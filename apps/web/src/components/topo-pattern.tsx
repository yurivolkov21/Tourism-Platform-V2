import { cn } from '@tourism/ui/lib/utils';

// "Gia vị" thương hiệu: lớp vân đồng mức trắc địa (sinh bằng thuật toán
// value-noise + marching squares — cùng họ với nền cụm auth) phủ qua CSS MASK:
// file SVG chỉ là alpha, MÀU + ĐỘ MỜ do caller đặt bằng class bg-*/opacity-*
// token nên tự ăn theo theme. Dùng CÓ CHỪNG MỰC — tối đa 1 vị trí mỗi trang
// (quyết định 25/07), đừng rải mọi khoảng trắng.
const VARIANTS = {
  /** Vân đồng mức ngang 1800×700 (seed 11) cho band rộng — phủ cover */
  wide: '[mask-image:url(/images/topo-wide.svg)] [mask-position:center] [mask-size:cover]',
  /** Vân đồng mức dọc 900×1000 (seed 7, dùng chung file cụm auth) — phủ cover */
  portrait: '[mask-image:url(/images/auth-topo.svg)] [mask-position:center] [mask-size:cover]',
  /** Lưới trắc địa 1200×900 chia hết bước 60px — TILE lặp giữ đúng cỡ ô */
  grid: '[mask-image:url(/images/survey-grid.svg)] [mask-repeat:repeat] [mask-size:auto]',
} as const;

interface TopoPatternProps {
  variant?: keyof typeof VARIANTS;
  /** Đặt màu + opacity tại đây, vd "bg-foreground opacity-[0.05]" */
  className?: string;
}

export function TopoPattern({ variant = 'wide', className }: TopoPatternProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', VARIANTS[variant], className)}
    />
  );
}
