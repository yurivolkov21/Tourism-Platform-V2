import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { checkoutMood, PENDING_TTL_MINUTES, pendingExpiry } from './checkout';

describe('checkoutMood — tâm trạng màn /checkout/success đọc từ status', () => {
  it('PAID → confirmed', () => {
    expect(checkoutMood(makeBooking({ status: 'PAID' }))).toBe('confirmed');
  });

  it('PENDING → confirming (webhook chưa về)', () => {
    expect(checkoutMood(makeBooking({ status: 'PENDING' }))).toBe('confirming');
  });

  /**
   * Ba status còn lại KHÔNG phải "đang chờ webhook" — chúng là kết cục đã rồi.
   * Nếu khách quay về từ cổng mà booking đã CANCELLED (hết hạn giữa chừng) thì
   * hiện mood confirming là nói dối: trang sẽ tự làm mới mãi mãi cho một thứ
   * không bao giờ đổi.
   */
  it.each(['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const)(
    '%s → settled, KHÔNG tự làm mới',
    (status) => {
      expect(checkoutMood(makeBooking({ status }))).toBe('settled');
    },
  );
});

describe('pendingExpiry — hạn 65 phút tính từ createdAt', () => {
  const createdAt = '2026-08-07T10:00:00.000Z';

  it('còn 65 phút ngay lúc vừa tạo', () => {
    const at = new Date('2026-08-07T10:00:00.000Z');
    expect(pendingExpiry(createdAt, at).minutesLeft).toBe(65);
    expect(pendingExpiry(createdAt, at).expired).toBe(false);
  });

  it('làm tròn XUỐNG phút — không bao giờ hứa nhiều hơn thực tế', () => {
    // 10:00 + 12 phút 40 giây trôi qua → còn 52 phút 20 giây → in "52", không phải "53".
    const at = new Date('2026-08-07T10:12:40.000Z');
    expect(pendingExpiry(createdAt, at).minutesLeft).toBe(52);
  });

  it('đúng mốc 65 phút là ĐÃ hết hạn, không phải còn 0', () => {
    const at = new Date('2026-08-07T11:05:00.000Z');
    const r = pendingExpiry(createdAt, at);
    expect(r.expired).toBe(true);
    expect(r.minutesLeft).toBe(0);
  });

  it('quá hạn thì kẹp ở 0, không trả số âm', () => {
    const at = new Date('2026-08-07T23:00:00.000Z');
    expect(pendingExpiry(createdAt, at).minutesLeft).toBe(0);
    expect(pendingExpiry(createdAt, at).expired).toBe(true);
  });

  it('hằng số khớp PENDING_TTL_MINUTES của API', () => {
    expect(PENDING_TTL_MINUTES).toBe(65);
  });
});
