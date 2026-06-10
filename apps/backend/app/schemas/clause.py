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


class ClauseOut(BaseModel):
    """A clause as stored in the clause_library table."""
    id: str
    contract_standard: str
    clause_number: str
    clause_title: str
    clause_description: str
    tags: List[str] = []
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ClauseCreate(BaseModel):
    contract_standard: str
    clause_number: str
    clause_title: str
    clause_description: str = ""
    tags: List[str] = []

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, v):
        return _clean_tags(v)


class ClauseUpdate(BaseModel):
    contract_standard: Optional[str] = None
    clause_number: Optional[str] = None
    clause_title: Optional[str] = None
    clause_description: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, v):
        return None if v is None else _clean_tags(v)
