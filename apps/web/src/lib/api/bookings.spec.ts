import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMyBookingsPage } from './bookings';

// Mock client oRPC — chỉ soi procedure, input và cookie; không gọi API thật.
const { mine } = vi.hoisted(() => ({ mine: vi.fn() }));
vi.mock('./client', () => ({
  api: { bookings: { mine } },
  withAuthHeaders: (cookie: string) => ({ auth: { cookie } }),
}));

beforeEach(() => {
  mine.mockReset();
});

describe('fetchMyBookingsPage', () => {
  it('gửi NGUYÊN input của trang cùng cookie phiên, trả nguyên kết quả', async () => {
    const result = {
      items: [],
      page: 2,
      limit: 10,
      total: 11,
      totalPages: 2,
      facets: {
        when: { ON_TOUR: 0, UPCOMING: 11, PAST: 3 },
        status: { PENDING: 0, PAID: 14, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
      },
      overallTotal: 14,
    };
    mine.mockResolvedValueOnce(result);
    const input = {
      page: 2,
      limit: 10,
      order: 'journey' as const,
      when: ['UPCOMING' as const],
      q: 'hue',
    };

    await expect(fetchMyBookingsPage('session=abc', input)).resolves.toBe(result);
    expect(mine).toHaveBeenCalledWith(input, { context: { auth: { cookie: 'session=abc' } } });
  });
});
