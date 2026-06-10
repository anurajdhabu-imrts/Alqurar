from datetime import datetime, timedelta
from typing import Optional

from jose import jwt

from app.services.user_service import verify_credentials


SECRET_KEY = "demo-secret-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


def authenticate_user(email: str, password: str) -> Optional[dict]:
    """Verify credentials and return a minimal user dict for the JWT payload."""
    user = verify_credentials(email, password)
    if not user:
        return None
    return {"id": user["id"], "email": user["email"], "role": user["role"]}


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.utcnow()
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None
