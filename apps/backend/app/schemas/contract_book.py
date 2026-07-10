from typing import List, Optional

from pydantic import BaseModel


class ContractBookOut(BaseModel):
    """A standard contract book card in the Knowledge Center. The file bytes are
    never returned here — only via the download route."""

    id: str
    name: str
    edition: str
    publisher: Optional[str] = None
    fileName: str
    sizeKB: int
    mime: Optional[str] = None
    uploadedAt: str
    uploadedBy: str
    # "pending" | "processing" | "done" | "failed"
    status: str
    error: Optional[str] = None
    clauseCount: int
    processedChunks: int
    totalChunks: int


class BookClauseOut(BaseModel):
    id: str
    bookId: str
    clause_number: str
    clause_title: str
    clause_text: str
    summary: str
    tags: List[str] = []
    sortIndex: int = 0
    createdAt: Optional[str] = None


class BookClauseSearchResult(BookClauseOut):
    """A clause hit from the cross-book search, carrying the book it came from so
    results stay attributable when several books match."""

    bookName: str = ""
    bookEdition: str = ""
