import React, { useState, useEffect, useRef } from 'react';
const Vditor = window.Vditor;
import 'vditor/dist/index.css';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import JellyCaret from '../components/JellyCaret';
import TagPill from '../components/TagPill';
import { macAlert, macConfirm } from '../components/MacModal';
import { CodeLayout, InterviewLayout, KnowledgeLayout } from '../components/editor-templates';

export default function Editor() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const articleId = searchParams.get('id');
    const solveForId = searchParams.get('solveFor');
    const initialCategory = searchParams.get('category') || 'knowledge';

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState(initialCategory);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [visibility, setVisibility] = useState('public');
    const [isVisDropdownOpen, setIsVisDropdownOpen] = useState(false);
    const visDropdownRef = useRef(null);
    const [initialContent, setInitialContent] = useState('');
    const [codeTemplate, setCodeTemplate] = useState('');

    // 草稿箱护甲核心
    const [drafts, setDrafts] = useState([]);
    const [isDraftDropdownOpen, setIsDraftDropdownOpen] = useState(false);
    const draftDropdownRef = useRef(null);
    const [showExitPrompt, setShowExitPrompt] = useState(false);
    const [draftError, setDraftError] = useState("");

    const fetchDrafts = () => {
        const cat = solveForId ? 'solution' : category;
        const token = localStorage.getItem('access_token');
        if (!token) return;
        // 加入 only_standalone=true，从而将靶场的代码挑战解题缓存碎片隔绝在外，仅展示具有发文骨架的纯正草稿
        axios.get(`/api/drafts/?category=${cat}&only_standalone=true`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setDrafts(res.data)).catch(console.error);
    };

    useEffect(() => {
        fetchDrafts();
    }, [category, solveForId]);

    const handleApplyDraft = (draft) => {
        macConfirm("覆盖确认", "确定加载该历史草稿吗？当前编辑器内的未保存内容将被覆盖。", () => {
            setTitle(draft.title);
            if (draft.tags) setTags(draft.tags.split(',').filter(Boolean));
            if (draft.code_template) setCodeTemplate(draft.code_template);
            if (vditorObj) vditorObj.setValue(draft.content);
            setIsDraftDropdownOpen(false);
        });
    };

    const handleDeleteDraft = (e, draft_id) => {
        e.stopPropagation();
        macConfirm("删除确认", "确定要永久删除这篇草稿吗？此操作无法恢复。", async () => {
            try {
                await axios.delete(`/api/drafts/${draft_id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
                fetchDrafts();
                setDraftError(""); // 一旦删除可以尝试重置错误信息
            } catch (err) { console.error(err); }
        });
    };

    const handleBackClick = () => {
        if (articleId) { navigate(-1); return; } // 已发文修订一般不适用草稿弹窗直接退
        const currentContent = vditorObj ? vditorObj.getValue() : '';
        if (!title.trim() && !currentContent.trim()) {
            navigate('/');
            return;
        }
        setShowExitPrompt(true);
    };

    const handleSaveDraft = async (triggerExit = false) => {
        const content = vditorObj ? vditorObj.getValue() : '';
        try {
            await axios.post('/api/drafts/', {
                title, content, code_template: codeTemplate, tags: tags.join(','), category: solveForId ? 'solution' : category, target_id: solveForId || null
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
            if (triggerExit) navigate('/');
            else {
                macAlert("草稿已成功保存至云端。", "保存成功");
                fetchDrafts();
                setShowExitPrompt(false);
            }
        } catch (err) {
            if (err.response?.status === 400) {
                setDraftError(err.response.data.detail);
            } else {
                macAlert("保存草稿失败：网络连接中断。", "网络错误");
            }
        }
    };


    useEffect(() => {
        if (articleId) {
            axios.get(`/api/articles/${articleId}`)
                .catch(err => {
                    // [穿透逻辑]：如果因为靶标屏蔽墙（代码类题库不允许走常规世界路由）报 404，直接使用暗网高速特供通道重拉一波
                    if (err.response && err.response.status === 404) {
                        return axios.get(`/api/articles/code/${articleId}`);
                    }
                    throw err;
                })
                .then(res => {
                    const data = res.data;
                    document.title = `编修: ${data.title} - RewardHacking`;
                    setTitle(data.title);
                    setCategory(data.category);
                    if (data.tags) setTags(data.tags.split(',').filter(Boolean));
                    if (data.code_template) setCodeTemplate(data.code_template);
                    if (data.visibility) setVisibility(data.visibility);
                    setInitialContent(data.content);
                }).catch(err => {
                    console.error("双通道加载旧文稿均失败或没有权限", err);
                    navigate('/');
                });
        } else {
            document.title = '创作中心 - RewardHacking';
        }
    }, [articleId, navigate]);

    // ================= [鉴权与资料防线] =================
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (!token) { navigate('/login'); return; }
            try {
                const res = await axios.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
                if (!res.data.is_profile_completed) navigate('/onboarding');
            } catch (err) { navigate('/login'); }
        };
        checkAuth();
    }, [navigate]);

    // ================= [Tags 新引擎阵列区] =================
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [isTagInputVisible, setIsTagInputVisible] = useState(false);

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = tagInput.trim().replace(/,/g, '');
            if (val && !tags.includes(val) && tags.length < 10) {
                setTags([...tags, val]);
            }
            setTagInput('');
            setIsTagInputVisible(false); // 闭合药丸触发器
        } else if (e.key === 'Escape') {
            setTagInput('');
            setIsTagInputVisible(false);
        }
    };

    // 如果焦点离开，哪怕不按回车也帮他强行存起来做最后兜底
    const handleTagBlur = () => {
        const val = tagInput.trim().replace(/,/g, '');
        if (val && !tags.includes(val) && tags.length < 10) {
            setTags([...tags, val]);
        }
        setTagInput('');
        setIsTagInputVisible(false);
    };
    const removeTag = (target) => setTags(tags.filter(t => t !== target));
    // ==========================================================

    // macOS 风格下拉菜单外部点击关闭护甲
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (draftDropdownRef.current && !draftDropdownRef.current.contains(event.target)) {
                setIsDraftDropdownOpen(false);
            }
            if (visDropdownRef.current && !visDropdownRef.current.contains(event.target)) {
                setIsVisDropdownOpen(false);
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
        if (isEditorReady && vditorObj && initialContent) {
            vditorObj.setValue(initialContent);
        }
    }, [isEditorReady, vditorObj, initialContent]);

    useEffect(() => {
        // 延后 50ms 初始化，让 loading 动画先流畅播放几帧，避免 Vditor 同步阻塞冻住画面
        let vditor = null;
        const timerId = setTimeout(() => {
            vditor = new Vditor('vditor-container', {
                // [断网隔离锁] - 严防由于 Vditor 高亮、图标加载失败造成的全局假死崩溃
                cdn: '/vendor/vditor',
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
                preview: {
                    markdown: {
                        mark: true // 开启 ==高亮文本== 语法支持 (<mark> 标签)
                    }
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

                    // 拦截剪贴板外部图片或防盗链图片请求，通过后台转存为本地资源
                    linkToImgUrl: '/api/upload/fetch_image',
                    linkToImgFormat(responseText) {
                        // 承接后台回传的指定报文格式
                        let res;
                        try {
                            res = JSON.parse(responseText);
                        } catch (e) {
                            return JSON.stringify({ msg: '无法解包远端走私数据', code: 1 });
                        }
                        return responseText;
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
                    error(msg) { macAlert(msg, "渲染组件加载失败"); }
                },
                after: () => {
                    // =============== 💉[知乎专属杀毒剂：纯本地护航] ===============
                    // 知乎特供图文混排会导致公式彻底炸裂和无端换行，咱们直接在它触碰 Vditor 核心前进行拦截。
                    const irContainer = document.querySelector('.vditor-ir');
                    if (irContainer) {
                        // =============== 🚑[Vditor 核心结构塌陷同步急救舱] ===============
                        // 根治：用户 `Ctrl+X` 全选剪切后，浏览器原生机制会销毁底层 `<p>` 容器，导致光标迷失在外部 padding 虚空中。
                        // 此时若粘贴，文本完全脱离区块，造成首行幽灵换行、无法回删，且光标极度错位（显示在极上方）。
                        const recoverVacuumState = () => {
                            requestAnimationFrame(() => {
                                const editorReset = irContainer.querySelector('.vditor-reset');
                                if (!editorReset) return;
                                // 侦测到物理底座被完全摧毁
                                if (!editorReset.querySelector('p')) {
                                    // 重塑基础骨架
                                    editorReset.innerHTML = '<p data-block="0">\n<wbr></p>';
                                    // ✨ 最关键的抢救：将游离在虚空中（offset 0）的光标，强行捕获回真实的区块内部！
                                    const p = editorReset.querySelector('p');
                                    const sel = window.getSelection();
                                    const range = document.createRange();
                                    range.selectNodeContents(p);
                                    range.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(range);
                                }
                            });
                        };
                        irContainer.addEventListener('cut', recoverVacuumState);
                        irContainer.addEventListener('keyup', (e) => {
                            if (e.key === 'Backspace' || e.key === 'Delete') recoverVacuumState();
                        });

                        irContainer.addEventListener('paste', (e) => {
                            // 🚀 [终极防御：WebKit 原生段落切分（分裂）Bug]
                            // 当在一个含有 <br> 或 <wbr> 的空 <p> 里粘贴包含块级元素 (如 <p>) 的内容时，
                            // 浏览器原生的 insertHTML 会直接把原空的 <p> 切成两半！从而在上方诞生一个“幽灵寄生空行”！
                            // 而且因为 Vditor Lute 的 AST 树逻辑，排在第一位的空 block 极难被 Backspace 合并。
                            // 【最终对策】：如果是全空状态，直接抹除所有遗留壳子制造“绝对真空”，让新粘贴的内容直接在此生根落户，绝不产生切分！
                            const sel = window.getSelection();
                            if (sel.rangeCount > 0) {
                                const editorReset = irContainer.querySelector('.vditor-reset');
                                if (editorReset && editorReset.contains(sel.anchorNode)) {
                                    if (editorReset.textContent.trim() === '') {
                                        // 制造绝对真空环境！
                                        editorReset.innerHTML = '';
                                        const range = document.createRange();
                                        range.setStart(editorReset, 0);
                                        range.collapse(true);
                                        sel.removeAllRanges();
                                        sel.addRange(range);
                                    }
                                }
                            }

                            const html = e.clipboardData.getData('text/html');
                            let plainText = e.clipboardData.getData('text/plain');

                            let isInsideCode = false;
                            if (sel.rangeCount > 0 && sel.anchorNode) {
                                const elm = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
                                if (elm && elm.closest) {
                                    isInsideCode = elm.closest('.vditor-ir__node[data-type="code-block"]') !== null;
                                }
                            }

                            // 处理从 IDE 或其他平台复制 Markdown 源码时，由于包含了 HTML 格式
                            // 导致 Vditor 误认为整体是一大段代码从而错误包裹的问题
                            if (plainText && /(?:^|\n)```/.test(plainText) && html) {
                                if (!isInsideCode) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (vditor) vditor.insertValue(plainText);
                                    return;
                                }
                            }

                            // 修复外源复制的跨行或带有不规范空格的 LaTeX 公式（如 $ a $）
                            // 避免 Vditor 的 HTML 解析导致公式内的下划线等字符被转义
                            if (plainText && plainText.includes('$') && !isInsideCode) {
                                let hasMath = false;
                                
                                const cleanText = plainText.replace(/\$([\s\S]+?)\$/g, (match, inner) => {
                                    const hasMathSymbol = inner.includes('\\') || inner.includes('_') || inner.includes('^');
                                    const hasBasicOp = inner.includes('=') || inner.includes('+') || inner.includes('-') || 
                                                       inner.includes('*') || inner.includes('/') || inner.includes('<') || inner.includes('>');
                                    const isMath = hasMathSymbol || (inner.includes('\n') && hasBasicOp);
                                    
                                    if (isMath) {
                                        hasMath = true;
                                        if (inner.includes('\n')) {
                                            // 跨多行公式统一改为 $$ 块级公式
                                            return `$$\n${inner.trim()}\n$$`;
                                        } else {
                                            // 单行公式去除头尾空格
                                            return `$${inner.trim()}$`;
                                        }
                                    }
                                    return match;
                                });

                                if (hasMath) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (vditor) vditor.insertValue(cleanText);
                                    return;
                                }
                            }

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

                                // 抢救四（大哥查漏补缺的极地救援！）：
                                // 因为咱们刚才把原生粘贴过程一刀切断了，原生引擎对外网图片的“洗白”管道由于没触发自动下线。
                                // 在这里必须为它单独开个后门，手动找出所有被缴获来的外网图片，一并扔向服务器！！
                                doc.querySelectorAll('img').forEach(img => {
                                    let src = img.getAttribute('src') || '';
                                    // 如果发现非咱们本地的正经图，或者带有各种防盗链大长串的知乎防盗图
                                    if (src.startsWith('http') && !src.includes('/api/static/images')) {
                                        // 开启地下黑市快车直连
                                        axios.post('/api/upload/fetch_image', { url: src }, {
                                            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
                                        }).then(resp => {
                                            if (resp.data && resp.data.code === 0) {
                                                const newLocalUrl = resp.data.data.url;
                                                // 图片运回来是异步的，编辑器可能还在动。我们在真实的地盘上使用动态射杀替换原来的赃物！
                                                const editorDOM = document.querySelector('.vditor-ir');
                                                if (editorDOM) {
                                                    editorDOM.querySelectorAll(`img[src="${src}"]`).forEach(node => {
                                                        node.setAttribute('src', newLocalUrl);
                                                    });
                                                }
                                            }
                                        }).catch(err => {
                                            console.error('拦截知乎图档送下洗白失败', err);
                                        });
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

                    setIsEditorReady(true);
                    setVditorObj(vditor);
                }
            });
        }, 50); // setTimeout 闭合

        // 核心护法神技重启：延时封印外挂！
        const forceHideRef = (e) => {
            setTimeout(() => {
                const hintBoxes = document.querySelectorAll('.vditor-hint');
                hintBoxes.forEach(hintBox => {
                    if (!hintBox.contains(e.target)) {
                        hintBox.classList.add('mac-force-hide-hint');
                    }
                });
            }, 80);
        };

        const removeHideRef = (e) => {
            if (e.key === 'Escape') return;
            const hintBoxes = document.querySelectorAll('.vditor-hint');
            hintBoxes.forEach(hintBox => {
                hintBox.classList.remove('mac-force-hide-hint');
            });
        }

        document.addEventListener('mousedown', forceHideRef, true);
        document.addEventListener('keydown', removeHideRef, true);

        return () => {
            clearTimeout(timerId);
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
        if (!title.trim() || !content.trim()) return macAlert("发布失败：标题和正文不可以为空。", "内容缺失");

        setIsPublishing(true);
        try {
            const payload = {
                title,
                content,
                code_template: codeTemplate,
                category: solveForId ? 'solution' : category,
                visibility: visibility,
                tags: tags.join(',')
            };
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } };

            if (articleId) {
                await axios.put(`/api/articles/${articleId}`, payload, config);
            } else if (solveForId) {
                // 特殊分支：撰写的是靶场题目的题解
                await axios.post(`/api/articles/code/${solveForId}/solutions`, payload, config);
            } else {
                await axios.post('/api/articles/', payload, config);
            }
            navigate(solveForId ? `/codeplay/${solveForId}` : '/');
        } catch (err) {
            macAlert(err.response?.data?.detail || "文章发布失败，请检查网络状态或操作权限。", "发布失败");
        } finally {
            setIsPublishing(false);
        }
    };

    const layoutExtensions = {
        code: <CodeLayout codeTemplate={codeTemplate} setCodeTemplate={setCodeTemplate} />,
        interview: <InterviewLayout />,
        knowledge: <KnowledgeLayout />
    };
    const ExtensionPanel = !solveForId ? layoutExtensions[category] : null;
    const needsDualScreen = category === 'code' && !solveForId;

    return (
        <div className="zhi-app">
            <header className="zhi-header">
                <div className="zhi-header-inner">
                    <button className="zhi-btn-text" onClick={handleBackClick} style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        ← 返回主页
                    </button>
                    <div style={{ flexGrow: 1 }}></div>
                    <div className="zhi-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

                        {/* 草稿箱极客抽屉 */}
                        {!articleId && (
                            <div className="mac-custom-dropdown" ref={draftDropdownRef} onClick={() => setIsDraftDropdownOpen(!isDraftDropdownOpen)}>
                                <div className="mac-dropdown-trigger" style={{ cursor: 'pointer', background: 'transparent', padding: '0 8px', fontWeight: 500, color: '#86868B' }}>
                                    <span>草稿箱 ({drafts.length}/5)</span>
                                </div>
                                {isDraftDropdownOpen && (
                                    <div className="mac-dropdown-menu" style={{ width: '260px', right: 0 }}>
                                        {drafts.length === 0 ? (
                                            <div style={{ padding: '16px', fontSize: '13px', color: '#86868B', textAlign: 'center' }}>暂无历史草稿</div>
                                        ) : (
                                            drafts.map(d => (
                                                <div key={d.id} className="mac-draft-item" onClick={() => handleApplyDraft(d)}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingRight: '12px' }}>
                                                        <span className="draft-title">{d.title || '无标题草稿'}</span>
                                                        <span className="draft-time">{d.updated_at}</span>
                                                    </div>
                                                    <button className="draft-delete-btn" onClick={(e) => handleDeleteDraft(e, d.id)} title="彻底删除此草稿">
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

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

                        {/* 访问权限选择器 */}
                        <div className="mac-custom-dropdown" ref={visDropdownRef} onClick={() => setIsVisDropdownOpen(!isVisDropdownOpen)}>
                            <div className="mac-dropdown-trigger">
                                <span>{visibility === 'public' ? '🌐 游客可见' : '🔒 登录可见'}</span>
                                <svg className={`mac-chevron ${isVisDropdownOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            {isVisDropdownOpen && (
                                <div className="mac-dropdown-menu">
                                    {[['public', '🌐 游客可见'], ['registered', '🔒 登录可见']].map(([key, label]) => (
                                        <div
                                            key={key}
                                            className={`mac-dropdown-item ${visibility === key ? 'active' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setVisibility(key);
                                                setIsVisDropdownOpen(false);
                                            }}
                                        >
                                            {label}
                                            {visibility === key && (
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
                            {isPublishing ? '提交中...' : (articleId ? '更新文章' : (solveForId ? '发布题解' : '发布文章'))}
                        </button>
                    </div>
                </div>
            </header>

            <div className="zhi-editor-layout">
                <div style={{ paddingBottom: '16px', borderBottom: '1px solid #F0F2F7', marginBottom: '12px' }}>
                    <input
                        className="zhi-title-input"
                        placeholder="请输入文章标题"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{ width: '100%', background: 'transparent' }}
                    />
                </div>

                {/* Apple 级动态感应标签引擎容器！完全脱离前者的包裹，置于主隔断横轴之下 */}
                <div className="mac-tags-container" style={{ marginBottom: '16px' }}>
                    {tags.map((tag, idx) => (
                        <TagPill key={idx} text={tag} onRemove={removeTag} />
                    ))}

                    {/* 圆圈+号按钮与小微型输入框的变身逻辑 */}
                    {tags.length < 10 && !isTagInputVisible && (
                        <button className="mac-tag-add-btn" onClick={() => setIsTagInputVisible(true)} aria-label="增加标签">
                            +
                        </button>
                    )}
                    {tags.length < 10 && isTagInputVisible && (
                        <input
                            className="mac-tag-input-small"
                            autoFocus
                            placeholder="输入并回车"
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            onBlur={handleTagBlur}
                        />
                    )}

                    {tags.length === 10 && <span className="mac-tag-limit-msg">最多 10 条，已满舱</span>}
                </div>

                {/* 这里的布局分叉的顶层包装器 */}
                <div style={{ position: 'relative', minHeight: '500px' }}>
                    {/* 全局 Loading 层：等待核心引擎完全着陆前，涵盖整个多屏创作矩阵 */}
                    {!isEditorReady && (
                        <div className="mac-editor-loading" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '160px' }}>
                            <div className="plane-voyage-box">
                                <div className="air-stream stream-1"></div>
                                <div className="air-stream stream-2"></div>
                                <div className="air-stream stream-3"></div>
                                <svg className="mac-svg-plane" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 2L11 13" />
                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="rgba(0, 122, 255, 0.05)" />
                                </svg>
                            </div>
                            <span style={{ marginTop: '28px', color: '#8E8E93', fontSize: '14px', fontWeight: '500', letterSpacing: '0.02em' }}>正在为您构建高维创作大厅...</span>
                        </div>
                    )}

                    {/* 实景大厅：通过透明度的压制，迫使其在后端引擎没有就位时完全噤声，并在启动瞬间联动左右屏共同淡雅降维出场！ */}
                    <div style={{
                        display: needsDualScreen ? 'flex' : 'block',
                        gap: '24px',
                        alignItems: 'stretch',
                        opacity: isEditorReady ? 1 : 0,
                        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                        pointerEvents: isEditorReady ? 'auto' : 'none'
                    }}>
                        {/* 左侧主体 */}
                        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                            {/* 彻底摆脱 UIW 的幽灵，由 Vditor 接管渲染 */}
                            <div id="vditor-container" className={`mac-vditor-override ${isEditorReady ? 'ready' : ''}`}></div>

                            {/* 游龙果冻追尾光标 */}
                            <JellyCaret editorReady={isEditorReady} />
                        </div>

                        {/* 后期多路拓展插件区 (解耦抽离的渲染层) */}
                        {ExtensionPanel}
                    </div>
                </div>
            </div>

            {showExitPrompt && (
                <div className="mac-modal-overlay">
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'mac-modal-pop 0.3s forwards' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600, color: '#1D1D1F' }}>是否保存草稿？</h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#86868B', lineHeight: 1.5 }}>
                            当前内容尚未保存，退出将丢失更改。
                        </p>

                        {draftError && <div style={{ color: '#FF5F56', fontSize: '13px', marginBottom: '16px', padding: '10px', background: 'rgba(255,95,86,0.1)', borderRadius: '8px' }}>{draftError}</div>}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => handleSaveDraft(true)} style={{ padding: '10px', border: 'none', background: '#0071E3', color: '#FFF', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>保存草稿并退出</button>
                            <button onClick={() => navigate('/')} style={{ padding: '10px', border: '1px solid #FF5F56', background: 'transparent', color: '#FF5F56', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>不保存退出</button>
                            <button onClick={() => setShowExitPrompt(false)} style={{ padding: '10px', border: '1px solid #D2D2D7', background: 'transparent', color: '#1D1D1F', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>取消</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
