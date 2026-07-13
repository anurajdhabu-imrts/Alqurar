"""Proposal costing API — one editable costing sheet per proposal.

    GET /costing/project/{project_id}     the whole sheet + computed summary
    PUT /costing/project/{project_id}     replace the whole sheet (activities + settings)

The sheet is read and saved as one document, matching how the UI edits it locally
then saves once. Rates are snapshotted client-side from the Employee master and
stored verbatim (see costing_service), so past costings never move when a master
rate changes. Editing needs `claims.create` (the proposal-editing permission);
reading needs only authentication.

Kept deliberately independent of the AI proposal-generation tab (client_proposals)
and PDF generation — this module is standalone and extendable to invoicing/reports.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.v1.deps import get_current_user, require_permission
from app.schemas.costing import CostingSheetIn, CostingSheetOut
from app.services import costing_service
from app.services.project_service import get_project

router = APIRouter()

_EDIT = require_permission("claims.create")


def _require_proposal(project_id: str) -> dict:
    proj = get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return proj


@router.get("/project/{project_id}", response_model=CostingSheetOut)
async def get_costing(project_id: str, _=Depends(get_current_user)):
    _require_proposal(project_id)
    return costing_service.get_sheet(project_id)


@router.put("/project/{project_id}", response_model=CostingSheetOut)
async def put_costing(
    project_id: str,
    payload: CostingSheetIn,
    _=Depends(get_current_user),
    __=Depends(_EDIT),
):
    _require_proposal(project_id)
    activities = [a.model_dump() for a in payload.activities]
    settings = payload.settings.model_dump()
    return costing_service.replace_sheet(project_id, activities, settings)
