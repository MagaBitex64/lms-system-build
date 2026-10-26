"""Course folders: HTTP + PostgreSQL tests on the isolated auditdb only."""
import os
import unittest

import asyncpg
from core.config import DATABASE_URL
from core.security import create_access_token
from scripts import init_db
from tests import test_release as release
from unittest.mock import patch


@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class CourseSectionTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request
    item = release.ReleaseTests.item
    quiz = release.ReleaseTests.quiz

    async def section(self, title, course=None):
        response = await self.request('POST', f'/courses/{course or self.course}/sections', 'teacher', json={'title': title})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['id']

    async def move(self, item, section):
        response = await self.request('PATCH', f'/courses/items/{item}/section', 'teacher', json={'section_id': section})
        self.assertEqual(response.status_code, 200, response.text)

    async def test_section_lifecycle_order_and_legacy_materials(self):
        legacy = await self.item('lesson')
        first, second = await self.section('Бірінші'), await self.section('Екінші')
        created = []
        for kind in ('lesson', 'homework', 'quiz'):
            response = await self.request('POST', f'/courses/{self.course}/items', 'teacher', json={'type': kind, 'title': kind, 'section_id': first})
            self.assertEqual(response.status_code, 200, response.text)
            created.append(response.json()['id'])
        before = (await self.request('GET', f'/courses/{self.course}', 'teacher')).json()
        self.assertEqual(next(item for item in before['items'] if item['id'] == legacy)['section_id'], None)
        self.assertEqual((await self.request('PATCH', f'/courses/{self.course}/sections/{first}', 'teacher', json={'title': ' Жаңа атау '})).json()['title'], 'Жаңа атау')
        self.assertEqual((await self.request('DELETE', f'/courses/{self.course}/sections/{first}', 'teacher')).status_code, 409)
        reordered = await self.request('POST', f'/courses/{self.course}/items/reorder', 'teacher', json={'section_id': first, 'item_ids': created[::-1]})
        self.assertEqual(reordered.status_code, 200, reordered.text)
        await self.move(created[0], second)
        order = await self.request('POST', f'/courses/{self.course}/sections/reorder', 'teacher', json={'section_ids': [second, first]})
        self.assertEqual(order.status_code, 200, order.text)
        result = (await self.request('GET', f'/courses/{self.course}', 'teacher')).json()
        self.assertEqual([s['id'] for s in result['sections']], [second, first])
        self.assertEqual([item['id'] for item in result['items']], [created[0], created[2], created[1], legacy])
        await self.move(created[0], None)
        self.assertEqual((await self.request('DELETE', f'/courses/{self.course}/sections/{second}', 'teacher')).status_code, 200)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM course_items WHERE course_id=$1', self.course), 4)
        for title in ('', '   ', 'a' * 201):
            self.assertEqual((await self.request('POST', f'/courses/{self.course}/sections', 'teacher', json={'title': title})).status_code, 422)

    async def test_permissions_cross_course_and_stale_orders(self):
        section = await self.section('Section')
        item = await self.item('lesson')
        other = await self.pool.fetchval("INSERT INTO courses(teacher_id,title) VALUES($1,'Other') RETURNING id", self.users['teacher']['id'])
        foreign_section = await self.section('Foreign', other)
        for path, payload in [(f'/courses/items/{item}/section', {'section_id': foreign_section}), (f'/courses/{self.course}/items', {'type': 'lesson', 'title': 'Invalid', 'section_id': foreign_section})]:
            self.assertEqual((await self.request('PATCH' if '/items/' in path else 'POST', path, 'teacher', json=payload)).status_code, 422)
        for role in ('student',):
            for method, path, payload in [
                ('POST', f'/courses/{self.course}/sections', {'title': 'No'}),
                ('PATCH', f'/courses/{self.course}/sections/{section}', {'title': 'No'}),
                ('PATCH', f'/courses/items/{item}/section', {'section_id': section}),
                ('POST', f'/courses/{self.course}/sections/reorder', {'section_ids': [section]}),
                ('POST', f'/courses/{self.course}/items/reorder', {'item_ids': [item]}),
                ('DELETE', f'/courses/{self.course}/sections/{section}', None),
            ]:
                self.assertEqual((await self.request(method, path, role, **({'json': payload} if payload else {}))).status_code, 403)
        teacher = await self.pool.fetchrow("INSERT INTO users(email,password_hash,full_name,role) VALUES('other@example.com','unused','Other','teacher') RETURNING *")
        self.headers['other'] = {'Authorization': 'Bearer ' + create_access_token(teacher['id'], 'teacher', teacher['auth_version'])}
        self.assertEqual((await self.request('POST', f'/courses/{self.course}/sections', 'other', json={'title': 'No'})).status_code, 403)
        self.assertEqual((await self.request('POST', f'/courses/{self.course}/sections', 'admin', json={'title': 'Admin'})).status_code, 200)
        for values in ([section, section], [foreign_section], []):
            self.assertEqual((await self.request('POST', f'/courses/{self.course}/sections/reorder', 'teacher', json={'section_ids': values})).status_code, 409)
        for values in ([item, item], [], [999999]):
            self.assertEqual((await self.request('POST', f'/courses/{self.course}/items/reorder', 'teacher', json={'section_id': None, 'item_ids': values})).status_code, 409)
        async with self.pool.acquire() as conn:
            with self.assertRaises(asyncpg.ForeignKeyViolationError):
                async with conn.transaction():
                    await conn.execute('UPDATE course_items SET section_id=$1 WHERE id=$2', foreign_section, item)

    async def test_student_order_visibility_and_sequential_locks(self):
        first, second = await self.section('Test'), await self.section('Lesson')
        quiz, _, _ = await self.quiz(timed=False)
        lesson = await self.item('lesson', 1)
        hidden = await self.item('lesson', 2)
        await self.pool.execute('UPDATE course_items SET sequential_unlock=true WHERE id=$1', lesson)
        await self.pool.execute('UPDATE course_items SET is_visible=false WHERE id=$1', hidden)
        await self.move(quiz, first)
        await self.move(lesson, second)
        course = (await self.request('GET', f'/courses/{self.course}')).json()
        self.assertNotIn(hidden, [item['id'] for item in course['items']])
        self.assertTrue(next(item for item in course['items'] if item['id'] == lesson)['locked'])
        self.assertEqual((await self.request('GET', f'/courses/lessons/{lesson}')).status_code, 403)
        self.assertEqual((await self.request('POST', f'/courses/{self.course}/sections/reorder', 'teacher', json={'section_ids': [second, first]})).status_code, 200)
        course = (await self.request('GET', f'/courses/{self.course}')).json()
        self.assertEqual([item['id'] for item in course['items']], [lesson, quiz])
        self.assertFalse(course['items'][0]['locked'])
        self.assertEqual((await self.request('GET', f'/courses/lessons/{lesson}')).status_code, 200)
        await self.pool.execute('DELETE FROM item_student_access WHERE item_id=$1', lesson)
        self.assertEqual((await self.request('GET', f'/courses/lessons/{lesson}')).status_code, 403)

    async def test_historical_quiz_data_and_unt_stay_unchanged(self):
        quiz, question, correct = await self.quiz(timed=False)
        self.assertEqual((await self.request('POST', f'/quizzes/{quiz}/start')).status_code, 200)
        submitted = await self.request('POST', f'/quizzes/{quiz}/attempt', json={'answers': [{'question_id': question, 'selected_option_ids': [correct]}]})
        self.assertEqual(submitted.status_code, 200, submitted.text)
        attempt_before = dict(await self.pool.fetchrow('SELECT * FROM quiz_attempts WHERE quiz_id=$1', quiz))
        answers_before = [dict(row) for row in await self.pool.fetch('SELECT * FROM attempt_answers WHERE attempt_id=$1', attempt_before['id'])]
        variant = await self.pool.fetchval("INSERT INTO ent_variants(title,course_id) VALUES('Separate UNT',$1) RETURNING id", self.course)
        variant_before = dict(await self.pool.fetchrow('SELECT * FROM ent_variants WHERE id=$1', variant))
        section = await self.section('Existing quiz')
        await self.move(quiz, section)
        await self.move(quiz, None)
        self.assertEqual(attempt_before, dict(await self.pool.fetchrow('SELECT * FROM quiz_attempts WHERE quiz_id=$1', quiz)))
        self.assertEqual(answers_before, [dict(row) for row in await self.pool.fetch('SELECT * FROM attempt_answers WHERE attempt_id=$1', attempt_before['id'])])
        self.assertEqual(variant_before, dict(await self.pool.fetchrow('SELECT * FROM ent_variants WHERE id=$1', variant)))
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM quiz_questions WHERE quiz_id=$1', quiz), 1)

    async def test_legacy_upgrade_is_additive_and_repeatable(self):
        legacy = await self.item('lesson', 7)
        await self.pool.execute('ALTER TABLE course_items DROP CONSTRAINT course_items_section_course_fkey')
        await self.pool.execute('ALTER TABLE course_items DROP COLUMN section_id')
        await self.pool.execute('DROP TABLE course_sections')
        from scripts.course_section_migrations import COURSE_SECTION_MIGRATIONS
        import hashlib
        for sql in COURSE_SECTION_MIGRATIONS:
            await self.pool.execute('DELETE FROM schema_migrations WHERE id=$1', hashlib.sha256(sql.encode()).hexdigest())
        real_connect = asyncpg.connect
        async def connect(*args, **kwargs):
            kwargs['server_settings'] = {'search_path': self.schema}
            return await real_connect(*args, **kwargs)
        with patch.object(init_db.asyncpg, 'connect', connect):
            await init_db.main()
            await init_db.main()
        row = await self.pool.fetchrow('SELECT * FROM course_items WHERE id=$1', legacy)
        self.assertIsNone(row['section_id'])
        self.assertEqual(row['position'], 7)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM item_student_access WHERE item_id=$1', legacy), 1)
