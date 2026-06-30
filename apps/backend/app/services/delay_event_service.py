"""Delay-event store — backed by the database, so events the analyst adds,
reviews (Accept / Merge / Reject), edits and deletes survive restarts.

Events get into the table two ways: manual entry by the analyst, or AI extraction
from the project's data-room documents (see `replace_project_events`, fed by
app.services.ai_service.extract_delay_events). There is no hard-coded sample data.
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import DelayEvent


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_by_project(project_id: str) -> List[Dict]:
    with SessionLocal() as db:
        rows = (
            db.query(DelayEvent)
            .filter(DelayEvent.projectId == project_id)
            .order_by(DelayEvent.ref)
            .all()
        )
        return [e.to_dict() for e in rows]


def get_event(event_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        return e.to_dict() if e else None


def _next_ref(db, project_id: str) -> str:
    """Next human reference for a project: DE-01, DE-02, ..."""
    count = db.query(DelayEvent).filter(DelayEvent.projectId == project_id).count()
    return f"DE-{count + 1:02d}"


def create_event(data: Dict) -> Dict:
    """Create or update a delay event (idempotent upsert by id)."""
    data = dict(data)
    with SessionLocal() as db:
        event_id = data.get("id")
        existing = db.get(DelayEvent, event_id) if event_id else None
        if existing:
            for key, value in data.items():
                if value is not None:
                    setattr(existing, key, value)
            existing.updatedAt = _now()
            db.commit()
            return existing.to_dict()

        if not event_id:
            data["id"] = f"de-{int(time.time() * 1000)}"
        if not data.get("ref"):
            data["ref"] = _next_ref(db, data["projectId"])
        data.setdefault("createdAt", _now())
        data["updatedAt"] = _now()
        e = DelayEvent(**data)
        db.add(e)
        db.commit()
        return e.to_dict()


def update_event(event_id: str, patch: Dict) -> Optional[Dict]:
    """Apply a partial edit; only provided (non-None) fields change."""
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        if not e:
            return None
        for key, value in patch.items():
            if value is not None:
                setattr(e, key, value)
        e.updatedAt = _now()
        db.commit()
        return e.to_dict()


def set_status(event_id: str, review_status: str) -> Optional[Dict]:
    """Accept / Merge / Reject — just the reviewStatus field."""
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        if not e:
            return None
        e.reviewStatus = review_status
        e.updatedAt = _now()
        db.commit()
        return e.to_dict()


def delete_event(event_id: str) -> bool:
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        if not e:
            return False
        db.delete(e)
        db.commit()
        return True


def replace_project_events(project_id: str, events: List[Dict]) -> List[Dict]:
    """Replace all of a project's delay events with a freshly-extracted set.

    Used by the AI extraction endpoint: it deletes the project's existing events
    (including any stale/sample rows) and inserts the new register, assigning ids
    and sequential refs (DE-01, DE-02, ...). Returns the stored events.
    """
    now = _now()
    with SessionLocal() as db:
        db.query(DelayEvent).filter(DelayEvent.projectId == project_id).delete()
        rows = []
        for i, data in enumerate(events, start=1):
            data = dict(data)
            data["projectId"] = project_id
            data["id"] = f"ai-{project_id}-{i:02d}-{int(time.time() * 1000)}"
            data.setdefault("ref", f"DE-{i:02d}")
            data["createdAt"] = now
            data["updatedAt"] = now
            row = DelayEvent(**data)
            db.add(row)
            rows.append(row)
        db.commit()
        return [r.to_dict() for r in rows]
