import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { daysUntilDeparture, groupBookingsByTime } from './account-stats';

const TODAY = '2026-08-04';

// "Hôm nay" cố định để test biên ngày không phụ thuộc giờ chạy CI thật.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('daysUntilDeparture — đồng hồ đếm ngược trên thẻ chuyến kế tiếp', () => {
  it('khởi hành hôm nay → 0, KHÔNG âm', () => {
    expect(daysUntilDeparture(TODAY)).toBe(0);
  });

  it('ngày mai → 1', () => {
    expect(daysUntilDeparture('2026-08-05')).toBe(1);
  });

  it('đếm đúng qua ranh giới THÁNG', () => {
    // 04/08 → 01/09 là 28 ngày. Trừ chuỗi ngày kiểu ngây thơ sẽ ra sai ở đây.
    expect(daysUntilDeparture('2026-09-01')).toBe(28);
  });

  it('chuyến đã qua → số ÂM, để chỗ gọi tự quyết hiển thị gì', () => {
    expect(daysUntilDeparture('2026-08-01')).toBe(-3);
  });

  it('KHÔNG lệch vì múi giờ — so theo ngày lịch UTC, không theo giờ máy', () => {
    // Chạy lúc 12:00 UTC (beforeEach). Nếu hàm dùng giờ địa phương của máy
    // thì một máy ở UTC+7 sẽ cho lệch một ngày ở các mốc gần nửa đêm.
    vi.setSystemTime(new Date(`${TODAY}T23:59:59.000Z`));
    expect(daysUntilDeparture('2026-08-05')).toBe(1);
    vi.setSystemTime(new Date(`${TODAY}T00:00:01.000Z`));
    expect(daysUntilDeparture('2026-08-05')).toBe(1);
  });
});

describe('groupBookingsByTime — ba nhóm của /account/bookings', () => {
  const trip = (code: string, start: string, end: string, over = {}) =>
    makeBooking({ code, departureStartDate: start, departureEndDate: end, ...over });

  it('rỗng → ba nhóm rỗng, không ném', () => {
    expect(groupBookingsByTime([])).toEqual({ onTheRoad: [], upcoming: [], past: [] });
  });

  it('đang đi: hôm nay NẰM TRONG khoảng khởi hành, và đã trả tiền', () => {
    const now = trip('BK-ONROAD01', '2026-08-02', '2026-08-06');
    expect(groupBookingsByTime([now]).onTheRoad.map((b) => b.code)).toEqual(['BK-ONROAD01']);
  });

  it('ngày bắt đầu và ngày kết thúc đều TÍNH LÀ đang đi — biên đóng hai đầu', () => {
    // Chuyến khởi hành đúng hôm nay chưa thể là "sắp tới"; chuyến kết thúc
    // đúng hôm nay chưa thể là "đã qua".
    expect(groupBookingsByTime([trip('BK-STARTTOD', TODAY, '2026-08-09')]).onTheRoad).toHaveLength(
      1,
    );
    expect(groupBookingsByTime([trip('BK-ENDSTODA', '2026-08-01', TODAY)]).onTheRoad).toHaveLength(
      1,
    );
  });

  it('CANCELLED luôn vào "đã qua", kể cả khi ngày còn ở tương lai', () => {
    // Nói một chuyến đã huỷ là "sắp tới" thì đang hứa thứ không xảy ra.
    const cancelled = trip('BK-CANCEL01', '2026-12-01', '2026-12-05', {
      status: 'CANCELLED' as const,
    });
    const g = groupBookingsByTime([cancelled]);
    expect(g.past.map((b) => b.code)).toEqual(['BK-CANCEL01']);
    expect(g.upcoming).toEqual([]);
  });

  it('CHƯA trả tiền mà ngày đã tới → "sắp tới", KHÔNG phải "đang đi"', () => {
    // PENDING không giữ chỗ (bất biến #1), nên gọi nó là "đang đi" là sai sự
    // thật. Để ở "sắp tới" kèm pill "Awaiting payment" mới đúng mức khẩn.
    const pending = trip('BK-PENDNOW1', '2026-08-02', '2026-08-06', { status: 'PENDING' as const });
    const g = groupBookingsByTime([pending]);
    expect(g.onTheRoad).toEqual([]);
    expect(g.upcoming.map((b) => b.code)).toEqual(['BK-PENDNOW1']);
  });

  it('sắp tới: gần nhất TRƯỚC', () => {
    const far = trip('BK-FAR00001', '2026-12-01', '2026-12-05');
    const near = trip('BK-NEAR0001', '2026-08-20', '2026-08-22');
    expect(groupBookingsByTime([far, near]).upcoming.map((b) => b.code)).toEqual([
      'BK-NEAR0001',
      'BK-FAR00001',
    ]);
  });

  it('đã qua: MỚI NHẤT trước — ngược chiều với sắp tới', () => {
    const old = trip('BK-OLD00001', '2026-01-01', '2026-01-03');
    const recent = trip('BK-RECENT01', '2026-07-01', '2026-07-03');
    expect(groupBookingsByTime([old, recent]).past.map((b) => b.code)).toEqual([
      'BK-RECENT01',
      'BK-OLD00001',
    ]);
  });

  it('KHÔNG làm mất booking nào — tổng ba nhóm bằng đầu vào', () => {
    const all = [
      trip('BK-AAAAAAA1', '2026-08-02', '2026-08-06'),
      trip('BK-BBBBBBB1', '2026-12-01', '2026-12-05'),
      trip('BK-CCCCCCC1', '2026-01-01', '2026-01-03'),
      trip('BK-DDDDDDD1', '2026-12-01', '2026-12-05', { status: 'CANCELLED' as const }),
    ];
    const g = groupBookingsByTime(all);
    expect(g.onTheRoad.length + g.upcoming.length + g.past.length).toBe(all.length);
  });

  it('KHÔNG sửa mảng gốc', () => {
    const input = [
      trip('BK-ZZZZZZZ1', '2026-12-01', '2026-12-05'),
      trip('BK-YYYYYYY1', '2026-08-20', '2026-08-22'),
    ];
    const before = input.map((b) => b.code);
    groupBookingsByTime(input);
    expect(input.map((b) => b.code)).toEqual(before);
  });
});
