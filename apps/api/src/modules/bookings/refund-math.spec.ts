import { Prisma } from '../../generated/prisma/client.js';
import {
  classifyRefundAmount,
  deriveStatusAfterRefund,
  RefundNothingLeftError,
  RefundOverTotalError,
  RefundZeroOrNegativeError,
} from './refund-math.js';

const D = (value: string) => new Prisma.Decimal(value);

/**
 * TDD suite (spec P2 §4 invariant #5, viết TRƯỚC) cho refund ledger math thuần:
 * phân loại một admin request đối chiếu total với SUM(refunds), và suy ra
 * projection Booking.status từ ledger.
 */
describe('classifyRefundAmount', () => {
  const total = D('117.00');
  const none = D('0');

  describe('requested là BẮT BUỘC (ADR-0030 AMEND 2) — không còn "vắng = trọn phần dư"', () => {
    // Nhánh cũ `requested == null → full remainder` bị xoá cả ở math dùng chung
    // (vòng vá review W2): contract đã bắt buộc amount, còn giữ nhánh ở đây là
    // giữ nguyên hình cửa hậu cho một caller tương lai quên truyền.
    it('gõ đúng phần dư → kind full, settle', () => {
      const result = classifyRefundAmount({ requested: '117.00', total, alreadyRefunded: none });
      expect(result.kind).toBe('full');
      expect(result.amount.toFixed(2)).toBe('117.00');
    });

    it('sau một partial 30.00: gõ đúng 87.00 → settle (kind full)', () => {
      const result = classifyRefundAmount({
        requested: '87.00',
        total,
        alreadyRefunded: D('30.00'),
      });
      expect(result.kind).toBe('full');
      expect(result.amount.toFixed(2)).toBe('87.00');
    });

    it('biên 0.01: phần dư 0.01 gõ đúng 0.01 → kind full', () => {
      const result = classifyRefundAmount({
        requested: '0.01',
        total: D('100.00'),
        alreadyRefunded: D('99.99'),
      });
      expect(result.kind).toBe('full');
      expect(result.amount.toFixed(2)).toBe('0.01');
    });
  });

  describe('requested provided', () => {
    it('strictly below the remainder → partial', () => {
      const result = classifyRefundAmount({ requested: '30.00', total, alreadyRefunded: none });
      expect(result.kind).toBe('partial');
      expect(result.amount.toFixed(2)).toBe('30.00');
    });

    it('exact-equal to the total on a fresh booking → full', () => {
      const result = classifyRefundAmount({ requested: '117.00', total, alreadyRefunded: none });
      expect(result.kind).toBe('full');
      expect(result.amount.toFixed(2)).toBe('117.00');
    });

    it('exact-equal to the remainder after a partial → full (accumulation settles)', () => {
      const result = classifyRefundAmount({
        requested: '87.00',
        total,
        alreadyRefunded: D('30.00'),
      });
      expect(result.kind).toBe('full');
      expect(result.amount.toFixed(2)).toBe('87.00');
    });

    it('scale-insensitive equality: "117" settles a 117.00 total', () => {
      const result = classifyRefundAmount({ requested: '117', total, alreadyRefunded: none });
      expect(result.kind).toBe('full');
      expect(result.amount.toFixed(2)).toBe('117.00');
    });

    it('rounds HALF_UP to 2dp before classifying ("29.995" → 30.00)', () => {
      const result = classifyRefundAmount({ requested: '29.995', total, alreadyRefunded: none });
      expect(result.amount.toFixed(2)).toBe('30.00');
      expect(result.kind).toBe('partial');
    });

    it('accumulation across multiple partials: 30 + 50 + 37 settles 117.00', () => {
      let refunded = D('0');
      const steps: Array<{ requested: string; kind: string }> = [
        { requested: '30.00', kind: 'partial' },
        { requested: '50.00', kind: 'partial' },
        { requested: '37.00', kind: 'full' },
      ];
      for (const step of steps) {
        const result = classifyRefundAmount({
          requested: step.requested,
          total,
          alreadyRefunded: refunded,
        });
        expect(result.kind).toBe(step.kind);
        refunded = refunded.add(result.amount);
      }
      expect(refunded.equals(total)).toBe(true);
    });
  });

  describe('typed domain errors', () => {
    it('ZERO_OR_NEGATIVE: "0" and "0.00"', () => {
      for (const requested of ['0', '0.00']) {
        expect(() => classifyRefundAmount({ requested, total, alreadyRefunded: none })).toThrow(
          RefundZeroOrNegativeError,
        );
      }
    });

    it('ZERO_OR_NEGATIVE: negative input (service-level callers bypass the contract regex)', () => {
      expect(() =>
        classifyRefundAmount({ requested: '-5.00', total, alreadyRefunded: none }),
      ).toThrow(RefundZeroOrNegativeError);
    });

    it('ZERO_OR_NEGATIVE: sub-cent amount that rounds to 0.00 ("0.004")', () => {
      expect(() =>
        classifyRefundAmount({ requested: '0.004', total, alreadyRefunded: none }),
      ).toThrow(RefundZeroOrNegativeError);
    });

    it('OVER_TOTAL: requested alone exceeds the total', () => {
      expect(() =>
        classifyRefundAmount({ requested: '117.01', total, alreadyRefunded: none }),
      ).toThrow(RefundOverTotalError);
    });

    it('OVER_TOTAL: requested + alreadyRefunded exceeds the total by one cent', () => {
      expect(() =>
        classifyRefundAmount({ requested: '87.01', total, alreadyRefunded: D('30.00') }),
      ).toThrow(RefundOverTotalError);
    });

    it('NOTHING_LEFT: ledger already sums to the total', () => {
      expect(() =>
        classifyRefundAmount({ requested: '1.00', total, alreadyRefunded: D('117.00') }),
      ).toThrow(RefundNothingLeftError);
    });

    it('NOTHING_LEFT: defensive on an over-refunded ledger (should be impossible)', () => {
      expect(() =>
        classifyRefundAmount({ requested: '1.00', total, alreadyRefunded: D('117.01') }),
      ).toThrow(RefundNothingLeftError);
    });

    it('NOTHING_LEFT wins over amount validation (checked before the requested value)', () => {
      expect(() =>
        classifyRefundAmount({ requested: '0.00', total, alreadyRefunded: D('117.00') }),
      ).toThrow(RefundNothingLeftError);
    });
  });
});

describe('deriveStatusAfterRefund', () => {
  it('sum strictly below total → PARTIALLY_REFUNDED', () => {
    expect(deriveStatusAfterRefund(D('30.00'), D('117.00'))).toBe('PARTIALLY_REFUNDED');
  });

  it('one cent short → PARTIALLY_REFUNDED (0.01 remainder edge)', () => {
    expect(deriveStatusAfterRefund(D('116.99'), D('117.00'))).toBe('PARTIALLY_REFUNDED');
  });

  it('exact-equal → REFUNDED', () => {
    expect(deriveStatusAfterRefund(D('117.00'), D('117.00'))).toBe('REFUNDED');
  });

  it('scale-insensitive equality ("117" vs "117.00") → REFUNDED', () => {
    expect(deriveStatusAfterRefund(D('117'), D('117.00'))).toBe('REFUNDED');
  });

  it('accumulation: derives PARTIALLY until the running sum reaches the total', () => {
    const total = D('117.00');
    let sum = D('0');
    for (const step of ['30.00', '50.00']) {
      sum = sum.add(D(step));
      expect(deriveStatusAfterRefund(sum, total)).toBe('PARTIALLY_REFUNDED');
    }
    sum = sum.add(D('37.00'));
    expect(deriveStatusAfterRefund(sum, total)).toBe('REFUNDED');
  });

  it('defensive: sum above total still reports REFUNDED (classify prevents this upstream)', () => {
    expect(deriveStatusAfterRefund(D('117.01'), D('117.00'))).toBe('REFUNDED');
  });
});
