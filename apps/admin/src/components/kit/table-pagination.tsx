'use client';

import { messages } from '@tourism/i18n';
import { buttonVariants } from '@tourism/ui/components/button';
import { Label } from '@tourism/ui/components/label';
import { cn } from '@tourism/ui/lib/utils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Picker } from '@/components/kit/picker';

/**
 * Thanh phân trang cho bảng đọc-từ-server (kit P4b §2.1). Bố cục + class giữ
 * ĐÚNG bản của block `dashboard-01` (bản demo `data-table.tsx` đã xoá ở P4d,
 * đây là nguồn duy nhất): câu tổng
 * bên trái, cụm "Rows per page" · "Page X of Y" · bốn nút nhảy trang bên
 * phải — để bảng vùng và bảng dashboard nhìn là một hệ (user chốt 31/08).
 *
 * Khác duy nhất về CƠ CHẾ, không về hình: trạng thái trang nằm TRÊN URL
 * (§2.2) nên nút nhảy trang là `<Link>` — mở tab mới được, và server render
 * lại thay vì table client tự cắt. Biên (không đi tiếp được) render thành
 * `<span>` mờ chứ không phải link chết (nghiệm thu P4a §0.3).
 *
 * Ngoại lệ về hình từ 05/10 (spec 2026-10-05 §2.3): ô "Rows per page" là kit
 * `Picker` chứ không còn `Select` trần `size="sm"` của block — cao 32px bằng các
 * nút nhảy trang, danh sách mở lên trên và không đè lên ô, như mọi ô chọn của admin.
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
  /** Các mức chọn được cho "Rows per page". */
  pageSizeOptions: readonly number[];
  /** Href của một trang bất kỳ — do vùng tự dựng (vd `bookingsHref`). */
  hrefForPage: (page: number) => string;
  /** Href khi đổi số dòng mỗi trang — vùng tự quyết (thường kèm về trang 1). */
  hrefForPageSize: (pageSize: number) => string;
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
  pageSizeOptions,
  hrefForPage,
  hrefForPageSize,
}: TablePaginationProps) {
  const router = useRouter();
  // URL là input tự do: `?page=99` với 1 trang kết quả vẫn tới được đây (server
  // echo lại page và trả items rỗng). Clamp TRƯỚC khi tính hiển thị/href, kẻo
  // in "1961–5 of 5 · Page 99 of 1" cạnh bảng trống.
  const lastPage = Math.max(totalPages, 1);
  const shownPage = Math.min(Math.max(page, 1), lastPage);
  const from = total === 0 ? 0 : (shownPage - 1) * pageSize + 1;
  const to = Math.min(shownPage * pageSize, total);
  const isFirst = shownPage <= 1;
  const isLast = shownPage >= lastPage;

  return (
    <div className="flex items-center justify-between px-4">
      <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
        {t.summary(from, to, total)}
      </div>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            {t.rowsPerPage}
          </Label>
          <Picker
            id="rows-per-page"
            value={`${pageSize}`}
            options={pageSizeOptions.map((size) => ({ value: `${size}`, label: `${size}` }))}
            // Ô nằm sát đáy trang — mở lên trên cho danh sách khỏi bị cắt.
            side="top"
            className="w-20"
            onValueChange={(value) => {
              // Chỉ điều hướng với số hợp lệ — `Number('')` = 0 sẽ treo `?limit=0` lên URL.
              const size = Number(value);
              if (Number.isInteger(size) && size > 0) router.push(hrefForPageSize(size));
            }}
          />
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {t.page(shownPage, lastPage)}
        </div>
        {/* Landmark cho screen reader — cùng vai `<nav aria-label>` của
            `@tourism/ui` pagination. KHÔNG dùng thẳng bộ component đó:
            `PaginationLink` là `<a>` thuần (full reload — chính JSDoc
            `ButtonLink` chỉ định next/link thì dùng `buttonVariants`, đúng
            cái `PageLink` làm), kiểu ghost cũng lệch bộ nút outline của
            dashboard-01, và ở đây không có link số trang nên `aria-current`
            không có chỗ đứng. */}
        <nav aria-label={t.pagination} className="ml-auto flex items-center gap-2 lg:ml-0">
          <PageLink
            href={hrefForPage(1)}
            label={t.firstPage}
            disabled={isFirst}
            className="hidden lg:flex"
          >
            <ChevronsLeftIcon />
          </PageLink>
          <PageLink href={hrefForPage(shownPage - 1)} label={t.previousPage} disabled={isFirst}>
            <ChevronLeftIcon />
          </PageLink>
          <PageLink href={hrefForPage(shownPage + 1)} label={t.nextPage} disabled={isLast}>
            <ChevronRightIcon />
          </PageLink>
          <PageLink
            href={hrefForPage(lastPage)}
            label={t.lastPage}
            disabled={isLast}
            className="hidden lg:flex"
          >
            <ChevronsRightIcon />
          </PageLink>
        </nav>
      </div>
    </div>
  );
}
