import type { Booking, Paged } from '@tourism/contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EXPORT_MAX_ROWS, EXPORT_PAGE_SIZE } from '@/lib/export-pages';
import { fetchAllAdminBookings } from './bookings';
import { api } from './client';

/**
 * Phần RIÊNG của vùng bookings trong vòng gom Export CSV (spec P4b §3-F6):
 * hình dạng request (limit trần contract, `includeMedia: false`, cookie +
 * một signal chung) và khoá dedupe là `code`. Luật của chính vòng lặp — trần
 * từ-chối, đợt song song, dedupe, tập đổi giữa chừng — pin ở
 * `export-pages.spec.ts` (vòng vá review F10: bản đầu chép lại bốn kịch bản
 * đó ở đây với mock oRPC).
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
  it('request: limit là trần contract, media TẮT, cookie + signal chung; trang/limit của URL bị GHI ĐÈ', async () => {
    listMock.mockResolvedValue(paged({ items: [row('BK-AAAA0001')], total: 1 }));

    const result = await fetchAllAdminBookings('cookie=x', { page: 4, limit: 20 });

    expect(result).toEqual({ kind: 'rows', items: [row('BK-AAAA0001')] });
    const [input, options] = listMock.mock.calls[0] as [
      Record<string, unknown>,
      { context: { cookie: string; signal?: AbortSignal } },
    ];
    expect(input).toMatchObject({ page: 1, limit: EXPORT_PAGE_SIZE, includeMedia: false });
    expect(options.context.cookie).toBe('cookie=x');
    expect(options.context.signal).toBeInstanceOf(AbortSignal);
  });

  it('lời từ chối của vòng gom đi qua NGUYÊN (cùng hình dạng PagedExport với subscribers)', async () => {
    listMock.mockResolvedValue(paged({ total: EXPORT_MAX_ROWS + 1, totalPages: 21 }));
    expect(await fetchAllAdminBookings('cookie=x', { page: 1, limit: 20 })).toEqual({
      kind: 'too-large',
      total: EXPORT_MAX_ROWS + 1,
      max: EXPORT_MAX_ROWS,
    });
  });

  it('dedupe theo `code` — khoá tự nhiên của hàng, cùng khoá mà cột checkbox dùng', async () => {
    const pages: Record<number, Booking[]> = {
      1: [row('BK-AAAA0001'), row('BK-AAAA0002')],
      2: [row('BK-AAAA0002'), row('BK-AAAA0003')],
    };
    listMock.mockImplementation(async (input: { page: number }) =>
      paged({ items: pages[input.page] ?? [], page: input.page, total: 150, totalPages: 2 }),
    );
    expect(await fetchAllAdminBookings('cookie=x', { page: 1, limit: 20 })).toEqual({
      kind: 'rows',
      items: [row('BK-AAAA0001'), row('BK-AAAA0002'), row('BK-AAAA0003')],
    });
  });
});
