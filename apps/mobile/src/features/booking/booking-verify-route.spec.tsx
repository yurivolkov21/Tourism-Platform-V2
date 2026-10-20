import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import type { BookingDetail, BookingsListResult } from '@tourism/contract';
import { router } from 'expo-router';
import BookingVerifyRoute from '@/app/bookings/new/verify';
import { orpc } from '@/lib/api/client';
import { renderWithTheme } from '@/test-utils';
import { VERIFY_BACKOFF_MS } from './booking-form';

const CODE = 'BK-TEST0001';

jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({
    useSession: () => ({ data: { user: { id: 'u1' } } }),
    getCookie: () => '',
  }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
// Draft giữ mã booking vừa tạo ở B4 — chỉ phần B6 đọc tới.
jest.mock('./booking-draft', () => ({
  getBookingDraft: () => ({ bookingCode: 'BK-TEST0001', checkoutUrl: 'https://pay.example/s' }),
  completeBookingDraft: jest.fn(),
  clearBookingDraft: jest.fn(),
}));

const clients: QueryClient[] = [];
const MINE_KEY = orpc.bookings.mine.queryOptions({ input: { page: 1, limit: 50 } }).queryKey;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.mocked(router.replace).mockClear();
  globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  for (const client of clients.splice(0)) client.clear();
});

/**
 * Dựng B6 với `bookings.byCode` có sẵn trong cache (staleTime vô hạn nên `fetchQuery`
 * không ra mạng) và một danh sách Trips đang mở với đơn còn PENDING.
 */
async function renderVerify(status: BookingDetail['status']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(orpc.bookings.byCode.queryOptions({ input: { code: CODE } }).queryKey, {
    code: CODE,
    status,
    totalAmount: '35.00',
  } as BookingDetail);
  client.setQueryData(MINE_KEY, {
    items: [{ code: CODE, status: 'PENDING' }],
  } as unknown as BookingsListResult);
  await renderWithTheme(
    <QueryClientProvider client={client}>
      <BookingVerifyRoute />
    </QueryClientProvider>,
  );
  await act(async () => {
    jest.advanceTimersByTime(VERIFY_BACKOFF_MS[0] ?? 0);
  });
  return client;
}

describe('BookingVerifyRoute — tab Trips không giữ trạng thái cũ', () => {
  it('đã trả tiền: đánh dấu danh sách đơn cũ để tab Trips đọc lại', async () => {
    const client = await renderVerify('PAID');

    expect(router.replace).toHaveBeenCalledWith('/bookings/new/success');
    expect(client.getQueryState(MINE_KEY)?.isInvalidated).toBe(true);
  });

  it('đơn đã huỷ: cũng đánh dấu danh sách đơn cũ', async () => {
    const client = await renderVerify('CANCELLED');

    expect(router.replace).not.toHaveBeenCalled();
    expect(client.getQueryState(MINE_KEY)?.isInvalidated).toBe(true);
  });
});
