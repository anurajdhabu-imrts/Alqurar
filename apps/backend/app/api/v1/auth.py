from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.schemas.auth import LoginRequest, MeOut, Token
from app.services.auth_service import authenticate_user, create_access_token
from app.services.client_profile_service import get_profile
from app.services.user_service import get_user_by_email, update_user, verify_credentials
from app.schemas.user import UserUpdate
from app.api.v1.deps import get_current_user

router = APIRouter()


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    return "".join(p[0] for p in parts[:2]).upper()


@router.post("/login", response_model=Token)
async def login(body: LoginRequest):
    user = authenticate_user(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # A temporary client uploads via their secret portal link; login is only for
    # confirmed clients. (Internal users are unaffected.)
    if user.get("role") == "Client View":
        profile = get_profile(user["id"])
        if profile and profile.get("clientType") == "Temporary":
            raise HTTPException(
                status_code=403,
                detail="Your account isn't active yet. Please use the secure upload link Al Qarar sent you.",
            )
    token = create_access_token({"sub": user["id"]}, expires_delta=timedelta(minutes=60 * 24))
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=MeOut)
async def me(current_user=Depends(get_current_user)):
    return {**current_user, "initials": _initials(current_user.get("name", ""))}


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@router.patch("/me", response_model=MeOut)
async def update_me(body: ProfileUpdateRequest, current_user=Depends(get_current_user)):
    """Let the authenticated user update their own name, email, and/or password."""
    user_id = current_user["id"]

    # ── Email uniqueness check ──
    if body.email:
        existing = get_user_by_email(body.email)
        if existing and existing["id"] != user_id:
            raise HTTPException(status_code=400, detail="That email is already in use.")

    # ── Password change requires current password verification ──
    if body.new_password:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password is required to set a new password.")
        if len(body.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
        verified = verify_credentials(current_user["email"], body.current_password)
        if not verified:
            raise HTTPException(status_code=400, detail="Current password is incorrect.")

    # ── Build the patch ──
    patch = UserUpdate(
        name=body.name or None,
        email=body.email or None,
        password=body.new_password or None,
    )
    updated = update_user(user_id, patch)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {**{k: v for k, v in updated.items() if k != "password"}, "initials": _initials(updated.get("name", ""))}
