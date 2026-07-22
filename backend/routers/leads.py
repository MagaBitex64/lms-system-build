from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.db import get_pool
from core.deps import require_admin

router = APIRouter(prefix="/leads", tags=["leads"])
admin_router = APIRouter(prefix="/admin/leads", tags=["admin"])


class LeadCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    course: str = Field(min_length=2, max_length=160)
    branch: str = Field(default="", max_length=160)


class LeadStatusIn(BaseModel):
    status: str = Field(pattern="^(new|contacted|closed)$")


def public_lead(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "course": row["course"],
        "branch": row["branch"],
        "status": row["status"],
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]),
    }


@router.post("")
async def create_lead(data: LeadCreateIn):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO lead_requests (name, phone, course, branch)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        data.name.strip(),
        data.phone.strip(),
        data.course.strip(),
        data.branch.strip(),
    )
    return {"id": row["id"], "status": row["status"]}


@admin_router.get("")
async def list_leads(
    status: str = Query("", pattern="^(|new|contacted|closed)$"),
    q: str = Query("", max_length=200),
    user: dict = Depends(require_admin),
):
    pool = await get_pool()
    like = f"%{q}%"
    rows = await pool.fetch(
        """
        SELECT *
        FROM lead_requests
        WHERE ($1 = '' OR status = $1)
          AND ($2 = '' OR name ILIKE $3 OR phone ILIKE $3 OR course ILIKE $3)
        ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 ELSE 2 END,
                 created_at DESC
        LIMIT 500
        """,
        status,
        q,
        like,
    )
    return {"items": [public_lead(row) for row in rows]}


@admin_router.patch("/{lead_id}")
async def update_lead_status(
    lead_id: int,
    data: LeadStatusIn,
    user: dict = Depends(require_admin),
):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE lead_requests
        SET status = $1, updated_at = now()
        WHERE id = $2
        RETURNING *
        """,
        data.status,
        lead_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Lead request not found")
    return public_lead(row)
