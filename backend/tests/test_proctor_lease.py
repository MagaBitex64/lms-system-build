"""Real PostgreSQL regression for expiring attempt-specific proctor capabilities."""
import unittest
from tests import test_ent_integration as fixtures

class ProctorLeaseTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.EntIntegrationTests.asyncSetUp
    cleanup_database = fixtures.EntIntegrationTests.cleanup_database
    create_variant = fixtures.EntIntegrationTests.create_variant
    fill_variant = fixtures.EntIntegrationTests.fill_variant
    start = fixtures.EntIntegrationTests.start

    async def test_rotation_expiry_loss_and_recovery_preserve_answers_timer(self):
        vid = await self.create_variant()
        await self.fill_variant(vid)
        access, aid = await self.start(vid)
        original = await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid)
        body = {'revision':0,'answers':[]}
        path = f'/ent-trial/attempts/{aid}'
        self.assertEqual((await self.client.patch(path+'/answers',json=body)).status_code,403)
        old = self.proctor_token
        active={'session_id':'integration-test-session','camera_active':True,'screen_active':True,'fullscreen':True}
        token=(await self.client.post(path+'/proctor/activate',json=active)).json()['proctor_token']
        self.assertNotEqual(old,token)
        body.update(session_id=active['session_id'],proctor_token=old)
        self.assertEqual((await self.client.patch(path+'/answers',json=body)).status_code,403)
        body['proctor_token']=token
        self.assertEqual((await self.client.patch(path+'/answers',json=body)).status_code,200)
        body['revision']=1
        await self.conn.execute("UPDATE ent_trial_attempts SET proctor_last_seen_at=now()-interval '46 seconds' WHERE id=$1",aid)
        self.assertEqual((await self.client.patch(path+'/answers',json=body)).status_code,403)
        for camera_required in (False,True):
            await self.conn.execute('UPDATE ent_trial_accesses SET camera_required=$2 WHERE id=$1',access,camera_required)
            for event in ('fullscreen_exit','screen_share_stopped','absence_start'):
                token=(await self.client.post(path+'/proctor/activate',json=active)).json()['proctor_token']
                body['proctor_token']=token
                loss=await self.client.post(path+'/proctor/events',json={'session_id':active['session_id'],'proctor_token':token,'event_type':event})
                self.assertEqual(loss.status_code,200,loss.text)
                self.assertEqual((await self.client.patch(path+'/answers',json=body)).status_code,403)
        restored=(await self.client.post(path+'/proctor/activate',json=active)).json()['proctor_token']
        body['proctor_token']=restored
        final=await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',aid)
        self.assertEqual(final['deadline_at'],original['deadline_at'])
        self.assertEqual(final['started_at'],original['started_at'])
        self.assertEqual(final['responses'],original['responses'])
        self.assertEqual(await self.conn.fetchval('SELECT count(*) FROM ent_trial_attempts WHERE access_id=$1',access),1)
        self.assertEqual((await self.client.post(path+'/submit',json=body)).status_code,200)
