from typing import List

from pydantic import BaseModel


class DocumentAnalysis(BaseModel):
    """Structured result of analysing a single uploaded document."""

    document_type: str
    title: str
    summary: str
    relevance_to_claim: str
    supports_eot: bool
    key_points: List[str]
    parties: List[str]
    key_dates: List[str]
    confidence: int


class DocumentAnalysisOut(DocumentAnalysis):
    """API response — the analysis plus a little metadata about the source."""

    filename: str
    extracted_chars: int
    truncated: bool
    model: str
