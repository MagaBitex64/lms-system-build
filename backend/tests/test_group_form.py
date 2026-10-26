"""Group form compatibility. Integration tests require the disposable auditdb."""
import os
import unittest

from pydantic import ValidationError
from routers.admin import GroupIn, GroupUpdateIn
from tests import test_release as release


class GroupValidationTests(unittest.TestCase):
    def test_stream_optional_and_legacy_stream_accepted(self):
        values = dict(code=' ИМ2 ', title=' Group ', direction=' Custom direction ')
        group = GroupIn(**values)
        self.assertIsNone(group.stream)
        self.assertEqual(group.code, 'ИМ2')
        self.assertEqual(GroupIn(**values, stream='legacy').stream, 'legacy')
        self.assertEqual(GroupUpdateIn(title='New name').model_dump(exclude_unset=True), {'title': 'New name'})

    def test_invalid_text_and_capacity(self):
        values = dict(code='ИМ2', title='Group', direction='Custom')
        for field in ('code', 'title', 'direction'):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                GroupIn(**(values | {field: '   '}))
        for value in (0, -1, 41, 1.5, True):
            with self.subTest(capacity=value), self.assertRaises(ValidationError):
                GroupIn(**values, capacity=value)
        for value in (1, 40):
            self.assertEqual(GroupIn(**values, capacity=value).capacity, value)


@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class GroupFormIntegrationTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request
    item = release.ReleaseTests.item

    async def test_create_edit_preserves_stream_membership_and_permissions(self):
        response = await self.request('POST', '/admin/groups', 'admin', json={
            'code': 'им2', 'title': 'Group fixture', 'direction': 'Информатика-математика', 'capacity': 20})
        self.assertEqual(response.status_code, 200, response.text)
        group = response.json()
        self.assertEqual((group['code'], group['stream']), ('ИМ2', '2'))
        gid = group['id']
        await self.pool.execute("UPDATE groups SET stream='legacy' WHERE id=$1", gid)
        member = await self.request('POST', f'/admin/groups/{gid}/students', 'admin', json={'student_id': self.users['student']['id']})
        self.assertEqual(member.status_code, 200, member.text)
        assigned = await self.request('POST', f'/admin/courses/{self.course}/groups', 'admin', json={'group_id': gid})
        self.assertEqual(assigned.status_code, 200, assigned.text)
        lesson = await self.item('lesson')
        permitted = await self.request('PUT', f'/courses/items/{lesson}/access', 'teacher', json={'group_ids': [gid], 'student_ids': []})
        self.assertEqual(permitted.status_code, 200, permitted.text)
        changed = await self.request('PATCH', f'/admin/groups/{gid}', 'admin', json={'title': 'Renamed fixture', 'capacity': 21})
        self.assertEqual(changed.status_code, 200, changed.text)
        self.assertEqual(changed.json()['stream'], 'legacy')
        self.assertEqual(changed.json()['direction'], group['direction'])
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM group_students WHERE group_id=$1', gid), 1)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM course_groups WHERE group_id=$1', gid), 1)
        self.assertEqual((await self.request('GET', f'/courses/lessons/{lesson}')).status_code, 200)
        self.assertEqual((await self.request('POST', '/admin/groups', 'admin', json={
            'code': 'ИМ2', 'title': 'Duplicate', 'direction': 'Custom'})).status_code, 409)
        self.assertEqual((await self.request('PATCH', f'/admin/groups/{gid}', 'admin', json={'capacity': 1.5})).status_code, 422)
