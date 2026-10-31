"""Course subject inheritance without rewriting historical variants."""
import os
import unittest
from tests import test_release as release

@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class CourseSubjectTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request

    async def test_explicit_subject_inheritance_and_confirmed_change(self):
        created=await self.request('POST','/courses','teacher',json={'title':'Not a subject name','ent_subject':'informatics'})
        self.assertEqual(created.status_code,200,created.text)
        cid=created.json()['id']
        first=await self.request('POST',f'/ent-trial/teacher/courses/{cid}/variants','teacher',json={'title':'Original'})
        self.assertEqual(first.status_code,200,first.text)
        vid=first.json()['id']
        original=dict(await self.pool.fetchrow('SELECT * FROM ent_variants WHERE id=$1',vid))
        self.assertEqual(original['single_subject'],'informatics')
        denied=await self.request('PUT',f'/courses/{cid}/ent-subject','admin',json={'subject':'mathematics'})
        self.assertEqual(denied.status_code,409)
        changed=await self.request('PUT',f'/courses/{cid}/ent-subject','admin',json={'subject':'mathematics','confirm_subject_change':True})
        self.assertEqual(changed.status_code,200,changed.text)
        self.assertEqual(dict(await self.pool.fetchrow('SELECT * FROM ent_variants WHERE id=$1',vid)),original)
        second=await self.request('POST',f'/ent-trial/teacher/courses/{cid}/variants','teacher',json={'title':'Updated subject'})
        self.assertEqual(second.status_code,200,second.text)
        self.assertEqual(await self.pool.fetchval('SELECT single_subject FROM ent_variants WHERE id=$1',second.json()['id']),'mathematics')
        listing=await self.request('GET',f'/ent-trial/teacher/courses/{cid}/variants','teacher')
        self.assertEqual(len(listing.json()['items']),2)
        # The course owner retains access to the old subject's editor.
        self.assertEqual((await self.request('GET',f'/ent-trial/admin/variants/{vid}/questions','teacher')).status_code,200)
        self.assertEqual((await self.request('PUT',f'/courses/{cid}/ent-subject','teacher',json={'subject':'physics','confirm_subject_change':True})).status_code,403)

    async def test_missing_combined_and_invalid_mapping_never_defaults(self):
        for title, subject in [('Информатика',None),('Математика-информатика',None),('Legacy','invalid-combination')]:
            cid=await self.pool.fetchval('INSERT INTO courses(teacher_id,title,ent_subject) VALUES($1,$2,$3) RETURNING id',self.users['teacher']['id'],title,subject)
            result=await self.request('POST',f'/ent-trial/teacher/courses/{cid}/variants','teacher',json={'title':'No default'})
            self.assertEqual(result.status_code,409,result.text)
            self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM ent_variants WHERE course_id=$1',cid),0)
        # Unmapped courses can still list historical variants.
        await self.pool.execute("INSERT INTO ent_variants(title,combination,exam_mode,single_subject,course_id) VALUES('Old','infmat','single','reading',$1)",cid)
        result=await self.request('GET',f'/ent-trial/teacher/courses/{cid}/variants','teacher')
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['items'][0]['single_subject'],'reading')
