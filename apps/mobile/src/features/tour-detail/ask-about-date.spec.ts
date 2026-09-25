import { buildAskAboutDatePayload, validateAskAboutDate } from './ask-about-date';

const VALID_STATE = {
  name: 'Alice Nguyen',
  email: 'alice@example.com',
  message: 'Will this date reopen soon?',
};
const DEPARTURE = { tourId: '0198c000-0000-7000-8000-000000000001', travelDate: '2026-12-24' };

describe('buildAskAboutDatePayload', () => {
  it('ghép ba ô khách gõ với tourId/travelDate của đợt đã bấm', () => {
    expect(buildAskAboutDatePayload(VALID_STATE, DEPARTURE)).toEqual({
      name: VALID_STATE.name,
      email: VALID_STATE.email,
      message: VALID_STATE.message,
      tourId: DEPARTURE.tourId,
      travelDate: DEPARTURE.travelDate,
      interests: [],
    });
  });
});

describe('validateAskAboutDate', () => {
  it('cả ba ô hợp lệ: không lỗi', () => {
    expect(validateAskAboutDate(VALID_STATE)).toEqual({});
  });

  it('tên rỗng: lỗi required; tên 1 ký tự: lỗi tooShort', () => {
    expect(validateAskAboutDate({ ...VALID_STATE, name: '' }).name).toBe('Enter your name.');
    expect(validateAskAboutDate({ ...VALID_STATE, name: 'A' }).name).toBe(
      'A first name is enough — just 2 characters or more.',
    );
  });

  it('email rỗng: lỗi required; email sai dạng: lỗi invalid', () => {
    expect(validateAskAboutDate({ ...VALID_STATE, email: '' }).email).toBe(
      'Enter your email address.',
    );
    expect(validateAskAboutDate({ ...VALID_STATE, email: 'not-an-email' }).email).toBe(
      'Enter a valid email address, e.g. you@example.com.',
    );
  });

  it('lời nhắn rỗng: lỗi required; dưới 10 ký tự: lỗi tooShort', () => {
    expect(validateAskAboutDate({ ...VALID_STATE, message: '' }).message).toBe(
      'Tell us a little about your trip.',
    );
    expect(validateAskAboutDate({ ...VALID_STATE, message: 'hi' }).message).toBe(
      'A few more words would help — at least 10 characters.',
    );
  });

  it('khoảng trắng đầu/cuối không tính vào độ dài (schema `.trim()` trước `.min()`)', () => {
    expect(validateAskAboutDate({ ...VALID_STATE, name: '  Al  ' })).toEqual({});
  });
});
