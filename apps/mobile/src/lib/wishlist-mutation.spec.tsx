import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { isWishlistMutating, useWishlistSetMutation } from './wishlist-mutation';

// Không chạm SecureStore thật — cookie rỗng đủ cho link oRPC dựng header.
jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({ getCookie: () => '' }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));

/** Mỗi lượt fetch là một promise do test tự resolve/reject — điều khiển thứ tự về. */
type Pending = { resolve: (res: Response) => void; reject: (err: Error) => void };
let pending: Pending[] = [];
// Gom client để dọn sau mỗi test — mutation cache giữ hẹn giờ gc 5 phút, để
// nguyên là jest không thoát được.
const clients: QueryClient[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

beforeEach(() => {
  pending = [];
  globalThis.fetch = jest.fn(
    () =>
      new Promise<Response>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
  ) as unknown as typeof fetch;
});

function ok() {
  return new Response(JSON.stringify({ wished: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  clients.push(queryClient);
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  const onFailed = jest.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidate, onFailed, wrapper };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('useWishlistSetMutation', () => {
  it('N1 — bấm A rồi B, A hỏng SAU khi B đã gọi: vẫn rollback đúng A', async () => {
    const { onFailed, wrapper } = setup();
    const { result } = await renderHook(() => useWishlistSetMutation(onFailed), { wrapper });

    await act(async () => {
      result.current.mutate({ tourId: 'A', wished: false });
      result.current.mutate({ tourId: 'B', wished: false });
    });
    await flush();
    expect(pending).toHaveLength(2);

    pending[0]?.reject(new Error('mạng hỏng'));
    pending[1]?.resolve(ok());
    await flush();

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith({ tourId: 'A', wished: false });
  });

  it('N1 — màn đã unmount trước khi lượt về: vẫn invalidate list + check', async () => {
    const { invalidate, onFailed, wrapper } = setup();
    const { result, unmount } = await renderHook(() => useWishlistSetMutation(onFailed), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ tourId: 'A', wished: true });
    });
    await flush();
    await unmount();

    pending[0]?.resolve(ok());
    await flush();

    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('N6 — hai lượt chồng nhau: chỉ lượt settle CUỐI mới invalidate', async () => {
    const { queryClient, invalidate, onFailed, wrapper } = setup();
    const { result } = await renderHook(() => useWishlistSetMutation(onFailed), { wrapper });

    await act(async () => {
      result.current.mutate({ tourId: 'A', wished: true });
      result.current.mutate({ tourId: 'A', wished: false });
    });
    await flush();
    expect(isWishlistMutating(queryClient)).toBe(true);

    pending[0]?.resolve(ok());
    await flush();
    expect(invalidate).not.toHaveBeenCalled();
    expect(isWishlistMutating(queryClient)).toBe(true);

    pending[1]?.resolve(ok());
    await flush();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(isWishlistMutating(queryClient)).toBe(false);
  });
});
