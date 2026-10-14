import {
  CATCH_UP_SEND_OPTIONS,
  type CatchUpSend,
  describeCatchUp,
  sendDailyCatchUp,
} from './daily-catch-up.js';

/**
 * Lượt chạy bù job dọn dẹp hằng ngày khi worker khởi động (G41, ADR-0024 AMEND 5).
 *
 * Khoá ngày là hành vi của pg-boss (chỉ mục duy nhất `job_i4`), nên nó được soi ở
 * `daily-catch-up.int.spec.ts` trên pg-boss thật. Ở đây ghim hợp đồng của phía ta: gửi
 * gì, vào đâu, và KHÔNG BAO GIỜ ném — `startWorker` chạy sau `app.listen` của API, một
 * lỗi lọt ra ngoài là cả tiến trình API sập vì một job dọn dẹp.
 */
describe('CATCH_UP_SEND_OPTIONS', () => {
  it('khoá theo ngày UTC (86400 giây) với khoá riêng, hẹn chạy sau một phút', () => {
    expect(CATCH_UP_SEND_OPTIONS).toEqual({
      singletonKey: 'catch-up',
      singletonSeconds: 86_400,
      startAfter: 60,
    });
  });
});

describe('sendDailyCatchUp', () => {
  it('gửi một job bù rỗng vào từng queue, cùng tuỳ chọn khoá ngày', async () => {
    const send = vi.fn<CatchUpSend>().mockResolvedValue('job-id');

    const result = await sendDailyCatchUp(send, ['outbox-purge', 'enquiry-retention']);

    expect(send.mock.calls).toEqual([
      ['outbox-purge', {}, CATCH_UP_SEND_OPTIONS],
      ['enquiry-retention', {}, CATCH_UP_SEND_OPTIONS],
    ]);
    expect(result).toEqual({
      queued: ['outbox-purge', 'enquiry-retention'],
      skipped: [],
      failed: [],
    });
  });

  it('pg-boss trả null (hôm nay queue đã có job bù) → bỏ qua, không phải lỗi', async () => {
    const send = vi.fn<CatchUpSend>(async (queue) => (queue === 'media-gc' ? null : 'job-id'));

    await expect(sendDailyCatchUp(send, ['outbox-purge', 'media-gc'])).resolves.toEqual({
      queued: ['outbox-purge'],
      skipped: ['media-gc'],
      failed: [],
    });
  });

  it('một queue gửi hỏng không chặn queue khác, và lỗi không lọt ra ngoài', async () => {
    const send = vi.fn<CatchUpSend>(async (queue) => {
      if (queue === 'enquiry-retention') throw new Error('Connection terminated unexpectedly');
      return 'job-id';
    });

    await expect(
      sendDailyCatchUp(send, ['outbox-purge', 'enquiry-retention', 'media-gc']),
    ).resolves.toEqual({
      queued: ['outbox-purge', 'media-gc'],
      skipped: [],
      failed: [{ queue: 'enquiry-retention', reason: 'Connection terminated unexpectedly' }],
    });
  });

  // `boss.send` là hàm async nên lỗi của nó về dạng promise bị từ chối; nhưng hàm gửi được
  // truyền vào từ ngoài, và một hàm ném ĐỒNG BỘ không được làm vỡ lời hứa "không ném".
  it('hàm gửi ném đồng bộ cũng bị bắt, kể cả giá trị ném không phải Error', async () => {
    const send: CatchUpSend = (queue) => {
      if (queue === 'outbox-purge') throw 'pool ended';
      return Promise.resolve('job-id');
    };

    await expect(sendDailyCatchUp(send, ['outbox-purge', 'media-gc'])).resolves.toEqual({
      queued: ['media-gc'],
      skipped: [],
      failed: [{ queue: 'outbox-purge', reason: 'pool ended' }],
    });
  });
});

describe('describeCatchUp', () => {
  it('một dòng log: queue vừa gửi, queue hôm nay đã có, queue hỏng kèm lý do', () => {
    expect(
      describeCatchUp({
        queued: ['outbox-purge'],
        skipped: ['media-gc'],
        failed: [{ queue: 'enquiry-retention', reason: 'boom' }],
      }),
    ).toBe(
      'chạy bù hằng ngày — gửi: outbox-purge · hôm nay đã có: media-gc · hỏng: enquiry-retention (boom)',
    );
  });

  it('chỉ nêu phần có mặt', () => {
    expect(
      describeCatchUp({ queued: [], skipped: ['outbox-purge', 'enquiry-retention'], failed: [] }),
    ).toBe('chạy bù hằng ngày — hôm nay đã có: outbox-purge, enquiry-retention');
  });
});
