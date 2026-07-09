"""Demo data seed for Phenomenon School LMS.

Run: python -m scripts.seed  (from the backend/ directory)
All demo accounts share the password: Phenomenon1!
"""

import asyncio
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg

from core.config import DATABASE_URL
from core.security import hash_password

PASSWORD = "Phenomenon1!"


async def seed() -> None:
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        existing = await conn.fetchval("SELECT COUNT(*) FROM users")
        if existing > 0:
            print(f"Database already has {existing} users; skipping seed.")
            return

        pw = hash_password(PASSWORD)

        async def user(email, name, role):
            return await conn.fetchval(
                "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id",
                email, pw, name, role,
            )

        admin = await user("admin@phenomenon.school", "Айгуль Администратор", "admin")
        t1 = await user("teacher1@phenomenon.school", "Марат Ибрагимов", "teacher")
        t2 = await user("teacher2@phenomenon.school", "Елена Соколова", "teacher")
        s1 = await user("student1@phenomenon.school", "Данияр Ахметов", "student")
        s2 = await user("student2@phenomenon.school", "Алия Нурланова", "student")
        s3 = await user("student3@phenomenon.school", "Иван Петров", "student")

        async def course(teacher, title, desc, ann):
            return await conn.fetchval(
                """INSERT INTO courses (teacher_id, title, description, announcement, is_published)
                   VALUES ($1,$2,$3,$4,TRUE) RETURNING id""",
                teacher, title, desc, ann,
            )

        async def item(cid, typ, title, pos, note="", seq=False):
            iid = await conn.fetchval(
                """INSERT INTO course_items (course_id, type, title, position, note, sequential_unlock)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING id""",
                cid, typ, title, pos, note, seq,
            )
            if typ == "lesson":
                await conn.execute("INSERT INTO lessons (item_id) VALUES ($1)", iid)
            elif typ == "quiz":
                await conn.execute("INSERT INTO quizzes (item_id) VALUES ($1)", iid)
            else:
                await conn.execute("INSERT INTO homework (item_id) VALUES ($1)", iid)
            return iid

        async def lesson_content(iid, content, yt=""):
            await conn.execute("UPDATE lessons SET content=$1, youtube_url=$2 WHERE item_id=$3", content, yt, iid)

        async def quiz_cfg(iid, max_score, weight):
            await conn.execute("UPDATE quizzes SET max_score=$1, weight_pct=$2 WHERE item_id=$3", max_score, weight, iid)

        async def hw_cfg(iid, desc, max_score, weight, days_open=-7, days_deadline=7, days_close=14):
            now = datetime.datetime.now(datetime.timezone.utc)
            await conn.execute(
                """UPDATE homework SET description=$1, max_score=$2, weight_pct=$3,
                   open_at=$4, deadline_at=$5, close_at=$6 WHERE item_id=$7""",
                desc, max_score, weight,
                now + datetime.timedelta(days=days_open),
                now + datetime.timedelta(days=days_deadline),
                now + datetime.timedelta(days=days_close),
                iid,
            )

        async def question(qid, typ, prompt, points, pos, explanation="", options=None):
            question_id = await conn.fetchval(
                """INSERT INTO quiz_questions (quiz_id, type, prompt, points, position, explanation)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING id""",
                qid, typ, prompt, points, pos, explanation,
            )
            for i, (text, correct) in enumerate(options or []):
                await conn.execute(
                    "INSERT INTO question_options (question_id, text, is_correct, position) VALUES ($1,$2,$3,$4)",
                    question_id, text, correct, i,
                )
            return question_id

        async def enroll(cid, sid, status="approved"):
            await conn.execute(
                """INSERT INTO enrollments (course_id, student_id, status, decided_at)
                   VALUES ($1,$2,$3, now())
                   ON CONFLICT (course_id, student_id)
                   DO UPDATE SET status = EXCLUDED.status, decided_at = now()""",
                cid, sid, status,
            )

        async def group(code, title, direction, stream, students):
            gid = await conn.fetchval(
                """INSERT INTO groups (code, title, direction, stream, capacity)
                   VALUES ($1,$2,$3,$4,20) RETURNING id""",
                code, title, direction, stream,
            )
            for sid in students:
                await conn.execute(
                    "INSERT INTO group_students (group_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                    gid, sid,
                )
            return gid

        async def course_group(cid, gid):
            await conn.execute(
                "INSERT INTO course_groups (course_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                cid, gid,
            )
            await conn.execute(
                """
                INSERT INTO enrollments (course_id, student_id, status, decided_at)
                SELECT $1, student_id, 'approved', now()
                FROM group_students WHERE group_id = $2
                ON CONFLICT (course_id, student_id)
                DO UPDATE SET status = 'approved', decided_at = now()
                """,
                cid, gid,
            )

        # ---------- Course 1: Algebra ----------
        c1 = await course(
            t1, "Алгебра 9 класс",
            "Полный курс алгебры для 9 класса: квадратные уравнения, функции, прогрессии.",
            "Добро пожаловать! Занятия обновляются каждую неделю. Не забывайте про дедлайны домашних заданий.",
        )
        l1 = await item(c1, "lesson", "Квадратные уравнения: введение", 0)
        await lesson_content(
            l1,
            "Квадратное уравнение имеет вид ax² + bx + c = 0, где a ≠ 0.\n\n"
            "Дискриминант: D = b² − 4ac.\n\n"
            "Если D > 0 — два корня, D = 0 — один корень, D < 0 — корней нет.\n\n"
            "Формула корней: x = (−b ± √D) / 2a.",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        )
        q1 = await item(c1, "quiz", "Тест: квадратные уравнения", 1)
        await quiz_cfg(q1, 100, 40)
        await question(
            q1, "single", "Чему равен дискриминант уравнения x² − 5x + 6 = 0?", 2, 0,
            "D = b² − 4ac = 25 − 24 = 1",
            [("1", True), ("−1", False), ("49", False), ("25", False)],
        )
        await question(
            q1, "multiple", "Какие из чисел являются корнями уравнения x² − 5x + 6 = 0?", 2, 1,
            "x² − 5x + 6 = (x − 2)(x − 3), корни: 2 и 3",
            [("2", True), ("3", True), ("−2", False), ("6", False)],
        )
        await question(
            q1, "short_text", "Запишите формулу дискриминанта.", 2, 2,
            "D = b² − 4ac",
        )
        h1 = await item(c1, "homework", "Домашняя работа №1: решение уравнений", 2)
        await hw_cfg(h1, "Решите задачи 1–10 из учебника, стр. 45. Загрузите фото или PDF решения.", 100, 60)

        # ---------- Course 2: Physics ----------
        c2 = await course(
            t1, "Физика: механика",
            "Кинематика, динамика, законы Ньютона и законы сохранения.",
            "Перед каждым тестом внимательно смотрите видеоуроки.",
        )
        l2 = await item(c2, "lesson", "Законы Ньютона", 0)
        await lesson_content(
            l2,
            "Первый закон Ньютона: тело сохраняет состояние покоя или равномерного движения, "
            "пока на него не подействует сила.\n\nВторой закон: F = ma.\n\n"
            "Третий закон: сила действия равна силе противодействия.",
            "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
        )
        q2 = await item(c2, "quiz", "Тест: законы Ньютона", 1, seq=True)
        await quiz_cfg(q2, 100, 50)
        await question(
            q2, "single", "Какая формула выражает второй закон Ньютона?", 1, 0,
            "Сила равна произведению массы на ускорение.",
            [("F = ma", True), ("E = mc²", False), ("F = mv", False)],
        )
        await question(
            q2, "long_text", "Опишите своими словами третий закон Ньютона и приведите пример из жизни.", 3, 1,
            "Действию всегда есть равное и противоположное противодействие.",
        )
        h2 = await item(c2, "homework", "Лабораторная работа: измерение ускорения", 2, seq=True)
        await hw_cfg(h2, "Проведите эксперимент по инструкции и оформите отчёт в PDF.", 100, 50)

        # ---------- Course 3: Kazakh language ----------
        c3 = await course(
            t2, "Қазақ тілі: грамматика негіздері",
            "Қазақ тілінің грамматикасы: септіктер, жіктік жалғаулары және сөйлем құрылымы.",
            "Сабақ материалдары аптасына екі рет жаңартылады.",
        )
        l3 = await item(c3, "lesson", "Септіктер жүйесі", 0)
        await lesson_content(
            l3,
            "Қазақ тілінде 7 септік бар: атау, ілік, барыс, табыс, жатыс, шығыс, көмектес.\n\n"
            "Әр септіктің өз сұрақтары мен жалғаулары бар.",
        )
        q3 = await item(c3, "quiz", "Тест: септіктер", 1)
        await quiz_cfg(q3, 100, 100)
        await question(
            q3, "single", "Қазақ тілінде неше септік бар?", 1, 0, "Жеті септік.",
            [("7", True), ("6", False), ("8", False)],
        )
        await question(
            q3, "short_text", "Ілік септігінің сұрақтарын жазыңыз.", 2, 1, "кімнің? ненің?",
        )

        # ---------- Course 4: Programming ----------
        c4 = await course(
            t2, "Основы программирования на Python",
            "Переменные, условия, циклы, функции и первые проекты на Python.",
            "Устанавливать ничего не нужно — используйте любой онлайн-интерпретатор.",
        )
        l4 = await item(c4, "lesson", "Переменные и типы данных", 0)
        await lesson_content(
            l4,
            "В Python переменные создаются простым присваиванием: x = 5.\n\n"
            "Основные типы: int, float, str, bool, list, dict.\n\n"
            "Функция type() показывает тип значения.",
            "https://www.youtube.com/watch?v=kqtD5dpn9C8",
        )
        h4 = await item(c4, "homework", "Практика: первая программа", 1)
        await hw_cfg(h4, "Напишите программу-калькулятор и загрузите файл с кодом (или скриншот).", 100, 100,
                     days_open=-3, days_deadline=10, days_close=20)

        # ---------- Groups and course access ----------
        im1 = await group("ИМ1", "ИМ1 - информатика-математика", "Информатика-математика", "1", [s1, s2])
        im2 = await group("ИМ2", "ИМ2 - информатика-математика", "Информатика-математика", "2", [s3])
        fm1 = await group("ФМ1", "ФМ1 - физика-математика", "Физика-математика", "1", [s1, s3])
        await group("БГ1", "БГ1 - биология-география", "Биология-география", "1", [])
        await course_group(c1, im1)
        await course_group(c2, fm1)
        await course_group(c3, im2)
        await course_group(c4, im1)

        # ---------- Activity: quiz attempts ----------
        # s1 takes algebra quiz: correct single + correct multiple, text pending manual review
        a1 = await conn.fetchval(
            """INSERT INTO quiz_attempts (quiz_id, student_id, auto_score, status)
               VALUES ($1,$2,$3,'pending_review') RETURNING id""",
            q1, s1, round(4 / 6 * 100, 2),
        )
        qs = await conn.fetch("SELECT id, type FROM quiz_questions WHERE quiz_id=$1 ORDER BY position", q1)
        opts_correct_q0 = [r["id"] for r in await conn.fetch(
            "SELECT id FROM question_options WHERE question_id=$1 AND is_correct", qs[0]["id"])]
        opts_correct_q1 = [r["id"] for r in await conn.fetch(
            "SELECT id FROM question_options WHERE question_id=$1 AND is_correct", qs[1]["id"])]
        await conn.execute(
            "INSERT INTO attempt_answers (attempt_id, question_id, selected_option_ids, awarded_points) VALUES ($1,$2,$3,2)",
            a1, qs[0]["id"], opts_correct_q0,
        )
        await conn.execute(
            "INSERT INTO attempt_answers (attempt_id, question_id, selected_option_ids, awarded_points) VALUES ($1,$2,$3,2)",
            a1, qs[1]["id"], opts_correct_q1,
        )
        await conn.execute(
            "INSERT INTO attempt_answers (attempt_id, question_id, text_answer) VALUES ($1,$2,$3)",
            a1, qs[2]["id"], "D = b в квадрате минус 4ac",
        )

        # s2 takes kazakh quiz — fully graded
        a2 = await conn.fetchval(
            """INSERT INTO quiz_attempts (quiz_id, student_id, auto_score, manual_score, status)
               VALUES ($1,$2,$3,$4,'graded') RETURNING id""",
            q3, s2, round(1 / 3 * 100, 2), round(2 / 3 * 100, 2),
        )
        qs3 = await conn.fetch("SELECT id, type FROM quiz_questions WHERE quiz_id=$1 ORDER BY position", q3)
        opt = [r["id"] for r in await conn.fetch(
            "SELECT id FROM question_options WHERE question_id=$1 AND is_correct", qs3[0]["id"])]
        await conn.execute(
            "INSERT INTO attempt_answers (attempt_id, question_id, selected_option_ids, awarded_points) VALUES ($1,$2,$3,1)",
            a2, qs3[0]["id"], opt,
        )
        await conn.execute(
            "INSERT INTO attempt_answers (attempt_id, question_id, text_answer, awarded_points) VALUES ($1,$2,$3,2)",
            a2, qs3[1]["id"], "кімнің? ненің?",
        )

        # ---------- Activity: homework submissions ----------
        sub1 = await conn.fetchval(
            """INSERT INTO homework_submissions (homework_id, student_id, comment, grade, feedback, status)
               VALUES ($1,$2,'Решил все задачи, задача 7 вызвала трудности.',85,'Хорошая работа! Обратите внимание на оформление задачи 7.','graded')
               RETURNING id""",
            h1, s1,
        )
        await conn.execute(
            """INSERT INTO homework_submissions (homework_id, student_id, comment, status)
               VALUES ($1,$2,'Прикладываю решение.','submitted')""",
            h1, s2,
        )
        _ = sub1

        print("Seed complete.")
        print(f"All accounts use password: {PASSWORD}")
        print("admin@phenomenon.school / teacher1..2@phenomenon.school / student1..3@phenomenon.school")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
