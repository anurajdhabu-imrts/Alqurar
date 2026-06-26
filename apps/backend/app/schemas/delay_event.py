from typing import List, Optional

from pydantic import BaseModel


class ChronologyItem(BaseModel):
    """One step in an event's correspondence chronology."""

    id: str
    date: str = ""
    actor: str = "Contractor"
    title: str = ""
    detail: Optional[str] = None
    sourceId: Optional[str] = None


class DelayEventSource(BaseModel):
    """A source document linked to a delay event."""

    id: str
    name: str
    type: str = "Other"
    ref: Optional[str] = None
    date: Optional[str] = None


class DelayEventBase(BaseModel):
    ref: str = ""
    title: str = ""
    category: str = ""
    narrative: str = ""
    cause: str = "Employer"
    clause: str = ""
    startDate: str = ""
    endDate: str = ""
    daysImpact: int = 0
    criticalPath: bool = False
    admissibility: str = "Not assessed"
    aiConfidence: int = 0
    reviewStatus: str = "Pending"
    chronology: List[ChronologyItem] = []
    sources: List[DelayEventSource] = []


class DelayEventIn(DelayEventBase):
    """Create a delay event. `id` is optional — the server assigns one if absent."""

    id: Optional[str] = None
    projectId: str


class DelayEventUpdate(BaseModel):
    """Edit an event — every field optional so a partial PUT works."""

    ref: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    narrative: Optional[str] = None
    cause: Optional[str] = None
    clause: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    daysImpact: Optional[int] = None
    criticalPath: Optional[bool] = None
    admissibility: Optional[str] = None
    aiConfidence: Optional[int] = None
    reviewStatus: Optional[str] = None
    chronology: Optional[List[ChronologyItem]] = None
    sources: Optional[List[DelayEventSource]] = None


class StatusUpdate(BaseModel):
    """PATCH body for Accept / Merge / Reject."""

    reviewStatus: str


class DelayEventOut(DelayEventBase):
    id: str
    projectId: str
