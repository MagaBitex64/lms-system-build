import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.db import get_pool
from core.deps import get_current_user, require_admin, require_student

router = APIRouter(prefix="/ent-trial", tags=["ent-trial"])

COMBINATIONS = {
    'infmat':  ['informatics', 'mathematics'],
    'phymat':  ['physics',     'mathematics'],
    'biochem': ['biology',     'chemistry'],
    'chemphi': ['chemistry',   'physics'],
    'matgeo':  ['mathematics', 'geography'],
}

MANDATORY_QUOTA = {
    'kaz_history': 20,
    'reading': 10,
    'math_literacy': 10,
}

PROFILE_QUOTA = 50

class OptionIn(BaseModel):
    text: str = Field(..., max_length=1000)
    is_correct: bool = False

class QuestionIn(BaseModel):
    subject: str = Field(..., max_length=50)
    prompt: str = Field(..., max_length=10000)
    explanation: str = Field(default="", max_length=5000)
    options: list[OptionIn] = []

class AccessIn(BaseModel):
    combination: str = Field(pattern="^(infmat|phymat|biochem|chemphi|matgeo)$")
    target_type: str = Field(pattern="^(all|group|student)$")
    group_id: int | None = None
    student_id: int | None = None
    expires_at: datetime.datetime | None = None

class SubmitEntIn(BaseModel):
    answers: list[dict] # {"question_id": 1, "selected_option_id": 2}


# ---------- ADMIN ENDPOINTS ----------

@router.get("/admin/subjects")
async def get_subjects_stats(user: dict = Depends(require_admin)):
    pool = await get_pool()
    rows = await pool.fetch("SELECT subject, COUNT(*) as count FROM ent_questions GROUP BY subject")
    return {r["subject"]: r["count"] for r in rows}

@router.get("/admin/questions")
async def get_questions(
    subject: str = Query(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: dict = Depends(require_admin)
):
    pool = await get_pool()
    offset = (page - 1) * per_page
    rows = await pool.fetch(
        """
        SELECT q.*, COUNT(*) OVER() AS total
        FROM ent_questions q
        WHERE q.subject = $1
        ORDER BY q.created_at DESC
        LIMIT $2 OFFSET $3
        """,
        subject, per_page, offset
    )
    total = rows[0]["total"] if rows else 0
    questions = []
    for r in rows:
        d = dict(r)
        d.pop("total")
        d["created_at"] = str(d["created_at"])
        opts = await pool.fetch(
            "SELECT id, text, is_correct FROM ent_options WHERE question_id = $1 ORDER BY position",
            r["id"]
        )
        d["options"] = [dict(o) for o in opts]
        questions.append(d)
    return {"items": questions, "total": total, "page": page, "per_page": per_page}

@router.post("/admin/questions")
async def add_question(data: QuestionIn, user: dict = Depends(require_admin)):
    if len(data.options) < 2:
        raise HTTPException(status_code=422, detail="Needs at least 2 options")
    if sum(1 for o in data.options if o.is_correct) != 1:
        raise HTTPException(status_code=422, detail="Needs exactly 1 correct option")
        
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            pos = await conn.fetchval(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM ent_questions WHERE subject = $1", 
                data.subject
            )
            q_id = await conn.fetchval(
                """
                INSERT INTO ent_questions (subject, prompt, explanation, position)
                VALUES ($1, $2, $3, $4) RETURNING id
                """,
                data.subject, data.prompt, data.explanation, pos
            )
            for i, opt in enumerate(data.options):
                await conn.execute(
                    """
                    INSERT INTO ent_options (question_id, text, is_correct, position)
                    VALUES ($1, $2, $3, $4)
                    """,
                    q_id, opt.text, opt.is_correct, i
                )
    return {"ok": True, "id": q_id}

@router.delete("/admin/questions/{question_id}")
async def delete_question(question_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    row = await pool.fetchrow("DELETE FROM ent_questions WHERE id = $1 RETURNING id", question_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@router.get("/admin/accesses")
async def get_accesses(user: dict = Depends(require_admin)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT a.*, 
               u.full_name as student_name, 
               g.title as group_title, g.code as group_code
        FROM ent_trial_accesses a
        LEFT JOIN users u ON u.id = a.student_id
        LEFT JOIN groups g ON g.id = a.group_id
        ORDER BY a.created_at DESC
        """
    )
    items = []
    for r in rows:
        d = dict(r)
        d["created_at"] = str(d["created_at"])
        d["expires_at"] = str(d["expires_at"]) if d["expires_at"] else None
        items.append(d)
    return {"items": items}

@router.post("/admin/accesses")
async def grant_access(data: AccessIn, user: dict = Depends(require_admin)):
    if data.target_type == "group" and not data.group_id:
        raise HTTPException(status_code=422, detail="group_id is required")
    if data.target_type == "student" and not data.student_id:
        raise HTTPException(status_code=422, detail="student_id is required")
        
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO ent_trial_accesses (granted_by_id, combination, target_type, group_id, student_id, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        """,
        user["id"], data.combination, data.target_type, data.group_id, data.student_id, data.expires_at
    )
    return {"ok": True, "id": row["id"]}

@router.delete("/admin/accesses/{access_id}")
async def revoke_access(access_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    row = await pool.fetchrow("DELETE FROM ent_trial_accesses WHERE id = $1 RETURNING id", access_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@router.get("/admin/accesses/{access_id}/results")
async def get_access_results(access_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT r.*, u.full_name, u.email
        FROM ent_trial_attempts r
        JOIN users u ON u.id = r.student_id
        WHERE r.access_id = $1
        ORDER BY r.total_score DESC
        """,
        access_id
    )
    items = []
    for r in rows:
        d = dict(r)
        d["started_at"] = str(d["started_at"])
        d["submitted_at"] = str(d["submitted_at"]) if d["submitted_at"] else None
        d["kaz_history_score"] = float(d["kaz_history_score"])
        d["reading_score"] = float(d["reading_score"])
        d["math_score"] = float(d["math_score"])
        d["subject1_score"] = float(d["subject1_score"])
        d["subject2_score"] = float(d["subject2_score"])
        d["total_score"] = float(d["total_score"])
        items.append(d)
    return {"items": items}


# ---------- STUDENT ENDPOINTS ----------

@router.get("/my-accesses")
async def get_my_accesses(user: dict = Depends(require_student)):
    pool = await get_pool()
    # Find all accesses: target='all' OR target='group' for student's groups OR target='student' for this student
    rows = await pool.fetch(
        """
        SELECT a.*,
               (SELECT id FROM ent_trial_attempts WHERE access_id = a.id AND student_id = $1 LIMIT 1) as attempt_id,
               (SELECT status FROM ent_trial_attempts WHERE access_id = a.id AND student_id = $1 LIMIT 1) as attempt_status,
               (SELECT total_score FROM ent_trial_attempts WHERE access_id = a.id AND student_id = $1 LIMIT 1) as attempt_score
        FROM ent_trial_accesses a
        WHERE a.target_type = 'all'
           OR (a.target_type = 'student' AND a.student_id = $1)
           OR (a.target_type = 'group' AND a.group_id IN (SELECT group_id FROM group_students WHERE student_id = $1))
        ORDER BY a.created_at DESC
        """,
        user["id"]
    )
    items = []
    for r in rows:
        d = dict(r)
        d["created_at"] = str(d["created_at"])
        d["expires_at"] = str(d["expires_at"]) if d["expires_at"] else None
        d["attempt_score"] = float(d["attempt_score"]) if d["attempt_score"] is not None else None
        items.append(d)
    return {"items": items}

@router.post("/accesses/{access_id}/start")
async def start_ent_test(access_id: int, user: dict = Depends(require_student)):
    pool = await get_pool()
    # 1. Check access
    access = await pool.fetchrow("SELECT * FROM ent_trial_accesses WHERE id = $1", access_id)
    if not access:
        raise HTTPException(status_code=404, detail="Access not found")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    if access["expires_at"] and access["expires_at"] < now:
        raise HTTPException(status_code=403, detail="Access expired")
        
    valid = False
    if access["target_type"] == "all": valid = True
    elif access["target_type"] == "student" and access["student_id"] == user["id"]: valid = True
    elif access["target_type"] == "group":
        in_group = await pool.fetchrow("SELECT 1 FROM group_students WHERE group_id = $1 AND student_id = $2", access["group_id"], user["id"])
        if in_group: valid = True
        
    if not valid:
        raise HTTPException(status_code=403, detail="Not authorized for this test")
        
    # 2. Check existing attempt
    existing = await pool.fetchrow("SELECT id, status FROM ent_trial_attempts WHERE access_id = $1 AND student_id = $2", access_id, user["id"])
    if existing:
        return {"ok": True, "attempt_id": existing["id"]}
        
    # 3. Create attempt and answers (randomly sampled)
    combo = access["combination"]
    subjects = [
        ('kaz_history', MANDATORY_QUOTA['kaz_history']),
        ('reading', MANDATORY_QUOTA['reading']),
        ('math_literacy', MANDATORY_QUOTA['math_literacy']),
        (COMBINATIONS[combo][0], PROFILE_QUOTA),
        (COMBINATIONS[combo][1], PROFILE_QUOTA),
    ]
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            attempt_id = await conn.fetchval(
                """
                INSERT INTO ent_trial_attempts (access_id, student_id, combination)
                VALUES ($1, $2, $3) RETURNING id
                """,
                access_id, user["id"], combo
            )
            
            for subj, limit in subjects:
                # Select random questions
                qs = await conn.fetch(
                    "SELECT id FROM ent_questions WHERE subject = $1 ORDER BY RANDOM() LIMIT $2",
                    subj, limit
                )
                for q in qs:
                    await conn.execute(
                        "INSERT INTO ent_trial_answers (attempt_id, question_id) VALUES ($1, $2)",
                        attempt_id, q["id"]
                    )
                    
    return {"ok": True, "attempt_id": attempt_id}

@router.get("/attempts/{attempt_id}")
async def get_attempt(attempt_id: int, user: dict = Depends(require_student)):
    pool = await get_pool()
    attempt = await pool.fetchrow("SELECT * FROM ent_trial_attempts WHERE id = $1 AND student_id = $2", attempt_id, user["id"])
    if not attempt:
        raise HTTPException(status_code=404, detail="Not found")
        
    # Fetch questions and options
    rows = await pool.fetch(
        """
        SELECT a.id as answer_id, a.selected_option_id, a.is_correct,
               q.id as question_id, q.subject, q.prompt, q.explanation
        FROM ent_trial_answers a
        JOIN ent_questions q ON q.id = a.question_id
        WHERE a.attempt_id = $1
        """,
        attempt_id
    )
    
    questions = []
    for r in rows:
        d = dict(r)
        opts = await pool.fetch(
            "SELECT id, text, is_correct FROM ent_options WHERE question_id = $1 ORDER BY position",
            r["question_id"]
        )
        options = []
        for o in opts:
            od = dict(o)
            if attempt["status"] != "submitted":
                od.pop("is_correct")
            options.append(od)
            
        qd = {
            "answer_id": d["answer_id"],
            "question_id": d["question_id"],
            "subject": d["subject"],
            "prompt": d["prompt"],
            "options": options,
            "selected_option_id": d["selected_option_id"],
        }
        if attempt["status"] == "submitted":
            qd["is_correct"] = d["is_correct"]
            qd["explanation"] = d["explanation"]
        questions.append(qd)
        
    # Group by subject
    grouped = {}
    for q in questions:
        grouped.setdefault(q["subject"], []).append(q)
        
    return {
        "id": attempt["id"],
        "status": attempt["status"],
        "combination": attempt["combination"],
        "started_at": str(attempt["started_at"]),
        "submitted_at": str(attempt["submitted_at"]) if attempt["submitted_at"] else None,
        "scores": {
            "kaz_history": float(attempt["kaz_history_score"]),
            "reading": float(attempt["reading_score"]),
            "math_literacy": float(attempt["math_score"]),
            "subject1": float(attempt["subject1_score"]),
            "subject2": float(attempt["subject2_score"]),
            "total": float(attempt["total_score"]),
        },
        "questions": grouped
    }

@router.post("/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: int, data: SubmitEntIn, user: dict = Depends(require_student)):
    pool = await get_pool()
    attempt = await pool.fetchrow("SELECT * FROM ent_trial_attempts WHERE id = $1 AND student_id = $2", attempt_id, user["id"])
    if not attempt:
        raise HTTPException(status_code=404, detail="Not found")
    if attempt["status"] == "submitted":
        raise HTTPException(status_code=400, detail="Already submitted")
        
    combo = attempt["combination"]
    subj1 = COMBINATIONS[combo][0]
    subj2 = COMBINATIONS[combo][1]
    
    # answers format: list of dicts like {"question_id": 123, "selected_option_id": 456}
    updates = {a["question_id"]: a.get("selected_option_id") for a in data.answers}
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # fetch all correct options to grade
            answers_db = await conn.fetch(
                """
                SELECT a.id, a.question_id, q.subject, o.id as correct_option_id
                FROM ent_trial_answers a
                JOIN ent_questions q ON q.id = a.question_id
                LEFT JOIN ent_options o ON o.question_id = q.id AND o.is_correct = TRUE
                WHERE a.attempt_id = $1
                """,
                attempt_id
            )
            
            scores = {
                'kaz_history': 0, 'reading': 0, 'math_literacy': 0,
                subj1: 0, subj2: 0
            }
            
            for row in answers_db:
                qid = row["question_id"]
                selected = updates.get(qid)
                is_correct = (selected == row["correct_option_id"]) if selected else False
                
                await conn.execute(
                    "UPDATE ent_trial_answers SET selected_option_id = $1, is_correct = $2 WHERE id = $3",
                    selected, is_correct, row["id"]
                )
                
                if is_correct:
                    scores[row["subject"]] += 1
                    
            kh = scores.get('kaz_history', 0)
            rd = scores.get('reading', 0)
            ml = scores.get('math_literacy', 0)
            s1 = scores.get(subj1, 0)
            s2 = scores.get(subj2, 0)
            total = kh + rd + ml + s1 + s2
            
            await conn.execute(
                """
                UPDATE ent_trial_attempts 
                SET status = 'submitted', submitted_at = now(),
                    kaz_history_score = $1, reading_score = $2, math_score = $3,
                    subject1_score = $4, subject2_score = $5, total_score = $6
                WHERE id = $7
                """,
                kh, rd, ml, s1, s2, total, attempt_id
            )
            
    return {"ok": True, "total_score": total}
