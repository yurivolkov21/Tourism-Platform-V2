import { slugify } from '@tourism/ui/lib/slug';

/**
 * Bóc inline markdown (bold/italic/code/link/ảnh) khỏi text raw của một heading, trả text
 * thuần để làm nhãn và slugify. Chuyển từ `apps/web/src/lib/toc.ts` (L8-20, review F3) để
 * mục lục của web và id heading của `ArticleMarkdown` cùng đọc MỘT hàm.
 */
export function headingPlainText(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // ![alt](url) -> alt — ảnh đóng góp alt text (TRƯỚC regex link thường, vì link thường khớp luôn phần sau dấu !)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/`([^`]+)`/g, '$1') // `code` -> code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold (trước italic vì ** chứa *)
    .replace(/__([^_]+)__/g, '$1') // __bold__ -> bold
    .replace(/\*([^*]+)\*/g, '$1') // *italic* -> italic
    .replace(/_([^_]+)_/g, '$1') // _italic_ -> italic
    .trim();
}

/** Một H2 của bài: `line` đếm từ 1, khớp `position.start.line` mà react-markdown gắn vào node. */
export interface MarkdownH2 {
  line: number;
  label: string;
  id: string;
}

/**
 * Mọi H2 (`## `) của một bài markdown theo thứ tự, bỏ qua heading nằm trong code fence.
 *
 * Id là slug của text thuần, và DUY NHẤT trong bài: heading trùng chữ lần sau mang hậu tố
 * `-2`, `-3`… (bỏ qua hậu tố đã có chủ). Trước L8-20 hai H2 cùng chữ ra cùng một id, nên
 * HTML có id trùng và mục thứ hai của "On this page" nhảy về section đầu.
 *
 * Mục lục của web (`tocFromMarkdown`) và id gắn trên `<h2>` của `ArticleMarkdown` cùng lấy
 * từ đây, nên hai phía không thể lệch nhau.
 */
export function markdownH2s(markdown: string): MarkdownH2[] {
  const headings: MarkdownH2[] = [];
  const used = new Set<string>();
  let inFence = false;
  // `\r?\n`: nội dung CRLF (sửa thẳng trong DB trên Windows) vẫn tách đúng dòng, và
  // remark cũng đếm `\r\n` là MỘT lần xuống dòng nên số dòng vẫn khớp.
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^##\s+(.+)$/.exec(line);
    if (!match?.[1]) continue;
    const label = headingPlainText(match[1]);
    const base = slugify(label);
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    headings.push({ line: index + 1, label, id });
  }
  return headings;
}
