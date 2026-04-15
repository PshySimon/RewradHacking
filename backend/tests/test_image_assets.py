import os
import tempfile
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app import models
from app.image_assets import (
    ensure_asset_for_filename,
    extract_local_image_filenames,
    store_image_bytes,
    clear_image_references,
    sync_image_references,
)


class ImageAssetsTest(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.upload_dir = os.path.join(self.tmpdir.name, "uploads")
        os.makedirs(self.upload_dir)
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        self.Session = sessionmaker(bind=engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.tmpdir.cleanup()

    def test_extract_local_image_filenames_from_markdown_and_html(self):
        content = """
        ![](/api/static/images/abc.png)
        <img src="/api/static/images/def.webp" />
        ![](https://example.com/remote.png)
        <img src='/api/static/images/abc.png?cache=1' />
        """

        self.assertEqual(
            extract_local_image_filenames(content),
            {"abc.png", "def.webp"},
        )

    def test_store_image_bytes_reuses_existing_hash(self):
        first = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"same-image",
            original_filename="first.png",
            content_type="image/png",
            uploader_id=1,
        )
        second = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"same-image",
            original_filename="second.png",
            content_type="image/png",
            uploader_id=1,
        )

        self.assertEqual(first.url, second.url)
        self.assertEqual(len(os.listdir(self.upload_dir)), 1)
        self.assertEqual(self.db.query(models.ImageAsset).count(), 1)

    def test_ensure_asset_for_filename_preserves_existing_legacy_filename(self):
        legacy_filename = "legacy-uuid.png"
        with open(os.path.join(self.upload_dir, legacy_filename), "wb") as image_file:
            image_file.write(b"legacy-image")

        asset = ensure_asset_for_filename(
            self.db,
            upload_dir=self.upload_dir,
            filename=legacy_filename,
        )

        self.assertEqual(asset.filename, legacy_filename)
        self.assertEqual(asset.url, f"/api/static/images/{legacy_filename}")
        self.assertEqual(os.listdir(self.upload_dir), [legacy_filename])

    def test_sync_image_references_replaces_current_owner_references(self):
        image_a = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"image-a",
            original_filename="a.png",
            content_type="image/png",
            uploader_id=1,
        )
        image_b = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"image-b",
            original_filename="b.png",
            content_type="image/png",
            uploader_id=1,
        )

        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({image_a.url}) ![]({image_b.url})",
        )
        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({image_b.url})",
        )

        refs = self.db.query(models.ImageReference).all()
        self.assertEqual(len(refs), 1)
        self.assertEqual(refs[0].image_id, image_b.id)

    def test_sync_image_references_is_idempotent_for_existing_references(self):
        image_a = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"shared-content",
            original_filename="a.png",
            content_type="image/png",
            uploader_id=1,
        )

        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({image_a.url})",
            upload_dir=self.upload_dir,
        )
        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({image_a.url})",
            upload_dir=self.upload_dir,
        )

        refs = self.db.query(models.ImageReference).all()
        self.assertEqual(len(refs), 1)
        self.assertEqual(refs[0].image_id, image_a.id)

    def test_clear_image_references_deletes_file_when_last_reference_is_removed(self):
        image = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"referenced",
            original_filename="referenced.png",
            content_type="image/png",
            uploader_id=1,
        )
        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({image.url})",
        )

        deleted = clear_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            upload_dir=self.upload_dir,
        )

        self.assertEqual(deleted, [image.filename])
        self.assertFalse(os.path.exists(os.path.join(self.upload_dir, image.filename)))
        self.assertEqual(self.db.query(models.ImageAsset).count(), 0)

    def test_clear_image_references_keeps_file_when_another_owner_still_references_it(self):
        image = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"shared",
            original_filename="shared.png",
            content_type="image/png",
            uploader_id=1,
        )
        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({image.url})",
        )
        sync_image_references(
            self.db,
            owner_type="draft",
            owner_id="D1",
            field="content",
            content=f"![]({image.url})",
        )

        deleted = clear_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            upload_dir=self.upload_dir,
        )

        self.assertEqual(deleted, [])
        self.assertTrue(os.path.exists(os.path.join(self.upload_dir, image.filename)))
        self.assertEqual(self.db.query(models.ImageAsset).count(), 1)

    def test_sync_image_references_deletes_files_removed_from_owner_content(self):
        referenced = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"referenced",
            original_filename="referenced.png",
            content_type="image/png",
            uploader_id=1,
        )
        unused = store_image_bytes(
            self.db,
            upload_dir=self.upload_dir,
            content=b"unused",
            original_filename="unused.png",
            content_type="image/png",
            uploader_id=1,
        )
        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({referenced.url}) ![]({unused.url})",
        )
        sync_image_references(
            self.db,
            owner_type="article",
            owner_id="A1",
            field="content",
            content=f"![]({referenced.url})",
            upload_dir=self.upload_dir,
        )

        self.assertTrue(os.path.exists(os.path.join(self.upload_dir, referenced.filename)))
        self.assertFalse(os.path.exists(os.path.join(self.upload_dir, unused.filename)))
        self.assertEqual(
            {asset.filename for asset in self.db.query(models.ImageAsset).all()},
            {referenced.filename},
        )


if __name__ == "__main__":
    unittest.main()
