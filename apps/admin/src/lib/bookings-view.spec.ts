import type { Booking } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { parseBookingsSearchParams } from './bookings-query';
import {
  formatAmount,
  formatCalendarDate,
  formatDateRange,
  formatDateTime,
  formatGuests,
  guestCount,
  statusBadgeVariant,
  toBookingRow,
} from './bookings-view';

/**
 * Mapper hiển thị của vùng bookings (spec P4b §3-F1). Chúng THUẦN và nằm
 * ngoài React để test được: bảng + trang chi tiết chỉ render VM có sẵn.
 */

/** Một booking đủ field contract để dựng VM — chỉ đổi phần từng test quan tâm. */
function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'NX-ABC123',
    status: 'PAID',
    tourTitle: 'Ha Long Bay Cruise',
    tourSlug: 'ha-long-bay-cruise',
    tourImage: null,
    tourDestinations: [],
    departureStartDate: '2026-09-14',
    departureEndDate: '2026-09-20',
    unitPrice: '499.00',
    totalAmount: '1497.00',
    currency: 'USD',
    numAdults: 2,
    numChildren: 1,
    contactName: 'Ann Nguyen',
    contactEmail: 'ann@example.com',
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-08-30T09:30:00.000Z',
    cancelledAt: null,
    createdAt: '2026-08-29T02:05:00.000Z',
    cancellationStatus: null,
    cancellationRequestedAt: null,
    cancellationDecidedAt: null,
    refundedTotal: '0.00',
    reviewedAt: null,
    ...overrides,
  };
}

describe('formatAmount', () => {
  it('chuỗi thập phân của contract → tiền có ký hiệu và ĐỦ hai số lẻ', () => {
    expect(formatAmount('1497.00', 'USD')).toBe('$1,497.00');
  });

  it('giữ phần lẻ khác 0 — back-office cần con số chính xác, không làm tròn', () => {
    expect(formatAmount('1234.50', 'USD')).toBe('$1,234.50');
    expect(formatAmount('0.05', 'USD')).toBe('$0.05');
  });
});

describe('formatCalendarDate', () => {
  it('ngày lịch YYYY-MM-DD in nguyên vẹn, KHÔNG lệch theo múi giờ máy', () => {
    expect(formatCalendarDate('2026-09-14')).toBe('14 Sep 2026');
    expect(formatCalendarDate('2026-01-01')).toBe('1 Jan 2026');
  });
});

describe('formatDateRange', () => {
  it('khoảng đợt khởi hành nối bằng gạch ngang', () => {
    expect(formatDateRange('2026-09-14', '2026-09-20')).toBe('14 Sep 2026 – 20 Sep 2026');
  });
});

describe('formatDateTime', () => {
  it('mốc ISO đọc theo UTC kèm nhãn — admin đọc cùng giờ với sổ cái, không theo máy', () => {
    expect(formatDateTime('2026-08-30T09:30:00.000Z')).toBe('30 Aug 2026, 09:30 UTC');
  });

  it('null → gạch ngang, không phải "null"', () => {
    expect(formatDateTime(null)).toBe('—');
  });
});

describe('guestCount', () => {
  it('khách = người lớn + trẻ em', () => {
    expect(guestCount({ numAdults: 2, numChildren: 1 })).toBe(3);
    expect(guestCount({ numAdults: 1, numChildren: 0 })).toBe(1);
  });
});

describe('formatGuests', () => {
  it('có trẻ em thì tách rõ hai vế', () => {
    expect(formatGuests({ numAdults: 2, numChildren: 1 })).toBe('2 adults, 1 child');
  });

  it('không trẻ em thì chỉ nói người lớn', () => {
    expect(formatGuests({ numAdults: 1, numChildren: 0 })).toBe('1 adult');
  });

  it('nhiều trẻ em dùng số nhiều đúng', () => {
    // Cùng nguồn `accountBookings.travellers` với web — một booking một câu.
    expect(formatGuests({ numAdults: 2, numChildren: 3 })).toBe('2 adults, 3 children');
  });
});

describe('toBookingRow', () => {
  /** Bộ lọc đang xem — hàng phải mang nó sang link chi tiết (user báo 04/09). */
  const QUERY = parseBookingsSearchParams(
    { status: 'PAID', from: '2026-07-01', to: '2026-07-31', page: '2' },
    new Date('2026-09-04T10:00:00.000Z'),
  );

  it('gói đúng 6 cột của bảng — mọi thứ đã format sẵn, bảng không tự tính', () => {
    expect(toBookingRow(makeBooking(), QUERY)).toEqual({
      code: 'NX-ABC123',
      tourTitle: 'Ha Long Bay Cruise',
      status: 'PAID',
      statusLabel: 'Paid',
      guests: 3,
      guestsLabel: '2 adults, 1 child',
      amount: '$1,497.00',
      customerName: 'Ann Nguyen',
      customerEmail: 'ann@example.com',
      departure: '14 Sep 2026 – 20 Sep 2026',
      href: '/bookings/NX-ABC123?status=PAID&from=2026-07-01&to=2026-07-31&page=2',
    });
  });

  it('nhãn trạng thái lấy từ i18n cho mọi giá trị enum', () => {
    expect(toBookingRow(makeBooking({ status: 'PARTIALLY_REFUNDED' }), QUERY).statusLabel).toBe(
      'Partially refunded',
    );
    expect(toBookingRow(makeBooking({ status: 'PENDING' }), QUERY).statusLabel).toBe('Pending');
  });
});

describe('statusBadgeVariant', () => {
  it('mỗi trạng thái có đúng một variant badge — luật màu THUẦN, không nằm trong JSX', () => {
    expect(statusBadgeVariant('PAID')).toBe('default');
    expect(statusBadgeVariant('PENDING')).toBe('secondary');
    expect(statusBadgeVariant('CANCELLED')).toBe('destructive');
    expect(statusBadgeVariant('REFUNDED')).toBe('outline');
    expect(statusBadgeVariant('PARTIALLY_REFUNDED')).toBe('outline');
  });
});
