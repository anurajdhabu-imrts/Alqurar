"""Employee master-data API — the source of employees/rates for proposal costing.

    GET    /employees
    POST   /employees
    PATCH  /employees/{employee_id}
    DELETE /employees/{employee_id}

Managing employees is an administrative action, gated on `admin.users` (the same
permission that governs the Users and Clients admin screens). Any authenticated
user can READ the list, because the costing tab needs it to populate its dropdowns.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import get_current_user, require_permission
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.services.employee_service import (
    create_employee,
    delete_employee,
    get_employee,
    list_employees,
    update_employee,
)

router = APIRouter()

_MANAGE = require_permission("admin.users")


@router.get("/", response_model=List[EmployeeOut])
async def get_employees(_=Depends(get_current_user)):
    """All employees. Readable by any authenticated user (costing dropdowns)."""
    return list_employees()


@router.post("/", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def post_employee(payload: EmployeeCreate, _=Depends(get_current_user), __=Depends(_MANAGE)):
    if not payload.designation.strip():
        raise HTTPException(status_code=400, detail="Designation is required.")
    return create_employee(payload.model_dump())


@router.patch("/{employee_id}", response_model=EmployeeOut)
async def patch_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    _=Depends(get_current_user),
    __=Depends(_MANAGE),
):
    updated = update_employee(employee_id, payload.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Employee not found")
    return updated


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_employee(employee_id: str, _=Depends(get_current_user), __=Depends(_MANAGE)):
    if not get_employee(employee_id):
        raise HTTPException(status_code=404, detail="Employee not found")
    delete_employee(employee_id)
