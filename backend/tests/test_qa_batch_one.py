"""QA01/QA03/QA04 only; integration fixtures require disposable @auditdb."""
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from routers.leads import LEAD_COURSES, LeadCreateIn
from tests import test_release as release


class LeadValidationTests(unittest.TestCase):
    def test_common_kazakhstan_formats_normalize(self):
        for phone in ('+7 (701) 123-45-67', '87011234567', '77011234567', '7011234567', '+7 701 123 45 67'):
            with self.subTest(phone=phone):
                data = LeadCreateIn(name='  Аружан   Сейіт  ', phone=phone, course=' Математика ')
                self.assertEqual(data.phone, '+77011234567')
                self.assertEqual(data.name, 'Аружан Сейіт')
                self.assertEqual(data.course, 'Математика')
        self.assertEqual(LeadCreateIn(name='Айгүл', phone='+7 (727) 123-45-67', course='Физика').phone, '+77271234567')

    def test_empty_malformed_and_unknown_values_rejected(self):
        valid = {'name': 'Аружан', 'phone': '+77011234567', 'course': 'Математика'}
        for field, values in {
            'name': ['', '   ', '\t\n', 'А', 'А'*121],
            'course': ['', '   ', 'unknown', '123'],
            'phone': ['', '    ', 'abcde', '12345', '+7701123456', '+7011234567', '+74951234567',
                      '+87011234567', '701123456789', '+7 (701))123-45-67', '+7 (701 1234567',
                      '+7 701 1234567 ext 1', '7+7011234567', '７７０１１２３４５６７'],
        }.items():
            for value in values:
                with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                    LeadCreateIn(**(valid | {field: value}))

    def test_all_current_public_courses_accepted(self):
        self.assertEqual(len(LEAD_COURSES), 8)
        for course in LEAD_COURSES:
            self.assertEqual(LeadCreateIn(name='Айгүл', phone='87011234567', course=course).course, course)


@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class QABatchTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request

    async def test_invalid_leads_never_persist_valid_lead_does(self):
        valid = {'name': '  Аружан   Сейіт ', 'phone': '+7 (701) 123-45-67', 'course': ' Математика ', 'branch': ' Шымкент '}
        for field in ('name', 'phone', 'course'):
            for value in ('', '   ', 'x'):
                response = await self.client.post('/leads', json=valid | {field: value})
                self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM lead_requests'), 0)
        response = await self.client.post('/leads', json=valid)
        self.assertEqual(response.status_code, 200, response.text)
        saved = await self.pool.fetchrow('SELECT * FROM lead_requests WHERE id=$1', response.json()['id'])
        self.assertEqual((saved['name'], saved['phone'], saved['course'], saved['branch']),
                         ('Аружан Сейіт', '+77011234567', 'Математика', 'Шымкент'))
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM lead_requests'), 1)

    async def seed_search(self, count=23):
        teacher = self.users['teacher']['id']
        courses = []
        for index in range(count):
            # Deliberately identical titles exercise deterministic tie ordering.
            cid = await self.pool.fetchval("INSERT INTO courses(teacher_id,title,is_published) VALUES($1,'QA needle',true) RETURNING id", teacher)
            iid = await self.pool.fetchval("INSERT INTO course_items(course_id,type,title,position) VALUES($1,'lesson','QA needle',0) RETURNING id", cid)
            await self.pool.execute('INSERT INTO lessons(item_id) VALUES($1)', iid)
            await self.pool.execute("INSERT INTO lesson_materials(lesson_id,kind,label,url) VALUES($1,'link','QA needle','https://example.com')", iid)
            courses.append(cid)
        return courses

    async def test_search_all_pages_all_categories_no_duplicates(self):
        await self.seed_search()
        pages = [(await self.request('GET', f'/search?q=needle&page={page}', 'teacher')).json() for page in (1, 2, 3)]
        self.assertEqual([p['has_more'] for p in pages], [True, True, False])
        self.assertEqual([p['page'] for p in pages], [1, 2, 3])
        for key in ('courses', 'lessons', 'materials'):
            self.assertEqual([len(p[key]) for p in pages], [10, 10, 3])
            ids = [r['id'] for p in pages for r in p[key]]
            self.assertEqual(len(set(ids)), 23)
            self.assertEqual(ids, sorted(ids))
        custom = (await self.request('GET', '/search?q=needle&per_page=7&page=4', 'teacher')).json()
        self.assertEqual(custom['per_page'], 7)
        self.assertEqual(len(custom['courses']), 2)
        self.assertFalse(custom['has_more'])

    async def test_search_validation_empty_and_server_errors_are_distinct(self):
        for query in ('', '   ', 'a'*201):
            response = await self.request('GET', '/search', params={'q': query})
            self.assertEqual(response.status_code, 422, response.text)
        for params in ({'page': 0}, {'per_page': 51}):
            self.assertEqual((await self.request('GET', '/search', params={'q': 'needle'} | params)).status_code, 422)
        response = await self.request('GET', '/search?q=no-such-result')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['has_more'])
        self.assertEqual(response.json()['courses'], [])
        with patch('routers.search.get_pool', side_effect=RuntimeError('fixture database unavailable')):
            self.assertEqual((await self.request('GET', '/search?q=needle')).status_code, 500)

    async def test_student_sparse_filtered_page_does_not_hide_later_results(self):
        courses = await self.seed_search(12)
        student = self.users['student']['id']
        for cid in courses:
            await self.pool.execute("INSERT INTO enrollments(course_id,student_id,status) VALUES($1,$2,'approved')", cid, student)
            await self.pool.execute('INSERT INTO item_student_access(item_id,student_id) SELECT id,$2 FROM course_items WHERE course_id=$1', cid, student)
        async def readable(_user, iid):
            if iid <= 10:
                raise HTTPException(403, 'Fixture sequential lock')
        with patch('routers.search.ensure_item_access', side_effect=readable):
            first = (await self.request('GET', '/search?q=needle')).json()
            second = (await self.request('GET', '/search?q=needle&page=2')).json()
        self.assertEqual(first['lessons'], [])
        self.assertTrue(first['has_more'])
        self.assertEqual(len(second['lessons']), 2)
        self.assertEqual(len(second['materials']), 2)
        self.assertFalse(second['has_more'])
