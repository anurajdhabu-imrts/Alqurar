from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.schemas.project import ProjectIn, ProjectOut
from app.services.project_service import (
    convert_proposal_to_project,
    create_project,
    delete_project,
    get_project,
    list_projects,
)
from app.api.v1.deps import get_current_user

router = APIRouter()


class ConvertIn(BaseModel):
    """Target identity for the new project created when a proposal is confirmed."""

    newId: str
    newCode: Optional[str] = None


@router.get("/", response_model=List[ProjectOut])
async def get_projects(kind: str | None = None, _=Depends(get_current_user)):
    """All created projects. Readable by any signed-in user (clients need this
    to resolve the projects assigned to them). Pass ?kind=project or
    ?kind=proposal to filter."""
    return list_projects(kind)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_one(project_id: str, _=Depends(get_current_user)):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def post_project(body: ProjectIn, current_user=Depends(get_current_user)):
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot create projects.")
    return create_project(body.model_dump())


@router.post("/{project_id}/convert", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def convert_project(project_id: str, body: ConvertIn, current_user=Depends(get_current_user)):
    """Confirm a proposal: copy it into a new ordinary project (kind="project")
    with all its documents, delay events, clauses and any EOT claim. The source
    proposal is left in place."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot confirm proposals.")
    result = convert_proposal_to_project(project_id, body.newId, body.newCode)
    if not result:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return result


@router.delete("/{project_id}")
async def remove_project(project_id: str, current_user=Depends(get_current_user)):
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot delete projects.")
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}
