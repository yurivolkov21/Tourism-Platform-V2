import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { api } from './client';
import { ADMIN_STATS_TAG, fetchAdminBookingsStats, fetchDashboardBookingsStats } from './stats';

/**
 * Luật cache của hai đường đọc `admin.stats.bookings` (ADR-0036 AMEND 3, review A1). Cùng một
 * endpoint nhưng hai số phận: hàng card của `/bookings` cache 60s theo tag (ngoại lệ có chủ đích
 * của vòng F5 — refetch trên mỗi click phân trang), còn bốn card của dashboard `/` thì KHÔNG,
 * vì Data Cache là stale-while-revalidate: mở lại `/` sau một khoản trả tiền thì biểu đồ tươi
 * có tiền mới còn card cache vẫn mang số của lượt xem trước.
 */
vi.mock('./client', () => ({
  api: { admin: { stats: { bookings: vi.fn() } } },
  withAdminAuth: (cookie: string) => ({ cookie }),
}));

const bookingsMock = api.admin.stats.bookings as unknown as Mock;

beforeEach(() => {
  bookingsMock.mockReset();
  bookingsMock.mockResolvedValue({});
});

describe('fetchDashboardBookingsStats', () => {
  it('cửa sổ trượt 28 ngày (`{}`), context CHỈ có cookie — không `cacheFor`', async () => {
    await fetchDashboardBookingsStats('cookie=x');

    expect(bookingsMock).toHaveBeenCalledWith({}, { context: { cookie: 'cookie=x' } });
  });
});

describe('fetchAdminBookingsStats', () => {
  it('`/bookings` giữ cache 60s theo tag để server action `updateTag` được', async () => {
    await fetchAdminBookingsStats('cookie=x', { from: '2026-10-01', to: '2026-10-31' });

    expect(bookingsMock).toHaveBeenCalledWith(
      { from: '2026-10-01', to: '2026-10-31' },
      { context: { cookie: 'cookie=x', cacheFor: { seconds: 60, tags: [ADMIN_STATS_TAG] } } },
    );
  });
});
