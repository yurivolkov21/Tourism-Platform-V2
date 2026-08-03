import { describe, expect, it } from 'vitest';
import { buildEnquiryPayload, type ContactFormState, validateEnquiry } from './enquiry-form';

// State hợp lệ dùng chung — mỗi test chỉ đổi field đang khảo sát (spec §2:
// "message" (textarea "loves") đủ ≥10 ký tự, name ≥2, email hợp lệ).
const VALID_STATE: ContactFormState = {
  name: 'Minh Anh',
  email: 'minh@example.com',
  loves: 'Slow mornings, street food, and a boat ride at sunset.',
  dates: '',
  count: '',
  region: '',
  website: '',
};

describe('buildEnquiryPayload', () => {
  it('name/email trần — không biến đổi', () => {
    const payload = buildEnquiryPayload(VALID_STATE);
    expect(payload.name).toBe(VALID_STATE.name);
    expect(payload.email).toBe(VALID_STATE.email);
  });

  it('dates rỗng: message = nguyên văn "loves", không ghép gì thêm', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, dates: '' });
    expect(payload.message).toBe(VALID_STATE.loves);
  });

  it('dates có giá trị: ghép "\\n\\nPreferred dates: <dates>" vào cuối message', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, dates: 'next April' });
    expect(payload.message).toBe(`${VALID_STATE.loves}\n\nPreferred dates: next April`);
  });

  it('count "4": parse được int hợp lệ → groupSize = 4', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, count: '4' });
    expect(payload.groupSize).toBe(4);
  });

  it('count "bốn": không phải số → bỏ field groupSize', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, count: 'bốn' });
    expect(payload.groupSize).toBeUndefined();
  });

  it('count "0": ngoài khoảng 1..100 → bỏ field groupSize', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, count: '0' });
    expect(payload.groupSize).toBeUndefined();
  });

  it('count "101": ngoài khoảng 1..100 → bỏ field groupSize', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, count: '101' });
    expect(payload.groupSize).toBeUndefined();
  });

  it('count rỗng: bỏ field groupSize', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, count: '' });
    expect(payload.groupSize).toBeUndefined();
  });

  it('region không chọn: interests rỗng', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, region: '' });
    expect(payload.interests).toEqual([]);
  });

  it('region có chọn: interests = [region]', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, region: 'central' });
    expect(payload.interests).toEqual(['central']);
  });

  it('honeypot điền: passthrough nguyên giá trị vào field website', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, website: 'http://spam.example' });
    expect(payload.website).toBe('http://spam.example');
  });

  it('honeypot rỗng: bỏ field website (server không cần thấy field rỗng)', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, website: '' });
    expect(payload.website).toBeUndefined();
  });

  it('region "any" ("Anywhere in Vietnam"): interests rỗng, KHÔNG gửi \'any\' làm interest rác (final review item 2)', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, region: 'any' });
    expect(payload.interests).toEqual([]);
  });

  it('KHÔNG bao giờ gửi travelDate (schema đòi ISO date, text tự do là bịa dữ liệu)', () => {
    const payload = buildEnquiryPayload({ ...VALID_STATE, dates: 'next April' });
    expect(payload).not.toHaveProperty('travelDate');
  });
});

describe('validateEnquiry', () => {
  it('state hợp lệ đầy đủ → không có lỗi nào', () => {
    expect(validateEnquiry(VALID_STATE)).toEqual({});
  });

  it('honeypot điền nhưng field khác hợp lệ → vẫn build hợp lệ, không lỗi', () => {
    expect(validateEnquiry({ ...VALID_STATE, website: 'http://spam.example' })).toEqual({});
  });

  it('name rỗng → lỗi field "name", copy "required"', () => {
    const errors = validateEnquiry({ ...VALID_STATE, name: '' });
    expect(errors.name).toBe('Enter your name.');
  });

  it('name 1 ký tự → lỗi field "name", copy "tooShort"', () => {
    const errors = validateEnquiry({ ...VALID_STATE, name: 'A' });
    expect(errors.name).toBe('A first name is enough — just 2 characters or more.');
  });

  it('email rỗng → lỗi field "email", copy "required"', () => {
    const errors = validateEnquiry({ ...VALID_STATE, email: '' });
    expect(errors.email).toBe('Enter your email address.');
  });

  it('email sai định dạng → lỗi field "email", copy "invalid"', () => {
    const errors = validateEnquiry({ ...VALID_STATE, email: 'not-an-email' });
    expect(errors.email).toBe('Enter a valid email address, e.g. you@example.com.');
  });

  it('loves rỗng → lỗi field "loves", copy "required"', () => {
    const errors = validateEnquiry({ ...VALID_STATE, loves: '' });
    expect(errors.loves).toBe('Tell us a little about your trip.');
  });

  it('message 9 ký tự (loves ngắn, dates rỗng) → lỗi field "loves", copy "tooShort"', () => {
    const errors = validateEnquiry({ ...VALID_STATE, loves: '123456789' });
    expect(errors.loves).toBe('A few more words would help — at least 10 characters.');
  });

  // Final review item 1: suffix "\n\nPreferred dates: …" (≥18 ký tự) tự thoả
  // message.min(10) của schema khi safeParse chạy trên payload ĐÃ GHÉP, nên
  // "loves" rỗng vẫn lọt qua nếu chỉ soi issues của safeParse. Quyết định
  // controller: "loves" LUÔN bắt buộc ≥10 ký tự (trim), ĐỘC LẬP với dates —
  // hai test dưới phải ĐỎ trên code cũ (không check state.loves trước parse).
  it('loves rỗng + dates có giá trị → vẫn lỗi field "loves", copy "required" (final review item 1)', () => {
    const errors = validateEnquiry({ ...VALID_STATE, loves: '', dates: 'next April' });
    expect(errors.loves).toBe('Tell us a little about your trip.');
  });

  it('loves 4 ký tự + dates có giá trị → vẫn lỗi field "loves", copy "tooShort" (final review item 1)', () => {
    const errors = validateEnquiry({ ...VALID_STATE, loves: 'ngắn', dates: 'next April' });
    expect(errors.loves).toBe('A few more words would help — at least 10 characters.');
  });

  it('dates/region không thuộc schema → không bao giờ xuất hiện trong lỗi', () => {
    // count "bốn" bị buildEnquiryPayload bỏ field groupSize (không phải lỗi
    // schema); region/dates không map tới lỗi nào — kiểm luôn trong state
    // hợp lệ khác để chắc hai key này không lọt vào object lỗi.
    const errors = validateEnquiry({
      ...VALID_STATE,
      name: '',
      dates: 'next April',
      region: 'north',
    });
    expect(errors).not.toHaveProperty('dates');
    expect(errors).not.toHaveProperty('region');
    expect(errors).not.toHaveProperty('count');
  });
});
