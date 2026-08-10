import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WishlistHeart } from './wishlist-heart';
import { WishlistProvider } from './wishlist-store';

const push = vi.fn();
const useSession = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/tours',
  useSearchParams: () => new URLSearchParams('destinations=hue'),
}));

vi.mock('@/lib/auth-client', () => ({
  useSession: () => useSession(),
}));

const check = vi.fn();
const set = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: {
    wishlist: {
      check: (...args: unknown[]) => check(...args),
      set: (...args: unknown[]) => set(...args),
    },
  },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

const success = vi.fn();
const error = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => success(...a), error: (...a: unknown[]) => error(...a) },
}));

const A = 'd0000002-0000-4000-8000-00000000000a';
const B = 'd0000002-0000-4000-8000-00000000000b';

function renderHearts(ids: string[] = [A, B]) {
  return render(
    <WishlistProvider tourIds={ids}>
      {ids.map((id) => (
        <WishlistHeart key={id} tourId={id} tourTitle={`Tour ${id.slice(-1)}`} />
      ))}
    </WishlistProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  check.mockResolvedValue({ wishedTourIds: [] });
  set.mockResolvedValue({ tourId: A, wished: true });
  useSession.mockReturnValue({ data: { user: { id: 'u1' } } });
});

describe('WishlistHeart — không có provider', () => {
  it('KHÔNG render gì cả — thà không có nút còn hơn có nút trơ', () => {
    // Đây chính là lỗi cụm này sinh ra để sửa: card cũ ship một cái tim bấm
    // được nhưng không nối dây, kèm aria-label hứa hẹn chức năng.
    const { container } = render(<WishlistHeart tourId={A} tourTitle="Tour A" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('WishlistHeart — khách CHƯA đăng nhập', () => {
  beforeEach(() => useSession.mockReturnValue({ data: null }));

  it('không gọi wishlist.check — endpoint đó cần session', async () => {
    renderHearts();
    await waitFor(() => expect(check).not.toHaveBeenCalled());
  });

  it('bấm tim → sang trang đăng nhập, GIỮ nguyên bộ lọc đang mở', async () => {
    renderHearts();
    await userEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    expect(push).toHaveBeenCalledWith('/login?redirect=%2Ftours%3Fdestinations%3Dhue');
    expect(set).not.toHaveBeenCalled();
  });
});

describe('WishlistHeart — khách ĐÃ đăng nhập', () => {
  it('hỏi trạng thái MỘT lần cho cả trang, không phải mỗi nút một lần', async () => {
    renderHearts();
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    expect(check.mock.calls[0]?.[0]).toEqual({ tourIds: [A, B] });
  });

  it('tour đã lưu hiện tim ĐẶC (aria-pressed=true)', async () => {
    check.mockResolvedValue({ wishedTourIds: [B] });
    renderHearts();
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
      expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('bấm → đổi màu NGAY (optimistic) rồi mới gọi API', async () => {
    renderHearts();
    await waitFor(() => expect(check).toHaveBeenCalled());
    const first = screen.getAllByRole('button')[0] as HTMLElement;
    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(set).toHaveBeenCalledWith(
      { tourId: A, wished: true },
      { context: { auth: { credentials: 'include' } } },
    );
  });

  it('API lỗi → TRẢ LẠI trạng thái cũ và báo lỗi', async () => {
    set.mockRejectedValue(new Error('boom'));
    renderHearts();
    await waitFor(() => expect(check).toHaveBeenCalled());
    const first = screen.getAllByRole('button')[0] as HTMLElement;
    await userEvent.click(first);
    await waitFor(() => {
      expect(first).toHaveAttribute('aria-pressed', 'false');
      expect(error).toHaveBeenCalled();
    });
  });

  it('bỏ lưu gửi wished:false', async () => {
    check.mockResolvedValue({ wishedTourIds: [A] });
    renderHearts();
    await waitFor(() =>
      expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-pressed', 'true'),
    );
    await userEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    expect(set).toHaveBeenCalledWith(
      { tourId: A, wished: false },
      expect.objectContaining({ context: expect.anything() }),
    );
  });

  it('check lỗi → KHÔNG quấy khách bằng toast; tim vẫn bấm được', async () => {
    // Không tô được tim là mất trang trí, không phải mất chức năng.
    check.mockRejectedValue(new Error('offline'));
    renderHearts();
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(error).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    expect(set).toHaveBeenCalled();
  });

  it('cắt ở 100 id — trần contract, gửi quá là API từ chối cả lô', async () => {
    const many = Array.from(
      { length: 120 },
      (_, i) => `d0000002-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    renderHearts(many);
    await waitFor(() => expect(check).toHaveBeenCalled());
    const payload = check.mock.calls[0]?.[0] as { tourIds: string[] } | undefined;
    expect(payload?.tourIds).toHaveLength(100);
  });
});
