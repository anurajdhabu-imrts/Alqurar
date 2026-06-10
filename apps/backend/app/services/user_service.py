"""User store — seeded with the same 7 users as the frontend src/mock/admin.ts.
Demo password for all seeded users: `demo1234`.
"""
import time
from typing import Dict, List, Optional

from app.core.security import get_password_hash, verify_password
from app.schemas.user import UserCreate, UserUpdate


_DEFAULT_PWD_HASH = get_password_hash("demo1234")


_users: List[Dict] = [
    {"id": "u-1", "name": "Akshay Patil",   "email": "claims@alqarar.ae",        "password": _DEFAULT_PWD_HASH, "role": "Administrator",    "status": "Active",    "lastActive": "2026-05-26"},
    {"id": "u-2", "name": "Sara Khan",      "email": "sara.khan@alqarar.ae",     "password": _DEFAULT_PWD_HASH, "role": "Claims Manager",   "status": "Active",    "lastActive": "2026-05-26"},
    {"id": "u-3", "name": "Omar Haddad",    "email": "omar.haddad@alqarar.ae",   "password": _DEFAULT_PWD_HASH, "role": "Contract Manager", "status": "Active",    "lastActive": "2026-05-25"},
    {"id": "u-4", "name": "Priya Nair",     "email": "priya.nair@alqarar.ae",    "password": _DEFAULT_PWD_HASH, "role": "Legal Reviewer",   "status": "Active",    "lastActive": "2026-05-24"},
    {"id": "u-5", "name": "Mona Al-Rashid", "email": "mona.r@alqarar.ae",        "password": _DEFAULT_PWD_HASH, "role": "Claims Manager",   "status": "Active",    "lastActive": "2026-05-23"},
    {"id": "u-6", "name": "James Whitfield","email": "j.whitfield@client.com",   "password": _DEFAULT_PWD_HASH, "role": "Client View",      "status": "Invited",   "lastActive": ""},
    {"id": "u-7", "name": "Daniel Cruz",    "email": "daniel.cruz@alqarar.ae",   "password": _DEFAULT_PWD_HASH, "role": "Contract Manager", "status": "Suspended", "lastActive": "2026-05-04"},
]


def _strip(u: Dict) -> Dict:
    return {k: v for k, v in u.items() if k != "password"}


def list_users() -> List[Dict]:
    return [_strip(u) for u in _users]


def get_user_by_id(user_id: str) -> Optional[Dict]:
    return next((u for u in _users if u["id"] == user_id), None)


def get_user_by_email(email: str) -> Optional[Dict]:
    e = (email or "").lower()
    return next((u for u in _users if u["email"].lower() == e), None)


def create_user(payload: UserCreate) -> Dict:
    new_id = f"u-{int(time.time() * 1000)}"
    user = {
        "id": new_id,
        "name": payload.name,
        "email": payload.email.lower(),
        "password": get_password_hash(payload.password or "demo1234"),
        "role": payload.role,
        "status": payload.status,
        "phone": payload.phone or "",
        "lastActive": "",
    }
    _users.append(user)
    return _strip(user)


def update_user(user_id: str, patch: UserUpdate) -> Optional[Dict]:
    user = get_user_by_id(user_id)
    if not user:
        return None
    data = patch.model_dump(exclude_none=True)
    if "password" in data:
        data["password"] = get_password_hash(data["password"])
    if "email" in data:
        data["email"] = data["email"].lower()
    user.update(data)
    return _strip(user)


def delete_user(user_id: str) -> bool:
    for i, u in enumerate(_users):
        if u["id"] == user_id:
            _users.pop(i)
            return True
    return False


def verify_credentials(email: str, password: str) -> Optional[Dict]:
    user = get_user_by_email(email)
    if not user or not verify_password(password, user["password"]):
        return None
    if user["status"] == "Suspended":
        return None
    return user
