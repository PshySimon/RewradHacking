import React, { useState } from 'react';
import axios from 'axios';

/**
 * 页内登录/注册弹窗组件
 * 可被任何页面以 <AuthModal visible={bool} onClose={fn} onSuccess={fn} /> 方式使用
 */
export default function AuthModal({ visible, onClose, onSuccess, initialTab = 'login' }) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    if (!visible) return null;

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setErrorMsg('');
        setIsLoading(false);
        setIsSuccess(false);
    };

    const switchTab = (tab) => {
        resetForm();
        setActiveTab(tab);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);

            const res = await axios.post('/api/auth/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            localStorage.setItem('access_token', res.data.access_token);
            setIsSuccess(true);
            setTimeout(() => {
                resetForm();
                onSuccess && onSuccess();
            }, 600);
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || "账号或密码错误");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (password.length < 4) {
            setErrorMsg("密码长度不能少于 4 位");
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg("两次输入的密码不一致");
            return;
        }

        setIsLoading(true);
        try {
            // 注册
            await axios.post('/api/auth/register', { username, password });
            // 注册成功后自动登录
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);
            const res = await axios.post('/api/auth/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            localStorage.setItem('access_token', res.data.access_token);
            setIsSuccess(true);
            setTimeout(() => {
                resetForm();
                onSuccess && onSuccess();
            }, 600);
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || "注册失败，该用户名可能已被占用");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mac-modal-overlay" onClick={onClose}>
            <div className="auth-modal-card" onClick={e => e.stopPropagation()}>
                {/* Logo */}
                <div className="auth-modal-logo">
                    <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: '0', left: '0', width: '18px', height: '18px', background: '#38BDF8', borderRadius: '5px' }}></div>
                        <div style={{ position: 'absolute', bottom: '0', right: '0', width: '18px', height: '18px', background: '#0071E3', borderRadius: '5px', zIndex: 1, boxShadow: '-2px -2px 0 white' }}></div>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: '22px', color: '#1D1D1F', letterSpacing: '-0.5px' }}>
                        Reward<span style={{ color: '#0071E3' }}>Hacking</span>
                    </span>
                </div>

                {/* Tab 切换 */}
                <div className="auth-modal-tabs">
                    <div 
                        className={`auth-modal-tab ${activeTab === 'login' ? 'active' : ''}`}
                        onClick={() => switchTab('login')}
                    >
                        登录
                    </div>
                    <div 
                        className={`auth-modal-tab ${activeTab === 'register' ? 'active' : ''}`}
                        onClick={() => switchTab('register')}
                    >
                        注册
                    </div>
                </div>

                {/* 登录表单 */}
                {activeTab === 'login' && (
                    <form className="auth-modal-form" onSubmit={handleLogin}>
                        <div className="auth-modal-input-group">
                            <label>账号</label>
                            <input 
                                type="text" placeholder="请输入账号" 
                                value={username} onChange={e => setUsername(e.target.value)} required 
                            />
                        </div>
                        <div className="auth-modal-input-group">
                            <label>密码</label>
                            <input 
                                type="password" placeholder="请输入密码" 
                                value={password} onChange={e => setPassword(e.target.value)} required 
                            />
                        </div>
                        {errorMsg && <div className="auth-modal-error">{errorMsg}</div>}
                        <button 
                            type="submit" 
                            className="auth-modal-submit"
                            disabled={isLoading || isSuccess}
                            style={{ 
                                background: isSuccess ? 'linear-gradient(135deg, #34D399, #10B981)' : ''
                            }}
                        >
                            {isSuccess ? '登录成功' : (isLoading ? '登录中...' : '登 录')}
                        </button>
                    </form>
                )}

                {/* 注册表单 */}
                {activeTab === 'register' && (
                    <form className="auth-modal-form" onSubmit={handleRegister}>
                        <div className="auth-modal-input-group">
                            <label>账号</label>
                            <input 
                                type="text" placeholder="请输入账号" 
                                value={username} onChange={e => setUsername(e.target.value)} required 
                            />
                        </div>
                        <div className="auth-modal-input-group">
                            <label>密码</label>
                            <input 
                                type="password" placeholder="请设置密码（至少4位）" 
                                value={password} onChange={e => setPassword(e.target.value)} required 
                            />
                        </div>
                        <div className="auth-modal-input-group">
                            <label>确认密码</label>
                            <input 
                                type="password" placeholder="请再次输入密码" 
                                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required 
                            />
                        </div>
                        {errorMsg && <div className="auth-modal-error">{errorMsg}</div>}
                        <button 
                            type="submit" 
                            className="auth-modal-submit"
                            disabled={isLoading || isSuccess}
                            style={{ 
                                background: isSuccess ? 'linear-gradient(135deg, #34D399, #10B981)' : ''
                            }}
                        >
                            {isSuccess ? '注册成功，正在进入...' : (isLoading ? '注册中...' : '注 册')}
                        </button>
                    </form>
                )}

                {/* 关闭按钮 */}
                <button className="auth-modal-close" onClick={onClose} aria-label="关闭">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
}
