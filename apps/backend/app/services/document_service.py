"""Project document store — backed by the database. A document uploaded by a
client is visible to the admin in the project workspace, across browsers/devices.
(The file bytes themselves are not stored in this demo — only the record.)"""
from typing import Dict, List

from app.db import SessionLocal
from app.models import Document


def list_by_project(project_id: str) -> List[Dict]:
    with SessionLocal() as db:
        return [d.to_dict() for d in db.query(Document).filter(Document.projectId == project_id).all()]


def create_document(data: Dict) -> Dict:
    """Create a document record (idempotent upsert by id)."""
    with SessionLocal() as db:
        d = db.get(Document, data["id"])
        if d:
            for key, value in data.items():
                setattr(d, key, value)
        else:
            d = Document(**data)
            db.add(d)
        db.commit()
        return d.to_dict()


def delete_document(document_id: str) -> bool:
    with SessionLocal() as db:
        d = db.get(Document, document_id)
        if not d:
            return False
        db.delete(d)
        db.commit()
        return True
