import type { EnquiryDetail, EnquiryStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import { enquiryStatusLabel } from './enquiries-view';

/**
 * Logic THUẦN của HAI hành vi ghi vùng enquiries (spec P4c §3-F9) — cùng
 * khuôn `outbox-retry.ts`: codec lỗi derive từ khối i18n, luật trạng-thái-cũ,
 * hợp đồng vận chuyển của server action, và copy dialog dựng sẵn để component
 * không tự ghép chuỗi.
 *
 * HAI codec chứ không một: `setStatus` và `addNote` tình cờ có cùng MỘT mã
 * contract (`NOT_FOUND`), nhưng hai câu phải khác nhau — "mất lead nên trạng
 * thái không đổi" và "mất lead nên note không lưu" là hai việc khác nhau đối
 * với người vừa gõ xong một đoạn — và endpoint nào thêm mã riêng về sau thì
 * đã có sẵn chỗ đứng.
 */

const t = messages.admin.enquiries;

/**
 * `NOT_FOUND` là trạng-thái-cũ ở CẢ HAI lệnh: lead đã biến mất dưới chân
 * dialog/ô nhập, nên UI đóng lại + toast + refresh chứ không mời bấm lại
 * (bấm lại vào một id không còn thì lần nào cũng hỏng như nhau).
 */
const setStatusCodec = createWriteErrorCodec(t.setStatus.errors, { stale: ['NOT_FOUND'] });
const addNoteCodec = createWriteErrorCodec(t.addNote.errors, { stale: ['NOT_FOUND'] });

export const SET_STATUS_CONTRACT_CODES = setStatusCodec.codes;
export const ADD_NOTE_CONTRACT_CODES = addNoteCodec.codes;

export type SetStatusContractCode = keyof typeof t.setStatus.errors;
export type SetStatusFailureCode = SetStatusContractCode | TransportFailureCode;
export type AddNoteContractCode = keyof typeof t.addNote.errors;
export type AddNoteFailureCode = AddNoteContractCode | TransportFailureCode;

export const classifySetStatusError = setStatusCodec.classify;
export const setStatusErrorCopy = setStatusCodec.copy;
export const isSetStatusStale = setStatusCodec.isStale;

export const classifyAddNoteError = addNoteCodec.classify;
export const addNoteErrorCopy = addNoteCodec.copy;
export const isAddNoteStale = addNoteCodec.isStale;

/**
 * Kết quả server action đổi trạng thái — hợp đồng vận chuyển giữa `actions.ts`
 * (server) và dialog (client), sống ở lib để tầng server không import tầng
 * trình bày. Nhánh thành công trả trạng thái ĐỌC TỪ RESPONSE (không phải từ
 * input đã gửi) để toast kể đúng chuyện server vừa làm.
 */
export type SetStatusActionResult =
  | { ok: true; name: string; status: EnquiryStatusValue }
  | { ok: false; code: SetStatusFailureCode };

export type SetStatusAction = (input: {
  id: string;
  status: EnquiryStatusValue;
}) => Promise<SetStatusActionResult>;

/** Kết quả server action thêm note. Không có gì để kể lại ngoài "đã vào thread". */
export type AddNoteActionResult = { ok: true } | { ok: false; code: AddNoteFailureCode };

export type AddNoteAction = (input: { id: string; body: string }) => Promise<AddNoteActionResult>;

/** Detail → trạng thái/tên mà nhánh thành công của action cần kể lại. */
export function setStatusSuccess(detail: EnquiryDetail): SetStatusActionResult {
  return { ok: true, name: detail.name, status: detail.status };
}

/**
 * Copy của dialog xác nhận đổi trạng thái — KHÔNG có ô note (kit
 * `ConfirmWriteDialog` bỏ ô khi không truyền `noteId`): audit trail đã ghi
 * ai/lúc nào/từ đâu tới đâu, còn lời giải thích thì thuộc về thread note ngay
 * bên dưới — hai ô ghi chú trên cùng một trang là hai chỗ người sau phải đọc.
 */
export function setStatusDialogCopy() {
  return {
    title: t.setStatus.dialog.title,
    body: t.setStatus.dialog.body,
    warning: t.setStatus.dialog.warning,
    submit: t.setStatus.dialog.submit,
    submitting: t.setStatus.dialog.submitting,
    cancel: t.setStatus.cancel,
  };
}

/** Lead + hai đầu của bước chuyển — đủ để dialog nêu rõ `from → to`. */
export interface SetStatusTarget {
  name: string;
  from: EnquiryStatusValue;
  to: EnquiryStatusValue;
}

/**
 * Dòng ngữ cảnh của dialog. Chuyển trạng thái là TỰ DO giữa năm giá trị —
 * không luật máy nào chặn một cú bấm nhầm — nên ba dòng này (lead nào, từ
 * đâu, tới đâu) là lớp bảo vệ duy nhất, và phải đọc bằng NHÃN chứ không phải
 * giá trị enum thô.
 */
export function setStatusConfirmRows(target: SetStatusTarget): Array<{
  label: string;
  value: string;
}> {
  return [
    { label: t.setStatus.lead, value: target.name },
    { label: t.setStatus.from, value: enquiryStatusLabel(target.from) },
    { label: t.setStatus.to, value: enquiryStatusLabel(target.to) },
  ];
}
