import { describe, expect, it } from 'vitest';
import {
  daysBeforeDeparture,
  fromCents,
  fullRefundThresholdDays,
  percentOfAmount,
  policyRefundAmount,
  REFUND_GRACE_HOURS,
  REFUND_POLICY_TIERS,
  refundPercentForBooking,
  refundPercentForDays,
  refundPercentForRequest,
  toCents,
} from './refund-policy.js';

/**
 * Chính sách hoàn tiền (ADR-0030) — đây là NGUỒN của cả văn bản công khai lẫn
 * số tiền server trả, nên mỗi bậc và mỗi biên đều được khoá bằng test. Một
 * sửa đổi "chỉ đổi chữ" mà lỡ đổi số sẽ đỏ ở đây trước khi tới khách.
 */

describe('REFUND_POLICY_TIERS', () => {
  it('xếp GIẢM DẦN theo minDaysBefore — điều kiện để phép tra "khớp đầu tiên" đúng', () => {
    // Xếp sai thứ tự thì `find` trả bậc hẹp hơn và khách bị hoàn thiếu.
    const mins = REFUND_POLICY_TIERS.map((tier) => tier.minDaysBefore);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
  });

  it('phủ KÍN mọi số ngày ≥ 0 — bậc cuối phải bắt đầu từ 0', () => {
    // Lỗ ngày 14 của bản văn xuôi cũ sinh ra chính vì hai bậc không khít nhau.
    expect(REFUND_POLICY_TIERS.at(-1)?.minDaysBefore).toBe(0);
  });

  it('phần trăm nằm trong 0..100 và giảm dần theo bậc', () => {
    const percents = REFUND_POLICY_TIERS.map((tier) => tier.percent);
    expect(percents.every((p) => p >= 0 && p <= 100)).toBe(true);
    expect(percents).toEqual([...percents].sort((a, b) => b - a));
  });
});

describe('refundPercentForDays', () => {
  it('bốn bậc của ADR-0030 §2', () => {
    expect(refundPercentForDays(45)).toBe(100);
    expect(refundPercentForDays(30)).toBe(100);
    expect(refundPercentForDays(29)).toBe(50);
    expect(refundPercentForDays(15)).toBe(50);
    expect(refundPercentForDays(7)).toBe(25);
    expect(refundPercentForDays(6)).toBe(0);
    expect(refundPercentForDays(0)).toBe(0);
  });

  it('NGÀY 14 có bậc — đây là lỗ của bản văn xuôi cũ', () => {
    // Bản cũ viết "15–29 ngày" và "dưới 14 ngày", bỏ rơi đúng ngày 14 chẵn.
    expect(refundPercentForDays(14)).toBe(25);
  });

  it('yêu cầu gửi SAU khi đã khởi hành (ngày âm) không hoàn đồng nào', () => {
    expect(refundPercentForDays(-1)).toBe(0);
    expect(refundPercentForDays(-30)).toBe(0);
  });
});

describe('fullRefundThresholdDays', () => {
  it('tour không có badge thì theo bậc cao nhất của site', () => {
    expect(fullRefundThresholdDays(null)).toBe(30);
  });

  it('tour có badge thì badge là ngưỡng — kể cả khi rộng rãi hơn site', () => {
    expect(fullRefundThresholdDays(7)).toBe(7);
    expect(fullRefundThresholdDays(21)).toBe(21);
  });
});

describe('refundPercentForBooking', () => {
  it('badge NÂNG ngưỡng 100% lên trên bậc site', () => {
    // Tour "Free until 21 days": ngày 21 hoàn 100% dù bậc site chỉ cho 50%.
    expect(refundPercentForBooking(21, 21)).toBe(100);
    expect(refundPercentForBooking(21, null)).toBe(50);
  });

  it('dưới ngưỡng badge thì bảng bậc áp bình thường', () => {
    expect(refundPercentForBooking(20, 21)).toBe(50);
    expect(refundPercentForBooking(10, 21)).toBe(25);
    expect(refundPercentForBooking(3, 21)).toBe(0);
  });

  it('badge KHÔNG BAO GIỜ tệ hơn bậc site — nó chỉ nâng, không hạ', () => {
    // Bất biến quan trọng nhất của việc ghép hai nguồn: với MỌI số ngày, tour
    // có badge phải hoàn ≥ tour không badge. Nếu bất biến này vỡ thì badge trở
    // thành một lời hứa làm khách THIỆT, và đó mới là mâu thuẫn với chính sách.
    for (const badge of [7, 8, 10, 14, 15, 21, 30]) {
      for (let days = -2; days <= 40; days += 1) {
        expect(refundPercentForBooking(days, badge)).toBeGreaterThanOrEqual(
          refundPercentForDays(days),
        );
      }
    }
  });

  it('ĐỘ CAO của vực ngay dưới hạn badge — số đo, không phải phỏng đoán', () => {
    // Bảng này là bằng chứng cho quyết định chọn SÀN của badge: sàn 7 KHÔNG
    // xoá được vực 100 điểm (ngày 6 vẫn rơi vào bậc <7 = 0%), phải từ 8 trở
    // lên thì ngày trước hạn mới rơi vào dải 25%.
    const cliff = (badge: number) => 100 - refundPercentForDays(badge - 1);
    expect(cliff(3)).toBe(100);
    expect(cliff(5)).toBe(100);
    expect(cliff(7)).toBe(100);
    expect(cliff(8)).toBe(75);
    expect(cliff(15)).toBe(75);
    expect(cliff(16)).toBe(50);
    expect(cliff(30)).toBe(50);
  });
});

describe('daysBeforeDeparture', () => {
  it('đếm theo NGÀY LỊCH, không phải hiệu millisecond', () => {
    // Ca thật của ADR-0030 §4: 23:00 ngày 4/9 tới 4/10. Hiệu millisecond là
    // 29,04 ngày → làm tròn xuống 29 → rơi nhầm bậc 50%. Lịch nói 30 → 100%.
    const requested = new Date('2026-09-04T23:00:00.000Z');
    expect(daysBeforeDeparture(requested, '2026-10-04')).toBe(30);
    expect(refundPercentForDays(daysBeforeDeparture(requested, '2026-10-04'))).toBe(100);
  });

  it('giờ trong ngày KHÔNG đổi kết quả — cùng ngày lịch là cùng số ngày', () => {
    for (const time of ['00:00:00', '12:00:00', '23:59:59']) {
      expect(daysBeforeDeparture(new Date(`2026-09-04T${time}.000Z`), '2026-10-04')).toBe(30);
    }
  });

  it('cùng ngày khởi hành = 0, sau khởi hành = âm', () => {
    expect(daysBeforeDeparture(new Date('2026-10-04T08:00:00.000Z'), '2026-10-04')).toBe(0);
    expect(daysBeforeDeparture(new Date('2026-10-06T08:00:00.000Z'), '2026-10-04')).toBe(-2);
  });

  it('vắt qua giao thừa và tháng nhuận vẫn đúng', () => {
    expect(daysBeforeDeparture(new Date('2025-12-20T10:00:00.000Z'), '2026-01-05')).toBe(16);
    expect(daysBeforeDeparture(new Date('2028-02-01T10:00:00.000Z'), '2028-03-01')).toBe(29);
  });
});

/**
 * Cửa sổ ân hạn (ADR-0030 §3c) — chữa lỗ "người đặt muộn không bao giờ với tới
 * bậc 100%". Đây là LỚP PHỦ chỉ có lợi, không phải vật thay thế bảng bậc.
 */
describe('refundPercentForRequest — ân hạn 24 giờ', () => {
  const paidAt = '2026-09-04T10:00:00.000Z';

  it('ca của user: đặt 4/9 cho chuyến 19/9, huỷ hôm sau → 100% chứ không phải 50%', () => {
    // Không có ân hạn thì 14 ngày trước khởi hành = bậc 25%; đặt sát ngày nên
    // bậc 100% vốn BẤT KHẢ dù khách đổi ý sau một phút.
    expect(
      refundPercentForRequest({
        requestedAt: new Date('2026-09-05T09:00:00.000Z'),
        paidAt,
        departureStartDate: '2026-09-19',
        freeCancellationDays: null,
      }),
    ).toBe(100);
  });

  it('quá 24 giờ thì bảng bậc áp lại bình thường', () => {
    expect(
      refundPercentForRequest({
        requestedAt: new Date('2026-09-05T10:00:01.000Z'),
        paidAt,
        departureStartDate: '2026-09-19',
        freeCancellationDays: null,
      }),
    ).toBe(25);
  });

  it('đúng mốc 24 giờ vẫn TÍNH VÀO — biên có lợi cho khách', () => {
    expect(
      refundPercentForRequest({
        requestedAt: new Date('2026-09-05T10:00:00.000Z'),
        paidAt,
        departureStartDate: '2026-09-19',
        freeCancellationDays: null,
      }),
    ).toBe(100);
  });

  it('KHÔNG chặn theo ngày khởi hành — đặt sát ngày vẫn có 24 giờ đổi ý', () => {
    // Chuyến còn 4 ngày: bảng bậc cho 0%, ân hạn vẫn cho 100% (ADR-0030 §3c).
    expect(
      refundPercentForRequest({
        requestedAt: new Date('2026-09-05T09:00:00.000Z'),
        paidAt,
        departureStartDate: '2026-09-08',
        freeCancellationDays: null,
      }),
    ).toBe(100);
  });

  it('booking chưa trả tiền thì KHÔNG có ân hạn — không có gì để hoàn', () => {
    expect(
      refundPercentForRequest({
        requestedAt: new Date('2026-09-05T09:00:00.000Z'),
        paidAt: null,
        departureStartDate: '2026-09-19',
        freeCancellationDays: null,
      }),
    ).toBe(25);
  });

  it('ân hạn CHỈ CÓ LỢI — không bao giờ hạ kết quả so với bảng bậc', () => {
    // Bất biến của cả luật: quét mọi khoảng cách tới khởi hành × cả hai phía
    // của cửa sổ ân hạn, kết quả phải luôn ≥ bậc thuần.
    const base = new Date('2026-09-04T10:00:00.000Z');
    for (let daysOut = 0; daysOut <= 60; daysOut += 1) {
      const departure = new Date(Date.UTC(2026, 8, 4 + daysOut)).toISOString().slice(0, 10);
      for (const hours of [0, 1, 23, 24, 25, 100]) {
        const requestedAt = new Date(base.getTime() + hours * 3_600_000);
        const withGrace = refundPercentForRequest({
          requestedAt,
          paidAt,
          departureStartDate: departure,
          freeCancellationDays: null,
        });
        const plain = refundPercentForBooking(daysBeforeDeparture(requestedAt, departure), null);
        expect(withGrace).toBeGreaterThanOrEqual(plain);
      }
    }
  });

  it('REFUND_GRACE_HOURS là 24 — khoá con số đã công bố với khách', () => {
    expect(REFUND_GRACE_HOURS).toBe(24);
  });
});

describe('số học tiền dùng chung (vòng vá review 05/09)', () => {
  it('percentOfAmount làm tròn cent HALF_UP — 50% của 1199.01 là 599.51 ở MỌI bên', () => {
    // Web từng tính bằng float rồi toFixed → 599.50, admin → 599.51: khách và
    // admin nhìn hai con số khác nhau một cent. Nay chỉ có một phép tính.
    expect(percentOfAmount('1199.01', 50)).toBe('599.51');
    expect(percentOfAmount('499.95', 50)).toBe('249.98');
    expect(percentOfAmount('1199.00', 50)).toBe('599.50');
    expect(percentOfAmount('100.01', 25)).toBe('25.00');
  });

  it('toCents/fromCents khứ hồi, HALF_UP ở chữ số thứ ba', () => {
    expect(toCents('12.345')).toBe(1235);
    expect(toCents('12.344')).toBe(1234);
    expect(fromCents(toCents('0.10'))).toBe('0.10');
  });

  it('policyRefundAmount: phần trăm trên TỔNG, trừ đã hoàn, kẹp trong phần dư', () => {
    expect(policyRefundAmount({ percent: 50, totalAmount: '1000.00', refundedTotal: '0.00' })).toBe(
      '500.00',
    );
    // Đã hoàn thiện chí 100 → 50% của 1000 trừ 100.
    expect(
      policyRefundAmount({ percent: 50, totalAmount: '1000.00', refundedTotal: '100.00' }),
    ).toBe('400.00');
    // Đã hoàn hơn cả bậc → 0, không âm.
    expect(
      policyRefundAmount({ percent: 25, totalAmount: '1000.00', refundedTotal: '300.00' }),
    ).toBe('0.00');
    // 100% trên booking đã hoàn một phần → đúng phần dư.
    expect(
      policyRefundAmount({ percent: 100, totalAmount: '1000.00', refundedTotal: '300.00' }),
    ).toBe('700.00');
  });

  it('daysBeforeDeparture NÉM với ngày hỏng thay vì âm thầm ra 0%', () => {
    expect(() => daysBeforeDeparture(new Date('2026-09-05T00:00:00Z'), 'bad')).toThrow(RangeError);
  });
});
