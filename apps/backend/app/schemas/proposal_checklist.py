"""Schemas for a proposal's EOT-documentation checklist.

The checklist answers (all items with their status/remarks) are read and saved as
one document via GET/PUT — matching how the UI edits it (locally, then one save)
and how the sibling costing sheet works. The item TEXT is canonical and owned by
the service; only the editable state is sent back on save.

File attachments are the exception: they are immediate single-item operations
(attach / detach / add row), because a file upload can't sensibly sit in an
unsaved local buffer. Every one of them returns the whole refreshed checklist.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel

# Yes = provided, No = not provided, na = not applicable, "" = not yet answered.
ChecklistStatus = Literal["yes", "no", "na", ""]


class ChecklistDocOut(BaseModel):
    """A file attached to a checklist item. It is an ordinary project document —
    it also appears in the proposal's Documents tab and can be analysed there."""

    id: str
    name: str = ""
    type: str = ""
    uploadedAt: str = ""
    uploadedBy: str = ""
    sizeKB: int = 0


class ChecklistItemIn(BaseModel):
    """Editable state for one checklist row, keyed by its item number."""

    no: int
    status: ChecklistStatus = ""
    remarks: str = ""
    # Only honoured for user-added rows (28+); canonical item text is server-owned.
    item: str = ""


class ChecklistItemOut(BaseModel):
    no: int
    # The canonical (or user-set) item text, merged in from the service on read.
    item: str = ""
    status: ChecklistStatus = ""
    remarks: str = ""
    documents: List[ChecklistDocOut] = []


class ChecklistOut(BaseModel):
    projectId: str
    items: List[ChecklistItemOut] = []
    updatedAt: Optional[str] = None


class ChecklistIn(BaseModel):
    """Replace the whole checklist state for a proposal in one call."""

    items: List[ChecklistItemIn] = []


class AttachDocIn(BaseModel):
    """Link an already-uploaded project document to a checklist item."""

    documentId: str
    # Names the row. Only honoured for the additional-document rows (27+).
    item: str = ""


class NewItemIn(BaseModel):
    """Add a further "additional document" row (28, 29, …)."""

    item: str = ""


class NewItemOut(BaseModel):
    """The refreshed checklist plus the number of the row just created, so the
    caller can attach the file it just uploaded to it."""

    no: int
    checklist: ChecklistOut
