import asyncio
import asyncpg

from core.config import DATABASE_URL

_pool: asyncpg.Pool | None = None
_pool_lock = asyncio.Lock()


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:
                _pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=1, max_size=10,
                                                command_timeout=30, timeout=10)
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
