import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import MacModal from '../components/MacModal';
import TagPill from '../components/TagPill';

export default function Dashboard() {
    const [articles, setArticles] = useState([]);
    const [activeTab, setActiveTab] = useState(sessionStorage.getItem('dashboard_tab') || 'knowledge');
    const [user, setUser] = useState(null);
    // 高级弹窗机制接管原生 confirm
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        document.title = '首页 - RewardHacking';
    }, []);

    useEffect(() => {
        sessionStorage.setItem('dashboard_tab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const res = await axios.get('/api/users/me', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
                });
                if (!res.data.is_profile_completed) {
                    navigate('/onboarding');
                    return;
                }
                setUser(res.data);
            } catch (err) {
                navigate('/login');
            }
        };
        fetchMe();
    }, [navigate]);

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const res = await axios.get(`/api/articles/?category=${activeTab}`);
                setArticles(res.data);
            } catch (err) {
                console.error("数据加载失败:", err);
            }
        };
        fetchArticles();
    }, [activeTab]);

    // 第一步：触发警戒弹窗而不是生硬开杀
    const handleDeleteClick = (id) => {
        setDeleteConfirmId(id);
    };

    // 第二步：用户在弹窗中坚决确认，开始行刑
    const executeDelete = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await axios.delete(`/api/articles/${deleteConfirmId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
            });
            setArticles(prev => prev.filter(a => a.id !== deleteConfirmId));
            setDeleteConfirmId(null);
        } catch (err) {
            alert(err.response?.data?.detail || "删除失败，您可能没有足够的权限。");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="zhi-app">
            <header className="zhi-header">
                <div className="zhi-header-inner">
                    <div className="zhi-logo" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', fontSize: '20px', fontWeight: '900', color: '#1D1D1F', letterSpacing: '-0.5px' }}>
                        <div style={{ position: 'relative', width: '22px', height: '22px', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: '0', left: '0', width: '14px', height: '14px', background: '#38BDF8', borderRadius: '3px' }}></div>
                            <div style={{ position: 'absolute', bottom: '0', right: '0', width: '14px', height: '14px', background: '#0071E3', borderRadius: '3px', zIndex: 1, boxShadow: '-1px -1px 0 white' }}></div>
                        </div>
                        Reward<span style={{ color: '#0071E3' }}>Hacking</span>
                    </div>
                    <nav className="zhi-nav" style={{ flexShrink: 0, display: 'flex', whiteSpace: 'nowrap' }}>
                        {['knowledge', 'interview', 'code'].map(tab => (
                            <div 
                                key={tab} 
                                className={`zhi-nav-item ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {tab === 'knowledge' ? '知识' : tab === 'interview' ? '面经' : '代码'}
                            </div>
                        ))}
                    </nav>
                    
                    <div className="zhi-search-zone" style={{ flexGrow: 1, padding: '0 24px', display: 'flex', justifyContent: 'flex-start', minWidth: '150px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', background: '#F5F5F7', borderRadius: '8px', padding: '8px 14px', width: '100%', maxWidth: '340px', transition: 'all 0.2s' }}>
                             <svg width="16" height="16" fill="none" stroke="#86868B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginRight: '8px', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                             <input type="text" placeholder="搜索" style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px', color: '#1D1D1F' }} />
                         </div>
                    </div>

                    <div className="zhi-actions" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <button className="zhi-btn-primary" style={{ background: '#0071E3', color: '#FFFFFF', padding: '8px 20px', fontWeight: '700', border: 'none', boxShadow: '0 2px 10px rgba(0, 113, 227, 0.2)', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => navigate(`/editor?category=${activeTab}`)}>创作</button>
                        <div className="zhi-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: '#0071E3', 
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold'
                            }}>
                                {user?.avatar || (user?.nickname || user?.username || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{fontWeight: 600, fontSize: '14px', color: '#1D1D1F'}}>{user?.nickname || user?.username}</span>
                            <span className="zhi-logout" onClick={() => { localStorage.clear(); navigate('/login'); }}>退出</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="zhi-main-layout">
                <div className="zhi-feed">
                    {articles.length === 0 ? (
                        <div className="zhi-empty">暂无文章，点击上方“创作”发布第一篇。</div>
                    ) : (
                        articles.map(a => {
                            // 动态渲染预处理层
                            const tagsArr = a.tags ? a.tags.split(',').filter(Boolean) : [];
                            const displayTags = tagsArr.slice(0, 5);
                            const hasMoreTags = tagsArr.length > 5;
                            // 数据净化宣告：彻底废弃前端伪随机多项式发生器，全面接管后端真实的血脉数据！
                            const views = a.views_count || 0;
                            const comments = a.comments_count || 0;
                            
                            return (
                                <div key={a.id} className="zhi-feed-card" onClick={() => {
                                    if (a.category === 'code') navigate(`/codeplay/${a.id}`);
                                    else navigate(`/article/${a.id}`);
                                }} style={{cursor: 'pointer'}}>
                                    <h2 className="zhi-card-title">{a.title}</h2>
                                    <div className="zhi-card-excerpt">
                                        {a.content.substring(0, 180)}...
                                    </div>
                                    <div className="zhi-card-footer">
                                        {/* 左侧：严控极限长度的标签集合舱 */}
                                        <div className="zhi-card-footer-left">
                                            {displayTags.map((tag, idx) => (
                                                <TagPill key={idx} text={tag} />
                                            ))}
                                            {hasMoreTags && <span className="mac-tag-pill more-dots">...</span>}
                                        </div>
                                        
                                        {/* 右侧：精简纯粹的展示互动面板 */}
                                        <div className="zhi-card-footer-right">
                                            {a.created_at && <span style={{ fontSize: '12px', color: '#86868B', marginRight: '12px', fontWeight: 500 }}>{a.created_at.substring(0, 10)}</span>}
                                            <div className="mac-interaction-item">
                                                {/* 浏览量 Eye Icon */}
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                <span>{views}</span>
                                            </div>
                                            <div className="mac-interaction-item">
                                                {/* 评论数 Message Square Icon */}
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                <span>{comments}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                
                <aside className="zhi-sidebar">
                    <div className="zhi-side-card">
                        <h3>关于「RewardHacking」</h3>
                        <p>大厂攻关的野生信息集散地。极简排版，毫无广告。拒绝过度设计，我们将所有的视线重新回归于最纯粹的面试真题流转与高质量的求职干货上。</p>
                    </div>
                </aside>
            </main>

            {/* Apple 级全局玻璃弹窗警戒网 (Mac Danger Modal) 组件层抽取接驳 */}
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
