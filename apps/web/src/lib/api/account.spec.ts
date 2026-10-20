import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSignInMethods } from './account';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Response `GET /api/auth/list-accounts` (better-auth 1.6.23, `dist/api/routes/account.mjs`). */
const account = (providerId: string) => ({
  id: `acc-${providerId}`,
  providerId,
  accountId: 'user-1',
  userId: 'user-1',
  scopes: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

describe('fetchSignInMethods', () => {
  it('forward cookie phiên, no-store; đổi providerId của Better Auth sang cách đăng nhập', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [account('google'), account('credential')],
    });
    vi.stubGlobal('fetch', fetchMock);

    // Thứ tự cố định (mật khẩu trước, Google sau), không theo thứ tự row của API.
    await expect(fetchSignInMethods('session=abc')).resolves.toEqual(['password', 'google']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/list-accounts$/);
    expect(init).toEqual({ headers: { cookie: 'session=abc' }, cache: 'no-store' });
  });

  it('tài khoản chỉ có Google (review L1-08) → chỉ "google"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [account('google')] }),
    );
    await expect(fetchSignInMethods('session=abc')).resolves.toEqual(['google']);
  });

  it('provider web không hiển thị (vd một provider thêm sau) bị bỏ qua', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [account('credential'), account('github')],
      }),
    );
    await expect(fetchSignInMethods('session=abc')).resolves.toEqual(['password']);
  });

  it('API trả lỗi, lỗi mạng hay body hỏng → null, KHÔNG ném (mục phụ, không làm hỏng trang)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchSignInMethods('session=abc')).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(fetchSignInMethods('session=abc')).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: true }) }),
    );
    await expect(fetchSignInMethods('session=abc')).resolves.toBeNull();
  });

  it('lỗi nội bộ của Next (có digest) đi thẳng ra, không bị nuốt thành null', async () => {
    const dynamicUsage = Object.assign(new Error('Dynamic server usage'), {
      digest: 'DYNAMIC_SERVER_USAGE',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(dynamicUsage));
    await expect(fetchSignInMethods('session=abc')).rejects.toBe(dynamicUsage);
  });
});
