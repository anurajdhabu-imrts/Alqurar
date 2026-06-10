"""Role store — seeded with the 5 built-in roles from the frontend src/mock/admin.ts."""
import time
from typing import Dict, List, Optional

from app.services.permission_service import all_permission_ids


_roles: List[Dict] = [
    {
        "id": "r-admin",
        "name": "Administrator",
        "description": "Full access to all projects, users and platform settings.",
        "color": "#0a2540",
        "system": True,
        "permissionIds": all_permission_ids(),
    },
    {
        "id": "r-claims",
        "name": "Claims Manager",
        "description": "Create and manage EOT claims, delay events and submissions.",
        "color": "#e8920c",
        "system": True,
        "permissionIds": [
            "claims.view", "claims.create", "claims.generate", "claims.submit",
            "contracts.view", "notices.view", "notices.manage", "disputes.view",
        ],
    },
    {
        "id": "r-contract",
        "name": "Contract Manager",
        "description": "Manage contracts, clauses, obligations and variations.",
        "color": "#2563eb",
        "system": True,
        "permissionIds": [
            "claims.view", "contracts.view", "contracts.manage", "notices.view", "notices.manage",
        ],
    },
    {
        "id": "r-legal",
        "name": "Legal Reviewer",
        "description": "Review and approve AI-generated outputs and submissions.",
        "color": "#18794e",
        "system": True,
        "permissionIds": [
            "claims.view", "claims.generate", "claims.submit",
            "contracts.view", "notices.view", "disputes.view", "disputes.manage",
        ],
    },
    {
        "id": "r-client",
        "name": "Client View",
        "description": "Read-only client portal: assigned projects and claim document upload.",
        "color": "#5a6878",
        "system": True,
        "permissionIds": [
            "claims.view", "contracts.view", "notices.view", "disputes.view",
            "client.dashboard", "client.projects.view", "client.documents.upload",
        ],
    },
]


def list_roles() -> List[Dict]:
    return _roles


def get_role(identifier: str) -> Optional[Dict]:
    """Lookup by id or name."""
    for r in _roles:
        if r["id"] == identifier or r["name"] == identifier:
            return r
    return None


def add_role(data: Dict) -> Dict:
    new = {
        "id": f"r-{int(time.time() * 1000)}",
        "name": data["name"],
        "description": data.get("description") or "",
        "color": data.get("color") or "#0a2540",
        "system": False,
        "permissionIds": list(data.get("permissionIds") or []),
    }
    _roles.append(new)
    return new


def update_role(role_id: str, patch: Dict) -> Optional[Dict]:
    for r in _roles:
        if r["id"] == role_id:
            for k, v in patch.items():
                if v is not None:
                    r[k] = v
            return r
    return None


def delete_role(role_id: str) -> bool:
    for i, r in enumerate(_roles):
        if r["id"] == role_id:
            if r.get("system"):
                return False
            _roles.pop(i)
            return True
    return False


def user_has_permission(role_name: str, permission_id: str) -> bool:
    role = get_role(role_name)
    return bool(role and permission_id in role.get("permissionIds", []))
