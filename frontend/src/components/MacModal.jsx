import React from 'react';
import { createRoot } from 'react-dom/client';

const ModalBox = ({ title, content, type = 'alert', onConfirm, onCancel, close }) => {
    // 渐出一瞬间动画的卸载器保护
    const handleClose = () => {
        const overlay = document.getElementById('mac-native-modal-overlay');
        const box = document.getElementById('mac-native-modal-box');
        if (overlay) overlay.classList.add('mac-fade-out');
        if (box) box.classList.add('mac-pop-out');
        setTimeout(() => close(), 250); // 配合 CSS 的淡出退场延时
    };

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
        handleClose();
    };

    return (
        <div id="mac-native-modal-overlay" className="mac-native-modal-overlay" onClick={handleClose}>
            <div 
                id="mac-native-modal-box" 
                className="mac-native-modal-box" 
                onClick={(e) => e.stopPropagation()} // 防止点击框体误关
            >
                {/* 警惕性极简红色图标/正常蓝标 */}
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                    {type === 'confirm' ? (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 59, 48, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                    ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 113, 227, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0071E3' }}>
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                    )}
                </div>
                
                <h3 className="mac-modal-title">{title}</h3>
                <p className="mac-modal-desc">{content}</p>

                {type === 'confirm' ? (
                    <div className="mac-modal-actions-dual">
                        <button className="mac-btn-cancel" onClick={handleClose}>取消</button>
                        <button className="mac-btn-danger" onClick={handleConfirm}>确定</button>
                    </div>
                ) : (
                    <div className="mac-modal-actions-single">
                        <button className="mac-btn-primary-alert" onClick={handleClose}>我知道了</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// 工具方法：生成与摧毁实体 DOM
const createModalInstance = (props) => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    const destroy = () => {
        root.unmount();
        if (div.parentNode) {
            div.parentNode.removeChild(div);
        }
    };

    root.render(<ModalBox {...props} close={destroy} />);
};

// 暴露对外的极简方法
export const macAlert = (content, title = '系统提示') => {
    createModalInstance({ type: 'alert', title, content });
};

export const macConfirm = (title, content, onConfirm) => {
    createModalInstance({ type: 'confirm', title, content, onConfirm });
};
