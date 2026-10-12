"""Provision the sole production administrator once, using a Docker secret."""
import asyncio
from pathlib import Path

import asyncpg
from pydantic import EmailStr, TypeAdapter

from core.config import APP_ENV, DATABASE_URL, PRODUCTION_ADMIN_EMAIL, validate_production_config
from core.security import hash_password_async


async def provision_admin(conn, email: str, password_file: str):
    email = str(TypeAdapter(EmailStr).validate_python(email)).lower()
    async with conn.transaction():
        await conn.execute('SELECT pg_advisory_xact_lock(72419013)')
        await conn.execute('''CREATE TABLE IF NOT EXISTS production_admin_bootstrap (
            singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
            user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            email text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )''')
        state = await conn.fetchrow('SELECT user_id,email FROM production_admin_bootstrap')
        if state:
            admins = await conn.fetch('SELECT id,email,is_blocked FROM users WHERE role=$1', 'admin')
            if (state['email'] != email or len(admins) != 1 or admins[0]['id'] != state['user_id']
                    or admins[0]['email'] != email or admins[0]['is_blocked']):
                raise RuntimeError('Production administrator differs from its bootstrap record; review the database')
            return  # Never reset a changed password or revoke sessions on restart.

        password = Path(password_file).read_text(encoding='utf-8').rstrip('\r\n')
        password_hash = await hash_password_async(password)
        # Keep historical references, but remove privileges and invalidate sessions.
        await conn.execute("""UPDATE users SET role='teacher',is_blocked=true,
            auth_version=auth_version+1 WHERE role='admin' AND lower(email)<>$1""", email)
        matching = await conn.fetch('SELECT id FROM users WHERE lower(email)=$1 FOR UPDATE', email)
        if len(matching) > 1:
            raise RuntimeError('Duplicate case-insensitive administrator emails; resolve before deployment')
        if matching:
            admin_id = matching[0]['id']
            await conn.execute("""UPDATE users SET email=$1,password_hash=$2,role='admin',
                is_blocked=false,auth_version=auth_version+1 WHERE id=$3""", email, password_hash, admin_id)
        else:
            admin_id = await conn.fetchval("""INSERT INTO users(email,password_hash,full_name,role)
                VALUES($1,$2,'Fenomen administrator','admin') RETURNING id""", email, password_hash)
        await conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS production_one_admin ON users ((role)) WHERE role='admin'")
        await conn.execute('INSERT INTO production_admin_bootstrap(user_id,email) VALUES($1,$2)', admin_id, email)


async def main():
    if APP_ENV != 'production':
        return
    validate_production_config()
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await provision_admin(conn, PRODUCTION_ADMIN_EMAIL, '/run/secrets/production_admin_password')
    finally:
        await conn.close()
    print('Production administrator verified.')


if __name__ == '__main__':
    asyncio.run(main())
