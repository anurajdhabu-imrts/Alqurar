from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.auth import LoginRequest, MeOut, Token
from app.services.auth_service import authenticate_user, create_access_token
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
    token = create_access_token({"sub": user["id"]}, expires_delta=timedelta(minutes=60 * 24))
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=MeOut)
async def me(current_user=Depends(get_current_user)):
    return {**current_user, "initials": _initials(current_user.get("name", ""))}
