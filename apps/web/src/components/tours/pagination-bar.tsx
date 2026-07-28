'use client';

import { messages } from '@tourism/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { pageNumbers } from '@/lib/paginate';

/** Lựa chọn số tour mỗi trang. Cả ba đều ≤ 50 — trần `limit` của
    ToursListQuerySchema. Contract mặc định 12, ta chọn 10 cho trang ngắn hơn;
    không xung đột vì client luôn gửi `limit` tường minh. */
export const PAGE_SIZES = [10, 20, 50] as const;

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
  total,
  pageSize,
  onChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  /** Tổng số kết quả SAU khi lọc — cho dòng "Showing 1–10 of 16". */
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  /** Bỏ trống thì KHÔNG render ô chọn số/trang. `/blog` dùng thế: số bài mỗi
      trang gắn với hình dạng lưới của trang đó, không phải thứ người đọc cần
      điều chỉnh. Ẩn hẳn thay vì render ô vô hiệu — một điều khiển bấm không được
      là điều khiển gây thắc mắc. */
  onPageSizeChange?: (size: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const numbers = pageNumbers(page, totalPages);

  // Ba cụm ở ba vị trí: chọn số/trang trái · số trang giữa · phạm vi phải.
  // Đây là lý do hàng này KHÔNG bị "trống hoác" như thanh công cụ trước —
  // nó có neo ở cả hai đầu chứ không phải vài nút lạc lõng trên dải rộng.
  return (
    <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
      {onPageSizeChange ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              id="tours-page-size"
              aria-label={messages.toursPage.perPageLabel}
              size="sm"
              className="w-20"
            >
              <SelectValue>{(value) => value}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>{messages.toursPage.perPage}</span>
        </div>
      ) : (
        // Giữ một ô rỗng để ba cụm không dồn về giữa: hàng này có neo ở cả hai
        // đầu là lý do nó không "trống hoác" như thanh công cụ đã bị loại.
        <div />
      )}

      <PageNumbers page={page} numbers={numbers} totalPages={totalPages} onChange={onChange} />

      <p className="text-sm text-muted-foreground tabular-nums">
        {messages.toursPage.showing(from, to, total)}
      </p>
    </div>
  );
}

/** Dãy nút số trang. Tách ra vì thanh bao ngoài vẫn phải hiện (chọn số/trang +
    phạm vi) kể cả khi chỉ có ĐÚNG một trang — chỉ dãy số là ẩn đi. */
function PageNumbers({
  page,
  numbers,
  totalPages,
  onChange,
}: {
  page: number;
  numbers: (number | 'ellipsis')[];
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return <div aria-hidden="true" />;

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
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
