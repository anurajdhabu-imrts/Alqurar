"""Delay-analysis method-selection model — canonical factors + scoring.

This reproduces the business's "Delay Analysis Method Selection - Model" workbook.
Four candidate methodologies are scored against 17 weighted selection factors; the
method with the highest weighted total is the recommended one.

CANONICAL (defined here, never per-proposal):
  * METHODS        — the 4 candidate methodologies (fixed ids + labels).
  * FACTORS        — the 17 selection factors, each with a group, a weight (D from
                     the workbook, "Absolute Weightages based on Global standards"),
                     and either:
                        - a detailed sub-table: records each carrying the FIXED
                          per-method Requirement (Yes/No), plus an editable field
                          (Availability / Applicable / Suitable / Purpose); or
                        - no sub-table: the suitability score is entered directly.

EDITABLE STATE (per proposal, stored on MethodologyAssessment):
  * availability   — factorNo → recordIndex → methodId → "yes"/"no"/""
  * directScores   — factorNo → methodId → "yes"/"no" (a single Yes/No per method for
                     the factors that have no sub-table)

SCORING (verified against the workbook):
    score(record, method)   = 1 if Requirement=Yes AND Availability=Yes else 0
    suitability(factor,m)    = Σ score / Σ (Requirement=Yes)   (0 when denominator 0)
                               = 1 if Yes else 0 for the no-sub-table factors
    finalScore(factor, m)    = suitability × weight
    total(method)            = Σ finalScore over the 17 factors
    recommended              = method with the greatest total (None if all zero)
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import MethodologyAssessment

# ── The 4 candidate methodologies (order = the workbook's column order) ──────────
METHODS: List[Dict] = [
    {"id": "ap", "label": "As-Planned vs As-Built"},
    {"id": "im", "label": "Impacted As-Planned"},
    {"id": "cb", "label": "Collapsed As-Built"},
    {"id": "tia", "label": "TIA / Window Analysis"},
]
METHOD_IDS = [m["id"] for m in METHODS]


def _req(ap: int, im: int, cb: int, tia: int) -> Dict[str, str]:
    """Expand a fixed Yes/No requirement tuple (order ap, im, cb, tia)."""
    vals = (ap, im, cb, tia)
    return {mid: ("yes" if vals[i] else "no") for i, mid in enumerate(METHOD_IDS)}


# ── The 17 selection factors ────────────────────────────────────────────────────
# Detailed factors carry `records` = [(record name, (req_ap, req_im, req_cb, req_tia))].
# `field` is the label of the editable column. Non-detailed factors omit `records`.
_FACTORS_RAW: List[Dict] = [
    {
        "no": 1, "group": "Record Availability", "name": "Record Availability",
        "weight": 1.00, "field": "Availability (based on the Project data)",
        "records": [
            ("Outline of Delay Events", (1, 1, 1, 1)),
            ("Start dates of delay events", (1, 1, 1, 1)),
            ("Finish Dates of the delay events", (1, 1, 1, 1)),
            ("Activities affected by delays", (0, 1, 1, 1)),
            ("Duration of the delay events", (1, 1, 1, 1)),
            ("Original planned completion date (or as extended)", (1, 1, 1, 1)),
            ("Actual completion date", (1, 0, 1, 1)),
            ("As-planned critical path(s)", (1, 1, 0, 1)),
            ("As-built critical path", (1, 0, 1, 0)),
            ("Updates critical or near critical path(s)", (0, 0, 0, 1)),
            ("Update, or schedule revision dates", (0, 0, 0, 1)),
            ("Activity list with leads and lag", (1, 1, 1, 1)),
        ],
    },
    {
        "no": 2, "group": "Baseline Programme Characteristics", "name": "Baseline Programme Availability",
        "weight": 0.86, "field": "Availability (based on the Project data)",
        "records": [
            ("Baseline Programme", (1, 1, 1, 1)),
        ],
    },
    {
        "no": 3, "group": "Baseline Programme Characteristics", "name": "Nature of Baseline Programme",
        "weight": 0.73, "field": "Availability (based on the Project data)",
        "records": [
            ("Available in CPM diagram", (1, 1, 0, 1)),
            ("Includes all relevant activities", (1, 1, 0, 1)),
            ("Reasonable activity durations", (1, 1, 0, 1)),
            ("Reasonable activity relationships", (1, 1, 0, 1)),
            ("Activities defined in appropriate detail", (1, 1, 0, 1)),
        ],
    },
    {
        "no": 4, "group": "Contractual Requirements", "name": "Updated Programmes availability",
        "weight": 0.72, "field": "Availability (based on the Project data)",
        "records": [
            ("Intermediate regular programme updates available", (0, 0, 0, 1)),
            ("Final updated programme available (as-built programme)", (1, 0, 1, 1)),
        ],
    },
    {
        "no": 5, "group": "Contractual Requirements",
        "name": "Applicable Legislation (if any) for choosing the methodology",
        "weight": 0.37, "field": "Applicable",
        "records": [
            ("Applicable Legislation for choosing the methodology", (1, 1, 1, 1)),
        ],
    },
    {
        "no": 6, "group": "Contractual Requirements",
        "name": "Form of Contract (Any Method specified in the Contract)",
        "weight": 0.61, "field": "Applicable",
        "records": [
            ("Form of Contract - Any methodology specified in the Contract", (1, 1, 1, 1)),
        ],
    },
    {
        "no": 7, "group": "Contractual Requirements", "name": "Dispute Resolution Forum",
        "weight": 0.56, "field": "Suitable",
        "records": [
            ("Dispute Resolution Forum suitability", (1, 1, 1, 1)),
        ],
    },
    {
        "no": 8, "group": "Timing of the Analysis", "name": "Purpose for the analysis",
        "weight": 0.63, "field": "Purpose (based on Project)",
        "records": [
            ("Extension of time", (1, 1, 1, 1)),
            ("Prolongation Cost", (1, 0, 1, 1)),
            ("Acceleration effects", (0, 0, 0, 1)),
            ("Disruption effects", (0, 0, 0, 1)),
        ],
    },
    {
        "no": 9, "group": "Timing of the Analysis",
        "name": "Time of Delay relative to the current stage of Project", "weight": 0.64,
    },
    {
        "no": 10, "group": "Project characteristics", "name": "Project complexity", "weight": 0.67,
    },
    {
        "no": 11, "group": "Project characteristics", "name": "The amount in dispute",
        "weight": 0.75, "field": "Availability (based on the Project data)",
        "records": [
            ("The amount of Dispute", (1, 1, 1, 1)),
        ],
    },
    {
        "no": 12, "group": "Project characteristics", "name": "Duration & Size of the Project",
        "weight": 0.52, "field": "Availability (based on the Project data)",
        "records": [
            ("Duration & Size of Project", (1, 1, 1, 1)),
        ],
    },
    {
        "no": 13, "group": "Project characteristics", "name": "Nature of delaying events", "weight": 0.66,
    },
    {
        "no": 14, "group": "Project characteristics", "name": "Number of delaying events", "weight": 0.68,
    },
    {
        "no": 15, "group": "Project characteristics", "name": "The other party to the claim", "weight": 0.46,
    },
    {
        "no": 16, "group": "Cost Proportionality", "name": "Cost of using method", "weight": 0.59,
    },
    {
        "no": 17, "group": "Cost Proportionality", "name": "Skills of the analyst", "weight": 0.67,
    },
]


def canonical_factors() -> List[Dict]:
    """Expand the raw factor table into full dicts (requirements as method→yes/no)."""
    out: List[Dict] = []
    for f in _FACTORS_RAW:
        base = {"no": f["no"], "group": f["group"], "name": f["name"], "weight": f["weight"]}
        if f.get("records"):
            base["hasDetail"] = True
            base["field"] = f["field"]
            base["records"] = [
                {"index": i, "name": name, "requirement": _req(*req)}
                for i, (name, req) in enumerate(f["records"])
            ]
        else:
            base["hasDetail"] = False
        out.append(base)
    return out


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Scoring ──────────────────────────────────────────────────────────────────────

def compute_summary(factors: List[Dict]) -> Dict:
    """Compute suitability/final scores per factor, per-method totals and the
    recommended method. `factors` must already carry merged state (record
    `availability` for detailed factors, `directScores` for the rest)."""
    per_factor: List[Dict] = []
    totals = {mid: 0.0 for mid in METHOD_IDS}

    for f in factors:
        suitability: Dict[str, float] = {}
        for mid in METHOD_IDS:
            if f.get("hasDetail"):
                req_count = 0
                score_sum = 0
                for r in f["records"]:
                    if r["requirement"].get(mid) == "yes":
                        req_count += 1
                        if r.get("availability", {}).get(mid) == "yes":
                            score_sum += 1
                suitability[mid] = (score_sum / req_count) if req_count else 0.0
            else:
                # No sub-table: a single Yes/No per method → 1 if Yes else 0.
                suitability[mid] = 1.0 if f.get("directScores", {}).get(mid) == "yes" else 0.0

        final = {mid: suitability[mid] * f["weight"] for mid in METHOD_IDS}
        for mid in METHOD_IDS:
            totals[mid] += final[mid]
        per_factor.append({"no": f["no"], "suitability": suitability, "finalScore": final})

    best = max(totals, key=lambda m: totals[m]) if totals else None
    recommended = best if (best is not None and totals[best] > 0) else None

    return {"perFactor": per_factor, "totals": totals, "recommended": recommended}


# ── Read / replace state ──────────────────────────────────────────────────────────

def _merge_state(factors: List[Dict], availability: Dict, direct_scores: Dict) -> None:
    """Fold the saved editable state into the canonical factor list (in place)."""
    for f in factors:
        key = str(f["no"])
        if f.get("hasDetail"):
            fa = availability.get(key, {}) if isinstance(availability, dict) else {}
            for r in f["records"]:
                cell = fa.get(str(r["index"]), {}) if isinstance(fa, dict) else {}
                r["availability"] = {
                    mid: (cell.get(mid) if cell.get(mid) in ("yes", "no") else "")
                    for mid in METHOD_IDS
                }
        else:
            fd = direct_scores.get(key, {}) if isinstance(direct_scores, dict) else {}
            f["directScores"] = {
                mid: (fd.get(mid) if fd.get(mid) in ("yes", "no") else "")
                for mid in METHOD_IDS
            }


def get_assessment(project_id: str) -> Dict:
    """The proposal's full methodology assessment: canonical factors merged with
    saved state, plus the computed summary and recommendation."""
    with SessionLocal() as db:
        row = db.get(MethodologyAssessment, project_id)
        state = row.to_dict() if row else {
            "knowMethodology": False, "manualSelection": None,
            "availability": {}, "directScores": {}, "updatedAt": None,
        }

    factors = canonical_factors()
    _merge_state(factors, state.get("availability", {}), state.get("directScores", {}))
    summary = compute_summary(factors)

    return {
        "projectId": project_id,
        "knowMethodology": bool(state.get("knowMethodology")),
        "manualSelection": state.get("manualSelection"),
        "methods": METHODS,
        "factors": factors,
        "summary": summary,
        "updatedAt": state.get("updatedAt"),
    }


def replace_assessment(project_id: str, state: Dict) -> Dict:
    """Replace the proposal's whole assessment state in one transaction. Only the
    editable state is stored; requirements/weights are never trusted from the client."""
    valid_nos = {str(f["no"]) for f in _FACTORS_RAW}
    detail_nos = {str(f["no"]) for f in _FACTORS_RAW if f.get("records")}

    # Sanitise availability → factorNo → recordIndex → methodId → "yes"/"no"/""
    raw_avail = state.get("availability") or {}
    availability: Dict = {}
    if isinstance(raw_avail, dict):
        for fno, recs in raw_avail.items():
            if str(fno) not in detail_nos or not isinstance(recs, dict):
                continue
            clean_recs: Dict = {}
            for ridx, cells in recs.items():
                if not isinstance(cells, dict):
                    continue
                clean_cells = {
                    mid: cells.get(mid)
                    for mid in METHOD_IDS
                    if cells.get(mid) in ("yes", "no")
                }
                if clean_cells:
                    clean_recs[str(ridx)] = clean_cells
            if clean_recs:
                availability[str(fno)] = clean_recs

    # Sanitise directScores → factorNo → methodId → "yes"/"no"
    raw_direct = state.get("directScores") or {}
    direct_scores: Dict = {}
    if isinstance(raw_direct, dict):
        for fno, cells in raw_direct.items():
            if str(fno) not in valid_nos or str(fno) in detail_nos or not isinstance(cells, dict):
                continue
            clean_cells = {
                mid: cells.get(mid)
                for mid in METHOD_IDS
                if cells.get(mid) in ("yes", "no")
            }
            if clean_cells:
                direct_scores[str(fno)] = clean_cells

    manual = state.get("manualSelection")
    if manual not in METHOD_IDS:
        manual = None

    now = _now()
    with SessionLocal() as db:
        row = db.get(MethodologyAssessment, project_id)
        if not row:
            row = MethodologyAssessment(projectId=project_id)
            db.add(row)
        row.knowMethodology = bool(state.get("knowMethodology"))
        row.manualSelection = manual
        row.availability = availability
        row.directScores = direct_scores
        row.updatedAt = now
        db.commit()

    return get_assessment(project_id)


def delete_assessment(project_id: str) -> None:
    """Remove a proposal's methodology assessment entirely."""
    with SessionLocal() as db:
        row = db.get(MethodologyAssessment, project_id)
        if row:
            db.delete(row)
            db.commit()
