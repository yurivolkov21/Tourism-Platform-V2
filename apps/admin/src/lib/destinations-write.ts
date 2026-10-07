import {
  type AdminDestinationCreateInput,
  type AdminDestinationDeleteInput,
  type AdminDestinationDeleteResult,
  type AdminDestinationRow,
  type AdminDestinationSetActiveInput,
  type AdminDestinationUpdateInput,
  DESTINATION_COUNTRY_MAX,
  DESTINATION_DEFAULT_COUNTRY,
  DESTINATION_DESCRIPTION_MAX,
  DESTINATION_NAME_MAX,
  DESTINATION_SLUG_MAX,
  findRegion,
  REGIONS,
  type RegionKey,
  RegionNameSchema,
  SLUG_PATTERN,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import type { DestinationRowVM } from './destinations-view';

/**
 * Logic THUẦN của bốn hành vi ghi vùng điểm đến (spec P4e-2 F15, lệnh xoá theo
 * ADR-0053) — cùng khuôn `categories-write.ts`: codec lỗi derive từ khối i18n,
 * hợp đồng vận chuyển của server action, validate form để component không tự
 * chế luật, và copy của hộp ẩn/hiện và hộp xoá.
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
/**
 * Giá trị đầu của hộp Add — quốc gia điền sẵn theo contract, mọi ô khác trống.
 * Bảng dùng CHÍNH hàm này, nên spec canh được giá trị thật mà admin thấy (vòng
 * review F15: spec của hộp thoại từng tự cấp "Vietnam" qua fixture).
 */
export function newDestinationFormValues(): DestinationFormValues {
  return {
    name: '',
    slug: '',
    country: DESTINATION_DEFAULT_COUNTRY,
    region: '',
    description: '',
  };
}

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

/**
 * Copy của `ConfirmWriteDialog` cho một trong hai chiều ẩn/hiện. Thân hộp ẩn
 * đổi theo vùng: điểm đến chưa có vùng không nằm trên trang vùng nào, nên câu
 * không được nói nó "rời các trang điểm đến" (vòng review F15).
 */
export function setActiveDialogCopy(next: boolean, row: { regionKey: RegionKey | null }) {
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
        body: row.regionKey ? d.hideBody : d.hideBodyNoRegion,
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
export function hideConsequences(row: {
  regionName: string | null;
  regionKey: RegionKey | null;
}): string[] {
  const d = t.setActive.dialog;
  const { regionName, regionKey } = row;
  return [
    ...(regionName && regionKey
      ? [d.hideRegionTours(regionName), d.hideRegionOwnTours[regionKey](regionName)]
      : []),
    d.hideCounts,
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

/**
 * Toast của nhánh thành công — hai giọng, đọc trạng thái TỪ RESPONSE, kể cả vùng:
 * điểm đến không khớp vùng nào thì không nhắc "destination pages".
 */
export function setActiveToast(row: AdminDestinationRow) {
  const toast = t.setActive.toast;
  const onRegionPage = findRegion(REGIONS, row.region) !== undefined;
  return row.isActive
    ? { title: toast.shownTitle, description: toast.shownBody(row.name, onRegionPage) }
    : { title: toast.hiddenTitle, description: toast.hiddenBody(row.name, onRegionPage) };
}

// ── Lệnh xoá (ADR-0053) ─────────────────────────────────────────────────────

/**
 * `IN_USE` là "trạng thái cũ" như `NOT_FOUND`: bảng nói hàng 0 tour mà DB đã có tour gắn
 * vào. Đóng hộp và làm mới bảng — sau lượt làm mới, nút Delete khoá kèm tooltip, đúng chỗ
 * admin cần nhìn (plan 2026-10-05, quyết định 3).
 */
const deleteCodec = createWriteErrorCodec(t.delete.errors, { stale: ['IN_USE', 'NOT_FOUND'] });

export const DELETE_CONTRACT_CODES = deleteCodec.codes;
export type DeleteContractCode = keyof typeof t.delete.errors;
export const classifyDeleteError = deleteCodec.classify;
export const isDeleteStale = deleteCodec.isStale;

/**
 * Câu cho mã lỗi của lệnh xoá ở MỘT hàng: câu của codec, trừ `IN_USE` ở hàng đã ẩn — câu ấy bỏ vế
 * "Hide it instead" vì nút bật tắt của hàng đang là Show (Ruling F-b). `errors` của i18n là tập mã
 * contract, mỗi mã một câu, nên câu theo trạng thái hàng rẽ ở đây.
 */
export function deleteErrorCopy(
  code: DeleteContractCode | TransportFailureCode,
  row: { isActive: boolean },
): string {
  return code === 'IN_USE' && !row.isActive ? t.delete.inUseRaceHidden : deleteCodec.copy(code);
}

export type DestinationDeleteResult =
  | { ok: true; deleted: AdminDestinationDeleteResult }
  | { ok: false; code: DeleteContractCode | TransportFailureCode };

export type DeleteDestinationAction = (
  input: AdminDestinationDeleteInput,
) => Promise<DestinationDeleteResult>;

/**
 * Lý do nút Delete khoá; `null` là xoá được (ADR-0053 §5).
 *
 * Chỉ mở khi đếm ĐÚNG bằng 0. Hàng không mang số tour — admin mới gọi API cũ trong khe giữa hai
 * lần deploy — thì khoá với lý do chung (review E2): mở kiểu "không lớn hơn 0" từng bật nút ở mọi
 * hàng và để hộp khẳng định "No tour goes to…" cho cả hàng đang có tour.
 *
 * Còn tour thì hàng đang hiện được gợi ý ẩn; hàng đã ẩn chỉ nghe số tour, vì nút bật tắt của nó
 * đang là Show (Ruling F-b).
 */
export function deleteBlockedReason(row: {
  linkedTourCount: number;
  isActive: boolean;
}): string | null {
  const count = row.linkedTourCount;
  if (count === 0) return null;
  if (count > 0) return row.isActive ? t.delete.inUse(count) : t.delete.inUseHidden(count);
  return t.delete.unavailable;
}

export function deleteDialogCopy() {
  const d = t.delete.dialog;
  return {
    title: d.title,
    body: d.body,
    warning: d.warning,
    submit: d.submit,
    submitting: d.submitting,
    cancel: t.form.cancel,
  };
}

export function deleteConfirmRows(row: {
  name: string;
  regionLabel: string;
  slug: string;
}): Array<{ label: string; value: string }> {
  return [
    { label: t.delete.rows.destination, value: row.name },
    { label: t.delete.rows.region, value: row.regionLabel },
    { label: t.delete.rows.slug, value: row.slug },
  ];
}

export function deleteToast(name: string) {
  return { title: t.delete.toast.title, description: t.delete.toast.body(name) };
}
