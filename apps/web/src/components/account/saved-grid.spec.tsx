import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WishlistItem } from '@tourism/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedGrid } from './saved-grid';

// Mock client oRPC — spec chỉ kiểm gọi ĐÚNG payload `wishlist.set`, không gọi
// API thật (cùng khuôn `newsletter-form.spec.tsx`/`booking-actions.spec.tsx`).
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { wishlist: { set } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

// Mock sonner — Task 7/A2: saved-grid CHỈ toast khi LỖI (rollback) — thành
// công đã tự hiện qua card biến mất, khác các form khác trong khu account.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

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
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a', wished: false });
  });

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

  it('bấm ✕ trên MỘT card → card đó biến mất NGAY (optimistic), card còn lại vẫn còn', async () => {
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

  it('bấm ✕ → gọi wishlist.set({tourId, wished:false}) đúng payload', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[makeItem()]} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(
        { tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a', wished: false },
        expect.anything(),
      ),
    );
  });

  it('wishlist.set lỗi → rollback (card quay lại) + toast lỗi', async () => {
    set.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[makeItem()]} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    // Rollback sau khi promise reject: card quay lại + toast lỗi. (Biến mất
    // NGAY lúc click đã được phủ ở test optimistic riêng phía trên — reject
    // ở đây có thể xử lý xong trước khi `user.click` trả điều khiển, nên
    // không assert lại state "giữa chừng" ở đây, tránh test ăn may theo
    // microtask timing.)
    expect(
      await screen.findByText('Ninh Bình: Tràng An, Múa Cave & Rice Fields'),
    ).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
