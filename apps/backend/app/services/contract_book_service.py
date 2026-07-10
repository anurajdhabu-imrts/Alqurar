"""Knowledge Center store — standard contract books and their extracted clauses.

A ContractBook is a published standard form (FIDIC Red Book, NEC4, …) uploaded
once by an admin. Claude reads it and fills `book_clauses` with every clause it
finds, kept verbatim alongside a plain-language summary.

This is the central, project-independent repository. It is deliberately separate
from `project_clause_service`, which manages a single project's own clause
library built from that project's contract — the two must not be merged.
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import or_

from app.db import SessionLocal
from app.models import BookClause, ContractBook


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Books ───────────────────────────────────────────────────────────────────

def list_books() -> List[Dict]:
    """All books, newest first. Never loads the file bytes (they are deferred)."""
    with SessionLocal() as db:
        rows = db.query(ContractBook).order_by(ContractBook.uploadedAt.desc()).all()
        return [b.to_dict() for b in rows]


def get_book(book_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        b = db.get(ContractBook, book_id)
        return b.to_dict() if b else None


def create_book(data: Dict) -> Dict:
    """Store an uploaded book (including its bytes) as `pending` extraction."""
    with SessionLocal() as db:
        book = ContractBook(
            id=f"book-{uuid4().hex[:12]}",
            name=data["name"],
            edition=data.get("edition") or "",
            publisher=data.get("publisher") or None,
            fileName=data.get("fileName") or "",
            sizeKB=data.get("sizeKB") or 0,
            mime=data.get("mime"),
            data=data.get("data"),
            uploadedAt=_now_iso(),
            uploadedBy=data.get("uploadedBy") or "",
            status="pending",
            clauseCount=0,
            processedChunks=0,
            totalChunks=0,
        )
        db.add(book)
        db.commit()
        return book.to_dict()


def get_book_file(book_id: str) -> Optional[Tuple[bytes, str, str]]:
    """(bytes, filename, mime) for a stored book, or None. Loads the deferred
    column — call only when the bytes are actually needed."""
    with SessionLocal() as db:
        b = db.get(ContractBook, book_id)
        if not b or not b.data:
            return None
        return b.data, b.fileName or f"{b.name}.pdf", b.mime or "application/octet-stream"


def delete_book(book_id: str) -> bool:
    """Remove a book and every clause extracted from it."""
    with SessionLocal() as db:
        b = db.get(ContractBook, book_id)
        if not b:
            return False
        db.query(BookClause).filter(BookClause.bookId == book_id).delete(synchronize_session=False)
        db.delete(b)
        db.commit()
        return True


# ── Extraction lifecycle ────────────────────────────────────────────────────

def set_status(
    book_id: str,
    status: str,
    *,
    error: Optional[str] = None,
    total_chunks: Optional[int] = None,
    processed_chunks: Optional[int] = None,
    clause_count: Optional[int] = None,
) -> None:
    with SessionLocal() as db:
        b = db.get(ContractBook, book_id)
        if not b:
            return
        b.status = status
        b.error = error
        if total_chunks is not None:
            b.totalChunks = total_chunks
        if processed_chunks is not None:
            b.processedChunks = processed_chunks
        if clause_count is not None:
            b.clauseCount = clause_count
        db.commit()


def bump_progress(book_id: str) -> None:
    """Mark one more chunk as read, so the UI's progress bar advances live."""
    with SessionLocal() as db:
        b = db.get(ContractBook, book_id)
        if not b:
            return
        b.processedChunks = (b.processedChunks or 0) + 1
        db.commit()


def list_unfinished_book_ids() -> List[str]:
    """Books left mid-extraction by a restart, so they can be re-queued."""
    with SessionLocal() as db:
        rows = (
            db.query(ContractBook.id)
            .filter(ContractBook.status.in_(("pending", "processing")))
            .all()
        )
        return [r[0] for r in rows]


# ── Clauses ─────────────────────────────────────────────────────────────────

def replace_book_clauses(book_id: str, clauses: List[Dict]) -> int:
    """Swap in a fresh set of clauses for a book. Returns how many were stored.

    Called once at the end of extraction, so a re-run never leaves the library in
    a half-old/half-new state.
    """
    now = _now_iso()
    base = int(time.time() * 1000)
    with SessionLocal() as db:
        db.query(BookClause).filter(BookClause.bookId == book_id).delete(synchronize_session=False)
        rows = [
            BookClause(
                id=f"bcl-{base}-{i}",
                bookId=book_id,
                clause_number=c.get("clause_number") or "",
                clause_title=c.get("clause_title") or "",
                clause_text=c.get("clause_text") or "",
                summary=c.get("summary") or "",
                tags=list(c.get("tags") or []),
                sortIndex=i,
                createdAt=now,
            )
            for i, c in enumerate(clauses)
        ]
        db.add_all(rows)
        db.commit()
        return len(rows)


def list_book_clauses(book_id: str) -> List[Dict]:
    with SessionLocal() as db:
        rows = (
            db.query(BookClause)
            .filter(BookClause.bookId == book_id)
            .order_by(BookClause.sortIndex)
            .all()
        )
        return [c.to_dict() for c in rows]


def search_clauses(
    *,
    book_id: Optional[str] = None,
    clause_number: Optional[str] = None,
    title: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 300,
) -> List[Dict]:
    """Search clauses across the whole Knowledge Center.

    `book_id` scopes to one book; `clause_number` and `title` are prefix/substring
    filters on those fields; `q` is a free-text keyword match across the number,
    title, verbatim text and summary. All supplied filters are ANDed.
    """
    with SessionLocal() as db:
        query = db.query(BookClause)
        if book_id:
            query = query.filter(BookClause.bookId == book_id)
        if clause_number:
            query = query.filter(BookClause.clause_number.ilike(f"{clause_number.strip()}%"))
        if title:
            query = query.filter(BookClause.clause_title.ilike(f"%{title.strip()}%"))
        if q:
            like = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    BookClause.clause_number.ilike(like),
                    BookClause.clause_title.ilike(like),
                    BookClause.clause_text.ilike(like),
                    BookClause.summary.ilike(like),
                )
            )
        rows = query.order_by(BookClause.bookId, BookClause.sortIndex).limit(limit).all()
        return [c.to_dict() for c in rows]
