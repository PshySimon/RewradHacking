import unittest

from fastapi.testclient import TestClient

from app.main import app


class AnnotationRoutesTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_annotation_routes_are_registered(self):
        route_table = {
            (method, route.path)
            for route in app.routes
            for method in getattr(route, "methods", set())
        }

        self.assertIn(("GET", "/api/articles/{article_id}/annotations"), route_table)
        self.assertIn(("POST", "/api/articles/{article_id}/annotations"), route_table)

    def test_create_annotation_route_is_live_and_not_a_404(self):
        response = self.client.post(
            "/api/articles/test-article/annotations",
            json={
                "content": "test",
                "line_index": 1,
                "line_text": "line",
            },
        )

        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
