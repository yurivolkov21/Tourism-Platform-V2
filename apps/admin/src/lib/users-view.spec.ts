import type { AdminUserRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { userDetailFixture } from '@/test/user-detail';
import {
  formatDay,
  toUserDetailVM,
  toUserRowVM,
  userDisplayName,
  userRoleBadgeVariant,
  userStatusBadgeVariant,
} from './users-view';

const ROW: AdminUserRow = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
  role: 'STAFF',
  status: 'locked',
  createdAt: '2026-09-01T23:30:00.000Z',
  lastActiveAt: null,
};

describe('userDisplayName', () => {
  it('tên có chữ thì lấy; rỗng hay toàn dấu cách thì email', () => {
    expect(userDisplayName({ name: 'Ada', email: 'a@x.com' })).toBe('Ada');
    expect(userDisplayName({ name: '   ', email: 'a@x.com' })).toBe('a@x.com');
    expect(userDisplayName({ name: null, email: 'a@x.com' })).toBe('a@x.com');
  });
});

describe('formatDay', () => {
  it('ngày theo UTC — 23:30 UTC vẫn là ngày 1, không trượt theo múi giờ máy', () => {
    expect(formatDay('2026-09-01T23:30:00.000Z')).toBe('1 Sep 2026');
  });

  it('null → gạch ngang của back-office', () => {
    expect(formatDay(null)).toBe('—');
  });
});

describe('toUserRowVM', () => {
  it('nhãn Owner/Staff/Customer, chip trạng thái, ngày, link mang ?back=', () => {
    expect(toUserRowVM(ROW, '/users?view=locked')).toEqual({
      id: ROW.id,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
      initial: 'A',
      href: `/users/${ROW.id}?back=%2Fusers%3Fview%3Dlocked`,
      role: 'STAFF',
      roleLabel: 'Staff',
      status: 'locked',
      statusLabel: 'Locked',
      joined: '1 Sep 2026',
      lastActive: '—',
    });
  });

  it('không tên → email làm tên, chữ cái đầu từ email', () => {
    const vm = toUserRowVM({ ...ROW, name: null, email: 'zed@example.com' }, '/users');
    expect(vm.name).toBe('zed@example.com');
    expect(vm.initial).toBe('Z');
  });
});

describe('badge', () => {
  it('Owner nổi nhất, Staff vừa, khách nhạt; khoá là destructive', () => {
    expect(userRoleBadgeVariant('ADMIN')).toBe('default');
    expect(userRoleBadgeVariant('STAFF')).toBe('secondary');
    expect(userRoleBadgeVariant('CUSTOMER')).toBe('outline');
    expect(userStatusBadgeVariant('locked')).toBe('destructive');
    expect(userStatusBadgeVariant('unverified')).toBe('secondary');
    expect(userStatusBadgeVariant('active')).toBe('outline');
  });
});

describe('toUserDetailVM', () => {
  it('Profile in đủ bốn dòng; cách đăng nhập nối bằng dấu phẩy; điện thoại trống là gạch', () => {
    const vm = toUserDetailVM(userDetailFixture({ signInMethods: ['password', 'google'] }));
    expect(vm.profile).toEqual([
      { label: 'Email', value: 'ada@example.com' },
      { label: 'Email verified', value: 'Yes' },
      { label: 'Phone', value: '—' },
      { label: 'Signs in with', value: 'Password, Google' },
    ]);
    expect(vm.joined).toBe('Joined 1 Sep 2026');
  });

  it('có booking → link bookings mọi ngày; không booking → không link', () => {
    expect(toUserDetailVM(userDetailFixture()).bookingsHref).toBe(
      '/bookings?q=ada%40example.com&dates=all',
    );
    const none = userDetailFixture({ counts: { bookings: 0, reviews: 0, enquiries: 0 } });
    expect(toUserDetailVM(none).bookingsHref).toBeNull();
  });

  it('câu của card Access theo đúng lý do có hay không có nút', () => {
    const note = (patch: Parameters<typeof userDetailFixture>[0]) =>
      toUserDetailVM(userDetailFixture(patch)).accessNote;
    expect(note({})).toBe(messages.admin.users.detail.access.customer);
    expect(note({ role: 'STAFF' })).toBe(messages.admin.users.detail.access.staff);
    expect(note({ emailVerified: false, status: 'unverified' })).toBe(
      messages.admin.users.detail.access.needsVerified,
    );
    expect(note({ lockedAt: '2026-10-02T03:00:00.000Z', status: 'locked' })).toBe(
      messages.admin.users.detail.access.needsUnlock,
    );
    expect(note({ role: 'ADMIN' })).toBeNull();
  });

  it('đang khoá: từ khi nào (giờ UTC) và vì sao', () => {
    const vm = toUserDetailVM(
      userDetailFixture({
        status: 'locked',
        lockedAt: '2026-10-02T03:00:00.000Z',
        lockReason: 'Chargeback abuse',
      }),
    );
    expect(vm.lockedSince).toBe('Locked since 2 Oct 2026, 03:00 UTC');
    expect(vm.lockReason).toBe('Reason: Chargeback abuse');
    expect(vm.actions).toEqual(['unlock', 'revokeSessions']);
  });

  it('lịch sử: "ai làm gì", giờ UTC, lý do; người làm đã mất → "A removed account"', () => {
    const vm = toUserDetailVM(
      userDetailFixture({
        history: [
          {
            id: 'e2',
            type: 'LOCKED',
            note: 'Left the team',
            createdAt: '2026-10-02T03:00:00.000Z',
            actor: { name: 'Owner Olive' },
          },
          {
            id: 'e1',
            type: 'STAFF_GRANTED',
            note: null,
            createdAt: '2026-10-01T03:00:00.000Z',
            actor: null,
          },
        ],
      }),
    );
    expect(vm.history).toEqual([
      {
        id: 'e2',
        line: 'Owner Olive locked the account',
        at: '2 Oct 2026, 03:00 UTC',
        reason: 'Reason: Left the team',
      },
      {
        id: 'e1',
        line: 'A removed account granted staff access',
        at: '1 Oct 2026, 03:00 UTC',
        reason: null,
      },
    ]);
  });

  it('Owner: isOwner, không thao tác nào', () => {
    const vm = toUserDetailVM(userDetailFixture({ role: 'ADMIN' }));
    expect(vm.isOwner).toBe(true);
    expect(vm.roleLabel).toBe('Owner');
    expect(vm.actions).toEqual([]);
  });
});
