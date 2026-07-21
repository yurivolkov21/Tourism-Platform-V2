import { CreateEnquiryInputSchema } from './enquiries.js';

/**
 * Ràng buộc độ dài tối thiểu của `name` trên form liên hệ công khai.
 *
 * Vì sao canh ở TẦNG CONTRACT: rule này chỉ sống ở Zod — grep
 * `prisma/migrations/` xác nhận KHÔNG có CHECK độ dài `name` ở DB, nên schema
 * là chỗ DUY NHẤT quan sát được. Int test không đủ: mutation `.min(2)`→`.min(1)`
 * không làm ca int nào đỏ (chúng gửi tên dài).
 *
 * Khôi phục parity với Nexora `@MinLength(2)`
 * (`modules/enquiry/dto/create-enquiry.dto.ts`). v2 từng nới xuống `.min(1)`,
 * nhận cả lead tên 1 ký tự — thụt lùi N1 (đối chiếu 21/07).
 */
describe('CreateEnquiryInputSchema — `name` tối thiểu 2 ký tự', () => {
  const BASE = {
    email: 'a@example.com',
    message: 'Toi muon hoi ve tour nay',
  };

  it('name 1 ký tự → reject (Nexora chặn, v2 phải chặn theo)', () => {
    expect(CreateEnquiryInputSchema.safeParse({ ...BASE, name: 'A' }).success).toBe(false);
  });

  it('name đúng 2 ký tự → chấp nhận (biên dưới hợp lệ)', () => {
    expect(CreateEnquiryInputSchema.safeParse({ ...BASE, name: 'Al' }).success).toBe(true);
  });
});
