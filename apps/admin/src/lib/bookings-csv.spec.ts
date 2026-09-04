import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { BOOKINGS_CSV_HEADER, bookingsCsvRows, toBookingCsvRow } from './bookings-csv';

/**
 * File CSV của `/bookings` (spec P4b §3-F6) mang DỮ LIỆU chứ không phải chữ
 * hiển thị: người mở nó sẽ lọc, cộng, dựng pivot — nên tiền phải là số Excel
 * đọc được, ngày phải là ISO, trạng thái phải là member enum.
 */
const booking: Booking = {
  id: 'a0000001-0000-4000-8000-000000000001',
  code: 'BK-7Q2M9XKD',
  status: 'PAID',
  tourTitle: 'Hội An Ancient Town Walking Tour',
  tourSlug: 'hoi-an-ancient-town-walking-tour',
  freeCancellationDays: null,
  tourImage: null,
  tourDestinations: [],
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-20',
  unitPrice: '39.00',
  totalAmount: '117.00',
  currency: 'USD',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Alice Nguyen',
  contactEmail: 'alice@example.com',
  contactPhone: '+84 90 123 4567',
  specialRequests: null,
  paymentProvider: 'STRIPE',
  checkoutUrl: null,
  paidAt: '2026-07-18T10:15:00.000Z',
  cancelledAt: null,
  createdAt: '2026-07-18T09:00:00.000Z',
  cancellationStatus: null,
  cancellationRequestedAt: null,
  cancellationDecidedAt: null,
  refundedTotal: '0.00',
  reviewedAt: null,
};

describe('BOOKINGS_CSV_HEADER', () => {
  it('nhãn cột lấy từ i18n, không chép tay', () => {
    expect(BOOKINGS_CSV_HEADER[0]).toBe(messages.admin.bookings.csv.code);
    expect(BOOKINGS_CSV_HEADER).toContain(messages.admin.bookings.csv.totalAmount);
  });
});

describe('toBookingCsvRow', () => {
  it('mỗi hàng có đúng số ô của header — lệch một ô là cả file lệch cột', () => {
    expect(toBookingCsvRow(booking)).toHaveLength(BOOKINGS_CSV_HEADER.length);
  });

  it('tiền là số THÔ, không ký hiệu và không dấu phân cách nghìn', () => {
    const row = toBookingCsvRow(booking);
    expect(row).toContain('117.00');
    expect(row).toContain('39.00');
    expect(row).toContain('USD');
    expect(row.some((cell) => cell.includes('$'))).toBe(false);
  });

  it('trạng thái là member enum, không phải nhãn hiển thị', () => {
    expect(toBookingCsvRow(booking)).toContain('PAID');
    expect(toBookingCsvRow({ ...booking, status: 'PARTIALLY_REFUNDED' })).toContain(
      'PARTIALLY_REFUNDED',
    );
  });

  it('mốc thời gian giữ nguyên ISO UTC của contract', () => {
    const row = toBookingCsvRow(booking);
    expect(row).toContain('2026-07-18T09:00:00.000Z');
    expect(row).toContain('2026-07-18T10:15:00.000Z');
  });

  it('khách lẻ (adults/children/guests) tách thành ba cột đếm được', () => {
    const row = toBookingCsvRow(booking);
    expect(row).toContain('2');
    expect(row).toContain('1');
    expect(row).toContain('3');
  });

  it('field vắng thành Ô RỖNG, không phải chữ "—" hay "null"', () => {
    // Ô rỗng là "không có giá trị" với mọi công cụ; một em-dash là text và
    // sẽ phá mọi phép lọc/tính trên cột đó.
    const row = toBookingCsvRow({ ...booking, contactPhone: null, paidAt: null });
    expect(row).toContain('');
    expect(row.some((cell) => cell === '—' || cell === 'null')).toBe(false);
  });
});

describe('bookingsCsvRows', () => {
  it('header đứng đầu, mỗi booking một hàng', () => {
    const rows = bookingsCsvRows([booking, { ...booking, code: 'BK-OTHER01' }]);
    expect(rows[0]).toEqual(BOOKINGS_CSV_HEADER);
    expect(rows).toHaveLength(3);
    expect(rows[2]?.[0]).toBe('BK-OTHER01');
  });

  it('không booking nào vẫn có header — file rỗng mở ra vẫn đọc được cột', () => {
    expect(bookingsCsvRows([])).toEqual([BOOKINGS_CSV_HEADER]);
  });
});
