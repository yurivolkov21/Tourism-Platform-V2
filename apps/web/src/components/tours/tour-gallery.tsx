'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { ImagesIcon } from 'lucide-react';
import { useState } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { Lightbox } from '@/components/media/lightbox';
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

      {/* `Lightbox` là component DÙNG CHUNG (`components/media/lightbox.tsx`) —
          gallery trang vùng dùng cùng một bản. Copy đi qua prop nên khối
          `messages.tourDetail.gallery` ở đây vẫn là nguồn duy nhất cho trang tour.

          KHÔNG truyền nhãn vào media: mô tả đã nằm ở `caption` dưới ảnh, và chú
          thích là thứ Ở LẠI khi có ảnh thật (nhãn placeholder thì biến mất).
          Truyền cả hai làm cùng một câu hiện hai lần — đo được ở ảnh chụp vòng
          đầu. */}
      <Lightbox
        count={photos.length}
        openAt={openAt}
        onOpenChange={(open) => setOpenAt(open ? (openAt ?? 0) : null)}
        onNavigate={setOpenAt}
        dialogTitle={t.dialogTitle}
        counterLabel={t.counter}
        closeLabel={t.close}
        previousLabel={t.previous}
        nextLabel={t.next}
        caption={(index) => photos[index]?.alt ?? null}
        renderMedia={() => <ImagePlaceholder className="aspect-16/10 w-full rounded-lg" />}
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
