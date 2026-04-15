import hashlib
import os
import re
from typing import Iterable

from sqlalchemy.orm import Session

from . import models

LOCAL_IMAGE_PATTERN = re.compile(r"/api/static/images/(?P<filename>[A-Za-z0-9._-]+)")
ALLOWED_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
}


def extract_local_image_filenames(content: str | None) -> set[str]:
    if not content:
        return set()
    return {match.group("filename") for match in LOCAL_IMAGE_PATTERN.finditer(content)}


def get_extension(original_filename: str | None, content_type: str | None) -> str:
    if content_type in ALLOWED_EXTENSIONS:
        return ALLOWED_EXTENSIONS[content_type]
    if original_filename and "." in original_filename:
        ext = original_filename.rsplit(".", 1)[-1].lower()
        if ext in {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"}:
            return "jpg" if ext == "jpeg" else ext
    return "jpg"


def store_image_bytes(
    db: Session,
    *,
    upload_dir: str,
    content: bytes,
    original_filename: str | None,
    content_type: str,
    uploader_id: int | None = None,
) -> models.ImageAsset:
    digest = hashlib.sha256(content).hexdigest()
    existing = db.query(models.ImageAsset).filter(models.ImageAsset.hash == digest).first()
    if existing:
        return existing

    os.makedirs(upload_dir, exist_ok=True)
    ext = get_extension(original_filename, content_type)
    filename = f"{digest}.{ext}"
    file_path = os.path.join(upload_dir, filename)
    if not os.path.exists(file_path):
        with open(file_path, "wb") as image_file:
            image_file.write(content)

    asset = models.ImageAsset(
        hash=digest,
        filename=filename,
        url=f"/api/static/images/{filename}",
        mime=content_type,
        size=len(content),
        uploader_id=uploader_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def ensure_asset_for_filename(
    db: Session,
    *,
    upload_dir: str,
    filename: str,
) -> models.ImageAsset | None:
    asset = db.query(models.ImageAsset).filter(models.ImageAsset.filename == filename).first()
    if asset:
        return asset

    file_path = os.path.join(upload_dir, filename)
    if not os.path.isfile(file_path):
        return None

    with open(file_path, "rb") as image_file:
        content = image_file.read()

    content_type = _content_type_from_extension(filename)
    asset = models.ImageAsset(
        hash=hashlib.sha256(content).hexdigest(),
        filename=filename,
        url=f"/api/static/images/{filename}",
        mime=content_type,
        size=len(content),
        uploader_id=None,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def sync_image_references(
    db: Session,
    *,
    owner_type: str,
    owner_id: str,
    field: str,
    content: str | None,
    upload_dir: str | None = None,
) -> list[str]:
    existing_refs = db.query(models.ImageReference).filter(
        models.ImageReference.owner_type == owner_type,
        models.ImageReference.owner_id == str(owner_id),
        models.ImageReference.field == field,
    ).all()
    affected_image_ids = {ref.image_id for ref in existing_refs}
    for ref in existing_refs:
        db.delete(ref)

    filenames = extract_local_image_filenames(content)
    if not filenames:
        deleted = _delete_unreferenced_assets(db, image_ids=affected_image_ids, upload_dir=upload_dir)
        db.commit()
        return deleted

    assets_by_filename = {
        asset.filename: asset
        for asset in db.query(models.ImageAsset).filter(models.ImageAsset.filename.in_(filenames)).all()
    }

    if upload_dir:
        for filename in filenames - set(assets_by_filename):
            asset = ensure_asset_for_filename(db, upload_dir=upload_dir, filename=filename)
            if asset:
                assets_by_filename[filename] = asset

    for asset in assets_by_filename.values():
        affected_image_ids.add(asset.id)
        db.add(models.ImageReference(
            image_id=asset.id,
            owner_type=owner_type,
            owner_id=str(owner_id),
            field=field,
        ))

    deleted = _delete_unreferenced_assets(db, image_ids=affected_image_ids, upload_dir=upload_dir)
    db.commit()
    return deleted


def clear_image_references(
    db: Session,
    *,
    owner_type: str,
    owner_id: str,
    fields: Iterable[str] | None = None,
    upload_dir: str | None = None,
) -> list[str]:
    query = db.query(models.ImageReference).filter(
        models.ImageReference.owner_type == owner_type,
        models.ImageReference.owner_id == str(owner_id),
    )
    if fields:
        query = query.filter(models.ImageReference.field.in_(list(fields)))
    refs = query.all()
    affected_image_ids = {ref.image_id for ref in refs}
    for ref in refs:
        db.delete(ref)
    deleted = _delete_unreferenced_assets(db, image_ids=affected_image_ids, upload_dir=upload_dir)
    db.commit()
    return deleted


def _delete_unreferenced_assets(
    db: Session,
    *,
    image_ids: set[int],
    upload_dir: str | None,
) -> list[str]:
    if not upload_dir or not image_ids:
        return []

    deleted = []
    for image_id in sorted(image_ids):
        asset = db.query(models.ImageAsset).filter(models.ImageAsset.id == image_id).first()
        if not asset:
            continue
        still_referenced = db.query(models.ImageReference).filter(
            models.ImageReference.image_id == image_id,
        ).first()
        if still_referenced:
            continue

        source = os.path.join(upload_dir, asset.filename)
        if os.path.isfile(source):
            os.remove(source)
        deleted.append(asset.filename)
        db.delete(asset)
    return deleted


def _content_type_from_extension(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "bmp": "image/bmp",
    }.get(ext, "image/jpeg")
