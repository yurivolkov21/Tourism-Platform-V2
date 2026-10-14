import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BookingDetail, MyReview } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ThemeProvider } from '@tourism/mobile-ui';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReviewsLayout from '@/app/reviews/_layout';
import RewriteReviewRoute from '@/app/reviews/rewrite';
import TripLayout from '@/app/trips/[code]/_layout';
import ReviewRoute from '@/app/trips/[code]/review';
import { orpc } from '@/lib/api/client';
import { MY_REVIEWS_INPUT } from './my-reviews';

/**
 * R1, R5 nối đúng tấm hỏi lại (open-items P5b-5 mục 4): bài còn dở thì lệnh back bị chặn, bài
 * chưa đổi gì thì rời ngay. Cơ chế chặn và back cứng Android có spec riêng ở
 * `discard-draft-guard.spec.tsx`; ở đây chỉ kiểm hai route tính "còn dở" đúng.
 */

// Khách đã đăng nhập; cookie rỗng đủ cho link oRPC dựng header.
jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({
    useSession: () => ({ data: { user: { id: 'u1' } } }),
    getCookie: () => '',
  }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));

const CODE = 'BK-TEST0001';
const REVIEW_ID = '7d4f1c2a-5b6e-4f80-9a1b-2c3d4e5f6a7b';
const unsentDraft = messages.reviews.unsentDraft;
const clients: QueryClient[] = [];

// Số đo máy tầm trung có tai thỏ, cùng số với `test-utils`: `SafeAreaView` cần metrics thật.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

beforeEach(() => {
  // Dữ liệu đã nằm sẵn trong cache; lệnh mạng nào lọt ra cũng hỏng ngay thay vì treo.
  globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

/** Đơn PAID trên chuyến đã về — đủ để R1 hiện form. */
function makeBooking(): BookingDetail {
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
    departureCancelReason: null,
  };
}

/** Bài bị bác một lần, có một ảnh — R5 điền sẵn đúng những thứ này. */
function makeRejectedReview(): MyReview {
  return {
    id: REVIEW_ID,
    rating: 3,
    title: 'Rainy but lovely',
    body: 'The guide kept us dry and cheerful all day.',
    authorName: 'A',
    authorDeleted: false,
    createdAt: '2026-01-12T00:00:00.000Z',
    media: [
      {
        publicId: 'reviews/b1/rain',
        url: 'https://res.cloudinary.com/demo/image/upload/reviews/b1/rain.jpg',
        type: 'IMAGE',
        role: 'gallery',
        posterUrl: null,
        width: null,
        height: null,
        alt: null,
        sortOrder: 0,
        author: null,
        license: null,
        licenseUrl: null,
        sourceUrl: null,
      },
    ],
    isApproved: false,
    moderationState: 'rejected',
    moderationNote: 'Please leave out the guide’s phone number.',
    rejectionCount: 1,
    tourSlug: 'test-tour',
    tourTitle: 'Test tour',
    bookingCode: CODE,
    tourImage: null,
    retractedAt: null,
  };
}

/** Mở Home rồi đẩy route cần thử lên trên — có chỗ để back về. */
async function openOnTopOfHome(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(
    orpc.bookings.byCode.queryOptions({ input: { code: CODE } }).queryKey,
    makeBooking(),
  );
  client.setQueryData(orpc.reviews.mine.queryOptions({ input: MY_REVIEWS_INPUT }).queryKey, {
    items: [makeRejectedReview()],
    page: 1,
    limit: MY_REVIEWS_INPUT.pageSize,
    total: 1,
    totalPages: 1,
  });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SafeAreaProvider initialMetrics={METRICS}>
          <ThemeProvider scheme="light">{children}</ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    );
  }

  // Hai layout thật: R1 và R5 nằm trong stack lồng như ở app, nên lệnh back gỡ cả stack con khỏi
  // stack gốc — đường `beforeRemove` phải đi xuyên qua tầng lồng ấy.
  const app = renderRouter(
    {
      _layout: () => <Stack />,
      index: () => <Text>Home</Text>,
      'trips/[code]/_layout': TripLayout,
      'trips/[code]/review': ReviewRoute,
      'reviews/_layout': ReviewsLayout,
      'reviews/rewrite': RewriteReviewRoute,
    },
    { initialUrl: '/', wrapper: Providers },
  );
  await app;
  await act(() => router.push(path));
  return { pathname: () => app.getPathname() };
}

describe('R1 — viết bài mới', () => {
  const path = `/trips/${CODE}/review`;

  it('chưa điền gì thì back rời ngay', async () => {
    const app = await openOnTopOfHome(path);
    expect(app.pathname()).toBe(path);

    await act(() => router.back());

    expect(app.pathname()).toBe('/');
  });

  it('đã gõ bài thì back không rời mà hỏi lại', async () => {
    const app = await openOnTopOfHome(path);

    await fireEvent.changeText(
      screen.getByPlaceholderText(messages.reviews.bodyPlaceholder),
      'Lovely',
    );
    await act(() => router.back());

    expect(app.pathname()).toBe(path);
    expect(screen.getByText(unsentDraft.title)).toBeTruthy();
  });

  it('chỉ chọn sao thôi cũng là có thứ để mất', async () => {
    const app = await openOnTopOfHome(path);

    await fireEvent.press(screen.getByLabelText(messages.reviews.ratingValueLabel(4)));
    await act(() => router.back());

    expect(app.pathname()).toBe(path);
    expect(screen.getByText(unsentDraft.title)).toBeTruthy();
  });
});

describe('R5 — viết lại bài bị bác', () => {
  const path = '/reviews/rewrite';
  const url = `${path}?id=${REVIEW_ID}`;

  it('mở ra rồi rời ngay thì không hỏi: bài cũ điền sẵn, chưa đổi gì', async () => {
    const app = await openOnTopOfHome(url);
    expect(app.pathname()).toBe(path);
    expect(screen.getByDisplayValue(makeRejectedReview().body)).toBeTruthy();

    await act(() => router.back());

    expect(app.pathname()).toBe('/');
  });

  it('sửa bài thì back không rời mà hỏi lại', async () => {
    const app = await openOnTopOfHome(url);

    await fireEvent.changeText(
      screen.getByDisplayValue(makeRejectedReview().body),
      'The guide kept us dry all day.',
    );
    await act(() => router.back());

    expect(app.pathname()).toBe(path);
    expect(screen.getByText(unsentDraft.title)).toBeTruthy();
  });

  it('gửi lại xong (màn đã gửi) thì back rời luôn: không hỏi về một bài đã gửi', async () => {
    const app = await openOnTopOfHome(url);
    const rewritten = 'The guide kept us dry all day.';
    // Server nhận bài sửa (PATCH) rồi trả lại nó, đã về hàng chờ duyệt; lượt tải lại `reviews.mine`
    // sau khi gửi nhận danh sách có đúng bài ấy.
    const resubmitted = { ...makeRejectedReview(), body: rewritten, moderationState: 'pending' };
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = input instanceof Request ? input.method : (init?.method ?? 'GET');
      return method === 'PATCH'
        ? Response.json(resubmitted)
        : Response.json({ items: [resubmitted], page: 1, limit: 100, total: 1, totalPages: 1 });
    }) as unknown as typeof fetch;

    await fireEvent.changeText(screen.getByDisplayValue(makeRejectedReview().body), rewritten);
    await fireEvent.press(screen.getByText(messages.reviews.resubmit));
    await screen.findByText(messages.reviews.successTitle);
    await act(() => router.back());

    expect(app.pathname()).toBe('/');
    expect(screen.queryByText(unsentDraft.title)).toBeNull();
  });
});
