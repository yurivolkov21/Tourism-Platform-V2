import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { MockMoment } from '@/mocks/types';

/** Số ô nhỏ tối đa cạnh ô lớn — cùng khảm 1 lớn + 4 nhỏ mà `TourGallery` đã
    duyệt (`components/tours/tour-gallery.tsx`), khác ở chỗ đây KHÔNG có
    lightbox: khu này giới thiệu, không phải gallery tương tác. */
const MAX_THUMBS = 4;

/**
 * Khu "Moments from the journey" — băng TỐI thứ hai của trang (sau hero),
 * đứng ngay sau ba `RegionBand`. Đây là phần *cảm xúc* mà bản thẻ vùng cũ
 * thiếu hẳn: bằng chứng sống (`MOMENTS`, 5 mục) đứng cạnh ba trạm số liệu.
 *
 * Khuôn băng tối ĐÚNG quy ước repo: `bg-hero` + `text-hero-foreground` trên
 * `<section>`, rồi `<div className="dark contents">` bọc RIÊNG nội dung.
 * TUYỆT ĐỐI không đặt `dark` lên chính `<section>` — nếu không, ở dark mode
 * `bg-hero` bị đọc trong scope dark và hero trùng màu nền trang, hero biến
 * mất (lỗi đã sửa ở `ToursHero`, xem `components/tours/tours-hero.tsx`).
 *
 * Nhận dữ liệu qua PROP, không tự import mock — để test được với fixture nhỏ.
 */
export function JourneyMoments({ moments }: { moments: MockMoment[] }) {
  const t = messages.destinationsPage.moments;
  const [lead, ...rest] = moments;
  const thumbs = rest.slice(0, MAX_THUMBS);

  // Không có khoảnh khắc nào: không render khu rỗng.
  if (!lead) return null;

  return (
    <section className="w-full bg-hero px-4 py-16 text-hero-foreground md:px-16 lg:px-24 xl:px-32">
      <div className="dark contents">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-medium text-foreground md:text-4xl">
              {t.heading}
            </h2>
            <p className="mt-2 text-pretty text-muted-foreground">{t.subtitle}</p>
          </div>

          {/* Khảm: 1 ô lớn (2×2 ở sm+) + tối đa 4 ô nhỏ — cùng lưới
              `TourGallery` dùng, không sao chép lightbox của nó. */}
          <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:grid-rows-2">
            <MomentTile
              moment={lead}
              className="col-span-2 aspect-4/3 sm:row-span-2 sm:aspect-auto sm:h-full"
            />
            {thumbs.map((moment) => (
              <MomentTile key={moment.title} moment={moment} className="aspect-4/3 w-full" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MomentTile({ moment, className }: { moment: MockMoment; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <ImagePlaceholder className="h-full w-full" />
      {/* Caption đè lên ảnh: `title` là chú thích, `credit` là dòng nhỏ dưới —
          cùng khuôn scrim `from-overlay` + `text-on-media` mà `home/gallery.tsx`
          đã dùng cho caption đáy ảnh (token cố định, không phải theo theme,
          đúng chỗ vì nền là ảnh/scrim tối chứ không phải nền trang). */}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-overlay to-transparent p-4 pt-10 text-on-media">
        <p className="text-sm font-medium text-pretty">{moment.title}</p>
        <p className="mt-1 text-xs opacity-85">{moment.credit}</p>
      </div>
    </div>
  );
}
