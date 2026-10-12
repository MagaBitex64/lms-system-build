"""Release regressions on a disposable DB only.

RUN_RELEASE_TESTS=1 DATABASE_URL=...@auditdb/... python -m unittest tests.test_release -v
The isolated schema is dropped after each case; no application tables are used.
"""
import asyncio
import datetime as dt
import hashlib
import json
import os
import tempfile
import unittest
import uuid
from unittest.mock import patch
from urllib.parse import urlparse
import asyncpg
import httpx
from core import db, security
from core.config import DATABASE_URL
from core.security import create_access_token
from core.quiz_attempts import finalize_expired_quizzes
from main import app
from scripts import init_db
from storage.local import storage
from tests.test_ent_rules import fixture
from routers.ent_trial import make_snapshot


@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS')=='1', 'Explicit disposable database required')
class ReleaseTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.assertEqual(urlparse(DATABASE_URL).hostname,'auditdb')
        self.schema = 'release_'+uuid.uuid4().hex
        self.connection = await asyncpg.connect(DATABASE_URL)
        await self.connection.execute(f'CREATE SCHEMA "{self.schema}"')
        self.addAsyncCleanup(self.cleanup)
        real_connect = asyncpg.connect
        async def connect(*args,**kwargs):
            kwargs['server_settings']={'search_path':self.schema}
            return await real_connect(*args,**kwargs)
        with patch.object(init_db.asyncpg,'connect',connect):
            await init_db.main()
        self.pool = await asyncpg.create_pool(DATABASE_URL,min_size=1,max_size=10,server_settings={'search_path':self.schema})
        db._pool=self.pool
        db._pool_lock=asyncio.Lock()
        security._password_slots=asyncio.Semaphore(8)
        self.upload_dir=tempfile.TemporaryDirectory()
        self.old_upload_dir=storage.base_dir
        storage.base_dir=self.upload_dir.name
        self.users={}
        for role in ('admin','teacher','student'):
            self.users[role]=dict(await self.pool.fetchrow("INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,$3) RETURNING *",role+'@example.com',security.hash_password('Release-only-password!'),role))
        self.headers={role:{'Authorization':'Bearer '+create_access_token(u['id'],role,u['auth_version'])} for role,u in self.users.items()}
        self.client=httpx.AsyncClient(transport=httpx.ASGITransport(app=app,raise_app_exceptions=False),base_url='http://audit')
        self.course=await self.pool.fetchval("INSERT INTO courses(teacher_id,title,is_published) VALUES($1,'Release course',true) RETURNING id",self.users['teacher']['id'])
        await self.pool.execute("INSERT INTO enrollments(course_id,student_id,status) VALUES($1,$2,'approved')",self.course,self.users['student']['id'])

    async def cleanup(self):
        if hasattr(self,'client'):await self.client.aclose()
        if hasattr(self,'pool'):await self.pool.close()
        db._pool=None
        if hasattr(self,'old_upload_dir'):storage.base_dir=self.old_upload_dir;self.upload_dir.cleanup()
        await self.connection.execute(f'DROP SCHEMA "{self.schema}" CASCADE')
        await self.connection.close()

    async def request(self,method,path,role='student',**kwargs):
        return await self.client.request(method,path,headers=self.headers[role],**kwargs)

    async def item(self,kind='quiz',position=0):
        iid=await self.pool.fetchval('INSERT INTO course_items(course_id,type,title,position) VALUES($1,$2,$2,$3) RETURNING id',self.course,kind,position)
        await self.pool.execute('INSERT INTO item_student_access(item_id,student_id) VALUES($1,$2)',iid,self.users['student']['id'])
        await self.pool.execute(f'INSERT INTO {"quizzes" if kind=="quiz" else "homework" if kind=="homework" else "lessons"}(item_id) VALUES($1)',iid)
        return iid

    async def quiz(self,timed=True):
        iid=await self.item()
        if timed:await self.pool.execute('UPDATE quizzes SET time_limit_minutes=1 WHERE item_id=$1',iid)
        qid=await self.pool.fetchval("INSERT INTO quiz_questions(quiz_id,type,prompt,points) VALUES($1,'single','2+2?',1) RETURNING id",iid)
        oid=await self.pool.fetchval("INSERT INTO question_options(question_id,text,is_correct) VALUES($1,'4',true) RETURNING id",qid)
        await self.pool.execute("INSERT INTO question_options(question_id,text,is_correct) VALUES($1,'5',false)",qid)
        return iid,qid,oid

    async def test_production_admin_bootstrap_is_single_and_idempotent(self):
        from pathlib import Path
        from scripts.bootstrap_admin import provision_admin
        from routers import admin as admin_router
        email = 'nurdildanurasyl7@gmail.com'
        secret = Path(self.upload_dir.name) / 'admin-secret'
        secret.write_text('Disposable-admin-password!', encoding='utf-8')
        async def provision():
            async with self.pool.acquire() as conn:
                await provision_admin(conn, email, str(secret))
        await asyncio.gather(provision(), provision())
        admins = await self.pool.fetch("SELECT * FROM users WHERE role='admin'")
        self.assertEqual(len(admins), 1)
        admin = admins[0]
        self.assertEqual(admin['email'], email)
        self.assertFalse(admin['is_blocked'])
        self.assertTrue(security.verify_password('Disposable-admin-password!', admin['password_hash']))
        old = await self.pool.fetchrow('SELECT * FROM users WHERE id=$1',self.users['admin']['id'])
        self.assertEqual(old['role'], 'teacher')
        self.assertTrue(old['is_blocked'])
        self.assertEqual(old['auth_version'], self.users['admin']['auth_version']+1)
        self.assertEqual((await self.request('GET','/admin/users',role='admin')).status_code,401)
        new_hash = await security.hash_password_async('Changed-admin-password!')
        await self.pool.execute('UPDATE users SET password_hash=$1,auth_version=auth_version+1 WHERE id=$2',new_hash,admin['id'])
        secret.unlink()
        await provision()  # Works without secret after first provisioning; no password reset.
        current = await self.pool.fetchrow('SELECT * FROM users WHERE id=$1',admin['id'])
        self.assertEqual(current['password_hash'],new_hash)
        self.assertEqual(current['auth_version'],admin['auth_version']+1)
        with self.assertRaises(asyncpg.UniqueViolationError):
            await self.pool.execute("UPDATE users SET role='admin' WHERE id=$1",self.users['student']['id'])
        headers={'Authorization':'Bearer '+create_access_token(current['id'],'admin',current['auth_version'])}
        with patch.object(admin_router,'APP_ENV','production'), patch.object(admin_router,'PRODUCTION_ADMIN_EMAIL',email):
            self.assertEqual((await self.client.post('/admin/users',headers=headers,json={
                'email':'second-admin@example.com','password':'Another-admin-password!',
                'full_name':'Second admin','role':'admin'})).status_code,422)
            self.assertEqual((await self.client.patch(f"/admin/users/{self.users['student']['id']}",headers=headers,json={'role':'admin'})).status_code,422)
            self.assertEqual((await self.client.post(f"/admin/users/{self.users['student']['id']}/role",headers=headers,json={'role':'admin'})).status_code,422)
            self.assertEqual((await self.client.patch(f"/admin/users/{current['id']}",headers=headers,json={'email':'renamed@example.com'})).status_code,422)
            self.assertEqual((await self.client.post(f"/admin/users/{current['id']}/block",headers=headers,json={'is_blocked':True})).status_code,422)
            self.assertEqual((await self.client.delete(f"/admin/users/{current['id']}",headers=headers)).status_code,422)

    async def test_production_admin_bootstrap_rolls_back_invalid_secret(self):
        from pathlib import Path
        from scripts.bootstrap_admin import provision_admin
        from fastapi import HTTPException
        secret = Path(self.upload_dir.name) / 'invalid-secret'
        secret.write_text('short',encoding='utf-8')
        async with self.pool.acquire() as conn:
            with self.assertRaises(HTTPException):
                await provision_admin(conn,'nurdildanurasyl7@gmail.com',str(secret))
        current = await self.pool.fetchrow('SELECT * FROM users WHERE id=$1',self.users['admin']['id'])
        self.assertEqual(current['role'],'admin')
        self.assertFalse(current['is_blocked'])
        self.assertIsNone(await self.pool.fetchval("SELECT to_regclass('production_admin_bootstrap')"))

    async def test_grade_overview_and_resubmission(self):
        iid=await self.item('homework')
        await self.pool.execute('UPDATE homework SET weight_pct=100 WHERE item_id=$1',iid)
        r=await self.request('GET','/grades/my');self.assertEqual(r.status_code,200,r.text)
        r=await self.request('POST',f'/homework/{iid}/submit',json={'comment':'first'})
        sid=r.json()['submission_id']
        self.assertEqual((await self.request('POST',f'/homework/submissions/{sid}/grade','teacher',json={'grade':90,'feedback':'first'})).status_code,200)
        rs=await asyncio.gather(*[self.request('POST',f'/homework/{iid}/submit',json={'comment':str(i)}) for i in range(2)])
        self.assertEqual([r.status_code for r in rs],[200,200])
        row=await self.pool.fetchrow('SELECT grade,feedback,status FROM homework_submissions WHERE id=$1',sid)
        self.assertIsNone(row['grade']);self.assertEqual(row['feedback'],'');self.assertEqual(row['status'],'submitted')
        self.assertEqual((await self.request('GET',f'/grades/gradebook/{self.course}','teacher')).status_code,200)

    async def test_stale_homework_grade_is_rejected_after_resubmit(self):
        iid=await self.item('homework')
        sid=(await self.request('POST',f'/homework/{iid}/submit',json={'comment':'old'})).json()['submission_id']
        listing=(await self.request('GET',f'/homework/{iid}/submissions','teacher')).json()['submissions'][0]
        await self.request('POST',f'/homework/{iid}/submit',json={'comment':'new'})
        stale=await self.request('POST',f'/homework/submissions/{sid}/grade','teacher',json={'grade':90,'revision':listing['revision']})
        self.assertEqual(stale.status_code,409,stale.text)
        current=(await self.request('GET',f'/homework/{iid}/submissions','teacher')).json()['submissions'][0]
        graded=await self.request('POST',f'/homework/submissions/{sid}/grade','teacher',json={'grade':70,'revision':current['revision']})
        self.assertEqual(graded.status_code,200,graded.text)

    async def test_quiz_start_save_replay_expiry_and_restore(self):
        iid,qid,oid=await self.quiz()
        before=(await self.request('GET',f'/quizzes/{iid}')).json()
        self.assertFalse(before['quiz_started']);self.assertEqual(before['question_count'],1);self.assertEqual(before['questions'],[])
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,200)
        body={'revision':0,'request_id':str(uuid.uuid4()),'answers':[{'question_id':qid,'selected_option_ids':[oid]}]}
        one=await self.request('PATCH',f'/quizzes/{iid}/answers',json=body);self.assertEqual(one.status_code,200,one.text)
        replay=await self.request('PATCH',f'/quizzes/{iid}/answers',json=body);self.assertEqual(replay.json()['revision'],1)
        other=await self.request('PATCH',f'/quizzes/{iid}/answers',json={**body,'request_id':str(uuid.uuid4())});self.assertEqual(other.status_code,409)
        read=(await self.request('GET',f'/quizzes/{iid}')).json()
        self.assertEqual(read['saved_answers'][str(qid)]['selected_option_ids'],[oid]);self.assertTrue(read['quiz_started'])
        await self.pool.execute("UPDATE quiz_starts SET deadline_at=now()-interval '1 second' WHERE quiz_id=$1",iid)
        late=await self.request('POST',f'/quizzes/{iid}/attempt',json={'revision':1,'answers':[{'question_id':qid,'selected_option_ids':[]}]})
        self.assertEqual(late.status_code,200,late.text);self.assertEqual(late.json()['auto_score'],100)
        again=await self.request('POST',f'/quizzes/{iid}/attempt',json={'revision':1,'answers':[]});self.assertEqual(again.json()['attempt_id'],late.json()['attempt_id'])

    async def test_quiz_worker_grades_saved_answers_and_rejects_edits(self):
        iid,qid,oid=await self.quiz()
        await self.request('POST',f'/quizzes/{iid}/start')
        for path,method,body in [(f'/quizzes/{iid}/questions','POST',{'type':'single','prompt':'new','options':[{'text':'A','is_correct':True},{'text':'B'}]}),
                                (f'/quizzes/{iid}/settings','PUT',{'max_score':200,'weight_pct':100})]:
            r=await self.request(method,path,'teacher',json=body);self.assertEqual(r.status_code,409,r.text)
        r=await self.request('PATCH',f'/quizzes/{iid}/answers',json={'revision':0,'answers':[{'question_id':qid,'selected_option_ids':[oid]}]});self.assertEqual(r.status_code,200,r.text)
        await self.pool.execute("UPDATE quiz_starts SET deadline_at=now()-interval '1 second' WHERE quiz_id=$1",iid)
        await finalize_expired_quizzes(self.pool)
        row=await self.pool.fetchrow('SELECT auto_score FROM quiz_attempts WHERE quiz_id=$1',iid);self.assertEqual(float(row['auto_score']),100)

    async def test_close_only_quiz_has_future_server_timer(self):
        iid,qid,oid=await self.quiz(False)
        await self.pool.execute("UPDATE quizzes SET close_at=now()+interval '1 hour' WHERE item_id=$1",iid)
        await self.request('POST',f'/quizzes/{iid}/start')
        read=(await self.request('GET',f'/quizzes/{iid}')).json()
        self.assertIsNone(read['time_limit_minutes']);self.assertGreater(read['remaining_seconds'],3500)
        self.assertIsNone(read['attempt'])

    async def test_shared_file_and_access_gates(self):
        lesson=await self.item('lesson',1)
        r=await self.request('POST','/files/upload','teacher',files={'file':('shared.txt',b'hello','text/plain')});self.assertEqual(r.status_code,200,r.text)
        fid=r.json()['id']
        mats=[]
        for label in ('A','B'):
            r=await self.request('POST',f'/courses/lessons/{lesson}/materials','teacher',json={'kind':'file','file_id':fid,'label':label});mats.append(r.json()['id'])
        self.assertEqual((await self.request('DELETE',f'/courses/materials/{mats[0]}','teacher')).status_code,200)
        self.assertEqual((await self.request('GET',f'/files/{fid}/download')).status_code,200)
        anon=await self.client.get(f'/files/{fid}/download?token='+self.headers['student']['Authorization'][7:]);self.assertEqual(anon.status_code,401)
        await self.pool.execute('UPDATE courses SET is_published=false WHERE id=$1',self.course)
        self.assertEqual((await self.request('GET',f'/files/{fid}/download')).status_code,403)
        self.assertEqual((await self.request('GET',f'/grades/my/{self.course}')).status_code,403)
        await self.pool.execute('UPDATE courses SET is_published=true WHERE id=$1',self.course)
        await self.quiz()
        await self.pool.execute('UPDATE course_items SET sequential_unlock=true WHERE id=$1',lesson)
        self.assertEqual((await self.request('GET',f'/files/{fid}/download')).status_code,403)

    async def test_history_deletions_are_rejected(self):
        iid,qid,oid=await self.quiz();await self.request('POST',f'/quizzes/{iid}/start')
        for path,role in [(f'/courses/{self.course}','teacher'),(f'/courses/items/{iid}','teacher'),(f'/admin/users/{self.users["student"]["id"]}','admin')]:
            r=await self.request('DELETE',path,role);self.assertEqual(r.status_code,409,r.text)
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM quiz_starts WHERE quiz_id=$1',iid),1)
        group=await self.pool.fetchval("INSERT INTO groups(code,title,direction,stream) VALUES('G','group','x','1') RETURNING id")
        vid=await self.pool.fetchval("INSERT INTO ent_variants(title,course_id) VALUES('protected',$1) RETURNING id",self.course)
        aid=await self.pool.fetchval("INSERT INTO ent_trial_accesses(granted_by_id,variant_id,combination,target_type,group_id) VALUES($1,$2,'infmat','group',$3) RETURNING id",self.users['admin']['id'],vid,group)
        await self.pool.execute("INSERT INTO ent_trial_attempts(access_id,student_id,variant_id,combination) VALUES($1,$2,$3,'infmat')",aid,self.users['student']['id'],vid)
        self.assertEqual((await self.request('DELETE',f'/admin/groups/{group}','admin')).status_code,409)

    async def test_capacity_concurrent_and_cannot_shrink(self):
        group=await self.pool.fetchval("INSERT INTO groups(code,title,direction,stream,capacity) VALUES('G','group','x','1',1) RETURNING id")
        second=await self.pool.fetchval("INSERT INTO users(email,password_hash,full_name,role) VALUES('second@example.com','unused','second','student') RETURNING id")
        rs=await asyncio.gather(*[self.request('POST',f'/admin/groups/{group}/students','admin',json={'student_id':uid}) for uid in (self.users['student']['id'],second)])
        self.assertEqual(sorted(r.status_code for r in rs),[200,422]);self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM group_students WHERE group_id=$1',group),1)
        await self.pool.execute('UPDATE groups SET capacity=2 WHERE id=$1',group)
        for uid in (self.users['student']['id'],second):await self.request('POST',f'/admin/groups/{group}/students','admin',json={'student_id':uid})
        self.assertEqual((await self.request('PATCH',f'/admin/groups/{group}','admin',json={'capacity':1})).status_code,422)

    async def test_concurrent_manual_grading_is_consistent(self):
        iid=await self.item()
        qs=[await self.pool.fetchval("INSERT INTO quiz_questions(quiz_id,type,prompt,points) VALUES($1,'long_text','manual',1) RETURNING id",iid) for _ in range(2)]
        attempt=await self.pool.fetchval("INSERT INTO quiz_attempts(quiz_id,student_id,status) VALUES($1,$2,'pending_review') RETURNING id",iid,self.users['student']['id'])
        answers=[await self.pool.fetchval('INSERT INTO attempt_answers(attempt_id,question_id) VALUES($1,$2) RETURNING id',attempt,q) for q in qs]
        rs=await asyncio.gather(*[self.request('POST',f'/quizzes/answers/{aid}/grade','teacher',json={'awarded_points':1}) for aid in answers]);self.assertEqual([r.status_code for r in rs],[200,200])
        row=await self.pool.fetchrow('SELECT manual_score,status FROM quiz_attempts WHERE id=$1',attempt)
        self.assertEqual(float(row['manual_score']),100);self.assertEqual(row['status'],'graded')

    async def test_pending_ent_snapshot_hidden_and_migrations_repeat(self):
        vid=await self.pool.fetchval("INSERT INTO ent_variants(title,combination,exam_mode,single_subject) VALUES('single','infmat','single','math_literacy') RETURNING id")
        access=await self.pool.fetchval("INSERT INTO ent_trial_accesses(granted_by_id,variant_id,combination,target_type) VALUES($1,$2,'infmat','all') RETURNING id",self.users['admin']['id'],vid)
        v,qs,cs=fixture();snapshot=make_snapshot(v,qs,cs)
        aid=await self.pool.fetchval("INSERT INTO ent_trial_attempts(access_id,student_id,variant_id,combination,snapshot,deadline_at) VALUES($1,$2,$3,'infmat',$4::jsonb,NULL) RETURNING id",access,self.users['student']['id'],vid,json.dumps(snapshot))
        read=(await self.request('GET',f'/ent-trial/attempts/{aid}')).json();self.assertEqual(sum(map(len,read['questions'].values())),0);self.assertTrue(read['requires_proctor_setup'])
        real_connect=asyncpg.connect
        async def connect(*args,**kwargs):kwargs['server_settings']={'search_path':self.schema};return await real_connect(*args,**kwargs)
        for _ in range(2):
            with patch.object(init_db.asyncpg,'connect',connect):await init_db.main()
        row=await self.pool.fetchrow('SELECT deadline_at,activated_at,proctor_status FROM ent_trial_attempts WHERE id=$1',aid)
        self.assertIsNone(row['deadline_at']);self.assertIsNone(row['activated_at']);self.assertEqual(row['proctor_status'],'pending')

    async def test_http_limits_password_validation_rate_limits_and_logout(self):
        anon=await self.client.post('/files/upload',content=b'x'*100,headers={'Content-Type':'multipart/form-data; boundary=x'});self.assertEqual(anon.status_code,401)
        large=await self.client.post('/leads',content=b'x'*(2*1024*1024+1));self.assertEqual(large.status_code,413)
        long=await self.request('POST','/admin/users','admin',json={'email':'long@example.com','password':'я'*40,'full_name':'long','role':'student'});self.assertEqual(long.status_code,422,long.text)
        for _ in range(10):r=await self.client.post('/auth/login',json={'email':'student@example.com','password':'wrong'})
        self.assertEqual(r.status_code,401,r.text)
        r=await self.client.post('/auth/login',json={'email':'student@example.com','password':'wrong'});self.assertEqual(r.status_code,429,r.text)
        self.assertEqual((await self.request('POST','/auth/logout')).status_code,200)
        self.assertEqual((await self.request('GET','/auth/me')).status_code,401)

    async def test_server_search_can_find_student_beyond_first_page(self):
        await self.pool.executemany("INSERT INTO users(email,password_hash,full_name,role) VALUES($1,'unused',$2,'student')",[(f'cohort{i}@example.com',f'Cohort {i}') for i in range(200)])
        r=await self.request('GET','/admin/users?role=student&per_page=50&page=4','admin');self.assertEqual(len(r.json()['items']),50)
        r=await self.request('GET','/admin/users?role=student&q=Cohort%20199','admin');self.assertEqual(len(r.json()['items']),1)
        r=await self.request('GET','/courses?q=teacher');self.assertEqual(r.json()['items'][0]['id'],self.course)

    async def test_leaderboard_top_100_has_complete_counts_and_proctor_pagination(self):
        access=await self.pool.fetchval("INSERT INTO ent_trial_accesses(granted_by_id,combination,target_type) VALUES($1,'infmat','all') RETURNING id",self.users['admin']['id'])
        v,qs,cs=fixture();snapshot=make_snapshot(v,qs,cs)
        for i in range(110):
            aid=await self.pool.fetchval("""INSERT INTO ent_trial_attempts(access_id,student_id,combination,snapshot,status,submitted_at,total_score,scores_by_subject)
                VALUES($1,$2,'infmat',$3::jsonb,'submitted',now(),$4,'{"mathematics":20}'::jsonb) RETURNING id""",access,self.users['student']['id'],json.dumps(snapshot),i)
        r=await self.request('GET','/ent-trial/leaderboard');self.assertEqual(r.status_code,200,r.text)
        general=r.json()['general'];self.assertEqual(len(general['items']),100);self.assertEqual(general['completed_attempt_count'],110);self.assertEqual(general['participant_count'],1);self.assertEqual(general['items'][0]['score'],109)
        await self.pool.executemany("INSERT INTO ent_proctor_events(attempt_id,event_type) VALUES($1,'copy')",[(aid,) for _ in range(205)])
        r=await self.request('GET',f'/ent-trial/admin/attempts/{aid}/proctor-events?page=3','admin');self.assertEqual(len(r.json()['items']),5);self.assertEqual(r.json()['total'],205)

    async def test_upgrade_without_journal_preserves_modern_and_converts_only_legacy(self):
        access=await self.pool.fetchval("INSERT INTO ent_trial_accesses(granted_by_id,combination,target_type,allow_retake) VALUES($1,'infmat','all',true) RETURNING id",self.users['admin']['id'])
        v,qs,cs=fixture();snapshot=make_snapshot(v,qs,cs)
        modern=await self.pool.fetchval("INSERT INTO ent_trial_attempts(access_id,student_id,combination,snapshot) VALUES($1,$2,'infmat',$3::jsonb) RETURNING id",access,self.users['student']['id'],json.dumps(snapshot))
        frozen={'version':'legacy','questions':[{} for _ in range(10)]}
        legacy=await self.pool.fetchval("INSERT INTO ent_trial_attempts(access_id,student_id,combination,snapshot) VALUES($1,$2,'infmat',$3::jsonb) RETURNING id",access,self.users['student']['id'],json.dumps(frozen))
        for i in range(10):
            uid=await self.pool.fetchval("INSERT INTO users(email,password_hash,full_name,role) VALUES($1,'unused','legacy','student') RETURNING id",f'legacy{i}@example.com')
            await self.pool.execute("INSERT INTO ent_trial_attempts(access_id,student_id,combination,status) VALUES($1,$2,'infmat','submitted')",access,uid)
        await self.pool.execute('DROP TABLE schema_migrations')
        real_connect=asyncpg.connect
        async def connect(*args,**kwargs):kwargs['server_settings']={'search_path':self.schema};return await real_connect(*args,**kwargs)
        with patch.object(init_db.asyncpg,'connect',connect):await init_db.main()
        current=await self.pool.fetchrow('SELECT deadline_at,proctor_status FROM ent_trial_attempts WHERE id=$1',modern)
        self.assertIsNone(current['deadline_at']);self.assertEqual(current['proctor_status'],'pending')
        old=await self.pool.fetchrow('SELECT deadline_at-started_at duration,proctor_status FROM ent_trial_attempts WHERE id=$1',legacy)
        self.assertEqual(old['duration'],dt.timedelta(minutes=20));self.assertEqual(old['proctor_status'],'legacy')
        self.assertEqual(await self.pool.fetchval('SELECT max_attempts FROM ent_trial_accesses WHERE id=$1',access),3)

    async def test_concurrent_start_and_authoring_freeze(self):
        for _ in range(5):
            iid,qid,oid=await self.quiz()
            rs=await asyncio.gather(self.request('POST',f'/quizzes/{iid}/start'),self.request('POST',f'/quizzes/{iid}/questions','teacher',json={'type':'single','prompt':'race','options':[{'text':'A','is_correct':True},{'text':'B'}]}))
            self.assertEqual(rs[0].status_code,200,rs[0].text)
            self.assertIn(rs[1].status_code,(200,409),rs[1].text)
            frozen=await self.request('DELETE',f'/quizzes/questions/{qid}','teacher');self.assertEqual(frozen.status_code,409,frozen.text)
