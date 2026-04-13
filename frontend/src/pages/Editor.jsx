import React, { useState, useEffect, useRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Editor() {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('knowledge');
    const [isPublishing, setIsPublishing] = useState(false);
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // macOS 风格下拉菜单外部点击关闭护甲
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const categoryMap = { knowledge: '知识', interview: '面经', code: '代码' };

    const vditorRef = useRef(null);
    const [vditorObj, setVditorObj] = useState(null);
    const [isEditorReady, setIsEditorReady] = useState(false);

    useEffect(() => {
        const vditor = new Vditor('vditor-container', {
            // 让卡片脱离固定限制，像一张真实的无限画轴一样随内容向下撑大
            height: 'auto',
            minHeight: window.innerHeight - 220, // 兜底最低高度
            mode: 'ir', // ir 为 Typora 级即时渲染模式
            placeholder: '开始沉浸式的所见即所得执笔...',
            toolbarConfig: {
                pin: true,
            },
            cache: {
                enable: false,
            },
            // 修改原生工具栏，精简掉花哨没用的按钮
            toolbar: [
                'headings', 'bold', 'italic', 'strike', '|',
                'line', 'quote', 'list', 'ordered-list', 'check', '|',
                'code', 'inline-code', 'table', 'link', 'upload', '|',
                'undo', 'redo', 'fullscreen', 'edit-mode'
            ],
            upload: {
                accept: 'image/*',
                url: '/api/upload/image',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('access_token')}`
                },
                format(files, responseText) {
                    // 解析后端传回的 {"url": "..."} 并喂给 vditor 原生的成功回显表
                    let res = {};
                    try { res = JSON.parse(responseText); } catch (e) { }
                    return JSON.stringify({
                        msg: '',
                        code: 0,
                        data: {
                            errFiles: [],
                            succMap: { [res.filename || files[0].name]: res.url }
                        }
                    });
                },
                error(msg) { alert(msg); }
            },
            after: () => {
                // =============== 💉[知乎专属杀毒剂：纯本地护航] ===============
                // 知乎特供图文混排会导致公式彻底炸裂和无端换行，咱们直接在它触碰 Vditor 核心前进行拦截。
                const irContainer = document.querySelector('.vditor-ir');
                if (irContainer) {
                    irContainer.addEventListener('paste', (e) => {
                        const html = e.clipboardData.getData('text/html');
                        // 鹰眼侦测：如果捕捉到类似知乎等带有隐藏 data-tex 的污染型公式 DOM 时（普通网页不触发）
                        if (html && html.includes('data-tex="')) {
                            // 直接切断 Vditor 原本那糟糕透顶的防备，由我们全权接管这一次外科手术式的粘贴！
                            e.preventDefault();
                            e.stopPropagation();

                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');



                            // 抢救一：抓去所有的知乎公式伪装块，强制剥去伪装皮，挖出绝对纯净的 LaTeX 真血！！
                            doc.querySelectorAll('[data-tex]').forEach(node => {
                                let tex = node.getAttribute('data-tex');
                                if (!tex) return;

                                // 1. 斩去冗余：拔除开头或结尾可能带有的知乎脏美元符号或空格
                                tex = tex.replace(/^[\s$]+|[\s$]+$/g, '');

                                // 2. 回归经典+终极边界隔离：Vditor 底层 Lute 引擎如果不吃带有特殊属性的 HTML（会被过滤器抛弃变源码），
                                // 我们就直接给它喂原汁原味的 Markdown 的 $ 和 $$！
                                // 核心奥义：在 $ 前后强制注入一个普通空格和零宽连字符（零宽空格易阻断）\u200B ，强制让该公式与任何周围的汉字、标点绝缘！
                                if (tex.includes('\n') || node.classList.contains('ztext-math_block')) {
                                    // 块级公式必须由换行符隔离
                                    node.outerHTML = `\n\n$$\n${tex}\n$$\n\n`;
                                } else {
                                    // 行内公式：必须使用外部空格包裹！不允许任何标点贴贴！
                                    node.outerHTML = ` \u200B$${tex}$\u200B `;
                                }
                            });

                            // 抢救二：知乎甚至会藏一些没用的、捣乱的不可见 span
                            doc.querySelectorAll('.invisible').forEach(node => node.remove());

                            // 抢救三：斩断“吸血百科词条”！知乎会在专业词汇上自动强加带 SVG 图标的知识链接
                            // 这会导致复制出来的 Markdown 出现恐怖的换行和断裂。直接拔掉只留纯净文本！
                            doc.querySelectorAll('a').forEach(a => {
                                if (a.href && (a.href.includes('zhida.zhihu.com') || a.classList.contains('internal'))) {
                                    const cleanText = a.textContent.trim();
                                    const textNode = doc.createTextNode(cleanText);
                                    a.parentNode.replaceChild(textNode, a);
                                }
                            });

                            // 重新利用浏览器的底牌，强行把解过毒的干净 HTML 插回编辑靶心
                            // Vditor 后置的 MutationObserver 将顺滑无比地消化掉这些不带刺的结构
                            let finalHtml = doc.body.innerHTML;
                            // 大道至简：直接在准备丢给编辑器的最后一行 HTML 源码里加上物理空格！
                            finalHtml = finalHtml.replace(/\$([^\$\n<>]+?)\$/g, ' $ $1 $ ');
                            document.execCommand('insertHTML', false, finalHtml);
                        }
                    }, true); // 抢占最高级捕获权，先斩后奏
                }
                // ====================================================================

                // 强制驻留额外的 600 毫秒，用于彻底排版清理并营造顺滑细腻的入场装载感！
                setTimeout(() => {
                    setIsEditorReady(true);
                    setVditorObj(vditor);
                }, 600);
            }
        });

        // 核心护法神技重启：延时封印外挂！
        const forceHideRef = (e) => {
            setTimeout(() => {
                const hintBoxes = document.querySelectorAll('.vditor-hint');
                hintBoxes.forEach(hintBox => {
                    if (!hintBox.contains(e.target)) {
                        hintBox.style.cssText = 'display: none !important; visibility: hidden; opacity: 0;';
                        hintBox.classList.add('mac-force-hide-hint');
                    }
                });
            }, 80);
        };

        const removeHideRef = (e) => {
            if (e.key === 'Escape') return;
            const hintBoxes = document.querySelectorAll('.vditor-hint');
            hintBoxes.forEach(hintBox => {
                hintBox.style.cssText = '';
                hintBox.classList.remove('mac-force-hide-hint');
            });
        }

        document.addEventListener('mousedown', forceHideRef, true);
        document.addEventListener('keydown', removeHideRef, true);

        return () => {
            document.removeEventListener('mousedown', forceHideRef, true);
            document.removeEventListener('keydown', removeHideRef, true);
            try {
                if (vditor) vditor.destroy();
            } catch (e) {
                console.warn("Vditor destruction bypassed during initial render phase.");
            }
            setVditorObj(null);
        };
    }, []);

    const handlePublish = async () => {
        const content = vditorObj ? vditorObj.getValue() : '';
        if (!title.trim() || !content.trim()) return alert("标题和正文内容不能为空。");

        setIsPublishing(true);
        try {
            await axios.post('/api/articles/', {
                title, content, category, visibility: 'public'
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
            });
            navigate('/');
        } catch (err) {
            alert(err.response?.data?.detail || "文章发布失败，请检查您的网络或权限。");
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="zhi-app">
            <header className="zhi-header">
                <div className="zhi-header-inner">
                    <button className="zhi-btn-text" onClick={() => navigate('/')} style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        ← 返回主页
                    </button>
                    <div style={{ flexGrow: 1 }}></div>
                    <div className="zhi-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

                        {/* Apple 高级定制悬浮下拉菜单，再见厚重的 Select 原生标签！ */}
                        <div className="mac-custom-dropdown" ref={dropdownRef} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                            <div className="mac-dropdown-trigger">
                                <span>发布在：{categoryMap[category]}</span>
                                <svg className={`mac-chevron ${isDropdownOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>

                            {/* 毛玻璃浮力菜单，优雅淡入 */}
                            {isDropdownOpen && (
                                <div className="mac-dropdown-menu">
                                    {Object.entries(categoryMap).map(([key, label]) => (
                                        <div
                                            key={key}
                                            className={`mac-dropdown-item ${category === key ? 'active' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCategory(key);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            {label}
                                            {/* 对勾特效只在选中的选项后出现 */}
                                            {category === key && (
                                                <svg className="mac-check" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M13.3333 4.66667L6 12L2.66666 8.66667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="zhi-btn-primary" onClick={handlePublish} disabled={isPublishing || !vditorObj}>
                            {isPublishing ? '发布中...' : '发布文章'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="zhi-editor-layout">
                <div style={{ paddingBottom: '16px', borderBottom: '1px solid #F0F2F7', marginBottom: '16px' }}>
                    <input
                        className="zhi-title-input"
                        placeholder="请输入文章标题"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{ width: '100%', background: 'transparent' }}
                    />
                </div>

                {/* Apple UI 级顶级内嵌微交互：极度流畅的云端纸飞机风洞实验！ */}
                {!isEditorReady && (
                    <div className="mac-editor-loading">
                        <div className="plane-voyage-box">
                            {/* 呼啸后退的高速气流条（纯视觉营造流线速度感） */}
                            <div className="air-stream stream-1"></div>
                            <div className="air-stream stream-2"></div>
                            <div className="air-stream stream-3"></div>

                            {/* 代表着信息传递、创作输出与飞翔极简速度的定制 SVG 航班 */}
                            <svg className="mac-svg-plane" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 2L11 13" />
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="rgba(0, 122, 255, 0.05)" />
                            </svg>
                        </div>
                        <span style={{ marginTop: '28px', color: '#8E8E93', fontSize: '14px', fontWeight: '500', letterSpacing: '0.02em' }}>正在加载中...</span>
                    </div>
                )}

                {/* 彻底摆脱 UIW 的幽灵，由 Vditor 接管渲染 */}
                <div id="vditor-container" className={`mac-vditor-override ${isEditorReady ? 'ready' : ''}`}></div>
            </div>
        </div>
    );
}
