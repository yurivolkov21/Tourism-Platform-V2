import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_WINDOW_RULES,
  canCancelOnline,
  cancellationDeadline,
  cancellationWindowDays,
  fromCents,
  isWithinDeadline,
  refundOnCancel,
  toCents,
  tripLengthDays,
  VIETNAM_TIME_ZONE,
  vietnamToday,
  windowDaysForTripLength,
} from './refund-policy.js';

/**
 * Luật hạn chót huỷ (ADR-0041) — NGUỒN của cả văn bản công khai lẫn số tiền
 * server trả, nên mỗi biên đều được khoá bằng test. Một sửa đổi "chỉ đổi chữ"
 * mà lỡ đổi số sẽ đỏ ở đây trước khi tới khách.
 *
 * Bảng bậc 100/50/25/0 và cửa sổ ân hạn 24 giờ của ADR-0030 đã gỡ cùng file
 * nguồn; lịch sử của chúng nằm ở ADR-0030 và các entry CHANGELOG trước 15/09.
 */

describe('số học tiền dùng chung (vòng vá review 05/09)', () => {
  it('toCents/fromCents khứ hồi, HALF_UP ở chữ số thứ ba', () => {
    expect(toCents('12.345')).toBe(1235);
    expect(toCents('12.344')).toBe(1234);
    expect(fromCents(toCents('0.10'))).toBe('0.10');
  });
});

/**
 * Hạn chót một mốc mỗi chuyến (ADR-0041). Mọi con số của luật khoá ở đây: N theo
 * độ dài chuyến, ngày chót, ranh giới nửa đêm giờ Việt Nam và số tiền hoàn. Một
 * sửa đổi lỡ tay ở bảng N sẽ đỏ ở đây trước khi tới khách.
 */
describe('hạn chót một mốc mỗi chuyến (ADR-0041)', () => {
  describe('CANCELLATION_WINDOW_RULES', () => {
    it('bảng ba dòng của spec §3.1 — khoá con số sẽ công bố với khách', () => {
      expect(CANCELLATION_WINDOW_RULES).toEqual([
        { minTripDays: 1, maxTripDays: 1, windowDays: 1 },
        { minTripDays: 2, maxTripDays: 3, windowDays: 3 },
        { minTripDays: 4, maxTripDays: null, windowDays: 7 },
      ]);
    });

    it('phủ KÍN mọi độ dài từ 1 ngày: dòng sau nối tiếp dòng trước, dòng cuối không trần', () => {
      // Hở một khe thì `windowDaysForTripLength` ném lỗi cho chuyến rơi vào khe đó.
      expect(CANCELLATION_WINDOW_RULES[0]?.minTripDays).toBe(1);
      CANCELLATION_WINDOW_RULES.forEach((rule, index) => {
        const next = CANCELLATION_WINDOW_RULES[index + 1];
        if (next === undefined) {
          expect(rule.maxTripDays).toBeNull();
        } else {
          expect(next.minTripDays).toBe((rule.maxTripDays ?? Number.NaN) + 1);
        }
      });
    });
  });

  describe('tripLengthDays và N', () => {
    it.each([
      ['2026-10-20', '2026-10-20', 1],
      ['2026-10-20', '2026-10-21', 2],
      ['2026-10-20', '2026-10-22', 3],
      ['2026-10-20', '2026-10-23', 4],
      ['2026-10-20', '2026-10-31', 12],
    ] as const)('L của chuyến %s → %s là %i ngày', (startDate, endDate, days) => {
      expect(tripLengthDays(startDate, endDate)).toBe(days);
    });

    it('đếm theo ngày lịch qua cuối năm và tháng 2 năm nhuận', () => {
      expect(tripLengthDays('2026-12-30', '2027-01-02')).toBe(4);
      expect(tripLengthDays('2028-02-28', '2028-03-01')).toBe(3);
    });

    it.each([
      [1, 1],
      [2, 3],
      [3, 3],
      [4, 7],
      [12, 7],
    ] as const)('chuyến %i ngày thì N = %i', (tripDays, windowDays) => {
      expect(windowDaysForTripLength(tripDays)).toBe(windowDays);
    });

    it('cancellationWindowDays tính N thẳng từ cặp ngày', () => {
      expect(cancellationWindowDays('2026-10-20', '2026-10-20')).toBe(1);
      expect(cancellationWindowDays('2026-10-20', '2026-10-22')).toBe(3);
      expect(cancellationWindowDays('2026-10-20', '2026-10-31')).toBe(7);
    });
  });

  describe('cancellationDeadline', () => {
    it.each([
      ['hanoi-heritage-day', '2026-10-20', '2026-10-20', '2026-10-19'],
      ['mekong-can-tho-2d', '2026-10-20', '2026-10-21', '2026-10-17'],
      ['ha-giang-loop-4d', '2026-10-20', '2026-10-23', '2026-10-13'],
    ] as const)(
      'ví dụ spec §3.1: %s (%s → %s) có ngày chót %s',
      (_slug, startDate, endDate, deadline) => {
        expect(cancellationDeadline(startDate, endDate)).toBe(deadline);
      },
    );

    it('lùi qua đầu tháng và đầu năm vẫn ra ngày lịch đúng', () => {
      expect(cancellationDeadline('2026-11-03', '2026-11-06')).toBe('2026-10-27');
      expect(cancellationDeadline('2027-01-02', '2027-01-03')).toBe('2026-12-30');
    });
  });

  describe('vietnamToday', () => {
    it('23:59:59 giờ Việt Nam vẫn là hôm đó, 00:00:00 đã sang ngày mới', () => {
      expect(vietnamToday(new Date('2026-10-18T16:59:59.000Z'))).toBe('2026-10-18');
      expect(vietnamToday(new Date('2026-10-18T17:00:00.000Z'))).toBe('2026-10-19');
    });

    it('khung 00:00–06:59 giờ Việt Nam: ngày UTC còn là hôm trước — đúng ca thước UTC cũ đếm lệch (spec §1)', () => {
      const at = new Date('2026-10-18T23:30:00.000Z'); // 06:30 sáng 19/10 giờ Việt Nam
      expect(at.toISOString().slice(0, 10)).toBe('2026-10-18');
      expect(vietnamToday(at)).toBe('2026-10-19');
    });

    it('không đổi giờ theo mùa: mốc đổi ngày luôn là 17:00 UTC, kể cả đêm giao thừa', () => {
      expect(vietnamToday(new Date('2026-01-15T16:59:59.000Z'))).toBe('2026-01-15');
      expect(vietnamToday(new Date('2026-07-15T17:00:00.000Z'))).toBe('2026-07-16');
      expect(vietnamToday(new Date('2026-12-31T17:00:00.000Z'))).toBe('2027-01-01');
    });

    it('VIETNAM_TIME_ZONE là Asia/Ho_Chi_Minh — cùng tên vùng mà SQL dùng', () => {
      expect(VIETNAM_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
    });
  });

  describe('isWithinDeadline — chuyến 20–21/10: N = 3, ngày chót 17/10', () => {
    const startDate = '2026-10-20';
    const endDate = '2026-10-21';

    it('trọn ngày chót, từ 00:00 tới 23:59:59 giờ Việt Nam, còn trong hạn', () => {
      expect(isWithinDeadline(new Date('2026-10-16T17:00:00.000Z'), startDate, endDate)).toBe(true);
      expect(isWithinDeadline(new Date('2026-10-17T16:59:59.000Z'), startDate, endDate)).toBe(true);
    });

    it('00:00 giờ Việt Nam ngày sau ngày chót là quá hạn, dù UTC còn là ngày chót', () => {
      expect(isWithinDeadline(new Date('2026-10-17T17:00:00.000Z'), startDate, endDate)).toBe(
        false,
      );
      expect(isWithinDeadline(new Date('2026-10-20T03:00:00.000Z'), startDate, endDate)).toBe(
        false,
      );
    });
  });

  describe('canCancelOnline — khởi hành 20/10', () => {
    it('huỷ online được tới 23:59:59 giờ Việt Nam hôm trước ngày khởi hành', () => {
      expect(canCancelOnline(new Date('2026-10-19T16:59:59.000Z'), '2026-10-20')).toBe(true);
    });

    it('từ 00:00 giờ Việt Nam ngày khởi hành thì hết — kể cả khi UTC còn là hôm trước', () => {
      expect(canCancelOnline(new Date('2026-10-19T17:00:00.000Z'), '2026-10-20')).toBe(false);
      expect(canCancelOnline(new Date('2026-10-21T02:00:00.000Z'), '2026-10-20')).toBe(false);
    });
  });

  describe('refundOnCancel — chuyến 4 ngày 20–23/10: N = 7, ngày chót 13/10', () => {
    const trip = { startDate: '2026-10-20', endDate: '2026-10-23', totalAmount: '1200.00' };

    it('trong hạn: hoàn trọn phần CHƯA hoàn, không phải cả tổng', () => {
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-13T16:59:59.000Z'),
          refundedTotal: '0.00',
        }),
      ).toBe('1200.00');
      // Đã hoàn thiện chí 200.50 từ trước → chỉ còn 999.50.
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-01T09:00:00.000Z'),
          refundedTotal: '200.50',
        }),
      ).toBe('999.50');
    });

    it('quá hạn: 0.00 dù sổ còn tiền chưa hoàn', () => {
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-13T17:00:00.000Z'),
          refundedTotal: '0.00',
        }),
      ).toBe('0.00');
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-15T09:00:00.000Z'),
          refundedTotal: '200.50',
        }),
      ).toBe('0.00');
    });

    it('đã hoàn đủ từ trước thì trong hạn cũng chỉ còn 0.00, không âm', () => {
      expect(
        refundOnCancel({
          ...trip,
          now: new Date('2026-10-01T09:00:00.000Z'),
          refundedTotal: '1200.00',
        }),
      ).toBe('0.00');
    });
  });

  describe('dữ liệu hỏng thì NÉM RangeError, không âm thầm ra một hạn chót sai', () => {
    const now = new Date('2026-10-01T09:00:00.000Z');

    it.each(['2026-02-31', '2026-13-01', '2026-10-2', '20/10/2026', '', 'bad'])(
      'ngày hỏng %j',
      (bad) => {
        expect(() => tripLengthDays(bad, '2026-10-20')).toThrow(RangeError);
        expect(() => tripLengthDays('2026-10-20', bad)).toThrow(RangeError);
        expect(() => cancellationDeadline(bad, '2026-10-20')).toThrow(RangeError);
        expect(() => isWithinDeadline(now, '2026-10-20', bad)).toThrow(RangeError);
        expect(() => canCancelOnline(now, bad)).toThrow(RangeError);
      },
    );

    it('ngày về trước ngày đi', () => {
      expect(() => tripLengthDays('2026-10-20', '2026-10-19')).toThrow(RangeError);
      expect(() => cancellationWindowDays('2026-10-20', '2026-10-19')).toThrow(RangeError);
      expect(() =>
        refundOnCancel({
          now,
          startDate: '2026-10-20',
          endDate: '2026-10-19',
          totalAmount: '10.00',
          refundedTotal: '0.00',
        }),
      ).toThrow(RangeError);
    });

    it('Invalid Date', () => {
      expect(() => vietnamToday(new Date('not a date'))).toThrow(RangeError);
      expect(() => isWithinDeadline(new Date(Number.NaN), '2026-10-20', '2026-10-21')).toThrow(
        RangeError,
      );
      expect(() => canCancelOnline(new Date(Number.NaN), '2026-10-20')).toThrow(RangeError);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('độ dài chuyến %s', (tripDays) => {
      expect(() => windowDaysForTripLength(tripDays)).toThrow(RangeError);
    });
  });
});
