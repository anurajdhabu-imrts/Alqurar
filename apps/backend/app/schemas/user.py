from typing import Optional
from pydantic import BaseModel


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    status: str
    phone: Optional[str] = None
    lastActive: str = ""


class UserCreate(BaseModel):
    name: str
    email: str
    password: str = "demo1234"
    role: str
    status: str = "Invited"
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
