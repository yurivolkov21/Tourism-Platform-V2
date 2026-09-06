import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * W2 mục 9 (audit cụm 8): mỗi route xuất một test — chứng minh route TRẢ
 * NGAY response của gate khi bị từ chối và KHÔNG chạm tầng data (không một
 * byte PII nào được gom trước khi quyền được xác nhận). Bốn nhánh bên trong
 * gate đã có ma trận riêng ở export-route.spec; ở đây chỉ cần "route có hỏi
 * gate và có nghe lời không" — đúng lỗ mà audit chỉ: xoá `if (!gate.ok)`
 * là ba spec này đỏ.
 */

const { guardExportAccess, denied } = vi.hoisted(() => {
  const response = new Response('unauthorized', { status: 401 });
  return {
    denied: response,
    guardExportAccess: vi.fn(async () => ({ ok: false as const, response })),
  };
});
vi.mock('@/lib/export-route', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export-route')>();
  return { ...actual, guardExportAccess };
});

// Tầng data: mock nổ nếu bị gọi — gate từ chối rồi thì không được gom gì.
const { fetchAdminBookings, fetchAllAdminBookings, fetchAdminMonthlyReport } = vi.hoisted(() => ({
  fetchAdminBookings: vi.fn(async () => {
    throw new Error('không được chạm data khi gate từ chối');
  }),
  fetchAllAdminBookings: vi.fn(async () => {
    throw new Error('không được chạm data khi gate từ chối');
  }),
  fetchAdminMonthlyReport: vi.fn(async () => {
    throw new Error('không được chạm data khi gate từ chối');
  }),
}));
vi.mock('@/lib/api/bookings', () => ({ fetchAdminBookings, fetchAllAdminBookings }));
vi.mock('@/lib/api/reports', () => ({ fetchAdminMonthlyReport }));
const { fetchAllAdminSubscribers } = vi.hoisted(() => ({
  fetchAllAdminSubscribers: vi.fn(async () => {
    throw new Error('không được chạm data khi gate từ chối');
  }),
}));
vi.mock('@/lib/api/subscribers', () => ({ fetchAllAdminSubscribers }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ toString: (): string => '' })) }));

function requestFor(path: string): NextRequest {
  return {
    nextUrl: new URL(`https://admin.example.com${path}`),
  } as unknown as NextRequest;
}

describe('route xuất tôn trọng gate (mỗi route một test)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardExportAccess.mockResolvedValue({ ok: false as const, response: denied });
  });

  it('GET /bookings/export: gate từ chối → trả nguyên response, không fetch', async () => {
    const { GET } = await import('@/app/(admin)/bookings/export/route');
    const res = await GET(requestFor('/bookings/export'));
    expect(res).toBe(denied);
    expect(guardExportAccess).toHaveBeenCalledWith('/bookings/export');
    expect(fetchAdminBookings).not.toHaveBeenCalled();
    expect(fetchAllAdminBookings).not.toHaveBeenCalled();
  });

  it('GET /reports/export: gate từ chối → trả nguyên response, không fetch', async () => {
    const { GET } = await import('@/app/(admin)/reports/export/route');
    const res = await GET(requestFor('/reports/export'));
    expect(res).toBe(denied);
    expect(guardExportAccess).toHaveBeenCalledWith('/reports/export');
    expect(fetchAdminMonthlyReport).not.toHaveBeenCalled();
    expect(fetchAllAdminBookings).not.toHaveBeenCalled();
  });

  it('GET /subscribers/export: gate từ chối → trả nguyên response, không fetch', async () => {
    const { GET } = await import('@/app/(admin)/subscribers/export/route');
    const res = await GET(requestFor('/subscribers/export'));
    expect(res).toBe(denied);
    expect(guardExportAccess).toHaveBeenCalledWith('/subscribers/export');
    expect(fetchAllAdminSubscribers).not.toHaveBeenCalled();
  });
});
