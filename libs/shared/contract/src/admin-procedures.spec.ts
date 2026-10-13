import { describe, expect, it } from 'vitest';
import { ADMIN_ACCESS } from './admin-access.js';
import { adminProcedureKey, listAdminProcedures } from './admin-procedures.js';
import { contract } from './contract.js';

describe('listAdminProcedures', () => {
  it('đúng tập khoá của bảng quyền — kiểu và lúc chạy không lệch nhau', () => {
    const keys = listAdminProcedures()
      .map((entry) => entry.key)
      .sort();
    expect(keys).toEqual(Object.keys(ADMIN_ACCESS).sort());
  });

  it('mọi thủ tục admin có method HTTP và path dưới /api/admin/', () => {
    for (const entry of listAdminProcedures()) {
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], entry.key).toContain(entry.method);
      expect(entry.path.startsWith('/api/admin/'), entry.key).toBe(true);
    }
  });

  it('mang đúng route và đúng đối tượng của từng thủ tục', () => {
    const refund = listAdminProcedures().find((entry) => entry.key === 'bookings.refund');
    expect(refund).toMatchObject({ method: 'POST', path: '/api/admin/bookings/{code}/refund' });
    expect(refund?.procedure).toBe(contract.admin.bookings.refund);
  });
});

describe('adminProcedureKey', () => {
  it('tra ngược từ chính đối tượng thủ tục', () => {
    expect(adminProcedureKey(contract.admin.users.lock)).toBe('users.lock');
    expect(adminProcedureKey(contract.admin.tours.signPhotoUploads)).toBe('tours.signPhotoUploads');
  });

  it('thủ tục ngoài contract.admin → undefined', () => {
    expect(adminProcedureKey(contract.catalog.tours.list)).toBeUndefined();
    expect(adminProcedureKey({})).toBeUndefined();
  });
});
