'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import { SafeImg } from '@/components/kit/safe-img';
import type { MediaItemVM } from '@/lib/media-view';

/**
 * Lưới ảnh của tab In use (spec P4f Media §6.2): mỗi ảnh một ô — thu nhỏ rộng 320, nhãn Uploaded
 * khi là ảnh tải lên, chấm đỏ khi cần chú ý, tên (alt) và tóm tắt chỗ dùng. Cả ô là MỘT nút mở
 * ngăn chi tiết, nên tên của nút là chữ nhìn thấy trong ô.
 */
const t = messages.admin.media;

export function MediaGrid({
  items,
  onOpen,
  onClearFilters,
}: {
  items: MediaItemVM[];
  onOpen: (publicId: string) => void;
  onClearFilters: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="mx-4 flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground lg:mx-6">
        <p>{t.empty}</p>
        <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
          {messages.admin.table.clearFilters}
        </Button>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 px-4 @xl/main:grid-cols-3 @3xl/main:grid-cols-4 @5xl/main:grid-cols-5 @7xl/main:grid-cols-6 lg:px-6">
      {items.map((item) => (
        <li key={item.publicId} className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(item.publicId)}
            className="flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="relative block aspect-4/3 w-full">
              {/* Alt rỗng: tên ảnh đã là chữ của nút ngay bên dưới, đọc hai lần là thừa. */}
              <SafeImg src={item.thumbUrl} alt="" className="size-full rounded-lg" />
              {item.uploaded ? (
                <Badge variant="secondary" className="absolute top-1.5 left-1.5">
                  {t.uploaded}
                </Badge>
              ) : null}
              {item.needsAttention ? (
                <span
                  data-testid="media-attention"
                  className="absolute top-1.5 right-1.5 size-3 rounded-full bg-destructive ring-2 ring-background"
                >
                  <span className="sr-only">{t.attentionMark}</span>
                </span>
              ) : null}
            </span>
            <span className="line-clamp-2 text-sm font-medium wrap-anywhere">{item.name}</span>
            <span className="mt-auto text-xs text-muted-foreground">{item.summary}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
