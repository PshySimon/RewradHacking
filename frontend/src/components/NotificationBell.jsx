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
    const [currentPage, setCurrentPage] = useState(1);
    const [hasPrevPage, setHasPrevPage] = useState(false);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const popoverRef = useRef(null);
    const timerRef = useRef(null);

    const authHeaders = useMemo(() => getAuthHeaders(), [user]);
    const totalPages = Math.max(1, Math.ceil(totalCount / 10));
    const visiblePages = useMemo(() => {
        if (totalPages <= 3) {
            return Array.from({ length: totalPages }, (_, index) => index + 1);
        }

        if (currentPage <= 2) {
            return [1, 2, 3];
        }

        if (currentPage >= totalPages - 1) {
            return [totalPages - 2, totalPages - 1, totalPages];
        }

        return [currentPage - 1, currentPage, currentPage + 1];
    }, [currentPage, totalPages]);

    const canPoll = () => document.visibilityState === 'visible' && document.hasFocus();

    const fetchNotifications = async (targetPage = 1) => {
        if (!user) return;
        try {
            const res = await axios.get('/api/notifications/', {
                params: {
                    page: targetPage,
                    page_size: 10,
                },
                headers: authHeaders,
            });
            setNotifications(Array.isArray(res.data?.items) ? res.data.items : []);
            setCurrentPage(Number(res.data?.page || targetPage));
            setHasPrevPage(Boolean(res.data?.has_prev));
            setHasNextPage(Boolean(res.data?.has_next));
            setTotalCount(Number(res.data?.total_count || 0));
            setUnreadCount(Number(res.data?.unread_count || 0));
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

        fetchNotifications(currentPage);
        timerRef.current = setInterval(() => {
            if (canPoll()) {
                fetchNotifications(currentPage);
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
    }, [user, authHeaders, currentPage]);

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
            await fetchNotifications(1);
            setLoading(false);
        }
    };

    const markReadAll = async () => {
        try {
            await axios.post('/api/notifications/read-all', null, {
                headers: authHeaders,
            });
            await fetchNotifications(currentPage);
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
        setNotifications((curr) => curr.map((item) => (
            item.id === notification.id ? { ...item, is_read: true } : item
        )));
        setUnreadCount((count) => Math.max(0, count - (notification.is_read ? 0 : 1)));
        navigate(path);
    };

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
                            <div className="zhi-notification-empty">暂无通知</div>
                        ) : notifications.map((item) => (
                            <div
                                className={`zhi-notification-item ${item.is_read ? 'zhi-notification-item--read' : 'zhi-notification-item--unread'}`}
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
                    <div className="zhi-notification-pagination">
                        <button
                            type="button"
                            className="zhi-notification-page-link"
                            onClick={() => fetchNotifications(currentPage - 1)}
                            disabled={!hasPrevPage || loading}
                        >
                            上一页
                        </button>
                        <div className="zhi-notification-page-numbers">
                            {visiblePages.map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    className={`zhi-notification-page-number ${page === currentPage ? 'is-active' : ''}`.trim()}
                                    onClick={() => fetchNotifications(page)}
                                    disabled={page === currentPage || loading}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="zhi-notification-page-link"
                            onClick={() => fetchNotifications(currentPage + 1)}
                            disabled={!hasNextPage || loading}
                        >
                            下一页
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
