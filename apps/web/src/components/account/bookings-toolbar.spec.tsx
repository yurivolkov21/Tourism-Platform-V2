import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingsListFacets } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsListParams } from '@/lib/bookings-list';
import {
  BOOKINGS_SEARCH_ID,
  BookingsToolbar,
  ResetFiltersButton,
  SEARCH_DEBOUNCE_MS,
} from './bookings-toolbar';

/**
 * Hàng tìm và lọc của My bookings (spec P7 §7.2): mọi thay đổi thay URL bằng
 * `router.replace(…, { scroll: false })` và đưa page về 1. Router là mock nên `params` không
 * tự đổi sau cú bấm — ca nào cần "URL về tới" thì `rerender` tường minh.
 */
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const FACETS: BookingsListFacets = {
  when: { ON_TOUR: 1, UPCOMING: 2, PAST: 5 },
  status: { PENDING: 1, PAID: 5, CANCELLED: 0, REFUNDED: 2, PARTIALLY_REFUNDED: 0 },
};
const NONE: BookingsListParams = { q: null, when: [], status: [], page: 1 };
const SCROLL = { scroll: false };
const SEARCH = { name: 'Search tour or booking code' };

function renderToolbar(params: Partial<BookingsListParams> = {}) {
  return render(<BookingsToolbar params={{ ...NONE, ...params }} facets={FACETS} />);
}

beforeEach(() => {
  replace.mockReset();
});

describe('BookingsToolbar — lọc', () => {
  it('tích Upcoming: replace sang ?when=upcoming, page về 1, giữ từ khoá', async () => {
    const user = userEvent.setup();
    renderToolbar({ q: 'hue', page: 3 });
    await user.click(screen.getByRole('button', { name: 'When' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Upcoming, 2 trips' }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/account/bookings?q=hue&when=upcoming', SCROLL);
  });

  it('bỏ tích giá trị đang chọn: chỉ giá trị ấy rời URL', async () => {
    const user = userEvent.setup();
    renderToolbar({ when: ['UPCOMING', 'PAST'] });
    await user.click(screen.getByRole('button', { name: 'When: 2 selected' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Upcoming, 2 trips' }));

    expect(replace).toHaveBeenCalledWith('/account/bookings?when=past', SCROLL);
  });

  it('Status chỉ bày trạng thái có đơn, cộng trạng thái đang chọn dù đếm 0', async () => {
    const user = userEvent.setup();
    renderToolbar({ status: ['CANCELLED'] });
    await user.click(screen.getByRole('button', { name: 'Status: Cancelled' }));
    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.getByRole('checkbox', { name: 'Awaiting payment, 1 trip' })).toBeInTheDocument();
    expect(dialog.getByRole('checkbox', { name: 'Paid, 5 trips' })).toBeInTheDocument();
    expect(dialog.getByRole('checkbox', { name: 'Cancelled, 0 trips' })).toBeChecked();
    expect(dialog.getByRole('checkbox', { name: 'Refunded, 2 trips' })).toBeInTheDocument();
    expect(dialog.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('"Clear filters" của Status chỉ xoá Status', async () => {
    const user = userEvent.setup();
    renderToolbar({ when: ['UPCOMING'], status: ['PAID'] });
    await user.click(screen.getByRole('button', { name: 'Status: Paid' }));
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(replace).toHaveBeenCalledWith('/account/bookings?when=upcoming', SCROLL);
  });
});

describe('BookingsToolbar — ô tìm', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gõ xong 300 ms mới áp; page về 1, giữ bộ lọc', async () => {
    vi.useFakeTimers();
    renderToolbar({ when: ['PAST'], page: 2 });
    fireEvent.change(screen.getByRole('searchbox', SEARCH), { target: { value: 'ha noi' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/account/bookings?q=ha+noi&when=past', SCROLL);
  });

  it('Enter áp ngay và huỷ lượt đang chờ — không gửi lần hai', async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.type(screen.getByRole('searchbox', SEARCH), 'hanoi{Enter}');

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/account/bookings?q=hanoi', SCROLL);
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('nút ✕ xoá từ khoá, URL bỏ q, tiêu điểm về ô tìm', async () => {
    const user = userEvent.setup();
    renderToolbar({ q: 'hanoi', status: ['PAID'] });
    const box = screen.getByRole('searchbox', SEARCH);
    expect(box).toHaveValue('hanoi');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
    expect(replace).toHaveBeenCalledWith('/account/bookings?status=paid', SCROLL);
  });

  it('URL đổi từ ngoài (nút Back, link Reset) thì ô tìm theo URL', () => {
    const { rerender } = renderToolbar({ q: 'hanoi' });
    rerender(<BookingsToolbar params={NONE} facets={FACETS} />);

    expect(screen.getByRole('searchbox', SEARCH)).toHaveValue('');
  });

  it('lượt tìm của CHÍNH ô về tới thì không đè chữ khách đang gõ dở', async () => {
    vi.useFakeTimers();
    const { rerender } = renderToolbar();
    const box = screen.getByRole('searchbox', SEARCH);
    fireEvent.change(box, { target: { value: 'ha noi' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    // Trong lúc trang mới đang về, khách gõ tiếp.
    fireEvent.change(box, { target: { value: 'ha noi old' } });
    rerender(<BookingsToolbar params={{ ...NONE, q: 'ha noi' }} facets={FACETS} />);

    expect(box).toHaveValue('ha noi old');
  });
  /**
   * Review P7 06/10: lượt tìm đang chờ thuộc về URL CŨ. Không huỷ thì 300 ms sau nó
   * router.replace đè lên mục lịch sử khách vừa Back về, với bộ lọc của trang cũ.
   */
  it('URL đổi từ ngoài trong lúc lượt tìm còn chờ: huỷ lượt ấy, không đè mục vừa về', async () => {
    vi.useFakeTimers();
    const { rerender } = renderToolbar({ q: 'hue' });
    fireEvent.change(screen.getByRole('searchbox', SEARCH), { target: { value: 'hue x' } });
    rerender(<BookingsToolbar params={{ ...NONE, q: 'hanoi' }} facets={FACETS} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox', SEARCH)).toHaveValue('hanoi');
  });

  /** Lượt khôi phục phải tải lại thì `params` về MUỘN hơn 300 ms — sự kiện popstate tới trước. */
  it('nút Back (popstate) huỷ lượt tìm đang chờ ngay, ô tìm theo URL vừa khôi phục', async () => {
    vi.useFakeTimers();
    renderToolbar({ q: 'hue' });
    fireEvent.change(screen.getByRole('searchbox', SEARCH), { target: { value: 'hue x' } });
    window.history.pushState(null, '', '/account/bookings?q=hanoi');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox', SEARCH)).toHaveValue('hanoi');
    window.history.replaceState(null, '', '/');
  });
});

describe('BookingsToolbar — Reset', () => {
  it('không lọc, không tìm thì không có Reset', () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('đang lọc: Reset về danh sách gốc và trả tiêu điểm cho ô tìm', async () => {
    const user = userEvent.setup();
    renderToolbar({ q: 'hue', when: ['PAST'], status: ['PAID'], page: 2 });
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(replace).toHaveBeenCalledWith('/account/bookings', SCROLL);
    expect(screen.getByRole('searchbox', SEARCH)).toHaveFocus();
  });
});

describe('ResetFiltersButton — Reset của trạng thái "No trips match"', () => {
  it('ô tìm của hàng lọc mang id mà nút này trả tiêu điểm về', () => {
    renderToolbar();
    expect(screen.getByRole('searchbox', SEARCH)).toHaveAttribute('id', BOOKINGS_SEARCH_ID);
  });

  /** Review P7 06/10: bản link thường tải lại cả trang và thêm một mục lịch sử. */
  it('replace về danh sách gốc (không thêm lịch sử) và trả tiêu điểm cho ô tìm', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input id={BOOKINGS_SEARCH_ID} aria-label="Search" />
        <ResetFiltersButton />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(replace).toHaveBeenCalledWith('/account/bookings', SCROLL);
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
  });
});
