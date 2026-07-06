import asyncio
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.schemas.document import CommentIn, CommentOut, DocumentIn, DocumentOut
from app.services.document_service import (
    add_comment,
    create_document,
    delete_comment,
    delete_document,
    get_document,
    get_document_file,
    list_by_project,
    list_comments,
    list_pending_ids,
    next_document_id,
    set_analysis_status,
    update_comment,
)
from app.services.document_analysis import run_analysis, run_many
# Google Drive storage is on hold — files are stored in the database for now.
# Keep this import + the commented code below so Drive can be switched back on
# later without rewriting anything.
from app.services import drive_service  # noqa: F401
from app.api.v1.deps import get_current_user

router = APIRouter()

_EXT_TYPE = {
    "pdf": "PDF", "doc": "DOCX", "docx": "DOCX", "xls": "XLSX", "xlsx": "XLSX",
    "xml": "P6 XML", "xer": "P6 XML", "mpp": "MPP",
    "png": "Scan", "jpg": "Scan", "jpeg": "Scan", "tif": "Scan", "tiff": "Scan",
}


def _doc_type(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return _EXT_TYPE.get(ext, "Other")


@router.get("/project/{project_id}", response_model=List[DocumentOut])
async def documents_for_project(project_id: str, _=Depends(get_current_user)):
    """All documents uploaded against a project (admin and client both read this)."""
    return list_by_project(project_id)


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    projectId: str = Form(...),
    uploadedBy: str = Form(""),
    claimRef: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    analyze: bool = Form(True),
    user=Depends(get_current_user),
):
    """Receive the file, store its bytes, and (for staff uploads) kick off AI
    analysis in the background so the upload returns immediately even for large
    files.

    Client-uploaded documents are NEVER auto-analysed — analysis is a staff
    action. A client's files land un-analysed and an admin runs analysis from the
    workspace ("Analyse pending"). This is enforced server-side by role, not just
    the `analyze` flag, so a client cannot trigger analysis."""
    is_client = user.get("role") == "Client View"
    should_analyze = bool(os.getenv("ANTHROPIC_API_KEY")) and analyze and not is_client

    content = await file.read()
    doc_id = next_document_id()  # short sequential id: doc-1, doc-2, ...

    # ── Google Drive storage (ON HOLD) ────────────────────────────────────────
    # Re-enable this block (and remove the database `data`/`mime` lines below)
    # to switch file storage back to Google Drive.
    # if not drive_service.is_configured():
    #     raise HTTPException(status_code=503, detail="Google Drive is not configured on the server.")
    # try:
    #     drive_id = drive_service.upload_file(content, file.filename or "file", file.content_type)
    # except Exception as exc:  # noqa: BLE001 — surface a clean error to the client
    #     raise HTTPException(status_code=502, detail=f"Drive upload failed: {exc}")
    # ──────────────────────────────────────────────────────────────────────────

    record = {
        "id": doc_id,
        "projectId": projectId,
        "name": file.filename or "file",
        "type": _doc_type(file.filename or ""),
        "sizeKB": max(1, round(len(content) / 1024)),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "uploadedBy": uploadedBy or "",
        "status": "Uploaded",
        "claimRef": claimRef,
        "note": note,
        # Reuse driveFileId as the "downloadable file is stored" marker so the
        # frontend keeps showing its download button. Bytes live in `data`.
        # For Drive, set this to `drive_id` instead.
        "driveFileId": doc_id,
        "data": content,
        "mime": file.content_type or "application/octet-stream",
    }
    if should_analyze:
        record["analysisStatus"] = "pending"
    # Inserting the file bytes is blocking and the file can be large — keep it off
    # the event loop so concurrent requests (e.g. login) stay responsive.
    saved = await asyncio.to_thread(create_document, record)

    # Analyse in the background — the response returns now, not after the model call.
    if should_analyze:
        background.add_task(run_analysis, doc_id)
    return saved


_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)


@router.post("/{document_id}/analyze", response_model=DocumentOut)
async def analyze_project_document(
    document_id: str, background: BackgroundTasks, _=Depends(get_current_user),
):
    """Queue (re)analysis of a stored document and return immediately. The result
    is written to the row in the background; the client polls for it."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)
    if not get_document(document_id):
        raise HTTPException(status_code=404, detail="Document not found")

    updated = set_analysis_status(document_id, "pending")
    background.add_task(run_analysis, document_id)
    return updated


@router.post("/project/{project_id}/analyze-pending", response_model=List[DocumentOut])
async def analyze_pending_documents(
    project_id: str, background: BackgroundTasks, _=Depends(get_current_user),
):
    """Queue analysis for every not-yet-analysed document in a project (bulk).
    Returns the project's documents with the queued ones marked pending."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)

    pending = list_pending_ids(project_id)
    for doc_id in pending:
        set_analysis_status(doc_id, "pending")
    if pending:
        background.add_task(run_many, pending)
    return list_by_project(project_id)


@router.get("/{document_id}/download")
async def download_document(document_id: str, _=Depends(get_current_user)):
    # ── Google Drive download (ON HOLD) ───────────────────────────────────────
    # doc = get_document(document_id)
    # if not doc:
    #     raise HTTPException(status_code=404, detail="Document not found")
    # if not doc.get("driveFileId"):
    #     raise HTTPException(status_code=404, detail="No stored file for this document.")
    # try:
    #     data = drive_service.download_file(doc["driveFileId"])
    # except Exception as exc:  # noqa: BLE001
    #     raise HTTPException(status_code=502, detail=f"Drive download failed: {exc}")
    # ──────────────────────────────────────────────────────────────────────────

    stored = get_document_file(document_id)
    if not stored:
        raise HTTPException(status_code=404, detail="No stored file for this document.")
    data, filename, mime = stored
    return StreamingResponse(
        iter([data]),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{document_id}/comments", response_model=List[CommentOut])
async def document_comments(document_id: str, _=Depends(get_current_user)):
    """All comments/notes attached to a document."""
    return list_comments(document_id)


@router.post("/{document_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def add_document_comment(document_id: str, body: CommentIn, user=Depends(get_current_user)):
    """Attach a comment to a document (author taken from the logged-in user)."""
    text = (body.body or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")
    if not get_document(document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return add_comment(
        document_id,
        text,
        author=user.get("name") or user.get("email") or "",
        author_id=user.get("id"),
        anchor_text=body.anchorText,
        anchor_start=body.anchorStart,
        anchor_length=body.anchorLength,
    )


@router.put("/comments/{comment_id}", response_model=CommentOut)
async def edit_document_comment(comment_id: str, body: CommentIn, _=Depends(get_current_user)):
    text = (body.body or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")
    updated = update_comment(comment_id, text)
    if not updated:
        raise HTTPException(status_code=404, detail="Comment not found")
    return updated


@router.delete("/comments/{comment_id}")
async def remove_document_comment(comment_id: str, _=Depends(get_current_user)):
    if not delete_comment(comment_id):
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}


@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def add_document(body: DocumentIn, _=Depends(get_current_user)):
    """Metadata-only create (kept for compatibility; no file bytes)."""
    return create_document(body.model_dump())


@router.delete("/{document_id}")
async def remove_document(document_id: str, _=Depends(get_current_user)):
    # ── Google Drive cleanup (ON HOLD) — bytes now live in the DB row itself ───
    # doc = get_document(document_id)
    # if doc and doc.get("driveFileId"):
    #     try:
    #         drive_service.delete_file(doc["driveFileId"])
    #     except Exception:  # noqa: BLE001 — best-effort; still remove the record
    #         pass
    # ──────────────────────────────────────────────────────────────────────────
    if not delete_document(document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}
