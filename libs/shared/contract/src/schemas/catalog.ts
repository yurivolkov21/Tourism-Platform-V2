import { z } from 'zod';
import { MediaItemSchema } from './media.js';

/**
 * Catalog read schemas (spec §6) — the ONE source of truth for the public
 * catalog surface: oRPC contract input/output + (later) P3 web client types.
 *
 * Conventions:
 * - Prisma `Decimal` money is serialized as a STRING (`"39.00"`) — never a
 *   float — so amounts survive JSON round-trips losslessly.
 * - Prisma `@db.Date` columns serialize as calendar dates (`YYYY-MM-DD`).
 * - DB-nullable fields are `.nullable()` (the API returns explicit `null`,
 *   not omitted keys).
 */

/** Non-negative decimal serialized as string, e.g. "39.00". */
export const DecimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'expected a non-negative decimal string');

/**
 * Decimal chuỗi CÓ THỂ ÂM — cho những con số mà dấu trừ là một câu trả lời
 * HỢP LỆ, không phải lỗi dữ liệu: lợi nhuận gộp và lợi nhuận ròng của một
 * tháng lỗ (ADR-0033).
 *
 * Tách khỏi `DecimalStringSchema` chứ KHÔNG nới lỏng nó: tiền THU và giá VỐN
 * âm là dữ liệu hỏng và phải bị chặn ở biên. Hai khái niệm, hai schema — nới
 * cái cũ là mở đường cho một `revenue: '-500.00'` đi lọt tới tận màn hình.
 */
export const SignedDecimalStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'expected a decimal string');

/** Mirrors Prisma enum TourDifficulty (audit M4). */
export const TourDifficultySchema = z.enum(['EASY', 'MODERATE', 'CHALLENGING']);

/** Mirrors Prisma enum TravellerType. */
export const TravellerTypeSchema = z.enum(['FAMILY', 'COUPLE', 'FRIENDS', 'SOLO', 'BUSINESS']);

/** Mirrors Prisma enum TourBadge. */
export const TourBadgeSchema = z.enum([
  'BEST_VALUE',
  'LIMITED_OFFER',
  'EXCLUSIVE',
  'NEW',
  'POPULAR',
]);

/** Mirrors Prisma enum PolicyKind. */
export const PolicyKindSchema = z.enum(['CANCELLATION', 'BOOKING', 'GENERAL']);

// ─────────────────────────────────────────────────────────────────────────────
// Tour card (public list item)
// ─────────────────────────────────────────────────────────────────────────────

/** Một destination mà tour đi qua (bảng join M:N). `isPrimary` = destination
 * chính; card/detail trả CẢ mảng (primary đứng đầu) nên client tự chọn được —
 * thay cho field `primaryDestination` đơn cũ (C1: tour đi qua nhiều nơi). */
export const DestinationLinkSchema = z.object({
  slug: z.string(),
  name: z.string(),
  isPrimary: z.boolean(),
});

export const TourCardSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).nullable(),
  basePrice: DecimalStringSchema,
  compareAtPrice: DecimalStringSchema.nullable(),
  /**
   * Giá "from" THẬT của tour = `min(effectivePrice)` trên các đợt OPEN sắp tới
   * (`effectivePrice = priceOverride ?? basePrice`); không còn đợt nào thì rơi về
   * `basePrice`. Thêm 19/08 (sổ nợ cùng ngày): thẻ /tours in `basePrice` "from
   * $129" trong khi trang chi tiết có đợt thấp điểm $119 — card không biết đợt.
   * Tính ở API (một query cho cả trang, không N+1) chứ không ở web, vì list
   * không mang `departures`. Vẫn là DecimalString — tiền không bao giờ là số.
   */
  priceFrom: DecimalStringSchema,
  currency: z.string().length(3),
  durationDays: z.int().positive(),
  difficulty: TourDifficultySchema.nullable(),
  maxGroupSize: z.int().positive(),
  isFeatured: z.boolean(),
  destinations: z.array(DestinationLinkSchema),
  category: z.object({ slug: z.string(), name: z.string() }),
  // Rating denormalize sẵn trên Tour (cập nhật atomically trong transaction
  // duyệt review — xem ReviewsService.moderate). Nexora tính live bằng
  // groupBy mỗi lần đọc; cách này rẻ hơn hẳn ở đường đọc.
  //
  // `number` chứ không phải DecimalString như tiền: đây là số để hiển thị
  // sao, FE cần dùng số trực tiếp, và Decimal(2,1) biểu diễn chính xác
  // được trong double. Quy tắc "tiền luôn là string" không áp ở đây.
  //
  // null ≠ 0: null là "chưa ai đánh giá", 0 là "bị chấm 0 điểm".
  ratingAvg: z.number().min(0).max(5).nullable(),
  ratingCount: z.int().nonnegative(),
  // Ảnh bìa — role `hero` của tour (ADR-0020). Đóng "nợ contract #1": trước
  // đây tour KHÔNG có đường nào ra ảnh, cả ở schema lẫn contract, nên web chỉ
  // vẽ được ô giữ chỗ. Cùng khuôn `PostCardSchema.cover` đã chạy từ P3a.
  //
  // Card chỉ cần MỘT tấm; mảng đầy đủ nằm ở `TourDetailSchema.media`.
  cover: MediaItemSchema.nullable(),
});

export type TourCard = z.output<typeof TourCardSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tour detail (card + editorial content + upcoming OPEN departures)
// ─────────────────────────────────────────────────────────────────────────────

export const TourItineraryDaySchema = z.object({
  dayNumber: z.int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
});

export const TourFaqSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
});

export const TourPolicySchema = z.object({
  kind: PolicyKindSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

/** Upcoming OPEN departure. `effectivePrice = priceOverride ?? tour.basePrice`. */
export const TourDepartureSchema = z.object({
  id: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  seatsLeft: z.int().nonnegative(),
  effectivePrice: DecimalStringSchema,
  compareAtPrice: DecimalStringSchema.nullable(),
});

export const TourDetailSchema = TourCardSchema.extend({
  // Schema v2 has no single `description` column — the tour body is the
  // structured merchandising content below (summary lives on the card).
  suitableFor: z.array(TravellerTypeSchema),
  badges: z.array(TourBadgeSchema),
  included: z.array(z.string()),
  excluded: z.array(z.string()),
  highlights: z.array(z.string()),
  meetingPoint: z.string().max(300).nullable(),
  /**
   * Một câu mô tả dưới mỗi card dữ kiện ở tab Overview (ADR-0023).
   *
   * CHỈ có ở detail, KHÔNG có ở `TourCardSchema`: card trong danh sách không
   * hiện mô tả, thêm vào chỉ làm nặng payload `/tours`.
   *
   * Nullable và UI phải chịu được null — 30 tour × 4 câu là việc soạn nội dung
   * thật, và tour mới tạo ở admin sẽ trống lúc đầu. Card thiếu mô tả vẫn phải
   * đọc được, chỉ là thấp hơn.
   */
  factDurationNote: z.string().max(280).nullable(),
  factGroupSizeNote: z.string().max(280).nullable(),
  factDifficultyNote: z.string().max(280).nullable(),
  factGoodForNote: z.string().max(280).nullable(),
  /**
   * Cửa sổ huỷ miễn phí tính bằng NGÀY (ADR-0023 §2).
   *
   * `policies[]` vẫn giữ toàn văn chính sách; trường này chỉ tách MỘT con số để
   * giao diện in thành nhãn ngắn ("Free until 10 days out"). Không suy ra từ
   * `policy.body`: đã đếm trên 29 policy, regex `up to (\d+) days` chỉ bắt được
   * 12 — 17 câu còn lại viết khác khuôn.
   *
   * `null` cho tour tính cửa sổ bằng GIỜ (14/29 tour hiện tại). Ép 24 giờ thành
   * "1 ngày" là nói sai: mốc 24 giờ tính từ giờ khởi hành, không phải nửa đêm.
   */
  freeCancellationDays: z.int().nonnegative().nullable(),
  itinerary: z.array(TourItineraryDaySchema),
  faqs: z.array(TourFaqSchema),
  policies: z.array(TourPolicySchema),
  departures: z.array(TourDepartureSchema),
  // Bộ ảnh đầy đủ nuôi khảm gallery (`tour-gallery.tsx`: 1 ô lớn + 4 ô nhỏ,
  // lightbox không giới hạn). Trước ADR-0020 trang detail truyền `media={[]}`
  // cứng vì chỗ này không tồn tại.
  //
  // Mảng rỗng là hợp lệ — gallery tự ẩn, không phải lỗi.
  media: z.array(MediaItemSchema),
});

export type TourDetail = z.output<typeof TourDetailSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Destination + category
// ─────────────────────────────────────────────────────────────────────────────

export const DestinationSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  country: z.string().min(1).max(60),
  region: z.string().max(80).nullable(),
  description: z.string().max(2000).nullable(),
  /** Number of PUBLISHED tours touching this destination. */
  tourCount: z.int().nonnegative(),
  // MỘT tấm, không phải mảng: site không có trang chi tiết địa danh, mỗi địa
  // danh chỉ xuất hiện dưới dạng một tile. Kho ~10 ảnh mỗi địa danh (ADR-0020
  // §5) tồn tại để nuôi gallery TOUR, không phải để trưng ở đây.
  cover: MediaItemSchema.nullable(),
});

export type Destination = z.output<typeof DestinationSchema>;

export const TourCategorySchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  order: z.int(),
  // Đối xứng với `DestinationSchema.tourCount` — dùng cho nhãn bộ lọc
  // "Adventure Tours (7)". CHỈ đếm tour đã publish: đếm cả draft là
  // endpoint công khai gián tiếp lộ số tour nháp (lỗi Nexora mắc ở
  // destinations, v2 đã tránh — giữ nhất quán ở đây).
  toursCount: z.int().nonnegative(),
});

export type TourCategory = z.output<typeof TourCategorySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// List query + pagination envelope
// ─────────────────────────────────────────────────────────────────────────────

// `updatedAt`: parity Nexora — cho sort "mới cập nhật".
export const TourSortKeySchema = z.enum([
  'createdAt',
  'updatedAt',
  'basePrice',
  'durationDays',
  'title',
]);
export const SortOrderSchema = z.enum(['asc', 'desc']);

/**
 * Query for `tours.list`. Plain typed fields (no z.coerce) — HTTP query-string
 * coercion is the server's job (ZodSmartCoercionPlugin), so client input
 * types stay honest (`page?: number`, `featured?: boolean`).
 */
export const ToursListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(50).default(12),
  /** Category slug. */
  category: z.string().min(1).max(60).optional(),
  /** Destination slug (any linked destination, not just primary). */
  destination: z.string().min(1).max(80).optional(),
  /** Case-insensitive substring match on title/summary. */
  search: z.string().min(1).max(100).optional(),
  featured: z.boolean().optional(),
  sort: TourSortKeySchema.default('createdAt'),
  order: SortOrderSchema.default('desc'),
});

export type ToursListQuery = z.output<typeof ToursListQuerySchema>;

/** Pagination envelope factory: `{ items, page, limit, total, totalPages }`. */
export function PagedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    limit: z.int().min(1),
    total: z.int().nonnegative(),
    totalPages: z.int().nonnegative(),
  });
}

export type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

export const HealthSchema = z.object({
  status: z.literal('ok'),
  uptimeSec: z.int().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type Health = z.output<typeof HealthSchema>;
