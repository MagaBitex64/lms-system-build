from fastapi import APIRouter, Depends

from core.access import ensure_course_owner
from core.db import get_pool
from core.deps import get_current_user, require_teacher

router = APIRouter(prefix="/grades", tags=["grades"])


async def compute_student_course_grades(pool, course_ids: list[int], student_ids: list[int]) -> dict[tuple[int, int], dict]:
    gradables = await pool.fetch(
        """
        SELECT ci.id, ci.course_id, students.student_id, ci.type, ci.title,
               COALESCE(q.max_score, h.max_score) AS max_score,
               COALESCE(q.weight_pct, h.weight_pct) AS weight_pct,
               h.deadline_at
        FROM course_items ci
        CROSS JOIN unnest($2::bigint[]) AS students(student_id)
        LEFT JOIN quizzes q ON q.item_id = ci.id
        LEFT JOIN homework h ON h.item_id = ci.id
                WHERE ci.course_id = ANY($1::bigint[])
                    AND (ci.type IN ('quiz','homework') OR q.item_id IS NOT NULL) AND ci.is_visible
          AND (
            EXISTS (
              SELECT 1 FROM item_student_access isa
              WHERE isa.item_id = ci.id AND isa.student_id = students.student_id
            )
            OR EXISTS (
              SELECT 1
              FROM item_group_access iga
              JOIN group_students gs ON gs.group_id = iga.group_id AND gs.student_id = students.student_id
              JOIN course_groups cg ON cg.group_id = iga.group_id AND cg.course_id = ci.course_id
              WHERE iga.item_id = ci.id
            )
          )
        ORDER BY students.student_id, ci.course_id, ci.position
        """,
        course_ids,
        student_ids,
    )
    quiz_ids = [g["id"] for g in gradables if g["max_score"] is not None and g["type"] != "homework"]
    homework_ids = [g["id"] for g in gradables if g["max_score"] is None or g["type"] == "homework"]
    quiz_attempts = await pool.fetch(
        """
        SELECT student_id, quiz_id, auto_score, manual_score, status
        FROM quiz_attempts
        WHERE quiz_id = ANY($1::bigint[]) AND student_id = ANY($2::bigint[])
        """,
        quiz_ids,
        student_ids,
    ) if quiz_ids else []
    homework_submissions = await pool.fetch(
        """
        SELECT student_id, homework_id, grade, status
        FROM homework_submissions
        WHERE homework_id = ANY($1::bigint[]) AND student_id = ANY($2::bigint[])
        """,
        homework_ids,
        student_id,
    ) if homework_ids else []
    attempts_by_item = {(attempt["student_id"], attempt["quiz_id"]): attempt for attempt in quiz_attempts}
    submissions_by_item = {(submission["student_id"], submission["homework_id"]): submission for submission in homework_submissions}
    results: dict[tuple[int, int], dict] = {}
    for student_id in student_ids:
        for course_id in course_ids:
            results[(student_id, course_id)] = {
            "entries": [],
            "final_grade": 0.0,
            "total_weight": 0.0,
            "completed_items": 0,
            "total_items": 0,
        }
    for g in gradables:
        score = None
        status = "not_started"
        completed_item = False
        result = results[(g["student_id"], g["course_id"])]
        if g["max_score"] is not None and g["type"] != "homework":
            a = attempts_by_item.get((g["student_id"], g["id"]))
            if a:
                completed_item = True
                score = float(a["auto_score"]) + float(a["manual_score"] or 0)
                status = a["status"]
        else:
            s = submissions_by_item.get((g["student_id"], g["id"]))
            if s:
                completed_item = True
                score = float(s["grade"]) if s["grade"] is not None else None
                status = s["status"]
        weight = float(g["weight_pct"])
        result["total_items"] += 1
        result["total_weight"] += weight
        if completed_item:
            result["completed_items"] += 1
        if score is not None and g["max_score"]:
            result["final_grade"] += (score / float(g["max_score"])) * weight
        result["entries"].append(
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
    for result in results.values():
        result["final_grade"] = round(result["final_grade"], 2)
        result["progress"] = round(result["completed_items"] / result["total_items"] * 100) if result["total_items"] else 0
    return results


async def compute_student_course_grade(pool, course_id: int, student_id: int) -> dict:
    return (await compute_student_course_grades(pool, [course_id], [student_id])).get(
        (student_id, course_id),
        {"entries": [], "final_grade": 0.0, "total_weight": 0.0, "progress": 0,
         "completed_items": 0, "total_items": 0},
    )


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
    grades = await compute_student_course_grades(pool, [c["id"] for c in courses], [user["id"]])
    out = []
    for c in courses:
        g = grades[(user["id"], c["id"])]
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
    grades = await compute_student_course_grades(pool, [course_id], [s["id"] for s in students])
    rows = []
    for s in students:
        g = grades[(s["id"], course_id)]
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
