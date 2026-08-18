import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { Reveal } from '@/components/motion/reveal';
import { SlotImage } from '@/components/slot-image';
import type { SiteMediaItem } from '@/lib/api/site-media';
import type { MockMoment } from '@/mocks/types';

/**
 * Một khoảnh khắc ĐÃ được gắn ảnh của khe tương ứng.
 *
 * Ảnh giải ở TRANG rồi truyền xuống, không để component tự gọi mạng: file này
 * cố ý nhận dữ liệu qua prop để test được với fixture nhỏ (ghi ngay dưới), và
 * một component tự fetch thì mất luôn tính chất đó.
 */
export type MomentVM = MockMoment & { image: SiteMediaItem | null };

/** Số ô nhỏ tối đa cạnh ô lớn — cùng khảm 1 lớn + 4 nhỏ mà `TourGallery` đã
    duyệt (file đó xoá 13/08 khi trang tour chuyển sang dải 7 thumb của
    `tour-media-panel.tsx`), khác ở chỗ đây KHÔNG có lightbox: khu này giới
    thiệu, không phải gallery tương tác. */
const MAX_THUMBS = 4;

/**
 * Khu "Moments from the journey" — băng TỐI thứ hai của trang (sau hero),
 * đứng ngay sau ba `RegionGroup`. Đây là phần *cảm xúc* mà bản thẻ vùng cũ
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
export function JourneyMoments({ moments }: { moments: MomentVM[] }) {
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
            <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
            {/* `md:text-[40px]/12` là cỡ chuẩn của trang marketing (10 component
                home/about dùng), KHÔNG phải `md:text-4xl` — cỡ đó thuộc về
                `/contact`, một trang tiện ích. */}
            <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
              {t.heading}
            </h2>
            <p className="mt-2 text-pretty text-muted-foreground">{t.subtitle}</p>
          </div>

          {/* Khảm: 1 ô lớn (2×2 ở sm+) + tối đa 4 ô nhỏ — cùng lưới
              `TourGallery` dùng, không sao chép lightbox của nó.
              Mỗi ô bọc `Reveal` riêng với `delay` tăng dần: khảm DỰNG LÊN lần
              lượt thay vì bật một cục. Trước đây cả khu chỉ có đúng một
              `Reveal` bọc ngoài (ở page.tsx) nên 5 ô đến cùng lúc và đứng im. */}
          <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:grid-rows-2">
            <Reveal className="col-span-2 sm:row-span-2 sm:h-full">
              <MomentTile moment={lead} className="aspect-4/3 sm:aspect-auto sm:h-full" />
            </Reveal>
            {thumbs.map((moment, index) => (
              // Bước 80ms — đủ để mắt thấy thứ tự mà không thành hàng đợi lê thê.
              <Reveal key={moment.title} delay={0.08 * (index + 1)}>
                <MomentTile moment={moment} className="aspect-4/3 w-full" />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Một ô khoảnh khắc. Là LINK sang chính tour trong `credit`, không phải `<div>`
 * trơ: hover-zoom trên một thứ bấm không đi đâu là hứa hão — chuột báo "tương
 * tác được" rồi bấm vào không có gì xảy ra. Ba component ảnh khác của repo
 * (`tour-media-panel`, `about-gallery`, `tour-card`) đều có hover VÌ chúng là
 * link hoặc nút thật.
 */
function MomentTile({ moment, className }: { moment: MomentVM; className?: string }) {
  return (
    <a
      href={`/tours/${moment.tourSlug}`}
      className={cn(
        'group relative block overflow-hidden rounded-xl',
        // Vòng focus INSET: ô có `overflow-hidden` nên ring thường bị cắt mất.
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none',
        className,
      )}
    >
      {/* Zoom ảnh theo đúng công thức `tour-gallery.tsx` (khảm cùng họ; file
          gốc xoá 13/08, bản chuẩn nhất repo nay là CHÍNH ĐÂY): 500ms ease-out,
          scale 105, có `group-focus-within`
          cho bàn phím và ĐỦ guard `motion-reduce`. Cố ý KHÔNG theo
          `about-gallery.tsx` — bản đó thiếu cả `ease-out` lẫn guard. */}
      <SlotImage
        image={moment.image}
        className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105 group-focus-within:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        sizes="(min-width: 640px) 50vw, 100vw"
      />

      {/* Lớp phủ đậm thêm khi hover — caption nổi rõ hơn lúc con trỏ ở trên ô.
          `--overlay` đã mang alpha sẵn nên `/25` là ~0.12 hiệu dụng: đủ thấy,
          không nuốt mất ảnh. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 transition-colors duration-500 group-hover:bg-overlay/25 group-focus-within:bg-overlay/25 motion-reduce:transition-none"
      />

      {/* Caption đè lên ảnh: `title` là chú thích, `credit` là dòng nhỏ dưới —
          cùng khuôn scrim `from-overlay` + `text-on-media` mà `home/gallery.tsx`
          đã dùng cho caption đáy ảnh (token cố định, không phải theo theme,
          đúng chỗ vì nền là ảnh/scrim tối chứ không phải nền trang). */}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-overlay to-transparent p-4 pt-10 text-on-media">
        <p className="text-sm font-medium text-pretty">{moment.title}</p>
        <p className="mt-1 text-xs opacity-85">{moment.credit}</p>
      </div>
    </a>
  );
}
