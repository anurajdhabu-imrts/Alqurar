"""SQLAlchemy models — persisted equivalents of the former in-memory stores.

Column names mirror the dict keys the services/schemas already use (incl.
camelCase), so the API responses are unchanged.
"""
from typing import Optional

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="Client View")
    status: Mapped[str] = mapped_column(String, default="Active")
    phone: Mapped[str] = mapped_column(String, default="")
    lastActive: Mapped[str] = mapped_column(String, default="")

    def to_dict(self, with_password: bool = False) -> dict:
        d = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "phone": self.phone,
            "lastActive": self.lastActive,
        }
        if with_password:
            d["password"] = self.password
        return d


class ClientProfile(Base):
    """Company details for a client, keyed by the client's user id."""

    __tablename__ = "client_profiles"

    userId: Mapped[str] = mapped_column(String, primary_key=True)
    company: Mapped[str] = mapped_column(String, default="")
    crNo: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    roleOnProject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contactName: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="", index=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    projectId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    _FIELDS = (
        "userId", "company", "crNo", "country", "roleOnProject",
        "contactName", "email", "phone", "projectId", "createdAt",
    )

    def to_dict(self) -> dict:
        return {f: getattr(self, f) for f in self._FIELDS}


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    code: Mapped[str] = mapped_column(String, default="")
    employer: Mapped[str] = mapped_column(String, default="")
    contractor: Mapped[str] = mapped_column(String, default="")
    standard: Mapped[str] = mapped_column(String, default="")
    value: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String, default="OMR")
    startDate: Mapped[str] = mapped_column(String, default="")
    completionDate: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="Active")
    riskLevel: Mapped[str] = mapped_column(String, default="Moderate")
    source: Mapped[str] = mapped_column(String, default="created")
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    engineer: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    loaRef: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    commencementDate: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    timeForCompletionDays: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dataDate: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    baselineProgramme: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    _FIELDS = (
        "id", "name", "code", "employer", "contractor", "standard", "value", "currency",
        "startDate", "completionDate", "status", "riskLevel", "source", "location", "engineer",
        "loaRef", "commencementDate", "timeForCompletionDays", "dataDate", "baselineProgramme", "createdAt",
    )

    def to_dict(self) -> dict:
        return {f: getattr(self, f) for f in self._FIELDS}


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, index=True)
    client_user_id: Mapped[str] = mapped_column(String, index=True)
    assigned_by: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[str] = mapped_column(String, default="")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "client_user_id": self.client_user_id,
            "assigned_by": self.assigned_by,
            "created_at": self.created_at,
        }


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    projectId: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String, default="")
    type: Mapped[str] = mapped_column(String, default="Other")
    sizeKB: Mapped[int] = mapped_column(Integer, default=0)
    uploadedAt: Mapped[str] = mapped_column(String, default="")
    uploadedBy: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="Uploaded")
    claimRef: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    _FIELDS = ("id", "projectId", "name", "type", "sizeKB", "uploadedAt", "uploadedBy", "status", "claimRef", "note")

    def to_dict(self) -> dict:
        return {f: getattr(self, f) for f in self._FIELDS}
