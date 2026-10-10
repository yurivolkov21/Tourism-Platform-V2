import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { BookingsQuery } from './bookings-query';
import {
  BOOKINGS_XLSX_HEADER,
  bookingsFilterSummary,
  buildBookingsWorkbook,
} from './bookings-xlsx';
import { COST, DATE_FMT, DATETIME_FMT, MONEY_FMT } from './xlsx-style';

/**
 * File Excel của `/bookings/export` (G40, ADR-0034 AMEND 3): ô mang KIỂU thật để người mở lọc, cộng,
 * dựng pivot — tiền là số, ngày là ngày, mốc thời gian là ngày-giờ theo giờ Việt Nam.
 */
const x = messages.admin.bookings.xlsx;
const ORIGIN = 'https://admin.example.com';
const AT = '2026-10-10T02:30:00.000Z';

const booking: Booking = {
  id: 'a0000001-0000-4000-8000-000000000001',
  code: 'BK-7Q2M9XKD',
  status: 'PAID',
  tourTitle: 'Hội An Ancient Town Walking Tour',
  tourSlug: 'hoi-an-ancient-town-walking-tour',
  tourImage: null,
  tourDestinations: [],
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-20',
  cancellationDeadline: '2026-09-15',
  departureCancelled: false,
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

const cancelled: Booking = {
  ...booking,
  code: 'BK-CANCEL01',
  status: 'CANCELLED',
  contactPhone: null,
  paidAt: null,
  cancelledAt: '2026-07-19T17:30:00.000Z',
  totalAmount: '39.00',
  refundedTotal: '39.00',
  numAdults: 1,
  numChildren: 0,
};

const QUERY: BookingsQuery = { page: 1, limit: 20, from: '2026-07-01', to: '2026-07-31' };

async function open(
  rows: readonly Booking[] = [booking, cancelled],
  options: { query?: BookingsQuery; selected?: number } = {},
): Promise<ExcelJS.Worksheet> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await buildBookingsWorkbook(rows, {
      query: options.query ?? QUERY,
      selected: options.selected ?? 0,
      adminOrigin: ORIGIN,
      generatedAt: AT,
    }),
  );
  const sheet = book.getWorksheet(x.sheet);
  if (!sheet) throw new Error('Không có sheet Bookings');
  return sheet;
}

describe('BOOKINGS_XLSX_HEADER', () => {
  it('18 cột đúng thứ tự spec §7.1, nhãn từ i18n', () => {
    const c = x.columns;
    expect(BOOKINGS_XLSX_HEADER).toEqual([
      c.code,
      c.status,
      c.tour,
      c.departureStart,
      c.departureEnd,
      c.adults,
      c.children,
      c.guests,
      c.unitPrice,
      c.total,
      c.refunded,
      c.currency,
      c.customer,
      c.email,
      c.phone,
      c.bookedAt,
      c.paidAt,
      c.cancelledAt,
    ]);
  });
});

describe('bookingsFilterSummary — đầu trang khi in', () => {
  it('URL trần (tháng hiện tại): khoảng ngày', () => {
    expect(bookingsFilterSummary(QUERY, 0)).toBe('1 Jul 2026 – 31 Jul 2026');
  });

  it('trạng thái · khoảng ngày · từ khoá · số hàng chọn', () => {
    expect(bookingsFilterSummary({ ...QUERY, status: 'PAID', search: 'hoi an' }, 3)).toBe(
      [
        messages.admin.bookings.status.PAID,
        '1 Jul 2026 – 31 Jul 2026',
        x.search('hoi an'),
        x.selected(3),
      ].join(' · '),
    );
  });

  it('một đầu ngày; không lọc gì thì "All bookings"', () => {
    expect(bookingsFilterSummary({ page: 1, limit: 20, from: '2026-07-01' }, 0)).toBe(
      x.dateFrom('1 Jul 2026'),
    );
    expect(bookingsFilterSummary({ page: 1, limit: 20, to: '2026-07-31' }, 0)).toBe(
      x.dateUntil('31 Jul 2026'),
    );
    expect(bookingsFilterSummary({ page: 1, limit: 20, allDates: true }, 0)).toBe(x.allBookings);
  });
});

describe('buildBookingsWorkbook', () => {
  it('hàng tiêu đề ở hàng 1, đóng băng, lọc tới hàng dữ liệu cuối, khổ ngang', async () => {
    const sheet = await open();
    expect(sheet.getCell('A1').value).toBe(x.columns.code);
    expect(sheet.getCell('R1').value).toBe(x.columns.cancelledAt);
    expect(sheet.views[0]?.state).toBe('frozen');
    expect(sheet.autoFilter).toBe('A1:R3');
    expect(sheet.pageSetup.orientation).toBe('landscape');
    expect(sheet.headerFooter.oddHeader).toContain(x.headerCenter('1 Jul 2026 – 31 Jul 2026'));
  });

  it('một hàng: mã là hyperlink, nhãn trạng thái admin, ngày là ngày, tiền là số', async () => {
    const sheet = await open();
    expect(sheet.getCell('A2').value).toEqual({
      text: 'BK-7Q2M9XKD',
      hyperlink: `${ORIGIN}/bookings/BK-7Q2M9XKD`,
    });
    expect(sheet.getCell('B2').value).toBe(messages.admin.bookings.status.PAID);
    expect(sheet.getCell('D2').value).toEqual(new Date('2026-09-18T00:00:00.000Z'));
    expect(sheet.getCell('D2').numFmt).toBe(DATE_FMT);
    expect(sheet.getCell('H2').value).toBe(3);
    expect(sheet.getCell('I2').value).toBe(39);
    expect(sheet.getCell('J2').value).toBe(117);
    expect(sheet.getCell('J2').numFmt).toBe(MONEY_FMT);
    expect(sheet.getCell('K2').value).toBe(0);
    expect(sheet.getCell('L2').value).toBe('USD');
    expect(sheet.getCell('O2').value).toBe('+84 90 123 4567');
  });

  it('mốc thời gian là ngày-giờ theo giờ VIỆT NAM; mốc vắng là ô trống', async () => {
    const sheet = await open();
    expect(sheet.getCell('P2').value).toEqual(new Date('2026-07-18T16:00:00.000Z')); // 09:00Z = 16:00 VN
    expect(sheet.getCell('P2').numFmt).toBe(DATETIME_FMT);
    expect(sheet.getCell('R2').value).toBeNull();
    expect(sheet.getCell('O3').value).toBeNull(); // không có điện thoại
    expect(sheet.getCell('R3').value).toEqual(new Date('2026-07-20T00:30:00.000Z'));
  });

  it('"Cancelled" chữ màu chi phí', async () => {
    expect((await open()).getCell('B3').font?.color?.argb).toBe(COST);
  });

  it('hàng Total: SUBTOTAL(109) cho Guests, Total, Refunded', async () => {
    const sheet = await open();
    expect(sheet.getCell('A4').value).toBe(x.total);
    expect(sheet.getCell('H4').value).toEqual({ formula: 'SUBTOTAL(109,H2:H3)', result: 4 });
    expect(sheet.getCell('J4').value).toEqual({ formula: 'SUBTOTAL(109,J2:J3)', result: 156 });
    expect(sheet.getCell('K4').value).toEqual({ formula: 'SUBTOTAL(109,K2:K3)', result: 39 });
  });

  it('tập rỗng vẫn có hàng tiêu đề, không hàng Total', async () => {
    const sheet = await open([]);
    expect(sheet.getCell('A1').value).toBe(x.columns.code);
    expect(sheet.getCell('A2').value).toBeNull();
    expect(sheet.autoFilter).toBe('A1:R1');
  });

  it('chữ bắt đầu bằng "=" là CHUỖI, không thành công thức (không có CSV injection ở .xlsx)', async () => {
    const sheet = await open([{ ...booking, contactName: '=HYPERLINK("http://x")' }]);
    expect(sheet.getCell('M2').value).toBe('=HYPERLINK("http://x")');
  });
});
