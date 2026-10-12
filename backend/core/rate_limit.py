"""Shared fixed-window limits, atomic across workers; no raw IP/email stored."""
import hashlib
from fastapi import HTTPException, Request
from core.db import get_pool


async def check_rate_limit(key: str, limit: int, seconds: int):
    pool = await get_pool()
    digest = hashlib.sha256(key.encode()).hexdigest()
    hits = await pool.fetchval("""INSERT INTO request_limits(key,window_start,hits)
        VALUES($1,clock_timestamp(),1)
        ON CONFLICT(key) DO UPDATE SET
        hits=CASE WHEN request_limits.window_start <= clock_timestamp()-make_interval(secs=>$2::int)
                  THEN 1 ELSE request_limits.hits+1 END,
        window_start=CASE WHEN request_limits.window_start <= clock_timestamp()-make_interval(secs=>$2::int)
                         THEN clock_timestamp() ELSE request_limits.window_start END
        RETURNING hits""", digest, seconds)
    if hits > limit:
        raise HTTPException(429, "Too many requests. Please try again later.", headers={"Retry-After": str(seconds)})


def client_key(request: Request):
    # Forwarded IP is accepted only by Uvicorn from explicitly trusted proxy addresses.
    return request.client.host if request.client else 'unknown'
