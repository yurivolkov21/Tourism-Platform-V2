import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của hành vi ghi vùng tours (spec P4e-1 §3-F11) — cùng khuôn
 * `subscribers-unsubscribe.ts`/`outbox-retry.ts`: codec lỗi derive từ khối
 * i18n, luật trạng-thái-cũ, và hợp đồng vận chuyển của server action.
 *
 * KHÁC ba vùng ghi trước ở một điểm quan trọng: lệnh này KHÔNG đi qua
 * `ConfirmWriteDialog`. Bật/tắt bán một tour là thao tác nhẹ, hoàn tác được
 * bằng đúng cú bấm ngược lại, và vận hành cần rút một tour khỏi kệ NGAY khi có
 * chuyện — một hộp xác nhận ở đây là ma sát đặt sai chỗ. Đổi lại, công tắc
 * phải tự lo phần mà dialog vẫn lo hộ: hoàn nguyên khi lệnh hỏng.
 */

const t = messages.admin.tours.publish;

/**
 * Mã contract DUY NHẤT, và nó là trạng-thái-cũ: tour đã biến mất giữa lúc
 * trang render và lúc bấm. Không có mã "thử lại tại chỗ" — lệnh này không đi
 * qua provider nào để mà bị từ chối, và cố ý KHÔNG có mã nào chặn vì tour đang
 * có booking sống (xem contract `admin.tours.setPublished`).
 */
const codec = createWriteErrorCodec(t.errors, { stale: ['NOT_FOUND'] });

export const SET_PUBLISHED_CONTRACT_CODES = codec.codes;

export type SetPublishedContractCode = keyof typeof t.errors;
export type SetPublishedFailureCode = SetPublishedContractCode | TransportFailureCode;

export const classifySetPublishedError = codec.classify;
export const setPublishedErrorCopy = codec.copy;
export const isSetPublishedStale = codec.isStale;

/**
 * Kết quả server action — hợp đồng vận chuyển giữa `actions.ts` (server) và
 * công tắc (client), sống ở lib để tầng server không import tầng trình bày.
 *
 * Nhánh thành công trả trạng thái SERVER vừa ghi, không phải cái client vừa
 * bấm: công tắc settle theo response nên một lệnh về muộn không để lại hình
 * ảnh sai. `changed: false` = hàng đã ở sẵn trạng thái ấy.
 */
export type SetPublishedActionResult =
  | { ok: true; isPublished: boolean; changed: boolean }
  | { ok: false; code: SetPublishedFailureCode };

export type SetPublishedAction = (input: {
  id: string;
  isPublished: boolean;
}) => Promise<SetPublishedActionResult>;

/**
 * Câu toast kể lại đúng thứ server vừa làm. Ba nhánh, không gộp:
 * lên kệ · rút khỏi kệ (kèm lời trấn an về khách đã đặt) · không có gì đổi.
 */
export function setPublishedToast(
  title: string,
  result: { isPublished: boolean; changed: boolean },
): string {
  if (!result.changed) return t.toast.unchanged(title);
  return result.isPublished ? t.toast.live(title) : t.toast.off(title);
}
