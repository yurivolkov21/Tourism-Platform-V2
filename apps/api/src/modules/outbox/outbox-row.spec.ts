import type { Outbox } from '../../generated/prisma/client.js';
import { EmailType, OutboxStatus } from '../../generated/prisma/enums.js';
import { REDACTED, redactDedupeKey, redactPayload, toOutboxRow } from './outbox-row.js';

/**
 * Mapper THUẦN row Prisma → `OutboxRow` của contract (spec P4c §3-F7). Ba chỗ
 * có luật: `recipient` rút bằng ĐÚNG luật worker gửi (`to` thắng `email`),
 * mốc thời gian ra ISO UTC / null, và REDACT credential (vòng vá review F7).
 *
 * Fixture theo quy ước dedupeKey THẬT (`<event>:<uuid>`,
 * docs/conventions/outbox-dedupe-key.md) — bản đầu bịa `…:BK-ABCD1234`, một
 * format không tồn tại ở production.
 */
const base: Outbox = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  type: EmailType.BOOKING_CONFIRMATION,
  payload: { code: 'BK-ABCD1234', email: 'ada@example.com' },
  status: OutboxStatus.FAILED,
  attempts: 5,
  dedupeKey: 'booking-confirmed:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  lastError: 'Resend: 401 invalid api key',
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  processedAt: null,
};

describe('toOutboxRow', () => {
  it('row FAILED: mốc ISO UTC, processedAt null, recipient từ payload.email', () => {
    expect(toOutboxRow(base)).toEqual({
      id: base.id,
      type: 'BOOKING_CONFIRMATION',
      status: 'FAILED',
      attempts: 5,
      dedupeKey: 'booking-confirmed:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      lastError: 'Resend: 401 invalid api key',
      createdAt: '2026-09-01T10:00:00.000Z',
      processedAt: null,
      recipient: 'ada@example.com',
      payload: { code: 'BK-ABCD1234', email: 'ada@example.com' },
    });
  });

  it('`to` THẮNG `email` — cùng luật với deliverer (ENQUIRY_ADMIN_ALERT gửi cho admin)', () => {
    const row = toOutboxRow({
      ...base,
      type: EmailType.ENQUIRY_ADMIN_ALERT,
      payload: { email: 'lead@example.com', to: 'ops@nexora.test' },
    });
    expect(row.recipient).toBe('ops@nexora.test');
  });

  it('payload không có địa chỉ nào → recipient null (không bịa chuỗi rỗng)', () => {
    expect(toOutboxRow({ ...base, payload: { enquiryId: 'e-1' } }).recipient).toBeNull();
    expect(toOutboxRow({ ...base, payload: 'just a string' }).recipient).toBeNull();
  });

  it('row SENT: processedAt ra ISO, lastError null giữ null', () => {
    const row = toOutboxRow({
      ...base,
      status: OutboxStatus.SENT,
      attempts: 0,
      lastError: null,
      processedAt: new Date('2026-09-01T10:01:30.000Z'),
    });
    expect(row.status).toBe('SENT');
    expect(row.processedAt).toBe('2026-09-01T10:01:30.000Z');
    expect(row.lastError).toBeNull();
  });

  it('row SKIPPED đi qua nguyên vẹn — trạng thái mới của vòng vá', () => {
    expect(toOutboxRow({ ...base, status: OutboxStatus.SKIPPED }).status).toBe('SKIPPED');
  });
});

describe('redact credential (vòng vá review F7)', () => {
  const resetUrl = 'https://admin.nexora.test/reset-password?token=SECRET-TOKEN-123';

  it('PASSWORD_RESET: url trong payload VÀ trong dedupeKey đều bị che — không admin nào cầm được link reset của admin khác', () => {
    const row = toOutboxRow({
      ...base,
      type: EmailType.PASSWORD_RESET,
      payload: { email: 'other-admin@example.com', url: resetUrl },
      dedupeKey: `pwreset:user-1:${resetUrl}`,
    });
    expect(row.payload).toEqual({ email: 'other-admin@example.com', url: REDACTED });
    expect(row.dedupeKey).toBe(`pwreset:${REDACTED}`);
    expect(JSON.stringify(row)).not.toContain('SECRET-TOKEN-123');
    // Recipient vẫn rút được — địa chỉ không phải credential.
    expect(row.recipient).toBe('other-admin@example.com');
  });

  it('EMAIL_OTP: mã otp bị che ở cả hai chỗ', () => {
    const row = toOutboxRow({
      ...base,
      type: EmailType.EMAIL_OTP,
      payload: { email: 'ada@example.com', otp: '482913' },
      dedupeKey: 'email-otp:ada@example.com:482913',
    });
    expect(row.payload).toEqual({ email: 'ada@example.com', otp: REDACTED });
    expect(row.dedupeKey).toBe(`email-otp:${REDACTED}`);
    expect(JSON.stringify(row)).not.toContain('482913');
  });

  it('khoá bí mật bị che theo TÊN ở mọi loại email; dedupeKey chỉ che ở loại auth', () => {
    expect(redactPayload({ code: 'BK-1', url: 'https://x/manage?token=t' })).toEqual({
      code: 'BK-1',
      url: REDACTED,
    });
    expect(redactDedupeKey(EmailType.BOOKING_CONFIRMATION, 'booking-confirmed:uuid')).toBe(
      'booking-confirmed:uuid',
    );
    // Payload vô hướng/mảng không có khoá để che — đi nguyên vẹn.
    expect(redactPayload('plain')).toBe('plain');
    expect(redactPayload(null)).toBeNull();
  });
});
