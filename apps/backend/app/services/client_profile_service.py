"""Client company profile store — backed by the database. Holds the company
details (company name, CR no., country, role) captured at client registration,
keyed by the client's user id. The login account lives in the users table."""
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import ClientProfile


def list_profiles() -> List[Dict]:
    with SessionLocal() as db:
        return [p.to_dict() for p in db.query(ClientProfile).all()]


def get_profile(user_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        p = db.get(ClientProfile, user_id)
        return p.to_dict() if p else None


def upsert_profile(data: Dict) -> Dict:
    """Create or update a profile (by userId)."""
    with SessionLocal() as db:
        p = db.get(ClientProfile, data["userId"])
        if p:
            for key, value in data.items():
                setattr(p, key, value)
        else:
            p = ClientProfile(**data)
            db.add(p)
        db.commit()
        return p.to_dict()


def delete_profile(user_id: str) -> bool:
    with SessionLocal() as db:
        p = db.get(ClientProfile, user_id)
        if not p:
            return False
        db.delete(p)
        db.commit()
        return True
