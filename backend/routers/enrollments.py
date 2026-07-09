from fastapi import APIRouter, Depends, HTTPException

from core.deps import require_student

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.post("/request/{course_id}")
async def request_enrollment(course_id: int, user: dict = Depends(require_student)):
    raise HTTPException(status_code=403, detail="Course access is assigned by an administrator")
