import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import TagPill from '../components/TagPill';
import { macAlert, macConfirm } from '../components/MacModal';
import ThreadZone from '../components/ThreadZone';
import NotificationBell from '../components/NotificationBell';
import AuthModal from '../components/AuthModal';
import { debugVditorMath, normalizeVditorMarkdown, shouldDebugVditorMath } from '../utils/vditorMarkdown';
import { buildVditorRenderOptions } from '../utils/vditorOptions';

const ANNOTATION_EMOJI_BANK = ['💬', '👍', '👏', '🙏', '🔥', '🎯', '🤔', '🚀', '✅', '✨'];

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeAnnotationText = (value) => {
    return (value || '').replace(/\s+/g, ' ').trim();
};

const getLineTextFromNode = (node) => {
    if (!node) {
        return '';
    }
    const text = (node.textContent || '').replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
    return text.replace(/\s+/g, ' ').trim();
};

const stripHeadingMarkup = (nodeText) => {
    if (!nodeText) {
        return '';
    }

    return nodeText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^\s*[#>*_`~]+\s*/, '')
        .trim();
};

// 骨架屏炫光占位层
const ArticleSkeleton = () => (
    <div className="mac-article-glass-card" style={{ padding: '40px' }}>
        <div className="mac-skeleton-title skeleton-pulse"></div>
        <div className="mac-skeleton-meta skeleton-pulse"></div>
        
        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="mac-skeleton-text skeleton-pulse" style={{ width: '100%' }}></div>
            <div className="mac-skeleton-text skeleton-pulse" style={{ width: '90%' }}></div>
            <div className="mac-skeleton-text skeleton-pulse" style={{ width: '95%' }}></div>
            <div className="mac-skeleton-text skeleton-pulse" style={{ width: '70%' }}></div>
        </div>
        
        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="mac-skeleton-text skeleton-pulse" style={{ width: '100%' }}></div>
            <div className="mac-skeleton-text skeleton-pulse" style={{ width: '85%' }}></div>
            <div className="mac-skeleton-text skeleton-pulse" style={{ width: '40%' }}></div>
        </div>

        <div style={{ marginTop: '60px' }}>
            <div className="mac-skeleton-title skeleton-pulse" style={{ width: '120px', height: '24px', marginBottom: '24px' }}></div>
            <div className="skeleton-pulse" style={{ width: '100%', height: '160px', borderRadius: '12px' }}></div>
        </div>
    </div>
);

export default function ArticleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [article, setArticle] = useState(null);
    const [user, setUser] = useState(null);
    
    // 渲染系统相关状态
    const [outline, setOutline] = useState([]);
    const [isOutlineVisible, setIsOutlineVisible] = useState(true);
    const [isMainContentReady, setIsMainContentReady] = useState(false);
    const [focusCommentId, setFocusCommentId] = useState('');
    const [focusAnnotationId, setFocusAnnotationId] = useState('');
    const [annotations, setAnnotations] = useState([]);
    const [activeComposeLine, setActiveComposeLine] = useState(null);
    const [activeComposeText, setActiveComposeText] = useState('');
    const [composerPos, setComposerPos] = useState({ x: 0, y: 0, lineIndex: null, lineText: '', popupWidth: 320, popupHeight: 360 });
    const annotationComposerRef = useRef(null);
    const annotationTextAreaRef = useRef(null);
    const articlePreviewRef = useRef(null);
    
    // 登录弹窗
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authModalTab, setAuthModalTab] = useState('login');
    
    const fetchMe = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) { setUser(null); return; }
        try {
            const res = await axios.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.data.is_profile_completed) {
                navigate('/onboarding');
                return;
            }
            setUser(res.data);
        } catch (error) {
            console.error('加载用户信息失败：', error);
            localStorage.removeItem('access_token');
            setUser(null);
        }
    };

    const fetchArticleDetail = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`/api/articles/${id}`, { headers });
            document.title = `${res.data.title} - RewardHacking`;
            setArticle(res.data);
            if (res.data.is_restricted) {
                setOutline([]);
            }
        } catch (error) {
            console.error("加载文章失败：", error);
            if (error.response?.status === 404) navigate('/');
        }
    };

    const clampComposerPosition = ({ x: pointerX, y: pointerY }) => {
        const margin = 12;
        const popupWidth = Math.min(360, Math.max(260, window.innerWidth - 24));
        const maxAvailableHeight = window.innerHeight - margin * 2;
        const preferredHeight = Math.min(360, maxAvailableHeight);
        const contentBottomSpace = window.innerHeight - margin - pointerY;
        const popupHeight = Math.max(220, Math.min(preferredHeight, contentBottomSpace));

        let x = pointerX + 10;
        if (x + popupWidth > window.innerWidth - margin) {
            x = pointerX - popupWidth - 10;
        }
        if (x < margin) {
            x = margin;
        }

        let y = pointerY - 12;
        if (y + popupHeight > window.innerHeight - margin) {
            y = window.innerHeight - popupHeight - margin;
        }
        if (y < margin) {
            y = margin;
        }

        return {
            x: Math.floor(x),
            y: Math.floor(y),
            popupWidth,
            popupHeight: Math.floor(popupHeight),
        };
    };

    const fetchAnnotations = async () => {
        if (!article || article.is_restricted) {
            setAnnotations([]);
            return;
        }

        try {
            const res = await axios.get(`/api/articles/${id}/annotations`);
            const list = Array.isArray(res.data) ? res.data : [];
            const normalized = list
                .filter((item) => item && item.id)
                .map((item) => ({
                    ...item,
                    line_text: normalizeAnnotationText(item.line_text || ''),
                    content: normalizeAnnotationText(item.content || ''),
                }))
                .sort((a, b) => {
                    if (a.line_index !== b.line_index) {
                        return Number(a.line_index || 0) - Number(b.line_index || 0);
                    }
                    return (a.created_at || '').localeCompare(b.created_at || '');
                });
            setAnnotations(normalized);
        } catch (error) {
            console.error('加载批注失败：', error);
            setAnnotations([]);
        }
    };

    const buildLineAnnotationAnchors = () => {
        const root = articlePreviewRef.current;
        if (!root) {
            return;
        }

        const annotationLineMap = {};
        annotations.forEach((annotation) => {
            if (!annotation || annotation.line_index < 1) {
                return;
            }

            if (!annotationLineMap[annotation.line_index]) {
                annotationLineMap[annotation.line_index] = 0;
            }
            annotationLineMap[annotation.line_index] += 1;
        });

        const blocks = Array.from(root.children);
        let lineIndex = 0;
        const seen = new Set();
        const seenButtons = new Set();

        blocks.forEach((block) => {
            if (!(block instanceof HTMLElement)) {
                return;
            }

            const text = getLineTextFromNode(block);
            if (!text) {
                block.removeAttribute('data-annotation-line');
                block.classList.remove('mac-line-annotated');
                block.style.position = '';
                block.style.paddingRight = '';
                return;
            }

            lineIndex += 1;
            block.dataset.annotationLine = String(lineIndex);
            block.style.position = block.style.position || 'relative';
            block.style.paddingRight = '44px';
            block.classList.add('mac-line-annotated');

            let marker = block.querySelector(':scope > .mac-line-annotation-btn');
            if (!marker) {
                marker = document.createElement('button');
                marker.type = 'button';
                marker.className = 'mac-line-annotation-btn';
                marker.setAttribute('aria-label', '添加批注');
                block.appendChild(marker);
            }

            const normalizedText = text.slice(0, 180);
            marker.dataset.annotationLine = String(lineIndex);
            marker.dataset.annotationText = normalizedText;
            marker.textContent = '';
            marker.title = `第 ${lineIndex} 行添加批注`;
            marker.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();

                const pointer = {
                    x: event.clientX,
                    y: event.clientY,
                };
                const { x, y, popupWidth, popupHeight } = clampComposerPosition(pointer);
                setComposerPos({
                    x,
                    y,
                    lineIndex,
                    lineText: normalizedText,
                    popupWidth,
                    popupHeight,
                });
                setActiveComposeLine(lineIndex);
            };

            seen.add(block);
            seenButtons.add(marker);
        });

        Array.from(root.querySelectorAll('.mac-line-annotation-btn')).forEach((node) => {
            const parent = node.parentElement;
            if (!parent || !seen.has(parent) || !seenButtons.has(node)) {
                node.remove();
            }
        });
    };

    const buildOutlineFromRenderedPreview = () => {
        const root = document.getElementById('mac-vditor-preview');
        if (!root) {
            setOutline([]);
            return;
        }

        const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const seen = new Set();
        const out = [];

        headings.forEach((heading, index) => {
            const title = cleanupOutlineTitle(heading);
            if (!title) {
                return;
            }

            let headingId = `heading-${index}`;
            let suffix = 1;
            while (seen.has(headingId)) {
                headingId = `heading-${index}-${suffix}`;
                suffix += 1;
            }
            seen.add(headingId);
            heading.id = headingId;

            out.push({
                level: Number(heading.tagName[1]),
                title,
                id: headingId,
            });
        });

        setOutline(out);
    };

    const cleanupOutlineTitle = (value) => {
        const heading = value;
        if (!heading || !heading.textContent) {
            return '';
        }

        const titleNode = heading.cloneNode(true);
        titleNode.querySelectorAll('.vditor-ir__marker').forEach((marker) => marker.remove());
        let title = (titleNode.textContent || '').trim();
        title = title.replace(/\u00A0/g, ' ');
        title = title.replace(/&nbsp;/g, ' ');
        title = title.replace(/[\u200B-\u200D\uFEFF]/g, '');
        title = title.replace(/\s{2,}/g, ' ');
        return stripHeadingMarkup(title.trim());
    };

    const closeAnnotationComposer = () => {
        setActiveComposeLine(null);
        setActiveComposeText('');
        setComposerPos({ x: 0, y: 0, lineIndex: null, lineText: '', popupWidth: 320, popupHeight: 360 });
    };

    const handleCreateAnnotation = async () => {
        const plainContent = normalizeAnnotationText(activeComposeText);
        if (!plainContent || !composerPos.lineIndex) {
            return;
        }

        const headers = getAuthHeaders();
        if (!headers.Authorization) {
            setShowAuthModal(true);
            setAuthModalTab('login');
            return;
        }

        try {
            const res = await axios.post(
                `/api/articles/${id}/annotations`,
                {
                    content: plainContent,
                    line_index: composerPos.lineIndex,
                    line_text: composerPos.lineText,
                },
                { headers }
            );

            const next = normalizeAnnotationText(res.data?.content || plainContent);
            setAnnotations((prev) => [...prev, { ...res.data, content: next }].sort((a, b) => {
                if (a.line_index !== b.line_index) {
                    return Number(a.line_index || 0) - Number(b.line_index || 0);
                }
                return (a.created_at || '').localeCompare(b.created_at || '');
            }));

            closeAnnotationComposer();
            setTimeout(() => {
                setFocusAnnotationId(res.data?.id || '');
                window.location.hash = `#annotation-${res.data?.id || ''}`;
            }, 0);
            buildLineAnnotationAnchors();
        } catch (error) {
            console.error('提交批注失败：', error);
            macAlert(error.response?.data?.detail || '提交失败，请稍后再试。', '批注失败');
        }
    };

    const addAnnotationEmoji = (emoji) => {
        const textarea = annotationTextAreaRef.current;
        if (!textarea) {
            setActiveComposeText((curr) => `${curr}${emoji}`);
            return;
        }

        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const next = `${activeComposeText.slice(0, start)}${emoji}${activeComposeText.slice(end)}`;
        setActiveComposeText(next);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        });
    };

    const scrollToAnchor = (anchorId) => {
        const target = document.getElementById(anchorId);
        if (!target) {
            return false;
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('mac-annotation-focus');
        setTimeout(() => {
            target.classList.remove('mac-annotation-focus');
        }, 1600);
        return true;
    };

    const focusAnnotationByHash = () => {
        if (!focusAnnotationId) {
            return;
        }

        let tries = 0;
        const maxTries = 16;
        const tryScroll = () => {
            const anchorId = `annotation-${focusAnnotationId}`;
            const ok = scrollToAnchor(anchorId);
            if (ok) {
                return;
            }

            tries += 1;
            if (tries < maxTries) {
                setTimeout(tryScroll, 200);
            }
        };

        tryScroll();
    };

    useEffect(() => {
        const hash = (location.hash || '').trim();
        const commentMatch = hash.match(/^#comment-([\w-]+)$/);
        if (commentMatch && commentMatch[1]) {
            setFocusCommentId(commentMatch[1]);
            setFocusAnnotationId('');
            return;
        }

        const annotationMatch = hash.match(/^#annotation-([\w-]+)$/);
        if (annotationMatch && annotationMatch[1]) {
            setFocusCommentId('');
            setFocusAnnotationId(annotationMatch[1]);
            return;
        }

        setFocusCommentId('');
        setFocusAnnotationId('');
    }, [location.hash]);

    useEffect(() => {
        fetchAnnotations();
    }, [article]);

    useEffect(() => {
        if (activeComposeLine === null || !annotationTextAreaRef.current) {
            return;
        }
        annotationTextAreaRef.current.focus();
    }, [activeComposeLine]);

    useEffect(() => {
        fetchMe();
        fetchArticleDetail();
    }, [id]);

    // 等待 Article 在 DOM 中解包后再对核心正文区铺设高亮渲染
    useEffect(() => {
        if (article && !article.is_restricted) {
            const normalizedContent = normalizeVditorMarkdown(article.content);
            if (shouldDebugVditorMath(article.content) || shouldDebugVditorMath(normalizedContent)) {
                debugVditorMath('article-preview:before-render', {
                    articleId: String(id),
                    rawContent: article.content,
                    normalizedContent,
                });
            }

            Vditor.preview(document.getElementById('mac-vditor-preview'), normalizedContent, buildVditorRenderOptions({
                mode: 'light',
                theme: { current: 'light' },
                hljs: { style: 'github' }
            })).then(() => {
                const renderedElement = document.getElementById('mac-vditor-preview');
                if (shouldDebugVditorMath(normalizedContent)) {
                    debugVditorMath('article-preview:after-render', {
                        articleId: String(id),
                        renderedHtml: renderedElement?.innerHTML || '',
                    });
                }
                buildOutlineFromRenderedPreview();
                buildLineAnnotationAnchors();
                focusAnnotationByHash();
                setIsMainContentReady(true);
            }).catch(e => {
                console.error("正文Vditor底层解析故障", e);
                setOutline([]);
                buildLineAnnotationAnchors();
                setIsMainContentReady(true);
            });
            return;
        }

        setIsMainContentReady(false);
        setOutline([]);
    }, [article]);

    useEffect(() => {
        if (!isMainContentReady || !articlePreviewRef.current || article?.is_restricted) {
            return;
        }
        buildLineAnnotationAnchors();
    }, [annotations, isMainContentReady]);

    useEffect(() => {
        if (!focusAnnotationId) {
            return;
        }
        focusAnnotationByHash();
    }, [focusAnnotationId, annotations, isMainContentReady]);

    useEffect(() => {
        if (activeComposeLine === null) {
            return;
        }

        const handleClickOutside = (event) => {
            if (!annotationComposerRef.current || annotationComposerRef.current.contains(event.target)) {
                return;
            }
            closeAnnotationComposer();
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeComposeLine]);

    // 锚点平滑降落协议
    const scrollToHeading = (headingId) => {
        const target = document.getElementById(headingId);
        if (!target) {
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // 删除文章操作
    const handleDeleteClick = () => {
        macConfirm("确认删除", "确定要永久删除这篇文章吗？此操作无法恢复。", async () => {
            try {
                await axios.delete(`/api/articles/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
                navigate('/');
            } catch (error) {
                console.error("删除动作失败：", error);
                macAlert(error.response?.data?.detail || "无法删除目标文件，请检查当前操作权限。", "删除失败");
            }
        });
    };

    const handleAuthSuccess = () => {
        setShowAuthModal(false);
        // 重新加载当前页面数据
        fetchMe();
        fetchArticleDetail();
    };

    const openAuth = (tab) => {
        setAuthModalTab(tab);
        setShowAuthModal(true);
    };

    if (!article) return (
        <div className="mac-reading-room">
            <header className="zhi-header"></header>
            <main className="mac-reader-layout">
                <div className="mac-sidebar-container">
                    <aside className="mac-reader-outline" style={{ width: '250px' }}>
                        <div className="skeleton-pulse" style={{ width: '60%', height: '24px', marginBottom: '20px', borderRadius: '4px' }}></div>
                        <div className="skeleton-pulse" style={{ width: '90%', height: '14px', marginBottom: '16px', borderRadius: '4px' }}></div>
                        <div className="skeleton-pulse" style={{ width: '70%', height: '14px', marginBottom: '16px', borderRadius: '4px' }}></div>
                        <div className="skeleton-pulse" style={{ width: '80%', height: '14px', marginBottom: '16px', borderRadius: '4px' }}></div>
                    </aside>
                </div>
                <article className="mac-reader-content">
                    <ArticleSkeleton />
                </article>
            </main>
        </div>
    );

    const tagsArr = article.tags ? article.tags.split(',').filter(Boolean) : [];
    const hasAdminRights = user && (user.role === 'admin' || user.id === article.author_id);
    const showOutline = article && !['interview', 'solution'].includes(article.category);

    return (
        <div className="mac-reading-room">
            <header className="zhi-header">
                <div className="zhi-header-inner">
                    <nav className="zhi-nav">
                        <div className="zhi-logo mac-reading-back" onClick={() => navigate('/')}>
                            ← 首页
                        </div>
                    </nav>
                    <div className="zhi-actions">
                        <NotificationBell user={user} />
                        {hasAdminRights && (
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginRight: '24px' }}>
                                <span 
                                    className="mac-top-icon-btn" 
                                    title="修编本版" 
                                    style={{ cursor: 'pointer', color: '#86868B', display: 'flex', alignItems: 'center' }} 
                                    onClick={() => navigate('/editor?id=' + article.id)}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </span>
                                <span 
                                    className="mac-top-icon-btn mac-danger-btn" 
                                    title="删除该文章" 
                                    style={{ cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }} 
                                    onClick={handleDeleteClick}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </span>
                            </div>
                        )}
                        {user ? (
                            <div className="zhi-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%', background: '#0071E3', 
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold'
                                }}>
                                    {user?.avatar || (user?.nickname || user?.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <span style={{fontWeight: 600, fontSize: '14px', color: '#1D1D1F'}}>{user?.nickname || user?.username}</span>
                                <span className="zhi-logout" onClick={() => { localStorage.clear(); setUser(null); fetchArticleDetail(); }}>退出登录</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button onClick={() => openAuth('login')} style={{ padding: '8px 20px', borderRadius: '20px', border: '1px solid #0071E3', background: 'transparent', color: '#0071E3', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>登录</button>
                                <button onClick={() => openAuth('register')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', background: '#0071E3', color: '#FFFFFF', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0, 113, 227, 0.2)', transition: 'all 0.2s' }}>注册</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="mac-reader-layout">
                {showOutline && (
                <div className="mac-sidebar-container">
                    <div className="mac-outline-toggler" onClick={() => setIsOutlineVisible(!isOutlineVisible)} title={isOutlineVisible ? '收起导视' : '唤起导视'}>
                        {isOutlineVisible ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
                        )}
                    </div>
                    <aside 
                        className="mac-reader-outline" 
                        style={{ 
                            width: isOutlineVisible ? '250px' : '0px', 
                            opacity: isOutlineVisible ? 1 : 0, 
                            visibility: isOutlineVisible ? 'visible' : 'hidden', 
                            transform: isOutlineVisible ? 'translateX(0)' : 'translateX(-10px)'
                        }}
                    >
                        <h4>大纲</h4>
                        {outline.length > 0 ? (
                            <ul className="mac-outline-list">
                                {outline.map((item, idx) => (
                                    <li 
                                        key={idx} 
                                        style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                                        onClick={() => scrollToHeading(item.id)}
                                    >
                                        {item.title}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mac-outline-empty">-</p>
                        )}
                    </aside>
                </div>
                )}

                <article className="mac-reader-content" style={!showOutline ? { margin: '0 auto', maxWidth: '800px', width: '100%' } : {}}>
                    <div className="mac-article-glass-card">
                        <h1 className="mac-article-title">{article.title}</h1>
                        <div className="mac-article-meta-ribbon">
                            <div className="mac-article-meta-left">
                                {article.category === 'code' && <span className="category-meta">代码</span>}
                                {tagsArr.length > 0 && tagsArr.map((t, idx) => <TagPill key={idx} text={t} />)}
                            </div>
                            <div className="mac-article-meta-right">
                                {article.created_at && <span style={{ fontSize: '13px', color: '#86868B', marginRight: '12px', fontWeight: 500 }}>{article.created_at}</span>}
                                <div className="mac-interaction-item" style={{cursor: 'default'}}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    <span>{article.views_count} 浏览</span>
                                </div>
                                <div className="mac-interaction-item" style={{cursor: 'default'}}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                    <span>{article.comments_count} 讨论</span>
                                </div>
                            </div>
                        </div>

                        {/* 正文区域：根据 is_restricted 决定显示完整内容还是遮罩 */}
                        {article.is_restricted ? (
                            <div className="rh-restricted-zone">
                                <div className="rh-restricted-card" style={{ margin: '60px auto' }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                    <h3>当前内容需要登录后查看</h3>
                                    <p>作者已将本文设置为登录可见，请先登录或注册后继续阅读。</p>
                                    <div className="rh-restricted-actions">
                                        <button className="rh-btn-login" onClick={() => openAuth('login')}>登录</button>
                                        <button className="rh-btn-register" onClick={() => openAuth('register')}>注册</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                id="mac-vditor-preview"
                                ref={articlePreviewRef}
                                className="mac-markdown-stream"
                                style={{ position: 'relative' }}
                            ></div>
                        )}

                        {activeComposeLine !== null && (
                            <div
                                ref={annotationComposerRef}
                                className="mac-annotation-composer"
                                style={{ left: composerPos.x, top: composerPos.y, width: composerPos.popupWidth, maxHeight: composerPos.popupHeight }}
                            >
                                <div className="mac-annotation-composer-title">
                                    <span>第 {composerPos.lineIndex} 行批注</span>
                                    <span>{activeComposeText.length}/1200</span>
                                </div>
                                <div className="mac-annotation-composer-line">{composerPos.lineText}</div>
                                <textarea
                                    ref={annotationTextAreaRef}
                                    className="mac-annotation-textarea"
                                    placeholder="添加批注（仅支持文字+表情）"
                                    value={activeComposeText}
                                    onChange={(event) => setActiveComposeText(normalizeAnnotationText(event.target.value))}
                                    maxLength={1200}
                                />
                                <div className="mac-annotation-emojis" role="list">
                                    {ANNOTATION_EMOJI_BANK.map((emoji) => (
                                        <button
                                            type="button"
                                            key={emoji}
                                            className="mac-annotation-emoji-btn"
                                            onClick={() => addAnnotationEmoji(emoji)}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                                <div className="mac-annotation-composer-actions">
                                    <button
                                        type="button"
                                        className="mac-comment-submit"
                                        onClick={closeAnnotationComposer}
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="button"
                                        className="mac-comment-submit"
                                        onClick={handleCreateAnnotation}
                                        disabled={normalizeAnnotationText(activeComposeText).length === 0 || normalizeAnnotationText(activeComposeText).length > 1200}
                                    >
                                        发布
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mac-annotations-zone">
                        <h3>批注</h3>
                        {annotations.length === 0 ? (
                            <div className="mac-annotation-empty">暂无批注，移动到正文右侧区域点击可发起批注</div>
                        ) : (
                            <div className="mac-annotations-list">
                                {annotations.map((annotation) => (
                                    <div
                                        key={annotation.id}
                                        id={`annotation-${annotation.id}`}
                                        className={`mac-annotation-item ${focusAnnotationId === annotation.id ? 'mac-annotation-item--focus' : ''}`}
                                    >
                                        <div className="mac-annotation-meta">
                                            <span className="mac-annotation-user">
                                                {annotation.author_nickname || annotation.author_username}
                                            </span>
                                            <span>{annotation.created_at}</span>
                                        </div>
                                        <div className="mac-annotation-snippet">
                                            第 {annotation.line_index} 行：{annotation.line_text || ''}
                                        </div>
                                        <div className="mac-annotation-content">{annotation.content}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 评论区：仅在非受限且渲染完成后显示 */}
                    {!article.is_restricted && isMainContentReady && (
                        <ThreadZone 
                            articleId={id} 
                            articleAuthorId={article.author_id} 
                            onCommentAdded={() => setArticle({...article, comments_count: article.comments_count + 1})}
                            focusCommentId={focusCommentId}
                        />
                    )}
                </article>
            </main>

            <AuthModal 
                visible={showAuthModal} 
                onClose={() => setShowAuthModal(false)} 
                onSuccess={handleAuthSuccess}
                initialTab={authModalTab}
            />
        </div>
    );
}
