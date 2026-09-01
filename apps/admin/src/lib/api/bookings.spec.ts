import type { Booking, Paged } from '@tourism/contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EXPORT_MAX_ROWS, EXPORT_PAGE_SIZE, fetchAllAdminBookings } from './bookings';
import { api } from './client';

/**
 * Vòng gom trang của Export CSV (spec P4b §3-F6, siết ở vòng vá review F6
 * lần 2). Mock oRPC client để test được ba luật thuần của vòng lặp — trần
 * từ-chối, dedupe theo code, và hình dạng request (limit trần contract,
 * `includeMedia: false`, một signal chung) — không cần API sống.
 */
vi.mock('./client', () => ({
  api: { admin: { bookings: { list: vi.fn(), byCode: vi.fn(), refund: vi.fn() } } },
  withAdminAuth: (cookie: string) => ({ cookie }),
}));

const listMock = api.admin.bookings.list as unknown as Mock;

/** Booking tối giản cho vòng lặp — nó chỉ đọc `code`. */
const row = (code: string) => ({ code }) as unknown as Booking;

const paged = (over: Partial<Paged<Booking>>): Paged<Booking> => ({
  items: [],
  page: 1,
  limit: EXPORT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  ...over,
});

beforeEach(() => {
  listMock.mockReset();
});

describe('fetchAllAdminBookings', () => {
  it('một trang: một request, limit là trần contract, media TẮT, signal chung có mặt', async () => {
    listMock.mockResolvedValue(paged({ items: [row('BK-AAAA0001')], total: 1 }));

    const result = await fetchAllAdminBookings('cookie=x', { page: 4, limit: 20 });

    expect(result).toEqual({ kind: 'rows', bookings: [row('BK-AAAA0001')] });
    expect(listMock).toHaveBeenCalledTimes(1);
    const [input, options] = listMock.mock.calls[0] as [
      Record<string, unknown>,
      { context: { cookie: string; signal?: AbortSignal } },
    ];
    // Trang/limit của URL đang xem bị GHI ĐÈ — file là cả tập, không phải trang.
    expect(input).toMatchObject({ page: 1, limit: EXPORT_PAGE_SIZE, includeMedia: false });
    expect(options.context.cookie).toBe('cookie=x');
    // Ngân sách thời gian CHUNG (không phải timeout 10s/lượt của link).
    expect(options.context.signal).toBeInstanceOf(AbortSignal);
  });

  it('total vượt trần → từ chối kèm con số, KHÔNG gọi thêm trang nào', async () => {
    listMock.mockResolvedValue(paged({ total: EXPORT_MAX_ROWS + 1, totalPages: 21 }));

    const result = await fetchAllAdminBookings('cookie=x', { page: 1, limit: 20 });

    expect(result).toEqual({
      kind: 'too-large',
      total: EXPORT_MAX_ROWS + 1,
      max: EXPORT_MAX_ROWS,
    });
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('nhiều trang: gọi đủ 1..totalPages (theo đợt) và gom theo đúng thứ tự trang', async () => {
    listMock.mockImplementation(async (input: { page: number }) =>
      paged({
        items: [row(`BK-PAGE000${input.page}`)],
        page: input.page,
        total: 450,
        totalPages: 5,
      }),
    );

    const result = await fetchAllAdminBookings('cookie=x', { page: 1, limit: 20 });

    expect(listMock).toHaveBeenCalledTimes(5);
    expect(listMock.mock.calls.map((call) => (call[0] as { page: number }).page)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(result).toEqual({
      kind: 'rows',
      bookings: [1, 2, 3, 4, 5].map((page) => row(`BK-PAGE000${page}`)),
    });
  });

  it('row lặp qua biên trang (tập trôi khi có booking mới chen vào) bị dedupe theo code', async () => {
    // Offset pagination trên list "mới nhất trước": booking mới đẩy hàng cuối
    // trang 1 quay lại đầu trang 2 — không dedupe thì file mang một mã hai lần.
    const pages: Record<number, Booking[]> = {
      1: [row('BK-AAAA0001'), row('BK-AAAA0002')],
      2: [row('BK-AAAA0002'), row('BK-AAAA0003')],
    };
    listMock.mockImplementation(async (input: { page: number }) =>
      paged({ items: pages[input.page] ?? [], page: input.page, total: 150, totalPages: 2 }),
    );

    const result = await fetchAllAdminBookings('cookie=x', { page: 1, limit: 20 });

    expect(result).toEqual({
      kind: 'rows',
      bookings: [row('BK-AAAA0001'), row('BK-AAAA0002'), row('BK-AAAA0003')],
    });
  });
});
