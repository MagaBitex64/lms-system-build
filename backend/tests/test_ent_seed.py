"""Tests for the full ENT seeder.

Creates a temporary schema inside a transaction and runs the seeder, then
verifies that three variants with expected question counts and scores exist.
"""
import asyncio
import unittest
import uuid
from contextlib import asynccontextmanager

import asyncpg

from core.config import DATABASE_URL
from scripts.init_db import SCHEMA, ENT_MIGRATIONS


class TransactionPool:
    def __init__(self, conn):
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn

    def __getattr__(self, name):
        return getattr(self.conn, name)


class SeedFullEntTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.conn = await asyncpg.connect(DATABASE_URL)
        self.tx = self.conn.transaction(isolation='repeatable_read')
        await self.tx.start()
        self.addAsyncCleanup(self.cleanup_database)
        name = 'ent_seed_test_' + uuid.uuid4().hex
        await self.conn.execute(f'CREATE SCHEMA "{name}"')
        await self.conn.execute(f'SET LOCAL search_path TO "{name}"')
        await self.conn.execute(SCHEMA)
        for migration in ENT_MIGRATIONS:
            await self.conn.execute(migration)

    async def cleanup_database(self):
        await self.tx.rollback()
        await self.conn.close()

    async def test_seed_creates_three_variants_with_120_questions_each(self):
        # create an admin user
        admin = await self.conn.fetchrow("INSERT INTO users(email,password_hash,full_name,role) VALUES($1,'x',$2,'admin') RETURNING *", 'admin@seed.test', 'Admin')
        # import and run seeder
        from scripts.seed_ent_full import seed_full_ent, VARIANT_TITLES
        await seed_full_ent(self.conn, admin['id'])
        # verify variants
        rows = await self.conn.fetch("SELECT id,title FROM ent_variants ORDER BY id")
        self.assertEqual(len(rows), len(VARIANT_TITLES))
        for r in rows:
            vid = r['id']
            qcount = await self.conn.fetchval('SELECT count(1) FROM ent_questions WHERE variant_id=$1', vid)
            self.assertEqual(qcount, 120, f"Variant {r['title']} has {qcount} questions")
            max_score = await self.conn.fetchval('SELECT SUM(max_points) FROM ent_questions WHERE variant_id=$1', vid)
            self.assertEqual(max_score, 140)
            # subjects counts
            sub_counts = await self.conn.fetch("SELECT subject, count(1) FROM ent_questions WHERE variant_id=$1 GROUP BY subject", vid)
            mapping = {row['subject']: row['count'] for row in sub_counts}
            self.assertEqual(mapping.get('kaz_history', 0), 20)
            self.assertEqual(mapping.get('reading', 0), 10)
            self.assertEqual(mapping.get('math_literacy', 0), 10)
            self.assertEqual(mapping.get('mathematics', 0), 40)
            self.assertEqual(mapping.get('informatics', 0), 40)


if __name__ == '__main__':
    unittest.main()
