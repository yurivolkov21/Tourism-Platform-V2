import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { BookingDetail, TourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
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
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    back: jest.fn(),
  },
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

/**
 * P6 "Where to next?": tracker là màn của stack gốc, `navigate('/explore')` từ đây đẩy thêm một bộ
 * tab mới chồng lên — từ Explore bấm back về Home rồi back nữa lại ra đúng P6 vừa rời (review M1,
 * đo bằng router thật). `dismissTo` lùi về bộ tab đang có rồi mở Explore, cùng khuôn B8.
 */
describe('TripTrackerRoute — Where to next? ở P6 lùi về bộ tab đang có', () => {
  beforeEach(() => {
    jest.mocked(router.dismissTo).mockClear();
    jest.mocked(router.navigate).mockClear();
  });

  it('chuyến đã về: dòng Where to next? mở Explore bằng dismissTo', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('offline')),
    ) as unknown as typeof fetch;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    clients.push(client);
    client.setQueryData(orpc.bookings.byCode.queryOptions({ input: { code: CODE } }).queryKey, {
      code: CODE,
      status: 'PAID',
      tourTitle: 'Test tour',
      tourSlug: 'test-tour',
      tourDestinations: [],
      departureStartDate: '2026-01-08',
      departureEndDate: '2026-01-10',
      departureCancelled: false,
      totalAmount: '35.00',
      currency: 'USD',
      numAdults: 1,
      numChildren: 0,
      reviewedAt: null,
    } as Partial<BookingDetail> as BookingDetail);
    client.setQueryData(
      orpc.catalog.tours.bySlug.queryOptions({ input: { slug: 'test-tour' } }).queryKey,
      { durationDays: 3, policies: [] } as Partial<TourDetail> as TourDetail,
    );
    await renderWithTheme(
      <QueryClientProvider client={client}>
        <TripTrackerRoute />
      </QueryClientProvider>,
    );

    await fireEvent.press(screen.getByText(messages.mobile.trip.whereToNext));
    expect(router.dismissTo).toHaveBeenCalledWith('/explore');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
