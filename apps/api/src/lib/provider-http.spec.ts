import { defaultHttpPost, PROVIDER_HTTP_TIMEOUT_MS } from './provider-http.js';

describe('defaultHttpPost', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('truyền AbortSignal có timeout xuống fetch', async () => {
    // Không có timeout thì provider treo kết nối sẽ treo luôn request tạo
    // booking / vòng outbox-drain — vô thời hạn. Đây là bảo vệ đó.
    let seen: RequestInit | undefined;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    await defaultHttpPost('https://api.stripe.com/v1/x', { headers: {}, body: '' });

    expect(seen?.signal).toBeInstanceOf(AbortSignal);
    expect(PROVIDER_HTTP_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('ném lỗi có tên provider + url khi quá hạn, không nuốt im lặng', async () => {
    // fetch thật sẽ ném AbortError khi signal fire; mô phỏng đúng hành vi đó.
    globalThis.fetch = (async () => {
      throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    }) as unknown as typeof fetch;

    await expect(
      defaultHttpPost('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
        headers: {},
        body: '',
      }),
    ).rejects.toThrow(/timed out|api-m\.sandbox\.paypal\.com/);
  });

  it('lỗi mạng khác vẫn ném nguyên, không bị nhầm thành timeout', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    await expect(
      defaultHttpPost('https://api.resend.com/emails', { headers: {}, body: '' }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});
