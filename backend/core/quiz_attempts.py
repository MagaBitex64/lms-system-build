"""Server-owned LMS quiz timing and durable answers, shared by reads and worker."""
import datetime as dt
import json
from fastapi import HTTPException


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def decoded(value):
    return json.loads(value) if isinstance(value, str) else value


async def complete_quiz(conn, start):
    # Caller holds the quiz_starts row lock; completion is idempotent.
    number = start.get('attempt_number', 1)
    existing = await conn.fetchrow('SELECT * FROM quiz_attempts WHERE quiz_id=$1 AND student_id=$2 AND attempt_number=$3', start['quiz_id'], start['student_id'], number)
    if existing:
        return existing
    quiz = await conn.fetchrow('SELECT * FROM quizzes WHERE item_id=$1', start['quiz_id'])
    questions = await conn.fetch('SELECT * FROM quiz_questions WHERE quiz_id=$1 ORDER BY position,id', start['quiz_id'])
    options = await conn.fetch('SELECT id,question_id,is_correct FROM question_options WHERE question_id=ANY($1::bigint[])', [q['id'] for q in questions])
    keys = {}
    for option in options:
        if option['is_correct']:
            keys.setdefault(option['question_id'], set()).add(option['id'])
    responses = decoded(start['responses']) or {}
    points = sum(q['points'] for q in questions) or 1
    auto_points = 0
    answers = []
    manual = False
    for q in questions:
        value = responses.get(str(q['id']), {})
        selected = value.get('selected_option_ids', [])
        awarded = None
        if q['type'] in ('single','multiple'):
            awarded = q['points'] if selected and set(selected) == keys.get(q['id'], set()) else 0
            auto_points += awarded
        else:
            manual = True
        answers.append((q['id'], selected, value.get('text_answer',''), awarded))
    maximum = start.get('max_score_snapshot') or quiz['max_score']
    result = await conn.fetchrow("""INSERT INTO quiz_attempts(quiz_id,student_id,auto_score,status,submitted_at,attempt_number,max_score_snapshot)
        VALUES($1,$2,$3,$4,LEAST(clock_timestamp(),COALESCE($5,clock_timestamp())),$6,$7) RETURNING *""",
        start['quiz_id'],start['student_id'],round(auto_points/points*maximum,2),
        'pending_review' if manual else 'graded',start['deadline_at'],number,start.get('max_score_snapshot'))
    await conn.executemany('INSERT INTO attempt_answers(attempt_id,question_id,selected_option_ids,text_answer,awarded_points) VALUES($1,$2,$3,$4,$5)',
        [(result['id'], *answer) for answer in answers])
    return result


async def normalized_answers(conn, quiz_id, answers):
    questions = await conn.fetch('SELECT id,type FROM quiz_questions WHERE quiz_id=$1',quiz_id)
    types = {q['id']:q['type'] for q in questions}
    options = await conn.fetch('SELECT id,question_id FROM question_options WHERE question_id=ANY($1::bigint[])',list(types))
    allowed = {}
    for option in options:
        allowed.setdefault(option['question_id'],set()).add(option['id'])
    result = {}
    for answer in answers:
        qid = answer.question_id
        selected = sorted(set(answer.selected_option_ids))
        if qid not in types or str(qid) in result or not set(selected) <= allowed.get(qid,set()):
            raise HTTPException(422,'Foreign or repeated question/option')
        if types[qid]=='single' and len(selected)>1:
            raise HTTPException(422,'Single-choice questions accept one option')
        result[str(qid)] = {'selected_option_ids':selected,'text_answer':answer.text_answer}
    return result


async def quiz_state(pool, quiz_id, student_id):
    async with pool.acquire() as conn, conn.transaction():
        start = await conn.fetchrow('SELECT * FROM quiz_starts WHERE quiz_id=$1 AND student_id=$2 ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE',quiz_id,student_id)
        if start and start['deadline_at'] and start['deadline_at'] <= utcnow():
            await complete_quiz(conn,start)
        return dict(start) if start else None


async def finalize_expired_quizzes(pool):
    async with pool.acquire() as conn, conn.transaction():
        rows = await conn.fetch("""SELECT s.* FROM quiz_starts s WHERE s.deadline_at<=now()
            AND NOT EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.quiz_id=s.quiz_id AND a.student_id=s.student_id AND a.attempt_number=s.attempt_number)
            ORDER BY s.deadline_at LIMIT 100 FOR UPDATE OF s SKIP LOCKED""")
        for row in rows:
            await complete_quiz(conn,row)
