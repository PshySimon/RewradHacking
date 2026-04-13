import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Setup() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    // UI状态机: 'FORM' -> 'INSTALLING' -> 'SUCCESS'
    const [viewState, setViewState] = useState('FORM');
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

    const handleSetup = async (e) => {
        e.preventDefault();
        setErrorMsg('');
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
            await axios.post('/api/auth/setup_admin', { username, password });
            
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
            <div className="login-card" style={{ maxWidth: '500px' }}>
                <div className="logo-area" style={{ marginBottom: '20px' }}>
                    <h1>Prep<span>Master</span></h1>
                    <p className="subtitle">系统配置向导</p>
                </div>

                <div className="setup-steps">
                    {/* 根据状态动态高亮进度标识 */}
                    <div className="step active" style={{ background: viewState === 'FORM' ? '#3B82F6' : '', color: viewState === 'FORM' ? 'white' : '' }}>
                        {viewState === 'FORM' ? '● 配置系统' : '✓ 配置系统'}
                    </div>
                    <div className="step-line"></div>
                    <div className="step active" style={{ background: viewState === 'INSTALLING' ? '#3B82F6' : '', color: viewState === 'INSTALLING' ? 'white' : ''}}>
                        {viewState !== 'SUCCESS' ? '● 安装部署' : '✓ 安装部署'}
                    </div>
                    <div className="step-line"></div>
                    <div className="step active" style={{ background: viewState === 'SUCCESS' ? '#3B82F6' : '', color:  viewState === 'SUCCESS' ? 'white' : '' }}>
                        {viewState === 'SUCCESS' ? '● 跳转验证' : '完成启航'}
                    </div>
                </div>
                
                {viewState === 'FORM' && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '25px', marginTop: '10px' }}>
                            <h2 style={{ fontSize: '20px', marginBottom: '5px' }}>设置管理员</h2>
                            <p style={{ fontSize: '13px', color: '#8AA2BA' }}>请为面经系统设置强有力的唯一管理员账号</p>
                        </div>
                        
                        <form className="login-form" onSubmit={handleSetup}>
                            <div className="input-group">
                                <label>管理员账号</label>
                                <input type="text" placeholder="请输入管理员账号" value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>密码</label>
                                <input type="password" placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>

                            {errorMsg && <div className="error-msg">{errorMsg}</div>}

                            <button type="submit" className="submit-btn" onMouseDown={addRipple} style={{ marginTop: '10px' }}>
                                确认并初始化系统
                                {ripples.map(r => ( <span key={r.id} className="ripple-span" style={{ left: r.x, top: r.y, width: r.size, height: r.size }} onAnimationEnd={() => setRipples(prev => prev.filter(ripple => ripple.id !== r.id))}/>))}
                            </button>
                        </form>
                    </>
                )}

                {/* 加载中与成功的专属视觉区 */}
                {viewState !== 'FORM' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0 20px 0', minHeight: '160px' }}>
                        <div style={{ padding: '20px', background: viewState === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', marginBottom: '15px' }}>
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
            `}</style>
        </div>
    );
}
