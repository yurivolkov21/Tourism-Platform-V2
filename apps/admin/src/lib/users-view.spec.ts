import type { AdminUserRow } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  formatDay,
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
