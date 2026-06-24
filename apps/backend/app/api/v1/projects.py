from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.project import ProjectIn, ProjectOut
from app.services.project_service import create_project, delete_project, get_project, list_projects
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[ProjectOut])
async def get_projects(_=Depends(get_current_user)):
    """All created projects. Readable by any signed-in user (clients need this
    to resolve the projects assigned to them)."""
    return list_projects()


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


@router.delete("/{project_id}")
async def remove_project(project_id: str, current_user=Depends(get_current_user)):
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot delete projects.")
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}
