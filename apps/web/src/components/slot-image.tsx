import type { MediaItem } from '@tourism/contract';
import Image from 'next/image';
import { ImagePlaceholder } from '@/components/image-placeholder';

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
 *
 * Kiểu prop là `MediaItem` của contract — KHÔNG phải kiểu riêng của site-media.
 * Khe thương hiệu, `cover` của tour và `cover` của địa danh đều là cùng một
 * lược đồ, nên cùng một component phục vụ cả ba; buộc kiểu hẹp hơn chỉ tạo ra
 * ép kiểu ở chỗ gọi mà không thêm an toàn nào.
 */
export function SlotImage({
  image,
  label,
  className,
  corner = false,
  priority = false,
  sizes = '100vw',
}: {
  image: MediaItem | null;
  /** Nhãn của placeholder khi chưa có ảnh — bỏ qua khi đã có ảnh thật. */
  label?: string;
  className?: string;
  corner?: boolean;
  /** Bật cho ảnh trong khung nhìn đầu tiên (hero) để Next nạp sớm. */
  priority?: boolean;
  sizes?: string;
}) {
  // Host mà `next.config.ts` khai trong `images.remotePatterns`. Giữ đồng bộ
  // với file đó — nới ở một nơi mà quên nơi kia thì ảnh biến mất im lặng.
  const OPTIMISABLE_HOST = 'https://res.cloudinary.com/';

  if (!image) return <ImagePlaceholder label={label} className={className} corner={corner} />;

  // `buildCloudinaryUrl` có escape-hatch CỐ Ý (ADR-0005 §2): `publicId` là URL
  // tuyệt đối thì trả nguyên, không bọc transform. Nhưng `next/image` chỉ nhận
  // host đã khai trong `remotePatterns`, nên một URL ngoài đi thẳng vào đây sẽ
  // ném `Invalid src prop … hostname is not configured` — trang chết lúc
  // prerender (build đỏ) hoặc 500 khi ISR, chỉ vì MỘT row dữ liệu.
  //
  // Rơi về `<img>` thường thay vì để nổ: ảnh vẫn hiện, chỉ mất tối ưu của Next.
  // Mất tối ưu là phiền; sập trang vì một row là hỏng.
  if (!image.url.startsWith(OPTIMISABLE_HOST)) {
    return (
      <div className={className}>
        {/** biome-ignore lint/performance/noImgElement: host ngoài remotePatterns, next/image sẽ ném lỗi */}
        <img src={image.url} alt={image.alt ?? ''} className="size-full object-cover" />
      </div>
    );
  }

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
