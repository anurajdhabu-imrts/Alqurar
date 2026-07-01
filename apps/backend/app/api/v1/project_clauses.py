"""Per-project Clause Library API.

Each project has its own clause library (project_clauses), built from that
project's uploaded contract. Routes are nested under a project:
    GET    /projects/{project_id}/clauses
    POST   /projects/{project_id}/clauses
    PATCH  /projects/{project_id}/clauses/{clause_id}
    DELETE /projects/{project_id}/clauses/{clause_id}
    POST   /projects/{project_id}/clauses/extract          (upload the contract)
    GET    /projects/{project_id}/clauses/extract-status   (poll AI extraction)

`extract` stores the uploaded contract in the project's data room and, when the
Anthropic key is configured, kicks off background AI extraction that fills the
project's clause library. The client polls `extract-status` for progress.
"""
import os
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status

from app.schemas.project_clause import (
    ProjectClauseCreate,
    ProjectClauseOut,
    ProjectClauseUpdate,
)
from app.services import clause_extraction
from app.services.document_service import create_document, next_document_id
from app.services.project_clause_service import (
    add_clause,
    delete_clause,
    get_clause,
    list_by_project,
    update_clause,
)
from app.api.v1.deps import get_current_user, require_permission

router = APIRouter()

# Adding/editing/removing clauses is a contract-management action — the same
# permission the global clause library used.
_MANAGE = require_permission("contracts.manage")

_EXT_TYPE = {
    "pdf": "PDF", "doc": "DOCX", "docx": "DOCX", "xls": "XLSX", "xlsx": "XLSX",
}


def _doc_type(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return _EXT_TYPE.get(ext, "Other")


@router.get("/{project_id}/clauses", response_model=List[ProjectClauseOut])
async def get_project_clauses(project_id: str, _=Depends(get_current_user)):
    """This project's clause library (all authenticated users can read it)."""
    return list_by_project(project_id)


@router.post("/{project_id}/clauses", response_model=ProjectClauseOut, status_code=status.HTTP_201_CREATED)
async def create_project_clause(
    project_id: str,
    payload: ProjectClauseCreate,
    current_user=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    if not payload.contract_standard.strip():
        raise HTTPException(status_code=400, detail="Contract standard is required.")
    if not payload.clause_number.strip():
        raise HTTPException(status_code=400, detail="Clause number is required.")
    if not payload.clause_title.strip():
        raise HTTPException(status_code=400, detail="Clause title is required.")
    return add_clause(project_id, payload.model_dump(), created_by=current_user["id"])


@router.patch("/{project_id}/clauses/{clause_id}", response_model=ProjectClauseOut)
async def patch_project_clause(
    project_id: str,
    clause_id: str,
    payload: ProjectClauseUpdate,
    _=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    updated = update_clause(clause_id, payload.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Clause not found")
    return updated


@router.delete("/{project_id}/clauses/{clause_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_clause(
    project_id: str,
    clause_id: str,
    _=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    if not get_clause(clause_id):
        raise HTTPException(status_code=404, detail="Clause not found")
    delete_clause(clause_id)


@router.post("/{project_id}/clauses/extract", status_code=status.HTTP_201_CREATED)
async def upload_contract_for_clauses(
    project_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    """Upload this project's contract and (when AI is configured) extract its clauses.

    The contract is stored in the project's data room, then Claude reads it in the
    background and fills the clause library. The client polls `extract-status`.
    If the Anthropic key isn't set, the contract is saved and the response says so.
    """
    content = await file.read()
    doc_id = next_document_id()
    record = {
        "id": doc_id,
        "projectId": project_id,
        "name": file.filename or "contract",
        "type": _doc_type(file.filename or ""),
        "sizeKB": max(1, round(len(content) / 1024)),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "uploadedBy": current_user.get("name") or current_user.get("email") or "",
        "status": "Uploaded",
        "claimRef": "Contract",
        "note": "Uploaded for clause extraction",
        "driveFileId": doc_id,
        "data": content,
        "mime": file.content_type or "application/octet-stream",
    }
    create_document(record)

    if not os.getenv("ANTHROPIC_API_KEY"):
        return {
            "stored": True,
            "documentId": doc_id,
            "status": "idle",
            "message": "Contract saved. AI clause extraction will run once the Anthropic key is enabled.",
        }

    clause_extraction.mark_running(project_id)
    background.add_task(clause_extraction.run_extraction, project_id, doc_id)
    return {
        "stored": True,
        "documentId": doc_id,
        "status": "running",
        "message": "Contract saved. Claude is reading it and extracting the clauses…",
    }


@router.get("/{project_id}/clauses/extract-status")
async def clause_extraction_status(project_id: str, _=Depends(get_current_user)):
    """Current state of background clause extraction for a project."""
    return clause_extraction.get_status(project_id)
