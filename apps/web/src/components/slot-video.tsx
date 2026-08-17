'use client';

import type { MediaItem } from '@tourism/contract';
import { cn } from '@tourism/ui/lib/utils';
import { useEffect, useRef } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { SlotImage } from '@/components/slot-image';

/**
 * Anh em của `SlotImage` cho khe VIDEO (khe đầu tiên: `about-cta-video`).
 *
 * Vì sao là component RIÊNG chứ không nhét thêm nhánh vào `SlotImage`: video
 * không đi qua `next/image` (không có tối ưu nào áp dụng được), cần bộ thuộc
 * tính hoàn toàn khác (`autoPlay`/`loop`/`muted`/`playsInline`/`poster`), và
 * cần một hiệu ứng client để tôn trọng `prefers-reduced-motion`. Gộp vào một
 * component sẽ thành ba nhánh chỏi nhau — đúng thứ vừa đẻ ra lỗi định vị ở
 * `SlotImage` ngày 17/08 (hai nhánh không mang cùng bộ class).
 *
 * Ba trạng thái, đều là BÌNH THƯỜNG:
 * · khe rỗng      → `ImagePlaceholder`, y như `SlotImage`
 * · khe có ẢNH    → uỷ cho `SlotImage`, để một khe đổi từ video sang ảnh mà
 *                   không phải sửa chỗ gọi
 * · khe có VIDEO  → thẻ `<video>` bên dưới
 */
export function SlotVideo({
  media,
  label,
  className,
  corner = false,
}: {
  media: MediaItem | null;
  /** Nhãn của placeholder khi khe rỗng; cũng thành `aria-label` của video. */
  label?: string;
  className?: string;
  corner?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // `autoPlay` là thuộc tính HTML nên trình duyệt đã bấm play TRƯỚC khi React
    // chạy effect. Không có cách nào chặn từ đầu mà không đánh đổi: bỏ
    // `autoPlay` rồi tự play sau mount thì mọi người dùng đều phải chờ một
    // vòng render. Nên cứ để chạy rồi dừng ngay — người bật giảm-chuyển-động
    // thấy đúng khung `poster` đứng yên, chỉ mất vài khung hình đầu.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  if (!media) return <ImagePlaceholder label={label} className={className} corner={corner} />;
  if (media.type !== 'VIDEO') {
    return <SlotImage image={media} label={label} className={className} corner={corner} />;
  }

  return (
    // Cùng hợp đồng định vị với `SlotImage`: `relative overflow-hidden` nằm ở
    // ĐÂY chứ không bắt chỗ gọi nhớ, và qua `cn` để caller vẫn ghi đè được.
    <div className={cn('relative overflow-hidden', className)}>
      {/* Không có `<track>` phụ đề là CỐ Ý: clip là nền trang trí, không có
          tiếng và không mang thông tin nào mà chữ xung quanh chưa nói. Phụ đề
          rỗng chỉ làm nhiễu trình đọc màn hình. */}
      <video
        ref={ref}
        // `muted` + `playsInline` KHÔNG phải tuỳ chọn: thiếu `muted` thì mọi
        // trình duyệt chặn autoplay, thiếu `playsInline` thì Safari iOS mở
        // toàn màn hình thay vì phát tại chỗ.
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster={media.posterUrl ?? undefined}
        aria-label={media.alt ?? label}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={media.url} />
      </video>
    </div>
  );
}
