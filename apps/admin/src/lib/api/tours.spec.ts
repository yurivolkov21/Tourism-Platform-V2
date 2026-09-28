import { ORPCError } from '@orpc/client';
import type { AdminCategoryRow, AdminDestinationRow } from '@tourism/contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { api } from './client';
import {
  fetchAdminTour,
  fetchTourCategories,
  fetchTourDestinationOptions,
  fetchTourEditorOptions,
} from './tours';

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
  api: {
    admin: {
      categories: { list: vi.fn() },
      destinations: { list: vi.fn() },
      tours: { get: vi.fn() },
    },
  },
  withAdminAuth: (cookie: string) => ({ cookie }),
}));

const listMock = api.admin.categories.list as unknown as Mock;
const destinationsMock = api.admin.destinations.list as unknown as Mock;
const getTourMock = api.admin.tours.get as unknown as Mock;

const destination = (over: Partial<AdminDestinationRow>): AdminDestinationRow => ({
  id: 'c0000002-0000-4000-8000-000000000001',
  slug: 'hanoi',
  name: 'Hà Nội',
  country: 'Vietnam',
  region: 'Northern Vietnam',
  description: null,
  isActive: true,
  tourCount: 5,
  ...over,
});

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
  destinationsMock.mockReset();
  getTourMock.mockReset();
});

describe('fetchAdminTour (spec F17 §2g)', () => {
  it('trả nguyên tour server gửi', async () => {
    const detail = detailFixture();
    getTourMock.mockResolvedValue(detail);

    await expect(fetchAdminTour('cookie=x', 'ha-long-bay-cruise')).resolves.toEqual(detail);
    expect(getTourMock).toHaveBeenCalledWith({ slug: 'ha-long-bay-cruise' }, expect.anything());
  });

  it('khe deploy: API cũ chưa trả photos và readiness.cover → lùi về [] và true', async () => {
    const { photos: _photos, readiness, ...rest } = detailFixture();
    const { cover: _cover, ...oldReadiness } = readiness;
    getTourMock.mockResolvedValue({ ...rest, readiness: oldReadiness });

    const detail = await fetchAdminTour('cookie=x', 'ha-long-bay-cruise');

    expect(detail?.photos).toEqual([]);
    expect(detail?.readiness.cover).toBe(true);
  });

  it('NOT_FOUND do contract KHAI thì trả null — trang gọi notFound()', async () => {
    getTourMock.mockRejectedValue(new ORPCError('NOT_FOUND', { defined: true, status: 404 }));

    await expect(fetchAdminTour('cookie=x', 'gone')).resolves.toBeNull();
  });

  it('slug dài quá trần của contract → null, không gọi API (vòng review F17)', async () => {
    // Không chặn ở đây thì API trả 400 (input hỏng), hàm ném lại và URL rác ra
    // trang lỗi của app thay vì 404.
    getTourMock.mockReset();

    await expect(fetchAdminTour('cookie=x', 'x'.repeat(121))).resolves.toBeNull();
    expect(getTourMock).not.toHaveBeenCalled();
  });

  it('NOT_FOUND KHÔNG khai (route chưa có, khe deploy) và mọi lỗi khác thì ném lại', async () => {
    getTourMock.mockRejectedValueOnce(new ORPCError('NOT_FOUND'));
    await expect(fetchAdminTour('cookie=x', 'x')).rejects.toBeInstanceOf(ORPCError);

    getTourMock.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchAdminTour('cookie=x', 'x')).rejects.toThrow('boom');
  });
});

describe('fetchTourDestinationOptions (hộp New tour ở trang Tours)', () => {
  it('chở id, tên và isActive của mọi điểm đến, kể cả điểm đã ẩn', async () => {
    destinationsMock.mockResolvedValue([
      destination({}),
      destination({ id: 'c0000002-0000-4000-8000-000000000009', name: 'An Bàng', isActive: false }),
    ]);

    await expect(fetchTourDestinationOptions('cookie=x')).resolves.toEqual([
      { id: 'c0000002-0000-4000-8000-000000000001', name: 'Hà Nội', isActive: true },
      { id: 'c0000002-0000-4000-8000-000000000009', name: 'An Bàng', isActive: false },
    ]);
  });

  it('lời gọi hỏng thì trả RỖNG — bảng tour không sập theo hộp tạo', async () => {
    destinationsMock.mockRejectedValue(new Error('boom'));

    await expect(fetchTourDestinationOptions('cookie=x')).resolves.toEqual([]);
  });
});

describe('fetchTourEditorOptions (khu làm việc)', () => {
  it('hai danh sách chọn, mỗi mục chở isActive — cả mục đang hiện lẫn mục đã ẩn', async () => {
    listMock.mockResolvedValue([
      row({}),
      row({ id: 'b0000001-0000-4000-8000-000000000004', name: 'Trekking', isActive: false }),
    ]);
    destinationsMock.mockResolvedValue([
      destination({}),
      destination({ id: 'c0000002-0000-4000-8000-000000000009', name: 'An Bàng', isActive: false }),
    ]);

    await expect(fetchTourEditorOptions('cookie=x')).resolves.toEqual({
      categories: [
        { id: 'b0000001-0000-4000-8000-000000000001', name: 'Day Tours', isActive: true },
        { id: 'b0000001-0000-4000-8000-000000000004', name: 'Trekking', isActive: false },
      ],
      destinations: [
        { id: 'c0000002-0000-4000-8000-000000000001', name: 'Hà Nội', isActive: true },
        { id: 'c0000002-0000-4000-8000-000000000009', name: 'An Bàng', isActive: false },
      ],
    });
  });

  it('KHÔNG nuốt lỗi — ô chọn rỗng trong form SỬA là mời lưu đè danh mục', async () => {
    listMock.mockResolvedValue([row({})]);
    destinationsMock.mockRejectedValue(new Error('boom'));

    await expect(fetchTourEditorOptions('cookie=x')).rejects.toThrow('boom');
  });
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
