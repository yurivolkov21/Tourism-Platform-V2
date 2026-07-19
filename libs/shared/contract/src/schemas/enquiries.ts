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
   *
   * `.max(200)` BẮT BUỘC dù field này chẳng bao giờ được dùng: đây là chuỗi
   * do kẻ tấn công điều khiển và mọi field anh em đều đã có trần (`name` 120,
   * `message` 2000). Không có trần thì cái chặn duy nhất là giới hạn body
   * 1 MiB mặc định của Fastify — tức bot bơm được ~1 MB text tự chọn, lặp vô
   * hạn từ vô số IP, vào log ứng dụng. 200 đủ rộng cho mọi giá trị thật
   * (luôn là chuỗi rỗng) mà vẫn chặn được kiểu lạm dụng đó.
   */
  website: z.string().max(200).optional(),
});

export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInputSchema>;

/**
 * LUÔN là một uuid — KHÔNG nullable. Nhánh honeypot cũng trả uuid (sinh bằng
 * `randomUUID()`, không bao giờ ghi xuống DB) đúng bằng lý do tồn tại của cái
 * bẫy: response phải giống hệt nhánh thành công tới từng shape, không chỉ
 * status. Trước đây field này `.nullable()` để chở `id: null` của honeypot —
 * chính chỗ đó tự khai với bot rằng nó bị bắt. Giờ `null` không còn xảy ra
 * được nữa, nên giữ `.nullable()` sẽ là hợp đồng nói dối: buộc mọi client
 * xử lý một nhánh vĩnh viễn không tồn tại.
 */
export const EnquiryResultSchema = z.object({ id: z.uuid() });

export type EnquiryResult = z.infer<typeof EnquiryResultSchema>;
