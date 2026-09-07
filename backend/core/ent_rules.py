"""Standard full-school ENT 2026. Slot numbers in storage are zero-based.

Sources and intentionally unsupported formats: docs/ent-rules.md.
This module has no I/O so the blueprint and every scoring branch can be tested.
"""
from collections import Counter

RULES_VERSION = "ent-2026-v1"
DURATION_SECONDS = 240 * 60
SECONDS_PER_QUESTION = 120
COMBINATIONS = {
    "infmat": ["informatics", "mathematics"],
    "phymat": ["physics", "mathematics"],
    "biochem": ["biology", "chemistry"],
    "chemphi": ["chemistry", "physics"],
    "matgeo": ["mathematics", "geography"],
    "biogeo": ["biology", "geography"],
    "langhist": ["foreign_language", "world_history"],
    "geolang": ["geography", "foreign_language"],
    "histlaw": ["world_history", "law"],
    "histgeo": ["world_history", "geography"],
    "kazlit": ["kazakh_language", "kazakh_literature"],
    "ruslit": ["russian_language", "russian_literature"],
}
SUBJECT_LABELS = {
    "kaz_history": "Қазақстан тарихы", "reading": "Оқу сауаттылығы",
    "math_literacy": "Математикалық сауаттылық", "informatics": "Информатика",
    "mathematics": "Математика", "physics": "Физика", "biology": "Биология",
    "chemistry": "Химия", "geography": "География", "foreign_language": "Шет тілі",
    "world_history": "Дүниежүзі тарихы", "law": "Құқық негіздері",
    "kazakh_language": "Қазақ тілі", "kazakh_literature": "Қазақ әдебиеті",
    "russian_language": "Орыс тілі", "russian_literature": "Орыс әдебиеті",
}
MANDATORY_SUBJECTS = {"kaz_history": 20, "reading": 10, "math_literacy": 10}


def subject_blueprint(subject):
    if subject not in SUBJECT_LABELS:
        raise KeyError(subject)
    count = MANDATORY_SUBJECTS.get(subject, 40)
    if subject == "kaz_history":
        blocks = [(10, 14, None), (15, 19, None)]
    elif subject == "reading":
        blocks = [(0, 1, [60, 100]), (2, 4, [100, 150]), (5, 9, [150, 350])]
    elif subject in MANDATORY_SUBJECTS:
        blocks = []
    else:
        blocks = [(25, 29, None)]
    contexts = [{"start": a, "end": b, "word_range": words} for a, b, words in blocks]
    slots = []
    for position in range(count):
        context = next((c for c in contexts if c["start"] <= position <= c["end"]), None)
        kind = "context" if context else "single_choice"
        if count == 40 and position >= 30:
            kind = "matching" if position < 35 else "multi_choice"
        slots.append({"position": position, "number": position + 1, "question_type": kind,
                      "max_points": 2 if kind in ("matching", "multi_choice") else 1,
                      "option_count": 6 if kind == "multi_choice" else 4,
                      "context_start": context["start"] if context else None})
    return {"label": SUBJECT_LABELS[subject], "slots": slots, "contexts": contexts,
            "difficulty_quota": {"A": count // 2, "B": count * 3 // 10, "C": count // 5}}


def blueprint(combination):
    subjects = {}
    for subject in {**MANDATORY_SUBJECTS, **dict.fromkeys(COMBINATIONS[combination], 40)}:
        subjects[subject] = subject_blueprint(subject)
    return subjects


def variant_blueprint(combination, exam_mode="full", single_subject=None):
    if exam_mode == "single":
        if single_subject not in SUBJECT_LABELS:
            raise KeyError(single_subject)
        return {single_subject: subject_blueprint(single_subject)}
    return blueprint(combination)


def blueprint_metrics(rules):
    question_count = sum(len(rule["slots"]) for rule in rules.values())
    max_score = sum(slot["max_points"] for rule in rules.values() for slot in rule["slots"])
    return {"question_count": question_count, "max_score": max_score,
            "duration_seconds": question_count * SECONDS_PER_QUESTION}


def question_issues(question, slot):
    errors = []
    if question["question_type"] != slot["question_type"]:
        errors.append(f"Қажетті түрі: {slot['question_type']}")
    if not question.get("prompt", "").strip() and not (question.get("image_file_id") or question.get("image_url")):
        errors.append("Сұрақ мәтіні немесе суреті қажет")
    if question.get("difficulty") not in ("A", "B", "C"):
        errors.append("A, B немесе C күрделілігін таңдаңыз")
    options = question.get("options", [])
    if len(options) != slot["option_count"] or any(not o.get("text", "").strip() for o in options):
        errors.append(f"Толтырылған {slot['option_count']} жауап нұсқасы қажет")
    if len({o.get("text", "").strip().casefold() for o in options}) != len(options):
        errors.append("Жауап нұсқалары қайталанбауы тиіс")
    correct_count = sum(bool(o.get("is_correct")) for o in options)
    if slot["question_type"] != "matching" and question.get("matching_pairs"):
        errors.append("Бұл сұрақта сәйкестендіру жолдары болмауы тиіс")
    if slot["question_type"] == "matching":
        pairs = question.get("matching_pairs", [])
        if len(pairs) != 2 or any(not p.get("left_text", "").strip() or
                                 p.get("correct_option_position") not in range(4) for p in pairs):
            errors.append("A және B жолдарын толтырып, әрқайсысына 4 нұсқадан дұрыс жауап таңдаңыз")
    elif slot["question_type"] == "multi_choice":
        if not 1 <= correct_count <= 3:
            errors.append("1–3 дұрыс жауап белгілеңіз")
    elif correct_count != 1:
        errors.append("Дәл 1 дұрыс жауап белгілеңіз")
    return errors


def validate_variant(combination, questions, contexts, exam_mode="full", single_subject=None):
    rules = variant_blueprint(combination, exam_mode, single_subject)
    issues = []
    for question in questions:
        if question["subject"] not in rules or question["position"] not in range(len(rules.get(question["subject"], {}).get("slots", []))):
            issues.append({"subject": question["subject"], "position": question["position"], "message": "Артық сұрақ: құрылымнан тыс"})
    for subject, rule in rules.items():
        qs = [q for q in questions if q["subject"] == subject]
        for slot in rule["slots"]:
            matching = [q for q in qs if q["position"] == slot["position"]]
            messages = ["Сұрақ толтырылмаған"] if not matching else question_issues(matching[0], slot)
            if len(matching) > 1:
                messages.append("Осы нөмірде бірнеше сұрақ бар; артық сұрақты жойыңыз")
            for message in messages:
                issues.append({"subject": subject, "position": slot["position"], "message": message})
        for block in rule["contexts"]:
            content = next((c["content"] for c in contexts if c["subject"] == subject and c["start_position"] == block["start"]), "")
            message = None
            if not content.strip():
                message = f"№{block['start'] + 1}–{block['end'] + 1} үшін ортақ контекст қажет"
            elif block["word_range"] and not block["word_range"][0] <= len(content.split()) <= block["word_range"][1]:
                message = f"Контекст көлемі: {block['word_range'][0]}–{block['word_range'][1]} сөз"
            if message:
                issues.append({"subject": subject, "position": block["start"], "message": message})
        counts = Counter(q.get("difficulty") for q in qs)
        if any(counts[k] != n for k, n in rule["difficulty_quota"].items()):
            quota = rule["difficulty_quota"]
            issues.append({"subject": subject, "position": None, "message": f"Күрделілік квотасы: A={quota['A']}, B={quota['B']}, C={quota['C']}"})
    metrics = blueprint_metrics(rules)
    return {"ready": not issues, "issues": issues, **metrics}


def score_multi_choice(selected_ids, correct_ids):
    correct, selected = set(correct_ids), set(selected_ids)
    good, wrong = len(selected & correct), len(selected - correct)
    if not 1 <= len(correct) <= 3:
        return 0
    if selected == correct:
        return 2
    return int(good >= max(1, len(correct) - 1) and wrong <= 1)


def score_question(question, answer):
    correct = [o["id"] for o in question["options"] if o.get("is_correct")]
    if question["question_type"] == "multi_choice":
        return score_multi_choice(answer.get("selected_option_ids", []), correct)
    if question["question_type"] == "matching":
        selected = answer.get("matching_answer", {})
        return min(2, sum(str(selected.get(str(p["id"]), "")) == str(p["correct_option_id"])
                          for p in question["matching_pairs"]))
    return int(answer.get("selected_option_id") in correct)
