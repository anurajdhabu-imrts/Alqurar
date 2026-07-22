"""Per-project Clause Library store — backed by the database.

Each project has its OWN clause library, built from that project's uploaded
contract. Today rows are added/edited/deleted manually by the analyst; they
survive restarts. When the Anthropic key is enabled, an extraction step writes
AI-detected clauses into this same table (scoped by projectId) and nothing else
changes. Function names mirror the global clause_service so the API layer is
familiar.
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.db import SessionLocal
from app.models import Project, ProjectClause


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_by_project(project_id: str) -> List[Dict]:
    with SessionLocal() as db:
        rows = (
            db.query(ProjectClause)
            .filter(ProjectClause.projectId == project_id)
            .order_by(ProjectClause.created_at.desc())
            .all()
        )
        return [c.to_dict() for c in rows]


def get_clause(clause_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        c = db.get(ProjectClause, clause_id)
        return c.to_dict() if c else None


def add_clause(project_id: str, data: Dict, created_by: Optional[str] = None) -> Dict:
    now = _now_iso()
    with SessionLocal() as db:
        clause = ProjectClause(
            id=f"pcl-{int(time.time() * 1000)}",
            projectId=project_id,
            contract_standard=data["contract_standard"],
            clause_number=data["clause_number"],
            clause_title=data["clause_title"],
            clause_description=data.get("clause_description") or "",
            tags=list(data.get("tags") or []),
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        db.add(clause)
        db.commit()
        return clause.to_dict()


def update_clause(clause_id: str, patch: Dict) -> Optional[Dict]:
    with SessionLocal() as db:
        c = db.get(ProjectClause, clause_id)
        if not c:
            return None
        for key, value in patch.items():
            if value is not None:
                setattr(c, key, value)
        c.updated_at = _now_iso()
        db.commit()
        return c.to_dict()


def delete_clause(clause_id: str) -> bool:
    with SessionLocal() as db:
        c = db.get(ProjectClause, clause_id)
        if not c:
            return False
        db.delete(c)
        db.commit()
        return True


def replace_ai_clauses(project_id: str, clauses: List[Dict], created_by: str = "ai") -> List[Dict]:
    """Replace this project's AI-extracted clauses with a fresh set.

    Only rows previously created by AI (created_by == "ai") are removed, so any
    clauses the analyst added by hand are preserved. Used when a contract is
    (re-)uploaded and re-analysed.
    """
    now = _now_iso()
    base = int(time.time() * 1000)
    with SessionLocal() as db:
        db.query(ProjectClause).filter(
            ProjectClause.projectId == project_id,
            ProjectClause.created_by == created_by,
        ).delete(synchronize_session=False)

        rows: List[ProjectClause] = []
        for i, c in enumerate(clauses):
            rows.append(
                ProjectClause(
                    id=f"pcl-ai-{base}-{i}",
                    projectId=project_id,
                    contract_standard=c.get("contract_standard") or "",
                    clause_number=c.get("clause_number") or "",
                    clause_title=c.get("clause_title") or "",
                    clause_description=c.get("clause_description") or "",
                    tags=list(c.get("tags") or []),
                    source="ai",
                    # A contract uploaded WITH its Particular Conditions included
                    # can flag clauses the PC amends, same as a PCC comparison.
                    modified=bool(c.get("modified")),
                    modification_note=(c.get("modification_note") or "").strip() or None,
                    created_by=created_by,
                    created_at=now,
                    updated_at=now,
                )
            )
        db.add_all(rows)
        db.commit()
        return [r.to_dict() for r in rows]


# ── Base contract book (Knowledge Center → project) ─────────────────────────

def get_clause_book_id(project_id: str) -> Optional[str]:
    """The Knowledge-Center book chosen as this project's base clause set."""
    with SessionLocal() as db:
        p = db.get(Project, project_id)
        return p.clauseBookId if p else None


def set_book_clauses(project_id: str, book: Dict, book_clauses: List[Dict]) -> int:
    """Copy a Knowledge-Center book's clauses into this project's library.

    Replaces only the previously book-sourced rows (source == "book"), so manual
    and AI-extracted clauses are untouched. Records the chosen book on the project
    and returns how many clauses were copied. Any prior PCC modifications are
    dropped with the old book rows — a fresh base book starts unmodified.
    """
    now = _now_iso()
    base = int(time.time() * 1000)
    standard = book.get("name") or ""
    if book.get("edition"):
        standard = f"{standard} {book['edition']}".strip()
    with SessionLocal() as db:
        # Replace the previous book set AND any PCC additions/flags tied to it —
        # a fresh base book starts clean, ready for a new PCC comparison.
        db.query(ProjectClause).filter(
            ProjectClause.projectId == project_id,
            ProjectClause.source.in_(("book", "pcc")),
        ).delete(synchronize_session=False)

        rows = [
            ProjectClause(
                id=f"pcl-book-{base}-{i}",
                projectId=project_id,
                contract_standard=standard,
                clause_number=c.get("clause_number") or "",
                clause_title=c.get("clause_title") or "",
                # The card summary uses the book's plain-language summary.
                clause_description=c.get("summary") or "",
                tags=list(c.get("tags") or []),
                source="book",
                modified=False,
                created_by="book",
                created_at=now,
                updated_at=now,
            )
            for i, c in enumerate(book_clauses)
        ]
        db.add_all(rows)

        p = db.get(Project, project_id)
        if p:
            p.clauseBookId = book.get("id")
        db.commit()
        return len(rows)


def list_book_sourced_clauses(project_id: str) -> List[Dict]:
    """This project's book-copied clauses (the base set a PCC can amend)."""
    with SessionLocal() as db:
        rows = (
            db.query(ProjectClause)
            .filter(
                ProjectClause.projectId == project_id,
                ProjectClause.source == "book",
            )
            .all()
        )
        return [c.to_dict() for c in rows]


def apply_pcc_modifications(
    project_id: str,
    modifications: List[Dict],
    additions: Optional[List[Dict]] = None,
) -> Dict[str, int]:
    """Apply a PCC comparison to this project's library.

    Two effects, both re-computed from scratch each upload:
    - MODIFICATIONS: for each entry whose clause_number matches a book clause, set
      `modified`, record the `modification_note` and update the description to the
      amended wording. Book clauses not matched are reset to unmodified.
    - ADDITIONS: brand-new clauses the PCC introduces are stored as their own rows
      (source == "pcc"), replacing any additions from a previous PCC upload.

    Returns {"modified": <count>, "added": <count>}.
    """
    now = _now_iso()
    additions = additions or []
    by_number = {}
    for m in modifications:
        num = (m.get("clause_number") or "").strip()
        if num:
            by_number[num] = m

    # The base book's contract-standard label, reused on new PCC clauses so their
    # card book badge matches the rest of the project's library.
    standard = ""

    with SessionLocal() as db:
        rows = (
            db.query(ProjectClause)
            .filter(
                ProjectClause.projectId == project_id,
                ProjectClause.source == "book",
            )
            .all()
        )
        matched = 0
        for r in rows:
            if standard == "" and r.contract_standard:
                standard = r.contract_standard
            m = by_number.get((r.clause_number or "").strip())
            if m:
                r.modified = True
                r.modification_note = (m.get("modification_note") or "").strip() or None
                new_desc = (m.get("new_description") or "").strip()
                if new_desc:
                    r.clause_description = new_desc
                r.updated_at = now
                matched += 1
            else:
                # Re-uploading a PCC re-evaluates from scratch.
                r.modified = False
                r.modification_note = None

        # Replace any previously PCC-added clauses, then insert the fresh set.
        db.query(ProjectClause).filter(
            ProjectClause.projectId == project_id,
            ProjectClause.source == "pcc",
        ).delete(synchronize_session=False)

        base = int(time.time() * 1000)
        new_rows = [
            ProjectClause(
                id=f"pcl-pcc-{base}-{i}",
                projectId=project_id,
                contract_standard=standard or "Particular Conditions",
                clause_number=a.get("clause_number") or "",
                clause_title=a.get("clause_title") or "",
                clause_description=a.get("clause_description") or "",
                tags=list(a.get("tags") or []),
                source="pcc",
                modified=False,
                modification_note="Added by the Particular Conditions",
                created_by="pcc",
                created_at=now,
                updated_at=now,
            )
            for i, a in enumerate(additions)
        ]
        db.add_all(new_rows)
        db.commit()
        return {"modified": matched, "added": len(new_rows)}
