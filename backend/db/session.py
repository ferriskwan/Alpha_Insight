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
    """Return or create the SQLAlchemy Engine with bounded pool configuration."""
    global _engine
    if _engine is None:
        settings = get_settings()
        uri = settings.sqlalchemy_database_uri
        engine_kwargs: dict[str, Any] = {
            "pool_pre_ping": True,
            "future": True,
        }
        if not uri.startswith("sqlite"):
            engine_kwargs.update(
                {
                    "pool_size": settings.db_pool_size,
                    "max_overflow": settings.db_max_overflow,
                    "pool_recycle": settings.db_pool_recycle,
                    "pool_timeout": settings.db_pool_timeout,
                }
            )
        _engine = create_engine(uri, **engine_kwargs)
    return _engine


def dispose_engine() -> None:
    """Dispose the SQLAlchemy Engine and release pooled database connections."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
        _engine = None
    _session_factory = None


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
        settings = get_settings()
        pd_module.init_pool(minconn=1, maxconn=settings.db_raw_pool_maxconn)
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
