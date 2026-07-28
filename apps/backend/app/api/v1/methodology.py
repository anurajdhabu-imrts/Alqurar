"""Delay-analysis method-selection API — one assessment per proposal.

    GET /methodology/project/{project_id}   canonical factors + saved state + summary
    PUT /methodology/project/{project_id}    replace the whole assessment state

Read and saved as one document (same shape as the costing sheet / checklist). Any
authenticated user may read and save it. The response is a plain dict — the nested
canonical structure (17 factors × 4 methods) is large, so no strict response model.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.v1.deps import get_current_user
from app.schemas.methodology import MethodologyStateIn
from app.services import methodology_service
from app.services.project_service import get_project

router = APIRouter()


def _require_proposal(project_id: str) -> dict:
    proj = get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return proj


@router.get("/project/{project_id}")
async def get_methodology(project_id: str, _=Depends(get_current_user)):
    _require_proposal(project_id)
    return methodology_service.get_assessment(project_id)


@router.put("/project/{project_id}")
async def put_methodology(project_id: str, payload: MethodologyStateIn, _=Depends(get_current_user)):
    _require_proposal(project_id)
    return methodology_service.replace_assessment(project_id, payload.model_dump())
