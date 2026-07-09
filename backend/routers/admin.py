from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

from core.db import get_pool
from core.deps import require_admin
from core.security import hash_password
from routers.grades import compute_student_course_grade

router = APIRouter(prefix="/admin", tags=["admin"])


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    role: str = Field(pattern="^(student|teacher|admin)$")


class UserUpdateIn(BaseModel):
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: str | None = Field(default=None, pattern="^(student|teacher|admin)$")
    is_blocked: bool | None = None


class RoleIn(BaseModel):
    role: str = Field(pattern="^(student|teacher|admin)$")


class BlockIn(BaseModel):
    is_blocked: bool


class GroupIn(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    title: str = Field(min_length=2, max_length=120)
    direction: str = Field(min_length=2, max_length=120)
    stream: str = Field(min_length=1, max_length=20)
    capacity: int = Field(default=20, ge=1, le=40)


class GroupUpdateIn(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=20)
    title: str | None = Field(default=None, min_length=2, max_length=120)
    direction: str | None = Field(default=None, min_length=2, max_length=120)
    stream: str | None = Field(default=None, min_length=1, max_length=20)
    capacity: int | None = Field(default=None, ge=1, le=40)


class GroupStudentIn(BaseModel):
    student_id: int


class CourseGroupIn(BaseModel):
    group_id: int


def public_user(r) -> dict:
    return {
        "id": r["id"],
        "email": r["email"],
        "full_name": r["full_name"],
        "role": r["role"],
        "is_blocked": r["is_blocked"],
        "created_at": str(r["created_at"]),
    }


async def enroll_group_students(conn, course_id: int, group_id: int) -> None:
    await conn.execute(
        """
        INSERT INTO enrollments (course_id, student_id, status, decided_at)
        SELECT $1, gs.student_id, 'approved', now()
        FROM group_students gs
        JOIN users u ON u.id = gs.student_id AND u.role = 'student'
        WHERE gs.group_id = $2
        ON CONFLICT (course_id, student_id)
        DO UPDATE SET status = 'approved', decided_at = now()
        """,
        course_id,
        group_id,
    )


async def enroll_student_in_group_courses(conn, group_id: int, student_id: int) -> None:
    await conn.execute(
        """
        INSERT INTO enrollments (course_id, student_id, status, decided_at)
        SELECT cg.course_id, $2, 'approved', now()
        FROM course_groups cg
        WHERE cg.group_id = $1
        ON CONFLICT (course_id, student_id)
        DO UPDATE SET status = 'approved', decided_at = now()
        """,
        group_id,
        student_id,
    )


async def cleanup_orphan_group_enrollments(conn) -> None:
    await conn.execute(
        """
        DELETE FROM enrollments e
        WHERE e.status = 'approved'
          AND NOT EXISTS (
            SELECT 1
            FROM course_groups cg
            JOIN group_students gs ON gs.group_id = cg.group_id
            WHERE cg.course_id = e.course_id
              AND gs.student_id = e.student_id
          )
        """
    )


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str = Query("", max_length=200),
    role: str = Query("", pattern="^(|student|teacher|admin)$"),
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
    return {"items": [public_user(r) for r in rows], "total": total, "page": page, "per_page": per_page}


@router.post("/users")
async def create_user(data: UserCreateIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    existing = await pool.fetchrow("SELECT 1 FROM users WHERE email = $1", data.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")
    row = await pool.fetchrow(
        """
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, full_name, role, is_blocked, created_at
        """,
        data.email.lower(),
        hash_password(data.password),
        data.full_name.strip(),
        data.role,
    )
    return public_user(row)


@router.patch("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdateIn, user: dict = Depends(require_admin)):
    if user_id == user["id"] and (data.role is not None or data.is_blocked is True):
        raise HTTPException(status_code=422, detail="You cannot restrict your own admin account")
    pool = await get_pool()
    existing = await pool.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="User not found")
    password_hash = hash_password(data.password) if data.password else existing["password_hash"]
    try:
        row = await pool.fetchrow(
            """
            UPDATE users SET
              email = $1,
              password_hash = $2,
              full_name = $3,
              role = $4,
              is_blocked = $5
            WHERE id = $6
            RETURNING id, email, full_name, role, is_blocked, created_at
            """,
            data.email.lower() if data.email else existing["email"],
            password_hash,
            data.full_name.strip() if data.full_name else existing["full_name"],
            data.role or existing["role"],
            existing["is_blocked"] if data.is_blocked is None else data.is_blocked,
            user_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=409, detail="Email is already registered") from exc
    return public_user(row)


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=422, detail="You cannot delete your own account")
    pool = await get_pool()
    row = await pool.fetchrow("DELETE FROM users WHERE id = $1 RETURNING id", user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


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
          (SELECT COUNT(*) FROM groups) AS total_groups,
          (SELECT COUNT(*) FROM courses) AS total_courses,
          (SELECT COUNT(*) FROM enrollments WHERE status = 'approved') AS active_enrollments
        """
    )
    return dict(totals)


@router.get("/groups")
async def list_groups(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    q: str = Query("", max_length=200),
    user: dict = Depends(require_admin),
):
    pool = await get_pool()
    offset = (page - 1) * per_page
    like = f"%{q}%"
    rows = await pool.fetch(
        """
        SELECT g.*, COUNT(gs.student_id) AS student_count, COUNT(*) OVER() AS total
        FROM groups g
        LEFT JOIN group_students gs ON gs.group_id = g.id
        WHERE ($1 = '' OR g.code ILIKE $2 OR g.title ILIKE $2 OR g.direction ILIKE $2)
        GROUP BY g.id
        ORDER BY g.code
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
        items.append(d)
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/groups")
async def create_group(data: GroupIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO groups (code, title, direction, stream, capacity)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            data.code.strip().upper(),
            data.title.strip(),
            data.direction.strip(),
            data.stream.strip(),
            data.capacity,
        )
    except Exception as exc:
        raise HTTPException(status_code=409, detail="Group code already exists") from exc
    return dict(row) | {"created_at": str(row["created_at"])}


@router.patch("/groups/{group_id}")
async def update_group(group_id: int, data: GroupUpdateIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    existing = await pool.fetchrow("SELECT * FROM groups WHERE id = $1", group_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Group not found")
    try:
        row = await pool.fetchrow(
            """
            UPDATE groups SET
              code = $1,
              title = $2,
              direction = $3,
              stream = $4,
              capacity = $5
            WHERE id = $6
            RETURNING *
            """,
            data.code.strip().upper() if data.code else existing["code"],
            data.title.strip() if data.title else existing["title"],
            data.direction.strip() if data.direction else existing["direction"],
            data.stream.strip() if data.stream else existing["stream"],
            data.capacity if data.capacity is not None else existing["capacity"],
            group_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=409, detail="Group code already exists") from exc
    return dict(row) | {"created_at": str(row["created_at"])}


@router.delete("/groups/{group_id}")
async def delete_group(group_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("DELETE FROM groups WHERE id = $1 RETURNING id", group_id)
            if row is None:
                raise HTTPException(status_code=404, detail="Group not found")
            await cleanup_orphan_group_enrollments(conn)
    return {"ok": True}


@router.get("/groups/{group_id}")
async def group_detail(group_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    group = await pool.fetchrow("SELECT * FROM groups WHERE id = $1", group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    students = await pool.fetch(
        """
        SELECT u.id, u.email, u.full_name, u.is_blocked, gs.added_at
        FROM group_students gs
        JOIN users u ON u.id = gs.student_id
        WHERE gs.group_id = $1
        ORDER BY u.full_name
        """,
        group_id,
    )
    courses = await pool.fetch(
        """
        SELECT c.id, c.title, u.full_name AS teacher_name
        FROM course_groups cg
        JOIN courses c ON c.id = cg.course_id
        JOIN users u ON u.id = c.teacher_id
        WHERE cg.group_id = $1
        ORDER BY c.title
        """,
        group_id,
    )
    return {
        **dict(group),
        "created_at": str(group["created_at"]),
        "students": [dict(s) | {"added_at": str(s["added_at"])} for s in students],
        "courses": [dict(c) for c in courses],
    }


@router.get("/groups/{group_id}/student-search")
async def search_students_for_group(
    group_id: int,
    q: str = Query("", max_length=200),
    user: dict = Depends(require_admin),
):
    pool = await get_pool()
    like = f"%{q}%"
    rows = await pool.fetch(
        """
        SELECT id, email, full_name, role, is_blocked, created_at
        FROM users u
        WHERE role = 'student'
          AND ($1 = '' OR full_name ILIKE $2 OR email ILIKE $2)
          AND NOT EXISTS (
            SELECT 1 FROM group_students gs WHERE gs.group_id = $3 AND gs.student_id = u.id
          )
        ORDER BY full_name
        LIMIT 20
        """,
        q,
        like,
        group_id,
    )
    return {"items": [public_user(r) for r in rows]}


@router.post("/groups/{group_id}/students")
async def add_student_to_group(group_id: int, data: GroupStudentIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            group = await conn.fetchrow("SELECT id, capacity FROM groups WHERE id = $1", group_id)
            if group is None:
                raise HTTPException(status_code=404, detail="Group not found")
            student = await conn.fetchrow("SELECT id FROM users WHERE id = $1 AND role = 'student'", data.student_id)
            if student is None:
                raise HTTPException(status_code=404, detail="Student not found")
            count = await conn.fetchval("SELECT COUNT(*) FROM group_students WHERE group_id = $1", group_id)
            if count >= group["capacity"]:
                raise HTTPException(status_code=422, detail="Group is full")
            await conn.execute(
                """
                INSERT INTO group_students (group_id, student_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                """,
                group_id,
                data.student_id,
            )
            await enroll_student_in_group_courses(conn, group_id, data.student_id)
    return {"ok": True}


@router.delete("/groups/{group_id}/students/{student_id}")
async def remove_student_from_group(group_id: int, student_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM group_students WHERE group_id = $1 AND student_id = $2", group_id, student_id)
            await cleanup_orphan_group_enrollments(conn)
    return {"ok": True}


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
        SELECT c.id, c.title, c.description, c.is_published,
               (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'approved') AS students,
               (SELECT COUNT(*) FROM course_items ci WHERE ci.course_id = c.id) AS items
        FROM courses c WHERE c.teacher_id = $1 ORDER BY c.created_at DESC
        """,
        teacher_id,
    )
    course_items = []
    for c in courses:
        groups = await pool.fetch(
            """
            SELECT g.id, g.code, g.title, g.direction,
                   (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id = g.id) AS student_count
            FROM course_groups cg
            JOIN groups g ON g.id = cg.group_id
            WHERE cg.course_id = $1
            ORDER BY g.code
            """,
            c["id"],
        )
        course_items.append(dict(c) | {"groups": [dict(g) for g in groups]})
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
        "courses": course_items,
    }


@router.post("/courses/{course_id}/groups")
async def add_group_to_course(course_id: int, data: CourseGroupIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            course = await conn.fetchrow("SELECT id FROM courses WHERE id = $1", course_id)
            if course is None:
                raise HTTPException(status_code=404, detail="Course not found")
            group = await conn.fetchrow("SELECT id FROM groups WHERE id = $1", data.group_id)
            if group is None:
                raise HTTPException(status_code=404, detail="Group not found")
            await conn.execute(
                "INSERT INTO course_groups (course_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                course_id,
                data.group_id,
            )
            await enroll_group_students(conn, course_id, data.group_id)
    return {"ok": True}


@router.delete("/courses/{course_id}/groups/{group_id}")
async def remove_group_from_course(course_id: int, group_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM course_groups WHERE course_id = $1 AND group_id = $2", course_id, group_id)
            await cleanup_orphan_group_enrollments(conn)
    return {"ok": True}


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
    groups = await pool.fetch(
        """
        SELECT g.id, g.code, g.title
        FROM group_students gs JOIN groups g ON g.id = gs.group_id
        WHERE gs.student_id = $1
        ORDER BY g.code
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
        "groups": [dict(g) for g in groups],
        "enrolled_courses": len(courses),
        "completed_courses": completed_count,
        "average_grade": round(grade_sum / graded_courses, 2) if graded_courses else 0,
        "courses": detail,
    }
