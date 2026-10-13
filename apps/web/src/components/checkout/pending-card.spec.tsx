import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PendingPage, pendingView } from '@/lib/pending-receipt';
import { makeBooking } from '@/test/fixtures/booking';
import { PendingCard } from './pending-card';

// `router.refresh()` của nút Refresh và bộ hẹn giờ tự làm tươi.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

// Pay now gọi đúng `bookings.checkout` của trang chi tiết đơn — spec chỉ hỏi lời gọi, không gọi API.
const { checkout } = vi.hoisted(() => ({ checkout: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { bookings: { checkout, cancelPending: vi.fn(), cancel: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

beforeEach(() => {
  refresh.mockReset();
  checkout.mockReset();
});

const CODE = 'BK-EET0JBTH';
const AT = new Date('2026-10-09T11:02:00.000Z'); // 18:02 giờ VN, ba phút sau khi đặt
const LAPSED = new Date('2026-10-29T03:00:00.000Z');
const p = messages.pendingReceipt;

/** Đơn của bản thảo B1: Hội An một ngày 29/10, 1 người lớn × $39, đặt 17:59 giờ VN 9/10. */
const booking = (overrides: Partial<BookingDetail> = {}) =>
  makeBooking({
    code: CODE,
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-09T10:59:36.812Z',
    tourTitle: 'Hội An Old Town & Lantern Evening',
    tourSlug: 'hoi-an-lantern-evening',
    tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    departureStartDate: '2026-10-29',
    departureEndDate: '2026-10-29',
    unitPrice: '39.00',
    totalAmount: '39.00',
    contactName: 'Nora Dahl',
    contactEmail: 'nora.dahl@example.com',
    ...overrides,
  });

function renderCard(
  page: PendingPage,
  { overrides = {}, now = AT }: { overrides?: Partial<BookingDetail>; now?: Date } = {},
) {
  const b = booking(overrides);
  return render(<PendingCard booking={b} view={pendingView(b, now, page)} />);
}

const slot = (container: HTMLElement, name: string) => {
  const el = container.querySelector(`[data-slot="${name}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`thiếu data-slot="${name}"`);
  return el;
};

describe('PendingCard — khung như voucher', () => {
  it('hai cột trong MỘT thẻ, chia đôi từ voucher-split; cột phải mảng muted; một h2, không h1', () => {
    const { container } = renderCard('cancel');
    const card = slot(container, 'pending-card');
    expect(card.classList.contains('voucher-split:grid-cols-[minmax(0,1fr)_440px]')).toBe(true);
    expect(card.querySelector('[data-slot="pending-overview"]')).not.toBeNull();
    expect(slot(container, 'pending-pass').classList.contains('bg-muted')).toBe(true);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
  });

  it('không mã vạch ở bất kỳ trạng thái nào — mã chưa phải giấy vào cổng', () => {
    for (const [page, now] of [
      ['cancel', AT],
      ['success', AT],
      ['cancel', LAPSED],
    ] as const) {
      const { container, unmount } = renderCard(page, { now });
      expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
      unmount();
    }
  });

  it('ô mã gọn (dưới xl) và ô mã cột phải mang CÙNG một mã', () => {
    const { container } = renderCard('cancel');
    const compact = slot(container, 'pending-compact');
    const ticket = slot(container, 'pending-ticket');
    expect(within(compact).getByText(CODE)).toBeInTheDocument();
    expect(within(ticket).getByText(CODE)).toBeInTheDocument();
    expect(compact.classList.contains('voucher-split:hidden')).toBe(true);
    expect(ticket.classList.contains('voucher-stack:hidden')).toBe(true);
  });
});

describe('PendingCard — trang huỷ, đơn còn trả được', () => {
  it('mộc chờ trả, tiêu đề, ô hạn trả, dải Unpaid, link View booking', () => {
    const { container } = renderCard('cancel');
    expect(
      screen.getByRole('heading', { level: 2, name: messages.booking.cancel.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.passportVisa.stampByStatus.PENDING)).toBeInTheDocument();
    // Ô hạn trả của lưới bốn ô và mốc Awaiting payment của nhật ký.
    expect(screen.getAllByText('Pay by 18:59 · Fri 9 Oct')).toHaveLength(2);
    expect(slot(container, 'pending-band')).toHaveTextContent(messages.printDoc.receipt.unpaid);
    expect(
      screen.getByRole('link', { name: messages.booking.success.viewBooking }),
    ).toHaveAttribute('href', `/account/bookings/${CODE}`);
  });

  it('Pay now gọi bookings.checkout với mã đơn; không có nút huỷ giữ chỗ', async () => {
    checkout.mockResolvedValueOnce({ checkoutUrl: null });
    renderCard('cancel');
    const buttons = screen.getAllByRole('button', {
      name: messages.accountBookingDetail.actions.payNow,
    });
    // Một ở ô gọn (dưới xl), một ở cột phải (từ xl) — CSS chỉ hiện một.
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[0] as HTMLElement);
    expect(checkout).toHaveBeenCalledWith({ code: CODE }, expect.anything());
    expect(
      screen.queryByRole('button', { name: messages.accountBookingDetail.actions.cancel }),
    ).toBeNull();
  });
});

describe('PendingCard — trang success, khách về trước webhook', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dòng "Checking with Stripe…" và nút Refresh; không Pay now', () => {
    renderCard('success');
    expect(
      screen.getByRole('heading', { level: 2, name: messages.booking.success.pendingTitle }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(p.checkingWith.STRIPE)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: messages.booking.success.refresh })).toHaveLength(
      2,
    );
    expect(
      screen.queryByRole('button', { name: messages.accountBookingDetail.actions.payNow }),
    ).toBeNull();
  });

  // Hành động vẽ hai lần mà CSS chỉ giấu: hai bộ hẹn giờ là hai lượt refresh mỗi nhịp 5 giây.
  it('chỉ MỘT bộ hẹn giờ tự làm tươi trên cả thẻ', () => {
    vi.useFakeTimers();
    renderCard('success');
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('PendingCard — đơn không còn trả được', () => {
  it('quá hạn chót: mộc NOT PAID, ảnh xám, nút Book again sang trang tour', () => {
    const { container } = renderCard('cancel', { now: LAPSED });
    expect(screen.getByText(messages.passportVisa.stampLapsed)).toBeInTheDocument();
    expect(slot(container, 'voucher-photo').querySelector('.grayscale')).not.toBeNull();
    const again = screen.getAllByRole('link', { name: messages.printDoc.receipt.bookAgain });
    expect(again).toHaveLength(2);
    for (const link of again) expect(link).toHaveAttribute('href', '/tours/hoi-an-lantern-evening');
    expect(
      screen.queryByRole('button', { name: messages.accountBookingDetail.actions.payNow }),
    ).toBeNull();
  });

  it('đã đóng khi chưa trả: tiêu đề đóng, câu cuống nói thẳng, dải Closed, "Charged · $0"', () => {
    const { container } = renderCard('cancel', {
      overrides: { status: 'CANCELLED', cancelledAt: '2026-10-09T12:05:00.000Z' },
    });
    expect(screen.getByRole('heading', { level: 2, name: p.closedTitle })).toBeInTheDocument();
    expect(screen.getByText(messages.booking.success.stubClosed)).toBeInTheDocument();
    expect(slot(container, 'pending-band')).toHaveTextContent(
      messages.printDoc.receipt.stampClosed,
    );
    const receipt = slot(container, 'pending-receipt');
    expect(within(receipt).getByText(p.charged).nextElementSibling).toHaveTextContent('$0');
    expect(within(receipt).queryByText(messages.checkoutSummary.taxesNote)).toBeNull();
  });
});
