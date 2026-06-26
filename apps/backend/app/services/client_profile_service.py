"""Client company profile store — backed by the database. Holds the company
details (company name, CR no., country, role) captured at client registration,
keyed by the client's user id. The login account lives in the users table."""
import secrets
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import ClientProfile


def _new_token() -> str:
    """Unguessable URL-safe token for the client's passwordless upload link."""
    return secrets.token_urlsafe(32)


def list_profiles() -> List[Dict]:
    with SessionLocal() as db:
        return [p.to_dict() for p in db.query(ClientProfile).all()]


def get_profile(user_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        p = db.get(ClientProfile, user_id)
        return p.to_dict() if p else None


def get_by_token(token: str) -> Optional[Dict]:
    """Resolve a client profile from its upload-link token, or None."""
    if not token:
        return None
    with SessionLocal() as db:
        p = db.query(ClientProfile).filter(ClientProfile.accessToken == token).first()
        return p.to_dict() if p else None


def upsert_profile(data: Dict) -> Dict:
    """Create or update a profile (by userId). Every client gets a stable upload
    token — generated on create and never wiped by a later edit."""
    with SessionLocal() as db:
        p = db.get(ClientProfile, data["userId"])
        if p:
            # An edit must not clear an existing token by sending it back empty.
            if not data.get("accessToken"):
                data.pop("accessToken", None)
            for key, value in data.items():
                setattr(p, key, value)
            if not p.accessToken:
                p.accessToken = _new_token()
        else:
            if not data.get("accessToken"):
                data["accessToken"] = _new_token()
            p = ClientProfile(**data)
            db.add(p)
        db.commit()
        return p.to_dict()


def ensure_tokens() -> int:
    """Backfill an upload token onto any existing client that lacks one.
    Returns how many were updated (run once on startup)."""
    updated = 0
    with SessionLocal() as db:
        for p in db.query(ClientProfile).filter(
            (ClientProfile.accessToken.is_(None)) | (ClientProfile.accessToken == "")
        ).all():
            p.accessToken = _new_token()
            updated += 1
        if updated:
            db.commit()
    return updated


def delete_profile(user_id: str) -> bool:
    with SessionLocal() as db:
        p = db.get(ClientProfile, user_id)
        if not p:
            return False
        db.delete(p)
        db.commit()
        return True
