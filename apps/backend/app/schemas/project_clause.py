"""Schemas for a project's own Clause Library (project_clauses table).

Mirrors the global clause schema but each clause belongs to one project. The
`projectId` comes from the URL path, so it is not part of the create/update body.
"""
from typing import List, Optional

from pydantic import BaseModel, field_validator


def _clean_tags(tags) -> List[str]:
    """Normalise tags: accept a list or a comma/space string, strip leading '#'."""
    if tags is None:
        return []
    if isinstance(tags, str):
        parts = tags.replace(",", " ").split()
    else:
        parts = list(tags)
    out: List[str] = []
    for t in parts:
        t = str(t).strip().lstrip("#").strip()
        if t and t not in out:
            out.append(t)
    return out


class ProjectClauseOut(BaseModel):
    """A clause as stored in the project_clauses table."""
    id: str
    projectId: str
    contract_standard: str
    clause_number: str
    clause_title: str
    clause_description: str
    tags: List[str] = []
    # "manual" | "book" | "ai" — where the clause came from.
    source: str = "manual"
    # Set when the project's Particular Conditions amend this base clause.
    modified: bool = False
    modification_note: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProjectClauseCreate(BaseModel):
    contract_standard: str
    clause_number: str
    clause_title: str
    clause_description: str = ""
    tags: List[str] = []

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, v):
        return _clean_tags(v)


class ProjectClauseUpdate(BaseModel):
    contract_standard: Optional[str] = None
    clause_number: Optional[str] = None
    clause_title: Optional[str] = None
    clause_description: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, v):
        return None if v is None else _clean_tags(v)
