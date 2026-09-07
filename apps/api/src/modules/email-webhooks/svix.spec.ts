import { signSvixPayload, verifySvixSignature } from './svix.js';

// W4 E6 (ADR-0039 §4): verify chữ ký webhook Resend (chuẩn svix) — logic
// thuần, TDD trước. Secret dạng `whsec_<base64>`; nội dung ký là
// `<id>.<timestamp>.<body>`; header mang danh sách `v1,<base64>` cách nhau
// bằng khoảng trắng; timestamp lệch quá 5 phút bị loại (chống replay).

const SECRET = `whsec_${Buffer.from('int-test-webhook-secret-32bytes!').toString('base64')}`;
const NOW = new Date('2026-09-07T12:00:00.000Z');
const TS = String(Math.floor(NOW.getTime() / 1000));
const ID = 'msg_2abc';
const BODY = '{"type":"email.bounced","data":{"to":["a@example.com"]}}';

describe('verifySvixSignature', () => {
  it('chữ ký đúng, timestamp tươi → true', () => {
    const sig = signSvixPayload(SECRET, ID, TS, BODY);
    expect(
      verifySvixSignature({
        secret: SECRET,
        id: ID,
        timestamp: TS,
        signatureHeader: `v1,${sig}`,
        payload: BODY,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('header nhiều chữ ký (xoay secret) — chỉ cần MỘT cái khớp', () => {
    const sig = signSvixPayload(SECRET, ID, TS, BODY);
    expect(
      verifySvixSignature({
        secret: SECRET,
        id: ID,
        timestamp: TS,
        signatureHeader: `v1,${Buffer.from('wrong').toString('base64')} v1,${sig}`,
        payload: BODY,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('body bị sửa / secret khác / id khác → false', () => {
    const sig = signSvixPayload(SECRET, ID, TS, BODY);
    const base = { secret: SECRET, id: ID, timestamp: TS, signatureHeader: `v1,${sig}`, now: NOW };
    expect(verifySvixSignature({ ...base, payload: `${BODY} ` })).toBe(false);
    expect(verifySvixSignature({ ...base, payload: BODY, id: 'msg_khac' })).toBe(false);
    expect(
      verifySvixSignature({
        ...base,
        payload: BODY,
        secret: `whsec_${Buffer.from('another-secret').toString('base64')}`,
      }),
    ).toBe(false);
  });

  it('timestamp lệch quá 5 phút (cả hai chiều) → false — chống replay', () => {
    const sig = signSvixPayload(SECRET, ID, TS, BODY);
    const base = {
      secret: SECRET,
      id: ID,
      timestamp: TS,
      signatureHeader: `v1,${sig}`,
      payload: BODY,
    };
    expect(verifySvixSignature({ ...base, now: new Date(NOW.getTime() + 6 * 60_000) })).toBe(false);
    expect(verifySvixSignature({ ...base, now: new Date(NOW.getTime() - 6 * 60_000) })).toBe(false);
  });

  it('đầu vào rác (timestamp không phải số, header rỗng, secret sai dạng) → false, không throw', () => {
    const sig = signSvixPayload(SECRET, ID, TS, BODY);
    expect(
      verifySvixSignature({
        secret: SECRET,
        id: ID,
        timestamp: 'NaN',
        signatureHeader: `v1,${sig}`,
        payload: BODY,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      verifySvixSignature({
        secret: SECRET,
        id: ID,
        timestamp: TS,
        signatureHeader: '',
        payload: BODY,
        now: NOW,
      }),
    ).toBe(false);
    expect(
      verifySvixSignature({
        secret: 'not-a-whsec-secret',
        id: ID,
        timestamp: TS,
        signatureHeader: `v1,${sig}`,
        payload: BODY,
        now: NOW,
      }),
    ).toBe(false);
  });
});
