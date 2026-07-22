from typing import Optional

from pydantic import BaseModel


class ProjectQueryBase(BaseModel):
    """Shared query / RFI fields (Project Workspace → Queries tab)."""

    dateOfRfi: str = ""
    eotDescription: str = ""
    queryDescription: str = ""
    responseFromGic: str = ""
    dateOfResponse: str = ""
    status: str = "Open"
    remarks: str = ""


class ProjectQueryIn(ProjectQueryBase):
    """Create a query. `id` is optional — the server assigns one if absent."""

    id: Optional[str] = None
    projectId: str


class ProjectQueryUpdate(BaseModel):
    """Edit a query — every field optional so a partial PUT works."""

    dateOfRfi: Optional[str] = None
    eotDescription: Optional[str] = None
    queryDescription: Optional[str] = None
    responseFromGic: Optional[str] = None
    dateOfResponse: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class ProjectQueryOut(ProjectQueryBase):
    id: str
    projectId: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
