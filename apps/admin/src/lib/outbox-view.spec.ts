import { OUTBOX_MAX_ATTEMPTS, type OutboxRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { canRetry, outboxStatusBadgeVariant, toOutboxRowVM } from './outbox-view';

/**
 * Mapper hiển thị bảng `/outbox` (spec P4c §3-F7) — THUẦN, ngoài React: bảng
 * chỉ render VM có sẵn, không tự format ngày, không tự đoán hàng nào retry
 * được, không tự ghép "3/5".
 */
const t = messages.admin.outbox;

const FAILED: OutboxRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  type: 'BOOKING_CONFIRMATION',
  status: 'FAILED',
  attempts: 5,
  dedupeKey: 'booking-confirmed:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  lastError: 'Resend: 401 invalid api key',
  createdAt: '2026-09-01T10:00:00.000Z',
  processedAt: null,
  recipient: 'ada@example.com',
  payload: { code: 'BK-ABCD1234', email: 'ada@example.com', nested: { n: 1 } },
};

describe('toOutboxRowVM', () => {
  it('hàng FAILED: nhãn type/status từ i18n, attempts "5/5", ngày UTC, retry được', () => {
    expect(toOutboxRowVM(FAILED)).toEqual({
      id: FAILED.id,
      type: 'BOOKING_CONFIRMATION',
      typeLabel: t.type.BOOKING_CONFIRMATION,
      recipient: 'ada@example.com',
      status: 'FAILED',
      statusLabel: t.status.FAILED,
      attempts: 5,
      attemptsLabel: `5/${OUTBOX_MAX_ATTEMPTS}`,
      lastError: 'Resend: 401 invalid api key',
      created: '1 Sep 2026, 10:00 UTC',
      processed: null,
      dedupeKey: 'booking-confirmed:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      payload: FAILED.payload,
      retried: false,
      canRetry: true,
    });
  });

  it('hàng PENDING: attempts "2/5" (còn lượt), chưa có processed, KHÔNG retry được', () => {
    const vm = toOutboxRowVM({ ...FAILED, status: 'PENDING', attempts: 2 });
    expect(vm.attemptsLabel).toBe(`2/${OUTBOX_MAX_ATTEMPTS}`);
    expect(vm.processed).toBeNull();
    expect(vm.canRetry).toBe(false);
  });

  it('hàng SENT đi ngay lần đầu: attempts nói "First try" thay vì "0/5" vô nghĩa', () => {
    const vm = toOutboxRowVM({
      ...FAILED,
      status: 'SENT',
      attempts: 0,
      lastError: null,
      processedAt: '2026-09-01T10:01:30.000Z',
    });
    expect(vm.attemptsLabel).toBe(t.list.sentFirstTry);
    expect(vm.processed).toBe('1 Sep 2026, 10:01 UTC');
    expect(vm.lastError).toBeNull();
    expect(vm.canRetry).toBe(false);
  });

  it('hàng SENT sau vài lần hỏng: nói số lần hỏng trước khi đi được', () => {
    const one = toOutboxRowVM({ ...FAILED, status: 'SENT', attempts: 1 });
    const three = toOutboxRowVM({ ...FAILED, status: 'SENT', attempts: 3 });
    expect(one.attemptsLabel).toBe(t.list.sentAfterRetries(1));
    expect(three.attemptsLabel).toBe(t.list.sentAfterRetries(3));
    expect(one.attemptsLabel).not.toBe(three.attemptsLabel);
  });

  it('recipient null giữ null — bảng tự chọn chữ thay thế, VM không bịa email', () => {
    expect(toOutboxRowVM({ ...FAILED, recipient: null }).recipient).toBeNull();
  });

  it('payload đi THÔ — drawer tự thụt lề đúng row đang mở (vòng vá review F7)', () => {
    expect(toOutboxRowVM({ ...FAILED, payload: 'plain' }).payload).toBe('plain');
  });

  it('dấu vết retry: attempts 0 mà còn lastError → PENDING "Re-queued", SENT "Sent after a manual retry"', () => {
    // Vòng vá review F7: retry đặt attempts=0 giữ lastError; bản đầu in
    // "0/5"/"First try" cho hàng phải can thiệp tay 6 lượt.
    const requeued = toOutboxRowVM({ ...FAILED, status: 'PENDING', attempts: 0 });
    expect(requeued.retried).toBe(true);
    expect(requeued.attemptsLabel).toBe(t.list.requeued);

    const sentAfter = toOutboxRowVM({
      ...FAILED,
      status: 'SENT',
      attempts: 0,
      processedAt: '2026-09-01T10:05:00.000Z',
    });
    expect(sentAfter.retried).toBe(true);
    expect(sentAfter.attemptsLabel).toBe(t.list.sentAfterRetry);

    // FAILED luôn có lỗi và attempts = trần — không phải dấu vết retry.
    expect(toOutboxRowVM(FAILED).retried).toBe(false);
  });

  it('SKIPPED: nói thẳng lý do không gửi, badge viền trơn, không retry được', () => {
    const vm = toOutboxRowVM({
      ...FAILED,
      status: 'SKIPPED',
      attempts: 0,
      lastError: null,
      processedAt: '2026-09-01T10:05:00.000Z',
    });
    expect(vm.attemptsLabel).toBe(t.list.skipped);
    expect(vm.statusLabel).toBe(t.status.SKIPPED);
    expect(vm.canRetry).toBe(false);
    expect(outboxStatusBadgeVariant('SKIPPED')).toBe('outline');
  });
});

describe('outboxStatusBadgeVariant', () => {
  it('FAILED nổi bật destructive — đây là lý do trang tồn tại; PENDING nhạt; SENT mặc định', () => {
    expect(outboxStatusBadgeVariant('FAILED')).toBe('destructive');
    expect(outboxStatusBadgeVariant('PENDING')).toBe('secondary');
    expect(outboxStatusBadgeVariant('SENT')).toBe('default');
  });
});

describe('canRetry', () => {
  it('chỉ FAILED — server cũng gác đúng luật này (409 NOT_FAILED)', () => {
    expect(canRetry('FAILED')).toBe(true);
    expect(canRetry('PENDING')).toBe(false);
    expect(canRetry('SENT')).toBe(false);
  });
});
