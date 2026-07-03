from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.db import get_pool
from core.deps import require_admin
from routers.grades import compute_student_course_grade

router = APIRouter(prefix="/admin", tags=["admin"])


class RoleIn(BaseModel):
    role: str = Field(pattern="^(guest|student|teacher|admin)$")


class BlockIn(BaseModel):
    is_blocked: bool


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
    role: str = Query("", max_length=20),
    user: dict = Depends(require_admin),
):
    pool = await get_pool()
    offset = (page - 1) * per_page
    like = f"%{q}%"
    rows = await pool.fetch(
        """
        SELECT id, email, full_name, role, is_blocked, created_at, COUNT(*) OVER() AS total
        FROM users
        WHERE ($1 = '' OR full_name ILIKE $2 OR email ILIKE $2)
          AND ($3 = '' OR role = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        """,
        q,
        like,
        role,
        per_page,
        offset,
    )
    total = rows[0]["total"] if rows else 0
    return {
        "items": [
            {
                "id": r["id"],
                "email": r["email"],
                "full_name": r["full_name"],
                "role": r["role"],
                "is_blocked": r["is_blocked"],
                "created_at": str(r["created_at"]),
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/users/{user_id}/role")
async def set_role(user_id: int, data: RoleIn, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=422, detail="You cannot change your own role")
    pool = await get_pool()
    row = await pool.fetchrow("UPDATE users SET role = $1 WHERE id = $2 RETURNING id", data.role, user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@router.post("/users/{user_id}/block")
async def set_blocked(user_id: int, data: BlockIn, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=422, detail="You cannot block yourself")
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING id", data.is_blocked, user_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@router.get("/stats")
async def system_stats(user: dict = Depends(require_admin)):
    pool = await get_pool()
    totals = await pool.fetchrow(
        """
        SELECT
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
          (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
          (SELECT COUNT(*) FROM users WHERE role = 'guest') AS total_guests,
          (SELECT COUNT(*) FROM courses) AS total_courses,
          (SELECT COUNT(*) FROM enrollments WHERE status = 'approved') AS active_enrollments,
          (SELECT COUNT(*) FROM enrollments WHERE status = 'pending') AS pending_enrollments
        """
    )
    per_course = await pool.fetch(
        """
        SELECT c.id, c.title,
               (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'approved') AS students
        FROM courses c ORDER BY students DESC, c.title LIMIT 20
        """
    )
    # Completed courses: student finished all gradable items
    completed = await pool.fetchval(
        """
        SELECT COUNT(*) FROM (
          SELECT e.course_id, e.student_id
          FROM enrollments e
          WHERE e.status = 'approved'
            AND (SELECT COUNT(*) FROM course_items ci
                 WHERE ci.course_id = e.course_id AND ci.type IN ('quiz','homework') AND ci.is_visible) > 0
            AND (SELECT COUNT(*) FROM course_items ci
                 WHERE ci.course_id = e.course_id AND ci.type IN ('quiz','homework') AND ci.is_visible)
              = (SELECT COUNT(*) FROM course_items ci
                 WHERE ci.course_id = e.course_id AND ci.type IN ('quiz','homework') AND ci.is_visible
                   AND (
                     (ci.type = 'quiz' AND EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.quiz_id = ci.id AND qa.student_id = e.student_id))
                     OR
                     (ci.type = 'homework' AND EXISTS (SELECT 1 FROM homework_submissions hs WHERE hs.homework_id = ci.id AND hs.student_id = e.student_id))
                   ))
        ) t
        """
    )
    return {
        "total_users": totals["total_users"],
        "total_teachers": totals["total_teachers"],
        "total_students": totals["total_students"],
        "total_guests": totals["total_guests"],
        "total_courses": totals["total_courses"],
        "active_enrollments": totals["active_enrollments"],
        "pending_enrollments": totals["pending_enrollments"],
        "completed_courses": completed,
        "students_per_course": [dict(r) for r in per_course],
    }


@router.get("/teachers/{teacher_id}")
async def teacher_profile(teacher_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    t = await pool.fetchrow(
        "SELECT id, email, full_name, role, is_blocked, created_at FROM users WHERE id = $1 AND role = 'teacher'",
        teacher_id,
    )
    if t is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    courses = await pool.fetch(
        """
        SELECT c.id, c.title, c.is_published,
               (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'approved') AS students,
               (SELECT COUNT(*) FROM course_items ci WHERE ci.course_id = c.id) AS items
        FROM courses c WHERE c.teacher_id = $1 ORDER BY c.created_at DESC
        """,
        teacher_id,
    )
    active_students = await pool.fetchval(
        """
        SELECT COUNT(DISTINCT e.student_id) FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE c.teacher_id = $1 AND e.status = 'approved'
        """,
        teacher_id,
    )
    return {
        "id": t["id"],
        "email": t["email"],
        "full_name": t["full_name"],
        "created_at": str(t["created_at"]),
        "is_blocked": t["is_blocked"],
        "courses_count": len(courses),
        "active_students": active_students,
        "courses": [dict(c) for c in courses],
    }


@router.get("/students/{student_id}")
async def student_profile(student_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    s = await pool.fetchrow(
        "SELECT id, email, full_name, role, is_blocked, created_at FROM users WHERE id = $1 AND role = 'student'",
        student_id,
    )
    if s is None:
        raise HTTPException(status_code=404, detail="Student not found")
    courses = await pool.fetch(
        """
        SELECT c.id, c.title FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE e.student_id = $1 AND e.status = 'approved' ORDER BY c.title
        """,
        student_id,
    )
    detail = []
    completed_count = 0
    grade_sum = 0.0
    graded_courses = 0
    for c in courses:
        g = await compute_student_course_grade(pool, c["id"], student_id)
        if g["total_items"] > 0 and g["completed_items"] == g["total_items"]:
            completed_count += 1
        if g["total_items"] > 0:
            grade_sum += g["final_grade"]
            graded_courses += 1
        detail.append(
            {
                "course_id": c["id"],
                "course_title": c["title"],
                "progress": g["progress"],
                "final_grade": g["final_grade"],
            }
        )
    return {
        "id": s["id"],
        "email": s["email"],
        "full_name": s["full_name"],
        "created_at": str(s["created_at"]),
        "is_blocked": s["is_blocked"],
        "enrolled_courses": len(courses),
        "completed_courses": completed_count,
        "average_grade": round(grade_sum / graded_courses, 2) if graded_courses else 0,
        "courses": detail,
    }
