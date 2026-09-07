/**
 * Trần tần suất cho endpoint GHI CÔNG KHAI (không cần đăng nhập).
 *
 * 5 request / 60 giây / IP — khớp giá trị Nexora dùng cho form enquiry và
 * newsletter. Người thật không bao giờ gửi form 6 lần trong một phút; bot
 * thì có.
 *
 * Từ ADR-0037 đây là DEFAULT của `ThrottlerModule` — guard toàn cục
 * `DefaultThrottlerGuard` áp nó cho mọi route ghi `@Public()` không khai
 * gì, và nâng lên `AUTHED_WRITE_THROTTLE`/`ADMIN_WRITE_THROTTLE` khi request
 * có session (bản đầu của file này viết "cố ý KHÔNG gắn toàn cục" — câu đó
 * lỗi thời từ 06/09, vòng vá review W2). GET public từ W4 đếm bucket `read`
 * riêng (PUBLIC_READ_THROTTLE bên dưới); GET có session không đếm.
 *
 * ttl tính bằng MILLISECOND (@nestjs/throttler v6+), không phải giây.
 */
export const PUBLIC_WRITE_THROTTLE = { limit: 5, ttl: 60_000 } as const;

/**
 * Trần ĐỌC công khai (W4 R1, ADR-0037 AMEND 2): GET trên route `@Public()`
 * đếm bucket TÊN RIÊNG `read` theo IP, MỘT bucket cho mọi route đọc —
 * `/tours` + detail + related ≈ 6 call/trang nên 300/phút là ~50 trang/phút
 * một IP: người thật không tới, script cào tuần tự thì chạm. Đây là lưới
 * chống cạn pool DB (~10 connection), không phải chống đọc; GET có session
 * và admin GET KHÔNG đếm (đối tượng của trần ghi theo user).
 */
export const PUBLIC_READ_THROTTLE = { limit: 300, ttl: 60_000 } as const;

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
 * Trần ghi cho ADMIN trên `/api/admin/*` (ADR-0037 AMEND 1): moderator dọn
 * hàng đợi (duyệt 21 review/phút, retry cả loạt outbox) là mức dùng hợp lệ mà
 * 20/60s của khách sẽ chặn oan rồi block thêm 60s. Vẫn theo `user.id`; 60/60s
 * đủ cho tay người, vẫn chặn script chạy vòng.
 */
export const ADMIN_WRITE_THROTTLE = { limit: 60, ttl: 60_000 } as const;

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
 * site). 60/60s theo IP cho TỪNG PATH (ADR-0037 AMEND 1: guard nối pathname
 * vào key khi handler là wildcard — bản đầu một bucket cho cả cụm
 * sign-in/sign-up/OTP/sign-out, CGNAT chạm 60/phút là khoá đăng nhập cả
 * pool); lớp mịn theo-path (sign-in 3/10s…) là rate limiter của chính
 * Better Auth, nay đã bật tường minh + biết proxy.
 */
export const AUTH_THROTTLE = { limit: 60, ttl: 60_000 } as const;
