import { messages } from '@tourism/i18n';
import { ArrowRightIcon } from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import type { MockFaqItem } from '@/mocks/types';

/**
 * Khu "Know before you go" — lưới 2 cột câu hỏi pre-sales (`FAQ_ITEMS`, 5
 * mục nội dung THẬT, đã duyệt và đang chạy ở `/contact`), kèm link sang trang
 * `/faq` có thật (spec §5.1). Không bịa gì — chỉ dùng lại nội dung mình đã
 * duy trì.
 *
 * Nhận dữ liệu qua PROP, không tự import mock — để test được với fixture nhỏ.
 */
export function KnowBeforeYouGo({ items }: { items: MockFaqItem[] }) {
  const t = messages.destinationsPage.know;

  if (items.length === 0) return null;

  return (
    <section className="w-full px-4 py-16 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
            <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
              {t.heading}
            </h2>
            <p className="mt-2 text-pretty text-muted-foreground">{t.subtitle}</p>
          </div>
          <a
            href="/faq"
            className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary-emphasis hover:underline"
          >
            {t.seeAll}
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </a>
        </div>

        <dl className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-foreground">{item.question}</dt>
              <dd className="mt-2 text-pretty text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
