"""Read-only snapshot review. Historical reconstruction never writes/regrades results."""
import json
from math import isfinite
from core.ent_rules import COMBINATIONS, SUBJECT_LABELS, RULES_VERSION, score_question


def decoded(value):
    return json.loads(value) if isinstance(value, str) else value


def saved_subject_scores(attempt):
    scores = decoded(attempt.get('scores_by_subject')) or {}
    if isinstance(scores, dict) and scores:
        return scores
    profiles = COMBINATIONS.get(attempt['combination'], (None, None))
    return {k: v for k, v in zip(('kaz_history', 'reading', 'math_literacy', *profiles),
                                (attempt['kaz_history_score'], attempt['reading_score'], attempt['math_score'],
                                 attempt['subject1_score'], attempt['subject2_score'])) if k}


def verified_points(attempt, snapshot, responses):
    """Accept saved awards or exactly reproducible v1 awards only when ALL totals agree."""
    questions = snapshot.get('questions') or []
    if not questions or len({q.get('question_id') for q in questions if isinstance(q, dict)}) != len(questions):
        return {}, None
    def matches(points):
        try:
            subjects = dict.fromkeys(snapshot.get('subjects') or [], 0)
            for q in questions:
                value = points[str(q['question_id'])]
                award, maximum = value['awarded'], value['maximum']
                if not all(isinstance(n, (int, float)) and not isinstance(n, bool) and isfinite(n) for n in (award, maximum)):
                    return False
                if not 0 <= award <= maximum or maximum != q.get('max_points'):
                    return False
                subjects[q['subject']] = subjects.get(q['subject'], 0) + award
            stored = saved_subject_scores(attempt)
            return (sum(subjects.values()) == float(attempt['total_score']) and
                    all(subject in stored and value == float(stored[subject]) for subject, value in subjects.items()) and
                    all(subject in subjects or float(value) == 0 for subject, value in stored.items()))
        except (KeyError, TypeError, ValueError):
            return False
    ledger = decoded(attempt.get('question_scores')) or {}
    if isinstance(ledger, dict) and ledger.get('version') == 1 and ledger.get('rules_version') == snapshot.get('version') and matches(ledger.get('points', {})):
        return ledger['points'], 'stored'
    # Unknown/legacy versions are NOT run through today's grader. The v1 scorer
    # is deterministic for this immutable version; require complete valid inputs
    # plus exact agreement with total AND every saved subject result.
    if snapshot.get('version') != 'ent-2026-v1' or RULES_VERSION != 'ent-2026-v1' or snapshot.get('question_count') != len(questions):
        return {}, None
    try:
        if not isinstance(responses, dict) or not set(responses) <= {str(q['question_id']) for q in questions}:
            return {}, None
        points = {}
        for q in questions:
            kind = q['question_type']
            if kind not in ('single_choice', 'context', 'multi_choice', 'matching') or q.get('legacy_matching'):
                return {}, None
            if q.get('max_points') != (2 if kind in ('multi_choice', 'matching') else 1):
                return {}, None
            options = q['options']
            ids = {o['id'] for o in options}
            if len(ids) != len(options):
                return {}, None
            response = responses.get(str(q['question_id']), {})
            if not isinstance(response, dict):
                return {}, None
            if kind == 'matching':
                pairs = q['matching_pairs']
                if len(pairs) != 2 or len({p['id'] for p in pairs}) != 2 or any(p.get('correct_option_id') not in ids for p in pairs):
                    return {}, None
                selected = response.get('matching_answer') or {}
                if not set(selected) <= {str(p['id']) for p in pairs} or any(v not in ids for v in selected.values()):
                    return {}, None
            else:
                correct = [o['id'] for o in options if o.get('is_correct')]
                if not (1 <= len(correct) <= 3 if kind == 'multi_choice' else len(correct) == 1):
                    return {}, None
                if kind == 'multi_choice':
                    selected = response.get('selected_option_ids') or []
                else:
                    selected = [response['selected_option_id']] if response.get('selected_option_id') is not None else []
                if not set(selected) <= ids:
                    return {}, None
            points[str(q['question_id'])] = {'awarded': score_question(q, response), 'maximum': q['max_points']}
        if sum(v['maximum'] for v in points.values()) != snapshot.get('max_score') or not matches(points):
            return {}, None
        return points, 'reconstructed'
    except (KeyError, TypeError, ValueError):
        return {}, None


def answer_review(attempt):
    snapshot = decoded(attempt.get('snapshot')) or {}
    raw_responses = decoded(attempt.get('responses'))
    snapshot = snapshot if isinstance(snapshot, dict) else {}
    responses = raw_responses if isinstance(raw_responses, dict) else {}
    awards, award_source = verified_points(attempt, snapshot, raw_responses)
    questions = []
    for index, source in enumerate(snapshot.get('questions') or []):
        if not isinstance(source, dict) or not all(key in source for key in ('question_id', 'question_type', 'subject')):
            continue
        q = dict(source)
        response = responses.get(str(q['question_id']), {})
        response = response if isinstance(response, dict) else {}
        options = q.get('options') or []
        pairs = q.get('matching_pairs') or []
        selected = set(response.get('selected_option_ids') or [])
        if response.get('selected_option_id') is not None:
            selected.add(response['selected_option_id'])
        matching = response.get('matching_answer') or {}
        if q['question_type'] == 'matching':
            answered = any(v is not None and v != '' for v in matching.values())
            keys_known = bool(pairs) and all(p.get('correct_option_id') is not None for p in pairs)
            exact = keys_known and all(str(matching.get(str(p['id']), '')) == str(p['correct_option_id']) for p in pairs)
        else:
            correct = {o['id'] for o in options if o.get('is_correct')}
            keys_known = bool(correct)
            answered = bool(selected)
            exact = keys_known and selected == correct
        award = awards.get(str(q['question_id']))
        points = award['awarded'] if award else q.get('legacy_points_earned')
        maximum = award['maximum'] if award else q.get('max_points')
        if points is not None:
            points = float(points)
        status = 'unanswered' if not answered else 'correct' if exact else 'incorrect' if keys_known else 'unknown'
        if answered and points is not None and maximum is not None:
            status = 'correct' if points == maximum else 'partial' if 0 < points < maximum else 'incorrect'
        questions.append({
            'question_id': q['question_id'], 'number': index + 1,
            'subject': q['subject'], 'subject_label': SUBJECT_LABELS.get(q['subject'], q['subject']),
            'position': q.get('position'), 'question_type': q['question_type'],
            'prompt': q.get('prompt', ''), 'context_text': q.get('context_text', ''),
            'image_file_id': q.get('image_file_id'), 'image_url': q.get('image_url', ''),
            'image_placement': q.get('image_placement', 'after'), 'image_width': q.get('image_width', 640),
            'image_alt': q.get('image_alt', ''), 'options': options, 'matching_pairs': pairs,
            'response': response, 'status': status, 'keys_available': keys_known,
            'points_earned': points, 'max_points': maximum,
            'evaluation_source': award_source if award else 'stored' if points is not None else 'snapshot_keys' if keys_known else 'unavailable',
        })
    scores = saved_subject_scores(attempt)
    subjects = []
    for subject in snapshot.get('subjects') or [s for s in scores if s]:
        relevant = [q for q in questions if q['subject'] == subject]
        maximum = sum(q['max_points'] for q in relevant) if relevant and all(q['max_points'] is not None for q in relevant) else None
        score = float(scores[subject]) if scores.get(subject) is not None else None
        subjects.append({'subject': subject, 'label': SUBJECT_LABELS.get(subject, subject),
                         'score': score, 'max_score': maximum,
                         'percentage': round(score / maximum * 100, 2) if score is not None and maximum else None})
    maximum = snapshot.get('max_score')
    if maximum is None and questions and all(q['max_points'] is not None for q in questions):
        maximum = sum(q['max_points'] for q in questions)
    total = float(attempt['total_score'])
    return {
        'id': attempt['id'], 'access_id': attempt['access_id'], 'attempt_number': attempt['attempt_number'],
        'student_name': attempt['full_name'], 'student_email': attempt['email'],
        'title': snapshot.get('title') or 'Тест атауы сақталмаған',
        'started_at': attempt['started_at'], 'submitted_at': attempt['submitted_at'],
        'total_score': total, 'max_score': maximum,
        'percentage': round(total / maximum * 100, 2) if maximum else None,
        'subjects': subjects, 'questions': questions, 'review_available': bool(questions),
        'history_warning': (
            'Сұрақтардың тарихи көшірмесі сақталмаған. Қазіргі банк пайдаланылмайды.' if not questions else
            'Бұрынғы форматтың сақталған көшірмесі. Бастапқы көрсету реті бөлек сақталмаған.' if snapshot.get('version') == 'legacy' else None),
        'points_warning': 'Кейбір жеке ұпайлар сақталмаған және дәл қалпына келтіру расталмады. Тарихи жалпы нәтиже өзгермейді.' if any(q['points_earned'] is None for q in questions) else
            'Жеке ұпайлар тарихи көшірме мен бастапқы бағалау ережесінен қалпына келтірілді. Жалпы және барлық пәндік нәтижелермен сәйкестігі тексерілді. Сақталған нәтиже өзгермейді.' if award_source == 'reconstructed' else None,
    }
