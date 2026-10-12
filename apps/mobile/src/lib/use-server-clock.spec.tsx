import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useServerClock } from './use-server-clock';

const SERVER_TIME = '2026-10-10T00:00:00.000Z';

jest.mock('@/lib/api/client', () => ({
  orpc: {
    health: {
      check: {
        queryOptions: (opts: object) => ({
          queryKey: ['health'],
          queryFn: async () => ({ timestamp: '2026-10-10T00:00:00.000Z' }),
          ...opts,
        }),
      },
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Hai màn dùng CHUNG một cache — đúng như app, nơi `health.check` chỉ gọi một lần mỗi phiên. */
function sharedWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.setSystemTime(new Date('2026-10-09T00:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useServerClock', () => {
  it('đồng hồ server chạy tiếp theo giờ máy, không đứng yên ở mốc timestamp đầu', async () => {
    const { result, rerender } = await renderHook(() => useServerClock(), { wrapper });
    await waitFor(() => expect(result.current.now.toISOString()).toBe(SERVER_TIME));

    await act(async () => {
      jest.setSystemTime(new Date('2026-10-09T00:01:00.000Z'));
    });
    await rerender({});

    // Đã qua 60s giờ máy → giờ server phải nhích đúng 60s.
    expect(result.current.now.toISOString()).toBe('2026-10-10T00:01:00.000Z');
  });

  it('màn mở SAU lần gọi đầu (đọc cache) vẫn đúng giờ server, không bắt đầu lại từ mốc cũ', async () => {
    const shared = sharedWrapper();
    const first = await renderHook(() => useServerClock(), { wrapper: shared });
    await waitFor(() => expect(first.result.current.now.toISOString()).toBe(SERVER_TIME));

    // Hai giờ sau mới mở màn thứ hai (vd mở tab Trips sáng, mở P5 sau đó).
    await act(async () => {
      jest.setSystemTime(new Date('2026-10-09T02:00:00.000Z'));
    });
    const second = await renderHook(() => useServerClock(), { wrapper: shared });

    expect(second.result.current.now.toISOString()).toBe('2026-10-10T02:00:00.000Z');
  });
});
