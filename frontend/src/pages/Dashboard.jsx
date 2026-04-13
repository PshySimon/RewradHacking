import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const [articles, setArticles] = useState([]);
    const [activeTab, setActiveTab] = useState('knowledge');
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const res = await axios.get('/api/users/me', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
                });
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

    const handleDelete = async (id) => {
        if (!confirm("确定要删除这篇文章吗？此操作不可恢复。")) return;
        try {
            await axios.delete(`/api/articles/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
            });
            setArticles(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            alert(err.response?.data?.detail || "删除失败，您可能没有足够的权限。");
        }
    };

    return (
        <div className="zhi-app">
            <header className="zhi-header">
                <div className="zhi-header-inner">
                    <div className="zhi-logo" style={{ cursor: 'pointer' }}>面经存档点</div>
                    <nav className="zhi-nav">
                        {['knowledge', 'interview', 'code'].map(tab => (
                            <div 
                                key={tab} 
                                className={`zhi-nav-item ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'knowledge' ? '知识' : tab === 'interview' ? '面经' : '代码'}
                            </div>
                        ))}
                    </nav>
                    <div className="zhi-actions">
                        <button className="zhi-btn-primary" onClick={() => navigate('/editor')}>写文章</button>
                        <div className="zhi-user-actions">
                            <span style={{fontWeight: 600}}>{user?.role === 'admin' ? '管理员' : '用户'}</span>
                            <span className="zhi-logout" onClick={() => { localStorage.clear(); navigate('/login'); }}>退出</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="zhi-main-layout">
                <div className="zhi-feed">
                    {articles.length === 0 ? (
                        <div className="zhi-empty">暂无文章，点击上方“写文章”发布第一篇。</div>
                    ) : (
                        articles.map(a => (
                            <div key={a.id} className="zhi-feed-card">
                                <h2 className="zhi-card-title">{a.title}</h2>
                                <div className="zhi-card-excerpt">
                                    {a.content.substring(0, 180)}...
                                </div>
                                <div className="zhi-card-footer">
                                    <span className="zhi-tag">{a.category === 'knowledge' ? '知识' : a.category === 'interview' ? '面经' : '代码'}</span>
                                    {user && (user.role === 'admin' || user.id === a.author_id) && (
                                        <button className="zhi-btn-text" onClick={() => handleDelete(a.id)}>删除文章</button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                <aside className="zhi-sidebar">
                    <div className="zhi-side-card">
                        <h3>关于「面经存档点」</h3>
                        <p>大厂攻关的野生信息集散地。极简排版，毫无广告。拒绝过度设计，我们将所有的视线重新回归于最纯粹的面试真题流转与高质量的求职干货上。</p>
                    </div>
                </aside>
            </main>
        </div>
    );
}
