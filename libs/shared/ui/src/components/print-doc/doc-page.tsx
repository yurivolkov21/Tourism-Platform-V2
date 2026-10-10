import { cn } from '@tourism/ui/lib/utils';
import type * as React from 'react';

/**
 * Tờ A4 của tài liệu in (G40, ADR-0057 §1–§2): ẩn trên màn hình, hiện khi in thành cột dọc (chân
 * trang `mt-auto` dính đáy); `data-print-doc` là móc của trang in tên `doc` và của luật giấu chrome
 * ở app. Class `light` lấy lại màu sáng khi trang đang ở giao diện tối — giấy luôn sáng.
 */
export function DocPage({ className, children, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-print-doc=""
      className={cn(
        'light scheme-light hidden h-[297mm] w-[210mm] flex-col overflow-hidden bg-background px-[15mm] pt-[14mm] pb-[11mm] font-sans text-[9.5pt] leading-[1.45] text-foreground print:flex',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
