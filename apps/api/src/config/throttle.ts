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
 * Trần MẶC ĐỊNH cho endpoint GHI ĐÃ-AUTH (W1 khai sinh, W2/ADR-0037 thành
 * mặc định toàn cục qua DefaultWriteThrottlerGuard — không còn khai từng
 * route). Bucket theo `user.id` — theo IP thì NAT chung IP bị khoá oan theo
 * nhau còn pool IP xoay vòng lách được. 20/60s: người thật không ghi 21 lần
 * một phút; mỗi route một bucket riêng (generateKey theo handler) nên trần
 * không cộng dồn chéo endpoint.
 */
export const AUTHED_WRITE_THROTTLE = { limit: 20, ttl: 60_000 } as const;

/**
 * Route webhook provider (W1, audit 05/09 cụm 2): trần RỘNG TAY theo IP — trần
 * phải TỒN TẠI vì webhook PayPal verify bằng một round-trip mạng tới PayPal,
 * không trần là ai cũng đốt được quota đó ẩn danh miễn phí. Nhưng delivery
 * THẬT của provider dùng chung bucket với kẻ dò (chữ ký chỉ kiểm được sau khi
 * guard đã đếm), và 429 là non-2xx → provider coi là fail rồi retry chồng.
 * Ca nguy hiểm là burst redeliver khi API Render vừa thức sau khi ngủ (mọi
 * event dồn trong lúc ngủ về cùng lúc từ dải IP egress hẹp của Stripe): 600/phút
 * (vòng vá review 06/09, bản đầu 120) đủ cho cả ngày event dồn lại, vẫn chặn
 * được kẻ đốt quota verify — mỗi request rác ở PayPal nay bị kiểm rẻ chặn
 * trước round-trip nên 600 request/phút không đáng kể.
 */
export const WEBHOOK_THROTTLE = { limit: 600, ttl: 60_000 } as const;

/**
 * Trần Nest riêng cho AuthController (W2 mục 3, theo tinh thần ADR-0037):
 * CHỈ đếm non-GET (guard bỏ qua GET/HEAD/OPTIONS — `get-session` đi từ SSR
 * của web qua egress IP DÙNG CHUNG của Vercel, đếm nó theo IP là tự khoá
 * site). 60/60s theo IP là ĐÁY chống flood cho cả cụm /api/auth/* (một
 * handler wildcard = một bucket); lớp mịn theo-path (sign-in 3/10s…) là
 * rate limiter của chính Better Auth, nay đã bật tường minh + biết proxy.
 */
export const AUTH_THROTTLE = { limit: 60, ttl: 60_000 } as const;
