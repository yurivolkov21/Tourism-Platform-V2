import {
  type AdminMediaItem,
  type AdminMediaUpdateInput,
  AdminMediaUpdateInputSchema,
  isCcByLicense,
  MEDIA_ALT_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import { creditLine } from './appearance-view';

/**
 * Lớp ghi của Media library (ADR-0060) — codec lỗi, hợp đồng vận chuyển của server action, bản
 * nháp của form trong ngăn chi tiết. THUẦN để test được; server action chỉ re-parse và gọi.
 */
const t = messages.admin.media;

// ── Codec ───────────────────────────────────────────────────────────────────

/**
 * `STALE_MEDIA` (ai đó vừa sửa ảnh ở nơi khác) và `NOT_FOUND` (ảnh không còn chỗ dùng nào) là
 * trạng-thái-cũ: toast rồi tải lại ngăn từ dữ liệu tươi (spec §6.2). `ALT_REQUIRED` ở lại form,
 * thành lỗi của ô alt — gõ alt là sửa được ngay.
 */
const codec = createWriteErrorCodec(t.errors, { stale: ['STALE_MEDIA', 'NOT_FOUND'] });

export type MediaContractCode = keyof typeof t.errors;
export const MEDIA_CONTRACT_CODES = codec.codes;
export const classifyMediaError = codec.classify;
export const mediaErrorCopy = codec.copy;
export const isMediaStale = codec.isStale;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type UpdateMediaResult =
  | { ok: true; item: AdminMediaItem }
  | { ok: false; code: MediaContractCode | TransportFailureCode };

export type UpdateMediaAction = (input: AdminMediaUpdateInput) => Promise<UpdateMediaResult>;

// ── Bản nháp của form ───────────────────────────────────────────────────────

/** Năm ô của form, giữ nguyên chữ người gõ — cắt khoảng trắng và đổi rỗng thành null lúc gửi. */
export interface MediaDraft {
  alt: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

export type MediaField = keyof MediaDraft;

export function mediaDraft(item: AdminMediaItem): MediaDraft {
  return {
    alt: item.alt ?? '',
    author: item.author ?? '',
    license: item.license ?? '',
    licenseUrl: item.licenseUrl ?? '',
    sourceUrl: item.sourceUrl ?? '',
  };
}

const clean = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Lệnh lưu — `version` là phiên bản ngăn đang cầm; server so lại trên các dòng đã khoá. */
export function mediaPayload(item: AdminMediaItem, draft: MediaDraft): AdminMediaUpdateInput {
  return {
    publicId: item.publicId,
    version: item.version,
    alt: clean(draft.alt),
    author: clean(draft.author),
    license: clean(draft.license),
    licenseUrl: clean(draft.licenseUrl),
    sourceUrl: clean(draft.sourceUrl),
  };
}

/**
 * Có gì để lưu: một ô khác giá trị đang hiện (sau khi cắt khoảng trắng), hoặc các chỗ dùng đang
 * lệch nhau — lưu nguyên giá trị đang hiện cũng là làm chúng giống nhau (spec §6.2).
 */
export function canSaveMedia(item: AdminMediaItem, draft: MediaDraft): boolean {
  if (item.altVaries || item.creditVaries) return true;
  const payload = mediaPayload(item, draft);
  return (
    payload.alt !== item.alt ||
    payload.author !== item.author ||
    payload.license !== item.license ||
    payload.licenseUrl !== item.licenseUrl ||
    payload.sourceUrl !== item.sourceUrl
  );
}

/**
 * Lỗi của từng ô trước khi gửi. Hình dạng phán bằng CHÍNH schema contract (link chỉ `http`/`https`,
 * độ dài theo cột), alt bắt buộc theo cờ API trả — API vẫn phán lại trên các dòng đã khoá.
 */
export function draftErrors(
  item: AdminMediaItem,
  draft: MediaDraft,
): Partial<Record<MediaField, string>> {
  const errors: Partial<Record<MediaField, string>> = {};
  const parsed = AdminMediaUpdateInputSchema.safeParse(mediaPayload(item, draft));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'licenseUrl' || field === 'sourceUrl') errors[field] = t.drawer.invalidLink;
      // Ô alt có `maxLength` nên chỉ chữ dán vào mới vượt trần — nói bằng câu đếm ký tự.
      if (field === 'alt') errors.alt = t.drawer.altTooLong(MEDIA_ALT_MAX);
    }
  }
  if (item.altRequired && clean(draft.alt) === null) errors.alt = t.drawer.altMissing;
  return errors;
}

/** Cảnh báo không chặn: họ CC BY đòi cả tác giả lẫn link giấy phép (ADR-0060 §1). */
export function hasCcWarning(draft: MediaDraft): boolean {
  return (
    isCcByLicense(clean(draft.license)) &&
    (clean(draft.author) === null || clean(draft.licenseUrl) === null)
  );
}

/** Các alt đang khác nhau, mỗi giá trị kèm số chỗ dùng — thứ tự lần đầu gặp. */
export function altVariantLines(item: AdminMediaItem): { value: string; uses: string }[] {
  if (!item.altVaries) return [];
  const counts = new Map<string | null, number>();
  for (const usage of item.usages) {
    const alt = clean(usage.alt ?? '');
    counts.set(alt, (counts.get(alt) ?? 0) + 1);
  }
  return [...counts].map(([alt, n]) => ({
    value: alt ?? t.drawer.emptyValue,
    uses: t.drawer.usesCount(n),
  }));
}

/** Các bản ghi công đang khác nhau: "Jane Doe · CC BY-SA 4.0", hay "No credit". */
export function creditVariantLines(item: AdminMediaItem): string[] {
  return item.creditVariants.map(
    (credit) => creditLine(credit.author, credit.license) ?? t.drawer.noCredit,
  );
}

/** Gợi ý cho ô Licence: giấy phép đang có trong thư viện, dùng nhiều trước (spec §6.2). */
export function licenseSuggestions(items: readonly AdminMediaItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.license !== null) counts.set(item.license, (counts.get(item.license) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([license]) => license);
}
