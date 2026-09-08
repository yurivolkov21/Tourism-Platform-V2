import { suppressionsFromResendEvent } from './resend-event.js';

// W4 E6 (ADR-0039 §4): dịch event Resend đã verify → danh sách suppression.
// Chỉ hai loại được ghi: bounce VĨNH VIỄN và complaint; bounce tạm là sự cố
// (hộp thư đầy) — ghi nó là chặn vĩnh viễn một địa chỉ đang sống.

/**
 * Fixture theo payload THẬT của Resend (docs "Webhooks → email.bounced",
 * vòng vá review W4): `bounce.type` là `Permanent|Transient|Undetermined`,
 * KHÔNG phải `hard`/`soft` như bản đầu tự chế.
 */
const realBounced = (type: string, to = ['a@example.com']) => ({
  type: 'email.bounced',
  created_at: '2026-09-08T03:00:00.000Z',
  data: {
    created_at: '2026-09-08T02:59:58.000Z',
    email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
    from: 'Nexora <noreply@nexora-travel.agency>',
    to,
    subject: 'Confirm your subscription',
    bounce: {
      message:
        "The recipient's email address is on the suppression list because it has a recent history of producing hard bounces.",
      subType: 'Suppressed',
      type,
    },
  },
});

describe('suppressionsFromResendEvent', () => {
  it('email.bounced Permanent (payload thật) → một suppression reason bounced cho từng người nhận', () => {
    expect(
      suppressionsFromResendEvent(realBounced('Permanent', ['a@example.com', 'b@example.com'])),
    ).toEqual([
      { email: 'a@example.com', reason: 'bounced' },
      { email: 'b@example.com', reason: 'bounced' },
    ]);
  });

  it('email.bounced Undetermined → vẫn ghi (phía an toàn cho reputation)', () => {
    expect(suppressionsFromResendEvent(realBounced('Undetermined'))).toEqual([
      { email: 'a@example.com', reason: 'bounced' },
    ]);
  });

  it('email.bounced Transient → KHÔNG ghi — hộp thư đầy không phải địa chỉ chết (soft cũ cũng vậy)', () => {
    expect(suppressionsFromResendEvent(realBounced('Transient'))).toEqual([]);
    expect(
      suppressionsFromResendEvent({
        type: 'email.bounced',
        data: { to: ['a@example.com'], bounce: { type: 'soft' } },
      }),
    ).toEqual([]);
  });

  it('bounce type `hard` (fixture cũ) và KHÔNG khai loại → vẫn ghi (mặc định coi là cứng)', () => {
    expect(
      suppressionsFromResendEvent({
        type: 'email.bounced',
        data: { to: ['a@example.com'], bounce: { type: 'hard' } },
      }),
    ).toEqual([{ email: 'a@example.com', reason: 'bounced' }]);
    expect(
      suppressionsFromResendEvent({ type: 'email.bounced', data: { to: ['a@example.com'] } }),
    ).toEqual([{ email: 'a@example.com', reason: 'bounced' }]);
  });

  it('email.complained → reason complained; `to` dạng chuỗi đơn cũng nhận', () => {
    expect(
      suppressionsFromResendEvent({ type: 'email.complained', data: { to: 'c@example.com' } }),
    ).toEqual([{ email: 'c@example.com', reason: 'complained' }]);
  });

  it('loại event khác (delivered, opened…) và body rác → mảng rỗng, không throw', () => {
    expect(
      suppressionsFromResendEvent({ type: 'email.delivered', data: { to: ['a@example.com'] } }),
    ).toEqual([]);
    expect(suppressionsFromResendEvent(null)).toEqual([]);
    expect(suppressionsFromResendEvent({ type: 'email.bounced' })).toEqual([]);
    expect(suppressionsFromResendEvent({ type: 'email.bounced', data: { to: [42] } })).toEqual([]);
  });
});
