import type { OutboxRow } from '@tourism/contract';
import type { Outbox } from '../../generated/prisma/client.js';
import { EmailType } from '../../generated/prisma/enums.js';
import { resolveRecipient } from '../../worker/recipient.js';

/**
 * Row Prisma `outbox` → `OutboxRow` của contract (spec P4c §3-F7). THUẦN —
 * unit test không cần DB.
 *
 * `recipient` rút bằng ĐÚNG hàm worker dùng để gửi (`resolveRecipient`: `to`
 * thắng `email`) chứ không chép luật lần hai: cột Recipient của admin phải
 * nói đúng địa chỉ mà deliverer sẽ bắn tới, kể cả ENQUIRY_ADMIN_ALERT (ở đó
 * `email` là địa chỉ KHÁCH, người nhận là admin qua `to`).
 *
 * ## Redact credential (vòng vá review F7)
 *
 * Hai loại email của auth mang CREDENTIAL trong chính payload — PASSWORD_RESET
 * có `url` chứa token reset, EMAIL_OTP có `otp` — và `auth.config.ts` còn
 * nhét chúng vào `dedupeKey` (`pwreset:<userId>:<url>`,
 * `email-otp:<email>:<otp>`). Bề mặt admin KHÔNG được là nơi một admin cầm
 * được link reset của admin khác (row SENT sống 30 ngày). Nên:
 *
 * - `payload`: mọi khoá trong `SECRET_PAYLOAD_KEYS` thành `[redacted]` cho
 *   MỌI loại email (khoá theo TÊN, không theo type: loại email mới mang `url`
 *   thì tự động được che, không phải nhớ thêm vào danh sách).
 * - `dedupeKey`: với loại trong `CREDENTIAL_EMAIL_TYPES` chỉ giữ tiền tố
 *   sự kiện (`pwreset`, `email-otp`) — phần sau là chính credential.
 *
 * Redact ở MAPPER (một chỗ, mọi endpoint outbox đi qua) chứ không ở UI.
 */

/** Khoá payload có thể mang credential — che ở mọi loại email. */
export const SECRET_PAYLOAD_KEYS: ReadonlySet<string> = new Set(['url', 'otp', 'token']);

/** Loại email mà `dedupeKey` nhúng credential (xem `auth.config.ts`). */
export const CREDENTIAL_EMAIL_TYPES: ReadonlySet<EmailType> = new Set([
  EmailType.PASSWORD_RESET,
  EmailType.EMAIL_OTP,
  EmailType.EMAIL_VERIFICATION,
  EmailType.EMAIL_CHANGED,
]);

export const REDACTED = '[redacted]';

/** Che khoá bí mật ở TẦNG NGOÀI của payload (payload outbox là record phẳng). */
export function redactPayload(payload: Outbox['payload']): OutboxRow['payload'] {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    // Cùng một tập giá trị JSON, hai cách gõ: Prisma khai `JsonArray` là
    // interface kế thừa Array nên TS không khớp nó với union đệ quy `JSONType`
    // của `z.json()`. Cast là khớp DANH NGHĨA, không đổi giá trị.
    return payload as OutboxRow['payload'];
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = SECRET_PAYLOAD_KEYS.has(key) ? REDACTED : value;
  }
  return out as OutboxRow['payload'];
}

/** Giữ tiền tố sự kiện, che phần mang credential — chỉ cho loại email auth. */
export function redactDedupeKey(type: EmailType, dedupeKey: string): string {
  if (!CREDENTIAL_EMAIL_TYPES.has(type)) return dedupeKey;
  const [prefix] = dedupeKey.split(':');
  return `${prefix}:${REDACTED}`;
}

export function toOutboxRow(row: Outbox): OutboxRow {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    dedupeKey: redactDedupeKey(row.type, row.dedupeKey),
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    recipient: resolveRecipient(row.payload) ?? null,
    payload: redactPayload(row.payload),
  };
}
