"""FastAPI application root with lifespan, CORS, and mounted sub-routers."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.api.v1 import (
    admin,
    analysis,
    auth,
    committee,
    dataops,
    notes,
    portfolio,
    research,
    sitemap,
    transactions,
    watchlist,
)
from backend.config import get_settings
from backend.db.session import close_db_pool, init_db_pool

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown events."""
    logger.info("Initializing Alpha_Insight backend application...")
    init_db_pool()
    yield
    logger.info("Shutting down Alpha_Insight backend application...")
    close_db_pool()


settings = get_settings()

app = FastAPI(
    title="Alpha_Insight API",
    description="Unified FastAPI Backend for Alpha_Insight & 4leafclover Data Operations",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(dataops.router, prefix="/api/v1", tags=["dataops"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["watchlist"])
app.include_router(watchlist.router, prefix="/api/v1/watchlist", tags=["watchlist"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(portfolio.router, prefix="/api/v1/portfolio", tags=["portfolio"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(sitemap.router, prefix="/api/sitemap", tags=["sitemap"])
app.include_router(sitemap.router, prefix="/api/v1/sitemap", tags=["sitemap"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(research.router, prefix="/api/v1/research", tags=["research"])
app.include_router(committee.router, prefix="/api/committee", tags=["committee"])
app.include_router(committee.router, prefix="/api/v1/committee", tags=["committee"])
app.include_router(notes.router, prefix="/api/notes", tags=["notes"])
app.include_router(notes.router, prefix="/api/v1/notes", tags=["notes"])


@app.get("/api/health")
@app.get("/healthz")
def health_check() -> dict[str, str]:
    """Kubernetes / Cloud Run liveness and readiness probe endpoint."""
    return {"status": "ok", "env": settings.env}


# Frontend Static Files SPA Serving for Cloud Run Container
project_root = Path(__file__).resolve().parent.parent
dist_path = project_root / "frontend" / "dist"
if not dist_path.exists():
    dist_path = project_root / "dist"

if dist_path.exists():
    assets_dir = dist_path / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str, request: Request):
        # Don't intercept API routes or documentation
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        requested_file = dist_path / full_path
        if requested_file.is_file():
            return FileResponse(requested_file)
        index_file = dist_path / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})
