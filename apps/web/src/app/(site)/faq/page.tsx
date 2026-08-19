import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { ContentHero } from '@/components/content/content-hero';
import { OnThisPage } from '@/components/content/on-this-page';
import { FaqExplorer } from '@/components/faq/faq-explorer';
import { slugify } from '@/lib/slug';
import type { TocItem } from '@/lib/toc';

export const metadata: Metadata = {
  title: `${messages.pageMeta.faq.title} — Nexora`,
  description: messages.pageMeta.faq.description,
};

// JSON-LD FAQPage cho rich result. Dựng từ catalogue TĨNH của mình (không có
// input người dùng); escape `<` sau JSON.stringify để một giá trị bất kỳ
// không thể thoát ra khỏi thẻ <script> — pattern an toàn port từ Nexora.
function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: messages.faqPage.categories.flatMap((category) =>
      category.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    ),
  };
}

export default function FaqPage() {
  const t = messages.faqPage;
  const toc: TocItem[] = t.categories.map((category, i) => ({
    id: slugify(category.title),
    label: category.title,
    index: String(i + 1).padStart(2, '0'),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd()).replace(/</g, '\\u003c'),
        }}
      />

      <ContentHero breadcrumb={t.breadcrumbCurrent} title={t.title} subtitle={t.subtitle} />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto flex max-w-7xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
          <div className="min-w-0 max-w-3xl">
            <FaqExplorer
              categories={t.categories.map((c) => ({ title: c.title, items: c.items }))}
              searchPlaceholder={t.searchPlaceholder}
              searchLabel={t.searchLabel}
              noResults={t.noResults}
            />
          </div>

          {/* Mục lục lên trước bài trên mobile, giống LegalArticle */}
          <aside className="order-first mb-12 lg:order-none lg:mb-0">
            <div className="lg:sticky lg:top-28">
              <OnThisPage items={toc} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
