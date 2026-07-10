"""Knowledge Center API — the central library of standard contract books.

    GET    /knowledge/books                  list the books (cards)
    POST   /knowledge/books                  upload a book; AI extraction starts
    GET    /knowledge/books/{id}             one book
    DELETE /knowledge/books/{id}             remove a book and its clauses
    POST   /knowledge/books/{id}/reextract   re-run AI extraction
    GET    /knowledge/books/{id}/clauses     that book's clauses, in book order
    GET    /knowledge/books/{id}/download    the original file
    GET    /knowledge/clauses                search clauses across all books

Reading is open to anyone who can view contracts; uploading and deleting need the
same `contracts.manage` permission that governs project clause libraries.

This module is the standard-form repository. It is intentionally separate from
`project_clauses.py`, which manages one project's own clause library.
"""
import os
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.api.v1.deps import get_current_user, require_permission
from app.schemas.contract_book import BookClauseOut, BookClauseSearchResult, ContractBookOut
from app.services import book_clause_extraction, contract_book_service as books

router = APIRouter()

_MANAGE = require_permission("contracts.manage")

# Formats document_extract can pull text from. A scanned PDF will still fail at
# extraction time (and say so), but this stops obvious mistakes at the door.
_ALLOWED_EXTS = {"pdf", "doc", "docx", "txt", "md", "rtf"}


def _require_book(book_id: str) -> dict:
    book = books.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")
    return book


def _queue_extraction(background: BackgroundTasks, book_id: str) -> str:
    """Kick off background extraction, or explain why it can't run yet."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        books.set_status(
            book_id,
            "failed",
            error=(
                "Book saved. AI clause extraction will run once ANTHROPIC_API_KEY is "
                "set in apps/backend/.env."
            ),
        )
        return "Book saved. AI clause extraction is not configured yet."
    background.add_task(book_clause_extraction.run_extraction, book_id)
    return "Book saved. Claude is reading it and extracting the clauses…"


@router.get("/books", response_model=List[ContractBookOut])
async def list_books(_=Depends(get_current_user)):
    return books.list_books()


@router.post("/books", response_model=ContractBookOut, status_code=status.HTTP_201_CREATED)
async def upload_book(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    edition: str = Form(""),
    publisher: str = Form(""),
    current_user=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    """Upload a standard contract book. It is stored, then read by Claude in the
    background; poll `GET /knowledge/books` for `status` and `clauseCount`."""
    if not name.strip():
        raise HTTPException(status_code=400, detail="Book name is required.")

    filename = file.filename or "book.pdf"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type “.{ext}”. Upload a PDF, Word or text document.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    book = books.create_book({
        "name": name.strip(),
        "edition": edition.strip(),
        "publisher": publisher.strip() or None,
        "fileName": filename,
        "sizeKB": max(1, round(len(content) / 1024)),
        "mime": file.content_type or "application/octet-stream",
        "data": content,
        "uploadedBy": current_user.get("name") or current_user.get("email") or "",
    })

    _queue_extraction(background, book["id"])
    return books.get_book(book["id"])


@router.get("/clauses", response_model=List[BookClauseSearchResult])
async def search_clauses(
    q: Optional[str] = None,
    bookId: Optional[str] = None,
    clauseNumber: Optional[str] = None,
    title: Optional[str] = None,
    limit: int = 300,
    _=Depends(get_current_user),
):
    """Search clauses across every book. All supplied filters are ANDed:
    `bookId` scopes to one book, `clauseNumber` matches a number prefix (e.g.
    "4.12" or just "4."), `title` matches the heading, and `q` is a free-text
    keyword search over the number, title, verbatim text and summary."""
    rows = books.search_clauses(
        book_id=bookId,
        clause_number=clauseNumber,
        title=title,
        q=q,
        limit=max(1, min(limit, 1000)),
    )
    # Attribute each hit to its book so mixed-book results stay readable.
    by_id = {b["id"]: b for b in books.list_books()}
    return [
        {**r, "bookName": by_id.get(r["bookId"], {}).get("name", ""),
         "bookEdition": by_id.get(r["bookId"], {}).get("edition", "")}
        for r in rows
    ]


@router.get("/books/{book_id}", response_model=ContractBookOut)
async def get_book(book_id: str, _=Depends(get_current_user)):
    return _require_book(book_id)


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_book(book_id: str, _=Depends(get_current_user), __=Depends(_MANAGE)):
    if not books.delete_book(book_id):
        raise HTTPException(status_code=404, detail="Book not found.")


@router.post("/books/{book_id}/reextract", response_model=ContractBookOut)
async def reextract_book(
    book_id: str,
    background: BackgroundTasks,
    _=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    """Re-run extraction on a book already on file (e.g. after a failure). The
    stored bytes are reused — no re-upload needed."""
    book = _require_book(book_id)
    # "pending" counts as busy: a book is queued before its task starts, so two
    # rapid clicks would otherwise both queue an extraction of the same book.
    if book["status"] in ("pending", "processing"):
        raise HTTPException(status_code=409, detail="This book is already being processed.")

    books.set_status(book_id, "pending", processed_chunks=0, total_chunks=0)
    _queue_extraction(background, book_id)
    return books.get_book(book_id)


@router.get("/books/{book_id}/clauses", response_model=List[BookClauseOut])
async def list_book_clauses(book_id: str, _=Depends(get_current_user)):
    _require_book(book_id)
    return books.list_book_clauses(book_id)


@router.get("/books/{book_id}/download")
async def download_book(book_id: str, _=Depends(get_current_user)):
    _require_book(book_id)
    stored = books.get_book_file(book_id)
    if not stored:
        raise HTTPException(status_code=404, detail="No stored file for this book.")
    data, filename, mime = stored
    return StreamingResponse(
        iter([data]),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
