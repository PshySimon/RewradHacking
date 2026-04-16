import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '../src/components/NotificationBell.jsx');
const cssPath = path.resolve(__dirname, '../src/index.css');

test('NotificationBell fetches a paginated unified notification list and renders text pagination controls', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(source, /const \[currentPage, setCurrentPage\] = useState\(1\);/);
    assert.match(source, /const \[unreadCount, setUnreadCount\] = useState\(0\);/);
    assert.match(source, /const totalPages = Math\.max\(1, Math\.ceil\(totalCount \/ 10\)\);/);
    assert.match(source, /const visiblePages = useMemo\(/);
    assert.match(source, /page:\s*targetPage/);
    assert.match(source, /page_size:\s*10/);
    assert.match(source, /setUnreadCount\(Number\(res\.data\?\.unread_count \|\| 0\)\)/);
    assert.match(source, /className=\{`zhi-notification-item \$\{item\.is_read \? 'zhi-notification-item--read' : 'zhi-notification-item--unread'\}`\}/);
    assert.match(source, /className="zhi-notification-pagination"/);
    assert.match(source, /className="zhi-notification-page-link"/);
    assert.match(source, /className="zhi-notification-page-numbers"/);
    assert.match(source, /className=\{`zhi-notification-page-number \$\{page === currentPage \? 'is-active' : ''\}`\.trim\(\)\}/);
    assert.match(source, /visiblePages\.map\(\(page\) => \(/);
    assert.match(source, /上一页/);
    assert.match(source, /下一页/);
    assert.doesNotMatch(source, /zhi-notification-page-btn/);
    assert.match(css, /\.zhi-notification-item--unread\s*\{/);
    assert.match(css, /\.zhi-notification-item--read\s*\{/);
    assert.match(css, /\.zhi-notification-pagination\s*\{/);
    assert.match(css, /\.zhi-notification-popover\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/);
    assert.match(css, /\.zhi-notification-list\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*min-height:\s*0;/);
    assert.match(css, /\.zhi-notification-page-link\s*\{[^}]*color:\s*#0071E3;/);
    assert.match(css, /\.zhi-notification-page-link:disabled\s*\{[^}]*color:\s*#86868B;/);
    assert.match(css, /\.zhi-notification-page-number\s*\{/);
    assert.match(css, /\.zhi-notification-page-number\.is-active\s*\{[^}]*color:\s*#0071E3;/);
});
