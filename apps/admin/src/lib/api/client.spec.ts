import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { contract } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { type AdminApiContext, createAdminLink, withAdminAuth, withAdminOptions } from './client';
import { ADMIN_FORBIDDEN_DIGEST } from './forbidden';

/**
 * Client oRPC của admin (spec P4b §2.3) rút gọn từ bản web: chỉ còn ĐƯỜNG
 * SERVER cookie-forward, không có nhánh browser-credentials và không có
 * revalidate/tag — back-office luôn đọc dữ liệu tươi.
 */
describe('withAdminAuth', () => {
  it('bọc cookie thành context dùng thẳng cho call oRPC', () => {
    expect(withAdminAuth('better-auth.session_token=abc')).toEqual({
      cookie: 'better-auth.session_token=abc',
    });
  });
});

describe('withAdminOptions', () => {
  it('forward cookie mà GIỮ header oRPC đã đặt trên request gốc', () => {
    const request = new Request('http://api.test/x', { headers: { accept: 'application/json' } });
    const init = withAdminOptions(request, { method: 'GET' }, { cookie: 'session=abc' });

    const headers = init.headers as Headers;
    expect(headers.get('cookie')).toBe('session=abc');
    expect(headers.get('accept')).toBe('application/json');
    expect(init.method).toBe('GET');
  });

  it('LUÔN no-store — mọi bề mặt admin là dữ liệu quản trị, không được cache', () => {
    const request = new Request('http://api.test/x');
    expect(withAdminOptions(request, {}, { cookie: 'session=abc' }).cache).toBe('no-store');
  });

  it('không có context vẫn no-store, và không bịa header cookie rỗng', () => {
    const request = new Request('http://api.test/x');
    const init = withAdminOptions(request, { method: 'GET' }, undefined);
    expect(init).toEqual({ method: 'GET', cache: 'no-store' });
  });
});

// Vòng vá review W3: interceptor gắn digest 403 (ADR-0026 AMEND 3 §B) là mắt
// xích DUY NHẤT nối markAdminForbidden với đường thật — bơm một fetch trả 403
// giả qua chính link để gỡ interceptor là đỏ.
describe('createAdminLink — interceptor 403 → digest ADMIN_FORBIDDEN', () => {
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  it('HTTP 403 từ API → lỗi ném ra mang digest ADMIN_FORBIDDEN', async () => {
    const fetchImpl = (async () =>
      jsonResponse(403, {
        defined: false,
        code: 'FORBIDDEN',
        status: 403,
        message: 'no',
      })) as typeof fetch;
    const api = createORPCClient<ContractRouterClient<typeof contract, AdminApiContext>>(
      createAdminLink(fetchImpl),
    );
    await expect(
      api.admin.bookings.list({ page: 1 }, { context: withAdminAuth('c=1') }),
    ).rejects.toMatchObject({ status: 403, digest: ADMIN_FORBIDDEN_DIGEST });
  });

  it('HTTP 500 → KHÔNG có digest (ở lại màn lỗi chung)', async () => {
    const fetchImpl = (async () =>
      jsonResponse(500, {
        defined: false,
        code: 'INTERNAL',
        status: 500,
        message: 'boom',
      })) as typeof fetch;
    const api = createORPCClient<ContractRouterClient<typeof contract, AdminApiContext>>(
      createAdminLink(fetchImpl),
    );
    await expect(
      api.admin.bookings.list({ page: 1 }, { context: withAdminAuth('c=1') }),
    ).rejects.not.toHaveProperty('digest');
  });
});
