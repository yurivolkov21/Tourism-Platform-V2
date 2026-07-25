import type { LegalDoc } from '@tourism/i18n';
import { Typeset } from '@tourism/ui/components/typeset';
import { TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ContentHero } from '@/components/content/content-hero';
import { OnThisPage } from '@/components/content/on-this-page';
import { ReadingProgress } from '@/components/content/reading-progress';
import { Reveal } from '@/components/motion/reveal';
import { slugify } from '@/lib/slug';
import { tocFromLegalDoc } from '@/lib/toc';

// Khung chung cho 3 trang pháp lý dài. Kỷ luật lấy từ mẫu Vercel/Linear:
// một cột đo hẹp (~68ch), số section bằng font mono, hairline chia đoạn —
// thay vòng tròn primary của Nexora. Thân chữ chạy bọc <Typeset preset="reading">
// (ADR-0012) để cỡ chữ/leading/nhịp dọc do hệ typography lo, không chế tay.
export function LegalArticle({
  doc,
  afterIntro,
}: {
  doc: LegalDoc;
  /** Nội dung riêng của từng trang, chèn giữa phần mở đầu và các mục đánh số
      (vd sơ đồ quy trình hoàn tiền ở /cancellation-policy). */
  afterIntro?: ReactNode;
}) {
  const toc = tocFromLegalDoc(doc);

  return (
    <>
      <ReadingProgress />
      <ContentHero breadcrumb={doc.breadcrumb} title={doc.title} meta={doc.updated} />

      {/* Padding đặt ở lớp full-bleed rồi mới max-w-7xl bên trong — đúng thứ tự
          của ContentHero; làm ngược lại thì mép trái thân bài lệch 80px so với
          tiêu đề hero (đã đo). */}
      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto flex max-w-7xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
          <div className="min-w-0 max-w-[68ch]">
            {doc.reviewNote ? (
              <div className="mb-12 flex gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-5 text-sm">
                <TriangleAlertIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <p className="leading-relaxed text-pretty text-foreground/80">{doc.reviewNote}</p>
              </div>
            ) : null}

            <Typeset preset="reading" className="text-muted-foreground">
              {doc.intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Typeset>

            {afterIntro ? <div className="mt-12">{afterIntro}</div> : null}

            <div className="mt-12 divide-y divide-border border-t border-border">
              {doc.sections.map((section, i) => (
                <section
                  key={section.heading}
                  id={slugify(section.heading)}
                  className="scroll-mt-28 py-10"
                >
                  <Reveal>
                    <div className="mb-4 flex items-baseline gap-4">
                      <span className="font-mono text-xs tabular-nums text-primary">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h2 className="font-heading text-2xl leading-snug font-medium text-balance text-foreground">
                        {section.heading}
                      </h2>
                    </div>

                    <Typeset preset="reading" className="text-muted-foreground">
                      {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {section.bullets ? (
                        <ul>
                          {section.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </Typeset>
                  </Reveal>
                </section>
              ))}
            </div>
          </div>

          {/* Mobile: mục lục lên TRƯỚC bài (order-first) như Nexora — nằm sau
              bài thì phải cuộn hết mới thấy, coi như không có. Chặn chiều cao
              cho nó cuộn trong khung, khỏi đẩy nội dung xuống quá sâu. */}
          <aside className="order-first mb-12 lg:order-none lg:mb-0">
            <div className="max-h-64 overflow-y-auto lg:sticky lg:top-28 lg:max-h-none lg:overflow-visible">
              <OnThisPage items={toc} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
