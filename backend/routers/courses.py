from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.access import (
    ensure_course_access,
    ensure_course_owner,
    ensure_item_access,
    get_item_or_404,
    is_enrolled,
    is_item_unlocked,
)
from core.db import get_pool
from core.deps import get_current_user, require_teacher

router = APIRouter(prefix="/courses", tags=["courses"])


class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    announcement: str = Field(default="", max_length=5000)
    is_published: bool = False


class ItemIn(BaseModel):
    type: str = Field(pattern="^(lesson|quiz|homework)$")
    title: str = Field(min_length=1, max_length=200)
    is_visible: bool = True
    sequential_unlock: bool = False
    note: str = Field(default="", max_length=5000)


class ItemUpdate(BaseModel):
    title: str | None = None
    is_visible: bool | None = None
    sequential_unlock: bool | None = None
    note: str | None = None


class ReorderIn(BaseModel):
    item_ids: list[int]


class LessonIn(BaseModel):
    content: str = Field(default="", max_length=50000)
    youtube_url: str = Field(default="", max_length=500)


class MaterialIn(BaseModel):
    kind: str = Field(pattern="^(file|link)$")
    file_id: int | None = None
    url: str = Field(default="", max_length=1000)
    label: str = Field(default="", max_length=200)


# ---------- Catalog ----------

@router.get("")
async def list_catalog(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    q: str = Query("", max_length=200),
    user: dict = Depends(get_current_user),
):
    """Published course catalog with search + pagination. All roles."""
    pool = await get_pool()
    offset = (page - 1) * per_page
    like = f"%{q}%"
    rows = await pool.fetch(
        """
        SELECT c.id, c.title, c.description, c.is_published, c.created_at,
               u.full_name AS teacher_name,
               (SELECT COUNT(*) FROM course_items ci WHERE ci.course_id = c.id AND ci.is_visible) AS item_count,
               (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'approved') AS student_count,
               COUNT(*) OVER() AS total
        FROM courses c JOIN users u ON u.id = c.teacher_id
        WHERE c.is_published AND ($1 = '' OR c.title ILIKE $2 OR c.description ILIKE $2)
        ORDER BY c.created_at DESC
        LIMIT $3 OFFSET $4
        """,
        q,
        like,
        per_page,
        offset,
    )
    total = rows[0]["total"] if rows else 0
    items = []
    for r in rows:
        d = dict(r)
        d.pop("total")
        d["created_at"] = str(d["created_at"])
        if user["role"] == "student":
            e = await pool.fetchrow(
                "SELECT status FROM enrollments WHERE course_id = $1 AND student_id = $2", r["id"], user["id"]
            )
            d["enrollment_status"] = e["status"] if e else None
        items.append(d)
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/mine")
async def my_courses(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    if user["role"] == "teacher" or user["role"] == "admin":
        rows = await pool.fetch(
            """
            SELECT c.*, u.full_name AS teacher_name,
                   (SELECT COUNT(*) FROM course_items ci WHERE ci.course_id = c.id) AS item_count,
                   (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'approved') AS student_count,
                   (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'pending') AS pending_count
            FROM courses c JOIN users u ON u.id = c.teacher_id
            WHERE ($1 = 'admin' OR c.teacher_id = $2)
            ORDER BY c.created_at DESC
            """,
            user["role"],
            user["id"],
        )
        return [dict(r) | {"created_at": str(r["created_at"])} for r in rows]
    if user["role"] == "student":
        rows = await pool.fetch(
            """
            SELECT c.id, c.title, c.description, c.is_published, c.created_at, u.full_name AS teacher_name,
                   e.status AS enrollment_status
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
            JOIN users u ON u.id = c.teacher_id
            WHERE e.student_id = $1 AND e.status IN ('approved','pending')
            ORDER BY e.requested_at DESC
            """,
            user["id"],
        )
        return [dict(r) | {"created_at": str(r["created_at"])} for r in rows]
    return []


# ---------- Course CRUD (teacher) ----------

@router.post("")
async def create_course(data: CourseIn, user: dict = Depends(require_teacher)):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO courses (teacher_id, title, description, announcement, is_published)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
        """,
        user["id"],
        data.title.strip(),
        data.description,
        data.announcement,
        data.is_published,
    )
    return dict(row) | {"created_at": str(row["created_at"])}


@router.put("/{course_id}")
async def update_course(course_id: int, data: CourseIn, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE courses SET title = $1, description = $2, announcement = $3, is_published = $4
        WHERE id = $5 RETURNING *
        """,
        data.title.strip(),
        data.description,
        data.announcement,
        data.is_published,
        course_id,
    )
    return dict(row) | {"created_at": str(row["created_at"])}


@router.delete("/{course_id}")
async def delete_course(course_id: int, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    await pool.execute("DELETE FROM courses WHERE id = $1", course_id)
    return {"ok": True}


# ---------- Course detail ----------

@router.get("/{course_id}")
async def course_detail(course_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    course = await pool.fetchrow(
        """
        SELECT c.*, u.full_name AS teacher_name FROM courses c
        JOIN users u ON u.id = c.teacher_id WHERE c.id = $1
        """,
        course_id,
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    is_owner = user["role"] == "admin" or (user["role"] == "teacher" and course["teacher_id"] == user["id"])
    enrolled = user["role"] == "student" and await is_enrolled(user["id"], course_id)

    # Guests / non-enrolled students see only the public summary
    if not is_owner and not enrolled:
        if not course["is_published"]:
            raise HTTPException(status_code=404, detail="Course not found")
        e = None
        if user["role"] == "student":
            e = await pool.fetchrow(
                "SELECT status FROM enrollments WHERE course_id = $1 AND student_id = $2", course_id, user["id"]
            )
        return {
            "id": course["id"],
            "title": course["title"],
            "description": course["description"],
            "teacher_name": course["teacher_name"],
            "is_published": course["is_published"],
            "enrollment_status": e["status"] if e else None,
            "items": None,
        }

    items_rows = await pool.fetch(
        """
        SELECT ci.*, q.max_score AS quiz_max_score, q.weight_pct AS quiz_weight,
               h.deadline_at, h.open_at, h.close_at, h.max_score AS hw_max_score, h.weight_pct AS hw_weight
        FROM course_items ci
        LEFT JOIN quizzes q ON q.item_id = ci.id
        LEFT JOIN homework h ON h.item_id = ci.id
        WHERE ci.course_id = $1
        ORDER BY ci.position
        """,
        course_id,
    )
    items = []
    for r in items_rows:
        if user["role"] == "student" and not r["is_visible"]:
            continue
        d = {
            "id": r["id"],
            "type": r["type"],
            "title": r["title"],
            "position": r["position"],
            "is_visible": r["is_visible"],
            "sequential_unlock": r["sequential_unlock"],
            "note": r["note"],
            "deadline_at": str(r["deadline_at"]) if r["deadline_at"] else None,
            "weight_pct": float(r["quiz_weight"] or r["hw_weight"] or 0),
            "max_score": r["quiz_max_score"] or r["hw_max_score"],
        }
        if user["role"] == "student":
            d["locked"] = r["sequential_unlock"] and not await is_item_unlocked(user["id"], dict(r))
            if r["type"] == "quiz":
                a = await pool.fetchrow(
                    "SELECT auto_score, manual_score, status FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2",
                    r["id"],
                    user["id"],
                )
                d["completed"] = a is not None
                d["score"] = float(a["auto_score"] + (a["manual_score"] or 0)) if a else None
            elif r["type"] == "homework":
                s = await pool.fetchrow(
                    "SELECT grade, status FROM homework_submissions WHERE homework_id = $1 AND student_id = $2",
                    r["id"],
                    user["id"],
                )
                d["completed"] = s is not None
                d["score"] = float(s["grade"]) if s and s["grade"] is not None else None
        items.append(d)

    return {
        "id": course["id"],
        "title": course["title"],
        "description": course["description"],
        "announcement": course["announcement"],
        "teacher_id": course["teacher_id"],
        "teacher_name": course["teacher_name"],
        "is_published": course["is_published"],
        "is_owner": is_owner,
        "enrollment_status": "approved" if enrolled else None,
        "items": items,
    }


# ---------- Items ----------

@router.post("/{course_id}/items")
async def create_item(course_id: int, data: ItemIn, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            pos = await conn.fetchval(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM course_items WHERE course_id = $1", course_id
            )
            item = await conn.fetchrow(
                """
                INSERT INTO course_items (course_id, type, title, position, is_visible, sequential_unlock, note)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
                """,
                course_id,
                data.type,
                data.title.strip(),
                pos,
                data.is_visible,
                data.sequential_unlock,
                data.note,
            )
            if data.type == "lesson":
                await conn.execute("INSERT INTO lessons (item_id) VALUES ($1)", item["id"])
            elif data.type == "quiz":
                await conn.execute("INSERT INTO quizzes (item_id) VALUES ($1)", item["id"])
            elif data.type == "homework":
                await conn.execute("INSERT INTO homework (item_id) VALUES ($1)", item["id"])
    return dict(item) | {"created_at": str(item["created_at"])}


@router.patch("/items/{item_id}")
async def update_item(item_id: int, data: ItemUpdate, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE course_items SET
            title = COALESCE($1, title),
            is_visible = COALESCE($2, is_visible),
            sequential_unlock = COALESCE($3, sequential_unlock),
            note = COALESCE($4, note)
        WHERE id = $5 RETURNING *
        """,
        data.title,
        data.is_visible,
        data.sequential_unlock,
        data.note,
        item_id,
    )
    return dict(row) | {"created_at": str(row["created_at"])}


@router.delete("/items/{item_id}")
async def delete_item(item_id: int, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    pool = await get_pool()
    await pool.execute("DELETE FROM course_items WHERE id = $1", item_id)
    return {"ok": True}


@router.post("/{course_id}/items/reorder")
async def reorder_items(course_id: int, data: ReorderIn, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for pos, item_id in enumerate(data.item_ids):
                await conn.execute(
                    "UPDATE course_items SET position = $1 WHERE id = $2 AND course_id = $3",
                    pos,
                    item_id,
                    course_id,
                )
    return {"ok": True}


# ---------- Lessons ----------

@router.get("/lessons/{item_id}")
async def get_lesson(item_id: int, user: dict = Depends(get_current_user)):
    item, _course = await ensure_item_access(user, item_id)
    if item["type"] != "lesson":
        raise HTTPException(status_code=404, detail="Not a lesson")
    pool = await get_pool()
    lesson = await pool.fetchrow("SELECT * FROM lessons WHERE item_id = $1", item_id)
    materials = await pool.fetch(
        """
        SELECT lm.id, lm.kind, lm.url, lm.label, lm.file_id, f.original_name, f.mime, f.size
        FROM lesson_materials lm LEFT JOIN files f ON f.id = lm.file_id
        WHERE lm.lesson_id = $1 ORDER BY lm.id
        """,
        item_id,
    )
    return {
        "item": {"id": item["id"], "title": item["title"], "note": item["note"], "course_id": item["course_id"]},
        "content": lesson["content"],
        "youtube_url": lesson["youtube_url"],
        "materials": [dict(m) for m in materials],
    }


@router.put("/lessons/{item_id}")
async def update_lesson(item_id: int, data: LessonIn, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    pool = await get_pool()
    await pool.execute(
        "UPDATE lessons SET content = $1, youtube_url = $2 WHERE item_id = $3",
        data.content,
        data.youtube_url.strip(),
        item_id,
    )
    return {"ok": True}


@router.post("/lessons/{item_id}/materials")
async def add_material(item_id: int, data: MaterialIn, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    if data.kind == "file" and not data.file_id:
        raise HTTPException(status_code=422, detail="file_id required for file materials")
    if data.kind == "link" and not data.url:
        raise HTTPException(status_code=422, detail="url required for link materials")
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO lesson_materials (lesson_id, kind, file_id, url, label) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        item_id,
        data.kind,
        data.file_id,
        data.url.strip(),
        data.label.strip(),
    )
    return {"id": row["id"]}


@router.delete("/materials/{material_id}")
async def delete_material(material_id: int, user: dict = Depends(require_teacher)):
    pool = await get_pool()
    mat = await pool.fetchrow("SELECT * FROM lesson_materials WHERE id = $1", material_id)
    if mat is None:
        raise HTTPException(status_code=404, detail="Material not found")
    item = await get_item_or_404(mat["lesson_id"])
    await ensure_course_owner(user, item["course_id"])
    await pool.execute("DELETE FROM lesson_materials WHERE id = $1", material_id)
    return {"ok": True}
