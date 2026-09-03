import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import type { SubscriberRowVM } from './subscribers-view';

/**
 * Logic THUẦN của hành vi ghi vùng subscribers (spec P4c §3-F10) — cùng
 * khuôn `outbox-retry.ts`/`enquiries-write.ts`: codec lỗi derive từ khối
 * i18n, luật trạng-thái-cũ, hợp đồng vận chuyển của server action, và copy
 * dialog dựng sẵn để component không tự ghép chuỗi.
 */

const t = messages.admin.subscribers.unsubscribe;

/**
 * CẢ HAI mã contract là trạng-thái-cũ: địa chỉ đã biến mất, hoặc đã rời danh
 * sách trước khi dialog kịp bắn. Không có mã "thử lại tại chỗ" — lệnh này
 * không đi qua provider nào để mà bị từ chối, nên nếu hàng còn đang nhận tin
 * thì câu UPDATE luôn ăn.
 *
 * `ALREADY_UNSUBSCRIBED` đặc biệt KHÔNG được mời bấm lại: bấm lại chỉ ra 409
 * y như cũ, và ý nghĩa của nó là "mốc rút consent CŨ đang được giữ" — đúng
 * thứ ta muốn, không phải một lỗi cần chữa.
 */
const codec = createWriteErrorCodec(t.errors, {
  stale: ['NOT_FOUND', 'ALREADY_UNSUBSCRIBED'],
});

export const UNSUBSCRIBE_CONTRACT_CODES = codec.codes;

export type UnsubscribeContractCode = keyof typeof t.errors;
export type UnsubscribeFailureCode = UnsubscribeContractCode | TransportFailureCode;

export const classifyUnsubscribeError = codec.classify;
export const unsubscribeErrorCopy = codec.copy;
export const isUnsubscribeStale = codec.isStale;

/**
 * Kết quả server action — hợp đồng vận chuyển giữa `actions.ts` (server) và
 * dialog (client), sống ở lib để tầng server không import tầng trình bày.
 *
 * Nhánh thành công trả MỐC vừa được ghi (đọc từ response, không phải giờ của
 * client): đó là dòng consent mà lệnh này tạo ra, và là thứ toast kể lại.
 * Email KHÔNG đi qua đây — nó là PII mà client đang cầm sẵn trong hàng vừa
 * bấm, nên chở ngược về chỉ để in vào toast là một lượt truyền thừa.
 */
export type UnsubscribeActionResult =
  | { ok: true; unsubscribedAt: string }
  | { ok: false; code: UnsubscribeFailureCode };

export type UnsubscribeAction = (input: { id: string }) => Promise<UnsubscribeActionResult>;

/**
 * Copy của dialog — KHÔNG có ô note (kit `ConfirmWriteDialog` bỏ ô khi không
 * truyền `noteId`): lệnh này không mang ghi chú đi đâu cả, và bảng
 * `subscribers` không có chỗ nào lưu nó.
 */
export function unsubscribeDialogCopy() {
  return {
    title: t.dialog.title,
    body: t.dialog.body,
    warning: t.dialog.warning,
    submit: t.dialog.submit,
    submitting: t.dialog.submitting,
    cancel: t.cancel,
  };
}

/**
 * Dòng ngữ cảnh của dialog: email · nguồn · ngày đăng ký. ĐỊA CHỈ đứng ĐẦU vì
 * nó là thứ duy nhất phải đọc lại trước khi bấm — đây là lệnh gỡ đúng một
 * người khỏi danh sách, và admin không có nút nào để đăng ký lại hộ.
 *
 * Nhận NGUYÊN `SubscriberRowVM` (nếp vá review F7): VM thuần đã format sẵn
 * cả ba giá trị, một interface con cắt tay ở bảng chỉ là chỗ nữa phải sửa khi
 * dialog cần thêm field.
 */
export function unsubscribeConfirmRows(row: SubscriberRowVM): Array<{
  label: string;
  value: string;
}> {
  return [
    { label: t.email, value: row.email },
    { label: t.source, value: row.source },
    { label: t.subscribed, value: row.subscribed },
  ];
}
