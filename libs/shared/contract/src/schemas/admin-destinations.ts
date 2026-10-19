import { z } from 'zod';
import { MediaSourceSchema } from './admin-media.js';
import { AdminTourPhotoInputSchema, TOUR_PHOTOS_MAX } from './admin-tours.js';
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
 * - **Xoá chỉ khi chưa tour nào dùng** (ADR-0053). Server kiểm số liên kết dưới khoá hàng
 *   trong cùng transaction rồi mới xoá, còn liên kết thì `IN_USE`. Khoá ngoại
 *   `tour_destinations` là `ON DELETE RESTRICT` từ AMEND 2 (G25), chặn các đường xoá ngoài
 *   API.
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
  /** Số tour MỌI trạng thái gắn điểm đến — bằng 0 thì xoá được (ADR-0053 §5). */
  linkedTourCount: z.int().nonnegative(),
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

/** Xoá một điểm đến chưa tour nào dùng (ADR-0053). */
export const AdminDestinationDeleteInputSchema = z.object({ id: z.uuid() });
export type AdminDestinationDeleteInput = z.output<typeof AdminDestinationDeleteInputSchema>;

/** Slug của hàng vừa xoá — cùng khuôn kết quả `admin.tours.delete`. */
export const AdminDestinationDeleteResultSchema = z.object({ slug: z.string() });
export type AdminDestinationDeleteResult = z.output<typeof AdminDestinationDeleteResultSchema>;

// ── Ảnh (Media B, ADR-0060 §8) ──────────────────────────────────────────────

/**
 * Trần ảnh của một điểm đến — bằng trần ảnh tour: trang Photos của điểm đến dùng lại khuôn tab
 * Photos của tour (lọc file, sức chứa, ký theo lô), và lô ký của hai bên cùng một cỡ.
 */
export const DESTINATION_PHOTOS_MAX = TOUR_PHOTOS_MAX;

/** Phiên bản của điểm đến: `updatedAt` dạng ISO, cùng nếp tour và bài viết. */
const DestinationVersionSchema = z.iso.datetime();

/**
 * Một ảnh của điểm đến như trang Photos cần. Nguồn chỉ có hai (ADR-0060 §8): `UPLOAD` là thư mục
 * tải lên của chính điểm đến, `CATALOG` là ảnh đi theo site — gỡ ra thì không thêm lại được từ
 * admin. Không có `LIBRARY`: thư viện chính là trang này. `usedByTours` đếm tour đang mượn ảnh,
 * nuôi câu hậu quả khi gỡ. Lỏng như mọi schema HÀNG: dữ liệu cũ có thể thiếu alt và số đo.
 */
export const AdminDestinationPhotoSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  alt: z.string().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  source: MediaSourceSchema,
  usedByTours: z.int().nonnegative(),
  author: z.string().nullable(),
  license: z.string().nullable(),
});
export type AdminDestinationPhoto = z.output<typeof AdminDestinationPhotoSchema>;

/** Một điểm đến kèm danh sách ảnh theo thứ tự hiển thị — ảnh đầu là ảnh bìa (ADR-0048 §1). */
export const AdminDestinationPhotosSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(DESTINATION_NAME_MAX),
  slug: z.string().min(1).max(DESTINATION_SLUG_MAX),
  isActive: z.boolean(),
  version: DestinationVersionSchema,
  photos: z.array(AdminDestinationPhotoSchema),
});
export type AdminDestinationPhotos = z.output<typeof AdminDestinationPhotosSchema>;

/** Mở trang Photos theo slug — đường dẫn admin đọc được, như khu sửa tour. */
export const AdminDestinationPhotosInputSchema = z.object({ slug: DestinationSlugSchema });
export type AdminDestinationPhotosInput = z.output<typeof AdminDestinationPhotosInputSchema>;

/**
 * Thay trọn danh sách ảnh (ADR-0060 §8). Mỗi ảnh đúng hình ảnh của tab Photos tour (publicId, alt
 * 1 đến 300 ký tự, metadata khi vừa tải lên) — một schema cho cả hai trình sửa. Danh sách rỗng
 * hợp lệ: điểm đến mới tạo đã không có ảnh nào, web vẽ ô giữ chỗ.
 */
export const AdminDestinationSetPhotosInputSchema = z.object({
  id: z.uuid(),
  version: DestinationVersionSchema,
  photos: z
    .array(AdminTourPhotoInputSchema)
    .max(DESTINATION_PHOTOS_MAX)
    .refine((photos) => new Set(photos.map((photo) => photo.publicId)).size === photos.length, {
      message: 'a photo can only be listed once',
    }),
});
export type AdminDestinationSetPhotosInput = z.output<typeof AdminDestinationSetPhotosInputSchema>;

/** Ký một LÔ upload vào thư mục của điểm đến — một request cho cả lô, như ảnh tour. */
export const AdminDestinationSignPhotoUploadsInputSchema = z.object({
  id: z.uuid(),
  count: z.int().min(1).max(DESTINATION_PHOTOS_MAX),
});
export type AdminDestinationSignPhotoUploadsInput = z.output<
  typeof AdminDestinationSignPhotoUploadsInputSchema
>;
