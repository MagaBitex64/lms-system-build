import os
import sys
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from core.audit import IMPORTANT_ACTIONS, audit_entity_id, get_audit_actor, record_audit_log
from routers import admin, audit, auth, courses, enrollments, files, grades, homework, leads, quizzes, search

app = FastAPI(title="Phenomenon School LMS API", version="1.0.0")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
app.include_router(audit.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
