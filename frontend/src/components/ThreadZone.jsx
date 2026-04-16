import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { debugVditorMath, normalizeVditorMarkdown, shouldDebugVditorMath } from '../utils/vditorMarkdown';
import { buildVditorRenderOptions } from '../utils/vditorOptions';
import {
    buildCommentEditorOptions,
    positionCommentToolbarPanel,
    shouldRepositionCommentToolbarPanel,
} from '../utils/commentEditorOptions';
const Vditor = window.Vditor;

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// 局部的评论区阅读引擎（轻量化：用 md2html 纯转换代替重型 preview）
const CommentPreview = ({ content }) => {
    const [html, setHtml] = React.useState('');
    React.useEffect(() => {
        if (content && window.Vditor) {
            const normalizedContent = normalizeVditorMarkdown(content);
            if (shouldDebugVditorMath(content) || shouldDebugVditorMath(normalizedContent)) {
                debugVditorMath('comment-preview:before-render', {
                    rawContent: content,
                    normalizedContent,
                });
            }
            // md2html 通常返回 Promise 且需要基础 options 以定位依赖库，这里指向我们已经部署的 local cdn
            Promise.resolve(window.Vditor.md2html(normalizedContent, buildVditorRenderOptions()))
                .then(res => {
                    if (shouldDebugVditorMath(normalizedContent)) {
                        debugVditorMath('comment-preview:after-render', {
                            normalizedContent,
                            renderedHtml: res,
                        });
                    }
                    setHtml(res);
                })
                .catch(err => console.error("md2html failed:", err));
        }
    }, [content]);
    return <div className="vditor-reset" style={{ background: 'transparent', padding: '0', fontSize: '14px', color: '#333' }} dangerouslySetInnerHTML={{ __html: html }} />;
};

// 局部的评论区富文本输入引擎
const EmbeddedCommentEditor = ({ onInstanceReady }) => {
    React.useEffect(() => {
        const logEmojiPanelState = (root, label) => {
            if (!root || typeof window === 'undefined') {
                return;
            }

            const describe = (node) => {
                if (!(node instanceof HTMLElement)) {
                    return null;
                }
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return {
                    tag: node.tagName,
                    className: node.className || '',
                    id: node.id || '',
                    display: style.display,
                    position: style.position,
                    zIndex: style.zIndex,
                    top: style.top,
                    right: style.right,
                    bottom: style.bottom,
                    left: style.left,
                    overflow: `${style.overflow}/${style.overflowX}/${style.overflowY}`,
                    rect: {
                        top: Math.round(rect.top),
                        left: Math.round(rect.left),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        right: Math.round(rect.right),
                        bottom: Math.round(rect.bottom),
                    },
                };
            };

            const toolbar = root.querySelector('.vditor-toolbar');
            const item = root.querySelector('.vditor-toolbar__item');
            const panel = root.querySelector('.vditor-panel');
            const emojis = root.querySelector('.vditor-emojis');
            const content = root.querySelector('.vditor-content');
            const editor = root.querySelector('.vditor-ir');

            const hitAt = (x, y) => document.elementsFromPoint(x, y).slice(0, 6).map((node) => (
                node instanceof HTMLElement
                    ? {
                        tag: node.tagName,
                        className: node.className || '',
                        id: node.id || '',
                    }
                    : null
            )).filter(Boolean);

            let hitTop = [];
            let hitMid = [];
            let hitBottom = [];
            if (panel instanceof HTMLElement) {
                const rect = panel.getBoundingClientRect();
                const x = Math.max(0, Math.round(rect.left + Math.min(40, rect.width / 2)));
                hitTop = hitAt(x, Math.max(0, Math.round(rect.top + 4)));
                hitMid = hitAt(x, Math.max(0, Math.round(rect.top + rect.height / 2)));
                hitBottom = hitAt(x, Math.max(0, Math.round(rect.bottom - 4)));
            }

            console.debug('[CommentEmojiDebug]', {
                label,
                root: describe(root),
                toolbar: describe(toolbar),
                toolbarItem: describe(item),
                content: describe(content),
                editor: describe(editor),
                panel: describe(panel),
                emojis: describe(emojis),
                hitTop,
                hitMid,
                hitBottom,
            });
        };

        const vditor = new Vditor('embedded-comment-editor', buildCommentEditorOptions({
            after: () => {
                const root = document.getElementById('embedded-comment-editor');
                if (root) {
                    const observer = new MutationObserver(() => {
                        const panel = root.querySelector('.vditor-panel');
                        if (!(panel instanceof HTMLElement)) {
                            return;
                        }
                        if (!shouldRepositionCommentToolbarPanel(root, panel)) {
                            return;
                        }
                        window.requestAnimationFrame(() => {
                            positionCommentToolbarPanel(panel);
                            logEmojiPanelState(root, 'emoji-panel-visible');
                        });
                    });
                    observer.observe(root, {
                        attributes: true,
                        childList: true,
                        subtree: true,
                        attributeFilter: ['style', 'class'],
                    });
                    root.__commentEmojiDebugObserver = observer;
                }
                onInstanceReady(vditor);
            },
        }));
        return () => {
            const root = document.getElementById('embedded-comment-editor');
            if (root?.__commentEmojiDebugObserver) {
                root.__commentEmojiDebugObserver.disconnect();
                delete root.__commentEmojiDebugObserver;
            }
            try { vditor.destroy(); } catch (e) {}
        };
    }, []);
    return <div id="embedded-comment-editor" style={{ width: '100%', minHeight: '120px', marginBottom: '4px', border: '1px solid #D2D2D7', borderRadius: '12px', background: '#FAFAFC' }}></div>;
};

// CommentNode - 单体评论节点
const CommentNode = ({ c, isChild, articleAuthorId, handleLike, setReplyingToId, replyingToId, handleCreateComment, setCommentVditor, focusCommentId }) => {
    const isAuthor = articleAuthorId === c.author_id;
    const isAdmin = c.author_role === 'admin';
    const showEditor = replyingToId === c.id;
    const isFocus = focusCommentId === c.id;

    return (
        <div
            id={`comment-${c.id}`}
            className={`mac-comment-item ${isFocus ? 'mac-comment-item--focus' : ''}`}
            style={{ marginBottom: isChild ? '8px' : '16px' }}
        >
            <div className="mac-comment-avatar">{c.author_avatar || (c.author_nickname || c.author_username || 'U')[0].toUpperCase()}</div>
            <div className="mac-comment-body" style={{ flexGrow: 1, background: isChild ? '#FFFFFF' : '#FAFAFC', padding: '12px 14px', borderRadius: '0 16px 16px 16px', boxShadow: isChild ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>
                <div className="mac-comment-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: '#1D1D1F' }}>{c.author_nickname || c.author_username}</strong>
                        {c.replyTarget && (
                            <span style={{ fontSize: '12px', color: '#86868B', marginLeft: '6px' }}>
                                回复 <span style={{ color: '#0071E3', fontWeight: 500 }}>@{c.replyTarget}</span>
                            </span>
                        )}
                        {isAdmin && <span className="mac-tag-pill" style={{ background: '#1D1D1F', color: '#FFFFFF', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #1D1D1F', fontWeight: 600 }}>管理员</span>}
                        {isAuthor && <span className="mac-tag-pill" style={{ background: '#FFFFFF', color: '#1D1D1F', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #D2D2D7', fontWeight: 600 }}>楼主</span>}
                    </div>
                    <span className="mac-comment-time" style={{ fontSize: '12px', color: '#86868B' }}>{c.created_at}</span>
                </div>
                <div className="mac-comment-text" style={{ padding: '8px 0', overflowX: 'auto' }}>
                    <CommentPreview content={c.content} />
                </div>
                <div className="mac-comment-actions" style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: '#86868B' }}>
                    <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: c.is_liked ? '#FF3B30' : '#86868B' }} onClick={() => handleLike(c.id, c.is_liked)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={c.is_liked ? '#FF3B30' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        {c.likes_count > 0 ? c.likes_count : '赞'}
                    </span>
                    <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setReplyingToId(c.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        回复
                    </span>
                </div>
                {/* 跃迁式的编辑器 */}
                {showEditor && (
                    <div className="mac-comment-trigger" style={{ marginTop: '16px', alignItems: 'stretch' }}>
                        <EmbeddedCommentEditor onInstanceReady={setCommentVditor} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
                            <button className="mac-cancel-btn" style={{ padding: '8px 16px', borderRadius: '8px', color: '#86868B', fontSize: '14px', background: 'transparent', cursor: 'pointer', border: '1px solid #D2D2D7' }} onClick={() => setReplyingToId(null)}>取消</button>
                            <button className="mac-comment-submit" onClick={() => handleCreateComment(isChild ? c.parent_id : c.id)}>回复</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// CommentThread - 带有树状计算的一条讨论线
const CommentThread = ({ thread, articleAuthorId, handleLike, setReplyingToId, replyingToId, handleCreateComment, setCommentVditor, shouldExpand, focusCommentId }) => {
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (shouldExpand) {
            setExpanded(true);
        }
    }, [shouldExpand]);

    const displayedChildren = expanded ? thread.children : thread.children.slice(0, 2);

    return (
        <div className="mac-comment-thread-container" style={{ marginBottom: '20px' }}>
            <CommentNode 
                c={thread} 
                isChild={false} 
                articleAuthorId={articleAuthorId} 
                handleLike={handleLike} 
                setReplyingToId={setReplyingToId} 
                replyingToId={replyingToId} 
                handleCreateComment={handleCreateComment}
                setCommentVditor={setCommentVditor}
                focusCommentId={focusCommentId}
            />
            {thread.children.length > 0 && (
                <div className="mac-comment-children-zone" style={{ marginLeft: '48px', padding: '12px 14px', borderRadius: '12px', background: '#F9F9FB', border: '1px solid rgba(0,0,0,0.03)' }}>
                    {displayedChildren.map(child => (
                        <CommentNode 
                            key={child.id} 
                            c={child} 
                            isChild={true} 
                            articleAuthorId={articleAuthorId} 
                            handleLike={handleLike} 
                            setReplyingToId={setReplyingToId} 
                            replyingToId={replyingToId} 
                            handleCreateComment={handleCreateComment}
                            setCommentVditor={setCommentVditor}
                            focusCommentId={focusCommentId}
                        />
                    ))}
                    {thread.children.length > 2 && !expanded && (
                        <div 
                            style={{ padding: '8px', cursor: 'pointer', color: '#0071E3', fontSize: '13px', fontWeight: '500', display: 'inline-block' }}
                            onClick={() => setExpanded(true)}
                        >
                            展开剩余 {thread.children.length - 2} 条回复 ↓
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function ThreadZone({ articleId, articleAuthorId, onCommentAdded, focusCommentId, onFocusCommentConsumed = () => {} }) {
    const [comments, setComments] = useState([]);
    const [replyingToId, setReplyingToId] = useState(null);
    const [commentVditor, setCommentVditor] = useState(null);
    const [localFocusCommentId, setLocalFocusCommentId] = useState('');
    const scrollTimerRef = useRef(null);
    const effectiveFocusCommentId = localFocusCommentId || focusCommentId;

    // 进行防抖以确保当评论完全拉取后再执行映射
    useEffect(() => {
        if (!articleId) return;
        const fetchComments = async () => {
            try {
                const res = await axios.get(`/api/articles/${articleId}/comments`);
                setComments(res.data);
            } catch (error) {
                console.error("加载评论集群故障", error);
            }
        };
        fetchComments();
    }, [articleId]);

    useEffect(() => {
        if (!effectiveFocusCommentId || comments.length === 0) {
            return;
        }

        let tries = 0;
        const maxTries = 10;

        const tryScroll = () => {
            const targetNode = document.getElementById(`comment-${effectiveFocusCommentId}`);
            if (targetNode) {
                targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (effectiveFocusCommentId === focusCommentId) {
                    onFocusCommentConsumed(focusCommentId);
                } else {
                    setLocalFocusCommentId('');
                }
                return;
            }

            tries += 1;
            if (tries < maxTries) {
                scrollTimerRef.current = setTimeout(tryScroll, 180);
            }
        };

        tryScroll();

        return () => {
            if (scrollTimerRef.current) {
                clearTimeout(scrollTimerRef.current);
            }
        };
    }, [effectiveFocusCommentId, focusCommentId, comments, onFocusCommentConsumed]);

    const threads = useMemo(() => {
        const map = {};
        const cdict = {};
        comments.forEach(c => cdict[c.id] = c);

        comments.forEach(c => {
            if (!c.parent_id) map[c.id] = { ...c, children: [] };
        });
        
        comments.forEach(c => {
            if (c.parent_id) {
                const target = cdict[c.parent_id];
                const enrichedNode = { ...c, replyTarget: target ? (target.author_nickname || target.author_username) : null };
                
                let current = target;
                while (current && current.parent_id) {
                    current = cdict[current.parent_id];
                }
                
                if (current && map[current.id]) {
                    map[current.id].children.push(enrichedNode);
                }
            }
        });
        return Object.values(map).map(thread => {
            thread.children.sort((a, b) => b.likes_count - a.likes_count);
            thread.shouldExpand = Boolean(
                    effectiveFocusCommentId && (
                        thread.id === effectiveFocusCommentId
                        || thread.children.some(child => child.id === effectiveFocusCommentId)
                    )
                );
                return thread;
            });
    }, [comments, effectiveFocusCommentId]);

    const handleLikeComment = async (commentId, isLiked) => {
        try {
            setComments(comments.map(c => c.id === commentId ? { 
                ...c, 
                likes_count: isLiked ? Math.max(0, c.likes_count - 1) : c.likes_count + 1,
                is_liked: !isLiked
            } : c));
            await axios.post(
                `/api/articles/${articleId}/comments/${commentId}/like`,
                null,
                { headers: getAuthHeaders() }
            );
        } catch (error) {
            if (error.response?.status === 401) {
                alert('请先登录后点赞');
            }
            console.error("点赞抛网失败", error);
        }
    };

    const handleCreateComment = async (parentId = null) => {
        if (!commentVditor) return;
        const value = commentVditor.getValue();
        if (!value.trim()) return;
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                alert('请先登录后发表评论。');
                return;
            }
                const res = await axios.post(`/api/articles/${articleId}/comments`, {
                    content: value,
                    article_id: articleId,
                    parent_id: parentId
                }, { headers });
                setComments([...comments, res.data]);
                setLocalFocusCommentId(res.data.id);
                commentVditor.setValue('');
                setReplyingToId(null);
            if (!parentId && onCommentAdded) {
                onCommentAdded();
            }
        } catch (error) {
            if (error.response?.status === 401) {
                alert('登录态无效，请重新登录后再发表评论。');
                return;
            }
            console.error("发表评论被拦截", error);
        }
    };

    return (
        <div className="mac-comments-zone" style={{ animation: 'mac-tag-fade-in 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>评论 ({threads.length})</h3>
                {replyingToId && (
                    <button className="mac-cancel-btn" style={{ padding: '6px 12px', borderRadius: '8px', color: '#0071E3', fontSize: '13px', background: '#E8F2FC', cursor: 'pointer', border: 'none' }} onClick={() => setReplyingToId(null)}>
                        取消回复
                    </button>
                )}
            </div>
            
            {!replyingToId && (
                <div className="mac-comment-trigger" style={{ alignItems: 'stretch' }}>
                    <EmbeddedCommentEditor onInstanceReady={setCommentVditor} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                        <button className="mac-comment-submit" onClick={() => handleCreateComment(null)}>评论</button>
                    </div>
                </div>
            )}
            
            <div className="mac-comments-stream">
                {threads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#86868B', fontSize: '14px' }}>暂无评论。</div>
                ) : (
                    threads.map(thread => (
                        <CommentThread 
                            key={thread.id} 
                            thread={thread} 
                            articleAuthorId={articleAuthorId}
                            handleLike={handleLikeComment}
                            setReplyingToId={setReplyingToId}
                            replyingToId={replyingToId}
                            handleCreateComment={handleCreateComment}
                            setCommentVditor={setCommentVditor}
                            shouldExpand={Boolean(thread.shouldExpand)}
                                focusCommentId={effectiveFocusCommentId}
                            />
                    ))
                )}
            </div>
        </div>
    );
}
