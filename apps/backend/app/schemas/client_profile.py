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


class ClientProfileOut(ClientProfileIn):
    pass
