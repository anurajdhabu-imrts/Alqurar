from typing import Optional

from pydantic import BaseModel, field_validator


class EmployeeOut(BaseModel):
    id: str
    name: str
    designation: str
    hourlyRate: float
    department: Optional[str] = None
    status: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class EmployeeCreate(BaseModel):
    # Name is optional — the master data is keyed by designation/role + rate.
    name: str = ""
    designation: str
    hourlyRate: float = 0
    department: Optional[str] = None
    status: str = "Active"

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in ("Active", "Inactive"):
            raise ValueError("status must be 'Active' or 'Inactive'")
        return v

    @field_validator("hourlyRate")
    @classmethod
    def _non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("hourlyRate cannot be negative")
        return v


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    hourlyRate: Optional[float] = None
    department: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("Active", "Inactive"):
            raise ValueError("status must be 'Active' or 'Inactive'")
        return v

    @field_validator("hourlyRate")
    @classmethod
    def _non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("hourlyRate cannot be negative")
        return v
