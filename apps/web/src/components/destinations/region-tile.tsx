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
export function RegionTile({
  label,
  className,
  decorative = false,
}: {
  /** Mô tả cảnh trong ô. Là `aria-label` ở chế độ thường, và là `alt` khi ô này
      thành ảnh thật. Ở chế độ `decorative` nó KHÔNG ra HTML — vẫn giữ prop vì nó
      nói cho người đọc code biết ô đang vẽ cái gì, và vì nó là khoá `key` tự
      nhiên ở mấy chỗ lặp danh sách. */
  label: string;
  className?: string;
  /** Bật khi CHỮ KỀ BÊN đã nói đúng cái nhãn này — hero (`<h1>` = tên vùng) và
      bưu thiếp (`<h3>` = tên bưu thiếp). Để nguyên `role="img"` ở đó là bắt
      trình đọc màn hình đọc cùng một cụm từ hai lần liền. Ô nào mà nhãn là
      THÔNG TIN DUY NHẤT (khảm gallery, bento khu intro) thì KHÔNG bật. */
  decorative?: boolean;
}) {
  // Phần NHÌN THẤY giống hệt nhau ở cả hai chế độ — chỉ khai báo trợ năng khác.
  const style = {
    background:
      'linear-gradient(135deg, var(--region-primary), color-mix(in oklch, var(--region-spark), var(--region-deep) 45%))',
  };
  const classes = cn('flex items-center justify-center overflow-hidden rounded-xl', className);
  const icon = <ImageIcon aria-hidden="true" className="size-7 text-on-media/70" />;

  // Hai nhánh JSX TÁCH HẲN thay vì `role={decorative ? undefined : 'img'}`:
  // Biome đọc tĩnh, gặp `role` là biểu thức thì nó coi như thẻ KHÔNG có role và
  // bắt lỗi `useAriaPropsSupportedByRole` cho `aria-label`. Tách ra thì cả hai
  // nhánh đều hợp lệ mà không phải tắt lint bằng `biome-ignore`.
  if (decorative) {
    return (
      <div aria-hidden="true" style={style} className={classes}>
        {icon}
      </div>
    );
  }

  return (
    <div role="img" aria-label={label} style={style} className={classes}>
      {icon}
    </div>
  );
}
