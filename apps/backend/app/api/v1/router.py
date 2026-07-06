from fastapi import APIRouter

from app.api.v1 import auth, users, roles, permissions, documents, assignments, clauses, projects, project_documents, project_clauses, client_profiles, delay_events, portal, proposals, client_proposals

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(clauses.router, prefix="/clauses", tags=["clauses"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(project_clauses.router, prefix="/projects", tags=["project-clauses"])
api_router.include_router(project_documents.router, prefix="/project-documents", tags=["project-documents"])
api_router.include_router(client_profiles.router, prefix="/client-profiles", tags=["client-profiles"])
api_router.include_router(delay_events.router, prefix="/delay-events", tags=["delay-events"])
api_router.include_router(proposals.router, prefix="/proposals", tags=["proposals"])
api_router.include_router(client_proposals.router, prefix="/client-proposals", tags=["client-proposals"])
api_router.include_router(portal.router, prefix="/portal", tags=["portal"])
