import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from core.config import (
    FRONTEND_BASE_URL,
    PASSWORD_RESET_EXPIRES_MINUTES,
    PASSWORD_RESET_MAX_PER_HOUR,
)
from core.db import get_pool
from core.deps import get_current_user
from core.security import create_access_token, hash_password, verify_password
from services.email import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)
GENERIC_RESET_MESSAGE = (
    "Егер бұл email жүйеде тіркелген болса, құпиясөзді қалпына келтіру сілтемесі жіберілді."
)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


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
    token = create_access_token(user["id"], user["role"], user["auth_version"])
    return {"token": token, "user": public_user(user)}


async def _deliver_reset_email(
    *,
    user_id: int,
    email: str,
    full_name: str,
    token: str,
    token_hash: str,
) -> None:
    reset_url = f"{FRONTEND_BASE_URL}/reset-password?token={quote(token, safe='')}"
    try:
        await send_password_reset_email(
            email=email,
            full_name=full_name,
            reset_url=reset_url,
            expires_minutes=PASSWORD_RESET_EXPIRES_MINUTES,
        )
    except Exception:
        # The raw token and reset URL are intentionally never written to logs.
        logger.exception("Password reset email delivery failed for user_id=%s", user_id)
        pool = await get_pool()
        await pool.execute(
            "DELETE FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL",
            token_hash,
        )


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(data: ForgotPasswordIn, background_tasks: BackgroundTasks):
    pool = await get_pool()
    email = data.email.lower()
    user = await pool.fetchrow(
        """
        SELECT id, email, full_name
        FROM users
        WHERE email = $1 AND NOT is_blocked
        """,
        email,
    )
    if user is None:
        return {"message": GENERIC_RESET_MESSAGE}

    recent_requests = await pool.fetchval(
        """
        SELECT count(*)
        FROM password_reset_tokens
        WHERE user_id = $1 AND created_at > now() - interval '1 hour'
        """,
        user["id"],
    )
    if recent_requests >= PASSWORD_RESET_MAX_PER_HOUR:
        return {"message": GENERIC_RESET_MESSAGE}

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRES_MINUTES)

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                UPDATE password_reset_tokens
                SET used_at = now()
                WHERE user_id = $1 AND used_at IS NULL
                """,
                user["id"],
            )
            await conn.execute(
                """
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                VALUES ($1, $2, $3)
                """,
                user["id"],
                token_hash,
                expires_at,
            )

    background_tasks.add_task(
        _deliver_reset_email,
        user_id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        token=token,
        token_hash=token_hash,
    )
    return {"message": GENERIC_RESET_MESSAGE}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordIn):
    if len(data.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password must be at most 72 bytes")

    token_hash = hashlib.sha256(data.token.encode("utf-8")).hexdigest()
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            reset = await conn.fetchrow(
                """
                SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.is_blocked
                FROM password_reset_tokens prt
                JOIN users u ON u.id = prt.user_id
                WHERE prt.token_hash = $1
                FOR UPDATE OF prt
                """,
                token_hash,
            )
            if (
                reset is None
                or reset["used_at"] is not None
                or reset["expires_at"] <= datetime.now(timezone.utc)
                or reset["is_blocked"]
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Сілтеме жарамсыз немесе оның мерзімі аяқталған.",
                )

            await conn.execute(
                """
                UPDATE users
                SET password_hash = $1, auth_version = auth_version + 1
                WHERE id = $2
                """,
                hash_password(data.new_password),
                reset["user_id"],
            )
            await conn.execute(
                """
                UPDATE password_reset_tokens
                SET used_at = now()
                WHERE user_id = $1 AND used_at IS NULL
                """,
                reset["user_id"],
            )

    return {"message": "Құпиясөз сәтті өзгертілді."}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)
