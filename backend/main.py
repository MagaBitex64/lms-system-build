import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import admin, auth, courses, enrollments, files, grades, homework, leads, quizzes, search

app = FastAPI(title="Phenomenon School LMS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
