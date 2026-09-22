import { Logger } from '@nestjs/common';
import type { DepartureRefundJob } from './departure-refund.service.js';
import { DEPARTURE_REFUND_QUEUE } from './departure-refund.service.js';

/**
 * Cầu nối một chiều từ đường REQUEST (admin bấm "huỷ chuyến") sang vòng worker
 * pg-boss — cùng khuôn `outbox-nudge.ts`, và **khác nó ở đúng một điểm quyết
 * định mọi thứ còn lại**.
 *
 * `nudgeOutboxDrain` là BEST-EFFORT: cron mỗi phút vẫn drain, nên một lượt đẩy
 * hỏng chỉ làm email tới chậm. Ở đây KHÔNG có cron nào chạy sau lưng: đẩy hỏng
 * nghĩa là một khách đã trả tiền cho chuyến vừa bị huỷ sẽ không ai hoàn cho.
 * Nên hàm này KHÔNG nuốt lỗi — nó trả về danh sách booking đẩy KHÔNG được, và
 * chỗ gọi phải làm gì đó với danh sách ấy (log mức error, và lưới cuối là
 * {@link DepartureRefundService.sweepStranded} chạy theo cron `booking-sweep`).
 *
 * Vì sao vẫn là registry cấp module chứ không phải DI: vòng worker sở hữu
 * instance pg-boss và tự đăng ký vào đây lúc khởi động. Prod chạy
 * `WORKER_INLINE=true` nên worker ở cùng tiến trình API; mở thêm một client
 * pg-boss thứ hai chỉ để INSERT một dòng job là trả giá sai chỗ khi pool
 * Postgres của dự án chốt ~10 kết nối (CLAUDE.md).
 */
export type DepartureRefundSender = (queue: string, job: DepartureRefundJob) => Promise<unknown>;

let sender: DepartureRefundSender | null = null;

const logger = new Logger('DepartureRefundQueue');

/** Vòng worker gọi lúc khởi động, SAU khi queue đã tồn tại. */
export function registerDepartureRefundSender(fn: DepartureRefundSender): void {
  sender = fn;
}

/** Vòng worker gọi lúc dừng. */
export function clearDepartureRefundSender(): void {
  sender = null;
}

/**
 * Đẩy một job cho MỖI booking cần hoàn tiền. Trả về những job KHÔNG đẩy được —
 * mảng rỗng nghĩa là tất cả đã nằm trong hàng đợi.
 *
 * Không ném: lượt huỷ đã commit rồi, và ném ở đây sẽ biến "chuyến đã huỷ, vài
 * job chưa xếp" thành "admin thấy lỗi 500 và không biết chuyến đã huỷ hay
 * chưa". Chỗ gọi log và lưới cron dọn nốt.
 */
export async function enqueueDepartureRefunds(
  jobs: DepartureRefundJob[],
): Promise<DepartureRefundJob[]> {
  if (jobs.length === 0) return [];
  const fn = sender;
  if (!fn) {
    logger.error(
      `Không có worker nào đăng ký — ${jobs.length} job hoàn tiền CHƯA được xếp hàng; chờ lượt quét booking-sweep`,
    );
    return jobs;
  }
  const failed: DepartureRefundJob[] = [];
  for (const job of jobs) {
    try {
      await fn(DEPARTURE_REFUND_QUEUE, job);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      logger.error(`Không đẩy được job hoàn tiền cho booking ${job.bookingId}: ${message}`);
      failed.push(job);
    }
  }
  return failed;
}
