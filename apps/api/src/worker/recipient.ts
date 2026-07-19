/**
 * MỘT nguồn sự thật cho "email nào là người nhận thật của outbox row này".
 *
 * Vì sao phải dùng chung: `ResendDeliverer.deliver()` GỬI tới `to` (ưu tiên)
 * rồi mới tới `email`, trong khi guard huỷ-đăng-ký của `OutboxService` lại
 * TRA CỨU subscriber theo `email`. Hai nơi đọc hai field khác nhau nghĩa là
 * một loại email bản tin tương lai mang sẵn `to` sẽ bị kiểm tra
 * `unsubscribedAt` trên MỘT địa chỉ nhưng gửi tới địa chỉ KHÁC — bản tin bay
 * tới người đã rút consent (đúng vi phạm GDPR/CAN-SPAM mà Task 6 sinh ra để
 * chặn), và không có gì trong code lẫn test chỉ ra sự lệch này.
 *
 * Quy ước: `to` (nếu có, non-empty) THẮNG `email`. Lý do `to` tồn tại: hầu
 * hết email gửi cho chính chủ nhân của `email` trong payload, nhưng
 * ENQUIRY_ADMIN_ALERT thì ngược lại — `email` ở đó là địa chỉ KHÁCH (để admin
 * đọc), người nhận phải là admin.
 */
export function resolveRecipient(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined;
  const fields = payload as Record<string, unknown>;
  if (typeof fields.to === 'string' && fields.to.length > 0) return fields.to;
  if (typeof fields.email === 'string' && fields.email.length > 0) return fields.email;
  return undefined;
}
