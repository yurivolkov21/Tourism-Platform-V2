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
