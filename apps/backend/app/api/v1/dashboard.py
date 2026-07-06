"""Dashboard summary — real counts aggregated from existing tables.

Read-only. Computes totals the dashboard needs (clients, projects, proposals,
delay events) in a few grouped queries, so the frontend makes one call instead of
fetching every module and counting client-side. No business logic is changed —
this only reads what other modules already store.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func

from app.db import SessionLocal
from app.models import ClientProfile, DelayEvent, Project
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(_=Depends(get_current_user)):
    """Live counts for the dashboard, grouped by status where useful."""
    with SessionLocal() as db:
        clients = db.query(func.count(ClientProfile.userId)).scalar() or 0

        # Projects and proposals share the projects table (kind column). A legacy
        # row with a null kind counts as an ordinary project.
        projects_by_status: dict[str, int] = {}
        proposals_by_status: dict[str, int] = {}
        projects_total = 0
        proposals_total = 0
        for kind, status, count in (
            db.query(Project.kind, Project.status, func.count(Project.id))
            .group_by(Project.kind, Project.status)
            .all()
        ):
            bucket = proposals_by_status if (kind or "project") == "proposal" else projects_by_status
            label = status or "Active"
            bucket[label] = bucket.get(label, 0) + count
            if (kind or "project") == "proposal":
                proposals_total += count
            else:
                projects_total += count

        delay_by_status: dict[str, int] = {}
        delay_total = 0
        for review_status, count in (
            db.query(DelayEvent.reviewStatus, func.count(DelayEvent.id))
            .group_by(DelayEvent.reviewStatus)
            .all()
        ):
            label = review_status or "Pending"
            delay_by_status[label] = delay_by_status.get(label, 0) + count
            delay_total += count

    return {
        "clients": clients,
        "projects": projects_total,
        "proposals": proposals_total,
        "delayEvents": delay_total,
        "projectsByStatus": projects_by_status,
        "proposalsByStatus": proposals_by_status,
        "delayEventsByStatus": delay_by_status,
    }
