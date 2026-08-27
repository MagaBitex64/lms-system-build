import asyncio
import os
import sys
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from core.config import DATABASE_URL

# Real-like questions for each subject
REAL_QUESTIONS = {
    "kaz_history": [
        {
            "prompt": "Қазақ хандығының негізін қалаған хандар?",
            "options": ["Керей мен Жәнібек", "Қасым мен Хақназар", "Тәуке мен Абылай", "Жошы мен Шағатай"],
            "correct": 0,
            "explanation": "Қазақ хандығының негізін 1465 жылы Керей мен Жәнібек қалады."
        },
        {
            "prompt": "Аңырақай шайқасы болған жыл?",
            "options": ["1726 жыл", "1723 жыл", "1729-1730 жылдар", "1711 жыл"],
            "correct": 2,
            "explanation": "Аңырақай шайқасы 1729-1730 жылдары болды."
        },
        {
            "prompt": "Қазақстан Республикасының мемлекеттік тәуелсіздігі туралы заң қабылданған күн?",
            "options": ["1991 жыл 25 қазан", "1991 жыл 16 желтоқсан", "1990 жыл 25 қазан", "1992 жыл 4 маусым"],
            "correct": 1,
            "explanation": "Тәуелсіздік туралы заң 1991 жылы 16 желтоқсанда қабылданды."
        },
        {
            "prompt": "Түрік қағанаты екіге бөлінген жыл?",
            "options": ["552 жыл", "603 жыл", "704 жыл", "756 жыл"],
            "correct": 1,
            "explanation": "Түрік қағанаты 603 жылы Батыс және Шығыс болып екіге бөлінді."
        },
        {
            "prompt": "Алтын Орданың ыдырауы нәтижесінде пайда болған хандық?",
            "options": ["Қарахан мемлекеті", "Түрік қағанаты", "Ақ Орда", "Сібір хандығы"],
            "correct": 3,
            "explanation": "Алтын Орда ыдырағанда бірнеше хандық (Сібір, Қазан, Астрахан т.б.) құрылды. Ақ Орда одан бұрын болған."
        }
    ],
    "reading": [
        {
            "prompt": "Мәтінді оқыңыз: 'Кітап – білім бұлағы, білім – өмір шырағы. Адам кітап оқу арқылы өзін дамытады, әлемді таниды.' Мәтіндегі негізгі ой қандай?",
            "options": ["Кітап оқудың пайдасы", "Өмір сүру қиындықтары", "Әлемнің үлкендігі", "Адамның мінезі"],
            "correct": 0,
            "explanation": "Мәтінде кітап оқудың маңызы туралы айтылған."
        },
        {
            "prompt": "Тұрақты тіркестің мағынасын табыңыз: 'Қой аузынан шөп алмас'",
            "options": ["Жауыз", "Жуас, момын", "Еріншек", "Пысық"],
            "correct": 1,
            "explanation": "Бұл фразеологизм өте жуас адамға қаратылып айтылады."
        },
        {
            "prompt": "'Жер-Ана' ұғымы қандай мағына береді?",
            "options": ["Жердің көлемі", "Жердің құнарлығы", "Табиғаттың қорғаушысы, асыраушысы", "Ғарыштағы планета"],
            "correct": 2,
            "explanation": "Адамзатты асыраушы, қорғаушы мағынасында қолданылады."
        }
    ],
    "math_literacy": [
        {
            "prompt": "Заттың бағасы алғашқыда 20%-ға қымбаттап, кейін 20%-ға арзандады. Алғашқы бағамен салыстырғанда қалай өзгерді?",
            "options": ["Өзгермеді", "4%-ға қымбаттады", "4%-ға арзандады", "10%-ға арзандады"],
            "correct": 2,
            "explanation": "100 * 1.2 = 120. 120 * 0.8 = 96. Демек 4%-ға арзандады."
        },
        {
            "prompt": "5 жұмысшы тапсырманы 8 сағатта орындайды. Осындай жылдамдықпен 4 жұмысшы неше сағатта орындайды?",
            "options": ["10 сағат", "6.4 сағат", "12 сағат", "8 сағат"],
            "correct": 0,
            "explanation": "Кері пропорционалдық: 5*8 = 4*x => x = 10."
        },
        {
            "prompt": "Цифрлары әртүрлі болатын ең үлкен үш таңбалы санды табыңыз.",
            "options": ["999", "987", "789", "900"],
            "correct": 1,
            "explanation": "Ең үлкен цифрлардан бастаймыз, қайталанбайтындай: 9, 8, 7."
        }
    ],
    "informatics": [
        {
            "prompt": "Python тілінде цикл операторлары қандай?",
            "options": ["if, else", "for, while", "def, return", "int, float"],
            "correct": 1,
            "explanation": "Python-да for және while циклдері қолданылады."
        },
        {
            "prompt": "Ақпаратты өлшеудің ең кіші бірлігі?",
            "options": ["Байт", "Мегабайт", "Бит", "Килобайт"],
            "correct": 2,
            "explanation": "Ең кіші бірлік – бит (0 немесе 1)."
        },
        {
            "prompt": "SQL тілінде кесте құру командасы?",
            "options": ["SELECT TABLE", "CREATE TABLE", "INSERT INTO", "DROP TABLE"],
            "correct": 1,
            "explanation": "Кесте құру үшін CREATE TABLE қолданылады."
        },
        {
            "prompt": "IPv4 мекенжайының ұзындығы неше бит?",
            "options": ["16 бит", "32 бит", "64 бит", "128 бит"],
            "correct": 1,
            "explanation": "IPv4 32 биттен (4 октеттен) тұрады."
        }
    ],
    "mathematics": [
        {
            "prompt": "sin^2(x) + cos^2(x) неге тең?",
            "options": ["0", "1", "-1", "2"],
            "correct": 1,
            "explanation": "Негізгі тригонометриялық теңбе-теңдік бойынша жауабы 1."
        },
        {
            "prompt": "х^2 - 5х + 6 = 0 теңдеуінің түбірлерін табыңыз.",
            "options": ["-2, -3", "2, 3", "1, 6", "5, 6"],
            "correct": 1,
            "explanation": "Виет теоремасы бойынша: x1+x2=5, x1*x2=6. Түбірлері: 2 және 3."
        },
        {
            "prompt": "Квадраттың қабырғасы 5 см болса, ауданы нешеге тең?",
            "options": ["10 см^2", "20 см^2", "25 см^2", "15 см^2"],
            "correct": 2,
            "explanation": "S = a^2 = 5^2 = 25."
        }
    ],
    "physics": [
        {
            "prompt": "Ньютонның екінчи заңы қандай формуламен жазылады?",
            "options": ["F = m/a", "F = ma", "F = m-a", "F = m+a"],
            "correct": 1,
            "explanation": "Ньютонның 2-ші заңы: Күш масса мен үдеудің көбейтіндісіне тең (F=ma)."
        },
        {
            "prompt": "Кернеудің өлшем бірлігі қандай?",
            "options": ["Ампер", "Ом", "Вольт", "Ватт"],
            "correct": 2,
            "explanation": "Электр кернеуі Вольтпен өлшенеді."
        }
    ],
    "chemistry": [
        {
            "prompt": "Судың химиялық формуласы?",
            "options": ["CO2", "H2O", "O2", "NaCl"],
            "correct": 1,
            "explanation": "Су сутегінің 2 атомынан және оттегінің 1 атомынан тұрады: H2O."
        },
        {
            "prompt": "Ас тұзының формуласы қандай?",
            "options": ["H2SO4", "NaOH", "NaCl", "HCl"],
            "correct": 2,
            "explanation": "Натрий хлориді (NaCl) – ас тұзы."
        }
    ],
    "biology": [
        {
            "prompt": "Жасушаның энергия көзі болып табылатын органоид?",
            "options": ["Рибосома", "Митохондрия", "Лизосома", "Ядро"],
            "correct": 1,
            "explanation": "Митохондрия – жасушаның «күш станциясы» немесе энергия көзі."
        },
        {
            "prompt": "Адам қаңқасында шамамен қанша сүйек бар?",
            "options": ["100-ден астам", "200-ден астам", "300-ден астам", "500-ден астам"],
            "correct": 1,
            "explanation": "Ересек адамның қаңқасында 206 сүйек болады."
        }
    ],
    "geography": [
        {
            "prompt": "Жер бетіндегі ең үлкен мұхит?",
            "options": ["Атлант мұхиты", "Үнді мұхиты", "Тынық мұхиты", "Солтүстік Мұзды мұхит"],
            "correct": 2,
            "explanation": "Ең үлкен әрі ең терең мұхит – Тынық мұхиты."
        },
        {
            "prompt": "Қазақстанның ең биік нүктесі?",
            "options": ["Белуха", "Хан Тәңірі", "Талғар шыңы", "Көкшетау"],
            "correct": 1,
            "explanation": "Хан Тәңірі шыңы (6995 м) Қазақстанның ең биік нүктесі."
        }
    ]
}

SUBJECT_QUOTAS = {
    "kaz_history": 25,
    "reading": 15,
    "math_literacy": 15,
    "informatics": 55,
    "mathematics": 55,
    "physics": 55,
    "chemistry": 55,
    "biology": 55,
    "geography": 55,
}

async def seed_ent() -> None:
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        # Clear existing to re-seed with real questions
        await conn.execute("TRUNCATE ent_questions CASCADE")

        print("Seeding REAL ENT questions...")
        
        for subject, count in SUBJECT_QUOTAS.items():
            print(f"Seeding {count} questions for {subject}...")
            base_qs = REAL_QUESTIONS.get(subject, [
                {"prompt": f"{subject} сұрағы", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "Түсіндірме"}
            ])
            
            for i in range(1, count + 1):
                # Pick a real question template (loop over them)
                template = base_qs[(i - 1) % len(base_qs)]
                prompt = f"{template['prompt']} (Нұсқа {i})" if count > len(base_qs) else template['prompt']
                explanation = template['explanation']
                
                q_id = await conn.fetchval(
                    """
                    INSERT INTO ent_questions (subject, prompt, explanation, position)
                    VALUES ($1, $2, $3, $4) RETURNING id
                    """,
                    subject, prompt, explanation, i
                )
                
                options = template['options']
                correct_idx = template['correct']
                
                # We can shuffle options slightly, but for simplicity let's keep them and mark the correct one
                for opt_idx, opt_text in enumerate(options):
                    is_correct = (opt_idx == correct_idx)
                    await conn.execute(
                        """
                        INSERT INTO ent_options (question_id, text, is_correct, position)
                        VALUES ($1, $2, $3, $4)
                        """,
                        q_id, opt_text, is_correct, opt_idx
                    )

        print("REAL ENT questions seeded successfully.")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed_ent())
