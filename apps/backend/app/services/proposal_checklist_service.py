"""Proposal EOT-documentation checklist store + canonical item list.

One checklist per proposal = a single ProposalChecklist row (projectId PK) holding
the editable state (status / remarks) and the attached files for each item. The 27
standard items themselves are CANONICAL and defined here, so the item wording is
owned by the backend and never drifts per proposal. The row stores only state,
keyed by item `no`; get_checklist merges that state with the canonical text.

Items 1-26 are the fixed standard documents, canonically worded. Item 27 ("Any
additional documents…") is where anything extra goes: the user gives it a name and
a file, and once it is named or filled each further additional document gets its
own row — 28, 29, … — with its own name. Rows 27+ therefore carry a user-supplied
`item` label in the same JSON list.

Attached files are NOT stored here: a file is uploaded through the ordinary project
-document pipeline (so it shows up in the proposal's Documents tab and can be
analysed like any other), and the checklist simply keeps the document ids. Deleting
a document elsewhere therefore just drops it off the checklist.

The status/remarks state is read and replaced as one document (get_checklist /
replace_checklist), mirroring the sibling costing sheet, while file attach/detach
are immediate single-item operations. Filled collaboratively by the client and the
analyst — plain data storage, no AI, no hard-coded sample state.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.db import SessionLocal
from app.models import ProposalChecklist
from app.services.document_service import get_documents_meta

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

_CANONICAL_NOS = {c["no"] for c in CANONICAL_ITEMS}
_CANONICAL_TEXT = {c["no"]: c["item"] for c in CANONICAL_ITEMS}

#: The "Any additional documents" row — the first extra document lands here.
ADDITIONAL_ITEM_NO = 27
#: Every further additional document gets its own row, numbered from here up.
EXTRA_ITEM_START = 28

_VALID_STATUS = {"yes", "no", "na", ""}
_DEFAULT_EXTRA_TEXT = "Additional document"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load(project_id: str) -> Tuple[List[Dict], Optional[str]]:
    """The raw stored state rows (mutable copies) + the last-saved timestamp."""
    with SessionLocal() as db:
        row = db.get(ProposalChecklist, project_id)
        if not row:
            return [], None
        return [dict(s) for s in (row.items or []) if isinstance(s, dict)], row.updatedAt


def _store(project_id: str, states: List[Dict]) -> None:
    states.sort(key=lambda s: s["no"])
    with SessionLocal() as db:
        row = db.get(ProposalChecklist, project_id)
        if not row:
            row = ProposalChecklist(projectId=project_id)
            db.add(row)
        row.items = states
        row.updatedAt = _now()
        db.commit()


def _by_no(states: List[Dict]) -> Dict[int, Dict]:
    """Index the state rows by item number (values are the same dict objects, so
    mutating one mutates the list)."""
    out: Dict[int, Dict] = {}
    for s in states:
        try:
            no = int(s.get("no"))
        except (TypeError, ValueError):
            continue
        s["no"] = no
        out[no] = s
    return out


def _is_extra(no: int) -> bool:
    """True for the user-added rows beyond the canonical list."""
    return no >= EXTRA_ITEM_START


def _is_nameable(no: int) -> bool:
    """True for the additional-document rows (27 and up), whose label the user
    supplies. The 26 standard items keep their canonical wording."""
    return no >= ADDITIONAL_ITEM_NO


def get_checklist(project_id: str) -> Dict:
    """The proposal's full checklist: every canonical item merged with any saved
    state and its attached documents, followed by the user-added extra rows.
    Returns all 27 canonical items even when nothing has been saved yet."""
    states, updated_at = _load(project_id)
    by_no = _by_no(states)

    # Resolve every referenced document in one query; ids that no longer exist
    # (the file was deleted from the data room) drop out here.
    meta = get_documents_meta([d for s in by_no.values() for d in (s.get("docIds") or [])])

    def row(no: int, text: str, state: Dict) -> Dict:
        status = state.get("status", "")
        return {
            "no": no,
            "item": text,
            "status": status if status in _VALID_STATUS else "",
            "remarks": state.get("remarks") or "",
            "documents": [meta[d] for d in (state.get("docIds") or []) if d in meta],
        }

    items = []
    for c in CANONICAL_ITEMS:
        state = by_no.get(c["no"], {})
        # Item 27 onwards is "additional documents" — the user names those, so a
        # saved label wins over the canonical placeholder text.
        label = c["item"]
        if _is_nameable(c["no"]):
            label = (state.get("item") or "").strip() or label
        items.append(row(c["no"], label, state))

    for no in sorted(n for n in by_no if _is_extra(n)):
        state = by_no[no]
        items.append(row(no, (state.get("item") or "").strip() or _DEFAULT_EXTRA_TEXT, state))

    return {"projectId": project_id, "items": items, "updatedAt": updated_at}


def replace_checklist(project_id: str, items: List[Dict]) -> Dict:
    """Replace the proposal's checklist answers in one transaction. Only the
    editable state (status / remarks, plus the label of user-added rows) comes from
    the client; canonical item text and the attached document ids are owned by the
    server and re-merged here, so a save can never drop someone's uploads."""
    stored, _ = _load(project_id)
    existing = _by_no(stored)

    clean: List[Dict] = []
    seen = set()
    for s in items:
        try:
            no = int(s.get("no"))
        except (TypeError, ValueError):
            continue
        if no in seen:
            continue
        # Unknown rows are ignored; an extra row must already exist (add_item).
        if no not in _CANONICAL_NOS and no not in existing:
            continue
        if _is_extra(no) and no not in existing:
            continue
        seen.add(no)

        prev = existing.get(no, {})
        status = s.get("status") or ""
        entry = {
            "no": no,
            "status": status if status in _VALID_STATUS else "",
            "remarks": (s.get("remarks") or "").strip(),
            "docIds": list(prev.get("docIds") or []),
        }
        if _is_nameable(no):
            label = (s.get("item") or "").strip() or (prev.get("item") or "").strip()
            if _is_extra(no):
                entry["item"] = label or _DEFAULT_EXTRA_TEXT
            elif label and label != _CANONICAL_TEXT[no]:
                # Item 27 only stores a label once the user has named it; leaving it
                # as the canonical wording keeps that wording server-owned.
                entry["item"] = label
        clean.append(entry)

    # Rows the payload never mentioned (e.g. an extra added from another tab while
    # this one was open) are kept as-is rather than silently deleted.
    for no, prev in existing.items():
        if no not in seen:
            clean.append(prev)

    _store(project_id, clean)
    return get_checklist(project_id)


def add_item(project_id: str, item_text: str = "") -> Tuple[Dict, int]:
    """Claim the next additional-document row and return (checklist, its no).

    The canonical "Any additional documents…" row (27) is the first slot, so the
    first extra document lands there; once it has been named or filled, each
    further one gets its own row — 28, 29, … — carrying the given name.
    """
    states, _ = _load(project_id)
    by_no = _by_no(states)
    label = (item_text or "").strip()

    slot = by_no.get(ADDITIONAL_ITEM_NO)
    if slot is None or not (slot.get("docIds") or (slot.get("item") or "").strip()):
        if slot is None:
            slot = {"no": ADDITIONAL_ITEM_NO, "status": "", "remarks": "", "docIds": []}
            states.append(slot)
        if label:
            slot["item"] = label
        _store(project_id, states)
        return get_checklist(project_id), ADDITIONAL_ITEM_NO

    highest = max([n for n in by_no if _is_extra(n)] or [EXTRA_ITEM_START - 1])
    no = max(highest + 1, EXTRA_ITEM_START)
    states.append({
        "no": no,
        "item": label or _DEFAULT_EXTRA_TEXT,
        "status": "",
        "remarks": "",
        "docIds": [],
    })
    _store(project_id, states)
    return get_checklist(project_id), no


def remove_item(project_id: str, no: int) -> Optional[Dict]:
    """Delete a user-added row. Canonical items (1-27) cannot be removed — None is
    returned for those and for rows that don't exist. The documents that were
    attached are left untouched in the proposal's data room."""
    if not _is_extra(no):
        return None
    states, _ = _load(project_id)
    remaining = [s for s in states if s.get("no") != no]
    if len(remaining) == len(states):
        return None
    _store(project_id, remaining)
    return get_checklist(project_id)


def attach_document(project_id: str, no: int, document_id: str, label: str = "") -> Optional[Dict]:
    """Link an already-uploaded project document to a checklist item. Returns None
    if the item doesn't exist. Attaching answers the question, so an item that is
    still unanswered is marked "yes" (available).

    `label` names the row and is only honoured for the additional-document rows
    (27+) — the 26 standard items keep their canonical wording."""
    states, _ = _load(project_id)
    by_no = _by_no(states)

    entry = by_no.get(no)
    if entry is None:
        if no not in _CANONICAL_NOS:
            return None
        entry = {"no": no, "status": "", "remarks": "", "docIds": []}
        states.append(entry)

    if label.strip() and _is_nameable(no):
        entry["item"] = label.strip()

    doc_ids = list(entry.get("docIds") or [])
    if document_id not in doc_ids:
        doc_ids.append(document_id)
    entry["docIds"] = doc_ids
    if not entry.get("status"):
        entry["status"] = "yes"

    _store(project_id, states)
    return get_checklist(project_id)


def detach_document(project_id: str, no: int, document_id: str) -> Optional[Dict]:
    """Unlink a document from a checklist item. The file itself stays in the
    proposal's Documents tab — only the link is removed."""
    states, _ = _load(project_id)
    entry = _by_no(states).get(no)
    if entry is None:
        return None
    entry["docIds"] = [d for d in (entry.get("docIds") or []) if d != document_id]
    _store(project_id, states)
    return get_checklist(project_id)


def item_exists(project_id: str, no: int) -> bool:
    """True when `no` is a canonical item or an existing user-added row."""
    if no in _CANONICAL_NOS:
        return True
    states, _ = _load(project_id)
    return no in _by_no(states)


def delete_checklist(project_id: str) -> None:
    """Remove a proposal's checklist entirely (e.g. when the proposal is deleted)."""
    with SessionLocal() as db:
        row = db.get(ProposalChecklist, project_id)
        if row:
            db.delete(row)
            db.commit()
