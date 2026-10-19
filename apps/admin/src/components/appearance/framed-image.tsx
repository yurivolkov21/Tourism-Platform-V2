'use client';

import { cn } from '@tourism/ui/lib/utils';
import { SafeImg } from '@/components/kit/safe-img';

/**
 * Ảnh trong một khung đúng tỉ lệ khe (spec P4f Appearance §6) — cắt bằng `object-fit: cover` căn
 * giữa y như `SlotImage` của web, không vẽ chữ hay lớp phủ tối của web. Cỡ khung là px đã thu nhỏ
 * (`fitFrame`), nên khung đứng 390×844 vẫn ra một dải đứng, không méo; ô chứa hẹp hơn thì khung
 * co thêm theo đúng tỉ lệ.
 */
export function FramedImage({
  src,
  size,
  placeholder,
  className,
}: {
  /** `null` = khe chưa có ảnh vẽ được: ô giữ chỗ mang câu `placeholder`. */
  src: string | null;
  size: readonly [width: number, height: number];
  placeholder: string;
  className?: string;
}) {
  const [width, height] = size;
  return (
    <div
      className={cn('max-w-full shrink-0 overflow-hidden rounded-md bg-muted', className)}
      // Rộng tối đa bằng ô chứa, cao theo tỉ lệ: ô hẹp hơn khung thì khung co lại, KHÔNG méo.
      style={{ width, aspectRatio: `${width} / ${height}` }}
    >
      {src === null ? (
        <div className="grid size-full place-items-center p-2 text-center text-xs text-muted-foreground">
          {placeholder}
        </div>
      ) : (
        // Ảnh trang trí: nhãn khe và câu chú thích đứng ngay cạnh.
        <SafeImg src={src} alt="" className="size-full object-cover object-center" />
      )}
    </div>
  );
}
