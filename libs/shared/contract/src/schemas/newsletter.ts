import { z } from 'zod';

/**
 * Đăng ký nhận bản tin (spec §4.4, nửa đầu) — endpoint GHI công khai thứ hai
 * khách CHƯA đăng nhập gọi được, cùng khuôn chống spam với enquiry (Task 4):
 * honeypot không reject, throttle riêng theo IP.
 */
export const SubscribeInputSchema = z.object({
  email: z.email().max(200),
  source: z.string().trim().max(40).optional(),
  /**
   * HONEYPOT — cùng cơ chế với enquiry: không reject, controller trả kết quả
   * GIẢ giống hệt thành công để bot không phân biệt được.
   */
  website: z.string().optional(),
});

export type SubscribeInput = z.infer<typeof SubscribeInputSchema>;

/**
 * Output LUÔN `{subscribed: true}`, kể cả email đã tồn tại hoặc bị honeypot
 * bắt. Đây là chống dò email: nếu response khác nhau giữa "mới" và "đã có",
 * ai cũng dùng endpoint này để kiểm tra một địa chỉ có trong hệ thống hay
 * không.
 */
export const SubscribeResultSchema = z.object({ subscribed: z.literal(true) });

export type SubscribeResult = z.infer<typeof SubscribeResultSchema>;

/**
 * Huỷ đăng ký bản tin (spec §4.4, nửa sau) — v2 làm hơn Nexora (Nexora không
 * có unsubscribe công khai, rủi ro pháp lý GDPR/CAN-SPAM). Input DÙNG CHUNG
 * cho cả GET xác nhận lẫn POST thực thi: `id` (subscriberId) + `token` (HMAC
 * tự xác thực, xem `unsubscribe-token.ts`) — cả hai đều lấy thẳng từ link
 * trong email, không cần đăng nhập.
 */
export const UnsubscribeInputSchema = z.object({
  id: z.uuid(),
  token: z.string().min(1).max(200),
});

export type UnsubscribeInput = z.infer<typeof UnsubscribeInputSchema>;

/**
 * Output của GET — dữ liệu cho trang xác nhận, KHÔNG tự huỷ đăng ký (email
 * client như Gmail/Outlook prefetch mọi link trong thư để quét virus; nếu GET
 * tự huỷ thì khách bị huỷ mà chưa hề bấm gì). `alreadyUnsubscribed` cho FE đổi
 * copy nút khi khách bấm lại link cũ sau khi đã huỷ rồi.
 */
export const UnsubscribeConfirmResultSchema = z.object({
  email: z.string(),
  alreadyUnsubscribed: z.boolean(),
});

export type UnsubscribeConfirmResult = z.infer<typeof UnsubscribeConfirmResultSchema>;

/** Output của POST — luôn `true` khi thành công, kể cả gọi lần hai (idempotent). */
export const UnsubscribeResultSchema = z.object({ unsubscribed: z.literal(true) });

export type UnsubscribeResult = z.infer<typeof UnsubscribeResultSchema>;

/**
 * Đăng ký LẠI sau khi đã huỷ (vá review Task 6 — Khoản 1: "đăng ký lại sau
 * khi huỷ là ngõ cụt câm lặng"). Kịch bản: khách huỷ → đổi ý → tự điền lại
 * form subscribe → `subscribe()` cố tình KHÔNG reset `unsubscribedAt` (chống
 * đăng ký hộ người lạ khi hệ thống chưa có double opt-in, xem JSDoc
 * `NewsletterService.subscribe`) → khách không bao giờ nhận gì và không có
 * đường tự sửa.
 *
 * Input DÙNG LẠI NGUYÊN `UnsubscribeInputSchema` (không tạo schema mới trùng
 * shape): chính token HMAC của unsubscribe (`id` + `token`) chứng minh người
 * bấm thật sự cầm link gửi tới hộp thư đó — thay thế cho double opt-in mà v2
 * chưa xây.
 */
export const ResubscribeInputSchema = UnsubscribeInputSchema;

export type ResubscribeInput = z.infer<typeof ResubscribeInputSchema>;

/**
 * Output — LUÔN `{subscribed:true}` sau khi token hợp lệ, DÙNG LẠI đúng
 * `SubscribeResultSchema` (cùng shape, cùng tinh thần chống dò: không tiết lộ
 * subscriber đang active hay vừa được reset).
 */
export const ResubscribeResultSchema = SubscribeResultSchema;

export type ResubscribeResult = z.infer<typeof ResubscribeResultSchema>;
