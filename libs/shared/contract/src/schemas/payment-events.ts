import { z } from 'zod';
import { BookingCodeSchema, PaymentProviderSchema } from './bookings.js';
import { DecimalStringSchema } from './catalog.js';
import { AdminPageQuerySchema } from './common.js';

/**
 * Vùng payment events cho admin (spec P4c §3-F8) — sổ webhook Stripe/PayPal
 * mà `PaymentsService.beginEvent` ghi một row cho MỖI delivery đã verify
 * chữ ký (bảng `payment_events`, unique `[provider, eventId]`).
 *
 * HOÀN TOÀN ĐỌC: không có endpoint ghi nào (spec §2.2 — F8 là vùng duy nhất
 * của P4c không có hành vi ghi). Thứ duy nhất đổi row là chính webhook
 * (`finishEvent` đặt `processedAt`), nên bề mặt admin chỉ là kính soi.
 */

/**
 * Bốn type trung lập provider mà gateway phát ra (`VerifiedEvent['type']`
 * ở `apps/api/src/modules/payments/gateway.ts`): mọi event Stripe/PayPal đều
 * bị gom về một trong bốn — rừng `checkout.session.*`/`PAYMENT.CAPTURE.*`
 * chỉ còn nằm trong payload.
 *
 * Tập này HỮU HẠN nên admin lọc bằng Select (quyết định tự chọn F8) — nhưng
 * cột DB là `varchar(100)` và input contract giữ `string` (spec §3-F8), vì
 * đây là gương của một union TypeScript chứ không phải enum Prisma: gateway
 * thêm type thứ năm thì list vẫn trả được row đó, Select chỉ thiếu một mục
 * (unit test bên API đối chiếu tuple này với union của gateway).
 */
export const PAYMENT_EVENT_TYPES = [
  'payment.completed',
  'payment.failed',
  'payment.expired',
  'other',
] as const;
export type PaymentEventTypeValue = (typeof PAYMENT_EVENT_TYPES)[number];

/**
 * Enum của tuple trên — cho nơi cần hỏi "type này gateway có biết không"
 * (Select của admin liệt kê đúng tập này; một type ngoài tập vẫn lọc được,
 * chỉ không có nhãn i18n). Khai MỘT lần ở contract (vòng vá review F8: hai
 * file admin từng tự `z.enum(PAYMENT_EVENT_TYPES)` riêng).
 */
export const PaymentEventTypeSchema = z.enum(PAYMENT_EVENT_TYPES);

/**
 * Query cho `admin.paymentEvents.list`. Phân trang dùng chung
 * `AdminPageQuerySchema`; field gõ kiểu THUẦN (`unprocessed: z.boolean()`,
 * không `z.coerce`) — ZodSmartCoercionPlugin bên API ép "true"/"false" của
 * query string, còn typed client thì gửi boolean thật.
 *
 * `search` khớp `eventId` contains, không phân biệt hoa/thường (id Stripe
 * `evt_…`, PayPal `WH-…` — thứ operator dán từ dashboard provider).
 * `unprocessed = true` → chỉ row `processedAt` null; `false`/vắng → mọi row.
 */
export const AdminPaymentEventsListQuerySchema = AdminPageQuerySchema.extend({
  provider: PaymentProviderSchema.optional(),
  type: z.string().min(1).max(100).optional(),
  search: z.string().min(1).max(120).optional(),
  unprocessed: z.boolean().optional(),
});
export type AdminPaymentEventsListQuery = z.output<typeof AdminPaymentEventsListQuerySchema>;

/**
 * Một row của bảng — KHÔNG mang payload (spec §3-F8): một trang 100 event
 * Stripe là ~100 × 3KB JSON chỉ để đọc bảy cột; drawer gọi `byId` khi mở.
 */
export const PaymentEventRowSchema = z.object({
  id: z.uuid(),
  provider: PaymentProviderSchema,
  /** Id event của provider — nửa của khoá idempotency `[provider, eventId]`. */
  eventId: z.string().min(1).max(255),
  /** Một trong `PAYMENT_EVENT_TYPES` ở mọi row hiện có — xem JSDoc tuple đó. */
  type: z.string().min(1).max(100),
  /**
   * Số tiền provider báo về (cột audit H4) — null ở event `other`/`failed`
   * không mang tiền. Chuỗi thập phân, không bao giờ float (nếp `bookings.ts`).
   */
  amount: DecimalStringSchema.nullable(),
  /** ISO-4217; null cùng lúc với `amount` (gateway ghi cả hai hoặc không). */
  currency: z.string().length(3).nullable(),
  /**
   * Mã booking đọc được — join từ `bookingId`; null khi event không gắn
   * booking HOẶC `bookingId` trỏ tới booking không còn (cột không có FK).
   */
  bookingCode: BookingCodeSchema.nullable(),
  receivedAt: z.iso.datetime(),
  /**
   * Mốc handler chạy xong. null = "đã nhận, chưa xử lý xong": lượt trước
   * crash giữa chừng, provider retry sẽ CHẠY LẠI handler (idempotent cấp
   * booking) — xem `PaymentsService.beginEvent`.
   */
  processedAt: z.iso.datetime().nullable(),
  /**
   * Ghi chú của handler (ADR-0006 AMEND 2a): lý do một event đã ký hợp lệ bị
   * từ chối (tiền lệch), hay dấu vết của một khoản hoàn NGOÀI sổ (capture
   * thừa/lệch, hoàn thất bại cần operator). null = xử lý bình thường. Đây là
   * bề mặt operator DUY NHẤT của những khoản tiền không thành Refund row.
   */
  note: z.string().max(500).nullable(),
});
export type PaymentEventRow = z.output<typeof PaymentEventRowSchema>;

/**
 * Row + payload provider nguyên văn (đã REDACT khoá credential ở mapper API —
 * `payment-event-row.ts`). JSON là dữ liệu để soi trong drawer, không phải
 * giao diện (spec §2.3): có thể mang email/tên khách như bảng bookings đã
 * hiện, và KHÔNG được chép vào log server.
 */
export const PaymentEventDetailSchema = PaymentEventRowSchema.extend({ payload: z.json() });
export type PaymentEventDetail = z.output<typeof PaymentEventDetailSchema>;

/** Input của `admin.paymentEvents.byId` — server action admin re-parse bằng chính schema này. */
export const AdminPaymentEventByIdInputSchema = z.object({ id: z.uuid() });
export type AdminPaymentEventByIdInput = z.output<typeof AdminPaymentEventByIdInputSchema>;
