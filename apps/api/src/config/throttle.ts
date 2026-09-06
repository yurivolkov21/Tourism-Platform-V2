/**
 * Trần tần suất cho endpoint GHI CÔNG KHAI (không cần đăng nhập).
 *
 * 5 request / 60 giây / IP — khớp giá trị Nexora dùng cho form enquiry và
 * newsletter. Người thật không bao giờ gửi form 6 lần trong một phút; bot
 * thì có.
 *
 * Cố ý KHÔNG gắn throttle toàn cục: endpoint đọc (catalogue) và endpoint đã
 * auth (booking, admin) có mô hình sử dụng khác hẳn, gắn chung một trần sẽ
 * chặn nhầm người dùng thật.
 *
 * ttl tính bằng MILLISECOND (@nestjs/throttler v6+), không phải giây.
 */
export const PUBLIC_WRITE_THROTTLE = { limit: 5, ttl: 60_000 } as const;

/** Ký upload media (ADR-0021): 5 ảnh/review + đổi ảnh/retry + NAT chung IP —
 *  trần public 5/60s vừa khít mức dùng hợp lệ nên phải có headroom riêng.
 *  Endpoint đã authed; 20/60s vẫn chặn được spam ký hàng loạt. */
export const SIGN_UPLOAD_THROTTLE = { limit: 20, ttl: 60_000 } as const;

/**
 * Route webhook provider (W1, audit 05/09 cụm 2): trần RỘNG TAY theo IP —
 * Stripe/PayPal retry burst hợp lệ không bao giờ chạm 120/phút cho một shop
 * cỡ này, nhưng trần phải TỒN TẠI: webhook PayPal verify bằng một round-trip
 * mạng tới PayPal, không trần là ai cũng đốt được quota đó ẩn danh miễn phí.
 */
export const WEBHOOK_THROTTLE = { limit: 120, ttl: 60_000 } as const;
