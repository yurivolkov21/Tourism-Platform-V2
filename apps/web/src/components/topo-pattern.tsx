import { cn } from '@tourism/ui/lib/utils';

// "Gia vị" thương hiệu: lớp vân đồng mức trắc địa (sinh bằng thuật toán
// value-noise + marching squares — cùng họ với nền cụm auth) phủ qua CSS MASK:
// file SVG chỉ là alpha, MÀU + ĐỘ MỜ do caller đặt bằng class bg-*/opacity-*
// token nên tự ăn theo theme. Dùng CÓ CHỪNG MỰC — tối đa 1 vị trí mỗi trang
// (quyết định 25/07), đừng rải mọi khoảng trắng.
interface TopoPatternProps {
  /** wide 1800×700 (seed 11) cho band ngang · portrait 900×1000 (seed 7, dùng chung file cụm auth) */
  variant?: 'wide' | 'portrait';
  /** Đặt màu + opacity tại đây, vd "bg-foreground opacity-[0.05]" */
  className?: string;
}

export function TopoPattern({ variant = 'wide', className }: TopoPatternProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 [mask-position:center] [mask-size:cover]',
        variant === 'wide'
          ? '[mask-image:url(/images/topo-wide.svg)]'
          : '[mask-image:url(/images/auth-topo.svg)]',
        className,
      )}
    />
  );
}
