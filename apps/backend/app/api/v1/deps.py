from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.services.auth_service import decode_access_token
from app.services.user_service import get_user_by_id
from app.services.role_service import user_has_permission

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _strip(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "password"}


async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    user_id = payload.get("sub")
    user = get_user_by_id(user_id) if user_id else None
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") == "Suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    return _strip(user)


def require_permission(permission_id: str):
    async def _checker(current_user=Depends(get_current_user)):
        if user_has_permission(current_user["role"], permission_id):
            return True
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return _checker
