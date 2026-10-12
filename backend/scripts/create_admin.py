"""Create initial administrator interactively; never print/store a raw password."""
import asyncio
import getpass
import asyncpg
from pydantic import EmailStr, TypeAdapter
from core.config import APP_ENV, DATABASE_URL
from core.security import hash_password_async


async def main():
    if APP_ENV == 'production':
        raise RuntimeError('Production uses the sole administrator provisioned by scripts.bootstrap_admin')
    email = str(TypeAdapter(EmailStr).validate_python(input('Administrator email: ').strip())).lower()
    name = input('Full name: ').strip()
    if len(name) < 2:
        raise ValueError('Full name must have at least two characters')
    password = getpass.getpass('Password: ')
    if password != getpass.getpass('Repeat password: '):
        raise ValueError('Passwords do not match')
    hashed = await hash_password_async(password)
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,'admin')",email,hashed,name)
    finally:
        await conn.close()
    print('Administrator created.')


if __name__ == '__main__':
    asyncio.run(main())
