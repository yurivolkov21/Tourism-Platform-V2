'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { pageNumbers } from '@/lib/paginate';

// Phân trang ĐÁNH SỐ (không "Load more"): back-button hoạt động đúng, URL chia
// sẻ được, crawler đi hết được catalogue.
//
// Tự dựng thay vì dùng `@tourism/ui/components/pagination`: component đó render
// `<a href>` nên mỗi lần bấm là một điều hướng thật, trong khi lọc ở đây chạy
// hoàn toàn client. Vẫn giữ đúng cấu trúc a11y của nó (nav[aria-label] +
// aria-current="page").
export function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  // Tự ẩn khi 0 hoặc 1 trang — thanh phân trang một nút là nhiễu.
  if (totalPages <= 1) return null;
  const numbers = pageNumbers(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </button>

      {numbers.map((entry, i) =>
        entry === 'ellipsis' ? (
          // Key theo vị trí hợp lệ ở đây: hai ellipsis không phân biệt được bằng
          // giá trị, và dãy chỉ đổi khi page/totalPages đổi.
          // biome-ignore lint/suspicious/noArrayIndexKey: xem comment trên
          <span key={`gap-${i}`} aria-hidden="true" className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={`size-9 cursor-pointer rounded-full text-sm tabular-nums transition-colors ${
              entry === page
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
