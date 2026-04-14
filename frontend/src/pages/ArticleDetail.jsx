import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ErrorPage from './ErrorPage';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import TagPill from '../components/TagPill';
import MacModal from '../components/MacModal';
import ThreadZone from '../components/ThreadZone';

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
        const [isMainContentReady, setIsMainContentReady] = useState(false); // 核心防止 Vditor 并发死锁标识
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    
    useEffect(() => {
        // 请求上下文基座
        const token = localStorage.getItem('access_token');
        
        const fetchMe = async () => {
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
                console.warn("身份解包失败");
            }
        };

        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchMe();
            fetchArticleDetail();
            
        } else {
            navigate('/login');
        }
    }, [id]);

    // 等待 Article 在 DOM 中解包后再对核心正文区铺设高亮渲染
    useEffect(() => {
        if (article) {
            // 使用.then来进行错峰：只有当主干文章最吃性能的解析大业落成，才放任其他的实例化动作
            Vditor.preview(document.getElementById('mac-vditor-preview'), article.content, {
                mode: 'light',
                theme: { current: 'light' },
                hljs: { style: 'github' }
            }).then(() => {
                setIsMainContentReady(true);
            }).catch(e => {
                console.error("正文Vditor底层解析故障", e);
                setIsMainContentReady(true); // 即便出错也不能永远让评论区锁死
            });
        }
    }, [article]);

    const fetchArticleDetail = async () => {
        try {
            const res = await axios.get(`/api/articles/${id}`);
            document.title = `${res.data.title} - RewardHacking`;
            setArticle(res.data);
            generateOutline(res.data.content);
        } catch (error) {
            console.error("加载文章迷失：", error);
            if (error.response?.status === 404) navigate('/');
        }
    };

    
    const generateOutline = (content) => {
        // 造一套轻量、灵巧的正则抽大纲以追求原生可塑的自由感
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
        // Vditor 生成的 html 中的 h1~h6 id 是内容文本或者其自带的解析，
        // 最暴力的办法是直接在前台找文字相等的 DOM 元素，然后 scrollIntoView
        const elements = document.querySelectorAll('#mac-vditor-preview h1, #mac-vditor-preview h2, #mac-vditor-preview h3, #mac-vditor-preview h4, #mac-vditor-preview h5, #mac-vditor-preview h6');
        for (let el of elements) {
            // Vditor 会包裹超链接等，取 textContent
            if (el.textContent.includes(title)) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
            }
        }
    };

    
    
    // 删除体系集成
    const handleDeleteClick = () => setDeleteConfirmId(id);
    const executeDelete = async () => {
        setIsDeleting(true);
        try {
            await axios.delete(`/api/articles/${deleteConfirmId}`);
            setDeleteConfirmId(null);
            navigate('/'); // 消灭完毕后立刻强行退回母阵列
        } catch (error) {
            console.error("执行毁损动作失败：", error);
            setDeleteConfirmId(null);
        } finally {
            setIsDeleting(false);
        }
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
            {/* 顶配：高斯全息指令条，高度类似于 Dashboard 的配置 */}
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
                                    title="物理消除该文章" 
                                    style={{ cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }} 
                                    onClick={handleDeleteClick}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </span>
                            </div>
                        )}
                        <div className="zhi-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: '#0071E3', 
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold'
                            }}>
                                {user?.avatar || (user?.nickname || user?.username || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{fontWeight: 600, fontSize: '14px', color: '#1D1D1F'}}>{user?.nickname || user?.username}</span>
                            <span className="zhi-logout" onClick={() => { localStorage.clear(); navigate('/login'); }}>退出登录</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* 大阵列：双轨滑行悬浮阅读场 */}
            <main className="mac-reader-layout">
                {/* 漂浮的收放枢纽 + 抽屉式隐形容器 */}
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
                        <h4>文档导视</h4>
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

                {/* 右域（乃至主域）：正文展示核心、底部互动圈 */}
                <article className="mac-reader-content" style={!showOutline ? { margin: '0 auto', maxWidth: '800px', width: '100%' } : {}}>
                    <div className="mac-article-glass-card">
                        <h1 className="mac-article-title">{article.title}</h1>
                        <div className="mac-article-meta-ribbon">
                            <div className="mac-article-meta-left">
                                <span className="category-meta">{article.category === 'knowledge' ? '知识' : article.category === 'interview' ? '面经' : '代码'}</span>
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

                        <div id="mac-vditor-preview" className="mac-markdown-stream"></div>
                    </div>

                    {/* 评论交互生命海：已完全组件化抽离于 ThreadZone 核心！ */}
                    {isMainContentReady && (
                        <ThreadZone 
                            articleId={id} 
                            articleAuthorId={article.author_id} 
                            onCommentAdded={() => setArticle({...article, comments_count: article.comments_count + 1})}
                        />
                    )}
                </article>
            </main>

            <MacModal 
                isOpen={!!deleteConfirmId}
                title="不可挽回的消除动作"
                desc="您即将要把这篇文章从数据库的深渊中彻底抹除，包括它的标签和一切信息，此操作无可挽回。确定要继续吗？"
                confirmText={isDeleting ? '正在湮灭...' : '确认销毁'}
                cancelText="安然撤退"
                onConfirm={executeDelete}
                onCancel={() => setDeleteConfirmId(null)}
                isProcessing={isDeleting}
            />
        </div>
    );
}
