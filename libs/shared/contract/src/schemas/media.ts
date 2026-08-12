import { z } from 'zod';
import { BookingCodeSchema } from './common.js';

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

/**
 * ── Bề mặt GHI media (ADR-0021) ──
 * Đuôi ảnh được phép ký upload — để dạng enum trong contract nên request
 * sai đuôi chết ngay tầng validate, server không cần luật riêng.
 */
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'] as const;

/**
 * Trần dung lượng/số lượng dùng CHUNG client + server (ADR-0021 §2). Bytes
 * đi thẳng Cloudinary nên API không cân được file — enforce thật nằm ở
 * client; hằng sống ở contract để hai bên đọc MỘT nguồn, đổi số đổi một chỗ.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const REVIEW_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const REVIEW_PHOTOS_MAX = 5;

/** Input ký upload — REVIEW_PHOTO phải khai booking để server soi quyền. */
export const SignUploadInputSchema = z.discriminatedUnion('purpose', [
  z.object({
    purpose: z.literal('AVATAR'),
    ext: z.enum(ALLOWED_IMAGE_EXTENSIONS),
  }),
  z.object({
    purpose: z.literal('REVIEW_PHOTO'),
    ext: z.enum(ALLOWED_IMAGE_EXTENSIONS),
    bookingCode: BookingCodeSchema,
  }),
]);

/**
 * Bộ tham số browser cần để POST file thẳng lên Cloudinary. Chữ ký phủ
 * `{folder, public_id, timestamp}` — form phải gửi đúng các giá trị này,
 * đổi một ký tự là Cloudinary từ chối. KHÔNG BAO GIỜ chứa api_secret.
 */
export const SignedUploadParamsSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.int().positive(),
  apiKey: z.string().min(1),
  cloudName: z.string().min(1),
  folder: z.string().min(1),
  /** BASENAME server sinh (không kèm folder) — form gửi nguyên ở field `public_id`. */
  publicId: z.string().min(1),
  uploadUrl: z.url(),
});

export type SignUploadInput = z.infer<typeof SignUploadInputSchema>;
export type SignedUploadParams = z.output<typeof SignedUploadParamsSchema>;
