import { REFUND_POLICY_TIERS } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { type ApproveRefundContext, policyRefund } from './approve-refund';
import { percentOfAmount } from './refund';

/**
 * Bậc hoàn tiền là LUẬT TIỀN — ca nào cũng phải có test, và test phải chứng
 * minh đúng thứ đáng lo: admin nhìn thấy CÙNG con số mà khách đã nhìn thấy lúc
 * bấm xin huỷ, và không đường nào ở đây trả nhiều hơn phần còn nợ khách.
 */

/** Ngày lịch UTC cách `from` đúng `days` ngày. */
function isoDate(from: Date, days: number): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const REQUESTED_AT = '2026-09-04T08:00:00.000Z';

function contextFor(overrides: Partial<ApproveRefundContext> = {}): ApproveRefundContext {
  return {
    requestedAt: REQUESTED_AT,
    // Ngoài ân hạn 24h, để bậc theo ngày là thứ DUY NHẤT quyết con số.
    paidAt: '2026-08-01T08:00:00.000Z',
    departureStartDate: isoDate(new Date(REQUESTED_AT), 40),
    freeCancellationDays: null,
    totalAmount: '1000.00',
    refundedTotal: '0.00',
    ...overrides,
  };
}

describe('policyRefund — bậc theo ngày', () => {
  it.each([
    [40, 100, '1000.00'],
    [30, 100, '1000.00'],
    [29, 50, '500.00'],
    [15, 50, '500.00'],
    [14, 25, '250.00'],
    [7, 25, '250.00'],
    [6, 0, '0.00'],
    [0, 0, '0.00'],
  ])('còn %i ngày → %i%% → %s', (days, percent, amount) => {
    const result = policyRefund(
      contextFor({ departureStartDate: isoDate(new Date(REQUESTED_AT), days) }),
    );

    expect(result.percent).toBe(percent);
    expect(result.amount).toBe(amount);
    expect(result.days).toBe(days);
  });

  it('yêu cầu gửi SAU khi tour đã khởi hành → 0%, không âm', () => {
    // "No-shows, and cancellations made after the tour has started, are not
    // refundable" — số ngày âm phải rơi vào bậc cuối chứ không lật dấu.
    const result = policyRefund(
      contextFor({ departureStartDate: isoDate(new Date(REQUESTED_AT), -3) }),
    );

    expect(result.days).toBe(-3);
    expect(result.percent).toBe(0);
    expect(result.amount).toBe('0.00');
  });

  it('đếm ngày từ lúc KHÁCH GỬI, không phải lúc admin mở dialog', () => {
    // ADR-0030 §4: ta xử chậm thì lỗi ở ta. Cùng một ngày khởi hành, yêu cầu
    // gửi sớm 10 ngày phải giữ bậc cao hơn — nếu hàm lỡ đọc `Date.now()` thì
    // hai ca này sẽ ra bằng nhau và test đổ.
    const departure = '2026-10-04';
    const early = policyRefund(
      contextFor({ requestedAt: '2026-09-04T08:00:00.000Z', departureStartDate: departure }),
    );
    const late = policyRefund(
      contextFor({ requestedAt: '2026-09-14T08:00:00.000Z', departureStartDate: departure }),
    );

    expect(early.percent).toBe(100);
    expect(late.percent).toBe(50);
  });
});

describe('policyRefund — hai lớp phủ chỉ-có-lợi', () => {
  it('ân hạn 24h sau thanh toán → 100% dù khởi hành cận kề', () => {
    const result = policyRefund(
      contextFor({
        departureStartDate: isoDate(new Date(REQUESTED_AT), 3),
        paidAt: '2026-09-04T02:00:00.000Z',
      }),
    );

    expect(result.inGrace).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.amount).toBe('1000.00');
    // Căn cứ phải kể ĐÚNG nguồn: 100% này đến từ ân hạn, không phải badge.
    expect(result.badgeApplied).toBe(false);
  });

  it('badge của tour nâng ngưỡng 100% lên trên bậc site', () => {
    // Bậc site cho 20 ngày là 50%; tour hứa huỷ miễn phí tới ngày 15 thì 20
    // ngày phải là 100%.
    const result = policyRefund(
      contextFor({
        departureStartDate: isoDate(new Date(REQUESTED_AT), 20),
        freeCancellationDays: 15,
      }),
    );

    expect(result.percent).toBe(100);
    expect(result.badgeApplied).toBe(true);
  });

  it('badge KHÔNG bao giờ HẠ mức hoàn xuống', () => {
    // Bất biến của ADR-0030 §3, quét mọi tổ hợp badge × ngày: badge chỉ nâng.
    for (let badge = 0; badge <= 45; badge += 1) {
      for (let days = 0; days <= 45; days += 1) {
        const withBadge = policyRefund(
          contextFor({
            departureStartDate: isoDate(new Date(REQUESTED_AT), days),
            freeCancellationDays: badge,
          }),
        );
        const withoutBadge = policyRefund(
          contextFor({ departureStartDate: isoDate(new Date(REQUESTED_AT), days) }),
        );
        expect(withBadge.percent).toBeGreaterThanOrEqual(withoutBadge.percent);
      }
    }
  });

  it('badge không được kể công khi chính bậc site đã cho 100%', () => {
    const result = policyRefund(
      contextFor({
        departureStartDate: isoDate(new Date(REQUESTED_AT), 40),
        freeCancellationDays: 15,
      }),
    );

    expect(result.percent).toBe(100);
    expect(result.badgeApplied).toBe(false);
  });
});

describe('policyRefund — phần đã hoàn và trần phần dư', () => {
  it('phần trăm áp lên TỔNG rồi mới trừ phần đã hoàn', () => {
    // 50% của 1000 là 500; đã hoàn 120 nên còn hoàn 380. Nếu ai đó tính 50%
    // TRÊN PHẦN DƯ thì ra 440 và test này đổ — đó là cái bẫy nó canh.
    const result = policyRefund(
      contextFor({
        departureStartDate: isoDate(new Date(REQUESTED_AT), 20),
        refundedTotal: '120.00',
      }),
    );

    expect(result.amount).toBe('380.00');
    expect(result.remaining).toBe('880.00');
  });

  it('đã hoàn NHIỀU hơn mức chính sách → 0, không phải số âm', () => {
    // Hoàn thiện chí 700 rồi mới xin huỷ ở bậc 50% (=500). Không có gì để hoàn
    // thêm, và 0 là hợp lệ: approve vẫn chạy để huỷ booking + nhả ghế.
    const result = policyRefund(
      contextFor({
        departureStartDate: isoDate(new Date(REQUESTED_AT), 20),
        refundedTotal: '700.00',
      }),
    );

    expect(result.amount).toBe('0.00');
    expect(result.remaining).toBe('300.00');
  });

  it('KHÔNG BAO GIỜ vượt phần còn nợ khách, quét mọi bậc × mọi mức đã hoàn', () => {
    // Trần cuối cùng là trigger DB (`SUM(refunds) ≤ total`), nhưng UI không
    // được phép bày ra một con số biết trước sẽ bị server từ chối.
    for (const tier of REFUND_POLICY_TIERS) {
      for (const already of ['0.00', '1.00', '333.33', '999.99', '1000.00']) {
        const result = policyRefund(
          contextFor({
            departureStartDate: isoDate(new Date(REQUESTED_AT), tier.minDaysBefore),
            refundedTotal: already,
          }),
        );
        expect(Number(result.amount)).toBeLessThanOrEqual(Number(result.remaining));
        expect(Number(result.amount)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('làm tròn cent HALF_UP, cùng phép tính với web và API — 50% của 1199.01 là 599.51', () => {
    // Trước vòng vá review 05/09 web ra 599.50 (float + toFixed) còn admin ra
    // 599.51: khách chụp màn hình một con số, admin duyệt con số khác.
    const result = policyRefund(
      contextFor({
        departureStartDate: isoDate(new Date(REQUESTED_AT), 20),
        totalAmount: '1199.01',
      }),
    );

    expect(result.amount).toBe('599.51');
  });

  it('giữ đủ cent — 50% của 1199.00 là 599.50', () => {
    const result = policyRefund(
      contextFor({
        departureStartDate: isoDate(new Date(REQUESTED_AT), 20),
        totalAmount: '1199.00',
      }),
    );

    expect(result.amount).toBe('599.50');
  });
});

describe('percentOfAmount', () => {
  it('0% và 100% là hai đầu chính xác', () => {
    expect(percentOfAmount('1234.56', 0)).toBe('0.00');
    expect(percentOfAmount('1234.56', 100)).toBe('1234.56');
  });

  it('nửa cent tranh chấp thì làm tròn LÊN — phần thắng thuộc về khách', () => {
    // 25% của 100.02 là 25,005 → 25.01.
    expect(percentOfAmount('100.02', 25)).toBe('25.01');
    // 25% của 100.01 là 25,0025 → 25.00.
    expect(percentOfAmount('100.01', 25)).toBe('25.00');
  });
});
