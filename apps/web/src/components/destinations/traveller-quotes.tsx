import { messages } from '@tourism/i18n';
import { StarIcon } from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import type { MockTestimonial } from '@/mocks/types';

/** Số trích dẫn hiển thị — cố định 3, không phải toàn bộ `TESTIMONIALS` (8
    mục): trang chủ đã có marquee đủ 8, lấy 3 ở đây tránh độn dài trang. */
const FEATURED_COUNT = 3;

/**
 * Khu "Loved by travellers" — trích dẫn LỚN (`font-heading text-xl`), cố ý
 * KHÁC hình thức marquee 2 cột của `components/home/testimonials.tsx` để
 * không thành bản sao của khu đã có ở trang chủ (spec §5.1).
 *
 * Nhận dữ liệu qua PROP, không tự import `TESTIMONIALS` — để test được với
 * fixture nhỏ.
 */
export function TravellerQuotes({ testimonials }: { testimonials: MockTestimonial[] }) {
  const t = messages.destinationsPage.quotes;
  const featured = testimonials.slice(0, FEATURED_COUNT);

  if (featured.length === 0) return null;

  return (
    <section className="w-full px-4 py-16 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
            {t.heading}
          </h2>
          <p className="mt-2 text-pretty text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {featured.map((item) => (
            <QuoteCard key={item.name} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteCard({ item }: { item: MockTestimonial }) {
  return (
    <figure className="flex flex-col gap-4">
      <blockquote className="font-heading text-xl leading-snug text-pretty text-foreground">
        “{item.quote}”
      </blockquote>
      <figcaption className="mt-auto flex flex-col gap-1.5">
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
      </figcaption>
    </figure>
  );
}
