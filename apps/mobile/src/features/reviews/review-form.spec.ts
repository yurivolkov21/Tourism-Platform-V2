import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { buildReviewInput, canSubmitReview, reviewSubmitErrorMessage } from './review-form';

describe('canSubmitReview', () => {
  it('chặn khi chưa có sao', () => {
    expect(canSubmitReview({ rating: null, title: '', body: 'Một bài đánh giá đủ dài' })).toBe(
      false,
    );
  });

  it('chặn khi body dưới 10 ký tự sau khi cắt khoảng trắng', () => {
    expect(canSubmitReview({ rating: 4, title: '', body: '   ngắn   ' })).toBe(false);
  });

  it('cho gửi khi có sao và body đủ 10 ký tự', () => {
    expect(canSubmitReview({ rating: 5, title: '', body: '0123456789' })).toBe(true);
  });
});

describe('buildReviewInput', () => {
  it('cắt khoảng trắng và bỏ title rỗng', () => {
    expect(
      buildReviewInput('BK-ABC123XY', { rating: 4, title: '   ', body: '  Chuyến đi đẹp lắm  ' }),
    ).toEqual({ bookingCode: 'BK-ABC123XY', rating: 4, body: 'Chuyến đi đẹp lắm' });
  });

  it('giữ title đã cắt khi có nội dung', () => {
    expect(
      buildReviewInput('BK-ABC123XY', {
        rating: 5,
        title: ' Ba thành phố ',
        body: 'Chuyến đi đẹp lắm',
      }),
    ).toEqual({
      bookingCode: 'BK-ABC123XY',
      rating: 5,
      title: 'Ba thành phố',
      body: 'Chuyến đi đẹp lắm',
    });
  });
});

describe('reviewSubmitErrorMessage', () => {
  it('429 → câu chờ một lúc', () => {
    expect(reviewSubmitErrorMessage(new ORPCError('TOO_MANY_REQUESTS', { status: 429 }))).toBe(
      messages.accountActionErrors.throttle,
    );
  });

  it('mã có trong bảng → câu riêng của mã đó', () => {
    expect(reviewSubmitErrorMessage(new ORPCError('REVIEW_NOT_EDITABLE', { status: 409 }))).toBe(
      messages.reviews.errors.REVIEW_NOT_EDITABLE,
    );
    expect(reviewSubmitErrorMessage(new ORPCError('REVIEW_PHOTO_INVALID', { status: 422 }))).toBe(
      messages.reviews.errors.REVIEW_PHOTO_INVALID,
    );
  });

  it('mã lạ hoặc lỗi không phải ORPCError → câu chung', () => {
    expect(reviewSubmitErrorMessage(new ORPCError('SOMETHING_ELSE', { status: 500 }))).toBe(
      messages.accountActionErrors.generic,
    );
    expect(reviewSubmitErrorMessage(new Error('network'))).toBe(
      messages.accountActionErrors.generic,
    );
  });
});
