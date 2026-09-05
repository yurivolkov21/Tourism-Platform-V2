import { z } from 'zod';
import { AdminPageQuerySchema } from './common.js';

/**
 * Vùng outbox email cho admin (spec P4c §3-F7) — bề mặt ĐỌC + MỘT hành vi ghi
 * (`retry`) trên bảng `outbox` mà worker pg-boss drain mỗi phút (ADR-0007).
 *
 * Contract KHÔNG biết gì về worker: retry chỉ là "đưa hàng về PENDING", worker
 * tự nhặt ở lượt kế. Không có endpoint xoá — FAILED giữ lại để triage (spec
 * §2.4), SENT/SKIPPED có purge cron dọn.
 */

/**
 * Soi gương enum `OutboxStatus` của Prisma — trạng thái vòng đời một row.
 * `SKIPPED` (vòng vá review F7): worker CỐ Ý không gửi (người nhận đã huỷ
 * đăng ký newsletter) — trước đây bị đánh SENT nên card "Sent" và badge nói
 * dối; giờ là trạng thái riêng, không đếm vào email đã giao.
 */
export const OutboxStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED', 'SKIPPED']);
export type OutboxStatusValue = z.output<typeof OutboxStatusSchema>;

/**
 * Soi gương enum `EmailType` của Prisma — thứ tự giữ đúng schema.prisma để
 * Select lọc của admin liệt kê cùng thứ tự với DB. Thêm loại email mới là
 * thêm ở CẢ HAI chỗ (int test của API đối chiếu hai enum).
 */
export const EmailTypeSchema = z.enum([
  'BOOKING_CONFIRMATION',
  'BOOKING_REFUNDED',
  'REVIEW_APPROVED',
  'REVIEW_REJECTED',
  'ENQUIRY_RECEIVED',
  'ENQUIRY_ADMIN_ALERT',
  'CANCELLATION_REQUESTED',
  'CANCELLATION_APPROVED',
  'CANCELLATION_DENIED',
  'NEWSLETTER_WELCOME',
  'EMAIL_CHANGED',
  'PASSWORD_RESET',
  'EMAIL_VERIFICATION',
  'EMAIL_OTP',
]);
export type EmailTypeValue = z.output<typeof EmailTypeSchema>;

/**
 * Số lần thử tối đa trước khi worker park một row thành FAILED.
 *
 * Vì sao là HẰNG của contract chứ không echo qua từng response (spec §3-F7
 * yêu cầu chọn một): đây là hằng của SẢN PHẨM như `STATS_WINDOW_DAYS` — không
 * đổi theo row, không đổi theo request. Echo trong response là lặp một con số
 * 20 lần mỗi trang và client vẫn phải có fallback khi thiếu; đặt ở contract
 * thì worker (`apps/api/src/worker/outbox.service.ts`) và cột "3/5" của admin
 * đọc CÙNG một nguồn, đổi ở một chỗ là cả hai đổi theo.
 */
export const OUTBOX_MAX_ATTEMPTS = 5;

/**
 * Query cho `admin.outbox.list`. Phân trang dùng chung `AdminPageQuerySchema`
 * (field gõ kiểu thuần — ZodSmartCoercionPlugin ép query string ở server).
 *
 * `search` khớp KHÔNG phân biệt hoa/thường trên BỐN chỗ: `dedupeKey`,
 * `payload.code` (mã booking `BK-XXXX`), `payload.email` và `payload.to`.
 * Vòng vá review F7: bản đầu chỉ khớp `dedupeKey`, mà key thật theo quy ước
 * `docs/conventions/outbox-dedupe-key.md` là `<event>:<uuid>` — KHÔNG bao giờ
 * chứa mã người đọc, nên đúng câu hỏi của vụ 20/08 ("email của đơn BK-XXXX
 * đâu rồi") lại không tra được.
 */
export const AdminOutboxListQuerySchema = AdminPageQuerySchema.extend({
  status: OutboxStatusSchema.optional(),
  type: EmailTypeSchema.optional(),
  search: z.string().min(1).max(120).optional(),
});
export type AdminOutboxListQuery = z.output<typeof AdminOutboxListQuerySchema>;

/**
 * Một row outbox cho admin. `recipient` là email đích rút từ payload bằng
 * ĐÚNG luật worker gửi (`worker/recipient.ts`: `to` thắng `email`) — null khi
 * payload không có địa chỉ nào. `payload` là JSON để soi, không phải giao
 * diện (spec §2.3), drawer in thụt lề chứ không map thành form.
 *
 * `payload` và `dedupeKey` đã qua REDACT ở API (vòng vá review F7): email
 * PASSWORD_RESET mang URL có token, EMAIL_OTP mang mã — và cả hai còn nằm
 * trong dedupeKey. Bề mặt admin không được là nơi một admin cầm được link
 * reset của admin khác; khoá `url`/`otp`/`token` thành `[redacted]`, dedupeKey
 * của các loại đó chỉ còn tiền tố. Xem `outbox-row.ts` bên API.
 */
export const OutboxRowSchema = z.object({
  id: z.uuid(),
  type: EmailTypeSchema,
  status: OutboxStatusSchema,
  /**
   * Số lần giao THẤT BẠI đã ghi nhận. Retry đặt lại 0 (ngân sách mới đủ
   * `OUTBOX_MAX_ATTEMPTS`), nên row SENT với attempts 0 có hai nghĩa — đọc
   * cùng `lastError` để phân biệt (xem dưới).
   */
  attempts: z.int().nonnegative(),
  dedupeKey: z.string().min(1).max(200),
  /**
   * Lỗi của lượt giao gần nhất. Retry GIỮ lại và worker chỉ ghi đè khi lượt
   * mới cũng hỏng — nên `lastError != null` trên row PENDING/SENT có
   * `attempts = 0` là DẤU VẾT DUY NHẤT rằng row từng được retry (không có
   * cột retriedAt; vòng vá review F7 ghi rõ để UI diễn giải đúng).
   */
  lastError: z.string().max(1000).nullable(),
  createdAt: z.iso.datetime(),
  /** Mốc SENT; null khi chưa giao xong (PENDING/FAILED). */
  processedAt: z.iso.datetime().nullable(),
  recipient: z.string().nullable(),
  payload: z.json(),
});
export type OutboxRow = z.output<typeof OutboxRowSchema>;

/** Input của `admin.outbox.retry` — server action admin re-parse bằng chính schema này. */
export const AdminOutboxRetryInputSchema = z.object({ id: z.uuid() });
export type AdminOutboxRetryInput = z.output<typeof AdminOutboxRetryInputSchema>;
