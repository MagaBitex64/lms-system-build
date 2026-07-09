from fastapi import APIRouter, Depends

from core.access import ensure_course_owner
from core.db import get_pool
from core.deps import get_current_user, require_teacher

router = APIRouter(prefix="/grades", tags=["grades"])


async def compute_student_course_grade(pool, course_id: int, student_id: int) -> dict:
    """Final grade on a 100-point scale: sum of (score/max * weight)."""
    gradables = await pool.fetch(
        """
        SELECT ci.id, ci.type, ci.title,
               COALESCE(q.max_score, h.max_score) AS max_score,
               COALESCE(q.weight_pct, h.weight_pct) AS weight_pct,
               h.deadline_at
        FROM course_items ci
        LEFT JOIN quizzes q ON q.item_id = ci.id
        LEFT JOIN homework h ON h.item_id = ci.id
        WHERE ci.course_id = $1 AND (ci.type IN ('quiz','homework') OR q.item_id IS NOT NULL) AND ci.is_visible
          AND (
            EXISTS (
              SELECT 1 FROM item_student_access isa
              WHERE isa.item_id = ci.id AND isa.student_id = $2
            )
            OR EXISTS (
              SELECT 1
              FROM item_group_access iga
              JOIN group_students gs ON gs.group_id = iga.group_id AND gs.student_id = $2
              JOIN course_groups cg ON cg.group_id = iga.group_id AND cg.course_id = ci.course_id
              WHERE iga.item_id = ci.id
            )
          )
        ORDER BY ci.position
        """,
        course_id,
        student_id,
    )
    entries = []
    final_grade = 0.0
    total_weight = 0.0
    completed = 0
    for g in gradables:
        score = None
        status = "not_started"
        if g["max_score"] is not None and g["type"] != "homework":
            a = await pool.fetchrow(
                "SELECT auto_score, manual_score, status FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2",
                g["id"],
                student_id,
            )
            if a:
                completed += 1
                score = float(a["auto_score"]) + float(a["manual_score"] or 0)
                status = a["status"]
        else:
            s = await pool.fetchrow(
                "SELECT grade, status FROM homework_submissions WHERE homework_id = $1 AND student_id = $2",
                g["id"],
                student_id,
            )
            if s:
                completed += 1
                score = float(s["grade"]) if s["grade"] is not None else None
                status = s["status"]
        weight = float(g["weight_pct"])
        total_weight += weight
        if score is not None and g["max_score"]:
            final_grade += (score / float(g["max_score"])) * weight
        entries.append(
            {
                "item_id": g["id"],
                "type": g["type"],
                "title": g["title"],
                "max_score": g["max_score"],
                "weight_pct": weight,
                "score": score,
                "status": status,
                "deadline_at": str(g["deadline_at"]) if g["deadline_at"] else None,
            }
        )
    total_items = len(gradables)
    progress = round(completed / total_items * 100) if total_items else 0
    return {
        "entries": entries,
        "final_grade": round(final_grade, 2),
        "total_weight": total_weight,
        "progress": progress,
        "completed_items": completed,
        "total_items": total_items,
    }


@router.get("/my")
async def my_grades(user: dict = Depends(get_current_user)):
    """Student overview: per-course grades and progress."""
    pool = await get_pool()
    courses = await pool.fetch(
        """
        SELECT c.id, c.title, u.full_name AS teacher_name FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        JOIN users u ON u.id = c.teacher_id
        WHERE e.student_id = $1 AND e.status = 'approved'
        ORDER BY c.title
        """,
        user["id"],
    )
    out = []
    for c in courses:
        g = await compute_student_course_grade(pool, c["id"], user["id"])
        out.append(
            {
                "course_id": c["id"],
                "course_title": c["title"],
                "teacher_name": c["teacher_name"],
                "final_grade": g["final_grade"],
                "progress": g["progress"],
                "completed_items": g["completed_items"],
                "total_items": g["total_items"],
            }
        )
    return out


@router.get("/my/{course_id}")
async def my_course_grades(course_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    return await compute_student_course_grade(pool, course_id, user["id"])


@router.get("/gradebook/{course_id}")
async def gradebook(course_id: int, user: dict = Depends(require_teacher)):
    """Teacher gradebook: every approved student x every gradable item."""
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    students = await pool.fetch(
        """
        SELECT u.id, u.full_name, u.email FROM enrollments e
        JOIN users u ON u.id = e.student_id
        WHERE e.course_id = $1 AND e.status = 'approved'
        ORDER BY u.full_name
        """,
        course_id,
    )
    rows = []
    for s in students:
        g = await compute_student_course_grade(pool, course_id, s["id"])
        rows.append(
            {
                "student_id": s["id"],
                "student_name": s["full_name"],
                "student_email": s["email"],
                "final_grade": g["final_grade"],
                "progress": g["progress"],
                "entries": g["entries"],
            }
        )
    return rows
