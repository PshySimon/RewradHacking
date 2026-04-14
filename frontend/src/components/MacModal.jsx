import React from 'react';

export default function MacModal({
    isOpen,
    title = "重要操作拦截",
    desc = "您正在进行一项不可逆的操作，请确定执行。",
    confirmText = "确认执行",
    cancelText = "取消退回",
    onConfirm,
    onCancel,
    isProcessing = false
}) {
    if (!isOpen) return null;

    return (
        <div className="mac-modal-overlay">
            <div className="mac-modal-box">
                <div className="mac-modal-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h3 className="mac-modal-title">{title}</h3>
                <p className="mac-modal-desc">{desc}</p>
                <div className="mac-modal-actions">
                    <button 
                        className="mac-modal-btn cancel" 
                        onClick={onCancel} 
                        disabled={isProcessing}
                    >
                        {cancelText}
                    </button>
                    <button 
                        className="mac-modal-btn confirm" 
                        onClick={onConfirm} 
                        disabled={isProcessing}
                    >
                        {isProcessing ? '环境处理中...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
