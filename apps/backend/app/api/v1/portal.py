"""Public client portal — passwordless document upload, secured with email OTP.

A client opens /portal/{accessToken}. The token identifies the client+projects,
but it is NOT enough to access anything: the client must verify a one-time code
sent to their registered email, which mints a verified browser session. Upload,
list and download all require that verified session — opening the link alone
grants nothing.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import config
from app.services import email_service, portal_auth_service as auth
from app.services.assignment_service import project_ids_for_client
from app.services.client_profile_service import get_by_token
from app.services.document_service import (
    create_document,
    get_document,
    get_document_file,
    list_by_project,
    next_document_id,
)
from app.services.project_service import get_project

logger = logging.getLogger("portal")
router = APIRouter()

_EXT_TYPE = {
    "pdf": "PDF", "doc": "DOCX", "docx": "DOCX", "xls": "XLSX", "xlsx": "XLSX",
    "xml": "P6 XML", "xer": "P6 XML", "mpp": "MPP",
    "png": "Scan", "jpg": "Scan", "jpeg": "Scan", "tif": "Scan", "tiff": "Scan",
}


class VerifyBody(BaseModel):
    code: str


def _doc_type(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return _EXT_TYPE.get(ext, "Other")


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email or ""
    name, domain = email.split("@", 1)
    head = name[0] if name else "*"
    return f"{head}{'*' * max(3, len(name) - 1)}@{domain}"


def _resolve(token: str) -> dict:
    """Resolve the client behind a portal token, or 404 if invalid/revoked."""
    profile = get_by_token(token)
    if not profile:
        raise HTTPException(status_code=404, detail="This upload link is invalid or has been revoked.")
    return profile


def _require_session(token: str, session: Optional[str]) -> dict:
    """Resolve the client AND require a valid verified session (else 401)."""
    profile = _resolve(token)
    if not auth.validate_session(token, session):
        raise HTTPException(status_code=401, detail="Please verify your email to continue.")
    return profile


def _require_project(profile: dict, project_id: str) -> None:
    if project_id not in project_ids_for_client(profile["userId"]):
        raise HTTPException(status_code=403, detail="This project isn't linked to your account.")


@router.get("/{token}")
async def portal_info(token: str, x_portal_session: Optional[str] = Header(default=None)):
    """Whether this browser is verified. Projects are only revealed once verified;
    otherwise just the masked email (so the client knows where the code goes)."""
    profile = _resolve(token)
    if not auth.validate_session(token, x_portal_session):
        return {"verified": False, "email": _mask_email(profile.get("email") or "")}
    projects = [p for p in (get_project(pid) for pid in project_ids_for_client(profile["userId"])) if p]
    return {
        "verified": True,
        "client": {
            "name": profile.get("contactName") or profile.get("company") or "Client",
            "company": profile.get("company") or "",
            "email": profile.get("email") or "",
        },
        "projects": projects,
    }


@router.post("/{token}/request-otp")
async def portal_request_otp(token: str):
    """Generate and send a one-time code to the client's registered email."""
    profile = _resolve(token)
    email = (profile.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="No email is on file for this client.")

    code = auth.create_otp(token, email)

    # The code is ONLY ever delivered by email — never returned to the client.
    if not email_service.is_configured():
        # Logged server-side for the developer; not exposed to the frontend.
        logger.warning("PORTAL OTP could not be emailed (SMTP not configured) for %s", email)
        raise HTTPException(status_code=503, detail="OTP could not be sent. Please contact admin.")
    try:
        email_service.send_otp(email, code)
    except Exception:  # noqa: BLE001 — never leak the code or SMTP internals
        logger.exception("OTP email failed")
        raise HTTPException(status_code=502, detail="OTP could not be sent. Please contact admin.")

    return {
        "sent": True,
        "email": _mask_email(email),
        "expiresInMinutes": config.OTP_TTL_MINUTES,
    }


@router.post("/{token}/verify-otp")
async def portal_verify_otp(token: str, body: VerifyBody):
    """Verify the code; on success return a session token for future access."""
    profile = _resolve(token)
    result, error = auth.verify_otp(token, body.code, profile["userId"], profile.get("email") or "")
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@router.get("/{token}/documents")
async def portal_documents(
    token: str,
    projectId: str,
    x_portal_session: Optional[str] = Header(default=None),
):
    profile = _require_session(token, x_portal_session)
    _require_project(profile, projectId)
    # A client sees only their OWN uploads (their "folder"), not the whole project.
    return [d for d in list_by_project(projectId) if d.get("uploadedById") == profile["userId"]]


@router.post("/{token}/upload", status_code=status.HTTP_201_CREATED)
async def portal_upload(
    token: str,
    file: UploadFile = File(...),
    projectId: str = Form(...),
    x_portal_session: Optional[str] = Header(default=None),
):
    profile = _require_session(token, x_portal_session)
    _require_project(profile, projectId)

    content = await file.read()
    doc_id = next_document_id()
    uploader = profile.get("contactName") or profile.get("company") or "Client"
    record = {
        "id": doc_id,
        "projectId": projectId,
        "name": file.filename or "file",
        "type": _doc_type(file.filename or ""),
        "sizeKB": max(1, round(len(content) / 1024)),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "uploadedBy": uploader,
        "status": "Uploaded",
        "driveFileId": doc_id,
        "data": content,
        "mime": file.content_type or "application/octet-stream",
        "uploadedById": profile["userId"],  # so the client sees it in their folder
    }
    return create_document(record)


@router.get("/{token}/documents/{document_id}/download")
async def portal_download(
    token: str,
    document_id: str,
    x_portal_session: Optional[str] = Header(default=None),
):
    profile = _require_session(token, x_portal_session)
    doc = get_document(document_id)
    if not doc or doc["projectId"] not in project_ids_for_client(profile["userId"]):
        raise HTTPException(status_code=404, detail="Document not found.")
    stored = get_document_file(document_id)
    if not stored:
        raise HTTPException(status_code=404, detail="No stored file for this document.")
    data, filename, mime = stored
    return StreamingResponse(
        iter([data]),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
