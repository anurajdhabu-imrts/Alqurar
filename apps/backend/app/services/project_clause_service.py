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
from app.models import ProjectClause


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
