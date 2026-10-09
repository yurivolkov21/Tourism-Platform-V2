import { cn } from '@tourism/ui/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Lề ngang chung của các khối thẻ trang chi tiết đơn (spec P7 §5): 24px ở điện thoại, 26px từ `sm`
 * như bản vẽ. Thẻ tự chia phần bên trong (các khối của Details, thân và chân của Get ready) dùng
 * thẳng hằng này cho từng phần.
 */
export const PANEL_INSET_X = 'px-6 sm:px-[26px]';

/** Nhãn nhỏ in hoa (`.k` của bản vẽ: 10px, đậm, giãn chữ 0.15em) — tiêu đề khối, nhãn ô của vé. */
export const KICKER =
  'text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase';

/**
 * Vỏ thẻ của các khối cột phải trang chi tiết đơn (spec P7 §2.5): bốn khối giai đoạn, khu review và
 * lời cảm ơn dùng MỘT bản, nên đệm không trôi lệch giữa các bản chép tay — sáu bản trước đó đã lệch
 * (lời cảm ơn thiếu `sm:px-[26px]`, khu review đệm `sm:px-6`; review P7 B18). `flush`: thẻ tự đệm
 * từng phần bên trong (Get ready có chân khối kẻ ngang trọn bề rộng).
 */
export function PanelCard({
  flush = false,
  className,
  ...props
}: ComponentProps<'section'> & { flush?: boolean }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card',
        flush ? null : [PANEL_INSET_X, 'py-5'],
        className,
      )}
      {...props}
    />
  );
}

/** Tiêu đề khối dạng nhãn nhỏ in hoa — luôn là h2: hero của trang giữ h1 duy nhất (spec P7 §5.2). */
export function PanelKicker({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className={KICKER}>
      {children}
    </h2>
  );
}
