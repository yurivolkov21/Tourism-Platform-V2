import type {
  AdminCategoryCreateInput,
  AdminCategoryMoveInput,
  AdminCategoryRow,
  AdminCategorySetActiveInput,
  AdminCategoryUpdateInput,
} from '@tourism/contract';
import {
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_NAME_MAX,
  CATEGORY_SLUG_MAX,
  SLUG_PATTERN,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của bốn hành vi ghi vùng danh mục (spec P4e-2 F14) — cùng khuôn
 * `departures-write.ts`: codec lỗi derive từ khối i18n, hợp đồng vận chuyển
 * của server action, và validate form để component không tự chế luật.
 *
 * BỐN codec chứ không một: bốn endpoint có mã trùng tên (`NOT_FOUND`) nhưng
 * câu phải khác nhau — "danh mục biến mất nên không sửa được" và "danh mục
 * biến mất nên không đổi chỗ được" là hai việc khác nhau với người vừa bấm.
 */

const t = messages.admin.categories;

/**
 * Mã TRẠNG-THÁI-CŨ: thế giới đã đổi dưới chân dialog, nên UI đóng lại + toast
 * + refresh thay vì mời bấm lại.
 *
 * `SLUG_TAKEN` KHÔNG nằm trong tập này, có chủ đích: nó nói về thứ đang nằm
 * trong ô nhập, sửa tại chỗ là xong — đóng dialog ở đó là bắt người ta gõ lại
 * cả form.
 */
const createCodec = createWriteErrorCodec(t.create.errors, { stale: [] });
const updateCodec = createWriteErrorCodec(t.edit.errors, { stale: ['NOT_FOUND'] });
const setActiveCodec = createWriteErrorCodec(t.setActive.errors, { stale: ['NOT_FOUND'] });
/**
 * `move` KHÔNG khai mã trạng-thái-cũ nào, khác ba codec trên.
 *
 * Không phải bỏ sót: `runMove` toast rồi làm mới bảng ở MỌI nhánh hỏng, vì
 * hàng đổi chỗ không có dialog nào để mà đóng. Khai một tập `stale` ở đây là
 * dựng một cấu hình không nơi nào đọc — và người thêm mã lỗi sau sẽ tưởng
 * mình vừa đổi hành vi giao diện.
 */
const moveCodec = createWriteErrorCodec(t.move.errors, { stale: [] });

export const CREATE_CONTRACT_CODES = createCodec.codes;
export const UPDATE_CONTRACT_CODES = updateCodec.codes;
export const SET_ACTIVE_CONTRACT_CODES = setActiveCodec.codes;
export const MOVE_CONTRACT_CODES = moveCodec.codes;

export type CreateContractCode = keyof typeof t.create.errors;
export type UpdateContractCode = keyof typeof t.edit.errors;
export type SetActiveContractCode = keyof typeof t.setActive.errors;
export type MoveContractCode = keyof typeof t.move.errors;

export const classifyCreateError = createCodec.classify;
export const createErrorCopy = createCodec.copy;
export const isCreateStale = createCodec.isStale;

export const classifyUpdateError = updateCodec.classify;
export const updateErrorCopy = updateCodec.copy;
export const isUpdateStale = updateCodec.isStale;

export const classifySetActiveError = setActiveCodec.classify;
export const setActiveErrorCopy = setActiveCodec.copy;
export const isSetActiveStale = setActiveCodec.isStale;

export const classifyMoveError = moveCodec.classify;
export const moveErrorCopy = moveCodec.copy;

/**
 * Kết quả một lệnh ghi. Nhánh thành công chở NGUYÊN hàng server vừa ghi (hoặc
 * cả danh sách với `move`), nên toast kể lại chuyện thật thay vì lặp lại input.
 */
export type CategoryWriteResult<Code extends string> =
  | { ok: true; row: AdminCategoryRow }
  | { ok: false; code: Code | TransportFailureCode };

export type CategoryListResult<Code extends string> =
  | { ok: true; rows: AdminCategoryRow[] }
  | { ok: false; code: Code | TransportFailureCode };

export type CreateCategoryAction = (
  input: AdminCategoryCreateInput,
) => Promise<CategoryWriteResult<CreateContractCode>>;

export type UpdateCategoryAction = (
  input: AdminCategoryUpdateInput,
) => Promise<CategoryWriteResult<UpdateContractCode>>;

export type SetCategoryActiveAction = (
  input: AdminCategorySetActiveInput,
) => Promise<CategoryWriteResult<SetActiveContractCode>>;

/** `move` trả CẢ danh sách: một lượt đổi chỗ động tới hai hàng. */
export type MoveCategoryAction = (
  input: AdminCategoryMoveInput,
) => Promise<CategoryListResult<MoveContractCode>>;

// ── Form tạo/sửa ────────────────────────────────────────────────────────────

/** Ba ô của form, thô như người gõ. Form SỬA không dùng `slug`. */
export interface CategoryFormValues {
  name: string;
  slug: string;
  description: string;
}

export interface CategoryFormErrors {
  name?: string;
  slug?: string;
  description?: string;
}

/**
 * Khuôn slug lấy TỪ contract, không chép tay.
 *
 * Bản đầu viết lại `/^[a-z0-9-]+$/` ở đây với chú thích "soi gương" — nhưng
 * gương làm bằng cách gõ lại thì chỉ đúng tới lúc ai đó sửa một bên. Hai hằng
 * `MAX` ngay trên đã import từ contract vì đúng lý do ấy; regex là chỗ duy
 * nhất bị bỏ quên (vòng review F14). Từ F15 khuôn ấy là `SLUG_PATTERN` dùng
 * chung cho cả điểm đến.
 */
const SLUG_SHAPE = SLUG_PATTERN;

/**
 * Soi gương luật server để lỗi đọc-thấy-ngay không phải đi một vòng mạng.
 *
 * `mode` quyết định có xét ô slug hay không: form SỬA không có ô ấy, nên bắt nó
 * hợp lệ là bắt một ô không tồn tại.
 */
export function validateCategoryForm(
  values: CategoryFormValues,
  mode: 'create' | 'edit',
): CategoryFormErrors {
  const errors: CategoryFormErrors = {};
  const e = t.form.errors;

  if (values.name.trim() === '') errors.name = e.nameRequired;
  else if (values.name.trim().length > CATEGORY_NAME_MAX) {
    errors.name = e.tooLong(CATEGORY_NAME_MAX);
  }

  if (mode === 'create') {
    const slug = values.slug.trim();
    if (slug === '') errors.slug = e.slugRequired;
    else if (!SLUG_SHAPE.test(slug)) errors.slug = e.slugShape;
    else if (slug.length > CATEGORY_SLUG_MAX) errors.slug = e.tooLong(CATEGORY_SLUG_MAX);
  }

  if (values.description.trim().length > CATEGORY_DESCRIPTION_MAX) {
    errors.description = e.tooLong(CATEGORY_DESCRIPTION_MAX);
  }

  return errors;
}

/** Form có ô nào hỏng không — một chỗ hỏi, để không nơi nào tự đếm keys. */
export function hasFormErrors(errors: CategoryFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Ba ô thô → hình dạng contract của `create`. Gọi SAU khi validate đã sạch.
 *
 * Mô tả trống thành `null` chứ không thành chuỗi rỗng: cột nullable, và "chưa
 * viết mô tả" khác "mô tả là một chuỗi rỗng".
 */
export function categoryCreatePayload(values: CategoryFormValues): AdminCategoryCreateInput {
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: description === '' ? null : description,
  };
}

/** Ba ô thô → hình dạng contract của `update`. KHÔNG mang `slug`. */
export function categoryUpdatePayload(
  id: string,
  values: CategoryFormValues,
): AdminCategoryUpdateInput {
  const description = values.description.trim();
  return { id, name: values.name.trim(), description: description === '' ? null : description };
}

// ── Dialog bật/tắt ──────────────────────────────────────────────────────────

/** Copy của `ConfirmWriteDialog` cho một trong hai chiều bật/tắt. */
export function setActiveDialogCopy(next: boolean) {
  const d = t.setActive.dialog;
  return next
    ? {
        title: d.showTitle,
        body: d.showBody,
        warning: d.showWarning,
        submit: d.showSubmit,
        submitting: d.showSubmitting,
        cancel: t.form.cancel,
      }
    : {
        title: d.hideTitle,
        body: d.hideBody,
        warning: d.hideWarning,
        submit: d.hideSubmit,
        submitting: d.hideSubmitting,
        cancel: t.form.cancel,
      };
}

/**
 * Ngữ cảnh hàng trong dialog: danh mục nào, bao nhiêu tour đã đăng.
 *
 * Số tour là con số quyết định ở đây — nó trả lời "ẩn cái này thì bao nhiêu
 * tour vẫn đang bày ra đó?", mà câu cảnh báo bên dưới nói chúng KHÔNG bị ẩn theo.
 */
export function setActiveConfirmRows(row: {
  name: string;
  tourCount: number;
}): Array<{ label: string; value: string }> {
  return [
    { label: t.setActive.rows.category, value: row.name },
    { label: t.setActive.rows.tours, value: String(row.tourCount) },
  ];
}

/** Toast của nhánh thành công — hai giọng, đọc trạng thái TỪ RESPONSE. */
export function setActiveToast(row: AdminCategoryRow) {
  const toast = t.setActive.toast;
  return row.isActive
    ? { title: toast.shownTitle, description: toast.shownBody(row.name) }
    : { title: toast.hiddenTitle, description: toast.hiddenBody(row.name) };
}
