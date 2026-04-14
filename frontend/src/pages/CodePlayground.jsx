import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ErrorPage from './ErrorPage';
import ThreadZone from '../components/ThreadZone';
import TagPill from '../components/TagPill';
import { macAlert, macConfirm } from '../components/MacModal';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { autocompletion } from '@codemirror/autocomplete';
import { indentUnit } from '@codemirror/language';
import { leetcodeCompletionSource } from '../utils/leetcodeCompletions';

const Vditor = window.Vditor;

// 题解弹窗内嵌编辑器
const SolutionEditor = ({ onInstanceReady }) => {
    React.useEffect(() => {
        const vditor = new Vditor('solution-modal-editor', {
            height: 300,
            mode: 'ir',
            placeholder: '写下你的题解...',
            cache: { enable: false },
            toolbar: [
                'headings', 'bold', 'italic', '|',
                'quote', 'list', 'ordered-list', '|',
                'code', 'inline-code', 'link', 'table'
            ],
            after: () => {
                onInstanceReady(vditor);
            }
        });
        return () => {
            try { vditor.destroy(); } catch (e) {}
        };
    }, []);
    return <div id="solution-modal-editor" style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}></div>;
};

export default function CodePlayground() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [article, setArticle] = useState(null);
    const [user, setUser] = useState(null);
    const [isError, setIsError] = useState(false);
    const [codeContent, setCodeContent] = useState("");
    
    // 初始化登录身份嗅探
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if(token) {
            axios.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
                 .then(res => setUser(res.data))
                 .catch(() => {});
        }
    }, []);
    
    // Pyodide Core
    const [leftTab, setLeftTab] = useState('description');
    const [solutions, setSolutions] = useState([]);
    const [viewingSolution, setViewingSolution] = useState(null); // 内联渲染题解
    
    // 题解发布弹窗
    const [showSolutionModal, setShowSolutionModal] = useState(false);
    const [solutionTitle, setSolutionTitle] = useState('');
    const [solutionVditor, setSolutionVditor] = useState(null);
    const [isPublishingSolution, setIsPublishingSolution] = useState(false);
    
    // Pyodide Core
    const [pyodide, setPyodide] = useState(null);
    const [isPyodideLoading, setIsPyodideLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);
    
    const [terminalOutput, setTerminalOutput] = useState("RewardHacking VM (Wasm Edge Sandbox) Ready.\nWelcome to Python VVM environment.\n\nadmin@local:~/workspace$ ");
    // ====== [代码独立静脉自动防抖重连器 & 题解草稿仓储库] ======
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [isAutosaving, setIsAutosaving] = useState(false);
    const [solutionDrafts, setSolutionDrafts] = useState([]);
    const [isSolDraftOpen, setIsSolDraftOpen] = useState(false);
    const [showSolutionExitPrompt, setShowSolutionExitPrompt] = useState(false);

    const fetchSolutionDrafts = () => {
        const token = localStorage.getItem('access_token');
        if(!token) return;
        axios.get('/api/drafts/?category=solution', { headers: { Authorization: `Bearer ${token}` } })
             .then(res => setSolutionDrafts(res.data)).catch(console.error);
    };

    // 原生被废除：这里现在合并到下方统一通过 Promise.all 决断生命周期
    const fetchDraftLogic = () => {
        const token = localStorage.getItem('access_token');
        if(!token) return Promise.resolve(null);
        return axios.get(`/api/drafts/?category=code&target_id=${id}&_t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => (res.data && res.data.length > 0) ? res.data[0] : null)
            .catch(() => null);
    };

    // 生命周期挂载：最新一代【复合防抖光速存档盘】
    useEffect(() => {
        if(!codeContent || codeContent === "# Write your code here" || codeContent.trim() === '') return;
        
        // 【维度一】：毫秒级极速本地落盘，绝不动用网路通道资源
        localStorage.setItem(`RH_AutoSave_${id}`, codeContent);

        // 【维度二】：感知型无缝静默防抖 (Debounce 2秒)，打字不断不发，一旦停下立马捕获云端
        const timer = setTimeout(() => {
            const token = localStorage.getItem('access_token');
            setIsAutosaving(true);
            axios.post('/api/drafts/', {
                title: "CodeAutoSave", content: codeContent, tags: "", category: "code", target_id: id
            }, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                const tm = res.data.updated_at;
                setLastSavedTime(tm.includes(' ') ? tm.split(' ')[1] : tm);
            })
            .catch(console.error).finally(()=>setIsAutosaving(false));
        }, 2000); 

        // 数据变动产生的组件再次执行将会摧毁上一轮还没来得及走完的 timer，达成防抖锁闭环
        return () => clearTimeout(timer);
    }, [codeContent, id]);

    // ========= [题解弹窗的草稿防御机制] =========
    const handleCloseSolutionModal = () => {
        if(!solutionVditor) { setShowSolutionModal(false); return; }
        const currentContent = solutionVditor.getValue();
        if(!solutionTitle.trim() && !currentContent.trim() && currentContent !== '\n') {
            setShowSolutionModal(false); return;
        }
        setShowSolutionExitPrompt(true); // 转为弹出警告
    };

    const handleSaveSolutionDraft = async (triggerClose = false) => {
        const content = solutionVditor ? solutionVditor.getValue() : '';
        const token = localStorage.getItem('access_token');
        try {
            await axios.post('/api/drafts/', {
                title: solutionTitle, content, tags: "", category: "solution", target_id: null
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchSolutionDrafts();
            if(triggerClose) { setShowSolutionExitPrompt(false); setShowSolutionModal(false); }
            else macAlert("草稿保存成功，请在发布前妥善保留。", "保存成功");
        } catch(err) {
            macAlert(err.response?.data?.detail || "草稿保存失败：网络连接异常！", "保存失败");
        }
    };

    const handleApplySolutionDraft = (d) => {
        macConfirm("加载草稿", "确定加载该历史草稿吗？当前未保存的输入将被覆盖。", () => {
            setSolutionTitle(d.title);
            if(solutionVditor) solutionVditor.setValue(d.content);
            setIsSolDraftOpen(false);
        });
    };

    const handleDeleteSolutionDraft = (e, draft_id) => {
        e.stopPropagation();
        macConfirm("删除确认", "确定要永久删除这篇草稿吗？此操作无法恢复。", async () => {
            try {
                await axios.delete(`/api/drafts/${draft_id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
                fetchSolutionDrafts();
            } catch(err) {}
        });
    };

    const previewRef = useRef(null);

    // [LeetCode 级物理滑轨引擎]
    const [leftWidth, setLeftWidth] = useState(35);
    const isResizingRef = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizingRef.current) return;
            const newPct = (e.clientX / window.innerWidth) * 100;
            if (newPct >= 20 && newPct <= 75) setLeftWidth(newPct);
        };

        const handleMouseUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDown = (e) => {
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    // 1. 获取文章题目数据并结合靶场打卡草稿统一裁决初值
    useEffect(() => {
        const articlePromise = axios.get(`/api/articles/code/${id}`).then(res => res.data);
        
        Promise.all([fetchDraftLogic(), articlePromise]).then(([draft, articleData]) => {
            document.title = `${articleData.title} - RewardHacking`;
            setArticle(articleData);
            if (previewRef.current && window.Vditor) {
                window.Vditor.preview(previewRef.current, articleData.content, {
                    theme: { current: 'light' },
                    hljs: { style: 'github' } 
                });
            }
            
            // 【终极裁决】：绝不由于闭包覆盖，草稿至上，模板保底。
            const localFallback = localStorage.getItem(`RH_AutoSave_${id}`);
            
            if (draft && draft.content) {
                if(localFallback && localFallback.length > draft.content.length) {
                     setCodeContent(localFallback);
                     setLastSavedTime("已恢复本地未同步记录");
                } else {
                     setCodeContent(draft.content);
                     const tm = draft.updated_at;
                     setLastSavedTime(tm.includes(' ') ? tm.split(' ')[1] : tm);
                }
            } else if (localFallback) {
                setCodeContent(localFallback);
                setLastSavedTime("已恢复本地记录");
            } else {
                setCodeContent(articleData.code_template || "# Write your code here\n");
            }
        }).catch(err => {
            console.error("查题或恢复草稿失败:", err);
            setIsError(true);
        });

        // 题解弹层草稿可以顺便异步拉取
        fetchSolutionDrafts();
    }, [id, navigate]);

        useEffect(() => {
        if (leftTab === 'solutions') {
            if (solutions.length === 0) {
                axios.get(`/api/articles/code/${id}/solutions`).then(res => setSolutions(res.data)).catch(console.error);
            }
            if (viewingSolution) setViewingSolution(null);
        }
    }, [leftTab, id]);

    if (isError) {
        return <ErrorPage code={404} message="NON-EXECUTABLE ENTITY" />;
    }

    // 2. 生命初始唤醒庞大的 Pyodide Wasm 机体 (极度延迟按需懒加载策略)
    useEffect(() => {
        let isMounted = true;
        async function initPyodide() {
            try {
                // 如果未曾装载过，此时才向系统注射这套巨大的 Wasm 外挂骨架
                if (!window.loadPyodide) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        // 强制截回内网资源，不再让系统忍受数十兆跨洋调取的死亡迟滞
                        script.src = '/vendor/pyodide/pyodide.js';
                        script.async = true;
                        script.onload = resolve;
                        script.onerror = () => reject(new Error("本地引擎文件损毁或挂载异常"));
                        document.body.appendChild(script);
                    });
                }
                
                // 接管全局黑体输出管道 (注意这里的执行输出不换行，直接抛回)
                const pyodideInstance = await window.loadPyodide({
                    indexURL: "/vendor/pyodide/",
                    stdout: (text) => setTerminalOutput(prev => prev + text + '\n'),
                    stderr: (text) => setTerminalOutput(prev => prev + '[ERROR] ' + text + '\n')
                });
                
                if (isMounted) {
                    setPyodide(pyodideInstance);
                    setIsPyodideLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setTerminalOutput("[ERROR] Python Wasm 沙盒加载失败。请检查网络。");
            }
        }
        initPyodide();
        return () => { isMounted = false; };
    }, []);

    // 内联题解内容 Vditor 渲染桥
    useEffect(() => {
        if (viewingSolution && Vditor) {
            const el = document.getElementById('solution-preview-container');
            if (el) {
                Vditor.preview(el, viewingSolution.content, {
                    theme: { current: 'light' },
                    hljs: { style: 'github' }
                });
            }
        }
    }, [viewingSolution]);

    // 3. 运行代码逻辑
    const executeCode = async () => {
        if (!pyodide || isExecuting) return;
        if (!codeContent.trim()) { 
            setTerminalOutput(prev => prev + "python3 solution.py\n\n[Exception]: File is empty or missing content.\n\nadmin@local:~/workspace$ "); 
            return; 
        }
        setIsExecuting(true);
        
        setTerminalOutput(prev => prev + "python3 solution.py\n");
        
        const startTime = performance.now();
        try {
            await pyodide.runPythonAsync(codeContent);
            const duration = (performance.now() - startTime).toFixed(1);
            setTerminalOutput(prev => prev + `\n[Process completed in ${duration}ms]\nadmin@local:~/workspace$ `);
        } catch (err) {
            // 解析 err 获取不包含长长框架栈的部分（如果有需要的话直接吐原生）
            setTerminalOutput(prev => prev + `\n\n${err.toString()}\n\n[Process completed with exit code 1]\nadmin@local:~/workspace$ `);
        } finally {
            setIsExecuting(false);
        }
    };

    // 题解发布
    const handlePublishSolution = async () => {
        if (!solutionVditor) return;
        const content = solutionVditor.getValue();
        if (!solutionTitle.trim() || !content.trim()) return macAlert('发布失败：标题和代码内容不能为空。', '内容缺失');
        setIsPublishingSolution(true);
        try {
            const payload = { title: solutionTitle, content, category: 'solution', visibility: 'public', tags: '' };
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } };
            await axios.post(`/api/articles/code/${id}/solutions`, payload, config);
            const res = await axios.get(`/api/articles/code/${id}/solutions`);
            setSolutions(res.data);
            setShowSolutionModal(false);
            setSolutionTitle('');
            setLeftTab('solutions');
        } catch (err) {
            const detail = err.response?.data?.detail;
            macAlert(typeof detail === 'string' ? detail : (JSON.stringify(detail) || '发布失败或网络错误。'), "发布失败");
        } finally {
            setIsPublishingSolution(false);
        }
    };

    // 权限制裁集成 (补齐丢失的物理消除权限)
    const hasAdminRights = user && article && (user.role === 'admin' || user.id === article.author_id);
    const handleDeleteClick = () => {
        macConfirm("不可挽回的消除动作", "您即将要把这道题设从题库及靶场的深渊中彻底抹除，包括它的标签、草稿和一切信息，此操作无可挽回。确定要继续吗？", async () => {
            try {
                await axios.delete(`/api/articles/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
                navigate('/');
            } catch (error) {
                console.error("执行毁损动作失败：", error);
                macAlert(error.response?.data?.detail || "无法摧毁靶标，您可能越权或网络不稳。", "抹除失败");
            }
        });
    };

    // 4. 定制纯血 TextArea 支持软 Tab (2 spaces) 及缩进锁定
    const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            // 填装四个空格作为强缩进约束
            target.value = value.substring(0, start) + "    " + value.substring(end);
            target.selectionStart = target.selectionEnd = start + 4;
            setCodeContent(target.value);
        }
    };

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
            {/* 顶层航天器导航舱复用标准 Header 质感 */}
            <header className="zhi-header" style={{ position: 'relative', borderBottom: '1px solid #E5E7EB', zIndex: 10, flexShrink: 0, height: '56px' }}>
                <div className="zhi-header-inner" style={{ padding: '0 24px', maxWidth: 'none' }}>
                    <nav className="zhi-nav">
                        <div className="zhi-logo mac-reading-back" onClick={() => navigate('/')}>
                            ← 首页 
                        </div>
                        <span style={{ marginLeft: '16px', fontWeight: 600, color: '#1D1D1F', fontSize: '15px' }}>
                            {article?.title || '加载题目...'}
                        </span>
                    </nav>
                    <div className="zhi-actions" style={{ display: 'flex', alignItems: 'center' }}>
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
                                    title="删除该题目" 
                                    style={{ cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }} 
                                    onClick={handleDeleteClick}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </span>
                            </div>
                        )}
                        <button 
                            onClick={executeCode} 
                            disabled={isPyodideLoading || isExecuting}
                            className="zhi-btn-primary"
                            style={{
                                background: isExecuting ? '#E5E7EB' : '#1D1D1F',
                                color: isExecuting ? '#86868B' : '#FFF',
                                border: 'none', borderRadius: '6px', padding: '6px 20px', fontSize: '13px',
                                fontWeight: '600', cursor: (isPyodideLoading || isExecuting) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', boxShadow: 'none'
                            }}
                        >
                            {isPyodideLoading ? 'Wasm 启动中...' : isExecuting ? '引力场解析中...' : '▶ 执行沙箱 (Run)'}
                        </button>
                    </div>
                </div>
            </header>

            {/* 双阵列深渊 */}
            <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
                {/* 左翼：多维战局分析面板 */}
                <div style={{ width: `calc(${leftWidth}% - 4px)`, display: 'flex', flexDirection: 'column', background: '#FAFAFC' }}>
                    {/* 内置 Tab 滑轨 */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', background: '#F5F5F7', padding: '0 8px', flexShrink: 0 }}>
                        {[
                            { id: 'description', label: '题目' },
                            { id: 'solutions', label: '题解' },
                            { id: 'discussion', label: '评论' }
                        ].map(t => (
                            <div 
                                key={t.id}
                                onClick={() => setLeftTab(t.id)}
                                style={{
                                    padding: '12px 16px', fontSize: '13px', fontWeight: leftTab === t.id ? 600 : 500,
                                    color: leftTab === t.id ? '#1D1D1F' : '#86868B',
                                    borderBottom: leftTab === t.id ? '2px solid #0071E3' : '2px solid transparent',
                                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                                }}
                            >
                                {t.label} 
                                {t.id==='discussion' && article?.comments_count > 0 && <span style={{marginLeft: '6px', background: '#E3E3E8', padding: '2px 6px', borderRadius: '10px', fontSize: '10px'}}>{article.comments_count}</span>}
                            </div>
                        ))}
                    </div>
                    {/* 内容展示流域 */}
                    <div style={{ flex: 1, padding: '24px 34px', overflowY: 'auto' }}>
                        {/* 题目层：用 display 控制保证 Vditor 的 Ref 生命周期不断裂，绝非三元切换销毁！ */}
                        <div style={{ display: leftTab === 'description' ? 'block' : 'none', paddingBottom: '32px' }}>
                            <div ref={previewRef} className="vditor-reset" style={{ fontSize: '15px' }} />
                            {article && (
                                <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {article.tags ? article.tags.split(',').filter(Boolean).map((t, idx) => <TagPill key={idx} text={t} />) : null}
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', fontSize: '12.5px', color: '#86868B', fontWeight: 500 }}>
                                        <span>作者：{article.author_name || '作者'}</span>
                                        <span>发布于：{article.created_at.substring(0, 10)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {leftTab === 'solutions' && (
                            <div className="mac-solutions-zone" style={{ animation: 'mac-tag-fade-in 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                {!viewingSolution ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', color: '#1D1D1F' }}>题解列表 ({solutions.length})</h3>
                                            <button onClick={() => setShowSolutionModal(true)} className="mac-btn-outline" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #0071E3', color: '#0071E3', cursor: 'pointer', background: 'transparent' }}>发布题解</button>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                                            {solutions.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#86868B', fontSize: '13px' }}>暂无题解。</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    {solutions.map(s => (
                                                        <div key={s.id} onClick={() => setViewingSolution(s)} style={{ background: '#FFF', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'box-shadow 0.2s' }} onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'} onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
                                                            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1D1D1F', marginBottom: '6px' }}>{s.title}</div>
                                                            <div style={{ fontSize: '13px', color: '#86868B', display: 'flex', justifyContent: 'space-between' }}>
                                                                <span>{s.created_at.substring(0, 10)}</span>
                                                                <span>阅读 {s.views_count} · 讨论 {s.comments_count}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', cursor: 'pointer', color: '#86868B', fontSize: '13px', fontWeight: 500 }} onClick={() => setViewingSolution(null)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><path d="M19 12H6M12 5l-7 7 7 7"/></svg>
                                            返回题解列表
                                        </div>
                                        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600, color: '#1D1D1F' }}>{viewingSolution.title}</h2>
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#86868B', marginBottom: '24px' }}>
                                            <span>发布于 {viewingSolution.created_at.substring(0, 10)}</span>
                                            <span>阅读 {viewingSolution.views_count}</span>
                                            <span>讨论 {viewingSolution.comments_count}</span>
                                        </div>
                                        <div id="solution-preview-container" className="vditor-reset" style={{ fontSize: '14px', flexShrink: 0, paddingBottom: '160px' }}></div>
                                        {/* 隔离式的局部微生态评论区挂载 */}
                                        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
                                            <ThreadZone 
                                                articleId={viewingSolution.id} 
                                                articleAuthorId={viewingSolution.author_id} 
                                                onCommentAdded={() => setViewingSolution({...viewingSolution, comments_count: viewingSolution.comments_count + 1})}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {leftTab === 'discussion' && article && (
                            <ThreadZone 
                                articleId={id} 
                                articleAuthorId={article.author_id} 
                                onCommentAdded={() => setArticle({...article, comments_count: article.comments_count + 1})}
                            />
                        )}
                    </div>
                </div>
                
                {/* 中控护卫滑轨：工业级可变物理控制柄 */}
                <div 
                    onMouseDown={handleMouseDown}
                    style={{
                        width: '8px', 
                        background: '#FAFAFC', 
                        cursor: 'col-resize', 
                        borderLeft: '1px solid #E5E7EB',
                        borderRight: '1px solid #E5E7EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        flexShrink: 0
                    }}
                >
                    {/* 微型防滑反光纹理 */}
                    <div style={{ width: '2px', height: '24px', background: '#D2D2D7', borderRadius: '1px' }}></div>
                </div>

                {/* 右翼：带鱼屏编辑中枢及终端回馈池 */}
                <div style={{ width: `calc(${100 - leftWidth}% - 4px)`, display: 'flex', flexDirection: 'column', background: '#1E1E1E' }}>
                    {/* 顶级 VSCode 极客范：深空视界顶托档栏 */}
                    <div style={{ height: '40px', background: '#252526', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #161616', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1) z-index: 10' }}>
                        <div style={{ display: 'flex', gap: '8px', marginRight: '24px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FF5F56' }}></div>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFBD2E' }}></div>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27C93F' }}></div>
                        </div>
                        <div style={{ background: '#1E1E1E', color: '#FFF', fontSize: '12.5px', padding: '0 20px', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px', height: '100%', borderBottom: '2px solid #38BDF8', borderRight: '1px solid #252526', borderLeft: '1px solid #252526' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFBD2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            <span style={{letterSpacing: '0.5px'}}>solution.py</span>
                        </div>
                        <div style={{ flex: 1 }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#5C6370', fontSize: '11px', fontWeight: 600 }}>
                            {isAutosaving ? '保存中...' : (lastSavedTime ? `✓ 已保存于 ${lastSavedTime}` : '等待保存')}
                        </div>
                    </div>

                    <div style={{ flex: 6, position: 'relative', borderBottom: '1px solid #161616', overflow: 'hidden' }}>
                        {/* 极简化核心解析大盘：CodeMirror 原盘挂载，断除虚假行号魔改 */}
                        <CodeMirror
                            value={codeContent}
                            height="100%"
                            theme={vscodeDark}
                            extensions={[
                                python(), 
                                autocompletion({ override: [leetcodeCompletionSource] }),
                                indentUnit.of("    ")
                            ]}
                            onChange={(val) => setCodeContent(val)}
                            style={{ 
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                                fontSize: '14.5px', fontFamily: '"SF Mono", "Fira Code", Consolas, monospace'
                            }}
                            basicSetup={{
                                autocompletion: true, // 核心驱动点火
                                tabSize: 4,                  
                                lineNumbers: true,           
                                foldGutter: false,           
                                highlightActiveLine: false,   
                                highlightActiveLineGutter: false, 
                                indentOnInput: true          
                            }}
                        />
                    </div>

                    {/* 真正的 UNIX 级黑客终端阵列区 */}
                    <div className="mac-terminal-zone" style={{ flex: 4, background: '#111111', padding: '16px 24px', overflowY: 'auto', borderTop: '1px solid #222' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ color: '#4A5059', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', display: 'flex', alignItems: 'center', textTransform: 'uppercase' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                                Terminal — bash
                            </div>
                            <div style={{ color: '#6A717D', fontSize: '10px', fontWeight: 500 }}>
                                * 当前终端仅用于展示输出，无法交互
                            </div>
                        </div>
                        {/* 将内容转化为带边界区隔的终端瀑布流排版 */}
                        <pre style={{
                            margin: 0, color: '#D4D4D4', fontSize: '13.5px', 
                            fontFamily: '"SF Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, monospace',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.5'
                        }}>
                            {terminalOutput}
                            {!isExecuting && <span style={{
                                display: 'inline-block', width: '8px', height: '15px', background: '#A9A9A9',
                                animation: 'mac-terminal-blink 1s step-end infinite', verticalAlign: 'middle', marginLeft: '2px', marginBottom: '2px'
                            }}></span>}
                        </pre>
                    </div>
                </div>
            </div>

            {/* 题解发布弹窗 */}
            {showSolutionModal && (
                <div className="mac-modal-overlay" onClick={() => setShowSolutionModal(false)}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', width: '680px', maxWidth: '90vw',
                        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'mac-modal-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards'
                    }} onClick={e => e.stopPropagation()}>
                        {/* 弹窗头部 */}
                        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #F0F0F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontSize: '16px', fontWeight: 600, color: '#1D1D1F' }}>发布题解战报</span>
                                {/* 草稿箱内敛微交互下拉 */}
                                <div style={{ position: 'relative' }}>
                                    <span onClick={()=>setIsSolDraftOpen(!isSolDraftOpen)} style={{ fontSize: '12px', color: '#0071E3', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,113,227,0.06)', padding: '4px 10px', borderRadius: '12px' }}>
                                        草稿箱 ({solutionDrafts.length}/5)
                                    </span>
                                    {isSolDraftOpen && (
                                        <div style={{position: 'absolute', top: '28px', left: 0, width: '220px', background: '#FFF', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #EDEDF2', zIndex: 100, overflow: 'hidden'}}>
                                            {solutionDrafts.length === 0 ? <div style={{padding: '24px 16px', color: '#86868B', fontSize: '13px', textAlign: 'center'}}>您还没有缓存过的题解</div> :
                                                solutionDrafts.map(d => (
                                                    <div key={d.id} className="mac-draft-item" onClick={() => handleApplySolutionDraft(d)} style={{ margin: '4px 8px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingRight: '12px' }}>
                                                            <span className="draft-title">{d.title || '无标题战报'}</span>
                                                            <span className="draft-time">{d.updated_at}</span>
                                                        </div>
                                                        <button className="draft-delete-btn" onClick={(e) => handleDeleteSolutionDraft(e, d.id)} title="彻底删除此草稿">
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: '#86868B', lineHeight: 1 }} onClick={handleCloseSolutionModal}>✕</span>
                        </div>
                        {/* 标题输入 */}
                        <div style={{ padding: '12px 24px 0' }}>
                            <input
                                placeholder="题解标题"
                                value={solutionTitle}
                                onChange={e => setSolutionTitle(e.target.value)}
                                style={{
                                    width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px',
                                    padding: '8px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#0071E3'}
                                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                            />
                        </div>
                        {/* Vditor 编辑器 */}
                        <div style={{ padding: '12px 24px', flex: 1, minHeight: 0, overflow: 'auto' }}>
                            <SolutionEditor onInstanceReady={setSolutionVditor} />
                        </div>
                        {/* 底部操作栏 */}
                        <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F0F0F5', display: 'flex', justifyContent: 'flex-end', gap: '10px', position: 'relative' }}>
                            <button onClick={handleCloseSolutionModal} style={{
                                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                                border: '1px solid #D2D2D7', background: '#fff', color: '#424245', cursor: 'pointer'
                            }}>取消退出</button>
                            <button onClick={() => handleSaveSolutionDraft(false)} style={{
                                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                                border: '1px solid #0071E3', background: '#e5f1fa', color: '#0071E3', cursor: 'pointer'
                            }}>保存草稿</button>
                            <button onClick={handlePublishSolution} disabled={isPublishingSolution} style={{
                                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                border: 'none', background: isPublishingSolution ? '#D2D2D7' : '#0071E3',
                                color: '#fff', cursor: isPublishingSolution ? 'not-allowed' : 'pointer'
                            }}>{isPublishingSolution ? '网络传输中...' : '核对发布题解'}</button>

                            {/* [核爆防御] 题解内部出站拦截器 */}
                            {showSolutionExitPrompt && (
                                <div style={{
                                    position: 'absolute', right: '0', bottom: '60px', width: '320px', background: '#1D1D1F', borderRadius: '12px', padding: '16px',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)', color: '#FFF', zIndex: 10, animation: 'mac-tag-fade-in 0.2s', textAlign: 'left'
                                }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#FF5F56' }}>是否保存草稿？</h4>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#A1A1A6', lineHeight: 1.4 }}>当前内容尚未保存，退出将丢失更改。</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleSaveSolutionDraft(true)} style={{ flex: 1, padding: '6px', background: '#0071E3', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>存草稿并退出</button>
                                        <button onClick={() => { setShowSolutionExitPrompt(false); setShowSolutionModal(false); }} style={{ flex: 1, padding: '6px', background: 'transparent', color: '#FF5F56', border: '1px solid #FF5F56', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>不保存退出</button>
                                    </div>
                                    <div onClick={() => setShowSolutionExitPrompt(false)} style={{ textAlign: 'center', fontSize: '11px', color: '#86868B', marginTop: '12px', cursor: 'pointer' }}>取消</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
