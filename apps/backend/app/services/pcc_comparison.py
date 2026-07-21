"""Background Particular-Conditions (PCC) comparison for a project's Clause Library.

A project picks a base standard form (General Conditions) from the Knowledge
Center — its clauses are copied into the project's library. The analyst may then
upload the project's PARTICULAR CONDITIONS OF CONTRACT (PCC), which amend some of
those base sub-clauses. Claude reads the PCC, works out which base clauses it
changes, and those clauses are flagged "Modified" with a note and updated wording.

Like clause extraction, reading the file and running the model is too slow for an
HTTP request, so it runs as a background job. Per-project status is held in memory
and polled by the UI; all blocking work runs in worker threads.
"""
import asyncio
import logging
import os
import time
from typing import Dict

import anthropic

from app.services import document_service, project_clause_service, project_service
from app.services.ai_service import (
    EXTRACTION_MODEL,
    compare_pcc_to_book,
    ocr_document,
    ocr_pdf_pages,
)
from app.services.document_extract import extract_text, is_ocr_candidate

logger = logging.getLogger(__name__)

# projectId -> {"status": "idle"|"running"|"done"|"failed", "error"?, "count"?}
_status: Dict[str, dict] = {}
_sem = asyncio.Semaphore(int(os.getenv("CLAUSE_EXTRACTION_CONCURRENCY", "2")))

_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)

# Particular Conditions are read end-to-end so every amendment is reached. They
# are far shorter than a whole contract, but keep the same generous cap.
_PCC_MAX_CHARS = int(os.getenv("PCC_MAX_CHARS", "300000"))

# Below this many characters of embedded text, a PDF/image is treated as scanned
# and sent to OCR (Claude vision) instead of relying on the empty extraction.
_OCR_TEXT_THRESHOLD = 80


def get_status(project_id: str) -> dict:
    return _status.get(project_id, {"status": "idle"})


def mark_running(project_id: str) -> None:
    _status[project_id] = {"status": "running"}


def mark_idle(project_id: str) -> None:
    """Reset status — e.g. when a new base book clears any prior comparison."""
    _status.pop(project_id, None)


def _load(project_id: str, document_id: str):
    """Blocking: load the project, the PCC bytes/text and the base clauses.

    Returns (project, base_clauses, data, filename, mime, text). `data`/`mime` are
    kept so an image-only ("scanned") PCC can be OCR'd afterwards on the event loop.
    """
    project = project_service.get_project(project_id)
    base_clauses = project_clause_service.list_book_sourced_clauses(project_id)
    stored = document_service.get_document_file(document_id)
    if not stored:
        return project, base_clauses, b"", "", None, ""
    data, filename, mime = stored
    text, _truncated = extract_text(filename, data, max_chars=_PCC_MAX_CHARS)
    return project, base_clauses, data, filename, mime, text


async def run_comparison(project_id: str, document_id: str) -> None:
    """Compare the uploaded PCC against the project's base book clauses and flag
    the clauses it modifies; record status for the polling UI."""
    async with _sem:
        _status[project_id] = {"status": "running"}
        try:
            if not os.getenv("ANTHROPIC_API_KEY"):
                _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
                return

            project, base_clauses, data, filename, mime, text = await asyncio.to_thread(
                _load, project_id, document_id
            )
            if not project:
                _status[project_id] = {"status": "failed", "error": "Project not found."}
                return
            if not base_clauses:
                _status[project_id] = {
                    "status": "failed",
                    "error": "Select a base contract book first — there are no base clauses to compare against.",
                }
                return

            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            raw_chars = len((text or "").strip())
            ocr_used = False
            logger.info(
                "PCC compare: project=%s file=%s ext=%s bytes=%d extracted_chars=%d",
                project_id, filename, ext, len(data or b""), raw_chars,
            )

            # A scanned or image-only PDF (or an image file) yields little/no
            # embedded text — transcribe it with Claude vision instead. For PDFs
            # we render page-by-page (handles scans of any length, past the API's
            # whole-PDF page/size limits); images go through the direct OCR path.
            # OCR runs on the extraction model (the one proven enabled for this
            # account), not the lighter analysis model.
            ocr_err = ""
            t0 = time.monotonic()
            if raw_chars < _OCR_TEXT_THRESHOLD and is_ocr_candidate(filename):
                ocr_used = True
                if ext == "pdf":
                    text, ocr_err = await ocr_pdf_pages(
                        data, max_chars=_PCC_MAX_CHARS, model=EXTRACTION_MODEL
                    )
                    # Last-resort: whole-file document OCR if page rendering yielded nothing.
                    if not text.strip():
                        fallback = await ocr_document(data, filename, mime, model=EXTRACTION_MODEL)
                        if fallback.strip():
                            text, ocr_err = fallback, ""
                else:
                    text = await ocr_document(data, filename, mime, model=EXTRACTION_MODEL)
                    if not text.strip():
                        ocr_err = "vision OCR produced no text"
                logger.info(
                    "PCC compare: OCR took %.1fs, extracted_chars=%d",
                    time.monotonic() - t0, len((text or "").strip()),
                )

            if not text or not text.strip():
                logger.warning(
                    "PCC compare: no text for project=%s file=%s ext=%s ocr_err=%s",
                    project_id, filename, ext, ocr_err,
                )
                kb = round(len(data or b"") / 1024)
                # Surface the specifics in the banner so the cause is diagnosable
                # without needing the server log.
                if ext == "doc":
                    hint = "Legacy .doc files aren't supported — open it in Word and Save As .docx or PDF."
                elif ocr_used:
                    hint = "OCR couldn't read this scan"
                    if ocr_err:
                        hint += f" ({ocr_err})"
                    hint += "."
                else:
                    hint = "No selectable text found. Try a PDF or Word (.docx) file with selectable text."
                _status[project_id] = {
                    "status": "failed",
                    "error": f"Couldn't read any text from the Particular Conditions ({filename}, {ext or 'no ext'}, {kb} KB). {hint}",
                }
                return

            t0 = time.monotonic()
            result = await compare_pcc_to_book(
                base_clauses=base_clauses,
                pcc_text=text,
                filename=filename,
                standard=project.get("standard"),
            )
            logger.info(
                "PCC compare: model comparison took %.1fs (modifications=%d additions=%d)",
                time.monotonic() - t0,
                len(result.get("modifications", [])),
                len(result.get("additions", [])),
            )
            counts = await asyncio.to_thread(
                project_clause_service.apply_pcc_modifications,
                project_id,
                result.get("modifications", []),
                result.get("additions", []),
            )
            _status[project_id] = {
                "status": "done",
                "count": counts["modified"] + counts["added"],
                "modified": counts["modified"],
                "added": counts["added"],
            }
        except anthropic.AuthenticationError:
            _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
        except anthropic.APIStatusError as e:
            _status[project_id] = {"status": "failed", "error": f"AI provider error ({e.status_code})."}
        except Exception as e:  # noqa: BLE001 — record any failure so the UI isn't stuck
            _status[project_id] = {"status": "failed", "error": str(e)[:500]}
