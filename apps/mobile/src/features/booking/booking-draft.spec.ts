import {
  type BookingDraftTrip,
  clearBookingDraft,
  clearCompletedBooking,
  completeBookingDraft,
  getBookingDraft,
  getCompletedBooking,
  startBookingDraft,
  updateBookingDraft,
} from './booking-draft';

const trip: BookingDraftTrip = {
  tourSlug: 'ha-long',
  tourTitle: 'Ha Long',
  tourImageUrl: null,
  departureId: 'dep-1',
  startDate: '2026-12-01',
  endDate: '2026-12-03',
  unitPrice: '100.00',
  currency: 'USD',
  maxGroupSize: 10,
  seatsLeft: 5,
  bookingDeadline: '2026-11-30',
};

function startWithBooking() {
  startBookingDraft(trip, { name: 'A', email: 'a@example.com' });
  updateBookingDraft({ checkoutUrl: 'https://pay.example/s', bookingCode: 'BK-1' });
}

beforeEach(() => {
  clearBookingDraft();
  clearCompletedBooking();
});

describe('updateBookingDraft — bookingCode đi theo dữ liệu đã gửi', () => {
  it('đổi số khách thì quên booking cũ (lần Pay sau tạo booking đúng giá)', () => {
    startWithBooking();
    updateBookingDraft({ numAdults: 2 });
    expect(getBookingDraft()?.bookingCode).toBeNull();
    expect(getBookingDraft()?.checkoutUrl).toBeNull();
  });

  it('đổi cổng thanh toán thì quên booking cũ', () => {
    startWithBooking();
    updateBookingDraft({ paymentProvider: 'PAYPAL' });
    expect(getBookingDraft()?.bookingCode).toBeNull();
  });

  it('đổi liên hệ thì quên booking cũ', () => {
    startWithBooking();
    updateBookingDraft({ contactPhone: '0900000000' });
    expect(getBookingDraft()?.bookingCode).toBeNull();
  });

  it('ghi lại đúng giá trị cũ thì giữ booking', () => {
    startWithBooking();
    updateBookingDraft({ numAdults: 1, paymentProvider: 'STRIPE' });
    expect(getBookingDraft()?.bookingCode).toBe('BK-1');
  });

  it('ghi bookingCode/checkoutUrl không tự xoá chính chúng', () => {
    startBookingDraft(trip, { name: 'A', email: 'a@example.com' });
    updateBookingDraft({ checkoutUrl: 'https://pay.example/s', bookingCode: 'BK-2' });
    expect(getBookingDraft()?.bookingCode).toBe('BK-2');
  });
});

describe('completeBookingDraft — xoá draft ngay khi PAID', () => {
  it('chuyển draft sang bản ghi hoàn tất và xoá draft', () => {
    startWithBooking();
    completeBookingDraft('300.00');
    expect(getBookingDraft()).toBeNull();
    expect(getCompletedBooking()?.bookingCode).toBe('BK-1');
    expect(getCompletedBooking()?.trip.tourSlug).toBe('ha-long');
    // Số tiền B8 là số server xác nhận, không phải số máy tự nhân.
    expect(getCompletedBooking()?.totalAmount).toBe('300.00');
  });

  it('không có draft thì giữ nguyên bản ghi hoàn tất, không ghi đè bằng null', () => {
    startWithBooking();
    completeBookingDraft('300.00');
    completeBookingDraft('300.00');
    expect(getCompletedBooking()?.bookingCode).toBe('BK-1');
  });

  it('draft chưa có bookingCode thì không coi là hoàn tất', () => {
    startBookingDraft(trip, { name: 'A', email: 'a@example.com' });
    completeBookingDraft('300.00');
    expect(getCompletedBooking()).toBeNull();
    expect(getBookingDraft()).not.toBeNull();
  });

  it('startBookingDraft mới dọn bản ghi hoàn tất cũ', () => {
    startWithBooking();
    completeBookingDraft('300.00');
    startBookingDraft(trip, { name: 'A', email: 'a@example.com' });
    expect(getCompletedBooking()).toBeNull();
  });
});
