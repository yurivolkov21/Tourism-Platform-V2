import { type MyReview, REVIEW_REJECTION_LIMIT } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { hasReviewArea, reviewSlot } from './review';

const TODAY = '2026-08-04';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});
afterEach(() => {
  vi.useRealTimers();
});

const done = { status: 'PAID' as const, departureEndDate: '2026-08-01' };

describe('reviewSlot — trang chi tiết booking hiện gì ở chỗ đánh giá', () => {
  /** Một review của khách ở trạng thái bất kỳ. */
  function ownReview(over: Partial<MyReview> = {}): MyReview {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      rating: 5,
      title: null,
      body: 'Chuyến đi rất đáng nhớ và hướng dẫn viên nhiệt tình',
      authorName: 'Ada Lovelace',
      authorDeleted: false,
      createdAt: '2026-08-02T00:00:00.000Z',
      media: [],
      isApproved: false,
      moderationState: 'pending',
      moderationNote: null,
      rejectionCount: 0,
      tourSlug: 'ha-long-bay-cruise',
      tourTitle: 'Ha Long Bay Cruise',
      retractedAt: null,
      ...over,
    };
  }

  it('đã duyệt → "approved", KHÔNG hiện form nữa', () => {
    // Trước cụm B, cách duy nhất để biết là POST rồi ăn 409 — tức khách gõ
    // xong cả bài mới được báo là không viết được.
    const review = ownReview({ isApproved: true, moderationState: 'approved' });
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: review.createdAt, review }))).toBe(
      'approved',
    );
  });

  it('W4 U2: đã RÚT → "retracted", thắng mọi nhánh khác (kể cả hết-lượt-sửa)', () => {
    // rejectionCount chạm trần cố ý: câu cho khách phải là "bạn đã rút",
    // không phải "chúng tôi đã xem hai lần" — thứ tự nhánh là load-bearing.
    const review = ownReview({
      moderationState: 'retracted',
      retractedAt: '2026-08-03T00:00:00.000Z',
      rejectionCount: REVIEW_REJECTION_LIMIT,
    });
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: review.createdAt, review }))).toBe(
      'retracted',
    );
  });

  it('đang chờ duyệt → "pending", VẪN sửa được', () => {
    const review = ownReview();
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: review.createdAt, review }))).toBe(
      'pending',
    );
  });

  it('bị bác một lần → "rejected" (còn đường viết lại)', () => {
    const review = ownReview({ moderationState: 'rejected', rejectionCount: 1 });
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: review.createdAt, review }))).toBe(
      'rejected',
    );
  });

  it('bị bác đủ số lần → "rejectedFinal", KHÔNG hiện form nữa', () => {
    // Ranh giới của ADR-0032 §5, và nó phải khớp với cổng phía API — cả hai
    // gọi cùng `canAuthorEdit`.
    const review = ownReview({
      moderationState: 'rejected',
      rejectionCount: REVIEW_REJECTION_LIMIT,
    });
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: review.createdAt, review }))).toBe(
      'rejectedFinal',
    );
  });

  it('bác đủ lần rồi admin Reopen → vẫn "rejectedFinal", không phải "pending"', () => {
    // Trạng thái về `pending` nhưng lịch sử vẫn là hai lần bác. Đọc trạng thái
    // mà quên lịch sử là mở lại một cánh cửa đã chốt.
    const review = ownReview({
      moderationState: 'pending',
      rejectionCount: REVIEW_REJECTION_LIMIT,
    });
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: review.createdAt, review }))).toBe(
      'rejectedFinal',
    );
  });

  it('đủ điều kiện → "form"', () => {
    expect(reviewSlot(makeBooking({ ...done, reviewedAt: null }))).toBe('form');
  });

  it('chuyến kết thúc ĐÚNG HÔM NAY vẫn viết được — biên đóng', () => {
    // Mirror `checkReviewEligibility` phía API: `end > now` mới bị chặn.
    expect(reviewSlot(makeBooking({ status: 'PAID', departureEndDate: TODAY }))).toBe('form');
  });

  it('"hôm nay" ở đây là ngày UTC, CỐ Ý — chép đúng cổng review của API', () => {
    // `checkReviewEligibility` giữ ngày UTC (ADR-0009 AMEND 3). Chuyến về 05/08:
    // lúc 00:00 giờ VN ngày 05/08 (17:00Z ngày 04/08) API vẫn trả
    // TRIP_NOT_COMPLETED, tới 07:00 giờ VN (00:00Z) mới nhận. Web mà đổi sang
    // ngày VN thì mở form sớm bảy tiếng — khách gõ xong bài mới bị từ chối.
    const endsOn5th = makeBooking({ status: 'PAID', departureEndDate: '2026-08-05' });
    vi.setSystemTime(new Date('2026-08-04T17:00:00.000Z'));
    expect(reviewSlot(endsOn5th)).toBe('tooEarly');
    vi.setSystemTime(new Date('2026-08-04T23:59:59.999Z'));
    expect(reviewSlot(endsOn5th)).toBe('tooEarly');
    vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z'));
    expect(reviewSlot(endsOn5th)).toBe('form');
  });

  it('nhận `now` của nơi gọi — voucher truyền đồng hồ nó đã đọc một lần, không đọc lại máy', () => {
    const endsOn5th = makeBooking({ status: 'PAID', departureEndDate: '2026-08-05' });
    // Đồng hồ máy (giả) đang là 04/08: còn đọc nó thì ca này ra "tooEarly".
    expect(reviewSlot(endsOn5th, new Date('2026-08-05T00:00:00.000Z'))).toBe('form');
    // Và ngược lại: máy đã sang 06/08 mà `now` của nơi gọi còn là 04/08.
    vi.setSystemTime(new Date('2026-08-06T00:00:00.000Z'));
    expect(reviewSlot(endsOn5th, new Date('2026-08-04T23:59:59.999Z'))).toBe('tooEarly');
  });

  it('chuyến CHƯA kết thúc → "tooEarly", không phải ẩn hẳn', () => {
    // Ẩn hẳn thì khách tưởng site không có tính năng đánh giá.
    expect(reviewSlot(makeBooking({ status: 'PAID', departureEndDate: '2026-12-01' }))).toBe(
      'tooEarly',
    );
  });

  it('chưa trả tiền → "hidden": chưa đi thì chưa có gì để kể', () => {
    expect(reviewSlot(makeBooking({ status: 'PENDING', departureEndDate: '2026-08-01' }))).toBe(
      'hidden',
    );
  });

  it('đã huỷ hoặc đã hoàn tiền → "hidden"', () => {
    for (const status of ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const) {
      expect(reviewSlot(makeBooking({ status, departureEndDate: '2026-08-01' }))).toBe('hidden');
    }
  });

  it('CHƯA trả tiền thắng CHƯA kết thúc — cùng thứ tự ưu tiên với API', () => {
    // API kiểm PAID trước ngày kết thúc; web phải nói cùng một câu, không thì
    // khách thấy "chưa tới lúc" rồi trả tiền xong lại thấy nút biến mất.
    expect(reviewSlot(makeBooking({ status: 'PENDING', departureEndDate: '2026-12-01' }))).toBe(
      'hidden',
    );
  });

  /**
   * Chuyến bị CÔNG TY huỷ không chạy (ADR-0041 AMEND 1): không mời viết review, kể cả khi đơn còn
   * PAID vì job hoàn tiền chưa chạy (hay đang retry) mà ngày về đã qua — form từng đứng dưới khối
   * "Departure cancelled" và gửi được thật (review cuối M1).
   */
  it('chuyến bị công ty huỷ, chưa có review: "hidden" dù đơn còn PAID và ngày về đã qua', () => {
    expect(reviewSlot(makeBooking({ ...done, departureCancelled: true }))).toBe('hidden');
  });

  it('chuyến bị công ty huỷ, ngày về chưa tới: "hidden", không "tooEarly"', () => {
    const booking = makeBooking({
      status: 'PAID',
      departureEndDate: '2026-12-01',
      departureCancelled: true,
    });
    expect(reviewSlot(booking)).toBe('hidden');
  });

  it('chuyến bị công ty huỷ mà đơn đã có review: vẫn theo phán quyết của review (còn sửa, rút)', () => {
    const review = ownReview();
    const booking = makeBooking({
      ...done,
      departureCancelled: true,
      reviewedAt: review.createdAt,
      review,
    });
    expect(reviewSlot(booking)).toBe('pending');
  });
});

/**
 * Trang chi tiết đơn dựng khu review theo cổng `reviewSlot`, không theo giai đoạn (ADR-0054
 * AMEND 1 §5): mọi slot có gì để vẽ đều có khu review, ở bất kỳ giai đoạn nào.
 */
describe('hasReviewArea — trang chi tiết đơn có khu review không', () => {
  it.each([
    ['form', true],
    ['pending', true],
    ['rejected', true],
    ['rejectedFinal', true],
    ['approved', true],
    ['retracted', true],
    // Đã trả, chuyến chưa về: chân khối Get ready nói ngày mở, không dựng khu review.
    ['tooEarly', false],
    ['hidden', false],
  ] as const)('%s → %s', (slot, shown) => {
    expect(hasReviewArea(slot)).toBe(shown);
  });
});
