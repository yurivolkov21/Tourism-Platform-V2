import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TourDetailVM, TourReviewsPageVM, TourReviewVM } from '@/lib/api/tours';
import { ReviewsPanel } from './reviews-panel';

function rv(n: number, overrides: Partial<TourReviewVM> = {}): TourReviewVM {
  return {
    id: `rv-${n}`,
    rating: 5,
    title: `Review title ${n}`,
    body: `Review body number ${n}.`,
    authorName: `Guest ${n}`,
    authorDeleted: false,
    createdAt: `2026-08-0${n}T10:00:00.000Z`,
    media: [],
    ...overrides,
  } as TourReviewVM;
}

function pageWith(
  breakdown: Record<string, number>,
  items: TourReviewVM[] = [rv(1), rv(2), rv(3)],
): TourReviewsPageVM {
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  return {
    items,
    page: 1,
    limit: 10,
    total,
    totalPages: Math.max(1, Math.ceil(total / 10)),
    breakdown,
  } as unknown as TourReviewsPageVM;
}

const TOUR = {
  slug: 'ha-giang',
  title: 'Hà Giang Loop',
  ratingAvg: 4.4,
} as unknown as TourDetailVM;
const PAGE = pageWith({ '5': 18, '4': 3, '3': 2, '2': 0, '1': 0 });

describe('ReviewsPanel', () => {
  it('bề rộng cột = count/total, KHÔNG chuẩn hoá theo cột cao nhất', () => {
    // Chuẩn hoá theo cột cao nhất thì 5★ luôn đầy khung ở MỌI tour — cột dài ra
    // mà không nói thêm điều gì.
    render(<ReviewsPanel tour={TOUR} page={PAGE} />);
    expect(screen.getByTestId('rating-bar-5')).toHaveStyle({ width: `${(18 / 23) * 100}%` });
    expect(screen.getByTestId('rating-bar-3')).toHaveStyle({ width: `${(2 / 23) * 100}%` });
    expect(screen.getByTestId('rating-bar-1')).toHaveStyle({ width: '0%' });
  });

  it('KHÔNG có nút Write a review trên trang tour', () => {
    // POST /api/reviews đòi bookingCode mà trang tour không có mã nào — nút đó
    // là hứa thứ sản phẩm không giữ (ADR-0022).
    render(<ReviewsPanel tour={TOUR} page={PAGE} />);
    expect(screen.queryByRole('button', { name: /write a review/i })).toBeNull();
    expect(screen.getByRole('button', { name: /show all reviews/i })).toBeInTheDocument();
  });

  it('KHÔNG gắn huy hiệu "verified" lên review', () => {
    // `listByTour` trả cả review CURATED (không gắn booking) và
    // `PublicReviewSchema` không phơi `source` — không có gì để xác nhận.
    render(<ReviewsPanel tour={TOUR} page={PAGE} />);
    expect(screen.queryByText(/verified/i)).toBeNull();
  });

  it('review của tài khoản đã xoá hiện nhãn thay tên', () => {
    const page = pageWith({ '5': 1, '4': 0, '3': 0, '2': 0, '1': 0 }, [
      rv(1, { authorName: null, authorDeleted: true }),
    ]);
    render(<ReviewsPanel tour={TOUR} page={page} />);
    expect(screen.getByText('Deleted account')).toBeInTheDocument();
  });

  it('chưa có review nào thì hiện trạng thái rỗng, KHÔNG vẽ biểu đồ năm cột 0%', () => {
    const empty = pageWith({ '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }, []);
    render(
      <ReviewsPanel tour={{ ...TOUR, ratingAvg: null } as unknown as TourDetailVM} page={empty} />,
    );
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.queryByTestId('rating-bar-5')).toBeNull();
  });

  it('chỉ giữ hai review làm mồi trên tab, phần còn lại đi qua modal', () => {
    render(<ReviewsPanel tour={TOUR} page={PAGE} />);
    expect(screen.getByText('Review title 1')).toBeInTheDocument();
    expect(screen.getByText('Review title 2')).toBeInTheDocument();
    expect(screen.queryByText('Review title 3')).toBeNull();
  });
});
