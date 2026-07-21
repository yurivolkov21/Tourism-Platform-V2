import { z } from 'zod';
import { DecimalStringSchema } from './catalog.js';

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

/** `BK-` + 8 ký tự base36 in hoa (xem apps/api bookings/booking-code.ts). */
export const BookingCodeSchema = z.string().regex(/^BK-[A-Z0-9]{8}$/, 'expected a booking code');

/**
 * Input cho `bookings.create`. Departure được định danh trực tiếp bằng id (tour
 * suy ra ở server — không có `tourSlug`, thứ chỉ có thể mâu thuẫn). Các giới hạn
 * kích thước nhóm ngoài `numAdults ≥ 1` là business rule, kiểm ở server dựa trên
 * số seat còn lại của departure.
 */
export const CreateBookingInputSchema = z.object({
  departureId: z.uuid(),
  numAdults: z.int().min(1),
  numChildren: z.int().min(0).default(0),
  contactName: z.string().min(1).max(120),
  contactEmail: z.email().max(200),
  // min 6: parity Nexora `@Length(6,30)` — chặn số điện thoại 1–5 ký tự.
  contactPhone: z.string().min(6).max(30).optional(),
  specialRequests: z.string().min(1).max(1000).optional(),
  paymentProvider: PaymentProviderSchema,
});

export type CreateBookingInput = z.output<typeof CreateBookingInputSchema>;

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
  departureStartDate: z.iso.date(),
  departureEndDate: z.iso.date(),
  unitPrice: DecimalStringSchema,
  totalAmount: DecimalStringSchema,
  currency: z.string().length(3),
  numAdults: z.int().min(1),
  numChildren: z.int().min(0),
  contactName: z.string().min(1).max(120),
  contactEmail: z.email().max(200),
  contactPhone: z.string().max(30).nullable(),
  specialRequests: z.string().max(1000).nullable(),
  paymentProvider: PaymentProviderSchema,
  checkoutUrl: z.url().nullable(),
  paidAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type Booking = z.output<typeof BookingSchema>;

/**
 * Query cho `bookings.mine`. Cùng quy ước pagination như list catalog (field gõ
 * kiểu thuần — ZodSmartCoercionPlugin lo coerce query string ở server).
 */
export const BookingsListQuerySchema = z.object({
  page: z.int().min(1).default(1),
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
  createdAt: z.iso.datetime(),
});

export type Refund = z.output<typeof RefundSchema>;

/**
 * Input cho `admin.bookings.refund`. Bỏ trống `amount` → refund phần còn lại
 * (total − SUM(refunds)); nó cố ý không mang currency — currency của booking đã
 * ngầm định, nên mismatch currency refund/booking (invariant #6) là bất khả biểu
 * diễn trên path này. `reason` chỉ lưu trong payload outbox của email refund
 * (model Refund cố ý không có cột reason — audit).
 */
export const AdminRefundInputSchema = z.object({
  code: BookingCodeSchema,
  amount: DecimalStringSchema.optional(),
  reason: z.string().min(1).max(500).optional(),
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
 */
export const AdminBookingsListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20),
  status: BookingStatusSchema.optional(),
  search: z.string().min(1).max(120).optional(),
});

export type AdminBookingsListQuery = z.output<typeof AdminBookingsListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation (spec P2 §3, W4 — lịch sử append-only D1-B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirror enum Prisma CancellationRequestStatus. REQUESTED = đang mở (nhiều nhất
 * một cái mỗi booking — partial unique index), DENIED = admin từ chối (booking
 * vẫn PAID), REFUNDED = đã duyệt → refund toàn phần còn lại + booking CANCELLED
 * (docs/conventions/booking-states.md).
 */
export const CancellationRequestStatusSchema = z.enum(['REQUESTED', 'REFUNDED', 'DENIED']);
export type CancellationRequestStatusValue = z.output<typeof CancellationRequestStatusSchema>;

/** Input cho `bookings.cancel` — lý do của khách được chuyển tới queue admin. */
export const CancelBookingInputSchema = z.object({
  code: BookingCodeSchema,
  reason: z.string().min(1).max(1000),
});

export type CancelBookingInput = z.output<typeof CancelBookingInputSchema>;

/**
 * Một row cancellation request (lịch sử append-only theo D1-B — một booking có
 * thể mang nhiều cái: lịch sử DENIED + nhiều nhất một REQUESTED đang mở). Các
 * field quyết định là null cho tới khi admin quyết.
 */
export const CancellationRequestSchema = z.object({
  id: z.uuid(),
  bookingCode: BookingCodeSchema,
  reason: z.string().min(1).max(1000),
  status: CancellationRequestStatusSchema,
  decisionNote: z.string().max(500).nullable(),
  decidedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type CancellationRequest = z.output<typeof CancellationRequestSchema>;

/**
 * Row cho queue admin: request kèm đủ context booking để quyết mà không cần
 * lookup lần hai (port từ DTO cancellation admin của Nexora).
 */
export const AdminCancellationRequestSchema = CancellationRequestSchema.extend({
  tourTitle: z.string().min(1).max(160),
  departureStartDate: z.iso.date(),
  contactName: z.string().min(1).max(120),
  contactEmail: z.email().max(200),
});

export type AdminCancellationRequest = z.output<typeof AdminCancellationRequestSchema>;

/**
 * Query cho `admin.cancellations.list`. Bỏ trống `status` → TẤT CẢ request (nhất
 * quán với `admin.bookings.list`; queue đang mở là `?status=REQUESTED`).
 */
export const AdminCancellationsListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20),
  status: CancellationRequestStatusSchema.optional(),
});

export type AdminCancellationsListQuery = z.output<typeof AdminCancellationsListQuerySchema>;

/**
 * Input cho `admin.cancellations.decide` — một endpoint cho cả hai phán quyết.
 * `approve: true` → refund toàn phần còn lại + booking CANCELLED + trả lại seat
 * + request REFUNDED; `approve: false` → request DENIED, booking giữ nguyên.
 */
export const DecideCancellationInputSchema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  decisionNote: z.string().min(1).max(500).optional(),
});

export type DecideCancellationInput = z.output<typeof DecideCancellationInputSchema>;

/** Output của `admin.cancellations.decide`: request đã quyết + booking sau đó. */
export const DecideCancellationResultSchema = z.object({
  request: AdminCancellationRequestSchema,
  booking: BookingSchema,
});

export type DecideCancellationResult = z.output<typeof DecideCancellationResultSchema>;

/**
 * Output của `admin.bookings.byCode` (nâng cấp W4): booking kèm toàn bộ lịch sử
 * cancellation, cũ nhất trước — dấu vết append-only D1-B (row DENIED vẫn còn qua
 * các lần re-request) là một phần của view chi tiết admin.
 */
export const AdminBookingDetailSchema = BookingSchema.extend({
  cancellationRequests: z.array(CancellationRequestSchema),
});

export type AdminBookingDetail = z.output<typeof AdminBookingDetailSchema>;
