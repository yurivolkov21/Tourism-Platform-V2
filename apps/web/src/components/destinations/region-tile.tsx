import { cn } from '@tourism/ui/lib/utils';
import { ImageIcon } from 'lucide-react';

/**
 * Ô giữ chỗ ảnh CHO TRANG VÙNG. Đây là cơ chế dự phòng của chính Nexora
 * (`marketing/gallery.tsx` → `Tile` khi thiếu `src`: nền gradient + icon), khác
 * ở chỗ gradient pha bằng token VÙNG nên mỗi vùng một sắc.
 *
 * Vì sao KHÔNG dùng `ImagePlaceholder` xám của repo ở đây (user chốt 29/07):
 * trang này có 14 ô ảnh, trong đó khu `X in photos` là 10 ô liền nhau. Mười hộp
 * xám sọc chéo cạnh nhau đọc thành "vùng ảnh hỏng" chứ không thành gallery —
 * đúng lỗi đã đo ở `destination-tile.tsx`. Gradient có màu thì đọc được là chủ ý.
 *
 * Khi có ảnh thật: thêm prop `src` và render `next/image`, KHÔNG phải đổi bố cục.
 */
export function RegionTile({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        background:
          'linear-gradient(135deg, var(--region-primary), color-mix(in oklch, var(--region-spark), var(--region-deep) 45%))',
      }}
      className={cn('flex items-center justify-center overflow-hidden rounded-xl', className)}
    >
      <ImageIcon aria-hidden="true" className="size-7 text-on-media/70" />
    </div>
  );
}
