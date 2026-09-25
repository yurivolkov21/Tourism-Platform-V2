import { z } from 'zod';
import { DeparturePriceSchema } from './admin-departures.js';
import {
  DecimalStringSchema,
  PolicyKindSchema,
  TourBadgeSchema,
  TourDifficultySchema,
  TravellerTypeSchema,
} from './catalog.js';
import { descriptionSchema } from './common.js';
import { slugSchema } from './slug.js';
import { TourCostBasisSchema, TourCostCategorySchema } from './tour-costs.js';
import { TourReadinessSchema } from './tour-readiness.js';

/**
 * Khu làm việc của MỘT tour phía admin (spec F17, ADR-0047) — bảy thao tác:
 * tạo, đọc, bốn lệnh sửa theo tab, xoá.
 *
 * Ba quyết định hiện ra ngay trong hình dạng schema dưới đây:
 *
 * - **Mỗi tab một input, khối danh sách gửi NGUYÊN cả danh sách đã sắp**
 *   (§2). Không có thao tác cho từng hàng, nên không có đua ghi thứ tự.
 * - **Mọi input sửa mang `version`** = `updatedAt` của tour dạng ISO có
 *   mili-giây (§3). Server so trong CÙNG câu `UPDATE`; lệch là `STALE_TOUR`.
 * - **`updateDetails` không mang `slug`** (§7) — slug là đường dẫn
 *   `/tours/<slug>` và là thẻ cache `tour:<slug>`. Zod bỏ field lạ, nên client
 *   gửi thừa thì slug cũng không đổi.
 *
 * Trần của từng field gương cột DB (spec §3). Export để admin đếm ký tự và
 * validate bằng CHÍNH các con số này.
 */
export const TOUR_SLUG_MAX = 120;
export const TOUR_TITLE_MAX = 200;
export const TOUR_SUMMARY_MAX = 500;
export const TOUR_FACT_NOTE_MAX = 280;
export const TOUR_MEETING_POINT_MAX = 300;
/** Điểm nổi bật, bao gồm, không bao gồm — mỗi danh sách. */
export const TOUR_LIST_ITEMS_MAX = 15;
export const TOUR_LIST_ITEM_MAX = 200;
export const TOUR_DAY_TITLE_MAX = 200;
export const TOUR_DAY_DESCRIPTION_MAX = 2000;
export const TOUR_FAQS_MAX = 20;
export const TOUR_FAQ_QUESTION_MAX = 300;
export const TOUR_FAQ_ANSWER_MAX = 2000;
export const TOUR_POLICIES_MAX = 10;
export const TOUR_POLICY_TITLE_MAX = 200;
export const TOUR_POLICY_BODY_MAX = 4000;
export const TOUR_COST_ITEMS_MAX = 30;
export const TOUR_COST_LABEL_MAX = 120;
export const TOUR_DURATION_MAX = 30;
export const TOUR_GROUP_MAX = 100;
export const TOUR_DESTINATIONS_MAX = 10;
/** Cả 29 tour là USD; F17 không có ô tiền tệ (spec §1). */
export const TOUR_CURRENCY = 'USD';

export const TourSlugSchema = slugSchema(TOUR_SLUG_MAX);

/** Giá gốc: khuôn giá chuyến (≤ 2 chữ số lẻ, dưới trần cột) và LỚN HƠN 0. */
export const TourBasePriceSchema = DeparturePriceSchema.refine((value) => Number(value) > 0, {
  message: 'base price must be above zero',
});

/** Chính sách viết tay chỉ còn hai loại — chính sách huỷ tính từ độ dài chuyến (ADR-0041). */
export const TourEditorPolicyKindSchema = z.enum(['BOOKING', 'GENERAL']);

const VersionSchema = z.iso.datetime();
const TitleSchema = z.string().trim().min(1).max(TOUR_TITLE_MAX);
const DurationDaysSchema = z.int().min(1).max(TOUR_DURATION_MAX);
const MaxGroupSizeSchema = z.int().min(1).max(TOUR_GROUP_MAX);
const ListSchema = z
  .array(z.string().trim().min(1).max(TOUR_LIST_ITEM_MAX))
  .max(TOUR_LIST_ITEMS_MAX);

/** Mảng enum không được lặp — ô tích ở admin không bao giờ gửi trùng, API cũng không nhận. */
function uniqueArray<T extends z.ZodType<string>>(item: T) {
  return z.array(item).refine((values) => new Set(values).size === values.length, {
    message: 'values must not repeat',
  });
}

const DestinationsSchema = z
  .array(z.object({ destinationId: z.uuid(), isPrimary: z.boolean() }))
  .min(1)
  .max(TOUR_DESTINATIONS_MAX)
  .refine((links) => links.filter((link) => link.isPrimary).length === 1, {
    message: 'exactly one destination must be primary',
  })
  .refine((links) => new Set(links.map((link) => link.destinationId)).size === links.length, {
    message: 'a destination can only be listed once',
  });

// ── Đọc ─────────────────────────────────────────────────────────────────────

/**
 * Một tour như khu làm việc cần. Schema HÀNG cố ý LỎNG hơn input (cùng lý lẽ
 * `AdminDestinationRowSchema`): nó mô tả thứ DB đang giữ, không phải luật ghi —
 * một tour seed vượt một trần mới không được làm cả khu làm việc sập 500 đúng
 * lúc admin cần mở nó ra để sửa.
 */
export const AdminTourDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(TOUR_SLUG_MAX),
  /** `updatedAt` dạng ISO có mili-giây — gửi lại nguyên văn ở mọi lệnh sửa. */
  version: VersionSchema,
  title: z.string(),
  summary: z.string().nullable(),
  categoryId: z.uuid(),
  difficulty: TourDifficultySchema.nullable(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  durationDays: z.int(),
  maxGroupSize: z.int(),
  basePrice: DecimalStringSchema,
  currency: z.string(),
  /** Suy ra từ dòng chi phí (ADR-0033); `null` = tour chưa khai giá vốn. */
  costPrice: DecimalStringSchema.nullable(),
  ratingAvg: DecimalStringSchema.nullable(),
  ratingCount: z.int().nonnegative(),
  suitableFor: z.array(TravellerTypeSchema),
  badges: z.array(TourBadgeSchema),
  highlights: z.array(z.string()),
  included: z.array(z.string()),
  excluded: z.array(z.string()),
  meetingPoint: z.string().nullable(),
  factDurationNote: z.string().nullable(),
  factGroupSizeNote: z.string().nullable(),
  factDifficultyNote: z.string().nullable(),
  factGoodForNote: z.string().nullable(),
  /** Điểm chính đứng đầu. */
  destinations: z.array(z.object({ destinationId: z.uuid(), isPrimary: z.boolean() })),
  /** Theo `dayNumber` tăng dần. Ngày chưa có tiêu đề thì không có hàng. */
  itinerary: z.array(
    z.object({
      dayNumber: z.int().positive(),
      title: z.string(),
      description: z.string().nullable(),
    }),
  ),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  /** Đọc lỏng cả ba loại; ghi chỉ nhận hai (`TourEditorPolicyKindSchema`). */
  policies: z.array(z.object({ kind: PolicyKindSchema, title: z.string(), body: z.string() })),
  costItems: z.array(
    z.object({
      category: TourCostCategorySchema,
      label: z.string(),
      amount: DecimalStringSchema,
      basis: TourCostBasisSchema,
    }),
  ),
  /** Mọi chuyến, kể cả đã huỷ — số ngày khoá khi con số này lớn hơn 0. */
  departureCount: z.int().nonnegative(),
  /** Số ghế lớn nhất của chuyến chưa về và chưa huỷ; `null` khi không có. */
  liveSeatsMax: z.int().positive().nullable(),
  /** Mọi booking, mọi trạng thái — nút Delete chỉ hiện khi bằng 0. */
  bookingCount: z.int().nonnegative(),
  readiness: TourReadinessSchema,
});
export type AdminTourDetail = z.output<typeof AdminTourDetailSchema>;

/** Đọc theo slug vì khu làm việc sống ở `/tours/[slug]`. Lỏng như dữ liệu, không khắt như input tạo. */
export const AdminTourGetInputSchema = z.object({ slug: z.string().min(1).max(TOUR_SLUG_MAX) });
export type AdminTourGetInput = z.output<typeof AdminTourGetInputSchema>;

// ── Tạo, xoá ────────────────────────────────────────────────────────────────

/** Bảy ô của hộp New tour (spec §2a). Tour sinh ra đang TẮT bán. */
export const AdminTourCreateInputSchema = z.object({
  title: TitleSchema,
  slug: TourSlugSchema,
  categoryId: z.uuid(),
  primaryDestinationId: z.uuid(),
  durationDays: DurationDaysSchema,
  maxGroupSize: MaxGroupSizeSchema,
  basePrice: TourBasePriceSchema,
});
export type AdminTourCreateInput = z.output<typeof AdminTourCreateInputSchema>;

export const AdminTourCreateResultSchema = z.object({ id: z.uuid(), slug: z.string() });
export type AdminTourCreateResult = z.output<typeof AdminTourCreateResultSchema>;

export const AdminTourDeleteInputSchema = z.object({ id: z.uuid() });
export type AdminTourDeleteInput = z.output<typeof AdminTourDeleteInputSchema>;

export const AdminTourDeleteResultSchema = z.object({ slug: z.string() });
export type AdminTourDeleteResult = z.output<typeof AdminTourDeleteResultSchema>;

// ── Bốn lệnh sửa ────────────────────────────────────────────────────────────

/** Tab Details — mọi cột sửa được của hàng tour cộng danh sách điểm đến. */
export const AdminTourDetailsInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  title: TitleSchema,
  summary: descriptionSchema(TOUR_SUMMARY_MAX),
  categoryId: z.uuid(),
  difficulty: TourDifficultySchema.nullable(),
  isFeatured: z.boolean(),
  durationDays: DurationDaysSchema,
  maxGroupSize: MaxGroupSizeSchema,
  basePrice: TourBasePriceSchema,
  destinations: DestinationsSchema,
  suitableFor: uniqueArray(TravellerTypeSchema),
  badges: uniqueArray(TourBadgeSchema),
  highlights: ListSchema,
  included: ListSchema,
  excluded: ListSchema,
  meetingPoint: descriptionSchema(TOUR_MEETING_POINT_MAX),
  factDurationNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
  factGroupSizeNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
  factDifficultyNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
  factGoodForNote: descriptionSchema(TOUR_FACT_NOTE_MAX),
});
export type AdminTourDetailsInput = z.output<typeof AdminTourDetailsInputSchema>;

/**
 * Tab Itinerary — chỉ những ngày ĐÃ có tiêu đề (lưu dở được, spec §2b.3).
 * Trần `dayNumber` ≤ số ngày của tour là phán quyết của server, sau phép so
 * phiên bản: contract không biết N.
 */
export const AdminTourItineraryInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  days: z
    .array(
      z.object({
        dayNumber: z.int().min(1).max(TOUR_DURATION_MAX),
        title: z.string().trim().min(1).max(TOUR_DAY_TITLE_MAX),
        description: descriptionSchema(TOUR_DAY_DESCRIPTION_MAX),
      }),
    )
    .max(TOUR_DURATION_MAX)
    .refine((days) => new Set(days.map((day) => day.dayNumber)).size === days.length, {
      message: 'each day can only appear once',
    }),
});
export type AdminTourItineraryInput = z.output<typeof AdminTourItineraryInputSchema>;

/** Tab FAQ & policies — hai danh sách thay nguyên, thứ tự là thứ tự gửi. */
export const AdminTourFaqsPoliciesInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(TOUR_FAQ_QUESTION_MAX),
        answer: z.string().trim().min(1).max(TOUR_FAQ_ANSWER_MAX),
      }),
    )
    .max(TOUR_FAQS_MAX),
  policies: z
    .array(
      z.object({
        kind: TourEditorPolicyKindSchema,
        title: z.string().trim().min(1).max(TOUR_POLICY_TITLE_MAX),
        body: z.string().trim().min(1).max(TOUR_POLICY_BODY_MAX),
      }),
    )
    .max(TOUR_POLICIES_MAX),
});
export type AdminTourFaqsPoliciesInput = z.output<typeof AdminTourFaqsPoliciesInputSchema>;

/** Tab Costs — dòng chi phí thay nguyên; `costPrice` do server tính lại, không có ô nhập. */
export const AdminTourCostsInputSchema = z.object({
  id: z.uuid(),
  version: VersionSchema,
  items: z
    .array(
      z.object({
        category: TourCostCategorySchema,
        label: z.string().trim().min(1).max(TOUR_COST_LABEL_MAX),
        /** Chi phí 0 là có thật (vé miễn phí) — khuôn giá chuyến, cho phép 0. */
        amount: DeparturePriceSchema,
        basis: TourCostBasisSchema,
      }),
    )
    .max(TOUR_COST_ITEMS_MAX),
});
export type AdminTourCostsInput = z.output<typeof AdminTourCostsInputSchema>;
