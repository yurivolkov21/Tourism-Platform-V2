import { createORPCErrorFromJson } from '@orpc/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeWishlistItem } from '@/test/fixtures/wishlist';
import { SavedGrid } from './saved-grid';

// jsdom không có IntersectionObserver — lưới bọc từng thẻ trong `RevealItem` (motion
// `whileInView`). Stub CỤC BỘ theo quy ước ở `reveal-item.spec.tsx`: dời lên vitest.setup.ts là
// gãy test ở file khác.
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

// Mock client oRPC — chỉ kiểm gọi ĐÚNG payload `wishlist.set`, không gọi API thật.
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { wishlist: { set } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

// Lưới CHỈ toast khi LỖI (rollback) — thành công đã tự hiện qua thẻ rời lưới.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

// Bỏ lưu thành công thì lưới làm mới trang để hero (server in) đếm lại — spec 09/10 §3.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

/** Ngày lịch Việt Nam do trang server tính. */
const TODAY = '2026-10-09';
const NINH_BINH = makeWishlistItem();
const HA_GIANG = makeWishlistItem({
  tourId: 'ded599f0-df12-43a3-9b3d-bbe5d26764dc',
  slug: 'ha-giang-loop-4d',
  title: 'Hà Giang Loop by Easyrider 4D3N',
  basePrice: '189.00',
});
const HOI_AN = makeWishlistItem({
  tourId: '3c1e8a52-6f0b-4d7e-9a14-2b5f7c9d1e03',
  slug: 'hoi-an-lantern-walk',
  title: 'Hoi An Lantern Walk & Cooking Class',
});

/** Nút tim của một thẻ — tên đọc là khoá có sẵn `accountSaved.removeAria`. */
const heartOf = (title: string) =>
  screen.getByRole('button', { name: `Remove ${title} from saved tours` });

/**
 * Hứng lỗi bất đồng bộ không ai bắt. Vitest gắn sẵn một trình nghe `unhandledRejection` và coi mỗi
 * lần như thế là lỗi của CẢ lượt chạy (thoát mã 1 dù mọi ca xanh); ca `router.refresh()` ném lỗi cố ý
 * để lỗi lọt ra khỏi `handleRemove`, nên phải gỡ tạm trình nghe ấy rồi trả lại ở `restore()`.
 */
function captureUnhandledRejections() {
  const original = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  const seen: unknown[] = [];
  process.on('unhandledRejection', (reason) => {
    seen.push(reason);
  });
  return {
    seen,
    restore() {
      process.removeAllListeners('unhandledRejection');
      for (const listener of original) process.on('unhandledRejection', listener);
    },
  };
}

describe('SavedGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: NINH_BINH.tourId, wished: false });
  });

  it('rỗng ngay từ đầu → trạng thái trống với nút Browse tours, không thẻ nào', () => {
    render(<SavedGrid initialItems={[]} today={TODAY} />);
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('rỗng → khối trống giữa trang: icon tim trong vòng tròn, tiêu đề, câu dạy bấm tim, nút chính', () => {
    const { container } = render(<SavedGrid initialItems={[]} today={TODAY} />);
    const empty = container.querySelector('[data-slot="saved-empty"]');
    expect(empty).toHaveClass('mx-auto', 'max-w-130', 'border-dashed', 'text-center');
    expect(empty?.querySelector('svg')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Nothing saved yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tap the heart on any tour to keep it here for later.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveClass('bg-primary');
  });

  it('dựng đủ N thẻ (tên + giá), thẻ nào cũng có dòng ngày lưu', () => {
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('$79')).toBeInTheDocument();
    expect(screen.getByText('$189')).toBeInTheDocument();
    expect(screen.getAllByText('Saved 3 Oct')).toHaveLength(2);
  });

  it('lưới: 1 cột dưới sm, 2 cột từ sm, 3 cột từ lg; khe ngang 24px, dọc 32px', () => {
    const { container } = render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    expect(container.querySelector('[data-slot="saved-grid"]')).toHaveClass(
      'grid',
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-3',
      'gap-x-6',
      'gap-y-8',
    );
  });

  it('bấm tim trên MỘT thẻ → thẻ đó rời lưới NGAY, thẻ còn lại vẫn còn', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    expect(screen.queryByText(NINH_BINH.title)).not.toBeInTheDocument();
    expect(screen.getByText(HA_GIANG.title)).toBeInTheDocument();
  });

  it('bỏ lưu đến hết → chuyển sang trạng thái trống', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
  });

  it('bấm tim → gọi wishlist.set({ tourId, wished: false }) đúng payload', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(
        { tourId: NINH_BINH.tourId, wished: false },
        expect.anything(),
      ),
    );
  });

  it('wishlist.set lỗi → thẻ quay lại ĐÚNG chỗ cũ (không xuống cuối) + toast lỗi', async () => {
    set.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG, HOI_AN]} today={TODAY} />);

    await user.click(heartOf(HA_GIANG.title));

    // Biến mất NGAY lúc bấm đã có ca riêng ở trên; reject có thể xử lý xong trước khi
    // `user.click` trả điều khiển, nên không đo trạng thái "giữa chừng" ở đây.
    expect(await screen.findByText(HA_GIANG.title)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      NINH_BINH.title,
      HA_GIANG.title,
      HOI_AN.title,
    ]);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('bỏ lưu THÀNH CÔNG → làm mới trang đúng một lần để hero đếm lại', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('chính `router.refresh()` ném lỗi → thẻ vừa bỏ THẬT vẫn rời lưới, không toast "không bỏ được"', async () => {
    refresh.mockImplementationOnce(() => {
      throw new Error('refresh failed');
    });
    const unhandled = captureUnhandledRejections();
    try {
      const user = userEvent.setup();
      render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG]} today={TODAY} />);
      await user.click(heartOf(NINH_BINH.title));
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
      // Server đã bỏ tour (wishlist.set trả về thành công): `catch` của lời gọi API không được hứng
      // lỗi của bước làm mới rồi lật thẻ về và báo sai là bỏ lưu hỏng.
      expect(screen.queryByText(NINH_BINH.title)).not.toBeInTheDocument();
      expect(toastError).not.toHaveBeenCalled();
      // Lỗi lập trình thật thì không bị nuốt: nó lọt ra ngoài để trình duyệt ghi vào console.
      await waitFor(() => expect(unhandled.seen).toHaveLength(1));
    } finally {
      unhandled.restore();
    }
  });

  it('bỏ lưu LỖI → KHÔNG làm mới: hero giữ số cũ, thẻ đã quay lại', async () => {
    set.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));
    expect(await screen.findByText(NINH_BINH.title)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('SavedGrid — session hết hạn', () => {
  // `beforeEach` của describe trên nằm TRONG khối đó, không áp cho đây — thiếu thì mock cộng dồn
  // lượt gọi từ test trước và `not.toHaveBeenCalled` đọc sai.
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: NINH_BINH.tourId, wished: false });
  });

  it('401 → thông báo RIÊNG kèm link đăng nhập lại, KHÔNG toast lỗi chung', async () => {
    set.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Unauthorized',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
      'href',
      '/login?redirect=/account/saved',
    );
    expect(toastError).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lỗi KHÔNG phải 401 vẫn dùng toast như cũ', async () => {
    set.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    await user.click(heartOf(NINH_BINH.title));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByText('Your session has expired.')).not.toBeInTheDocument();
  });
});

describe('SavedGrid — focus sau khi bỏ lưu bằng bàn phím (spec 09/10 §3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue({ tourId: NINH_BINH.tourId, wished: false });
  });

  /** Đặt focus bàn phím lên tim của một thẻ — chỗ người dùng Tab tới trước khi bấm Enter. */
  const focusHeart = (title: string) => {
    act(() => heartOf(title).focus());
  };

  it('Tab tới tim đầu tiên rồi Enter: thẻ rời lưới, focus sang tim của thẻ KẾ, không rơi về <body>', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG, HOI_AN]} today={TODAY} />);
    await user.tab();
    expect(heartOf(NINH_BINH.title)).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(screen.queryByText(NINH_BINH.title)).not.toBeInTheDocument();
    expect(heartOf(HA_GIANG.title)).toHaveFocus();
  });

  it('bỏ thẻ ở GIỮA: focus sang thẻ kế (sau), không lùi về thẻ trước', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG, HOI_AN]} today={TODAY} />);
    focusHeart(HA_GIANG.title);
    await user.keyboard('{Enter}');
    expect(heartOf(HOI_AN.title)).toHaveFocus();
  });

  it('bỏ thẻ CUỐI: focus lùi về tim của thẻ trước', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG, HOI_AN]} today={TODAY} />);
    focusHeart(HOI_AN.title);
    await user.keyboard('{Enter}');
    expect(screen.queryByText(HOI_AN.title)).not.toBeInTheDocument();
    expect(heartOf(HA_GIANG.title)).toHaveFocus();
  });

  it('bỏ thẻ DUY NHẤT: focus sang nút "Browse tours" của trạng thái trống', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH]} today={TODAY} />);
    focusHeart(NINH_BINH.title);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveFocus();
  });

  it('Enter liền tay: focus đi theo từng thẻ còn lại rồi tới "Browse tours"', async () => {
    const user = userEvent.setup();
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG, HOI_AN]} today={TODAY} />);
    focusHeart(NINH_BINH.title);
    await user.keyboard('{Enter}');
    expect(heartOf(HA_GIANG.title)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(heartOf(HOI_AN.title)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveFocus();
  });

  it('focus đang ở chỗ khác khi thẻ rời lưới: giữ nguyên, không bị cướp', () => {
    render(<SavedGrid initialItems={[NINH_BINH, HA_GIANG, HOI_AN]} today={TODAY} />);
    focusHeart(HOI_AN.title);
    // `fireEvent.click` không đổi focus (khác `user.click` vốn focus nút trước khi bấm): giống một
    // lần bỏ lưu mà focus đang nằm ở thẻ khác hoặc ngoài lưới.
    fireEvent.click(heartOf(NINH_BINH.title));
    expect(screen.queryByText(NINH_BINH.title)).not.toBeInTheDocument();
    expect(heartOf(HOI_AN.title)).toHaveFocus();
  });
});
