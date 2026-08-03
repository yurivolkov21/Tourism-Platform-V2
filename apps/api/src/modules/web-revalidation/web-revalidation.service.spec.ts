import { Logger } from '@nestjs/common';
import { WebRevalidationService } from './web-revalidation.service.js';

// Fire-and-forget: stub fetch toàn cục để không đụng network thật (nếp
// provider-http.spec.ts). `revalidate` KHÔNG BAO GIỜ throw/reject — mọi lỗi
// (non-200, network, timeout) chỉ warn, nghiệp vụ gốc (moderate) không được
// phép fail theo tín hiệu bust cache phụ này.
describe('WebRevalidationService.revalidate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('gọi đúng URL FRONTEND_URL/api/revalidate, POST, header secret + content-type, body {tags}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new WebRevalidationService();
    await service.revalidate(['tours', 'tour:vung-tau-2n1d']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/revalidate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe(
      'dev-revalidate-secret-change-me',
    );
    expect(JSON.parse(init.body as string)).toEqual({ tags: ['tours', 'tour:vung-tau-2n1d'] });
  });

  it('non-200 → resolve bình thường (không throw), có logger.warn', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const service = new WebRevalidationService();
    await expect(service.revalidate(['tours'])).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('fetch reject (network) → không throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const service = new WebRevalidationService();
    await expect(service.revalidate(['tours'])).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('truyền AbortSignal (timeout) xuống fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new WebRevalidationService();
    await service.revalidate(['tours']);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
