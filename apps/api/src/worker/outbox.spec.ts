import { OutboxStatus } from '../generated/prisma/enums.js';
import { DeliveryHttpError, isPermanentDeliveryError } from './deliverer.js';
import { backoffDelayMs, MAX_ATTEMPTS, nextAttemptState, trimError } from './outbox.service.js';

// Unit — logic thuần của state machine retry (stateful paths ở outbox.int.spec.ts).

const NOW = new Date('2026-09-07T12:00:00.000Z');

describe('nextAttemptState', () => {
  it('increments attempts and stays PENDING below MAX_ATTEMPTS, kèm nextAttemptAt backoff', () => {
    expect(nextAttemptState(0, { now: NOW })).toEqual({
      attempts: 1,
      status: OutboxStatus.PENDING,
      // 2^1 = 2 phút sau lần thử đầu (W4 E5, ADR-0039 §4).
      nextAttemptAt: new Date(NOW.getTime() + 2 * 60_000),
    });
    expect(nextAttemptState(3, { now: NOW })).toEqual({
      attempts: 4,
      status: OutboxStatus.PENDING,
      nextAttemptAt: new Date(NOW.getTime() + 16 * 60_000),
    });
  });

  it(`parks FAILED when attempts reach MAX_ATTEMPTS (${MAX_ATTEMPTS}) — không hẹn giờ nữa`, () => {
    expect(nextAttemptState(MAX_ATTEMPTS - 1, { now: NOW })).toEqual({
      attempts: MAX_ATTEMPTS,
      status: OutboxStatus.FAILED,
      nextAttemptAt: null,
    });
    // Phòng thủ: đã quá trần (row cũ từ trước khi hạ MAX_ATTEMPTS) vẫn FAILED.
    expect(nextAttemptState(MAX_ATTEMPTS + 3, { now: NOW }).status).toBe(OutboxStatus.FAILED);
  });

  it('W4 E5: lỗi VĨNH VIỄN (4xx trừ 429) → FAILED NGAY, không đốt thêm lượt retry', () => {
    expect(nextAttemptState(0, { now: NOW, permanent: true })).toEqual({
      attempts: 1,
      status: OutboxStatus.FAILED,
      nextAttemptAt: null,
    });
  });
});

describe('backoffDelayMs (W4 E5 — luỹ thừa trần 60 phút)', () => {
  it('2^attempts phút cho các lượt đầu', () => {
    expect(backoffDelayMs(1)).toBe(2 * 60_000);
    expect(backoffDelayMs(2)).toBe(4 * 60_000);
    expect(backoffDelayMs(5)).toBe(32 * 60_000);
  });

  it('trần 60 phút — một sự cố dài không đẩy lịch hẹn ra vô tận', () => {
    expect(backoffDelayMs(6)).toBe(60 * 60_000);
    expect(backoffDelayMs(20)).toBe(60 * 60_000);
  });
});

describe('isPermanentDeliveryError (W4 E5 — phân loại 4xx/5xx/429)', () => {
  it('4xx là vĩnh viễn — thư sai địa chỉ gửi lại y nguyên ra y kết quả', () => {
    expect(isPermanentDeliveryError(new DeliveryHttpError('bad request', 400))).toBe(true);
    expect(isPermanentDeliveryError(new DeliveryHttpError('not found', 404))).toBe(true);
    expect(isPermanentDeliveryError(new DeliveryHttpError('unprocessable', 422))).toBe(true);
  });

  it('401/403/408 là TẠM (vòng vá review W4): credential CỦA TA hỏng hay provider timeout — sửa env xong cả batch phải đi tiếp, không park FAILED', () => {
    expect(isPermanentDeliveryError(new DeliveryHttpError('unauthorized', 401))).toBe(false);
    expect(isPermanentDeliveryError(new DeliveryHttpError('forbidden', 403))).toBe(false);
    expect(isPermanentDeliveryError(new DeliveryHttpError('timeout', 408))).toBe(false);
  });

  it('429/5xx/lỗi mạng là TẠM — giữ đường retry với backoff', () => {
    expect(isPermanentDeliveryError(new DeliveryHttpError('rate limited', 429))).toBe(false);
    expect(isPermanentDeliveryError(new DeliveryHttpError('server error', 500))).toBe(false);
    expect(isPermanentDeliveryError(new DeliveryHttpError('bad gateway', 502))).toBe(false);
    expect(isPermanentDeliveryError(new Error('fetch failed'))).toBe(false);
    expect(isPermanentDeliveryError('raw string')).toBe(false);
  });
});

describe('trimError', () => {
  it('uses Error message as-is when short', () => {
    expect(trimError(new Error('smtp boom'))).toBe('smtp boom');
  });

  it('stringifies non-Error throwables', () => {
    expect(trimError('raw string')).toBe('raw string');
    expect(trimError(42)).toBe('42');
    expect(trimError(undefined)).toBe('undefined');
  });

  it('trims to 1000 chars (last_error column cap)', () => {
    const long = 'x'.repeat(2500);
    expect(trimError(new Error(long))).toHaveLength(1000);
  });
});
