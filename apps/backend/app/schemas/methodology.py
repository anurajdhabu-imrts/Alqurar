"""Schemas for a proposal's delay-analysis method-selection model.

Only the editable STATE is validated on save (knowMethodology / manualSelection /
availability / directScores). The canonical factor definitions, requirements and
weights — and the computed suitability / final / total scores and recommendation —
are produced by the service and returned as a plain dict (no strict response model,
because the nested canonical structure is large and dynamic).
"""
from typing import Dict, Optional

from pydantic import BaseModel


class MethodologyStateIn(BaseModel):
    """Replace the whole assessment state for a proposal in one call."""

    # True  → the analyst picks the method by hand (manualSelection).
    # False → the weighted scoring model recommends one.
    knowMethodology: bool = False
    manualSelection: Optional[str] = None
    # factorNo → recordIndex → methodId → "yes" | "no" | ""
    availability: Dict[str, Dict[str, Dict[str, str]]] = {}
    # factorNo → methodId → "yes" | "no"  (a single Yes/No per method for the
    # factors that have no sub-table)
    directScores: Dict[str, Dict[str, str]] = {}
