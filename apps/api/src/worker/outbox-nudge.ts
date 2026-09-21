import { Logger } from '@nestjs/common';

/**
 * Tên queue drain outbox — khai ở ĐÂY chứ không ở `start-worker.ts` để hai
 * phía (kẻ đăng ký và kẻ đẩy) đọc cùng một hằng, không phải hai chuỗi giống
 * nhau ở hai file.
 */
export const OUTBOX_DRAIN_QUEUE = 'outbox-drain';

/** Hàm đẩy một job vào queue — thực chất là `boss.send` của vòng worker. */
export type OutboxNudgeSender = (queue: string) => Promise<unknown>;

/** Kết quả một lượt nudge — trả về để test ghim được, người gọi bỏ qua cũng không sao. */
export type OutboxNudgeResult = 'queued' | 'no-worker' | 'failed';

/**
 * Cầu nối một chiều giữa đường REQUEST và vòng worker pg-boss.
 *
 * ## Vì sao cần
 *
 * Outbox drain chạy theo cron `* * * * *` — mỗi phút là granularity nhỏ nhất
 * pg-boss cho. Với email không ai ngồi chờ (xác nhận đặt chỗ) thì đó là đúng
 * nhịp. Nhưng OTP đăng ký và link đặt lại mật khẩu thì có một người đang nhìn
 * màn hình "check your email", và 1–1,5 phút ở đó dài như một lỗi. Nudge đẩy
 * thêm MỘT job vào chính queue ấy để lượt drain chạy ngay, không đợi tick kế.
 *
 * ## Vì sao là registry cấp module chứ không phải DI
 *
 * Người gọi là `auth.config.ts` — callback của plugin better-auth ở tầng
 * module, KHÔNG nằm trong container Nest và ghi bằng `prisma` trần, nên không
 * inject được gì vào đó. Vòng worker thì ngược lại: nó sở hữu instance pg-boss
 * và tự đăng ký vào đây lúc khởi động.
 *
 * Tái dùng ĐÚNG instance của worker (chứ không tự mở một client pg-boss thứ
 * hai) là có chủ đích: prod chạy `WORKER_INLINE=true` nên worker ở cùng tiến
 * trình API, và pool Postgres của dự án chốt ~10 kết nối (CLAUDE.md) — mở thêm
 * một client chỉ để INSERT một dòng job là trả giá sai chỗ.
 *
 * ## BEST-EFFORT, và đó là toàn bộ hợp đồng
 *
 * Cron mỗi phút vẫn là lưới cuối, nên mọi thất bại ở đây đều nuốt: không
 * worker nào đăng ký (API chạy tách khỏi worker process — cấu hình hợp lệ),
 * pg-boss lỗi, queue chưa tạo… đều chỉ log rồi đi tiếp. Để một lỗi pg-boss lan
 * ra ngoài `sendVerificationOTP` là biến "email tới chậm một phút" thành
 * "không đăng ký được" — đắt hơn hẳn thứ ta đang đi sửa. Spec ghim điều này.
 *
 * Không cần khoá chống trùng: queue `outbox-drain` khai `policy: 'short'`, nên
 * job mới không xếp chồng khi tick cũ còn queued.
 */
let sender: OutboxNudgeSender | null = null;

const logger = new Logger('OutboxNudge');

/** Vòng worker gọi lúc khởi động, sau khi queue drain đã tồn tại. */
export function registerOutboxNudge(fn: OutboxNudgeSender): void {
  sender = fn;
}

/** Vòng worker gọi lúc dừng — nudge sau đó không đẩy vào một instance đã stop. */
export function clearOutboxNudge(): void {
  sender = null;
}

/** Xin vòng worker drain outbox NGAY. Không bao giờ ném. */
export async function nudgeOutboxDrain(): Promise<OutboxNudgeResult> {
  const fn = sender;
  if (!fn) return 'no-worker';
  try {
    await fn(OUTBOX_DRAIN_QUEUE);
    return 'queued';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    logger.warn(`Không đẩy được job drain (${message}) — chờ lượt cron kế`);
    return 'failed';
  }
}
