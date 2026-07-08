"""Project store — backed by the database, so projects survive restarts and are
visible to admin and client across browsers/devices."""
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from app.db import SessionLocal
from app.models import (
    Document,
    DocumentComment,
    DelayEvent,
    EOTClaim,
    Project,
    ProjectClause,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_projects(kind: Optional[str] = None) -> List[Dict]:
    """All projects, optionally filtered by kind ("project" or "proposal").

    Legacy rows created before the `kind` column existed are treated as
    ordinary projects (kind is null → "project")."""
    with SessionLocal() as db:
        rows = db.query(Project).all()
        out = [p.to_dict() for p in rows]
    for d in out:
        d["kind"] = d.get("kind") or "project"
    if kind:
        out = [d for d in out if d["kind"] == kind]
    return out


def get_project(project_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        p = db.get(Project, project_id)
        return p.to_dict() if p else None


def create_project(data: Dict) -> Dict:
    """Create or update a project (idempotent upsert by id)."""
    with SessionLocal() as db:
        p = db.get(Project, data["id"])
        if p:
            for key, value in data.items():
                setattr(p, key, value)
        else:
            p = Project(**data)
            db.add(p)
        db.commit()
        return p.to_dict()


def delete_project(project_id: str) -> bool:
    with SessionLocal() as db:
        p = db.get(Project, project_id)
        if not p:
            return False
        db.delete(p)
        db.commit()
        return True


def convert_proposal_to_project(
    proposal_id: str, new_id: str, new_code: Optional[str] = None
) -> Optional[Dict]:
    """Confirm a proposal by copying it into a brand-new ordinary project.

    The source proposal is left untouched (it stays in the Proposals area). A new
    Project row (kind="project") is created under `new_id`, and every child record
    keyed to the proposal — documents (with their bytes, cached AI analysis and
    extracted text), document comments, the fully-analysed delay events, the
    clause library and any generated EOT claim — is deep-copied under the new id.
    Because the delay events already carry the full AI forensic analysis, the new
    project's richer workspace surfaces it immediately; nothing is re-run.

    The client-facing costed proposal (ClientProposal) is intentionally NOT copied
    — it belongs to the proposal, not the delivery project.

    Returns the new project dict, or None if the proposal doesn't exist. If a
    project already exists at `new_id` (e.g. a double-confirm), it is returned
    as-is without copying again.
    """
    with SessionLocal() as db:
        src = db.get(Project, proposal_id)
        if not src:
            return None

        existing = db.get(Project, new_id)
        if existing:
            return existing.to_dict()

        now = _now_iso()

        # 1. The project row — copy every field, then re-stamp identity/kind.
        proj = Project(**{f: getattr(src, f) for f in Project._FIELDS})
        proj.id = new_id
        proj.code = new_code or src.code
        proj.kind = "project"
        proj.createdAt = now
        db.add(proj)

        # 2. Documents (including deferred bytes / extracted text) + remap comments.
        doc_id_map: Dict[str, str] = {}
        for d in db.query(Document).filter(Document.projectId == proposal_id).all():
            nid = f"doc-{uuid4().hex}"
            doc_id_map[d.id] = nid
            db.add(Document(
                id=nid, projectId=new_id, name=d.name, type=d.type, sizeKB=d.sizeKB,
                uploadedAt=d.uploadedAt, uploadedBy=d.uploadedBy, status=d.status,
                claimRef=d.claimRef, note=d.note, driveFileId=d.driveFileId,
                data=d.data, mime=d.mime, uploadedById=d.uploadedById,
                analysis=d.analysis, analysisStatus=d.analysisStatus,
                analysisError=d.analysisError, extractedText=d.extractedText,
            ))

        for c in db.query(DocumentComment).filter(DocumentComment.projectId == proposal_id).all():
            mapped = doc_id_map.get(c.documentId)
            if not mapped:
                continue
            db.add(DocumentComment(
                id=f"cmt-{uuid4().hex}", documentId=mapped, projectId=new_id,
                body=c.body, author=c.author, authorId=c.authorId, createdAt=c.createdAt,
                anchorText=c.anchorText, anchorStart=c.anchorStart, anchorLength=c.anchorLength,
            ))

        # 3. Delay events — the full AI-analysed register. `sources` reference docs
        #    by name (not id), so no remapping is needed; copy the lists defensively.
        for e in db.query(DelayEvent).filter(DelayEvent.projectId == proposal_id).all():
            db.add(DelayEvent(
                id=f"de-{uuid4().hex}", projectId=new_id, ref=e.ref, title=e.title,
                category=e.category, narrative=e.narrative, cause=e.cause, clause=e.clause,
                startDate=e.startDate, endDate=e.endDate, daysImpact=e.daysImpact,
                criticalPath=e.criticalPath, admissibility=e.admissibility,
                aiConfidence=e.aiConfidence, reviewStatus=e.reviewStatus,
                chronology=list(e.chronology or []), sources=list(e.sources or []),
                createdAt=now, updatedAt=now,
            ))

        # 4. Clause library.
        for cl in db.query(ProjectClause).filter(ProjectClause.projectId == proposal_id).all():
            db.add(ProjectClause(
                id=f"cl-{uuid4().hex}", projectId=new_id,
                contract_standard=cl.contract_standard, clause_number=cl.clause_number,
                clause_title=cl.clause_title, clause_description=cl.clause_description,
                tags=list(cl.tags or []), created_by=cl.created_by,
                created_at=now, updated_at=now,
            ))

        # 5. EOT claim, if one was already generated on the proposal.
        eot = db.get(EOTClaim, proposal_id)
        if eot:
            db.add(EOTClaim(
                projectId=new_id, content=eot.content, model=eot.model,
                status=eot.status, error=eot.error, createdAt=now, updatedAt=now,
            ))

        db.commit()
        return proj.to_dict()
