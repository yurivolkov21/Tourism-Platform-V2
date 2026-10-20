import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { PublicReview, TourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import TourDetailRoute from '@/app/tours/[slug]';
import { formatDepartureRange } from '@/features/tour-detail/departures';
import { orpc } from '@/lib/api/client';
import { renderWithTheme } from '@/test-utils';

// Khách chưa đăng nhập: `wishlist.check` tắt, không có lượt gọi nào ngoài review.
jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({
    useSession: () => ({ data: null }),
    getCookie: () => '',
  }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ slug: 'test-tour' }),
}));

type TourDeparture = TourDetail['departures'][number];

const SLUG = 'test-tour';
const clients: QueryClient[] = [];
const t = messages.mobile.tourDetail;
const bookCta = messages.mobile.booking.bookCta;

/** Trang review trả về cho mỗi lượt gọi, theo thứ tự; hết danh sách thì treo (đang tải). */
type ReviewReply = { status: number; body?: unknown } | 'pending';
let reviewReplies: Record<number, ReviewReply[]> = {};
let reviewPagesRequested: number[] = [];
let reviewSortsRequested: (string | null)[] = [];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  reviewReplies = {};
  reviewPagesRequested = [];
  reviewSortsRequested = [];
  globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!url.pathname.endsWith(`/api/tours/${SLUG}/reviews`)) {
      return Promise.reject(new Error(`unexpected call ${url.pathname}`));
    }
    const page = Number(url.searchParams.get('page') ?? '1');
    reviewPagesRequested.push(page);
    reviewSortsRequested.push(url.searchParams.get('sort'));
    const reply = reviewReplies[page]?.shift() ?? 'pending';
    if (reply === 'pending') return new Promise<Response>(() => {});
    return Promise.resolve(json(reply.status, reply.body ?? {}));
  }) as unknown as typeof fetch;
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

function makeDeparture(overrides: Partial<TourDeparture>): TourDeparture {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    startDate: '2099-03-10',
    endDate: '2099-03-13',
    seatsLeft: 6,
    effectivePrice: '100.00',
    compareAtPrice: null,
    bookingDeadline: '2099-03-03',
    bookable: true,
    ...overrides,
  };
}

function makeTour(overrides: Partial<TourDetail>): TourDetail {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    slug: SLUG,
    title: 'Test tour',
    summary: null,
    basePrice: '100.00',
    compareAtPrice: null,
    priceFrom: '100.00',
    currency: 'USD',
    durationDays: 4,
    difficulty: null,
    maxGroupSize: 10,
    isFeatured: false,
    destinations: [],
    category: { slug: 'culture', name: 'Culture' },
    ratingAvg: 4.5,
    ratingCount: 3,
    cover: null,
    badges: [],
    nextDeparture: null,
    suitableFor: [],
    included: [],
    excluded: [],
    highlights: [],
    meetingPoint: null,
    factDurationNote: null,
    factGroupSizeNote: null,
    factDifficultyNote: null,
    factGoodForNote: null,
    itinerary: [],
    faqs: [],
    policies: [],
    departures: [],
    media: [],
    ...overrides,
  };
}

function review(id: string, body: string): PublicReview {
  return {
    id,
    rating: 5,
    title: null,
    body,
    authorName: 'Lan N.',
    authorDeleted: false,
    createdAt: '2026-07-05T10:30:00.000Z',
    media: [],
  };
}

function reviewPage(page: number, totalPages: number, items: PublicReview[]) {
  return {
    status: 200,
    body: {
      items,
      page,
      limit: 20,
      total: totalPages * 20,
      totalPages,
      breakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 3 },
    },
  };
}

/** Dựng route với chi tiết tour có sẵn trong cache — không gọi mạng cho `catalog.tours.bySlug`. */
async function renderRoute(tour: TourDetail) {
  // `staleTime: Infinity`: tour trong cache không bị gọi lại khi mount (lượt gọi
  // lại hỏng sẽ đẩy query sang `error` dù còn dữ liệu).
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { gcTime: 0 } },
  });
  clients.push(client);
  client.setQueryData(
    orpc.catalog.tours.bySlug.queryOptions({ input: { slug: SLUG } }).queryKey,
    tour,
  );
  await renderWithTheme(
    <QueryClientProvider client={client}>
      <TourDetailRoute />
    </QueryClientProvider>,
  );
}

function rowName(departure: TourDeparture, priceLabel: string): string {
  return `${formatDepartureRange(departure.startDate, departure.endDate)} · ${priceLabel}`;
}

describe('TourDetailRoute — tab Dates', () => {
  const soldOut = makeDeparture({ seatsLeft: 0 });
  const open = makeDeparture({
    id: '00000000-0000-4000-8000-000000000002',
    startDate: '2099-04-10',
    endDate: '2099-04-13',
    bookingDeadline: '2099-04-03',
  });

  // `bookable` của API chỉ nói còn hạn đặt; đợt kín vẫn `bookable: true`. Web
  // khoá đợt ấy qua `isDepartureOpen` — app từng cho chọn rồi mở "Book now".
  it('đợt còn hạn đặt nhưng hết chỗ: không chọn được, đáy màn vẫn "Choose a date"', async () => {
    await renderRoute(makeTour({ departures: [soldOut, open] }));
    await fireEvent.press(screen.getByRole('tab', { name: t.datesTitle }));

    const soldOutRow = screen.getByRole('radio', { name: rowName(soldOut, '$100') });
    expect(soldOutRow.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(soldOutRow);
    expect(screen.queryByRole('button', { name: bookCta })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: rowName(open, '$100') }));
    expect(screen.getByRole('button', { name: bookCta })).toBeTruthy();
  });

  it('đợt hạ giá không có neo riêng: gạch giá gốc như web', async () => {
    const promo = makeDeparture({ effectivePrice: '80.00' });
    await renderRoute(makeTour({ priceFrom: '80.00', departures: [promo] }));
    await fireEvent.press(screen.getByRole('tab', { name: t.datesTitle }));

    expect(screen.getByText('$100')).toBeTruthy();
  });

  // Đợt khuyến mãi của seed (neo = giá gốc) bị admin nâng giá lên trên neo.
  it('neo không cao hơn giá trả: không gạch một số thấp hơn giá', async () => {
    const raised = makeDeparture({ effectivePrice: '120.00', compareAtPrice: '110.00' });
    await renderRoute(makeTour({ priceFrom: '120.00', departures: [raised] }));
    await fireEvent.press(screen.getByRole('tab', { name: t.datesTitle }));

    expect(screen.getByRole('radio', { name: rowName(raised, '$120') })).toBeTruthy();
    expect(screen.queryByText('$110')).toBeNull();
  });
});

describe('TourDetailRoute — tab Reviews', () => {
  const emptyTitle = messages.tourDetail.reviewsTab.emptyTitle;

  it('review đang tải: không nói "chưa có review" trong khi tour có 3 review', async () => {
    await renderRoute(makeTour({}));
    await fireEvent.press(screen.getByRole('tab', { name: t.reviewsTitle }));

    expect(screen.queryByText(emptyTitle)).toBeNull();
    expect(screen.getByText(t.loadingReviews)).toBeTruthy();
  });

  it('tải review hỏng: báo lỗi, không nói "chưa có review"', async () => {
    reviewReplies = { 1: [{ status: 500 }] };
    await renderRoute(makeTour({}));
    await fireEvent.press(screen.getByRole('tab', { name: t.reviewsTitle }));

    expect(await screen.findByText(t.reviewsError)).toBeTruthy();
    expect(screen.queryByText(emptyTitle)).toBeNull();
  });

  // Trước đây route tự cộng `page` mỗi lần bấm: trang 2 hỏng rồi bấm lại là
  // nhảy sang trang 3, trang 2 không bao giờ hiện.
  it('trang kế hỏng rồi bấm "Load more" lần nữa: tải lại đúng trang đó, không nhảy trang', async () => {
    reviewReplies = {
      1: [reviewPage(1, 3, [review('00000000-0000-4000-8000-0000000000b1', 'Page one review')])],
      2: [
        { status: 500 },
        reviewPage(2, 3, [review('00000000-0000-4000-8000-0000000000c2', 'Page two review')]),
      ],
      3: [reviewPage(3, 3, [review('00000000-0000-4000-8000-0000000000c3', 'Page three review')])],
    };
    await renderRoute(makeTour({}));
    await fireEvent.press(screen.getByRole('tab', { name: t.reviewsTitle }));
    await screen.findByText('Page one review');

    await fireEvent.press(screen.getByRole('button', { name: t.loadMoreReviews }));
    await waitFor(() => expect(reviewPagesRequested).toEqual([1, 2]));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: t.loadMoreReviews }).props.accessibilityState,
      ).toMatchObject({
        disabled: false,
      }),
    );

    await fireEvent.press(screen.getByRole('button', { name: t.loadMoreReviews }));
    expect(await screen.findByText('Page two review')).toBeTruthy();
    expect(reviewPagesRequested).toEqual([1, 2, 2]);
    expect(screen.queryByText('Page three review')).toBeNull();
  });

  // F10: bấm lại đúng chip đang chọn từng xoá sạch danh sách tới khi rời màn.
  it('bấm lại chip sắp xếp đang chọn: giữ nguyên review đã tải', async () => {
    reviewReplies = {
      1: [reviewPage(1, 1, [review('00000000-0000-4000-8000-0000000000b1', 'Newest review')])],
    };
    await renderRoute(makeTour({}));
    await fireEvent.press(screen.getByRole('tab', { name: t.reviewsTitle }));
    await screen.findByText('Newest review');

    await fireEvent.press(screen.getByRole('button', { name: t.sortNewest }));
    expect(screen.getByText('Newest review')).toBeTruthy();
    expect(reviewPagesRequested).toEqual([1]);
  });

  it('đổi sắp xếp: tải lại từ trang 1 theo thứ tự mới, không nối vào danh sách cũ', async () => {
    reviewReplies = {
      1: [
        reviewPage(1, 1, [review('00000000-0000-4000-8000-0000000000b1', 'Newest review')]),
        reviewPage(1, 1, [review('00000000-0000-4000-8000-0000000000d1', 'Highest review')]),
      ],
    };
    await renderRoute(makeTour({}));
    await fireEvent.press(screen.getByRole('tab', { name: t.reviewsTitle }));
    await screen.findByText('Newest review');

    await fireEvent.press(screen.getByRole('button', { name: t.sortHighest }));
    expect(await screen.findByText('Highest review')).toBeTruthy();
    expect(screen.queryByText('Newest review')).toBeNull();
    expect(reviewSortsRequested).toEqual(['newest', 'highest']);
    expect(reviewPagesRequested).toEqual([1, 1]);
  });
});
