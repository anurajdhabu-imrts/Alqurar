import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.services import chronology_generation, project_service
from app.api.v1.deps import get_current_user

router = APIRouter()

_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)


@router.post("/generate/{project_id}")
async def generate_chronology(
    project_id: str, background: BackgroundTasks, current_user=Depends(get_current_user),
):
    """Queue AI generation of a per-event chronology for the project (background)
    and return immediately. The client polls `/generate/{project_id}/status`.
    On completion each delay event's chronology is replaced with the generated one."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot generate chronology.")
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)
    if not project_service.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    if chronology_generation.get_status(project_id).get("status") == "running":
        return {"status": "running"}

    chronology_generation.mark_running(project_id)
    background.add_task(chronology_generation.run_generation, project_id)
    return {"status": "running"}


@router.get("/generate/{project_id}/status")
async def chronology_status(project_id: str, _=Depends(get_current_user)):
    """Current state of background chronology generation for a project."""
    return chronology_generation.get_status(project_id)
