from sqlalchemy.orm import Session

from . import models

NOTIFICATION_RETENTION_MONTHS = 6


def purge_expired_notifications(db: Session) -> int:
    cutoff = models.get_notification_retention_cutoff(NOTIFICATION_RETENTION_MONTHS)
    deleted = (
        db.query(models.Notification)
        .filter(models.Notification.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    return deleted
