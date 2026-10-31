"""Onboarding and group compatibility, using only disposable auditdb schemas."""
import os
import asyncio
import unittest
import uuid
from tests import test_release as release

@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class OnboardingTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request

    async def test_student_and_teacher_mandatory_setup(self):
        for role in ('student', 'teacher'):
            email = uuid.uuid4().hex + '@example.com'
            created = await self.request('POST', '/admin/users', 'admin', json={'email':email,'full_name':'New fixture','role':role})
            self.assertEqual(created.status_code, 200, created.text)
            data = created.json()
            temporary = data['temporary_password']
            self.assertGreaterEqual(len(temporary), 24)
            saved = await self.pool.fetchrow('SELECT * FROM users WHERE id=$1', data['id'])
            self.assertTrue(saved['must_change_password'])
            self.assertNotEqual(saved['password_hash'], temporary)
            login = await self.client.post('/auth/login',json={'email':email,'password':temporary})
            self.assertEqual(login.status_code,200,login.text)
            headers={'Authorization':'Bearer '+login.json()['token']}
            self.assertTrue(login.json()['user']['must_change_password'])
            self.assertEqual((await self.client.get('/courses',headers=headers)).status_code,403)
            self.assertNotIn('temporary_password',(await self.request('GET','/admin/users','admin')).text)
            for body in ({'new_password':'weak','confirmation':'weak'}, {'new_password':temporary,'confirmation':temporary}, {'new_password':'Long new password','confirmation':'not same'}, {'new_password':'123456789012','confirmation':'123456789012'}):
                self.assertEqual((await self.client.post('/auth/setup-password',headers=headers,json=body)).status_code,422)
            personal='Менің өте ұзын жеке құпиясөзім — қауіпсіз тіркес 2026!'
            result=await self.client.post('/auth/setup-password',headers=headers,json={'new_password':personal,'confirmation':personal})
            self.assertEqual(result.status_code,200,result.text)
            self.assertFalse(result.json()['user']['must_change_password'])
            self.assertEqual((await self.client.get('/auth/me',headers=headers)).status_code,401)
            self.assertEqual((await self.client.post('/auth/login',json={'email':email,'password':temporary})).status_code,401)
            self.assertEqual((await self.client.post('/auth/login',json={'email':email,'password':personal})).status_code,200)
            self.assertEqual((await self.client.post('/auth/setup-password',headers=headers,json={'new_password':personal,'confirmation':personal})).status_code,401)
        # Accounts predating this feature retain their exact hashes and ordinary login.
        for role, old in self.users.items():
            current=await self.pool.fetchrow('SELECT * FROM users WHERE id=$1',old['id'])
            self.assertEqual(current['password_hash'],old['password_hash'])
            self.assertFalse(current['must_change_password'])
            self.assertEqual((await self.client.post('/auth/login',json={'email':old['email'],'password':'Release-only-password!'})).status_code,200)
        self.assertEqual((await self.request('POST','/admin/users','student',json={'email':'no@example.com','full_name':'Denied','role':'student'})).status_code,403)

    async def test_group_without_direction_preserves_legacy(self):
        created=await self.request('POST','/admin/groups','admin',json={'code':'GIM','title':'GIM','capacity':20})
        self.assertEqual(created.status_code,200,created.text)
        group=created.json()
        self.assertIsNone(group['direction'])
        await self.pool.execute("UPDATE groups SET direction='Legacy',stream='old' WHERE id=$1",group['id'])
        updated=await self.request('PATCH',f"/admin/groups/{group['id']}",'admin',json={'code':'GIM2','title':'New','capacity':21})
        self.assertEqual(updated.status_code,200,updated.text)
        self.assertEqual(updated.json()['direction'],'Legacy')
        self.assertEqual(updated.json()['stream'],'old')

    async def test_concurrent_setup_and_rate_limit(self):
        email=uuid.uuid4().hex+'@example.com'
        created=await self.request('POST','/admin/users','admin',json={'email':email,'full_name':'Concurrent fixture','role':'student'})
        self.assertEqual(created.headers.get('cache-control'),'no-store')
        login=await self.client.post('/auth/login',json={'email':email,'password':created.json()['temporary_password']})
        headers={'Authorization':'Bearer '+login.json()['token']}
        body={'new_password':'Safe personal passphrase 2026','confirmation':'Safe personal passphrase 2026'}
        results=await asyncio.gather(*[self.client.post('/auth/setup-password',headers=headers,json=body) for _ in range(2)])
        self.assertEqual(sum(r.status_code==200 for r in results),1)
        self.assertTrue(all(r.status_code in (200,401,409) for r in results))
        uid=created.json()['id']
        self.assertEqual(await self.pool.fetchval('SELECT auth_version FROM users WHERE id=$1',uid),1)
        await self.pool.execute('UPDATE users SET must_change_password=TRUE WHERE id=$1',uid)
        from core.security import create_access_token
        headers={'Authorization':'Bearer '+create_access_token(uid,'student',1)}
        for _ in range(11):
            response=await self.client.post('/auth/setup-password',headers=headers,json={'new_password':'Other secure password','confirmation':'mismatch'})
        self.assertEqual(response.status_code,429)
