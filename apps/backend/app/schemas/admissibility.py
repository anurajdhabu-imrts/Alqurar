from typing import List, Optional

from pydantic import BaseModel


class AdmissibilityCriterion(BaseModel):
    """One compliance check within a clause group."""

    id: Optional[str] = None
    category: str = ""
    subClause: str = ""
    description: str = ""
    overallWtg: float = 0


class AdmissibilityClause(BaseModel):
    """One clause group in the matrix, allocated a share of the 100 marks."""

    id: Optional[str] = None
    clauseRef: str = ""
    label: str = ""
    marks: float = 0
    # book | modified | new | manual
    source: str = "book"
    note: str = ""
    criteria: List[AdmissibilityCriterion] = []


class AdmissibilityContent(BaseModel):
    clauses: List[AdmissibilityClause] = []
    summary: str = ""


class AdmissibilitySave(BaseModel):
    """PUT body — the analyst-edited matrix."""

    content: AdmissibilityContent
