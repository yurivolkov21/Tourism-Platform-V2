import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  isStaleStateCode,
  MODERATE_CONTRACT_CODES,
  type ModerateTarget,
  moderateConsequences,
  moderateErrorCopy,
} from './reviews-moderate';

/**
 * Bất biến spec §2.4: mã lỗi contract hiện NGUYÊN NGHĨA, mỗi mã một câu. Tập
 * mã derive từ keys khối i18n (nguồn DUY NHẤT phía admin — nếp F2/F3) và test
 * dưới đây khoá nó vào chính `contract.admin.reviews.moderate`.
 */
describe('MODERATE_CONTRACT_CODES', () => {
  it('khớp CHÍNH XÁC tập mã lỗi contract khai cho moderate', () => {
    const declared = Object.keys(
      (contract.admin.reviews.moderate as unknown as { '~orpc': { errorMap: object } })['~orpc']
        .errorMap,
    );
    expect([...MODERATE_CONTRACT_CODES].sort()).toEqual(declared.sort());
  });

  it('đúng MỘT mã: REVIEW_NOT_FOUND (moderate không đụng tiền nên không có mã ledger)', () => {
    expect([...MODERATE_CONTRACT_CODES]).toEqual(['REVIEW_NOT_FOUND']);
  });
});

describe('moderateErrorCopy', () => {
  it('mã contract có câu riêng của vùng', () => {
    expect(moderateErrorCopy('REVIEW_NOT_FOUND')).toBe(
      messages.admin.reviews.moderate.errors.REVIEW_NOT_FOUND,
    );
  });

  it('mã tầng vận chuyển mượn giọng chung của admin — không viết lại câu "hết phiên"', () => {
    expect(moderateErrorCopy('UNAUTHORIZED')).toBe(messages.admin.errors.write.UNAUTHORIZED);
    expect(moderateErrorCopy('GENERIC')).toBe(messages.admin.errors.write.GENERIC);
    expect(moderateErrorCopy('INVALID_INPUT')).toBe(messages.admin.errors.write.INVALID_INPUT);
  });
});

describe('isStaleStateCode', () => {
  it('REVIEW_NOT_FOUND là lỗi TRẠNG-THÁI-CŨ: review biến mất dưới chân dialog, bấm lại vô nghĩa', () => {
    expect(isStaleStateCode('REVIEW_NOT_FOUND')).toBe(true);
  });

  it('mã tầng vận chuyển KHÔNG thuộc nhóm này — chúng có lối xử riêng', () => {
    expect(isStaleStateCode('UNAUTHORIZED')).toBe(false);
    expect(isStaleStateCode('FORBIDDEN')).toBe(false);
    expect(isStaleStateCode('GENERIC')).toBe(false);
  });
});

/**
 * Hệ quả THẬT của `ReviewsService.moderate` (transaction 4-trong-1). Hai
 * trong bốn việc CÓ ĐIỀU KIỆN — rating chỉ recompute khi review gắn tour,
 * email chỉ enqueue ở lần false→true và chỉ khi sau review có tài khoản thật
 * — nên dialog phải nói đúng ca của hàng đang mở. Hứa email cho một review
 * CURATED là nói dối operator.
 */
const t = messages.admin.reviews.moderate;

const PENDING: ModerateTarget = {
  id: '11111111-1111-4111-8111-111111111111',
  ratingLabel: messages.admin.reviews.list.ratingLabel(5),
  title: 'Trip of a lifetime',
  body: 'The guide knew every cove.',
  photos: [],
  photosLabel: null,
  authorLabel: 'Ada Lovelace',
  authorDeleted: false,
  source: 'VERIFIED',
  tourTitle: 'Ha Long Bay Cruise',
  approved: false,
  state: 'pending',
};

describe('moderateConsequences — nhánh approve', () => {
  it('review VERIFIED, còn tài khoản, có tour → đăng + tính lại rating tour + email cho tác giả', () => {
    expect(moderateConsequences(PENDING, 'approve')).toEqual([
      t.approveDialog.consequences.publish,
      t.approveDialog.consequences.rating('Ha Long Bay Cruise'),
      t.approveDialog.consequences.email,
    ]);
  });

  it('review KHÔNG gắn tour → nói rõ KHÔNG rating nào đổi (gate ③ của service cần tourId)', () => {
    const consequences = moderateConsequences({ ...PENDING, tourTitle: null }, 'approve');
    expect(consequences).toContain(t.approveDialog.consequences.noRating);
    expect(consequences).not.toContain(t.approveDialog.consequences.rating('Ha Long Bay Cruise'));
  });

  it('review CURATED → KHÔNG hứa email: không có tài khoản khách nào sau lưng nó', () => {
    const consequences = moderateConsequences({ ...PENDING, source: 'CURATED' }, 'approve');
    expect(consequences).toContain(t.approveDialog.consequences.noEmailCurated);
    expect(consequences).not.toContain(t.approveDialog.consequences.email);
  });

  it('tác giả đã xoá tài khoản → KHÔNG hứa email: địa chỉ còn lại là tombstone, không tới ai', () => {
    const consequences = moderateConsequences({ ...PENDING, authorDeleted: true }, 'approve');
    expect(consequences).toContain(t.approveDialog.consequences.noEmailDeleted);
    expect(consequences).not.toContain(t.approveDialog.consequences.email);
  });
});

describe('moderateConsequences — nhánh unapprove', () => {
  const APPROVED: ModerateTarget = { ...PENDING, approved: true };

  it('gỡ khỏi trang tour + tính lại rating KHÔNG có review này + nói rõ khách không được báo', () => {
    expect(moderateConsequences(APPROVED, 'unpublish')).toEqual([
      t.unpublishDialog.consequences.hide,
      t.unpublishDialog.consequences.rating('Ha Long Bay Cruise'),
      t.unpublishDialog.consequences.noEmail,
    ]);
  });

  it('không gắn tour → câu hide/publish KHÔNG hứa "trang tour", không rating đổi, không email', () => {
    // Khoá vòng vá review F4: review mồ côi không hiện ở đâu trên site —
    // "Removes the review from the tour page" là nói dối operator.
    const consequences = moderateConsequences({ ...APPROVED, tourTitle: null }, 'unpublish');
    expect(consequences).toEqual([
      t.unpublishDialog.consequences.hideNoTour,
      t.unpublishDialog.consequences.noRating,
      t.unpublishDialog.consequences.noEmail,
    ]);
    expect(
      moderateConsequences({ ...APPROVED, tourTitle: null, approved: false }, 'approve')[0],
    ).toBe(t.approveDialog.consequences.publishNoTour);
  });

  it('bỏ duyệt KHÔNG bao giờ hứa email, kể cả với tác giả còn tài khoản', () => {
    // Service chỉ enqueue ở lần false→true — chiều ngược lại im lặng tuyệt đối.
    expect(moderateConsequences(APPROVED, 'unpublish')).not.toContain(
      t.approveDialog.consequences.email,
    );
  });
});
