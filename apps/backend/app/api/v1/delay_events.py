import os
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.schemas.delay_event import (
    DelayEventIn,
    DelayEventOut,
    DelayEventUpdate,
    StatusUpdate,
)
from app.services.delay_event_service import (
    create_event,
    delete_event,
    list_by_project,
    set_status,
    update_event,
)
from app.services import project_service, delay_event_extraction
from app.api.v1.deps import get_current_user

router = APIRouter()

_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)


@router.post("/extract/{project_id}")
async def extract_events_for_project(
    project_id: str, background: BackgroundTasks, current_user=Depends(get_current_user),
):
    """Queue AI extraction of the project's delay-event register (background) and
    return immediately. The client polls `/extract/{project_id}/status`. When it
    completes, the project's events are replaced with the extracted set."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot extract delay events.")
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)
    if not project_service.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    if delay_event_extraction.get_status(project_id).get("status") == "running":
        return {"status": "running"}

    delay_event_extraction.mark_running(project_id)
    background.add_task(delay_event_extraction.run_extraction, project_id)
    return {"status": "running"}


@router.get("/extract/{project_id}/status")
async def extraction_status(project_id: str, _=Depends(get_current_user)):
    """Current state of background extraction for a project."""
    return delay_event_extraction.get_status(project_id)


@router.get("/project/{project_id}", response_model=List[DelayEventOut])
async def events_for_project(project_id: str, _=Depends(get_current_user)):
    """All delay events for a project."""
    return list_by_project(project_id)


@router.post("/", response_model=DelayEventOut, status_code=status.HTTP_201_CREATED)
async def add_event(body: DelayEventIn, current_user=Depends(get_current_user)):
    """Create a new delay event (manual entry)."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot create delay events.")
    return create_event(body.model_dump())


@router.put("/{event_id}", response_model=DelayEventOut)
async def edit_event(event_id: str, body: DelayEventUpdate, current_user=Depends(get_current_user)):
    """Edit an event's fields."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot edit delay events.")
    event = update_event(event_id, body.model_dump(exclude_unset=True))
    if not event:
        raise HTTPException(status_code=404, detail="Delay event not found")
    return event


@router.patch("/{event_id}/status", response_model=DelayEventOut)
async def change_status(event_id: str, body: StatusUpdate, current_user=Depends(get_current_user)):
    """Set the review status — Accept / Merge / Reject."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot review delay events.")
    event = set_status(event_id, body.reviewStatus)
    if not event:
        raise HTTPException(status_code=404, detail="Delay event not found")
    return event


@router.delete("/{event_id}")
async def remove_event(event_id: str, current_user=Depends(get_current_user)):
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot delete delay events.")
    if not delete_event(event_id):
        raise HTTPException(status_code=404, detail="Delay event not found")
    return {"ok": True}
