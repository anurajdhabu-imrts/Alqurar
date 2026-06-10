from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.role import RoleCreate, RoleOut, RoleUpdate
from app.services.role_service import (
    add_role,
    delete_role,
    get_role,
    list_roles,
    update_role,
)
from app.api.v1.deps import get_current_user, require_permission

router = APIRouter()


@router.get("/", response_model=List[RoleOut])
async def get_roles(_=Depends(get_current_user)):
    """All authenticated users can read the role catalog (needed for permission gating)."""
    return list_roles()


@router.post("/", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    _=Depends(get_current_user),
    __=Depends(require_permission("admin.roles")),
):
    if get_role(payload.name):
        raise HTTPException(status_code=400, detail="A role with that name already exists.")
    return add_role(payload.model_dump())


@router.patch("/{role_id}", response_model=RoleOut)
async def patch_role(
    role_id: str,
    payload: RoleUpdate,
    _=Depends(get_current_user),
    __=Depends(require_permission("admin.roles")),
):
    updated = update_role(role_id, payload.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Role not found")
    return updated


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role(
    role_id: str,
    _=Depends(get_current_user),
    __=Depends(require_permission("admin.roles")),
):
    role = get_role(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("system"):
        raise HTTPException(status_code=400, detail="Built-in roles cannot be deleted.")
    delete_role(role_id)
