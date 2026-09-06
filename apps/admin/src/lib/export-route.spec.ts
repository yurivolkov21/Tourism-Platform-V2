import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guardExportAccess } from './export-route';

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
