import { render, screen } from '@testing-library/react';
import { type MyReview, REVIEW_REJECTION_LIMIT } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { ReviewPanel } from './review-panel';

// Hai linh kiện client của khu review có spec riêng — ở đây chỉ soi chỗ nào hiện cái nào.
vi.mock('@/components/account/review-composer', () => ({
  ReviewComposer: ({ bookingCode, review }: { bookingCode: string; review?: MyReview }) => (
    <div data-testid="review-composer">
      {bookingCode}|{review ? review.id : 'new'}
    </div>
  ),
}));
vi.mock('@/components/account/retract-review-button', () => ({
  RetractReviewButton: ({ reviewId }: { reviewId: string }) => (
    <div data-testid="retract">{reviewId}</div>
  ),
}));

const REVIEW_ID = '11111111-1111-4111-8111-111111111111';

/** Một review của khách — cùng hình với fixture của `review.spec.ts`. */
function ownReview(over: Partial<MyReview> = {}): MyReview {
  return {
    id: REVIEW_ID,
    rating: 5,
    title: null,
    body: 'Chuyến đi rất đáng nhớ và hướng dẫn viên nhiệt tình',
    authorName: 'Erik Lund',
    authorDeleted: false,
    createdAt: '2026-02-12T00:00:00.000Z',
    media: [],
    isApproved: false,
    moderationState: 'pending',
    moderationNote: null,
    rejectionCount: 0,
    tourSlug: 'bana-hills-golden-bridge-day',
    tourTitle: 'Bà Nà Hills & Golden Bridge Day Trip',
    retractedAt: null,
    ...over,
  };
}

/** Chuyến đã xong từ 11/02 — `reviewSlot` mở form theo ngày UTC, nên ngày phải ở quá khứ thật. */
const DONE = makeBooking({
  code: 'BK-6EYNLUEK',
  status: 'PAID',
  departureStartDate: '2026-02-11',
  departureEndDate: '2026-02-11',
});

describe('ReviewPanel — khu review giữ nguyên linh kiện và luật, chỉ đổi chỗ', () => {
  it('chưa viết: tiêu đề, câu dẫn, form mới; section mang id "review"', () => {
    const { container } = render(<ReviewPanel booking={DONE} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Your review' })).toBeInTheDocument();
    expect(screen.getByText('Tell other travellers how it went.')).toBeInTheDocument();
    expect(screen.getByTestId('review-composer')).toHaveTextContent('BK-6EYNLUEK|new');
    expect(container.querySelector('section#review')).not.toBeNull();
  });

  it('đang chờ duyệt: câu trạng thái trước, form sửa sau', () => {
    const review = ownReview();
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('Your review is with our team')).toBeInTheDocument();
    expect(screen.getByTestId('review-composer')).toHaveTextContent(`BK-6EYNLUEK|${REVIEW_ID}`);
  });

  it('bị bác còn lượt: lý do nguyên văn và form', () => {
    const review = ownReview({
      moderationState: 'rejected',
      moderationNote: 'The photos show other guests.',
      rejectionCount: 1,
    });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('Your review wasn’t published')).toBeInTheDocument();
    expect(screen.getByText('Why')).toBeInTheDocument();
    expect(screen.getByText('The photos show other guests.')).toBeInTheDocument();
    expect(screen.getByTestId('review-composer')).toBeInTheDocument();
  });

  it('hết lượt: không form, mở lối liên hệ', () => {
    const review = ownReview({
      moderationState: 'rejected',
      rejectionCount: REVIEW_REJECTION_LIMIT,
    });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('We’ve looked at this review twice')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByTestId('review-composer')).toBeNull();
  });

  it('đã đăng: lời cảm ơn và nút rút, không form', () => {
    const review = ownReview({ isApproved: true, moderationState: 'approved' });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('You’ve already reviewed this trip')).toBeInTheDocument();
    expect(screen.getByTestId('retract')).toHaveTextContent(REVIEW_ID);
    expect(screen.queryByTestId('review-composer')).toBeNull();
  });

  it('đã rút: chỉ nói kết cục', () => {
    const review = ownReview({
      moderationState: 'retracted',
      retractedAt: '2026-02-20T00:00:00.000Z',
    });
    render(<ReviewPanel booking={{ ...DONE, review, reviewedAt: review.createdAt }} />);
    expect(screen.getByText('You retracted this review')).toBeInTheDocument();
    expect(screen.queryByTestId('retract')).toBeNull();
    expect(screen.queryByTestId('review-composer')).toBeNull();
  });

  it('slot ẩn (đơn hoàn một phần đã đi): lời cảm ơn và Browse tours, không khu review', () => {
    render(<ReviewPanel booking={{ ...DONE, status: 'PARTIALLY_REFUNDED' }} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Thanks for travelling with us.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
    expect(screen.queryByText('Your review')).toBeNull();
  });
});
