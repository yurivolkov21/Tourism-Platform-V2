import { cn } from '@tourism/ui/lib/utils';
import { ImageIcon } from 'lucide-react';

/**
 * Ô giữ chỗ ảnh CHO TRANG VÙNG. Đây là cơ chế dự phòng của chính Nexora
 * (`marketing/gallery.tsx` → `Tile` khi thiếu `src`: nền gradient + icon), khác
 * ở chỗ gradient pha bằng token BRAND nên nó lật theo theme.
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
      THÔNG TIN DUY NHẤT (khảm gallery) thì KHÔNG bật. */
  decorative?: boolean;
}) {
  // Nền (gradient) giống hệt nhau ở cả hai chế độ — chỉ khác trợ năng VÀ icon.
  //
  // Dốc ngọc bích: `--primary` (tông giữa) → `--hero` (mảng tối nhất của brand).
  // HAI stop cùng một họ hue (184.3° và 181.5°) nên gradient KHÔNG đi vòng qua
  // hue nào lạ — đây là lý do bỏ phương án `color-mix(--rating, --hero 45%)` mà
  // bản đồ di trú đề xuất: đo ra `oklch(… 122°)`, tức XANH Ô LIU, đúng cái sắc
  // ngoài-brand mà chính bản đồ cảnh báo ở phép map 1-1.
  //
  // Cả hai token đều LẬT theo theme, nên ô sáng lên nhẹ ở dark thay vì đứng yên
  // như lớp `--region-*` cũ. Icon `on-media/70` nằm ở TÂM ô, tức trên điểm giữa
  // của dốc: đo pixel thật (lõi nét, bỏ pixel khử răng cưa) được 6.00:1 light /
  // 6.23:1 dark — trên ngưỡng 3.0 của đồ hoạ ở cả hai theme. (Ở riêng stop
  // `--primary` con số là 3.66/2.91, nhưng icon không rơi vào đó vì nó căn giữa.)
  const style = {
    background: 'linear-gradient(135deg, var(--primary), var(--hero))',
  };
  const classes = cn('flex items-center justify-center overflow-hidden rounded-xl', className);

  // Hai nhánh JSX TÁCH HẲN thay vì `role={decorative ? undefined : 'img'}`:
  // Biome đọc tĩnh, gặp `role` là biểu thức thì nó coi như thẻ KHÔNG có role và
  // bắt lỗi `useAriaPropsSupportedByRole` cho `aria-label`. Tách ra thì cả hai
  // nhánh đều hợp lệ mà không phải tắt lint bằng `biome-ignore`.
  //
  // `decorative` KHÔNG vẽ icon (29/07, lỗi user chỉ ra ở hero): ô này chỉ làm
  // NỀN sau chữ/scrim, không đứng vào vị trí một tấm ảnh, nên `ImageIcon` giữa
  // khoảng trống đọc thành một vật thể lạ. Chế độ có nhãn (gallery, bưu thiếp)
  // GIỮ icon — ở đó nó là tín hiệu "đây là chỗ của ảnh".
  if (decorative) {
    return <div aria-hidden="true" style={style} className={classes} />;
  }

  return (
    <div role="img" aria-label={label} style={style} className={classes}>
      <ImageIcon aria-hidden="true" className="size-7 text-on-media/70" />
    </div>
  );
}
