from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.db import get_pool
from core.deps import require_admin, require_student

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


class DecideIn(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")


@router.post("/request/{course_id}")
async def request_enrollment(course_id: int, user: dict = Depends(require_student)):
    pool = await get_pool()
    course = await pool.fetchrow("SELECT id, is_published FROM courses WHERE id = $1", course_id)
    if course is None or not course["is_published"]:
        raise HTTPException(status_code=404, detail="Course not found")
    existing = await pool.fetchrow(
        "SELECT status FROM enrollments WHERE course_id = $1 AND student_id = $2", course_id, user["id"]
    )
    if existing:
        if existing["status"] == "rejected":
            await pool.execute(
                """
                UPDATE enrollments SET status = 'pending', requested_at = now(), decided_at = NULL
                WHERE course_id = $1 AND student_id = $2
                """,
                course_id,
                user["id"],
            )
            return {"status": "pending"}
        raise HTTPException(status_code=409, detail=f"Enrollment already {existing['status']}")
    await pool.execute(
        "INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)", course_id, user["id"]
    )
    return {"status": "pending"}


@router.get("/pending")
async def pending_enrollments(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin),
):
    pool = await get_pool()
    offset = (page - 1) * per_page
    rows = await pool.fetch(
        """
        SELECT e.id, e.status, e.requested_at, c.title AS course_title, c.id AS course_id,
               u.full_name AS student_name, u.email AS student_email, u.id AS student_id,
               COUNT(*) OVER() AS total
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        JOIN users u ON u.id = e.student_id
        WHERE e.status = 'pending'
        ORDER BY e.requested_at ASC
        LIMIT $1 OFFSET $2
        """,
        per_page,
        offset,
    )
    total = rows[0]["total"] if rows else 0
    return {
        "items": [
            {
                "id": r["id"],
                "status": r["status"],
                "requested_at": str(r["requested_at"]),
                "course_id": r["course_id"],
                "course_title": r["course_title"],
                "student_id": r["student_id"],
                "student_name": r["student_name"],
                "student_email": r["student_email"],
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/{enrollment_id}/decide")
async def decide_enrollment(enrollment_id: int, data: DecideIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE enrollments SET status = $1, decided_at = now() WHERE id = $2 RETURNING id",
        data.status,
        enrollment_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return {"ok": True, "status": data.status}
