"""Project document store — backed by the database. A document uploaded by a
client is visible to the admin in the project workspace, across browsers/devices.
The actual file bytes are stored in the `data` column so uploads persist and can
be downloaded again."""
from typing import Dict, List, Optional, Tuple

from app.db import SessionLocal
from app.models import Document


def list_by_project(project_id: str) -> List[Dict]:
    with SessionLocal() as db:
        return [d.to_dict() for d in db.query(Document).filter(Document.projectId == project_id).all()]


def get_document(document_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        d = db.get(Document, document_id)
        return d.to_dict() if d else None


def next_document_id() -> str:
    """Return the next sequential document id: doc-1, doc-2, doc-3, ...

    Looks at the highest existing doc-N number and adds 1, so ids stay short and
    readable instead of timestamp-based. Non-numeric/legacy ids are ignored.
    """
    with SessionLocal() as db:
        highest = 0
        for (doc_id,) in db.query(Document.id).all():
            if doc_id and doc_id.startswith("doc-"):
                suffix = doc_id[4:]
                # Ignore legacy timestamp ids (13-digit ms) — only count real
                # sequence numbers so they don't poison the counter.
                if suffix.isdigit() and int(suffix) < 1_000_000:
                    highest = max(highest, int(suffix))
        return f"doc-{highest + 1}"


def get_document_file(document_id: str) -> Optional[Tuple[bytes, str, str]]:
    """Return (bytes, filename, mime) for a stored document, or None."""
    with SessionLocal() as db:
        d = db.get(Document, document_id)
        if not d or d.data is None:
            return None
        return bytes(d.data), d.name or "file", d.mime or "application/octet-stream"


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
