from fastapi import APIRouter, Depends, HTTPException, Query, Request
import re
from pydantic import BaseModel, Field, field_validator

from core.db import get_pool
from core.deps import require_admin
from core.rate_limit import check_rate_limit, client_key

router = APIRouter(prefix="/leads", tags=["leads"])
admin_router = APIRouter(prefix="/admin/leads", tags=["admin"])


class LeadCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    course: str = Field(min_length=2, max_length=160)
    branch: str = Field(default="", max_length=160)

    @field_validator('name', 'course', 'branch', mode='before')
    @classmethod
    def trim_text(cls, value):
        return ' '.join(value.split()) if isinstance(value, str) else value

    @field_validator('phone', mode='before')
    @classmethod
    def normalize_phone(cls, value):
        if not isinstance(value, str):
            raise ValueError('Телефон нөмірін тексеріңіз')
        phone = value.strip()
        if not re.fullmatch(r'\+?[0-9 ()-]+', phone):
            raise ValueError('Телефон нөмірін тексеріңіз')
        if '(' in phone or ')' in phone:
            if phone.count('(') != 1 or phone.count(')') != 1 or not re.search(r'\([0-9]{2,5}\)', phone):
                raise ValueError('Телефон нөмірін тексеріңіз')
        digits = re.sub(r'[^0-9]', '', phone)
        if phone.startswith('+') and (len(digits) != 11 or digits[0] != '7'):
            raise ValueError('Қазақстанның телефон нөмірін енгізіңіз')
        if len(digits) == 11 and digits[0] in '78':
            digits = digits[1:]
        if not re.fullmatch(r'[67][0-9]{9}', digits):
            raise ValueError('Қазақстанның телефон нөмірін енгізіңіз')
        return '+7' + digits

    @field_validator('course')
    @classmethod
    def allowed_course(cls, value):
        if value not in LEAD_COURSES:
            raise ValueError('Курсты тізімнен таңдаңыз')
        return value


# Public form subject values, not course database IDs or new course records.
LEAD_COURSES = frozenset({
    'Математика', 'Физика', 'Биология', 'Химия', 'Қазақстан тарихы',
    'Оқу сауаттылығы', 'Математикалық сауаттылық', 'Информатика',
})


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
async def create_lead(data: LeadCreateIn, request: Request):
    await check_rate_limit('lead:'+client_key(request), 20, 60)
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
