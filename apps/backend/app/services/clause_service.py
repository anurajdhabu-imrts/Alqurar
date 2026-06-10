"""Clause Reference Library store.

The `clause_library` table for the FIDIC/NEC4 clause reference library, seeded
with the 16 built-in clauses that previously lived only in the frontend mock
(src/mock/clauses.ts). In-memory to match the rest of this demo backend
(users/roles/assignments services), so a clause added by an admin is visible to
everyone who reads the library afterwards within a running server process.

If this app later gains a real database, replace this module with a
`clause_library` table:
    (id, contract_standard, clause_number, clause_title, clause_description,
     tags, created_by, created_at, updated_at).
The column names below already mirror that target schema.
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Fixed timestamp for the seeded rows so they sort/display deterministically.
_SEED_AT = "2026-01-01T00:00:00+00:00"


def _seed(id: str, standard: str, number: str, title: str, desc: str, tags: List[str]) -> Dict:
    return {
        "id": id,
        "contract_standard": standard,
        "clause_number": number,
        "clause_title": title,
        "clause_description": desc,
        "tags": tags,
        "created_by": "system",
        "created_at": _SEED_AT,
        "updated_at": _SEED_AT,
    }


# Seeded from the original static cards — these are the default library entries.
_clauses: List[Dict] = [
    _seed("cl-1", "FIDIC Red 1999", "8.4", "Extension of Time for Completion", "Contractor entitled to EOT for variations, exceptionally adverse climatic conditions, unforeseeable shortages, and Employer delays.", ["EOT", "delay"]),
    _seed("cl-2", "FIDIC Red 1999", "20.1", "Contractor's Claims", "Notice within 28 days of the event, else time-barred; detailed particulars within 42 days.", ["notice", "time-bar"]),
    _seed("cl-3", "FIDIC Red 1999", "4.12", "Unforeseeable Physical Conditions", "Relief where physical conditions were not reasonably foreseeable by an experienced contractor.", ["ground", "EOT", "cost"]),
    _seed("cl-4", "FIDIC Yellow 2017", "8.5", "Extension of Time for Completion", "Grounds for EOT including Variations, causes under the Contract, and delays attributable to the Employer.", ["EOT", "delay"]),
    _seed("cl-5", "FIDIC Yellow 2017", "20.2.1", "Notice of Claim", "Claiming Party shall give Notice within 28 days of becoming aware (or should have become aware) of the event or circumstance.", ["notice", "time-bar"]),
    _seed("cl-6", "FIDIC Yellow 2017", "20.2.4", "Fully detailed Claim", "A fully detailed Claim with contractual/legal basis and supporting particulars within 84 days.", ["notice", "particulars"]),
    _seed("cl-7", "FIDIC Yellow 2017", "13.3", "Variation Procedure", "Engineer may instruct Variations; Contractor responds with proposal and quotation within 28 days.", ["variation", "change"]),
    _seed("cl-8", "FIDIC Yellow 2017", "8.8", "Delay Damages", "Liquidated damages for late completion, subject to the stated daily rate and overall cap.", ["LDs", "damages"]),
    _seed("cl-9", "FIDIC Silver 2017", "5.1", "General Design Obligations", "Single-point design responsibility rests with the Contractor under the Silver Book.", ["design", "risk"]),
    _seed("cl-10", "FIDIC Silver 2017", "8.5", "Extension of Time for Completion", "EOT grounds with reduced Employer risk allocation typical of EPC turnkey contracts.", ["EOT", "delay"]),
    _seed("cl-11", "FIDIC Silver 2017", "18", "Exceptional Events", "Relief for exceptional events (force majeure); 14-day notice requirement.", ["force majeure", "notice"]),
    _seed("cl-12", "NEC4", "60.1", "Compensation Events", "Twenty-one listed compensation events covering changes, Employer's risks and physical conditions.", ["compensation event", "change"]),
    _seed("cl-13", "NEC4", "61.3", "Notifying a Compensation Event", "Contractor notifies within 8 weeks of becoming aware, otherwise no change to Prices or Completion Date.", ["notice", "time-bar"]),
    _seed("cl-14", "NEC4", "62", "Quotations for Compensation Events", "Quotation comprising changes to Prices and any delay to the Completion Date, with programme.", ["quotation", "programme"]),
    _seed("cl-15", "NEC4", "15.1", "Early Warning", "Both Parties give early warning of matters that could increase cost, delay completion or impair performance.", ["early warning", "risk"]),
    _seed("cl-16", "NEC4", "63.5", "Assessing Delay", "Delay assessed as the length of time planned Completion is later than in the Accepted Programme.", ["delay", "programme"]),
]


def list_clauses() -> List[Dict]:
    return list(_clauses)


def get_clause(clause_id: str) -> Optional[Dict]:
    return next((c for c in _clauses if c["id"] == clause_id), None)


def add_clause(data: Dict, created_by: Optional[str] = None) -> Dict:
    now = _now_iso()
    clause = {
        "id": f"cl-{int(time.time() * 1000)}",
        "contract_standard": data["contract_standard"],
        "clause_number": data["clause_number"],
        "clause_title": data["clause_title"],
        "clause_description": data.get("clause_description") or "",
        "tags": list(data.get("tags") or []),
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }
    # Newest first, so a freshly added clause appears at the top of the library.
    _clauses.insert(0, clause)
    return clause


def update_clause(clause_id: str, patch: Dict) -> Optional[Dict]:
    clause = get_clause(clause_id)
    if not clause:
        return None
    for k, v in patch.items():
        if v is not None:
            clause[k] = v
    clause["updated_at"] = _now_iso()
    return clause


def delete_clause(clause_id: str) -> bool:
    for i, c in enumerate(_clauses):
        if c["id"] == clause_id:
            _clauses.pop(i)
            return True
    return False
