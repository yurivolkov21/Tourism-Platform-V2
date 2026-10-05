import { fireEvent, render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewsQuery } from '@/lib/reviews-query';
import type { ReviewRowVM } from '@/lib/reviews-view';
import { ReviewsTable } from './reviews-table';

/**
 * Bảng `/reviews` (spec P4b §3-F4). Spec này mới canh ô ảnh của cột Review — nơi admin gặp
 * ảnh khách đính kèm ĐẦU TIÊN: ảnh hỏng (nợ G22) phải thành ô có tên, không thành ô trống
 * câm (spec 2026-10-05 §4 #13). Nút duyệt và dialog chi tiết có spec riêng của chúng.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const t = messages.admin.reviews;

const row = (patch: Partial<ReviewRowVM> = {}): ReviewRowVM => ({
  id: '11111111-1111-4111-8111-111111111111',
  rating: 5,
  ratingLabel: t.list.ratingLabel(5),
  title: 'Trip of a lifetime',
  body: 'The guide knew every cove and the kayaking was the highlight.',
  photos: [
    {
      thumb: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_128,h_128,c_fill/a.jpg',
      large: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800,c_limit/a.jpg',
      alt: 'Sunrise over the bay',
    },
  ],
  photosLabel: t.list.photos(1),
  authorLabel: 'Ada Lovelace',
  authorDeleted: false,
  source: 'VERIFIED',
  sourceLabel: t.source.VERIFIED,
  state: 'pending',
  moderationNote: null,
  rejectionCount: 0,
  tourTitle: 'Ha Long Bay Cruise',
  approved: false,
  stateLabel: t.state.pending,
  submitted: '4 Sep 2026, 12:15 UTC',
  moderated: null,
  moderatedBy: null,
  ...patch,
});

const QUERY: ReviewsQuery = { page: 1, limit: 20 };

describe('ReviewsTable', () => {
  it('ảnh đính kèm hỏng (nợ G22): ô 32px thành ô có tên "Photo unavailable", không thành ô trống câm', () => {
    render(
      <ReviewsTable rows={[row()]} query={QUERY} total={1} totalPages={1} moderate={vi.fn()} />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Sunrise over the bay' }));
    expect(
      screen.getByRole('img', { name: messages.admin.table.photoUnavailable }),
    ).toBeInTheDocument();
  });
});
