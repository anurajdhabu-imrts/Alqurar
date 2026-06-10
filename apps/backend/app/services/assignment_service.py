"""Project ⇄ client assignment store.

Maps a project (by the frontend project id, e.g. "p-1") to one or more client
users. In-memory to match the rest of this demo backend (users/roles services).
Persists across requests within a running server process, so an assignment made
by an admin is visible to a client who logs in separately.

If this app later gains a real database, replace this module with a
`project_clients` table: (id, project_id, client_user_id, assigned_by, created_at).
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Seeded so the existing demo client (u-6, j.whitfield@client.com) keeps the
# three projects it had before assignments were backed by the server.
_assignments: List[Dict] = [
    {"id": "a-1", "project_id": "p-1", "client_user_id": "u-6", "assigned_by": "u-1", "created_at": "2026-05-01T00:00:00+00:00"},
    {"id": "a-2", "project_id": "p-2", "client_user_id": "u-6", "assigned_by": "u-1", "created_at": "2026-05-01T00:00:00+00:00"},
    {"id": "a-3", "project_id": "p-4", "client_user_id": "u-6", "assigned_by": "u-1", "created_at": "2026-05-01T00:00:00+00:00"},
]


def list_assignments() -> List[Dict]:
    return list(_assignments)


def project_ids_for_client(client_user_id: str) -> List[str]:
    """Distinct project ids assigned to a client (order preserved)."""
    seen: List[str] = []
    for a in _assignments:
        if a["client_user_id"] == client_user_id and a["project_id"] not in seen:
            seen.append(a["project_id"])
    return seen


def client_ids_for_project(project_id: str) -> List[str]:
    seen: List[str] = []
    for a in _assignments:
        if a["project_id"] == project_id and a["client_user_id"] not in seen:
            seen.append(a["client_user_id"])
    return seen


def _exists(project_id: str, client_user_id: str) -> bool:
    return any(
        a["project_id"] == project_id and a["client_user_id"] == client_user_id
        for a in _assignments
    )


def assign_clients(project_id: str, client_user_ids: List[str], assigned_by: str) -> List[str]:
    """Assign one or more clients to a project (idempotent). Returns the project's
    full client id list after the change."""
    for cid in client_user_ids:
        if not _exists(project_id, cid):
            _assignments.append({
                "id": f"a-{int(time.time() * 1000)}-{cid}",
                "project_id": project_id,
                "client_user_id": cid,
                "assigned_by": assigned_by,
                "created_at": _now_iso(),
            })
    return client_ids_for_project(project_id)


def unassign_client(project_id: str, client_user_id: str) -> bool:
    before = len(_assignments)
    _assignments[:] = [
        a for a in _assignments
        if not (a["project_id"] == project_id and a["client_user_id"] == client_user_id)
    ]
    return len(_assignments) < before
