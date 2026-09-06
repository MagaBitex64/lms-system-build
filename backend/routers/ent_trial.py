import datetime
import json
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

# Real ENT structure: 120 questions, 140 max points
# Mandatory: kaz_history(20×1=20), reading(10×1=10), math_literacy(10×1=10)
# Profile (×2): 25 single(×1=25) + 5 context(×1=5) + 5 matching(×2=10) + 5 multi(×2=10) = 50

MANDATORY_SUBJECTS = {
    'kaz_history': 20,
    'reading': 10,
    'math_literacy': 10,
}

PROFILE_STRUCTURE = {
    'single_choice': 25,
    'context': 5,
    'matching': 5,
    'multi_choice': 5,
}

POINTS_PER_TYPE = {
    'single_choice': 1,
    'context': 1,
    'matching': 2,
    'multi_choice': 2,
}


# ---- Pydantic models ----

class OptionIn(BaseModel):
    text: str = Field(..., max_length=1000)
    is_correct: bool = False

class MatchingPairIn(BaseModel):
    left_text: str = Field(..., max_length=500)
    right_text: str = Field(..., max_length=500)

class QuestionIn(BaseModel):
    variant_id: int | None = None
    subject: str = Field(..., max_length=50)
    prompt: str = Field(..., max_length=10000)
    question_type: str = Field(default="single_choice", pattern="^(single_choice|context|matching|multi_choice)$")
    context_text: str = Field(default="", max_length=10000)
    image_url: str = Field(default="", max_length=2000)
    explanation: str = Field(default="", max_length=5000)
    options: list[OptionIn] = []
    matching_pairs: list[MatchingPairIn] = []

class VariantIn(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(default="", max_length=1000)
    combination: str = Field(pattern="^(infmat|phymat|biochem|chemphi|matgeo)$")

class AccessIn(BaseModel):
    variant_id: int | None = None
    combination: str = Field(pattern="^(infmat|phymat|biochem|chemphi|matgeo)$")
    target_type: str = Field(pattern="^(all|group|student)$")
    group_id: int | None = None
    student_id: int | None = None
    expires_at: datetime.datetime | None = None

class SubmitEntIn(BaseModel):
    answers: list[dict]
    # For single_choice/context: {"question_id": 1, "selected_option_id": 2}
    # For multi_choice: {"question_id": 1, "selected_option_ids": [2,3,5]}
    # For matching: {"question_id": 1, "matching_answer": {"1": "B", "2": "A", ...}}


# ---------- PUBLIC & USER ENDPOINTS ----------

@router.get("/variants")
async def get_variants(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT v.*, COUNT(q.id) as question_count
        FROM ent_variants v
        LEFT JOIN ent_questions q ON q.variant_id = v.id
        GROUP BY v.id
        ORDER BY v.created_at DESC
        """
    )
    items = []
    for r in rows:
        d = dict(r)
        d["created_at"] = str(d["created_at"])
        d["question_count"] = int(d["question_count"])
        items.append(d)
    return {"items": items}


# ---------- ADMIN ENDPOINTS ----------

@router.post("/admin/variants")
async def create_variant(data: VariantIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO ent_variants (title, description, combination)
        VALUES ($1, $2, $3) RETURNING id, title, description, combination, created_at
        """,
        data.title, data.description, data.combination
    )
    d = dict(row)
    d["created_at"] = str(d["created_at"])
    return {"ok": True, "variant": d}

@router.patch("/admin/variants/{variant_id}")
async def update_variant(variant_id: int, data: VariantIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE ent_variants SET title = $1, description = $2, combination = $3
        WHERE id = $4 RETURNING id, title, description, combination, created_at
        """,
        data.title, data.description, data.combination, variant_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Variant not found")
    d = dict(row)
    d["created_at"] = str(d["created_at"])
    return {"ok": True, "variant": d}

@router.delete("/admin/variants/{variant_id}")
async def delete_variant(variant_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    row = await pool.fetchrow("DELETE FROM ent_variants WHERE id = $1 RETURNING id", variant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Variant not found")
    return {"ok": True}

@router.get("/admin/variants/{variant_id}/questions")
async def get_variant_questions(variant_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT q.* FROM ent_questions q
        WHERE q.variant_id = $1
        ORDER BY q.subject, q.position
        """,
        variant_id
    )
    questions = []
    for r in rows:
        d = dict(r)
        d["created_at"] = str(d["created_at"])
        opts = await pool.fetch(
            "SELECT id, text, is_correct FROM ent_options WHERE question_id = $1 ORDER BY position",
            r["id"]
        )
        d["options"] = [dict(o) for o in opts]
        pairs = await pool.fetch(
            "SELECT id, left_text, right_text, position FROM ent_matching_pairs WHERE question_id = $1 ORDER BY position",
            r["id"]
        )
        d["matching_pairs"] = [dict(p) for p in pairs]
        questions.append(d)
    
    # Group by subject
    grouped = {}
    for q in questions:
        grouped.setdefault(q["subject"], []).append(q)
    
    return {"items": questions, "grouped": grouped}

@router.get("/admin/subjects")
async def get_subjects_stats(user: dict = Depends(require_admin)):
    pool = await get_pool()
    rows = await pool.fetch("SELECT subject, COUNT(*) as count FROM ent_questions GROUP BY subject")
    return {r["subject"]: r["count"] for r in rows}

@router.get("/admin/questions")
async def get_questions(
    subject: str | None = Query(None),
    variant_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: dict = Depends(require_admin)
):
    pool = await get_pool()
    offset = (page - 1) * per_page
    
    where_clauses = []
    params = []
    
    if subject:
        params.append(subject)
        where_clauses.append(f"q.subject = ${len(params)}")
    if variant_id:
        params.append(variant_id)
        where_clauses.append(f"q.variant_id = ${len(params)}")
        
    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    
    params.extend([per_page, offset])
    limit_idx = len(params) - 1
    offset_idx = len(params)
    
    query = f"""
        SELECT q.*, COUNT(*) OVER() AS total
        FROM ent_questions q
        {where_str}
        ORDER BY q.position, q.created_at DESC
        LIMIT ${limit_idx} OFFSET ${offset_idx}
    """
    
    rows = await pool.fetch(query, *params)
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
        pairs = await pool.fetch(
            "SELECT id, left_text, right_text, position FROM ent_matching_pairs WHERE question_id = $1 ORDER BY position",
            r["id"]
        )
        d["matching_pairs"] = [dict(p) for p in pairs]
        questions.append(d)
    return {"items": questions, "total": total, "page": page, "per_page": per_page}

@router.post("/admin/questions")
async def add_question(data: QuestionIn, user: dict = Depends(require_admin)):
    max_points = POINTS_PER_TYPE.get(data.question_type, 1)
    
    if data.question_type in ('single_choice', 'context'):
        if len(data.options) < 2:
            raise HTTPException(status_code=422, detail="Needs at least 2 options")
        if sum(1 for o in data.options if o.is_correct) != 1:
            raise HTTPException(status_code=422, detail="Needs exactly 1 correct option")
    elif data.question_type == 'multi_choice':
        if len(data.options) < 4:
            raise HTTPException(status_code=422, detail="Needs at least 4 options (ideally 6)")
        correct_count = sum(1 for o in data.options if o.is_correct)
        if correct_count < 1 or correct_count > 3:
            raise HTTPException(status_code=422, detail="Needs 1-3 correct options")
    elif data.question_type == 'matching':
        if len(data.matching_pairs) < 2:
            raise HTTPException(status_code=422, detail="Needs at least 2 matching pairs")
        
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            pos = await conn.fetchval(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM ent_questions WHERE subject = $1 AND variant_id = $2", 
                data.subject, data.variant_id
            )
            q_id = await conn.fetchval(
                """
                INSERT INTO ent_questions (variant_id, subject, prompt, question_type, context_text, image_url, explanation, max_points, position)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
                """,
                data.variant_id, data.subject, data.prompt, data.question_type, data.context_text, data.image_url, data.explanation, max_points, pos
            )
            
            if data.question_type in ('single_choice', 'context', 'multi_choice'):
                for i, opt in enumerate(data.options):
                    await conn.execute(
                        "INSERT INTO ent_options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)",
                        q_id, opt.text, opt.is_correct, i
                    )
            
            if data.question_type == 'matching':
                for i, pair in enumerate(data.matching_pairs):
                    await conn.execute(
                        "INSERT INTO ent_matching_pairs (question_id, left_text, right_text, position) VALUES ($1, $2, $3, $4)",
                        q_id, pair.left_text, pair.right_text, i
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
               g.title as group_title, g.code as group_code,
               v.title as variant_title
        FROM ent_trial_accesses a
        LEFT JOIN users u ON u.id = a.student_id
        LEFT JOIN groups g ON g.id = a.group_id
        LEFT JOIN ent_variants v ON v.id = a.variant_id
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
    
    # If variant_id provided, use its combination
    combo = data.combination
    if data.variant_id:
        variant = await pool.fetchrow("SELECT combination FROM ent_variants WHERE id = $1", data.variant_id)
        if variant:
            combo = variant["combination"]
    
    row = await pool.fetchrow(
        """
        INSERT INTO ent_trial_accesses (granted_by_id, variant_id, combination, target_type, group_id, student_id, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        """,
        user["id"], data.variant_id, combo, data.target_type, data.group_id, data.student_id, data.expires_at
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
    rows = await pool.fetch(
        """
        SELECT a.*,
               v.title as variant_title,
               v.description as variant_description,
               (SELECT id FROM ent_trial_attempts WHERE access_id = a.id AND student_id = $1 LIMIT 1) as attempt_id,
               (SELECT status FROM ent_trial_attempts WHERE access_id = a.id AND student_id = $1 LIMIT 1) as attempt_status,
               (SELECT total_score FROM ent_trial_attempts WHERE access_id = a.id AND student_id = $1 LIMIT 1) as attempt_score
        FROM ent_trial_accesses a
        LEFT JOIN ent_variants v ON v.id = a.variant_id
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
        
    # 3. Create attempt and answers from variant
    combo = access["combination"]
    variant_id = access["variant_id"]
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            attempt_id = await conn.fetchval(
                """
                INSERT INTO ent_trial_attempts (access_id, student_id, variant_id, combination)
                VALUES ($1, $2, $3, $4) RETURNING id
                """,
                access_id, user["id"], variant_id, combo
            )
            
            # Get all questions from variant ordered by subject + position
            if variant_id:
                qs = await conn.fetch(
                    "SELECT id FROM ent_questions WHERE variant_id = $1 ORDER BY subject, position",
                    variant_id
                )
            else:
                # Fallback: random from pool
                subj1, subj2 = COMBINATIONS[combo]
                qs = []
                for subj, limit in MANDATORY_SUBJECTS.items():
                    rows = await conn.fetch(
                        "SELECT id FROM ent_questions WHERE subject = $1 ORDER BY RANDOM() LIMIT $2",
                        subj, limit
                    )
                    qs.extend(rows)
                for subj in [subj1, subj2]:
                    rows = await conn.fetch(
                        "SELECT id FROM ent_questions WHERE subject = $1 ORDER BY RANDOM() LIMIT 40",
                        subj
                    )
                    qs.extend(rows)
                    
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
        
    rows = await pool.fetch(
        """
        SELECT a.id as answer_id, a.selected_option_id, a.selected_option_ids, 
               a.matching_answer, a.points_earned, a.is_correct,
               q.id as question_id, q.subject, q.prompt, q.question_type,
               q.context_text, q.image_url, q.explanation, q.max_points
        FROM ent_trial_answers a
        JOIN ent_questions q ON q.id = a.question_id
        WHERE a.attempt_id = $1
        ORDER BY q.subject, q.position, a.id
        """,
        attempt_id
    )
    
    questions = []
    for r in rows:
        d = dict(r)
        
        # Get options for single_choice, context, multi_choice
        if d["question_type"] in ('single_choice', 'context', 'multi_choice'):
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
            d["options"] = options
        else:
            d["options"] = []
            
        # Get matching pairs for matching questions
        if d["question_type"] == 'matching':
            pairs = await pool.fetch(
                "SELECT id, left_text, right_text, position FROM ent_matching_pairs WHERE question_id = $1 ORDER BY position",
                r["question_id"]
            )
            d["matching_pairs"] = [dict(p) for p in pairs]
            # Convert matching_answer from JSON string if needed
            if isinstance(d["matching_answer"], str):
                try:
                    d["matching_answer"] = json.loads(d["matching_answer"])
                except:
                    d["matching_answer"] = {}
        else:
            d["matching_pairs"] = []
            
        # Convert selected_option_ids
        d["selected_option_ids"] = list(d["selected_option_ids"]) if d["selected_option_ids"] else []
        d["points_earned"] = float(d["points_earned"])
            
        qd = {
            "answer_id": d["answer_id"],
            "question_id": d["question_id"],
            "subject": d["subject"],
            "prompt": d["prompt"],
            "question_type": d["question_type"],
            "context_text": d["context_text"],
            "image_url": d["image_url"],
            "max_points": d["max_points"],
            "options": d["options"],
            "matching_pairs": d["matching_pairs"],
            "selected_option_id": d["selected_option_id"],
            "selected_option_ids": d["selected_option_ids"],
            "matching_answer": d["matching_answer"],
        }
        if attempt["status"] == "submitted":
            qd["is_correct"] = d["is_correct"]
            qd["points_earned"] = d["points_earned"]
            qd["explanation"] = d["explanation"]
        questions.append(qd)
        
    grouped = {}
    for q in questions:
        grouped.setdefault(q["subject"], []).append(q)
        
    return {
        "id": attempt["id"],
        "status": attempt["status"],
        "combination": attempt["combination"],
        "variant_id": attempt["variant_id"],
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


def _score_multi_choice(selected_ids: list[int], correct_ids: list[int]) -> float:
    """Score multi_choice question per real ENT rules."""
    correct_set = set(correct_ids)
    selected_set = set(selected_ids)
    
    correct_selected = selected_set & correct_set
    wrong_selected = selected_set - correct_set
    
    n_correct_total = len(correct_set)
    n_correct_selected = len(correct_selected)
    n_wrong_selected = len(wrong_selected)
    
    if n_correct_total == 2:
        if n_correct_selected == 2 and n_wrong_selected == 0:
            return 2.0
        elif n_correct_selected >= 1 and n_wrong_selected <= 1:
            return 1.0
        else:
            return 0.0
    elif n_correct_total == 3:
        if n_correct_selected == 3 and n_wrong_selected == 0:
            return 2.0
        elif n_correct_selected >= 2 and n_wrong_selected <= 1:
            return 1.0
        else:
            return 0.0
    else:
        # Fallback for 1 correct
        if n_correct_selected == 1 and n_wrong_selected == 0:
            return 2.0
        elif n_correct_selected == 1:
            return 1.0
        return 0.0


def _score_matching(student_answer: dict, correct_pairs: list[dict]) -> float:
    """Score matching question. student_answer maps left_text -> right_text."""
    if not correct_pairs or not student_answer:
        return 0.0
    
    total = len(correct_pairs)
    correct = 0
    for pair in correct_pairs:
        student_right = student_answer.get(str(pair["id"]), "")
        if student_right == pair["right_text"]:
            correct += 1
    
    if correct == total:
        return 2.0
    elif correct >= total // 2:
        return 1.0
    return 0.0


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
    
    # Build lookup from submitted answers
    answers_map = {}
    for a in data.answers:
        qid = a.get("question_id")
        if qid:
            answers_map[qid] = a
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Get all answers with question info
            answers_db = await conn.fetch(
                """
                SELECT a.id, a.question_id, q.subject, q.question_type, q.max_points
                FROM ent_trial_answers a
                JOIN ent_questions q ON q.id = a.question_id
                WHERE a.attempt_id = $1
                """,
                attempt_id
            )
            
            scores = {
                'kaz_history': 0.0, 'reading': 0.0, 'math_literacy': 0.0,
                subj1: 0.0, subj2: 0.0
            }
            
            for row in answers_db:
                qid = row["question_id"]
                qtype = row["question_type"]
                student_ans = answers_map.get(qid, {})
                points = 0.0
                is_correct = False
                
                if qtype in ('single_choice', 'context'):
                    selected = student_ans.get("selected_option_id")
                    if selected:
                        correct_opt = await conn.fetchrow(
                            "SELECT id FROM ent_options WHERE question_id = $1 AND is_correct = TRUE LIMIT 1",
                            qid
                        )
                        if correct_opt and selected == correct_opt["id"]:
                            points = 1.0
                            is_correct = True
                    
                    await conn.execute(
                        "UPDATE ent_trial_answers SET selected_option_id = $1, is_correct = $2, points_earned = $3 WHERE id = $4",
                        selected, is_correct, points, row["id"]
                    )
                    
                elif qtype == 'multi_choice':
                    selected_ids = student_ans.get("selected_option_ids", [])
                    correct_opts = await conn.fetch(
                        "SELECT id FROM ent_options WHERE question_id = $1 AND is_correct = TRUE",
                        qid
                    )
                    correct_ids = [o["id"] for o in correct_opts]
                    points = _score_multi_choice(selected_ids, correct_ids)
                    is_correct = points >= 2.0
                    
                    await conn.execute(
                        "UPDATE ent_trial_answers SET selected_option_ids = $1, is_correct = $2, points_earned = $3 WHERE id = $4",
                        selected_ids, is_correct, points, row["id"]
                    )
                    
                elif qtype == 'matching':
                    matching_ans = student_ans.get("matching_answer", {})
                    pairs = await conn.fetch(
                        "SELECT id, left_text, right_text FROM ent_matching_pairs WHERE question_id = $1",
                        qid
                    )
                    correct_pairs = [dict(p) for p in pairs]
                    points = _score_matching(matching_ans, correct_pairs)
                    is_correct = points >= 2.0
                    
                    await conn.execute(
                        "UPDATE ent_trial_answers SET matching_answer = $1, is_correct = $2, points_earned = $3 WHERE id = $4",
                        json.dumps(matching_ans), is_correct, points, row["id"]
                    )
                
                if row["subject"] in scores:
                    scores[row["subject"]] += points
                    
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
