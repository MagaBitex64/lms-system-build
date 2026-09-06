"""Seed 2 full ENT trial variants with real ENT structure.

Each variant: 120 questions, 140 max points
- kaz_history: 20 single_choice (20 pts)
- reading: 10 single_choice (10 pts)
- math_literacy: 10 single_choice (10 pts)
- profile1: 25 single + 5 context + 5 matching + 5 multi = 40 questions (50 pts)
- profile2: 25 single + 5 context + 5 matching + 5 multi = 40 questions (50 pts)

Run: python -m scripts.seed_ent
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from core.config import DATABASE_URL


def make_single(subject, prompt, options, correct_idx=0, explanation=""):
    """Create a single_choice question dict."""
    opts = []
    for i, text in enumerate(options):
        opts.append({"text": text, "is_correct": i == correct_idx})
    return {
        "subject": subject,
        "question_type": "single_choice",
        "prompt": prompt,
        "options": opts,
        "explanation": explanation,
        "max_points": 1,
    }


def make_context(subject, context, prompt, options, correct_idx=0, explanation=""):
    """Create a context question dict."""
    opts = []
    for i, text in enumerate(options):
        opts.append({"text": text, "is_correct": i == correct_idx})
    return {
        "subject": subject,
        "question_type": "context",
        "prompt": prompt,
        "context_text": context,
        "options": opts,
        "explanation": explanation,
        "max_points": 1,
    }


def make_matching(subject, prompt, pairs, explanation=""):
    """Create a matching question dict."""
    return {
        "subject": subject,
        "question_type": "matching",
        "prompt": prompt,
        "matching_pairs": pairs,
        "explanation": explanation,
        "max_points": 2,
    }


def make_multi(subject, prompt, options, correct_indices, explanation=""):
    """Create a multi_choice question dict."""
    opts = []
    for i, text in enumerate(options):
        opts.append({"text": text, "is_correct": i in correct_indices})
    return {
        "subject": subject,
        "question_type": "multi_choice",
        "prompt": prompt,
        "options": opts,
        "explanation": explanation,
        "max_points": 2,
    }


# ============================================================
# VARIANT 1 DATA
# ============================================================

def variant1_kaz_history():
    """20 single_choice questions for Қазақстан тарихы."""
    qs = []
    data = [
        ("Қазақ хандығы қай жылы құрылды?", ["1465", "1370", "1550", "1600"], 0, "Керей мен Жәнібек 1465 жылы құрған."),
        ("Қазақ хандығының негізін қалаушылар кімдер?", ["Керей мен Жәнібек", "Абылай хан", "Тәуке хан", "Қасым хан"], 0, ""),
        ("Қасым хан қай жылдары билік құрды?", ["1511-1521", "1465-1480", "1538-1580", "1600-1620"], 0, ""),
        ("Тәуке хан кезіндегі заң жинағы қалай аталады?", ["Жеті Жарғы", "Қасым ханның қасқа жолы", "Есім ханның ескі жолы", "Ата заң"], 0, ""),
        ("Абылай хан қай ғасырда өмір сүрді?", ["XVIII ғасыр", "XV ғасыр", "XVI ғасыр", "XIX ғасыр"], 0, ""),
        ("Қазақстан Республикасы тәуелсіздігін қай жылы жариялады?", ["1991", "1990", "1989", "1993"], 0, "16 желтоқсан 1991 жыл."),
        ("Алаш Орда партиясы қай жылы құрылды?", ["1917", "1905", "1920", "1916"], 0, ""),
        ("1916 жылғы ұлт-азаттық көтеріліс себебі не?", ["Тыл жұмысына алу жарлығы", "Жер мәселесі", "Салық салу", "Діни қысым"], 0, ""),
        ("Қазақ АССР қай жылы құрылды?", ["1920", "1917", "1925", "1936"], 0, ""),
        ("Қазақ ССР қай жылы Одақтық республика болды?", ["1936", "1920", "1925", "1940"], 0, ""),
        ("Қазақстанда тың және тыңайған жерлерді игеру қай жылы басталды?", ["1954", "1950", "1960", "1945"], 0, ""),
        ("Семей полигонында бірінші ядролық сынақ қай жылы жүргізілді?", ["1949", "1945", "1953", "1961"], 0, ""),
        ("Невада-Семей қозғалысын кім бастады?", ["Олжас Сүлейменов", "Мұхтар Шаханов", "Нұрсұлтан Назарбаев", "Дінмұхамед Қонаев"], 0, ""),
        ("Желтоқсан оқиғалары қай жылы болды?", ["1986", "1991", "1989", "1985"], 0, ""),
        ("Қазақстанның астанасы 1997 жылы қайда көшірілді?", ["Ақмолаға", "Алматыға", "Шымкентке", "Қарағандыға"], 0, ""),
        ("Қазақстан БҰҰ-ға қай жылы мүше болды?", ["1992", "1991", "1993", "1990"], 0, ""),
        ("Қазақстан теңгесі қай жылы айналымға шықты?", ["1993", "1992", "1994", "1995"], 0, ""),
        ("Түркістан қай ғасырларда Қазақ хандығының астанасы болды?", ["XVI-XVII ғасырлар", "XIII-XIV ғасырлар", "XVIII-XIX ғасырлар", "XV ғасыр"], 0, ""),
        ("Бұқар жырау қай ғасырда өмір сүрді?", ["XVIII ғасыр", "XVI ғасыр", "XIX ғасыр", "XV ғасыр"], 0, ""),
        ("Абай Құнанбайұлы қай жылы дүниеге келді?", ["1845", "1835", "1855", "1860"], 0, ""),
    ]
    for prompt, opts, correct, expl in data:
        qs.append(make_single("kaz_history", prompt, opts, correct, expl))
    return qs


def variant1_reading():
    """10 single_choice questions for Оқу сауаттылығы."""
    qs = []
    data = [
        ("Мәтінде автор нені айтқысы келеді?", ["Білімнің маңыздылығы", "Табиғат сұлулығы", "Спорт пайдасы", "Саяхат тәжірибесі"], 0),
        ("Мәтіннің негізгі ойы қандай?", ["Адамгершілік құндылықтары", "Экономикалық даму", "Сауда қатынастары", "Климат өзгерісі"], 0),
        ("Автор қандай стильде жазған?", ["Публицистикалық", "Көркем", "Ғылыми", "Ресми"], 0),
        ("Мәтіндегі 'алтын' сөзі қандай мағынада қолданылған?", ["Ауыспалы", "Тура", "Терминологиялық", "Фразеологиялық"], 0),
        ("Мәтіннің тақырыбына қандай тақырып сәйкес келеді?", ["Білім — байлық", "Ғарыш сыры", "Спорт және денсаулық", "Компьютер дүниесі"], 0),
        ("Мәтін бойынша дұрыс тұжырымды көрсетіңіз.", ["Білім адамды жетілдіреді", "Ақша бақыт әкеледі", "Жұмыс керек емес", "Қиындық жоқ"], 0),
        ("Мәтіндегі негізгі кейіпкердің мінезін қалай сипаттауға болады?", ["Батыл, табанды", "Жалқау, селқос", "Қорқақ, жасқыншақ", "Мақтаншақ, тәкаппар"], 0),
        ("'Жел' сөзі мәтінде қандай бейне ретінде берілген?", ["Еркіндік бейнесі", "Қауіп бейнесі", "Байлық бейнесі", "Ашулы адам бейнесі"], 0),
        ("Мәтіннің функционалды стилін анықтаңыз.", ["Ғылыми стиль", "Көркем стиль", "Ресми стиль", "Ауызекі стиль"], 0),
        ("Мәтінде берілген сандық мәліметтер нені дәлелдейді?", ["Білім деңгейінің артуы", "Экономиканың құлдырауы", "Халық санының азаюы", "Ауа райының өзгеруі"], 0),
    ]
    for prompt, opts, correct in data:
        qs.append(make_single("reading", prompt, opts, correct))
    return qs


def variant1_math_literacy():
    """10 single_choice questions for Математикалық сауаттылық."""
    qs = []
    data = [
        ("Дүкенде тауардың бағасы 20%-ға көтерілді. Бастапқы бағасы 5000 тг. Жаңа бағасы қанша?", ["6000 тг", "5200 тг", "5500 тг", "7000 тг"], 0),
        ("Банк жылдық 12% ставкамен салым қабылдайды. 100 000 тг салған адам 1 жылдан кейін қанша алады?", ["112 000 тг", "110 000 тг", "120 000 тг", "115 000 тг"], 0),
        ("Орташа жылдамдығы 60 км/сағ автокөлік 3 сағатта қанша жол жүреді?", ["180 км", "120 км", "200 км", "160 км"], 0),
        ("Сыныпта 30 оқушы бар. 60% қыз. Қанша ұл?", ["12", "18", "15", "20"], 0),
        ("Диаграмма бойынша қай ай ең көп жауын-шашын түскен?", ["Сәуір", "Наурыз", "Мамыр", "Маусым"], 0),
        ("Тауарға 15% жеңілдік жасалды. Бастапқы бағасы 8000 тг. Жеңілдік бағасы?", ["6800 тг", "7200 тг", "6500 тг", "7000 тг"], 0),
        ("Кредит 500 000 тг, жылдық 18%, 1 жылға. Қайтаратын жалпы сома?", ["590 000 тг", "580 000 тг", "600 000 тг", "550 000 тг"], 0),
        ("3 кг алма 1200 тг тұрады. 5 кг алманың бағасы?", ["2000 тг", "1800 тг", "2200 тг", "1500 тг"], 0),
        ("Жер учаскесінің ауданы 600 м². Ені 20 м. Ұзындығы?", ["30 м", "25 м", "35 м", "40 м"], 0),
        ("Графикте 2020 жылы халық саны 18 млн, 2023 жылы 20 млн. Өсім қанша пайыз?", ["≈11%", "≈15%", "≈8%", "≈20%"], 0),
    ]
    for prompt, opts, correct in data:
        qs.append(make_single("math_literacy", prompt, opts, correct))
    return qs


def make_profile_questions(subject, variant_num):
    """Generate 40 profile questions: 25 single + 5 context + 5 matching + 5 multi."""
    qs = []
    
    # Subject-specific question templates
    subject_data = {
        "informatics": {
            "single": [
                ("Компьютердің негізгі бөліктерінің бірі:", ["Процессор", "Принтер", "Модем", "Сканер"], 0),
                ("1 байт неше битке тең?", ["8", "4", "16", "2"], 0),
                ("Ақпарат өлшем бірлігі:", ["Бит", "Герц", "Ватт", "Вольт"], 0),
                ("Операциялық жүйеге мысал:", ["Windows", "Word", "Excel", "Chrome"], 0),
                ("Алгоритмнің сызықтық түрі:", ["Әрекеттер тізбекті орындалады", "Шарт тексеріледі", "Цикл қолданылады", "Рекурсия қолданылады"], 0),
                ("Python-да тізім жасау:", ["list()", "dict()", "set()", "tuple()"], 0),
                ("HTML-де тақырып тегі:", ["<h1>", "<p>", "<div>", "<span>"], 0),
                ("Деректер қоры дегеніміз:", ["Құрылымдалған деректер жиыны", "Бағдарлама", "Операциялық жүйе", "Желі"], 0),
                ("IP-адрес дегеніміз:", ["Компьютердің желідегі адресі", "Электрондық пошта", "Домен аты", "Порт нөмірі"], 0),
                ("CSS нені басқарады?", ["Веб-беттің стилін", "Деректер қорын", "Серверді", "Желіні"], 0),
                ("For циклінің мақсаты:", ["Қайталау", "Шартты тексеру", "Функция жасау", "Класс жасау"], 0),
                ("Массив дегеніміз:", ["Бір типті элементтер жиыны", "Функция", "Класс", "Модуль"], 0),
                ("RAM дегеніміз:", ["Жедел жад", "Тұрақты жад", "Қатты диск", "Флешка"], 0),
                ("SQL тілі не үшін қолданылады?", ["Деректер қорын басқару", "Веб-дизайн", "Ойын жасау", "Музыка жазу"], 0),
                ("Рекурсия дегеніміз:", ["Функцияның өзін-өзі шақыруы", "Циклдің түрі", "Шартты оператор", "Массив"], 0),
                ("Бинарлық жүйедегі 1010 он санау жүйесінде:", ["10", "8", "12", "6"], 0),
                ("Стек деректер құрылымы қай принциппен жұмыс істейді?", ["LIFO", "FIFO", "Random", "Priority"], 0),
                ("Кезек деректер құрылымы:", ["FIFO", "LIFO", "FILO", "Random"], 0),
                ("Git дегеніміз:", ["Нұсқаларды басқару жүйесі", "Бағдарламалау тілі", "Операциялық жүйе", "Деректер қоры"], 0),
                ("Антивирус бағдарламасының мақсаты:", ["Зиянды бағдарламалардан қорғау", "Файлдарды сығу", "Видео ойнату", "Суреттерді өңдеу"], 0),
                ("TCP/IP дегеніміз:", ["Желілік хаттама", "Бағдарламалау тілі", "Деректер қоры", "Операциялық жүйе"], 0),
                ("JavaScript қай жерде негізінен қолданылады?", ["Веб-бағдарламалау", "Мобильді ойындар", "Деректер ғылымы", "Роботтехника"], 0),
                ("Boolean деректер типі:", ["True/False", "Сандар", "Жолдар", "Массивтер"], 0),
                ("While циклі:", ["Шарт ақиқат болғанда қайталанады", "Тек бір рет орындалады", "Ешқашан тоқтамайды", "Тек сандармен жұмыс істейді"], 0),
                ("Функция дегеніміз:", ["Қайта қолдануға болатын код блогы", "Деректер типі", "Цикл түрі", "Оператор"], 0),
            ],
            "context": [
                ("Берілген Python кодын талдаңыз:\n\nx = 5\ny = 3\nprint(x + y)", "Кодтың нәтижесі қандай?", ["8", "53", "xy", "Қате"], 0),
                ("SQL сұранысы:\nSELECT COUNT(*) FROM students WHERE grade > 80", "Бұл сұраныс нені қайтарады?", ["Бағасы 80-нен жоғары оқушылар саны", "Барлық оқушылар", "Ең жоғары баға", "Орташа баға"], 0),
                ("HTML код:\n<ul><li>A</li><li>B</li></ul>", "Бұл код нені көрсетеді?", ["Нүктелі тізім", "Нөмірлі тізім", "Кесте", "Сурет"], 0),
                ("Алгоритм: 1) n=10 2) n=n-2 3) n>0 болса, 2-қадамға қайт 4) n мәнін шығар", "n-нің соңғы мәні:", ["0", "2", "-2", "10"], 0),
                ("CSS код:\n.box { color: red; font-size: 16px; }", "Бұл код нені орындайды?", ["Мәтін түсін қызыл, өлшемін 16px етеді", "Фон түсін өзгертеді", "Жиектеме қосады", "Суретті үлкейтеді"], 0),
            ],
            "matching": [
                ("Бағдарламалау тілдерін олардың қолдану саласымен сәйкестендіріңіз", [
                    {"left_text": "Python", "right_text": "Деректер ғылымы"},
                    {"left_text": "JavaScript", "right_text": "Веб-бағдарламалау"},
                    {"left_text": "Swift", "right_text": "iOS қосымшалар"},
                    {"left_text": "SQL", "right_text": "Деректер қоры"},
                    {"left_text": "C++", "right_text": "Жүйелік бағдарламалау"},
                ]),
                ("Деректер құрылымдарын сипаттамалармен сәйкестендіріңіз", [
                    {"left_text": "Массив", "right_text": "Индекс бойынша қол жеткізу"},
                    {"left_text": "Стек", "right_text": "LIFO принципі"},
                    {"left_text": "Кезек", "right_text": "FIFO принципі"},
                    {"left_text": "Граф", "right_text": "Төбелер мен қырлар"},
                    {"left_text": "Ағаш", "right_text": "Иерархиялық құрылым"},
                ]),
                ("Файл кеңейтімдерін түрлерімен сәйкестендіріңіз", [
                    {"left_text": ".py", "right_text": "Python файлы"},
                    {"left_text": ".html", "right_text": "Веб-бет"},
                    {"left_text": ".css", "right_text": "Стиль файлы"},
                    {"left_text": ".sql", "right_text": "Деректер қоры сұранысы"},
                    {"left_text": ".json", "right_text": "Деректер алмасу форматы"},
                ]),
                ("Желі компоненттерін функцияларымен сәйкестендіріңіз", [
                    {"left_text": "Роутер", "right_text": "Деректерді бағыттау"},
                    {"left_text": "Файрвол", "right_text": "Қауіпсіздік қамтамасыз ету"},
                    {"left_text": "DNS", "right_text": "Домен атын IP-ге түрлендіру"},
                    {"left_text": "DHCP", "right_text": "IP адресін автоматты беру"},
                    {"left_text": "HTTP", "right_text": "Веб-деректерді тасымалдау"},
                ]),
                ("Операторларды олардың типтерімен сәйкестендіріңіз", [
                    {"left_text": "+, -, *, /", "right_text": "Арифметикалық"},
                    {"left_text": "==, !=, <, >", "right_text": "Салыстыру"},
                    {"left_text": "and, or, not", "right_text": "Логикалық"},
                    {"left_text": "=, +=, -=", "right_text": "Меншіктеу"},
                    {"left_text": "in, not in", "right_text": "Мүшелік тексеру"},
                ]),
            ],
            "multi": [
                ("Бағдарламалау тілдеріне жатады (дұрыс жауаптарды таңдаңыз):", ["Python", "HTML", "Java", "CSS", "C++", "HTTP"], [0, 2, 4]),
                ("Циклдің түрлерін таңдаңыз:", ["for", "while", "do-while", "select", "switch", "loop"], [0, 1, 2]),
                ("Деректер типтеріне жатады:", ["Integer", "String", "Router", "Boolean", "Switch", "Float"], [0, 1, 3]),
                ("Объектіге бағытталған бағдарламалау принциптері:", ["Инкапсуляция", "Мұрагерлік", "Компиляция", "Полиморфизм", "Индексация", "Сериализация"], [0, 1, 3]),
                ("Сұрыптау алгоритмдеріне жатады:", ["Bubble Sort", "Quick Sort", "Binary Search", "Merge Sort", "DFS", "BFS"], [0, 1, 3]),
            ],
        },
        "mathematics": {
            "single": [
                ("2x + 5 = 15 теңдеуін шешіңіз:", ["x = 5", "x = 10", "x = 3", "x = 7"], 0),
                ("sin 30° мәні:", ["0.5", "1", "0", "√3/2"], 0),
                ("log₂ 8 =", ["3", "2", "4", "8"], 0),
                ("x² - 9 = 0 теңдеуінің түбірлері:", ["±3", "±9", "±1", "3"], 0),
                ("Арифметикалық прогрессия: 2, 5, 8, ... d =", ["3", "2", "5", "4"], 0),
                ("(a+b)² формуласы:", ["a²+2ab+b²", "a²+b²", "a²-2ab+b²", "2a²+2b²"], 0),
                ("Тікбұрышты үшбұрыштың гипотенузасы: a=3, b=4, c=?", ["5", "7", "6", "√7"], 0),
                ("Шеңбердің ауданы: S = ?", ["πr²", "2πr", "πd", "2πr²"], 0),
                ("Тригонометриялық тепе-теңдік: sin²x + cos²x =", ["1", "0", "2", "-1"], 0),
                ("Геометриялық прогрессия: 2, 6, 18, ... q =", ["3", "2", "4", "6"], 0),
                ("Функцияның туындысы: f(x) = x³, f'(x) =", ["3x²", "x²", "3x", "x³"], 0),
                ("Анықталмаған интеграл: ∫2x dx =", ["x² + C", "2x² + C", "x + C", "2 + C"], 0),
                ("|x - 3| = 5 теңдеуінің шешімі:", ["x = 8 немесе x = -2", "x = 8", "x = -2", "x = 3"], 0),
                ("3! (3 факториал) =", ["6", "3", "9", "27"], 0),
                ("C(5,2) комбинация саны:", ["10", "5", "20", "25"], 0),
                ("Вектордың ұзындығы: a(3;4) |a| =", ["5", "7", "1", "√7"], 0),
                ("Матрицаның анықтауышы: |2 1; 3 4| =", ["5", "8", "11", "-5"], 0),
                ("Параболаның төбесі y = x² - 4x + 3:", ["(2; -1)", "(4; 3)", "(1; 0)", "(-2; 1)"], 0),
                ("lim (x→∞) (1 + 1/x)ˣ =", ["e", "1", "∞", "0"], 0),
                ("Қос теңсіздік: -3 < x ≤ 5 аралығы:", ["(-3; 5]", "[-3; 5]", "(-3; 5)", "[-3; 5)"], 0),
                ("√(144) =", ["12", "14", "10", "16"], 0),
                ("Дискриминант формуласы D =", ["b²-4ac", "b²+4ac", "-b²-4ac", "4ac-b²"], 0),
                ("Арифметикалық прогрессияның қосындысы: Sn =", ["n(a₁+aₙ)/2", "na₁d", "a₁qⁿ", "n²d"], 0),
                ("Конустың көлемі:", ["1/3 πr²h", "πr²h", "2πrh", "4/3 πr³"], 0),
                ("Тангенс функциясы tan x = ?", ["sin x / cos x", "cos x / sin x", "1/sin x", "1/cos x"], 0),
            ],
            "context": [
                ("Функция графигі y = 2x - 1 берілген.\nНүкте А(0; ?) графикте жатса.", "А нүктесінің ординатасын табыңыз:", ["-1", "0", "1", "2"], 0),
                ("Тікбұрышты параллелепипедтің өлшемдері: 3 см, 4 см, 5 см.", "Көлемін табыңыз:", ["60 см³", "48 см³", "72 см³", "50 см³"], 0),
                ("Мектептегі оқушылардың математика балдары: 85, 90, 78, 92, 80.", "Орташа баллды есептеңіз:", ["85", "88", "82", "90"], 0),
                ("Координаталық жазықтықта нүктелер: A(1,2) және B(4,6).", "AB кесіндісінің ұзындығын табыңыз:", ["5", "7", "3", "√13"], 0),
                ("Тізбек: 1, 1, 2, 3, 5, 8, 13, ...", "Келесі сан қандай?", ["21", "18", "20", "15"], 0),
            ],
            "matching": [
                ("Формулаларды атауларымен сәйкестендіріңіз", [
                    {"left_text": "S = πr²", "right_text": "Шеңбер ауданы"},
                    {"left_text": "V = 4/3πr³", "right_text": "Шар көлемі"},
                    {"left_text": "S = ab", "right_text": "Тікбұрыш ауданы"},
                    {"left_text": "P = 2(a+b)", "right_text": "Тікбұрыш периметрі"},
                    {"left_text": "c² = a²+b²", "right_text": "Пифагор теоремасы"},
                ]),
                ("Функцияларды олардың графиктерімен сәйкестендіріңіз", [
                    {"left_text": "y = x²", "right_text": "Парабола"},
                    {"left_text": "y = kx + b", "right_text": "Түзу"},
                    {"left_text": "y = 1/x", "right_text": "Гипербола"},
                    {"left_text": "y = √x", "right_text": "Жартылай парабола"},
                    {"left_text": "y = |x|", "right_text": "V-тәрізді график"},
                ]),
                ("Сандық жиындарды белгілерімен сәйкестендіріңіз", [
                    {"left_text": "N", "right_text": "Натурал сандар"},
                    {"left_text": "Z", "right_text": "Бүтін сандар"},
                    {"left_text": "Q", "right_text": "Рационал сандар"},
                    {"left_text": "R", "right_text": "Нақты сандар"},
                    {"left_text": "C", "right_text": "Комплекс сандар"},
                ]),
                ("Теоремаларды авторларымен сәйкестендіріңіз", [
                    {"left_text": "a²+b²=c²", "right_text": "Пифагор"},
                    {"left_text": "Үшбұрыш бұрыштарының қосындысы 180°", "right_text": "Евклид"},
                    {"left_text": "a/sinA = b/sinB", "right_text": "Синустар теоремасы"},
                    {"left_text": "c² = a²+b²-2ab·cosC", "right_text": "Косинустар теоремасы"},
                    {"left_text": "S = 1/2 ab sinC", "right_text": "Үшбұрыш ауданы"},
                ]),
                ("Операцияларды олардың кері операцияларымен сәйкестендіріңіз", [
                    {"left_text": "Қосу", "right_text": "Азайту"},
                    {"left_text": "Көбейту", "right_text": "Бөлу"},
                    {"left_text": "Дәрежеге шығару", "right_text": "Түбір табу"},
                    {"left_text": "Дифференциалдау", "right_text": "Интегралдау"},
                    {"left_text": "Логарифм", "right_text": "Дәрежелеу"},
                ]),
            ],
            "multi": [
                ("Квадрат теңдеудің шешу әдістеріне жатады:", ["Дискриминант", "Виет теоремасы", "Толық квадрат", "Графиктік әдіс", "Теңдеулер жүйесі", "Қосу әдісі"], [0, 1, 2]),
                ("Тригонометриялық функцияларға жатады:", ["sin", "cos", "log", "tan", "exp", "cot"], [0, 1, 3]),
                ("Төмендегілердің қайсысы фигуралар:", ["Шеңбер", "Квадрат", "Функция", "Цилиндр", "Теорема", "Үшбұрыш"], [0, 1, 5]),
                ("Қасиеттері дұрыс берілген:", ["a⁰=1 (a≠0)", "a¹=a", "a⁻¹=a", "√(a²)=|a|", "(ab)ⁿ=aⁿbⁿ", "aⁿ+aⁿ=a²ⁿ"], [0, 1, 3]),
                ("Параллелограммның қасиеттерін таңдаңыз:", ["Қарама-қарсы қабырғалары тең", "Диагональдары қиылысу нүктесінде тең бөлінеді", "Барлық бұрыштары тік", "Қарама-қарсы бұрыштары тең", "Периметрі 0-ге тең", "Ауданы теріс"], [0, 1, 3]),
            ],
        },
    }
    
    subj_info = subject_data.get(subject)
    if not subj_info:
        # Fallback: generate generic questions
        subj_info = subject_data["informatics"]
    
    # 25 single_choice
    for prompt, opts, correct, *rest in subj_info["single"]:
        expl = rest[0] if rest else ""
        qs.append(make_single(subject, prompt, opts, correct, expl))
    
    # 5 context
    for ctx_text, prompt, opts, correct, *rest in subj_info["context"]:
        expl = rest[0] if rest else ""
        qs.append(make_context(subject, ctx_text, prompt, opts, correct, expl))
    
    # 5 matching
    for prompt, pairs in subj_info["matching"]:
        qs.append(make_matching(subject, prompt, pairs))
    
    # 5 multi_choice
    for prompt, opts, correct_indices, *rest in subj_info["multi"]:
        expl = rest[0] if rest else ""
        qs.append(make_multi(subject, prompt, opts, correct_indices, expl))
    
    return qs


VARIANTS = [
    {
        "title": "Пробный ЕНТ — Вариант 1",
        "description": "Информатика-Математика, толық формат, 120 сұрақ, 140 балл",
        "combination": "infmat",
    },
    {
        "title": "Пробный ЕНТ — Вариант 2",
        "description": "Информатика-Математика, толық формат, 120 сұрақ, 140 балл",
        "combination": "infmat",
    },
]


async def main():
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        # Clean old data
        await conn.execute("DELETE FROM ent_trial_answers")
        await conn.execute("DELETE FROM ent_trial_attempts")
        await conn.execute("DELETE FROM ent_trial_accesses")
        await conn.execute("DELETE FROM ent_matching_pairs")
        await conn.execute("DELETE FROM ent_options")
        await conn.execute("DELETE FROM ent_questions")
        await conn.execute("DELETE FROM ent_variants")
        
        for vi, var_data in enumerate(VARIANTS):
            variant_id = await conn.fetchval(
                "INSERT INTO ent_variants (title, description, combination) VALUES ($1, $2, $3) RETURNING id",
                var_data["title"], var_data["description"], var_data["combination"]
            )
            print(f"Created variant: {var_data['title']} (id={variant_id})")
            
            combo = var_data["combination"]
            subj1, subj2 = COMBINATIONS[combo]
            
            # Build all questions
            all_questions = []
            all_questions.extend(variant1_kaz_history())
            all_questions.extend(variant1_reading())
            all_questions.extend(variant1_math_literacy())
            all_questions.extend(make_profile_questions(subj1, vi + 1))
            all_questions.extend(make_profile_questions(subj2, vi + 1))
            
            pos_counters = {}
            for q in all_questions:
                subj = q["subject"]
                pos = pos_counters.get(subj, 0)
                pos_counters[subj] = pos + 1
                
                q_id = await conn.fetchval(
                    """
                    INSERT INTO ent_questions (variant_id, subject, prompt, question_type, context_text, image_url, explanation, max_points, position)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
                    """,
                    variant_id,
                    q["subject"],
                    q["prompt"],
                    q["question_type"],
                    q.get("context_text", ""),
                    q.get("image_url", ""),
                    q.get("explanation", ""),
                    q.get("max_points", 1),
                    pos
                )
                
                # Insert options
                for oi, opt in enumerate(q.get("options", [])):
                    await conn.execute(
                        "INSERT INTO ent_options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)",
                        q_id, opt["text"], opt["is_correct"], oi
                    )
                
                # Insert matching pairs
                for pi, pair in enumerate(q.get("matching_pairs", [])):
                    await conn.execute(
                        "INSERT INTO ent_matching_pairs (question_id, left_text, right_text, position) VALUES ($1, $2, $3, $4)",
                        q_id, pair["left_text"], pair["right_text"], pi
                    )
            
            # Count questions by subject
            for subj, count in pos_counters.items():
                print(f"  {subj}: {count} questions")
            print(f"  Total: {sum(pos_counters.values())} questions")
        
        print("\nSeed completed successfully!")
        
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
