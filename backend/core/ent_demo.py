"""Deterministic complete demo ENT variant used by the development seed."""
from core.ent_rules import variant_blueprint

DEMO_TITLE = "Демо ҰБТ — толық нұсқа"


def demo_context(subject, start, end, word_range):
    if word_range:
        target = (word_range[0] + word_range[1]) // 2
        words = [f"мәтін{i + 1}" for i in range(target)]
        return " ".join(words)
    return (f"{subject} пәні бойынша №{start + 1}–{end + 1} сұрақтарға арналған ортақ контекст. "
            "Бұл демонстрациялық мәтін оқиға, дерек және қысқаша түсіндірмені қамтиды.")


async def seed_demo_ent(conn, admin_id):
    existing = await conn.fetchval("SELECT id FROM ent_variants WHERE title=$1", DEMO_TITLE)
    if existing:
        return existing
    variant_id = await conn.fetchval("""INSERT INTO ent_variants(title,description,combination,exam_mode)
        VALUES($1,$2,'infmat','full') RETURNING id""", DEMO_TITLE,
        "ЕНТ редакторы, контексттер, сәйкестендіру және бірнеше жауап форматтарын көрсетуге арналған толық 120 сұрақтық нұсқа.")
    rules = variant_blueprint("infmat")
    for subject, rule in rules.items():
        for block in rule["contexts"]:
            await conn.execute("""INSERT INTO ent_contexts(variant_id,subject,start_position,content)
                VALUES($1,$2,$3,$4)""", variant_id, subject, block["start"],
                demo_context(subject, block["start"], block["end"], block["word_range"]))
        quota_a, quota_b = rule["difficulty_quota"]["A"], rule["difficulty_quota"]["B"]
        for slot in rule["slots"]:
            position = slot["position"]
            difficulty = "A" if position < quota_a else "B" if position < quota_a + quota_b else "C"
            prompt = f"{rule['label']} пәні бойынша демонстрациялық сұрақ №{position + 1}. Дұрыс жауапты таңдаңыз."
            qid = await conn.fetchval("""INSERT INTO ent_questions
                (variant_id,subject,position,prompt,question_type,explanation,max_points,difficulty,context_mode)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,'shared') RETURNING id""",
                variant_id, subject, position, prompt, slot["question_type"],
                "Бұл демонстрациялық сұрақта бірінші нұсқа дұрыс деп белгіленген.", slot["max_points"], difficulty)
            for option_position in range(slot["option_count"]):
                correct = slot["question_type"] != "matching" and (
                    option_position == 0 or slot["question_type"] == "multi_choice" and option_position == 1)
                await conn.execute("""INSERT INTO ent_options(question_id,text,is_correct,position)
                    VALUES($1,$2,$3,$4)""", qid,
                    f"{chr(65 + option_position)} жауабы · {subject} {position + 1}", correct, option_position)
            if slot["question_type"] == "matching":
                for pair_position in range(2):
                    await conn.execute("""INSERT INTO ent_matching_pairs
                        (question_id,left_text,right_text,position,correct_option_position)
                        VALUES($1,$2,$3,$4,$5)""", qid, f"{chr(65 + pair_position)} сәйкестендіру жолы",
                        f"{chr(65 + pair_position)} жауабы · {subject} {position + 1}", pair_position, pair_position)
    return variant_id
