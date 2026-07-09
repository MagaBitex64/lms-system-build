from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from core.db import get_pool
from core.deps import get_current_user
from core.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def public_user(u) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "role": u["role"],
        "is_blocked": u["is_blocked"],
        "created_at": str(u["created_at"]),
    }


@router.post("/login")
async def login(data: LoginIn):
    pool = await get_pool()
    user = await pool.fetchrow("SELECT * FROM users WHERE email = $1", data.email.lower())
    if user is None or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user["is_blocked"]:
        raise HTTPException(status_code=403, detail="Account is blocked")
    token = create_access_token(user["id"], user["role"])
    return {"token": token, "user": public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)
