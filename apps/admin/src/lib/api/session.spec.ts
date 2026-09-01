import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerSession, lookupServerSession } from './session';

/**
 * Phân loại kết quả tra phiên (vòng vá review F6): `none` (API trả lời:
 * không có phiên) phải TÁCH khỏi `unreachable` (không hỏi được API) — gộp
 * chung là hai route export nói "phiên hết hạn" khi Render sập.
 */
vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'better-auth.session_token=abc' }),
}));
vi.mock('./env', () => ({ apiOrigin: () => 'http://api.test' }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  // `cache()` memo hoá theo request RSC; vitest không có request nào — gỡ
  // memo để mỗi test tự dựng kịch bản fetch của riêng nó.
  return { ...actual, cache: <T>(fn: T) => fn };
});

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const okResponse = (body: unknown) => ({ ok: true, json: async () => body });

const USER = {
  id: 'u-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'ADMIN',
  deletedAt: null,
  image: null,
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe('lookupServerSession', () => {
  it('phiên hợp lệ → ok, cookie được forward tới đúng endpoint, no-store', async () => {
    fetchMock.mockResolvedValue(okResponse({ session: {}, user: USER }));

    const lookup = await lookupServerSession();

    expect(lookup).toEqual({
      kind: 'ok',
      user: {
        id: 'u-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: 'ADMIN',
        image: null,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/auth/get-session', {
      headers: { cookie: 'better-auth.session_token=abc' },
      cache: 'no-store',
    });
  });

  it('API trả lời "không có phiên" (body null) → none — đây mới là ca mời đăng nhập', async () => {
    fetchMock.mockResolvedValue(okResponse(null));
    expect(await lookupServerSession()).toEqual({ kind: 'none' });
  });

  it('tài khoản tombstone (deletedAt) cũng là none — phiên chết theo tài khoản', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ session: {}, user: { ...USER, deletedAt: '2026-08-01T00:00:00.000Z' } }),
    );
    expect(await lookupServerSession()).toEqual({ kind: 'none' });
  });

  it('mạng đứt (fetch throw) → unreachable, KHÔNG phải none', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await lookupServerSession()).toEqual({ kind: 'unreachable' });
  });

  it('API hỏng (status ngoài 2xx) → unreachable — get-session không bao giờ 401 cho thiếu cookie', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await lookupServerSession()).toEqual({ kind: 'unreachable' });
  });
});

describe('getServerSession (bản rút gọn cho layout/page)', () => {
  it('ok → user; cả none lẫn unreachable đều là null — fail-closed như cũ', async () => {
    fetchMock.mockResolvedValue(okResponse({ session: {}, user: USER }));
    expect((await getServerSession())?.id).toBe('u-1');

    fetchMock.mockResolvedValue(okResponse(null));
    expect(await getServerSession()).toBeNull();

    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await getServerSession()).toBeNull();
  });
});
