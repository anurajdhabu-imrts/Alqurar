from typing import List, Optional
from pydantic import BaseModel


class RoleOut(BaseModel):
    id: str
    name: str
    description: str
    color: str
    system: bool
    permissionIds: List[str] = []


class RoleCreate(BaseModel):
    name: str
    description: str = ""
    color: str = "#0a2540"
    permissionIds: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    permissionIds: Optional[List[str]] = None
