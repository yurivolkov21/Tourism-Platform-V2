import { BOOKING_CODE_PATTERN, mintBookingCode } from './booking-code.js';

describe('mintBookingCode', () => {
  it('mints `BK-` + 8 uppercase base36 chars', () => {
    for (let i = 0; i < 200; i++) {
      const code = mintBookingCode();
      expect(code).toMatch(/^BK-[A-Z0-9]{8}$/);
      expect(code).toHaveLength(11);
    }
  });

  it('exports the pattern consumers validate against (kept in sync with the contract)', () => {
    expect(BOOKING_CODE_PATTERN.test(mintBookingCode())).toBe(true);
    expect(BOOKING_CODE_PATTERN.test('BK-abcdefgh')).toBe(false); // lowercase
    expect(BOOKING_CODE_PATTERN.test('BK-1234567')).toBe(false); // too short
    expect(BOOKING_CODE_PATTERN.test('XX-12345678')).toBe(false); // wrong prefix
  });

  it('only uses the A-Z0-9 alphabet (no ambiguity with URL/emails)', () => {
    const chars = new Set(Array.from({ length: 100 }, () => mintBookingCode().slice(3)).join(''));
    for (const ch of chars) {
      expect(ch).toMatch(/[A-Z0-9]/);
    }
  });

  it('is random — 100 mints do not collide in practice', () => {
    const codes = new Set(Array.from({ length: 100 }, mintBookingCode));
    expect(codes.size).toBe(100);
  });
});
