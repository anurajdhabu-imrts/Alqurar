"""Background clause extraction for a Knowledge Center contract book.

A standard form like the FIDIC Red Book runs to hundreds of pages. Because the
Knowledge Center keeps each clause's wording VERBATIM (not just a summary), the
book cannot be extracted in one model call — the response would exceed the output
token budget long before the book ended. So the text is split into overlapping
chunks, each chunk is read concurrently by Claude, and the clauses are merged back
into document order.

Status lives on the contract_books row (not in memory) so progress survives a
restart and the UI can simply poll the book list. All blocking work — loading the
bytes, extracting text, writing rows — runs in worker threads so the single event
loop stays responsive.
"""
import asyncio
import logging
import os
from typing import Dict, List, Optional, Tuple

import anthropic

from app.services import contract_book_service as books
from app.services.ai_service import extract_book_clauses
from app.services.document_extract import extract_text

logger = logging.getLogger("book_extraction")

_NOT_CONFIGURED = (
    "AI extraction is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)

# A whole book is read end-to-end, so this is far larger than the per-document cap.
_BOOK_MAX_CHARS = int(os.getenv("BOOK_MAX_CHARS", "600000"))

# Chunk size is bounded by the OUTPUT budget, not the input: the model echoes each
# clause verbatim, so a chunk's clauses are roughly as long as the chunk itself.
# ~30k chars in ≈ ~8k tokens out, comfortably inside the 16k max_tokens.
_CHUNK_CHARS = int(os.getenv("BOOK_CHUNK_CHARS", "30000"))

# Chunks overlap so a clause straddling a boundary is seen whole by the later
# chunk. The prompt tells the model to skip clauses cut off at the start of an
# excerpt, and dedupe below catches anything that slips through.
_OVERLAP_CHARS = int(os.getenv("BOOK_CHUNK_OVERLAP", "2000"))

# Bounds in-flight model calls across ALL books being extracted at once.
_sem = asyncio.Semaphore(int(os.getenv("BOOK_EXTRACTION_CONCURRENCY", "3")))


def _chunk(text: str) -> List[str]:
    """Split the book into overlapping chunks, breaking on line boundaries so a
    chunk rarely starts or ends mid-sentence."""
    if len(text) <= _CHUNK_CHARS:
        return [text]

    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + _CHUNK_CHARS, len(text))
        if end < len(text):
            # Back off to the last line break in the final 10% of the window.
            window = text.rfind("\n", start + int(_CHUNK_CHARS * 0.9), end)
            if window > start:
                end = window
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - _OVERLAP_CHARS, start + 1)
    return chunks


def _load(book_id: str) -> Tuple[Optional[Dict], str]:
    """Blocking: load the book row + its extracted text (run in a thread)."""
    book = books.get_book(book_id)
    if not book:
        return None, ""
    stored = books.get_book_file(book_id)
    if not stored:
        return book, ""
    data, filename, _mime = stored
    text, _truncated = extract_text(filename, data, max_chars=_BOOK_MAX_CHARS)
    return book, text


def _key(clause: Dict) -> str:
    """Dedupe key: the clause number, normalised ('4.12.' == ' 4.12')."""
    return (clause.get("clause_number") or "").strip().rstrip(".").lower()


def _merge(chunk_results: List[List[Dict]]) -> List[Dict]:
    """Flatten per-chunk clauses into one list in document order, de-duplicating
    the overlap. When the same clause number appears twice, the copy with the
    longer verbatim text wins (the other was cut off at a chunk boundary), but it
    keeps the position of its first appearance."""
    ordered: List[Dict] = []
    seen: Dict[str, int] = {}
    for clauses in chunk_results:
        for clause in clauses:
            key = _key(clause)
            if not key:
                continue
            if key in seen:
                existing = ordered[seen[key]]
                if len(clause.get("clause_text") or "") > len(existing.get("clause_text") or ""):
                    ordered[seen[key]] = clause
                continue
            seen[key] = len(ordered)
            ordered.append(clause)
    return ordered


async def _run_chunk(book: Dict, chunk: str, part: int, total: int) -> List[Dict]:
    """Extract one chunk. A single failed chunk must not sink the whole book, so
    it is logged and yields no clauses."""
    async with _sem:
        try:
            clauses = await extract_book_clauses(
                text=chunk,
                book_name=book["name"],
                edition=book.get("edition"),
                part=part,
                of=total,
            )
        except (anthropic.AuthenticationError, anthropic.APIStatusError):
            raise
        except Exception:  # noqa: BLE001 — one bad chunk shouldn't lose the book
            logger.exception("Book %s: chunk %d/%d failed", book["id"], part, total)
            clauses = []

    await asyncio.to_thread(books.bump_progress, book["id"])
    return clauses


async def run_extraction(book_id: str) -> None:
    """Read a book end-to-end and replace its clause library. Records status on
    the book row throughout, so the UI can poll without a side channel."""
    try:
        if not os.getenv("ANTHROPIC_API_KEY"):
            await asyncio.to_thread(books.set_status, book_id, "failed", error=_NOT_CONFIGURED)
            return

        await asyncio.to_thread(
            books.set_status, book_id, "processing", processed_chunks=0, total_chunks=0
        )

        book, text = await asyncio.to_thread(_load, book_id)
        if not book:
            return  # deleted while queued
        if not text or not text.strip():
            await asyncio.to_thread(
                books.set_status,
                book_id,
                "failed",
                error=(
                    "Couldn't read any text from this book — it may be a scanned PDF "
                    "or an unsupported format."
                ),
            )
            return

        chunks = _chunk(text)
        await asyncio.to_thread(
            books.set_status, book_id, "processing", total_chunks=len(chunks), processed_chunks=0
        )

        results = await asyncio.gather(
            *(_run_chunk(book, c, i + 1, len(chunks)) for i, c in enumerate(chunks))
        )

        merged = _merge(results)
        if not merged:
            await asyncio.to_thread(
                books.set_status,
                book_id,
                "failed",
                error="No clauses could be extracted from this book.",
                clause_count=0,
            )
            return

        count = await asyncio.to_thread(books.replace_book_clauses, book_id, merged)
        await asyncio.to_thread(books.set_status, book_id, "done", clause_count=count)

    except anthropic.AuthenticationError:
        await asyncio.to_thread(books.set_status, book_id, "failed", error=_NOT_CONFIGURED)
    except anthropic.APIStatusError as e:
        await asyncio.to_thread(
            books.set_status, book_id, "failed", error=f"AI provider error ({e.status_code})."
        )
    except Exception as e:  # noqa: BLE001 — record any failure so the UI isn't stuck
        logger.exception("Book %s: extraction failed", book_id)
        await asyncio.to_thread(books.set_status, book_id, "failed", error=str(e)[:500])


async def run_many(book_ids: List[str]) -> None:
    """Re-queue books left mid-extraction by a restart."""
    await asyncio.gather(*(run_extraction(b) for b in book_ids), return_exceptions=True)
