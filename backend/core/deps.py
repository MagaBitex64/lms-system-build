from fastapi import Depends, HTTPException, Request

from core.db import get_pool
from core.security import decode_token


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(auth[7:])
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    pool = await get_pool()
    user = await pool.fetchrow(
        """
        SELECT id, email, full_name, role, is_blocked, auth_version, created_at
        FROM users
        WHERE id = $1
        """,
        int(payload["sub"]),
    )
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if payload.get("ver") != user["auth_version"]:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if user["is_blocked"]:
        raise HTTPException(status_code=403, detail="Account is blocked")
    return dict(user)


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return checker


require_admin = require_role("admin")
require_teacher = require_role("teacher", "admin")
require_student = require_role("student")
