"""SQLAlchemy models — persisted equivalents of the former in-memory stores.

Column names mirror the dict keys the services/schemas already use (incl.
camelCase), so the API responses are unchanged.
"""
from typing import Optional

from sqlalchemy import JSON, Boolean, Float, Integer, LargeBinary, String, Text
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
    # Secret token for the client's passwordless upload portal link
    # (/portal/{accessToken}). Unique per client; how they access without a login.
    accessToken: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)

    _FIELDS = (
        "userId", "company", "crNo", "country", "roleOnProject",
        "contactName", "email", "phone", "projectId", "createdAt", "accessToken",
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
    driveFileId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # The actual file bytes are stored in the database so uploads persist and can
    # be downloaded again (no external storage needed). DEFERRED: a file can be
    # tens of MB, so it is NOT loaded by ordinary list/get queries (e.g. the data
    # room list that the UI polls). It loads only when the bytes are accessed
    # (download / text extraction), keeping list queries small and the event loop
    # responsive.
    data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True, deferred=True)
    mime: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Client user id when uploaded via the client portal — lets a client see only
    # their own uploads ("client folder"). Null for admin/staff uploads.
    uploadedById: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    # Cached AI analysis of this document (DocumentAnalysis shape) so the data room
    # shows what each file is about without re-running the model on every view.
    analysis: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Background-analysis lifecycle: "" (never run), "pending", "analyzing",
    # "done", "failed". Lets the UI poll instead of blocking on the model call.
    analysisStatus: Mapped[str] = mapped_column(String, default="")
    analysisError: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Cached extracted text (OCR'd if the file was scanned). Computed once during
    # analysis and reused by delay-event extraction so files aren't re-read/re-OCR'd.
    # Deferred + kept out of _FIELDS: never sent to the frontend or loaded by lists.
    extractedText: Mapped[Optional[str]] = mapped_column(Text, nullable=True, deferred=True)

    _FIELDS = ("id", "projectId", "name", "type", "sizeKB", "uploadedAt", "uploadedBy", "status", "claimRef", "note", "driveFileId", "uploadedById", "analysis", "analysisStatus", "analysisError")

    def to_dict(self) -> dict:
        return {f: getattr(self, f) for f in self._FIELDS}


class DocumentComment(Base):
    """A free-text comment/note attached to an uploaded document. Multiple
    comments per document; shown beside the file in the in-app viewer."""

    __tablename__ = "document_comments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    documentId: Mapped[str] = mapped_column(String, index=True)
    projectId: Mapped[str] = mapped_column(String, default="", index=True)
    body: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str] = mapped_column(String, default="")
    authorId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[str] = mapped_column(String, default="")
    # Optional text anchor (for Word/text documents): the exact selected text and
    # its character offset within the rendered content, so it can be highlighted.
    anchorText: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    anchorStart: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    anchorLength: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    _FIELDS = (
        "id", "documentId", "projectId", "body", "author", "authorId", "createdAt",
        "anchorText", "anchorStart", "anchorLength",
    )

    def to_dict(self) -> dict:
        return {f: getattr(self, f) for f in self._FIELDS}


class DelayEvent(Base):
    """A reviewable delay event for a project (Project Workspace → Delay Events).

    Plain data storage — no AI involved. Events are created manually by the
    analyst (or seeded), reviewed (Accept / Merge / Reject), edited and deleted.
    `chronology` and `sources` are lists, stored whole as JSON columns so they
    match the frontend shape exactly.
    """

    __tablename__ = "delay_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    projectId: Mapped[str] = mapped_column(String, index=True)
    ref: Mapped[str] = mapped_column(String, default="")
    title: Mapped[str] = mapped_column(String, default="")
    category: Mapped[str] = mapped_column(String, default="")
    narrative: Mapped[str] = mapped_column(Text, default="")
    cause: Mapped[str] = mapped_column(String, default="Employer")
    clause: Mapped[str] = mapped_column(String, default="")
    startDate: Mapped[str] = mapped_column(String, default="")
    endDate: Mapped[str] = mapped_column(String, default="")
    daysImpact: Mapped[int] = mapped_column(Integer, default=0)
    criticalPath: Mapped[bool] = mapped_column(Boolean, default=False)
    admissibility: Mapped[str] = mapped_column(String, default="Not assessed")
    aiConfidence: Mapped[int] = mapped_column(Integer, default=0)
    reviewStatus: Mapped[str] = mapped_column(String, default="Pending")
    chronology: Mapped[list] = mapped_column(JSON, default=list)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    createdAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updatedAt: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    _FIELDS = (
        "id", "projectId", "ref", "title", "category", "narrative", "cause", "clause",
        "startDate", "endDate", "daysImpact", "criticalPath", "admissibility",
        "aiConfidence", "reviewStatus", "chronology", "sources",
    )

    def to_dict(self) -> dict:
        d = {f: getattr(self, f) for f in self._FIELDS}
        d["chronology"] = self.chronology or []
        d["sources"] = self.sources or []
        return d


class ProjectClause(Base):
    """A clause in a single project's own Clause Library.

    Unlike a global reference list, clauses here belong to ONE project
    (projectId): each project has its own library, built from that project's
    uploaded contract. Today rows are added manually; when the Anthropic key is
    enabled, AI reads the uploaded contract and fills this same table, and later
    matches delay events to these rows. The columns mirror the former global
    clause shape plus projectId, so the frontend mapping is unchanged.
    """

    __tablename__ = "project_clauses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    projectId: Mapped[str] = mapped_column(String, index=True)
    contract_standard: Mapped[str] = mapped_column(String, default="")
    clause_number: Mapped[str] = mapped_column(String, default="")
    clause_title: Mapped[str] = mapped_column(String, default="")
    clause_description: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    created_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    _FIELDS = (
        "id", "projectId", "contract_standard", "clause_number", "clause_title",
        "clause_description", "tags", "created_by", "created_at", "updated_at",
    )

    def to_dict(self) -> dict:
        d = {f: getattr(self, f) for f in self._FIELDS}
        d["tags"] = self.tags or []
        return d


class PortalOTP(Base):
    """The active one-time code for a client portal link (one row per link).
    The code itself is stored hashed; rows expire and are deleted on use."""

    __tablename__ = "portal_otps"

    portalToken: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, default="")
    codeHash: Mapped[str] = mapped_column(String, default="")
    expiresAt: Mapped[str] = mapped_column(String, default="")  # ISO datetime
    attempts: Mapped[int] = mapped_column(Integer, default=0)


class PortalSession(Base):
    """A verified browser session for a client portal link, created after a
    successful OTP. The client isn't asked for OTP again until this expires."""

    __tablename__ = "portal_sessions"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    portalToken: Mapped[str] = mapped_column(String, index=True)
    userId: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="")
    createdAt: Mapped[str] = mapped_column(String, default="")
    expiresAt: Mapped[str] = mapped_column(String, default="")  # ISO datetime
