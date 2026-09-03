import type { Paged } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import {
  EXPORT_CONCURRENCY,
  EXPORT_MAX_ROWS,
  EXPORT_PAGE_SIZE,
  fetchAllPages,
} from './export-pages';

/**
 * Vòng gom trang DÙNG CHUNG của các nút Export CSV (nâng lên kit ở F10 —
 * consumer thứ hai: bookings F6 và subscribers F10 cùng cần "cả tập đang lọc"
 * từ một endpoint chỉ trả tối đa 100 dòng một lượt).
 *
 * Ba luật của vòng lặp được pin ở ĐÂY, một lần: trần từ-chối (không cắt bớt
 * im lặng), dedupe theo khoá qua biên trang (offset pagination trên một list
 * đang trôi), và ngân sách thời gian CHUNG cho cả vòng.
 */

interface Row {
  id: string;
}

const row = (id: string): Row => ({ id });

const paged = (over: Partial<Paged<Row>>): Paged<Row> => ({
  items: [],
  page: 1,
  limit: EXPORT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  ...over,
});

const collect = (fetchPage: (page: number, signal: AbortSignal) => Promise<Paged<Row>>) =>
  fetchAllPages(fetchPage, (item: Row) => item.id);

describe('fetchAllPages', () => {
  it('một trang: đúng một lượt gọi, trang 1, kèm signal ngân sách chung', async () => {
    const fetchPage = vi.fn(async () => paged({ items: [row('a')], total: 1 }));

    const result = await collect(fetchPage);

    expect(result).toEqual({ kind: 'rows', items: [row('a')] });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    const [page, signal] = fetchPage.mock.calls[0] as unknown as [number, AbortSignal];
    expect(page).toBe(1);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('MỘT signal duy nhất cho cả vòng — không phải một hạn mức mới mỗi trang', async () => {
    const signals: AbortSignal[] = [];
    await collect(async (page, signal) => {
      signals.push(signal);
      return paged({ items: [row(`p${page}`)], page, total: 300, totalPages: 3 });
    });

    expect(signals).toHaveLength(3);
    expect(new Set(signals).size).toBe(1);
  });

  it('total vượt trần → từ chối kèm con số, KHÔNG gọi thêm trang nào', async () => {
    const fetchPage = vi.fn(async () => paged({ total: EXPORT_MAX_ROWS + 1, totalPages: 21 }));

    const result = await collect(fetchPage);

    expect(result).toEqual({ kind: 'too-large', total: EXPORT_MAX_ROWS + 1, max: EXPORT_MAX_ROWS });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('đúng trần thì VẪN xuất — trần là "vượt quá", không phải "chạm tới"', async () => {
    const result = await collect(async (page) =>
      paged({ items: [row(`p${page}`)], page, total: EXPORT_MAX_ROWS, totalPages: 1 }),
    );

    expect(result).toMatchObject({ kind: 'rows' });
  });

  it('nhiều trang: gọi đủ 1..totalPages và gom theo đúng thứ tự trang', async () => {
    const fetchPage = vi.fn(async (page: number) =>
      paged({ items: [row(`p${page}`)], page, total: 450, totalPages: 5 }),
    );

    const result = await collect(fetchPage);

    expect(fetchPage.mock.calls.map((call) => call[0])).toEqual([1, 2, 3, 4, 5]);
    expect(result).toEqual({ kind: 'rows', items: [1, 2, 3, 4, 5].map((p) => row(`p${p}`)) });
  });

  it('`totalPages` CHỐT ở trang đầu — tập phình ra giữa chừng không kéo dài vòng lặp', async () => {
    const fetchPage = vi.fn(async (page: number) =>
      // Trang 2 khai 40 trang: nếu vòng lặp đọc lại `totalPages` mỗi lượt thì
      // một tập đang lớn dần giữ nó chạy mãi.
      paged({ items: [row(`p${page}`)], page, total: 200, totalPages: page === 1 ? 2 : 40 }),
    );

    await collect(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('gọi theo ĐỢT `EXPORT_CONCURRENCY`, không nện cả cụm cùng lúc', async () => {
    let inFlight = 0;
    let peak = 0;
    await collect(async (page) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return paged({ items: [row(`p${page}`)], page, total: 1200, totalPages: 12 });
    });

    expect(peak).toBeLessThanOrEqual(EXPORT_CONCURRENCY);
    expect(peak).toBeGreaterThan(1);
  });

  it('row lặp qua biên trang (tập trôi vì có hàng mới chen vào) bị dedupe theo khoá', async () => {
    const pages: Record<number, Row[]> = {
      1: [row('a'), row('b')],
      2: [row('b'), row('c')],
    };
    const result = await collect(async (page) =>
      paged({ items: pages[page] ?? [], page, total: 150, totalPages: 2 }),
    );

    expect(result).toEqual({ kind: 'rows', items: [row('a'), row('b'), row('c')] });
  });

  it('tập rỗng: một trang, không hàng nào — file chỉ còn dòng tiêu đề', async () => {
    const result = await collect(async () => paged({ items: [], total: 0, totalPages: 0 }));

    expect(result).toEqual({ kind: 'rows', items: [] });
  });
});
