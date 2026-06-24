from fastapi import APIRouter

from app.api.v1 import auth, users, roles, permissions, documents, assignments, clauses, projects, project_documents

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(clauses.router, prefix="/clauses", tags=["clauses"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(project_documents.router, prefix="/project-documents", tags=["project-documents"])
