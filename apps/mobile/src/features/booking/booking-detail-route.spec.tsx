import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import BookingDetailRoute from '@/app/bookings/[code]';
import { orpc } from '@/lib/api/client';
import { renderWithTheme } from '@/test-utils';

// Khách đã đăng nhập; cookie rỗng đủ cho link oRPC dựng header.
jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({
    useSession: () => ({ data: { user: { id: 'u1' } } }),
    getCookie: () => '',
  }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ code: 'BK-TEST0001' }),
}));

const CODE = 'BK-TEST0001';
const clients: QueryClient[] = [];

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  // `health.check` của đồng hồ server hỏng thì màn dùng giờ máy — đủ cho các ngày rất xa dưới đây.
  globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

/** Đơn PAID trên chuyến đã về từ tháng 1 — đè `overrides` cho từng ca. */
function makeBooking(overrides: Partial<BookingDetail>): BookingDetail {
  return {
    id: 'b1',
    code: CODE,
    status: 'PAID',
    tourTitle: 'Test tour',
    tourSlug: 'test-tour',
    tourImage: null,
    tourDestinations: [],
    departureStartDate: '2026-01-08',
    departureEndDate: '2026-01-10',
    cancellationDeadline: '2026-01-07',
    departureCancelled: false,
    unitPrice: '35.00',
    totalAmount: '35.00',
    currency: 'USD',
    numAdults: 1,
    numChildren: 0,
    contactName: 'A',
    contactEmail: 'a@example.com',
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-01-01T00:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    cancellationStatus: null,
    cancellationRequestedAt: null,
    cancellationDecidedAt: null,
    refundedTotal: '0.00',
    reviewedAt: null,
    review: null,
    cancellation: null,
    // ADR-0041 AMEND 2: chuyến còn chạy thì không có lý do huỷ nào để in.
    departureCancelReason: null,
    ...overrides,
  };
}

/** Dựng route với chi tiết đơn có sẵn trong cache — không gọi mạng cho `bookings.byCode`. */
async function renderRoute(booking: BookingDetail) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(
    orpc.bookings.byCode.queryOptions({ input: { code: CODE } }).queryKey,
    booking,
  );
  await renderWithTheme(
    <QueryClientProvider client={client}>
      <BookingDetailRoute />
    </QueryClientProvider>,
  );
}

const writeReview = messages.mobile.trip.writeReview;

describe('BookingDetailRoute — lời mời viết đánh giá (nợ nhỏ P5b-5 mục 1)', () => {
  it('chuyến đã về, chưa có bài: hoá đơn có nút Write a review mở R1', async () => {
    await renderRoute(makeBooking({}));

    await fireEvent.press(screen.getByRole('button', { name: writeReview }));
    expect(router.push).toHaveBeenCalledWith(`/trips/${CODE}/review`);
  });

  it('đơn đã có bài thì không mời viết lần hai', async () => {
    const review = { moderationState: 'pending' } as BookingDetail['review'];
    await renderRoute(makeBooking({ review }));

    expect(screen.queryByRole('button', { name: writeReview })).toBeNull();
  });

  it('chuyến chưa về thì chưa mời', async () => {
    await renderRoute(
      makeBooking({ departureStartDate: '2099-01-08', departureEndDate: '2099-01-10' }),
    );

    expect(screen.queryByRole('button', { name: writeReview })).toBeNull();
  });
});
