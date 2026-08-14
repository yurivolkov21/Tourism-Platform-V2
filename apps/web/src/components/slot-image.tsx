import Image from 'next/image';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { SiteMediaItem } from '@/lib/api/site-media';

/**
 * Ảnh của một khe brand-chrome, hoặc `ImagePlaceholder` khi khe chưa có ảnh.
 *
 * ── Vì sao là component TRÌNH BÀY, không tự fetch ──
 * Cả chín component tiêu thụ khe (`hero`, `about-story`, `auth-screen`…) đều là
 * `'use client'` vì chúng dùng motion. Một server component async không lồng
 * thẳng vào đó được, nên fetch nằm ở PAGE (server) rồi truyền `image` xuống.
 * Đổi lại có prop drilling một tầng, nhưng được: một chỗ gọi mạng cho cả trang,
 * và component này chạy được ở cả hai phía.
 *
 * ── Hợp đồng ──
 * Prop trùng khuôn `ImagePlaceholder` (`label`, `className`, `corner`) nên chỗ
 * gọi chỉ việc đổi tên thẻ và thêm `image` — không phải sắp lại bố cục.
 *
 * `image === null` là trạng thái BÌNH THƯỜNG, không phải lỗi: API chỉ trả khe
 * có ảnh, và cả site sẽ còn khe trống trong một thời gian dài.
 */
export function SlotImage({
  image,
  label,
  className,
  corner = false,
  priority = false,
  sizes = '100vw',
}: {
  image: SiteMediaItem | null;
  /** Nhãn của placeholder khi chưa có ảnh — bỏ qua khi đã có ảnh thật. */
  label?: string;
  className?: string;
  corner?: boolean;
  /** Bật cho ảnh trong khung nhìn đầu tiên (hero) để Next nạp sớm. */
  priority?: boolean;
  sizes?: string;
}) {
  if (!image) return <ImagePlaceholder label={label} className={className} corner={corner} />;

  return (
    <div className={className}>
      <Image
        src={image.url}
        // `alt` rỗng là CỐ Ý khi thiếu: đây là ảnh TRANG TRÍ nền, chữ thật nằm
        // đè lên nó. Bịa mô tả cho ảnh mình không biết nội dung còn tệ hơn.
        alt={image.alt ?? ''}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
