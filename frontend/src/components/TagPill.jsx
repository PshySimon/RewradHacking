import React from 'react';

// 摒弃大红大紫的廉价感，全面切换至极简、克制、富有硅谷极客感的冷灰与莫兰迪色系
const ADVANCED_COLORS = [
    { bg: '#F3F4F6', text: '#4B5563' }, // 纯净极简灰
    { bg: '#EFF6FF', text: '#2563EB' }, // 克制原初蓝
    { bg: '#F0FDF4', text: '#15803D' }, // 清冷霜凝绿
    { bg: '#FAF5FF', text: '#7E22CE' }, // 极光深凝紫
    { bg: '#FFF7ED', text: '#C2410C' }, // 枯木哑光橙
];

// 使用极其稳定的特征散列化分配颜色，确保同一个词绝对拿到同一种颜色标签
export const getAdvancedColor = (str) => {
    if (!str) return ADVANCED_COLORS[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return ADVANCED_COLORS[Math.abs(hash) % ADVANCED_COLORS.length];
};

export default function TagPill({ text, onRemove }) {
    if (!text) return null;
    const colors = getAdvancedColor(text);
    return (
        <span className="mac-tag-pill" style={{ backgroundColor: colors.bg, color: colors.text }}>
            {text}
            {onRemove && (
                <button className="mac-tag-remove" onClick={() => onRemove(text)} aria-label="移除">×</button>
            )}
        </span>
    );
}
