import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify chữ ký webhook chuẩn svix (Resend dùng — W4 E6, ADR-0039 §4) —
 * logic THUẦN, tự cài theo tài liệu svix thay vì kéo thêm dependency cho
 * đúng một phép HMAC:
 *
 * - secret dạng `whsec_<base64>`; khoá HMAC là phần base64 đã decode;
 * - nội dung ký: `<svix-id>.<svix-timestamp>.<raw body>`;
 * - header `svix-signature` mang danh sách `v1,<base64>` cách nhau bởi
 *   khoảng trắng (nhiều chữ ký khi đang xoay secret) — MỘT cái khớp là đủ;
 * - timestamp lệch quá {@link SVIX_TOLERANCE_MS} theo CẢ hai chiều bị loại
 *   (chống replay một request cũ bắt được trên đường truyền).
 */

export const SVIX_TOLERANCE_MS = 5 * 60_000;

/** Khoá HMAC từ secret `whsec_<base64>` — sai dạng trả null (không throw). */
function keyOf(secret: string): Buffer | null {
  if (!secret.startsWith('whsec_')) return null;
  try {
    return Buffer.from(secret.slice('whsec_'.length), 'base64');
  } catch {
    return null;
  }
}

/**
 * Chữ ký base64 cho một payload — dùng ở TEST để dựng request hợp lệ (và là
 * chính phép tính mà verify so lại; một nguồn sự thật).
 */
export function signSvixPayload(
  secret: string,
  id: string,
  timestamp: string,
  payload: string,
): string {
  const key = keyOf(secret);
  if (!key) throw new Error('svix secret must look like whsec_<base64>');
  return createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
}

export function verifySvixSignature(opts: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  payload: string;
  now?: Date;
}): boolean {
  const key = keyOf(opts.secret);
  if (!key) return false;
  if (!opts.id || !opts.signatureHeader) return false;

  const tsSeconds = Number(opts.timestamp);
  if (!Number.isFinite(tsSeconds)) return false;
  const now = (opts.now ?? new Date()).getTime();
  if (Math.abs(now - tsSeconds * 1000) > SVIX_TOLERANCE_MS) return false;

  const expected = createHmac('sha256', key)
    .update(`${opts.id}.${opts.timestamp}.${opts.payload}`)
    .digest();
  // Header có thể mang nhiều chữ ký (`v1,<sig> v1,<sig>` khi xoay secret) —
  // duyệt hết, so timing-safe từng cái; lệch độ dài là loại ngay.
  for (const entry of opts.signatureHeader.split(' ')) {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) continue;
    let candidate: Buffer;
    try {
      candidate = Buffer.from(sig, 'base64');
    } catch {
      continue;
    }
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}
