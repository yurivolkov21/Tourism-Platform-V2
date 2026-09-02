import { cn } from '@tourism/ui/lib/utils';

// PORT NGUYÊN từ apps/web/src/components/logo.tsx (đồng bộ nhận diện — user
// nhắc 20/08: mọi chỗ phải dùng mark "Slidex" hai viên kim cương, không chế
// ô "N"). Mark: PrebuiltUI free placeholder ("Slidex"), viên sau nhuộm
// primary, viên trước theo foreground; wordmark chữ thường Literata hai tông.

/**
 * Bộ màu theo NƠI ĐẶT logo (ADR-0027). Bản admin phải rẽ nhánh vì cùng một
 * component đứng ở HAI nền ngược nhau: sidebar tối và trang login sáng.
 *
 * Không rẽ nhánh thì cả ba chỗ tô màu — hai viên kim cương và chữ "ora" — đều
 * lấy token của vùng SÁNG, tức mực tối trên vỏ tối: logo biến mất, chỉ còn
 * chữ "Nex". Đây đúng là lỗi user bắt được 01/09.
 *
 * Rẽ bằng prop chứ không bằng selector CSS kiểu `[data-sidebar] &`: chỗ đặt
 * logo là thứ nơi dùng BIẾT, còn CSS thì phải đoán, và một selector đoán sai
 * sẽ hỏng câm y như lần này.
 */
const TONES = {
  /** Trang login, và mọi nền sáng khác. */
  default: {
    back: 'fill-primary',
    front: 'fill-foreground',
    word: 'text-sidebar-foreground',
    accent: 'text-primary-emphasis',
  },
  /** Vỏ tối của shell admin — đo: teal 5.11, chữ trắng 11.56 (ADR-0027). */
  sidebar: {
    back: 'fill-sidebar-primary',
    front: 'fill-sidebar-foreground',
    word: 'text-sidebar-foreground',
    accent: 'text-sidebar-primary',
  },
} as const;

export function Logo({
  className,
  tone = 'default',
}: {
  className?: string;
  tone?: keyof typeof TONES;
}) {
  const c = TONES[tone];

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 46 33" aria-hidden="true" className="h-6 w-auto shrink-0">
        <path
          className={c.back}
          d="M30.966 12.968 19.938 1.945a2.75 2.75 0 0 0-3.891 0l-14.1 14.093a2.75 2.75 0 0 0 0 3.89L12.975 30.95a2.75 2.75 0 0 0 3.891 0l14.1-14.094a2.75 2.75 0 0 0 0-3.889"
        />
        <path
          className={c.front}
          d="M44.032 12.968 33.004 1.945a2.75 2.75 0 0 0-3.89 0l-14.1 14.093a2.75 2.75 0 0 0 0 3.89L26.041 30.95a2.75 2.75 0 0 0 3.89 0l14.1-14.094a2.75 2.75 0 0 0 0-3.889"
        />
      </svg>
      <span className={cn('font-heading text-xl font-semibold tracking-tight', c.word)}>
        Nex<span className={c.accent}>ora</span>
      </span>
    </span>
  );
}
