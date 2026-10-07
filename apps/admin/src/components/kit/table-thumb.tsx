import { SafeImg } from '@/components/kit/safe-img';

/**
 * Ô ảnh bìa 40px ở cột đầu của hàng bảng — MỘT khuôn cho bảng Tours và bảng Posts (review RU5:
 * `TourThumb` và `PostThumb` từng là hai bản giống hệt, chỉ khác chữ của ô trống).
 *
 * - Chưa có ảnh: ô giữ chỗ CÓ CHỮ (`emptyLabel`, `sr-only`) — ô trống câm đọc thành "ảnh hỏng",
 *   còn đây là một sự thật bình thường của bản ghi vừa tạo.
 * - Có ảnh: kit `SafeImg` với URL VM đã thu về `tableCoverThumb` (spec 2026-10-05 §4 #3) — ô 40px
 *   không kéo nguyên ảnh gốc ~2400px; ảnh hỏng thành ô icon mang tên "Photo unavailable" (§4 #13).
 *   `alt` rỗng: tên bản ghi nằm ngay cạnh, alt lặp lại nó là hai lần đọc cùng một chuỗi.
 */
export function TableThumb({ src, emptyLabel }: { src: string | null; emptyLabel: string }) {
  if (!src) {
    return (
      // `aria-hidden` + `title` là hai thứ TRIỆT TIÊU nhau: cái đầu gỡ hẳn ô khỏi cây trợ năng,
      // còn `title` trên một div không tương tác thì vốn không được đọc — cộng lại thành một ô
      // câm. Một span `sr-only` mới thật sự nói được.
      <div className="size-10 shrink-0 rounded-md border border-dashed bg-muted">
        <span className="sr-only">{emptyLabel}</span>
      </div>
    );
  }
  return <SafeImg src={src} alt="" width={40} height={40} className="size-10" />;
}
