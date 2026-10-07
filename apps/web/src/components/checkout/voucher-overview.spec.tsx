import { render, screen, within } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { voucherView } from '@/lib/voucher';
import {
  openCancellation,
  VOUCHER_NOW,
  VOUCHER_TODAY,
  voucherBooking,
} from '@/test/fixtures/voucher';
import { VoucherOverview } from './voucher-overview';

/** Điểm hẹn dài của bản vẽ. */
const MEETING = 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội';

/** Chuyến ba ngày, 2 người lớn và 1 trẻ em — chip khách (đơn giá $49) khác hẳn tổng ($147). */
const FAMILY_TRIP = {
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: openCancellation('2026-10-31'),
  numAdults: 2,
  numChildren: 1,
};

/** Đơn đã trả rồi bị huỷ — voucher hết hiệu lực. */
const CANCELLED = {
  status: 'CANCELLED',
  cancellation: null,
  cancelledAt: '2026-10-19T08:00:00.000Z',
} as const;

function renderOverview(
  overrides: Partial<BookingDetail> = {},
  meetingPoint: string | null = MEETING,
) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW, VOUCHER_TODAY);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(<VoucherOverview booking={booking} view={view} meetingPoint={meetingPoint} />);
}

function slot(container: HTMLElement, name: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-slot="${name}"]`);
  if (!el) throw new Error(`thiếu [data-slot="${name}"]`);
  return el;
}

describe('VoucherOverview — tiêu đề và mộc', () => {
  it('tiêu đề là h2 (hero giữ h1 duy nhất), dòng phụ ngay dưới', () => {
    const { container } = renderOverview();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your trip voucher' }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(
      screen.getByText('Booked on 18 Oct 2026 · a copy went to erik.lund@example.com'),
    ).toBeInTheDocument();
  });

  it('mộc theo trạng thái: CONFIRMED khi PAID, CANCELLED khi đã huỷ', () => {
    const { unmount } = renderOverview();
    expect(screen.getByText(messages.passportVisa.stampByStatus.PAID)).toBeInTheDocument();
    unmount();

    renderOverview(CANCELLED);
    expect(screen.getByText(messages.passportVisa.stampByStatus.CANCELLED)).toBeInTheDocument();
    expect(screen.queryByText(messages.passportVisa.stampByStatus.PAID)).toBeNull();
  });
});

describe('VoucherOverview — thẻ ảnh', () => {
  it('dòng "{nơi} · {D} days", tên tour, tổng đã trả và hai chip kính mờ', () => {
    const { container } = renderOverview(FAMILY_TRIP);
    const photo = within(slot(container, 'voucher-photo'));
    expect(photo.getByText('Hà Nội · 3 days')).toBeInTheDocument();
    expect(photo.getByText('Hanoi Heritage in a Day')).toBeInTheDocument();
    expect(photo.getByText('$147')).toBeInTheDocument();
    expect(photo.getByText('3–5 Nov 2026')).toBeInTheDocument();
    // Đơn giá ($49), KHÔNG phải tổng ($147).
    expect(photo.getByText('2 adults, 1 child × $49')).toBeInTheDocument();
  });

  it('chuyến một ngày: "1 day" số ít', () => {
    const { container } = renderOverview();
    expect(
      within(slot(container, 'voucher-photo')).getByText('Hà Nội · 1 day'),
    ).toBeInTheDocument();
  });
});

describe('VoucherOverview — bốn ô có icon', () => {
  it('Meeting point in nguyên văn dữ liệu tour', () => {
    renderOverview();
    expect(screen.getByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByText(MEETING)).toBeInTheDocument();
  });

  it('tour đã gỡ (không có điểm hẹn) → chỉ sang email xác nhận', () => {
    renderOverview({}, null);
    expect(screen.getByText('Details are in your confirmation email.')).toBeInTheDocument();
  });

  it('Paid with {cổng}: ngày trả · ghi chú chế độ thử', () => {
    renderOverview();
    expect(screen.getByText('Paid with PayPal')).toBeInTheDocument();
    expect(
      screen.getByText(`18 Oct 2026 · ${messages.tourDetail.booking.testMode}`),
    ).toBeInTheDocument();
  });

  it('Lead traveller: họ tên · email', () => {
    renderOverview();
    expect(screen.getByText('Lead traveller')).toBeInTheDocument();
    expect(screen.getByText('Erik Lund · erik.lund@example.com')).toBeInTheDocument();
  });

  it('Need help? — link "contact us" tới /contact', () => {
    renderOverview();
    expect(screen.getByText('Need help?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contact us' })).toHaveAttribute('href', '/contact');
  });
});

describe('VoucherOverview — ô mã gọn cho điện thoại (spec §6.4)', () => {
  it('có nhãn, mã và nút chép; giấu ở màn rộng và khi in (mảng teal mang ô mã ở đó)', () => {
    const { container } = renderOverview();
    const code = slot(container, 'voucher-code');
    expect(within(code).getByText('Booking code')).toBeInTheDocument();
    expect(within(code).getByText('BK-B6VCOQNW')).toBeInTheDocument();
    expect(
      within(code).getByRole('button', { name: messages.booking.success.copyCode }),
    ).toBeInTheDocument();
    expect(code.classList.contains('md:hidden')).toBe(true);
    expect(code.classList.contains('print:hidden')).toBe(true);
  });

  it('đơn đã huỷ: không có mã nào, dải hết hiệu lực thay chỗ (cũng chỉ trên điện thoại)', () => {
    const { container } = renderOverview(CANCELLED);
    expect(screen.queryByText('BK-B6VCOQNW')).toBeNull();
    const notice = slot(container, 'voucher-cancelled');
    expect(notice.textContent).toBe(
      'This booking was cancelled — this voucher is no longer valid.',
    );
    expect(notice.classList.contains('md:hidden')).toBe(true);
  });
});
