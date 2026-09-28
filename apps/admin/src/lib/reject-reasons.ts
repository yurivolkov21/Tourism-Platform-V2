import { REVIEW_MODERATION_NOTE_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Danh sách lý do bác review (ADR-0031 AMEND 1) — logic THUẦN, có test riêng.
 *
 * Câu chữ sống ở `@tourism/i18n` (câu gửi khách); ở đây là phần HÀNH VI: thứ tự
 * trong danh sách, mục nào bắt buộc chi tiết, cách ghép note gửi server, và phép
 * lọc của ô tìm.
 *
 * Vì sao chọn chứ không gõ: góp ý của giáo viên hướng dẫn (28/09) — lý do gõ tay
 * thì mỗi admin một kiểu, khách đọc những câu không đồng nhất. Câu chuẩn KHOÁ;
 * admin chỉ thêm một câu chi tiết cho điều riêng của từng ca.
 */

const copy = messages.admin.reviews.moderate.rejectReasons;

/** Thứ tự trong danh sách: lỗi hay gặp lên trước, `other` luôn đứng cuối. */
const REJECT_REASON_KEYS = [
  'personalDetails',
  'peopleInPhotos',
  'unrelatedPhotos',
  'offensive',
  'offTopic',
  'advertising',
  'bookingIssue',
  'copied',
  'other',
] as const satisfies readonly (keyof typeof copy)[];

export type RejectReasonKey = (typeof REJECT_REASON_KEYS)[number];

export interface RejectReason {
  key: RejectReasonKey;
  /** Tên admin thấy trong danh sách. */
  label: string;
  /** Câu khách đọc NGUYÊN VĂN — trong email và trên trang booking. */
  text: string;
  /** Bắt buộc có chi tiết: câu chuẩn của mục này không tự nói được gì. */
  detailRequired: boolean;
}

/** Chỉ `other`: câu "can't be published as written" mà không kèm vì sao là câu rỗng. */
const DETAIL_REQUIRED: ReadonlySet<RejectReasonKey> = new Set(['other']);

export const REJECT_REASONS: readonly RejectReason[] = REJECT_REASON_KEYS.map((key) => ({
  key,
  label: copy[key].label,
  text: copy[key].text,
  detailRequired: DETAIL_REQUIRED.has(key),
}));

/**
 * Trần của ô chi tiết — tính theo câu chuẩn DÀI NHẤT chứ không theo câu đang
 * chọn: admin gõ chi tiết rồi đổi sang lý do dài hơn thì note ghép vẫn vừa trần
 * của contract, không cần nhánh báo lỗi độ dài nào. Trừ thêm 1 cho dấu cách nối.
 */
export const REJECT_DETAIL_MAX =
  REVIEW_MODERATION_NOTE_MAX - Math.max(...REJECT_REASONS.map((reason) => reason.text.length)) - 1;

/**
 * Note gửi server: câu chuẩn nguyên văn, rồi chi tiết (nếu có) sau một dấu cách.
 * Vẫn là MỘT chuỗi trong `note` như ADR-0031 §6 — email và trang booking đọc nó
 * như trước, không có cột mã lý do nào.
 */
export function composeRejectNote(reason: RejectReason, detail: string): string {
  const extra = detail.trim();
  return extra ? `${reason.text} ${extra}` : reason.text;
}

/**
 * Lọc danh sách theo ô tìm: khớp cả tên lẫn câu khách đọc, không phân biệt hoa
 * thường. Nhiều từ thì mục phải chứa ĐỦ mọi từ — "photos other" ra đúng mục ảnh
 * có người khác, không phải mọi mục có chữ "other".
 */
export function filterRejectReasons(
  reasons: readonly RejectReason[],
  query: string,
): RejectReason[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...reasons];
  return reasons.filter((reason) => {
    const haystack = `${reason.label} ${reason.text}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** Chỗ còn thiếu của form bác, theo thứ tự admin cần sửa; `null` là đủ để gửi. */
export type RejectFormProblem = 'reason' | 'detail' | null;

export function rejectFormProblem(reason: RejectReason | null, detail: string): RejectFormProblem {
  if (!reason) return 'reason';
  if (reason.detailRequired && !detail.trim()) return 'detail';
  return null;
}
