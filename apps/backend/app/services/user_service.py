"""User store — backed by the database. Seeded on first run with the same 7
demo users as the frontend src/mock/admin.ts. Demo password: `demo1234`."""
import time
from typing import Dict, List, Optional

from app.core.security import get_password_hash, verify_password
from app.db import SessionLocal
from app.models import User
from app.schemas.user import UserCreate, UserUpdate


def _seed_rows() -> List[Dict]:
    pwd = get_password_hash("demo1234")
    return [
        {"id": "u-1", "name": "Akshay Patil",    "email": "claims@alqarar.ae",      "password": pwd, "role": "Administrator",    "status": "Active",    "phone": "", "lastActive": "2026-05-26"},
        {"id": "u-2", "name": "Sara Khan",       "email": "sara.khan@alqarar.ae",   "password": pwd, "role": "Claims Manager",   "status": "Active",    "phone": "", "lastActive": "2026-05-26"},
        {"id": "u-3", "name": "Omar Haddad",     "email": "omar.haddad@alqarar.ae", "password": pwd, "role": "Contract Manager", "status": "Active",    "phone": "", "lastActive": "2026-05-25"},
        {"id": "u-4", "name": "Priya Nair",      "email": "priya.nair@alqarar.ae",  "password": pwd, "role": "Legal Reviewer",   "status": "Active",    "phone": "", "lastActive": "2026-05-24"},
        {"id": "u-5", "name": "Mona Al-Rashid",  "email": "mona.r@alqarar.ae",      "password": pwd, "role": "Claims Manager",   "status": "Active",    "phone": "", "lastActive": "2026-05-23"},
        {"id": "u-6", "name": "James Whitfield", "email": "j.whitfield@client.com", "password": pwd, "role": "Client View",      "status": "Invited",   "phone": "", "lastActive": ""},
        {"id": "u-7", "name": "Daniel Cruz",     "email": "daniel.cruz@alqarar.ae", "password": pwd, "role": "Contract Manager", "status": "Suspended", "phone": "", "lastActive": "2026-05-04"},
    ]


def seed_users() -> None:
    """Insert the demo users if the table is empty (called on startup)."""
    with SessionLocal() as db:
        if db.query(User).count() == 0:
            db.add_all(User(**row) for row in _seed_rows())
            db.commit()


def list_users() -> List[Dict]:
    with SessionLocal() as db:
        return [u.to_dict() for u in db.query(User).order_by(User.id).all()]


def get_user_by_id(user_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        u = db.get(User, user_id)
        return u.to_dict() if u else None


def get_user_by_email(email: str) -> Optional[Dict]:
    e = (email or "").lower()
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == e).first()
        return u.to_dict(with_password=True) if u else None


def create_user(payload: UserCreate) -> Dict:
    with SessionLocal() as db:
        u = User(
            id=f"u-{int(time.time() * 1000)}",
            name=payload.name,
            email=payload.email.lower(),
            password=get_password_hash(payload.password or "demo1234"),
            role=payload.role,
            status=payload.status,
            phone=payload.phone or "",
            lastActive="",
        )
        db.add(u)
        db.commit()
        return u.to_dict()


def update_user(user_id: str, patch: UserUpdate) -> Optional[Dict]:
    with SessionLocal() as db:
        u = db.get(User, user_id)
        if not u:
            return None
        data = patch.model_dump(exclude_none=True)
        if "password" in data:
            data["password"] = get_password_hash(data["password"])
        if "email" in data:
            data["email"] = data["email"].lower()
        for key, value in data.items():
            setattr(u, key, value)
        db.commit()
        return u.to_dict()


def delete_user(user_id: str) -> bool:
    with SessionLocal() as db:
        u = db.get(User, user_id)
        if not u:
            return False
        db.delete(u)
        db.commit()
        return True


def verify_credentials(email: str, password: str) -> Optional[Dict]:
    e = (email or "").lower()
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == e).first()
        if not u or not verify_password(password, u.password):
            return None
        if u.status == "Suspended":
            return None
        return u.to_dict()
