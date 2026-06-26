"""Delay-event store — backed by the database, so events the analyst adds,
reviews (Accept / Merge / Reject), edits and deletes survive restarts.

No AI here: this is plain CRUD storage. Events get into the table two ways —
seeded sample data (once) or manual entry by the analyst. When the Anthropic key
arrives, an extra endpoint can draft events into this same table automatically;
nothing else changes.
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import DelayEvent, Project


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_by_project(project_id: str) -> List[Dict]:
    with SessionLocal() as db:
        rows = (
            db.query(DelayEvent)
            .filter(DelayEvent.projectId == project_id)
            .order_by(DelayEvent.ref)
            .all()
        )
        return [e.to_dict() for e in rows]


def get_event(event_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        return e.to_dict() if e else None


def _next_ref(db, project_id: str) -> str:
    """Next human reference for a project: DE-01, DE-02, ..."""
    count = db.query(DelayEvent).filter(DelayEvent.projectId == project_id).count()
    return f"DE-{count + 1:02d}"


def create_event(data: Dict) -> Dict:
    """Create or update a delay event (idempotent upsert by id)."""
    data = dict(data)
    with SessionLocal() as db:
        event_id = data.get("id")
        existing = db.get(DelayEvent, event_id) if event_id else None
        if existing:
            for key, value in data.items():
                if value is not None:
                    setattr(existing, key, value)
            existing.updatedAt = _now()
            db.commit()
            return existing.to_dict()

        if not event_id:
            data["id"] = f"de-{int(time.time() * 1000)}"
        if not data.get("ref"):
            data["ref"] = _next_ref(db, data["projectId"])
        data.setdefault("createdAt", _now())
        data["updatedAt"] = _now()
        e = DelayEvent(**data)
        db.add(e)
        db.commit()
        return e.to_dict()


def update_event(event_id: str, patch: Dict) -> Optional[Dict]:
    """Apply a partial edit; only provided (non-None) fields change."""
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        if not e:
            return None
        for key, value in patch.items():
            if value is not None:
                setattr(e, key, value)
        e.updatedAt = _now()
        db.commit()
        return e.to_dict()


def set_status(event_id: str, review_status: str) -> Optional[Dict]:
    """Accept / Merge / Reject — just the reviewStatus field."""
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        if not e:
            return None
        e.reviewStatus = review_status
        e.updatedAt = _now()
        db.commit()
        return e.to_dict()


def delete_event(event_id: str) -> bool:
    with SessionLocal() as db:
        e = db.get(DelayEvent, event_id)
        if not e:
            return False
        db.delete(e)
        db.commit()
        return True


# ── Seed sample data ───────────────────────────────────────────────────────
# The same 5 events the frontend used to hard-code, ported 1:1. Seeded ONCE
# (when the table is completely empty) against every project that exists at that
# moment, so the screen looks identical to before — only now it's persistent.
# Projects created later start empty, and the analyst adds events manually.
_SEED_EVENTS: List[Dict] = [
    {
        "ref": "DE-01",
        "title": "Late release of IFC drawings — L3 transfer slab",
        "category": "Design information delay",
        "narrative": "Issued-for-construction drawings for the Level 3 transfer slab were released 46 days after the date in the Information Release Schedule. The Contractor could not commence rebar fixing on the critical-path slab pour, holding the structural programme.",
        "cause": "Employer",
        "clause": "Sub-Clause 8.5",
        "startDate": "2026-02-03",
        "endDate": "2026-03-21",
        "daysImpact": 46,
        "criticalPath": True,
        "admissibility": "Likely admissible",
        "aiConfidence": 88,
        "reviewStatus": "Pending",
        "sources": [
            {"id": "s-01a", "name": "CL-0388 — Notice of delay (IFC drawings).pdf", "type": "PDF", "ref": "CL-0388", "date": "2026-02-10"},
            {"id": "s-01b", "name": "Information Release Schedule Rev C.xlsx", "type": "XLSX", "ref": "IRS-RevC", "date": "2025-12-01"},
            {"id": "s-01c", "name": "EL-0211 — Engineer response.pdf", "type": "PDF", "ref": "EL-0211", "date": "2026-02-24"},
        ],
        "chronology": [
            {"id": "c-01a", "date": "2026-02-03", "actor": "Contractor", "title": "Critical date for IFC drawings missed", "detail": "Transfer-slab IFC drawings not received against IRS Rev C.", "sourceId": "s-01b"},
            {"id": "c-01b", "date": "2026-02-10", "actor": "Contractor", "title": "Notice of delay issued (CL-0388)", "detail": "Contractor gave notice under SC 20.2.1 within 28 days of awareness.", "sourceId": "s-01a"},
            {"id": "c-01c", "date": "2026-02-24", "actor": "Engineer", "title": "Engineer acknowledges, drawings expedited (EL-0211)", "detail": "Engineer confirmed late issue and committed to release by 21 Mar.", "sourceId": "s-01c"},
            {"id": "c-01d", "date": "2026-03-21", "actor": "Employer", "title": "IFC drawings released", "detail": "Drawings issued; rebar fixing resumed the following shift."},
        ],
    },
    {
        "ref": "DE-02",
        "title": "Bus duct delivery delay — main LV risers",
        "category": "Bus duct delay",
        "narrative": "Long-lead bus duct for the main LV risers arrived 31 days late following a free-issue material change instructed by the Engineer. Riser shaft close-out and the associated fire-stopping inspection were held pending installation.",
        "cause": "Employer",
        "clause": "Sub-Clause 8.5",
        "startDate": "2026-04-05",
        "endDate": "2026-05-06",
        "daysImpact": 31,
        "criticalPath": True,
        "admissibility": "At risk",
        "aiConfidence": 74,
        "reviewStatus": "Pending",
        "sources": [
            {"id": "s-02a", "name": "EI-0140 — Engineer's instruction (bus duct change).pdf", "type": "PDF", "ref": "EI-0140", "date": "2026-03-18"},
            {"id": "s-02b", "name": "CL-0431 — Delivery impact notice.pdf", "type": "PDF", "ref": "CL-0431", "date": "2026-04-09"},
            {"id": "s-02c", "name": "Supplier delivery confirmation.pdf", "type": "PDF", "ref": "PO-22871", "date": "2026-05-06"},
        ],
        "chronology": [
            {"id": "c-02a", "date": "2026-03-18", "actor": "Engineer", "title": "Instruction to change bus duct rating (EI-0140)", "sourceId": "s-02a"},
            {"id": "c-02b", "date": "2026-04-09", "actor": "Contractor", "title": "Delivery impact notice issued (CL-0431)", "detail": "Notice raised 22 days after the instruction — within the 28-day window.", "sourceId": "s-02b"},
            {"id": "c-02c", "date": "2026-05-06", "actor": "Contractor", "title": "Bus duct delivered to site", "sourceId": "s-02c"},
        ],
    },
    {
        "ref": "DE-03",
        "title": "Fireproofing rework — structural steel zones B & C",
        "category": "Fireproofing rework",
        "narrative": "Intumescent fireproofing to zones B & C failed third-party DFT inspection and required full removal and re-application. The Contractor's applicator used an off-spec primer; rework consumed access to the steel frame for two weeks.",
        "cause": "Contractor",
        "clause": "Sub-Clause 7.5",
        "startDate": "2026-05-12",
        "endDate": "2026-05-26",
        "daysImpact": 14,
        "criticalPath": False,
        "admissibility": "Inadmissible",
        "aiConfidence": 81,
        "reviewStatus": "Pending",
        "sources": [
            {"id": "s-03a", "name": "ITR-0907 — Failed DFT inspection.pdf", "type": "PDF", "ref": "ITR-0907", "date": "2026-05-12"},
            {"id": "s-03b", "name": "NCR-0044 — Off-spec primer.pdf", "type": "PDF", "ref": "NCR-0044", "date": "2026-05-14"},
        ],
        "chronology": [
            {"id": "c-03a", "date": "2026-05-12", "actor": "Engineer", "title": "DFT inspection failed (ITR-0907)", "sourceId": "s-03a"},
            {"id": "c-03b", "date": "2026-05-14", "actor": "Engineer", "title": "NCR raised for off-spec primer (NCR-0044)", "sourceId": "s-03b"},
            {"id": "c-03c", "date": "2026-05-26", "actor": "Contractor", "title": "Rework completed and re-inspected"},
        ],
    },
    {
        "ref": "DE-04",
        "title": "RFI response delays — façade interface details",
        "category": "RFI delays",
        "narrative": "A cluster of 7 RFIs on the unitised façade-to-slab interface averaged 19 days to close against the 7-day contractual response period. Cumulative late responses delayed the start of façade installation on the east elevation.",
        "cause": "Concurrent",
        "clause": "Sub-Clause 8.5",
        "startDate": "2026-03-10",
        "endDate": "2026-04-22",
        "daysImpact": 18,
        "criticalPath": True,
        "admissibility": "At risk",
        "aiConfidence": 69,
        "reviewStatus": "Pending",
        "sources": [
            {"id": "s-04a", "name": "RFI register (façade) — extract.xlsx", "type": "XLSX", "ref": "RFI-Log", "date": "2026-04-22"},
            {"id": "s-04b", "name": "CL-0402 — Cumulative RFI delay notice.pdf", "type": "PDF", "ref": "CL-0402", "date": "2026-04-01"},
        ],
        "chronology": [
            {"id": "c-04a", "date": "2026-03-10", "actor": "Contractor", "title": "First façade interface RFI raised", "sourceId": "s-04a"},
            {"id": "c-04b", "date": "2026-04-01", "actor": "Contractor", "title": "Cumulative delay notice issued (CL-0402)", "sourceId": "s-04b"},
            {"id": "c-04c", "date": "2026-04-22", "actor": "Engineer", "title": "Final RFI in cluster closed out", "sourceId": "s-04a"},
        ],
    },
    {
        "ref": "DE-05",
        "title": "Exceptional rainfall — basement dewatering",
        "category": "Adverse weather",
        "narrative": "Rainfall in March exceeded the 10-year mean for the region, flooding the basement excavation and requiring three additional days of dewatering before the raft pour could proceed.",
        "cause": "Force Majeure",
        "clause": "Sub-Clause 8.5",
        "startDate": "2026-03-04",
        "endDate": "2026-03-09",
        "daysImpact": 3,
        "criticalPath": False,
        "admissibility": "Not assessed",
        "aiConfidence": 63,
        "reviewStatus": "Confirmed",
        "sources": [
            {"id": "s-05a", "name": "Met office rainfall record — March.pdf", "type": "PDF", "ref": "MET-03", "date": "2026-03-31"},
            {"id": "s-05b", "name": "Site diary extract (dewatering).pdf", "type": "Scan", "ref": "SD-0312", "date": "2026-03-09"},
        ],
        "chronology": [
            {"id": "c-05a", "date": "2026-03-04", "actor": "Contractor", "title": "Basement excavation flooded", "sourceId": "s-05b"},
            {"id": "c-05b", "date": "2026-03-09", "actor": "Contractor", "title": "Dewatering complete, raft pour resumed"},
        ],
    },
]


def seed_delay_events() -> None:
    """Seed the 5 sample events ONCE (when the table is empty) for every existing
    project. Idempotent: once any event exists, this never runs again, so the
    analyst's edits and deletions are never overwritten."""
    with SessionLocal() as db:
        if db.query(DelayEvent).count() > 0:
            return
        project_ids = [pid for (pid,) in db.query(Project.id).all()]
        if not project_ids:
            return
        now = _now()
        rows = []
        for pid in project_ids:
            for seed in _SEED_EVENTS:
                rows.append(
                    DelayEvent(
                        id=f"{pid}-{seed['ref'].lower()}",
                        projectId=pid,
                        createdAt=now,
                        updatedAt=now,
                        **seed,
                    )
                )
        db.add_all(rows)
        db.commit()
