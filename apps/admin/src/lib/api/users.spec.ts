import { ORPCError } from '@orpc/client';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { userDetailFixture } from '@/test/user-detail';
import { api } from './client';
import { fetchAccountEmail } from './users';

/**
 * Nhãn của bộ lọc tài khoản ở `/bookings` (G45). `users.byId` chỉ Owner gọi được, nên với Staff
 * hàm KHÔNG gọi API — trang không bao giờ bắn một thủ tục mà phiên không có quyền. Nhãn hỏng thì
 * nhãn chung, không làm hỏng cả trang danh sách.
 */
vi.mock('./client', () => ({
  api: { admin: { users: { byId: vi.fn() } } },
  withAdminAuth: (cookie: string) => ({ cookie }),
}));

const byId = api.admin.users.byId as unknown as Mock;
const ID = '4f2a1b3c-0000-4000-8000-000000000001';

beforeEach(() => {
  byId.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('fetchAccountEmail', () => {
  it('Owner: email của đúng tài khoản, gọi kèm cookie', async () => {
    byId.mockResolvedValue(userDetailFixture({ id: ID, email: 'ada@example.com' }));

    expect(await fetchAccountEmail('cookie=x', ID, 'ADMIN')).toBe('ada@example.com');
    expect(byId).toHaveBeenCalledWith({ id: ID }, { context: { cookie: 'cookie=x' } });
  });

  it('Staff: null và KHÔNG gọi API', async () => {
    expect(await fetchAccountEmail('cookie=x', ID, 'STAFF')).toBeNull();
    expect(byId).not.toHaveBeenCalled();
  });

  it('tài khoản không còn (NOT_FOUND) → null', async () => {
    byId.mockRejectedValue(new ORPCError('NOT_FOUND', { defined: true }));

    expect(await fetchAccountEmail('cookie=x', ID, 'ADMIN')).toBeNull();
  });

  it('API lỗi → null, không ném — chỉ là một cái nhãn', async () => {
    byId.mockRejectedValue(new Error('socket hang up'));

    expect(await fetchAccountEmail('cookie=x', ID, 'ADMIN')).toBeNull();
  });
});
