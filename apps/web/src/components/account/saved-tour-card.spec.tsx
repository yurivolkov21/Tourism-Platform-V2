import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WishlistItem } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import { makeWishlistItem } from '@/test/fixtures/wishlist';
import { SavedTourCard } from './saved-tour-card';

/** Thẻ một tour đã lưu (spec 09/10 §3, phương án A). */
const TODAY = '2026-10-09';
const TITLE = 'Ninh Bình: Tràng An, Múa Cave & Rice Fields';
const COVER: NonNullable<WishlistItem['cover']> = {
  publicId: 'tourism/catalog/tours/ninh-binh',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/catalog/tours/ninh-binh',
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 1600,
  height: 1200,
  alt: null,
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
};

function renderCard(overrides: Partial<WishlistItem> = {}) {
  const onRemove = vi.fn();
  const view = render(
    <SavedTourCard item={makeWishlistItem(overrides)} today={TODAY} onRemove={onRemove} />,
  );
  return { ...view, onRemove };
}

describe('SavedTourCard — tour còn bán', () => {
  it('cả thẻ là MỘT link tới trang tour, tên tour là chữ của link', () => {
    renderCard();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/tours/ninh-binh-trang-an-day');
    expect(links[0]).toHaveTextContent(TITLE);
  });

  it('dòng "Saved {ngày}" theo lịch Việt Nam, cùng năm thì không in năm', () => {
    renderCard({ addedAt: '2026-10-02T18:30:00.000Z' });
    expect(screen.getByText('Saved 3 Oct')).toBeInTheDocument();
  });

  it('lưu từ năm trước thì in cả năm', () => {
    renderCard({ addedAt: '2025-12-20T03:00:00.000Z' });
    expect(screen.getByText('Saved 20 Dec 2025')).toBeInTheDocument();
  });

  it('số ngày, điểm sao một số lẻ, số lượt có dấu phẩy ngăn nghìn, và giá', () => {
    renderCard({ ratingAvg: 4.8, ratingCount: 1320 });
    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('(1,320)')).toBeInTheDocument();
    expect(screen.getByText('$79')).toBeInTheDocument();
  });

  it('điểm tròn số vẫn in MỘT chữ số thập phân: 5 → "5.0" (ca 4.8 in ra giống `String`, không bắt được thiếu `.toFixed(1)`)', () => {
    renderCard({ ratingAvg: 5, ratingCount: 3 });
    expect(screen.getByText('5.0')).toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('chưa ai đánh giá: bỏ hẳn phần sao — không "Not yet reviewed", không "★ null"', () => {
    renderCard({ ratingAvg: null, ratingCount: 0 });
    expect(screen.getByText('1 day').closest('p')?.textContent).toBe('1 day');
    expect(screen.queryByText('Not yet reviewed')).not.toBeInTheDocument();
  });

  it('tim là nút hành động thuần (KHÔNG aria-pressed), tên đọc có tên tour, nằm NGOÀI link; bấm thì gọi onRemove', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderCard();
    const heart = screen.getByRole('button', { name: `Remove ${TITLE} from saved tours` });
    // Thẻ rời lưới ngay khi bấm nên không có trạng thái "chưa bấm": `aria-pressed="true"` cộng với
    // nhãn "Remove …" thì trình đọc màn hình đọc "Remove …, toggle button, pressed" — tự mâu thuẫn.
    expect(heart).not.toHaveAttribute('aria-pressed');
    expect(screen.getByRole('link')).not.toContainElement(heart);
    await user.click(heart);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('ảnh bìa 4:3 bo góc, `sizes` theo số cột của lưới', () => {
    const { container } = renderCard({ cover: COVER });
    const img = container.querySelector('img');
    expect(img).toHaveAttribute(
      'sizes',
      '(min-width: 1024px) 368px, (min-width: 640px) 50vw, 100vw',
    );
    expect(img?.parentElement).toHaveClass('aspect-4/3', 'rounded-xl');
  });

  it('chỉ dựng đúng dữ liệu có — không chip chuyên mục rỗng', () => {
    const { container } = renderCard();
    expect(container.querySelectorAll('[class*="chip"]')).toHaveLength(0);
  });
});

describe('SavedTourCard — tour không còn bán (`unavailable`)', () => {
  it('ảnh xám, nhãn "No longer available", tên muted, không giá, KHÔNG link', () => {
    const { container } = renderCard({ unavailable: true });
    expect(screen.getByText('No longer available')).toBeInTheDocument();
    expect(container.querySelector('.grayscale')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: TITLE })).toHaveClass(
      'text-muted-foreground',
    );
    expect(screen.queryByText('$79')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('tim vẫn bỏ lưu được; dòng "Saved {ngày}" vẫn còn', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderCard({ unavailable: true });
    await user.click(screen.getByRole('button', { name: `Remove ${TITLE} from saved tours` }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved 3 Oct')).toBeInTheDocument();
  });
});
