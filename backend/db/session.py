"""Database session management and psycopg2 ThreadedConnectionPool lifecycle."""

from __future__ import annotations

import logging
from collections.abc import Generator
from typing import Any, Optional

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

import ProcessData as pd_module
from backend.config import get_settings

logger = logging.getLogger(__name__)

_engine: Optional[Engine] = None
_session_factory: Optional[sessionmaker[Session]] = None


def get_engine() -> Engine:
    """Return or create the SQLAlchemy Engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.sqlalchemy_database_uri,
            pool_pre_ping=True,
            future=True,
        )
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Return or create the SQLAlchemy sessionmaker."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _session_factory


def get_db_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a SQLAlchemy Session."""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
    finally:
        session.close()


def init_db_pool() -> None:
    """Initialize the psycopg2 ThreadedConnectionPool in ProcessData."""
    try:
        pd_module.init_pool(minconn=1, maxconn=20)
    except Exception as exc:
        logger.warning("Could not initialize psycopg2 connection pool at startup: %s", exc)


def close_db_pool() -> None:
    """Close the psycopg2 ThreadedConnectionPool in ProcessData."""
    try:
        pd_module.close_pool()
    except Exception as exc:
        logger.warning("Error closing psycopg2 connection pool: %s", exc)


def get_raw_db_connection() -> Generator[Any, None, None]:
    """FastAPI dependency yielding a pooled psycopg2 connection via ProcessData."""
    conn = pd_module.get_connection()
    try:
        yield conn
    finally:
        pd_module.put_connection(conn)
