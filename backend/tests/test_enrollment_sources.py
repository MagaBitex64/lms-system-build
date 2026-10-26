"""Enrollment sources share existing relationships; disposable auditdb only."""
import asyncio
import os
import unittest

from tests import test_release as release


@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class EnrollmentSourceTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request
    item = release.ReleaseTests.item
    quiz = release.ReleaseTests.quiz

    async def new_course(self):
        return await self.pool.fetchval("INSERT INTO courses(teacher_id,title,is_published) VALUES($1,'Enrollment fixture',true) RETURNING id", self.users['teacher']['id'])

    async def group(self, code='ИМ1'):
        result = await self.request('POST', '/admin/groups', 'admin', json={'code': code, 'title': 'Group fixture', 'direction': 'Информатика-математика'})
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()['id']

    async def assign(self, course, group):
        result = await self.request('POST', f'/admin/courses/{course}/groups', 'admin', json={'group_id': group})
        self.assertEqual(result.status_code, 200, result.text)

    async def member(self, group, student=None):
        result = await self.request('POST', f'/admin/groups/{group}/students', 'admin', json={'student_id': student or self.users['student']['id']})
        self.assertEqual(result.status_code, 200, result.text)

    async def enrollment(self, course):
        return await self.pool.fetchrow('SELECT * FROM enrollments WHERE course_id=$1 AND student_id=$2', course, self.users['student']['id'])

    async def test_two_workflows_and_independent_direct_source(self):
        course, group = await self.new_course(), await self.group()
        await self.member(group)
        await self.assign(course, group)
        await self.assign(course, group)
        detail = (await self.request('GET', f'/admin/groups/{group}', 'admin')).json()
        self.assertIn(course, [entry['id'] for entry in detail['courses']])
        self.assertTrue(detail['courses'][0]['is_published'])
        detail = (await self.request('GET', f'/courses/{course}', 'teacher')).json()
        self.assertEqual(detail['groups'][0]['id'], group)
        self.assertFalse(detail['students'][0]['direct_enrollment'])
        self.assertEqual(detail['students'][0]['groups'][0]['id'], group)
        self.assertIn(course, [entry['id'] for entry in (await self.request('GET', '/courses/mine')).json()])
        original = await self.enrollment(course)
        for _ in range(2):
            self.assertEqual((await self.request('POST', f'/admin/courses/{course}/students', 'admin', json={'student_id': self.users['student']['id']})).status_code, 200)
        self.assertEqual((await self.enrollment(course))['id'], original['id'])
        await self.request('DELETE', f'/admin/courses/{course}/groups/{group}', 'admin')
        self.assertEqual((await self.enrollment(course))['status'], 'approved')
        await self.assign(course, group)
        await self.request('DELETE', f'/admin/courses/{course}/students/{self.users["student"]["id"]}', 'admin')
        self.assertEqual((await self.enrollment(course))['status'], 'approved')
        self.assertFalse((await self.enrollment(course))['direct_enrollment'])
        await self.request('DELETE', f'/admin/courses/{course}/groups/{group}', 'admin')
        self.assertEqual((await self.enrollment(course))['status'], 'rejected')
        self.assertEqual((await self.enrollment(course))['id'], original['id'])
        self.assertNotIn(course, [entry['id'] for entry in (await self.request('GET', '/courses/mine')).json()])
        # Unrelated direct access must survive every orphan-cleanup invocation.
        self.assertEqual((await self.enrollment(self.course))['status'], 'approved')

    async def test_new_members_multiple_groups_and_concurrent_cleanup(self):
        course, first, second = await self.new_course(), await self.group(), await self.group('ФМ1')
        await self.assign(course, first)
        await self.assign(course, second)
        await self.member(first)
        await self.member(second)
        self.assertEqual((await self.enrollment(course))['status'], 'approved')
        await self.request('DELETE', f'/admin/groups/{first}/students/{self.users["student"]["id"]}', 'admin')
        self.assertEqual((await self.enrollment(course))['status'], 'approved')
        await self.member(first)
        results = await asyncio.gather(*[self.request('DELETE', f'/admin/courses/{course}/groups/{group}', 'admin') for group in (first, second)])
        self.assertEqual([result.status_code for result in results], [200, 200])
        self.assertEqual((await self.enrollment(course))['status'], 'rejected')
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM group_students WHERE student_id=$1', self.users['student']['id']), 2)

    async def test_direct_student_without_group_and_permissions(self):
        course = await self.new_course()
        student = self.users['student']['id']
        self.assertEqual((await self.request('POST', f'/admin/courses/{course}/students', 'admin', json={'student_id': student})).status_code, 200)
        result = (await self.request('GET', f'/courses/{course}', 'teacher')).json()
        self.assertTrue(result['students'][0]['direct_enrollment'])
        self.assertEqual(result['students'][0]['groups'], [])
        for role in ('teacher', 'student'):
            self.assertEqual((await self.request('POST', f'/admin/courses/{course}/students', role, json={'student_id': student})).status_code, 403)
            self.assertEqual((await self.request('DELETE', f'/admin/courses/{course}/students/{student}', role)).status_code, 403)
            self.assertEqual((await self.request('POST', f'/admin/courses/{course}/groups', role, json={'group_id': 999})).status_code, 403)
        self.assertEqual((await self.request('POST', f'/admin/courses/{course}/students', 'admin', json={'student_id': self.users['teacher']['id']})).status_code, 422)
        # Enrollment alone does not grant material/topic access.
        lesson = await self.pool.fetchval("INSERT INTO course_items(course_id,type,title) VALUES($1,'lesson','Locked lesson') RETURNING id", course)
        await self.pool.execute('INSERT INTO lessons(item_id) VALUES($1)', lesson)
        self.assertEqual((await self.request('GET', f'/courses/lessons/{lesson}')).status_code, 403)

    async def test_legacy_access_and_historical_attempts_are_preserved(self):
        quiz, question, correct = await self.quiz(timed=False)
        self.assertEqual((await self.request('POST', f'/quizzes/{quiz}/start')).status_code, 200)
        result = await self.request('POST', f'/quizzes/{quiz}/attempt', json={'answers': [{'question_id': question, 'selected_option_ids': [correct]}]})
        self.assertEqual(result.status_code, 200, result.text)
        attempt = dict(await self.pool.fetchrow('SELECT * FROM quiz_attempts WHERE quiz_id=$1', quiz))
        await self.pool.execute('UPDATE enrollments SET direct_enrollment=NULL WHERE course_id=$1', self.course)
        group = await self.group()
        await self.assign(self.course, group)
        await self.member(group)
        await self.request('DELETE', f'/admin/courses/{self.course}/groups/{group}', 'admin')
        self.assertEqual((await self.enrollment(self.course))['status'], 'approved')
        detail = (await self.request('GET', f'/courses/{self.course}', 'teacher')).json()
        self.assertTrue(detail['students'][0]['legacy_access'])
        await self.request('DELETE', f'/admin/courses/{self.course}/students/{self.users["student"]["id"]}', 'admin')
        self.assertEqual((await self.enrollment(self.course))['status'], 'rejected')
        self.assertEqual(attempt, dict(await self.pool.fetchrow('SELECT * FROM quiz_attempts WHERE quiz_id=$1', quiz)))
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM attempt_answers WHERE attempt_id=$1', attempt['id']), 1)
