"""Phenomenon School LMS demo data.

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

        async def user(email: str, name: str, role: str) -> int:
            return await conn.fetchval(
                "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id",
                email,
                pw,
                name,
                role,
            )

        admin = await user("admin@phenomenon.school", "Айгүл Әкімші", "admin")
        t1 = await user("teacher1@phenomenon.school", "Марат Ибраев", "teacher")
        t2 = await user("teacher2@phenomenon.school", "Әсел Нұрланқызы", "teacher")
        s1 = await user("student1@phenomenon.school", "Данияр Ахмет", "student")
        s2 = await user("student2@phenomenon.school", "Әлия Нұрлан", "student")
        s3 = await user("student3@phenomenon.school", "Айбар Сәрсен", "student")
        s4 = await user("student4@phenomenon.school", "Мадина Қайрат", "student")
        s5 = await user("student5@phenomenon.school", "Ерасыл Болат", "student")
        s6 = await user("student6@phenomenon.school", "Аружан Сейіт", "student")

        async def course(teacher: int, title: str, desc: str, ann: str) -> int:
            return await conn.fetchval(
                """INSERT INTO courses (teacher_id, title, description, announcement, is_published)
                   VALUES ($1,$2,$3,$4,TRUE) RETURNING id""",
                teacher,
                title,
                desc,
                ann,
            )

        async def item(cid: int, typ: str, title: str, pos: int, note: str = "", seq: bool = False) -> int:
            iid = await conn.fetchval(
                """INSERT INTO course_items (course_id, type, title, position, note, sequential_unlock)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING id""",
                cid,
                typ,
                title,
                pos,
                note,
                seq,
            )
            if typ == "lesson":
                await conn.execute("INSERT INTO lessons (item_id) VALUES ($1)", iid)
            elif typ == "quiz":
                await conn.execute("INSERT INTO quizzes (item_id) VALUES ($1)", iid)
            else:
                await conn.execute("INSERT INTO homework (item_id) VALUES ($1)", iid)
            return iid

        async def lesson_content(iid: int, content: str, yt: str = "") -> None:
            await conn.execute("UPDATE lessons SET content=$1, youtube_url=$2 WHERE item_id=$3", content, yt, iid)

        async def quiz_cfg(iid: int, max_score: int, weight: int) -> None:
            await conn.execute(
                """
                INSERT INTO quizzes (item_id, max_score, weight_pct)
                VALUES ($1, $2, $3)
                ON CONFLICT (item_id)
                DO UPDATE SET max_score = EXCLUDED.max_score, weight_pct = EXCLUDED.weight_pct
                """,
                iid,
                max_score,
                weight,
            )

        async def hw_cfg(
            iid: int,
            desc: str,
            max_score: int,
            weight: int,
            days_open: int = -7,
            days_deadline: int = 7,
            days_close: int = 14,
        ) -> None:
            now = datetime.datetime.now(datetime.timezone.utc)
            await conn.execute(
                """UPDATE homework SET description=$1, max_score=$2, weight_pct=$3,
                   open_at=$4, deadline_at=$5, close_at=$6 WHERE item_id=$7""",
                desc,
                max_score,
                weight,
                now + datetime.timedelta(days=days_open),
                now + datetime.timedelta(days=days_deadline),
                now + datetime.timedelta(days=days_close),
                iid,
            )

        async def question(
            qid: int,
            typ: str,
            prompt: str,
            points: int,
            pos: int,
            explanation: str = "",
            options: list[tuple[str, bool]] | None = None,
        ) -> int:
            question_id = await conn.fetchval(
                """INSERT INTO quiz_questions (quiz_id, type, prompt, points, position, explanation)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING id""",
                qid,
                typ,
                prompt,
                points,
                pos,
                explanation,
            )
            for i, (text, correct) in enumerate(options or []):
                await conn.execute(
                    "INSERT INTO question_options (question_id, text, is_correct, position) VALUES ($1,$2,$3,$4)",
                    question_id,
                    text,
                    correct,
                    i,
                )
            return question_id

        async def group(code: str, title: str, direction: str, stream: str, students: list[int]) -> int:
            gid = await conn.fetchval(
                """INSERT INTO groups (code, title, direction, stream, capacity)
                   VALUES ($1,$2,$3,$4,20) RETURNING id""",
                code,
                title,
                direction,
                stream,
            )
            for sid in students:
                await conn.execute(
                    "INSERT INTO group_students (group_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                    gid,
                    sid,
                )
            return gid

        async def course_group(cid: int, gid: int) -> None:
            await conn.execute(
                "INSERT INTO course_groups (course_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                cid,
                gid,
            )
            await conn.execute(
                """
                INSERT INTO enrollments (course_id, student_id, status, decided_at)
                SELECT $1, student_id, 'approved', now()
                FROM group_students WHERE group_id = $2
                ON CONFLICT (course_id, student_id)
                DO UPDATE SET status = 'approved', decided_at = now()
                """,
                cid,
                gid,
            )

        # ---------- Groups: UNT profile streams ----------
        mf1 = await group("МФ1", "МФ1 - математика-физика", "Математика-физика", "1", [s1, s2, s3])
        im1 = await group("ИМ1", "ИМ1 - информатика-математика", "Информатика-математика", "1", [s4, s5, s6])
        bh1 = await group("БХ1", "БХ1 - биология-химия", "Биология-химия", "1", [s1, s4])
        bg1 = await group("БГ1", "БГ1 - биология-география", "Биология-география", "1", [s2, s5])
        dt1 = await group("ДГ1", "ДГ1 - дүниежүзі тарихы-география", "Дүниежүзі тарихы-география", "1", [s3, s6])

        # ---------- Mandatory UNT subjects ----------
        c_history = await course(
            t1,
            "Қазақстан тарихы",
            "ҰБТ-дағы міндетті пән: ежелгі дәуірден қазіргі Қазақстанға дейінгі негізгі оқиғалар.",
            "Әр тақырып бір бейнесабақпен беріледі. Мұғалім қолжетімділікті топқа немесе жеке оқушыға ашады.",
        )
        h_l1 = await item(c_history, "lesson", "Сақтар мен ғұндар", 0, "Бір бейнесабақ - бір тақырып.")
        await lesson_content(
            h_l1,
            "Бұл тақырыпта сақ, ғұн тайпаларының қоғамдық құрылымы, шаруашылығы және тарихи маңызы қарастырылады.\n\n"
            "ҰБТ-да жиі кездесетін ұғымдар: тайпа, көсем, әскери демократия, көшпелі мәдениет.",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        )
        h_l2 = await item(c_history, "lesson", "Қазақ хандығының құрылуы", 1, "Керей мен Жәнібек кезеңі.")
        await lesson_content(
            h_l2,
            "Қазақ хандығы XV ғасырда құрылды. Тақырыпта хандықтың құрылу себептері, алғашқы хандар және тарихи деректер талданады.",
            "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
        )
        h_q = h_l2
        await quiz_cfg(h_q, 100, 60)
        await question(
            h_q,
            "single",
            "Қазақ хандығының алғашқы хандары кімдер?",
            2,
            0,
            "Қазақ хандығының негізін Керей мен Жәнібек қалаған.",
            [("Керей мен Жәнібек", True), ("Абылай мен Әбілқайыр", False), ("Тәуке мен Қасым", False)],
        )
        await question(
            h_q,
            "short_text",
            "Сақ қоғамындағы билеуші топ қалай аталды?",
            2,
            1,
            "Көсемдер мен ақсүйектер билеуші топқа жатады.",
        )
        h_hw = await item(c_history, "homework", "Тапсырма: тарихи кесте", 2, seq=True)
        await hw_cfg(h_hw, "Сақтар, ғұндар және Қазақ хандығы бойынша негізгі даталар кестесін жасаңыз.", 100, 40)

        c_math_lit = await course(
            t1,
            "Математикалық сауаттылық",
            "ҰБТ-дағы міндетті пән: пайыз, пропорция, логика, диаграмма және мәтінді есептер.",
            "Есепті шығарғанда жауап қана емес, қысқа шешу жолын да көрсетіңіз.",
        )
        ml_l1 = await item(c_math_lit, "lesson", "Пайыз және пропорция", 0)
        await lesson_content(
            ml_l1,
            "Пайыз - санның жүзден бір бөлігі. Пропорцияда екі қатынас тең болады.\n\n"
            "Мысал: 200 санының 15%-ы = 200 * 0.15 = 30.",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        )
        ml_l2 = await item(c_math_lit, "lesson", "Диаграмма және кесте оқу", 1)
        await lesson_content(
            ml_l2,
            "Диаграммадағы мәліметті оқу үшін ось атауын, өлшем бірлігін және салыстырылатын шамаларды анықтау керек.",
            "https://www.youtube.com/watch?v=kqtD5dpn9C8",
        )
        ml_q = ml_l2
        await quiz_cfg(ml_q, 100, 100)
        await question(
            ml_q,
            "single",
            "300 санының 20%-ы нешеге тең?",
            1,
            0,
            "300 * 0.20 = 60.",
            [("60", True), ("30", False), ("20", False)],
        )

        c_reading = await course(
            t2,
            "Оқу сауаттылығы",
            "ҰБТ-дағы міндетті пән: мәтінді түсіну, негізгі ойды табу және дәлелді жауап беру.",
            "Мәтінді алдымен толық оқып, содан кейін сұраққа оралыңыз.",
        )
        r_l1 = await item(c_reading, "lesson", "Негізгі ойды анықтау", 0)
        await lesson_content(
            r_l1,
            "Негізгі ой - мәтіндегі ең басты пікір. Оны табу үшін қай ой бірнеше сөйлем арқылы дәлелденетінін анықтаңыз.",
            "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
        )
        r_l2 = await item(c_reading, "lesson", "Автор көзқарасы", 1)
        await lesson_content(
            r_l2,
            "Автор көзқарасы мәтіндегі бағалау сөздерінен, дәлелдерінен және қорытындысынан байқалады.",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        )
        r_hw = await item(c_reading, "homework", "Тапсырма: мәтін талдау", 2)
        await hw_cfg(r_hw, "Берілген мәтіннен негізгі ойды, автор көзқарасын және екі дәлелді жазыңыз.", 100, 100)

        # ---------- Profile UNT subject combinations ----------
        c_mf = await course(
            t1,
            "Математика-физика",
            "Бейіндік бағыт: функциялар, қозғалыс, күш, энергия және ҰБТ есептері.",
            "Бұл курс МФ топтарына арналған. Әр тақырып жеке бейнесабақ ретінде ашылады.",
        )
        mf_l1 = await item(c_mf, "lesson", "Функция және график", 0)
        await lesson_content(
            mf_l1,
            "Функция бір айнымалының мәніне екінші айнымалының бір мәнін сәйкестендіреді. График арқылы өсу, кему және нөлдерін көруге болады.",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        )
        mf_l2 = await item(c_mf, "lesson", "Ньютон заңдары", 1)
        await lesson_content(
            mf_l2,
            "Ньютонның екінші заңы: F = ma. Күш, масса және үдеу арасындағы байланыс есеп шығарудың негізі болады.",
            "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
        )
        mf_q = mf_l2
        await quiz_cfg(mf_q, 100, 50)
        await question(
            mf_q,
            "single",
            "Егер m = 2 кг, a = 3 м/с² болса, F нешеге тең?",
            2,
            0,
            "F = ma = 2 * 3 = 6 Н.",
            [("6 Н", True), ("5 Н", False), ("9 Н", False)],
        )
        mf_hw = await item(c_mf, "homework", "Тапсырма: график және күш", 2, seq=True)
        await hw_cfg(mf_hw, "Функция графигі және Ньютон заңы бойынша 5 есеп шығарыңыз.", 100, 50)

        c_im = await course(
            t2,
            "Математика-информатика",
            "Бейіндік бағыт: алгоритм, Python, логика және дискретті есептер.",
            "Кодты түсініктемемен жазыңыз, тек нәтиже жеткіліксіз.",
        )
        im_l1 = await item(c_im, "lesson", "Алгоритм және айнымалылар", 0)
        await lesson_content(
            im_l1,
            "Алгоритм - есепті шешуге арналған нақты қадамдар тізбегі. Python тілінде айнымалы мәнді сақтайды: x = 5.",
            "https://www.youtube.com/watch?v=kqtD5dpn9C8",
        )
        im_l2 = await item(c_im, "lesson", "Циклдер", 1)
        await lesson_content(
            im_l2,
            "Цикл қайталанатын әрекеттерді орындауға көмектеседі. for циклі белгілі сан рет, while циклі шарт орындалғанша жұмыс істейді.",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        )
        im_hw = await item(c_im, "homework", "Практика: Python есептері", 2)
        await hw_cfg(im_hw, "for және while циклдерін қолданып үш шағын бағдарлама жазыңыз.", 100, 100)

        c_bh = await course(
            t2,
            "Биология-химия",
            "Бейіндік бағыт: жасуша, генетика, химиялық байланыс және реакциялар.",
            "Биология мен химиядағы негізгі терминдерді дәптерге бөлек жазып жүріңіз.",
        )
        bh_l1 = await item(c_bh, "lesson", "Жасуша құрылысы", 0)
        await lesson_content(
            bh_l1,
            "Жасуша мембрана, цитоплазма және ядродан тұрады. Органоидтер әртүрлі қызмет атқарады.",
            "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
        )
        bh_l2 = await item(c_bh, "lesson", "Химиялық байланыс", 1)
        await lesson_content(
            bh_l2,
            "Иондық, коваленттік және металдық байланыстар заттың қасиетін анықтайды.",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        )
        bh_q = bh_l2
        await quiz_cfg(bh_q, 100, 100)
        await question(
            bh_q,
            "single",
            "Жасушаның тұқымқуалаушылық ақпаратын сақтайтын бөлігі қайсы?",
            1,
            0,
            "Ядро ДНҚ-ны сақтайды.",
            [("Ядро", True), ("Мембрана", False), ("Рибосома", False)],
        )

        c_geo = await course(
            t1,
            "География-дүниежүзі тарихы",
            "Бейіндік бағыт: карта, табиғи ресурстар, өркениеттер және тарихи үдерістер.",
            "Карта және хронологиямен жұмыс істеу дағдысын тұрақты қайталаңыз.",
        )
        geo_l1 = await item(c_geo, "lesson", "Карта және координата", 0)
        await lesson_content(
            geo_l1,
            "Географиялық координата ендік пен бойлық арқылы анықталады. Карта масштабын дұрыс оқу есеп шығаруға көмектеседі.",
            "https://www.youtube.com/watch?v=kqtD5dpn9C8",
        )
        geo_l2 = await item(c_geo, "lesson", "Ежелгі өркениеттер", 1)
        await lesson_content(
            geo_l2,
            "Ежелгі өркениеттер өзен аңғарларында қалыптасты. Ніл, Тигр, Евфрат, Үнді және Хуанхэ аймақтары маңызды.",
            "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
        )
        geo_hw = await item(c_geo, "homework", "Тапсырма: карта және хронология", 2)
        await hw_cfg(geo_hw, "Картадан 5 нысан белгілеп, ежелгі өркениеттер бойынша қысқа хронология жасаңыз.", 100, 100)

        # ---------- Link groups to relevant courses ----------
        for gid in [mf1, im1, bh1, bg1, dt1]:
            await course_group(c_history, gid)
            await course_group(c_math_lit, gid)
            await course_group(c_reading, gid)
        await course_group(c_mf, mf1)
        await course_group(c_im, im1)
        await course_group(c_bh, bh1)
        await course_group(c_bh, bg1)
        await course_group(c_geo, bg1)
        await course_group(c_geo, dt1)

        _ = admin

        print("Seed complete.")
        print(f"All accounts use password: {PASSWORD}")
        print("admin@phenomenon.school / teacher1..2@phenomenon.school / student1..6@phenomenon.school")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
