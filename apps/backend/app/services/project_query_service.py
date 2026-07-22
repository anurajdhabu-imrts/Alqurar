"""Project query / RFI store — backed by the database, so the RFI register the
analyst builds (queries raised to the client / GIC, the responses received and
each query's Open/Closed status) survives restarts.

Rows get here one way: manual entry by the analyst (see the Queries tab in the
Project Workspace). No AI is involved and there is no hard-coded sample data.
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import ProjectQuery


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_by_project(project_id: str) -> List[Dict]:
    with SessionLocal() as db:
        rows = (
            db.query(ProjectQuery)
            .filter(ProjectQuery.projectId == project_id)
            .order_by(ProjectQuery.createdAt)
            .all()
        )
        return [q.to_dict() for q in rows]


def get_query(query_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        q = db.get(ProjectQuery, query_id)
        return q.to_dict() if q else None


def create_query(data: Dict) -> Dict:
    """Create a query (RFI). The serial number ("Sl.") is derived on the client
    from row order, so nothing is stored for it here."""
    data = dict(data)
    with SessionLocal() as db:
        if not data.get("id"):
            data["id"] = f"q-{int(time.time() * 1000)}"
        data.setdefault("createdAt", _now())
        data["updatedAt"] = _now()
        q = ProjectQuery(**data)
        db.add(q)
        db.commit()
        return q.to_dict()


def update_query(query_id: str, patch: Dict) -> Optional[Dict]:
    """Apply a partial edit; only provided (non-None) fields change."""
    with SessionLocal() as db:
        q = db.get(ProjectQuery, query_id)
        if not q:
            return None
        for key, value in patch.items():
            if value is not None:
                setattr(q, key, value)
        q.updatedAt = _now()
        db.commit()
        return q.to_dict()


def delete_query(query_id: str) -> bool:
    with SessionLocal() as db:
        q = db.get(ProjectQuery, query_id)
        if not q:
            return False
        db.delete(q)
        db.commit()
        return True
