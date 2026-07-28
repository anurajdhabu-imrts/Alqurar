"""Proposal EOT-documentation checklist API — one checklist per proposal.

    GET /proposal-checklist/project/{project_id}   the 27 items + saved state
    PUT /proposal-checklist/project/{project_id}   replace the whole checklist state

Read and saved as one document, matching how the UI edits it locally then saves
once (same shape as the costing sheet). Deliberately collaborative: both the analyst
and the client fill it, so any authenticated user may read AND save it — the
checklist is the client's own record of what documentation they have provided.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.v1.deps import get_current_user
from app.schemas.proposal_checklist import ChecklistIn, ChecklistOut
from app.services import proposal_checklist_service
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
