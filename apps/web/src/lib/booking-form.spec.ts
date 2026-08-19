import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  BOOKING_STEPS,
  type BookingFormState,
  bookingSubmitErrorCopy,
  buildBookingInput,
  canLeaveStep,
  partyCap,
  stepErrors,
  stepOf,
  validateBookingForm,
} from './booking-form';

const STATE: BookingFormState = {
  departureId: 'e9000001-0000-4000-8000-000000000001',
  numAdults: 2,
  numChildren: 1,
  contactName: 'Elena Moreau',
  contactEmail: 'elena.moreau@example.com',
  contactPhone: '',
  specialRequests: '',
  paymentProvider: 'STRIPE',
};

describe('partyCap — trần số người là cái NHỎ HƠN trong hai ràng buộc', () => {
  it('ghế còn ít hơn nhóm tối đa → ghế thắng', () => {
    expect(partyCap(12, 9)).toEqual({ cap: 9, reason: 'seats' });
  });

  it('nhóm tối đa nhỏ hơn ghế còn → nhóm thắng', () => {
    expect(partyCap(8, 20)).toEqual({ cap: 8, reason: 'group' });
  });

  /** Bằng nhau thì quy về `group`: nói "tour này nhận tối đa 10 khách" dễ hiểu
   *  hơn "đợt này còn đúng 10 chỗ", và không sai. */
  it('bằng nhau → quy về nhóm tối đa', () => {
    expect(partyCap(10, 10)).toEqual({ cap: 10, reason: 'group' });
  });

  /** Chưa chọn đợt thì chưa biết ghế còn — chỉ còn ràng buộc nhóm tối đa. */
  it('chưa chọn đợt (seatsLeft null) → chỉ nhóm tối đa', () => {
    expect(partyCap(12, null)).toEqual({ cap: 12, reason: 'group' });
  });

  it('đợt hết chỗ → trần 0', () => {
    expect(partyCap(12, 0)).toEqual({ cap: 0, reason: 'seats' });
  });
});

describe('validateBookingForm', () => {
  it('state hợp lệ → không lỗi nào', () => {
    expect(validateBookingForm(STATE)).toEqual({});
  });

  it('chưa chọn đợt → lỗi ở departureId', () => {
    expect(validateBookingForm({ ...STATE, departureId: null }).departureId).toBeTruthy();
  });

  it('email thiếu hoặc sai shape → lỗi ở contactEmail', () => {
    expect(validateBookingForm({ ...STATE, contactEmail: '' }).contactEmail).toBeTruthy();
    expect(
      validateBookingForm({ ...STATE, contactEmail: 'elena.moreau@' }).contactEmail,
    ).toBeTruthy();
  });

  it('tên rỗng hoặc chỉ khoảng trắng → lỗi', () => {
    expect(validateBookingForm({ ...STATE, contactName: '   ' }).contactName).toBeTruthy();
  });

  /** Contract cho phép BỎ TRỐNG phone, nhưng nếu có thì tối thiểu 6 ký tự
   *  (parity Nexora `@Length(6,30)`) — chặn số 1–5 ký tự. */
  it('phone bỏ trống thì hợp lệ, nhưng 1–5 ký tự thì không', () => {
    expect(validateBookingForm({ ...STATE, contactPhone: '' }).contactPhone).toBeUndefined();
    expect(validateBookingForm({ ...STATE, contactPhone: '12345' }).contactPhone).toBeTruthy();
    expect(
      validateBookingForm({ ...STATE, contactPhone: '+33 6 12 34 56 78' }).contactPhone,
    ).toBeUndefined();
  });

  it('người lớn tối thiểu 1 — trẻ em không đi một mình', () => {
    expect(validateBookingForm({ ...STATE, numAdults: 0 }).numAdults).toBeTruthy();
  });

  it('special requests quá 1000 ký tự → lỗi', () => {
    expect(
      validateBookingForm({ ...STATE, specialRequests: 'x'.repeat(1001) }).specialRequests,
    ).toBeTruthy();
    expect(
      validateBookingForm({ ...STATE, specialRequests: 'x'.repeat(1000) }).specialRequests,
    ).toBeUndefined();
  });

  /** Sweep 19/08: mỗi ô nói ĐÚNG lỗi của mình — hết câu gộp "valid name and
   *  email" cho cả phone sai lẫn requests quá dài. */
  describe('copy lỗi theo từng ô', () => {
    const t = messages.formErrors;

    it('tên trống → name.required', () => {
      expect(validateBookingForm({ ...STATE, contactName: '' }).contactName).toBe(t.name.required);
    });

    it('email trống → email.required; sai shape → email.invalid', () => {
      expect(validateBookingForm({ ...STATE, contactEmail: '' }).contactEmail).toBe(
        t.email.required,
      );
      expect(validateBookingForm({ ...STATE, contactEmail: 'elena@' }).contactEmail).toBe(
        t.email.invalid,
      );
    });

    it('phone 1–5 ký tự → phone.invalid', () => {
      expect(validateBookingForm({ ...STATE, contactPhone: '123' }).contactPhone).toBe(
        t.phone.invalid,
      );
    });

    it('requests quá 1000 → specialRequests.tooLong', () => {
      expect(
        validateBookingForm({ ...STATE, specialRequests: 'x'.repeat(1001) }).specialRequests,
      ).toBe(t.specialRequests.tooLong);
    });
  });
});

describe('buildBookingInput — state form → CreateBookingInput', () => {
  it('dựng payload tối thiểu, BỎ HẲN field optional khi rỗng', () => {
    const input = buildBookingInput(STATE);
    expect(input).toEqual({
      departureId: STATE.departureId,
      numAdults: 2,
      numChildren: 1,
      contactName: 'Elena Moreau',
      contactEmail: 'elena.moreau@example.com',
      paymentProvider: 'STRIPE',
    });
    // Không được gửi chuỗi rỗng: contract khai `.optional()`, và '' sẽ trượt
    // `min(6)` của phone lẫn `min(1)` của specialRequests.
    expect('contactPhone' in input).toBe(false);
    expect('specialRequests' in input).toBe(false);
  });

  it('cắt khoảng trắng thừa quanh tên, email và ghi chú', () => {
    const input = buildBookingInput({
      ...STATE,
      contactName: '  Elena Moreau  ',
      contactEmail: '  elena.moreau@example.com ',
      specialRequests: '  ăn chay  ',
    });
    expect(input.contactName).toBe('Elena Moreau');
    expect(input.contactEmail).toBe('elena.moreau@example.com');
    expect(input.specialRequests).toBe('ăn chay');
  });

  it('ném khi chưa chọn đợt — gọi build trước khi validate là lỗi lập trình', () => {
    expect(() => buildBookingInput({ ...STATE, departureId: null })).toThrow();
  });
});

describe('logic bước của wizard đặt chỗ', () => {
  it('bốn bước, đúng thứ tự khách đi qua', () => {
    expect(BOOKING_STEPS).toEqual(['dates', 'travellers', 'review', 'pay']);
  });

  it('mỗi trường thuộc đúng một bước', () => {
    expect(stepOf('departureId')).toBe('dates');
    expect(stepOf('numAdults')).toBe('travellers');
    expect(stepOf('numChildren')).toBe('travellers');
    expect(stepOf('contactName')).toBe('travellers');
    expect(stepOf('contactEmail')).toBe('travellers');
    expect(stepOf('contactPhone')).toBe('travellers');
    expect(stepOf('specialRequests')).toBe('travellers');
    expect(stepOf('paymentProvider')).toBe('pay');
  });

  /** Lỗi phải HIỆN Ở ĐÚNG BƯỚC chứa ô hỏng. Đổ hết lỗi lên bước hiện tại thì
   *  khách thấy "email không hợp lệ" trong lúc đang chọn ngày — không sửa được
   *  vì ô đó còn chưa hiện ra. */
  it('stepErrors chỉ trả lỗi của trường thuộc bước đó', () => {
    const broken: BookingFormState = { ...STATE, departureId: null, contactEmail: 'sai' };
    expect(Object.keys(stepErrors('dates', broken))).toEqual(['departureId']);
    expect(Object.keys(stepErrors('travellers', broken))).toEqual(['contactEmail']);
    expect(stepErrors('pay', broken)).toEqual({});
  });

  it('canLeaveStep chặn khi bước hiện tại còn lỗi, cho qua khi sạch', () => {
    expect(canLeaveStep('dates', { ...STATE, departureId: null })).toBe(false);
    expect(canLeaveStep('dates', STATE)).toBe(true);
    expect(canLeaveStep('travellers', { ...STATE, contactName: '  ' })).toBe(false);
    expect(canLeaveStep('travellers', STATE)).toBe(true);
  });

  /** Review không sở hữu trường nào nên không bao giờ tự chặn — nhưng nó vẫn
   *  phải chặn khi bước TRƯỚC còn hỏng, và chuyện đó do wizard lo bằng cách
   *  không cho nhảy cóc, không phải do hàm này. */
  it('bước review không có trường riêng nên luôn qua được', () => {
    expect(canLeaveStep('review', STATE)).toBe(true);
    expect(canLeaveStep('review', { ...STATE, departureId: null })).toBe(true);
  });
});

describe('bookingSubmitErrorCopy — lỗi API khi tạo booking', () => {
  const t = messages.booking.errors;

  it('SEATS_UNAVAILABLE (409) → câu hết ghế, không phải checkout failed', () => {
    const err = new ORPCError('SEATS_UNAVAILABLE', { status: 409 });
    expect(bookingSubmitErrorCopy(err)).toBe(t.SEATS_NOT_AVAILABLE);
  });

  it('DEPARTURE_NOT_AVAILABLE (400) → câu đợt đã đóng', () => {
    const err = new ORPCError('DEPARTURE_NOT_AVAILABLE', { status: 400 });
    expect(bookingSubmitErrorCopy(err)).toBe(t.DEPARTURE_NOT_OPEN);
  });

  it('401 → hết phiên; 429 → throttle', () => {
    expect(bookingSubmitErrorCopy(new ORPCError('UNAUTHORIZED', { status: 401 }))).toBe(
      t.UNAUTHORIZED,
    );
    expect(bookingSubmitErrorCopy(new ORPCError('TOO_MANY_REQUESTS', { status: 429 }))).toBe(
      messages.accountActionErrors.throttle,
    );
  });

  it('CHECKOUT_FAILED (502), lỗi lạ, hoặc không phải ORPCError → CHECKOUT_FAILED', () => {
    expect(bookingSubmitErrorCopy(new ORPCError('CHECKOUT_FAILED', { status: 502 }))).toBe(
      t.CHECKOUT_FAILED,
    );
    expect(bookingSubmitErrorCopy(new Error('boom'))).toBe(t.CHECKOUT_FAILED);
    expect(bookingSubmitErrorCopy(undefined)).toBe(t.CHECKOUT_FAILED);
  });
});
