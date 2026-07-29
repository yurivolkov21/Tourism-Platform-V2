'use client';

import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@tourism/ui/components/carousel';
import { StarIcon } from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import type { MockTestimonial } from '@/mocks/types';

/**
 * Khu "Loved by travellers" — bố cục HAI CỘT kiểu Nexora
 * (`marketing/testimonials.tsx`): cột trái là phần giới thiệu + hai nút điều
 * hướng, cột phải là carousel hiện ĐÚNG MỘT trích dẫn một lúc.
 *
 * Vì sao một-lần-một thay vì lưới 3 cột (bản trước): ba trích dẫn cạnh nhau
 * buộc mỗi cái phải ngắn để cân hàng, và mắt đọc lướt cả ba cùng lúc nên không
 * cái nào đọng lại. Một trích dẫn được cỡ chữ lớn và toàn bộ sự chú ý.
 *
 * KHÁC Nexora ba chỗ, đều có lý do:
 *  1. Eyebrow dùng `SectionEyebrow` (chấm vuông) chứ không `Badge` — quy ước
 *     tiêu đề khu vừa thống nhất cho cả 4 khu của trang này.
 *  2. GIỮ hàng sao: `MockTestimonial` có `rating` thật, `TestimonialItem` của
 *     Nexora thì không.
 *  3. Dòng meta chỉ có `location` — mock v2 không có trường `trip`, và bịa ra
 *     một chuyến đi cho lời chứng thực là đúng thứ Nexora tự cảnh báo trong
 *     comment của họ ("fabricated testimonials are a credibility risk").
 *
 * KHÔNG tự chạy: embla chỉ trôi khi người đọc bấm. Tự trôi sẽ cướp mất trích
 * dẫn mà người ta đang đọc dở, và muốn đúng chuẩn tiếp cận thì lại phải thêm
 * nút tạm dừng — thêm điều khiển để sửa một vấn đề do chính mình tạo ra.
 *
 * Nhận dữ liệu qua PROP, không tự import `TESTIMONIALS` — để test được với
 * fixture nhỏ.
 */
export function TravellerQuotes({ testimonials }: { testimonials: MockTestimonial[] }) {
  const t = messages.destinationsPage.quotes;

  // Không có lời chứng thực nào thì ẩn cả khu — không có dữ liệu dự phòng.
  if (testimonials.length === 0) return null;

  return (
    <section className="w-full px-4 py-16 md:px-16 lg:px-24 xl:px-32">
      <Carousel
        className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 md:grid-cols-2 lg:gap-16"
        opts={{ align: 'start', slidesToScroll: 1 }}
      >
        {/* Cột trái — giới thiệu + điều khiển */}
        <div className="flex flex-col gap-8">
          <div>
            <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
            <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
              {t.heading}
            </h2>
            <p className="mt-2 text-pretty text-muted-foreground">{t.subtitle}</p>
          </div>

          {/* `static translate-y-0` gỡ định vị mặc định của component: bản
              vendored đặt hai nút `absolute -left-12 / -right-12`, tức trôi ra
              NGOÀI mép carousel và ở màn hẹp sẽ nằm ngoài khung nhìn. Nexora
              cũng phải gỡ đúng hai class này. */}
          <div className="flex items-center gap-3">
            <CarouselPrevious variant="outline" size="icon" className="static translate-y-0" />
            <CarouselNext variant="outline" size="icon" className="static translate-y-0" />
          </div>
        </div>

        {/* Cột phải — carousel một trích dẫn */}
        <CarouselContent>
          {testimonials.map((item) => (
            <CarouselItem key={item.name}>
              <QuoteFigure item={item} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

/** Chữ cái đầu của tối đa hai phần đầu tên — "Sarah Mitchell" → "SM". */
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
}

function QuoteFigure({ item }: { item: MockTestimonial }) {
  return (
    <figure className="flex flex-col gap-8">
      <div>
        {/* Dấu nháy cỡ đại — thuần trang trí nên `aria-hidden` và
            `select-none`: trình đọc màn hình đã có `<blockquote>` để biết đây
            là trích dẫn, đọc thêm một dấu nháy là nhiễu. */}
        <p
          aria-hidden="true"
          className="h-10 font-heading text-7xl leading-none text-primary/25 select-none"
        >
          &ldquo;
        </p>
        <blockquote className="font-heading text-xl leading-snug text-pretty text-foreground sm:text-2xl lg:text-3xl">
          {item.quote}
        </blockquote>
      </div>

      <figcaption className="flex items-center gap-3">
        <Avatar className="size-11">
          <AvatarFallback className="bg-primary/10 font-medium text-primary">
            {initials(item.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          {/* Hàng sao đọc thành MỘT câu, không phải 5 icon rời — cùng cách
              `tour-reviews.tsx` đã chốt. */}
          <div
            role="img"
            aria-label={`${item.rating} out of 5 stars`}
            className="flex items-center gap-1"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <StarIcon
                // biome-ignore lint/suspicious/noArrayIndexKey: dãy sao tĩnh 5 phần tử, không reorder
                key={i}
                aria-hidden="true"
                className={
                  i < Math.round(item.rating)
                    ? 'size-3.5! fill-rating text-rating'
                    : 'size-3.5! text-rating-muted'
                }
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{item.name}</span> · {item.location}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}
