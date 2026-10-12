import os
import sys
import logging
import asyncio
from contextlib import asynccontextmanager, suppress

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import asyncpg
from fastapi.middleware.cors import CORSMiddleware

from core.audit import IMPORTANT_ACTIONS, audit_entity_id, get_audit_actor, record_audit_log
from core.config import CORS_ORIGINS, validate_production_config
from core.db import get_pool, close_pool
from core.quiz_attempts import finalize_expired_quizzes
from core.http_limits import RequestLimitsMiddleware
from routers import admin, audit, auth, courses, enrollments, ent_trial, files, grades, homework, leads, quizzes, search

logger = logging.getLogger(__name__)


async def expire_ent_attempts():
    while True:
        try:
            await ent_trial.finalize_expired()
        except Exception:
            logger.exception("Failed to finalize expired ENT attempts")
        try:
            pool = await get_pool()
            await finalize_expired_quizzes(pool)
        except Exception:
            logger.exception("Failed to finalize expired LMS quizzes")
        try:
            pool = await get_pool()
            await pool.execute("DELETE FROM request_limits WHERE window_start < now()-interval '1 day'")
            await pool.execute("DELETE FROM password_reset_tokens WHERE expires_at < now()-interval '7 days'")
        except Exception:
            logger.exception("Failed to clean expired security records")
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app):
    validate_production_config()
    pool = await get_pool()
    await pool.fetchval('SELECT 1')
    worker = asyncio.create_task(expire_ent_attempts())
    try:
        yield
    finally:
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker
        await close_pool()


app = FastAPI(title="Phenomenon School LMS API", version="1.0.0", lifespan=lifespan)


@app.exception_handler(asyncpg.ForeignKeyViolationError)
async def dependent_history_error(request, exc):
    return JSONResponse(status_code=409, content={"detail": "This object has dependent data. Block or unpublish it instead of deleting it."})


@app.exception_handler(asyncpg.ObjectNotInPrerequisiteStateError)
async def quiz_history_error(request, exc):
    return JSONResponse(status_code=409, content={"detail": "Students have started this quiz. Create a new quiz to change its questions or settings."})


@app.exception_handler(asyncpg.CheckViolationError)
async def invalid_database_value(request, exc):
    return JSONResponse(status_code=422, content={"detail": "The value conflicts with the current data or allowed limits."})


@app.exception_handler(asyncpg.UniqueViolationError)
async def duplicate_value(request, exc):
    return JSONResponse(status_code=409, content={"detail": "This record already exists."})


@app.middleware("http")
async def audit_important_actions(request: Request, call_next):
    actor = None
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        try:
            actor = await get_audit_actor(request.headers.get("Authorization", ""))
        except Exception:
            logger.exception("Failed to resolve audit actor")

    response = await call_next(request)
    route = request.scope.get("route")
    action = IMPORTANT_ACTIONS.get(getattr(route, "name", ""))
    if actor and action and response.status_code < 400:
        path_params = dict(request.path_params)
        try:
            await record_audit_log(
                actor=actor,
                action=action,
                entity_id=audit_entity_id(path_params),
                details={
                    "method": request.method,
                    "path": request.url.path,
                    "path_params": path_params,
                    "status_code": response.status_code,
                },
            )
        except Exception:
            # A logging outage must not turn an already completed mutation into
            # a misleading client error. The exception remains visible in logs.
            logger.exception("Failed to record audit log")
    return response


app.add_middleware(RequestLimitsMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(quizzes.router)
app.include_router(homework.router)
app.include_router(enrollments.router)
app.include_router(grades.router)
app.include_router(files.router)
app.include_router(admin.router)
app.include_router(leads.router)
app.include_router(leads.admin_router)
app.include_router(search.router)
app.include_router(ent_trial.router)
app.include_router(audit.router)


@app.get("/health")
async def health() -> dict[str, str]:
    try:
        pool = await get_pool()
        await asyncio.wait_for(pool.fetchval('SELECT 1'), timeout=3)
        return {"status": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
