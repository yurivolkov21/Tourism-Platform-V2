import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/headers — session.ts forward NGUYÊN header cookie xuống API
// (ADR-0017 §3), không đọc từng cookie riêng lẻ nên chỉ cần toString().
// vi.hoisted: vi.mock được hoist lên đầu file, biến thường khai SAU import
// sẽ vướng TDZ (khuôn giống submit.spec.ts/login-form.spec.tsx).
const { cookiesToString } = vi.hoisted(() => ({
  cookiesToString: vi.fn(() => 'better-auth.session_token=abc'),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: cookiesToString }),
}));

// Mock next/navigation — redirect() THẬT luôn throw để ngắt render ngay tại
// chỗ gọi; mock lại đúng hành vi đó (KHÔNG no-op) để requireSession không
// "rơi qua" code sau redirect một cách sai lệch so với runtime thật.
const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

// React `cache()` bản 'react' thường (non-'react-server' condition) mà
// Vitest node runtime resolve là NO-OP passthrough — đo được tại
// node_modules/.pnpm/react@19.2.4/node_modules/react/cjs/
// react.development.js:917-920 (`exports.cache = function(fn){ return
// function(){ return fn.apply(null, arguments); }; }` — không nhớ gì cả).
// Bộ nhớ dedupe THẬT chỉ tồn tại ở bản `react-server` mà bundler Next.js
// resolve lúc chạy RSC thật; không tái tạo được trong Vitest node runtime
// (đã thử `react-dom/server` — vẫn không có dispatcher phù hợp). Mock lại
// MỘT bản memoize thật ở đây để xác nhận session.ts CÓ bọc cache() đúng chỗ
// (gỡ cache() ra thì test dedupe bên dưới sẽ đỏ) — không nhằm test lại cơ
// chế cache() nội bộ của React (không thuộc trách nhiệm của module này).
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
      let called = false;
      let result: ReturnType<T>;
      return ((...args: Parameters<T>) => {
        if (!called) {
          called = true;
          result = fn(...args) as ReturnType<T>;
        }
        return result;
      }) as T;
    },
  };
});

const validUser = {
  id: '0198c9c4-0000-7000-8000-000000000009',
  name: 'Mai Nguyen',
  email: 'mai@example.com',
  emailVerified: true,
  image: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  role: 'CUSTOMER',
  phone: '+84901234567',
  deletedAt: null,
};

/** `getServerSession` bọc `cache()` ở module top-level → phải import LẠI
 * module (sau `vi.resetModules()`) cho MỖI test để mỗi kịch bản có một
 * singleton dedupe riêng, không ăn ké kết quả mock fetch của test trước. */
async function freshSessionModule() {
  return import('./session');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('getServerSession', () => {
  it('200 có user (deletedAt null) → trả SessionUser đúng field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ session: { id: 's1' }, user: validUser }),
      }),
    );
    const { getServerSession } = await freshSessionModule();

    const result = await getServerSession();

    expect(result).toEqual({
      id: validUser.id,
      name: validUser.name,
      email: validUser.email,
      role: 'CUSTOMER',
      phone: '+84901234567',
    });
  });

  it('200 nhưng body null (BA: không có cookie session hợp lệ) → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => null }));
    const { getServerSession } = await freshSessionModule();

    expect(await getServerSession()).toBeNull();
  });

  it('user có deletedAt khác null (tombstone) → coi như null-session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          session: { id: 's1' },
          user: { ...validUser, deletedAt: '2026-08-01T00:00:00.000Z' },
        }),
      }),
    );
    const { getServerSession } = await freshSessionModule();

    expect(await getServerSession()).toBeNull();
  });

  it('response không ok (401) → null, KHÔNG throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
    const { getServerSession } = await freshSessionModule();

    await expect(getServerSession()).resolves.toBeNull();
  });

  it('lỗi mạng (fetch reject) → null, KHÔNG throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { getServerSession } = await freshSessionModule();

    await expect(getServerSession()).resolves.toBeNull();
  });

  it('gọi 2 lần trong cùng render chỉ tốn 1 fetch (React cache dedupe)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session: { id: 's1' }, user: validUser }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getServerSession } = await freshSessionModule();

    const first = await getServerSession();
    const second = await getServerSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

describe('requireSession', () => {
  it('có session → trả SessionUser, KHÔNG redirect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ session: { id: 's1' }, user: validUser }),
      }),
    );
    const { requireSession } = await freshSessionModule();

    const result = await requireSession('/account/bookings');

    expect(result).toEqual({
      id: validUser.id,
      name: validUser.name,
      email: validUser.email,
      role: 'CUSTOMER',
      phone: '+84901234567',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('không có session → redirect /login?redirect=<path đã encode>', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => null }));
    const { requireSession } = await freshSessionModule();

    await expect(requireSession('/account/bookings')).rejects.toThrow(
      'REDIRECT:/login?redirect=%2Faccount%2Fbookings',
    );
    expect(redirectMock).toHaveBeenCalledWith('/login?redirect=%2Faccount%2Fbookings');
  });
});
