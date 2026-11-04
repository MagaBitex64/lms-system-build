"""Durable timing and release classification on disposable PostgreSQL only."""
import os
import asyncio
import datetime as dt
import json
import unittest
from pathlib import Path
from unittest.mock import patch
from tests import test_ent_integration as ent_fixture
from tests import test_release as release
from routers import ent_trial as ent
from core import quiz_attempts


class EntTimerTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = ent_fixture.EntIntegrationTests.asyncSetUp
    cleanup_database = ent_fixture.EntIntegrationTests.cleanup_database
    fill_single_variant = ent_fixture.EntIntegrationTests.fill_single_variant

    async def create_attempt(self):
        self.actor = self.users['admin']
        r = await self.client.post('/ent-trial/admin/variants',json={'title':'Timer fixture','exam_mode':'single','single_subject':'informatics','combination':'infmat'})
        self.assertEqual(r.status_code,200,r.text)
        vid=r.json()['id']
        await self.fill_single_variant(vid,'informatics')
        r=await self.client.post('/ent-trial/admin/accesses',json={'variant_id':vid,'target_type':'all'})
        self.assertEqual(r.status_code,200,r.text)
        access=r.json()['id']
        self.actor=self.users['student']
        r=await self.client.post(f'/ent-trial/accesses/{access}/start')
        self.assertEqual(r.status_code,200,r.text)
        return access,r.json()['attempt_id']

    async def test_created_activation_resume_expiry_and_late_writes(self):
        access,aid=await self.create_attempt()
        path=f'/ent-trial/attempts/{aid}'
        created=(await self.client.get(path)).json()
        self.assertEqual(created['lifecycle'],'created')
        self.assertIsNone(created['started_at'])
        self.assertIsNone(created['expires_at'])
        self.assertEqual((await self.client.post(f'/ent-trial/accesses/{access}/start')).json()['attempt_id'],aid)
        active={'session_id':'timer-test-session','camera_active':True,'screen_active':True,'fullscreen':True}
        self.assertEqual((await self.client.post(path+'/proctor/activate',json=active|{'screen_active':False})).status_code,422)
        self.assertIsNone(await self.conn.fetchval('SELECT deadline_at FROM ent_trial_attempts WHERE id=$1',aid))
        caps=(await self.client.post(path+'/proctor/activate',json=active)).json()
        first=dict(await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',aid))
        q=ent.decoded(first['snapshot'])['questions'][0]
        answer={'question_id':q['question_id'],'selected_option_id':next(o['id'] for o in q['options'] if o['is_correct'])}
        body={'session_id':active['session_id'],'proctor_token':caps['proctor_token'],'revision':0,'answers':[answer]}
        self.assertEqual((await self.client.patch(path+'/answers',json=body)).status_code,200)
        saved=await self.conn.fetchval('SELECT responses FROM ent_trial_attempts WHERE id=$1',aid)
        await self.conn.execute("UPDATE ent_trial_attempts SET proctor_last_seen_at=now()-interval '1 hour' WHERE id=$1",aid)
        resumed=(await self.client.get(path)).json()
        self.assertEqual(resumed['lifecycle'],'active')
        self.assertEqual(resumed['deadline_at'],caps['deadline_at'])
        self.assertEqual((await self.client.patch(path+'/answers',json=body|{'revision':1})).status_code,403)
        again=(await self.client.post(path+'/proctor/activate',json=active)).json()
        self.assertEqual(again['expires_at'],caps['expires_at'])
        self.assertEqual(again['started_at'],caps['started_at'])
        self.assertEqual(await self.conn.fetchval('SELECT responses FROM ent_trial_attempts WHERE id=$1',aid),saved)
        # Close/disconnect/logout are no-ops on persisted timing. Simulate elapsed
        # server time only in this disposable fixture, then run the actual worker scan.
        await self.conn.execute("UPDATE ent_trial_attempts SET deadline_at=now()-interval '1 second' WHERE id=$1",aid)
        await ent.finalize_expired()
        before=dict(await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',aid))
        await ent.finalize_expired()
        late=(await self.client.patch(path+'/answers',json=body|{'revision':1,'answers':[]})).json()
        self.assertEqual(late['status'],'submitted')
        final=(await self.client.get(path)).json()
        self.assertEqual(final['lifecycle'],'expired')
        self.assertEqual(final['scores']['total'],1)
        self.assertEqual(final['remaining_seconds'],0)
        self.assertEqual(await self.conn.fetchval('SELECT responses FROM ent_trial_attempts WHERE id=$1',aid),saved)
        after=dict(await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',aid))
        self.assertEqual(before,after)
        reactivation=(await self.client.post(path+'/proctor/activate',json=active)).json()
        self.assertEqual(reactivation['status'],'submitted')
        self.assertNotIn('proctor_token',reactivation)
        self.assertEqual(await self.conn.fetchval('SELECT count(*) FROM ent_trial_attempts WHERE access_id=$1',access),1)

    async def test_sixty_minutes_close_at_twenty_return_at_forty_five(self):
        _, aid = await self.create_attempt()
        await self.conn.execute("UPDATE ent_trial_attempts SET snapshot=jsonb_set(snapshot,'{duration_seconds}','3600') WHERE id=$1", aid)
        path = f'/ent-trial/attempts/{aid}'
        start = ent.now()
        active = {'session_id':'sixty-minute-session','camera_active':True,'screen_active':True,'fullscreen':True}
        with patch.object(ent, 'now', return_value=start):
            activated = (await self.client.post(path+'/proctor/activate', json=active)).json()
            self.assertEqual(activated['remaining_seconds'], 3600)
        # No requests while closed; the persisted deadline is independent of clients.
        with patch.object(ent, 'now', return_value=start+dt.timedelta(minutes=20)):
            self.assertEqual((await self.client.get(path)).json()['remaining_seconds'], 2400)
        with patch.object(ent, 'now', return_value=start+dt.timedelta(minutes=45)):
            resumed = (await self.client.get(path)).json()
            self.assertEqual(resumed['remaining_seconds'], 900)
            self.assertEqual(resumed['deadline_at'], activated['deadline_at'])
            again = (await self.client.post(path+'/proctor/activate', json=active)).json()
            self.assertEqual(again['remaining_seconds'], 900)
            self.assertEqual(again['expires_at'], activated['expires_at'])

    async def test_never_activated_is_not_expired_or_consumed_again(self):
        access,aid=await self.create_attempt()
        await self.conn.execute("UPDATE ent_trial_attempts SET started_at=now()-interval '15 days' WHERE id=$1",aid)
        before=dict(await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',aid))
        await ent.finalize_expired()
        self.assertEqual(before,dict(await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',aid)))
        self.assertEqual((await self.client.post(f'/ent-trial/accesses/{access}/start')).json()['attempt_id'],aid)
        self.assertEqual(await self.conn.fetchval('SELECT count(*) FROM ent_trial_attempts WHERE access_id=$1',access),1)

    async def test_deployment_classifier_pending_active_expired_ambiguous(self):
        _,aid=await self.create_attempt()
        from scripts.topical_migrations import TOPICAL_MIGRATIONS
        from scripts.init_db import RELEASE_MIGRATIONS
        for migration in RELEASE_MIGRATIONS + TOPICAL_MIGRATIONS:
            await self.conn.execute(migration)
        sql=(Path('/app/deploy/exam-window.sql') if Path('/app/deploy/exam-window.sql').exists() else Path(__file__).resolve().parents[2]/'deploy/exam-window.sql').read_text()
        self.assertEqual(await self.conn.fetchval(sql),0)
        await self.conn.execute("UPDATE ent_trial_attempts SET response_revision=1 WHERE id=$1",aid)
        self.assertEqual(await self.conn.fetchval(sql),1)  # Ambiguous never silently ignored.
        await self.conn.execute("UPDATE ent_trial_attempts SET response_revision=0,deadline_at=now()+interval '1 hour',proctor_last_seen_at=now()-interval '1 day' WHERE id=$1",aid)
        self.assertEqual(await self.conn.fetchval(sql),1)  # Missing heartbeat does NOT stop a timer.
        await self.conn.execute("UPDATE ent_trial_attempts SET deadline_at=now()-interval '1 second' WHERE id=$1",aid)
        self.assertEqual(await self.conn.fetchval(sql),0)


@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS')=='1','Requires disposable auditdb')
class TopicalTimerTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp=release.ReleaseTests.asyncSetUp
    cleanup=release.ReleaseTests.cleanup
    request=release.ReleaseTests.request
    item=release.ReleaseTests.item
    quiz=release.ReleaseTests.quiz

    async def test_worker_after_disconnect_restart_is_idempotent_and_rejects_late_answers(self):
        iid,qid,oid=await self.quiz()
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,200)
        data=(await self.request('GET',f'/quizzes/{iid}')).json()
        self.assertEqual(data['lifecycle'],'active')
        deadline=data['attempt_deadline_at']
        body={'revision':0,'attempt_number':1,'answers':[{'question_id':qid,'selected_option_ids':[oid]}]}
        self.assertEqual((await self.request('PATCH',f'/quizzes/{iid}/answers',json=body)).status_code,200)
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,200)
        returned=(await self.request('GET',f'/quizzes/{iid}')).json()
        self.assertEqual(returned['attempt_deadline_at'],deadline)
        self.assertEqual(returned['saved_answers'][str(qid)]['selected_option_ids'],[oid])
        await self.pool.execute("UPDATE quiz_starts SET deadline_at=now()-interval '1 second' WHERE quiz_id=$1",iid)
        # A new DB connection / restarted worker discovers expired persisted rows.
        await quiz_attempts.finalize_expired_quizzes(self.pool)
        first=dict(await self.pool.fetchrow('SELECT * FROM quiz_attempts WHERE quiz_id=$1',iid))
        await asyncio.gather(quiz_attempts.finalize_expired_quizzes(self.pool),quiz_attempts.finalize_expired_quizzes(self.pool))
        self.assertEqual(first['auto_score'],100)
        self.assertEqual(first['completion_reason'],'expired')
        late=await self.request('PATCH',f'/quizzes/{iid}/answers',json=body|{'revision':1,'answers':[]})
        self.assertEqual(late.status_code,200,late.text)
        self.assertTrue(late.json()['submitted'])
        self.assertEqual(first,dict(await self.pool.fetchrow('SELECT * FROM quiz_attempts WHERE quiz_id=$1',iid)))
        self.assertEqual(await self.pool.fetchval('SELECT count(*) FROM quiz_attempts WHERE quiz_id=$1',iid),1)
        self.assertEqual((await self.request('GET',f'/quizzes/{iid}')).json()['lifecycle'],'expired')

    async def test_sixty_minutes_close_at_twenty_return_at_forty_five(self):
        from routers import quizzes
        iid, qid, oid = await self.quiz()
        await self.pool.execute('UPDATE quizzes SET time_limit_minutes=60 WHERE item_id=$1', iid)
        start = quiz_attempts.utcnow()
        with patch.object(quizzes, 'utcnow', return_value=start), patch.object(quiz_attempts, 'utcnow', return_value=start):
            self.assertEqual((await self.request('POST', f'/quizzes/{iid}/start')).status_code, 200)
            initial = (await self.request('GET', f'/quizzes/{iid}')).json()
            self.assertEqual(initial['remaining_seconds'], 3600)
        with patch.object(quizzes, 'utcnow', return_value=start+dt.timedelta(minutes=20)), patch.object(quiz_attempts, 'utcnow', return_value=start+dt.timedelta(minutes=20)):
            body = {'revision':0,'attempt_number':1,'answers':[{'question_id':qid,'selected_option_ids':[oid]}]}
            self.assertEqual((await self.request('PATCH', f'/quizzes/{iid}/answers', json=body)).status_code, 200)
        with patch.object(quizzes, 'utcnow', return_value=start+dt.timedelta(minutes=45)), patch.object(quiz_attempts, 'utcnow', return_value=start+dt.timedelta(minutes=45)):
            self.assertEqual((await self.request('POST', f'/quizzes/{iid}/start')).status_code, 200)
            resumed = (await self.request('GET', f'/quizzes/{iid}')).json()
            self.assertEqual(resumed['remaining_seconds'], 900)
            self.assertEqual(resumed['expires_at'], initial['expires_at'])
            self.assertEqual(resumed['saved_answers'][str(qid)]['selected_option_ids'], [oid])

    async def test_release_share_lock_blocks_start_but_allows_read(self):
        iid, _, _ = await self.quiz()
        await self.request('POST', f'/quizzes/{iid}/start')
        async with self.pool.acquire() as gate, gate.transaction():
            await gate.execute('LOCK TABLE quiz_starts IN SHARE MODE')
            async with self.pool.acquire() as writer:
                self.assertEqual(await writer.fetchval('SELECT count(*) FROM quiz_starts'), 1)
                import asyncpg
                with self.assertRaises(asyncpg.LockNotAvailableError):
                    async with writer.transaction():
                        await writer.execute("SET LOCAL lock_timeout='100ms'")
                        await writer.execute('UPDATE quiz_starts SET deadline_at=now() WHERE quiz_id=$1', iid)
        self.assertGreater(await self.pool.fetchval('SELECT deadline_at FROM quiz_starts WHERE quiz_id=$1', iid), quiz_attempts.utcnow())

    async def test_untimed_stays_untimed_and_access_deadline_is_separate(self):
        iid,_,_=await self.quiz(timed=False)
        self.assertEqual((await self.request('POST',f'/quizzes/{iid}/start')).status_code,200)
        await quiz_attempts.finalize_expired_quizzes(self.pool)
        data=(await self.request('GET',f'/quizzes/{iid}')).json()
        self.assertIsNone(data['attempt_deadline_at'])
        self.assertIsNone(data['remaining_seconds'])
        self.assertEqual(data['lifecycle'],'active')
        self.assertIsNone(data['attempt'])
