/**
 * Hàng nút của trình soạn bài (spec P4e-4 §4.4, ADR-0051 §1) — THUẦN: nhận chữ và vùng
 * chọn, trả chữ mới và vùng chọn mới. Component chỉ đọc `selectionStart/End` của ô rồi
 * ghi kết quả lại. Nút chỉ CHÈN cú pháp markdown — không có định dạng ẩn nào ngoài chữ.
 */
export type MarkdownAction = 'heading' | 'bold' | 'italic' | 'bullet' | 'link';

export interface TextSelection {
  start: number;
  end: number;
}

export interface MarkdownEdit {
  text: string;
  selection: TextSelection;
}

const LINE_PREFIX = { heading: '## ', bullet: '- ' } as const;
const WRAP_MARK = { bold: '**', italic: '*' } as const;
const LINK_URL = 'https://';

export function applyMarkdownAction(
  text: string,
  selection: TextSelection,
  action: MarkdownAction,
): MarkdownEdit {
  // Kéo chọn từ phải sang trái cho `start > end` — chuẩn hoá trước.
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  switch (action) {
    case 'bold':
    case 'italic':
      return wrap(text, start, end, WRAP_MARK[action]);
    case 'link':
      return link(text, start, end);
    case 'heading':
    case 'bullet':
      return togglePrefix(text, start, end, LINE_PREFIX[action]);
  }
}

/**
 * Bọc vùng chọn; không chọn gì thì chèn cặp dấu và đặt con trỏ giữa. Vùng chọn mới giữ đúng
 * chữ cũ. Khoảng trắng ở mép đứng NGOÀI cặp dấu: `**pho **` không phải chữ đậm trong
 * CommonMark, mà double-click trên Windows chọn kèm dấu cách phía sau (vòng review P4e-4).
 */
function wrap(text: string, start: number, end: number, mark: string): MarkdownEdit {
  const selected = text.slice(start, end);
  const innerStart = start + (selected.length - selected.trimStart().length);
  // Chọn toàn khoảng trắng thì hai mép gặp nhau — như không chọn gì, sau khoảng trắng.
  const innerEnd = Math.max(innerStart, end - (selected.length - selected.trimEnd().length));
  return {
    text: `${text.slice(0, innerStart)}${mark}${text.slice(innerStart, innerEnd)}${mark}${text.slice(innerEnd)}`,
    selection: { start: innerStart + mark.length, end: innerEnd + mark.length },
  };
}

/** `[chữ](https://)`, chọn sẵn phần URL; không chọn gì thì con trỏ vào trong `[]` để gõ chữ trước. */
function link(text: string, start: number, end: number): MarkdownEdit {
  const label = text.slice(start, end);
  const next = `${text.slice(0, start)}[${label}](${LINK_URL})${text.slice(end)}`;
  if (label === '') return { text: next, selection: { start: start + 1, end: start + 1 } };
  const urlStart = start + label.length + 3;
  return { text: next, selection: { start: urlStart, end: urlStart + LINK_URL.length } };
}

/**
 * Thêm tiền tố cho MỖI dòng chạm vào vùng chọn; mọi dòng (có chữ) đã có rồi thì gỡ — bấm
 * lại là bỏ. Dòng trống bị bỏ qua để chọn ba đoạn không sinh ra gạch đầu dòng rỗng; con trỏ
 * đứng trên một dòng trống thì vẫn thêm cho dòng ấy. Chọn trọn dòng (vùng chọn dừng ngay
 * đầu dòng sau) thì dòng sau không tính. Vùng chọn mới phủ trọn các dòng đã sửa.
 */
function togglePrefix(text: string, start: number, end: number, prefix: string): MarkdownEdit {
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  // `lastIndexOf('\n', -1)` vẫn xét vị trí 0 — chặn riêng ca con trỏ ở đầu văn bản.
  const blockStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', last);
  const blockEnd = nextBreak === -1 ? text.length : nextBreak;

  const lines = text.slice(blockStart, blockEnd).split('\n');
  const filled = lines.filter((line) => line.trim() !== '');
  const remove = (filled.length > 0 ? filled : lines).every((line) => line.startsWith(prefix));
  const edited = lines.map((line) => {
    if (filled.length > 0 && line.trim() === '') return line;
    if (remove) return line.slice(prefix.length);
    return line.startsWith(prefix) ? line : `${prefix}${line}`;
  });
  const block = edited.join('\n');
  return {
    text: `${text.slice(0, blockStart)}${block}${text.slice(blockEnd)}`,
    selection: { start: blockStart, end: blockStart + block.length },
  };
}

/**
 * Đoạn khác nhau giữa chữ cũ và chữ mới: `[start, end)` của chữ cũ được thay bằng `insert`.
 * Hàng nút chèn đúng đoạn này qua `execCommand('insertText')` để trình duyệt ghi vào lịch sử
 * undo — gán cả `value` mới xoá sạch Ctrl+Z (vòng review P4e-4). Phần đuôi chung không được ăn
 * sang phần đầu chung (`aa` → `aaa`).
 */
export function replacedRange(
  before: string,
  after: string,
): { start: number; end: number; insert: string } {
  const shorter = Math.min(before.length, after.length);
  let start = 0;
  while (start < shorter && before[start] === after[start]) start++;
  let tail = 0;
  while (
    tail < shorter - start &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++;
  }
  return {
    start,
    end: before.length - tail,
    insert: after.slice(start, after.length - tail),
  };
}
