/**
 * Custom loader cho next/image (ADR-0020 §Hệ quả, trả nợ ở W3-S4): chèn
 * `w_<width>` để Cloudinary co ảnh ĐÚNG cỡ trước khi gửi — không có nó,
 * next/image tải nguyên bản f_auto,q_auto về rồi nén lại lần hai (thumbnail
 * 64px tải cả megabyte).
 *
 * Hợp đồng (có test):
 * - CHỈ đụng URL ảnh Cloudinary (`/image/upload/`); mọi URL khác trả NGUYÊN
 *   — escape-hatch "publicId là URL tuyệt đối" của buildCloudinaryUrl
 *   (ADR-0005 §2) và ảnh local đi qua không sứt mẻ.
 * - Idempotent: URL đã có transformation (API dựng sẵn `f_auto,q_auto`) thì
 *   MERGE vào segment đó — `w_` cũ bị thay, không chồng thêm segment mới
 *   (hai segment transform là hai lần derive trên Cloudinary).
 */

const IMAGE_UPLOAD_MARKER = '/image/upload/';

/** Segment transformation: các cặp `key_value` nối bằng phẩy (vd f_auto,q_auto,w_640). */
const TRANSFORMATION_SEGMENT_RE = /^[a-z]{1,3}_[^/]+$/;

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
  const [head = '', ...tail] = rest.split('/');

  const q = quality ? `q_${quality}` : 'q_auto';
  if (TRANSFORMATION_SEGMENT_RE.test(head)) {
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
