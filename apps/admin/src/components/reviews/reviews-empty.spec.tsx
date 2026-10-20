import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewsQuery } from '@/lib/reviews-query';
import { ReviewsTable } from './reviews-table';

/**
 * Ô rỗng của `/reviews` khi đang lọc ngày (review L5, cùng khuôn A1-07 của `/bookings`). Khoảng
 * ngày CỘNG DỒN với tab trạng thái, nguồn, số sao và ô tìm kiếm: đứng ở tab Pending hay lọc 1 sao
 * thì bảng rỗng trong khi khoảng ấy vẫn có review ở trạng thái khác. Câu phải nói "không có review
 * KHỚP", không được nói khoảng ấy không ai gửi review — ở hàng đợi kiểm duyệt, câu sai đọc thành
 * "khoảng này sạch". Pin chữ thật, không gọi lại hàm i18n, để đổi câu về bản cũ là đỏ.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function renderEmpty(query: Partial<ReviewsQuery>) {
  render(
    <ReviewsTable
      rows={[]}
      query={{ page: 1, limit: 20, ...query }}
      total={0}
      totalPages={1}
      moderate={vi.fn()}
    />,
  );
}

describe('ReviewsTable — ô rỗng khi đang lọc ngày', () => {
  it('tab Pending trong khoảng đang lọc: câu nói "matching", không nói khoảng ấy trống', () => {
    renderEmpty({ state: 'pending', from: '2026-10-01', to: '2026-10-31' });

    expect(screen.getByText(/^No matching reviews were submitted between /)).toBeInTheDocument();
    expect(screen.queryByText(/^No reviews were submitted/)).not.toBeInTheDocument();
  });

  it('khoảng một đầu giữ dạng câu riêng của nó, cũng "matching"', () => {
    renderEmpty({ rating: 1, from: '2026-10-01' });
    expect(
      screen.getByText(/^No matching reviews were submitted on or after /),
    ).toBeInTheDocument();
  });

  it('chỉ có ngày cuối: "on or before", cũng "matching"', () => {
    renderEmpty({ search: 'kayak', to: '2026-10-31' });
    expect(
      screen.getByText(/^No matching reviews were submitted on or before /),
    ).toBeInTheDocument();
  });
});
