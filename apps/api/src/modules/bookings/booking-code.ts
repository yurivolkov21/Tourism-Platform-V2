import { randomBytes } from 'node:crypto';

/**
 * Base36 alphabet (A-Z, 0-9). Codes are human-readable identifiers, not
 * secrets. Keep in sync with {@link BOOKING_CODE_PATTERN} and the contract's
 * `BookingCodeSchema` regex.
 */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 8;

/** Shape every booking code satisfies — the review flow (P-later) validates against it. */
export const BOOKING_CODE_PATTERN = /^BK-[A-Z0-9]{8}$/;

/**
 * Mints a human-readable booking code: `BK-` + 8 base36 chars. 36^8 ≈ 2.8×10^12
 * distinct codes. The slight modulo bias (256 % 36 ≠ 0) is irrelevant — codes
 * are identifiers, and uniqueness is enforced by the DB UNIQUE constraint plus
 * the service-level P2002 retry (BookingsService.create).
 */
export function mintBookingCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let suffix = '';
  for (const byte of bytes) {
    suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `BK-${suffix}`;
}
