/**
 * URL Cloudinary phía admin — MỘT chỗ cho khuôn URL mà `buildCloudinaryUrl` của API
 * dựng (ADR-0005). Trước đây đoạn "chèn transform sau `/upload/f_auto,q_auto/`" có hai
 * bản (ảnh tour, ảnh review) và khuôn URL gõ cứng lần nữa ở tab Photos (G14, sau vòng
 * review F18).
 */

/** Đoạn transform mà `buildCloudinaryUrl` phía API gắn cho mọi ảnh. */
const DELIVERY_TRANSFORM = '/upload/f_auto,q_auto/';

/**
 * Chèn thêm transform (vd `w_320`, `w_128,h_128,c_fill`) vào URL delivery của API.
 * URL không theo khuôn (host lạ, dữ liệu cũ) trả nguyên — thà nặng còn hơn vỡ ảnh.
 */
export function withDeliveryTransform(url: string, transform: string): string {
  // `replace` không gặp khuôn thì trả nguyên chuỗi — không cần kiểm `includes` trước.
  return url.replace(DELIVERY_TRANSFORM, `/upload/f_auto,q_auto,${transform}/`);
}

/** URL delivery của ảnh VỪA tải lên — đúng khuôn `buildCloudinaryUrl` phía API. */
export function cloudinaryImageUrl(cloudName: string, publicId: string, version: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/v${version}/${publicId}`;
}
