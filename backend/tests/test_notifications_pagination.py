import unittest
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth, database, models
from app.main import app


class NotificationsPaginationTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        database.Base.metadata.create_all(bind=self.engine)
        self.db = self.Session()

        def override_get_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[database.get_db] = override_get_db
        self.client = TestClient(app)

        self.recipient = models.User(
            username="recipient",
            hashed_password="x",
            role=models.RoleEnum.user,
            nickname="接收者",
            is_profile_completed=True,
        )
        self.actor = models.User(
            username="actor",
            hashed_password="x",
            role=models.RoleEnum.user,
            nickname="触发者",
            is_profile_completed=True,
        )
        self.db.add_all([self.recipient, self.actor])
        self.db.commit()
        self.db.refresh(self.recipient)
        self.db.refresh(self.actor)

        self.article = models.Article(
            id="art123",
            title="Article",
            content="content",
            category=models.CategoryEnum.knowledge,
            visibility=models.VisibilityEnum.public,
            author_id=self.actor.id,
        )
        self.db.add(self.article)
        self.db.commit()

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()

    def _token(self, username):
        return auth.create_access_token({"sub": username})

    def _create_notification(self, created_at, is_read=False):
        notification = models.Notification(
            recipient_id=self.recipient.id,
            actor_id=self.actor.id,
            article_id=self.article.id,
            comment_id=models.generate_nano_id(),
            event_type="article_comment",
            target_path=f"/article/{self.article.id}",
            snippet="snippet",
            created_at=created_at,
            is_read=is_read,
        )
        self.db.add(notification)
        return notification

    def test_notifications_are_paginated_and_prune_older_than_six_months(self):
        now = models.get_beijing_now()
        recent_notifications = []
        for index in range(12):
            notification = self._create_notification(
                (now - timedelta(minutes=index)).strftime("%Y-%m-%d %H:%M"),
                is_read=index >= 3,
            )
            recent_notifications.append(notification)

        old_notification = self._create_notification(
            (now - timedelta(days=220)).strftime("%Y-%m-%d %H:%M"),
            is_read=False,
        )
        old_notification_id = old_notification.id
        self.db.commit()

        response = self.client.get(
            "/api/notifications/",
            params={"page": 1, "page_size": 10},
            headers={"Authorization": f"Bearer {self._token('recipient')}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["page"], 1)
        self.assertEqual(payload["page_size"], 10)
        self.assertEqual(payload["total_count"], 12)
        self.assertEqual(payload["unread_count"], 3)
        self.assertTrue(payload["has_next"])
        self.assertFalse(payload["has_prev"])
        self.assertEqual(len(payload["items"]), 10)

        page_two = self.client.get(
            "/api/notifications/",
            params={"page": 2, "page_size": 10},
            headers={"Authorization": f"Bearer {self._token('recipient')}"},
        )
        self.assertEqual(page_two.status_code, 200)
        page_two_payload = page_two.json()
        self.assertEqual(page_two_payload["page"], 2)
        self.assertFalse(page_two_payload["has_next"])
        self.assertTrue(page_two_payload["has_prev"])
        self.assertEqual(len(page_two_payload["items"]), 2)

        self.assertIsNone(
            self.db.query(models.Notification)
            .filter(models.Notification.id == old_notification_id)
            .first()
        )


if __name__ == "__main__":
    unittest.main()
