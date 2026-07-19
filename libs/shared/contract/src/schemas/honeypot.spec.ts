import { CreateEnquiryInputSchema } from './enquiries.js';
import { SubscribeInputSchema } from './newsletter.js';

/**
 * Field honeypot `website` của HAI form công khai (enquiry + newsletter).
 *
 * Vì sao phải test ở TẦNG CONTRACT chứ không phải int test: việc cắt ngắn
 * KHÔNG có tác dụng quan sát được nào qua HTTP. Giá trị `website` không bao
 * giờ được ghi xuống DB, cũng không còn được nội suy thô vào log (controller
 * chỉ log "website field non-empty"), nên response của ca quá khổ giống hệt
 * ca honeypot thường — đó chính là ĐIỀU MONG MUỐN, nhưng cũng có nghĩa int
 * test không thể phân biệt "có cắt" với "không cắt".
 *
 * Đã đo bằng mutation: gỡ HẲN `.transform()` khỏi cả hai schema mà toàn bộ
 * 114 int test vẫn XANH. Nếu chỉ dựa vào int test thì cái trần này hoàn toàn
 * không có gì canh. Assert thẳng trên schema là chỗ DUY NHẤT quan sát được.
 */
describe('honeypot `website` — cắt ngắn 200 ký tự, KHÔNG reject', () => {
  const VALID_ENQUIRY = {
    name: 'Nguyen Van A',
    email: 'a@example.com',
    message: 'Toi muon hoi ve tour nay',
  };

  it('enquiry: chuỗi 5000 ký tự → parse THÀNH CÔNG và bị cắt còn đúng 200', () => {
    const parsed = CreateEnquiryInputSchema.parse({
      ...VALID_ENQUIRY,
      website: 'a'.repeat(5000),
    });

    expect(parsed.website).toHaveLength(200);
  });

  it('newsletter: chuỗi 5000 ký tự → parse THÀNH CÔNG và bị cắt còn đúng 200', () => {
    const parsed = SubscribeInputSchema.parse({
      email: 'a@example.com',
      website: 'a'.repeat(5000),
    });

    expect(parsed.website).toHaveLength(200);
  });

  it('quá khổ KHÔNG bị reject — reject sẽ trả lại cho bot tín hiệu 400-vs-200', () => {
    // Đây là nửa còn lại của cặp: cắt ngắn phải THAY THẾ `.max()` reject, chứ
    // không phải đứng cạnh nó. Một `.max(200)` sót lại sẽ làm hai safeParse
    // dưới đây `success: false` và honeypot lại tự khai với bot.
    expect(
      CreateEnquiryInputSchema.safeParse({ ...VALID_ENQUIRY, website: 'a'.repeat(5000) }).success,
    ).toBe(true);
    expect(
      SubscribeInputSchema.safeParse({ email: 'a@example.com', website: 'a'.repeat(5000) }).success,
    ).toBe(true);
  });

  it('giá trị bình thường (ngắn) đi qua NGUYÊN VẸN — cắt không được đụng ca thật', () => {
    const parsed = CreateEnquiryInputSchema.parse({
      ...VALID_ENQUIRY,
      website: 'http://spam.example',
    });

    expect(parsed.website).toBe('http://spam.example');
  });

  it('vắng mặt vẫn là undefined — người thật để trống, không bị biến thành chuỗi rỗng', () => {
    expect(CreateEnquiryInputSchema.parse(VALID_ENQUIRY).website).toBeUndefined();
    expect(SubscribeInputSchema.parse({ email: 'a@example.com' }).website).toBeUndefined();
  });
});
