"""Project store — backed by the database, so projects survive restarts and are
visible to admin and client across browsers/devices."""
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import Project


def list_projects() -> List[Dict]:
    with SessionLocal() as db:
        return [p.to_dict() for p in db.query(Project).all()]


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
