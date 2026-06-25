"""Database setup — synchronous SQLAlchemy against PostgreSQL.

Sync (psycopg2) is used so the existing services can manage their own sessions
without converting every route to async. The DATABASE_URL is read from .env; the
async driver in that URL is normalised to the sync driver for this engine.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

_DEFAULT_URL = "postgresql+psycopg2://postgres:root@localhost:5432/alqrar"


def _sync_url() -> str:
    url = os.getenv("DATABASE_URL", _DEFAULT_URL)
    # This engine is synchronous — use psycopg2 regardless of how .env is written.
    url = url.replace("+asyncpg", "+psycopg2")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


engine = create_engine(_sync_url(), pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create tables if they don't exist (called on app startup)."""
    from app import models  # noqa: F401 — register models on Base

    Base.metadata.create_all(bind=engine)

    # Lightweight column additions for tables that already existed before a new
    # field was introduced (create_all won't alter existing tables).
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE documents ADD COLUMN IF NOT EXISTS "driveFileId" VARCHAR'))
        conn.execute(text('ALTER TABLE documents ADD COLUMN IF NOT EXISTS "data" BYTEA'))
        conn.execute(text('ALTER TABLE documents ADD COLUMN IF NOT EXISTS "mime" VARCHAR'))
