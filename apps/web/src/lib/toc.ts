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

/** Mục lục từ markdown: chỉ H2 (`## `) — cùng cấp với section cũ; heading
    trong code fence không phải heading. Id PHẢI khớp id mà ArticleMarkdown
    gắn cho <h2> (cùng slugify) — lệch là TOC trỏ vào không khí. */
export function tocFromMarkdown(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^##\s+(.+)$/.exec(line);
    if (match?.[1]) {
      items.push({
        id: slugify(match[1]),
        label: match[1].trim(),
        index: String(items.length + 1).padStart(2, '0'),
      });
    }
  }
  return items;
}
