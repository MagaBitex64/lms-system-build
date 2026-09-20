"""Seed full ENT variants (three distinct variants) into the database.

This script uses the existing blueprint and insertion APIs to create three
complete `infmat` variants (120 questions each) without touching existing
data. It is idempotent by title: if a variant with the same title exists it
is skipped.

Run: python -m scripts.seed_ent_full (from backend/)
"""
import asyncio
import itertools
from core.config import DATABASE_URL
import asyncpg

from core.ent_rules import variant_blueprint

VARIANT_TITLES = [
    "Пробный ЕНТ — Вариант 1",
    "Пробный ЕНТ — Вариант 2",
    "Пробный ЕНТ — Вариант 3",
]


def demo_context_text(subject, start, end, word_range, variant_index):
    if word_range:
        target = (word_range[0] + word_range[1]) // 2
        words = [f"{subject}-мәтін-{variant_index}-{i+1}" for i in range(target)]
        return " ".join(words)
    return f"{subject} бойынша ортақ контекст (вариант {variant_index}) №{start+1}–{end+1}."


def option_text(subject, variant_index, subj_pos, opt_idx):
    return f"{subject} (в{variant_index}) сұрақ {subj_pos+1} · нұсқа {chr(65+opt_idx)}"


def make_options_texts(subject, vidx, pos, count):
    return [option_text(subject, vidx, pos, i) for i in range(count)]


def make_history_question_text(pos, vidx):
    # vary by era
    topics = [
        "Қазақ хандығының құрылуы", "Алаш қозғалысы", "Тәуелсіздік және Конституция", "Кеңес кезеңі және индустрияландыру",
        "Халықтар қозғалыстары", "Абай және мәдениет", "Астана және саяси өзгерістер", "Экономикалық реформалар"
    ]
    topic = topics[pos % len(topics)]
    return f"{topic}: қысқаша сұрақ. Вариант {vidx}. Осы сұраққа қатысты дұрыс жауапты таңдаңыз."


def make_history_options(pos, vidx):
    base = pos + vidx
    opts = [f"Жауап {i}" for i in range(1,5)]
    correct = base % 4
    return opts, correct


def make_math_literacy_question(pos, vidx):
    # simple percentage/ratio problems
    a = 10 + ((pos + 3 * vidx) % 50)
    price = 1000
    new_price = int(price * (100 - a) / 100)
    prompt = f"{price} тг тұратын затқа {a}% жеңілдік жасалды. Жаңа баға қанша?"
    opts = [f"{new_price} тг", f"{new_price + 100} тг", f"{new_price - 50} тг", f"{new_price + 50} тг"]
    return prompt, opts, 0


def make_reading_context(variant_index, block_len):
    # generate a realistic-looking paragraph using repeated informative sentences
    sentences = [
        "Бұл мәтін білім беру мен оқытуға арналған аналитикалық сипаттама.",
        "Оқушының дағдыларын дамыту мен бағалау туралы талқылау бар.",
        "Автор өмірлік мысалдар келтіріп, пікірін дәлелдейді.",
        "Мәтінде себептер мен нәтижелер логикалық түрде байланыстырылған.",
        "Қорытынды бөлім ұсыныстар мен қорытындыларды береді."
    ]
    words = []
    idx = 0
    while len(words) < block_len:
        words.extend(sentences[idx % len(sentences)].split())
        idx += 1
    return " ".join(words[:block_len])


def make_informatics_question(slot_type, pos, vidx):
    if slot_type == "single_choice":
        prompt = f"Компьютерлік жүйеде сұрақ №{pos+1}: қайсысы негізгі компонент болып табылады? (вариант {vidx})"
        opts = ["Процессор", "Принтер", "Монитор", "Қатты диск"]
        correct = 0
        return prompt, opts, correct
    if slot_type == "context":
        prompt = f"Берілген код үзіндісінің нәтижесін анықтаңыз: x=5; y=3; print(x+y). (вариант {vidx})"
        opts = ["8", "53", "Ошибка", "15"]
        correct = 0
        return prompt, opts, correct
    if slot_type == "matching":
        prompt = f"Бағдарламалау тілдерін қолдану салаларына сәйкестендіріңіз (вариант {vidx})."
        pairs = [
            {"left_text": "Python", "right_text": "Деректер ғылымы"},
            {"left_text": "JavaScript", "right_text": "Веб-бағдарламалау"}
        ]
        return prompt, pairs
    if slot_type == "multi_choice":
        prompt = f"Төмендегілердің қайсысы программалау тілдеріне жатады? (вариант {vidx})"
        opts = ["Python", "HTML", "Java", "CSS", "C++", "HTTP"]
        correct = [0,2,4]
        return prompt, opts, correct


def make_mathematics_question(slot_type, pos, vidx):
    if slot_type == "single_choice":
        prompt = f"Теңдеу шешімін табыңыз: 2x + {pos+1} = {10 + vidx}."
        x = (10 + vidx - (pos+1)) / 2
        opts = [str(int(x)), str(int(x+1)), str(int(x-1)), str(int(x+2))]
        correct = 0
        return prompt, opts, correct
    if slot_type == "context":
        prompt = f"Функцияға қатысты сұрақ: y=2x+{vidx}. x=3 болғандағы y мәні?"
        opts = [str(2*3 + vidx), str(3*vidx), str(vidx), str(0)]
        correct = 0
        return prompt, opts, correct
    if slot_type == "matching":
        prompt = f"Формулаларды атауларымен сәйкестендіріңіз (вариант {vidx})."
        pairs = [
            {"left_text": "S = πr²", "right_text": "Шеңбер ауданы"},
            {"left_text": "c² = a² + b²", "right_text": "Пифагор теоремасы"}
        ]
        return prompt, pairs
    if slot_type == "multi_choice":
        prompt = f"Төмендегі қасиеттердің қайсысы дұрыс? (вариант {vidx})"
        opts = ["a⁰=1", "a¹=a", "a⁻¹=a", "√(a²)=|a|", "(ab)ⁿ=aⁿbⁿ", "aⁿ+aⁿ=a²ⁿ"]
        correct = [0,1,3]
        return prompt, opts, correct



async def seed_full_ent(conn, admin_id):
    # create three variants for combination infmat
    for vidx, title in enumerate(VARIANT_TITLES, start=1):
        existing = await conn.fetchval("SELECT id FROM ent_variants WHERE title=$1", title)
        if existing:
            print(f"Variant exists, skipping: {title} -> {existing}")
            continue
        variant_id = await conn.fetchval("INSERT INTO ent_variants(title,description,combination,exam_mode) VALUES($1,$2,'infmat','full') RETURNING id",
                                         title, f"Пробный вариант {vidx} для проверки полного формата (infmat).")
        rules = variant_blueprint("infmat")
        # insert contexts
        for subject, rule in rules.items():
            for block in rule["contexts"]:
                if subject == 'reading' and block.get("word_range"):
                    # produce readable paragraph with length near middle of required words
                    rng = block["word_range"]
                    target = (rng[0] + rng[1]) // 2
                    content = make_reading_context(vidx, target)
                else:
                    content = demo_context_text(subject, block["start"], block["end"], block["word_range"], vidx)
                await conn.execute("""INSERT INTO ent_contexts(variant_id,subject,start_position,content)
                    VALUES($1,$2,$3,$4)""", variant_id, subject, block["start"], content)
        # insert questions per slot
        for subject, rule in rules.items():
            quota_a, quota_b = rule["difficulty_quota"]["A"], rule["difficulty_quota"]["B"]
            for slot in rule["slots"]:
                position = slot["position"]
                difficulty = "A" if position < quota_a else "B" if position < quota_a + quota_b else "C"
                # build question content according to subject and slot type
                q_prompt = f"{rule['label']} пәні. Вариант {vidx}. Сұрақ №{position+1}. Дұрыс жауапты таңдаңыз."
                opt_texts = []
                correct_flags = []
                matching_pairs = []
                if subject == 'kaz_history':
                    if slot["question_type"] in ('single_choice', 'context'):
                        q_prompt = make_history_question_text(position, vidx)
                        opts, correct = make_history_options(position, vidx)
                        opt_texts = opts
                        correct_flags = [i == correct for i in range(len(opts))]
                elif subject == 'math_literacy':
                    q_prompt, opts, correct = make_math_literacy_question(position, vidx)
                    opt_texts = opts
                    correct_flags = [i == correct for i in range(len(opts))]
                elif subject == 'reading':
                    # reading questions reference shared context; generate single-choice prompts
                    q_prompt = f"Оқу мәтініне қатысты сұрақ №{position+1} (вариант {vidx})."
                    opts = [f"Таңдау {i+1}" for i in range(4)]
                    opt_texts = opts
                    correct_flags = [i == (position + vidx) % 4 for i in range(4)]
                elif subject == 'informatics':
                    if slot["question_type"] == 'matching':
                        q_prompt, pairs = make_informatics_question('matching', position, vidx)
                        matching_pairs = pairs
                        # create 4 options to match against
                        opt_texts = [f"{p['right_text']}" for p in pairs] + [f"Қосымша жауап {i}" for i in range(2)]
                        correct_flags = [False] * len(opt_texts)
                    elif slot["question_type"] == 'multi_choice':
                        q_prompt, opts, correct_idx = make_informatics_question('multi_choice', position, vidx)
                        opt_texts = opts
                        correct_flags = [i in correct_idx for i in range(len(opts))]
                    else:
                        q_prompt, opts, correct = make_informatics_question('single_choice', position, vidx)
                        opt_texts = opts
                        correct_flags = [i == correct for i in range(len(opts))]
                elif subject == 'mathematics':
                    if slot["question_type"] == 'matching':
                        q_prompt, pairs = make_mathematics_question('matching', position, vidx)
                        matching_pairs = pairs
                        opt_texts = [f"{p['right_text']}" for p in pairs] + [f"Қосымша жауап {i}" for i in range(2)]
                        correct_flags = [False] * len(opt_texts)
                    elif slot["question_type"] == 'multi_choice':
                        q_prompt, opts, correct_idx = make_mathematics_question('multi_choice', position, vidx)
                        opt_texts = opts
                        correct_flags = [i in correct_idx for i in range(len(opts))]
                    else:
                        q_prompt, opts, correct = make_mathematics_question('single_choice', position, vidx)
                        opt_texts = opts
                        correct_flags = [i == correct for i in range(len(opts))]
                else:
                    # fallback generic options
                    opt_texts = make_options_texts(subject, vidx, position, slot.get("option_count", 4))
                    correct_flags = [i == 0 for i in range(len(opt_texts))]

                qid = await conn.fetchval("""INSERT INTO ent_questions(variant_id,subject,position,prompt,question_type,explanation,max_points,difficulty,context_mode)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'shared') RETURNING id""",
                    variant_id, subject, position, q_prompt, slot["question_type"], "Түсініктеме: тест үшін берілген.", slot["max_points"], difficulty)
                # insert options or matching pairs
                if slot["question_type"] == "matching":
                    # ensure we have 4 option texts
                    for opt_pos in range(4):
                        text = opt_texts[opt_pos] if opt_pos < len(opt_texts) else option_text(subject, vidx, position, opt_pos)
                        await conn.execute("INSERT INTO ent_options(question_id,text,is_correct,position) VALUES($1,$2,$3,$4)", qid, text, False, opt_pos)
                    for pair_pos, p in enumerate(matching_pairs or []):
                        # find correct_option_position matching our created option list
                        # match by right_text to option position
                        right = p.get('right_text')
                        try:
                            correct_pos = opt_texts.index(right)
                        except ValueError:
                            correct_pos = pair_pos
                        await conn.execute("INSERT INTO ent_matching_pairs(question_id,left_text,right_text,position,correct_option_position) VALUES($1,$2,$3,$4,$5)", qid, p.get('left_text'), right, pair_pos, correct_pos)
                elif slot["question_type"] == "multi_choice":
                    for opt_pos, text in enumerate(opt_texts):
                        is_corr = correct_flags[opt_pos] if opt_pos < len(correct_flags) else False
                        await conn.execute("INSERT INTO ent_options(question_id,text,is_correct,position) VALUES($1,$2,$3,$4)", qid, text, is_corr, opt_pos)
                else:
                    # single_choice or context
                    for opt_pos in range(slot.get("option_count", 4)):
                        text = opt_texts[opt_pos] if opt_pos < len(opt_texts) else option_text(subject, vidx, position, opt_pos)
                        is_corr = correct_flags[opt_pos] if opt_pos < len(correct_flags) else (opt_pos == 0)
                        await conn.execute("INSERT INTO ent_options(question_id,text,is_correct,position) VALUES($1,$2,$3,$4)", qid, text, is_corr, opt_pos)
        print(f"Created variant: {title} -> {variant_id}")
    return True


async def main():
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        async with conn.transaction():
            admin_id = await conn.fetchval("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")
            if not admin_id:
                raise RuntimeError("Create an administrator before seeding the ENT variants")
            await seed_full_ent(conn, admin_id)
            print("Seeding completed.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
