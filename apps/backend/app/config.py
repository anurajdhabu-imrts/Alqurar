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

# ── Client portal OTP + session ────────────────────────────────────────────
# How long a one-time code stays valid, and how long a verified browser session
# lasts before the client must re-verify.
OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
PORTAL_SESSION_DAYS = int(os.getenv("PORTAL_SESSION_DAYS", "7"))

# ── SMTP (for sending the OTP email) ───────────────────────────────────────
# OTP codes are emailed when SMTP_HOST + SMTP_FROM_EMAIL are set. If not, the
# request fails with a generic error — the code is NEVER exposed to the client.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "") or SMTP_USER
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")


def portal_link(token: str) -> str:
    """Absolute client-portal upload link for a token (empty string if no token)."""
    return f"{FRONTEND_URL}/portal/{token}" if token else ""
