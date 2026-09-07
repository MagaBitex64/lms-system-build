"""Add the complete demo ENT variant without touching other data."""
import asyncio

import asyncpg

from core.config import DATABASE_URL
from core.ent_demo import seed_demo_ent


async def main():
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        async with conn.transaction():
            admin_id = await conn.fetchval("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")
            if not admin_id:
                raise RuntimeError("Create an administrator before seeding the demo ENT variant")
            variant_id = await seed_demo_ent(conn, admin_id)
        print(f"Demo ENT variant is ready: {variant_id}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
