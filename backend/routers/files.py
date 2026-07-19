from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse

from core.db import get_pool
from core.deps import get_current_user
from storage.local import FileValidationError, storage

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
async def upload_file(file: UploadFile, user: dict = Depends(get_current_user)):
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


async def get_user_from_token(token: str | None):
    """Extract user from JWT token in query parameter."""
    if not token:
        return None
    try:
        from core.security import decode_token
        payload = decode_token(token)
        if payload is None:
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
        pool = await get_pool()
        user = await pool.fetchrow("SELECT * FROM users WHERE id = $1", int(user_id))
        return dict(user) if user else None
    except Exception:
        return None

async def get_optional_user(request: Request) -> dict | None:
    if not request.headers.get("Authorization", "").startswith("Bearer "):
        return None
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    request: Request,
    token: str | None = Query(None),
    user: dict | None = Depends(get_optional_user)
):
    pool = await get_pool()
    f = await pool.fetchrow("SELECT * FROM files WHERE id = $1", file_id)
    if f is None:
        raise HTTPException(status_code=404, detail="File not found")

    # If no user from header auth, try to get from token query parameter
    if not user and token:
        user = await get_user_from_token(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user["id"]
    user_role = user["role"]
    
    allowed = user_role in ("admin", "teacher") or f["owner_id"] == user_id
    if not allowed and user_role == "student":
        # Student may download files attached as lesson materials / question images
        # in courses they are enrolled in, or files of their own submissions.
        row = await pool.fetchrow(
            """
            SELECT 1 FROM lesson_materials lm
            JOIN course_items ci ON ci.id = lm.lesson_id
            JOIN enrollments e ON e.course_id = ci.course_id
            WHERE lm.file_id = $1 AND e.student_id = $2 AND e.status = 'approved'
              AND ci.is_visible
              AND (
                EXISTS (
                  SELECT 1 FROM item_student_access isa
                  WHERE isa.item_id = ci.id AND isa.student_id = $2
                )
                OR EXISTS (
                  SELECT 1
                  FROM item_group_access iga
                  JOIN group_students gs ON gs.group_id = iga.group_id AND gs.student_id = $2
                  JOIN course_groups cg ON cg.group_id = iga.group_id AND cg.course_id = ci.course_id
                  WHERE iga.item_id = ci.id
                )
              )
            UNION
            SELECT 1 FROM quiz_questions qq
            JOIN course_items ci ON ci.id = qq.quiz_id
            JOIN enrollments e ON e.course_id = ci.course_id
            WHERE qq.image_file_id = $1 AND e.student_id = $2 AND e.status = 'approved'
              AND ci.is_visible
              AND (
                EXISTS (
                  SELECT 1 FROM item_student_access isa
                  WHERE isa.item_id = ci.id AND isa.student_id = $2
                )
                OR EXISTS (
                  SELECT 1
                  FROM item_group_access iga
                  JOIN group_students gs ON gs.group_id = iga.group_id AND gs.student_id = $2
                  JOIN course_groups cg ON cg.group_id = iga.group_id AND cg.course_id = ci.course_id
                  WHERE iga.item_id = ci.id
                )
              )
            UNION
            SELECT 1 FROM question_options qo
            JOIN quiz_questions qq ON qq.id = qo.question_id
            JOIN course_items ci ON ci.id = qq.quiz_id
            JOIN enrollments e ON e.course_id = ci.course_id
            WHERE qo.image_file_id = $1 AND e.student_id = $2 AND e.status = 'approved'
              AND ci.is_visible
              AND (
                EXISTS (
                  SELECT 1 FROM item_student_access isa
                  WHERE isa.item_id = ci.id AND isa.student_id = $2
                )
                OR EXISTS (
                  SELECT 1
                  FROM item_group_access iga
                  JOIN group_students gs ON gs.group_id = iga.group_id AND gs.student_id = $2
                  JOIN course_groups cg ON cg.group_id = iga.group_id AND cg.course_id = ci.course_id
                  WHERE iga.item_id = ci.id
                )
              )
            """,
            file_id,
            user_id,
        )
        allowed = row is not None
    if not allowed:
        raise HTTPException(status_code=403, detail="You cannot access this file")

    path = storage.path_for(f["stored_name"])
    if not storage.exists(f["stored_name"]):
        raise HTTPException(status_code=404, detail="File is missing from storage")
    return FileResponse(path, media_type=f["mime"], filename=f["original_name"])
