import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { isActiveNav, NAV_GROUPS, navTooltip } from './nav';

/**
 * Sidebar thu gọn thành cột icon (góp ý giao diện 28/09): cột ấy không còn chữ, nên
 * tooltip là nhãn DUY NHẤT của mỗi icon, và ô sáng là dấu duy nhất của trang đang mở.
 */
const item = (key: string) => {
  const found = NAV_GROUPS.flatMap((group) => group.items).find((entry) => entry.key === key);
  if (!found) throw new Error(`Không có mục ${key}`);
  return found;
};

describe('navTooltip', () => {
  it('mục đã mở: đúng nhãn của nó', () => {
    expect(navTooltip(item('tours'))).toBe('Tours');
  });

  it('mục chưa mở: kèm "Soon" — nhãn Soon bị ẩn khi sidebar thu gọn', () => {
    expect(navTooltip(item('media'))).toBe(messages.admin.shell.soonItem('Media library'));
    expect(navTooltip(item('media'))).toBe('Media library · Soon');
  });
});

describe('isActiveNav', () => {
  it('Dashboard chỉ sáng ở đúng "/"', () => {
    expect(isActiveNav('/', '/')).toBe(true);
    expect(isActiveNav('/', '/tours')).toBe(false);
  });

  it('mục khác sáng ở trang của nó và mọi trang con; bỏ qua query của href', () => {
    expect(isActiveNav('/tours', '/tours')).toBe(true);
    expect(isActiveNav('/tours', '/tours/ha-long/photos')).toBe(true);
    expect(isActiveNav('/reviews?status=pending', '/reviews')).toBe(true);
  });

  it('tiền tố gần giống không tính', () => {
    expect(isActiveNav('/tours', '/tours-archive')).toBe(false);
    expect(isActiveNav('/outbox?status=FAILED', '/outboxes')).toBe(false);
  });
});
