import { messages } from '@tourism/i18n';
import { ArrowRightIcon } from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import type { MockDestination, MockRegion } from '@/mocks/types';
import { DestinationTile } from './destination-tile';

/**
 * Một khu vùng trên trang `/destinations` — Task 4c, thay `RegionBand` (bố
 * cục hai cột + kinh tuyến dọc của Task 4b, user bác vì muốn đúng kiểu
 * Nexora). Bố cục mới: header căn giữa (tiêu đề + intro + số tour + link
 * "View more") trên nền tint theo vùng, rồi một DẢI ẢNH FULL-BLEED sát mép
 * màn hình gồm các `DestinationTile`, ô đầu `variant="feature"` (chữ to hơn),
 * các ô còn lại `variant="photo"`. Xem
 * `.superpowers/sdd/dest-task-4c-brief.md` cho ASCII bố cục và lý do.
 *
 * Kinh tuyến dọc + chấm trạm của `RegionBand` BỎ HẲN ở đây — dải ảnh chạy sát
 * mép nên không còn chỗ cho một đường kẻ dọc bên trái; giữ cả hai là nhồi hai
 * chữ ký vào một khu (quyết định "Khác Nexora ở đâu" trong brief).
 */
export function RegionGroup({
  region,
  destinations,
  tourCount,
}: {
  region: MockRegion;
  destinations: MockDestination[];
  tourCount: number;
}) {
  const t = messages.destinationsPage;
  // Câu intro đã có sẵn ở `regionPage.regions[key].intro` (Task 3) — dùng lại
  // đúng một nguồn, không chép thành key thứ hai (brief dặn rõ).
  const intro = messages.regionPage.regions[region.key].intro;

  return (
    <section data-region={region.key} className="w-full">
      {/* Header — CHỈ khối này tint theo vùng, dải ảnh bên dưới KHÔNG tint
          (ảnh tự mang màu). Công thức pha giữ NGUYÊN như `region-band.tsx`:
          `--region-primary` (tông GIỮA, cố định) pha `--background` (theo
          theme) 88% — vừa được sửa để đạt AA ở dark mode, đừng đổi. */}
      <div
        style={{ background: 'color-mix(in oklch, var(--region-primary), var(--background) 88%)' }}
        className="w-full px-4 py-16 text-center md:px-16 lg:px-24 xl:px-32"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          {/* Số tour làm EYEBROW, không phải một dòng rời giữa intro và link.
              Trước đây nó nằm dưới intro và đọc thành dòng lơ lửng không thuộc
              về đâu — trong khi nó vốn đã đúng hình dạng eyebrow (chữ hoa nhỏ),
              chỉ sai chỗ và thiếu chấm vuông.
              `SectionEyebrow` là quy ước toàn site (15 component dùng); import
              từ `home/` theo đúng tiền lệ `about/about-values.tsx`. */}
          <SectionEyebrow>{t.toursLabel(tourCount)}</SectionEyebrow>
          {/* Cỡ chữ theo chuẩn trang marketing (`md:text-[40px]/12`, 10 component
              home/about dùng) — KHÔNG dùng `md:text-4xl`: cỡ đó là của `/contact`,
              một trang tiện ích. */}
          <h2 className="font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
            {t.regionHeading(region.name)}
          </h2>
          <p className="text-pretty text-muted-foreground">{intro}</p>
          {/* Link sang trang vùng CÓ THẬT (`/destinations/[region]`, Task 5 kế
              tiếp) — `<a>` thuần, cùng quy ước với các link nội bộ khác trong
              cụm destinations (know-before-you-go.tsx). */}
          <a
            href={`/destinations/${region.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t.viewMore}
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </div>

      {/* Dải ảnh FULL-BLEED — không padding ngang nên chạy sát mép màn hình
          (section cha `w-full`, `<main>` không có container giới hạn chiều
          rộng). `gap-px` trên nền `bg-border` là vạch mảnh giữa các ô. Mobile
          xếp dọc (flex-col, không có chiều cao cố định — mỗi tile tự mang
          min-height). */}
      <div className="flex flex-col gap-px border-y border-border bg-border sm:h-100 sm:flex-row">
        {destinations.map((dest, i) => (
          <DestinationTile
            key={dest.slug}
            destination={dest}
            variant={i === 0 ? 'feature' : 'photo'}
          />
        ))}
      </div>
    </section>
  );
}
