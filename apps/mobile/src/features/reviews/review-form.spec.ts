import { buildReviewInput, canSubmitReview } from './review-form';

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
