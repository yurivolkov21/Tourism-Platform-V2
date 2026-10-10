import { cn } from '@tourism/ui/lib/utils';
import type { ReactNode } from 'react';

/** Chân trang chung (G40, spec §2.3): dính đáy tờ giấy nhờ `mt-auto` trong cột flex của `DocPage`. */
export function DocFooter({
  start,
  end,
  className,
}: {
  start: ReactNode;
  end: ReactNode;
  className?: string;
}) {
  return (
    <footer
      data-slot="doc-footer"
      className={cn(
        'mt-auto flex justify-between gap-[8mm] border-t-[0.6pt] border-border pt-[3mm] text-[7.5pt] text-muted-foreground',
        className,
      )}
    >
      <span>{start}</span>
      <span>{end}</span>
    </footer>
  );
}
