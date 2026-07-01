import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.services import project_service, eot_claim_service
from app.api.v1.deps import get_current_user

router = APIRouter()

_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)


@router.get("/project/{project_id}")
async def get_proposal(project_id: str, _=Depends(get_current_user)):
    """The project's generated EOT claim document + generation status."""
    return eot_claim_service.get_claim(project_id)


@router.post("/project/{project_id}/generate")
async def generate_proposal(
    project_id: str, background: BackgroundTasks, current_user=Depends(get_current_user),
):
    """Queue AI generation of the project's EOT claim document (background) and
    return immediately. The client polls GET /project/{id} for progress + result."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot generate the EOT claim.")
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)
    if not project_service.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    if eot_claim_service.get_claim(project_id).get("status") == "running":
        return {"status": "running"}

    eot_claim_service.mark_running(project_id)
    background.add_task(eot_claim_service.run_generation, project_id)
    return {"status": "running"}
