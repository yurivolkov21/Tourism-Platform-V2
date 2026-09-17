import { z } from 'zod';
import { DecimalStringSchema, DestinationLinkSchema } from './catalog.js';
import {
  AdminPageQuerySchema,
  BookingCodeSchema,
  CalendarDateSchema,
  EmailSchema,
} from './common.js';
import { MediaItemSchema } from './media.js';
import { MyReviewSchema } from './reviews.js';

// Re-export để mọi chỗ import `BookingCodeSchema` từ `'./bookings.js'` (nguồn
// gốc lịch sử) không phải đổi gì — định nghĩa thật giờ nằm ở `common.ts` để
// tránh import vòng với `media.ts` (xem JSDoc tại đó).
export { BookingCodeSchema };

/**
 * Booking schema (spec P2 §3, W1) — nguồn sự thật DUY NHẤT cho bề mặt booking
 * phía khách: input/output của oRPC contract + kiểu client web P3.
 *
 * Cùng quy ước serialize như catalog.ts: money Decimal dạng string, cột
 * `@db.Date` dạng `YYYY-MM-DD`, field nullable ở DB trả về `null` tường minh.
 * Các giới hạn độ dài mirror y hệt `apps/api/prisma/schema.prisma` (model Booking).
 */

/** Mirror enum Prisma PaymentProvider (ADR-0006, đã sửa đổi). */
export const PaymentProviderSchema = z.enum(['STRIPE', 'PAYPAL']);
export type PaymentProviderValue = z.output<typeof PaymentProviderSchema>;

/** Mirror enum Prisma BookingStatus. */
export const BookingStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export type BookingStatusValue = z.output<typeof BookingStatusSchema>;

/**
 * Input cho `bookings.create`. Departure được định danh trực tiếp bằng id (tour
 * suy ra ở server — không có `tourSlug`, thứ chỉ có thể mâu thuẫn). Các giới hạn
 * kích thước nhóm ngoài `numAdults ≥ 1` là business rule, kiểm ở server dựa trên
 * số seat còn lại của departure.
 */
export const CreateBookingInputSchema = z.object({
  departureId: z.uuid(),
  // `.max(99)` là trần SANITY tuyệt đối (W1 — audit 05/09 cụm 2): trần thật
  // là `maxGroupSize` của tour, server kiểm sau khi join tour → PARTY_TOO_LARGE
  // (422). Contract chỉ chặn số vô nghĩa để phép cộng party không bao giờ tràn.
  numAdults: z.int().min(1).max(99),
  numChildren: z.int().min(0).max(99).default(0),
  contactName: z.string().min(1).max(120),
  contactEmail: EmailSchema,
  // min 6: parity Nexora `@Length(6,30)` — chặn số điện thoại 1–5 ký tự.
  contactPhone: z.string().min(6).max(30).optional(),
  specialRequests: z.string().min(1).max(1000).optional(),
  paymentProvider: PaymentProviderSchema,
});

export type CreateBookingInput = z.output<typeof CreateBookingInputSchema>;

/**
 * Mirror enum Prisma CancellationRequestStatus. REQUESTED = đang mở (nhiều nhất
 * một cái mỗi booking — partial unique index), DENIED = admin từ chối (booking
 * vẫn PAID), REFUNDED = đã duyệt → hoàn theo mức chính sách (hoặc số admin
 * ghi lý do, ADR-0029/0030) + booking CANCELLED (docs/conventions/booking-states.md). Đặt TRƯỚC `BookingSchema` (thay vì ở
 * cụm Cancellation phía dưới) vì `BookingSchema.cancellationStatus` cần tham
 * chiếu nó — const khai sau không dùng được do temporal dead zone.
 */
export const CancellationRequestStatusSchema = z.enum(['REQUESTED', 'REFUNDED', 'DENIED']);
export type CancellationRequestStatusValue = z.output<typeof CancellationRequestStatusSchema>;

/**
 * Shape booking công khai. Các field snapshot (tourTitle, ngày departure,
 * unitPrice) phản ánh đúng thứ khách đã mua tại thời điểm create — chúng không
 * bao giờ render lại khi tour bị sửa (audit H3). `checkoutUrl` chỉ khác null
 * ngay sau `create` (redirect session của gateway); khi read trả về `null`.
 */
export const BookingSchema = z.object({
  id: z.uuid(),
  code: BookingCodeSchema,
  status: BookingStatusSchema,
  tourTitle: z.string().min(1).max(160),
  /** Slug tour để link ngược về trang tour — snapshot lúc đọc, join từ quan hệ. */
  tourSlug: z.string().min(1).max(160),
  /** Ảnh cover tour cho card Trips (hướng A) — null khi tour chưa có media. */
  tourImage: MediaItemSchema.nullable(),
  /** Snapshot đích đến của tour lúc ĐỌC (primary đứng đầu — API đảm bảo thứ
   *  tự) — nguồn cho tem hộ chiếu, stats "places visited" và bản đồ chấm
   *  (spec 11/08 §3.1). Tái dùng DestinationLinkSchema của catalog, không
   *  khai schema mới; mảng rỗng hợp lệ khi tour chưa gắn destination. */
  tourDestinations: z.array(DestinationLinkSchema),
  departureStartDate: z.iso.date(),
  departureEndDate: z.iso.date(),
  /**
   * Ngày chót huỷ miễn phí của chuyến đã mua (ADR-0041 §2): ngày khởi hành − N,
   * N theo độ dài chuyến. SERVER tính từ snapshot ngày đi/ngày về bằng
   * `cancellationDeadline` của contract; web/admin chỉ in (Q7). Có mặt ở MỌI
   * route trả booking — một ngày lịch, không tốn query nào.
   */
  cancellationDeadline: z.iso.date(),
  unitPrice: DecimalStringSchema,
  totalAmount: DecimalStringSchema,
  currency: z.string().length(3),
  numAdults: z.int().min(1),
  numChildren: z.int().min(0),
  contactName: z.string().min(1).max(120),
  contactEmail: EmailSchema,
  contactPhone: z.string().max(30).nullable(),
  specialRequests: z.string().max(1000).nullable(),
  paymentProvider: PaymentProviderSchema,
  // CHỈ https (vòng vá review W3): `z.url()` trần cho `javascript:`/`data:`
  // qua — sink `window.location.assign` ở web/mobile là XSS trọn gói nếu
  // response bị nhiễm. Stripe/PayPal (kể cả sandbox) và FakeGateway test đều
  // https; dev http localhost không bao giờ là checkoutUrl. Web còn guard
  // `isCheckoutUrl` làm lớp hai.
  checkoutUrl: z.url({ protocol: /^https$/ }).nullable(),
  paidAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /**
   * Task 6a (A2, user duyệt 06/08): trạng thái đơn-xin-hủy MỚI NHẤT của booking
   * này (theo `createdAt desc`), null nếu chưa từng xin. CHỈ `bookings.byCode`
   * điền giá trị thật (đọc kèm — dùng cho trang chi tiết); `mine`/`adminList`/
   * `adminByCode` để null cố ý (giữ list nhẹ — không thêm N query phụ cho mỗi
   * row list, xem comment tại `BookingsService.mine`).
   */
  cancellationStatus: CancellationRequestStatusSchema.nullable(),
  /**
   * Mốc thời gian của CHÍNH đơn-xin-hủy mà `cancellationStatus` đang nói tới —
   * gửi lúc nào, quyết lúc nào (null khi chưa quyết). Cùng luật điền như
   * `cancellationStatus`: chỉ `byCode` có giá trị thật.
   *
   * Vì sao thêm (spec cụm C §3): "Cancellation requested — pending review"
   * không kèm ngày thì khách không biết yêu cầu đã tới hay chưa, và phản xạ tự
   * nhiên là gửi lại lần hai. Rẻ: `byCode` vốn đã chạy `findFirst` trên bảng
   * này, chỉ thêm cột vào `select` — không tốn query nào.
   *
   * CỐ Ý KHÔNG mở `decisionNote` (lý do admin từ chối) ra contract khách: đó là
   * ghi chú nội bộ, mở ra là biến nó thành copy user-facing không qua luật biên
   * tập nào. Nhánh DENIED dùng câu cố định + link `/cancellation-policy`.
   */
  cancellationRequestedAt: z.iso.datetime().nullable(),
  cancellationDecidedAt: z.iso.datetime().nullable(),
  /**
   * Tổng tiền ĐÃ HOÀN tính tới lúc đọc — `SUM(refunds.amount)` của booking này,
   * `'0.00'` khi chưa hoàn đồng nào. Cùng luật điền: chỉ `byCode`.
   *
   * Vì sao là MỘT CON SỐ chứ không phải danh sách refund: trang chi tiết của
   * khách cần trả lời "tiền về bao nhiêu rồi", không cần sổ cái từng lần —
   * sổ cái là việc của back-office (`AdminRefundResultSchema`). Thiết kế đã
   * chốt ô Payment là con số chứ không phải tính từ, vì tính từ không kể được
   * ca hoàn một phần mà chuyến vẫn chạy.
   *
   * Đáng tin: trigger của ADR-0009 khoá bất biến `SUM(refunds) ≤ totalAmount`,
   * nên con số này không bao giờ vượt tổng.
   */
  refundedTotal: DecimalStringSchema,
  /**
   * Mốc khách đã viết đánh giá cho booking này; null = chưa viết (cụm B).
   *
   * Vì sao cần: `reviews.create` có ràng buộc `bookingId @unique`, nên nếu
   * không có field này thì cách DUY NHẤT để biết đã review hay chưa là POST
   * rồi bắt 409 — tức khách gõ xong cả bài đánh giá mới được báo là không
   * viết được. Copy "bạn đã đánh giá chuyến này" đã có sẵn trong i18n từ
   * trước nhưng không có gì drive được nó.
   *
   * Chỉ `bookings.byCode` điền giá trị thật; `mine` giữ null — cùng lý do với
   * `refundedTotal` và hai mốc huỷ ở trên: tránh N+1 trên đường đọc danh sách.
   */
  reviewedAt: z.iso.datetime().nullable(),
});

export type Booking = z.output<typeof BookingSchema>;

/**
 * Output của `bookings.byCode` — booking kèm review của CHÍNH khách
 * (ADR-0032 §7).
 *
 * ## Vì sao MỞ RỘNG ở đây chứ không thêm field vào `BookingSchema`
 *
 * Bản đầu nhét `review` thẳng vào `BookingSchema`, và đo được ngay: worker
 * chạy `contract.spec.ts` **hết bộ nhớ**. `ContractInputs`/`ContractOutputs`
 * suy kiểu cho TOÀN BỘ router, mà `BookingSchema` xuất hiện ở khoảng mười
 * route — mỗi route bỗng phải mang thêm một review lồng một mảng media, và
 * phép nhân ấy làm nổ suy kiểu.
 *
 * Mở rộng cho ĐÚNG route cần thì chi phí ấy chỉ trả một lần. Cùng khuôn
 * `AdminBookingDetailSchema` ngay dưới đây, và cùng lý do đã ghi ở
 * `reviewedAt`: đường đọc danh sách không gánh thứ chỉ trang chi tiết dùng.
 */
/**
 * Trạng thái huỷ của booking lúc ĐỌC `bookings.byCode` (ADR-0041 §4) — SERVER
 * tính bằng bộ hàm luật của contract, cùng đường với lệnh huỷ thật, nên con số
 * khách thấy là con số server hoàn. Web không so ngày bằng giờ trình duyệt (Q7).
 */
export const BookingCancellationSchema = z.object({
  /** Ngày chót huỷ miễn phí, hết lúc 23:59:59 giờ Việt Nam. */
  deadline: z.iso.date(),
  /** Hôm nay (giờ Việt Nam) còn ≤ ngày chót. */
  withinDeadline: z.boolean(),
  /** Số sẽ hoàn nếu huỷ ngay: phần còn lại khi trong hạn, `'0.00'` khi quá hạn. */
  refundAmount: DecimalStringSchema,
  /** Còn nút huỷ: chưa tới ngày khởi hành và có capture để hoàn vào. */
  canCancel: z.boolean(),
});

export type BookingCancellation = z.output<typeof BookingCancellationSchema>;

export const BookingDetailSchema = BookingSchema.extend({
  /**
   * `null` khi khách chưa viết review nào cho booking này.
   *
   * `reviewedAt` một mình KHÔNG đủ: nó là một mốc thời gian, không mang phán
   * quyết nào. Trước ADR-0032 trang chi tiết booking chỉ có nó, nên khách bị
   * bác quay lại đọc thấy "bạn đã đánh giá chuyến này rồi" — email nói thật,
   * sản phẩm thì im. Ở đây mang trọn `MyReview` để trang vừa nói được trạng
   * thái + lý do, vừa điền sẵn form sửa mà không tốn thêm một lượt gọi.
   */
  review: MyReviewSchema.nullable(),
  /**
   * ADR-0041: trạng thái huỷ theo hạn chót — `null` khi booking không ở PAID
   * hoặc PARTIALLY_REFUNDED. Web chỉ IN các con số này, không tự tính lại.
   */
  cancellation: BookingCancellationSchema.nullable(),
});

export type BookingDetail = z.output<typeof BookingDetailSchema>;

/**
 * Query cho `bookings.mine`. Cùng quy ước pagination như list catalog (field gõ
 * kiểu thuần — ZodSmartCoercionPlugin lo coerce query string ở server).
 */
export const BookingsListQuerySchema = z.object({
  // Cùng trần với PageQuerySchema (W4 R3, vòng vá review): offset tuỳ ý là
  // Postgres đếm qua từng row bị skip — kể cả trên list đã lọc theo user.
  page: z.int().min(1).max(10_000).default(1),
  limit: z.int().min(1).max(50).default(12),
  status: BookingStatusSchema.optional(),
});

export type BookingsListQuery = z.output<typeof BookingsListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Bề mặt admin (spec P2 §3, W3) — refund ledger + list quản trị
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Một row ledger Refund append-only (nâng cấp audit H1 — thay cho bốn cột refund
 * nullable của Nexora). `adminId` null = refund tự động (overbook / orphaned
 * capture); `providerRefundId` null chỉ với row legacy/không rõ.
 */
export const RefundSchema = z.object({
  id: z.uuid(),
  amount: DecimalStringSchema,
  currency: z.string().length(3),
  providerRefundId: z.string().max(255).nullable(),
  adminId: z.uuid().nullable(),
  /** Lý do NỘI BỘ của refund thiện chí (ADR-0030 AMEND 2); null = auto-refund/row cũ. Chỉ admin thấy. */
  reason: z.string().max(500).nullable(),
  createdAt: z.iso.datetime(),
});

export type Refund = z.output<typeof RefundSchema>;

/**
 * Input cho `admin.bookings.refund` — W2 (ADR-0030 AMEND 1): `amount` VÀ
 * `reason` đều BẮT BUỘC. Nhánh cũ "vắng amount = hoàn trọn phần dư" là cửa
 * hậu cùng hình dạng với lỗ `refundAmount`-vắng mà ADR-0029 AMEND 5 vá bên
 * approve: một cú bấm nhầm là lệnh chuyển trọn số dư không dấu vết. Admin
 * muốn hoàn đủ thì GÕ đúng con số phần dư (panel có nút điền nhanh) — xác
 * nhận bằng chính con số. `reason` bắt buộc vì refund thiện chí ĐỊNH NGHĨA
 * là ngoài chính sách (không có request huỷ) — chính là ca "vượt bậc phải
 * ghi lý do" của ADR-0030 §5; nó vẫn chỉ sống trong payload outbox (model
 * Refund cố ý không có cột reason — ledger chỉ giữ money fact). Không mang
 * currency — currency của booking đã ngầm định, nên mismatch currency
 * refund/booking (invariant #6) là bất khả biểu diễn trên path này.
 */
export const AdminRefundInputSchema = z.object({
  code: BookingCodeSchema,
  amount: DecimalStringSchema,
  // `.trim()` ở contract (W1) — cùng luật với các free-text khác của miền này.
  reason: z.string().trim().min(1).max(500),
});

export type AdminRefundInput = z.output<typeof AdminRefundInputSchema>;

/** Output của `admin.bookings.refund`: booking suy ra lại + toàn bộ ledger. */
export const AdminRefundResultSchema = z.object({
  booking: BookingSchema,
  refunds: z.array(RefundSchema),
});

export type AdminRefundResult = z.output<typeof AdminRefundResultSchema>;

/**
 * Query cho `admin.bookings.list` (port nhẹ từ DTO list admin của Nexora):
 * pagination + filter `status` + `search` free-text khớp không phân biệt hoa
 * thường theo booking code, contact email và contact name.
 *
 * `from`/`to` (thêm ở F6, spec P4b §3-F6) lọc theo `createdAt` và là NGÀY
 * LỊCH `YYYY-MM-DD`, không phải mốc ISO có giờ: đây là thứ admin gõ vào hai ô
 * date trên toolbar và là thứ in ra tiêu đề báo cáo. Cả hai đầu ĐỀU tính vào
 * khoảng — "01/09 → 30/09" nghĩa là trọn ngày 30 cũng nằm trong; phép đổi ra
 * biên nửa-mở `[from 00:00Z, to+1d 00:00Z)` nằm ở API (`bookings-date-range.ts`,
 * cùng nếp nửa-mở của StatsService) chứ không rải ra client.
 *
 * `from > to` là 400 chứ KHÔNG phải một tập rỗng im lặng: khoảng ngược là lỗi
 * gõ, và trả về "0 booking" cho một lỗi gõ là câu trả lời nói dối. UI admin
 * không bao giờ gửi được khoảng ngược (`parseBookingsSearchParams` bỏ `to` khi
 * nó đứng trước `from`) — luật này canh cho mọi caller khác.
 */

export const AdminBookingsListQuerySchema = AdminPageQuerySchema.extend({
  status: BookingStatusSchema.optional(),
  search: z.string().min(1).max(120).optional(),
  from: CalendarDateSchema.optional(),
  to: CalendarDateSchema.optional(),
  /**
   * `false` = trả `tourImage: null` thay vì resolve ảnh cover (vòng vá
   * review F6). Dành cho đường export CSV: nó gom TỪNG TRANG của cả tập mà
   * file thì không có cột ảnh — mỗi trang một query media + payload phồng
   * chỉ để vứt đi. Bảng `/bookings` giữ mặc định `true`.
   */
  includeMedia: z.boolean().default(true),
})
  // `.refine` trên ZodObject của Zod 4 GIỮ NGUYÊN `.shape` (check gắn thêm,
  // không bọc lớp mới) — điều kiện sống còn của `ZodSmartCoercionPlugin` bên
  // API: nó đi theo shape để ép "2" thành number cho page/limit.
  .refine(({ from, to }) => !(from && to) || from <= to, {
    message: 'from must be on or before to',
    path: ['to'],
  });

export type AdminBookingsListQuery = z.output<typeof AdminBookingsListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation (spec P2 §3, W4 — lịch sử append-only D1-B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input cho `bookings.cancel` — khách huỷ NGAY (ADR-0041 §4). Lý do không bắt
 * buộc: vắng thì dòng yêu cầu huỷ ghi `null`.
 *
 * `.trim()` ở CONTRACT (W1, khuôn `reviews.ts`): luật một chỗ. Trước đây input
 * `min(1)` không trim còn service trim rồi ghi `''` — row lọt qua rồi nổ output
 * validation (500) ở chính `bookings.cancel` và `admin.cancellations.list` (cả
 * trang). Có gửi thì vẫn phải có chữ: toàn khoảng trắng là 400.
 */
export const CancelBookingInputSchema = z.object({
  code: BookingCodeSchema,
  reason: z.string().trim().min(1).max(1000).optional(),
});

export type CancelBookingInput = z.output<typeof CancelBookingInputSchema>;

/**
 * Output của `bookings.cancel`: booking sau khi huỷ kèm số tiền LẦN HUỶ NÀY đã
 * hoàn (`'0.00'` khi quá hạn chót). `booking.refundedTotal` là tổng sổ sau huỷ.
 */
export const CancelBookingResultSchema = z.object({
  booking: BookingSchema,
  refundedAmount: DecimalStringSchema,
});

export type CancelBookingResult = z.output<typeof CancelBookingResultSchema>;

/**
 * Một dòng `cancellation_requests` (lịch sử append-only D1-B). Từ ADR-0041 mỗi
 * lần khách tự huỷ ghi đúng MỘT dòng REFUNDED, gửi và quyết cùng lúc; REQUESTED
 * và DENIED chỉ còn ở dữ liệu của luồng duyệt cũ, hiện dạng chỉ đọc.
 */
export const CancellationRequestSchema = z.object({
  id: z.uuid(),
  bookingCode: BookingCodeSchema,
  /**
   * Lý do khách ghi. `null` = khách tự huỷ mà không ghi (ADR-0041 — lý do không
   * bắt buộc); yêu cầu tạo trước đợt này luôn có lý do.
   */
  reason: z.string().min(1).max(1000).nullable(),
  status: CancellationRequestStatusSchema,
  decisionNote: z.string().max(500).nullable(),
  decidedAt: z.iso.datetime().nullable(),
  /**
   * `true` khi người quyết CHÍNH LÀ khách đã gửi yêu cầu (`decided_by = user_id`),
   * tức khách tự huỷ (ADR-0041 §4). `false` khi chưa quyết, hoặc do nhân viên
   * quyết (dữ liệu luồng duyệt cũ). Admin in "ai huỷ" từ cờ này, nhờ vậy
   * contract không phải phơi id người dùng nào.
   */
  decidedByCustomer: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type CancellationRequest = z.output<typeof CancellationRequestSchema>;

/**
 * Output của `admin.bookings.byCode` (nâng cấp W4): booking kèm toàn bộ lịch sử
 * cancellation, cũ nhất trước — dấu vết append-only D1-B (row DENIED vẫn còn qua
 * các lần re-request) là một phần của view chi tiết admin.
 */
export const AdminBookingDetailSchema = BookingSchema.extend({
  cancellationRequests: z.array(CancellationRequestSchema),
  // Sổ cái refund THẬT (review F2 31/08): trước đây detail admin không mang
  // ledger nên UI phải "giải thích endpoint thiếu gì" thay vì in số — lỗ tầng
  // dữ liệu vá bằng tầng copy. Kèm theo, `refundedTotal` của BookingSchema
  // được adminByCode điền thật (trước để '0.00'), là trần validate phía admin.
  refunds: z.array(RefundSchema),
});

export type AdminBookingDetail = z.output<typeof AdminBookingDetailSchema>;
