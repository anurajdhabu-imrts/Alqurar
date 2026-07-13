"""Employee master-data store — backed by the database.

The single source of truth for who can be costed on a proposal and at what hourly
rate. Costing rows snapshot the rate at save time (see costing_service), so this
store owns only the *current* master values; historical rates live on the costings.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from app.db import SessionLocal
from app.models import Employee


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_employees() -> List[Dict]:
    with SessionLocal() as db:
        rows = (
            db.query(Employee)
            .order_by(Employee.status.desc(), Employee.name)  # Active before Inactive
            .all()
        )
        return [e.to_dict() for e in rows]


def get_employee(employee_id: str) -> Optional[Dict]:
    with SessionLocal() as db:
        e = db.get(Employee, employee_id)
        return e.to_dict() if e else None


def create_employee(data: Dict) -> Dict:
    now = _now()
    with SessionLocal() as db:
        emp = Employee(
            id=f"emp-{uuid4().hex[:12]}",
            name=(data.get("name") or "").strip(),
            designation=data["designation"].strip(),
            hourlyRate=float(data.get("hourlyRate") or 0),
            department=(data.get("department") or None),
            status=data.get("status") or "Active",
            createdAt=now,
            updatedAt=now,
        )
        db.add(emp)
        db.commit()
        return emp.to_dict()


def update_employee(employee_id: str, patch: Dict) -> Optional[Dict]:
    with SessionLocal() as db:
        emp = db.get(Employee, employee_id)
        if not emp:
            return None
        for key, value in patch.items():
            if value is not None:
                setattr(emp, key, value.strip() if isinstance(value, str) else value)
        emp.updatedAt = _now()
        db.commit()
        return emp.to_dict()


def delete_employee(employee_id: str) -> bool:
    with SessionLocal() as db:
        emp = db.get(Employee, employee_id)
        if not emp:
            return False
        db.delete(emp)
        db.commit()
        return True
