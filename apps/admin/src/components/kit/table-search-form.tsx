'use client';

import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { SearchIcon } from 'lucide-react';

/**
 * Ô tìm kiếm của bảng admin (kit P4b — nâng từ cặp bản chép VERBATIM
 * `BookingsSearch`/`ReviewsSearch`, sổ nợ ghi ở CHANGELOG 31/08 entry F4).
 *
 * Ranh giới: kit lo hình dạng + hành vi ô nhập, vùng lo URL. Chuỗi đi ra
 * NGUYÊN VĂN — trim và cắt trần là luật của `*Href` (một bản duy nhất cho cả
 * đường URL người gõ lẫn đường form), lặp lại ở đây là hai bản sẽ trôi lệch.
 *
 * Chỉ dựng ô này cho vùng mà server THẬT SỰ đọc tham số search — bảng
 * `/cancellations` cố ý không có, vì `AdminCancellationsListQuerySchema`
 * không khai `search` và một ô tìm kiếm không lọc gì là lời hứa suông.
 */
export function TableSearchForm({
  inputId,
  label,
  placeholder,
  clearLabel,
  value,
  onSearch,
  onClear,
}: {
  /** `id` của ô — mỗi bảng một id, tránh trùng khi hai bảng cùng DOM. */
  inputId: string;
  /** Nhãn sr-only: "Search bookings"/"Search reviews" — không phải placeholder. */
  label: string;
  placeholder: string;
  clearLabel: string;
  /** Từ khoá đang lọc (từ URL) — `undefined` là chưa lọc gì. */
  value: string | undefined;
  onSearch: (term: string) => void;
  onClear: () => void;
}) {
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSearch(String(form.get('q') ?? ''));
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          name="q"
          type="search"
          // Không kiểm soát bằng state: `key` ép React dựng lại ô sau mỗi lần
          // điều hướng, nên ô luôn khớp URL mà không cần effect đồng bộ.
          key={value ?? ''}
          defaultValue={value ?? ''}
          placeholder={placeholder}
          className="w-40 pl-8 lg:w-56"
        />
      </div>
      {value ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </form>
  );
}
