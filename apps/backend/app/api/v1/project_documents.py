from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.document import DocumentIn, DocumentOut
from app.services.document_service import create_document, delete_document, list_by_project
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.get("/project/{project_id}", response_model=List[DocumentOut])
async def documents_for_project(project_id: str, _=Depends(get_current_user)):
    """All documents uploaded against a project (admin and client both read this)."""
    return list_by_project(project_id)


@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def add_document(body: DocumentIn, _=Depends(get_current_user)):
    return create_document(body.model_dump())


@router.delete("/{document_id}")
async def remove_document(document_id: str, _=Depends(get_current_user)):
    if not delete_document(document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}
