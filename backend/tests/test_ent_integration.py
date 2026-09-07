"""Real PostgreSQL + HTTP tests, isolated in a transaction-local schema.

No production tables/users are touched; rollback removes all fixtures and schema.
Run explicitly: python -m unittest tests.test_ent_integration -v
"""
import copy
import json
import unittest
import uuid
from contextlib import asynccontextmanager
from unittest.mock import patch

import asyncpg
import httpx
from fastapi import FastAPI
from core.config import DATABASE_URL
from core.deps import get_current_user
from routers import ent_trial as ent
from scripts.init_db import SCHEMA, ENT_MIGRATIONS
from tests.test_ent_rules import fixture


class TransactionPool:
    def __init__(self, conn):
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn

    def __getattr__(self, name):
        return getattr(self.conn, name)


class EntIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.conn = await asyncpg.connect(DATABASE_URL)
        self.tx = self.conn.transaction(isolation="repeatable_read")
        await self.tx.start()
        self.addAsyncCleanup(self.cleanup_database)
        name = "ent_test_" + uuid.uuid4().hex
        await self.conn.execute(f'CREATE SCHEMA "{name}"')
        await self.conn.execute(f'SET LOCAL search_path TO "{name}"')
        await self.conn.execute(SCHEMA)
        for migration in ENT_MIGRATIONS:
            await self.conn.execute(migration)
        self.users = {}
        for role in ("admin", "student", "teacher"):
            row = await self.conn.fetchrow("INSERT INTO users(email,password_hash,full_name,role) VALUES($1,'unused',$2,$2) RETURNING *", f"{role}@example.invalid", role)
            self.users[role] = dict(row)
        self.actor = self.users["admin"]
        pool = TransactionPool(self.conn)
        async def get_pool():
            return pool
        self.patch = patch.object(ent, "get_pool", get_pool)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        app = FastAPI()
        app.include_router(ent.router)
        async def current_user():
            return self.actor
        app.dependency_overrides[get_current_user] = current_user
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.addAsyncCleanup(self.client.aclose)

    async def cleanup_database(self):
        await self.tx.rollback()
        await self.conn.close()

    async def create_variant(self):
        response = await self.client.post("/ent-trial/admin/variants", json={"title": "TEST ONLY", "combination": "infmat"})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["id"]

    async def fill_variant(self, vid):
        _, qs, contexts = fixture()
        for c in contexts:
            response = await self.client.put(f"/ent-trial/admin/variants/{vid}/contexts/{c['subject']}/{c['start_position']}", json={"content": c["content"]})
            self.assertEqual(response.status_code, 200, response.text)
        for q in qs:
            q["variant_id"] = vid
            response = await self.client.post("/ent-trial/admin/questions", json=q)
            self.assertEqual(response.status_code, 200, response.text)
        return qs

    async def start(self, vid):
        response = await self.client.post("/ent-trial/admin/accesses", json={"variant_id": vid, "target_type": "all"})
        self.assertEqual(response.status_code, 200, response.text)
        aid = response.json()["id"]
        self.actor = self.users["student"]
        available = await self.client.get("/ent-trial/my-accesses")
        self.assertEqual(available.status_code, 200, available.text)
        self.assertTrue(next(a for a in available.json()["items"] if a["id"] == aid)["variant_ready"])
        self.assertNotIn("is_correct", available.text)
        response = await self.client.post(f"/ent-trial/accesses/{aid}/start")
        self.assertEqual(response.status_code, 200, response.text)
        attempt_id = response.json()["attempt_id"]
        activated = await self.client.post(f"/ent-trial/attempts/{attempt_id}/proctor/activate", json={
            "session_id": "integration-test-session", "camera_active": True, "screen_active": True, "fullscreen": True,
        })
        self.assertEqual(activated.status_code, 200, activated.text)
        return aid, attempt_id

    async def test_full_exam_snapshots_autosave_permissions_and_140_score(self):
        vid = await self.create_variant()
        for _ in range(2):  # Incomplete variants cannot be assigned.
            response = await self.client.post("/ent-trial/admin/accesses", json={"variant_id": vid, "target_type": "all"})
            self.assertEqual(response.status_code, 409)
        qs = await self.fill_variant(vid)
        contextual = copy.deepcopy(qs[10]); contextual.update({"context_mode": "addendum", "context_override": "Жеке қосымша", "variant_id": vid})
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=contextual)).status_code, 200)
        image_id = await self.conn.fetchval("""INSERT INTO files(owner_id,original_name,stored_name,mime,size)
            VALUES($1,'formula.png',$2,'image/png',10) RETURNING id""", self.users["admin"]["id"], f"{uuid.uuid4().hex}.png")
        pictured = copy.deepcopy(qs[0]); pictured.update({"variant_id": vid, "prompt": "Формула: {{image}} жауапты таңдаңыз",
            "image_file_id": image_id, "image_placement": "marker", "image_width": 420, "image_alt": "Формула"})
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=pictured)).status_code, 200)
        response = await self.client.get(f"/ent-trial/admin/variants/{vid}/questions")
        self.assertTrue(response.json()["validation"]["ready"], response.text)
        aid, attempt_id = await self.start(vid)
        duplicate = await self.client.post(f"/ent-trial/accesses/{aid}/start")
        self.assertEqual(duplicate.json()["attempt_id"], attempt_id)
        response = await self.client.get(f"/ent-trial/attempts/{attempt_id}")
        self.assertEqual(response.status_code, 200, response.text)
        public = response.json()
        self.assertEqual(sum(map(len, public["questions"].values())), 120)
        self.assertGreaterEqual(public["remaining_seconds"], 14390)
        self.assertNotIn('"is_correct"', response.text)
        self.assertNotIn('"right_text"', response.text)
        history = public["questions"]["kaz_history"]
        self.assertEqual(history[9]["context_text"], "")
        self.assertEqual(history[11]["context_text"], history[14]["context_text"])
        self.assertTrue(history[10]["context_text"].endswith("Жеке қосымша"))
        self.assertNotEqual(history[14]["context_text"], history[15]["context_text"])
        self.assertEqual(history[0]["image_file_id"], image_id)
        violation = await self.client.post(f"/ent-trial/attempts/{attempt_id}/proctor/events", json={
            "session_id": "integration-test-session", "event_type": "fullscreen_exit", "details": {},
        })
        self.assertEqual(violation.json()["violations"], 1)
        self.actor = {**self.users["student"], "id": 999999}
        self.assertEqual((await self.client.get(f"/ent-trial/attempts/{attempt_id}")).status_code, 404)
        for role in ("teacher", "admin"):
            self.actor = self.users[role]
            self.assertEqual((await self.client.get(f"/ent-trial/attempts/{attempt_id}")).status_code, 403)
        self.actor = self.users["student"]
        self.assertEqual((await self.client.get("/ent-trial/variants")).status_code, 403)
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=qs[0])).status_code, 403)
        snapshot = ent.decoded(await self.conn.fetchval("SELECT snapshot FROM ent_trial_attempts WHERE id=$1", attempt_id))
        answers = [{"question_id": q["question_id"], "selected_option_id": q["options"][0]["id"],
                    "selected_option_ids": [q["options"][0]["id"]],
                    "matching_answer": {str(p["id"]): p["correct_option_id"] for p in q["matching_pairs"]}} for q in snapshot["questions"]]
        response = await self.client.patch(f"/ent-trial/attempts/{attempt_id}/answers", json={"revision": 0, "answers": answers})
        self.assertEqual(response.status_code, 200, response.text)
        restored = (await self.client.get(f"/ent-trial/attempts/{attempt_id}")).json()
        self.assertEqual(restored["questions"]["kaz_history"][0]["selected_option_id"], answers[0]["selected_option_id"])
        response = await self.client.patch(f"/ent-trial/attempts/{attempt_id}/answers", json={"revision": 0, "answers": []})
        self.assertEqual(response.status_code, 409)
        self.actor = self.users["admin"]
        changed = copy.deepcopy(qs[0]); changed["prompt"] = "Changed after start"
        changed["options"][0]["is_correct"] = False; changed["options"][1]["is_correct"] = True
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=changed)).status_code, 200)
        self.assertEqual((await self.client.delete(f"/ent-trial/admin/variants/{vid}")).status_code, 409)
        self.assertEqual((await self.client.delete(f"/ent-trial/admin/accesses/{aid}")).status_code, 200)
        self.actor = self.users["student"]
        response = await self.client.post(f"/ent-trial/attempts/{attempt_id}/submit", json={"revision": 1, "answers": []})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["total_score"], 140)
        repeated = await self.client.post(f"/ent-trial/attempts/{attempt_id}/submit", json={"revision": 0, "answers": []})
        self.assertEqual(repeated.json()["total_score"], 140)
        result = (await self.client.get(f"/ent-trial/attempts/{attempt_id}")).json()
        self.assertEqual(result["scores"]["total"], 140)
        self.assertEqual(result["questions"]["kaz_history"][0]["prompt"], "Формула: {{image}} жауапты таңдаңыз")
        self.assertTrue(result["questions"]["kaz_history"][0]["options"][0]["is_correct"])
        self.assertEqual(result["questions"]["informatics"][30]["points_earned"], 2)

    async def test_expiry_grades_only_saved_answers_and_blocks_late_edits(self):
        vid = await self.create_variant()
        await self.fill_variant(vid)
        _, attempt_id = await self.start(vid)
        snapshot = ent.decoded(await self.conn.fetchval("SELECT snapshot FROM ent_trial_attempts WHERE id=$1", attempt_id))
        q = snapshot["questions"][0]
        body = {"revision": 0, "answers": [{"question_id": q["question_id"], "selected_option_id": q["options"][0]["id"]}]}
        self.assertEqual((await self.client.patch(f"/ent-trial/attempts/{attempt_id}/answers", json=body)).status_code, 200)
        await self.conn.execute("UPDATE ent_trial_attempts SET deadline_at=now()-interval '1 second' WHERE id=$1", attempt_id)
        body["revision"] = 1; body["answers"][0]["selected_option_id"] = q["options"][1]["id"]
        response = await self.client.post(f"/ent-trial/attempts/{attempt_id}/submit", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "submitted")
        self.assertEqual(response.json()["total_score"], 1)

    async def test_reject_wrong_slots_contexts_options_and_legacy_bank_creation(self):
        vid = await self.create_variant()
        _, qs, _ = fixture()
        body = qs[0]; body["variant_id"] = vid
        wrong = copy.deepcopy(body); wrong["question_type"] = "matching"
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=wrong)).status_code, 422)
        wrong = copy.deepcopy(body); wrong["options"].pop()
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=wrong)).status_code, 422)
        wrong = copy.deepcopy(body); wrong.pop("position")
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=wrong)).status_code, 422)
        response = await self.client.put(f"/ent-trial/admin/variants/{vid}/contexts/kaz_history/0", json={"content": "not allowed"})
        self.assertEqual(response.status_code, 422)
        contextual = qs[10]; contextual["variant_id"] = vid
        response = await self.client.post("/ent-trial/admin/questions", json=contextual)
        self.assertEqual(response.status_code, 422)
        self.assertIn("контекст", response.text)

    async def test_single_subject_variant_has_its_own_size_and_duration(self):
        response = await self.client.post("/ent-trial/admin/variants", json={
            "title": "Single math", "combination": "infmat", "exam_mode": "single", "single_subject": "mathematics",
        })
        self.assertEqual(response.status_code, 200, response.text)
        vid = response.json()["id"]
        response = await self.client.get(f"/ent-trial/admin/variants/{vid}/questions")
        self.assertEqual(list(response.json()["rules"]), ["mathematics"])
        self.assertEqual(response.json()["validation"]["max_score"], 50)
        self.assertEqual(response.json()["validation"]["duration_seconds"], 80 * 60)

    async def test_three_proctor_violations_terminate_attempt(self):
        vid = await self.create_variant(); await self.fill_variant(vid)
        _, attempt_id = await self.start(vid)
        for event_type in ("tab_hidden", "fullscreen_exit", "camera_stopped"):
            response = await self.client.post(f"/ent-trial/attempts/{attempt_id}/proctor/events", json={
                "session_id": "integration-test-session", "event_type": event_type, "details": {},
            })
            self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "submitted")
        self.assertTrue(response.json()["terminated"])
        row = await self.conn.fetchrow("SELECT proctor_status,proctor_violations FROM ent_trial_attempts WHERE id=$1", attempt_id)
        self.assertEqual((row["proctor_status"], row["proctor_violations"]), ("terminated", 3))

    async def test_extra_time_is_individual_and_fixed_at_start(self):
        vid = await self.create_variant()
        await self.fill_variant(vid)
        response = await self.client.post("/ent-trial/admin/accesses", json={"variant_id": vid, "target_type": "all", "extra_time_minutes": 40})
        self.assertEqual(response.status_code, 422)
        response = await self.client.post("/ent-trial/admin/accesses", json={"variant_id": vid, "target_type": "student", "student_id": self.users["student"]["id"], "extra_time_minutes": 40})
        self.assertEqual(response.status_code, 200, response.text)
        aid = response.json()["id"]
        self.actor = self.users["student"]
        tid = (await self.client.post(f"/ent-trial/accesses/{aid}/start")).json()["attempt_id"]
        activated = await self.client.post(f"/ent-trial/attempts/{tid}/proctor/activate", json={
            "session_id": "extra-time-test-session", "camera_active": True, "screen_active": True, "fullscreen": True,
        })
        self.assertEqual(activated.status_code, 200, activated.text)
        duration = await self.conn.fetchval("SELECT extract(epoch FROM deadline_at-started_at) FROM ent_trial_attempts WHERE id=$1", tid)
        self.assertEqual(int(duration), 280 * 60)

    async def test_legacy_result_frozen_before_author_edit(self):
        vid = await self.create_variant()
        _, qs, _ = fixture(); q = qs[0]; q["variant_id"] = vid
        qid = (await self.client.post("/ent-trial/admin/questions", json=q)).json()["id"]
        oid = await self.conn.fetchval("SELECT id FROM ent_options WHERE question_id=$1 ORDER BY position LIMIT 1", qid)
        aid = await self.conn.fetchval("INSERT INTO ent_trial_accesses(granted_by_id,variant_id,combination,target_type) VALUES($1,$2,'infmat','all') RETURNING id", self.users["admin"]["id"], vid)
        tid = await self.conn.fetchval("INSERT INTO ent_trial_attempts(access_id,student_id,variant_id,combination,status,total_score,deadline_at) VALUES($1,$2,$3,'infmat','submitted',1,now()) RETURNING id", aid, self.users["student"]["id"], vid)
        await self.conn.execute("INSERT INTO ent_trial_answers(attempt_id,question_id,selected_option_id,points_earned,is_correct) VALUES($1,$2,$3,1,true)", tid, qid, oid)
        q["prompt"] = "Changed legacy question"
        self.assertEqual((await self.client.post("/ent-trial/admin/questions", json=q)).status_code, 200)
        self.actor = self.users["student"]
        result = (await self.client.get(f"/ent-trial/attempts/{tid}")).json()
        self.assertEqual(result["rules_version"], "legacy")
        self.assertEqual(result["questions"]["kaz_history"][0]["prompt"], "Synthetic question")
        self.assertEqual(result["questions"]["kaz_history"][0]["points_earned"], 1)


if __name__ == "__main__":
    unittest.main()
