import {
  CreateEnquiryInputSchema,
  type Paged,
  type TourCard,
  type TourDetail,
  TourSlugSchema,
  type ToursListQuery,
  ToursListQuerySchema,
  windowDaysForTripLength,
} from '@tourism/contract';
import { type Tool, type ToolExecuteFunction, tool } from 'ai';
import { z } from 'zod';
import type { BookingsService } from '../bookings/bookings.service.js';
import type { CatalogService } from '../catalog/catalog.service.js';
import type { EnquiriesService } from '../enquiries/enquiries.service.js';
import {
  type GetMyBookingInput,
  GetMyBookingInputSchema,
  type ListMyBookingsInput,
  ListMyBookingsInputSchema,
  type MyBookingResult,
  type MyBookingsResult,
  normalizeBookingCode,
  toMyBookingDetails,
  toMyBookingsQuery,
  toMyBookingsResult,
} from './chat-bookings.js';

/**
 * Các tool của trợ lý (spec §2c). Tool gọi thẳng service, không qua HTTP; kết quả thu
 * gọn để một lượt nhiều bước không phình token. Hàm thu gọn là thuần, test riêng.
 * Ba tool cho mọi khách; hai tool đọc đơn chỉ có khi lượt có phiên (ADR-0050 AMEND 2).
 */

const SEARCH_LIMIT = 8;
const MAX_DEPARTURES = 6;
const MAX_FAQS = 6;
const ITINERARY_DESCRIPTION_MAX = 200;
const FAQ_ANSWER_MAX = 300;
/**
 * Spec không đặt trần cho điều khoản; 600 là lưới an toàn vì admin gõ được tới 4000
 * ký tự mỗi điều, còn điều khoản thật trong seed chỉ khoảng 250.
 */
const POLICY_BODY_MAX = 600;

/** Cắt chuỗi về tối đa `max` ký tự, đánh dấu chỗ cắt để model biết còn nữa. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

const tourUrl = (slug: string) => `/tours/${slug}`;

// ── searchTours ─────────────────────────────────────────────────────────────

const SearchToursInputSchema = z.object({
  destination: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe('Destination slug from the list in your instructions.'),
  category: z
    .string()
    .min(1)
    .max(60)
    .optional()
    .describe('Category slug from the list in your instructions.'),
  search: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'One distinctive word, matched as plain text inside tour titles and summaries (for example Vespa). Use destination for places.',
    ),
  sort: z
    .enum(['price-asc', 'price-desc', 'newest', 'top-rated'])
    .optional()
    .describe('Default newest. top-rated puts tours without reviews last.'),
});

export type SearchToursInput = z.infer<typeof SearchToursInputSchema>;

const SORTS = {
  'price-asc': { sort: 'basePrice', order: 'asc' },
  'price-desc': { sort: 'basePrice', order: 'desc' },
  newest: { sort: 'createdAt', order: 'desc' },
  // ADR-0058 §4: tour chưa có đánh giá luôn đứng cuối, hoà điểm thì nhiều đánh giá trước.
  'top-rated': { sort: 'rating', order: 'desc' },
} as const;

/**
 * Input của model → truy vấn `/tours`. Đi qua `ToursListQuerySchema.parse` để field
 * mặc định nào thêm vào truy vấn về sau cũng tự có giá trị.
 */
export function toSearchQuery(input: SearchToursInput): ToursListQuery {
  return ToursListQuerySchema.parse({
    page: 1,
    limit: SEARCH_LIMIT,
    destination: input.destination,
    category: input.category,
    search: input.search,
    ...SORTS[input.sort ?? 'newest'],
  });
}

export function toSearchResult(paged: Paged<TourCard>) {
  return {
    total: paged.total,
    tours: paged.items.map((tour) => ({
      slug: tour.slug,
      title: tour.title,
      url: tourUrl(tour.slug),
      priceFrom: tour.priceFrom,
      currency: tour.currency,
      durationDays: tour.durationDays,
      // Điểm đến chính đứng đầu, như dòng điểm đến trên thẻ tour.
      destinations: [...tour.destinations]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((destination) => destination.name),
      ratingAvg: tour.ratingAvg,
      // Đợt sớm nhất còn đặt được (ADR-0058), như dòng "Next departure" trên thẻ.
      nextDeparture: tour.nextDeparture?.startDate ?? null,
    })),
  };
}

// ── getTourDetails ──────────────────────────────────────────────────────────

export function toTourDetailsResult(tour: TourDetail) {
  const windowDays = windowDaysForTripLength(tour.durationDays);
  return {
    found: true as const,
    title: tour.title,
    url: tourUrl(tour.slug),
    bookUrl: `${tourUrl(tour.slug)}/book`,
    summary: tour.summary,
    priceFrom: tour.priceFrom,
    currency: tour.currency,
    durationDays: tour.durationDays,
    maxGroupSize: tour.maxGroupSize,
    difficulty: tour.difficulty,
    ratingAvg: tour.ratingAvg,
    ratingCount: tour.ratingCount,
    meetingPoint: tour.meetingPoint,
    highlights: tour.highlights,
    included: tour.included,
    excluded: tour.excluded,
    itinerary: tour.itinerary.map((day) => ({
      day: day.dayNumber,
      title: day.title,
      description:
        day.description === null ? null : clip(day.description, ITINERARY_DESCRIPTION_MAX),
    })),
    // `getTourBySlug` đã xếp theo ngày tăng dần và chỉ còn đợt chưa khởi hành.
    departures: tour.departures
      .filter((departure) => departure.bookable)
      .slice(0, MAX_DEPARTURES)
      .map((departure) => ({
        date: departure.startDate,
        price: departure.effectivePrice,
        seatsLeft: departure.seatsLeft,
      })),
    faqs: tour.faqs.slice(0, MAX_FAQS).map((faq) => ({
      question: faq.question,
      answer: clip(faq.answer, FAQ_ANSWER_MAX),
    })),
    policies: tour.policies.map((policy) => ({
      kind: policy.kind,
      title: policy.title,
      body: clip(policy.body, POLICY_BODY_MAX),
    })),
    // Điều khoản huỷ không nằm trong bảng policy mà sinh từ độ dài chuyến (ADR-0041),
    // nên phải dựng ở đây như trang tour dựng thẻ huỷ — không thì model không có nó.
    cancellation: `Free cancellation until ${windowDays} ${windowDays === 1 ? 'day' : 'days'} before departure. After that, bookings close and cancellations are not refunded.`,
  };
}

// ── submitEnquiry ───────────────────────────────────────────────────────────

/** Cùng luật với form enquiry; tour nêu bằng slug thay vì id. */
const SubmitEnquiryInputSchema = CreateEnquiryInputSchema.pick({
  name: true,
  email: true,
  message: true,
  travelDate: true,
  groupSize: true,
}).extend({
  tourSlug: TourSlugSchema.optional().describe(
    'Slug of the tour the enquiry is about. Leave empty for a general enquiry.',
  ),
});

export type SubmitEnquiryInput = z.infer<typeof SubmitEnquiryInputSchema>;

interface PublishedTour {
  id: string;
  title: string;
}

export interface ChatToolDeps {
  catalog: Pick<CatalogService, 'listTours' | 'getTourBySlug'>;
  enquiries: Pick<EnquiriesService, 'create'>;
  /** Hai hàm đọc đơn của chính khách — cùng hàm trang My bookings và trang chi tiết đơn gọi. */
  bookings: Pick<BookingsService, 'mine' | 'byCode'>;
  /** Tour đang bán theo slug, hoặc null. */
  findPublishedTour(slug: string): Promise<PublishedTour | null>;
  /** Hội thoại đã gửi enquiry chưa (`chat_conversations.enquiry_id`). */
  hasEnquiry(): Promise<boolean>;
  /** Ghi `enquiry_id` vào hội thoại. */
  linkEnquiry(enquiryId: string): Promise<void>;
  /**
   * Người có phiên ở lượt này, hoặc null. Có phiên thì hội thoại đã thuộc đúng người ấy
   * (`ChatService.claimConversation`), nên hai tool đọc đơn chỉ thấy đơn của chủ hội thoại.
   */
  userId: string | null;
  /** Đồng hồ cho "hôm nay" của chi tiết đơn; test truyền mốc cố định. */
  now?: () => Date;
}

export type SearchToursResult = ReturnType<typeof toSearchResult>;
export type TourDetailsResult = ReturnType<typeof toTourDetailsResult> | { found: false };
export type SubmitEnquiryResult = { sent: true } | { sent: false; reason: 'already_sent' };

/** Tool có `execute` — kiểu ghi tay vì kiểu suy ra từ `tool()` trỏ vào gói con của `ai`. */
type ChatTool<INPUT, OUTPUT> = Tool<INPUT, OUTPUT> & {
  /** Ba tool không dùng ngữ cảnh tool của SDK. */
  execute: ToolExecuteFunction<INPUT, OUTPUT, Record<string, never>>;
};

export interface ChatToolset {
  tools: {
    searchTours: ChatTool<SearchToursInput, SearchToursResult>;
    getTourDetails: ChatTool<{ slug: string }, TourDetailsResult>;
    submitEnquiry: ChatTool<SubmitEnquiryInput, SubmitEnquiryResult>;
    /** Chỉ có khi lượt có phiên — khách vãng lai không có đường nào tra đơn. */
    listMyBookings?: ChatTool<ListMyBookingsInput, MyBookingsResult>;
    getMyBooking?: ChatTool<GetMyBookingInput, MyBookingResult>;
  };
  toolApproval: {
    submitEnquiry(input: SubmitEnquiryInput): Promise<{ type: 'user-approval'; reason?: string }>;
  };
}

export function createChatTools(deps: ChatToolDeps): ChatToolset {
  // Thẻ xác nhận và lúc gửi tra cùng một slug: nhớ trong lượt để hai chỗ thấy cùng
  // một kết quả.
  const lookups = new Map<string, Promise<PublishedTour | null>>();
  const lookup = (slug: string) => {
    let found = lookups.get(slug);
    if (found === undefined) {
      found = deps.findPublishedTour(slug);
      lookups.set(slug, found);
    }
    return found;
  };

  const tools = {
    searchTours: tool({
      description:
        'Search published Nexora tours. Returns at most 8 tours and the total number of matches.',
      inputSchema: SearchToursInputSchema,
      execute: async (input) => toSearchResult(await deps.catalog.listTours(toSearchQuery(input))),
    }),
    getTourDetails: tool({
      description:
        'Read one tour: itinerary, bookable departures with prices and seats, inclusions, FAQs and policies.',
      inputSchema: z.object({ slug: TourSlugSchema }),
      execute: async ({ slug }) => {
        const tour = await deps.catalog.getTourBySlug(slug);
        return tour === null ? { found: false as const } : toTourDetailsResult(tour);
      },
    }),
    submitEnquiry: tool({
      description:
        'Send an enquiry to the Nexora team on behalf of the visitor, for example for a private or custom tour, a group or special dates. The visitor sees a confirmation card and must press Send before it runs.',
      inputSchema: SubmitEnquiryInputSchema,
      execute: async (input) => {
        // Mỗi hội thoại một enquiry (spec §2c). Lượt duyệt chạy tuần tự nhờ cột giữ
        // lượt, nên đọc-rồi-ghi ở đây không đua với lượt khác của cùng hội thoại.
        if (await deps.hasEnquiry())
          return { sent: false as const, reason: 'already_sent' as const };
        const tour = input.tourSlug === undefined ? null : await lookup(input.tourSlug);
        const { id } = await deps.enquiries.create(
          {
            name: input.name,
            email: input.email,
            message: input.message,
            ...(tour ? { tourId: tour.id } : {}),
            ...(input.travelDate === undefined ? {} : { travelDate: input.travelDate }),
            ...(input.groupSize === undefined ? {} : { groupSize: input.groupSize }),
            interests: [],
          },
          deps.userId,
        );
        await deps.linkEnquiry(id);
        return { sent: true as const };
      },
    }),
    ...(deps.userId === null ? {} : bookingTools(deps.bookings, deps.userId, deps.now)),
  };

  /**
   * `submitEnquiry` luôn chờ khách bấm (ADR-0050 §3). Tên tour đi theo yêu cầu duyệt
   * (`approval.requestReason`) để thẻ hiện được mà web không phải tra thêm; slug không
   * phải tour đang bán thì thẻ không có tên tour, đúng như enquiry chung được gửi đi.
   *
   * Tour mặc định là tour đang xem nhờ prompt dặn model điền slug, KHÔNG nhờ server
   * tự điền: input chỉ có một nguồn là lời gọi tool đã lưu, nên thẻ khách thấy và
   * enquiry gửi ở lượt duyệt luôn khớp nhau dù khách chuyển trang giữa hai lượt
   * (`experimental_refineToolInput` từng làm việc này, nhưng SDK dựng lại input lúc
   * duyệt bằng chính hàm ấy với trang của lượt duyệt — khác trang là lệch).
   */
  const toolApproval = {
    submitEnquiry: async (input: SubmitEnquiryInput) => {
      const tour = input.tourSlug === undefined ? null : await lookup(input.tourSlug);
      return tour
        ? { type: 'user-approval' as const, reason: tour.title }
        : { type: 'user-approval' as const };
    },
  };

  return { tools, toolApproval };
}

export type ChatTools = ChatToolset['tools'];

/**
 * Hai tool CHỈ ĐỌC đơn của chính khách (ADR-0050 AMEND 2). `userId` đến từ phiên ở server,
 * không nằm trong input của model; mã đơn của người khác trả `{ found: false }` như trang
 * web trả 404 (`byCode` lọc theo chủ đơn).
 */
function bookingTools(
  bookings: ChatToolDeps['bookings'],
  userId: string,
  now: () => Date = () => new Date(),
) {
  return {
    listMyBookings: tool({
      description:
        "List the signed-in visitor's own bookings, at most 10, current and upcoming trips first. Status and payment are written in plain words; repeat them as given.",
      inputSchema: ListMyBookingsInputSchema,
      execute: async ({ when }) =>
        toMyBookingsResult(await bookings.mine(userId, toMyBookingsQuery(when))),
    }),
    getMyBooking: tool({
      description:
        "Read one of the signed-in visitor's own bookings by its code: payment, free-cancellation deadline and refund if cancelled now, cancellation requests, refunds and review. Returns found: false when the code is not one of their bookings.",
      inputSchema: GetMyBookingInputSchema,
      execute: async ({ code }): Promise<MyBookingResult> => {
        const normalized = normalizeBookingCode(code);
        const booking = normalized === null ? null : await bookings.byCode(userId, normalized);
        return booking === null ? { found: false as const } : toMyBookingDetails(booking, now());
      },
    }),
  };
}
