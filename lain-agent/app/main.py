from __future__ import annotations

from fastapi import FastAPI

from app.routes.scenes import router as scenes_router
from app.routes.runs import router as runs_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="lain-agent",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.include_router(runs_router)
    app.include_router(scenes_router)
    return app


app = create_app()
