import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

import bcrypt
import jwt
from fastapi import HTTPException

from core.config import JWT_ALGORITHM, JWT_EXPIRES_MINUTES, JWT_SECRET

_password_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="password")
_password_slots = asyncio.Semaphore(8)


def validate_password(password: str):
    if not 8 <= len(password) or len(password.encode("utf-8")) > 72:
        raise HTTPException(422, "Password must contain at least 8 characters and at most 72 UTF-8 bytes")


async def hash_password_async(password: str) -> str:
    validate_password(password)
    async with _password_slots:
        return await asyncio.get_running_loop().run_in_executor(_password_executor, hash_password, password)


async def verify_password_async(password: str, password_hash: str) -> bool:
    if len(password.encode("utf-8")) > 72:
        return False
    async with _password_slots:
        return await asyncio.get_running_loop().run_in_executor(_password_executor, verify_password, password, password_hash)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, role: str, auth_version: int) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "ver": auth_version,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"require": ["sub", "exp", "ver"]})
        if not isinstance(payload["sub"], str) or not payload["sub"].isdigit() or not 0 < int(payload["sub"]) < 2**63:
            return None
        return payload
    except jwt.PyJWTError:
        return None
