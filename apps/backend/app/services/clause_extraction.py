"""Background clause extraction for a project's own Clause Library.

A contract uploaded in the project's Clause Library tab is read by Claude, which
drafts the clauses an EOT claim relies on. Reading the file and running the model
takes too long for an HTTP request, so it runs as a background job; per-project
status is held in memory and polled by the UI. All blocking work (loading the
file bytes, extracting text, writing rows) runs in worker threads so the single
event loop stays responsive.
"""
import asyncio
import logging
import os
import time
from typing import Dict, Optional, Tuple

import anthropic

from app.services import document_service, project_clause_service, project_service
from app.services.ai_service import (
    EXTRACTION_MODEL,
    extract_clauses,
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

# A contract is read end-to-end so the AI reaches the operative clauses (8.x EOT,
# 13.x variations, 20.x claims) that come AFTER the long definitions section — far
# more than the short per-document analysis cap. Override with CONTRACT_MAX_CHARS.
_CONTRACT_MAX_CHARS = int(os.getenv("CONTRACT_MAX_CHARS", "300000"))

# Below this many characters of embedded text, a PDF/image is treated as scanned
# and sent to OCR (Claude vision) instead of relying on the empty extraction.
_OCR_TEXT_THRESHOLD = 80


def get_status(project_id: str) -> dict:
    return _status.get(project_id, {"status": "idle"})


def mark_running(project_id: str) -> None:
    _status[project_id] = {"status": "running"}


def _load(project_id: str, document_id: str) -> Tuple[Optional[dict], bytes, str, Optional[str], str]:
    """Blocking: load the project + the contract's bytes/text (run in a thread).

    Returns (project, data, filename, mime, text). `data`/`mime` are kept so a
    scanned contract can be OCR'd afterwards on the event loop.
    """
    project = project_service.get_project(project_id)
    stored = document_service.get_document_file(document_id)
    if not stored:
        return project, b"", "", None, ""
    data, filename, mime = stored
    text, _truncated = extract_text(filename, data, max_chars=_CONTRACT_MAX_CHARS)
    return project, data, filename, mime, text


async def run_extraction(project_id: str, document_id: str) -> None:
    """Extract this project's clauses from the uploaded contract; record status.
    AI-extracted clauses are replaced each run; manually-added clauses are kept."""
    async with _sem:
        _status[project_id] = {"status": "running"}
        try:
            if not os.getenv("ANTHROPIC_API_KEY"):
                _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
                return

            project, data, filename, mime, text = await asyncio.to_thread(
                _load, project_id, document_id
            )
            if not project:
                _status[project_id] = {"status": "failed", "error": "Project not found."}
                return

            # A scanned or image-only contract yields little/no embedded text —
            # transcribe it with Claude vision instead (same path as the PCC).
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            raw_chars = len((text or "").strip())
            t0 = time.monotonic()
            if raw_chars < _OCR_TEXT_THRESHOLD and is_ocr_candidate(filename):
                if ext == "pdf":
                    text, _ocr_err = await ocr_pdf_pages(
                        data, max_chars=_CONTRACT_MAX_CHARS, model=EXTRACTION_MODEL
                    )
                    if not text.strip():
                        text = await ocr_document(data, filename, mime, model=EXTRACTION_MODEL)
                else:
                    text = await ocr_document(data, filename, mime, model=EXTRACTION_MODEL)
                logger.info(
                    "Clause extraction: OCR took %.1fs, extracted_chars=%d (project=%s file=%s)",
                    time.monotonic() - t0, len((text or "").strip()), project_id, filename,
                )

            if not text or not text.strip():
                _status[project_id] = {
                    "status": "failed",
                    "error": "Couldn't read any text from the contract (it may be a scan "
                    "that OCR couldn't read, or an unsupported format). Try a PDF or "
                    "Word (.docx) file.",
                }
                return

            t0 = time.monotonic()
            raw_clauses = await extract_clauses(
                text=text,
                filename=filename,
                standard=project.get("standard"),
                project_name=project.get("name"),
            )
            logger.info(
                "Clause extraction: model took %.1fs, clauses=%d (project=%s)",
                time.monotonic() - t0, len(raw_clauses), project_id,
            )
            stored = await asyncio.to_thread(
                project_clause_service.replace_ai_clauses, project_id, raw_clauses
            )
            _status[project_id] = {
                "status": "done",
                "count": len(stored),
                "modified": sum(1 for c in stored if c.get("modified")),
            }
        except anthropic.AuthenticationError:
            _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
        except anthropic.APIStatusError as e:
            _status[project_id] = {"status": "failed", "error": f"AI provider error ({e.status_code})."}
        except Exception as e:  # noqa: BLE001 — record any failure so the UI isn't stuck
            _status[project_id] = {"status": "failed", "error": str(e)[:500]}
