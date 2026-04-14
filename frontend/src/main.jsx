import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
)

// 🛡️ 「破晓之盾」卸载序列
// 当 React 主树挂载并开始进行它的第一次宏观渲染长跳后，咱们优雅地撤掉这道前置的屏障。
// 给予一个极其短暂的安全缓冲期 (150ms)，确证所有深层组件的 DOM 完全撑开就位，断绝一丝一毫的闪烁可能！
setTimeout(() => {
    const splash = document.getElementById('nexus-global-loader');
    if (splash) {
        // 阶段一：给屏障下达高斯消散指令，触发其 CSS 缓动渐隐与微距膨胀的退场动画
        splash.classList.add('nexus-loader-hide');
        // 阶段二：等待 600 毫秒转场动画结束后，将加载遮罩层从文档树中移除并释放节点
        setTimeout(() => splash.remove(), 600);
    }
}, 150);
