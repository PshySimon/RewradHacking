import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth, database, models
from app.main import app


class AnnotationThreadsTest(unittest.TestCase):
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

        self.author = models.User(
            username="author",
            hashed_password="x",
            role=models.RoleEnum.user,
            nickname="作者",
            is_profile_completed=True,
        )
        self.reviewer = models.User(
            username="reviewer",
            hashed_password="x",
            role=models.RoleEnum.user,
            nickname="批注者",
            is_profile_completed=True,
        )
        self.db.add_all([self.author, self.reviewer])
        self.db.commit()
        self.db.refresh(self.author)
        self.db.refresh(self.reviewer)

        self.article = models.Article(
            id="art123",
            title="Article",
            content="content",
            category=models.CategoryEnum.knowledge,
            visibility=models.VisibilityEnum.public,
            author_id=self.author.id,
        )
        self.db.add(self.article)
        self.db.commit()

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()

    def _token(self, username):
        return auth.create_access_token({"sub": username})

    def test_root_annotation_targets_article_author_and_reply_targets_parent_author(self):
        root_response = self.client.post(
            f"/api/articles/{self.article.id}/annotations",
            json={
                "content": "根批注",
                "line_index": 8,
                "line_text": "这一行的正文",
            },
            headers={"Authorization": f"Bearer {self._token('reviewer')}"},
        )
        self.assertEqual(root_response.status_code, 200)
        root_payload = root_response.json()
        self.assertIsNone(root_payload["parent_id"])
        self.assertEqual(root_payload["recipient_id"], self.author.id)
        self.assertEqual(root_payload["recipient_username"], "author")

        reply_response = self.client.post(
            f"/api/articles/{self.article.id}/annotations",
            json={
                "content": "收到，回复你",
                "line_index": 999,
                "line_text": "这两个字段在回复里应该被忽略",
                "parent_id": root_payload["id"],
            },
            headers={"Authorization": f"Bearer {self._token('author')}"},
        )
        self.assertEqual(reply_response.status_code, 200)
        reply_payload = reply_response.json()
        self.assertEqual(reply_payload["parent_id"], root_payload["id"])
        self.assertEqual(reply_payload["recipient_id"], self.reviewer.id)
        self.assertEqual(reply_payload["recipient_username"], "reviewer")
        self.assertEqual(reply_payload["line_index"], 8)
        self.assertEqual(reply_payload["line_text"], "这一行的正文")

        list_response = self.client.get(f"/api/articles/{self.article.id}/annotations")
        self.assertEqual(list_response.status_code, 200)
        data = list_response.json()
        self.assertEqual(len(data), 2)
        data_by_id = {item["id"]: item for item in data}
        self.assertEqual(data_by_id[root_payload["id"]]["recipient_username"], "author")
        self.assertEqual(data_by_id[reply_payload["id"]]["parent_id"], root_payload["id"])
        self.assertEqual(data_by_id[reply_payload["id"]]["recipient_username"], "reviewer")

        notifications = self.db.query(models.Notification).order_by(models.Notification.created_at.asc()).all()
        self.assertEqual(len(notifications), 2)
        self.assertEqual(notifications[0].recipient_id, self.author.id)
        self.assertEqual(notifications[0].event_type, "annotation")
        self.assertEqual(notifications[1].recipient_id, self.reviewer.id)
        self.assertEqual(notifications[1].event_type, "annotation_reply")


if __name__ == "__main__":
    unittest.main()
