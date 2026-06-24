"""Project ⇄ client assignment store — backed by the database.

Maps a project id to one or more client users, so an assignment an admin makes
is visible to a client who logs in separately (any device).
"""
import time
from datetime import datetime, timezone
from typing import Dict, List

from app.db import SessionLocal
from app.models import Assignment


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_assignments() -> List[Dict]:
    with SessionLocal() as db:
        return [a.to_dict() for a in db.query(Assignment).all()]


def project_ids_for_client(client_user_id: str) -> List[str]:
    """Distinct project ids assigned to a client (order preserved)."""
    seen: List[str] = []
    with SessionLocal() as db:
        rows = db.query(Assignment).filter(Assignment.client_user_id == client_user_id).all()
        for a in rows:
            if a.project_id not in seen:
                seen.append(a.project_id)
    return seen


def client_ids_for_project(project_id: str) -> List[str]:
    seen: List[str] = []
    with SessionLocal() as db:
        rows = db.query(Assignment).filter(Assignment.project_id == project_id).all()
        for a in rows:
            if a.client_user_id not in seen:
                seen.append(a.client_user_id)
    return seen


def assign_clients(project_id: str, client_user_ids: List[str], assigned_by: str) -> List[str]:
    """Assign one or more clients to a project (idempotent). Returns the project's
    full client id list after the change."""
    with SessionLocal() as db:
        for cid in client_user_ids:
            exists = (
                db.query(Assignment)
                .filter(Assignment.project_id == project_id, Assignment.client_user_id == cid)
                .first()
            )
            if not exists:
                db.add(
                    Assignment(
                        id=f"a-{int(time.time() * 1000)}-{cid}",
                        project_id=project_id,
                        client_user_id=cid,
                        assigned_by=assigned_by,
                        created_at=_now_iso(),
                    )
                )
        db.commit()
    return client_ids_for_project(project_id)


def unassign_client(project_id: str, client_user_id: str) -> bool:
    with SessionLocal() as db:
        rows = (
            db.query(Assignment)
            .filter(Assignment.project_id == project_id, Assignment.client_user_id == client_user_id)
            .all()
        )
        for a in rows:
            db.delete(a)
        db.commit()
        return len(rows) > 0
