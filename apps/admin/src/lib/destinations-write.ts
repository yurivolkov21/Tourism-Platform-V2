import {
  type AdminDestinationCreateInput,
  type AdminDestinationRow,
  type AdminDestinationSetActiveInput,
  type AdminDestinationUpdateInput,
  DESTINATION_COUNTRY_MAX,
  DESTINATION_DESCRIPTION_MAX,
  DESTINATION_NAME_MAX,
  DESTINATION_SLUG_MAX,
  RegionNameSchema,
  SLUG_PATTERN,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import type { DestinationRowVM } from './destinations-view';

/**
 * Logic THUẦN của ba hành vi ghi vùng điểm đến (spec P4e-2 F15) — cùng khuôn
 * `categories-write.ts`: codec lỗi derive từ khối i18n, hợp đồng vận chuyển
 * của server action, validate form để component không tự chế luật, và copy
 * của hộp ẩn/hiện.
 */

const t = messages.admin.destinations;

/**
 * Mã TRẠNG-THÁI-CŨ: thế giới đã đổi dưới chân dialog, nên UI đóng lại + toast
 * + refresh. `SLUG_TAKEN` KHÔNG nằm trong tập này — nó nói về thứ đang nằm
 * trong ô nhập, sửa tại chỗ là xong.
 */
const createCodec = createWriteErrorCodec(t.create.errors, { stale: [] });
const updateCodec = createWriteErrorCodec(t.edit.errors, { stale: ['NOT_FOUND'] });
const setActiveCodec = createWriteErrorCodec(t.setActive.errors, { stale: ['NOT_FOUND'] });

export const CREATE_CONTRACT_CODES = createCodec.codes;
export const UPDATE_CONTRACT_CODES = updateCodec.codes;
export const SET_ACTIVE_CONTRACT_CODES = setActiveCodec.codes;

export type CreateContractCode = keyof typeof t.create.errors;
export type UpdateContractCode = keyof typeof t.edit.errors;
export type SetActiveContractCode = keyof typeof t.setActive.errors;

export const classifyCreateError = createCodec.classify;
export const createErrorCopy = createCodec.copy;
export const isCreateStale = createCodec.isStale;

export const classifyUpdateError = updateCodec.classify;
export const updateErrorCopy = updateCodec.copy;
export const isUpdateStale = updateCodec.isStale;

export const classifySetActiveError = setActiveCodec.classify;
export const setActiveErrorCopy = setActiveCodec.copy;
export const isSetActiveStale = setActiveCodec.isStale;

/** Kết quả một lệnh ghi. Nhánh thành công chở NGUYÊN hàng server vừa ghi. */
export type DestinationWriteResult<Code extends string> =
  | { ok: true; row: AdminDestinationRow }
  | { ok: false; code: Code | TransportFailureCode };

export type CreateDestinationAction = (
  input: AdminDestinationCreateInput,
) => Promise<DestinationWriteResult<CreateContractCode>>;

export type UpdateDestinationAction = (
  input: AdminDestinationUpdateInput,
) => Promise<DestinationWriteResult<UpdateContractCode>>;

export type SetDestinationActiveAction = (
  input: AdminDestinationSetActiveInput,
) => Promise<DestinationWriteResult<SetActiveContractCode>>;

// ── Form tạo/sửa ────────────────────────────────────────────────────────────

/**
 * Năm ô của form, thô như người gõ. Form SỬA không dùng `slug`. `region` là giá
 * trị của ô chọn: một trong ba tên vùng, hoặc chuỗi rỗng khi chưa chọn.
 */
export interface DestinationFormValues {
  name: string;
  slug: string;
  country: string;
  region: string;
  description: string;
}

export interface DestinationFormErrors {
  name?: string;
  slug?: string;
  country?: string;
  region?: string;
  description?: string;
}

/**
 * Soi gương luật server để lỗi đọc-thấy-ngay không phải đi một vòng mạng.
 * Khuôn slug và cổng vùng là CHÍNH hằng của contract, không chép tay (bài học
 * 6 và 8 của plan P4e-2).
 *
 * `mode` quyết định có xét ô slug hay không: form SỬA không có ô ấy.
 */
export function validateDestinationForm(
  values: DestinationFormValues,
  mode: 'create' | 'edit',
): DestinationFormErrors {
  const errors: DestinationFormErrors = {};
  const e = t.form.errors;

  const name = values.name.trim();
  if (name === '') errors.name = e.nameRequired;
  else if (name.length > DESTINATION_NAME_MAX) errors.name = e.tooLong(DESTINATION_NAME_MAX);

  if (mode === 'create') {
    const slug = values.slug.trim();
    if (slug === '') errors.slug = e.slugRequired;
    else if (!SLUG_PATTERN.test(slug)) errors.slug = e.slugShape;
    else if (slug.length > DESTINATION_SLUG_MAX) errors.slug = e.tooLong(DESTINATION_SLUG_MAX);
  }

  const country = values.country.trim();
  if (country === '') errors.country = e.countryRequired;
  else if (country.length > DESTINATION_COUNTRY_MAX) {
    errors.country = e.tooLong(DESTINATION_COUNTRY_MAX);
  }

  // Cổng GHI của contract: chỉ ba tên vùng. Ô chọn chỉ có ba mục, nhưng chuỗi
  // rỗng (chưa chọn) vẫn phải bị bắt tại đây.
  if (!RegionNameSchema.safeParse(values.region).success) errors.region = e.regionRequired;

  if (values.description.trim().length > DESTINATION_DESCRIPTION_MAX) {
    errors.description = e.tooLong(DESTINATION_DESCRIPTION_MAX);
  }

  return errors;
}

/** Mô tả trống thành `null` — cột nullable, "chưa viết" khác "chuỗi rỗng". */
function descriptionOrNull(value: string): string | null {
  const description = value.trim();
  return description === '' ? null : description;
}

/**
 * Năm ô thô → hình dạng contract của `create`. Gọi SAU khi validate đã sạch.
 *
 * `region` đi qua `RegionNameSchema.parse` thay vì ép kiểu: gọi hàm này với một
 * ô vùng chưa chọn là lỗi lập trình, và nó phải ném ngay chứ không gửi đi một
 * giá trị mà server chắc chắn từ chối.
 */
export function destinationCreatePayload(
  values: DestinationFormValues,
): AdminDestinationCreateInput {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    country: values.country.trim(),
    region: RegionNameSchema.parse(values.region),
    description: descriptionOrNull(values.description),
  };
}

/** Năm ô thô → hình dạng contract của `update`. KHÔNG mang `slug`. */
export function destinationUpdatePayload(
  id: string,
  values: DestinationFormValues,
): AdminDestinationUpdateInput {
  return {
    id,
    name: values.name.trim(),
    country: values.country.trim(),
    region: RegionNameSchema.parse(values.region),
    description: descriptionOrNull(values.description),
  };
}

/**
 * Giá trị đầu của form sửa: vùng chọn sẵn là tên CHUẨN mà web đang xếp hàng
 * này vào (qua `findRegion`), hoặc rỗng khi chuỗi trong DB không khớp vùng nào
 * — admin phải chọn lại, và lưu xong là cột mang đúng một trong ba tên.
 */
export function destinationEditValues(row: DestinationRowVM): DestinationFormValues {
  return {
    name: row.name,
    // Chở theo cho đủ hình dạng; form sửa không render ô này.
    slug: row.slug,
    country: row.country,
    region: row.regionName ?? '',
    description: row.descriptionValue,
  };
}

// ── Dialog ẩn/hiện ──────────────────────────────────────────────────────────

/** Copy của `ConfirmWriteDialog` cho một trong hai chiều ẩn/hiện. */
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
 * Những hệ quả KHÔNG hiển nhiên của việc ẩn — lấy từ bảng đo spec §4.6 (Task 9a
 * B1). Hai câu về trang vùng chỉ có mặt khi điểm đến thật sự nằm trên một
 * trang vùng: chưa có vùng thì nói về một trang không tồn tại là nói sai.
 */
export function hideConsequences(row: { regionName: string | null }): string[] {
  const d = t.setActive.dialog;
  const region = row.regionName;
  return [
    ...(region ? [d.hideRegionTours(region), d.hideRegionOwnTours(region)] : []),
    d.hidePassport,
    d.hideJournal,
  ];
}

/**
 * Ngữ cảnh hàng trong dialog: điểm đến nào, ở vùng nào, bao nhiêu tour đã đăng
 * đang gắn nó — con số ấy trả lời "ẩn cái này thì bao nhiêu tour vẫn bày ra mà
 * mất một điểm dừng trên trang vùng?".
 */
export function setActiveConfirmRows(row: {
  name: string;
  regionLabel: string;
  tourCount: number;
}): Array<{ label: string; value: string }> {
  return [
    { label: t.setActive.rows.destination, value: row.name },
    { label: t.setActive.rows.region, value: row.regionLabel },
    { label: t.setActive.rows.tours, value: String(row.tourCount) },
  ];
}

/** Toast của nhánh thành công — hai giọng, đọc trạng thái TỪ RESPONSE. */
export function setActiveToast(row: AdminDestinationRow) {
  const toast = t.setActive.toast;
  return row.isActive
    ? { title: toast.shownTitle, description: toast.shownBody(row.name) }
    : { title: toast.hiddenTitle, description: toast.hiddenBody(row.name) };
}
