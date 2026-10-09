import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWishlistItem } from '@/test/fixtures/wishlist';
import { SavedView } from './saved-view';

// Lưới bọc thẻ trong `RevealItem` (motion `whileInView`) — jsdom không có IntersectionObserver.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { wishlist: { set } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

/** Trang `/account/saved` (spec 09/10 §1, §3). */
const TODAY = '2026-10-09';
const FIRST = makeWishlistItem();
const SECOND = makeWishlistItem({
  tourId: 'ded599f0-df12-43a3-9b3d-bbe5d26764dc',
  slug: 'ha-giang-loop-4d',
  title: 'Hà Giang Loop by Easyrider 4D3N',
});
const THIRD = makeWishlistItem({
  tourId: '3c1e8a52-6f0b-4d7e-9a14-2b5f7c9d1e03',
  slug: 'hoi-an-lantern-walk',
  title: 'Hoi An Lantern Walk & Cooking Class',
});

describe('SavedView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: FIRST.tourId, wished: false });
  });

  it('hero giữ chữ cũ, in số tour, có nút tròn "Back to Passport" về /account; không còn link chữ "← Passport"', () => {
    render(<SavedView items={[FIRST, SECOND]} today={TODAY} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tucked inside' })).toBeInTheDocument();
    expect(screen.getByText('Tours you’ve bookmarked to plan later.')).toBeInTheDocument();
    expect(screen.getByText('2 tours')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Passport' })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.queryByText('← Passport')).not.toBeInTheDocument();
  });

  it('lưới nằm trong khung tối đa 1152px, lề 16px dưới lg', () => {
    const { container } = render(<SavedView items={[FIRST]} today={TODAY} />);
    const frame = container.querySelector('[data-slot="saved-grid"]')?.parentElement;
    expect(frame).toHaveClass('mx-auto', 'max-w-6xl');
    expect(frame?.parentElement).toHaveClass('px-4', 'lg:px-8');
  });

  it('bỏ lưu thành công: thẻ rời ngay, trang được làm mới, server trả danh sách mới thì hero đếm lại', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SavedView items={[FIRST, SECOND]} today={TODAY} />);

    await user.click(
      screen.getByRole('button', { name: `Remove ${FIRST.title} from saved tours` }),
    );
    expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    // `router.refresh()` dựng lại trang ở server: SavedView nhận danh sách đã bỏ FIRST.
    rerender(<SavedView items={[SECOND]} today={TODAY} />);
    expect(screen.getByText('1 tour')).toBeInTheDocument();
    expect(screen.getByText(SECOND.title)).toBeInTheDocument();
    expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument();
  });

  it('lưới GIỮ state qua lần làm mới: thẻ đang treo không sống lại khi server trả danh sách chưa kịp bỏ nó', async () => {
    // Ca hai thẻ ở trên không phân biệt được "lưới giữ state" với "lưới đồng bộ theo props" (cả hai
    // đều ra [SECOND]). Ba thẻ thì khác: SECOND treo nên server vẫn còn nó trong danh sách mới.
    let finishSecond: () => void = () => {};
    const secondPending = new Promise<{ tourId: string; wished: boolean }>((resolve) => {
      finishSecond = () => resolve({ tourId: SECOND.tourId, wished: false });
    });
    set.mockImplementation(({ tourId }: { tourId: string }) =>
      tourId === SECOND.tourId ? secondPending : Promise.resolve({ tourId, wished: false }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<SavedView items={[FIRST, SECOND, THIRD]} today={TODAY} />);

    await user.click(
      screen.getByRole('button', { name: `Remove ${FIRST.title} from saved tours` }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await user.click(
      screen.getByRole('button', { name: `Remove ${SECOND.title} from saved tours` }),
    );
    expect(screen.queryByText(SECOND.title)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);

    // Lượt làm mới đầu về: server đã bỏ FIRST nhưng SECOND còn (yêu cầu của nó chưa trả).
    rerender(<SavedView items={[SECOND, THIRD]} today={TODAY} />);
    expect(screen.queryByText(SECOND.title)).not.toBeInTheDocument();
    expect(screen.getByText(THIRD.title)).toBeInTheDocument();
    expect(screen.queryByText(FIRST.title)).not.toBeInTheDocument();
    // Hero đếm theo server nên tạm còn 2; số đúng sau lượt làm mới cuối.
    expect(screen.getByText('2 tours')).toBeInTheDocument();

    finishSecond();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    rerender(<SavedView items={[THIRD]} today={TODAY} />);
    expect(screen.getByText('1 tour')).toBeInTheDocument();
    expect(screen.getByText(THIRD.title)).toBeInTheDocument();
  });
});
