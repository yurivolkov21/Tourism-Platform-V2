import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import type { BookingDetail } from '@tourism/contract';
import { router } from 'expo-router';
import TripTrackerRoute from '@/app/trips/[code]/index';
import { orpc } from '@/lib/api/client';
import { renderWithTheme } from '@/test-utils';

const CODE = 'BK-TEST0001';

jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({
    useSession: () => ({ data: { user: { id: 'u1' } } }),
    getCookie: () => '',
  }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ code: 'BK-TEST0001' }),
}));

const clients: QueryClient[] = [];

beforeEach(() => {
  jest.mocked(router.replace).mockClear();
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

/** API trả lỗi đã khai trong contract cho trang tour; mọi lời gọi khác coi như mất mạng. */
function mockTourResponse(status: number, body: object) {
  globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('/api/tours/test-tour')) {
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.reject(new Error('offline'));
  }) as unknown as typeof fetch;
}

/** Đơn PAID của chuyến còn xa — thuộc nhóm "còn đi theo ngày" nên vào được tracker. */
async function renderTracker() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(orpc.bookings.byCode.queryOptions({ input: { code: CODE } }).queryKey, {
    code: CODE,
    status: 'PAID',
    tourSlug: 'test-tour',
    departureStartDate: '2099-01-08',
    departureEndDate: '2099-01-10',
    departureCancelled: false,
  } as BookingDetail);
  await renderWithTheme(
    <QueryClientProvider client={client}>
      <TripTrackerRoute />
    </QueryClientProvider>,
  );
}

describe('TripTrackerRoute — tour đã gỡ khỏi web', () => {
  it('trang tour trả NOT_FOUND: đưa về hoá đơn thay vì kẹt ở màn lỗi', async () => {
    mockTourResponse(404, {
      defined: true,
      code: 'NOT_FOUND',
      status: 404,
      message: 'Tour not found',
    });
    await renderTracker();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/bookings/${CODE}`));
  });

  it('lỗi khác (mạng, 500) không đưa khách đi đâu', async () => {
    mockTourResponse(500, {
      defined: false,
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      message: 'Internal server error',
    });
    await renderTracker();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
