import type { AdminCategoryRow } from '@tourism/contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { api } from './client';
import { fetchTourCategories } from './tours';

/**
 * Nguồn của menu lọc danh mục ở `/tours` (vòng review F14 + lượt thử tay F14).
 *
 * Hai điều phải ghim, cả hai từng hỏng:
 *
 *  ① nguồn là endpoint ADMIN, trả CẢ danh mục đã ẩn — bản đầu đọc đường công
 *    khai, nên ẩn một danh mục là menu mất luôn mục ấy;
 *  ② `isActive` đi TỚI menu thật, không bị gán cứng — nếu không thì dấu
 *    "(hidden)" chẳng bao giờ hiện, mà không test component nào biết (chúng
 *    dựng menu từ fixture, không qua hàm này).
 */
vi.mock('./client', () => ({
  api: { admin: { categories: { list: vi.fn() } } },
  withAdminAuth: (cookie: string) => ({ cookie }),
}));

const listMock = api.admin.categories.list as unknown as Mock;

const row = (over: Partial<AdminCategoryRow>): AdminCategoryRow => ({
  id: 'b0000001-0000-4000-8000-000000000001',
  slug: 'day',
  name: 'Day Tours',
  description: null,
  order: 1,
  isActive: true,
  tourCount: 14,
  ...over,
});

beforeEach(() => {
  listMock.mockReset();
});

describe('fetchTourCategories', () => {
  it('đọc endpoint ADMIN và chở nguyên `isActive` của từng hàng', async () => {
    listMock.mockResolvedValue([
      row({}),
      row({ id: 'b0000001-0000-4000-8000-000000000004', name: 'Trekking', isActive: false }),
    ]);

    const options = await fetchTourCategories('cookie=x');

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(options).toEqual([
      { id: 'b0000001-0000-4000-8000-000000000001', name: 'Day Tours', isActive: true },
      { id: 'b0000001-0000-4000-8000-000000000004', name: 'Trekking', isActive: false },
    ]);
  });

  it('lời gọi hỏng thì trả danh sách RỖNG, không kéo sập cả bảng tour', async () => {
    // Menu lọc mất đi là phiền; bảng tour mất đi là hỏng việc.
    listMock.mockRejectedValue(new Error('boom'));

    await expect(fetchTourCategories('cookie=x')).resolves.toEqual([]);
  });
});
