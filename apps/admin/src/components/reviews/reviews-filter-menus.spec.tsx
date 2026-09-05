import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReviewsQuery, reviewsHref } from '@/lib/reviews-query';
import { ReviewsRatingMenu } from './reviews-rating-menu';
import { ReviewsSourceMenu } from './reviews-source-menu';

/**
 * Hai bộ lọc trả nợ 05/09 của `/reviews`, cùng kit `ToolbarFilterMenu` với
 * `/outbox`, `/payment-events`, `/subscribers` và `/reports`.
 *
 * Spec canh phần RIÊNG của vùng — kit đã có spec của nó. Ba thứ đáng canh, và
 * cả ba đều là chỗ một bộ lọc lắp muộn hay chết âm thầm:
 *
 * 1. Chọn một mục phải đẩy ĐÚNG href mà `reviewsHref` sinh ra — một bộ lọc
 *    dựng đúng nhưng nối sai URL là một nút không làm gì.
 * 2. Mục "tất cả" phải XOÁ được filter, không phải đặt nó thành chuỗi 'ALL'.
 * 3. Nút phải đọc ra thứ đang nằm trên URL, kể cả khi URL do người gõ tay.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const t = messages.admin.reviews.list;
const QUERY: ReviewsQuery = { page: 1, limit: 20 };

beforeEach(() => {
  push.mockReset();
});

async function openMenu(user: ReturnType<typeof userEvent.setup>, label: string, first: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(label) }));
  await screen.findByRole('menuitemradio', { name: first });
}

describe('ReviewsSourceMenu', () => {
  it('mở ra có "All sources" và đúng hai nguồn của contract', async () => {
    const user = userEvent.setup();
    render(<ReviewsSourceMenu query={QUERY} />);
    await openMenu(user, t.sourceLabel, t.sourceAll);

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
    expect(
      screen.getByRole('menuitemradio', { name: messages.admin.reviews.source.VERIFIED }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: messages.admin.reviews.source.CURATED }),
    ).toBeInTheDocument();
  });

  it('chọn một nguồn đẩy giá trị enum THÔ lên URL, không tiền tố nào', async () => {
    const user = userEvent.setup();
    render(<ReviewsSourceMenu query={QUERY} />);
    await openMenu(user, t.sourceLabel, t.sourceAll);

    await user.click(
      screen.getByRole('menuitemradio', { name: messages.admin.reviews.source.CURATED }),
    );

    const href = reviewsHref(QUERY, { source: 'CURATED' });
    expect(push).toHaveBeenCalledWith(href);
    expect(href).toContain('source=CURATED');
    expect(href).not.toContain('v%3A');
  });

  it('chọn "All sources" XOÁ filter khỏi URL thay vì đặt nó thành ALL', async () => {
    const user = userEvent.setup();
    const filtered: ReviewsQuery = { ...QUERY, source: 'VERIFIED' };
    render(<ReviewsSourceMenu query={filtered} />);
    await openMenu(user, t.sourceLabel, t.sourceAll);

    await user.click(screen.getByRole('menuitemradio', { name: t.sourceAll }));

    expect(push).toHaveBeenCalledWith('/reviews');
  });

  it('nút đọc ra nguồn đang lọc, không nói "All" trong khi bảng đang lọc thật', () => {
    render(<ReviewsSourceMenu query={{ ...QUERY, source: 'CURATED' }} />);

    expect(screen.getByRole('button', { name: new RegExp(t.sourceLabel) })).toHaveTextContent(
      messages.admin.reviews.source.CURATED,
    );
  });
});

describe('ReviewsRatingMenu', () => {
  it('năm mức sao, 5 sao đứng đầu', async () => {
    const user = userEvent.setup();
    render(<ReviewsRatingMenu query={QUERY} />);
    await openMenu(user, t.ratingFilterLabel, t.ratingAll);

    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(6);
    expect(items[1]).toHaveTextContent(t.ratingStars(5));
    expect(items[5]).toHaveTextContent(t.ratingStars(1));
  });

  it('"1 star" số ít, "2 stars" số nhiều', async () => {
    const user = userEvent.setup();
    render(<ReviewsRatingMenu query={QUERY} />);
    await openMenu(user, t.ratingFilterLabel, t.ratingAll);

    expect(screen.getByRole('menuitemradio', { name: '1 star' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: '2 stars' })).toBeInTheDocument();
  });

  it('chọn một mức sao đẩy đúng href — số qua URL vẫn về lại số', async () => {
    const user = userEvent.setup();
    render(<ReviewsRatingMenu query={QUERY} />);
    await openMenu(user, t.ratingFilterLabel, t.ratingAll);

    await user.click(screen.getByRole('menuitemradio', { name: t.ratingStars(4) }));

    expect(push).toHaveBeenCalledWith(reviewsHref(QUERY, { rating: 4 }));
    expect(push).toHaveBeenCalledWith('/reviews?rating=4');
  });

  it('sentinel ALL không phải số nên nó XOÁ filter, không thành rating=NaN', async () => {
    const user = userEvent.setup();
    const filtered: ReviewsQuery = { ...QUERY, rating: 5 };
    render(<ReviewsRatingMenu query={filtered} />);
    await openMenu(user, t.ratingFilterLabel, t.ratingAll);

    await user.click(screen.getByRole('menuitemradio', { name: t.ratingAll }));

    expect(push).toHaveBeenCalledWith('/reviews');
  });

  it('nút đọc ra mức sao đang lọc', () => {
    render(<ReviewsRatingMenu query={{ ...QUERY, rating: 3 }} />);

    expect(screen.getByRole('button', { name: new RegExp(t.ratingFilterLabel) })).toHaveTextContent(
      t.ratingStars(3),
    );
  });
});
