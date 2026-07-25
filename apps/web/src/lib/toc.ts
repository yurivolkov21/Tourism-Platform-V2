import type { LegalDoc } from '@tourism/i18n';
// Import KHÔNG đuôi: Turbopack không map './slug.js' sang './slug.ts' (Vitest
// thì có — nên test xanh mà dev server vẫn đỏ). Trong mocks/ đuôi .js vô hại
// vì ở đó toàn `import type`, bị xoá lúc biên dịch nên chẳng ai phải resolve.
import { slugify } from './slug';

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
