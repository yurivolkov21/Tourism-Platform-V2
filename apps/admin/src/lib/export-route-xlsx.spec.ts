import type { Booking, SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ba route xuất trả `.xlsx` (G40, ADR-0034 AMEND 3) mà KHÔNG đổi hạ tầng: 413 khi vượt trần, 409 khi
 * tập đổi hay hàng chọn đã trôi, header tải file đúng loại. Gate đã có ma trận riêng
 * (`export-route.spec`, `export-route-gate.spec`) — ở đây gate cho qua.
 */
const ADMIN = { id: 'a1', name: 'A', email: 'a@example.com', role: 'ADMIN', image: null };

const { guardExportAccess } = vi.hoisted(() => ({ guardExportAccess: vi.fn() }));
vi.mock('@/lib/export-route', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export-route')>();
  return { ...actual, guardExportAccess };
});
const { fetchAdminBookings, fetchAllAdminBookings } = vi.hoisted(() => ({
  fetchAdminBookings: vi.fn(),
  fetchAllAdminBookings: vi.fn(),
}));
vi.mock('@/lib/api/bookings', () => ({ fetchAdminBookings, fetchAllAdminBookings }));
const { fetchAllAdminSubscribers } = vi.hoisted(() => ({ fetchAllAdminSubscribers: vi.fn() }));
vi.mock('@/lib/api/subscribers', () => ({ fetchAllAdminSubscribers }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ toString: (): string => '' })) }));

const booking = {
  code: 'BK-7Q2M9XKD',
  status: 'PAID',
  tourTitle: 'Hội An Ancient Town Walking Tour',
  departureStartDate: '2026-09-18',
  departureEndDate: '2026-09-20',
  unitPrice: '39.00',
  totalAmount: '117.00',
  refundedTotal: '0.00',
  currency: 'USD',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Alice Nguyen',
  contactEmail: 'alice@example.com',
  contactPhone: null,
  createdAt: '2026-07-18T09:00:00.000Z',
  paidAt: '2026-07-18T10:15:00.000Z',
  cancelledAt: null,
} as unknown as Booking;

const subscriber: SubscriberRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  confirmedAt: '2026-09-01T10:05:00.000Z',
  unsubscribedAt: null,
};

function requestFor(path: string): NextRequest {
  return { nextUrl: new URL(`https://admin.example.com${path}`) } as unknown as NextRequest;
}

async function sheetOf(response: Response, name: string): Promise<ExcelJS.Worksheet> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await response.arrayBuffer());
  const sheet = book.getWorksheet(name);
  if (!sheet) throw new Error(`Không có sheet ${name}`);
  return sheet;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

beforeEach(() => {
  vi.clearAllMocks();
  guardExportAccess.mockResolvedValue({ ok: true, session: ADMIN });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /bookings/export', () => {
  it('cả tập → .xlsx tải về, mã đơn trỏ về chính origin admin', async () => {
    fetchAllAdminBookings.mockResolvedValue({ kind: 'rows', items: [booking] });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(XLSX);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="nexora-bookings-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const sheet = await sheetOf(response, messages.admin.bookings.xlsx.sheet);
    expect(sheet.getCell('A2').value).toEqual({
      text: 'BK-7Q2M9XKD',
      hyperlink: 'https://admin.example.com/bookings/BK-7Q2M9XKD',
    });
  });

  it('vượt trần → 413 kèm con số, không file', async () => {
    fetchAllAdminBookings.mockResolvedValue({ kind: 'too-large', total: 2500, max: 2000 });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export'));
    expect(response.status).toBe(413);
    expect(await response.text()).toBe(messages.admin.bookings.list.exportTooLarge(2500, 2000));
  });

  it('tập đổi giữa vòng gom → 409', async () => {
    fetchAllAdminBookings.mockResolvedValue({ kind: 'changed', total: 10, now: 11 });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export'));
    expect(response.status).toBe(409);
    expect(await response.text()).toBe(messages.admin.errors.exportListChanged);
  });

  it('xuất hàng đã chọn → .xlsx đúng các hàng ấy, đầu trang ghi số hàng chọn', async () => {
    fetchAdminBookings.mockResolvedValue({
      items: [booking],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export?page=1&limit=20&sel=BK-7Q2M9XKD'));
    expect(response.status).toBe(200);
    const sheet = await sheetOf(response, messages.admin.bookings.xlsx.sheet);
    expect(sheet.headerFooter.oddHeader).toContain(messages.admin.bookings.xlsx.selected(1));
    expect(fetchAllAdminBookings).not.toHaveBeenCalled();
  });

  it('hàng đã chọn không còn trên trang → 409', async () => {
    fetchAdminBookings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const response = await GET(requestFor('/bookings/export?page=1&limit=20&sel=BK-7Q2M9XKD'));
    expect(response.status).toBe(409);
    expect(await response.text()).toBe(messages.admin.errors.exportSelectionStale);
  });
});

describe('GET /subscribers/export', () => {
  it('cả tập → .xlsx tải về', async () => {
    fetchAllAdminSubscribers.mockResolvedValue({ kind: 'rows', items: [subscriber] });
    const { GET } = await import('@/app/(admin)/subscribers/export/route');
    const response = await GET(requestFor('/subscribers/export'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="nexora-subscribers-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    const sheet = await sheetOf(response, messages.admin.subscribers.xlsx.sheet);
    expect(sheet.getCell('A2').value).toBe('ada@example.com');
  });

  it('vượt trần → 413', async () => {
    fetchAllAdminSubscribers.mockResolvedValue({ kind: 'too-large', total: 2500, max: 2000 });
    const { GET } = await import('@/app/(admin)/subscribers/export/route');
    const response = await GET(requestFor('/subscribers/export'));
    expect(response.status).toBe(413);
  });
});
