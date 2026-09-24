import { z } from 'zod';
import { descriptionSchema } from './common.js';
import { RegionNameSchema } from './regions.js';
import { slugSchema } from './slug.js';

/**
 * Bề mặt điểm đến phía ADMIN (spec P4e-2 F15) — bản song sinh của
 * `admin-categories.ts`, trừ hai chỗ: không có `order` (nên không có `move`),
 * và có `region` là một danh sách chọn.
 *
 * Khác `catalog.destinations.list` — bề mặt công khai ấy chỉ trả hàng đang bật
 * và không có cách nào ghi. Ở đây admin nhìn thấy cả hàng đã ẩn, vì "ẩn" là
 * trạng thái vận hành chứ không phải xoá.
 *
 * Ba quyết định của spec hiện ra ngay trong hình dạng các schema dưới đây:
 *
 * - **Không có lệnh xoá.** Chỉ có `setActive`. Khoá ngoại `tour_destinations`
 *   khai `ON DELETE CASCADE`, nên một lệnh xoá sẽ âm thầm gỡ điểm đến khỏi mọi
 *   tour — DB không chặn (spec §2a).
 * - **`update` không mang `slug`.** Slug đi vào `/tours?destinations=<slug>`,
 *   mà tham số truy vấn thì KHÔNG chuyển hướng được (spec §2c).
 * - **`region` ghi qua `RegionNameSchema`.** Cột là chữ tự do, còn web ghép nó
 *   với ba vùng cố định; một lần gõ nhầm là điểm đến biến khỏi mọi trang vùng
 *   mà không có lỗi nào (spec §2b, ADR-0045).
 */

/**
 * Trần của từng cột, gương đúng `schema.prisma`. Export vì admin dùng lại: ô
 * nhập đếm ký tự bằng CHÍNH con số này, và `slugifyVietnamese(name,
 * DESTINATION_SLUG_MAX)` cắt bằng nó.
 */
export const DESTINATION_SLUG_MAX = 80;
export const DESTINATION_NAME_MAX = 120;
export const DESTINATION_COUNTRY_MAX = 60;
/** Độ rộng cột `region` — chỉ nuôi schema HÀNG; input thì chỉ nhận ba tên vùng. */
export const DESTINATION_REGION_MAX = 80;
export const DESTINATION_DESCRIPTION_MAX = 2000;

/** Gương `@default("Vietnam")` của cột — ô quốc gia ở form tạo điền sẵn chính chuỗi này. */
export const DESTINATION_DEFAULT_COUNTRY = 'Vietnam';

export const DestinationSlugSchema = slugSchema(DESTINATION_SLUG_MAX);

const DestinationNameSchema = z.string().trim().min(1).max(DESTINATION_NAME_MAX);

/** Cắt khoảng trắng và chặn rỗng: cột NOT NULL, chuỗi rỗng ở đó là một hàng không quốc gia. */
const DestinationCountrySchema = z.string().trim().min(1).max(DESTINATION_COUNTRY_MAX);

const DestinationDescriptionSchema = descriptionSchema(DESTINATION_DESCRIPTION_MAX);

/**
 * Một hàng của bảng `/destinations` phía admin — gồm cả hàng đã ẩn.
 *
 * Schema HÀNG cố ý lỏng hơn input ở hai cột: `slug` và `region` mô tả thứ DB
 * có thể đang giữ, không phải luật ghi. Output mà chặt thì một hàng kiểu cũ
 * (region `north`, hay `null` từ thời seed) làm cả bảng sập 500 — đúng lúc
 * admin cần mở nó ra để sửa. Luật nằm ở input; chuẩn hoá chuỗi thô để chọn sẵn
 * ô vùng là việc của `findRegion`.
 */
export const AdminDestinationRowSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(DESTINATION_SLUG_MAX),
  name: z.string().min(1).max(DESTINATION_NAME_MAX),
  country: z.string().min(1).max(DESTINATION_COUNTRY_MAX),
  region: z.string().max(DESTINATION_REGION_MAX).nullable(),
  description: z.string().max(DESTINATION_DESCRIPTION_MAX).nullable(),
  isActive: z.boolean(),
  /** Số tour ĐÃ ĐĂNG gắn vào điểm đến này — nuôi câu cảnh báo lúc ẩn. */
  tourCount: z.int().nonnegative(),
});
export type AdminDestinationRow = z.output<typeof AdminDestinationRowSchema>;

export const AdminDestinationCreateInputSchema = z.object({
  name: DestinationNameSchema,
  slug: DestinationSlugSchema,
  country: DestinationCountrySchema.default(DESTINATION_DEFAULT_COUNTRY),
  region: RegionNameSchema,
  description: DestinationDescriptionSchema.default(null),
});
export type AdminDestinationCreateInput = z.output<typeof AdminDestinationCreateInputSchema>;

/**
 * Sửa một điểm đến — CỐ Ý không có `slug`, xem JSDoc đầu file.
 *
 * `country` BẮT BUỘC ở đây, không mặc định như lệnh tạo: mặc định chỉ có
 * nghĩa khi hàng chưa tồn tại. Ở lệnh sửa, một client quên gửi ô này mà
 * schema tự điền `Vietnam` là âm thầm đổi dữ liệu người ta không hề chạm.
 */
export const AdminDestinationUpdateInputSchema = z.object({
  id: z.uuid(),
  name: DestinationNameSchema,
  country: DestinationCountrySchema,
  region: RegionNameSchema,
  description: DestinationDescriptionSchema,
});
export type AdminDestinationUpdateInput = z.output<typeof AdminDestinationUpdateInputSchema>;

/** Ẩn hoặc hiện. Tách khỏi `update` vì nó là một cú bấm trên hàng, không phải một form. */
export const AdminDestinationSetActiveInputSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});
export type AdminDestinationSetActiveInput = z.output<typeof AdminDestinationSetActiveInputSchema>;
