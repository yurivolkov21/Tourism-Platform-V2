import { deleteAccountRequest, type FetchLike } from './account-api';

const API = 'http://192.168.1.10:3001';

function fakeFetch(response: Response | Error): jest.MockedFunction<FetchLike> {
  return jest.fn<Promise<Response>, Parameters<FetchLike>>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

describe('deleteAccountRequest', () => {
  it('gửi DELETE JSON kèm cookie phiên và mật khẩu trong body', async () => {
    const fetchImpl = fakeFetch(new Response(null, { status: 204 }));

    const result = await deleteAccountRequest('secret-123', {
      apiUrl: API,
      cookie: 'better-auth.session_token=abc',
      fetchImpl,
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`${API}/api/account`);
    expect(init?.method).toBe('DELETE');
    expect(init?.headers).toEqual({
      'content-type': 'application/json',
      cookie: 'better-auth.session_token=abc',
    });
    expect(init?.body).toBe(JSON.stringify({ password: 'secret-123' }));
  });

  it('lỗi có envelope thì trả status và code', async () => {
    const fetchImpl = fakeFetch(
      new Response(JSON.stringify({ code: 'INVALID_PASSWORD', message: 'Incorrect password' }), {
        status: 403,
      }),
    );

    const result = await deleteAccountRequest('sai', { apiUrl: API, cookie: '', fetchImpl });

    expect(result).toEqual({ ok: false, status: 403, code: 'INVALID_PASSWORD' });
  });

  it('body không phải JSON thì chỉ trả status', async () => {
    const fetchImpl = fakeFetch(new Response('<html>bad gateway</html>', { status: 502 }));

    const result = await deleteAccountRequest('x', { apiUrl: API, cookie: '', fetchImpl });

    expect(result).toEqual({ ok: false, status: 502 });
  });

  it('mất mạng thì trả status 0, không ném', async () => {
    const fetchImpl = fakeFetch(new TypeError('Network request failed'));

    const result = await deleteAccountRequest('x', { apiUrl: API, cookie: '', fetchImpl });

    expect(result).toEqual({ ok: false, status: 0 });
  });
});
