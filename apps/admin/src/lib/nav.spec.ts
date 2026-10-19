import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { isActiveNav, NAV_GROUPS, navGroupsFor, navPath, navTooltip } from './nav';

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
    // Media library là mục "Soon" cuối cùng, mở ở P4f — canh luật bằng một mục dựng tay.
    const soon = { ...item('media'), enabled: false };
    expect(navTooltip(soon)).toBe(messages.admin.shell.soonItem('Media library'));
    expect(navTooltip(soon)).toBe('Media library · Soon');
  });

  it('mọi mục của sidebar đã mở', () => {
    expect(NAV_GROUPS.flatMap((group) => group.items).filter((entry) => !entry.enabled)).toEqual(
      [],
    );
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

describe('navPath', () => {
  it('đường của href nav, bỏ query — Quick Create dẫn tới path trần (review RU4)', () => {
    expect(navPath('/reviews?status=pending')).toBe('/reviews');
    expect(navPath('/tours')).toBe('/tours');
  });
});

describe('navGroupsFor (ADR-0052)', () => {
  const keys = (role: string) =>
    navGroupsFor(role).flatMap((group) => group.items.map((i) => i.key));

  it('Owner thấy đủ mọi mục, đúng thứ tự', () => {
    expect(navGroupsFor('ADMIN')).toEqual(NAV_GROUPS);
  });

  it('Staff không thấy Reports, Payment events, Users, Activity — các mục khác còn nguyên', () => {
    const ownerOnly = ['reports', 'payment-events', 'users', 'activity'];
    const staff = keys('STAFF');
    for (const key of ownerOnly) expect(staff).not.toContain(key);
    expect(staff).toEqual(keys('ADMIN').filter((key) => !ownerOnly.includes(key)));
  });

  it('Owner thấy Activity cuối nhóm System (ADR-0061)', () => {
    const system = navGroupsFor('ADMIN').find((group) => group.key === 'system');
    expect(system?.items.at(-1)).toMatchObject({ key: 'activity', href: '/activity' });
  });
});
