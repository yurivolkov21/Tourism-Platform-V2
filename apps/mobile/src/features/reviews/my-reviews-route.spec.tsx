import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Booking, BookingDetail, MyReview } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ThemeProvider } from '@tourism/mobile-ui';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReviewsLayout from '@/app/reviews/_layout';
import MyReviewsRoute from '@/app/reviews/mine';
import TripLayout from '@/app/trips/[code]/_layout';
import ReviewRoute from '@/app/trips/[code]/review';
import { orpc } from '@/lib/api/client';
import { AWAITING_REVIEW_BOOKINGS_INPUT, MY_REVIEWS_INPUT } from './my-reviews';

/**
 * R4 nối với hai việc của 15/10: khối "chờ viết bài" đầu màn mở R1 rồi đưa khách về lại đúng R4
 * (card "Thêm khối"), và rút bài xong thì trình đọc màn hình đọc kết quả (card "Màn kết quả",
 * open-items P5b-5 mục 1 và 2).
 */

// Khách đã đăng nhập; cookie rỗng đủ cho link oRPC dựng header.
jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({
    useSession: () => ({ data: { user: { id: 'u1' } } }),
    getCookie: () => '',
  }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));

const mine = messages.reviews.mine;
const retractCopy = messages.reviews.retract;
const OPEN_CODE = 'BK-OPEN0001';
const REVIEWED_CODE = 'BK-DONE0001';
const OPEN_TOUR = 'Ha Long Bay Overnight Cruise';
const REVIEW_ID = '7d4f1c2a-5b6e-4f80-9a1b-2c3d4e5f6a7b';
const clients: QueryClient[] = [];

// Số đo máy tầm trung có tai thỏ, cùng số với `test-utils`: `SafeAreaView` cần metrics thật.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Đơn PAID trên chuyến đã về (tháng 1) — đủ để cổng viết bài mở. */
function makeBooking(code: string, tourTitle: string): BookingDetail {
  return {
    id: `id-${code}`,
    code,
    status: 'PAID',
    tourTitle,
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
    departureCancelReason: null,
  };
}

/** Một dòng của `bookings.mine` — khuôn danh sách không mang bài viết. */
function listItem(code: string, tourTitle: string): Booking {
  const {
    review: _review,
    cancellation: _cancel,
    departureCancelReason: _reason,
    ...item
  } = makeBooking(code, tourTitle);
  return item;
}

function makeReview(over: Partial<MyReview>): MyReview {
  return {
    id: REVIEW_ID,
    rating: 5,
    title: 'Worth every minute',
    body: 'The guide knew every cove on the bay.',
    authorName: 'A',
    authorDeleted: false,
    createdAt: '2026-01-12T00:00:00.000Z',
    media: [],
    isApproved: true,
    moderationState: 'approved',
    moderationNote: null,
    rejectionCount: 0,
    tourSlug: 'test-tour',
    tourTitle: 'Sa Pa Terraces Trek',
    bookingCode: REVIEWED_CODE,
    tourImage: null,
    retractedAt: null,
    ...over,
  };
}

function page<T>(items: T[]) {
  return { items, page: 1, limit: 100, total: items.length, totalPages: 1 };
}

/** Khuôn trả của `bookings.mine` — thêm facets, tổng và ngày lịch của lượt đọc. */
function bookingsPage(items: Booking[]) {
  return {
    ...page(items),
    facets: {
      when: { ON_TOUR: 0, UPCOMING: 0, PAST: items.length },
      status: { PENDING: 0, PAID: items.length, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
    },
    overallTotal: items.length,
    today: '2026-10-15',
  };
}

interface ApiState {
  reviews: MyReview[];
  bookings: Booking[];
}

/** API giả theo path: lệnh nào ngoài kịch bản cũng hỏng ngay thay vì treo. */
function stubApi(state: ApiState, onWrite: (path: string) => unknown) {
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = input instanceof Request ? input.method : (init?.method ?? 'GET');
    if (method !== 'GET') return Response.json(onWrite(url.pathname));
    if (url.pathname === '/api/reviews/mine') return Response.json(page(state.reviews));
    if (url.pathname === '/api/bookings/mine') return Response.json(bookingsPage(state.bookings));
    if (url.pathname === `/api/bookings/${OPEN_CODE}`) {
      return Response.json(makeBooking(OPEN_CODE, OPEN_TOUR));
    }
    throw new Error(`offline: ${method} ${url.pathname}`);
  }) as unknown as typeof fetch;
}

let announceSpy: jest.SpyInstance | undefined;

// Chỉ gỡ đúng spy của file này: `restoreAllMocks` gỡ luôn bản giả mà `expo-router/testing-library`
// cài cho cây route, và từ test thứ hai `renderRouter` không dựng được cây mới nữa.
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  announceSpy?.mockRestore();
  announceSpy = undefined;
});

/** Mở Home rồi đẩy R4 lên trên — dữ liệu hai danh sách đã nằm sẵn trong cache. */
async function openMyReviews(state: ApiState) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(
    orpc.reviews.mine.queryOptions({ input: MY_REVIEWS_INPUT }).queryKey,
    page(state.reviews),
  );
  client.setQueryData(
    orpc.bookings.mine.queryOptions({ input: AWAITING_REVIEW_BOOKINGS_INPUT }).queryKey,
    bookingsPage(state.bookings),
  );
  client.setQueryData(
    orpc.bookings.byCode.queryOptions({ input: { code: OPEN_CODE } }).queryKey,
    makeBooking(OPEN_CODE, OPEN_TOUR),
  );

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <ThemeProvider scheme="light">{children}</ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    );
  }

  const app = renderRouter(
    {
      _layout: () => <Stack />,
      index: () => <Text>Home</Text>,
      'reviews/_layout': ReviewsLayout,
      'reviews/mine': MyReviewsRoute,
      'trips/[code]/_layout': TripLayout,
      'trips/[code]/review': ReviewRoute,
    },
    { initialUrl: '/', wrapper: Providers },
  );
  await app;
  await act(() => router.push('/reviews/mine'));
  return { pathname: () => app.getPathname() };
}

describe('R4 — khối chuyến chờ viết bài', () => {
  it('chỉ mời chuyến chưa có bài; viết xong, nút ở màn đã gửi đưa về lại R4 và chuyến rời khối', async () => {
    const state: ApiState = {
      reviews: [makeReview({})],
      bookings: [listItem(OPEN_CODE, OPEN_TOUR), listItem(REVIEWED_CODE, 'Sa Pa Terraces Trek')],
    };
    stubApi(state, (path) => {
      // Server nhận bài mới; lượt tải lại `reviews.mine` sau khi gửi thấy bài ấy đang chờ duyệt.
      expect(path).toBe('/api/reviews');
      const created = makeReview({
        id: '0b5e8c1d-2f3a-4b6c-8d9e-0f1a2b3c4d5e',
        bookingCode: OPEN_CODE,
        tourTitle: OPEN_TOUR,
        isApproved: false,
        moderationState: 'pending',
      });
      state.reviews = [created, ...state.reviews];
      return created;
    });
    const app = await openMyReviews(state);

    expect(screen.getByText(mine.awaitingHeading)).toBeTruthy();
    // Đơn đã có bài (Sa Pa) không bị mời lần hai.
    expect(
      screen.queryByRole('button', { name: mine.writeReviewFor('Sa Pa Terraces Trek') }),
    ).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: mine.writeReviewFor(OPEN_TOUR) }));
    expect(app.pathname()).toBe(`/trips/${OPEN_CODE}/review`);

    await fireEvent.press(screen.getByLabelText(messages.reviews.ratingValueLabel(5)));
    await fireEvent.changeText(
      screen.getByPlaceholderText(messages.reviews.bodyPlaceholder),
      'Calm water, kind crew and a sunrise we will not forget.',
    );
    await fireEvent.press(screen.getByText(messages.reviews.submit));
    await screen.findByText(messages.reviews.successTitle);

    // Mở từ R4 thì lùi là về R4: nút nói đúng nơi sẽ về, và không có link đẩy thêm một R4 nữa.
    expect(screen.queryByText(messages.reviews.backToTrip)).toBeNull();
    expect(screen.queryByText(messages.reviews.seeMyReviews)).toBeNull();
    await fireEvent.press(screen.getByText(messages.reviews.backToReviews));

    expect(app.pathname()).toBe('/reviews/mine');
    await waitFor(() => expect(screen.queryByText(mine.awaitingHeading)).toBeNull());
  });
});

describe('R7 — rút bài', () => {
  it('rút xong thì trình đọc màn hình đọc kết quả, xếp sau câu nó đang đọc', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => {});
    announceSpy = announce;
    const state: ApiState = { reviews: [makeReview({})], bookings: [] };
    stubApi(state, (path) => {
      expect(path).toBe(`/api/reviews/${REVIEW_ID}/retract`);
      const retracted = makeReview({
        isApproved: false,
        moderationState: 'retracted',
        retractedAt: '2026-10-15T01:00:00.000Z',
      });
      state.reviews = [retracted];
      return retracted;
    });
    await openMyReviews(state);

    await fireEvent.press(screen.getByRole('button', { name: mine.retractAction }));
    const sheetButtons = screen.getAllByRole('button', { name: retractCopy.button });
    const confirm = sheetButtons.at(-1);
    if (confirm === undefined) throw new Error('Tấm rút bài không mở');
    await fireEvent.press(confirm);

    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        `${retractCopy.toast.done.title}. ${retractCopy.toast.done.body}`,
        { queue: true },
      ),
    );
    // Người nhìn thấy kết quả ngay trên thẻ: pill đổi sang "Retracted".
    expect(await screen.findByText(mine.retractedLabel)).toBeTruthy();
  });
});
