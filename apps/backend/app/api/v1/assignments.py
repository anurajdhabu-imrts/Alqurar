from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.assignment import AssignRequest, MyProjectsOut, ProjectClientsOut
from app.services.assignment_service import (
    assign_clients,
    client_ids_for_project,
    project_ids_for_client,
    unassign_client,
)
from app.services.user_service import get_user_by_id
from app.api.v1.deps import get_current_user, require_permission

router = APIRouter()

_ASSIGN = require_permission("claims.assign_client")


@router.get("/me/projects", response_model=MyProjectsOut)
async def my_projects(current_user=Depends(get_current_user)):
    """Project ids assigned to the signed-in user (drives the client dashboard)."""
    return {"project_ids": project_ids_for_client(current_user["id"])}


@router.get("/projects/{project_id}/clients", response_model=ProjectClientsOut)
async def project_clients(
    project_id: str,
    _=Depends(get_current_user),
    __=Depends(_ASSIGN),
):
    return {"project_id": project_id, "client_user_ids": client_ids_for_project(project_id)}


@router.post("/", response_model=ProjectClientsOut, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    body: AssignRequest,
    current_user=Depends(get_current_user),
    _=Depends(_ASSIGN),
):
    if not body.project_id:
        raise HTTPException(status_code=400, detail="project_id is required.")
    # Validate the targets are real client users.
    for cid in body.client_user_ids:
        u = get_user_by_id(cid)
        if not u:
            raise HTTPException(status_code=404, detail=f"User {cid} not found.")
        if u.get("role") != "Client View":
            raise HTTPException(status_code=400, detail=f"User {u.get('name', cid)} is not a client.")
    ids = assign_clients(body.project_id, body.client_user_ids, current_user["id"])
    return {"project_id": body.project_id, "client_user_ids": ids}


@router.delete("/projects/{project_id}/clients/{client_user_id}", response_model=ProjectClientsOut)
async def delete_assignment(
    project_id: str,
    client_user_id: str,
    _=Depends(get_current_user),
    __=Depends(_ASSIGN),
):
    unassign_client(project_id, client_user_id)
    return {"project_id": project_id, "client_user_ids": client_ids_for_project(project_id)}
