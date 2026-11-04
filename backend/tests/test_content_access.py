"""Inherited section permissions: real HTTP and isolated PostgreSQL fixtures."""
import datetime as dt
import os
import unittest
from tests import test_release as release
from tests import test_topical_quiz as topical

@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS')=='1','Disposable auditdb required')
class ContentAccessTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp=release.ReleaseTests.asyncSetUp
    cleanup=release.ReleaseTests.cleanup
    request=release.ReleaseTests.request
    question=topical.TopicalTests.question

    async def section(self,title='Restricted'):
        r=await self.request('POST',f'/courses/{self.course}/sections','teacher',json={'title':title})
        self.assertEqual(r.status_code,200,r.text)
        return r.json()['id']
    async def material(self,section=None,kind='lesson',title='Permission fixture'):
        r=await self.request('POST',f'/courses/{self.course}/items','teacher',json={'type':kind,'title':title,'section_id':section})
        self.assertEqual(r.status_code,200,r.text)
        return r.json()['id']
    async def grant_section(self,sid,role='teacher',**kwargs):
        r=await self.request('PUT',f'/courses/{self.course}/sections/{sid}/access',role,json=kwargs)
        self.assertEqual(r.status_code,200,r.text)
    async def grant_item(self,iid,role='teacher',**kwargs):
        r=await self.request('PUT',f'/courses/items/{iid}/access',role,json=kwargs)
        self.assertEqual(r.status_code,200,r.text)
    async def allowed(self,iid,expected=True,kind='lessons'):
        r=await self.request('GET',f'/courses/{kind}/{iid}') if kind=='lessons' else await self.request('GET',f'/{kind}/{iid}')
        self.assertEqual(r.status_code,200 if expected else 403,r.text)
    async def group(self,code='ACCESS'):
        r=await self.request('POST','/admin/groups','admin',json={'code':code,'title':code,'capacity':20})
        self.assertEqual(r.status_code,200,r.text)
        gid=r.json()['id']
        await self.request('POST',f'/admin/courses/{self.course}/groups','admin',json={'group_id':gid})
        await self.request('POST',f'/admin/groups/{gid}/students','admin',json={'student_id':self.users['student']['id']})
        return gid

    async def test_individual_group_union_and_enrollment_gate(self):
        iid=await self.material()
        await self.allowed(iid,False)
        await self.grant_item(iid,'admin',student_ids=[self.users['student']['id']])
        await self.allowed(iid)
        gid=await self.group()
        for students,groups in [([self.users['student']['id']],[gid]),([self.users['student']['id']],[]),([],[gid])]:
            await self.grant_item(iid,student_ids=students,group_ids=groups)
            await self.allowed(iid)
        await self.pool.execute('DELETE FROM enrollments WHERE course_id=$1',self.course)
        await self.allowed(iid,False)

    async def test_section_gate_new_materials_move_and_explicit_deny(self):
        sid,other=await self.section(),await self.section('Destination')
        iid=await self.material(sid)
        await self.grant_section(sid,'admin',student_ids=[self.users['student']['id']])
        await self.allowed(iid)
        new=await self.material(sid,title='New inherited lesson')
        await self.allowed(new)
        listed=(await self.request('GET',f'/courses/{self.course}')).json()
        self.assertTrue(all(not x['locked'] for x in listed['items']))
        await self.grant_section(other,student_ids=[])
        self.assertEqual((await self.request('PATCH',f'/courses/items/{iid}/section','teacher',json={'section_id':other})).status_code,200)
        await self.allowed(iid,False)
        await self.grant_item(iid,student_ids=[self.users['student']['id']])
        await self.allowed(iid,False) # Direct grant cannot bypass section gate.
        await self.grant_section(other,student_ids=[self.users['student']['id']])
        await self.allowed(iid)
        await self.grant_item(iid,student_ids=[])
        await self.allowed(iid,False) # Last explicit grant removal must not reopen by inheritance.
        await self.grant_section(other,student_ids=[],access_restricted=False)
        await self.allowed(iid,False) # Empty material policy remains closed.
        await self.grant_item(iid,student_ids=[self.users['student']['id']])
        await self.allowed(iid)

    async def test_section_group_direct_sources_and_no_duplicate_records(self):
        sid=await self.section();iid=await self.material(sid);gid=await self.group()
        student=self.users['student']['id']
        for body in [{'student_ids':[student,student],'group_ids':[gid,gid]}, {'student_ids':[student]}, {'group_ids':[gid]}]:
            await self.grant_section(sid,**body)
            await self.grant_section(sid,**body)
            await self.allowed(iid)
            self.assertLessEqual(await self.pool.fetchval('SELECT count(*) FROM section_student_access WHERE section_id=$1',sid),1)
            self.assertLessEqual(await self.pool.fetchval('SELECT count(*) FROM section_group_access WHERE section_id=$1',sid),1)
        await self.grant_item(iid,student_ids=[student])
        await self.grant_section(sid,student_ids=[])
        await self.allowed(iid,False)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM item_student_access WHERE item_id=$1',iid),1)
        await self.grant_section(sid,access_restricted=False)
        await self.allowed(iid)

    async def test_unauthorized_targets_and_roles_atomic(self):
        sid=await self.section();iid=await self.material(sid)
        await self.grant_section(sid,student_ids=[self.users['student']['id']])
        paths=[f'/courses/{self.course}/sections/{sid}/access',f'/courses/items/{iid}/access']
        foreign=await self.pool.fetchval("INSERT INTO courses(teacher_id,title) VALUES($1,'Other owner') RETURNING id",self.users['admin']['id'])
        fs=await self.pool.fetchval("INSERT INTO course_sections(course_id,title) VALUES($1,'Other section') RETURNING id",foreign)
        self.assertEqual((await self.request('PUT',f'/courses/{foreign}/sections/{fs}/access','teacher',json={'student_ids':[]})).status_code,403)
        for path in paths:
            self.assertEqual((await self.request('PUT',path,'student',json={})).status_code,403)
            for body in [{'student_ids':[self.users['teacher']['id']]},{'group_ids':[987654321]}]:
                self.assertEqual((await self.request('PUT',path,'teacher',json=body)).status_code,422)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM section_student_access WHERE section_id=$1',sid),1)
        self.assertEqual((await self.request('PUT',paths[1],'teacher',json={'quiz_rules':{'max_attempts':2}})).status_code,422)

    async def test_quiz_inheritance_limits_deadlines_and_history(self):
        sid=await self.section();iid=await self.material(sid,'quiz');student=self.users['student']['id']
        await self.question(iid)
        await self.grant_section(sid,student_ids=[student],quiz_rules={'max_attempts':1})
        view=await self.request('GET',f'/quizzes/{iid}')
        self.assertEqual(view.status_code,200,view.text)
        self.assertEqual(view.json()['max_attempts'],1)
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,200)
        submitted=await self.request('POST',f'/quizzes/{iid}/attempt',json={'answers':[],'revision':0})
        self.assertEqual(submitted.status_code,200,submitted.text)
        before=[dict(r) for r in await self.pool.fetch('SELECT * FROM quiz_attempts WHERE quiz_id=$1',iid)]
        await self.grant_item(iid,student_ids=[student],quiz_rules={'max_attempts':3})
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,403)
        self.assertEqual((await self.request('GET',f'/quizzes/{iid}')).json()['max_attempts'],1)
        await self.pool.execute("UPDATE section_student_access SET deadline_at=now()-interval '1 minute' WHERE section_id=$1",sid)
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,403)
        await self.grant_section(sid,student_ids=[])
        self.assertEqual((await self.request('PATCH',f'/quizzes/{iid}/answers',json={'answers':[],'revision':0})).status_code,403)
        self.assertEqual((await self.request('GET',f'/quizzes/{iid}')).status_code,403)
        self.assertEqual([dict(r) for r in await self.pool.fetch('SELECT * FROM quiz_attempts WHERE quiz_id=$1',iid)],before)

    async def test_hidden_unpublished_and_search_remain_protected(self):
        sid=await self.section();iid=await self.material(sid,title='UniqueAccessSearch')
        await self.grant_section(sid,student_ids=[self.users['student']['id']])
        self.assertEqual(len((await self.request('GET','/search?q=UniqueAccessSearch')).json()['lessons']),1)
        await self.grant_section(sid,student_ids=[])
        self.assertEqual((await self.request('GET','/search?q=UniqueAccessSearch')).json()['lessons'],[])
        await self.grant_section(sid,student_ids=[self.users['student']['id']])
        await self.pool.execute('UPDATE course_items SET is_visible=false WHERE id=$1',iid)
        await self.allowed(iid,False)
        await self.pool.execute('UPDATE course_items SET is_visible=true WHERE id=$1',iid)
        await self.pool.execute('UPDATE courses SET is_published=false WHERE id=$1',self.course)
        await self.allowed(iid,False)

    async def test_homework_files_and_sequential_gates(self):
        sid=await self.section();student=self.users['student']['id']
        lesson=await self.material(sid);hw=await self.material(sid,'homework')
        uploaded=await self.request('POST','/files/upload','teacher',files={'file':('fixture.pdf',b'%PDF-1.4\nsynthetic fixture','application/pdf')})
        self.assertEqual(uploaded.status_code,200,uploaded.text)
        fid=uploaded.json()['id']
        self.assertEqual((await self.request('POST',f'/courses/lessons/{lesson}/materials','teacher',json={'kind':'file','file_id':fid,'label':'Fixture'})).status_code,200)
        await self.grant_section(sid,student_ids=[student])
        self.assertEqual((await self.request('GET',f'/files/{fid}/download')).status_code,200)
        self.assertEqual((await self.request('GET',f'/homework/{hw}')).status_code,200)
        later=await self.material(sid,title='After homework')
        await self.pool.execute('UPDATE course_items SET sequential_unlock=true WHERE id=$1',later)
        await self.allowed(later,False)
        await self.pool.execute("UPDATE homework SET close_at=now()-interval '1 minute' WHERE item_id=$1",hw)
        self.assertEqual((await self.request('POST',f'/homework/{hw}/submit',json={'comment':'test'})).status_code,403)
        await self.grant_section(sid,student_ids=[])
        self.assertEqual((await self.request('GET',f'/files/{fid}/download')).status_code,403)
        self.assertEqual((await self.request('POST',f'/homework/{hw}/submit',json={'comment':'test'})).status_code,403)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM homework_submissions WHERE homework_id=$1',hw),0)

    async def test_overlapping_section_groups_use_strictest_rules(self):
        sid=await self.section();iid=await self.material(sid,'quiz');await self.question(iid)
        student=self.users['student']['id'];g1,g2=await self.group('FIRST'),await self.group('SECOND')
        early=dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=1)
        later=early+dt.timedelta(days=1)
        await self.grant_section(sid,student_ids=[student],group_ids=[g1,g2],quiz_rules={'max_attempts':4,'deadline_at':later.isoformat()})
        await self.pool.execute('UPDATE section_group_access SET max_attempts=2,deadline_at=$2 WHERE group_id=$1',g1,early)
        before=[dict(r) for r in await self.pool.fetch('SELECT * FROM section_group_access WHERE section_id=$1 ORDER BY group_id',sid)]
        # The simplified modal sends recipients only; legacy limits are untouched.
        await self.grant_section(sid,student_ids=[student],group_ids=[g1,g2])
        after=[dict(r) for r in await self.pool.fetch('SELECT * FROM section_group_access WHERE section_id=$1 ORDER BY group_id',sid)]
        self.assertEqual(before,after)
        view=(await self.request('GET',f'/quizzes/{iid}')).json()
        self.assertEqual(view['max_attempts'],2)
        self.assertEqual(dt.datetime.fromisoformat(view['access_deadline_at']),early)
        await self.pool.execute("UPDATE section_group_access SET deadline_at=now()-interval '1 minute' WHERE group_id=$1",g1)
        denied=await self.request('POST',f'/quizzes/{iid}/start')
        self.assertEqual(denied.status_code,403,denied.text)
        self.assertIn('мерзімі',denied.json()['detail'])
        await self.grant_section(sid,student_ids=[student],group_ids=[g2])
        self.assertEqual((await self.request('GET',f'/quizzes/{iid}')).json()['max_attempts'],4)

    async def test_section_never_overrides_separate_exam_permission(self):
        sid=await self.section();iid=await self.material(sid,'quiz');await self.question(iid)
        other=await self.pool.fetchval("INSERT INTO users(email,password_hash,full_name,role) SELECT 'other-student@example.com',password_hash,'Other student','student' FROM users WHERE id=$1 RETURNING id",self.users['student']['id'])
        await self.pool.execute("INSERT INTO enrollments(course_id,student_id,status) VALUES($1,$2,'approved')",self.course,other)
        enrollment=[dict(r) for r in await self.pool.fetch('SELECT * FROM enrollments ORDER BY student_id')]
        await self.grant_item(iid,student_ids=[other],quiz_rules={'max_attempts':2})
        await self.grant_section(sid,student_ids=[self.users['student']['id']],quiz_rules={'max_attempts':5})
        for method,path,body in [('GET',f'/quizzes/{iid}',None),('POST',f'/quizzes/{iid}/start',None),('PATCH',f'/quizzes/{iid}/answers',{'answers':[],'revision':0}),('POST',f'/quizzes/{iid}/attempt',{'answers':[],'revision':0})]:
            response=await self.request(method,path,**({'json':body} if body else {}))
            self.assertEqual(response.status_code,403,response.text)
        listing=(await self.request('GET',f'/courses/{self.course}')).json()
        self.assertTrue(listing['items'][0]['locked'])
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM quiz_starts WHERE quiz_id=$1',iid),0)
        self.assertEqual([dict(r) for r in await self.pool.fetch('SELECT * FROM enrollments ORDER BY student_id')],enrollment)

    async def test_assessment_rechecks_revocation_after_initial_access_check(self):
        from unittest.mock import patch, AsyncMock
        sid=await self.section();iid=await self.material(sid,'quiz');await self.question(iid)
        await self.grant_section(sid,student_ids=[self.users['student']['id']])
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,200)
        item=dict(await self.pool.fetchrow('SELECT * FROM course_items WHERE id=$1',iid))
        course=dict(await self.pool.fetchrow('SELECT * FROM courses WHERE id=$1',self.course))
        await self.grant_section(sid,student_ids=[])
        # Simulate an access check completed just before a concurrent revocation.
        with patch('routers.quizzes.ensure_item_access',AsyncMock(return_value=(item,course))):
            for method,path,body in [('POST',f'/quizzes/{iid}/start',None),('PATCH',f'/quizzes/{iid}/answers',{'answers':[],'revision':0}),('POST',f'/quizzes/{iid}/attempt',{'answers':[],'revision':0})]:
                response=await self.request(method,path,**({'json':body} if body else {}))
                self.assertEqual(response.status_code,403,response.text)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM quiz_attempts WHERE quiz_id=$1',iid),0)
