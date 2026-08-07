import { CreateEnquiryInputSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  buildPrivateTripPayload,
  type PrivateTripState,
  validatePrivateTrip,
} from './private-trip';

const TOUR_ID = 'a1000001-0000-4000-8000-000000000001';

const STATE: PrivateTripState = {
  startDate: '2026-11-14',
  numAdults: 4,
  numChildren: 0,
  contactName: 'Elena Moreau',
  contactEmail: 'elena.moreau@example.com',
  contactPhone: '',
  message: 'Two of us have trekked before, two have not. A slower first day would help.',
  website: '',
};

describe('validatePrivateTrip', () => {
  it('state hợp lệ → không lỗi', () => {
    expect(validatePrivateTrip(STATE)).toEqual({});
  });

  /** Contract đặt `message` min 10 để chặn "hi"/"test" — ngưỡng Nexora giữ
   *  nguyên. Form phải bắt trước, đừng để server từ chối một enquiry mà khách
   *  tưởng đã gửi đi. */
  it('lời nhắn dưới 10 ký tự → lỗi', () => {
    expect(validatePrivateTrip({ ...STATE, message: 'hi' }).message).toBeTruthy();
    expect(validatePrivateTrip({ ...STATE, message: 'x'.repeat(10) }).message).toBeUndefined();
  });

  it('tên dưới 2 ký tự → lỗi (parity Nexora)', () => {
    expect(validatePrivateTrip({ ...STATE, contactName: 'A' }).contactName).toBeTruthy();
  });

  it('email sai shape → lỗi', () => {
    expect(validatePrivateTrip({ ...STATE, contactEmail: 'elena@' }).contactEmail).toBeTruthy();
  });

  it('người lớn tối thiểu 1', () => {
    expect(validatePrivateTrip({ ...STATE, numAdults: 0 }).numAdults).toBeTruthy();
  });

  /** Enquiry KHÔNG bắt buộc ngày — khách có thể chỉ muốn hỏi trước. */
  it('bỏ trống ngày mong muốn vẫn hợp lệ', () => {
    expect(validatePrivateTrip({ ...STATE, startDate: '' }).startDate).toBeUndefined();
  });
});

describe('buildPrivateTripPayload', () => {
  it('dựng payload khớp CreateEnquiryInputSchema', () => {
    const payload = buildPrivateTripPayload(STATE, TOUR_ID);
    expect(CreateEnquiryInputSchema.safeParse(payload).success).toBe(true);
    expect(payload.tourId).toBe(TOUR_ID);
    expect(payload.groupSize).toBe(4);
    expect(payload.travelDate).toBe('2026-11-14');
  });

  it('groupSize là TỔNG người lớn + trẻ em', () => {
    expect(
      buildPrivateTripPayload({ ...STATE, numAdults: 3, numChildren: 2 }, TOUR_ID).groupSize,
    ).toBe(5);
  });

  /** Ba field optional: bỏ hẳn khi rỗng, KHÔNG gửi chuỗi rỗng — cùng bẫy đã ghi
   *  ở `buildBookingInput`. */
  it('bỏ hẳn phone và travelDate khi rỗng', () => {
    const payload = buildPrivateTripPayload({ ...STATE, contactPhone: '', startDate: '' }, TOUR_ID);
    expect('phone' in payload).toBe(false);
    expect('travelDate' in payload).toBe(false);
    expect(CreateEnquiryInputSchema.safeParse(payload).success).toBe(true);
  });

  it('giữ phone khi có', () => {
    expect(
      buildPrivateTripPayload({ ...STATE, contactPhone: '+33 6 12 34 56 78' }, TOUR_ID).phone,
    ).toBe('+33 6 12 34 56 78');
  });

  /** Honeypot: passthrough nguyên giá trị khi non-empty. Người thật luôn để
   *  rỗng nên field này vắng mặt trong đa số request thật. */
  it('honeypot chỉ đi kèm khi bot điền', () => {
    expect('website' in buildPrivateTripPayload(STATE, TOUR_ID)).toBe(false);
    expect(buildPrivateTripPayload({ ...STATE, website: 'spam.example' }, TOUR_ID).website).toBe(
      'spam.example',
    );
  });

  it('interests LUÔN có mặt (schema `.default([])` khiến kiểu output không optional)', () => {
    expect(buildPrivateTripPayload(STATE, TOUR_ID).interests).toEqual([]);
  });
});
