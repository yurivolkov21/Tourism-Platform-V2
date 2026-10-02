import {
  type AdminPostCreateInput,
  type AdminPostCreateResult,
  POST_SLUG_MAX,
  POST_TITLE_MAX,
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

export type CreatePostContractCode = keyof typeof t.create.errors;
export const CREATE_POST_CONTRACT_CODES = createCodec.codes;
export const classifyCreatePostError = createCodec.classify;
export const createPostErrorCopy = createCodec.copy;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type CreatePostResult =
  | { ok: true; created: AdminPostCreateResult }
  | { ok: false; code: CreatePostContractCode | TransportFailureCode };

export type CreatePostAction = (input: AdminPostCreateInput) => Promise<CreatePostResult>;

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
