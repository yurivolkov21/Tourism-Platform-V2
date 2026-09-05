import { type MyReview, REVIEW_REJECTION_LIMIT } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { reviewSlot } from './review';

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
});
