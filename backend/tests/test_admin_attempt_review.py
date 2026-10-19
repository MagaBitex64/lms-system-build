"""Read-only admin review: real HTTP/DB fixtures, never a live learner attempt."""
import copy
import json
import os
import unittest
from unittest.mock import patch

from core.ent_review import answer_review
from core.ent_rules import score_question
from routers.ent_trial import make_snapshot, finish
from tests.test_ent_rules import fixture
from tests import test_release as release


def review_fixture():
    variant, questions, contexts = fixture()
    snapshot = make_snapshot(variant, questions, contexts)
    snapshot['questions'][0]['prompt'] = 'Original $x^2$'
    snapshot['questions'][0]['image_url'] = '/saved-question.png'
    responses = {}
    for kind in ('single_choice', 'context', 'multi_choice', 'matching'):
        q = next(q for q in snapshot['questions'] if q['question_type'] == kind)
        responses[str(q['question_id'])] = {
            'selected_option_id': q['options'][0]['id'] if kind in ('single_choice', 'context') else None,
            'selected_option_ids': [q['options'][0]['id']] if kind == 'multi_choice' else [],
            'matching_answer': {str(p['id']): p['correct_option_id'] for p in q['matching_pairs']},
        }
    wrong = snapshot['questions'][1]
    responses[str(wrong['question_id'])] = {'selected_option_id': wrong['options'][1]['id']}
    return snapshot, responses


def row(snapshot, responses):
    return dict(id=1, access_id=1, attempt_number=2, full_name='Fixture Student', email='fixture@example.com',
                started_at=None, submitted_at=None, total_score=7.5, combination='infmat',
                kaz_history_score=1, reading_score=1, math_score=0, subject1_score=2, subject2_score=3.5,
                scores_by_subject={'mathematics': 7, 'informatics': .5}, snapshot=snapshot, responses=responses)


def consistent_row(snapshot, responses):
    data = row(snapshot, responses)
    scores = dict.fromkeys(snapshot['subjects'], 0)
    for q in snapshot['questions']:
        scores[q['subject']] += score_question(q, responses.get(str(q['question_id']), {}))
    return data | {'total_score': sum(scores.values()), 'scores_by_subject': scores}


class ReviewPresentationTests(unittest.TestCase):
    def test_historical_v1_points_reconstruct_only_when_all_saved_scores_match(self):
        snapshot, responses = review_fixture()
        data = consistent_row(snapshot, responses)
        original = copy.deepcopy(data)
        result = answer_review(data)
        self.assertTrue(all(q['evaluation_source'] == 'reconstructed' for q in result['questions']))
        self.assertEqual(sum(q['points_earned'] for q in result['questions']), data['total_score'])
        self.assertEqual(result['questions'][0]['points_earned'], 1)
        self.assertEqual(result['questions'][1]['points_earned'], 0)
        self.assertEqual(result['questions'][2]['points_earned'], 0)
        self.assertTrue(result['points_warning'])
        self.assertEqual(data, original)

    def test_partial_multi_and_matching_reconstruct_using_original_rules(self):
        snapshot, responses = review_fixture()
        multi = next(q for q in snapshot['questions'] if q['question_type'] == 'multi_choice')
        responses[str(multi['question_id'])]['selected_option_ids'].append(multi['options'][1]['id'])
        matching = next(q for q in snapshot['questions'] if q['question_type'] == 'matching')
        responses[str(matching['question_id'])]['matching_answer'][str(matching['matching_pairs'][1]['id'])] = matching['options'][1]['id']
        result = answer_review(consistent_row(snapshot, responses))
        for source in (multi, matching):
            q = next(q for q in result['questions'] if q['question_id'] == source['question_id'])
            self.assertEqual(q['points_earned'], 1)
            self.assertEqual(q['max_points'], 2)
            self.assertEqual(q['status'], 'partial')

    def test_unknown_version_missing_keys_or_conflicting_subject_scores_do_not_guess(self):
        snapshot, responses = review_fixture()
        valid = consistent_row(snapshot, responses)
        cases = []
        unknown = copy.deepcopy(valid); unknown['snapshot']['version'] = 'unknown-version'; cases.append(unknown)
        conflict = copy.deepcopy(valid)
        conflict['scores_by_subject']['mathematics'] += 1
        conflict['scores_by_subject']['informatics'] -= 1  # Same grand total is NOT sufficient.
        cases.append(conflict)
        missing = copy.deepcopy(valid); missing['snapshot']['questions'][0]['options'] = []; cases.append(missing)
        wrong_total = copy.deepcopy(valid); wrong_total['total_score'] += 1; cases.append(wrong_total)
        no_responses = consistent_row(copy.deepcopy(snapshot), {}); no_responses['responses'] = None; cases.append(no_responses)
        for case in cases:
            with self.subTest(case=case['snapshot']['version']):
                self.assertTrue(all(q['points_earned'] is None for q in answer_review(case)['questions']))

    def test_saved_ledger_preferred_even_for_unknown_scoring_version(self):
        snapshot, responses = review_fixture()
        valid = consistent_row(snapshot, responses)
        ledger = {str(q['question_id']): {'awarded': score_question(q, responses.get(str(q['question_id']), {})), 'maximum': q['max_points']} for q in snapshot['questions']}
        snapshot['version'] = 'future-version'
        result = answer_review(valid | {'question_scores': {'version': 1, 'rules_version': 'future-version', 'points': ledger}})
        self.assertTrue(all(q['evaluation_source'] == 'stored' for q in result['questions']))
        self.assertEqual(result['questions'][1]['points_earned'], 0)

    def test_saved_order_keys_context_images_and_answers_preserved_without_regrading(self):
        snapshot, responses = review_fixture()
        snapshot['questions'].reverse()
        for question in snapshot['questions']:
            question['options'].reverse()
        original = copy.deepcopy(snapshot)
        with patch('core.ent_rules.score_question', side_effect=AssertionError('Must not regrade')):
            review = answer_review(row(snapshot, responses))
        self.assertEqual(snapshot, original)
        self.assertEqual(len(review['questions']), 120)
        self.assertEqual([q['question_id'] for q in review['questions']], [q['question_id'] for q in snapshot['questions']])
        for actual, saved in zip(review['questions'], snapshot['questions']):
            self.assertEqual(actual['options'], saved['options'])
            self.assertEqual(actual['response'], responses.get(str(saved['question_id']), {}))
            self.assertIsNone(actual['points_earned'])
        self.assertEqual(review['total_score'], 7.5)
        self.assertEqual(review['max_score'], 140)
        self.assertTrue(review['points_warning'])
        self.assertEqual(next(q for q in review['questions'] if q['question_id'] == 1)['image_url'], '/saved-question.png')
        self.assertTrue(next(q for q in review['questions'] if q['question_type'] == 'context')['context_text'])
        statuses = {q['question_id']: q['status'] for q in review['questions']}
        self.assertEqual(statuses[1], 'correct')
        self.assertEqual(statuses[2], 'incorrect')
        self.assertEqual(statuses[3], 'unanswered')
        self.assertTrue(any(q['question_type'] == 'matching' and q['status'] == 'correct' for q in review['questions']))

    def test_multiple_selected_and_matching_pairs_not_lost(self):
        snapshot, responses = review_fixture()
        multi = next(q for q in snapshot['questions'] if q['question_type'] == 'multi_choice')
        multi['options'][1]['is_correct'] = True
        responses[str(multi['question_id'])]['selected_option_ids'] = [multi['options'][1]['id'], multi['options'][0]['id']]
        matching = next(q for q in snapshot['questions'] if q['question_type'] == 'matching')
        matching['legacy_points_earned'] = 1
        responses[str(matching['question_id'])]['matching_answer'][str(matching['matching_pairs'][1]['id'])] = matching['options'][1]['id']
        review = answer_review(row(snapshot, responses))
        result = next(q for q in review['questions'] if q['question_id'] == multi['question_id'])
        self.assertEqual(result['status'], 'correct')
        self.assertEqual(len(result['response']['selected_option_ids']), 2)
        result = next(q for q in review['questions'] if q['question_id'] == matching['question_id'])
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['points_earned'], 1)
        self.assertEqual(result['evaluation_source'], 'stored')

    def test_missing_snapshot_or_responses_is_honest_unavailable_not_latest_bank(self):
        result = answer_review(row(None, None))
        self.assertFalse(result['review_available'])
        self.assertEqual(result['questions'], [])
        self.assertIsNone(result['max_score'])
        self.assertEqual(result['total_score'], 7.5)
        self.assertTrue(result['history_warning'])
        snapshot, _ = review_fixture()
        result = answer_review(row(snapshot, None))
        self.assertTrue(all(q['status'] == 'unanswered' for q in result['questions']))


@unittest.skipUnless(os.environ.get('RUN_RELEASE_TESTS') == '1', 'Disposable auditdb required')
class AdminReviewTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = release.ReleaseTests.asyncSetUp
    cleanup = release.ReleaseTests.cleanup
    request = release.ReleaseTests.request

    async def attempt(self, status='submitted', with_snapshot=True):
        snapshot, responses = review_fixture()
        access = await self.pool.fetchval("INSERT INTO ent_trial_accesses(granted_by_id,combination,target_type) VALUES($1,'infmat','all') RETURNING id", self.users['admin']['id'])
        return await self.pool.fetchval('''INSERT INTO ent_trial_attempts(access_id,student_id,combination,status,snapshot,responses,total_score,scores_by_subject,submitted_at)
            VALUES($1,$2,'infmat',$3,$4::jsonb,$5::jsonb,7.5,'{"mathematics":7,"informatics":0.5}',CASE WHEN $3='submitted' THEN now() ELSE NULL END) RETURNING id''',
            access, self.users['student']['id'], status, json.dumps(snapshot) if with_snapshot else None, json.dumps(responses))

    async def test_admin_review_read_only_even_if_bank_changed_and_logs_preserved(self):
        aid = await self.attempt()
        await self.pool.execute("INSERT INTO ent_questions(id,subject,prompt) VALUES(1,'kaz_history','Edited current bank')")
        await self.pool.execute("INSERT INTO ent_proctor_events(attempt_id,event_type,details) VALUES($1,'tab_hidden','{\"fixture\":true}')", aid)
        await self.pool.execute("INSERT INTO ent_absence_periods(attempt_id,started_at,ended_at,duration_seconds) VALUES($1,now()-interval '3 minutes',now(),180)", aid)
        before = dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid))
        logs = [dict(r) for r in await self.pool.fetch('SELECT * FROM ent_proctor_events WHERE attempt_id=$1', aid)]
        absences = [dict(r) for r in await self.pool.fetch('SELECT * FROM ent_absence_periods WHERE attempt_id=$1', aid)]
        with (patch('routers.ent_trial.ensure_snapshot', side_effect=AssertionError('No hydration')),
              patch('routers.ent_trial.finalize_expired', side_effect=AssertionError('No finalization')),
              patch('routers.ent_trial.load_questions', side_effect=AssertionError('No latest bank'))):
            response = await self.request('GET', f'/ent-trial/admin/attempts/{aid}/review', 'admin')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['questions'][0]['prompt'], 'Original $x^2$')
        self.assertEqual(response.json()['total_score'], 7.5)
        self.assertEqual(next(s for s in response.json()['subjects'] if s['subject'] == 'mathematics')['score'], 7)
        log_response = await self.request('GET', f'/ent-trial/admin/attempts/{aid}/proctor-events', 'admin')
        self.assertEqual(log_response.status_code, 200)
        details = log_response.json()['items'][0]['details']
        self.assertEqual(json.loads(details) if isinstance(details, str) else details, {'fixture': True})
        self.assertEqual(log_response.json()['absences'][0]['duration_seconds'], 180)
        self.assertEqual(dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid)), before)
        self.assertEqual([dict(r) for r in await self.pool.fetch('SELECT * FROM ent_proctor_events WHERE attempt_id=$1', aid)], logs)
        self.assertEqual([dict(r) for r in await self.pool.fetch('SELECT * FROM ent_absence_periods WHERE attempt_id=$1', aid)], absences)

    async def test_student_teacher_and_unauthenticated_cannot_read_keys(self):
        aid = await self.attempt()
        for role in ('student', 'teacher'):
            response = await self.request('GET', f'/ent-trial/admin/attempts/{aid}/review', role)
            self.assertEqual(response.status_code, 403, response.text)
            self.assertNotIn('is_correct', response.text)
        response = await self.client.get(f'/ent-trial/admin/attempts/{aid}/review')
        self.assertIn(response.status_code, (401, 403))
        public = await self.request('GET', f'/ent-trial/attempts/{aid}')
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json()['questions'], {})
        self.assertNotIn('is_correct', public.text)

    async def test_in_progress_and_unknown_attempt_do_not_leak_or_finalize(self):
        aid = await self.attempt('in_progress')
        await self.pool.execute("UPDATE ent_trial_attempts SET deadline_at=now()-interval '1 second' WHERE id=$1", aid)
        before = dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid))
        response = await self.request('GET', f'/ent-trial/admin/attempts/{aid}/review', 'admin')
        self.assertEqual(response.status_code, 409)
        self.assertNotIn('is_correct', response.text)
        self.assertEqual(dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid)), before)
        self.assertEqual((await self.request('GET', '/ent-trial/admin/attempts/999999/review', 'admin')).status_code, 404)

    async def test_missing_historical_snapshot_stays_missing(self):
        aid = await self.attempt(with_snapshot=False)
        response = await self.request('GET', f'/ent-trial/admin/attempts/{aid}/review', 'admin')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()['review_available'])
        self.assertEqual(response.json()['total_score'], 7.5)
        self.assertIsNone(await self.pool.fetchval('SELECT snapshot FROM ent_trial_attempts WHERE id=$1', aid))

    async def test_future_completion_persists_actual_points_atomically_once_without_answer_changes(self):
        aid = await self.attempt('in_progress')
        before = dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid))
        async with self.pool.acquire() as conn, conn.transaction():
            attempt = dict(await conn.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1 FOR UPDATE', aid))
            result = await finish(conn, attempt)
        ledger = json.loads(result['question_scores'])
        self.assertEqual(len(ledger['points']), 120)
        self.assertEqual(sum(p['awarded'] for p in ledger['points'].values()), float(result['total_score']))
        self.assertEqual(ledger['points']['1'], {'awarded': 1, 'maximum': 1})
        self.assertEqual(ledger['points']['2'], {'awarded': 0, 'maximum': 1})
        self.assertEqual(result['responses'], before['responses'])
        self.assertEqual(result['snapshot'], before['snapshot'])
        reviewed = (await self.request('GET', f'/ent-trial/admin/attempts/{aid}/review', 'admin')).json()
        self.assertTrue(all(q['evaluation_source'] == 'stored' for q in reviewed['questions']))
        async with self.pool.acquire() as conn, conn.transaction():
            self.assertEqual(dict(await finish(conn, result)), dict(result))
        public = await self.request('GET', f'/ent-trial/attempts/{aid}')
        self.assertNotIn('question_scores', public.json())

    async def test_historical_review_reconstruction_does_not_backfill_or_modify_final_results(self):
        aid = await self.attempt()
        snapshot, responses = review_fixture()
        consistent = consistent_row(snapshot, responses)
        await self.pool.execute('UPDATE ent_trial_attempts SET total_score=$2,scores_by_subject=$3::jsonb WHERE id=$1', aid, consistent['total_score'], json.dumps(consistent['scores_by_subject']))
        before = dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid))
        self.assertIsNone(before['question_scores'])
        response = await self.request('GET', f'/ent-trial/admin/attempts/{aid}/review', 'admin')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(all(q['evaluation_source'] == 'reconstructed' for q in response.json()['questions']))
        self.assertEqual(dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid)), before)
        async with self.pool.acquire() as conn, conn.transaction():
            self.assertEqual(await finish(conn, before), before)  # No auto-backfill of submitted attempts.

    async def test_additive_points_migration_keeps_historical_rows_and_is_idempotent(self):
        from scripts.init_db import ENT_MIGRATIONS
        aid = await self.attempt()
        await self.pool.execute('ALTER TABLE ent_trial_attempts DROP COLUMN question_scores')
        before = dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid))
        migration = next(sql for sql in ENT_MIGRATIONS if 'ADD COLUMN IF NOT EXISTS question_scores' in sql)
        await self.pool.execute(migration)
        await self.pool.execute(migration)
        after = dict(await self.pool.fetchrow('SELECT * FROM ent_trial_attempts WHERE id=$1', aid))
        self.assertIsNone(after.pop('question_scores'))
        self.assertEqual(after, before)
