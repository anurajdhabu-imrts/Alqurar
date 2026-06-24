"""Project store — projects created in the web app.

In-memory to match the rest of this demo backend (users/roles/assignment
services). Persists across requests within a running server process, so a
project created by an admin is visible to a client who logs in separately —
including from a different browser or device (which localStorage could not do).

If this app later gains a real database, replace this module with a `projects`
table.
"""
from typing import Dict, List, Optional


_projects: List[Dict] = []


def list_projects() -> List[Dict]:
    return list(_projects)


def get_project(project_id: str) -> Optional[Dict]:
    return next((p for p in _projects if p["id"] == project_id), None)


def create_project(data: Dict) -> Dict:
    """Create or update a project (idempotent upsert by id)."""
    existing = get_project(data["id"])
    if existing:
        existing.update(data)
        return existing
    _projects.append(dict(data))
    return data


def delete_project(project_id: str) -> bool:
    for i, p in enumerate(_projects):
        if p["id"] == project_id:
            _projects.pop(i)
            return True
    return False
