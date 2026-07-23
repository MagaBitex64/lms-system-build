import json
from dataclasses import dataclass
from typing import Any

from core.db import get_pool
from core.security import decode_token


@dataclass(frozen=True)
class AuditAction:
    code: str
    entity_type: str
    summary: str


IMPORTANT_ACTIONS = {
    "create_user": AuditAction("user.create", "user", "Пайдаланушы құрылды"),
    "update_user": AuditAction("user.update", "user", "Пайдаланушы өзгертілді"),
    "delete_user": AuditAction("user.delete", "user", "Пайдаланушы жойылды"),
    "set_role": AuditAction("user.role", "user", "Пайдаланушы рөлі өзгертілді"),
    "set_blocked": AuditAction("user.block", "user", "Пайдаланушы мәртебесі өзгертілді"),
    "create_group": AuditAction("group.create", "group", "Топ құрылды"),
    "update_group": AuditAction("group.update", "group", "Топ өзгертілді"),
    "delete_group": AuditAction("group.delete", "group", "Топ жойылды"),
    "add_student_to_group": AuditAction("group.student_add", "group", "Оқушы топқа қосылды"),
    "remove_student_from_group": AuditAction("group.student_remove", "group", "Оқушы топтан шығарылды"),
    "add_group_to_course": AuditAction("course.group_add", "course", "Топ курсқа қосылды"),
    "remove_group_from_course": AuditAction("course.group_remove", "course", "Топ курстан шығарылды"),
    "update_lead_status": AuditAction("lead.status", "lead", "Кеңес өтінімінің мәртебесі өзгертілді"),
    "create_course": AuditAction("course.create", "course", "Курс құрылды"),
    "update_course": AuditAction("course.update", "course", "Курс өзгертілді"),
    "delete_course": AuditAction("course.delete", "course", "Курс жойылды"),
    "create_item": AuditAction("item.create", "course_item", "Курс элементі құрылды"),
    "update_item": AuditAction("item.update", "course_item", "Курс элементі өзгертілді"),
    "update_item_access": AuditAction("item.access", "course_item", "Элементке қолжетімділік өзгертілді"),
    "delete_item": AuditAction("item.delete", "course_item", "Курс элементі жойылды"),
    "reorder_items": AuditAction("item.reorder", "course", "Курс элементтерінің реті өзгертілді"),
    "update_lesson": AuditAction("lesson.update", "lesson", "Сабақ мазмұны өзгертілді"),
    "add_material": AuditAction("material.create", "material", "Сабақ материалы қосылды"),
    "delete_material": AuditAction("material.delete", "material", "Сабақ материалы жойылды"),
    "update_quiz_settings": AuditAction("quiz.update", "quiz", "Тест баптаулары өзгертілді"),
    "add_question": AuditAction("quiz.question_add", "quiz", "Тест сұрағы қосылды"),
    "delete_question": AuditAction("quiz.question_delete", "question", "Тест сұрағы жойылды"),
    "grade_answer": AuditAction("quiz.grade", "answer", "Тест жауабы бағаланды"),
    "update_homework": AuditAction("homework.update", "homework", "Үй тапсырмасы өзгертілді"),
    "grade_submission": AuditAction("homework.grade", "submission", "Оқушы жұмысы бағаланды"),
}

ENTITY_ID_KEYS = (
    "user_id",
    "group_id",
    "course_id",
    "item_id",
    "question_id",
    "material_id",
    "answer_id",
    "submission_id",
    "lead_id",
)


async def get_audit_actor(authorization: str) -> dict[str, Any] | None:
    if not authorization.startswith("Bearer "):
        return None
    payload = decode_token(authorization[7:])
    if payload is None or payload.get("sub") is None:
        return None

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, email, full_name, role, auth_version
        FROM users
        WHERE id = $1 AND role IN ('teacher', 'admin') AND NOT is_blocked
        """,
        int(payload["sub"]),
    )
    if row is None or payload.get("ver") != row["auth_version"]:
        return None
    return dict(row)


def audit_entity_id(path_params: dict[str, Any]) -> str | None:
    for key in ENTITY_ID_KEYS:
        value = path_params.get(key)
        if value is not None:
            return str(value)
    return None


async def record_audit_log(
    *,
    actor: dict[str, Any],
    action: AuditAction,
    entity_id: str | None,
    details: dict[str, Any],
) -> None:
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO audit_logs (
            actor_id, actor_name, actor_email, actor_role,
            action, entity_type, entity_id, summary, details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        """,
        actor["id"],
        actor["full_name"],
        actor["email"],
        actor["role"],
        action.code,
        action.entity_type,
        entity_id,
        action.summary,
        json.dumps(details, ensure_ascii=False),
    )
