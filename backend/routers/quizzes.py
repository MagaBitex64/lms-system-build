import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.access import ensure_course_owner, ensure_item_access, get_item_or_404
from core.db import get_pool
from core.deps import get_current_user, require_student, require_teacher

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


class QuizSettingsIn(BaseModel):
    max_score: int = Field(ge=1, le=1000)
    weight_pct: float = Field(ge=0, le=100)
    open_at: datetime.datetime | None = None
    deadline_at: datetime.datetime | None = None
    close_at: datetime.datetime | None = None
    time_limit_minutes: int | None = Field(default=None, ge=1, le=1440)


class OptionIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    is_correct: bool = False


class QuestionIn(BaseModel):
    type: str = Field(pattern="^(single|multiple|short_text|long_text)$")
    prompt: str = Field(min_length=1, max_length=10000)
    image_file_id: int | None = None
    explanation: str = Field(default="", max_length=5000)
    points: int = Field(default=1, ge=1, le=100)
    options: list[OptionIn] = []


class AnswerIn(BaseModel):
    question_id: int
    selected_option_ids: list[int] = []
    text_answer: str = Field(default="", max_length=20000)


class SubmitAttemptIn(BaseModel):
    answers: list[AnswerIn]


class GradeAnswerIn(BaseModel):
    awarded_points: float = Field(ge=0)


# ---------- Teacher: quiz building ----------

@router.put("/{item_id}/settings")
async def update_quiz_settings(item_id: int, data: QuizSettingsIn, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE quizzes
        SET max_score = $1, weight_pct = $2, open_at = $3, deadline_at = $4,
            close_at = $5, time_limit_minutes = $6
        WHERE item_id = $7
        """,
        data.max_score,
        data.weight_pct,
        data.open_at,
        data.deadline_at,
        data.close_at,
        data.time_limit_minutes,
        item_id,
    )
    return {"ok": True}


@router.post("/{item_id}/questions")
async def add_question(item_id: int, data: QuestionIn, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    if data.type in ("single", "multiple"):
        if len(data.options) < 2:
            raise HTTPException(status_code=422, detail="Choice questions need at least 2 options")
        correct = sum(1 for o in data.options if o.is_correct)
        if data.type == "single" and correct != 1:
            raise HTTPException(status_code=422, detail="Single-choice questions need exactly 1 correct option")
        if data.type == "multiple" and correct < 1:
            raise HTTPException(status_code=422, detail="Multiple-choice questions need at least 1 correct option")
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            pos = await conn.fetchval(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM quiz_questions WHERE quiz_id = $1", item_id
            )
            q = await conn.fetchrow(
                """
                INSERT INTO quiz_questions (quiz_id, type, prompt, image_file_id, explanation, points, position)
                VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
                """,
                item_id,
                data.type,
                data.prompt,
                data.image_file_id,
                data.explanation,
                data.points,
                pos,
            )
            for i, opt in enumerate(data.options):
                await conn.execute(
                    "INSERT INTO question_options (question_id, text, is_correct, position) VALUES ($1,$2,$3,$4)",
                    q["id"],
                    opt.text,
                    opt.is_correct,
                    i,
                )
    return {"id": q["id"]}


@router.delete("/questions/{question_id}")
async def delete_question(question_id: int, user: dict = Depends(require_teacher)):
    pool = await get_pool()
    q = await pool.fetchrow("SELECT * FROM quiz_questions WHERE id = $1", question_id)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found")
    item = await get_item_or_404(q["quiz_id"])
    await ensure_course_owner(user, item["course_id"])
    await pool.execute("DELETE FROM quiz_questions WHERE id = $1", question_id)
    return {"ok": True}


# ---------- Quiz detail ----------

@router.get("/{item_id}")
async def get_quiz(item_id: int, user: dict = Depends(get_current_user)):
    item, course = await ensure_item_access(user, item_id)
    if item["type"] != "quiz":
        raise HTTPException(status_code=404, detail="Not a quiz")
    pool = await get_pool()
    quiz = await pool.fetchrow("SELECT * FROM quizzes WHERE item_id = $1", item_id)
    questions = await pool.fetch(
        "SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY position", item_id
    )
    is_owner = user["role"] == "admin" or (user["role"] == "teacher" and course["teacher_id"] == user["id"])

    attempt = None
    if user["role"] == "student":
        attempt = await pool.fetchrow(
            "SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2", item_id, user["id"]
        )

    out_questions = []
    for q in questions:
        opts = await pool.fetch(
            "SELECT id, text, is_correct, position FROM question_options WHERE question_id = $1 ORDER BY position",
            q["id"],
        )
        qd = {
            "id": q["id"],
            "type": q["type"],
            "prompt": q["prompt"],
            "image_file_id": q["image_file_id"],
            "points": q["points"],
            "options": [
                {"id": o["id"], "text": o["text"]}
                | ({"is_correct": o["is_correct"]} if is_owner or attempt else {})
                for o in opts
            ],
        }
        # Explanation only visible to owner or after submitting
        if is_owner or attempt:
            qd["explanation"] = q["explanation"]
        out_questions.append(qd)

    result = {
        "type": "quiz",
        "is_owner": is_owner,
        "item": {"id": item["id"], "title": item["title"], "note": item["note"], "course_id": item["course_id"]},
        "max_score": quiz["max_score"],
        "weight_pct": float(quiz["weight_pct"]),
        "open_at": str(quiz["open_at"]) if quiz["open_at"] else None,
        "deadline_at": str(quiz["deadline_at"]) if quiz["deadline_at"] else None,
        "close_at": str(quiz["close_at"]) if quiz["close_at"] else None,
        "time_limit_minutes": quiz["time_limit_minutes"],
        "total_points": sum(q["points"] for q in questions),
        "questions": out_questions,
        "attempt": None,
    }
    if attempt:
        answers = await pool.fetch("SELECT * FROM attempt_answers WHERE attempt_id = $1", attempt["id"])
        result["attempt"] = {
            "id": attempt["id"],
            "submitted_at": str(attempt["submitted_at"]),
            "auto_score": float(attempt["auto_score"]),
            "manual_score": float(attempt["manual_score"]) if attempt["manual_score"] is not None else None,
            "status": attempt["status"],
            "answers": [
                {
                    "question_id": a["question_id"],
                    "selected_option_ids": list(a["selected_option_ids"]),
                    "text_answer": a["text_answer"],
                    "awarded_points": float(a["awarded_points"]) if a["awarded_points"] is not None else None,
                }
                for a in answers
            ],
        }
    return result


# ---------- Student: attempt ----------

@router.post("/{item_id}/attempt")
async def submit_attempt(item_id: int, data: SubmitAttemptIn, user: dict = Depends(require_student)):
    item, _course = await ensure_item_access(user, item_id)
    if item["type"] != "quiz":
        raise HTTPException(status_code=404, detail="Not a quiz")
    pool = await get_pool()
    existing = await pool.fetchrow(
        "SELECT 1 FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2", item_id, user["id"]
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already completed this quiz")

    quiz = await pool.fetchrow("SELECT * FROM quizzes WHERE item_id = $1", item_id)
    now = datetime.datetime.now(datetime.timezone.utc)
    if quiz["open_at"] and now < quiz["open_at"]:
        raise HTTPException(status_code=403, detail="Quiz is not open yet")
    if quiz["close_at"] and now > quiz["close_at"]:
        raise HTTPException(status_code=403, detail="Quiz is closed")

    questions = await pool.fetch("SELECT * FROM quiz_questions WHERE quiz_id = $1", item_id)
    q_by_id = {q["id"]: q for q in questions}
    answers_by_q = {a.question_id: a for a in data.answers}
    total_points = sum(q["points"] for q in questions) or 1

    auto_points = 0.0
    has_manual = False
    graded_answers = []

    for q in questions:
        a = answers_by_q.get(q["id"])
        selected = a.selected_option_ids if a else []
        text = a.text_answer if a else ""
        awarded = None
        if q["type"] in ("single", "multiple"):
            correct_ids = {
                r["id"]
                for r in await pool.fetch(
                    "SELECT id FROM question_options WHERE question_id = $1 AND is_correct", q["id"]
                )
            }
            awarded = float(q["points"]) if set(selected) == correct_ids and selected else 0.0
            auto_points += awarded
        else:
            has_manual = True
        graded_answers.append((q["id"], selected, text, awarded))

    # Convert points -> score on quiz max_score scale
    auto_score = round(auto_points / total_points * quiz["max_score"], 2)
    status = "pending_review" if has_manual else "graded"

    async with pool.acquire() as conn:
        async with conn.transaction():
            attempt = await conn.fetchrow(
                """
                INSERT INTO quiz_attempts (quiz_id, student_id, auto_score, status)
                VALUES ($1, $2, $3, $4) RETURNING id
                """,
                item_id,
                user["id"],
                auto_score,
                status,
            )
            for qid, selected, text, awarded in graded_answers:
                await conn.execute(
                    """
                    INSERT INTO attempt_answers (attempt_id, question_id, selected_option_ids, text_answer, awarded_points)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    attempt["id"],
                    qid,
                    selected,
                    text,
                    awarded,
                )
    return {"attempt_id": attempt["id"], "auto_score": auto_score, "status": status}


# ---------- Teacher: review manual answers ----------

@router.get("/{item_id}/attempts")
async def list_attempts(item_id: int, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item["course_id"])
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT qa.*, u.full_name AS student_name, u.email AS student_email, q.deadline_at
        FROM quiz_attempts qa JOIN users u ON u.id = qa.student_id
        JOIN quizzes q ON q.item_id = qa.quiz_id
        WHERE qa.quiz_id = $1 ORDER BY qa.submitted_at DESC
        """,
        item_id,
    )
    return [
        {
            "id": r["id"],
            "student_id": r["student_id"],
            "student_name": r["student_name"],
            "student_email": r["student_email"],
            "submitted_at": str(r["submitted_at"]),
            "auto_score": float(r["auto_score"]),
            "manual_score": float(r["manual_score"]) if r["manual_score"] is not None else None,
            "status": r["status"],
            "late": bool(r["deadline_at"] and r["submitted_at"] > r["deadline_at"]),
        }
        for r in rows
    ]


@router.get("/attempts/{attempt_id}")
async def attempt_detail(attempt_id: int, user: dict = Depends(require_teacher)):
    pool = await get_pool()
    attempt = await pool.fetchrow(
        """
        SELECT qa.*, u.full_name AS student_name FROM quiz_attempts qa
        JOIN users u ON u.id = qa.student_id WHERE qa.id = $1
        """,
        attempt_id,
    )
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    item = await get_item_or_404(attempt["quiz_id"])
    await ensure_course_owner(user, item["course_id"])
    answers = await pool.fetch(
        """
        SELECT aa.*, qq.type, qq.prompt, qq.points AS question_points
        FROM attempt_answers aa JOIN quiz_questions qq ON qq.id = aa.question_id
        WHERE aa.attempt_id = $1 ORDER BY qq.position
        """,
        attempt_id,
    )
    return {
        "id": attempt["id"],
        "student_name": attempt["student_name"],
        "quiz_title": item["title"],
        "submitted_at": str(attempt["submitted_at"]),
        "auto_score": float(attempt["auto_score"]),
        "manual_score": float(attempt["manual_score"]) if attempt["manual_score"] is not None else None,
        "status": attempt["status"],
        "answers": [
            {
                "id": a["id"],
                "question_id": a["question_id"],
                "type": a["type"],
                "prompt": a["prompt"],
                "question_points": a["question_points"],
                "selected_option_ids": list(a["selected_option_ids"]),
                "text_answer": a["text_answer"],
                "awarded_points": float(a["awarded_points"]) if a["awarded_points"] is not None else None,
            }
            for a in answers
        ],
    }


@router.post("/answers/{answer_id}/grade")
async def grade_answer(answer_id: int, data: GradeAnswerIn, user: dict = Depends(require_teacher)):
    pool = await get_pool()
    ans = await pool.fetchrow(
        """
        SELECT aa.*, qa.quiz_id, qq.points AS max_points FROM attempt_answers aa
        JOIN quiz_attempts qa ON qa.id = aa.attempt_id
        JOIN quiz_questions qq ON qq.id = aa.question_id
        WHERE aa.id = $1
        """,
        answer_id,
    )
    if ans is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    item = await get_item_or_404(ans["quiz_id"])
    await ensure_course_owner(user, item["course_id"])
    if data.awarded_points > ans["max_points"]:
        raise HTTPException(status_code=422, detail="Awarded points exceed the question maximum")

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE attempt_answers SET awarded_points = $1 WHERE id = $2", data.awarded_points, answer_id
            )
            # Recompute manual score; mark graded when all manual answers are graded
            pending = await conn.fetchval(
                """
                SELECT COUNT(*) FROM attempt_answers aa
                JOIN quiz_questions qq ON qq.id = aa.question_id
                WHERE aa.attempt_id = $1 AND qq.type IN ('short_text','long_text') AND aa.awarded_points IS NULL
                """,
                ans["attempt_id"],
            )
            manual_points = await conn.fetchval(
                """
                SELECT COALESCE(SUM(aa.awarded_points), 0) FROM attempt_answers aa
                JOIN quiz_questions qq ON qq.id = aa.question_id
                WHERE aa.attempt_id = $1 AND qq.type IN ('short_text','long_text')
                """,
                ans["attempt_id"],
            )
            quiz = await conn.fetchrow("SELECT * FROM quizzes WHERE item_id = $1", ans["quiz_id"])
            total_points = await conn.fetchval(
                "SELECT COALESCE(SUM(points), 1) FROM quiz_questions WHERE quiz_id = $1", ans["quiz_id"]
            )
            manual_score = round(float(manual_points) / float(total_points) * quiz["max_score"], 2)
            await conn.execute(
                "UPDATE quiz_attempts SET manual_score = $1, status = $2 WHERE id = $3",
                manual_score,
                "graded" if pending == 0 else "pending_review",
                ans["attempt_id"],
            )
    return {"ok": True, "pending_manual": pending}
