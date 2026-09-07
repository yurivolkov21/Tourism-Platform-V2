import { suppressionsFromResendEvent } from './resend-event.js';

// W4 E6 (ADR-0039 §4): dịch event Resend đã verify → danh sách suppression.
// Chỉ hai loại được ghi: bounce CỨNG và complaint; soft bounce là sự cố tạm
// (hộp thư đầy) — ghi nó là chặn vĩnh viễn một địa chỉ đang sống.

describe('suppressionsFromResendEvent', () => {
  it('email.bounced (hard) → một suppression reason bounced cho từng người nhận', () => {
    expect(
      suppressionsFromResendEvent({
        type: 'email.bounced',
        data: { to: ['a@example.com', 'b@example.com'], bounce: { type: 'hard' } },
      }),
    ).toEqual([
      { email: 'a@example.com', reason: 'bounced' },
      { email: 'b@example.com', reason: 'bounced' },
    ]);
  });

  it('email.bounced KHÔNG khai bounce type → vẫn ghi (mặc định coi là cứng)', () => {
    expect(
      suppressionsFromResendEvent({ type: 'email.bounced', data: { to: ['a@example.com'] } }),
    ).toEqual([{ email: 'a@example.com', reason: 'bounced' }]);
  });

  it('email.bounced soft → KHÔNG ghi — hộp thư đầy không phải địa chỉ chết', () => {
    expect(
      suppressionsFromResendEvent({
        type: 'email.bounced',
        data: { to: ['a@example.com'], bounce: { type: 'soft' } },
      }),
    ).toEqual([]);
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
