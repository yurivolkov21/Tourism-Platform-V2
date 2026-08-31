import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  canRefund,
  classifyRefundError,
  ledgerNote,
  REFUND_FAILURE_CODES,
  refundErrorCopy,
  sumRefunds,
  validateRefundAmount,
} from './refund';

const t = messages.admin.bookings.refund;

describe('canRefund', () => {
  it('chỉ PAID và PARTIALLY_REFUNDED mới còn tiền để hoàn (gate của RefundsService)', () => {
    expect(canRefund('PAID')).toBe(true);
    expect(canRefund('PARTIALLY_REFUNDED')).toBe(true);
  });

  it('PENDING/CANCELLED/REFUNDED không hiện nút — chưa thu, hoặc đã settle', () => {
    expect(canRefund('PENDING')).toBe(false);
    expect(canRefund('CANCELLED')).toBe(false);
    expect(canRefund('REFUNDED')).toBe(false);
  });
});

describe('validateRefundAmount', () => {
  const base = { totalAmount: '120.00', currency: 'USD' } as const;

  it('mode full KHÔNG cần amount — server tự tính phần còn lại', () => {
    expect(validateRefundAmount({ ...base, mode: 'full', amount: '' })).toBeUndefined();
    expect(validateRefundAmount({ ...base, mode: 'full', amount: 'rác' })).toBeUndefined();
  });

  it('partial mà bỏ trống → đòi nhập, không bắn request rỗng', () => {
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '   ' })).toBe(
      t.validation.required,
    );
  });

  it('sai định dạng DecimalStringSchema → câu định dạng riêng', () => {
    for (const amount of ['abc', '12,50', '-5', '1.2.3', '$10']) {
      expect(validateRefundAmount({ ...base, mode: 'partial', amount })).toBe(t.validation.format);
    }
  });

  it('làm tròn HALF_UP 2dp về 0 → câu ZERO_OR_NEGATIVE của contract', () => {
    for (const amount of ['0', '0.00', '0.004']) {
      expect(validateRefundAmount({ ...base, mode: 'partial', amount })).toBe(t.validation.zero);
    }
  });

  it('0.005 làm tròn lên 0.01 nên hợp lệ — mirror ROUND_HALF_UP của server', () => {
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '0.005' })).toBeUndefined();
  });

  it('vượt total → câu có kèm số tiền trần', () => {
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '120.01' })).toBe(
      t.validation.overTotal('$120.00'),
    );
  });

  it('đúng bằng total hợp lệ ở client — remainder thật chỉ server biết', () => {
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '120.00' })).toBeUndefined();
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '119.99' })).toBeUndefined();
  });
});

describe('classifyRefundError', () => {
  it('giữ NGUYÊN 5 mã lỗi ledger của contract, không nuốt thành GENERIC', () => {
    for (const code of [
      'NOT_REFUNDABLE',
      'OVER_TOTAL',
      'ZERO_OR_NEGATIVE',
      'NOTHING_LEFT',
      'REFUND_FAILED',
      'NOT_FOUND',
    ] as const) {
      expect(classifyRefundError(new ORPCError(code))).toBe(code);
    }
  });

  it('401/403 là lỗi tầng phiên, không phải mã contract', () => {
    expect(classifyRefundError(new ORPCError('UNAUTHORIZED', { status: 401 }))).toBe(
      'UNAUTHORIZED',
    );
    expect(classifyRefundError(new ORPCError('FORBIDDEN', { status: 403 }))).toBe('FORBIDDEN');
  });

  it('mã lạ / lỗi mạng → GENERIC', () => {
    expect(classifyRefundError(new ORPCError('INTERNAL_SERVER_ERROR'))).toBe('GENERIC');
    expect(classifyRefundError(new TypeError('fetch failed'))).toBe('GENERIC');
    expect(classifyRefundError(null)).toBe('GENERIC');
  });
});

describe('refundErrorCopy', () => {
  it('mỗi mã một câu KHÁC nhau — bất biến spec §2.4', () => {
    const copies = REFUND_FAILURE_CODES.map(refundErrorCopy);
    expect(new Set(copies).size).toBe(REFUND_FAILURE_CODES.length);
    expect(copies.every((copy) => copy.length > 0)).toBe(true);
  });

  it('câu 502 nói rõ ledger chưa ghi gì (operator cần biết tiền chưa đi)', () => {
    expect(refundErrorCopy('REFUND_FAILED')).toBe(t.errors.REFUND_FAILED);
    expect(refundErrorCopy('REFUND_FAILED')).toMatch(/nothing was recorded/i);
  });
});

describe('sumRefunds', () => {
  it('sổ rỗng → 0.00', () => {
    expect(sumRefunds([])).toBe('0.00');
  });

  it('cộng theo cent, không qua float (0.10 + 0.20 = 0.30)', () => {
    expect(sumRefunds([{ amount: '0.10' }, { amount: '0.20' }])).toBe('0.30');
    expect(sumRefunds([{ amount: '10' }, { amount: '5.5' }])).toBe('15.50');
  });
});

describe('ledgerNote', () => {
  it('PENDING/PAID: trạng thái BẢO ĐẢM chưa có refund row nào', () => {
    expect(ledgerNote('PENDING')).toBe(t.ledger.none);
    expect(ledgerNote('PAID')).toBe(t.ledger.none);
  });

  it('PARTIALLY_REFUNDED/REFUNDED: chắc chắn có refund — nhưng byCode không trả số', () => {
    expect(ledgerNote('PARTIALLY_REFUNDED')).toBe(t.ledger.onRecord);
    expect(ledgerNote('REFUNDED')).toBe(t.ledger.onRecord);
  });

  it('CANCELLED: KHÔNG khẳng định có hay không (auto-refund overbook có thể đã chạy)', () => {
    expect(ledgerNote('CANCELLED')).toBe(t.ledger.unknown);
  });
});
