"""Email sending via SMTP. Used to deliver client-portal OTP codes.

ON HOLD / UNUSED: the client portal now opens directly via its secret link, so
OTP emails are no longer sent and nothing imports this module. Kept for future
restore — see api/v1/portal.py (the commented OTP block) and config.py. The SMTP
config it references was removed from config.py, so this module must not be
imported until that config is restored.
"""
import smtplib
from email.message import EmailMessage

from app import config


def is_configured() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_FROM_EMAIL)


def send_otp(to_email: str, code: str) -> None:
    """Send a one-time code email. Raises on failure (caller handles)."""
    msg = EmailMessage()
    msg["Subject"] = "Your Al Qarar verification code"
    msg["From"] = config.SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(
        f"Your Al Qarar document portal verification code is: {code}\n\n"
        f"It expires in {config.OTP_TTL_MINUTES} minutes. "
        f"If you didn't request this, you can ignore this email."
    )

    if config.SMTP_USE_TLS:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
            server.starttls()
            if config.SMTP_USER:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
            if config.SMTP_USER:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
