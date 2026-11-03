"""Publication uses the existing API without changing enrollment or materials."""
import os
import unittest
from tests import test_release as release

@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class CoursePublicationTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request

    async def test_publication_roundtrip_preserves_data(self):
        cid=self.course
        await self.request('POST',f'/courses/{cid}/sections','teacher',json={'title':'Preserved folder'})
        await self.request('POST',f'/courses/{cid}/items','teacher',json={'title':'Preserved lesson','type':'lesson'})
        tables=['course_items','course_sections','lessons','enrollments','course_groups','quiz_attempts','attempt_answers']
        before={t:[dict(r) for r in await self.pool.fetch(f'SELECT * FROM {t} ORDER BY 1')] for t in tables}
        course=dict(await self.pool.fetchrow('SELECT * FROM courses WHERE id=$1',cid))
        for role,published in [('admin',False),('teacher',True)]:
            body={k:course[k] for k in ('title','description','announcement')}
            result=await self.request('PUT',f'/courses/{cid}',role,json=body|{'is_published':published})
            self.assertEqual(result.status_code,200,result.text)
            self.assertEqual((await self.request('GET',f'/courses/{cid}',role)).json()['is_published'],published)
            catalog=(await self.request('GET','/courses','student')).json()['items']
            self.assertEqual(any(c['id']==cid for c in catalog),published)
            self.assertEqual((await self.request('GET','/courses/mine','student')).json()[0]['id'],cid)
            for t in tables:self.assertEqual([dict(r) for r in await self.pool.fetch(f'SELECT * FROM {t} ORDER BY 1')],before[t])
        self.assertEqual(dict(await self.pool.fetchrow('SELECT * FROM courses WHERE id=$1',cid)),course)

    async def test_unauthorized_changes_are_denied(self):
        body={'title':'Blocked','is_published':False}
        self.assertEqual((await self.request('PUT',f'/courses/{self.course}','student',json=body)).status_code,403)
        other=await self.pool.fetchval("INSERT INTO courses(teacher_id,title) VALUES($1,'Other owner') RETURNING id",self.users['admin']['id'])
        self.assertEqual((await self.request('PUT',f'/courses/{other}','teacher',json=body)).status_code,403)
        self.assertEqual(await self.pool.fetchval('SELECT title FROM courses WHERE id=$1',self.course),'Release course')
