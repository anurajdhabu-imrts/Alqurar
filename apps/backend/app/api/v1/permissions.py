from typing import List

from fastapi import APIRouter, Depends

from app.schemas.permission import PermissionGroupOut
from app.services.permission_service import list_permission_groups
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[PermissionGroupOut])
async def get_permissions(_=Depends(get_current_user)):
    return list_permission_groups()
