import unittest
from unittest.mock import AsyncMock, patch

from routers import courses, quizzes


class LessonMaterialsTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_quiz_does_not_hide_lesson_video(self):
        user = {"id": 1, "role": "student"}
        item = {"id": 2, "type": "lesson", "title": "Lesson", "note": "", "course_id": 1}
        lesson = {"content": "Educational text", "youtube_url": "https://youtu.be/kqtD5dpn9C8"}
        quiz = {"max_score": 100, "weight_pct": 0, "open_at": None, "deadline_at": None,
                "close_at": None, "time_limit_minutes": None}
        pool = AsyncMock()
        pool.fetchrow.side_effect = [lesson, quiz]
        pool.fetch.return_value = []
        get_quiz = AsyncMock(return_value={"quiz_started": True, "question_count": 1, "attempt": None})
        with patch.object(courses, "ensure_item_access", AsyncMock(return_value=(item, {"teacher_id": 5}))), \
             patch.object(courses, "get_pool", AsyncMock(return_value=pool)), \
             patch.object(quizzes, "get_quiz", get_quiz):
            result = await courses.get_lesson(2, user=user)
        self.assertEqual(result["youtube_url"], lesson["youtube_url"])
        self.assertEqual(result["content"], lesson["content"])
        self.assertTrue(result["has_quiz"])
        self.assertTrue(result["quiz_started"])
        get_quiz.assert_awaited_once_with(2, user=user)
        pool.execute.assert_not_awaited()
