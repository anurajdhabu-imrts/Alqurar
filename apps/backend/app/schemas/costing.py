"""Schemas for a proposal's costing sheet.

The whole sheet (activities + their entries + the percentage settings) is read and
saved as one document via GET/PUT — this matches how the UI edits it (locally,
then one save) and keeps the snapshot rule simple: every rate is fixed on save.
"""
from typing import List, Optional

from pydantic import BaseModel


class CostingEntryIn(BaseModel):
    role: str = ""
    employeeId: Optional[str] = None
    employeeName: Optional[str] = None
    hours: float = 0
    # The hourly rate captured from the Employee master when this row was added.
    # Persisted as-is so future master-rate changes never rewrite a saved costing.
    rate: float = 0


class CostingEntryOut(CostingEntryIn):
    id: str
    activityId: str
    projectId: str
    sortIndex: int = 0
    # Derived, never stored: hours × rate.
    total: float = 0


class CostingActivityIn(BaseModel):
    description: str = ""
    entries: List[CostingEntryIn] = []


class CostingActivityOut(BaseModel):
    id: str
    projectId: str
    description: str
    sortIndex: int = 0
    entries: List[CostingEntryOut] = []
    # Derived: sum of the activity's entry totals.
    total: float = 0


class CostingSettingsIn(BaseModel):
    contingencyPct: float = 10
    overheadsPct: float = 15
    profitPct: float = 25
    incomeTaxPct: float = 15
    vatPct: float = 0


class CostingSettingsOut(CostingSettingsIn):
    projectId: str
    updatedAt: Optional[str] = None


class CostingSummary(BaseModel):
    """The Cost Summary waterfall, computed server-side with Excel-parity logic so
    API consumers (and future reports/invoices) get the same numbers as the UI."""

    totalCost: float
    contingencyPct: float
    contingencyAmount: float
    subtotalAfterContingency: float
    overheadsPct: float
    overheadsAmount: float
    subtotalAfterOverheads: float
    profitPct: float
    profitAmount: float
    subtotalAfterProfit: float
    incomeTaxPct: float
    incomeTaxAmount: float
    subtotalAfterIncomeTax: float
    vatPct: float
    vatAmount: float
    suggestedPricing: float


class CostingSheetOut(BaseModel):
    projectId: str
    activities: List[CostingActivityOut] = []
    settings: CostingSettingsOut
    summary: CostingSummary


class CostingSheetIn(BaseModel):
    """Replace the whole sheet for a proposal in one call."""

    activities: List[CostingActivityIn] = []
    settings: CostingSettingsIn
