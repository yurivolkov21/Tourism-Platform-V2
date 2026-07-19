import { BookingStatus } from '../../generated/prisma/enums.js';
import { checkReviewEligibility } from './review-eligibility.js';

const NOW = new Date('2026-07-19T00:00:00Z');
const base = {
  bookingStatus: BookingStatus.PAID,
  departureEndDate: new Date('2026-07-18'), // đã kết thúc
  now: NOW,
  ownerId: 'user-1',
  callerId: 'user-1',
};

describe('checkReviewEligibility', () => {
  it('cho phép khi PAID và chuyến đã kết thúc', () => {
    expect(checkReviewEligibility(base)).toEqual({ ok: true });
  });

  it('từ chối khi caller không phải chủ booking', () => {
    expect(checkReviewEligibility({ ...base, callerId: 'user-2' })).toEqual({
      ok: false,
      reason: 'NOT_OWNER',
    });
  });

  it('từ chối khi booking chưa PAID', () => {
    expect(checkReviewEligibility({ ...base, bookingStatus: BookingStatus.PENDING })).toEqual({
      ok: false,
      reason: 'NOT_PAID',
    });
  });

  it('từ chối khi chuyến CHƯA kết thúc — nâng cấp so với Nexora', () => {
    expect(checkReviewEligibility({ ...base, departureEndDate: new Date('2026-08-01') })).toEqual({
      ok: false,
      reason: 'TRIP_NOT_COMPLETED',
    });
  });

  it('cho phép ngay ngày chuyến kết thúc (biên)', () => {
    expect(checkReviewEligibility({ ...base, departureEndDate: new Date('2026-07-19') })).toEqual({
      ok: true,
    });
  });

  it('kiểm quyền sở hữu TRƯỚC trạng thái — không rò rỉ booking người khác', () => {
    expect(
      checkReviewEligibility({
        ...base,
        callerId: 'user-2',
        bookingStatus: BookingStatus.PENDING,
      }),
    ).toEqual({ ok: false, reason: 'NOT_OWNER' });
  });

  it('kiểm trạng thái PAID TRƯỚC ngày kết thúc — NOT_PAID thắng TRIP_NOT_COMPLETED', () => {
    expect(
      checkReviewEligibility({
        ...base,
        bookingStatus: BookingStatus.PENDING,
        departureEndDate: new Date('2026-08-01'),
      }),
    ).toEqual({ ok: false, reason: 'NOT_PAID' });
  });
});
