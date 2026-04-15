/* eslint-disable react/prop-types */

export default function ImageLocalizationToast({ progress }) {
    if (!progress) return null;

    const percent = progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0;
    const isDone = progress.status === 'done';
    const title = isDone ? '图片解析完成' : '正在本地化图片';
    const subtitle = isDone
        ? `成功 ${progress.success} 张${progress.failed ? `，失败 ${progress.failed} 张` : ''}`
        : `已处理 ${progress.completed}/${progress.total}`;

    return (
        <div className={`mac-image-localize-toast ${isDone ? 'done' : 'running'}`}>
            <div className="mac-image-localize-head">
                <div className="mac-image-localize-icon">
                    {isDone ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    ) : (
                        <div className="mac-image-localize-spinner" />
                    )}
                </div>
                <div className="mac-image-localize-copy">
                    <div className="mac-image-localize-title">{title}</div>
                    <div className="mac-image-localize-subtitle">{subtitle}</div>
                </div>
                <div className="mac-image-localize-percent">{percent}%</div>
            </div>
            <div className="mac-image-localize-track">
                <div className="mac-image-localize-bar" style={{ width: `${percent}%` }} />
            </div>
            {!isDone && progress.currentUrl && (
                <div className="mac-image-localize-url" title={progress.currentUrl}>
                    {progress.currentUrl}
                </div>
            )}
        </div>
    );
}
