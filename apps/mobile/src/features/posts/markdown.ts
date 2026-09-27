/**
 * Bộ vẽ markdown THUẦN cho `PostDetail.content` (G3/G4, spec P5b-4 §6).
 * Web dùng `react-markdown` (`article-markdown.tsx`) — thư viện đó trả thẻ
 * HTML, KHÔNG dùng lại được ở React Native. Đếm toàn bộ 9 bài seed (21/09):
 * chỉ có `##` (heading), đoạn văn, và `- ` (bullet) — ba kiểu là đủ, chưa cần
 * thư viện markdown nào. Admin CÓ THỂ gõ cú pháp lạ hơn về sau nên
 * `stripInline` phòng thân: không bao giờ in ra ký hiệu thô (`**đậm**`…)
 * giữa bài — cú pháp lạ rơi về đoạn-văn-thường đã lọc ký hiệu.
 */

export type MarkdownBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

/** Bỏ cú pháp inline markdown thường gặp — đậm/nghiêng/link — khỏi MỘT dòng. */
function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}

/** Parse `content` thành khối để vẽ. Dòng trống ngăn đoạn văn/list liền kề. */
export function parseMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const text = stripInline(paragraphLines.join(' '));
    if (text !== '') blocks.push({ type: 'paragraph', text });
    paragraphLines = [];
  }
  function flushList() {
    if (listItems.length === 0) return;
    blocks.push({ type: 'list', items: listItems });
    listItems = [];
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading !== null) {
      flushParagraph();
      flushList();
      const text = stripInline(heading[1] ?? '');
      if (text !== '') blocks.push({ type: 'heading', text });
      continue;
    }
    const bullet = /^-\s+(.*)$/.exec(line);
    if (bullet !== null) {
      flushParagraph();
      const item = stripInline(bullet[1] ?? '');
      if (item !== '') listItems.push(item);
      continue;
    }
    flushList();
    paragraphLines.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
