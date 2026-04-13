import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [ripples, setRipples] = useState([]);
    const navigate = useNavigate();

    const addRipple = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const diameter = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - diameter / 2;
        const y = e.clientY - rect.top - diameter / 2;
        setRipples(prev => [...prev, { x, y, size: diameter, id: Date.now() }]);
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
            setTimeout(() => navigate('/'), 600);
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || "账号或密码错误");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="login-card">
                <div className="logo-area">
                    <h1>Prep<span>Master</span></h1>
                    <p className="subtitle">面经管理与分享平台</p>
                </div>
                
                <form className="login-form" onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>账号</label>
                        <input 
                            type="text" placeholder="请输入账号" 
                            value={username} onChange={e => setUsername(e.target.value)} required 
                        />
                    </div>
                    
                    <div className="input-group">
                        <label>密码</label>
                        <input 
                            type="password" placeholder="请输入密码" 
                            value={password} onChange={e => setPassword(e.target.value)} required 
                        />
                    </div>

                    {errorMsg && <div className="error-msg">{errorMsg}</div>}

                    <button 
                        type="submit" className="submit-btn" 
                        onMouseDown={addRipple}
                        disabled={isLoading || isSuccess}
                        style={{ 
                            background: isSuccess ? 'linear-gradient(135deg, #34D399, #10B981)' : '',
                            boxShadow: isSuccess ? '0 8px 20px rgba(16, 185, 129, 0.3)' : ''
                        }}
                    >
                        {isSuccess ? '登录成功，正在跳转...' : (isLoading ? '登录中...' : '登 录')}
                        
                        {/* 按钮独享绝美水波扩散爆发特效 */}
                        {ripples.map(r => (
                            <span key={r.id} className="ripple-span"
                                style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
                                onAnimationEnd={() => setRipples(prev => prev.filter(ripple => ripple.id !== r.id))}
                            />
                        ))}
                    </button>
                </form>

                <div className="options">
                    <a href="#" className="forgot-pwd">忘记密码？</a>
                </div>
            </div>
        </div>
    );
}
