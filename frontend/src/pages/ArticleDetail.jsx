import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import {
    buildCommentEditorOptions,
    positionCommentToolbarPanel,
    shouldRepositionCommentToolbarPanel,
} from '../utils/commentEditorOptions';
import {
    buildAnnotationPreview,
    buildAnnotationQuotePreview,
    clampAnnotationComposerPosition,
    getAnnotationHotzoneLayout,
} from '../utils/annotationComposer';

const noop = () => {};
const ANNOTATION_HOTZONE_OVERLAY_ID = 'annotation-hotzone-overlay';

const logAnnotationComposerDebug = (label, payload) => {
    const safePayload = { label, ...payload };
    console.debug('[AnnotationComposerDebug]', safePayload);
    try {
        console.debug('[AnnotationComposerDebugJSON]', label, JSON.stringify(safePayload));
    } catch (error) {
        console.debug('[AnnotationComposerDebugJSON]', label, 'serialize-failed', String(error));
    }
};

const logAnnotationReplyDebug = (label, payload) => {
    const safePayload = { label, ...payload };
    console.debug('[AnnotationReplyDebug]', safePayload);
    try {
        console.debug('[AnnotationReplyDebugJSON]', label, JSON.stringify(safePayload));
    } catch (error) {
        console.debug('[AnnotationReplyDebugJSON]', label, 'serialize-failed', String(error));
    }
};

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

const EmbeddedAnnotationEditor = ({
    onInstanceReady = noop,
    onValueChange = noop,
    initialValue = '',
    placeholder = '添加批注（仅支持文字+表情）',
}) => {
    const vditorRef = useRef(null);
    const isAnnotationEditorReadyRef = useRef(false);
    const onInstanceReadyRef = useRef(onInstanceReady);
    const onValueChangeRef = useRef(onValueChange);

    useEffect(() => {
        onInstanceReadyRef.current = onInstanceReady;
    }, [onInstanceReady]);

    useEffect(() => {
        onValueChangeRef.current = onValueChange;
    }, [onValueChange]);

    useEffect(() => {
        const hostId = 'annotation-mini-editor';
        const vditor = new Vditor(hostId, buildCommentEditorOptions({
            toolbar: ['emoji'],
            placeholder,
            input: (value) => onValueChangeRef.current(normalizeAnnotationText(value)),
            after: () => {
                isAnnotationEditorReadyRef.current = true;
                if (initialValue) {
                    vditor.setValue(initialValue);
                }

                const root = document.getElementById(hostId);
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
                        });
                    });
                    observer.observe(root, {
                        attributes: true,
                        childList: true,
                        subtree: true,
                        attributeFilter: ['style', 'class'],
                    });
                    root.__annotationEmojiObserver = observer;
                }

                onInstanceReadyRef.current(vditor);
            },
        }));
        vditorRef.current = vditor;

        return () => {
            const root = document.getElementById(hostId);
            if (root?.__annotationEmojiObserver) {
                root.__annotationEmojiObserver.disconnect();
                delete root.__annotationEmojiObserver;
            }
            isAnnotationEditorReadyRef.current = false;
            onInstanceReadyRef.current(null);
            vditorRef.current = null;
            try { vditor.destroy(); } catch (error) {}
        };
    }, []);

    useEffect(() => {
        const vditor = vditorRef.current;
        if (!vditor || !isAnnotationEditorReadyRef.current || typeof vditor.getValue !== 'function') {
            return;
        }

        const normalizedInitialValue = normalizeAnnotationText(initialValue);
        const normalizedCurrentValue = normalizeAnnotationText(vditor.getValue());
        if (normalizedCurrentValue === normalizedInitialValue) {
            return;
        }

        vditor.setValue(initialValue);
    }, [initialValue]);

    return (
        <div className="mac-comment-trigger mac-annotation-editor-shell" style={{ marginBottom: 0, alignItems: 'stretch' }}>
            <div
                id="annotation-mini-editor"
                style={{ width: '100%', minHeight: '68px', marginBottom: 0, border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', background: '#F8F8FA' }}
            ></div>
        </div>
    );
};

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
    const [annotationReplyOverrides, setAnnotationReplyOverrides] = useState({});
    const [expandedAnnotationRoots, setExpandedAnnotationRoots] = useState({});
    const [activeComposeLine, setActiveComposeLine] = useState(null);
    const [activeComposeText, setActiveComposeText] = useState('');
    const [activeReplyParentId, setActiveReplyParentId] = useState('');
    const [isExplicitReplyTarget, setIsExplicitReplyTarget] = useState(false);
    const [annotationComposerMode, setAnnotationComposerMode] = useState('create');
    const [composerPos, setComposerPos] = useState({ x: 0, y: 0, lineIndex: null, lineText: '', popupWidth: 320, popupHeight: 360 });
    const annotationComposerRef = useRef(null);
    const articlePreviewRef = useRef(null);
    const annotationHotzoneRafRef = useRef(0);
    
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
                .map((item) => {
                    const override = annotationReplyOverrides[item.id] || null;
                    return {
                        ...item,
                        parent_id: item.parent_id || override?.parent_id || null,
                        recipient_id: item.recipient_id || override?.recipient_id || null,
                        recipient_username: item.recipient_username || override?.recipient_username || '',
                        recipient_nickname: item.recipient_nickname || override?.recipient_nickname || null,
                        recipient_avatar: item.recipient_avatar || override?.recipient_avatar || null,
                        line_text: normalizeAnnotationText(item.line_text || ''),
                        content: normalizeAnnotationText(item.content || ''),
                    };
                })
                .sort((a, b) => {
                    if (a.line_index !== b.line_index) {
                        return Number(a.line_index || 0) - Number(b.line_index || 0);
                    }
                    return (a.created_at || '').localeCompare(b.created_at || '');
                });
            logAnnotationReplyDebug('fetch-annotations', {
                count: normalized.length,
                annotations: normalized.map((item) => ({
                    id: item.id,
                    parent_id: item.parent_id || null,
                    recipient_id: item.recipient_id || null,
                    recipient_username: item.recipient_username || '',
                    line_index: item.line_index,
                    content: item.content,
                })),
            });
            setAnnotations(normalized);
        } catch (error) {
            console.error('加载批注失败：', error);
            setAnnotations([]);
        }
    };

    const removeAnnotationHotzoneOverlay = () => {
        if (typeof document === 'undefined') {
            return;
        }
        document.getElementById(ANNOTATION_HOTZONE_OVERLAY_ID)?.remove();
    };

    const buildLineAnnotationAnchors = () => {
        const root = articlePreviewRef.current;
        if (!root) {
            removeAnnotationHotzoneOverlay();
            return;
        }

        let overlay = document.getElementById(ANNOTATION_HOTZONE_OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = ANNOTATION_HOTZONE_OVERLAY_ID;
            overlay.className = 'mac-annotation-hotzone-overlay';
            document.body.appendChild(overlay);
        }

        const annotationLineMap = {};
        const annotationLineBuckets = {};
        annotations.forEach((annotation) => {
            if (!annotation || annotation.line_index < 1) {
                return;
            }

            if (!annotationLineMap[annotation.line_index]) {
                annotationLineMap[annotation.line_index] = 0;
            }
            annotationLineMap[annotation.line_index] += 1;
            if (!annotationLineBuckets[annotation.line_index]) {
                annotationLineBuckets[annotation.line_index] = [];
            }
            annotationLineBuckets[annotation.line_index].push(annotation);
        });

        const blocks = Array.from(root.children);
        let lineIndex = 0;
        const seenButtons = new Set();
        const rootRect = root.getBoundingClientRect();
        blocks.forEach((block) => {
            if (!(block instanceof HTMLElement)) {
                return;
            }

            const text = getLineTextFromNode(block);
            if (!text) {
                block.removeAttribute('data-annotation-line');
                block.classList.remove('mac-line-annotated');
                return;
            }

            lineIndex += 1;
            const currentLineIndex = lineIndex;
            block.dataset.annotationLine = String(currentLineIndex);
            block.classList.add('mac-line-annotated');

            let marker = overlay.querySelector(`.mac-line-annotation-btn[data-annotation-line="${currentLineIndex}"]`);
            if (!marker) {
                marker = document.createElement('button');
                marker.type = 'button';
                marker.className = 'mac-line-annotation-btn';
                marker.setAttribute('aria-label', '添加批注');
                overlay.appendChild(marker);
            }

            const normalizedText = text.slice(0, 180);
            const blockRect = block.getBoundingClientRect();
            const layout = getAnnotationHotzoneLayout({
                rootRect,
                blockRect,
                viewportWidth: window.innerWidth,
            });
            marker.dataset.annotationLine = String(lineIndex);
            marker.dataset.annotationText = normalizedText;
            const rootPreviewAnnotations = (annotationLineBuckets[currentLineIndex] || []).filter((annotation) => !annotation?.parent_id);
            const preview = buildAnnotationPreview(rootPreviewAnnotations);
            marker.classList.toggle('mac-line-annotation-btn--has-preview', Boolean(preview));
            marker.dataset.annotationCount = String(preview?.totalCount || 0);
            marker.style.left = `${Math.floor(rootRect.left + layout.left)}px`;
            marker.style.top = `${Math.floor(blockRect.top)}px`;
            marker.style.width = `${layout.width}px`;
            marker.style.height = `${layout.height}px`;
            marker.dataset.annotationLine = String(currentLineIndex);
            marker.title = preview
                ? `第 ${currentLineIndex} 行，已有 ${preview.totalCount} 条批注`
                : `第 ${currentLineIndex} 行添加批注`;
            marker.setAttribute(
                'aria-label',
                preview
                    ? `第 ${currentLineIndex} 行，已有 ${preview.totalCount} 条批注`
                    : `第 ${currentLineIndex} 行添加批注`,
            );

            let previewNode = marker.querySelector('.mac-line-annotation-preview');
            if (preview) {
                if (!(previewNode instanceof HTMLElement)) {
                    previewNode = document.createElement('span');
                    previewNode.className = 'mac-line-annotation-preview';
                    marker.appendChild(previewNode);
                }

                previewNode.innerHTML = '';
                const textNode = document.createElement('span');
                textNode.className = 'mac-line-annotation-preview-text';
                textNode.textContent = preview.previewText;
                previewNode.appendChild(textNode);

                if (preview.extraCount > 0) {
                    const countNode = document.createElement('span');
                    countNode.className = 'mac-line-annotation-preview-count';
                    countNode.textContent = `+${preview.extraCount}`;
                    previewNode.appendChild(countNode);
                }
            } else if (previewNode instanceof HTMLElement) {
                previewNode.remove();
            }

            marker.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();

                const nextComposerPos = clampAnnotationComposerPosition({
                    pointerX: event.clientX,
                    pointerY: event.clientY,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                });
                logAnnotationComposerDebug('hotzone-click', {
                    lineIndex: currentLineIndex,
                    pointer: {
                        clientX: Math.round(event.clientX),
                        clientY: Math.round(event.clientY),
                    },
                    rootRect: {
                        top: Math.round(rootRect.top),
                        left: Math.round(rootRect.left),
                        right: Math.round(rootRect.right),
                        bottom: Math.round(rootRect.bottom),
                        width: Math.round(rootRect.width),
                        height: Math.round(rootRect.height),
                    },
                    blockRect: {
                        top: Math.round(blockRect.top),
                        left: Math.round(blockRect.left),
                        right: Math.round(blockRect.right),
                        bottom: Math.round(blockRect.bottom),
                        width: Math.round(blockRect.width),
                        height: Math.round(blockRect.height),
                    },
                    hotzoneLayout: layout,
                    nextComposerPos,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight,
                    },
                });
                openAnnotationBubbleForLine({
                    lineIndex: currentLineIndex,
                    lineText: normalizedText,
                    resetDraft: true,
                });
            };

            seenButtons.add(marker);
        });

        Array.from(overlay.querySelectorAll('.mac-line-annotation-btn')).forEach((node) => {
            if (!seenButtons.has(node)) {
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

    const getAnnotationLineElements = (lineIndex, fallbackLineText = '') => {
        const root = articlePreviewRef.current;
        if (!root || !lineIndex) {
            return null;
        }

        const block = root.querySelector(`:scope > [data-annotation-line="${lineIndex}"]`);
        const overlay = document.getElementById(ANNOTATION_HOTZONE_OVERLAY_ID);
        const button = overlay?.querySelector(`.mac-line-annotation-btn[data-annotation-line="${lineIndex}"]`) || null;
        if (!(block instanceof HTMLElement) || !(button instanceof HTMLElement)) {
            return null;
        }

        return {
            block,
            button,
            lineText: normalizeAnnotationText(fallbackLineText || block.dataset.annotationText || getLineTextFromNode(block)),
        };
    };

    const getAnnotationRootId = (annotationId) => {
        const byId = new Map(annotations.map((annotation) => [annotation.id, annotation]));
        let current = byId.get(annotationId);
        while (current?.parent_id && byId.has(current.parent_id)) {
            current = byId.get(current.parent_id);
        }
        return current?.id || annotationId || '';
    };

    const getLineRootAnnotations = (lineIndex) => {
        return annotations.filter((annotation) => (
            Number(annotation?.line_index || 0) === Number(lineIndex || 0)
            && !annotation?.parent_id
        ));
    };

    const openAnnotationBubbleForLine = ({
        lineIndex,
        lineText = '',
        resetDraft = false,
        preserveFocus = false,
        focusTargetId = '',
    }) => {
        const elements = getAnnotationLineElements(lineIndex, lineText);
        if (!elements) {
            return false;
        }

        const buttonRect = elements.button.getBoundingClientRect();
        const nextComposerPos = clampAnnotationComposerPosition({
            pointerX: buttonRect.right - 12,
            pointerY: buttonRect.top + buttonRect.height / 2,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });

        setComposerPos({
            x: nextComposerPos.x,
            y: nextComposerPos.y,
            lineIndex,
            lineText: elements.lineText,
            popupWidth: nextComposerPos.popupWidth,
            popupHeight: nextComposerPos.popupHeight,
        });
        if (resetDraft) {
            setActiveComposeText('');
            if (!preserveFocus) {
                setFocusAnnotationId('');
            }
        }
        const rootAnnotations = getLineRootAnnotations(lineIndex);
        const defaultRootId = focusTargetId ? getAnnotationRootId(focusTargetId) : (rootAnnotations[0]?.id || '');
        setAnnotationComposerMode(rootAnnotations.length > 0 ? 'thread' : 'create');
        setActiveReplyParentId(defaultRootId);
        setIsExplicitReplyTarget(false);
        setExpandedAnnotationRoots(focusTargetId ? { [getAnnotationRootId(focusTargetId)]: true } : {});
        setActiveComposeLine(lineIndex);
        return true;
    };

    const closeAnnotationComposer = () => {
        setActiveComposeLine(null);
        setActiveComposeText('');
        setActiveReplyParentId('');
        setIsExplicitReplyTarget(false);
        setExpandedAnnotationRoots({});
        setAnnotationComposerMode('create');
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
            logAnnotationReplyDebug('submit-annotation:request', {
                annotationComposerMode,
                activeReplyParentId: activeReplyParentId || null,
                isExplicitReplyTarget,
                activeReplyTarget: activeReplyTarget ? {
                    id: activeReplyTarget.id,
                    parent_id: activeReplyTarget.parent_id || null,
                    author_username: activeReplyTarget.author_username || '',
                    author_nickname: activeReplyTarget.author_nickname || '',
                    recipient_username: activeReplyTarget.recipient_username || '',
                } : null,
                payload: {
                    content: plainContent,
                    line_index: composerPos.lineIndex,
                    line_text: composerPos.lineText,
                    parent_id: annotationComposerMode === 'thread' ? activeReplyParentId || null : null,
                },
            });
            const res = await axios.post(
                `/api/articles/${id}/annotations`,
                {
                    content: plainContent,
                    line_index: composerPos.lineIndex,
                    line_text: composerPos.lineText,
                    parent_id: annotationComposerMode === 'thread' ? activeReplyParentId || null : null,
                },
                { headers }
            );
            logAnnotationReplyDebug('submit-annotation:response', {
                id: res.data?.id || '',
                parent_id: res.data?.parent_id || null,
                recipient_id: res.data?.recipient_id || null,
                recipient_username: res.data?.recipient_username || '',
                line_index: res.data?.line_index ?? null,
                content: res.data?.content || '',
            });

            if (annotationComposerMode === 'thread' && activeReplyParentId && activeReplyTarget?.id && res.data?.id) {
                setAnnotationReplyOverrides((prev) => ({
                    ...prev,
                    [res.data.id]: {
                        parent_id: res.data?.parent_id || activeReplyParentId,
                        recipient_id: res.data?.recipient_id || activeReplyTarget.author_id || null,
                        recipient_username: res.data?.recipient_username || activeReplyTarget.author_username || '',
                        recipient_nickname: res.data?.recipient_nickname || activeReplyTarget.author_nickname || null,
                        recipient_avatar: res.data?.recipient_avatar || activeReplyTarget.author_avatar || null,
                    },
                }));
            }

            await fetchAnnotations();

            setFocusAnnotationId('');
            setActiveComposeText('');
            if (annotationComposerMode === 'create') {
                closeAnnotationComposer();
            } else {
                const nextRootId = res.data?.parent_id || res.data?.id || '';
                setActiveReplyParentId(nextRootId);
                setIsExplicitReplyTarget(false);
            }
            buildLineAnnotationAnchors();
        } catch (error) {
            console.error('提交批注失败：', error);
            macAlert(error.response?.data?.detail || '提交失败，请稍后再试。', '批注失败');
        }
    };

    const focusAnnotationByHash = () => {
        if (!focusAnnotationId) {
            return false;
        }

        const targetAnnotation = annotations.find((annotation) => String(annotation?.id || '') === String(focusAnnotationId));
        if (!targetAnnotation?.line_index) {
            return;
        }

        const openTargetBubble = () => openAnnotationBubbleForLine({
            lineIndex: targetAnnotation.line_index,
            lineText: targetAnnotation.line_text || '',
            resetDraft: true,
            preserveFocus: true,
            focusTargetId: targetAnnotation.id,
        });

        const elements = getAnnotationLineElements(targetAnnotation.line_index, targetAnnotation.line_text || '');
        if (!elements) {
            return false;
        }

        elements.block.scrollIntoView({ behavior: 'smooth', block: 'center' });

        let tries = 0;
        const maxTries = 12;
        const tryOpen = () => {
            buildLineAnnotationAnchors();
            if (openTargetBubble()) {
                if (typeof window !== 'undefined' && window.location.hash) {
                    window.history.replaceState(
                        window.history.state,
                        '',
                        `${location.pathname}${location.search}`,
                    );
                }
                return;
            }

            tries += 1;
            if (tries < maxTries) {
                setTimeout(tryOpen, 120);
            }
        };

        setTimeout(tryOpen, 180);
        return true;
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
        if (activeComposeLine === null || !annotationComposerRef.current) {
            return;
        }

        const composerNode = annotationComposerRef.current;
        window.requestAnimationFrame(() => {
            const rect = composerNode.getBoundingClientRect();
            logAnnotationComposerDebug('composer-visible', {
                activeComposeLine,
                composerPos,
                locationHash: location.hash || '',
                focusAnnotationId,
                actualRect: {
                    top: Math.round(rect.top),
                    left: Math.round(rect.left),
                    right: Math.round(rect.right),
                    bottom: Math.round(rect.bottom),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
            });
        });
    }, [activeComposeLine, composerPos, location.hash, focusAnnotationId]);

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
        removeAnnotationHotzoneOverlay();
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
        if (!isMainContentReady || article?.is_restricted) {
            return;
        }

        const scheduleRebuild = () => {
            if (annotationHotzoneRafRef.current) {
                cancelAnimationFrame(annotationHotzoneRafRef.current);
            }
            annotationHotzoneRafRef.current = window.requestAnimationFrame(() => {
                annotationHotzoneRafRef.current = 0;
                buildLineAnnotationAnchors();
            });
        };

        window.addEventListener('resize', scheduleRebuild);
        window.addEventListener('scroll', scheduleRebuild, { passive: true });
        return () => {
            window.removeEventListener('resize', scheduleRebuild);
            window.removeEventListener('scroll', scheduleRebuild);
            if (annotationHotzoneRafRef.current) {
                cancelAnimationFrame(annotationHotzoneRafRef.current);
                annotationHotzoneRafRef.current = 0;
            }
        };
    }, [isMainContentReady, article, annotations]);

    useEffect(() => () => {
        removeAnnotationHotzoneOverlay();
        if (annotationHotzoneRafRef.current) {
            cancelAnimationFrame(annotationHotzoneRafRef.current);
            annotationHotzoneRafRef.current = 0;
        }
    }, []);

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
    const activeLineAnnotations = annotations.filter(
        (annotation) => Number(annotation?.line_index || 0) === Number(activeComposeLine || 0)
    );
    const activeRootAnnotations = activeLineAnnotations.filter((annotation) => !annotation?.parent_id);
    const activeReplyAnnotations = activeLineAnnotations.filter((annotation) => Boolean(annotation?.parent_id));
    const repliesByRootId = activeReplyAnnotations.reduce((acc, annotation) => {
        const rootId = getAnnotationRootId(annotation.id);
        if (!acc[rootId]) {
            acc[rootId] = [];
        }
        acc[rootId].push(annotation);
        return acc;
    }, {});
    const activeReplyTarget = activeLineAnnotations.find((annotation) => annotation.id === activeReplyParentId) || null;
    const annotationEditorPlaceholder = annotationComposerMode === 'thread'
        ? '添加回复（仅支持文字+表情）'
        : '添加批注（仅支持文字+表情）';
    const annotationComposer = activeComposeLine !== null && (
        <div
            ref={annotationComposerRef}
            className="mac-annotation-composer"
            style={{ left: composerPos.x, top: composerPos.y, width: composerPos.popupWidth, maxHeight: composerPos.popupHeight }}
        >
            <div className="mac-annotation-composer-title">
                <span>{annotationComposerMode === 'thread' ? `第 ${composerPos.lineIndex} 行批注详情` : `第 ${composerPos.lineIndex} 行新批注`}</span>
            </div>
            <div className="mac-annotation-composer-line">{buildAnnotationQuotePreview(composerPos.lineText, 20)}</div>
            {annotationComposerMode === 'thread' && activeRootAnnotations.length > 0 && (
                <div className="mac-annotation-thread-panel">
                        <div className="mac-annotation-thread">
                            {activeRootAnnotations.map((annotation) => {
                                const replies = repliesByRootId[annotation.id] || [];
                                const isExpanded = Boolean(expandedAnnotationRoots[annotation.id]);
                                return (
                                <div
                                    key={annotation.id}
                                    id={`annotation-inline-${annotation.id}`}
                                    className={`mac-annotation-item mac-annotation-thread-root ${focusAnnotationId === annotation.id ? 'mac-annotation-item--focus' : ''}`}
                                >
                                    <div className="mac-annotation-thread-toggle">
                                        <div className="mac-annotation-meta">
                                            <span className="mac-annotation-author">
                                                <span className="mac-annotation-avatar">
                                                    {annotation.author_avatar || (annotation.author_nickname || annotation.author_username || 'U')[0].toUpperCase()}
                                                </span>
                                                <span className="mac-annotation-user">
                                                    {annotation.author_nickname || annotation.author_username}
                                                </span>
                                            </span>
                                            <span>{annotation.created_at}</span>
                                        </div>
                                        <div className="mac-annotation-content">{annotation.content}</div>
                                        <div className="mac-annotation-root-reply-row">
                                            {replies.length > 0 ? (
                                                <button
                                                    type="button"
                                                    className="mac-annotation-inline-action"
                                                    onClick={() => {
                                                        setExpandedAnnotationRoots((prev) => ({
                                                            ...prev,
                                                            [annotation.id]: !prev[annotation.id],
                                                        }));
                                                    }}
                                                >
                                                    {isExpanded ? '收起回复' : `展开 ${replies.length} 条回复`}
                                                </button>
                                            ) : <span></span>}
                                            <button
                                                type="button"
                                                className="mac-annotation-inline-action mac-annotation-root-reply"
                                                onClick={() => {
                                                    setActiveReplyParentId(annotation.id);
                                                    setIsExplicitReplyTarget(true);
                                                }}
                                            >
                                                回复
                                            </button>
                                        </div>
                                    </div>
                                        {replies.length > 0 && isExpanded ? (
                                            <div className="mac-annotation-replies">
                                                {replies.map((reply) => {
                                                const replyRecipient = reply.recipient_nickname || reply.recipient_username || '用户';
                                                return (
                                                    <div
                                                        key={reply.id}
                                                        id={`annotation-inline-${reply.id}`}
                                                        className={`mac-annotation-item mac-annotation-reply-item ${focusAnnotationId === reply.id ? 'mac-annotation-item--focus' : ''}`}
                                                    >
                                                        <div className="mac-annotation-meta">
                                                            <span className="mac-annotation-author">
                                                                <span className="mac-annotation-avatar">
                                                                    {reply.author_avatar || (reply.author_nickname || reply.author_username || 'U')[0].toUpperCase()}
                                                                </span>
                                                                <span className="mac-annotation-user">
                                                                    {reply.author_nickname || reply.author_username}
                                                                </span>
                                                            </span>
                                                            <span>{reply.created_at}</span>
                                                        </div>
                                                        <div className="mac-annotation-target">
                                                            回复 @{replyRecipient}
                                                        </div>
                                                        <div className="mac-annotation-content">{reply.content}</div>
                                                        <div className="mac-annotation-thread-actions mac-annotation-thread-actions--reply">
                                                            <button
                                                                type="button"
                                                                className="mac-annotation-inline-action"
                                                                onClick={() => {
                                                                    setActiveReplyParentId(reply.id);
                                                                    setIsExplicitReplyTarget(true);
                                                                }}
                                                            >
                                                                回复
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
            <div className="mac-annotation-input-panel">
                {annotationComposerMode === 'thread' && isExplicitReplyTarget && activeReplyTarget ? (
                    <div className="mac-annotation-reply-hint">
                        回复 @{activeReplyTarget.author_nickname || activeReplyTarget.author_username}
                    </div>
                ) : null}
                <EmbeddedAnnotationEditor
                    onValueChange={setActiveComposeText}
                    initialValue={activeComposeText}
                    placeholder={annotationEditorPlaceholder}
                />
            </div>
            <div className="mac-annotation-composer-actions">
                <div className="mac-annotation-composer-action-buttons">
                    <button
                        type="button"
                        className="mac-cancel-btn"
                        style={{ padding: '6px 14px', borderRadius: '10px', color: '#86868B', fontSize: '13px', background: 'transparent', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.08)' }}
                        onClick={closeAnnotationComposer}
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        className="mac-comment-submit"
                        onClick={handleCreateAnnotation}
                        disabled={
                            normalizeAnnotationText(activeComposeText).length === 0
                            || normalizeAnnotationText(activeComposeText).length > 1200
                        }
                    >
                        {annotationComposerMode === 'thread' ? '回复' : '发布'}
                    </button>
                </div>
            </div>
        </div>
    );

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
                                {(article.author_name || article.author_id) && (
                                    <span style={{ fontSize: '13px', color: '#86868B', marginRight: '12px', fontWeight: 500 }}>
                                        作者：{article.author_name || '作者'}
                                    </span>
                                )}
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
                    </div>

                    {/* 评论区：仅在非受限且渲染完成后显示 */}
                    {!article.is_restricted && isMainContentReady && (
                        <ThreadZone 
                            articleId={id} 
                            articleAuthorId={article.author_id} 
                            onCommentAdded={() => setArticle({...article, comments_count: article.comments_count + 1})}
                            focusCommentId={focusCommentId}
                            onFocusCommentConsumed={() => {
                                if (typeof window !== 'undefined' && window.location.hash) {
                                    window.history.replaceState(
                                        window.history.state,
                                        '',
                                        `${location.pathname}${location.search}`,
                                    );
                                }
                                setFocusCommentId('');
                            }}
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
            {activeComposeLine !== null && typeof document !== 'undefined' && createPortal(
                annotationComposer,
                document.body,
            )}
        </div>
    );
}
