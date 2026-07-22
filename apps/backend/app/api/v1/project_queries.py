from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.project_query import (
    ProjectQueryIn,
    ProjectQueryOut,
    ProjectQueryUpdate,
)
from app.services.project_query_service import (
    create_query,
    delete_query,
    list_by_project,
    update_query,
)
from app.services import project_service
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.get("/project/{project_id}", response_model=List[ProjectQueryOut])
async def queries_for_project(project_id: str, _=Depends(get_current_user)):
    """All queries / RFIs raised for a project (oldest first)."""
    return list_by_project(project_id)


@router.post("/", response_model=ProjectQueryOut, status_code=status.HTTP_201_CREATED)
async def add_query(body: ProjectQueryIn, current_user=Depends(get_current_user)):
    """Raise a new query / RFI (manual entry)."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot create queries.")
    if not project_service.get_project(body.projectId):
        raise HTTPException(status_code=404, detail="Project not found")
    return create_query(body.model_dump())


@router.put("/{query_id}", response_model=ProjectQueryOut)
async def edit_query(query_id: str, body: ProjectQueryUpdate, current_user=Depends(get_current_user)):
    """Edit a query — incl. recording the GIC response and closing it."""
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot edit queries.")
    q = update_query(query_id, body.model_dump(exclude_unset=True))
    if not q:
        raise HTTPException(status_code=404, detail="Query not found")
    return q


@router.delete("/{query_id}")
async def remove_query(query_id: str, current_user=Depends(get_current_user)):
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot delete queries.")
    if not delete_query(query_id):
        raise HTTPException(status_code=404, detail="Query not found")
    return {"ok": True}
