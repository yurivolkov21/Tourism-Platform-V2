import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayDateString } from './account-stats';

const TODAY = '2026-08-04';

// Hai mốc biên của ngày lịch Việt Nam (UTC+7, không có giờ mùa hè): 23:59:59.999
// giờ VN ngày 04/08 và 00:00 giờ VN ngày 05/08. Ở CẢ HAI mốc, ngày UTC vẫn là
// 04/08 — nên hàm nào còn cắt ngày theo UTC sẽ trả cùng một đáp án cho cả hai.
const LAST_MS_OF_TODAY_VN = `${TODAY}T16:59:59.999Z`;
const MIDNIGHT_TOMORROW_VN = `${TODAY}T17:00:00.000Z`;

// "Hôm nay" cố định để test biên ngày không phụ thuộc giờ chạy CI thật.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('todayDateString — "hôm nay" là ngày lịch Việt Nam (ADR-0041 §7)', () => {
  it('23:59:59.999 giờ VN vẫn là ngày cũ', () => {
    vi.setSystemTime(new Date(LAST_MS_OF_TODAY_VN));
    expect(todayDateString()).toBe('2026-08-04');
  });

  it('00:00 giờ VN (17:00Z) đã sang ngày mới, dù ngày UTC còn là hôm trước', () => {
    // Đây là khung 00:00–07:00 giờ VN: server đã tính ngày mới (hạn huỷ online,
    // giai đoạn chuyến của admin), trang account không được tụt lại một ngày.
    vi.setSystemTime(new Date(MIDNIGHT_TOMORROW_VN));
    expect(todayDateString()).toBe('2026-08-05');
  });
});
