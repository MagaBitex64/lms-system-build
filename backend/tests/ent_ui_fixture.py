"""Opt-in local UI fixture. Does not modify any existing questions or attempts.

Requires the existing demo student6 account. Run `create`, then `remove ID`.
Removal is guarded by a unique test marker and exact demo-student ownership.
Never run this developer helper against a production database.
"""
import asyncio
import json
import sys
import uuid
import asyncpg

from core.config import DATABASE_URL
from core.ent_rules import validate_variant
from tests.test_ent_rules import fixture

MARKER = "__ENT_UI_QA__ "
DEMO_EMAIL = "student6@phenomenon.school"


async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        async with conn.transaction():
            student = await conn.fetchval("SELECT id FROM users WHERE email=$1 AND role='student'", DEMO_EMAIL)
            admin = await conn.fetchval("SELECT id FROM users WHERE email='admin@phenomenon.school' AND role='admin'")
            if not student or not admin:
                raise RuntimeError("Local demo accounts are required; no accounts were created")
            if sys.argv[1:] == ["create"]:
                v, qs, contexts = fixture()
                assert validate_variant(v["combination"], qs, contexts)["ready"]
                title = MARKER + uuid.uuid4().hex
                vid = await conn.fetchval("INSERT INTO ent_variants(title,description,combination) VALUES($1,'Temporary UI verification; synthetic content','infmat') RETURNING id", title)
                for c in contexts:
                    await conn.execute("INSERT INTO ent_contexts(variant_id,subject,start_position,content) VALUES($1,$2,$3,$4)", vid, c["subject"], c["start_position"], c["content"])
                for q in qs:
                    qid = await conn.fetchval("INSERT INTO ent_questions(variant_id,subject,position,prompt,question_type,max_points,difficulty,explanation) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", vid, q["subject"], q["position"], q["prompt"], q["question_type"], q["max_points"], q["difficulty"], q["explanation"])
                    for i, o in enumerate(q["options"]):
                        await conn.execute("INSERT INTO ent_options(question_id,text,is_correct,position) VALUES($1,$2,$3,$4)", qid, o["text"], o["is_correct"], i)
                    for i, p in enumerate(q["matching_pairs"]):
                        await conn.execute("INSERT INTO ent_matching_pairs(question_id,left_text,right_text,position,correct_option_position) VALUES($1,$2,$3,$4,$5)", qid, p["left_text"], p["right_text"], i, p["correct_option_position"])
                aid = await conn.fetchval("INSERT INTO ent_trial_accesses(granted_by_id,variant_id,combination,target_type,student_id) VALUES($1,$2,'infmat','student',$3) RETURNING id", admin, vid, student)
                print(json.dumps({"variant_id": vid, "access_id": aid, "title": title, "student": DEMO_EMAIL}))
            elif len(sys.argv) == 3 and sys.argv[1] == "remove":
                vid = int(sys.argv[2])
                title = await conn.fetchval("SELECT title FROM ent_variants WHERE id=$1 FOR UPDATE", vid)
                if not title or not title.startswith(MARKER) or len(title) != len(MARKER) + 32:
                    raise RuntimeError("Not an exact UI-test variant; refusing removal")
                accesses = await conn.fetch("SELECT * FROM ent_trial_accesses WHERE variant_id=$1", vid)
                if len(accesses) != 1 or accesses[0]["student_id"] != student or accesses[0]["target_type"] != "student":
                    raise RuntimeError("Unexpected access ownership; refusing removal")
                if await conn.fetchval("SELECT EXISTS(SELECT 1 FROM ent_trial_attempts WHERE variant_id=$1 AND student_id<>$2)", vid, student):
                    raise RuntimeError("Unexpected attempt ownership; refusing removal")
                await conn.execute("DELETE FROM ent_variants WHERE id=$1 AND title=$2", vid, title)
                print(json.dumps({"removed_test_variant": vid}))
            else:
                raise RuntimeError("Usage: python -m tests.ent_ui_fixture create | remove ID")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
