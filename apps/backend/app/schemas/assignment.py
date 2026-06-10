from typing import List
from pydantic import BaseModel


class AssignRequest(BaseModel):
    project_id: str
    client_user_ids: List[str]


class ProjectClientsOut(BaseModel):
    project_id: str
    client_user_ids: List[str]


class MyProjectsOut(BaseModel):
    project_ids: List[str]
