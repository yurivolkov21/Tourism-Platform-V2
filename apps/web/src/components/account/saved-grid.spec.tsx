import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WishlistItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { SavedGrid } from './saved-grid';

function makeItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a',
    slug: 'ninh-binh-trang-an-day',
    title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields',
    basePrice: '79.00',
    currency: 'USD',
    durationDays: 1,
    ratingAvg: 4.8,
    ratingCount: 132,
    addedAt: '2026-07-28T14:00:00.000Z',
    unavailable: false,
    ...overrides,
  };
}

describe('SavedGrid', () => {
  it('rỗng ngay từ đầu → empty-state với CTA /tours, không render grid', () => {
    render(<SavedGrid initialItems={[]} />);
    expect(screen.getByRole('link', { name: /browse tours/i })).toHaveAttribute('href', '/tours');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('render đủ N tour đã lưu (title + giá)', () => {
    render(
      <SavedGrid
        initialItems={[
          makeItem(),
          makeItem({
            tourId: 'ded599f0-df12-43a3-9b3d-bbe5d26764dc',
            slug: 'ha-giang-loop-4d',
            title: 'Hà Giang Loop by Easyrider 4D3N',
            basePrice: '189.00',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Ninh Bình: Tràng An, Múa Cave & Rice Fields')).toBeInTheDocument();
    expect(screen.getByText('Hà Giang Loop by Easyrider 4D3N')).toBeInTheDocument();
    expect(screen.getByText('$79')).toBeInTheDocument();
    expect(screen.getByText('$189')).toBeInTheDocument();
  });

  it('item unavailable → nhãn "No longer available", KHÔNG có link tới tour (tour đã unpublish)', () => {
    render(<SavedGrid initialItems={[makeItem({ unavailable: true })]} />);
    expect(screen.getByText('No longer available')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ninh bình/i })).not.toBeInTheDocument();
    // Vẫn còn nút bỏ lưu cho item unavailable.
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('bấm ✕ trên MỘT card → card đó biến mất, card còn lại vẫn còn (optimistic, state cục bộ)', async () => {
    const user = userEvent.setup();
    const keep = makeItem({
      tourId: 'ded599f0-df12-43a3-9b3d-bbe5d26764dc',
      slug: 'ha-giang-loop-4d',
      title: 'Hà Giang Loop by Easyrider 4D3N',
    });
    render(<SavedGrid initialItems={[makeItem(), keep]} />);

    await user.click(
      screen.getByRole('button', {
        name: /remove ninh bình: tràng an, múa cave & rice fields from saved tours/i,
      }),
    );

    expect(
      screen.queryByText('Ninh Bình: Tràng An, Múa Cave & Rice Fields'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Hà Giang Loop by Easyrider 4D3N')).toBeInTheDocument();
  });

  it('bỏ lưu đến hết → chuyển sang empty-state', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[makeItem()]} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(screen.getByRole('link', { name: /browse tours/i })).toHaveAttribute('href', '/tours');
  });
});
