"""Synthetic browser fixture. Refuses any database except isolated auditdb."""
import asyncio,json,asyncpg
from core.config import DATABASE_URL
from core.security import hash_password
from tests.test_ent_rules import fixture
async def main():
 assert '@auditdb:' in DATABASE_URL
 c=await asyncpg.connect(DATABASE_URL)
 for role in ['admin','student']:
  await c.execute("INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash",f'audience-{role}@example.com',hash_password('Disposable-audience-only123'),f'Audience {role}',role)
 vid=await c.fetchval("INSERT INTO ent_variants(title,combination,exam_mode,single_subject) VALUES('Audience E2E fixture','infmat','single','informatics') RETURNING id")
 _,qs,cs=fixture()
 for context in cs:
  if context['subject']=='informatics':await c.execute('INSERT INTO ent_contexts(variant_id,subject,start_position,content) VALUES($1,$2,$3,$4)',vid,context['subject'],context['start_position'],context['content'])
 for q in qs:
  if q['subject']!='informatics':continue
  qid=await c.fetchval('INSERT INTO ent_questions(variant_id,subject,position,prompt,question_type,max_points,difficulty) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',vid,q['subject'],q['position'],q['prompt'],q['question_type'],q['max_points'],q['difficulty'])
  for i,o in enumerate(q['options']):await c.execute('INSERT INTO ent_options(question_id,text,is_correct,position) VALUES($1,$2,$3,$4)',qid,o['text'],o['is_correct'],i)
  for i,p in enumerate(q['matching_pairs']):await c.execute('INSERT INTO ent_matching_pairs(question_id,left_text,right_text,position,correct_option_position) VALUES($1,$2,$3,$4,$5)',qid,p['left_text'],p['right_text'],i,p['correct_option_position'])
 print(json.dumps({'variantId':vid}));await c.close()
asyncio.run(main())
