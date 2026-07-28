'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon, ImagesIcon, XIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { tourGallery } from '@/lib/tours';
import type { MockMediaItem } from '@/mocks/types';

/**
 * Khảm ảnh của trang chi tiết tour + lightbox.
 *
 * THAY cho băng ảnh 21:9 full-bleed trước đây: băng đó chiếm 617px ở màn 1440 mà
 * không nói được gì ngoài "sẽ có ảnh ở đây". Khảm nằm TRONG `max-w-7xl` như mọi
 * nội dung khác, không full-bleed — trang đã có hai băng tối liên tiếp (hero + dải
 * khởi hành), thêm băng thứ ba là quá nhiều.
 *
 * Ô có ASPECT CỐ ĐỊNH, không masonry theo chiều ảnh: `MediaItem.width/height` là
 * nullable ở DB (và mock có item null để canh), nên bố cục không được phụ thuộc tỉ
 * lệ nội tại của ảnh.
 *
 * Ba nhánh số lượng, không nhánh nào để lại khung rỗng:
 *  • 0 ảnh → không render gì. Không khung, không nút "xem ảnh". Đây là nhánh THẬT
 *    khi gắn API (tour vừa tạo, biên tập chưa upload), không phải trường hợp giả.
 *  • 1 ảnh → một ô đơn tỉ lệ 16:10, không khảm, không nút.
 *  • ≥2 ảnh → khảm: ô lớn bên trái + tối đa 4 ô nhỏ. Nút "View all N photos" chỉ
 *    hiện khi còn ảnh chưa lộ ra trên khảm.
 */

/** Số ô nhỏ tối đa cạnh ô lớn. Bốn ô cho lưới 2×2 vuông vắn cạnh ô lớn 2 hàng. */
const MAX_THUMBS = 4;

export function TourGallery({
  media,
  /** Nhãn ngắn cho ô lớn — tên điểm đến chính, KHÔNG phải tên tour (tên tour đã là
      H1 ngay trên). Các ô nhỏ không có nhãn: một câu dài trong ô 180px thì gãy vụn. */
  primaryLabel,
}: {
  media: MockMediaItem[];
  primaryLabel: string | undefined;
}) {
  const t = messages.tourDetail.gallery;
  const photos = tourGallery(media);
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const [lead, ...rest] = photos;
  const thumbs = rest.slice(0, MAX_THUMBS);
  // Còn ảnh nào chưa xuất hiện trên khảm thì mới có lý do mời xem tất cả.
  const hiddenCount = photos.length - 1 - thumbs.length;

  return (
    // Đệm trên nằm ở ĐÂY, không ở wrapper bên page.tsx: component trả `null` khi
    // không có ảnh, mà wrapper thì vẫn render — thành ra 40–48px đệm cho một thứ
    // không tồn tại (đo được ở ảnh chụp nhánh "không ảnh" vòng đầu).
    <section aria-label={t.label} className="w-full px-4 pt-10 md:px-16 md:pt-12 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        {photos.length === 1 ? (
          <GalleryTile
            photo={lead}
            index={0}
            total={1}
            label={primaryLabel}
            onOpen={setOpenAt}
            className="aspect-16/10 w-full"
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:grid-rows-2">
            {/* Ô lớn: 2 cột × 2 hàng ở sm+. Dưới sm nó tràn cả chiều ngang và các
                ô nhỏ xếp thành lưới 2 cột bên dưới — không cần lightbox mới xem
                được ảnh nào. */}
            <GalleryTile
              photo={lead}
              index={0}
              total={photos.length}
              label={primaryLabel}
              onOpen={setOpenAt}
              className="col-span-2 aspect-16/10 sm:row-span-2 sm:aspect-auto sm:h-full"
            />
            {thumbs.map((photo, i) => (
              <GalleryTile
                key={photo.publicId}
                photo={photo}
                index={i + 1}
                total={photos.length}
                onOpen={setOpenAt}
                className="aspect-4/3 w-full"
              />
            ))}
          </div>
        )}

        {hiddenCount > 0 ? (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpenAt(0)}>
              <ImagesIcon aria-hidden="true" />
              {t.viewAll(photos.length)}
            </Button>
          </div>
        ) : null}
      </div>

      <Lightbox
        photos={photos}
        openAt={openAt}
        onOpenChange={(open) => setOpenAt(open ? (openAt ?? 0) : null)}
        onNavigate={setOpenAt}
      />
    </section>
  );
}

function GalleryTile({
  photo,
  index,
  total,
  label,
  onOpen,
  className,
}: {
  photo: MockMediaItem | undefined;
  index: number;
  total: number;
  label?: string | undefined;
  onOpen: (index: number) => void;
  className?: string;
}) {
  if (!photo) return null;
  const t = messages.tourDetail.gallery;

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      // Tên khả truy cập nói VỊ TRÍ, không nói nội dung: mô tả ảnh nằm ở `alt` và
      // chỉ hiện thành chú thích trong lightbox. Ô khảm bịa mô tả là nói dối về
      // thứ mình không biết — và `alt` có thể null.
      aria-label={t.openPhoto(index + 1, total)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <ImagePlaceholder
        label={label}
        className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    </button>
  );
}

function Lightbox({
  photos,
  openAt,
  onOpenChange,
  onNavigate,
}: {
  photos: MockMediaItem[];
  openAt: number | null;
  onOpenChange: (open: boolean) => void;
  onNavigate: (index: number) => void;
}) {
  const t = messages.tourDetail.gallery;
  const current = openAt ?? 0;
  const photo = photos[current];

  // KHÔNG cuộn vòng: tới ảnh cuối rồi bấm tiếp mà quay về ảnh đầu làm người xem
  // tưởng mình chưa xem hết. Nút bị vô hiệu ở hai đầu, đúng như dải khởi hành.
  const go = useCallback(
    (delta: number) => {
      onNavigate(Math.min(photos.length - 1, Math.max(0, current + delta)));
    },
    [current, photos.length, onNavigate],
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

  if (!photo) return null;

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
          <DialogTitle className="sr-only">{t.dialogTitle}</DialogTitle>
          <p aria-live="polite" className="font-mono text-xs tracking-widest text-muted-foreground">
            {t.counter(current + 1, photos.length)}
          </p>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t.close}>
                <XIcon />
              </Button>
            }
          />
        </div>

        {/* KHÔNG truyền `label`: mô tả đã nằm ở chú thích dưới ảnh, và chú thích là
            thứ Ở LẠI khi có ảnh thật (nhãn placeholder thì biến mất). Truyền cả hai
            làm cùng một câu hiện hai lần — đo được ở ảnh chụp vòng đầu. */}
        <ImagePlaceholder className="aspect-16/10 w-full rounded-lg" />

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            aria-label={t.previous}
            disabled={current === 0}
            onClick={() => go(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          {/* Chú thích lặp lại `alt` thành chữ đọc được — nhãn trong
              ImagePlaceholder sẽ biến mất khi có ảnh thật, chú thích thì không. */}
          {photo.alt ? (
            <p className="min-w-0 flex-1 text-center text-sm text-pretty text-muted-foreground">
              {photo.alt}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label={t.next}
            disabled={current === photos.length - 1}
            onClick={() => go(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
