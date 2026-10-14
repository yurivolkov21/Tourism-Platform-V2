import cloudinaryLoader from './cloudinary-loader';

/**
 * URL ảnh nhỏ cho thẻ `<img>` thường (avatar, ảnh khách đính kèm review): thẻ này
 * không đi qua loader của next/image nên phải tự xin cỡ, không thì Cloudinary trả
 * bản gốc `f_auto,q_auto` — ảnh chụp điện thoại vài megabyte cho ô 64px (W-10).
 *
 * Xin bề ngang GẤP BA khung hiển thị: đủ nét ở màn DPR 2 kể cả khi ảnh ngang 3:2 bị
 * `object-cover` cắt hai bên (chiều cao mới là cạnh quyết định). URL ngoài
 * Cloudinary — ảnh xem trước `blob:`, avatar Google — trả nguyên, theo hợp đồng
 * của loader.
 */
export function thumbnailSrc(src: string, boxPx: number): string {
  return cloudinaryLoader({ src, width: boxPx * 3 });
}
