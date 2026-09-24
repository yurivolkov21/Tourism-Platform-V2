import { z } from 'zod';
import { descriptionSchema } from './common.js';
import { slugSchema } from './slug.js';

/**
 * Bề mặt danh mục tour phía ADMIN (spec P4e-2 F14).
 *
 * Khác `catalog.categories.list` — bề mặt công khai ấy chỉ trả hàng đang bật và
 * không có cách nào ghi. Ở đây admin nhìn thấy cả hàng đã tắt, vì "tắt" là
 * trạng thái vận hành chứ không phải xoá.
 *
 * Ba quyết định của spec hiện ra ngay trong hình dạng các schema dưới đây:
 *
 * - **Không có lệnh xoá.** Cả bảng chỉ có `setActive`. `is_active` đã có sẵn ở
 *   DB, tắt thì đảo ngược được bằng một cú bấm — còn xoá thì không.
 * - **`update` không mang `slug`.** Slug đi vào URL công khai dạng tham số
 *   truy vấn (`/tours?categories=<slug>`), mà tham số truy vấn thì KHÔNG
 *   chuyển hướng được: đổi slug là mọi link đã chia sẻ lọc ra rỗng. Nên slug
 *   chỉ đặt được một lần, lúc tạo.
 * - **`move` nhận HƯỚNG, không nhận số thứ tự.** Client không cần biết `order`
 *   đang là bao nhiêu, và hai admin bấm cùng lúc không thể ghi hai hàng cùng số.
 */

/**
 * Trần của từng cột, gương đúng `schema.prisma`.
 *
 * Export ra ngoài vì admin dùng lại: ô nhập đếm ký tự bằng CHÍNH con số này, và
 * `slugifyVietnamese(name, CATEGORY_SLUG_MAX)` cắt bằng nó. Chép số ra hai nơi
 * là mở đường cho một ô nhập cho gõ 80 ký tự rồi ăn một lỗi 400 ở tầng dưới.
 */
export const CATEGORY_SLUG_MAX = 60;
export const CATEGORY_NAME_MAX = 120;
export const CATEGORY_DESCRIPTION_MAX = 500;

/**
 * Slug: khuôn DÙNG CHUNG với điểm đến (`SLUG_PATTERN` ở `slug.ts`, bài học 6 của
 * vòng review F14), trần của bảng này. Đã đo sáu slug đang chạy trên production
 * — `day`, `package`, `cruise`, `trekking`, `honeymoon`, `seasonal-classics` —
 * tất cả đều qua.
 */
export const CategorySlugSchema = slugSchema(CATEGORY_SLUG_MAX);

/** Ô mô tả: cắt khoảng trắng, RỖNG thì thành `null` — xem `descriptionSchema`. */
const CategoryDescriptionSchema = descriptionSchema(CATEGORY_DESCRIPTION_MAX);

/** Một hàng của bảng `/categories` phía admin — gồm cả hàng đã tắt. */
export const AdminCategoryRowSchema = z.object({
  id: z.uuid(),
  slug: CategorySlugSchema,
  name: z.string().min(1).max(CATEGORY_NAME_MAX),
  description: z.string().max(CATEGORY_DESCRIPTION_MAX).nullable(),
  /** Thứ tự hiển thị trên web. Bảng admin sắp theo chính nó. */
  order: z.int(),
  isActive: z.boolean(),
  /** Số tour ĐÃ ĐĂNG thuộc danh mục này — nuôi câu cảnh báo lúc tắt. */
  tourCount: z.int().nonnegative(),
});
export type AdminCategoryRow = z.output<typeof AdminCategoryRowSchema>;

/**
 * Tạo một danh mục. `order` KHÔNG nằm trong input: server đặt nó bằng max + 1,
 * vì "thêm vào cuối" là thứ duy nhất có nghĩa khi chưa có hàng nào để so.
 */
export const AdminCategoryCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
  slug: CategorySlugSchema,
  /**
   * Bỏ trống thành `null` chứ không thành chuỗi rỗng: cột nullable, và "chưa
   * viết mô tả" khác "mô tả là một chuỗi rỗng".
   */
  description: CategoryDescriptionSchema.default(null),
});
export type AdminCategoryCreateInput = z.output<typeof AdminCategoryCreateInputSchema>;

/** Sửa một danh mục — CỐ Ý không có `slug`, xem JSDoc đầu file. */
export const AdminCategoryUpdateInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
  description: CategoryDescriptionSchema,
});
export type AdminCategoryUpdateInput = z.output<typeof AdminCategoryUpdateInputSchema>;

/** Bật hoặc tắt. Tách khỏi `update` vì nó là một cú bấm trên hàng, không phải một form. */
export const AdminCategorySetActiveInputSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});
export type AdminCategorySetActiveInput = z.output<typeof AdminCategorySetActiveInputSchema>;

/** Đổi chỗ với hàng liền kề. Hướng, không phải số — xem JSDoc đầu file. */
export const AdminCategoryMoveInputSchema = z.object({
  id: z.uuid(),
  direction: z.enum(['up', 'down']),
});
export type AdminCategoryMoveInput = z.output<typeof AdminCategoryMoveInputSchema>;
