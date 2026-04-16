import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from app import models


class _FakeDateTime:
    @staticmethod
    def now(tz=None):
        base = datetime(2026, 4, 16, 1, 5, tzinfo=timezone.utc)
        if tz is None:
            return base.replace(tzinfo=None)
        return base.astimezone(tz)


class TimeFormatTest(unittest.TestCase):
    def test_get_current_time_uses_beijing_time(self):
        with patch("app.models.datetime", _FakeDateTime):
            self.assertEqual(models.get_current_time(), "2026-04-16 09:05")


if __name__ == "__main__":
    unittest.main()
