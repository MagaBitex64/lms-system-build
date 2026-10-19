"""Topical quiz rules. Overlapping grants intersect; attempts are never added together."""
from fastapi import HTTPException


async def access_rules(conn, item_id, student_id):
    rows = await conn.fetch('''
        SELECT max_attempts,deadline_at FROM item_student_access WHERE item_id=$1 AND student_id=$2
        UNION ALL
        SELECT a.max_attempts,a.deadline_at FROM item_group_access a
        JOIN group_students gs ON gs.group_id=a.group_id AND gs.student_id=$2
        JOIN course_groups cg ON cg.group_id=a.group_id
        JOIN course_items ci ON ci.id=a.item_id AND ci.course_id=cg.course_id
        WHERE a.item_id=$1''', item_id, student_id)
    if not rows:
        raise HTTPException(403, 'This topic is not open yet')
    deadlines = [r['deadline_at'] for r in rows if r['deadline_at']]
    return {'max_attempts': min(r['max_attempts'] for r in rows),
            'deadline_at': min(deadlines) if deadlines else None}


async def readiness(conn, item_id):
    rows = await conn.fetch('''SELECT q.id,q.type,q.prompt,q.points,
        count(o.id) options,count(o.id) FILTER(WHERE o.is_correct) correct,
        count(o.id) FILTER(WHERE btrim(o.text)='' AND o.image_file_id IS NULL) empty_options
        FROM quiz_questions q LEFT JOIN question_options o ON o.question_id=q.id
        WHERE q.quiz_id=$1 GROUP BY q.id ORDER BY q.position,q.id''', item_id)
    incomplete = [r['id'] for r in rows if not r['prompt'].strip() or r['points'] <= 0 or
                  (r['type'] in ('single', 'multiple') and
                   (r['options'] < 2 or r['empty_options'] or r['correct'] == 0 or
                    (r['type'] == 'single' and r['correct'] != 1)))]
    return {'ready': bool(rows) and not incomplete, 'incomplete_question_ids': incomplete,
            'calculated_max_score': sum(r['points'] for r in rows)}
