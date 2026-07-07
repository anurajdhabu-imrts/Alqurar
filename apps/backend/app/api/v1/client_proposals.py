import os
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException

from app.services import project_service, client_proposal_service
from app.api.v1.deps import get_current_user

router = APIRouter()

_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)


@router.get("/project/{project_id}")
async def get_client_proposal(project_id: str, _=Depends(get_current_user)):
    """The proposal's generated costed client proposal + generation status."""
    return client_proposal_service.get_proposal(project_id)


@router.put("/project/{project_id}/inputs")
async def save_proposal_inputs(
    project_id: str,
    inputs: dict = Body(default={}),
    current_user=Depends(get_current_user),
):
    """Save the admin-entered proposal fields (client address, attention,
    reference, date, discount, notes, …) without generating."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot edit the proposal.")
    if not project_service.get_project(project_id):
        raise HTTPException(status_code=404, detail="Proposal not found")
    return client_proposal_service.save_inputs(project_id, inputs or {})


@router.post("/project/{project_id}/generate")
async def generate_client_proposal(
    project_id: str,
    background: BackgroundTasks,
    inputs: Optional[dict] = Body(default=None),
    current_user=Depends(get_current_user),
):
    """Save any admin-entered fields, then queue AI generation of the costed client
    proposal (background) and return immediately. The client polls GET /project/{id}
    for progress + result."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot generate the proposal.")
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)
    if not project_service.get_project(project_id):
        raise HTTPException(status_code=404, detail="Proposal not found")

    if inputs:
        client_proposal_service.save_inputs(project_id, inputs)

    if client_proposal_service.get_proposal(project_id).get("status") == "running":
        return {"status": "running"}

    client_proposal_service.mark_running(project_id)
    background.add_task(client_proposal_service.run_generation, project_id)
    return {"status": "running"}


@router.post("/project/{project_id}/send")
async def send_to_client(project_id: str, current_user=Depends(get_current_user)):
    """Mark a finished proposal as 'Sent to Client'. The client can then view
    and download it from their portal."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot send proposals.")
    if not project_service.get_project(project_id):
        raise HTTPException(status_code=404, detail="Proposal not found")
    result = client_proposal_service.mark_sent(project_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
