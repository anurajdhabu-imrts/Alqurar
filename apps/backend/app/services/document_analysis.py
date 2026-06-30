"""Background document analysis.

Runs Claude classification off the request path so uploads return instantly and
hundreds of documents can be processed without any single HTTP call blocking.

Critical for responsiveness: the backend runs on one event loop with a synchronous
(psycopg2) DB layer, so *all* blocking work here — loading the file bytes (which can
be tens of MB) and extracting text (pypdf etc.) — is pushed to worker threads via
asyncio.to_thread. Only the async model call runs on the loop, so other requests
(e.g. login) stay responsive even while many documents analyse.
"""
import asyncio
import os
from typing import Optional, Tuple

import anthropic

from app.services import document_service, project_service
from app.services.ai_service import analyze_document, ocr_document
from app.services.document_extract import MAX_CHARS, extract_text, is_ocr_candidate

# Below this many characters, a PDF/image is treated as "scanned" and sent to OCR.
_OCR_TEXT_THRESHOLD = 80

# Cap concurrent model calls. Tune via ANALYSIS_CONCURRENCY for your rate limits.
_MAX_CONCURRENCY = int(os.getenv("ANALYSIS_CONCURRENCY", "5"))
_sem = asyncio.Semaphore(_MAX_CONCURRENCY)

_NOT_CONFIGURED = "AI analysis is not configured (ANTHROPIC_API_KEY not set)."


def _prepare(document_id: str) -> Optional[Tuple[bytes, str, Optional[str], str, str, bool]]:
    """Blocking: load the file bytes, look up the project, and extract embedded text.

    Runs in a worker thread. Returns (data, filename, standard, mime, text, truncated),
    or None if there is no stored file.
    """
    stored = document_service.get_document_file(document_id)  # lazy-loads the deferred bytes
    if not stored:
        return None
    data, filename, mime = stored
    doc = document_service.get_document(document_id)
    project = project_service.get_project(doc.get("projectId", "")) if doc else None
    standard = project.get("standard") if project else None
    text, truncated = extract_text(filename, data)
    return data, filename, standard, mime, text, truncated


async def run_analysis(document_id: str) -> None:
    """Analyse one document in the background and record the outcome on its row."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        await asyncio.to_thread(document_service.set_analysis_status, document_id, "failed", _NOT_CONFIGURED)
        return

    async with _sem:
        await asyncio.to_thread(document_service.set_analysis_status, document_id, "analyzing")
        try:
            prepared = await asyncio.to_thread(_prepare, document_id)
            if prepared is None:
                await asyncio.to_thread(document_service.set_analysis_status, document_id, "failed", "No stored file to analyse.")
                return
            data, filename, standard, mime, text, truncated = prepared

            # Scanned PDF / image with no embedded text → OCR it with Claude vision.
            if len(text.strip()) < _OCR_TEXT_THRESHOLD and is_ocr_candidate(filename):
                ocr_text = await ocr_document(data, filename, mime)
                if ocr_text:
                    text = ocr_text
                    truncated = len(text) >= MAX_CHARS

            # Cache the resolved text (incl. OCR) so event extraction reuses it.
            await asyncio.to_thread(document_service.set_extracted_text, document_id, text)

            analysis = await analyze_document(
                text=text, filename=filename, truncated=truncated, standard=standard,
            )
            await asyncio.to_thread(document_service.set_analysis, document_id, analysis.model_dump())
        except anthropic.AuthenticationError:
            await asyncio.to_thread(document_service.set_analysis_status, document_id, "failed", _NOT_CONFIGURED)
        except anthropic.APIStatusError as e:
            await asyncio.to_thread(document_service.set_analysis_status, document_id, "failed", f"AI provider error ({e.status_code}).")
        except Exception as e:  # noqa: BLE001 — record any failure so the row isn't stuck
            await asyncio.to_thread(document_service.set_analysis_status, document_id, "failed", str(e)[:500])


async def run_many(document_ids: list[str]) -> None:
    """Analyse several documents concurrently (the semaphore bounds the real fan-out)."""
    await asyncio.gather(*(run_analysis(d) for d in document_ids))
