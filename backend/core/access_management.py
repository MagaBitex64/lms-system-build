"""Shared validation and transactional reconciliation of material/section grants."""
import datetime as dt
from fastapi import HTTPException
from pydantic import BaseModel, Field

class QuizAccessRulesIn(BaseModel):
    max_attempts: int = Field(strict=True, ge=1, le=100)
    deadline_at: dt.datetime | None = None

class AccessIn(BaseModel):
    group_ids: list[int] = Field(default_factory=list, max_length=10000)
    student_ids: list[int] = Field(default_factory=list, max_length=10000)
    quiz_rules: QuizAccessRulesIn | None = None

class SectionAccessIn(AccessIn):
    access_restricted: bool = True

async def validate_targets(conn, course_id, data):
    groups, students = sorted(set(data.group_ids)), sorted(set(data.student_ids))
    if groups and await conn.fetchval('SELECT count(*) FROM course_groups WHERE course_id=$1 AND group_id=ANY($2::bigint[])',course_id,groups) != len(groups):
        raise HTTPException(422, 'Таңдалған топтар курсқа қосылмаған')
    if students and await conn.fetchval("SELECT count(*) FROM enrollments WHERE course_id=$1 AND student_id=ANY($2::bigint[]) AND status='approved'",course_id,students) != len(students):
        raise HTTPException(422, 'Таңдалған оқушылар курсқа тіркелмеген')
    return groups, students

async def write_grants(conn, scope, source_id, groups, students, rules):
    for target, ids in [('group',groups),('student',students)]:
        table, key = f'{scope}_{target}_access', f'{target}_id'
        for target_id in ids:
            old = await conn.fetchrow(f'SELECT max_attempts,deadline_at FROM {table} WHERE {scope}_id=$1 AND {key}=$2',source_id,target_id)
            if rules is not None:
                deadline=rules.deadline_at
                if deadline and (deadline.tzinfo is None or ((not old or deadline != old['deadline_at'] or rules.max_attempts != old['max_attempts']) and deadline<=dt.datetime.now(dt.timezone.utc))):
                    raise HTTPException(422, 'Мерзім уақыт белдеуімен және болашақ уақытпен берілуі тиіс')
                await conn.execute(f'''INSERT INTO {table}({scope}_id,{key},max_attempts,deadline_at) VALUES($1,$2,$3,$4)
                    ON CONFLICT({scope}_id,{key}) DO UPDATE SET max_attempts=EXCLUDED.max_attempts,deadline_at=EXCLUDED.deadline_at''',source_id,target_id,rules.max_attempts,deadline)
            else:
                await conn.execute(f'INSERT INTO {table}({scope}_id,{key}) VALUES($1,$2) ON CONFLICT DO NOTHING',source_id,target_id)
        await conn.execute(f'DELETE FROM {table} WHERE {scope}_id=$1 AND NOT ({key}=ANY($2::bigint[]))',source_id,ids)
