from typing import Optional

from pydantic import BaseModel


class ClientProfileIn(BaseModel):
    """Company details for a client, keyed by the client's user id."""

    userId: str
    company: str = ""
    crNo: Optional[str] = None
    country: Optional[str] = None
    roleOnProject: Optional[str] = None
    contactName: str = ""
    email: str = ""
    phone: Optional[str] = None
    projectId: Optional[str] = None
    createdAt: Optional[str] = None
    # Secret token for the client's passwordless upload link. Never set by the
    # client; generated server-side. Returned so the admin can copy/share the link.
    accessToken: Optional[str] = None
    # Client lifecycle stage: "Temporary" (new) or "Permanent" (promoted later).
    clientType: str = "Temporary"


class ClientProfileOut(ClientProfileIn):
    # Absolute, ready-to-share upload-portal link, built server-side from
    # FRONTEND_URL + accessToken so the frontend never constructs URLs.
    portalLink: Optional[str] = None
