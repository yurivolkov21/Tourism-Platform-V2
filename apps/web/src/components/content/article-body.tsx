import { Typeset } from '@tourism/ui/components/typeset';
import { Reveal } from '@/components/motion/reveal';
import { slugify } from '@/lib/slug';

/** Một section thân bài. Trang pháp lý (`LegalDoc.sections`) và bài blog
    (mock journal cũ, đã khai tử Task 10) đã cùng hình dạng này từ đầu — đó là
    lý do tách được mà không ai phải đổi dữ liệu. */
export interface ArticleSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

/**
 * Thân bài dùng chung cho `/terms` · `/privacy` · `/cancellation-policy` và
 * `/blog/[slug]`.
 *
 * Bốn chỗ trước đây chép NGUYÊN KHỐI ~33 dòng giống nhau từng ký tự
 * (`legal-article.tsx` và `blog/[slug]/page.tsx`); CHANGELOG cụm Blog đã ghi nợ
 * này kèm nhận xét "đã bắt đầu trôi".
 *
 * CHÚ Ý cho ai đối chiếu với plan: khuôn `ArticleBody` trong plan là một bản
 * NHÁP khác hẳn code thật — nó bọc mọi thứ trong một `Typeset`, không có số mục,
 * không `Reveal`, không `divide-y`. Làm theo nháp đó là hồi quy thị giác trên cả
 * bốn trang. Ở đây tách đúng khối đang chạy.
 *
 * Bốn thứ hợp thành hợp đồng của khối này, đừng bỏ bớt khi sửa:
 *  1. `id` từ `slugify(heading)` — `OnThisPage` nhảy tới đúng chỗ nhờ nó, và
 *     `tocFromSections` dùng cùng hàm nên hai bên không thể lệch.
 *  2. `scroll-mt-28` — bù chiều cao navbar pill, không có thì tiêu đề bị navbar
 *     che sau khi nhảy anchor.
 *  3. Số mục mono ĐỨNG NGOÀI `Typeset`: đưa vào trong thì preset reading áp cỡ
 *     chữ thân bài lên nó.
 *  4. `divide-y` + `border-t` ở wrapper, không phải viền từng section — viền
 *     từng cái sẽ nhân đôi ở chỗ giáp nhau.
 */
export function ArticleBody({ sections }: { sections: ArticleSection[] }) {
  return (
    <div className="divide-y divide-border border-t border-border">
      {sections.map((section, i) => (
        <section key={section.heading} id={slugify(section.heading)} className="scroll-mt-28 py-10">
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
  );
}
