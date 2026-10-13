import { BookingStatus, DepartureStatus } from '../../generated/prisma/enums.js';
import { checkReviewEligibility } from './review-eligibility.js';

const NOW = new Date('2026-07-19T00:00:00Z');
const base = {
  bookingStatus: BookingStatus.PAID,
  departureStatus: DepartureStatus.OPEN,
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

  // G36: chuyến bị công ty huỷ mà job hoàn tiền chưa chạy hay kẹt retry thì đơn còn PAID qua ngày
  // về. Web đã ẩn form, nhưng app mobile hay request tay vẫn tới đây — cổng phải tự chặn.
  it('từ chối khi chuyến bị công ty huỷ dù đơn còn PAID và đã qua ngày về', () => {
    expect(checkReviewEligibility({ ...base, departureStatus: DepartureStatus.CANCELLED })).toEqual(
      {
        ok: false,
        reason: 'DEPARTURE_CANCELLED',
      },
    );
  });

  it('chuyến CLOSED (ngừng nhận khách) vẫn chạy thật — review được', () => {
    expect(checkReviewEligibility({ ...base, departureStatus: DepartureStatus.CLOSED })).toEqual({
      ok: true,
    });
  });

  it('kiểm quyền sở hữu TRƯỚC chuyến bị huỷ — người ngoài không dò được trạng thái chuyến', () => {
    expect(
      checkReviewEligibility({
        ...base,
        callerId: 'user-2',
        departureStatus: DepartureStatus.CANCELLED,
      }),
    ).toEqual({ ok: false, reason: 'NOT_OWNER' });
  });

  it('chuyến bị huỷ thắng TRIP_NOT_COMPLETED — không bảo khách chờ một chuyến sẽ không chạy', () => {
    expect(
      checkReviewEligibility({
        ...base,
        departureStatus: DepartureStatus.CANCELLED,
        departureEndDate: new Date('2026-08-01'),
      }),
    ).toEqual({ ok: false, reason: 'DEPARTURE_CANCELLED' });
  });
});
