import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useServerClock } from './use-server-clock';

const SERVER_TIME = '2026-10-10T00:00:00.000Z';
// Giờ server mà `health.check` giả trả về — tiền tố `mock` để factory của jest.mock đọc được.
let mockServerTimestamp = SERVER_TIME;

jest.mock('@/lib/api/client', () => ({
  orpc: {
    health: {
      check: {
        queryOptions: (opts: object) => ({
          queryKey: ['health'],
          queryFn: async () => ({ timestamp: mockServerTimestamp }),
          ...opts,
        }),
        key: () => ['health'],
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

let appStateListeners: Array<(state: AppStateStatus) => void> = [];
let appStateSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.setSystemTime(new Date('2026-10-09T00:00:00.000Z'));
  mockServerTimestamp = SERVER_TIME;
  appStateListeners = [];
  appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return {
      remove: () => {
        appStateListeners = appStateListeners.filter((l) => l !== listener);
      },
    } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  appStateSpy.mockRestore();
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

  it('khách chỉnh đồng hồ máy rồi quay lại app: đo lại lệch, giờ server không trôi theo máy', async () => {
    const { result, rerender } = await renderHook(() => useServerClock(), { wrapper });
    await waitFor(() => expect(result.current.now.toISOString()).toBe(SERVER_TIME));

    // Vào Settings vặn đồng hồ máy tới 3 ngày (server thật chưa nhích), rồi quay lại app.
    await act(async () => {
      jest.setSystemTime(new Date('2026-10-12T00:00:00.000Z'));
    });
    await act(async () => {
      for (const listener of appStateListeners) listener('active');
    });
    await rerender({});

    await waitFor(() => expect(result.current.now.toISOString()).toBe(SERVER_TIME));
    expect(result.current.today).toBe('2026-10-10');
  });
});
