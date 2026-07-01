"""Background clause extraction for a project's own Clause Library.

A contract uploaded in the project's Clause Library tab is read by Claude, which
drafts the clauses an EOT claim relies on. Reading the file and running the model
takes too long for an HTTP request, so it runs as a background job; per-project
status is held in memory and polled by the UI. All blocking work (loading the
file bytes, extracting text, writing rows) runs in worker threads so the single
event loop stays responsive.
"""
import asyncio
import os
from typing import Dict, Optional, Tuple

import anthropic

from app.services import document_service, project_clause_service, project_service
from app.services.ai_service import extract_clauses
from app.services.document_extract import extract_text

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


def get_status(project_id: str) -> dict:
    return _status.get(project_id, {"status": "idle"})


def mark_running(project_id: str) -> None:
    _status[project_id] = {"status": "running"}


def _load(project_id: str, document_id: str) -> Tuple[Optional[dict], str, str]:
    """Blocking: load the project + the contract's text (run in a thread)."""
    project = project_service.get_project(project_id)
    stored = document_service.get_document_file(document_id)
    if not stored:
        return project, "", ""
    data, filename, _mime = stored
    text, _truncated = extract_text(filename, data, max_chars=_CONTRACT_MAX_CHARS)
    return project, text, filename


async def run_extraction(project_id: str, document_id: str) -> None:
    """Extract this project's clauses from the uploaded contract; record status.
    AI-extracted clauses are replaced each run; manually-added clauses are kept."""
    async with _sem:
        _status[project_id] = {"status": "running"}
        try:
            if not os.getenv("ANTHROPIC_API_KEY"):
                _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
                return

            project, text, filename = await asyncio.to_thread(_load, project_id, document_id)
            if not project:
                _status[project_id] = {"status": "failed", "error": "Project not found."}
                return
            if not text or not text.strip():
                _status[project_id] = {
                    "status": "failed",
                    "error": "Couldn't read any text from the contract (it may be a scan or unsupported format).",
                }
                return

            raw_clauses = await extract_clauses(
                text=text,
                filename=filename,
                standard=project.get("standard"),
                project_name=project.get("name"),
            )
            stored = await asyncio.to_thread(
                project_clause_service.replace_ai_clauses, project_id, raw_clauses
            )
            _status[project_id] = {"status": "done", "count": len(stored)}
        except anthropic.AuthenticationError:
            _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
        except anthropic.APIStatusError as e:
            _status[project_id] = {"status": "failed", "error": f"AI provider error ({e.status_code})."}
        except Exception as e:  # noqa: BLE001 — record any failure so the UI isn't stuck
            _status[project_id] = {"status": "failed", "error": str(e)[:500]}
