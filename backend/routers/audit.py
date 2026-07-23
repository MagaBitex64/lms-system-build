import json
from typing import Literal

from fastapi import APIRouter, Depends, Query

from core.db import get_pool
from core.deps import require_admin

router = APIRouter(prefix="/admin/audit-logs", tags=["audit"])


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    role: Literal["admin", "teacher"] | None = None,
    q: str = Query("", max_length=200),
    user: dict = Depends(require_admin),
):
    pool = await get_pool()
    where = ["TRUE"]
    args: list[object] = []

    if role:
        args.append(role)
        where.append(f"actor_role = ${len(args)}")
    if q.strip():
        args.append(f"%{q.strip()}%")
        index = len(args)
        where.append(
            f"""(
                actor_name ILIKE ${index}
                OR actor_email ILIKE ${index}
                OR summary ILIKE ${index}
                OR action ILIKE ${index}
            )"""
        )

    where_sql = " AND ".join(where)
    total = await pool.fetchval(f"SELECT COUNT(*) FROM audit_logs WHERE {where_sql}", *args)
    offset = (page - 1) * per_page
    rows = await pool.fetch(
        f"""
        SELECT id, actor_id, actor_name, actor_email, actor_role,
               action, entity_type, entity_id, summary, details, created_at
        FROM audit_logs
        WHERE {where_sql}
        ORDER BY created_at DESC, id DESC
        LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}
        """,
        *args,
        per_page,
        offset,
    )

    items = []
    for row in rows:
        item = dict(row)
        if isinstance(item["details"], str):
            item["details"] = json.loads(item["details"])
        item["created_at"] = str(item["created_at"])
        items.append(item)

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
    }
