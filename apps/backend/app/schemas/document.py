from typing import List, Optional

from pydantic import BaseModel


class DocumentIn(BaseModel):
    """A document uploaded against a project. Stored server-side so a file the
    client uploads is visible to the admin in the project workspace (and vice
    versa), across browsers/devices."""

    id: str
    projectId: str
    name: str
    type: str = "Other"
    sizeKB: int = 0
    uploadedAt: str
    uploadedBy: str = ""
    status: str = "Uploaded"
    claimRef: Optional[str] = None
    note: Optional[str] = None
    driveFileId: Optional[str] = None


class DocumentOut(DocumentIn):
    pass


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
