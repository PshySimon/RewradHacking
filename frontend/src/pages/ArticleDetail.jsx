import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ErrorPage from './ErrorPage';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import TagPill from '../components/TagPill';
import { macAlert, macConfirm } from '../components/MacModal';
import ThreadZone from '../components/ThreadZone';
import AuthModal from '../components/AuthModal';
import { normalizeVditorMarkdown } from '../utils/vditorMarkdown';
import { buildVditorRenderOptions } from '../utils/vditorOptions';

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
    const [article, setArticle] = useState(null);
    const [user, setUser] = useState(null);
    
    // 渲染系统相关状态
    const [outline, setOutline] = useState([]);
    const [isOutlineVisible, setIsOutlineVisible] = useState(true);
    const [isMainContentReady, setIsMainContentReady] = useState(false);
    
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
        } catch (err) {
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
            if (!res.data.is_restricted) {
                generateOutline(res.data.content);
            }
        } catch (error) {
            console.error("加载文章失败：", error);
            if (error.response?.status === 404) navigate('/');
        }
    };

    useEffect(() => {
        fetchMe();
        fetchArticleDetail();
    }, [id]);

    // 等待 Article 在 DOM 中解包后再对核心正文区铺设高亮渲染
    useEffect(() => {
        if (article && !article.is_restricted) {
            Vditor.preview(document.getElementById('mac-vditor-preview'), normalizeVditorMarkdown(article.content), buildVditorRenderOptions({
                mode: 'light',
                theme: { current: 'light' },
                hljs: { style: 'github' }
            })).then(() => {
                setIsMainContentReady(true);
            }).catch(e => {
                console.error("正文Vditor底层解析故障", e);
                setIsMainContentReady(true);
            });
        }
    }, [article]);

    const generateOutline = (content) => {
        const regex = /^(#{1,6})\s+(.+)$/gm;
        let match;
        const out = [];
        let index = 0;
        while ((match = regex.exec(content)) !== null) {
            out.push({
                level: match[1].length,
                title: match[2],
                id: `heading-${index}`,
                rawLength: match[0].length
            });
            index++;
        }
        setOutline(out);
    };

    // 锚点平滑降落协议
    const scrollToHeading = (title) => {
        const elements = document.querySelectorAll('#mac-vditor-preview h1, #mac-vditor-preview h2, #mac-vditor-preview h3, #mac-vditor-preview h4, #mac-vditor-preview h5, #mac-vditor-preview h6');
        for (let el of elements) {
            if (el.textContent.includes(title)) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
            }
        }
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
                                        onClick={() => scrollToHeading(item.title)}
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
                            <div id="mac-vditor-preview" className="mac-markdown-stream"></div>
                        )}
                    </div>

                    {/* 评论区：仅在非受限且渲染完成后显示 */}
                    {!article.is_restricted && isMainContentReady && (
                        <ThreadZone 
                            articleId={id} 
                            articleAuthorId={article.author_id} 
                            onCommentAdded={() => setArticle({...article, comments_count: article.comments_count + 1})}
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
