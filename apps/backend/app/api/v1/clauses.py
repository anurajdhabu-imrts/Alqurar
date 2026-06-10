from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.clause import ClauseCreate, ClauseOut, ClauseUpdate
from app.services.clause_service import (
    add_clause,
    delete_clause,
    get_clause,
    list_clauses,
    update_clause,
)
from app.api.v1.deps import get_current_user, require_permission

router = APIRouter()

# Adding/editing/removing clauses is a contract-management action — held by the
# Administrator and Contract Manager roles ("Manage clauses & obligations").
_MANAGE = require_permission("contracts.manage")


@router.get("/", response_model=List[ClauseOut])
async def get_clauses(_=Depends(get_current_user)):
    """All authenticated users can read the clause reference library."""
    return list_clauses()


@router.post("/", response_model=ClauseOut, status_code=status.HTTP_201_CREATED)
async def create_clause(
    payload: ClauseCreate,
    current_user=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    if not payload.contract_standard.strip():
        raise HTTPException(status_code=400, detail="Contract standard is required.")
    if not payload.clause_number.strip():
        raise HTTPException(status_code=400, detail="Clause number is required.")
    if not payload.clause_title.strip():
        raise HTTPException(status_code=400, detail="Clause title is required.")
    return add_clause(payload.model_dump(), created_by=current_user["id"])


@router.patch("/{clause_id}", response_model=ClauseOut)
async def patch_clause(
    clause_id: str,
    payload: ClauseUpdate,
    _=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    updated = update_clause(clause_id, payload.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Clause not found")
    return updated


@router.delete("/{clause_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_clause(
    clause_id: str,
    _=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    if not get_clause(clause_id):
        raise HTTPException(status_code=404, detail="Clause not found")
    delete_clause(clause_id)
