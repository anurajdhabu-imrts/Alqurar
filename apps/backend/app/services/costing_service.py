"""Proposal costing store + Cost Summary calculation.

One costing sheet per proposal = the CostingActivity rows sharing a projectId, each
owning CostingEntry rows, plus a CostingSettings row of percentage markups. The
whole sheet is read and replaced atomically (get_sheet / replace_sheet), mirroring
how the UI edits locally then saves once.

RATE SNAPSHOT: an entry stores the `rate` it was saved with. This module never
re-reads the Employee master when returning a sheet, so a later master-rate change
cannot alter a proposal that was already costed.

The Cost Summary (compute_summary) reproduces the business's Excel sheet EXACTLY:

    Total Cost   = Σ(hours × rate)
    Contingency  = Total × contingency%
    Overheads    = (Total + Contingency) × overheads%
    Profit       = (Total + Contingency + Overheads) × profit%
    Income Tax   = Profit × incomeTax%          # note: on the profit amount only
    VAT          = (Total+Cont+OH+Profit+Tax) × vat%   # Excel leaves VAT blank → default 0%
    Suggested    = Total + Contingency + Overheads + Profit + Income Tax + VAT

Verified against the reference sheet: Programme (Total 1032) → 1680.8055;
Retainership (Total 480) → 781.77 (both at VAT 0%).
"""
from datetime import datetime, timezone
from typing import Dict, List
from uuid import uuid4

from app.db import SessionLocal
from app.models import CostingActivity, CostingEntry, CostingSettings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_DEFAULTS = {
    "contingencyPct": 10.0,
    "overheadsPct": 15.0,
    "profitPct": 25.0,
    "incomeTaxPct": 15.0,
    "vatPct": 0.0,
}


# ── Calculation (Excel-parity) ──────────────────────────────────────────────

def compute_summary(activities: List[Dict], settings: Dict) -> Dict:
    """Compute the Cost Summary waterfall. `activities` are dicts each with an
    `entries` list of {hours, rate}. Pure function — no DB access."""
    total = 0.0
    for a in activities:
        for e in a.get("entries", []):
            total += float(e.get("hours") or 0) * float(e.get("rate") or 0)

    c = float(settings.get("contingencyPct") or 0) / 100
    o = float(settings.get("overheadsPct") or 0) / 100
    p = float(settings.get("profitPct") or 0) / 100
    it = float(settings.get("incomeTaxPct") or 0) / 100
    v = float(settings.get("vatPct") or 0) / 100

    contingency = total * c
    sub_after_contingency = total + contingency

    overheads = sub_after_contingency * o
    sub_after_overheads = sub_after_contingency + overheads

    profit = sub_after_overheads * p
    sub_after_profit = sub_after_overheads + profit

    # Excel quirk kept deliberately: income tax is a % of the PROFIT amount, not of
    # the running subtotal.
    income_tax = profit * it
    sub_after_income_tax = sub_after_profit + income_tax

    # VAT is not defined in the Excel (default 0%). When configured, it applies to
    # the post-income-tax subtotal — pending business confirmation of the base.
    vat = sub_after_income_tax * v
    suggested = sub_after_income_tax + vat

    return {
        "totalCost": total,
        "contingencyPct": float(settings.get("contingencyPct") or 0),
        "contingencyAmount": contingency,
        "subtotalAfterContingency": sub_after_contingency,
        "overheadsPct": float(settings.get("overheadsPct") or 0),
        "overheadsAmount": overheads,
        "subtotalAfterOverheads": sub_after_overheads,
        "profitPct": float(settings.get("profitPct") or 0),
        "profitAmount": profit,
        "subtotalAfterProfit": sub_after_profit,
        "incomeTaxPct": float(settings.get("incomeTaxPct") or 0),
        "incomeTaxAmount": income_tax,
        "subtotalAfterIncomeTax": sub_after_income_tax,
        "vatPct": float(settings.get("vatPct") or 0),
        "vatAmount": vat,
        "suggestedPricing": suggested,
    }


# ── Settings ────────────────────────────────────────────────────────────────

def _get_or_default_settings(db, project_id: str) -> Dict:
    s = db.get(CostingSettings, project_id)
    if s:
        return s.to_dict()
    return {"projectId": project_id, "updatedAt": None, **_DEFAULTS}


# ── Read / replace the whole sheet ──────────────────────────────────────────

def get_sheet(project_id: str) -> Dict:
    """The proposal's full costing sheet: activities (with entries + derived
    totals), settings, and the computed summary."""
    with SessionLocal() as db:
        acts = (
            db.query(CostingActivity)
            .filter(CostingActivity.projectId == project_id)
            .order_by(CostingActivity.sortIndex)
            .all()
        )
        entries = (
            db.query(CostingEntry)
            .filter(CostingEntry.projectId == project_id)
            .order_by(CostingEntry.sortIndex)
            .all()
        )
        by_activity: Dict[str, List[CostingEntry]] = {}
        for e in entries:
            by_activity.setdefault(e.activityId, []).append(e)

        activities: List[Dict] = []
        for a in acts:
            rows = []
            for e in by_activity.get(a.id, []):
                d = e.to_dict()
                d["total"] = float(e.hours or 0) * float(e.rate or 0)
                rows.append(d)
            ad = a.to_dict()
            ad["entries"] = rows
            ad["total"] = sum(r["total"] for r in rows)
            activities.append(ad)

        settings = _get_or_default_settings(db, project_id)

    summary = compute_summary(activities, settings)
    return {"projectId": project_id, "activities": activities, "settings": settings, "summary": summary}


def replace_sheet(project_id: str, activities: List[Dict], settings: Dict) -> Dict:
    """Replace the proposal's whole costing sheet in one transaction.

    Rates arrive already snapshotted from the client (fetched from the Employee
    master at edit time) and are stored verbatim — this function never reads the
    master, so it cannot retro-change a saved rate.
    """
    now = _now()
    with SessionLocal() as db:
        # Clear the old sheet for this proposal.
        db.query(CostingEntry).filter(CostingEntry.projectId == project_id).delete(synchronize_session=False)
        db.query(CostingActivity).filter(CostingActivity.projectId == project_id).delete(synchronize_session=False)

        entry_sort = 0
        for a_index, a in enumerate(activities):
            activity_id = f"cact-{uuid4().hex[:12]}"
            db.add(CostingActivity(
                id=activity_id,
                projectId=project_id,
                description=(a.get("description") or "").strip(),
                sortIndex=a_index,
                createdAt=now,
                updatedAt=now,
            ))
            for e in a.get("entries", []):
                db.add(CostingEntry(
                    id=f"cent-{uuid4().hex[:12]}",
                    activityId=activity_id,
                    projectId=project_id,
                    role=(e.get("role") or "").strip(),
                    employeeId=e.get("employeeId") or None,
                    employeeName=(e.get("employeeName") or None),
                    hours=float(e.get("hours") or 0),
                    rate=float(e.get("rate") or 0),
                    sortIndex=entry_sort,
                ))
                entry_sort += 1

        # Upsert settings.
        s = db.get(CostingSettings, project_id)
        if not s:
            s = CostingSettings(projectId=project_id)
            db.add(s)
        s.contingencyPct = float(settings.get("contingencyPct", _DEFAULTS["contingencyPct"]))
        s.overheadsPct = float(settings.get("overheadsPct", _DEFAULTS["overheadsPct"]))
        s.profitPct = float(settings.get("profitPct", _DEFAULTS["profitPct"]))
        s.incomeTaxPct = float(settings.get("incomeTaxPct", _DEFAULTS["incomeTaxPct"]))
        s.vatPct = float(settings.get("vatPct", _DEFAULTS["vatPct"]))
        s.updatedAt = now

        db.commit()

    return get_sheet(project_id)


def delete_sheet(project_id: str) -> None:
    """Remove a proposal's costing entirely (e.g. when the proposal is deleted)."""
    with SessionLocal() as db:
        db.query(CostingEntry).filter(CostingEntry.projectId == project_id).delete(synchronize_session=False)
        db.query(CostingActivity).filter(CostingActivity.projectId == project_id).delete(synchronize_session=False)
        db.query(CostingSettings).filter(CostingSettings.projectId == project_id).delete(synchronize_session=False)
        db.commit()
