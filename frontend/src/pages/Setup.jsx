import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Setup() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [birthday, setBirthday] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    // UI状态机: 'ACCOUNT_FORM' -> 'PROFILE_FORM' -> 'INSTALLING' -> 'SUCCESS'
    const [viewState, setViewState] = useState('ACCOUNT_FORM');
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [ripples, setRipples] = useState([]);
    
    const navigate = useNavigate();

    const addRipple = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const diameter = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - diameter / 2;
        const y = e.clientY - rect.top - diameter / 2;
        setRipples(prev => [...prev, { x, y, size: diameter, id: Date.now() }]);
    };

    const handleAccountSubmit = (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!username || !password) {
            setErrorMsg('账号和密码不能为空。');
            return;
        }
        // 第一步完成，平滑进入档案补充步骤
        setViewState('PROFILE_FORM');
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!nickname.trim() || !birthday) {
            setErrorMsg('请完善向导中的所有信息，包括昵称和生日。');
            return;
        }
        setViewState('INSTALLING');
        
        // 真实且毫无包装的进度节点反馈
        const phases = [
            { p: 15, text: '检查数据库是否已有管理员账号...' },
            { p: 35, text: '构建管理员角色实体数据...' },
            { p: 65, text: '使用 bcrypt 加密管理员密码...' },
            { p: 90, text: '提交数据入库并永久锁定本界面入口...' }
        ];
        
        let phaseIdx = 0;
        setProgressText('启动初阶配置程序...');
        setProgress(5);
        
        // 视觉模拟加载（每450毫秒更替以体现系统运转过程）
        const progInterval = setInterval(() => {
            if (phaseIdx < phases.length) {
                setProgress(phases[phases.length - 1 - phaseIdx]?.p || 90);
                setProgressText(phases[phaseIdx].text);
                setProgress(phases[phaseIdx].p);
                phaseIdx++;
            }
        }, 450);

        try {
            await axios.post('/api/auth/setup_admin', { 
                username, 
                password,
                nickname: nickname.trim(),
                birthday
            });
            
            // 为了让视觉状态流畅走完，哪怕后端请求只耗费1毫秒，我们也等待2.2秒
            setTimeout(() => {
                clearInterval(progInterval);
                setProgress(100);
                setProgressText('全部节点配置就绪！');
                setViewState('SUCCESS');
            }, 2300);

        } catch (err) {
            clearInterval(progInterval);
            setErrorMsg(err.response?.data?.detail || "系统初始化遇到严重异常。");
            setViewState('FORM');
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="login-card" style={{ maxWidth: '640px' }}>
                <div className="logo-area" style={{ marginBottom: '20px' }}>
                    <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '32px', color: '#1D1D1F', letterSpacing: '-1px', margin: '0 0 5px 0' }}>
                        <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: '0', left: '0', width: '22px', height: '22px', background: '#38BDF8', borderRadius: '6px' }}></div>
                            <div style={{ position: 'absolute', bottom: '0', right: '0', width: '22px', height: '22px', background: '#0071E3', borderRadius: '6px', zIndex: 1, boxShadow: '-2px -2px 0 white' }}></div>
                        </div>
                        <span style={{ fontWeight: '900' }}>Reward<span style={{ color: '#0071E3' }}>Hacking</span></span>
                    </h1>
                    <p className="subtitle">系统配置向导</p>
                </div>

                <div className="setup-steps">
                    {/* 根据状态动态高亮进度标识 */}
                    <div className={`step ${viewState === 'ACCOUNT_FORM' || viewState === 'PROFILE_FORM' || viewState === 'INSTALLING' || viewState === 'SUCCESS' ? 'active' : ''}`} style={{ background: viewState === 'ACCOUNT_FORM' ? '#3B82F6' : '', color: viewState === 'ACCOUNT_FORM' ? 'white' : '' }}>
                        {viewState === 'ACCOUNT_FORM' ? '● 配置账号' : '✓ 配置账号'}
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${viewState === 'PROFILE_FORM' || viewState === 'INSTALLING' || viewState === 'SUCCESS' ? 'active' : ''}`} style={{ background: viewState === 'PROFILE_FORM' ? '#3B82F6' : '', color: viewState === 'PROFILE_FORM' ? 'white' : '' }}>
                        {viewState === 'PROFILE_FORM' ? '● 完善信息' : viewState === 'ACCOUNT_FORM' ? '完善信息' : '✓ 完善信息'}
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${viewState === 'INSTALLING' || viewState === 'SUCCESS' ? 'active' : ''}`} style={{ background: viewState === 'INSTALLING' ? '#3B82F6' : '', color: viewState === 'INSTALLING' ? 'white' : ''}}>
                        {viewState === 'SUCCESS' ? '✓ 安装部署' : viewState === 'INSTALLING' ? '● 安装部署' : '安装部署'}
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${viewState === 'SUCCESS' ? 'active' : ''}`} style={{ background: viewState === 'SUCCESS' ? '#3B82F6' : '', color:  viewState === 'SUCCESS' ? 'white' : '' }}>
                        {viewState === 'SUCCESS' ? '● 跳转验证' : '完成启航'}
                    </div>
                </div>
                
                {viewState === 'ACCOUNT_FORM' && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '25px', marginTop: '10px' }}>
                            <h2 style={{ fontSize: '20px', marginBottom: '5px' }}>配置管理员账号</h2>
                            <p style={{ fontSize: '13px', color: '#8AA2BA' }}>请为系统设置唯一的管理员登录凭证</p>
                        </div>
                        
                        <form className="login-form" onSubmit={handleAccountSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <div className="input-group">
                                <label>管理员账号</label>
                                <input type="text" placeholder="请输入管理员账号" value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>密码</label>
                                <input type="password" placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>

                            {errorMsg && <div className="error-msg">{errorMsg}</div>}

                            <button type="submit" className="submit-btn" onMouseDown={addRipple} style={{ marginTop: '20px' }}>
                                下一步
                                {ripples.map(r => ( <span key={r.id} className="ripple-span" style={{ left: r.x, top: r.y, width: r.size, height: r.size }} onAnimationEnd={() => setRipples(prev => prev.filter(ripple => ripple.id !== r.id))}/>))}
                            </button>
                        </form>
                    </>
                )}

                {viewState === 'PROFILE_FORM' && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '25px', marginTop: '10px' }}>
                            <h2 style={{ fontSize: '20px', marginBottom: '5px' }}>完善档案信息</h2>
                            <p style={{ fontSize: '13px', color: '#8AA2BA' }}>作为平台的第一位成员，请配置您的对外形象资料</p>
                        </div>
                        
                        <form className="login-form" onSubmit={handleProfileSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <div className="input-group">
                                <label>系统显示昵称</label>
                                <input type="text" placeholder="设置您的系统显示昵称" value={nickname} onChange={e => setNickname(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>出生日期</label>
                                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} required />
                            </div>

                            {errorMsg && <div className="error-msg">{errorMsg}</div>}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button type="button" className="submit-btn" onClick={() => setViewState('ACCOUNT_FORM')} style={{ flex: 1, width: 'auto', background: '#F3F4F6', color: '#374151' }} onMouseDown={addRipple}>
                                    返回
                                    {ripples.map(r => ( <span key={r.id} className="ripple-span" style={{ left: r.x, top: r.y, width: r.size, height: r.size }} onAnimationEnd={() => setRipples(prev => prev.filter(ripple => ripple.id !== r.id))}/>))}
                                </button>
                                <button type="submit" className="submit-btn" onMouseDown={addRipple} style={{ flex: 2, width: 'auto' }}>
                                    确认并初始化系统
                                    {ripples.map(r => ( <span key={r.id} className="ripple-span" style={{ left: r.x, top: r.y, width: r.size, height: r.size }} onAnimationEnd={() => setRipples(prev => prev.filter(ripple => ripple.id !== r.id))}/>))}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {/* 加载中与成功的专属视觉区 */}
                {(viewState === 'INSTALLING' || viewState === 'SUCCESS') && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0 20px 0', minHeight: '160px' }}>
                        <div style={{ width: '80px', height: '80px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: viewState === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', marginBottom: '15px' }}>
                            {viewState === 'SUCCESS' ? (
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            ) : (
                                <svg className="spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M4.93 4.93l2.83 2.83"></path><path d="M16.24 16.24l2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="M4.93 19.07l2.83-2.83"></path><path d="M16.24 7.76l2.83-2.83"></path></svg>
                            )}
                        </div>
                        
                        <h2 style={{ fontSize: '20px', marginBottom: '5px' }}>
                            {viewState === 'SUCCESS' ? '系统配置圆满成功' : '正在装载与环境部署'}
                        </h2>
                        
                        <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${progress}%`, background: viewState === 'SUCCESS' ? 'linear-gradient(90deg, #34D399, #10B981)' : '' }}></div>
                        </div>
                        <div className="progress-text">{progressText}</div>

                        {viewState === 'SUCCESS' && (
                            <button className="submit-btn" style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #34D399, #10B981)' }} onClick={() => navigate('/login')} onMouseDown={addRipple}>
                                点此完成并启动系统
                                {ripples.map(r => ( <span key={r.id} className="ripple-span" style={{ left: r.x, top: r.y, width: r.size, height: r.size }} onAnimationEnd={() => setRipples(prev => prev.filter(ripple => ripple.id !== r.id))}/>))}
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            <style>{`
                .spin { animation: spin 2s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .submit-btn {
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    padding: 12px;
                    border: none;
                    border-radius: 8px;
                    background: #0071E3;
                    color: white;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.3s;
                }
                .submit-btn:hover { background: #0077ED; }
                .error-msg { margin-bottom: 15px; color: #EF4444; font-size: 13px; text-align: center; }
            `}</style>
        </div>
    );
}
