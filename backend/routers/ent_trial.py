import copy
import datetime as dt
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.db import get_pool
from core.deps import get_current_user, require_admin, require_student
from core.ent_rules import (COMBINATIONS, DURATION_SECONDS, RULES_VERSION, SUBJECT_LABELS,
                            blueprint, blueprint_metrics, question_issues, score_question,
                            subject_blueprint, validate_variant, variant_blueprint)

router = APIRouter(prefix="/ent-trial", tags=["ent-trial"])


def now():
    return dt.datetime.now(dt.timezone.utc)


def decoded(value):
    return json.loads(value) if isinstance(value, str) else value


class OptionIn(BaseModel):
    text: str = Field(max_length=2000)
    is_correct: bool = False


class PairIn(BaseModel):
    left_text: str = Field(max_length=1000)
    correct_option_position: int = Field(ge=0, le=3)


class QuestionIn(BaseModel):
    variant_id: int
    subject: str = Field(max_length=50)
    position: int = Field(ge=0, le=39)
    prompt: str = Field(max_length=10000)
    question_type: Literal["single_choice", "context", "matching", "multi_choice"]
    difficulty: Literal["A", "B", "C"]
    image_url: str = Field(default="", max_length=2000, pattern=r"^(https?://[^\s]+|/[^/\s][^\s]*|)$")
    image_file_id: int | None = None
    image_placement: Literal["before", "after", "marker"] = "after"
    image_width: int = Field(default=640, ge=120, le=1200)
    image_alt: str = Field(default="", max_length=500)
    context_mode: Literal["shared", "addendum", "override"] = "shared"
    context_override: str = Field(default="", max_length=30000)
    explanation: str = Field(default="", max_length=5000)
    options: list[OptionIn] = Field(max_length=6)
    matching_pairs: list[PairIn] = Field(default_factory=list, max_length=2)


class VariantIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    combination: str = "infmat"
    exam_mode: Literal["full", "single"] = "full"
    single_subject: str | None = None


class ContextIn(BaseModel):
    content: str = Field(max_length=30000)


class AccessIn(BaseModel):
    variant_id: int
    target_type: Literal["all", "group", "student"]
    group_id: int | None = None
    student_id: int | None = None
    expires_at: dt.datetime | None = None
    extra_time_minutes: Literal[0, 40] = 0


class AnswerIn(BaseModel):
    question_id: int
    selected_option_id: int | None = None
    selected_option_ids: list[int] = Field(default_factory=list, max_length=6)
    matching_answer: dict[str, int | str] = Field(default_factory=dict, max_length=10)


class AnswersIn(BaseModel):
    answers: list[AnswerIn] = Field(default_factory=list, max_length=200)
    revision: int = Field(ge=0)


class ProctorActivateIn(BaseModel):
    session_id: str = Field(min_length=16, max_length=100)
    camera_active: bool
    screen_active: bool
    fullscreen: bool


class ProctorEventIn(BaseModel):
    session_id: str = Field(min_length=16, max_length=100)
    event_type: Literal["heartbeat", "tab_hidden", "window_blur", "fullscreen_exit", "camera_stopped", "screen_share_stopped", "copy", "cut", "paste", "context_menu", "forbidden_shortcut"]
    details: dict = Field(default_factory=dict)


async def variant_or_404(conn, variant_id, lock=False):
    row = await conn.fetchrow("SELECT * FROM ent_variants WHERE id=$1" + (" FOR UPDATE" if lock else ""), variant_id)
    if not row:
        raise HTTPException(404, "Вариант табылмады")
    return row


def rules_for_variant(variant):
    return variant_blueprint(variant["combination"], variant.get("exam_mode", "full"), variant.get("single_subject"))


async def load_questions(conn, variant_id=None, attempt_id=None):
    # Legacy attempts retain original question membership; load children in bulk.
    rows = await conn.fetch("SELECT q.* FROM ent_questions q WHERE " +
        ("q.id IN (SELECT question_id FROM ent_trial_answers WHERE attempt_id=$1)" if attempt_id else "q.variant_id=$1") +
        " ORDER BY q.subject,q.position,q.id", attempt_id or variant_id)
    ids = [r["id"] for r in rows]
    options = await conn.fetch("SELECT * FROM ent_options WHERE question_id=ANY($1::bigint[]) ORDER BY position,id", ids)
    pairs = await conn.fetch("SELECT * FROM ent_matching_pairs WHERE question_id=ANY($1::bigint[]) ORDER BY position,id", ids)
    result = []
    for row in rows:
        q = dict(row)
        q.pop("created_at", None)
        q["options"] = [dict(o) for o in options if o["question_id"] == q["id"]]
        q["matching_pairs"] = [dict(p) for p in pairs if p["question_id"] == q["id"]]
        result.append(q)
    return result


async def content(conn, variant):
    qs = await load_questions(conn, variant["id"])
    contexts = [dict(c) for c in await conn.fetch("SELECT * FROM ent_contexts WHERE variant_id=$1 ORDER BY subject,start_position", variant["id"])]
    return qs, contexts, validate_variant(variant["combination"], qs, contexts,
                                          variant.get("exam_mode", "full"), variant.get("single_subject"))


async def ready_content(conn, variant):
    qs, contexts, validation = await content(conn, variant)
    if not validation["ready"]:
        raise HTTPException(409, "Вариант ҰБТ құрылымына сәйкес емес. Редактордағы барлық ескертуді түзетіңіз.")
    return qs, contexts


def make_snapshot(variant, questions, contexts):
    result = []
    rules = rules_for_variant(variant)
    metrics = blueprint_metrics(rules)
    for subject, rule in rules.items():
        for slot in rule["slots"]:
            q = copy.deepcopy(next(q for q in questions if q["subject"] == subject and q["position"] == slot["position"]))
            q["question_id"] = q.pop("id")
            q["max_points"] = slot["max_points"]
            shared = next((c["content"] for c in contexts if c["subject"] == subject and c["start_position"] == slot["context_start"]), "")
            override = q.get("context_override", "").strip()
            mode = q.get("context_mode", "shared")
            q["context_text"] = override if mode == "override" else (f"{shared}\n\n{override}".strip() if mode == "addendum" else shared)
            for pair in q["matching_pairs"]:
                option = q["options"][pair["correct_option_position"]]
                pair["correct_option_id"], pair["right_text"] = option["id"], option["text"]
            result.append(q)
    return {"version": RULES_VERSION, "title": variant["title"], "questions": result,
            "subjects": list(rules), "exam_mode": variant.get("exam_mode", "full"),
            "single_subject": variant.get("single_subject"), **metrics}


async def ensure_snapshot(conn, attempt):
    if attempt["snapshot"] is not None:
        return dict(attempt)
    qs = await load_questions(conn, attempt_id=attempt["id"])
    answers = {r["question_id"]: r for r in await conn.fetch("SELECT * FROM ent_trial_answers WHERE attempt_id=$1", attempt["id"])}
    responses = {}
    for q in qs:
        qid = q.pop("id")
        q["question_id"] = qid
        a = answers[qid]
        matching = decoded(a["matching_answer"])
        if q["question_type"] == "matching":
            q["legacy_matching"] = True
            q["options"] = [{"id": -(i + 1), "text": text} for i, text in enumerate(sorted({p["right_text"] for p in q["matching_pairs"]}))]
            ids = {o["text"]: o["id"] for o in q["options"]}
            for p in q["matching_pairs"]:
                p["correct_option_id"] = ids[p["right_text"]]
            matching = {k: ids[v] for k, v in matching.items() if v in ids}
        if attempt["status"] == "submitted":
            q["legacy_points_earned"] = float(a["points_earned"])
        responses[str(qid)] = {"selected_option_id": a["selected_option_id"], "selected_option_ids": list(a["selected_option_ids"]), "matching_answer": matching}
    snapshot = {"version": "legacy", "title": "Бұрынғы формат", "questions": qs}
    return dict(await conn.fetchrow("UPDATE ent_trial_attempts SET snapshot=$2::jsonb,responses=$3::jsonb WHERE id=$1 RETURNING *", attempt["id"], json.dumps(snapshot), json.dumps(responses)))


async def freeze_legacy(conn, variant_id):
    rows = await conn.fetch("""SELECT * FROM ent_trial_attempts WHERE snapshot IS NULL AND
        (variant_id=$1 OR id IN (SELECT a.attempt_id FROM ent_trial_answers a JOIN ent_questions q ON q.id=a.question_id WHERE q.variant_id=$1))
        ORDER BY id FOR UPDATE""", variant_id)
    for row in rows:
        await ensure_snapshot(conn, row)


@router.get("/rules")
async def get_rules(user: dict = Depends(get_current_user)):
    return {"version": RULES_VERSION, "duration_seconds": DURATION_SECONDS, "combinations": COMBINATIONS,
            "subject_labels": SUBJECT_LABELS, "blueprints": {key: blueprint(key) for key in COMBINATIONS},
            "single_subjects": {key: subject_blueprint(key) for key in SUBJECT_LABELS}}


@router.get("/variants")
async def list_variants(user: dict = Depends(require_admin)):
    pool = await get_pool()
    items = []
    async with pool.acquire() as conn:
        for row in await conn.fetch("SELECT * FROM ent_variants ORDER BY created_at DESC"):
            _, _, validation = await content(conn, row)
            items.append({**dict(row), **{k: value for k, value in validation.items() if k != "issues"}, "issue_count": len(validation["issues"])})
    return {"items": items}


@router.post("/admin/variants")
async def create_ent_variant(data: VariantIn, user: dict = Depends(require_admin)):
    if (data.combination not in COMBINATIONS or not data.title.strip() or
            (data.exam_mode == "single" and data.single_subject not in SUBJECT_LABELS)):
        raise HTTPException(422, "Вариант атауы мен дұрыс пәндер комбинациясы қажет")
    pool = await get_pool()
    vid = await pool.fetchval("""INSERT INTO ent_variants(title,description,combination,exam_mode,single_subject)
        VALUES($1,$2,$3,$4,$5) RETURNING id""", data.title.strip(), data.description, data.combination,
        data.exam_mode, data.single_subject if data.exam_mode == "single" else None)
    return {"ok": True, "id": vid}


@router.patch("/admin/variants/{variant_id}")
async def update_ent_variant(variant_id: int, data: VariantIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        v = await variant_or_404(conn, variant_id, True)
        if (data.combination, data.exam_mode, data.single_subject if data.exam_mode == "single" else None) != (
                v["combination"], v["exam_mode"], v["single_subject"]):
            raise HTTPException(409, "Тест түрін немесе пәндерін өзгерту үшін жаңа вариант жасаңыз")
        if not data.title.strip():
            raise HTTPException(422, "Вариант атауы қажет")
        await conn.execute("UPDATE ent_variants SET title=$2,description=$3 WHERE id=$1", variant_id, data.title.strip(), data.description)
    return {"ok": True}


@router.delete("/admin/variants/{variant_id}")
async def delete_ent_variant(variant_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await variant_or_404(conn, variant_id, True)
        if await conn.fetchval("SELECT EXISTS(SELECT 1 FROM ent_trial_attempts WHERE variant_id=$1)", variant_id):
            raise HTTPException(409, "Бұл вариант бойынша әрекеттер бар. Тарихты сақтау үшін рұқсатты қайтарып алыңыз.")
        await freeze_legacy(conn, variant_id)
        await conn.execute("DELETE FROM ent_variants WHERE id=$1", variant_id)
    return {"ok": True}


@router.get("/admin/variants/{variant_id}/questions")
async def get_variant_questions(variant_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction(isolation="repeatable_read", readonly=True):
        v = await variant_or_404(conn, variant_id)
        qs, contexts, validation = await content(conn, v)
    return {"items": qs, "contexts": contexts, "rules": rules_for_variant(v), "validation": validation,
            "variant": dict(v)}


@router.put("/admin/variants/{variant_id}/contexts/{subject}/{start_position}")
async def save_ent_context(variant_id: int, subject: str, start_position: int, data: ContextIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        v = await variant_or_404(conn, variant_id, True)
        if start_position not in [c["start"] for c in rules_for_variant(v).get(subject, {}).get("contexts", [])]:
            raise HTTPException(422, "Бұл орында ортақ контекст жоқ")
        await freeze_legacy(conn, variant_id)
        await conn.execute("""INSERT INTO ent_contexts(variant_id,subject,start_position,content) VALUES($1,$2,$3,$4)
            ON CONFLICT(variant_id,subject,start_position) DO UPDATE SET content=EXCLUDED.content""", variant_id, subject, start_position, data.content)
    return {"ok": True}


@router.post("/admin/questions")
async def save_ent_question(data: QuestionIn, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        v = await variant_or_404(conn, data.variant_id, True)
        rules = rules_for_variant(v)
        slots = rules.get(data.subject, {}).get("slots", [])
        if data.position >= len(slots):
            raise HTTPException(422, "Пән немесе сұрақ нөмірі ҰБТ құрылымына сәйкес емес")
        errors = question_issues(data.model_dump(), slots[data.position])
        context_start = slots[data.position]["context_start"]
        if context_start is not None:
            block = next(c for c in rules[data.subject]["contexts"] if c["start"] == context_start)
            text = await conn.fetchval("SELECT content FROM ent_contexts WHERE variant_id=$1 AND subject=$2 AND start_position=$3", data.variant_id, data.subject, context_start)
            if not text or not text.strip():
                errors.append(f"Алдымен №{block['start'] + 1}–{block['end'] + 1} үшін ортақ контекстті сақтаңыз")
            elif block["word_range"] and not block["word_range"][0] <= len(text.split()) <= block["word_range"][1]:
                errors.append(f"Ортақ контекст көлемі {block['word_range'][0]}–{block['word_range'][1]} сөз болуы тиіс")
        if errors:
            raise HTTPException(422, "; ".join(errors))
        if data.image_file_id is not None and not await conn.fetchval(
                "SELECT 1 FROM files WHERE id=$1 AND owner_id=$2 AND mime LIKE 'image/%'", data.image_file_id, user["id"]):
            raise HTTPException(422, "Жүктелген сурет табылмады немесе файл сурет емес")
        if data.image_placement == "marker" and (data.image_file_id is not None or data.image_url) and "{{image}}" not in data.prompt:
            raise HTTPException(422, "Мәтіндегі сурет орны үшін {{image}} белгісін қойыңыз")
        await freeze_legacy(conn, data.variant_id)
        ids = await conn.fetch("SELECT id FROM ent_questions WHERE variant_id=$1 AND subject=$2 AND position=$3 ORDER BY id", data.variant_id, data.subject, data.position)
        if len(ids) > 1:
            raise HTTPException(409, "Бұл орында бірнеше ескі сұрақ бар. Алдымен артық сұрақтарды жойыңыз.")
        if ids:
            qid = ids[0]["id"]
            await conn.execute("""UPDATE ent_questions SET prompt=$2,question_type=$3,image_url=$4,explanation=$5,max_points=$6,difficulty=$7,
                image_file_id=$8,image_placement=$9,image_width=$10,image_alt=$11,context_mode=$12,context_override=$13 WHERE id=$1""",
                qid, data.prompt, data.question_type, data.image_url, data.explanation, slots[data.position]["max_points"], data.difficulty,
                data.image_file_id, data.image_placement, data.image_width, data.image_alt, data.context_mode, data.context_override)
            await conn.execute("DELETE FROM ent_options WHERE question_id=$1", qid)
            await conn.execute("DELETE FROM ent_matching_pairs WHERE question_id=$1", qid)
        else:
            qid = await conn.fetchval("""INSERT INTO ent_questions(variant_id,subject,position,prompt,question_type,image_url,explanation,max_points,difficulty,
                image_file_id,image_placement,image_width,image_alt,context_mode,context_override)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id""", data.variant_id, data.subject,
                data.position, data.prompt, data.question_type, data.image_url, data.explanation, slots[data.position]["max_points"], data.difficulty,
                data.image_file_id, data.image_placement, data.image_width, data.image_alt, data.context_mode, data.context_override)
        for i, o in enumerate(data.options):
            await conn.execute("INSERT INTO ent_options(question_id,text,is_correct,position) VALUES($1,$2,$3,$4)", qid, o.text.strip(), o.is_correct if data.question_type != "matching" else False, i)
        if data.question_type == "matching":
            for i, p in enumerate(data.matching_pairs):
                await conn.execute("INSERT INTO ent_matching_pairs(question_id,left_text,right_text,position,correct_option_position) VALUES($1,$2,$3,$4,$5)", qid, p.left_text.strip(), data.options[p.correct_option_position].text.strip(), i, p.correct_option_position)
    return {"ok": True, "id": qid}


@router.delete("/admin/questions/{question_id}")
async def delete_ent_question(question_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow("SELECT variant_id FROM ent_questions WHERE id=$1", question_id)
        if not row:
            raise HTTPException(404, "Сұрақ табылмады")
        if not row["variant_id"]:
            raise HTTPException(409, "Ескі сұрақтар банкі тек оқу режимінде")
        await variant_or_404(conn, row["variant_id"], True)
        await freeze_legacy(conn, row["variant_id"])
        await conn.execute("DELETE FROM ent_questions WHERE id=$1", question_id)
    return {"ok": True}


@router.get("/admin/accesses")
async def list_accesses(user: dict = Depends(require_admin)):
    pool = await get_pool()
    return {"items": [dict(r) for r in await pool.fetch("""SELECT a.*,v.title variant_title,v.exam_mode,v.single_subject,u.full_name student_name,g.title group_title,g.code group_code
        FROM ent_trial_accesses a LEFT JOIN ent_variants v ON v.id=a.variant_id LEFT JOIN users u ON u.id=a.student_id
        LEFT JOIN groups g ON g.id=a.group_id WHERE a.revoked_at IS NULL ORDER BY a.created_at DESC""")]}


@router.post("/admin/accesses")
async def grant_ent_access(data: AccessIn, user: dict = Depends(require_admin)):
    if data.extra_time_minutes and data.target_type != "student":
        raise HTTPException(422, "Қосымша 40 минут тек жеке оқушыға тағайындалады")
    if data.expires_at and (data.expires_at.tzinfo is None or data.expires_at <= now()):
        raise HTTPException(422, "Аяқталу уақыты уақыт белдеуімен және болашақта болуы керек")
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        v = await variant_or_404(conn, data.variant_id, True)
        await ready_content(conn, v)
        if data.target_type == "student" and not await conn.fetchval("SELECT 1 FROM users WHERE id=$1 AND role='student' AND NOT is_blocked", data.student_id):
            raise HTTPException(422, "Оқушы табылмады")
        if data.target_type == "group" and not await conn.fetchval("SELECT 1 FROM groups WHERE id=$1", data.group_id):
            raise HTTPException(422, "Топ табылмады")
        aid = await conn.fetchval("""INSERT INTO ent_trial_accesses(granted_by_id,variant_id,combination,target_type,group_id,student_id,expires_at,extra_time_minutes)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id""", user["id"], data.variant_id, v["combination"], data.target_type,
            data.group_id if data.target_type == "group" else None, data.student_id if data.target_type == "student" else None, data.expires_at, data.extra_time_minutes)
    return {"ok": True, "id": aid}


@router.delete("/admin/accesses/{access_id}")
async def revoke_ent_access(access_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    # Revocation prevents new starts without destroying existing attempts/results.
    if not await pool.fetchval("UPDATE ent_trial_accesses SET revoked_at=now() WHERE id=$1 RETURNING id", access_id):
        raise HTTPException(404, "Рұқсат табылмады")
    return {"ok": True}


@router.get("/admin/accesses/{access_id}/results")
async def get_access_results(access_id: int, user: dict = Depends(require_admin)):
    await finalize_expired()
    pool = await get_pool()
    rows = await pool.fetch("SELECT a.*,u.full_name,u.email FROM ent_trial_attempts a JOIN users u ON u.id=a.student_id WHERE access_id=$1 ORDER BY total_score DESC", access_id)
    return {"items": [{k: v for k, v in dict(r).items() if k not in ("snapshot", "responses")} for r in rows]}


@router.get("/admin/attempts/{attempt_id}/proctor-events")
async def get_proctor_events(attempt_id: int, user: dict = Depends(require_admin)):
    pool = await get_pool()
    if not await pool.fetchval("SELECT 1 FROM ent_trial_attempts WHERE id=$1", attempt_id):
        raise HTTPException(404, "Әрекет табылмады")
    rows = await pool.fetch("""SELECT id,event_type,severity,details,created_at FROM ent_proctor_events
        WHERE attempt_id=$1 ORDER BY created_at,id""", attempt_id)
    return {"items": [dict(r) for r in rows]}


@router.get("/my-accesses")
async def get_my_accesses(user: dict = Depends(require_student)):
    await finalize_expired(user["id"])
    pool = await get_pool()
    rows = await pool.fetch("""SELECT a.*,v.title variant_title,v.description variant_description,v.exam_mode,v.single_subject,
        t.id attempt_id,t.status attempt_status,t.total_score attempt_score FROM ent_trial_accesses a
        LEFT JOIN ent_variants v ON v.id=a.variant_id LEFT JOIN ent_trial_attempts t ON t.access_id=a.id AND t.student_id=$1
        WHERE t.id IS NOT NULL OR (a.revoked_at IS NULL AND (a.target_type='all' OR (a.target_type='student' AND a.student_id=$1) OR
        (a.target_type='group' AND a.group_id IN (SELECT group_id FROM group_students WHERE student_id=$1)))) ORDER BY a.created_at DESC""", user["id"])
    readiness = {}
    async with pool.acquire() as conn:
        for row in rows:
            vid = row["variant_id"]
            if vid and vid not in readiness:
                variant = await variant_or_404(conn, vid)
                _, _, validation = await content(conn, variant)
                readiness[vid] = validation
    return {"items": [{**dict(r), "variant_ready": readiness.get(r["variant_id"], {}).get("ready", False),
                       "question_count": readiness.get(r["variant_id"], {}).get("question_count"),
                       "max_score": readiness.get(r["variant_id"], {}).get("max_score"),
                       "duration_seconds": readiness.get(r["variant_id"], {}).get("duration_seconds")} for r in rows]}


@router.post("/accesses/{access_id}/start")
async def start_ent_test(access_id: int, user: dict = Depends(require_student)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        # Lock in the same order as authoring: variant, access, then attempt.
        access = await conn.fetchrow("SELECT * FROM ent_trial_accesses WHERE id=$1", access_id)
        if not access:
            raise HTTPException(404, "Рұқсат табылмады")
        if access["variant_id"]:
            v = await variant_or_404(conn, access["variant_id"], True)
        access = await conn.fetchrow("SELECT * FROM ent_trial_accesses WHERE id=$1 FOR UPDATE", access_id)
        if not access:
            raise HTTPException(404, "Рұқсат табылмады")
        existing = await conn.fetchval("SELECT id FROM ent_trial_attempts WHERE access_id=$1 AND student_id=$2", access_id, user["id"])
        if existing:
            return {"ok": True, "attempt_id": existing}
        authorized = access["target_type"] == "all" or (access["target_type"] == "student" and access["student_id"] == user["id"])
        if access["target_type"] == "group":
            authorized = bool(await conn.fetchval("SELECT 1 FROM group_students WHERE group_id=$1 AND student_id=$2", access["group_id"], user["id"]))
        if not authorized or access["revoked_at"] or (access["expires_at"] and access["expires_at"] <= now()):
            raise HTTPException(403, "Бұл тестке рұқсат жоқ немесе оның мерзімі аяқталған")
        if not access["variant_id"]:
            raise HTTPException(409, "Ескі кездейсоқ тест іске қосылмайды. Әкімші құрылымды вариант тағайындауы керек.")
        qs, contexts = await ready_content(conn, v)
        started = now()
        aid = await conn.fetchval("""INSERT INTO ent_trial_attempts(access_id,student_id,variant_id,combination,snapshot,started_at,deadline_at)
            VALUES($1,$2,$3,$4,$5::jsonb,$6,NULL) RETURNING id""", access_id, user["id"], v["id"], v["combination"], json.dumps(make_snapshot(v, qs, contexts)), started)
    return {"ok": True, "attempt_id": aid}


@router.post("/attempts/{attempt_id}/proctor/activate")
async def activate_proctor(attempt_id: int, data: ProctorActivateIn, user: dict = Depends(require_student)):
    if not data.camera_active or not data.screen_active or not data.fullscreen:
        missing = []
        if not data.camera_active:
            missing.append("камера")
        if not data.screen_active:
            missing.append("экран демонстрациясы")
        if not data.fullscreen:
            missing.append("толық экран режимі")
        raise HTTPException(422, "Қосылмаған: " + ", ".join(missing))
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        attempt = await owned_attempt(conn, attempt_id, user["id"])
        if attempt["status"] == "submitted":
            return {"ok": True, "status": "submitted"}
        if attempt["proctor_session_id"] and attempt["proctor_session_id"] != data.session_id:
            recently_seen = attempt["proctor_last_seen_at"] and attempt["proctor_last_seen_at"] > now() - dt.timedelta(seconds=35)
            if recently_seen:
                raise HTTPException(409, "Тест басқа терезеде ашылған")
            await conn.execute("""INSERT INTO ent_proctor_events(attempt_id,event_type,severity,details)
                VALUES($1,'window_blur',1,$2::jsonb)""", attempt_id, json.dumps({"action": "session_recovered"}))
            await conn.execute("UPDATE ent_trial_attempts SET proctor_violations=proctor_violations+1,proctor_session_id=$2 WHERE id=$1", attempt_id, data.session_id)
            attempt = await owned_attempt(conn, attempt_id, user["id"])
            if attempt["proctor_violations"] >= 3:
                attempt = dict(await conn.fetchrow("UPDATE ent_trial_attempts SET proctor_status='terminated' WHERE id=$1 RETURNING *", attempt_id))
                attempt = await finish(conn, attempt)
                return {"ok": True, "status": attempt["status"], "deadline_at": attempt["deadline_at"],
                        "violations": attempt["proctor_violations"]}
        if attempt["deadline_at"] is None:
            snapshot = decoded(attempt["snapshot"])
            duration = int(snapshot.get("duration_seconds", DURATION_SECONDS))
            extra = await conn.fetchval("SELECT extra_time_minutes FROM ent_trial_accesses WHERE id=$1", attempt["access_id"])
            started = now()
            attempt = dict(await conn.fetchrow("""UPDATE ent_trial_attempts SET activated_at=$2,started_at=$2,
                deadline_at=$3,proctor_session_id=$4,proctor_status='active',proctor_last_seen_at=$2
                WHERE id=$1 RETURNING *""", attempt_id, started,
                started + dt.timedelta(seconds=duration, minutes=extra or 0), data.session_id))
        else:
            attempt = dict(await conn.fetchrow("""UPDATE ent_trial_attempts SET proctor_session_id=COALESCE(proctor_session_id,$2),
                proctor_status=CASE WHEN proctor_status='pending' THEN 'active' ELSE proctor_status END,proctor_last_seen_at=now()
                WHERE id=$1 RETURNING *""", attempt_id, data.session_id))
        await conn.execute("INSERT INTO ent_proctor_events(attempt_id,event_type,severity,details) VALUES($1,'heartbeat',0,$2::jsonb)",
                           attempt_id, json.dumps({"action": "activated"}))
    return {"ok": True, "status": attempt["status"], "deadline_at": attempt["deadline_at"],
            "violations": attempt["proctor_violations"]}


@router.post("/attempts/{attempt_id}/proctor/events")
async def proctor_event(attempt_id: int, data: ProctorEventIn, user: dict = Depends(require_student)):
    if len(json.dumps(data.details)) > 2000:
        raise HTTPException(422, "Прокторинг оқиғасының деректері тым үлкен")
    severity = {"heartbeat": 0, "copy": 1, "cut": 1, "paste": 1, "context_menu": 1,
                "window_blur": 1, "tab_hidden": 1, "forbidden_shortcut": 1,
                "fullscreen_exit": 2, "camera_stopped": 2, "screen_share_stopped": 2}[data.event_type]
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        attempt = await owned_attempt(conn, attempt_id, user["id"])
        if attempt["status"] == "submitted":
            return {"ok": True, "status": "submitted", "violations": attempt["proctor_violations"]}
        if attempt["proctor_session_id"] != data.session_id or attempt["deadline_at"] is None:
            raise HTTPException(409, "Прокторинг сессиясы сәйкес емес")
        if data.event_type == "heartbeat":
            attempt = dict(await conn.fetchrow("UPDATE ent_trial_attempts SET proctor_last_seen_at=now() WHERE id=$1 RETURNING *", attempt_id))
            if attempt["deadline_at"] <= now():
                attempt = await finish(conn, attempt)
            return {"ok": True, "status": attempt["status"], "violations": attempt["proctor_violations"],
                    "terminated": attempt["proctor_status"] == "terminated"}
        duplicate = False
        if severity:
            duplicate = bool(await conn.fetchval("""SELECT 1 FROM ent_proctor_events WHERE attempt_id=$1 AND event_type=$2
                AND created_at > now() - interval '3 seconds' LIMIT 1""", attempt_id, data.event_type))
        await conn.execute("INSERT INTO ent_proctor_events(attempt_id,event_type,severity,details) VALUES($1,$2,$3,$4::jsonb)",
                           attempt_id, data.event_type, 0 if duplicate else severity, json.dumps(data.details))
        increment = 0 if duplicate else int(severity > 0)
        attempt = dict(await conn.fetchrow("""UPDATE ent_trial_attempts SET proctor_last_seen_at=now(),
            proctor_violations=proctor_violations+$2 WHERE id=$1 RETURNING *""", attempt_id, increment))
        if attempt["deadline_at"] <= now() or attempt["proctor_violations"] >= 3:
            if attempt["proctor_violations"] >= 3:
                attempt = dict(await conn.fetchrow("UPDATE ent_trial_attempts SET proctor_status='terminated' WHERE id=$1 RETURNING *", attempt_id))
            attempt = await finish(conn, attempt)
    return {"ok": True, "status": attempt["status"], "violations": attempt["proctor_violations"],
            "terminated": attempt["proctor_status"] == "terminated"}


def normalized_answers(snapshot, data):
    questions = {q["question_id"]: q for q in snapshot["questions"]}
    result = {}
    for answer in data.answers:
        q = questions.get(answer.question_id)
        if not q or str(answer.question_id) in result:
            raise HTTPException(422, "Бөтен немесе қайталанған сұрақ")
        ids = {o["id"] for o in q["options"]}
        value = {"selected_option_id": None, "selected_option_ids": [], "matching_answer": {}}
        if q["question_type"] == "matching":
            rows = {str(p["id"]) for p in q["matching_pairs"]}
            for row, option in answer.matching_answer.items():
                if row not in rows:
                    raise HTTPException(422, "Бөтен сәйкестендіру жолы")
                if option == "":
                    continue
                if str(option) not in {str(i) for i in ids}:
                    raise HTTPException(422, "Бөтен жауап нұсқасы")
                value["matching_answer"][row] = int(option)
        elif q["question_type"] == "multi_choice":
            if not set(answer.selected_option_ids) <= ids:
                raise HTTPException(422, "Бөтен жауап нұсқасы")
            value["selected_option_ids"] = sorted(set(answer.selected_option_ids))
        else:
            if answer.selected_option_id is not None and answer.selected_option_id not in ids:
                raise HTTPException(422, "Бөтен жауап нұсқасы")
            value["selected_option_id"] = answer.selected_option_id
        result[str(answer.question_id)] = value
    return result


def question_score(q, response):
    if q.get("legacy_matching"):
        matches = sum(str(response.get("matching_answer", {}).get(str(p["id"]), "")) == str(p["correct_option_id"]) for p in q["matching_pairs"])
        return 2 if matches == len(q["matching_pairs"]) and matches else int(matches >= max(1, len(q["matching_pairs"]) // 2))
    return score_question(q, response)


async def finish(conn, attempt):
    if attempt["status"] == "submitted":
        return attempt
    snapshot, responses = decoded(attempt["snapshot"]), decoded(attempt["responses"])
    scores = dict.fromkeys(snapshot.get("subjects") or {q["subject"] for q in snapshot["questions"]}, 0)
    for q in snapshot["questions"]:
        scores[q["subject"]] = scores.get(q["subject"], 0) + question_score(q, responses.get(str(q["question_id"]), {}))
    s1, s2 = COMBINATIONS[attempt["combination"]]
    return dict(await conn.fetchrow("""UPDATE ent_trial_attempts SET status='submitted',submitted_at=LEAST(clock_timestamp(),deadline_at),
        kaz_history_score=$2,reading_score=$3,math_score=$4,subject1_score=$5,subject2_score=$6,total_score=$7,
        scores_by_subject=$8::jsonb,proctor_status=CASE WHEN proctor_status='terminated' THEN 'terminated' ELSE 'finished' END
        WHERE id=$1 RETURNING *""", attempt["id"], scores.get("kaz_history", 0), scores.get("reading", 0),
        scores.get("math_literacy", 0), scores.get(s1, 0), scores.get(s2, 0), sum(scores.values()), json.dumps(scores)))


async def finalize_expired(student_id=None):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        rows = await conn.fetch("""SELECT * FROM ent_trial_attempts WHERE status='in_progress' AND deadline_at<=now()
            AND ($1::bigint IS NULL OR student_id=$1) ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED""", student_id)
        for row in rows:
            await finish(conn, await ensure_snapshot(conn, row))


async def owned_attempt(conn, attempt_id, student_id):
    row = await conn.fetchrow("SELECT * FROM ent_trial_attempts WHERE id=$1 AND student_id=$2 FOR UPDATE", attempt_id, student_id)
    if not row:
        raise HTTPException(404, "Әрекет табылмады")
    return await ensure_snapshot(conn, row)


def public_attempt(attempt):
    snapshot, responses = decoded(attempt["snapshot"]), decoded(attempt["responses"])
    submitted = attempt["status"] == "submitted"
    subjects = snapshot.get("subjects") or list(dict.fromkeys(q["subject"] for q in snapshot["questions"]))
    grouped = {subject: [] for subject in subjects}
    for source in snapshot["questions"]:
        q = copy.deepcopy(source)
        response = responses.get(str(q["question_id"]), {})
        q.update({"selected_option_id": response.get("selected_option_id"), "selected_option_ids": response.get("selected_option_ids", []), "matching_answer": response.get("matching_answer", {})})
        if submitted:
            q["points_earned"] = q.get("legacy_points_earned", question_score(q, response))
            q["is_correct"] = q["points_earned"] == q["max_points"]
        else:
            q.pop("explanation", None)
            for option in q["options"]:
                option.pop("is_correct", None)
            for pair in q["matching_pairs"]:
                for key in ("right_text", "correct_option_id", "correct_option_position"):
                    pair.pop(key, None)
        q.pop("legacy_points_earned", None)
        grouped.setdefault(q["subject"], []).append(q)
    deadline = attempt["deadline_at"]
    profile1, profile2 = COMBINATIONS[attempt["combination"]]
    scores_by_subject = decoded(attempt.get("scores_by_subject")) or {
        "kaz_history": float(attempt["kaz_history_score"]), "reading": float(attempt["reading_score"]),
        "math_literacy": float(attempt["math_score"]), profile1: float(attempt["subject1_score"]),
        profile2: float(attempt["subject2_score"])}
    max_score = snapshot.get("max_score", sum(q.get("max_points", 1) for q in snapshot["questions"]))
    return {"id": attempt["id"], "status": attempt["status"], "combination": attempt["combination"],
            "variant_id": attempt["variant_id"], "rules_version": snapshot["version"], "title": snapshot["title"],
            "started_at": attempt["started_at"], "deadline_at": attempt["deadline_at"], "server_time": now(),
            "remaining_seconds": max(0, int((deadline - now()).total_seconds())) if deadline else None,
            "submitted_at": attempt["submitted_at"], "revision": attempt["response_revision"],
            "requires_proctor_setup": attempt["status"] == "in_progress" and deadline is None,
            "proctor_status": attempt.get("proctor_status", "legacy"), "proctor_violations": attempt.get("proctor_violations", 0),
            "exam_mode": snapshot.get("exam_mode", "full"), "single_subject": snapshot.get("single_subject"),
            "duration_seconds": snapshot.get("duration_seconds", DURATION_SECONDS), "max_score": max_score,
            "scores_by_subject": {k: float(v) for k, v in scores_by_subject.items()},
            "scores": {"kaz_history": float(attempt["kaz_history_score"]), "reading": float(attempt["reading_score"]),
                       "math_literacy": float(attempt["math_score"]), "subject1": float(attempt["subject1_score"]),
                       "subject2": float(attempt["subject2_score"]), "total": float(attempt["total_score"])}, "questions": grouped}


@router.get("/attempts/{attempt_id}")
async def get_attempt(attempt_id: int, user: dict = Depends(require_student)):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        attempt = await owned_attempt(conn, attempt_id, user["id"])
        if attempt["deadline_at"] is not None and attempt["deadline_at"] <= now():
            attempt = await finish(conn, attempt)
        return public_attempt(attempt)


async def save_or_submit(attempt_id, data, user, submit=False):
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        attempt = await owned_attempt(conn, attempt_id, user["id"])
        if attempt["deadline_at"] is None:
            raise HTTPException(409, "Алдымен камера мен толық экранды қосып, прокторингті бастаңыз")
        if attempt["status"] == "submitted" or attempt["deadline_at"] <= now():
            attempt = await finish(conn, attempt)
        else:
            if data.revision != attempt["response_revision"]:
                raise HTTPException(409, "Жауаптар басқа терезеде өзгертілген. Бетті жаңартыңыз.")
            responses = decoded(attempt["responses"])
            responses.update(normalized_answers(decoded(attempt["snapshot"]), data))
            attempt = dict(await conn.fetchrow("UPDATE ent_trial_attempts SET responses=$2::jsonb,response_revision=response_revision+1 WHERE id=$1 RETURNING *", attempt_id, json.dumps(responses)))
            if submit:
                attempt = await finish(conn, attempt)
        return {"ok": True, "status": attempt["status"], "revision": attempt["response_revision"], "total_score": float(attempt["total_score"])}


@router.patch("/attempts/{attempt_id}/answers")
async def save_answers(attempt_id: int, data: AnswersIn, user: dict = Depends(require_student)):
    return await save_or_submit(attempt_id, data, user)


@router.post("/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: int, data: AnswersIn, user: dict = Depends(require_student)):
    return await save_or_submit(attempt_id, data, user, submit=True)
