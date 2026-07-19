import { z } from 'zod';

/**
 * Form liên hệ công khai (spec §4.3) — endpoint GHI đầu tiên khách CHƯA đăng
 * nhập gọi được. `tourId` optional: enquiry có thể gắn với một tour cụ thể
 * hoặc là câu hỏi chung chung.
 */
export const CreateEnquiryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  phone: z.string().trim().max(30).optional(),
  // min 10: chặn "hi"/"test" — ngưỡng Nexora dùng, giữ nguyên.
  message: z.string().trim().min(10).max(2000),
  tourId: z.uuid().optional(),
  nationality: z.string().trim().max(80).optional(),
  travelDate: z.iso.date().optional(),
  groupSize: z.int().min(1).max(100).optional(),
  budgetTier: z.string().trim().max(40).optional(),
  interests: z.array(z.string().trim().max(40)).max(20).default([]),
  /**
   * HONEYPOT — field ẩn trong form, người thật không bao giờ điền.
   *
   * Cố ý `.optional()` KHÔNG refine reject: nếu trả lỗi validate thì bot
   * biết ngay mình bị phát hiện rồi đổi chiến thuật. Controller sẽ trả 200
   * giả và KHÔNG ghi DB — bot tưởng thành công, ta không tốn một dòng nào.
   */
  website: z.string().optional(),
});

export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInputSchema>;

/** `id: null` khi bị honeypot bắt — response vẫn 200 nên bot không phân biệt
 * được, còn phía ta thì log được. */
export const EnquiryResultSchema = z.object({ id: z.uuid().nullable() });

export type EnquiryResult = z.infer<typeof EnquiryResultSchema>;
