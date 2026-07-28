"""Proposal EOT-documentation checklist store + canonical item list.

One checklist per proposal = a single ProposalChecklist row (projectId PK) holding
the editable state (status / date / remarks) for each of the 27 standard items. The
27 items themselves are CANONICAL and defined here, so the item wording is owned by
the backend and never drifts per proposal. The row stores only state, keyed by item
`no`; get_checklist merges that state with the canonical text for the API.

Read and replaced as one document (get_checklist / replace_checklist), mirroring the
sibling costing sheet. Filled collaboratively by the client and the analyst — plain
data storage, no AI, no hard-coded sample state.
"""
from datetime import datetime, timezone
from typing import Dict, List

from app.db import SessionLocal
from app.models import ProposalChecklist

# ── The 27 standard EOT-claim documentation items (verbatim from the business's
#    "EOT claims related Standard Documentation Check List"). Order = serial no. ──
CANONICAL_ITEMS: List[Dict] = [
    {"no": 1, "item": "Sub-Contractor's (SCC) Approved baseline programme - Soft Copy - Native file (Primavera / MSP)"},
    {"no": 2, "item": "Sub-Contractor's (SCC) baseline programme - Submission Letter along complete details."},
    {"no": 3, "item": "Sub-Contractor's (SCC) baseline programme - Approval letter from Client / Engineer"},
    {"no": 4, "item": "Sub-Contractor (SCC) updated programmes - Weekly / Monthly - Primavera or any other form"},
    {"no": 5, "item": "Sub-Contractor's revised programme - Submission and approval details"},
    {"no": 6, "item": "Full and Complete contractual data (Prime document, BOQ) - Including amendments (if any)"},
    {"no": 7, "item": "Tender Stage pre qualifications / special conditions."},
    {"no": 8, "item": "Previous submitted EOT documents & response from Engineer"},
    {"no": 9, "item": "Details of any EOT granted till date with relevant correspondence"},
    {"no": 10, "item": "Previous submitted EOT - Programme soft copies"},
    {"no": 11, "item": "Delay notices issued by contractor & Engineer's response - Correspondence"},
    {"no": 12, "item": "Delay related correspondence with back backup documents (Letters, emails, MOM etc.)"},
    {"no": 13, "item": "Details of delay caused by contractor - issues list"},
    {"no": 14, "item": "Details of design or specification issues (errors, ambiguities, etc.) that may have contributed to or caused the claims and problems."},
    {"no": 15, "item": "Detailed Log of Drawing, Materials, method statements etc. - Showing the date of submission, date of approval, status along with revisions"},
    {"no": 16, "item": "Intermediate milestone & its current status (achieved or not) along with proposed date for milestone not achieved"},
    {"no": 17, "item": "Penalty details on non achievement of milestone & details of penalty imposed (if any)"},
    {"no": 18, "item": "Daily / Weekly / Monthly Reports"},
    {"no": 19, "item": "Details of Sub-Contractor's Variation orders - approved, disputed or pending"},
    {"no": 20, "item": "Details of Engineer's Instructions (EI's) issued"},
    {"no": 21, "item": "Details of Month wise manpower and Equipment - Planned"},
    {"no": 22, "item": "Details of Month wise manpower and Equipment - Actual"},
    {"no": 23, "item": "Details of Planned Vs Actual progress % - Progress curve"},
    {"no": 24, "item": "Details of on site month wise expenses - Actual - Cost Ledger"},
    {"no": 25, "item": "Details of Head Office Overheads - Actual"},
    {"no": 26, "item": "Updated Payment register"},
    {"no": 27, "item": "Any additional documents if deemed necessary."},
]

_VALID_STATUS = {"yes", "no", "na", ""}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _blank_state() -> Dict:
    return {"status": "", "date": "", "remarks": ""}


def get_checklist(project_id: str) -> Dict:
    """The proposal's full checklist: every canonical item merged with any saved
    state. Returns all 27 items even when nothing has been saved yet."""
    with SessionLocal() as db:
        row = db.get(ProposalChecklist, project_id)
        saved = row.items if row and row.items else []
        updated_at = row.updatedAt if row else None

    by_no: Dict[int, Dict] = {}
    for s in saved:
        try:
            by_no[int(s.get("no"))] = s
        except (TypeError, ValueError):
            continue

    items: List[Dict] = []
    for c in CANONICAL_ITEMS:
        state = by_no.get(c["no"], {})
        status = state.get("status", "")
        if status not in _VALID_STATUS:
            status = ""
        items.append({
            "no": c["no"],
            "item": c["item"],
            "status": status,
            "date": (state.get("date") or ""),
            "remarks": (state.get("remarks") or ""),
        })

    return {"projectId": project_id, "items": items, "updatedAt": updated_at}


def replace_checklist(project_id: str, items: List[Dict]) -> Dict:
    """Replace the proposal's whole checklist state in one transaction. Only the
    editable state (status / date / remarks) is stored, keyed by item `no`; the
    item text is never trusted from the client — it is re-merged from CANONICAL_ITEMS
    on read."""
    valid_nos = {c["no"] for c in CANONICAL_ITEMS}
    clean: List[Dict] = []
    for s in items:
        try:
            no = int(s.get("no"))
        except (TypeError, ValueError):
            continue
        if no not in valid_nos:
            continue
        status = s.get("status") or ""
        if status not in _VALID_STATUS:
            status = ""
        clean.append({
            "no": no,
            "status": status,
            "date": (s.get("date") or "").strip(),
            "remarks": (s.get("remarks") or "").strip(),
        })

    now = _now()
    with SessionLocal() as db:
        row = db.get(ProposalChecklist, project_id)
        if not row:
            row = ProposalChecklist(projectId=project_id)
            db.add(row)
        row.items = clean
        row.updatedAt = now
        db.commit()

    return get_checklist(project_id)


def delete_checklist(project_id: str) -> None:
    """Remove a proposal's checklist entirely (e.g. when the proposal is deleted)."""
    with SessionLocal() as db:
        row = db.get(ProposalChecklist, project_id)
        if row:
            db.delete(row)
            db.commit()
