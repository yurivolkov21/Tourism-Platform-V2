import {
  AdminOutboxListQuerySchema,
  AdminOutboxRetryInputSchema,
  EmailTypeSchema,
  OUTBOX_MAX_ATTEMPTS,
  OutboxRowSchema,
  OutboxStatusSchema,
} from './outbox.js';
import { AdminOutboxStatsSchema, STATS_WINDOW_DAYS } from './stats.js';

/**
 * Contract vùng outbox (spec P4c §3-F7). Schema là hợp đồng giữa API và
 * admin, nên test pin đúng những gì hai bên dựa vào: trần/cận của query, hình
 * dạng row (payload là JSON tự do, recipient nullable), và hằng MAX_ATTEMPTS
 * mà cột "3/5" của bảng đọc.
 */

const validRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  type: 'BOOKING_CONFIRMATION',
  status: 'FAILED',
  attempts: 5,
  dedupeKey: 'booking-confirmation:BK-ABCD1234',
  lastError: 'Resend: 401 invalid api key',
  createdAt: '2026-09-01T10:00:00.000Z',
  processedAt: null,
  recipient: 'ada@example.com',
  payload: { code: 'BK-ABCD1234', email: 'ada@example.com', nested: { n: 1, list: [1, 'a'] } },
};

describe('enums', () => {
  it('OutboxStatus có bốn trạng thái của worker — SKIPPED thêm ở vòng vá review F7', () => {
    expect(OutboxStatusSchema.options).toEqual(['PENDING', 'SENT', 'FAILED', 'SKIPPED']);
  });

  it('EmailType phủ mọi loại email mà worker biết gửi', () => {
    expect(EmailTypeSchema.options).toContain('BOOKING_CONFIRMATION');
    expect(EmailTypeSchema.options).toContain('EMAIL_OTP');
    // ADR-0031 §6 thêm `REVIEW_REJECTED` — bác một review mà im lặng là để
    // khách đợi một thứ không bao giờ tới.
    expect(EmailTypeSchema.options).toContain('REVIEW_REJECTED');
    expect(EmailTypeSchema.options).toHaveLength(14);
  });
});

describe('OUTBOX_MAX_ATTEMPTS', () => {
  it('là 5 — cùng số với worker (row FAILED mang attempts = 5)', () => {
    expect(OUTBOX_MAX_ATTEMPTS).toBe(5);
  });
});

describe('AdminOutboxListQuerySchema', () => {
  it('mặc định trang 1 · 20 dòng, không filter', () => {
    expect(AdminOutboxListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('nhận status/type từ enum và search ≤120 ký tự', () => {
    expect(
      AdminOutboxListQuerySchema.parse({
        status: 'FAILED',
        type: 'REVIEW_APPROVED',
        search: 'booking-confirmation:',
      }),
    ).toMatchObject({ status: 'FAILED', type: 'REVIEW_APPROVED', search: 'booking-confirmation:' });
    expect(AdminOutboxListQuerySchema.safeParse({ search: 'x'.repeat(121) }).success).toBe(false);
    expect(AdminOutboxListQuerySchema.safeParse({ search: '' }).success).toBe(false);
  });

  it('từ chối status/type ngoài enum và limit vượt trần 100', () => {
    expect(AdminOutboxListQuerySchema.safeParse({ status: 'DONE' }).success).toBe(false);
    expect(AdminOutboxListQuerySchema.safeParse({ type: 'NEWSLETTER' }).success).toBe(false);
    expect(AdminOutboxListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('giữ nguyên `.shape` — điều kiện để ZodSmartCoercionPlugin ép query string', () => {
    expect(Object.keys(AdminOutboxListQuerySchema.shape)).toEqual([
      'page',
      'limit',
      'status',
      'type',
      'search',
    ]);
  });
});

describe('OutboxRowSchema', () => {
  it('nhận một row FAILED đầy đủ, payload JSON lồng nhau giữ nguyên', () => {
    expect(OutboxRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('SENT: processedAt có mốc, lastError có thể null, recipient có thể null', () => {
    const sent = {
      ...validRow,
      status: 'SENT',
      attempts: 0,
      lastError: null,
      processedAt: '2026-09-01T10:01:00.000Z',
      recipient: null,
      payload: { enquiryId: 'e-1' },
    };
    expect(OutboxRowSchema.parse(sent)).toEqual(sent);
  });

  it('attempts phải là số nguyên không âm', () => {
    expect(OutboxRowSchema.safeParse({ ...validRow, attempts: -1 }).success).toBe(false);
    expect(OutboxRowSchema.safeParse({ ...validRow, attempts: 1.5 }).success).toBe(false);
  });
});

describe('AdminOutboxRetryInputSchema', () => {
  it('chỉ nhận uuid', () => {
    expect(AdminOutboxRetryInputSchema.parse({ id: validRow.id })).toEqual({ id: validRow.id });
    expect(AdminOutboxRetryInputSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('AdminOutboxStatsSchema', () => {
  const period = {
    windowDays: STATS_WINDOW_DAYS,
    currentFrom: '2026-08-04T00:00:00.000Z',
    currentTo: '2026-09-01T00:00:00.000Z',
    previousFrom: '2026-07-07T00:00:00.000Z',
    generatedAt: '2026-09-01T00:00:00.000Z',
  };

  it('cả ba con số đều là số ĐƠN — sent không có kỳ trước (purge 30 ngày), queued/failed là ảnh chụp', () => {
    const stats = { period, sent: 40, queued: 3, failed: 1 };
    expect(AdminOutboxStatsSchema.parse(stats)).toEqual(stats);
    // Đưa cặp số vào là sai hình: kỳ trước của sent là số bịa (vòng vá F7),
    // ảnh chụp thì không có kỳ trước để mà so.
    expect(
      AdminOutboxStatsSchema.safeParse({ ...stats, queued: { current: 3, previous: 2 } }).success,
    ).toBe(false);
    expect(
      AdminOutboxStatsSchema.safeParse({ ...stats, sent: { current: 40, previous: 35 } }).success,
    ).toBe(false);
  });
});
