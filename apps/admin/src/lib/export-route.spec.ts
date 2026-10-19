import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportFilename,
  guardExportAccess,
  isoDay,
  XLSX_CONTENT_TYPE,
  xlsxAfterBuild,
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

  it('Staff + route xuất của thủ tục chỉ Owner → 403, không đi tiếp', async () => {
    lookupServerSession.mockResolvedValueOnce({
      kind: 'ok',
      user: { id: 's1', name: 'S', email: 's@example.com', role: 'STAFF', image: null },
    });
    const gate = await guardExportAccess('/reports/export', 'reports.monthly');
    expect(gate.ok).toBe(false);
    if (gate.ok) throw new Error('unreachable');
    expect(gate.response.status).toBe(403);
    // Staff vẫn là admin: câu "no longer has admin access" của nhánh deny nói sai với họ (plan
    // P4f, quyết định 5 — cùng lý do `/not-authorized` có biến thể ownerOnly).
    expect(await gate.response.text()).toBe(messages.admin.errors.exportOwnerOnly);
  });

  it('Staff + route xuất không khai khoá quyền (bookings, subscribers) → ok', async () => {
    const user = { id: 's1', name: 'S', email: 's@example.com', role: 'STAFF', image: null };
    lookupServerSession.mockResolvedValueOnce({ kind: 'ok', user });
    expect(await guardExportAccess('/bookings/export')).toEqual({ ok: true, session: user });
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

// Review max G40 Phần 3: route từng ghi audit `ok` rồi mới dựng file — dựng lỗi (thanh REPT tỉ lệ cực
// lớn ném RangeError) thành 500 trống trong khi vết audit nói đã xuất xong.
describe('xlsxAfterBuild', () => {
  const entry = { adminId: 'a1', rows: 3, filters: { month: '2026-09' } };

  it('dựng xong mới ghi audit ok, rồi trả file', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await xlsxAfterBuild(
      'reports',
      entry,
      'nexora-report-2026-09',
      async () => new ArrayBuffer(4),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(XLSX_CONTENT_TYPE);
    expect(info).toHaveBeenCalledWith(
      '[admin] reports export',
      expect.stringContaining('"outcome":"ok"'),
    );
    info.mockRestore();
  });

  it('dựng lỗi: audit ghi failed (không ok), trả 502 có lời', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await xlsxAfterBuild('reports', entry, 'nexora-report-2026-09', async () => {
      throw new RangeError('Invalid string length');
    });
    expect(response.status).toBe(502);
    expect(await response.text()).toBe(messages.admin.errors.exportFailed);
    expect(info).toHaveBeenCalledWith(
      '[admin] reports export',
      expect.stringContaining('"outcome":"failed"'),
    );
    expect(info).not.toHaveBeenCalledWith(
      '[admin] reports export',
      expect.stringContaining('"outcome":"ok"'),
    );
    info.mockRestore();
    error.mockRestore();
  });

  // ADR-0061 §5: lượt xuất thành công vào nhật ký admin; lỗi khi báo không được chặn file.
  it('dựng xong thì báo nhật ký đúng một lần, sau khi dựng', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const order: string[] = [];
    const record = vi.fn(async () => {
      order.push('record');
    });
    const response = await xlsxAfterBuild(
      'reports',
      entry,
      'nexora-report-2026-09',
      async () => {
        order.push('build');
        return new ArrayBuffer(4);
      },
      record,
    );
    expect(response.status).toBe(200);
    expect(record).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['build', 'record']);
    info.mockRestore();
  });

  it('báo nhật ký lỗi: vẫn trả file, log một dòng', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await xlsxAfterBuild(
      'reports',
      entry,
      'nexora-report-2026-09',
      async () => new ArrayBuffer(4),
      async () => {
        throw new Error('API down');
      },
    );
    expect(response.status).toBe(200);
    expect(error).toHaveBeenCalledWith(
      '[admin] reports export activity not recorded',
      expect.any(Error),
    );
    info.mockRestore();
    error.mockRestore();
  });

  it('dựng lỗi thì không báo nhật ký', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const record = vi.fn(async () => {});
    await xlsxAfterBuild(
      'reports',
      entry,
      'nexora-report-2026-09',
      async () => {
        throw new RangeError('Invalid string length');
      },
      record,
    );
    expect(record).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });
});
