from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from core.access import ensure_course_owner, get_item_or_404
from core.course_sections import lock_course, normalize_item_order, require_same_ids, validate_section
from core.db import get_pool
from core.deps import require_teacher

router = APIRouter()


class SectionIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    @field_validator('title', mode='before')
    @classmethod
    def trim_title(cls, value):
        return value.strip() if isinstance(value, str) else value


class SectionOrderIn(BaseModel):
    section_ids: list[int] = Field(max_length=10000)


class ItemSectionIn(BaseModel):
    section_id: int | None = Field(default=None, gt=0)


@router.post('/{course_id}/sections')
async def create_section(course_id: int, data: SectionIn, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await lock_course(conn, course_id)
        row = await conn.fetchrow('''INSERT INTO course_sections(course_id,title,position)
            VALUES($1,$2,(SELECT COALESCE(max(position),-1)+1 FROM course_sections WHERE course_id=$1))
            RETURNING *''', course_id, data.title)
    return dict(row)


@router.patch('/{course_id}/sections/{section_id}')
async def rename_section(course_id: int, section_id: int, data: SectionIn, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await lock_course(conn, course_id)
        await validate_section(conn, course_id, section_id)
        row = await conn.fetchrow('UPDATE course_sections SET title=$3 WHERE id=$1 AND course_id=$2 RETURNING *', section_id, course_id, data.title)
    return dict(row)


@router.post('/{course_id}/sections/reorder')
async def reorder_sections(course_id: int, data: SectionOrderIn, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await lock_course(conn, course_id)
        rows = await conn.fetch('SELECT id FROM course_sections WHERE course_id=$1', course_id)
        require_same_ids(data.section_ids, [row['id'] for row in rows])
        await conn.executemany('UPDATE course_sections SET position=$1 WHERE id=$2 AND course_id=$3',
                               [(position, sid, course_id) for position, sid in enumerate(data.section_ids)])
        await normalize_item_order(conn, course_id)
    return {'ok': True}


@router.delete('/{course_id}/sections/{section_id}')
async def delete_section(course_id: int, section_id: int, user: dict = Depends(require_teacher)):
    await ensure_course_owner(user, course_id)
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await lock_course(conn, course_id)
        await validate_section(conn, course_id, section_id)
        if await conn.fetchval('SELECT EXISTS(SELECT 1 FROM course_items WHERE section_id=$1)', section_id):
            raise HTTPException(409, 'Алдымен материалдарды басқа бөлімге немесе бөлінбеген материалдарға көшіріңіз')
        await conn.execute('DELETE FROM course_sections WHERE id=$1 AND course_id=$2', section_id, course_id)
    return {'ok': True}


@router.patch('/items/{item_id}/section')
async def move_item(item_id: int, data: ItemSectionIn, user: dict = Depends(require_teacher)):
    item = await get_item_or_404(item_id)
    await ensure_course_owner(user, item['course_id'])
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        await lock_course(conn, item['course_id'])
        await validate_section(conn, item['course_id'], data.section_id)
        row = await conn.fetchrow('''UPDATE course_items SET section_id=$2,
            position=(SELECT COALESCE(max(position),-1)+1 FROM course_items WHERE course_id=$3)
            WHERE id=$1 AND section_id IS DISTINCT FROM $2 RETURNING id''', item_id, data.section_id, item['course_id'])
        if row:
            await normalize_item_order(conn, item['course_id'])
    return {'ok': True}
