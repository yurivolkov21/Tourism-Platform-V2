import {
  clearOutboxNudge,
  nudgeOutboxDrain,
  OUTBOX_DRAIN_QUEUE,
  registerOutboxNudge,
} from './outbox-nudge.js';

/**
 * Cầu nối giữa đường REQUEST (tạo dòng outbox) và vòng worker pg-boss.
 *
 * Luật sống chết của module này: nó là BEST-EFFORT. Cron mỗi phút vẫn là lưới
 * cuối, nên không lượt nudge nào được phép làm hỏng thứ gọi nó — một lỗi
 * pg-boss mà ném ra ngoài `sendVerificationOTP` sẽ biến "email tới chậm một
 * phút" thành "không đăng ký được". Ba test dưới ghim đúng điều đó.
 */

afterEach(() => {
  clearOutboxNudge();
});

describe('nudgeOutboxDrain', () => {
  it('chưa có worker nào đăng ký → báo no-worker, không ném', async () => {
    // Tiến trình API chạy KHÔNG kèm worker inline (worker process riêng) là
    // cấu hình hợp lệ — lúc đó không có gì để đẩy, và đó không phải lỗi.
    await expect(nudgeOutboxDrain()).resolves.toBe('no-worker');
  });

  it('có worker → đẩy đúng queue outbox-drain và báo queued', async () => {
    const calls: string[] = [];
    registerOutboxNudge(async (queue) => {
      calls.push(queue);
    });

    await expect(nudgeOutboxDrain()).resolves.toBe('queued');
    expect(calls).toEqual([OUTBOX_DRAIN_QUEUE]);
  });

  it('worker ném lỗi → nuốt, báo failed, KHÔNG lan ra người gọi', async () => {
    registerOutboxNudge(async () => {
      throw new Error('pg-boss down');
    });

    // Không `rejects` — cả điểm của module là lỗi dừng lại ở đây.
    await expect(nudgeOutboxDrain()).resolves.toBe('failed');
  });

  it('clearOutboxNudge gỡ đăng ký — worker dừng thì nudge thôi gọi vào chỗ chết', async () => {
    registerOutboxNudge(async () => {
      throw new Error('worker đã dừng');
    });
    clearOutboxNudge();

    await expect(nudgeOutboxDrain()).resolves.toBe('no-worker');
  });
});
