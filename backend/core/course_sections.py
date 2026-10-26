from fastapi import HTTPException


async def lock_course(conn, course_id):
    # All grouping/order writes share this lock, including new material creation.
    await conn.fetchrow('SELECT id FROM courses WHERE id=$1 FOR UPDATE', course_id)


async def validate_section(conn, course_id, section_id):
    if section_id is not None and not await conn.fetchval(
        'SELECT EXISTS(SELECT 1 FROM course_sections WHERE id=$1 AND course_id=$2)', section_id, course_id
    ):
        raise HTTPException(422, 'Бөлім осы курсқа тиесілі емес')


async def normalize_item_order(conn, course_id):
    # Keep the existing global position used by sequential-access checks in sync
    # with the displayed folder order. No completion or access rules are changed.
    await conn.execute('''WITH ordered AS (
        SELECT ci.id, (row_number() OVER (
            ORDER BY s.position NULLS LAST, s.id NULLS LAST, ci.position, ci.id
        ) - 1)::integer AS position
        FROM course_items ci LEFT JOIN course_sections s ON s.id=ci.section_id
        WHERE ci.course_id=$1
    ) UPDATE course_items ci SET position=o.position FROM ordered o
      WHERE ci.id=o.id AND ci.position IS DISTINCT FROM o.position''', course_id)


def require_same_ids(requested, actual):
    if len(requested) != len(set(requested)) or set(requested) != set(actual):
        raise HTTPException(409, 'Тізім өзгерді. Бетті жаңартып, қайта көріңіз')
