/**
 * Build URL transform Cloudinary cho RN (ADR-0047 §4, port thuật toán từ
 * `apps/web/src/lib/cloudinary-loader.ts` — ADR-0020 §Hệ quả). Chữ ký khác
 * loader Next (`{src,width,quality}`) vì RN không có hợp đồng `next/image`.
 *
 * Hợp đồng (có test): chỉ đụng URL Cloudinary (`/image/upload/`), idempotent,
 * escape-hatch URL ký, publicId phẳng không bị nuốt vào segment transform.
 */

const IMAGE_UPLOAD_MARKER = '/image/upload/';

function isTransformationSegment(segment: string): boolean {
  if (segment.includes(',')) return /^[a-z]{1,3}_/.test(segment);
  return /^(f_auto|q_auto|q_\d{1,3}|w_\d+)$/.test(segment);
}

export function cloudinaryUrl(src: string, width: number, quality?: number): string {
  if (!src.startsWith('https://res.cloudinary.com/')) return src;
  const markerAt = src.indexOf(IMAGE_UPLOAD_MARKER);
  if (markerAt === -1) return src;

  const prefix = src.slice(0, markerAt + IMAGE_UPLOAD_MARKER.length);
  const rest = src.slice(prefix.length);
  if (rest.startsWith('s--')) return src;
  const [head = '', ...tail] = rest.split('/');

  const q = quality ? `q_${quality}` : 'q_auto';
  if (tail.length > 0 && isTransformationSegment(head)) {
    const others = head
      .split(',')
      .filter((p) => !p.startsWith('f_') && !p.startsWith('q_') && !p.startsWith('w_'));
    return `${prefix}${['f_auto', q, `w_${width}`, ...others].join(',')}/${tail.join('/')}`;
  }
  return `${prefix}f_auto,${q},w_${width}/${rest}`;
}
