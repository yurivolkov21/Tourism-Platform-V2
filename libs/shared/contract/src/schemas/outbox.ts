import { z } from 'zod';

/**
 * Vùng outbox email cho admin (spec P4c §3-F7) — bề mặt ĐỌC + MỘT hành vi ghi
 * (`retry`) trên bảng `outbox` mà worker pg-boss drain mỗi phút (ADR-0007).
 *
 * Contract KHÔNG biết gì về worker: retry chỉ là "đưa hàng về PENDING", worker
 * tự nhặt ở lượt kế. Không có endpoint xoá — FAILED giữ lại để triage (spec
 * §2.4), SENT có purge cron dọn.
 */

/** Soi gương enum `OutboxStatus` của Prisma — trạng thái vòng đời một row. */
export const OutboxStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED']);
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
 * Query cho `admin.outbox.list`. Cùng hình phân trang với mọi list admin
 * (field gõ kiểu thuần — ZodSmartCoercionPlugin ép query string ở server).
 * `search` khớp `dedupeKey` contains: dedupeKey mang mã booking/id enquiry
 * (docs/conventions/outbox-dedupe-key.md) nên đó là cách tra "email của đơn
 * BK-XXXX đâu rồi" mà vụ 20/08 phải soi bằng SQL tay.
 */
export const AdminOutboxListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20),
  status: OutboxStatusSchema.optional(),
  type: EmailTypeSchema.optional(),
  search: z.string().min(1).max(120).optional(),
});
export type AdminOutboxListQuery = z.output<typeof AdminOutboxListQuerySchema>;

/**
 * Một row outbox cho admin. `recipient` là email đích rút từ payload bằng
 * ĐÚNG luật worker gửi (`worker/recipient.ts`: `to` thắng `email`) — null khi
 * payload không có địa chỉ nào. `payload` là JSON nguyên văn: dữ liệu để soi,
 * không phải giao diện (spec §2.3), drawer in thụt lề chứ không map thành form.
 */
export const OutboxRowSchema = z.object({
  id: z.uuid(),
  type: EmailTypeSchema,
  status: OutboxStatusSchema,
  /** Số lần giao THẤT BẠI đã ghi nhận (row SENT ở lần đầu mang 0). */
  attempts: z.int().nonnegative(),
  dedupeKey: z.string().min(1).max(200),
  /** Lỗi của lượt giao gần nhất — retry GIỮ lại cho tới khi worker ghi đè. */
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
