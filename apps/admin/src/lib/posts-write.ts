import {
  type AdminPostCreateInput,
  type AdminPostCreateResult,
  type AdminPostDeleteInput,
  type AdminPostDeleteResult,
  type AdminPostDetail,
  type AdminPostSignCoverUploadInput,
  type AdminPostUpdateInput,
  POST_SLUG_MAX,
  POST_TITLE_MAX,
  type SignedUploadParams,
  SLUG_PATTERN,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Lớp ghi của vùng bài viết (spec P4e-4) — codec lỗi, hợp đồng vận chuyển của server
 * action, form hộp New post. THUẦN để test được; server action chỉ re-parse và gọi.
 */
const t = messages.admin.posts;
const fe = t.editor.form.errors;

// ── Codec ───────────────────────────────────────────────────────────────────

const createCodec = createWriteErrorCodec(t.create.errors);
const updateCodec = createWriteErrorCodec(t.editor.errors);

export type CreatePostContractCode = keyof typeof t.create.errors;
export const CREATE_POST_CONTRACT_CODES = createCodec.codes;
export const classifyCreatePostError = createCodec.classify;
export const createPostErrorCopy = createCodec.copy;

export type UpdatePostContractCode = keyof typeof t.editor.errors;
export const UPDATE_POST_CONTRACT_CODES = updateCodec.codes;
export const classifyUpdatePostError = updateCodec.classify;
export const updatePostErrorCopy = updateCodec.copy;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type CreatePostResult =
  | { ok: true; created: AdminPostCreateResult }
  | { ok: false; code: CreatePostContractCode | TransportFailureCode };

export type CreatePostAction = (input: AdminPostCreateInput) => Promise<CreatePostResult>;

/** Lệnh lưu trả NGUYÊN bài server vừa ghi — form lấy phiên bản mới từ đây. */
export type UpdatePostResult =
  | { ok: true; detail: AdminPostDetail }
  | { ok: false; code: UpdatePostContractCode | TransportFailureCode };

export type UpdatePostAction = (input: AdminPostUpdateInput) => Promise<UpdatePostResult>;

// ── Hộp New post ────────────────────────────────────────────────────────────

export interface PostCreateFormValues {
  title: string;
  slug: string;
}

export interface PostCreateFormErrors {
  title?: string;
  slug?: string;
}

/** Kiểm bằng CHÍNH các trần của contract — form không cho qua thứ server sẽ trả 400. */
export function validatePostCreateForm(values: PostCreateFormValues): PostCreateFormErrors {
  const errors: PostCreateFormErrors = {};
  const title = values.title.trim();
  if (title === '') errors.title = fe.required;
  else if (title.length > POST_TITLE_MAX) errors.title = fe.tooLong(POST_TITLE_MAX);

  const slug = values.slug.trim();
  if (slug === '') errors.slug = fe.required;
  else if (slug.length > POST_SLUG_MAX) errors.slug = fe.tooLong(POST_SLUG_MAX);
  else if (!SLUG_PATTERN.test(slug)) errors.slug = fe.slugShape;
  return errors;
}

export function postCreatePayload(values: PostCreateFormValues): AdminPostCreateInput {
  return { title: values.title.trim(), slug: values.slug.trim() };
}

/**
 * Ký là lệnh chưa đụng gì: kết cục không rõ ở đây không có gì để "lỡ đi qua", nên câu
 * GENERIC là câu riêng thay vì giọng ghi chung — khuôn `signCodec` của tab Photos.
 */
const signCodec = createWriteErrorCodec(t.editor.signErrors, {
  transportCopy: { GENERIC: t.editor.signFailed },
});

export type SignCoverContractCode = keyof typeof t.editor.signErrors;
export const SIGN_COVER_CONTRACT_CODES = signCodec.codes;
export const classifySignCoverError = signCodec.classify;
export const signCoverErrorCopy = signCodec.copy;

export type SignCoverResult =
  | { ok: true; params: SignedUploadParams }
  | { ok: false; code: SignCoverContractCode | TransportFailureCode };

export type SignCoverAction = (input: AdminPostSignCoverUploadInput) => Promise<SignCoverResult>;

/**
 * Xoá đi qua `ConfirmWriteDialog`: cả hai mã là trạng-thái-cũ — thế giới đã đổi dưới chân
 * hộp (người khác vừa lưu, hay vừa xoá). Kit đóng hộp, toast, rồi để vùng xoá quyết refresh
 * hay về danh sách.
 */
const deleteCodec = createWriteErrorCodec(t.delete.errors, { stale: ['STALE_POST', 'NOT_FOUND'] });

export type DeletePostContractCode = keyof typeof t.delete.errors;
export const DELETE_POST_CONTRACT_CODES = deleteCodec.codes;
export const classifyDeletePostError = deleteCodec.classify;
export const deletePostErrorCopy = deleteCodec.copy;
export const isDeletePostStale = deleteCodec.isStale;

export type DeletePostResult =
  | { ok: true; deleted: AdminPostDeleteResult }
  | { ok: false; code: DeletePostContractCode | TransportFailureCode };

export type DeletePostAction = (input: AdminPostDeleteInput) => Promise<DeletePostResult>;
