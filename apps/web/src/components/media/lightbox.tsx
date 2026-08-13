'use client';

import { Button } from '@tourism/ui/components/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { type ReactNode, useCallback } from 'react';

/**
 * Lightbox dùng chung — xem một bộ media theo chỉ số, có bộ đếm và điều hướng.
 *
 * TÁCH từ `tours/tour-gallery.tsx` (Task 5l — file đó đã XOÁ 13/08 khi trang
 * tour chuyển sang `tour-media-panel.tsx`) khi gallery trang vùng cần đúng hành
 * vi này. Bản cục bộ nhận `photos: MockMediaItem[]`, tức khoá vào kiểu dữ liệu
 * riêng của tour; hợp đồng ở đây chỉ nhận `count` + `renderMedia(index)`, nên
 * consumer nào cũng dùng được mà không phải nhồi dữ liệu của mình vào kiểu của
 * tour. Đây là lý do KHÔNG viết bản thứ hai: hai lightbox là hai lần phải nhớ
 * sửa cùng một luật trợ năng.
 *
 * Component ĐƯỢC ĐIỀU KHIỂN: `openAt` và `onNavigate` do consumer giữ. Nhờ vậy
 * ô khảm mở đúng index của nó mà không cần lightbox biết gì về bố cục khảm.
 *
 * Copy đi qua PROP, không qua `@tourism/i18n` từ trong đây: trang tour tiếp tục
 * dùng `messages.tourDetail.gallery` (copy của nó không đổi một chữ) và trang
 * vùng dùng `messages.regionPage.galleryLightbox`. Component không chứa chuỗi
 * user-facing nào — `lightbox.spec.tsx` canh đúng chuyện đó.
 */
export function Lightbox({
  count,
  openAt,
  onOpenChange,
  onNavigate,
  dialogTitle,
  counterLabel,
  closeLabel,
  previousLabel,
  nextLabel,
  caption,
  renderMedia,
}: {
  /** Tổng số media. `0` thì không render gì — không dialog rỗng. */
  count: number;
  /** Index đang xem, hoặc `null` khi đóng. */
  openAt: number | null;
  onOpenChange: (open: boolean) => void;
  onNavigate: (index: number) => void;
  /** Base UI Dialog BẮT BUỘC có title cho trợ năng, kể cả khi ẩn thị giác. */
  dialogTitle: string;
  counterLabel: (current: number, total: number) => string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
  /** Chú thích dưới media. Trả `null` là KHÔNG có chú thích — bịa mô tả cho một
      thứ mình không biết còn tệ hơn để trống. */
  caption?: ((index: number) => string | null) | undefined;
  renderMedia: (index: number) => ReactNode;
}) {
  const current = openAt ?? 0;

  // KHÔNG cuộn vòng: tới ảnh cuối rồi bấm tiếp mà quay về ảnh đầu làm người xem
  // tưởng mình chưa xem hết. Nút bị vô hiệu ở hai đầu, đúng như dải khởi hành.
  const go = useCallback(
    (delta: number) => {
      onNavigate(Math.min(count - 1, Math.max(0, current + delta)));
    },
    [current, count, onNavigate],
  );

  // Mũi tên bàn phím. Base UI Dialog đã lo Escape và bẫy focus; điều hướng ảnh thì
  // không — phải tự nối, nếu không lightbox chỉ dùng được bằng chuột.
  //
  // Handler đặt trên CHÍNH DialogContent, không phải `window`: focus đã bị bẫy
  // trong dialog nên mọi keydown đều nổi bọt lên đây, và mũi tên chỉ điều hướng ảnh
  // khi dialog đang mở — một listener toàn cục thì còn phải tự nhớ đóng/mở, mà bản
  // đầu tôi viết kiểu đó cũng không nhận được sự kiện trong jsdom.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    }
  }

  if (count <= 0) return null;

  const text = caption?.(current) ?? null;

  return (
    <Dialog open={openAt !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        className="w-full gap-3 sm:max-w-3xl lg:max-w-5xl"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Title bắt buộc cho trợ năng nhưng không cần thấy — bộ đếm ngay cạnh đã
              nói người xem đang ở đâu. */}
          <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
          <p aria-live="polite" className="font-mono text-xs tracking-widest text-muted-foreground">
            {counterLabel(current + 1, count)}
          </p>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" aria-label={closeLabel}>
                <XIcon />
              </Button>
            }
          />
        </div>

        {renderMedia(current)}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            aria-label={previousLabel}
            disabled={current === 0}
            onClick={() => go(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          {text ? (
            <p className="min-w-0 flex-1 text-center text-sm text-pretty text-muted-foreground">
              {text}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label={nextLabel}
            disabled={current === count - 1}
            onClick={() => go(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
