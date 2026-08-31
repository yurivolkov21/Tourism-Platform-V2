'use client';

import { messages } from '@tourism/i18n';
import { buttonVariants } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import Link from 'next/link';

/**
 * Thanh phân trang cho bảng đọc-từ-server (kit P4b §2.1 — bookings dựng
 * trước, cancellations/reviews tiêu thụ lại).
 *
 * Điều hướng bằng `<Link>` chứ không phải nút gọi `table.nextPage()`: trạng
 * thái trang nằm TRÊN URL (§2.2), nên một cái link vừa đúng ngữ nghĩa vừa mở
 * được tab mới, và trang chỉ cần render lại từ server. Nút ở biên (không đi
 * tiếp được) render thành `<span>` mờ — link chết là thứ nghiệm thu P4a đã
 * cấm.
 */
const t = messages.admin.table;

export interface TablePaginationProps {
  /** Trang hiện tại, 1-based (như URL). */
  page: number;
  totalPages: number;
  /** Tổng số row TOÀN BỘ tập kết quả (server trả), không phải số row đang hiện. */
  total: number;
  /** Số row của một trang. */
  pageSize: number;
  /** Href của một trang bất kỳ — do vùng tự dựng (vd `bookingsHref`). */
  hrefForPage: (page: number) => string;
}

function PageLink({
  href,
  label,
  disabled,
  className,
  children,
}: {
  href: string;
  label: string;
  disabled: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const styles = cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'size-8', className);
  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(styles, 'pointer-events-none opacity-50')}>
        <span className="sr-only">{label}</span>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={styles}>
      <span className="sr-only">{label}</span>
      {children}
    </Link>
  );
}

export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  hrefForPage,
}: TablePaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const isFirst = page <= 1;
  // `totalPages` = 0 khi không có kết quả nào — khi đó cũng không đi tiếp được.
  const isLast = page >= totalPages;

  return (
    <div className="flex items-center justify-between px-4">
      <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
        {t.summary(from, to, total)}
      </div>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {t.page(page, Math.max(totalPages, 1))}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <PageLink
            href={hrefForPage(1)}
            label={t.firstPage}
            disabled={isFirst}
            className="hidden lg:flex"
          >
            <ChevronsLeftIcon />
          </PageLink>
          <PageLink href={hrefForPage(page - 1)} label={t.previousPage} disabled={isFirst}>
            <ChevronLeftIcon />
          </PageLink>
          <PageLink href={hrefForPage(page + 1)} label={t.nextPage} disabled={isLast}>
            <ChevronRightIcon />
          </PageLink>
          <PageLink
            href={hrefForPage(Math.max(totalPages, 1))}
            label={t.lastPage}
            disabled={isLast}
            className="hidden lg:flex"
          >
            <ChevronsRightIcon />
          </PageLink>
        </div>
      </div>
    </div>
  );
}
