import type { Outbox } from '../../generated/prisma/client.js';
import { EmailType, OutboxStatus } from '../../generated/prisma/enums.js';
import { toOutboxRow } from './outbox-row.js';

/**
 * Mapper THUẦN row Prisma → `OutboxRow` của contract (spec P4c §3-F7). Phần
 * đáng test là hai chỗ có luật: `recipient` rút bằng ĐÚNG luật worker gửi
 * (`to` thắng `email`) và mốc thời gian ra ISO UTC / null.
 */
const base: Outbox = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  type: EmailType.BOOKING_CONFIRMATION,
  payload: { code: 'BK-ABCD1234', email: 'ada@example.com' },
  status: OutboxStatus.FAILED,
  attempts: 5,
  dedupeKey: 'booking-confirmation:BK-ABCD1234',
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
      dedupeKey: 'booking-confirmation:BK-ABCD1234',
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
});
