import { z } from 'zod';
import { DecimalStringSchema } from './catalog.js';
import { AdminPageQuerySchema, CalendarMonthSchema } from './common.js';

/**
 * Bề mặt catalog phía ADMIN (spec P4e-1) — khác hẳn `catalog.ts`, vốn là bề
 * mặt CÔNG KHAI và chỉ trả row đã published.
 *
 * P4e-1 mở vùng này bằng hai tính năng nối nhau: F11 (`admin.tours.*` — danh
 * sách 29 tour và công tắc đăng, file này) và F12 (`admin.departures.*` —
 * bảng chuyến của một tour). Hai tính năng thi công song song trên hai nhánh
 * nên CÙNG sửa file này; giữ mỗi nhánh gọn trong phần của mình.
 *
 * Quy ước kế thừa từ `catalog.ts`, không phát minh lại:
 * - Tiền là CHUỖI decimal (`"39.00"`), không bao giờ là float.
 * - Cột `@db.Date` của Prisma đi qua dây dưới dạng ngày lịch `YYYY-MM-DD`.
 * - Field DB nullable khai `.nullable()` (API trả `null` tường minh, không
 *   phải thiếu khoá).
 */

// ─────────────────────────────────────────────────────────────────────────────
// F11 — danh sách tour + công tắc đăng
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Một hàng của bảng `/tours` phía admin.
 *
 * KHÔNG phải `TourCardSchema`: card công khai chở nội dung bán hàng (summary,
 * badge, rating, destination, `priceFrom` tính theo đợt còn đặt được) mà bảng
 * vận hành không dùng tới, và LẠI THIẾU đúng hai thứ bảng này sống nhờ —
 * `isPublished` (card công khai chỉ tồn tại cho tour đã đăng nên cờ ấy luôn
 * `true`) và số chuyến đang mở.
 */
export const AdminTourRowSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  /** Tên danh mục đã join — bảng in chữ, không in uuid. */
  categoryName: z.string().min(1).max(120),
  /** Giá niêm yết của tour. Giá riêng của từng chuyến là chuyện của F12. */
  basePrice: DecimalStringSchema,
  currency: z.string().length(3),
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  /**
   * URL ảnh bìa — asset role `hero` của tour (ADR-0005/ADR-0020), dựng sẵn ở
   * API bằng đúng `MediaService` mà web dùng. `null` khi tour chưa gắn ảnh
   * nào: một sự thật bình thường của tour vừa tạo, không phải lỗi.
   *
   * Chỉ URL chứ không nguyên `MediaItem`: bảng vẽ một ô vuông 40px, mọi field
   * ghi công/kích thước/alt của item đầy đủ đều rơi xuống đất.
   */
  heroUrl: z.url().nullable(),
  /**
   * Số chuyến còn MỞ (`status = OPEN`) trong KHOẢNG LỌC của chính lượt gọi
   * này — không phải toàn bộ lịch sử chuyến của tour. Không có `?month=` thì
   * khoảng là "từ hôm nay (giờ Việt Nam) trở đi"; có thì là đúng tháng ấy.
   *
   * Đây là cột trả lời câu "tour nào tháng sau còn chạy" ngay tại màn danh
   * sách, thay vì phải bấm vào từng tour (spec §2a).
   */
  openDepartureCount: z.int().nonnegative(),
});

export type AdminTourRow = z.output<typeof AdminTourRowSchema>;

/**
 * Query cho `admin.tours.list`. Phân trang dùng chung `AdminPageQuerySchema`
 * (`page`/`limit`) đúng nếp `admin.bookings.list` — field gõ kiểu THUẦN,
 * `ZodSmartCoercionPlugin` bên API ép `"2"` → `2` của query string.
 *
 * `month` KHÔNG lọc bớt hàng, nó chỉ đổi KHOẢNG ĐẾM của
 * `openDepartureCount`: tour không có chuyến nào trong tháng đó vẫn có mặt
 * với số `0`. Đó là câu trả lời thật ("tour này tháng sau không chạy") và nó
 * giữ danh sách 29 tour đứng yên khi người dùng lia qua các tháng — một bảng
 * đổi cả số hàng theo bộ lọc thì không so sánh được hai tháng với nhau.
 */
export const AdminToursListQuerySchema = AdminPageQuerySchema.extend({
  categoryId: z.uuid().optional(),
  /** Vắng = mọi tour. `false` là một GIÁ TRỊ (chỉ tour đang ẩn), không phải "không lọc". */
  isPublished: z.boolean().optional(),
  month: CalendarMonthSchema.optional(),
});

export type AdminToursListQuery = z.output<typeof AdminToursListQuerySchema>;

/**
 * Input công tắc đăng. Gửi trạng thái ĐÍCH (`isPublished`) chứ không phải
 * lệnh "đảo": hai tab mở song song mà cùng gửi "đảo" thì tab cũ sẽ kéo hàng
 * về đúng cái vừa bị người kia bỏ đi — một lệnh idempotent không có chỗ cho
 * chuyện đó.
 */
export const AdminTourSetPublishedInputSchema = z.object({
  id: z.uuid(),
  isPublished: z.boolean(),
});

export type AdminTourSetPublishedInput = z.output<typeof AdminTourSetPublishedInputSchema>;

/**
 * Kết quả GỌN, không phải `AdminTourRow` (cùng nếp `admin.enquiries.setStatus`
 * và `admin.subscribers.unsubscribe`): bảng `router.refresh()` ngay sau lệnh
 * nên chở cả hàng qua dây chỉ để ném đi là một lượt đọc thừa.
 *
 * Và có một lý do riêng của vùng này: `openDepartureCount` CHỈ có nghĩa trong
 * khoảng lọc của một lượt `list`. Một lệnh ghi không mang bộ lọc nào, nên trả
 * kèm con số ấy là in ra một số không ai định nghĩa được.
 *
 * `changed: false` = hàng đã ở sẵn trạng thái được yêu cầu (bấm đúp, hoặc tab
 * khác vừa đổi). Không phải lỗi — nhưng phải phân biệt được với một lượt đổi
 * thật, vì chỉ lượt đổi thật mới đáng bust cache web.
 */
export const AdminTourSetPublishedResultSchema = z.object({
  id: z.uuid(),
  isPublished: z.boolean(),
  changed: z.boolean(),
});

export type AdminTourSetPublishedResult = z.output<typeof AdminTourSetPublishedResultSchema>;
