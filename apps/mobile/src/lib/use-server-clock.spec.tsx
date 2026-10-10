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
});
