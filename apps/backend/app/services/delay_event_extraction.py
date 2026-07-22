"""Background delay-event extraction.

Reading the whole data room and running the model takes too long to do inside an
HTTP request, so extraction runs as a background job. Per-project status is held
in memory and polled by the UI. All blocking work (loading file bytes, extracting
text, writing events) runs in worker threads so the event loop stays responsive.
"""
import asyncio
import os
import uuid
from typing import Dict, List, Optional, Tuple

import anthropic

from app.services import (
    delay_event_service,
    document_service,
    project_clause_service,
    project_service,
)
from app.services.ai_service import extract_delay_events
from app.services.document_extract import extract_text

# projectId -> {"status": "idle"|"running"|"done"|"failed", "error"?, "count"?}
_status: Dict[str, dict] = {}
_sem = asyncio.Semaphore(int(os.getenv("EXTRACTION_CONCURRENCY", "2")))

_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)


def get_status(project_id: str) -> dict:
    return _status.get(project_id, {"status": "idle"})


def mark_running(project_id: str) -> None:
    _status[project_id] = {"status": "running"}


def _map_event(raw: dict, docs_by_name: dict) -> dict:
    """Map an AI-extracted event onto the stored DelayEvent shape.

    Resolves `sourceDocuments` filenames to real document source records and
    assigns ids to chronology rows; drops fields the table doesn't store.
    """
    sources = []
    for name in raw.get("sourceDocuments", []):
        doc = docs_by_name.get(name)
        if doc:
            sources.append({"id": doc["id"], "name": doc["name"], "type": doc["type"]})
        else:
            sources.append({"id": f"src-{uuid.uuid4().hex[:8]}", "name": name, "type": "Other"})

    chronology = []
    for c in raw.get("chronology", []):
        chronology.append({
            "id": f"chr-{uuid.uuid4().hex[:8]}",
            "date": c.get("date", ""),
            "actor": c.get("actor", "Contractor"),
            "title": c.get("title", ""),
            "detail": c.get("detail") or None,
        })

    return {
        "title": raw.get("title", ""),
        "category": raw.get("category", ""),
        "narrative": raw.get("narrative", ""),
        "cause": raw.get("cause", "Employer"),
        "clause": raw.get("clause", ""),
        "startDate": raw.get("startDate", ""),
        "endDate": raw.get("endDate", ""),
        "daysImpact": int(raw.get("daysImpact", 0) or 0),
        "criticalPath": bool(raw.get("criticalPath", False)),
        "admissibility": raw.get("admissibility", "Not assessed"),
        "aiConfidence": int(raw.get("aiConfidence", 0) or 0),
        "reviewStatus": "Pending",
        "sources": sources,
        "chronology": chronology,
    }


def _load(project_id: str) -> Tuple[Optional[dict], List[dict], dict, List[dict]]:
    """Blocking: load the project + every document's text (run in a thread).

    Reuses the text cached during analysis (incl. OCR) and only reads bytes for
    documents that haven't been analysed yet — so extraction is fast and never
    re-OCRs. Also loads the project's Clause Library so extracted events cite
    those exact clauses.
    """
    project = project_service.get_project(project_id)
    docs_for_ai: List[dict] = []
    docs_by_name: dict = {}
    for doc_id, name, doc_type, cached in document_service.list_text_sources(project_id):
        if cached and cached.strip():
            text = cached
        else:
            stored = document_service.get_document_file(doc_id)
            text = extract_text(stored[1], stored[0])[0] if stored else ""
        docs_for_ai.append({"name": name, "type": doc_type, "text": text, "truncated": False})
        docs_by_name[name] = {"id": doc_id, "name": name, "type": doc_type}
    clauses = project_clause_service.list_by_project(project_id)
    return project, docs_for_ai, docs_by_name, clauses


async def run_extraction(project_id: str) -> None:
    """Extract delay events for a project and replace its register. Records status."""
    async with _sem:
        _status[project_id] = {"status": "running"}
        try:
            if not os.getenv("ANTHROPIC_API_KEY"):
                _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
                return

            project, docs_for_ai, docs_by_name, clauses = await asyncio.to_thread(_load, project_id)
            if not project:
                _status[project_id] = {"status": "failed", "error": "Project not found."}
                return
            if not docs_for_ai:
                _status[project_id] = {
                    "status": "failed",
                    "error": "No documents in the data room yet — upload documents first.",
                }
                return

            raw_events = await extract_delay_events(
                documents=docs_for_ai,
                standard=project.get("standard"),
                project_name=project.get("name"),
                clauses=clauses,
            )
            mapped = [_map_event(ev, docs_by_name) for ev in raw_events]
            stored = await asyncio.to_thread(
                delay_event_service.replace_project_events, project_id, mapped
            )
            _status[project_id] = {"status": "done", "count": len(stored)}
        except anthropic.AuthenticationError:
            _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
        except anthropic.APIStatusError as e:
            _status[project_id] = {"status": "failed", "error": f"AI provider error ({e.status_code})."}
        except Exception as e:  # noqa: BLE001
            _status[project_id] = {"status": "failed", "error": str(e)[:500]}
