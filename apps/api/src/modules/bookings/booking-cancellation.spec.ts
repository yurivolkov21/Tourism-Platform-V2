import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus } from '../../generated/prisma/enums.js';
import {
  bookingCancellation,
  type CancellableBooking,
  cancellationBlocker,
  isCancellableStatus,
  refundOnCancelForBooking,
} from './booking-cancellation.js';

/**
 * TDD (plan 15/09 Task 6) cho luật huỷ ở tầng API: bọc bộ hàm luật của contract
 * quanh SNAPSHOT ngày của booking. Chuyến mẫu 20/10 → 21/10 dài 2 ngày nên N = 3,
 * ngày chót 17/10 (spec §3.1). Mọi mốc viết bằng UTC; giờ Việt Nam = UTC + 7,
 * ghi cạnh từng mốc.
 */
function makeBooking(overrides: Partial<CancellableBooking> = {}): CancellableBooking {
  return {
    status: BookingStatus.PAID,
    departureStartDate: new Date('2026-10-20T00:00:00.000Z'),
    departureEndDate: new Date('2026-10-21T00:00:00.000Z'),
    totalAmount: new Prisma.Decimal('117.00'),
    providerPaymentId: 'pi_test_1',
    ...overrides,
  };
}

/** 10:00 ngày 10/10 giờ Việt Nam — còn xa ngày chót. */
const EARLY = new Date('2026-10-10T03:00:00.000Z');

describe('isCancellableStatus', () => {
  it('chỉ PAID và PARTIALLY_REFUNDED — REFUNDED thì khách liên hệ (spec §3.3)', () => {
    expect(isCancellableStatus(BookingStatus.PAID)).toBe(true);
    expect(isCancellableStatus(BookingStatus.PARTIALLY_REFUNDED)).toBe(true);
    expect(isCancellableStatus(BookingStatus.PENDING)).toBe(false);
    expect(isCancellableStatus(BookingStatus.CANCELLED)).toBe(false);
    expect(isCancellableStatus(BookingStatus.REFUNDED)).toBe(false);
  });
});

describe('cancellationBlocker', () => {
  it('PAID còn capture, trước ngày khởi hành → null (huỷ được)', () => {
    expect(cancellationBlocker(makeBooking(), EARLY)).toBeNull();
  });

  it('trạng thái ngoài PAID/PARTIALLY_REFUNDED → nêu trạng thái', () => {
    expect(cancellationBlocker(makeBooking({ status: BookingStatus.REFUNDED }), EARLY)).toMatch(
      /REFUNDED/,
    );
    expect(cancellationBlocker(makeBooking({ status: BookingStatus.PENDING }), EARLY)).toMatch(
      /PENDING/,
    );
  });

  it('không có capture → không có chỗ hoàn vào', () => {
    expect(cancellationBlocker(makeBooking({ providerPaymentId: null }), EARLY)).toMatch(
      /captured payment/,
    );
  });

  it('23:59:59 giờ VN hôm trước ngày khởi hành → vẫn huỷ được', () => {
    expect(cancellationBlocker(makeBooking(), new Date('2026-10-19T16:59:59.999Z'))).toBeNull();
  });

  it('00:00 giờ VN ngày khởi hành → hết huỷ online', () => {
    expect(cancellationBlocker(makeBooking(), new Date('2026-10-19T17:00:00.000Z'))).toMatch(
      /departure date/,
    );
  });

  it('06:30 giờ VN ngày khởi hành, UTC còn là hôm trước → vẫn chặn (thước UTC cũ để lọt)', () => {
    expect(cancellationBlocker(makeBooking(), new Date('2026-10-19T23:30:00.000Z'))).toMatch(
      /departure date/,
    );
  });
});

describe('refundOnCancelForBooking', () => {
  it('trong hạn: hoàn phần còn lại của sổ', () => {
    expect(refundOnCancelForBooking(makeBooking(), null, EARLY)).toBe('117.00');
    expect(refundOnCancelForBooking(makeBooking(), new Prisma.Decimal('17.00'), EARLY)).toBe(
      '100.00',
    );
  });

  it('23:59:59 giờ VN đúng ngày chót → vẫn trong hạn', () => {
    expect(
      refundOnCancelForBooking(makeBooking(), null, new Date('2026-10-17T16:59:59.999Z')),
    ).toBe('117.00');
  });

  it('00:00 giờ VN ngày sau ngày chót → hoàn 0', () => {
    expect(
      refundOnCancelForBooking(makeBooking(), null, new Date('2026-10-17T17:00:00.000Z')),
    ).toBe('0.00');
  });
});

describe('bookingCancellation', () => {
  it('PAID trong hạn → ngày chót, trong hạn, hoàn đủ, huỷ được', () => {
    expect(bookingCancellation(makeBooking(), null, EARLY)).toEqual({
      deadline: '2026-10-17',
      withinDeadline: true,
      refundAmount: '117.00',
      canCancel: true,
    });
  });

  it('PARTIALLY_REFUNDED quá hạn nhưng chưa khởi hành → hoàn 0, vẫn huỷ được', () => {
    expect(
      bookingCancellation(
        makeBooking({ status: BookingStatus.PARTIALLY_REFUNDED }),
        new Prisma.Decimal('17.00'),
        new Date('2026-10-18T03:00:00.000Z'),
      ),
    ).toEqual({
      deadline: '2026-10-17',
      withinDeadline: false,
      refundAmount: '0.00',
      canCancel: true,
    });
  });

  it('không có capture → canCancel false, vẫn in ngày chót và số tiền theo luật', () => {
    expect(bookingCancellation(makeBooking({ providerPaymentId: null }), null, EARLY)).toEqual({
      deadline: '2026-10-17',
      withinDeadline: true,
      refundAmount: '117.00',
      canCancel: false,
    });
  });

  it.each([BookingStatus.PENDING, BookingStatus.CANCELLED, BookingStatus.REFUNDED])(
    'trạng thái %s → null',
    (status) => {
      expect(bookingCancellation(makeBooking({ status }), null, EARLY)).toBeNull();
    },
  );

  it('chuyến 4 ngày → N = 7, ngày chót sớm hơn', () => {
    const long = makeBooking({ departureEndDate: new Date('2026-10-23T00:00:00.000Z') });
    expect(bookingCancellation(long, null, EARLY)?.deadline).toBe('2026-10-13');
  });
});
