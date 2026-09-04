import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { DECIDE_CONTRACT_CODES, decideErrorCopy, isStaleStateCode } from './cancellations-decide';

/**
 * Bất biến spec §2.4: mã lỗi contract hiện NGUYÊN NGHĨA, mỗi mã một câu. Tập
 * mã derive từ keys khối i18n (nguồn DUY NHẤT phía admin — nếp
 * `REFUND_CONTRACT_CODES` của F2), và test dưới đây khoá nó vào chính
 * `contract.admin.cancellations.decide`: thêm mã ở contract mà quên câu i18n
 * là đỏ ngay, không phải đợi admin gặp "Something went wrong" ngoài production.
 */
describe('DECIDE_CONTRACT_CODES', () => {
  it('khớp CHÍNH XÁC tập mã lỗi contract khai cho decide', () => {
    const declared = Object.keys(
      (contract.admin.cancellations.decide as unknown as { '~orpc': { errorMap: object } })['~orpc']
        .errorMap,
    );
    expect([...DECIDE_CONTRACT_CODES].sort()).toEqual(declared.sort());
  });

  it('sáu mã — hai mã tiền thêm ở ADR-0029 §1 khi decide bắt đầu nhận số tiền', () => {
    expect([...DECIDE_CONTRACT_CODES].sort()).toEqual([
      'ALREADY_DECIDED',
      'NOT_FOUND',
      'NOT_REFUNDABLE',
      'OVER_TOTAL',
      'REFUND_FAILED',
      'ZERO_OR_NEGATIVE',
    ]);
  });

  it('hai mã tiền KHÔNG thuộc nhóm trạng-thái-cũ — sửa tại chỗ được', () => {
    // Chúng nói về CON SỐ vừa gửi, không về thế giới đã đổi dưới chân dialog:
    // request còn nguyên REQUESTED, admin nhập lại là xong. Xếp nhầm vào nhóm
    // stale thì dialog đóng và bắt admin mở lại từ đầu.
    expect(isStaleStateCode('OVER_TOTAL')).toBe(false);
    expect(isStaleStateCode('ZERO_OR_NEGATIVE')).toBe(false);
    expect(isStaleStateCode('REFUND_FAILED')).toBe(false);
    expect(isStaleStateCode('NOT_REFUNDABLE')).toBe(true);
  });
});

describe('decideErrorCopy', () => {
  it('mỗi mã contract có câu RIÊNG, không gộp, không trùng nhau', () => {
    const copies = [...DECIDE_CONTRACT_CODES].map((code) => decideErrorCopy(code));
    expect(new Set(copies).size).toBe(copies.length);
    for (const copy of copies) expect(copy.length).toBeGreaterThan(0);
  });

  it('mã tầng vận chuyển mượn giọng chung của admin — không viết lại câu "hết phiên"', () => {
    expect(decideErrorCopy('UNAUTHORIZED')).toBe(messages.admin.errors.write.UNAUTHORIZED);
    expect(decideErrorCopy('GENERIC')).toBe(messages.admin.errors.write.GENERIC);
    expect(decideErrorCopy('INVALID_INPUT')).toBe(messages.admin.errors.write.INVALID_INPUT);
  });
});
