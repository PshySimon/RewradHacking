from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .. import schemas, database, models, auth

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("/", response_model=List[schemas.NotificationOut])
def list_notifications(
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="限制条数必须在 1 到 100 之间。"
        )

    query = db.query(models.Notification).filter(models.Notification.recipient_id == current_user.id)
    if unread_only:
        query = query.filter(models.Notification.is_read == False)
    notifications = query.order_by(desc(models.Notification.created_at)).offset(skip).limit(limit).all()

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

    return out


@router.post("/read-all")
def read_all_notifications(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db.query(models.Notification).filter(
        models.Notification.recipient_id == current_user.id,
        models.Notification.is_read == False,
    ).update({models.Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "SUCCESS"}


@router.post("/{notification_id}/read")
def read_notification(
    notification_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    if notification.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作该通知")

    notification.is_read = True
    db.commit()
    return {"status": "SUCCESS", "id": notification_id}
