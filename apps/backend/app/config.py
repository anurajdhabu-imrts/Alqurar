"""Application configuration loaded from environment variables (.env).

Centralises settings that differ between environments so the same code runs in
dev and production — only the .env values change. Add new settings here rather
than calling os.getenv() ad-hoc around the codebase.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Public base URL of the deployed frontend (no trailing slash). Used to build
# shareable links such as the passwordless client upload portal. Override with
# the FRONTEND_URL env var per-environment; no code change needed dev → prod.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

DEBUG = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")

# ── Client portal OTP + session + SMTP (DISABLED) ───────────────────────────
# The portal now opens directly via its secret link — no OTP/email verification —
# so these settings are no longer read. Restore them here (and re-enable the OTP
# routes in api/v1/portal.py) to bring email verification back:
#   OTP_TTL_MINUTES, PORTAL_SESSION_DAYS,
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_USE_TLS


def portal_link(token: str) -> str:
    """Absolute client-portal upload link for a token (empty string if no token)."""
    return f"{FRONTEND_URL}/portal/{token}" if token else ""
