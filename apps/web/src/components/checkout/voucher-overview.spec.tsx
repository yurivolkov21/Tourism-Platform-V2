import { render, screen, within } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { voucherView } from '@/lib/voucher';
import {
  CANCELLED_AFTER_PAYING,
  OPERATOR_CANCELLED_PENDING,
  THREE_DAY_TRIP,
  VOUCHER_NOW,
  voucherBooking,
  voucherNowOn,
} from '@/test/fixtures/voucher';
import { VoucherOverview } from './voucher-overview';

/** Điểm hẹn dài của bản vẽ. */
const MEETING = 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội';

/** Chuyến ba ngày, 2 người lớn và 1 trẻ em — chip khách (đơn giá $49) khác hẳn tổng ($147). */
const FAMILY_TRIP = { ...THREE_DAY_TRIP, numAdults: 2, numChildren: 1 };

/** Ảnh bìa trên Cloudinary — `SlotImage` dựng `next/image` có srcset qua loader. */
const PHOTO: NonNullable<BookingDetail['tourImage']> = {
  publicId: 'tourism/catalog/tour/hanoi-heritage-day/hero',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/catalog/tour/hanoi-heritage-day/hero',
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2400,
  height: 1600,
  alt: 'Temple of Literature',
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
};

function renderOverview(
  overrides: Partial<BookingDetail> = {},
  meetingPoint: string | null = MEETING,
  now: Date = VOUCHER_NOW,
) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, now);
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

  it('mộc theo giai đoạn: CONFIRMED khi PAID sắp đi, CANCELLED khi đã huỷ', () => {
    const { unmount } = renderOverview();
    expect(screen.getByText(messages.passportVisa.stampByStatus.PAID)).toBeInTheDocument();
    unmount();

    renderOverview(CANCELLED_AFTER_PAYING);
    expect(screen.getByText(messages.passportVisa.stampByStatus.CANCELLED)).toBeInTheDocument();
    expect(screen.queryByText(messages.passportVisa.stampByStatus.PAID)).toBeNull();
  });

  it('chuyến công ty huỷ, đơn còn PAID chờ job hoàn tiền: mộc CANCELLED, không CONFIRMED', () => {
    renderOverview(OPERATOR_CANCELLED_PENDING);
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

  it('lớp tối gắn vào chính khối chữ — cao theo nội dung, không phủ cố định theo chiều cao ảnh', () => {
    const { container } = renderOverview(FAMILY_TRIP);
    const photo = slot(container, 'voucher-photo');
    const caption = slot(container, 'voucher-photo-caption');
    // Mọi chữ trên ảnh nằm TRONG khối mang lớp tối: tiêu đề xuống dòng hay chip rớt hàng thì lớp
    // tối cao theo. Lớp phủ cũ trong suốt tới 30% chiều cao ảnh, nên ở 375px dòng trên cùng
    // nằm trên ảnh trần (đo 1,04:1 trên ảnh trắng).
    for (const text of [
      'Hà Nội · 3 days',
      'Hanoi Heritage in a Day',
      '$147',
      '3–5 Nov 2026',
      '2 adults, 1 child × $49',
    ]) {
      expect(caption).toContainElement(within(photo).getByText(text));
    }
    // 90% ở đáy, 70% đúng mép trên chữ (đỉnh phần đệm 4rem), trong suốt ở đỉnh phần đệm.
    for (const cls of ['from-hero/90', 'via-hero/70', 'via-[calc(100%-4rem)]', 'pt-16']) {
      expect(caption.classList.contains(cls)).toBe(true);
    }
    // Không còn lớp phủ cố định thứ hai trải hết ảnh.
    expect(photo.querySelectorAll(':scope > [aria-hidden="true"]')).toHaveLength(0);
    // Dòng nhỏ 10.5px không bị làm mờ thêm.
    expect(within(caption).getByText('Hà Nội · 3 days').className).not.toMatch(/opacity-/);
  });

  /**
   * `sizes` theo ĐÚNG bề rộng cột ảnh ở từng khổ (review P7C#12): bản cũ "(min-width: 1280px) 45vw,
   * 100vw" xin ảnh rộng hơn ô 30–40% dưới `xl` và hụt ở 1536px. Ảnh nằm dưới mép gập ở điện thoại
   * (dưới hero, tiêu đề, ô mã) nên nạp lười, không `priority`.
   */
  it('ảnh bìa xin đúng bề rộng cột ảnh ở từng khổ và nạp lười', () => {
    renderOverview({ tourImage: PHOTO });
    const img = screen.getByRole('img', { name: 'Temple of Literature' });
    expect(img).toHaveAttribute(
      'sizes',
      '(min-width: 1536px) 758px, (min-width: 1280px) calc(100vw - 778px), (min-width: 1024px) calc(100vw - 274px), (min-width: 768px) calc(100vw - 210px), calc(100vw - 82px)',
    );
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('ảnh cao theo khối chữ — tên tour dài ở màn hẹp không bị cắt mất ở mép trên ảnh', () => {
    // Tên tour thật dài nhất của seed: ở 375px khối chữ cao ~266px, vượt ảnh cố định 224px.
    const { container } = renderOverview({
      tourTitle: 'Northern Highlights: Hanoi–Hạ Long–Ninh Bình 5D4N',
    });
    const photo = slot(container, 'voucher-photo');
    // Chiều cao TỐI THIỂU (không cố định) và khối chữ nằm trong luồng, xếp ở đáy: chữ nhiều
    // thì đẩy ảnh cao lên thay vì tràn qua mép trên rồi bị `overflow-hidden` cắt.
    for (const cls of ['min-h-56', 'md:min-h-72', 'flex', 'justify-end']) {
      expect(photo.classList.contains(cls)).toBe(true);
    }
    expect(photo.className).not.toMatch(/(^|\s)(md:)?h-\d+/);
    const caption = slot(container, 'voucher-photo-caption');
    expect(caption.classList.contains('absolute')).toBe(false);
    // Trong luồng mà không `relative` thì khối chữ bị vẽ DƯỚI ảnh `absolute` đứng trước nó.
    expect(caption.classList.contains('relative')).toBe(true);
  });
});

describe('VoucherOverview — bốn ô có icon', () => {
  it('Meeting point in nguyên văn dữ liệu tour', () => {
    renderOverview();
    expect(screen.getByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByText(MEETING)).toBeInTheDocument();
  });

  /**
   * Không có điểm hẹn (tour đã gỡ, chưa ghi điểm hẹn, API catalog lỗi): mời liên hệ, KHÔNG hứa
   * "Details are in your confirmation email." — email xác nhận không mang điểm hẹn (review P7C#4,
   * câu user chốt D4).
   */
  it('không có điểm hẹn → "Contact us" (link /contact) "for the meeting point — we reply within a day."', () => {
    renderOverview({}, null);
    const body = screen.getByText('Meeting point').nextElementSibling;
    if (!(body instanceof HTMLElement)) throw new Error('ô Meeting point phải có dòng chữ phụ');
    expect(body.textContent).toBe('Contact us for the meeting point — we reply within a day.');
    expect(within(body).getByRole('link', { name: 'Contact us' })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  /**
   * Điểm hẹn chỉ còn việc ở voucher sắp đi, đang đi (`showMeetingPoint`, cùng luật trang chi tiết
   * đơn — review P7C#6): voucher đã đi hay đã huỷ không có ô này, cũng không mời liên hệ hỏi điểm
   * hẹn cho một chuyến đã xong hay đã huỷ.
   */
  it.each([
    ['đã đi', THREE_DAY_TRIP, voucherNowOn('2026-11-10')],
    ['đã huỷ', CANCELLED_AFTER_PAYING, VOUCHER_NOW],
  ] as const)('voucher %s: không có ô Meeting point, ba ô còn lại giữ nguyên', (_, over, now) => {
    renderOverview(over, null, now);
    expect(screen.queryByText('Meeting point')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Contact us' })).toBeNull();
    for (const title of ['Paid with PayPal', 'Lead traveller', 'Need help?']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
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
    expect(screen.getByText('Need help?').nextElementSibling?.textContent).toBe(
      'Reply to the confirmation email, or contact us.',
    );
    expect(screen.getByRole('link', { name: 'contact us' })).toHaveAttribute('href', '/contact');
  });
});

describe('VoucherOverview — ô mã gọn khi thẻ một cột (spec §6.4)', () => {
  // `voucher-split:` (globals.css) gói điều kiện thẻ chia đôi (từ xl) vào MỘT biến thể; bản cũ tự
  // ghép cặp `xl:hidden print:hidden` ở nơi gọi (review P7C#13).
  it('có nhãn, mã và nút chép; giấu khi thẻ chia đôi (từ xl) — mảng teal mang ô mã ở đó', () => {
    const { container } = renderOverview();
    const code = slot(container, 'voucher-code');
    expect(within(code).getByText('Booking code')).toBeInTheDocument();
    expect(within(code).getByText('BK-B6VCOQNW')).toBeInTheDocument();
    expect(
      within(code).getByRole('button', { name: messages.booking.success.copyCode }),
    ).toBeInTheDocument();
    expect(code.classList.contains('voucher-split:hidden')).toBe(true);
  });

  it('đơn đã huỷ: không có mã nào, dải hết hiệu lực thay chỗ (cũng chỉ khi thẻ một cột)', () => {
    const { container } = renderOverview(CANCELLED_AFTER_PAYING);
    expect(screen.queryByText('BK-B6VCOQNW')).toBeNull();
    const notice = slot(container, 'voucher-cancelled');
    expect(notice.textContent).toBe(
      'This booking was cancelled — this voucher is no longer valid.',
    );
    expect(notice.classList.contains('voucher-split:hidden')).toBe(true);
  });
});
