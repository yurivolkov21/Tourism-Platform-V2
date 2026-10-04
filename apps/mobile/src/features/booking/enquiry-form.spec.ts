import { ORPCError } from '@orpc/client';
import { buildEnquiryPayload, enquiryErrorCopy, validateEnquiry } from './enquiry-form';

const VALID_STATE = {
  name: 'Lan Nguyen',
  email: 'lan.nguyen@example.com',
  phone: '',
  message: 'Can I move my booking to a later date?',
};

describe('validateEnquiry', () => {
  it('đủ bốn ô hợp lệ (phone rỗng vì tuỳ chọn): không lỗi', () => {
    expect(validateEnquiry(VALID_STATE)).toEqual({});
  });

  it('tên rỗng hoặc quá ngắn: lỗi nameRequired', () => {
    expect(validateEnquiry({ ...VALID_STATE, name: '' }).name).toBe('Please enter your name.');
    expect(validateEnquiry({ ...VALID_STATE, name: 'A' }).name).toBe('Please enter your name.');
  });

  it('email rỗng hoặc sai dạng: lỗi emailInvalid', () => {
    expect(validateEnquiry({ ...VALID_STATE, email: '' }).email).toBe(
      'Please enter a valid email address.',
    );
    expect(validateEnquiry({ ...VALID_STATE, email: 'not-an-email' }).email).toBe(
      'Please enter a valid email address.',
    );
  });

  it('lời nhắn rỗng hoặc dưới 10 ký tự: lỗi messageRequired', () => {
    expect(validateEnquiry({ ...VALID_STATE, message: '' }).message).toBe(
      'Please write a short message.',
    );
    expect(validateEnquiry({ ...VALID_STATE, message: 'hi' }).message).toBe(
      'Please write a short message.',
    );
  });

  it('phone có điền vẫn hợp lệ, không bắt buộc đúng định dạng cụ thể', () => {
    expect(validateEnquiry({ ...VALID_STATE, phone: '+84 912 345 678' })).toEqual({});
  });

  it('khoảng trắng đầu/cuối không tính vào độ dài (schema `.trim()` trước `.min()`)', () => {
    expect(validateEnquiry({ ...VALID_STATE, name: '  Lan  ' })).toEqual({});
  });
});

describe('buildEnquiryPayload', () => {
  it('phone rỗng thì KHÔNG gửi field phone (optional thật sự, không gửi chuỗi rỗng)', () => {
    expect(buildEnquiryPayload(VALID_STATE)).toEqual({
      name: VALID_STATE.name,
      email: VALID_STATE.email,
      message: VALID_STATE.message,
      interests: [],
    });
  });

  it('phone có điền thì gửi kèm, đã trim', () => {
    expect(buildEnquiryPayload({ ...VALID_STATE, phone: '  +84 912 345 678  ' })).toEqual({
      name: VALID_STATE.name,
      email: VALID_STATE.email,
      message: VALID_STATE.message,
      phone: '+84 912 345 678',
      interests: [],
    });
  });

  it('có tourId thì gắn enquiry vào đúng tour', () => {
    expect(buildEnquiryPayload(VALID_STATE, '0198c000-0000-7000-8000-000000000001')).toEqual({
      name: VALID_STATE.name,
      email: VALID_STATE.email,
      message: VALID_STATE.message,
      tourId: '0198c000-0000-7000-8000-000000000001',
      interests: [],
    });
  });
});

describe('enquiryErrorCopy', () => {
  it('429 thì câu rateLimited', () => {
    expect(enquiryErrorCopy(new ORPCError('TOO_MANY_REQUESTS', { status: 429 }))).toBe(
      'Too many requests — please wait a minute and try again.',
    );
  });

  it('lỗi khác hoặc không phải ORPCError thì câu generic', () => {
    expect(enquiryErrorCopy(new ORPCError('BAD_REQUEST', { status: 400 }))).toBe(
      "Couldn't send your enquiry. Please try again.",
    );
    expect(enquiryErrorCopy(new Error('network'))).toBe(
      "Couldn't send your enquiry. Please try again.",
    );
  });
});
