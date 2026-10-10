import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportFilename,
  guardExportAccess,
  isoDay,
  XLSX_CONTENT_TYPE,
  xlsxExportResponse,
} from './export-route';

/**
 * W2 mục 9 (audit cụm 8 — Vừa): `guardExportAccess` là LỚP GÁC DUY NHẤT của
 * ba route xuất PII hàng loạt (route handler không chạy qua (admin)/layout,
 * proxy chỉ kiểm cookie tồn tại) — mà trước spec này nó không có test nào:
 * xoá dòng `if (!gate.ok)` cả suite vẫn xanh. Bốn ca dưới đây phủ đúng bốn
 * nhánh của gate; ba route dùng nó có test riêng ở export-route-gate.spec.
 */

const { lookupServerSession } = vi.hoisted(() => ({ lookupServerSession: vi.fn() }));
vi.mock('@/lib/api/session', () => ({ lookupServerSession }));

describe('guardExportAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('API không hỏi được (unreachable) → 502 "export failed", KHÔNG phải 401', async () => {
    // Nói dối ở đây từng có thật: Render sập mà route trả "session expired",
    // admin đăng xuất/đăng nhập vô ích trong khi phiên còn nguyên.
    lookupServerSession.mockResolvedValueOnce({ kind: 'unreachable' });
    const gate = await guardExportAccess('/bookings/export');
    expect(gate.ok).toBe(false);
    if (gate.ok) throw new Error('unreachable');
    expect(gate.response.status).toBe(502);
    expect(await gate.response.text()).toBe(messages.admin.errors.exportFailed);
  });

  it('không có phiên → 401', async () => {
    lookupServerSession.mockResolvedValueOnce({ kind: 'none' });
    const gate = await guardExportAccess('/bookings/export');
    expect(gate.ok).toBe(false);
    if (gate.ok) throw new Error('unreachable');
    expect(gate.response.status).toBe(401);
  });

  it('phiên CUSTOMER (không phải admin) → 403', async () => {
    lookupServerSession.mockResolvedValueOnce({
      kind: 'ok',
      user: { id: 'u1', name: 'C', email: 'c@example.com', role: 'CUSTOMER', image: null },
    });
    const gate = await guardExportAccess('/reports/export');
    expect(gate.ok).toBe(false);
    if (gate.ok) throw new Error('unreachable');
    expect(gate.response.status).toBe(403);
  });

  it('phiên ADMIN → ok, session được trả nguyên cho route ghi audit', async () => {
    const user = { id: 'a1', name: 'A', email: 'a@example.com', role: 'ADMIN', image: null };
    lookupServerSession.mockResolvedValueOnce({ kind: 'ok', user });
    const gate = await guardExportAccess('/subscribers/export');
    expect(gate).toEqual({ ok: true, session: user });
  });
});

describe('isoDay', () => {
  it('ngày UTC của một mốc — cùng thước với ngày mà API lọc', () => {
    expect(isoDay(new Date('2026-09-01T23:30:00.000Z'))).toBe('2026-09-01');
    expect(isoDay(new Date('2026-12-31T00:00:00.000Z'))).toBe('2026-12-31');
  });
});

describe('exportFilename', () => {
  it('tên + ngày xuất + đuôi; làm sạch tên vì nó đi vào header HTTP', () => {
    expect(exportFilename('nexora-bookings', '2026-09-01', 'xlsx')).toBe(
      'nexora-bookings-2026-09-01.xlsx',
    );
    expect(exportFilename('book"ings\r\n', '2026-09-01', 'xlsx')).toBe('book-ings-2026-09-01.xlsx');
    expect(exportFilename('Nexora Bookings', '2026-09-01', 'xlsx')).toBe(
      'nexora-bookings-2026-09-01.xlsx',
    );
  });
});

describe('xlsxExportResponse', () => {
  it('ép tải về đúng tên .xlsx, đúng content-type, cấm cache', () => {
    const response = xlsxExportResponse('nexora-bookings', new ArrayBuffer(0));
    expect(response.headers.get('content-type')).toBe(XLSX_CONTENT_TYPE);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="nexora-bookings-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
