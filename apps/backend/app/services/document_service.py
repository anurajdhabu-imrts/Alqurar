"""Project document store — metadata for files uploaded against a project.

In-memory to match the rest of this demo backend. Shared across requests, so a
document uploaded by a client is visible to the admin in the project workspace,
and across browsers/devices. (The file bytes themselves are not stored in this
demo — only the record.)

If this app later gains a real database + object storage, replace this module.
"""
from typing import Dict, List


_documents: List[Dict] = []


def list_by_project(project_id: str) -> List[Dict]:
    return [d for d in _documents if d["projectId"] == project_id]


def create_document(data: Dict) -> Dict:
    """Create a document record (idempotent upsert by id)."""
    existing = next((d for d in _documents if d["id"] == data["id"]), None)
    if existing:
        existing.update(data)
        return existing
    _documents.append(dict(data))
    return data


def delete_document(document_id: str) -> bool:
    for i, d in enumerate(_documents):
        if d["id"] == document_id:
            _documents.pop(i)
            return True
    return False
