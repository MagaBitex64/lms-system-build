"""Shared permission helpers for course/content access."""

from fastapi import HTTPException

from core.db import get_pool


async def get_course_or_404(course_id: int) -> dict:
    pool = await get_pool()
    course = await pool.fetchrow("SELECT * FROM courses WHERE id = $1", course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return dict(course)


async def ensure_course_owner(user: dict, course_id: int) -> dict:
    """Teacher must own the course; admin bypasses."""
    course = await get_course_or_404(course_id)
    if user["role"] == "admin":
        return course
    if user["role"] == "teacher" and course["teacher_id"] == user["id"]:
        return course
    raise HTTPException(status_code=403, detail="You do not manage this course")


async def is_enrolled(student_id: int, course_id: int) -> bool:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = 'approved'",
        course_id,
        student_id,
    )
    return row is not None


async def ensure_course_access(user: dict, course_id: int) -> dict:
    """Read access: owner teacher, admin, or approved-enrolled student."""
    course = await get_course_or_404(course_id)
    if user["role"] == "admin":
        return course
    if user["role"] == "teacher" and course["teacher_id"] == user["id"]:
        return course
    if user["role"] == "student" and course["is_published"] and await is_enrolled(user["id"], course_id):
        return course
    raise HTTPException(status_code=403, detail="You do not have access to this course")


async def get_item_or_404(item_id: int) -> dict:
    pool = await get_pool()
    item = await pool.fetchrow("SELECT * FROM course_items WHERE id = $1", item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return dict(item)


async def ensure_item_access(user: dict, item_id: int) -> tuple[dict, dict]:
    """Returns (item, course). Students also need the item visible + unlocked."""
    item = await get_item_or_404(item_id)
    course = await ensure_course_access(user, item["course_id"])
    if user["role"] == "student":
        if not item["is_visible"]:
            raise HTTPException(status_code=403, detail="This item is not available")
        if item["sequential_unlock"] and not await is_item_unlocked(user["id"], item):
            raise HTTPException(status_code=403, detail="Complete the previous items first")
    return item, course


async def is_item_unlocked(student_id: int, item: dict) -> bool:
    """Sequential unlock: all previous visible gradable items must be completed."""
    pool = await get_pool()
    prior = await pool.fetch(
        """
        SELECT ci.id, ci.type FROM course_items ci
        WHERE ci.course_id = $1 AND ci.position < $2 AND ci.is_visible
          AND ci.type IN ('quiz','homework')
        """,
        item["course_id"],
        item["position"],
    )
    for p in prior:
        if p["type"] == "quiz":
            done = await pool.fetchrow(
                "SELECT 1 FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2", p["id"], student_id
            )
        else:
            done = await pool.fetchrow(
                "SELECT 1 FROM homework_submissions WHERE homework_id = $1 AND student_id = $2",
                p["id"],
                student_id,
            )
        if done is None:
            return False
    return True
