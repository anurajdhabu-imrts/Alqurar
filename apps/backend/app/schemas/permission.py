from typing import List
from pydantic import BaseModel


class PermissionOut(BaseModel):
    id: str
    label: str


class PermissionGroupOut(BaseModel):
    module: str
    perms: List[PermissionOut]
