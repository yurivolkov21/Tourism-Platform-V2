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

  /** Thân lệnh POST thứ `n` (đếm từ 0) — mảng tag đã gửi. */
  const sentTags = (fetchMock: ReturnType<typeof vi.fn>, n: number): string[] =>
    JSON.parse((fetchMock.mock.calls[n] as [string, RequestInit])[1].body as string).tags;

  /** `tours` đứng đầu rồi 44 trang tour — 45 tag, quá trần 20 của route web. */
  const MANY_TAGS = ['tours', ...Array.from({ length: 44 }, (_, i) => `tour:slug-${i}`)];

  it('quá trần tag mỗi lệnh của web: chia lô 20/20/5, gửi TUẦN TỰ, giữ thứ tự (review A1-2)', async () => {
    // Route web từ chối NGUYÊN lệnh khi quá 20 tag, kể cả `tours` — gửi một lô là không tag
    // nào được bust. Lô đầu phải mang tag đầu (`tours`).
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await new WebRevalidationService().revalidate(MANY_TAGS);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const batches = [0, 1, 2].map((n) => sentTags(fetchMock, n));
    expect(batches.map((batch) => batch.length)).toEqual([20, 20, 5]);
    expect(batches.flat()).toEqual(MANY_TAGS);
    expect(batches[0]?.[0]).toBe('tours');
    expect(maxInFlight).toBe(1);
  });

  it('một lô hỏng chỉ warn — lô sau vẫn gửi (review A1-2)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(new WebRevalidationService().revalidate(MANY_TAGS)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sentTags(fetchMock, 2)).toEqual(MANY_TAGS.slice(40));
    expect(warnSpy).toHaveBeenCalledTimes(1);
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
