import { render, screen } from '@testing-library/react';
import { type BookingDetail, bookingPhase } from '@tourism/contract';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingTicket } from './booking-ticket';

// jsdom không có IntersectionObserver — mộc vào bằng `RevealItem` (motion `whileInView`).
// Stub cục bộ theo nếp `booking-receipt.spec.tsx`.
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

/** Chuyến 3 ngày 03–05/11; ngày đặt (13/08) khác ngày trả (14/08) để bắt ô "Booked" đọc nhầm. */
const PAID = makeBooking({
  code: 'BK-B6VCOQNW',
  status: 'PAID',
  tourTitle: 'Hanoi Heritage in a Day',
  tourSlug: 'hanoi-heritage-day',
  tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  createdAt: '2026-08-13T10:00:00.000Z',
  paidAt: '2026-08-14T03:05:00.000Z',
  numAdults: 2,
  numChildren: 1,
  unitPrice: '49.00',
  totalAmount: '147.00',
  contactName: 'Erik Lund',
  paymentProvider: 'PAYPAL',
});

/** "Hôm nay" mặc định: chuyến mẫu 03–05/11 còn sắp đi. Giai đoạn vé nhận do luật chung tính. */
const TODAY = '2026-10-05';

function renderTicket(booking: BookingDetail = PAID, today = TODAY) {
  return render(<BookingTicket booking={booking} phase={bookingPhase(booking, today)} />);
}

describe('BookingTicket — thân vé', () => {
  it('tên tour là h2 — hero giữ h1 duy nhất của trang', () => {
    const { container } = renderTicket();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Hanoi Heritage in a Day' }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('dải trên ghi "Entry · Tour booking" và mã; mã in lại dưới cuống', () => {
    renderTicket();
    expect(screen.getByText('Entry · Tour booking')).toBeInTheDocument();
    expect(screen.getAllByText('BK-B6VCOQNW')).toHaveLength(2);
  });

  it('DEPARTS → RETURNS kiểu giờ bay; giữa là độ dài chuyến kèm điểm đến', () => {
    renderTicket();
    expect(screen.getByText('Departs')).toBeInTheDocument();
    expect(screen.getByText('03 NOV')).toBeInTheDocument();
    expect(screen.getByText('Tue · 2026')).toBeInTheDocument();
    expect(screen.getByText('Returns')).toBeInTheDocument();
    expect(screen.getByText('05 NOV')).toBeInTheDocument();
    expect(screen.getByText('Thu · 2026')).toBeInTheDocument();
    expect(screen.getByText('3 days · Hà Nội')).toBeInTheDocument();
  });

  it('chuyến trong ngày: "1 day"', () => {
    renderTicket({ ...PAID, departureEndDate: '2026-11-03' });
    expect(screen.getByText('1 day · Hà Nội')).toBeInTheDocument();
  });

  it('tour không gắn điểm đến: chỉ còn độ dài chuyến', () => {
    renderTicket({ ...PAID, tourDestinations: [] });
    expect(screen.getByText('3 days')).toBeInTheDocument();
  });

  it('bốn ô: người đặt, số khách, ngày ĐẶT (không phải ngày trả), cổng', () => {
    renderTicket();
    for (const label of ['Lead traveller', 'Travellers', 'Booked', 'Paid with']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Erik Lund')).toBeInTheDocument();
    expect(screen.getByText('2 adults, 1 child')).toBeInTheDocument();
    expect(screen.getByText('13 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('PayPal')).toBeInTheDocument();
  });

  it('ô "Booked" là ngày lịch Việt Nam: đặt lúc 03:00 giờ VN 13/08 (20:00Z ngày 12/08)', () => {
    renderTicket({ ...PAID, createdAt: '2026-08-12T20:00:00.000Z' });
    expect(screen.getByText('13 Aug 2026')).toBeInTheDocument();
  });

  it('link "View tour" về trang tour', () => {
    renderTicket();
    expect(screen.getByRole('link', { name: 'View tour →' })).toHaveAttribute(
      'href',
      '/tours/hanoi-heritage-day',
    );
  });

  it('mộc trạng thái là `VisaStamp` có sẵn', () => {
    renderTicket();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  // Mộc theo giai đoạn (`bookingPass(…).stamp`, ADR-0054 AMEND 1 §5) — chuyến 03–05/11 có hạn
  // chót 31/10.
  it('chờ trả còn trong hạn: mộc "AWAITING PAYMENT" tông cảnh báo', () => {
    renderTicket({ ...PAID, status: 'PENDING', paidAt: null });
    expect(screen.getByText('AWAITING PAYMENT').className).toContain('text-warning');
  });

  it('chờ trả qua hạn chót: mộc "NOT PAID" mực xám — chưa chắc đã lỡ, nhưng không còn mời trả', () => {
    // Claim của API còn nhận phiên mở trước hạn (ADR-0054 AMEND 1 §4): "đã lỡ" là chưa chắc,
    // "AWAITING PAYMENT" cam là mời trả một khoản không mở lại được (review P7 B9, S1).
    renderTicket({ ...PAID, status: 'PENDING', paidAt: null }, '2026-11-01');
    expect(screen.getByText('NOT PAID').className).toContain('text-muted-foreground');
    expect(screen.queryByText('AWAITING PAYMENT')).toBeNull();
  });

  it('chuyến công ty huỷ, đơn còn PAID chờ job hoàn tiền: mộc CANCELLED, không CONFIRMED', () => {
    renderTicket({ ...PAID, departureCancelled: true });
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    expect(screen.queryByText('CONFIRMED')).toBeNull();
  });

  it('có ảnh bìa thì có cột ảnh với alt', () => {
    renderTicket({ ...PAID, tourImage: PHOTO });
    expect(screen.getByRole('img', { name: 'Temple of Literature' })).toBeInTheDocument();
  });

  it('ảnh bìa xin đúng cỡ của cột ảnh (`sizes`, srcset qua loader) thay vì tải ảnh gốc', () => {
    // Dưới `xl` ảnh trải trọn bề ngang vé, từ `xl` là cột 210px (review P7 B17).
    renderTicket({ ...PAID, tourImage: PHOTO });
    const img = screen.getByRole('img', { name: 'Temple of Literature' });
    expect(img).toHaveAttribute('sizes', '(min-width: 1280px) 210px, 100vw');
    expect(img.getAttribute('srcset')).toBeTruthy();
    expect(img.getAttribute('src')).not.toBe(PHOTO.url);
  });

  it('không có ảnh bìa thì bỏ cột ảnh', () => {
    const { container } = renderTicket({ ...PAID, tourImage: null });
    expect(container.querySelector('[data-slot="ticket-photo"]')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('BookingTicket — cuống vé', () => {
  it('Admit tổng số khách, "Total paid", số tiền, câu thuế phí', () => {
    renderTicket();
    expect(screen.getByText('Admit 3')).toBeInTheDocument();
    expect(screen.getByText('Total paid')).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
    expect(screen.getByText('Taxes and fees included')).toBeInTheDocument();
  });

  it('cuống mang `data-slot="ticket-stub"` — móc của đường xé và hai vết khuyết ở globals.css', () => {
    const { container } = renderTicket();
    expect(container.querySelector('[data-slot="ticket-stub"]')).not.toBeNull();
  });

  it('đơn còn hiệu lực và đã trả: mã vạch 52 vạch tất định theo mã', () => {
    const { container } = renderTicket();
    expect(container.querySelectorAll('[data-slot="barcode"] span')).toHaveLength(52);
  });

  it('PARTIALLY_REFUNDED vẫn là đơn còn hiệu lực: vẫn có mã vạch', () => {
    const { container } = renderTicket({
      ...PAID,
      status: 'PARTIALLY_REFUNDED',
      refundedTotal: '20.00',
    });
    expect(container.querySelector('[data-slot="barcode"]')).not.toBeNull();
  });

  it.each([
    ['chưa trả', { status: 'PENDING', paidAt: null }],
    ['đã trả rồi huỷ', { status: 'CANCELLED', cancelledAt: '2026-09-21T02:00:00.000Z' }],
    [
      'huỷ có hoàn đủ',
      { status: 'REFUNDED', refundedTotal: '147.00', cancelledAt: '2026-09-21T02:00:00.000Z' },
    ],
    ['chuyến bị công ty huỷ, đơn còn PAID chờ job hoàn tiền', { departureCancelled: true }],
  ] as const)('%s: không mã vạch', (_, patch) => {
    const { container } = renderTicket({ ...PAID, ...patch });
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
  });

  // Mã vạch theo giai đoạn (`bookingPass`, ADR-0054 AMEND 1 §5) — cùng luật với voucher, nút
  // "View voucher" bấm sang đó không còn thấy mã vạch biến mất (review P7 B11).
  it('chuyến đã đi: không mã vạch — không còn cổng nào để quét', () => {
    const { container } = renderTicket(PAID, '2026-11-10');
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
  });

  it('hoàn thiện chí trọn còn sắp đi (REFUNDED, không cancelledAt): vẫn có mã vạch — khách vẫn đi', () => {
    const { container } = renderTicket({ ...PAID, status: 'REFUNDED', refundedTotal: '147.00' });
    expect(container.querySelector('[data-slot="barcode"]')).not.toBeNull();
  });

  it('chưa trả: nhãn "Total" và ô cổng ghi "Not paid"', () => {
    renderTicket({ ...PAID, status: 'PENDING', paidAt: null });
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText('Total paid')).toBeNull();
    expect(screen.getByText('Not paid')).toBeInTheDocument();
  });

  it('bị thu rồi hoàn tự động trước khi sang PAID (paidAt null): ô cổng in tên cổng, không "Not paid"', () => {
    // Thua đua ghế hay chuyến đóng lúc capture về — API không ghi `paid_at` nhưng tiền đã đi một
    // vòng; khối Payment cùng trang in "Refunded −$147.00" (review P7 B1).
    renderTicket({
      ...PAID,
      status: 'CANCELLED',
      paidAt: null,
      cancelledAt: '2026-08-14T03:06:00.000Z',
      refundedTotal: '147.00',
    });
    expect(screen.getByText('PayPal')).toBeInTheDocument();
    expect(screen.queryByText('Not paid')).toBeNull();
  });
});
