from typing import Optional

from pydantic import BaseModel


class ProjectIn(BaseModel):
    """A project created in the web app. Mirrors the frontend ProjectDetails so
    the object round-trips unchanged. Stored server-side so any browser/device
    (admin or client) resolves the same projects."""

    id: str
    name: str
    code: str
    employer: str = ""
    contractor: str = ""
    standard: str = ""
    value: float = 0
    currency: str = "OMR"
    startDate: str = ""
    completionDate: str = ""
    status: str = "Active"
    riskLevel: str = "Moderate"
    source: str = "created"
    location: Optional[str] = None
    engineer: Optional[str] = None
    loaRef: Optional[str] = None
    commencementDate: Optional[str] = None
    timeForCompletionDays: Optional[int] = None
    dataDate: Optional[str] = None
    baselineProgramme: Optional[str] = None
    createdAt: Optional[str] = None
    # "project" (default) or "proposal" — proposals live in the Proposals area.
    kind: str = "project"


class ProjectOut(ProjectIn):
    pass
