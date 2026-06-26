from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import portal_link
from app.schemas.client_profile import ClientProfileIn, ClientProfileOut
from app.services.client_profile_service import delete_profile, list_profiles, upsert_profile
from app.api.v1.deps import get_current_user

router = APIRouter()


def _with_link(profile: dict) -> dict:
    """Attach the ready-to-share portal link (built from FRONTEND_URL)."""
    return {**profile, "portalLink": portal_link(profile.get("accessToken") or "")}


@router.get("/", response_model=List[ClientProfileOut])
async def get_profiles(_=Depends(get_current_user)):
    return [_with_link(p) for p in list_profiles()]


@router.post("/", response_model=ClientProfileOut, status_code=status.HTTP_201_CREATED)
async def post_profile(body: ClientProfileIn, current_user=Depends(get_current_user)):
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot edit company profiles.")
    return _with_link(upsert_profile(body.model_dump()))


@router.delete("/{user_id}")
async def remove_profile(user_id: str, current_user=Depends(get_current_user)):
    if current_user.get("role") == "Client View":
        raise HTTPException(status_code=403, detail="Clients cannot delete company profiles.")
    if not delete_profile(user_id):
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"ok": True}
