import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  canRefund,
  classifyRefundError,
  normalizeAmountInput,
  REFUND_CONTRACT_CODES,
  type RefundFailureCode,
  refundErrorCopy,
  remainingRefundable,
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

describe('normalizeAmountInput', () => {
  it('dấu phẩy thập phân kiểu bàn phím non-US → chấm ("120,50" → "120.50")', () => {
    expect(normalizeAmountInput('120,50')).toBe('120.50');
    expect(normalizeAmountInput('  7,5 ')).toBe('7.5');
  });

  it('KHÔNG đoán dấu nghìn: đã có chấm hoặc nhiều phẩy thì giữ nguyên cho validate từ chối', () => {
    expect(normalizeAmountInput('1,200.50')).toBe('1,200.50');
    expect(normalizeAmountInput('1,2,3')).toBe('1,2,3');
  });
});

describe('remainingRefundable', () => {
  it('total − đã hoàn, theo cent (không float)', () => {
    expect(remainingRefundable('120.00', '0.00')).toBe('120.00');
    expect(remainingRefundable('120.00', '100.00')).toBe('20.00');
    expect(remainingRefundable('0.30', '0.10')).toBe('0.20');
  });

  it('không bao giờ âm — dữ liệu lệch thì trần là 0, không phải số âm', () => {
    expect(remainingRefundable('50.00', '60.00')).toBe('0.00');
  });
});

describe('validateRefundAmount', () => {
  // Trần là phần CÒN HOÀN ĐƯỢC (vòng vá review 31/08) — booking 120 đã hoàn
  // 20, trần 100: nhập số biết trước sẽ ăn OVER_TOTAL phải bị chặn TẠI form.
  const base = { remaining: '100.00', currency: 'USD' } as const;

  it('mode full KHÔNG cần amount — server tự tính phần còn lại', () => {
    expect(validateRefundAmount({ ...base, mode: 'full', amount: '' })).toBeUndefined();
    expect(validateRefundAmount({ ...base, mode: 'full', amount: 'rác' })).toBeUndefined();
  });

  it('partial mà bỏ trống → đòi nhập, không bắn request rỗng', () => {
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '' })).toBe(
      t.validation.required,
    );
  });

  it('sai định dạng DecimalStringSchema → câu định dạng riêng', () => {
    for (const amount of ['abc', '1,200.50', '-5', '1.2.3', '$10']) {
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

  it('vượt phần còn hoàn được → câu kèm đúng số trần (không phải total)', () => {
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '100.01' })).toBe(
      t.validation.overRemaining('$100.00'),
    );
  });

  it('đúng bằng trần hoặc dưới trần → hợp lệ; server vẫn là phán quyết cuối', () => {
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '100.00' })).toBeUndefined();
    expect(validateRefundAmount({ ...base, mode: 'partial', amount: '99.99' })).toBeUndefined();
  });
});

describe('REFUND_CONTRACT_CODES', () => {
  it('derive từ keys khối i18n errors — một nguồn, đủ 6 mã contract', () => {
    // Khoá chống tái hiện bug review 31/08: ba danh sách chép tay từng lệch
    // nhau ("NĂM mã" vs sáu). Giờ tập mã LÀ tập câu — thêm/bớt một bên là
    // bên kia tự khớp, còn test này khoá đúng 6 mã của contract hiện tại.
    expect([...REFUND_CONTRACT_CODES].sort()).toEqual([
      'NOTHING_LEFT',
      'NOT_FOUND',
      'NOT_REFUNDABLE',
      'OVER_TOTAL',
      'REFUND_FAILED',
      'ZERO_OR_NEGATIVE',
    ]);
  });
});

describe('classifyRefundError', () => {
  it('giữ NGUYÊN 6 mã contract (defined error thật của oRPC), không nuốt thành GENERIC', () => {
    for (const code of REFUND_CONTRACT_CODES) {
      expect(classifyRefundError(new ORPCError(code, { defined: true }))).toBe(code);
    }
  });

  it('ORPCError trùng TÊN mã contract nhưng KHÔNG phải defined error → không được giả làm phán quyết contract', () => {
    // Khoá chống tái hiện: bản đầu so `code` trần bằng Set chép tay — một
    // lỗi tầng khác mang code 'NOT_FOUND' được phán như contract nói
    // "booking không tồn tại" trong khi thực tế không ai biết. Giờ phải có
    // con dấu `defined` của oRPC mới được tin.
    expect(classifyRefundError(new ORPCError('NOT_FOUND'))).toBe('GENERIC');
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
  it('mỗi mã một câu KHÁC nhau — bất biến spec §2.4, phủ cả mã transport', () => {
    const codes: RefundFailureCode[] = [
      ...REFUND_CONTRACT_CODES,
      'UNAUTHORIZED',
      'FORBIDDEN',
      'INVALID_INPUT',
      'GENERIC',
    ];
    const copies = codes.map(refundErrorCopy);
    expect(new Set(copies).size).toBe(codes.length);
    expect(copies.every((copy) => copy.length > 0)).toBe(true);
  });

  it('câu 502 nói rõ ledger chưa ghi gì (operator cần biết tiền chưa đi)', () => {
    expect(refundErrorCopy('REFUND_FAILED')).toBe(t.errors.REFUND_FAILED);
    expect(refundErrorCopy('REFUND_FAILED')).toMatch(/nothing was recorded/i);
  });

  it('INVALID_INPUT khẳng định request CHƯA từng rời lớp validate — khác hẳn GENERIC mập mờ', () => {
    expect(refundErrorCopy('INVALID_INPUT')).toMatch(/never reached/i);
    expect(refundErrorCopy('GENERIC')).toMatch(/may or may not/i);
  });
});
