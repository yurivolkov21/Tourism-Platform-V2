import { describe, expect, it } from 'vitest';
import {
  AdminUserLockInputSchema,
  AdminUserSetRoleInputSchema,
  AdminUsersListQuerySchema,
  USER_LOCK_REASON_MAX,
  userActions,
  userStatus,
} from './admin-users.js';

const ID = '11111111-1111-4111-8111-111111111111';
const LOCKED_AT = '2026-10-02T03:00:00.000Z';

describe('userStatus', () => {
  it('khoá thắng mọi thứ — kể cả khi chưa xác minh', () => {
    expect(userStatus({ emailVerified: false, lockedAt: LOCKED_AT })).toBe('locked');
    expect(userStatus({ emailVerified: true, lockedAt: new Date(LOCKED_AT) })).toBe('locked');
  });

  it('không khoá: chưa xác minh là unverified, đã xác minh là active', () => {
    expect(userStatus({ emailVerified: false, lockedAt: null })).toBe('unverified');
    expect(userStatus({ emailVerified: true, lockedAt: null })).toBe('active');
  });
});

describe('userActions (spec §4.1)', () => {
  it('Owner không là mục tiêu của thao tác nào — trừ mở khoá khi đang khoá', () => {
    expect(userActions({ role: 'ADMIN', emailVerified: true, lockedAt: null })).toEqual([]);
    expect(userActions({ role: 'ADMIN', emailVerified: true, lockedAt: LOCKED_AT })).toEqual([
      'unlock',
    ]);
  });

  it('Staff: thu Staff, khoá hoặc mở khoá, đăng xuất mọi nơi', () => {
    expect(userActions({ role: 'STAFF', emailVerified: true, lockedAt: null })).toEqual([
      'revokeStaff',
      'lock',
      'revokeSessions',
    ]);
    expect(userActions({ role: 'STAFF', emailVerified: true, lockedAt: LOCKED_AT })).toEqual([
      'revokeStaff',
      'unlock',
      'revokeSessions',
    ]);
  });

  it('khách đã xác minh, không khoá: cấp Staff được', () => {
    expect(userActions({ role: 'CUSTOMER', emailVerified: true, lockedAt: null })).toEqual([
      'grantStaff',
      'lock',
      'revokeSessions',
    ]);
  });

  it('khách chưa xác minh, hoặc đang khoá: KHÔNG cấp Staff được', () => {
    expect(userActions({ role: 'CUSTOMER', emailVerified: false, lockedAt: null })).toEqual([
      'lock',
      'revokeSessions',
    ]);
    expect(userActions({ role: 'CUSTOMER', emailVerified: true, lockedAt: LOCKED_AT })).toEqual([
      'unlock',
      'revokeSessions',
    ]);
  });
});

describe('schema admin.users', () => {
  it('lý do khoá được trim; toàn dấu cách là 400; trần đúng USER_LOCK_REASON_MAX', () => {
    expect(AdminUserLockInputSchema.parse({ id: ID, reason: '  Chargeback abuse  ' }).reason).toBe(
      'Chargeback abuse',
    );
    expect(AdminUserLockInputSchema.safeParse({ id: ID, reason: '   ' }).success).toBe(false);
    const max = 'x'.repeat(USER_LOCK_REASON_MAX);
    expect(AdminUserLockInputSchema.safeParse({ id: ID, reason: max }).success).toBe(true);
    expect(AdminUserLockInputSchema.safeParse({ id: ID, reason: `${max}x` }).success).toBe(false);
  });

  it('setRole chỉ nhận CUSTOMER hoặc STAFF — giao diện không bao giờ đặt được ADMIN', () => {
    expect(AdminUserSetRoleInputSchema.safeParse({ id: ID, role: 'STAFF' }).success).toBe(true);
    expect(AdminUserSetRoleInputSchema.safeParse({ id: ID, role: 'CUSTOMER' }).success).toBe(true);
    expect(AdminUserSetRoleInputSchema.safeParse({ id: ID, role: 'ADMIN' }).success).toBe(false);
  });

  it('list: view mặc định all, search được trim, view lạ là 400', () => {
    expect(AdminUsersListQuerySchema.parse({})).toEqual({ page: 1, limit: 20, view: 'all' });
    expect(AdminUsersListQuerySchema.parse({ search: '  ada  ' }).search).toBe('ada');
    expect(AdminUsersListQuerySchema.safeParse({ view: 'owners' }).success).toBe(false);
  });
});
