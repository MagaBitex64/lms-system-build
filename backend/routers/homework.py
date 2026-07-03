import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.access import ensure_course_owner, ensure_item_access, get_item_or_404
from core.db import get_pool
from core.deps import get_current_user, require_student, require_teacher

router = APIRouter(prefix="/homework", tags=["homework"])


class HomeworkIn(BaseModel):
    description: str = Field(default="", max_length=20000)
    open_at: datetime.datetime | None = None
    deadline_at: datetime.datetime | None = None
    close_at: datetime.datetime | None = None
    max_score: int = Field(default=100, ge=1, le=1000)
    weight_pct: float = Field(default=0, ge=0, le=100)


class SubmitIn(BaseModel):
    comment: str = Field(default="", max_length=5000)
    file_ids: list[int] = []


class GradeIn(BaseModel):
    grade: float = Field(ge=0)
    feedback: str = Field(default="", max_length=5000)


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


@router.get("/{item_id}")
async def get_homework(item_id: int, user: dict = Depends(get_current_user)):
    item, course = await ensure_item_access(user, item_id)
    if item["type"] != "homework":
        raise HTTPException(status_code=404, detail="Not a homework")
    pool = await get_pool()
    hw = await pool.fetchrow("SELECT * FROM homework WHERE item_id = $1", item_id)
    result = {
        "type": "homework",
        "is_owner": user["role"] == "admin" or (user["role"] == "teacher" and course["teacher_id"] == user["id"]),
        "item": {"id": item["id"], "title": item["title"], "note": item["note"], "course_id": item["course_id"]},
        "description": hw["description"],
        "open_at": str(hw["open_at"]) if hw["open_at"] else None,
        "deadline_at": str(hw["deadline_at"]) if hw["deadline_at"] else None,
        "close_at": str(hw["close_at"]) if hw["close_at"] else None,
        "max_score": hw["max_score"],
        "weight_pct": float(hw["weight_pct"]),
        "submission": None,
    }
    if user["role"] == "student":
        sub = await pool.fetchrow(
            "SELECT * FROM homework_submissions WHERE homework_id = $1 AND student_id = $2", item_id, user["id"]
        )
        if sub:
            files = await pool.fetch(
                """
                SELECT f.id, f.original_name, f.mime, f.size FROM submission_files sf
                JOIN files f ON f.id = sf.file_id WHERE sf.submission_id = $1
                """,
                sub["id"],
            )
            result["submission"] = {
                "id": sub["id"],
                "comment": sub["comment"],
                "submitted_at": str(sub["submitted_at"]),
                "grade": float(sub["grade"]) if sub["grade"] is not None else None,
                "feedback": sub["feedback"],
                "status": sub["status"],
                "files": [dict(f) for f in files],
            }
    return result


@router.put("/{item_id}")
async def update_homework(item_id: int, data: HomeworkIn, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE homework SET description = $1, open_at = $2, deadline_at = $3, close_at = $4,
                            max_score = $5, weight_pct = $6
        WHERE item_id = $7
        """,
        data.description,
        data.open_at,
        data.deadline_at,
        data.close_at,
        data.max_score,
        data.weight_pct,
        item_id,
    )
    return {"ok": True}


@router.post("/{item_id}/submit")
async def submit_homework(item_id: int, data: SubmitIn, user: dict = Depends(require_student)):
    item, _course = await ensure_item_access(user, item_id)
    if item["type"] != "homework":
        raise HTTPException(status_code=404, detail="Not a homework")
    pool = await get_pool()
    hw = await pool.fetchrow("SELECT * FROM homework WHERE item_id = $1", item_id)
    now = _now()
    if hw["open_at"] and now < hw["open_at"]:
        raise HTTPException(status_code=403, detail="Homework is not open yet")
    if hw["close_at"] and now > hw["close_at"]:
        raise HTTPException(status_code=403, detail="Homework is closed for submissions")

    # Verify uploaded files belong to the student
    for fid in data.file_ids:
        f = await pool.fetchrow("SELECT owner_id FROM files WHERE id = $1", fid)
        if f is None or f["owner_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Invalid file attached")

    async with pool.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchrow(
                "SELECT id FROM homework_submissions WHERE homework_id = $1 AND student_id = $2",
                item_id,
                user["id"],
            )
            if existing:
                sub_id = existing["id"]
                await conn.execute(
                    """
                    UPDATE homework_submissions SET comment = $1, submitted_at = now(), status = 'submitted'
                    WHERE id = $2
                    """,
                    data.comment,
                    sub_id,
                )
                await conn.execute("DELETE FROM submission_files WHERE submission_id = $1", sub_id)
            else:
                row = await conn.fetchrow(
                    """
                    INSERT INTO homework_submissions (homework_id, student_id, comment)
                    VALUES ($1, $2, $3) RETURNING id
                    """,
                    item_id,
                    user["id"],
                    data.comment,
                )
                sub_id = row["id"]
            for fid in data.file_ids:
                await conn.execute(
                    "INSERT INTO submission_files (submission_id, file_id) VALUES ($1, $2)", sub_id, fid
                )
    late = bool(hw["deadline_at"] and now > hw["deadline_at"])
    return {"submission_id": sub_id, "late": late}


@router.get("/{item_id}/submissions")
async def list_submissions(item_id: int, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT hs.*, u.full_name AS student_name, u.email AS student_email
        FROM homework_submissions hs JOIN users u ON u.id = hs.student_id
        WHERE hs.homework_id = $1 ORDER BY hs.submitted_at DESC
        """,
        item_id,
    )
    hw = await pool.fetchrow("SELECT deadline_at, max_score FROM homework WHERE item_id = $1", item_id)
    out = []
    for r in rows:
        files = await pool.fetch(
            """
            SELECT f.id, f.original_name, f.mime, f.size FROM submission_files sf
            JOIN files f ON f.id = sf.file_id WHERE sf.submission_id = $1
            """,
            r["id"],
        )
        out.append(
            {
                "id": r["id"],
                "student_id": r["student_id"],
                "student_name": r["student_name"],
                "student_email": r["student_email"],
                "comment": r["comment"],
                "submitted_at": str(r["submitted_at"]),
                "grade": float(r["grade"]) if r["grade"] is not None else None,
                "feedback": r["feedback"],
                "status": r["status"],
                "late": bool(hw["deadline_at"] and r["submitted_at"] > hw["deadline_at"]),
                "files": [dict(f) for f in files],
            }
        )
    return {"submissions": out, "max_score": hw["max_score"]}


@router.post("/submissions/{submission_id}/grade")
async def grade_submission(submission_id: int, data: GradeIn, user: dict = Depends(require_teacher)):
    pool = await get_pool()
    sub = await pool.fetchrow("SELECT * FROM homework_submissions WHERE id = $1", submission_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    item = await get_item_or_404(sub["homework_id"])
    await ensure_course_owner(user, item["course_id"])
    hw = await pool.fetchrow("SELECT max_score FROM homework WHERE item_id = $1", sub["homework_id"])
    if data.grade > hw["max_score"]:
        raise HTTPException(status_code=422, detail="Grade exceeds the homework maximum score")
    await pool.execute(
        "UPDATE homework_submissions SET grade = $1, feedback = $2, status = 'graded' WHERE id = $3",
        data.grade,
        data.feedback,
        submission_id,
    )
    return {"ok": True}
