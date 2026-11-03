"""One SQL predicate for listing, direct access, search and prerequisites.

Legacy sections keep the old deny-without-material-grant policy. Restricted
sections require a section grant AND any explicit material restrictions. A
section grant supplies access only when the material has no explicit grants.
Enrollment, publication, visibility and assessment rules are separate gates.
"""
def grant_sql(scope, alias='ci', student='$2'):
    key = f'{alias}.id' if scope == 'item' else f'{alias}.section_id'
    return f'''(EXISTS(SELECT 1 FROM {scope}_student_access a
        WHERE a.{scope}_id={key} AND a.student_id={student})
        OR EXISTS(SELECT 1 FROM {scope}_group_access a
        JOIN group_students gs ON gs.group_id=a.group_id AND gs.student_id={student}
        JOIN course_groups cg ON cg.group_id=a.group_id AND cg.course_id={alias}.course_id
        WHERE a.{scope}_id={key}))'''


def topic_sql(alias='ci', student='$2'):
    material = grant_sql('item',alias,student)
    section = grant_sql('section',alias,student)
    explicit = f'''({alias}.access_configured OR EXISTS(SELECT 1 FROM item_student_access a WHERE a.item_id={alias}.id)
        OR EXISTS(SELECT 1 FROM item_group_access a WHERE a.item_id={alias}.id))'''
    return f'''(CASE WHEN EXISTS(SELECT 1 FROM course_sections s
        WHERE s.id={alias}.section_id AND s.course_id={alias}.course_id AND s.access_restricted)
        THEN ({section} AND (NOT {explicit} OR {material})) ELSE {material} END)'''


async def require_live_student_access(conn, item_id, student_id):
    """Recheck grants on the assessment transaction's connection after its lock."""
    from fastapi import HTTPException
    allowed = await conn.fetchval(f'''SELECT {topic_sql()} AND ci.is_visible AND c.is_published
        AND EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id
            AND e.student_id=$2 AND e.status='approved')
        FROM course_items ci JOIN courses c ON c.id=ci.course_id WHERE ci.id=$1''', item_id, student_id)
    if not allowed:
        raise HTTPException(403, 'This topic is not open yet')
