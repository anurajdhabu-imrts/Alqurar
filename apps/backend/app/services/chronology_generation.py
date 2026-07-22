"""Background per-event chronology generation.

For a project's EXISTING delay events, Claude reads the data-room documents and
builds a dated chronology for each event, keyed by the event's reference. Like
delay-event extraction, this reasons over the whole data room, so it runs as a
background job with in-memory, pollable per-project status. The generated
chronology replaces each event's `chronology` field (and links any newly-cited
document into the event's sources), so the result shows up in both the
Chronology tab and the Delay Events detail panel.
"""
import asyncio
import os
import uuid
from typing import Dict, List, Tuple

import anthropic

from app.services import delay_event_service, project_service  # noqa: F401
from app.services.ai_service import generate_event_chronologies
from app.services.delay_event_extraction import _load

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


def _map_chronology(
    items: List[dict], event_sources: List[dict], docs_by_name: dict
) -> Tuple[List[dict], List[dict]]:
    """Assign ids to chronology rows and resolve each to a source document.

    Returns (chronology, sources): `sources` is the event's existing sources
    augmented with any document a chronology row cites that wasn't already linked,
    so every row's `sourceId` resolves to a document name the tab can show.
    """
    sources = list(event_sources or [])
    by_name = {s.get("name"): s for s in sources}
    chronology: List[dict] = []
    for c in items:
        source_id = None
        name = (c.get("sourceDocument") or "").strip()
        if name:
            existing = by_name.get(name)
            if existing:
                source_id = existing.get("id")
            elif name in docs_by_name:
                doc = docs_by_name[name]
                source_id = doc["id"]
                new_src = {"id": doc["id"], "name": doc["name"], "type": doc["type"]}
                sources.append(new_src)
                by_name[name] = new_src
        chronology.append({
            "id": f"chr-{uuid.uuid4().hex[:8]}",
            "date": c.get("date", ""),
            "actor": c.get("actor", "Contractor"),
            "title": c.get("title", ""),
            "detail": c.get("detail") or None,
            "sourceId": source_id,
        })
    return chronology, sources


async def run_generation(project_id: str) -> None:
    """Generate a chronology for every delay event in a project. Records status."""
    async with _sem:
        _status[project_id] = {"status": "running"}
        try:
            if not os.getenv("ANTHROPIC_API_KEY"):
                _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
                return

            project, docs_for_ai, docs_by_name, _clauses = await asyncio.to_thread(_load, project_id)
            if not project:
                _status[project_id] = {"status": "failed", "error": "Project not found."}
                return
            events = await asyncio.to_thread(delay_event_service.list_by_project, project_id)
            if not events:
                _status[project_id] = {
                    "status": "failed",
                    "error": "No delay events yet — extract or add delay events first.",
                }
                return
            if not docs_for_ai:
                _status[project_id] = {
                    "status": "failed",
                    "error": "No documents in the data room yet — upload documents first.",
                }
                return

            results = await generate_event_chronologies(
                events=events,
                documents=docs_for_ai,
                project_name=project.get("name"),
                standard=project.get("standard"),
            )
            by_ref = {e.get("ref"): e for e in events}

            def _apply() -> int:
                updated = 0
                for r in results:
                    ev = by_ref.get(r.get("eventRef"))
                    if not ev:
                        continue
                    chronology, sources = _map_chronology(
                        r.get("chronology", []), ev.get("sources", []), docs_by_name
                    )
                    delay_event_service.update_event(
                        ev["id"], {"chronology": chronology, "sources": sources}
                    )
                    updated += 1
                return updated

            count = await asyncio.to_thread(_apply)
            _status[project_id] = {"status": "done", "count": count}
        except anthropic.AuthenticationError:
            _status[project_id] = {"status": "failed", "error": _NOT_CONFIGURED}
        except anthropic.APIStatusError as e:
            _status[project_id] = {"status": "failed", "error": f"AI provider error ({e.status_code})."}
        except Exception as e:  # noqa: BLE001
            _status[project_id] = {"status": "failed", "error": str(e)[:500]}
