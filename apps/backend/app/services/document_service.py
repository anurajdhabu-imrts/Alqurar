"""Project document store — backed by the database. A document uploaded by a
client is visible to the admin in the project workspace, across browsers/devices.
The actual file bytes are stored in the `data` column so uploads persist and can
be downloaded again."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.db import SessionLocal
from app.models import Document, DocumentComment


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
        # Remove any comments attached to this document too.
        db.query(DocumentComment).filter(DocumentComment.documentId == document_id).delete()
        db.delete(d)
        db.commit()
        return True


# ── Document comments ──────────────────────────────────────────────────────

def list_comments(document_id: str) -> List[Dict]:
    """All comments for a document, oldest first."""
    with SessionLocal() as db:
        rows = (
            db.query(DocumentComment)
            .filter(DocumentComment.documentId == document_id)
            .order_by(DocumentComment.createdAt.asc())
            .all()
        )
        return [c.to_dict() for c in rows]


def add_comment(
    document_id: str,
    body: str,
    author: str = "",
    author_id: Optional[str] = None,
    anchor_text: Optional[str] = None,
    anchor_start: Optional[int] = None,
    anchor_length: Optional[int] = None,
) -> Dict:
    """Attach a new comment to a document and return it. May carry a text anchor."""
    with SessionLocal() as db:
        doc = db.get(Document, document_id)
        comment = DocumentComment(
            id=f"cmt-{uuid.uuid4().hex[:12]}",
            documentId=document_id,
            projectId=doc.projectId if doc else "",
            body=body,
            author=author or "",
            authorId=author_id,
            createdAt=datetime.now(timezone.utc).isoformat(),
            anchorText=anchor_text,
            anchorStart=anchor_start,
            anchorLength=anchor_length,
        )
        db.add(comment)
        db.commit()
        return comment.to_dict()


def update_comment(comment_id: str, body: str) -> Optional[Dict]:
    """Update a comment's text and return it, or None if not found."""
    with SessionLocal() as db:
        c = db.get(DocumentComment, comment_id)
        if not c:
            return None
        c.body = body
        db.commit()
        return c.to_dict()


def delete_comment(comment_id: str) -> bool:
    with SessionLocal() as db:
        c = db.get(DocumentComment, comment_id)
        if not c:
            return False
        db.delete(c)
        db.commit()
        return True
