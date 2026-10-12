from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse

from core.db import get_pool
from core.deps import get_current_user
from core.access import ensure_item_access
from core.config import MAX_USER_FILES, MAX_USER_STORAGE_BYTES
from core.rate_limit import check_rate_limit
from storage.local import FileValidationError, storage

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
async def upload_file(file: UploadFile, user: dict = Depends(get_current_user)):
    await check_rate_limit('upload:'+str(user['id']), 30, 60)
    try:
        stored_name, mime, size = await storage.save_upload(file.filename or "file", file)
    except FileValidationError as exc:
        raise HTTPException(422, str(exc))
    try:
        pool = await get_pool()
        async with pool.acquire() as conn, conn.transaction():
            await conn.fetchval('SELECT id FROM users WHERE id=$1 FOR UPDATE', user['id'])
            quota = await conn.fetchrow('SELECT count(*) n, COALESCE(sum(size),0) bytes FROM files WHERE owner_id=$1', user['id'])
            if quota['n'] >= MAX_USER_FILES or int(quota['bytes'])+size > MAX_USER_STORAGE_BYTES:
                raise HTTPException(413, 'Upload storage quota exceeded')
            row = await conn.fetchrow(
                """INSERT INTO files(owner_id,original_name,stored_name,mime,size)
                VALUES($1,$2,$3,$4,$5) RETURNING id,original_name,mime,size,created_at""",
                user['id'], file.filename or 'file', stored_name, mime, size)
    except Exception:
        storage.delete(stored_name)
        raise
    return dict(row) | {'created_at': str(row['created_at'])}


async def get_optional_user(request: Request) -> dict | None:
    if not request.headers.get("Authorization", "").startswith("Bearer "):
        return None
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def teacher_can_access_file(pool, file_id: int, teacher_id: int) -> bool:
    """Allow teachers to read only files connected to courses they own."""
    return bool(
        await pool.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM lesson_materials lm
                JOIN course_items ci ON ci.id = lm.lesson_id
                JOIN courses c ON c.id = ci.course_id
                WHERE lm.file_id = $1 AND c.teacher_id = $2

                UNION ALL

                SELECT 1
                FROM quiz_questions qq
                JOIN course_items ci ON ci.id = qq.quiz_id
                JOIN courses c ON c.id = ci.course_id
                WHERE qq.image_file_id = $1 AND c.teacher_id = $2

                UNION ALL

                SELECT 1
                FROM question_options qo
                JOIN quiz_questions qq ON qq.id = qo.question_id
                JOIN course_items ci ON ci.id = qq.quiz_id
                JOIN courses c ON c.id = ci.course_id
                WHERE qo.image_file_id = $1 AND c.teacher_id = $2

                UNION ALL

                SELECT 1
                FROM submission_files sf
                JOIN homework_submissions hs ON hs.id = sf.submission_id
                JOIN course_items ci ON ci.id = hs.homework_id
                JOIN courses c ON c.id = ci.course_id
                WHERE sf.file_id = $1 AND c.teacher_id = $2
            )
            """,
            file_id,
            teacher_id,
        )
    )


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    request: Request,
    user: dict | None = Depends(get_optional_user)
):
    pool = await get_pool()
    f = await pool.fetchrow("SELECT * FROM files WHERE id = $1", file_id)
    if f is None:
        raise HTTPException(status_code=404, detail="File not found")

    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user["id"]
    user_role = user["role"]

    allowed = user_role == "admin" or f["owner_id"] == user_id
    if not allowed and user_role == "teacher":
        # Teachers may read student submissions and course assets only inside
        # courses assigned to them. A teacher role alone grants no global access.
        allowed = await teacher_can_access_file(pool, file_id, user_id)

    if not allowed and user_role == "student":
        rows = await pool.fetch(
            """SELECT ci.id FROM lesson_materials lm JOIN course_items ci ON ci.id=lm.lesson_id WHERE lm.file_id=$1
            UNION SELECT ci.id FROM quiz_questions q JOIN course_items ci ON ci.id=q.quiz_id WHERE q.image_file_id=$1
            UNION SELECT ci.id FROM question_options o JOIN quiz_questions q ON q.id=o.question_id
                JOIN course_items ci ON ci.id=q.quiz_id WHERE o.image_file_id=$1""", file_id)
        for row in rows:
            try:
                await ensure_item_access(user, row['id'])
                allowed = True
                break
            except HTTPException as exc:
                if exc.status_code not in (403, 404):
                    raise
        if not allowed:
            # ENT images are frozen into the student's authorized attempt snapshot.
            # This keeps an image private until that exact student receives the test.
            allowed = bool(await pool.fetchval(
                """SELECT 1 FROM ent_trial_attempts a
                CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a.snapshot->'questions','[]'::jsonb)) q
                WHERE a.student_id=$2 AND a.deadline_at IS NOT NULL AND q->>'image_file_id'=$1::bigint::text LIMIT 1""",
                file_id, user_id,
            ))
    if not allowed:
        raise HTTPException(status_code=403, detail="You cannot access this file")

    path = storage.path_for(f["stored_name"])
    if not storage.exists(f["stored_name"]):
        raise HTTPException(status_code=404, detail="File is missing from storage")
    return FileResponse(path, media_type=f["mime"], filename=f["original_name"])
