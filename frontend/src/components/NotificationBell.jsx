import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const getDisplayName = (notification) =>
    notification.actor_nickname || notification.actor_username || '用户';

const formatNotificationText = (notification) => {
    const actor = getDisplayName(notification);
    if (notification.event_type === 'comment_reply') {
        return `${actor} 回复了你的评论`;
    }

    if (notification.event_type === 'article_comment') {
        return `${actor} 评论了你的文章`;
    }

    if (notification.event_type === 'annotation') {
        const match = (notification.snippet || '').match(/第\\s*(\\d+)\\s*行/);
        if (match && match[1]) {
            return `${actor} 在第 ${match[1]} 行批注了你的文章`;
        }

        return `${actor} 发表了新的批注`;
    }

    if (notification.event_type === 'annotation_reply') {
        return `${actor} 回复了你的批注`;
    }

    return `${actor} 发表了新的评论`;
};

export default function NotificationBell({ user }) {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const popoverRef = useRef(null);
    const timerRef = useRef(null);

    const authHeaders = useMemo(() => getAuthHeaders(), [user]);

    const canPoll = () => document.visibilityState === 'visible' && document.hasFocus();

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const res = await axios.get('/api/notifications/', {
                params: {
                    unread_only: true,
                    limit: 20,
                },
                headers: authHeaders,
            });
            setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('拉取通知失败', error);
        }
    };

    const stopPolling = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startPolling = () => {
        stopPolling();
        if (!canPoll() || !user) {
            return;
        }

        fetchNotifications();
        timerRef.current = setInterval(() => {
            if (canPoll()) {
                fetchNotifications();
            }
        }, 3000);
    };

    useEffect(() => {
        if (!user) {
            stopPolling();
            setNotifications([]);
            return;
        }

        const handleActiveChange = () => {
            if (canPoll()) {
                startPolling();
            } else {
                stopPolling();
            }
        };

        handleActiveChange();
        document.addEventListener('visibilitychange', handleActiveChange);
        window.addEventListener('focus', handleActiveChange);
        window.addEventListener('blur', handleActiveChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleActiveChange);
            window.removeEventListener('focus', handleActiveChange);
            window.removeEventListener('blur', handleActiveChange);
        };
    }, [user, authHeaders]);

    useEffect(() => {
        const closeWhenClickOutside = (event) => {
            if (!popoverRef.current || popoverRef.current.contains(event.target)) {
                return;
            }
            setIsOpen(false);
        };

        if (!isOpen) {
            return;
        }

        document.addEventListener('mousedown', closeWhenClickOutside);
        return () => document.removeEventListener('mousedown', closeWhenClickOutside);
    }, [isOpen]);

    const handleOpen = async () => {
        setIsOpen(prev => !prev);
        if (!isOpen) {
            setLoading(true);
            await fetchNotifications();
            setLoading(false);
        }
    };

    const markReadAll = async () => {
        try {
            await axios.post('/api/notifications/read-all', null, {
                headers: authHeaders,
            });
            setNotifications([]);
        } catch (error) {
            console.error('标记全部已读失败', error);
        }
    };

    const handleClickNotification = async (notification) => {
        try {
            await axios.post(`/api/notifications/${notification.id}/read`, null, {
                headers: authHeaders,
            });
        } catch (error) {
            console.error('标记已读失败', error);
        }

        setIsOpen(false);
        const path = notification.target_path || '/';
        setNotifications((curr) => curr.filter(item => item.id !== notification.id));
        navigate(path);
    };

    const unreadCount = notifications.length;

    if (!user) {
        return null;
    }

    return (
        <div className="zhi-notification-wrapper" ref={popoverRef}>
            <button
                type="button"
                className="zhi-notification-btn"
                onClick={handleOpen}
                title="通知"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 ? <span className="zhi-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
            </button>

            {isOpen ? (
                <div className="zhi-notification-popover">
                    <div className="zhi-notification-header">
                        <span>通知</span>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                className="zhi-notification-mark-btn"
                                onClick={markReadAll}
                            >
                                全部已读
                            </button>
                        )}
                    </div>

                    <div className="zhi-notification-list">
                        {loading && !notifications.length ? (
                            <div className="zhi-notification-empty">加载中…</div>
                        ) : notifications.length === 0 ? (
                            <div className="zhi-notification-empty">暂无新提醒</div>
                        ) : notifications.map((item) => (
                            <div
                                className="zhi-notification-item"
                                key={item.id}
                                onClick={() => handleClickNotification(item)}
                            >
                                <div className="zhi-notification-title">{formatNotificationText(item)}</div>
                                <div className="zhi-notification-snippet">{item.article_title || '未知文章'}</div>
                                {item.snippet ? <div className="zhi-notification-snippet">{item.snippet}</div> : null}
                                <div className="zhi-notification-time">{item.created_at}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
