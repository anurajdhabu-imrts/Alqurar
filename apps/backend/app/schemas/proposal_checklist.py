"""Schemas for a proposal's EOT-documentation checklist.

The whole checklist (all 27 items with their state) is read and saved as one
document via GET/PUT — matching how the UI edits it (locally, then one save) and
how the sibling costing sheet works. The item TEXT is canonical and owned by the
service; only the editable state (status / date / remarks) is sent back on save.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel

# Yes = provided, No = not provided, na = not applicable, "" = not yet answered.
ChecklistStatus = Literal["yes", "no", "na", ""]


class ChecklistItemIn(BaseModel):
    """Editable state for one checklist row, keyed by its item number."""

    no: int
    status: ChecklistStatus = ""
    # Date the information was provided (ISO "YYYY-MM-DD"); free text kept as-is.
    date: str = ""
    remarks: str = ""


class ChecklistItemOut(ChecklistItemIn):
    # The canonical item text, merged in from the service on read.
    item: str = ""


class ChecklistOut(BaseModel):
    projectId: str
    items: List[ChecklistItemOut] = []
    updatedAt: Optional[str] = None


class ChecklistIn(BaseModel):
    """Replace the whole checklist state for a proposal in one call."""

    items: List[ChecklistItemIn] = []
