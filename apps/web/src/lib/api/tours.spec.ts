import { ORPCError } from '@orpc/client';
import { notFound } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { ENRICHMENT_TOUR_BUDGET_MS, fetchTourDetailOrNull } from './tours';

// Mock client oRPC — chỉ soi kết quả của lượt đọc tour; không gọi API thật.
const { bySlug } = vi.hoisted(() => ({ bySlug: vi.fn() }));
vi.mock('./client', () => ({ api: { catalog: { tours: { bySlug } } } }));

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  bySlug.mockReset();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

/** Phần tour `resolveDepartureAnchors` đọc, kèm điểm hẹn để soi kết quả. */
const TOUR = { basePrice: '49.00', departures: [], meetingPoint: 'Hotel pickup — Hoàn Kiếm' };

/** Lỗi mà `fn` ném ra — để lấy đúng lỗi nội bộ Next dựng (digest riêng của nó). */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('hàm phải ném');
}

/**
 * Tour chỉ làm GIÀU trang chi tiết đơn và voucher (điểm hẹn, mục không gồm, lịch trình): tour đã
 * gỡ hay API catalog hỏng đều rơi về `null`, trang của khách vẫn chạy (plan P7, quyết định 22;
 * review P7 B16, C#6 — một bản thay hai bản chép).
 */
describe('fetchTourDetailOrNull', () => {
  it('tour còn: trả dữ liệu tour, không cảnh báo', async () => {
    bySlug.mockResolvedValueOnce(TOUR);
    await expect(fetchTourDetailOrNull('hanoi-heritage-day')).resolves.toMatchObject({
      meetingPoint: 'Hotel pickup — Hoàn Kiếm',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('tour đã gỡ (NOT_FOUND): null, không cảnh báo — nhánh hợp lệ chứ không phải sự cố', async () => {
    bySlug.mockRejectedValueOnce(new ORPCError('NOT_FOUND', { defined: true }));
    await expect(fetchTourDetailOrNull('retired-tour')).resolves.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('API catalog hỏng: null kèm cảnh báo có slug và lỗi gốc', async () => {
    const failure = new Error('fetch failed');
    bySlug.mockRejectedValueOnce(failure);
    await expect(fetchTourDetailOrNull('hanoi-heritage-day')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"hanoi-heritage-day"'), failure);
  });

  it('API catalog treo: quá trần thì null kèm cảnh báo, trang không đứng chờ ~62 giây (W-07)', async () => {
    vi.useFakeTimers();
    try {
      bySlug.mockReturnValueOnce(new Promise(() => {}));
      const pending = fetchTourDetailOrNull('hanoi-heritage-day');
      await vi.advanceTimersByTimeAsync(ENRICHMENT_TOUR_BUDGET_MS);
      await expect(pending).resolves.toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"hanoi-heritage-day"'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('tour về kịp trước trần: trả dữ liệu, không cảnh báo, không để timer treo', async () => {
    vi.useFakeTimers();
    try {
      bySlug.mockResolvedValueOnce(TOUR);
      await expect(fetchTourDetailOrNull('hanoi-heritage-day')).resolves.toMatchObject({
        meetingPoint: 'Hotel pickup — Hoàn Kiếm',
      });
      expect(vi.getTimerCount()).toBe(0);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('lỗi nội bộ của Next (notFound, redirect, bail-out động) thì ném lại, không nuốt', async () => {
    const nextError = thrownBy(() => notFound());
    bySlug.mockRejectedValueOnce(nextError);
    await expect(fetchTourDetailOrNull('hanoi-heritage-day')).rejects.toBe(nextError);
    expect(warn).not.toHaveBeenCalled();
  });
});
