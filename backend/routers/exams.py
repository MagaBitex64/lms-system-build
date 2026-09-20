import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional

from core.db import get_pool
from core.deps import require_admin

router = APIRouter(prefix="/admin/exams", tags=["admin-exams"])

class ExamCreateIn(BaseModel):
    title: str
    description: Optional[str] = ""
    language: Optional[str] = "kk"
    duration_minutes: Optional[int] = 240
    attempts_limit: Optional[int] = None
    result_visibility: Optional[str] = "immediate"
    starts_at: Optional[datetime.datetime] = None
    ends_at: Optional[datetime.datetime] = None
    subjects: Optional[List[dict]] = []  # [{subject_key, required_count, max_points, config}]


@router.get("")
async def list_exams(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100), user: dict = Depends(require_admin)):
    pool = await get_pool()
    offset = (page - 1) * per_page
    rows = await pool.fetch(
        "SELECT * FROM exams ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        per_page, offset
    )
    items = [dict(r) for r in rows]
    return {"items": items, "page": page, "per_page": per_page}


@router.post("")
async def create_exam(data: ExamCreateIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO exams (title, description, language, duration_minutes, attempts_limit, result_visibility, starts_at, ends_at, created_by)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
                """,
                data.title, data.description, data.language, data.duration_minutes, data.attempts_limit, data.result_visibility, data.starts_at, data.ends_at, user["id"]
            )
            exam_id = row["id"]
            # create subjects if provided
            for i, s in enumerate(data.subjects or []):
                await conn.execute(
                    "INSERT INTO exam_subjects (exam_id, subject_key, position, required_count, max_points, config) VALUES ($1,$2,$3,$4,$5,$6)",
                    exam_id, s.get("subject_key"), i, s.get("required_count", 0), s.get("max_points", 0), s.get("config", {})
                )
    return {"ok": True, "id": exam_id}


@router.get("/{exam_id}")
async def get_exam(exam_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    exam = await pool.fetchrow("SELECT * FROM exams WHERE id = $1", exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Not found")
    subjects = await pool.fetch("SELECT * FROM exam_subjects WHERE exam_id = $1 ORDER BY position", exam_id)
    questions = await pool.fetch("SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY position", exam_id)
    return {"exam": dict(exam), "subjects": [dict(s) for s in subjects], "questions": [dict(q) for q in questions]}


@router.post("/{exam_id}/validate")
async def validate_exam(exam_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    # basic validation: check subjects required_count vs actual
    subjects = await pool.fetch("SELECT * FROM exam_subjects WHERE exam_id = $1", exam_id)
    report = {"ok": True, "issues": []}
    for s in subjects:
        cnt = await pool.fetchval("SELECT COUNT(*) FROM exam_questions WHERE exam_subject_id = $1", s["id"])
        if cnt != s["required_count"]:
            report["ok"] = False
            report["issues"].append({"subject": s["subject_key"], "expected": s["required_count"], "found": cnt})
    # total questions and points
    total_q = await pool.fetchval("SELECT COUNT(*) FROM exam_questions WHERE exam_id = $1", exam_id)
    total_p = await pool.fetchval("SELECT COALESCE(SUM(points),0) FROM exam_questions WHERE exam_id = $1", exam_id)
    report["total_questions"] = total_q
    report["total_points"] = float(total_p)
    return report


@router.post("/{exam_id}/publish")
async def publish_exam(exam_id: int, user: dict = Depends(require_admin)):
    # ensure validation passes
    res = await validate_exam(exam_id, user)
    if not res.get("ok"):
        raise HTTPException(status_code=422, detail={"message": "Validation failed", "report": res})
    pool = await get_pool()
    await pool.execute("UPDATE exams SET status = 'published' WHERE id = $1", exam_id)
    return {"ok": True}


class AddQuestionsIn(BaseModel):
    bank_question_ids: List[int]


@router.post("/{exam_id}/questions")
async def add_questions_to_exam(exam_id: int, data: AddQuestionsIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    # insert questions at the end of exam
    async with pool.acquire() as conn:
        async with conn.transaction():
            for qid in data.bank_question_ids:
                pos = await conn.fetchval("SELECT COALESCE(MAX(position), -1) + 1 FROM exam_questions WHERE exam_id = $1", exam_id)
                # default points: 1 for single, 2 for multi? use 1 default, admin can adjust later
                await conn.execute(
                    "INSERT INTO exam_questions (exam_id, bank_question_id, position, points) VALUES ($1,$2,$3,$4)",
                    exam_id, qid, pos, 1
                )
    return {"ok": True}


@router.delete("/{exam_id}/questions/{exam_question_id}")
async def delete_exam_question(exam_id: int, exam_question_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    row = await pool.fetchrow("DELETE FROM exam_questions WHERE id = $1 AND exam_id = $2 RETURNING id", exam_question_id, exam_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Student endpoints: start, get attempt, submit ----------
from core.deps import require_student


@router.get("/my", tags=["exams"])
async def list_my_exams(user: dict = Depends(require_student)):
    pool = await get_pool()
    # find exams that are published and accessible (simple: published and within date)
    now = datetime.datetime.now(datetime.timezone.utc)
    rows = await pool.fetch("SELECT * FROM exams WHERE status = 'published' AND (starts_at IS NULL OR starts_at <= $1) AND (ends_at IS NULL OR ends_at >= $1)", now)
    return {"items": [dict(r) for r in rows]}


@router.post("/{exam_id}/start", tags=["exams"])
async def start_exam_attempt(exam_id: int, user: dict = Depends(require_student)):
    pool = await get_pool()
    # check exam exists and published
    exam = await pool.fetchrow("SELECT * FROM exams WHERE id = $1", exam_id)
    if not exam or exam["status"] != 'published':
        raise HTTPException(status_code=404, detail="Exam not available")

    # check existing attempt
    existing = await pool.fetchrow("SELECT id, status FROM student_attempts WHERE exam_id = $1 AND student_id = $2", exam_id, user["id"])
    if existing:
        return {"ok": True, "attempt_id": existing["id"]}

    async with pool.acquire() as conn:
        async with conn.transaction():
            attempt_id = await conn.fetchval("INSERT INTO student_attempts (exam_id, student_id) VALUES ($1,$2) RETURNING id", exam_id, user["id"])
            # create student_answers for each exam_question
            qs = await conn.fetch("SELECT id FROM exam_questions WHERE exam_id = $1 ORDER BY position", exam_id)
            for q in qs:
                await conn.execute("INSERT INTO student_answers (attempt_id, exam_question_id) VALUES ($1,$2)", attempt_id, q["id"])
    return {"ok": True, "attempt_id": attempt_id}


@router.get("/attempts/{attempt_id}", tags=["exams"])
async def get_attempt(attempt_id: int, user: dict = Depends(require_student)):
    pool = await get_pool()
    attempt = await pool.fetchrow("SELECT * FROM student_attempts WHERE id = $1 AND student_id = $2", attempt_id, user["id"])
    if not attempt:
        raise HTTPException(status_code=404, detail="Not found")

    # fetch answers and related exam_questions and bank question details
    rows = await pool.fetch(
        """
        SELECT sa.id as answer_id, sa.selected_option_ids, sa.text_answer, sa.is_correct, eq.id as exam_question_id, eq.points, eq.position,
               bq.id as bank_question_id, bq.prompt
        FROM student_answers sa
        JOIN exam_questions eq ON eq.id = sa.exam_question_id
        LEFT JOIN ent_questions bq ON bq.id = eq.bank_question_id
        WHERE sa.attempt_id = $1
        ORDER BY eq.position
        """,
        attempt_id
    )

    questions = []
    for r in rows:
        opts = []
        if r["bank_question_id"]:
            opts_rows = await pool.fetch("SELECT id, text FROM ent_options WHERE question_id = $1 ORDER BY position", r["bank_question_id"])
            opts = [dict(o) for o in opts_rows]
        questions.append({
            "answer_id": r["answer_id"],
            "exam_question_id": r["exam_question_id"],
            "bank_question_id": r["bank_question_id"],
            "prompt": r["prompt"],
            "options": opts,
            "selected_option_ids": r["selected_option_ids"],
            "text_answer": r["text_answer"],
            "points": float(r["points"])
        })

    return {
        "id": attempt["id"],
        "status": attempt["status"],
        "started_at": str(attempt["started_at"]),
        "submitted_at": str(attempt["submitted_at"]) if attempt["submitted_at"] else None,
        "questions": questions
    }


class SubmitAttemptIn(BaseModel):
    answers: List[dict]  # {exam_question_id, selected_option_ids: [..], matching: {...}, text_answer}


@router.post("/attempts/{attempt_id}/submit", tags=["exams"])
async def submit_attempt(attempt_id: int, data: SubmitAttemptIn, user: dict = Depends(require_student)):
    pool = await get_pool()
    attempt = await pool.fetchrow("SELECT * FROM student_attempts WHERE id = $1 AND student_id = $2", attempt_id, user["id"])
    if not attempt:
        raise HTTPException(status_code=404, detail="Not found")
    if attempt["status"] == 'submitted':
        raise HTTPException(status_code=400, detail="Already submitted")

    updates = {a["exam_question_id"]: a for a in data.answers}

    async with pool.acquire() as conn:
        async with conn.transaction():
            # fetch exam questions with bank info
            eqs = await conn.fetch(
                "SELECT eq.id, eq.points, eq.bank_question_id, es.subject_key, eq.exam_subject_id FROM exam_questions eq JOIN exam_subjects es ON es.id = eq.exam_subject_id WHERE eq.id = ANY($1::bigint[])",
                list(updates.keys())
            )

            # also fetch all exam_questions for scaling totals
            all_eqs = await conn.fetch("SELECT id, points, exam_subject_id FROM exam_questions WHERE exam_id = $1", attempt["exam_id"])
            total_possible = sum(float(e["points"]) for e in all_eqs)

            # track per subject raw scores and max
            subj_raw = {}
            subj_max = {}
            for e in all_eqs:
                sid = e["exam_subject_id"]
                subj_max[sid] = subj_max.get(sid, 0) + float(e["points"]) 

            raw_total = 0.0

            for eq in eqs:
                qid = eq["id"]
                bank_qid = eq["bank_question_id"]
                pts = float(eq["points"]) if eq["points"] is not None else 1.0
                submitted = updates.get(qid, {})
                selected = submitted.get("selected_option_ids") if submitted else []
                if selected is None:
                    selected = []

                # determine correct options
                correct_rows = []
                if bank_qid:
                    correct_rows = await conn.fetch("SELECT id FROM ent_options WHERE question_id = $1 AND is_correct = TRUE", bank_qid)
                correct_ids = [r["id"] for r in correct_rows]

                awarded = 0.0
                is_correct = False
                # Matching detection
                matching_pairs = await conn.fetch("SELECT COUNT(*) as cnt FROM matching_pairs WHERE question_id = $1", bank_qid) if bank_qid else []
                total_pairs = matching_pairs[0]["cnt"] if matching_pairs else 0

                if total_pairs > 0:
                    # expect submitted["matching"] as dict of left->right pair_key
                    submitted_matching = submitted.get("matching") or {}
                    correct_count = 0
                    # fetch correct pairs
                    pairs = await conn.fetch("SELECT left_text, right_text, pair_key FROM matching_pairs WHERE question_id = $1", bank_qid)
                    for p in pairs:
                        key = p["pair_key"]
                        if submitted_matching.get(p["left_text"]) == p["right_text"] or submitted_matching.get(p["left_text"]) == p["pair_key"]:
                            correct_count += 1
                    awarded = pts * (correct_count / total_pairs) if total_pairs > 0 else 0
                    is_correct = correct_count == total_pairs
                else:
                    # single vs multiple choice
                    if len(correct_ids) <= 1:
                        # single
                        if selected and selected[0] == (correct_ids[0] if correct_ids else None):
                            awarded = pts
                            is_correct = True
                    else:
                        # multiple: require exact match
                        sel_set = set(selected)
                        corr_set = set(correct_ids)
                        if sel_set == corr_set and len(sel_set) > 0:
                            awarded = pts
                            is_correct = True

                # update student_answers
                await conn.execute("UPDATE student_answers SET selected_option_ids = $1, matching = $2, text_answer = $3, awarded_points = $4, is_correct = $5 WHERE attempt_id = $6 AND exam_question_id = $7",
                                   selected, submitted.get("matching"), submitted.get("text_answer"), awarded, is_correct, attempt_id, qid)

                raw_total += awarded
                subj_raw[eq["exam_subject_id"]] = subj_raw.get(eq["exam_subject_id"], 0) + awarded

            # scale totals to 140
            scaled_total = round((raw_total / total_possible) * 140, 2) if total_possible > 0 else 0.0

            # compute per-subject scaled scores mapping exam_subject_id -> scaled
            per_subject_scaled = {}
            for sid, raw in subj_raw.items():
                max_s = subj_max.get(sid, 0)
                per_subject_scaled[str(sid)] = round((raw / max_s) * (max_s / total_possible * 140) if max_s > 0 and total_possible > 0 else 0.0, 2)

            await conn.execute("UPDATE student_attempts SET status = 'submitted', submitted_at = now(), total_score = $1, per_subject_scores = $2 WHERE id = $3",
                               scaled_total, per_subject_scaled, attempt_id)

    return {"ok": True, "total_score": scaled_total}

