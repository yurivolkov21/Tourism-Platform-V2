'use client';

import { Button } from '@tourism/ui/components/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon, XIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  canPan,
  clampPan,
  nextZoom,
  type PanOffset,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomPercent,
} from '@/lib/lightbox';

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
  zoom,
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
  /**
   * Bật thu/phóng. CÓ prop này là bật, không có là tắt — không cần cờ riêng.
   *
   * Copy đi qua đây vì component không được chứa chuỗi user-facing (xem
   * doc-comment đầu file), và tắt-theo-mặc-định là đúng: trang vùng dùng cùng
   * component nhưng chưa yêu cầu thu/phóng, thêm hai nút không ai đặt hàng là
   * tự ý nới phạm vi.
   */
  zoom?:
    | {
        inLabel: string;
        outLabel: string;
        /** Ví dụ `(p) => \`${p}%\`` — đơn vị do consumer quyết. */
        valueLabel: (percent: number) => string;
        /** Nhãn cho chính khung ảnh: bấm (hoặc Enter/Space) để phóng và về gốc. */
        toggleLabel: string;
      }
    | undefined;
  renderMedia: (index: number) => ReactNode;
}) {
  const current = openAt ?? 0;
  const [scale, setScale] = useState<number>(ZOOM_MIN);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const stageRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; from: PanOffset } | null>(null);
  /** Con trỏ có DI CHUYỂN trong lần nhấn này không — phân biệt "rê" với "bấm". */
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  // Đổi ảnh thì trả zoom về gốc. Giữ nguyên mức phóng khi sang ảnh khác nghĩa là
  // ảnh kế mở ra ở một góc crop ngẫu nhiên — người xem không hiểu mình đang nhìn
  // phần nào của tấm nào.
  const resetZoom = useCallback(() => {
    setScale(ZOOM_MIN);
    setPan({ x: 0, y: 0 });
  }, []);

  /** Kích thước khung sân khấu, đọc thẳng từ DOM tại thời điểm cần — KHÔNG giữ
      trong state: nó đổi theo cỡ cửa sổ và không có sự kiện nào đáng nghe. */
  const stageBox = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }, []);

  const zoomBy = useCallback(
    (direction: 1 | -1) => {
      setScale((prev) => {
        const next = nextZoom(prev, direction);
        // Thu nhỏ mà giữ nguyên độ dời cũ sẽ để ảnh lệch khỏi tâm; kẹp lại theo
        // biên MỚI ngay trong cùng một lần đổi.
        setPan((p) => clampPan(p, next, stageBox()));
        return next;
      });
    },
    [stageBox],
  );

  // KHÔNG cuộn vòng: tới ảnh cuối rồi bấm tiếp mà quay về ảnh đầu làm người xem
  // tưởng mình chưa xem hết. Nút bị vô hiệu ở hai đầu, đúng như dải khởi hành.
  const go = useCallback(
    (delta: number) => {
      resetZoom();
      onNavigate(Math.min(count - 1, Math.max(0, current + delta)));
    },
    [current, count, onNavigate, resetZoom],
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
    if (!zoom) return;
    // `+` và `-` là phím thu/phóng quen thuộc; `0` về gốc như mọi trình xem ảnh.
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1);
    }
    if (event.key === '-') {
      event.preventDefault();
      zoomBy(-1);
    }
    if (event.key === '0') {
      event.preventDefault();
      resetZoom();
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!canPan(scale)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, from: pan };
    movedRef.current = false;
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    movedRef.current = true;
    setPan(
      clampPan(
        {
          x: drag.from.x + (event.clientX - drag.startX),
          y: drag.from.y + (event.clientY - drag.startY),
        },
        scale,
        stageBox(),
      ),
    );
  }

  function onPointerUp() {
    dragRef.current = null;
    setDragging(false);
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
          {/* `.lb-tools` của bản duyệt — 32×32 mỗi nút, gap 6. */}
          <div className="flex items-center gap-1.5">
            {zoom ? (
              <>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={zoom.outLabel}
                  disabled={scale <= ZOOM_MIN}
                  onClick={() => zoomBy(-1)}
                >
                  <ZoomOutIcon />
                </Button>
                {/* `.lb-zoom` — mono 12, rộng tối thiểu 44 để 100%→300% không
                    làm hai nút hai bên nhảy chỗ. */}
                <p className="min-w-11 text-center font-mono text-xs text-muted-foreground tabular-nums">
                  {zoom.valueLabel(zoomPercent(scale))}
                </p>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={zoom.inLabel}
                  disabled={scale >= ZOOM_MAX}
                  onClick={() => zoomBy(1)}
                >
                  <ZoomInIcon />
                </Button>
              </>
            ) : null}
            <DialogClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label={closeLabel}>
                  <XIcon />
                </Button>
              }
            />
          </div>
        </div>

        {zoom ? (
          // `.lb-stage` — cắt phần tràn, con trỏ đổi theo trạng thái, và TẮT
          // transition khi đang kéo để ảnh bám tay chứ không trôi sau con trỏ.
          //
          // `<button>` THẬT chứ không `div role="button"`: con trỏ đã là
          // `zoom-in` nên chuột được hứa một cú bấm, và lời hứa đó phải tới được
          // cả bàn phím. Thẻ thật cho Enter/Space miễn phí, không phải tự nối.
          // An toàn vì `renderMedia` theo hợp đồng là MEDIA — không có phần tử
          // tương tác nào lồng bên trong.
          <button
            type="button"
            ref={stageRef}
            aria-label={zoom.toggleLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn(
              'block w-full overflow-hidden rounded-md',
              canPan(scale) ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in',
            )}
            // Bấm khi chưa phóng thì phóng lên; đang phóng thì về gốc. Cú THẢ
            // sau khi kéo cũng bắn `click`, nên phải bỏ qua nó — nếu không, mỗi
            // lần rê ảnh xong là zoom tự nhảy về 100%.
            onClick={() => {
              if (movedRef.current) {
                movedRef.current = false;
                return;
              }
              if (scale === ZOOM_MIN) zoomBy(1);
              else resetZoom();
            }}
          >
            <div
              className={cn('origin-center', dragging ? '' : 'transition-transform duration-150')}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
              {renderMedia(current)}
            </div>
          </button>
        ) : (
          renderMedia(current)
        )}

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
