from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.schemas.document import DocumentIn, DocumentOut
from app.services.document_service import (
    create_document,
    delete_document,
    get_document,
    get_document_file,
    list_by_project,
    next_document_id,
)
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
    file: UploadFile = File(...),
    projectId: str = Form(...),
    uploadedBy: str = Form(""),
    claimRef: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    _=Depends(get_current_user),
):
    """Receive the actual file, store its bytes in the database, and save the record."""
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
    return create_document(record)


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
