from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse

from core.db import get_pool
from core.deps import get_current_user
from storage.local import FileValidationError, storage

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
async def upload_file(file: UploadFile, user: dict = Depends(get_current_user)):
    if user["role"] == "guest":
        raise HTTPException(status_code=403, detail="Guests cannot upload files")
    content = await file.read()
    try:
        stored_name, mime = storage.save(file.filename or "file", content)
    except FileValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO files (owner_id, original_name, stored_name, mime, size)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, original_name, mime, size, created_at
        """,
        user["id"],
        file.filename or "file",
        stored_name,
        mime,
        len(content),
    )
    return dict(row) | {"created_at": str(row["created_at"])}


@router.get("/{file_id}/download")
async def download_file(file_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    f = await pool.fetchrow("SELECT * FROM files WHERE id = $1", file_id)
    if f is None:
        raise HTTPException(status_code=404, detail="File not found")

    allowed = user["role"] in ("admin", "teacher") or f["owner_id"] == user["id"]
    if not allowed and user["role"] == "student":
        # Student may download files attached as lesson materials / question images
        # in courses they are enrolled in, or files of their own submissions.
        row = await pool.fetchrow(
            """
            SELECT 1 FROM lesson_materials lm
            JOIN course_items ci ON ci.id = lm.lesson_id
            JOIN enrollments e ON e.course_id = ci.course_id
            WHERE lm.file_id = $1 AND e.student_id = $2 AND e.status = 'approved'
            UNION
            SELECT 1 FROM quiz_questions qq
            JOIN course_items ci ON ci.id = qq.quiz_id
            JOIN enrollments e ON e.course_id = ci.course_id
            WHERE qq.image_file_id = $1 AND e.student_id = $2 AND e.status = 'approved'
            """,
            file_id,
            user["id"],
        )
        allowed = row is not None
    if not allowed:
        raise HTTPException(status_code=403, detail="You cannot access this file")

    path = storage.path_for(f["stored_name"])
    if not storage.exists(f["stored_name"]):
        raise HTTPException(status_code=404, detail="File is missing from storage")
    return FileResponse(path, media_type=f["mime"], filename=f["original_name"])
