// Spec này render React (SSR bằng `renderToString` rồi hydrate) nên thuộc project
// `dom` theo ADR-0014 §4 — đuôi .spec.tsx trong `src/lib` quyết định project.
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// UserMenu gọi `useRouter` — ngoài App Router thật hook này ném invariant, nên
// mock mỏng đúng khuôn user-menu.spec.tsx. Mọi thứ còn lại là THẬT: client Better
// Auth, atom session của nó, `useStore` của `better-auth/react`, UserMenu, Base UI.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * Body `GET /api/auth/get-session` của một khách ĐÃ đăng nhập — shape better-auth
 * 1.6.23 như `lib/api/session.ts` đối chiếu, kèm `additionalFields` phone/role/
 * deletedAt khai ở `apps/api/src/auth/auth.config.ts` (role mặc định CUSTOMER).
 */
const SIGNED_IN_SESSION = {
  session: {
    id: 'sess_01',
    token: 'tok_01',
    userId: 'user_01',
    expiresAt: '2026-09-22T08:00:00.000Z',
    createdAt: '2026-09-15T08:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  },
  user: {
    id: 'user_01',
    name: 'Minh Anh',
    email: 'minh.anh@example.com',
    emailVerified: true,
    image: null,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    phone: null,
    role: 'CUSTOMER',
    deletedAt: null,
  },
};

beforeEach(() => {
  // Mạng là thứ DUY NHẤT bị thay. Better Auth chụp `customFetchImpl: fetch` đúng lúc
  // `createAuthClient` chạy, nên stub phải có mặt TRƯỚC khi nạp `auth-client`.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(SIGNED_IN_SESSION)),
  );
});

/**
 * Nạp MỚI `auth-client` + `UserMenu` cho mỗi test: atom session của Better Auth là
 * singleton cấp module — test trước đã resolve thì test sau không còn thấy trạng
 * thái pending ban đầu, tức trạng thái mà server luôn render.
 */
async function loadFreshModules() {
  vi.resetModules();
  const { authClient } = await import('./auth-client');
  const { UserMenu } = await import('@/components/user-menu');
  return { authClient, UserMenu };
}

describe('useSession — island session hydrate khớp HTML server (ADR-0017 §2)', () => {
  // Lỗi quan sát 15/09 ở /account, /account/bookings, /account/bookings/<code>:
  // server không đọc session nên HTML navbar luôn là "Log in", nhưng `/get-session`
  // về TRƯỚC lúc React kịp hydrate UserMenu → lượt hydrate đã render avatar →
  // "Hydration failed because the server rendered HTML didn't match the client".
  it('session về trước lúc hydrate → không lệch HTML server, avatar hiện ngay SAU hydrate', async () => {
    const { authClient, UserMenu } = await loadFreshModules();

    // Pha server: atom còn pending — đúng thứ Next gửi xuống cho mọi khách.
    const serverHtml = renderToString(<UserMenu />);
    expect(serverHtml).toContain('href="/login"');

    // Race: `/get-session` resolve xong trong lúc UserMenu còn chờ hydrate.
    await waitFor(() =>
      expect(authClient.$store.atoms.session?.get().data?.user.email).toBe('minh.anh@example.com'),
    );

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    render(<UserMenu />, { container, hydrate: true, onRecoverableError });

    // Session thật vẫn phải tới được navbar — chỉ là sau lượt hydrate.
    expect(await screen.findByRole('button', { name: 'Account' })).toBeInTheDocument();
    // Hydration mismatch của React 19 đi qua onRecoverableError; map ra message để
    // lúc đỏ đọc được nguyên văn lỗi.
    expect(onRecoverableError.mock.calls.map(([error]) => String(error))).toEqual([]);
  });

  // Chặn cách chữa sai kiểu `useEffect` + state "đã mount": nó cũng hết lệch hydrate,
  // nhưng MỌI lần mount — kể cả điều hướng client, nơi không có HTML server nào để
  // khớp — đều chớp "Log in" trước khi lên avatar. `act` của RTL flush effect trước
  // khi `render` trả về nên DOM cuối không lộ cú chớp; phải ghi lại từng node được chèn.
  it('island mount SAU hydrate (điều hướng client) → không bao giờ chèn link "Log in"', async () => {
    const { authClient, UserMenu } = await loadFreshModules();
    await waitFor(() =>
      expect(authClient.$store.atoms.session?.get().data?.user.email).toBe('minh.anh@example.com'),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const inserted: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) inserted.push(...record.addedNodes);
    });
    observer.observe(container, { childList: true, subtree: true });

    render(<UserMenu />, { container });

    for (const record of observer.takeRecords()) inserted.push(...record.addedNodes);
    observer.disconnect();
    const loginLinks = inserted.filter(
      (node) => node instanceof HTMLAnchorElement && node.getAttribute('href') === '/login',
    );
    expect(loginLinks).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });
});
