/**
 * Custom loader cho next/image (ADR-0020 §Hệ quả, trả nợ ở W3-S4): chèn
 * `w_<width>` để Cloudinary co ảnh ĐÚNG cỡ trước khi gửi — không có nó,
 * next/image tải nguyên bản f_auto,q_auto về rồi nén lại lần hai (thumbnail
 * 64px tải cả megabyte).
 *
 * ⚠️ Với `loaderFile`, Next KHÔNG còn đi qua `/_next/image` (optimizer) và
 * KHÔNG kiểm host nữa (vòng vá review W3, ADR-0016 AMEND 2): URL cuối là
 * Cloudinary thẳng, `images.remotePatterns`/`minimumCacheTTL` không có tác
 * dụng — đừng khai lại chúng tưởng là hàng rào.
 *
 * Hợp đồng (có test):
 * - CHỈ đụng URL ảnh Cloudinary (`/image/upload/`); mọi URL khác trả NGUYÊN
 *   — escape-hatch "publicId là URL tuyệt đối" của buildCloudinaryUrl
 *   (ADR-0005 §2) và ảnh local đi qua không sứt mẻ.
 * - Idempotent: URL đã có transformation (API dựng sẵn `f_auto,q_auto`) thì
 *   MERGE vào segment đó — `w_` cũ bị thay, không chồng thêm segment mới
 *   (hai segment transform là hai lần derive trên Cloudinary); mọi tham số
 *   khác (c_limit, g_face…) giữ ở đuôi.
 * - Segment đầu CHỈ được coi là transformation khi chắc chắn (có dấu phẩy,
 *   hoặc mở đầu bằng `f_auto`/`q_auto`/`w_` như API dựng) — publicId phẳng
 *   kiểu `my_photo.jpg` hay thư mục `ab_cd/` từng bị nuốt vào segment
 *   transform thành URL 400. URL ký (`s--…--`) trả nguyên: chèn gì cũng
 *   làm chữ ký sai (401).
 */

const IMAGE_UPLOAD_MARKER = '/image/upload/';

/** Segment transformation CHẮC CHẮN: nhiều cặp nối bằng phẩy, hoặc mở đầu đúng khuôn API. */
function isTransformationSegment(segment: string): boolean {
  if (segment.includes(',')) return /^[a-z]{1,3}_/.test(segment);
  return /^(f_auto|q_auto|q_\d{1,3}|w_\d+)$/.test(segment);
}

export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src.startsWith('https://res.cloudinary.com/')) return src;
  const markerAt = src.indexOf(IMAGE_UPLOAD_MARKER);
  if (markerAt === -1) return src;

  const prefix = src.slice(0, markerAt + IMAGE_UPLOAD_MARKER.length);
  const rest = src.slice(prefix.length);
  // URL ký: transformation nằm trong chữ ký, đụng vào là 401.
  if (rest.startsWith('s--')) return src;
  const [head = '', ...tail] = rest.split('/');

  const q = quality ? `q_${quality}` : 'q_auto';
  if (tail.length > 0 && isTransformationSegment(head)) {
    // Merge vào segment sẵn có: bỏ f_/q_/w_ cũ, giữ phần khác (vd c_limit)
    // ở đuôi — thứ tự ổn định f_auto,q_*,w_*,còn-lại để idempotent đúng
    // nghĩa chuỗi.
    const others = head
      .split(',')
      .filter((p) => !p.startsWith('f_') && !p.startsWith('q_') && !p.startsWith('w_'));
    return `${prefix}${['f_auto', q, `w_${width}`, ...others].join(',')}/${tail.join('/')}`;
  }
  return `${prefix}f_auto,${q},w_${width}/${rest}`;
}
