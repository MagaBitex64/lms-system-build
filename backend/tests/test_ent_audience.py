"""Audience authorization against disposable PostgreSQL, including direct API bypass."""
import unittest
from tests import test_ent_integration as fixture

class EntAudienceTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp=fixture.EntIntegrationTests.asyncSetUp
    cleanup_database=fixture.EntIntegrationTests.cleanup_database
    fill_single_variant=fixture.EntIntegrationTests.fill_single_variant

    async def test_snapshot_future_global_and_private_attempt(self):
        self.actor=self.users['admin']
        r=await self.client.post('/ent-trial/admin/variants',json={'title':'Audience fixture','exam_mode':'single','single_subject':'informatics','combination':'infmat'})
        self.assertEqual(r.status_code,200,r.text);vid=r.json()['id']
        await self.fill_single_variant(vid,'informatics')
        body={'variant_id':vid,'target_type':'current_students'}
        r=await self.client.post('/ent-trial/admin/accesses',json=body)
        self.assertEqual(r.status_code,200,r.text);ids=r.json()['ids']
        self.assertEqual(len(ids),1)
        self.actor=self.users['student']
        started=await self.client.post(f'/ent-trial/accesses/{ids[0]}/start')
        self.assertEqual(started.status_code,200,started.text);attempt=started.json()['attempt_id']
        before=dict(await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',attempt))
        late=dict(await self.conn.fetchrow("INSERT INTO users(email,password_hash,full_name,role) VALUES('future@example.invalid','unused','Future student','student') RETURNING *"))
        self.actor=late
        self.assertNotIn(ids[0],[a['id'] for a in (await self.client.get('/ent-trial/my-accesses')).json()['items']])
        self.assertEqual((await self.client.post(f'/ent-trial/accesses/{ids[0]}/start')).status_code,403)
        self.assertEqual((await self.client.get(f'/ent-trial/attempts/{attempt}')).status_code,404)
        self.assertEqual(await self.conn.fetchval('SELECT count(*) FROM ent_trial_attempts'),1)
        self.actor=self.users['teacher']
        self.assertEqual((await self.client.post('/ent-trial/admin/accesses',json=body)).status_code,403)
        self.actor=self.users['admin']
        self.assertEqual((await self.client.post('/ent-trial/admin/accesses',json=body|{'target_type':'all'})).status_code,422)
        global_grant=await self.client.post('/ent-trial/admin/accesses',json=body|{'target_type':'global'})
        self.assertEqual(global_grant.status_code,200,global_grant.text);gid=global_grant.json()['id']
        newest=dict(await self.conn.fetchrow("INSERT INTO users(email,password_hash,full_name,role) VALUES('newest@example.invalid','unused','Newest student','student') RETURNING *"))
        self.actor=newest
        self.assertIn(gid,[a['id'] for a in (await self.client.get('/ent-trial/my-accesses')).json()['items']])
        self.assertEqual((await self.client.post(f'/ent-trial/accesses/{gid}/start')).status_code,200)
        self.assertEqual(before,dict(await self.conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1',attempt)))
