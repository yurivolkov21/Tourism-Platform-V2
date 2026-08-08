import { z } from 'zod';

/**
 * Một media asset đã dựng URL (ADR-0005). `url` là thứ web render; `publicId`
 * giữ để admin (P4) re-submit item không đổi. DB-nullable → `.nullable()`.
 */
export const MediaItemSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  type: z.enum(['IMAGE', 'VIDEO']),
  role: z.enum(['hero', 'gallery', 'avatar', 'body']),
  posterUrl: z.url().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  alt: z.string().nullable(),
  sortOrder: z.int().nonnegative(),
  // Ghi công (ADR-0020). Bốn khoá này BẮT BUỘC có mặt nhưng cho phép null —
  // không dùng `.optional()`, vì web phải phân biệt được "chưa ai điền" (null)
  // với "trường không tồn tại". Nếu optional, một asset CC BY thiếu ghi công sẽ
  // trượt qua im lặng và ta phát hành ảnh mà không thoả điều kiện giấy phép.
  //
  // null là hợp lệ cho ảnh Pixabay (không đòi ghi công) và ảnh tự chụp.
  author: z.string().nullable(),
  // Giữ NGUYÊN chuỗi nguồn công bố ('CC BY-SA 4.0', 'Public domain'…), không ép
  // về enum: phiên bản giấy phép quyết định nghĩa vụ, ép enum là mất thông tin.
  license: z.string().nullable(),
  licenseUrl: z.url().nullable(),
  sourceUrl: z.url().nullable(),
});

export type MediaItem = z.output<typeof MediaItemSchema>;
