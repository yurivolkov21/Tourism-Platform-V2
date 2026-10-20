import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import type { TourDetail } from '@tourism/contract';
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
