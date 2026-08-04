"""Proposal EOT-documentation checklist API — one checklist per proposal.

    GET    /proposal-checklist/project/{project_id}   the items + saved state
    PUT    /proposal-checklist/project/{project_id}   replace the whole checklist state

    POST   /proposal-checklist/project/{project_id}/items                    add a row (28, 29, …)
    DELETE /proposal-checklist/project/{project_id}/items/{no}               remove a user-added row
    POST   /proposal-checklist/project/{project_id}/items/{no}/documents     attach an uploaded file
    DELETE /proposal-checklist/project/{project_id}/items/{no}/documents/{document_id}

The answers are read and saved as one document, matching how the UI edits them
locally then saves once (same shape as the costing sheet). File attachments are
immediate — the file is uploaded through the normal /project-documents pipeline
first (so it lands in the proposal's Documents tab), then linked here by id.

Deliberately collaborative: both the analyst and the client fill this in, so any
authenticated user may read, save and attach — the checklist is the client's own
record of what documentation they have provided.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.v1.deps import get_current_user
from app.schemas.proposal_checklist import (
    AttachDocIn,
    ChecklistIn,
    ChecklistOut,
    NewItemIn,
    NewItemOut,
)
from app.services import proposal_checklist_service
from app.services.document_service import get_document
from app.services.project_service import get_project

router = APIRouter()


def _require_proposal(project_id: str) -> dict:
    proj = get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return proj


@router.get("/project/{project_id}", response_model=ChecklistOut)
async def get_checklist(project_id: str, _=Depends(get_current_user)):
    _require_proposal(project_id)
    return proposal_checklist_service.get_checklist(project_id)


@router.put("/project/{project_id}", response_model=ChecklistOut)
async def put_checklist(project_id: str, payload: ChecklistIn, _=Depends(get_current_user)):
    _require_proposal(project_id)
    items = [i.model_dump() for i in payload.items]
    return proposal_checklist_service.replace_checklist(project_id, items)


@router.post("/project/{project_id}/items", response_model=NewItemOut, status_code=201)
async def add_item(project_id: str, payload: NewItemIn, _=Depends(get_current_user)):
    """Add a further "additional document" row beyond the canonical 27."""
    _require_proposal(project_id)
    checklist, no = proposal_checklist_service.add_item(project_id, payload.item)
    return {"no": no, "checklist": checklist}


@router.delete("/project/{project_id}/items/{no}", response_model=ChecklistOut)
async def remove_item(project_id: str, no: int, _=Depends(get_current_user)):
    """Delete a user-added row. Its files stay in the proposal's Documents tab."""
    _require_proposal(project_id)
    updated = proposal_checklist_service.remove_item(project_id, no)
    if updated is None:
        raise HTTPException(status_code=400, detail="Only additional rows you added can be removed.")
    return updated


@router.post("/project/{project_id}/items/{no}/documents", response_model=ChecklistOut)
async def attach_document(project_id: str, no: int, payload: AttachDocIn, _=Depends(get_current_user)):
    """Link a document that was already uploaded to this proposal."""
    _require_proposal(project_id)
    doc = get_document(payload.documentId)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.get("projectId") != project_id:
        raise HTTPException(status_code=400, detail="That document belongs to another proposal.")

    updated = proposal_checklist_service.attach_document(
        project_id, no, payload.documentId, payload.item,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    return updated


@router.delete("/project/{project_id}/items/{no}/documents/{document_id}", response_model=ChecklistOut)
async def detach_document(project_id: str, no: int, document_id: str, _=Depends(get_current_user)):
    """Unlink a file from a checklist item — the file itself is not deleted."""
    _require_proposal(project_id)
    updated = proposal_checklist_service.detach_document(project_id, no, document_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    return updated
