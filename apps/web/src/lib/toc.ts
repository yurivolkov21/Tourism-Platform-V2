import type { LegalDoc } from '@tourism/i18n';
import { markdownH2s } from '@tourism/ui/lib/markdown-headings';
// Import KHÔNG đuôi: Turbopack không map './slug.js' sang './slug.ts' (Vitest
// thì có — nên test xanh mà dev server vẫn đỏ). Trong mocks/ đuôi .js vô hại
// vì ở đó toàn `import type`, bị xoá lúc biên dịch nên chẳng ai phải resolve.
import { slugify } from './slug';

// Bóc inline markdown của heading: sống ở `@tourism/ui` từ L8-20 (review F3), cùng chỗ với
// hàm dựng id mà `ArticleMarkdown` gắn lên `<h2>`. Re-export để chỗ gọi cũ giữ đường import.
export { headingPlainText } from '@tourism/ui/lib/markdown-headings';

/** Một mục trong "On this page" — `index` là số thứ tự đã pad cho cột mono. */
export type TocItem = { id: string; label: string; index: string };

/** Dựng mục lục từ một mảng section — dùng chung cho LegalDoc và bài blog. */
export function tocFromSections(sections: { heading: string }[]): TocItem[] {
  return sections.map((section, i) => ({
    id: slugify(section.heading),
    label: section.heading,
    index: String(i + 1).padStart(2, '0'),
  }));
}

/** Mục lục của một LegalDoc; id phải khớp id gắn trên thẻ <section>. */
export function tocFromLegalDoc(doc: LegalDoc): TocItem[] {
  return tocFromSections(doc.sections);
}

/** Mục lục từ markdown: chỉ H2 (`## `) — cùng cấp với section cũ; heading
    trong code fence không phải heading. Id lấy từ `markdownH2s`, đúng hàm mà
    ArticleMarkdown dùng gắn id cho <h2> — nên TOC không thể trỏ vào không khí, kể cả
    khi hai heading trùng chữ (lần sau mang hậu tố `-2`, L8-20). Nhãn cũng là text
    thuần: nhãn thô in nguyên dấu sao của heading in đậm (thử tay P4e-4 trên prod). */
export function tocFromMarkdown(markdown: string): TocItem[] {
  return markdownH2s(markdown).map((heading, i) => ({
    id: heading.id,
    label: heading.label,
    index: String(i + 1).padStart(2, '0'),
  }));
}
