import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import {
  bookingCreateErrorAction,
  bookingSubmitErrorCopy,
  buildBookingInput,
  type ContactFormState,
  partyCap,
  totalPrice,
  validateContactForm,
} from './booking-form';

describe('partyCap — trần số người là cái NHỎ HƠN trong hai ràng buộc', () => {
  it('ghế còn ít hơn nhóm tối đa → ghế thắng', () => {
    expect(partyCap(12, 9)).toEqual({ cap: 9, reason: 'seats' });
  });

  it('nhóm tối đa nhỏ hơn ghế còn → nhóm thắng', () => {
    expect(partyCap(8, 20)).toEqual({ cap: 8, reason: 'group' });
  });

  it('bằng nhau → quy về nhóm tối đa', () => {
    expect(partyCap(10, 10)).toEqual({ cap: 10, reason: 'group' });
  });

  it('đợt hết chỗ → trần 0', () => {
    expect(partyCap(12, 0)).toEqual({ cap: 0, reason: 'seats' });
  });
});

describe('totalPrice', () => {
  it('nhân đơn giá với tổng chỗ, làm tròn 2 chữ số thập phân', () => {
    expect(totalPrice('459', 3)).toBe('1377.00');
  });

  it('0 chỗ → 0', () => {
    expect(totalPrice('459', 0)).toBe('0.00');
  });
});

describe('validateContactForm', () => {
  const STATE: ContactFormState = {
    contactName: 'Lan Nguyen',
    contactEmail: 'lan.nguyen@example.com',
    contactPhone: '',
    specialRequests: '',
  };

  it('state hợp lệ → không lỗi nào', () => {
    expect(validateContactForm(STATE)).toEqual({});
  });

  it('tên trống → lỗi contactName', () => {
    expect(validateContactForm({ ...STATE, contactName: '  ' }).contactName).toBeTruthy();
  });

  it('email trống → lỗi required', () => {
    expect(validateContactForm({ ...STATE, contactEmail: '' }).contactEmail).toBe(
      messages.formErrors.email.required,
    );
  });

  it('email sai định dạng → lỗi invalid', () => {
    expect(validateContactForm({ ...STATE, contactEmail: 'not-an-email' }).contactEmail).toBe(
      messages.formErrors.email.invalid,
    );
  });

  it('phone bỏ trống → hợp lệ (optional)', () => {
    expect(validateContactForm({ ...STATE, contactPhone: '' }).contactPhone).toBeUndefined();
  });

  it('phone quá ngắn (1-5 ký tự) → lỗi', () => {
    expect(validateContactForm({ ...STATE, contactPhone: '123' }).contactPhone).toBeTruthy();
  });

  it('specialRequests quá 1000 ký tự → lỗi', () => {
    expect(
      validateContactForm({ ...STATE, specialRequests: 'x'.repeat(1001) }).specialRequests,
    ).toBeTruthy();
  });
});

describe('buildBookingInput', () => {
  it('bỏ hẳn phone/specialRequests khỏi payload khi rỗng — không gửi chuỗi rỗng', () => {
    const input = buildBookingInput({
      departureId: 'e9000001-0000-4000-8000-000000000001',
      numAdults: 2,
      numChildren: 1,
      contactName: '  Lan Nguyen  ',
      contactEmail: '  lan.nguyen@example.com  ',
      contactPhone: '  ',
      specialRequests: '  ',
      paymentProvider: 'STRIPE',
    });

    expect(input).toEqual({
      departureId: 'e9000001-0000-4000-8000-000000000001',
      numAdults: 2,
      numChildren: 1,
      contactName: 'Lan Nguyen',
      contactEmail: 'lan.nguyen@example.com',
      paymentProvider: 'STRIPE',
    });
    expect(input).not.toHaveProperty('contactPhone');
    expect(input).not.toHaveProperty('specialRequests');
  });

  it('cắt khoảng trắng, giữ phone/specialRequests khi có chữ', () => {
    const input = buildBookingInput({
      departureId: 'e9000001-0000-4000-8000-000000000001',
      numAdults: 1,
      numChildren: 0,
      contactName: 'Lan Nguyen',
      contactEmail: 'lan.nguyen@example.com',
      contactPhone: ' +84 912 345 678 ',
      specialRequests: ' Window seat please ',
      paymentProvider: 'PAYPAL',
    });

    expect(input.contactPhone).toBe('+84 912 345 678');
    expect(input.specialRequests).toBe('Window seat please');
  });
});

describe('bookingSubmitErrorCopy', () => {
  it('SEATS_UNAVAILABLE → câu hết ghế', () => {
    const error = new ORPCError('SEATS_UNAVAILABLE', { status: 409 });
    expect(bookingSubmitErrorCopy(error)).toBe(messages.booking.errors.SEATS_NOT_AVAILABLE);
  });

  it('PARTY_TOO_LARGE → câu vượt trần nhóm', () => {
    const error = new ORPCError('PARTY_TOO_LARGE', { status: 422 });
    expect(bookingSubmitErrorCopy(error)).toBe(messages.booking.errors.PARTY_TOO_LARGE);
  });

  it('DEPARTURE_NOT_AVAILABLE → câu đợt đã đóng', () => {
    const error = new ORPCError('DEPARTURE_NOT_AVAILABLE', { status: 400 });
    expect(bookingSubmitErrorCopy(error)).toBe(messages.accountActionErrors.bookingClosed);
  });

  it('401 → câu hết phiên', () => {
    const error = new ORPCError('UNAUTHORIZED', { status: 401 });
    expect(bookingSubmitErrorCopy(error)).toBe(messages.booking.errors.UNAUTHORIZED);
  });

  it('429 → câu throttle', () => {
    const error = new ORPCError('TOO_MANY_REQUESTS', { status: 429 });
    expect(bookingSubmitErrorCopy(error)).toBe(messages.accountActionErrors.throttle);
  });

  it('lỗi lạ/không phải ORPCError → câu CHECKOUT_FAILED chung', () => {
    expect(bookingSubmitErrorCopy(new Error('boom'))).toBe(messages.booking.errors.CHECKOUT_FAILED);
  });
});

describe('bookingCreateErrorAction', () => {
  it('SEATS_UNAVAILABLE → goToDates', () => {
    expect(bookingCreateErrorAction(new ORPCError('SEATS_UNAVAILABLE', { status: 409 }))).toBe(
      'goToDates',
    );
  });

  it('DEPARTURE_NOT_AVAILABLE → goToDates', () => {
    expect(
      bookingCreateErrorAction(new ORPCError('DEPARTURE_NOT_AVAILABLE', { status: 400 })),
    ).toBe('goToDates');
  });

  it('PARTY_TOO_LARGE → goToTravellers', () => {
    expect(bookingCreateErrorAction(new ORPCError('PARTY_TOO_LARGE', { status: 422 }))).toBe(
      'goToTravellers',
    );
  });

  it('CHECKOUT_FAILED → stay', () => {
    expect(bookingCreateErrorAction(new ORPCError('CHECKOUT_FAILED', { status: 502 }))).toBe(
      'stay',
    );
  });

  it('lỗi lạ/không phải ORPCError → stay', () => {
    expect(bookingCreateErrorAction(new Error('boom'))).toBe('stay');
  });
});
