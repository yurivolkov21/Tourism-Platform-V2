import { randomBytes } from 'node:crypto';

/**
 * Bảng chữ cái base36 (A-Z, 0-9). Code là định danh người đọc được, không phải
 * secret. Giữ đồng bộ với {@link BOOKING_CODE_PATTERN} và regex
 * `BookingCodeSchema` của contract.
 */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 8;

/** Shape mà mọi booking code phải thỏa — review flow (P-later) validate theo nó. */
export const BOOKING_CODE_PATTERN = /^BK-[A-Z0-9]{8}$/;

/**
 * Sinh một booking code người đọc được: `BK-` + 8 ký tự base36. 36^8 ≈
 * 2.8×10^12 code phân biệt. Modulo bias nhẹ (256 % 36 ≠ 0) không đáng bận tâm —
 * code là định danh, còn tính duy nhất được đảm bảo bởi UNIQUE constraint ở DB
 * cộng với P2002 retry ở tầng service (BookingsService.create).
 */
export function mintBookingCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let suffix = '';
  for (const byte of bytes) {
    suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `BK-${suffix}`;
}
