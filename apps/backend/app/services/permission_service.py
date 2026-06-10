"""Permission catalog — must match the frontend src/mock/admin.ts permissionGroups."""
from typing import List, Dict


_permission_groups: List[Dict] = [
    {
        "module": "EOT Claims",
        "perms": [
            {"id": "claims.view", "label": "View claims"},
            {"id": "claims.create", "label": "Create & edit claims"},
            {"id": "claims.generate", "label": "Generate AI drafts"},
            {"id": "claims.submit", "label": "Submit claims"},
            {"id": "claims.delete", "label": "Delete claims"},
            {"id": "claims.assign_client", "label": "Assign clients to projects"},
        ],
    },
    {
        "module": "Contracts",
        "perms": [
            {"id": "contracts.view", "label": "View contracts"},
            {"id": "contracts.manage", "label": "Manage clauses & obligations"},
        ],
    },
    {
        "module": "Obligations & Notices",
        "perms": [
            {"id": "notices.view", "label": "View notice timeline"},
            {"id": "notices.manage", "label": "Manage notices & deadlines"},
        ],
    },
    {
        "module": "Dispute Resolution",
        "perms": [
            {"id": "disputes.view", "label": "View dispute cases"},
            {"id": "disputes.manage", "label": "Manage dispute cases"},
        ],
    },
    {
        "module": "Administration",
        "perms": [
            {"id": "admin.users", "label": "Manage users"},
            {"id": "admin.roles", "label": "Manage roles & permissions"},
            {"id": "admin.settings", "label": "Platform settings"},
        ],
    },
    {
        "module": "Client Portal",
        "perms": [
            {"id": "client.dashboard", "label": "Access client dashboard"},
            {"id": "client.projects.view", "label": "View assigned projects"},
            {"id": "client.documents.upload", "label": "Upload claim documents"},
            {"id": "client.documents.delete", "label": "Delete uploaded documents"},
        ],
    },
]


def list_permission_groups() -> List[Dict]:
    return _permission_groups


def all_permission_ids() -> List[str]:
    return [p["id"] for g in _permission_groups for p in g["perms"]]
