import { ORPCError } from '@orpc/client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { postDetailFixture } from '@/test/post-detail';
import { api } from './client';
import { fetchAdminPost, fetchPostTagOptions, fetchPostTourOptions } from './posts';

/**
 * Lớp đọc của vùng bài viết (vòng review P4e-4 — trước đó không có spec nào, trong khi bản
 * tour tương ứng đã ghim đúng những ca này ở `tours.spec.ts`):
 *
 *  ① `fetchAdminPost`: URL rác thành 404 chứ không thành trang lỗi của app — lỗi F17 từng gặp;
 *  ② `fetchPostTagOptions`: hỏng thì rỗng, trang sửa vẫn mở;
 *  ③ `fetchPostTourOptions`: gom mọi trang, bỏ trùng, dừng đúng chỗ, và nói ra khi bị cắt ở trần.
 */
vi.mock('./client', () => ({
  api: {
    admin: {
      posts: { get: vi.fn(), tags: vi.fn() },
      tours: { list: vi.fn() },
    },
  },
  withAdminAuth: (cookie: string) => ({ cookie }),
}));

const getPostMock = api.admin.posts.get as unknown as Mock;
const tagsMock = api.admin.posts.tags as unknown as Mock;
const toursListMock = api.admin.tours.list as unknown as Mock;

beforeEach(() => {
  getPostMock.mockReset();
  tagsMock.mockReset();
  toursListMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchAdminPost', () => {
  it('trả nguyên bài server gửi', async () => {
    const detail = postDetailFixture();
    getPostMock.mockResolvedValue(detail);

    await expect(fetchAdminPost('cookie=x', detail.slug)).resolves.toEqual(detail);
    expect(getPostMock).toHaveBeenCalledWith({ slug: detail.slug }, expect.anything());
  });

  it('NOT_FOUND do contract KHAI thì trả null — trang gọi notFound()', async () => {
    getPostMock.mockRejectedValue(new ORPCError('NOT_FOUND', { defined: true, status: 404 }));

    await expect(fetchAdminPost('cookie=x', 'gone')).resolves.toBeNull();
  });

  it('slug dài quá trần của contract → null, không gọi API', async () => {
    // Không chặn ở đây thì API trả 400 (input hỏng), hàm ném lại và URL rác ra trang lỗi.
    await expect(fetchAdminPost('cookie=x', 'x'.repeat(81))).resolves.toBeNull();
    expect(getPostMock).not.toHaveBeenCalled();
  });

  it('NOT_FOUND KHÔNG khai (route chưa có, khe deploy) và mọi lỗi khác thì ném lại', async () => {
    getPostMock.mockRejectedValueOnce(new ORPCError('NOT_FOUND'));
    await expect(fetchAdminPost('cookie=x', 'x')).rejects.toBeInstanceOf(ORPCError);

    getPostMock.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchAdminPost('cookie=x', 'x')).rejects.toThrow('boom');
  });
});

describe('fetchPostTagOptions', () => {
  it('trả danh sách tag; hỏng thì rỗng — mất gợi ý không được làm mất trang sửa', async () => {
    const tags = [{ slug: 'food', name: 'Food', count: 3 }];
    tagsMock.mockResolvedValueOnce(tags);
    await expect(fetchPostTagOptions('cookie=x')).resolves.toEqual(tags);

    tagsMock.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchPostTagOptions('cookie=x')).resolves.toEqual([]);
  });
});

describe('fetchPostTourOptions', () => {
  const row = (n: number) => ({
    id: `7a1b2c3d-0000-4000-8000-${String(n).padStart(12, '0')}`,
    slug: `tour-${n}`,
    title: `Tour ${n}`,
    isPublished: n % 2 === 0,
  });
  const page = (items: ReturnType<typeof row>[], totalPages: number) => ({
    items,
    page: 1,
    limit: 100,
    total: items.length,
    totalPages,
  });

  it('gom mọi trang, bỏ trùng theo id (offset trôi khi có tour mới chen vào), dừng ở trang cuối', async () => {
    toursListMock
      .mockResolvedValueOnce(page([row(1), row(2)], 2))
      .mockResolvedValueOnce(page([row(2), row(3)], 2));

    const options = await fetchPostTourOptions('cookie=x');

    expect(options.map((option) => option.slug)).toEqual(['tour-1', 'tour-2', 'tour-3']);
    expect(options[1]).toEqual({
      id: row(2).id,
      slug: 'tour-2',
      title: 'Tour 2',
      isPublished: true,
    });
    expect(toursListMock).toHaveBeenCalledTimes(2);
    expect(toursListMock).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 }, expect.anything());
  });

  it('chạm trần 10 trang: dừng, và NÓI ra một dòng thay vì cắt im lặng', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    toursListMock.mockImplementation(({ page: n }: { page: number }) =>
      Promise.resolve(page([row(n)], 12)),
    );

    const options = await fetchPostTourOptions('cookie=x');

    expect(options).toHaveLength(10);
    expect(toursListMock).toHaveBeenCalledTimes(10);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('12'));
  });

  it('lỗi API ném ra — trang sửa thiếu danh sách là trang lỗi, không phải ô chọn lặng lẽ rỗng', async () => {
    toursListMock.mockRejectedValue(new Error('boom'));

    await expect(fetchPostTourOptions('cookie=x')).rejects.toThrow('boom');
  });
});
