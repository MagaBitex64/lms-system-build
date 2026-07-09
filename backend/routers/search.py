from fastapi import APIRouter, Depends, Query

from core.db import get_pool
from core.deps import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query(min_length=1, max_length=200),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    """Search across published courses, lessons, and materials.

    Students/guests only see published courses; lessons/materials only in
    courses the student has an approved enrollment for.
    """
    pool = await get_pool()
    like = f"%{q}%"
    offset = (page - 1) * per_page

    courses = await pool.fetch(
        """
        SELECT c.id, c.title, c.description, u.full_name AS teacher_name
        FROM courses c JOIN users u ON u.id = c.teacher_id
        WHERE c.is_published AND (c.title ILIKE $1 OR c.description ILIKE $1)
        ORDER BY c.title LIMIT $2 OFFSET $3
        """,
        like,
        per_page,
        offset,
    )

    if user["role"] == "student":
        lessons = await pool.fetch(
            """
            SELECT ci.id, ci.title, ci.course_id, c.title AS course_title
            FROM course_items ci
            JOIN courses c ON c.id = ci.course_id
            JOIN enrollments e ON e.course_id = c.id AND e.student_id = $2 AND e.status = 'approved'
            LEFT JOIN lessons l ON l.item_id = ci.id
            WHERE ci.is_visible AND (ci.title ILIKE $1 OR l.content ILIKE $1)
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
            ORDER BY ci.title LIMIT $3 OFFSET $4
            """,
            like,
            user["id"],
            per_page,
            offset,
        )
        materials = await pool.fetch(
            """
            SELECT lm.id, lm.label, lm.kind, ci.id AS lesson_id, ci.title AS lesson_title,
                   c.id AS course_id, c.title AS course_title
            FROM lesson_materials lm
            JOIN course_items ci ON ci.id = lm.lesson_id
            JOIN courses c ON c.id = ci.course_id
            JOIN enrollments e ON e.course_id = c.id AND e.student_id = $2 AND e.status = 'approved'
            WHERE ci.is_visible AND lm.label ILIKE $1
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
            ORDER BY lm.label LIMIT $3 OFFSET $4
            """,
            like,
            user["id"],
            per_page,
            offset,
        )
    elif user["role"] in ("teacher", "admin"):
        lessons = await pool.fetch(
            """
            SELECT ci.id, ci.title, ci.course_id, c.title AS course_title
            FROM course_items ci
            JOIN courses c ON c.id = ci.course_id
            LEFT JOIN lessons l ON l.item_id = ci.id
            WHERE ($2 = 'admin' OR c.teacher_id = $3)
              AND (ci.title ILIKE $1 OR l.content ILIKE $1)
            ORDER BY ci.title LIMIT $4 OFFSET $5
            """,
            like,
            user["role"],
            user["id"],
            per_page,
            offset,
        )
        materials = await pool.fetch(
            """
            SELECT lm.id, lm.label, lm.kind, ci.id AS lesson_id, ci.title AS lesson_title,
                   c.id AS course_id, c.title AS course_title
            FROM lesson_materials lm
            JOIN course_items ci ON ci.id = lm.lesson_id
            JOIN courses c ON c.id = ci.course_id
            WHERE ($2 = 'admin' OR c.teacher_id = $3) AND lm.label ILIKE $1
            ORDER BY lm.label LIMIT $4 OFFSET $5
            """,
            like,
            user["role"],
            user["id"],
            per_page,
            offset,
        )
    else:
        lessons = []
        materials = []

    return {
        "courses": [dict(r) for r in courses],
        "lessons": [dict(r) for r in lessons],
        "materials": [dict(r) for r in materials],
        "page": page,
        "per_page": per_page,
    }
