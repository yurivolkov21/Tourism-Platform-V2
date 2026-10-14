import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import {
  BLANK_REVIEW_DRAFT,
  buildReviewInput,
  canSubmitReview,
  type ReviewDraftSnapshot,
  reviewDraftChanged,
  reviewSubmitErrorMessage,
} from './review-form';

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

describe('reviewDraftChanged — rời R1, R5 lúc này có làm mất gì khách đã viết không', () => {
  /** Bài cũ bị bác mà R5 điền sẵn. */
  const rejected: ReviewDraftSnapshot = {
    rating: 3,
    title: 'Rainy but lovely',
    body: 'The guide kept us dry and cheerful all day.',
    photoKeys: ['reviews/a', 'reviews/b'],
  };

  it('R1 chưa điền gì thì rời không mất gì', () => {
    expect(reviewDraftChanged(BLANK_REVIEW_DRAFT, BLANK_REVIEW_DRAFT)).toBe(false);
  });

  it('R1 đã chọn sao, gõ tiêu đề, gõ bài hay thêm ảnh thì là có thứ để mất', () => {
    expect(reviewDraftChanged({ ...BLANK_REVIEW_DRAFT, rating: 4 }, BLANK_REVIEW_DRAFT)).toBe(true);
    expect(reviewDraftChanged({ ...BLANK_REVIEW_DRAFT, title: 'Wow' }, BLANK_REVIEW_DRAFT)).toBe(
      true,
    );
    expect(reviewDraftChanged({ ...BLANK_REVIEW_DRAFT, body: 'Great' }, BLANK_REVIEW_DRAFT)).toBe(
      true,
    );
    // Ảnh đang tải hay tải lỗi cũng là thứ khách đã chọn.
    expect(
      reviewDraftChanged({ ...BLANK_REVIEW_DRAFT, photoKeys: ['local-1'] }, BLANK_REVIEW_DRAFT),
    ).toBe(true);
  });

  it('chỉ gõ khoảng trắng thì không tính là đã viết', () => {
    expect(
      reviewDraftChanged({ ...BLANK_REVIEW_DRAFT, title: '  ', body: ' \n ' }, BLANK_REVIEW_DRAFT),
    ).toBe(false);
  });

  it('R5 mở ra rồi rời ngay thì không mất gì: bài cũ vẫn nguyên', () => {
    expect(reviewDraftChanged({ ...rejected }, rejected)).toBe(false);
    expect(reviewDraftChanged({ ...rejected, body: `${rejected.body}  ` }, rejected)).toBe(false);
  });

  it('R5 đổi sao, chữ hay ảnh thì là có thứ để mất', () => {
    expect(reviewDraftChanged({ ...rejected, rating: 4 }, rejected)).toBe(true);
    expect(reviewDraftChanged({ ...rejected, title: '' }, rejected)).toBe(true);
    expect(
      reviewDraftChanged({ ...rejected, body: 'Rewritten with kinder words.' }, rejected),
    ).toBe(true);
    expect(reviewDraftChanged({ ...rejected, photoKeys: ['reviews/a'] }, rejected)).toBe(true);
    expect(
      reviewDraftChanged(
        { ...rejected, photoKeys: ['reviews/a', 'reviews/b', 'local-1'] },
        rejected,
      ),
    ).toBe(true);
  });

  it('R5 sửa rồi gõ trả lại đúng như cũ thì không còn gì để mất', () => {
    const edited = { ...rejected, body: 'Something else entirely.' };
    expect(reviewDraftChanged(edited, rejected)).toBe(true);
    expect(reviewDraftChanged({ ...edited, body: rejected.body }, rejected)).toBe(false);
  });
});
