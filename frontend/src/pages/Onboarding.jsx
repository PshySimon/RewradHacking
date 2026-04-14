import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
    const [nickname, setNickname] = useState('');
    const [birthday, setBirthday] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // 刚进这门，必须要保障他身上有 token，否则让他回登录
    useEffect(() => {
         const token = localStorage.getItem('access_token');
         if (!token) navigate('/login');
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (nickname.trim().length === 0) {
            setErrorMsg("请输入您的昵称。");
            return;
        }
        if (!birthday) {
            setErrorMsg("请选择您的出生日期。");
            return;
        }

        setIsLoading(true);
        try {
            await axios.put('/api/users/profile', {
                nickname: nickname.trim(),
                birthday: birthday
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
            });
            // 提交成功，破壁放行
            navigate('/');
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || "设置失败，该昵称可能已被占用。");
        } finally {
            setIsLoading(false);
        }
    };

    // 动态生成首字母呈现头像（无名则显 ?）
    const avatarLetter = nickname.trim().charAt(0).toUpperCase() || '?';

    return (
        <div className="auth-wrapper" style={{ minHeight: '100vh', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="login-card" style={{ maxWidth: '560px', width: '100%', padding: '40px', background: 'white', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '28px', color: '#1D1D1F', letterSpacing: '-0.5px', margin: '0 0 10px 0' }}>
                        <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: '0', left: '0', width: '18px', height: '18px', background: '#38BDF8', borderRadius: '5px' }}></div>
                            <div style={{ position: 'absolute', bottom: '0', right: '0', width: '18px', height: '18px', background: '#0071E3', borderRadius: '5px', zIndex: 1, boxShadow: '-2px -2px 0 white' }}></div>
                        </div>
                        <span style={{ fontWeight: '900' }}>Reward<span style={{ color: '#0071E3' }}>Hacking</span></span>
                    </h1>
                    <p style={{ fontSize: '15px', color: '#86868B', marginTop: '8px' }}>为了给您提供更好的服务，请完善个人信息。</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* 动态头像预览 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                        <div style={{
                            width: '90px', 
                            height: '90px', 
                            borderRadius: '50%', 
                            background: '#0071E3', 
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '40px',
                            fontWeight: '600',
                            boxShadow: '0 8px 16px rgba(0, 113, 227, 0.24)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: nickname ? 'scale(1.05)' : 'scale(1)'
                        }}>
                            {avatarLetter}
                        </div>
                        <p style={{ marginTop: '16px', fontSize: '13px', color: '#86868B', letterSpacing: '0.5px' }}>系统默认头像</p>
                    </div>

                    <div className="input-group" style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', color: '#1D1D1F', fontWeight: '500', marginBottom: '8px' }}>用户昵称</label>
                        <input 
                            type="text" 
                            placeholder="请输入您的昵称..." 
                            value={nickname} 
                            onChange={e => setNickname(e.target.value)}
                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #D2D2D7', background: '#F5F5F7', fontSize: '15px', transition: 'border 0.2s', outline: 'none' }}
                            onFocus={(e) => e.target.style.border = '1px solid #0071E3'}
                            onBlur={(e) => e.target.style.border = '1px solid #D2D2D7'}
                        />
                    </div>

                    <div className="input-group" style={{ marginBottom: '32px' }}>
                        <label style={{ display: 'block', fontSize: '14px', color: '#1D1D1F', fontWeight: '500', marginBottom: '8px' }}>出生日期</label>
                        <input 
                            type="date" 
                            value={birthday} 
                            onChange={e => setBirthday(e.target.value)}
                            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #D2D2D7', background: '#F5F5F7', fontSize: '15px', transition: 'border 0.2s', outline: 'none', fontFamily: 'inherit' }}
                            onFocus={(e) => e.target.style.border = '1px solid #0071E3'}
                            onBlur={(e) => e.target.style.border = '1px solid #D2D2D7'}
                        />
                    </div>

                    {errorMsg && (
                        <div style={{ padding: '12px', background: '#FEE2E2', color: '#EF4444', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
                            {errorMsg}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        style={{ 
                            width: '100%', 
                            padding: '16px', 
                            background: isLoading ? '#99C7F4' : '#0071E3', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '12px', 
                            fontSize: '16px', 
                            fontWeight: '500', 
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'background 0.2s',
                            boxShadow: '0 4px 12px rgba(0,113,227,0.2)'
                        }}
                    >
                        {isLoading ? '保存中...' : '保存并进入系统'}
                    </button>
                </form>
            </div>
        </div>
    );
}
