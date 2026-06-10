from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.user_service import (
    create_user,
    delete_user,
    get_user_by_email,
    get_user_by_id,
    list_users,
    update_user,
)
from app.api.v1.deps import get_current_user, require_permission

router = APIRouter()


@router.get("/", response_model=List[UserOut])
async def get_users(_=Depends(get_current_user), __=Depends(require_permission("admin.users"))):
    return list_users()


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    payload: UserCreate,
    _=Depends(get_current_user),
    __=Depends(require_permission("admin.users")),
):
    if get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="A user with that email already exists.")
    return create_user(payload)


@router.patch("/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: str,
    payload: UserUpdate,
    _=Depends(get_current_user),
    __=Depends(require_permission("admin.users")),
):
    # Guard email uniqueness on change
    if payload.email:
        existing = get_user_by_email(payload.email)
        if existing and existing["id"] != user_id:
            raise HTTPException(status_code=400, detail="That email is already in use.")
    updated = update_user(user_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user(
    user_id: str,
    current_user=Depends(get_current_user),
    _=Depends(require_permission("admin.users")),
):
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    if not get_user_by_id(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    delete_user(user_id)
