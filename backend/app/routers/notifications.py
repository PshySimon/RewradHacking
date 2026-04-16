from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .. import schemas, database, models, auth
from ..notification_retention import purge_expired_notifications

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("/", response_model=schemas.NotificationPageOut)
def list_notifications(
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if page < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="页码必须从 1 开始。"
        )

    if page_size < 1 or page_size > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="每页条数必须在 1 到 100 之间。"
        )

    deleted = purge_expired_notifications(db)
    if deleted:
        db.commit()

    query = db.query(models.Notification).filter(models.Notification.recipient_id == current_user.id)
    total_count = query.count()
    unread_count = query.filter(models.Notification.is_read == False).count()
    offset = (page - 1) * page_size
    notifications = query.order_by(desc(models.Notification.created_at)).offset(offset).limit(page_size).all()

    out = []
    for n in notifications:
        actor = db.query(models.User).filter(models.User.id == n.actor_id).first()
        article = db.query(models.Article).filter(models.Article.id == n.article_id).first()

        item = schemas.NotificationOut.model_validate(n)
        if actor:
            item.actor_username = actor.username
            item.actor_nickname = actor.nickname
            item.actor_avatar = actor.avatar
        if article:
            item.article_title = article.title

        out.append(item)

    return {
        "items": out,
        "page": page,
        "page_size": page_size,
        "total_count": total_count,
        "unread_count": unread_count,
        "has_prev": page > 1,
        "has_next": offset + len(out) < total_count,
    }


@router.post("/read-all")
def read_all_notifications(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    deleted = purge_expired_notifications(db)
    db.query(models.Notification).filter(
        models.Notification.recipient_id == current_user.id,
        models.Notification.is_read == False,
    ).update({models.Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "SUCCESS", "deleted": deleted}


@router.post("/{notification_id}/read")
def read_notification(
    notification_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    deleted = purge_expired_notifications(db)
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    if notification.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作该通知")

    notification.is_read = True
    db.commit()
    return {"status": "SUCCESS", "id": notification_id, "deleted": deleted}
