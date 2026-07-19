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
