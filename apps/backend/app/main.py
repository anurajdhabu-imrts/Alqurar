import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.db import init_db
from app.services.user_service import seed_users
from app.services.client_profile_service import ensure_tokens
from app.services.document_service import list_unfinished_analysis_ids
from app.services.document_analysis import run_many


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create tables (if missing) and seed the demo data on startup.
    init_db()
    seed_users()
    ensure_tokens()  # give any pre-existing client an upload-link token

    # Resume any document analyses that a previous run left unfinished, so they
    # don't sit "pending" forever. Runs in the background (semaphore-bounded).
    if os.getenv("ANTHROPIC_API_KEY"):
        pending = list_unfinished_analysis_ids()
        if pending:
            asyncio.create_task(run_many(pending))
    yield


app = FastAPI(
    title="Demo Backend",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "Demo backend is running"}


@app.get("/hello")
async def hello():
    return {"hello": "world"}

