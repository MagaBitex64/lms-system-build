import copy
import datetime as dt
import itertools
import unittest

from fastapi import HTTPException
from core.ent_rules import COMBINATIONS, blueprint, blueprint_metrics, question_issues, score_multi_choice, score_question, validate_variant, variant_blueprint
from routers.ent_trial import AnswersIn, make_snapshot, normalized_answers, public_attempt


def fixture(combination="infmat"):
    """Synthetic structural fixture only; never used as educational content."""
    qs, contexts = [], []
    for subject, rule in blueprint(combination).items():
        for block in rule["contexts"]:
            words = block["word_range"][0] if block["word_range"] else 20
            contexts.append({"subject": subject, "start_position": block["start"], "content": " ".join([f"Fixture-{subject}-{block['start']}"] * words)})
        levels = [level for level, count in rule["difficulty_quota"].items() for _ in range(count)]
        for slot in rule["slots"]:
            qid = len(qs) + 1
            options = [{"id": qid * 10 + i, "text": f"Option {i}", "is_correct": i == 0} for i in range(slot["option_count"])]
            pairs = [{"id": qid * 10 + i, "left_text": f"Row {i}", "right_text": options[i * 2]["text"], "correct_option_position": i * 2} for i in range(2)] if slot["question_type"] == "matching" else []
            qs.append({"id": qid, "subject": subject, "position": slot["position"], "prompt": "Synthetic question",
                       "question_type": slot["question_type"], "max_points": slot["max_points"], "difficulty": levels[slot["position"]],
                       "options": options, "matching_pairs": pairs, "explanation": "PRIVATE SOLUTION", "image_url": "", "context_text": ""})
    return {"title": "TEST ONLY", "combination": combination}, qs, contexts


class EntRulesTests(unittest.TestCase):
    def test_all_combinations_have_120_questions_and_140_points(self):
        for combo in COMBINATIONS:
            with self.subTest(combo=combo):
                v, qs, contexts = fixture(combo)
                self.assertEqual(len(qs), 120)
                self.assertEqual(sum(q["max_points"] for q in qs), 140)
                self.assertTrue(validate_variant(combo, qs, contexts)["ready"])
                snapshot = make_snapshot(v, qs, contexts)
                total = 0
                for q in snapshot["questions"]:
                    response = {"selected_option_id": q["options"][0]["id"], "selected_option_ids": [q["options"][0]["id"]],
                                "matching_answer": {str(p["id"]): p["correct_option_id"] for p in q["matching_pairs"]}}
                    total += score_question(q, response)
                self.assertEqual(total, 140)

    def test_context_boundaries(self):
        rules = blueprint("infmat")
        self.assertEqual([s["context_start"] for s in rules["kaz_history"]["slots"]], [None] * 10 + [10] * 5 + [15] * 5)
        self.assertEqual([s["context_start"] for s in rules["reading"]["slots"]], [0] * 2 + [2] * 3 + [5] * 5)
        profile = rules["mathematics"]["slots"]
        self.assertEqual([s["question_type"] for s in profile], ["single_choice"] * 25 + ["context"] * 5 + ["matching"] * 5 + ["multi_choice"] * 5)

    def test_single_subject_uses_the_same_subject_rules(self):
        _, all_questions, all_contexts = fixture()
        questions = [q for q in all_questions if q["subject"] == "mathematics"]
        contexts = [c for c in all_contexts if c["subject"] == "mathematics"]
        rules = variant_blueprint("infmat", "single", "mathematics")
        self.assertEqual(blueprint_metrics(rules), {"question_count": 40, "max_score": 50, "duration_seconds": 4800})
        self.assertTrue(validate_variant("infmat", questions, contexts, "single", "mathematics")["ready"])

    def test_shared_context_can_be_extended_or_replaced_per_question(self):
        variant, questions, contexts = fixture()
        question = questions[10]
        question["context_mode"] = "addendum"; question["context_override"] = "Жеке қосымша"
        snapshot = make_snapshot(variant, questions, contexts)
        result = snapshot["questions"][10]["context_text"]
        self.assertTrue(result.endswith("Жеке қосымша"))
        question["context_mode"] = "override"; question["context_override"] = "Тек жеке мәтін"
        snapshot = make_snapshot(variant, questions, contexts)
        self.assertEqual(snapshot["questions"][10]["context_text"], "Тек жеке мәтін")

    def test_multi_choice_exhaustive_192_cases(self):
        partial = {1: {(1, 1)}, 2: {(1, 0), (1, 1), (2, 1)}, 3: {(2, 0), (2, 1), (3, 1)}}
        for k in (1, 2, 3):
            correct = set(range(k))
            for mask in range(64):
                selected = {i for i in range(6) if mask & (1 << i)}
                expected = 2 if selected == correct else int((len(selected & correct), len(selected - correct)) in partial[k])
                self.assertEqual(score_multi_choice(selected, correct), expected, (k, selected))
        self.assertEqual(score_multi_choice([0, 0, 0], [0]), 2)
        self.assertEqual(score_multi_choice([0, 1, 2], [0]), 0)
        self.assertEqual(score_multi_choice([0, 1, 2, 3], [0, 1, 2]), 1)

    def test_matching_two_rows_independent_25_cases(self):
        v, qs, contexts = fixture()
        q = next(q for q in make_snapshot(v, qs, contexts)["questions"] if q["question_type"] == "matching")
        for selected in itertools.product([None] + [o["id"] for o in q["options"]], repeat=2):
            answer = {"matching_answer": {str(p["id"]): s for p, s in zip(q["matching_pairs"], selected) if s is not None}}
            expected = sum(s == p["correct_option_id"] for p, s in zip(q["matching_pairs"], selected))
            self.assertEqual(score_question(q, answer), expected)

    def test_validation_rejects_missing_context_wrong_type_duplicate_and_quota(self):
        _, qs, contexts = fixture()
        self.assertFalse(validate_variant("infmat", qs, contexts[1:])["ready"])
        self.assertFalse(validate_variant("infmat", qs[:-1], contexts)["ready"])
        self.assertFalse(validate_variant("infmat", qs + [qs[0]], contexts)["ready"])
        qs[0]["difficulty"] = "C"
        self.assertFalse(validate_variant("infmat", qs, contexts)["ready"])
        q = copy.deepcopy(qs[0]); q["question_type"] = "matching"
        self.assertTrue(question_issues(q, blueprint("infmat")["kaz_history"]["slots"][0]))
        q = copy.deepcopy(qs[0]); q["options"].pop()
        self.assertTrue(question_issues(q, blueprint("infmat")["kaz_history"]["slots"][0]))

    def test_keys_and_explanations_not_disclosed_and_snapshot_unchanged(self):
        v, qs, contexts = fixture()
        snapshot = make_snapshot(v, qs, contexts)
        timestamp = dt.datetime.now(dt.timezone.utc)
        attempt = dict(id=1, status="in_progress", combination="infmat", variant_id=1, snapshot=snapshot, responses={},
                       started_at=timestamp, deadline_at=timestamp + dt.timedelta(hours=4), submitted_at=None, response_revision=0,
                       kaz_history_score=0, reading_score=0, math_score=0, subject1_score=0, subject2_score=0, total_score=0)
        before = copy.deepcopy(snapshot)
        public = public_attempt(attempt)
        for q in itertools.chain.from_iterable(public["questions"].values()):
            self.assertNotIn("explanation", q)
            self.assertNotIn("points_earned", q)
            for o in q["options"]:
                self.assertNotIn("is_correct", o)
            for p in q["matching_pairs"]:
                self.assertNotIn("right_text", p)
                self.assertNotIn("correct_option_id", p)
                self.assertNotIn("correct_option_position", p)
        self.assertEqual(before, snapshot)

    def test_answer_validation(self):
        v, qs, contexts = fixture()
        snapshot = make_snapshot(v, qs, contexts)
        q = snapshot["questions"][0]
        for answers in ([{"question_id": -1}], [{"question_id": q["question_id"], "selected_option_id": -999}],
                        [{"question_id": q["question_id"]}] * 2):
            with self.assertRaises(HTTPException):
                normalized_answers(snapshot, AnswersIn(revision=0, answers=answers))
        multi = next(q for q in snapshot["questions"] if q["question_type"] == "multi_choice")
        result = normalized_answers(snapshot, AnswersIn(revision=0, answers=[{"question_id": multi["question_id"], "selected_option_ids": [o["id"] for o in multi["options"]]}]))
        self.assertEqual(len(result[str(multi["question_id"])]["selected_option_ids"]), 6)


if __name__ == "__main__":
    unittest.main()
