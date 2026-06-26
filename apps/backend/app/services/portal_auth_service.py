"""Client portal OTP + verified-session logic.

- An OTP is a 6-digit code, stored hashed, valid for OTP_TTL_MINUTES.
- On a correct OTP a PortalSession is created (random token, PORTAL_SESSION_DAYS),
  so the client isn't asked again until it expires / the link is regenerated /
  they switch browser. Sessions are tied to the portal token, so regenerating a
  client's link invalidates all their old sessions automatically.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from app import config
from app.core.security import get_password_hash, verify_password
from app.db import SessionLocal
from app.models import PortalOTP, PortalSession

MAX_ATTEMPTS = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _expired(value: str) -> bool:
    exp = _parse(value)
    return exp is None or _now() > exp


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def create_otp(portal_token: str, email: str) -> str:
    """Create/replace the active OTP for a portal link. Returns the plain code
    (for the caller to email or log) — only the hash is stored."""
    code = generate_code()
    expires = (_now() + timedelta(minutes=config.OTP_TTL_MINUTES)).isoformat()
    with SessionLocal() as db:
        otp = db.get(PortalOTP, portal_token)
        if otp:
            otp.email = email
            otp.codeHash = get_password_hash(code)
            otp.expiresAt = expires
            otp.attempts = 0
        else:
            db.add(PortalOTP(
                portalToken=portal_token,
                email=email,
                codeHash=get_password_hash(code),
                expiresAt=expires,
                attempts=0,
            ))
        db.commit()
    return code


def verify_otp(portal_token: str, code: str, user_id: str, email: str) -> Tuple[Optional[dict], Optional[str]]:
    """Check a code. On success: delete the OTP, create a session, return
    ({sessionToken, expiresAt}, None). On failure: (None, error_message)."""
    with SessionLocal() as db:
        otp = db.get(PortalOTP, portal_token)
        if not otp:
            return None, "No active code — please request a new one."
        if _expired(otp.expiresAt):
            db.delete(otp)
            db.commit()
            return None, "This code has expired. Please request a new one."
        if otp.attempts >= MAX_ATTEMPTS:
            db.delete(otp)
            db.commit()
            return None, "Too many incorrect attempts. Please request a new code."
        if not verify_password(code.strip(), otp.codeHash):
            otp.attempts += 1
            db.commit()
            return None, "Incorrect code. Please try again."

        # Success — consume the OTP and mint a verified session.
        db.delete(otp)
        session_token = secrets.token_urlsafe(32)
        expires = (_now() + timedelta(days=config.PORTAL_SESSION_DAYS)).isoformat()
        db.add(PortalSession(
            token=session_token,
            portalToken=portal_token,
            userId=user_id,
            email=email,
            createdAt=_now().isoformat(),
            expiresAt=expires,
        ))
        db.commit()
        return {"sessionToken": session_token, "expiresAt": expires}, None


def validate_session(portal_token: str, session_token: Optional[str]) -> bool:
    """True if the session token is valid for this portal link and not expired."""
    if not session_token:
        return False
    with SessionLocal() as db:
        sess = db.get(PortalSession, session_token)
        if not sess or sess.portalToken != portal_token:
            return False
        if _expired(sess.expiresAt):
            db.delete(sess)
            db.commit()
            return False
        return True
