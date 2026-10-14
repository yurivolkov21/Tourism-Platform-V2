import type { SendOptions } from 'pg-boss';

/**
 * Chạy bù job dọn dẹp hằng ngày khi worker khởi động (G41, ADR-0024 AMEND 5).
 *
 * Cron của pg-boss không bù mốc đã lỡ: nó chỉ gửi job khi mốc gần nhất cách hiện tại dưới
 * 60 giây, mà API gói free ngủ sau 15 phút không có request — ba job 03:00–04:00 UTC lỡ
 * lượt mỗi ngày máy ngủ đúng giờ ấy. Mỗi lần khởi động, `startWorker` gửi vào mỗi queue
 * dọn dẹp một job bù với khoá theo ngày:
 *
 * - `singletonSeconds: 86400` → pg-boss đặt `singleton_on` của job vào 00:00 UTC của ngày
 *   gửi; chỉ mục duy nhất của nó chặn job thứ hai cùng ngày, kể cả khi job đầu đã chạy
 *   xong. Vậy chỉ lần thức ĐẦU TIÊN trong ngày thật sự bù, dù máy khởi động bao nhiêu lần.
 * - `singletonKey: 'catch-up'` → khác khoá rỗng của job do cron gửi, nên policy `short`
 *   không gộp job bù vào một job cron đang chờ (hay ngược lại).
 * - `startAfter: 60` → request đánh thức máy không phải chia 0,1 CPU và pool Prisma với lượt
 *   dọn. Job đã nằm trong DB, nên tiến trình có tắt trước giờ thì lần thức sau chạy nó.
 */
export const CATCH_UP_SEND_OPTIONS = {
  singletonKey: 'catch-up',
  singletonSeconds: 86_400,
  startAfter: 60,
} as const satisfies SendOptions;

/** Gửi một job vào queue — trả id job, hoặc `null` khi pg-boss bỏ lượt gửi vì trùng khoá. */
export type CatchUpSend = (
  queue: string,
  data: object,
  options: SendOptions,
) => Promise<string | null>;

export type CatchUpResult = {
  /** Queue vừa nhận job bù — lần khởi động đầu tiên của ngày (UTC). */
  queued: string[];
  /** Queue hôm nay đã có job bù: pg-boss bỏ lượt gửi vì trùng khoá ngày. */
  skipped: string[];
  /** Queue gửi hỏng — chỉ để ghi log; lần thức sau hay lượt cron kế tiếp sẽ bù. */
  failed: { queue: string; reason: string }[];
};

/**
 * Gửi job bù vào từng queue. KHÔNG BAO GIỜ ném: `startWorker` chạy sau `app.listen` của
 * API, nên một lỗi lọt ra ngoài là cả tiến trình API sập vì một job dọn dẹp. Queue phải đã
 * `createQueue` — đẩy vào queue chưa tồn tại là lỗi (rơi vào `failed`).
 */
export async function sendDailyCatchUp(
  send: CatchUpSend,
  queues: readonly string[],
): Promise<CatchUpResult> {
  // Bọc `async` để cả hàm gửi ném ĐỒNG BỘ cũng thành promise bị từ chối, không vỡ ra ngoài.
  const settled = await Promise.allSettled(
    queues.map(async (queue) => send(queue, {}, CATCH_UP_SEND_OPTIONS)),
  );
  const result: CatchUpResult = { queued: [], skipped: [], failed: [] };
  settled.forEach((outcome, index) => {
    const queue = queues[index] as string;
    if (outcome.status === 'rejected') {
      const reason =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      result.failed.push({ queue, reason });
    } else if (outcome.value === null) {
      result.skipped.push(queue);
    } else {
      result.queued.push(queue);
    }
  });
  return result;
}

/** Một dòng log cho lượt bù — chỉ nêu phần có mặt. */
export function describeCatchUp(result: CatchUpResult): string {
  const parts = [
    result.queued.length > 0 ? `gửi: ${result.queued.join(', ')}` : null,
    result.skipped.length > 0 ? `hôm nay đã có: ${result.skipped.join(', ')}` : null,
    result.failed.length > 0
      ? `hỏng: ${result.failed.map(({ queue, reason }) => `${queue} (${reason})`).join(', ')}`
      : null,
  ].filter((part) => part !== null);
  return `chạy bù hằng ngày — ${parts.join(' · ')}`;
}
