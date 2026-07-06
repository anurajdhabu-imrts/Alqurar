"""Project store — backed by the database, so projects survive restarts and are
visible to admin and client across browsers/devices."""
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import Project


def list_projects(kind: Optional[str] = None) -> List[Dict]:
    """All projects, optionally filtered by kind ("project" or "proposal").

    Legacy rows created before the `kind` column existed are treated as
    ordinary projects (kind is null → "project")."""
    with SessionLocal() as db:
        rows = db.query(Project).all()
        out = [p.to_dict() for p in rows]
    for d in out:
        d["kind"] = d.get("kind") or "project"
    if kind:
        out = [d for d in out if d["kind"] == kind]
    return out


def get_project(project_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        p = db.get(Project, project_id)
        return p.to_dict() if p else None


def create_project(data: Dict) -> Dict:
    """Create or update a project (idempotent upsert by id)."""
    with SessionLocal() as db:
        p = db.get(Project, data["id"])
        if p:
            for key, value in data.items():
                setattr(p, key, value)
        else:
            p = Project(**data)
            db.add(p)
        db.commit()
        return p.to_dict()


def delete_project(project_id: str) -> bool:
    with SessionLocal() as db:
        p = db.get(Project, project_id)
        if not p:
            return False
        db.delete(p)
        db.commit()
        return True
