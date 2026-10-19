import { describe, expect, it } from 'vitest';
import {
  ADMIN_ACCESS,
  ADMIN_APP_ROLES,
  type AdminProcedureKey,
  canAccess,
  isAdminAppRole,
} from './admin-access.js';

/**
 * Danh sách user duyệt 02/10 (ADR-0052 §2). Sửa một dòng của bảng mà không sửa danh sách
 * này là test đỏ — CỐ Ý: đổi quyền phải là một quyết định, không phải một lần gõ nhầm.
 */
const OWNER_ONLY: AdminProcedureKey[] = [
  'activity.list',
  'bookings.refund',
  'categories.delete',
  'departures.cancel',
  'destinations.delete',
  'paymentEvents.byId',
  'paymentEvents.list',
  'posts.delete',
  'reports.monthly',
  'stats.paymentEvents',
  'tours.delete',
  'users.byId',
  'users.list',
  'users.lock',
  'users.revokeSessions',
  'users.setRole',
  'users.unlock',
];

describe('ADMIN_ACCESS', () => {
  it('đúng 17 thủ tục là của riêng Owner', () => {
    const owner = Object.entries(ADMIN_ACCESS)
      .filter(([, level]) => level === 'owner')
      .map(([key]) => key)
      .sort();
    expect(owner).toEqual([...OWNER_ONLY].sort());
  });
});

describe('canAccess', () => {
  it('Owner (ADMIN) vào mọi thủ tục', () => {
    for (const key of Object.keys(ADMIN_ACCESS) as AdminProcedureKey[]) {
      expect(canAccess('ADMIN', key), key).toBe(true);
    }
  });

  it('Staff vào thủ tục staff, không vào thủ tục owner', () => {
    expect(canAccess('STAFF', 'bookings.list')).toBe(true);
    expect(canAccess('STAFF', 'stats.dashboard')).toBe(true);
    expect(canAccess('STAFF', 'bookings.refund')).toBe(false);
    expect(canAccess('STAFF', 'users.list')).toBe(false);
  });

  it('khách, rỗng, lạ, sai hoa thường: không vào gì — fail-closed (ADR-0003)', () => {
    for (const role of ['CUSTOMER', '', 'MODERATOR', 'admin', 'staff']) {
      expect(canAccess(role, 'bookings.list'), role).toBe(false);
    }
  });
});

describe('isAdminAppRole', () => {
  it('đúng hai role vào được app admin', () => {
    expect(ADMIN_APP_ROLES).toEqual(['ADMIN', 'STAFF']);
    expect(isAdminAppRole('ADMIN')).toBe(true);
    expect(isAdminAppRole('STAFF')).toBe(true);
    expect(isAdminAppRole('CUSTOMER')).toBe(false);
    expect(isAdminAppRole('')).toBe(false);
  });
});
