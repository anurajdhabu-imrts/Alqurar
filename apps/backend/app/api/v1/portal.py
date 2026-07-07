"""Public client portal — passwordless document upload via a secret link.

A client opens /portal/{accessToken}. The token uniquely and securely maps to a
client and their assigned projects, so opening the link gives direct access to
upload documents into those projects' Data Rooms — no login, password or email
verification. The link's secrecy (a 256-bit token) is what protects it.

NOTE: An email-OTP + verified-session layer previously guarded this portal. It
has been DISABLED to simplify the client flow. That logic is kept commented at
the bottom of this file (and in services/portal_auth_service.py +
services/email_service.py, both now unused) so it can be switched back on later
without rewriting it.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

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

router = APIRouter()

_EXT_TYPE = {
    "pdf": "PDF", "doc": "DOCX", "docx": "DOCX", "xls": "XLSX", "xlsx": "XLSX",
    "xml": "P6 XML", "xer": "P6 XML", "mpp": "MPP",
    "png": "Scan", "jpg": "Scan", "jpeg": "Scan", "tif": "Scan", "tiff": "Scan",
}


def _doc_type(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return _EXT_TYPE.get(ext, "Other")


def _resolve(token: str) -> dict:
    """Resolve the client behind a portal token, or 404 if invalid/revoked."""
    profile = get_by_token(token)
    if not profile:
        raise HTTPException(status_code=404, detail="This upload link is invalid or has been revoked.")
    return profile


def _require_project(profile: dict, project_id: str) -> None:
    if project_id not in project_ids_for_client(profile["userId"]):
        raise HTTPException(status_code=403, detail="This project isn't linked to your account.")


@router.get("/{token}")
async def portal_info(token: str):
    """Resolve the link and return the client + their projects. The link opens
    directly — no verification step (`verified` stays True for the frontend)."""
    profile = _resolve(token)
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


@router.get("/{token}/documents")
async def portal_documents(token: str, projectId: str):
    profile = _resolve(token)
    _require_project(profile, projectId)
    # A client sees only their OWN uploads (their "folder"), not the whole project.
    return [d for d in list_by_project(projectId) if d.get("uploadedById") == profile["userId"]]


@router.post("/{token}/upload", status_code=status.HTTP_201_CREATED)
async def portal_upload(
    token: str,
    file: UploadFile = File(...),
    projectId: str = Form(...),
):
    profile = _resolve(token)
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
async def portal_download(token: str, document_id: str):
    profile = _resolve(token)
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


@router.get("/{token}/proposal")
async def portal_proposal(token: str):
    """Return proposal metadata for the client's assigned proposal-kind projects
    where the proposal has been sent."""
    from app.services.client_proposal_service import get_proposal as get_client_proposal

    profile = _resolve(token)
    project_ids = project_ids_for_client(profile["userId"])
    sent = []
    for pid in project_ids:
        proj = get_project(pid)
        if not proj or proj.get("kind") != "proposal":
            continue
        prop = get_client_proposal(pid)
        if not prop.get("sentToClient"):
            continue
        sent.append({
            "projectId": pid,
            "title": (prop.get("content") or {}).get("title") or proj.get("name", "Proposal"),
            "projectName": proj.get("name", ""),
            "date": (prop.get("content") or {}).get("date") or prop.get("updatedAt"),
            "sentAt": prop.get("sentAt"),
            "status": "sent",
        })
    return sent


@router.get("/{token}/proposal/download")
async def portal_proposal_download(token: str, projectId: str):
    """Return the full proposal content + inputs as JSON so the portal page can
    render the PDF client-side (same as the internal Download PDF button)."""
    from app.services.client_proposal_service import get_proposal as get_client_proposal

    profile = _resolve(token)
    if projectId not in project_ids_for_client(profile["userId"]):
        raise HTTPException(status_code=403, detail="This project isn't linked to your account.")
    prop = get_client_proposal(projectId)
    if not prop.get("sentToClient"):
        raise HTTPException(status_code=404, detail="No proposal has been shared with you for this project.")
    proj = get_project(projectId)
    return {
        "content": prop.get("content"),
        "inputs": prop.get("inputs") or {},
        "projectName": proj.get("name", "") if proj else "",
        "currency": proj.get("currency", "OMR") if proj else "OMR",
    }


# ─────────────────────────────────────────────────────────────────────────────
# DISABLED — email OTP + verified session (kept for future restore)
#
# The portal used to require a 6-digit code emailed to the client's registered
# address, which minted a verified session sent as the `X-Portal-Session` header.
# To re-enable: restore the imports (logging, Header, Optional, BaseModel,
# email_service, portal_auth_service as auth, config), re-add `_mask_email` /
# `_require_session`, swap the `_resolve(...)` calls above back to
# `_require_session(token, x_portal_session)`, and uncomment the routes below.
#
# import logging
# from typing import Optional
# from fastapi import Header
# from pydantic import BaseModel
# from app import config
# from app.services import email_service, portal_auth_service as auth
#
# logger = logging.getLogger("portal")
#
# class VerifyBody(BaseModel):
#     code: str
#
# def _mask_email(email: str) -> str:
#     if not email or "@" not in email:
#         return email or ""
#     name, domain = email.split("@", 1)
#     head = name[0] if name else "*"
#     return f"{head}{'*' * max(3, len(name) - 1)}@{domain}"
#
# def _require_session(token: str, session: Optional[str]) -> dict:
#     profile = _resolve(token)
#     if not auth.validate_session(token, session):
#         raise HTTPException(status_code=401, detail="Please verify your email to continue.")
#     return profile
#
# @router.post("/{token}/request-otp")
# async def portal_request_otp(token: str):
#     profile = _resolve(token)
#     email = (profile.get("email") or "").strip()
#     if not email:
#         raise HTTPException(status_code=400, detail="No email is on file for this client.")
#     code = auth.create_otp(token, email)
#     if not email_service.is_configured():
#         logger.warning("PORTAL OTP could not be emailed (SMTP not configured) for %s", email)
#         raise HTTPException(status_code=503, detail="OTP could not be sent. Please contact admin.")
#     try:
#         email_service.send_otp(email, code)
#     except Exception:  # noqa: BLE001
#         logger.exception("OTP email failed")
#         raise HTTPException(status_code=502, detail="OTP could not be sent. Please contact admin.")
#     return {"sent": True, "email": _mask_email(email), "expiresInMinutes": config.OTP_TTL_MINUTES}
#
# @router.post("/{token}/verify-otp")
# async def portal_verify_otp(token: str, body: VerifyBody):
#     profile = _resolve(token)
#     result, error = auth.verify_otp(token, body.code, profile["userId"], profile.get("email") or "")
#     if error:
#         raise HTTPException(status_code=400, detail=error)
#     return result
# ─────────────────────────────────────────────────────────────────────────────
