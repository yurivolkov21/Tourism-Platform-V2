import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourReviewsPageVM, TourReviewVM } from '@/lib/api/tours';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/tours', () => ({ fetchTourReviewsFromBrowser: fetchMock }));

import { ReviewsDialog } from './reviews-dialog';

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

function page(items: TourReviewVM[], total = items.length): TourReviewsPageVM {
  return {
    items,
    page: 1,
    limit: 6,
    total,
    totalPages: Math.max(1, Math.ceil(total / 6)),
    breakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': total },
  } as unknown as TourReviewsPageVM;
}

function open() {
  return render(
    <ReviewsDialog open onOpenChange={vi.fn()} tourSlug="ha-giang" tourTitle="Hà Giang Loop" />,
  );
}

/** Query cuối cùng đã gửi lên API — mọi assert về lọc/sắp xếp đọc từ đây. */
function lastQuery() {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[1];
}

describe('ReviewsDialog', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(page([rv(1), rv(2)]));
  });

  it('bấm sao thứ 3 lọc đúng 3 sao, bấm lại chính nó thì bỏ lọc', async () => {
    open();
    await screen.findByText('Review title 1');

    await userEvent.click(screen.getByRole('button', { name: '3 / 5' }));
    expect(screen.getByText('3 stars only')).toBeInTheDocument();
    await waitFor(() => expect(lastQuery()).toMatchObject({ rating: 3 }));

    await userEvent.click(screen.getByRole('button', { name: '3 / 5' }));
    expect(screen.getByText('Any rating')).toBeInTheDocument();
    await waitFor(() => expect(lastQuery()?.rating).toBeUndefined());
  });

  it('sắp xếp gửi thẳng lên API, KHÔNG sắp lại ở client', async () => {
    // Sắp ở client chỉ sắp được đúng trang đang xem — trang 2 sẽ mâu thuẫn với
    // trang 1. Thứ tự là việc của server (`orderBy` có cả authorDeleted).
    open();
    await screen.findByText('Review title 1');

    await userEvent.click(screen.getByRole('button', { name: /sort reviews by/i }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Highest rated' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'highest' }));
  });

  it('"With photos" bật thì gửi withPhotos, tắt thì bỏ hẳn field', async () => {
    open();
    await screen.findByText('Review title 1');

    await userEvent.click(screen.getByRole('button', { name: /with photos/i }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ withPhotos: true }));

    await userEvent.click(screen.getByRole('button', { name: /with photos/i }));
    await waitFor(() => expect(lastQuery()?.withPhotos).toBeUndefined());
  });

  it('đổi bộ lọc thì về trang 1 — trang 4 của bộ lọc cũ có thể không tồn tại', async () => {
    fetchMock.mockResolvedValue(page([rv(1), rv(2)], 24));
    open();
    await screen.findByText('Review title 1');

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));

    await userEvent.click(screen.getByRole('button', { name: '4 / 5' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, rating: 4 }));
  });

  it('không có kết quả thì nói rõ là do bộ lọc, không để khung trống', async () => {
    fetchMock.mockResolvedValue(page([], 0));
    open();
    expect(await screen.findByText('No reviews match these filters.')).toBeInTheDocument();
  });

  it('tài khoản đã xoá hiện nhãn thay tên', async () => {
    fetchMock.mockResolvedValue(page([rv(1, { authorName: null, authorDeleted: true })]));
    open();
    expect(await screen.findByText('Deleted account')).toBeInTheDocument();
  });
});
