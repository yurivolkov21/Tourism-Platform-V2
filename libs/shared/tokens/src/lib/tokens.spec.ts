import { oklch } from 'culori';
import { describe, expect, it } from 'vitest';
// Namespace import có chủ đích: cần cả default (tokens) lẫn named exports (regions).
import * as src from '../../style-dictionary/tokens.mjs';
import { REGIONS } from './tokens.js';

// Bất biến của hệ màu Wuling (ADR-0013) — chặn regression khi chỉnh token.
const tokens = src.default;

describe('nguồn token màu', () => {
  it('mọi token màu có value + darkValue parse được (oklch hợp lệ)', () => {
    for (const [name, t] of Object.entries(tokens.color)) {
      expect(oklch(t.value), `${name}.value`).toBeDefined();
      expect(oklch(t.darkValue), `${name}.darkValue`).toBeDefined();
    }
  });

  it('primary light thuộc họ ngọc Wuling: hue ∈ [170,195], chroma ≤ 0.09', () => {
    // Ép kiểu vì overload của @types/culori trả `never` khi input là any (nguồn .mjs không type).
    const p = oklch(tokens.color.primary.value) as { h?: number; c?: number } | undefined;
    expect(p?.h).toBeGreaterThanOrEqual(170);
    expect(p?.h).toBeLessThanOrEqual(195);
    expect(p?.c).toBeLessThanOrEqual(0.09);
  });
});

describe('lớp region (Bắc/Trung/Nam)', () => {
  const SLOTS = ['primary', 'deep', 'surface', 'spark', 'on-surface'];

  it('đúng 3 vùng, mỗi vùng đủ 5 slot, cùng bộ key với regionDefaults', () => {
    expect(Object.keys(src.regions).sort()).toEqual(['central', 'north', 'south']);
    expect(Object.keys(src.regionDefaults).sort()).toEqual([...SLOTS].sort());
    for (const [name, region] of Object.entries(src.regions)) {
      expect(Object.keys(region).sort(), name).toEqual([...SLOTS].sort());
      for (const v of Object.values(region)) {
        expect(oklch(v)).toBeDefined();
      }
    }
  });

  it('REGIONS (TS) khớp key của regions (nguồn token)', () => {
    expect([...REGIONS].sort()).toEqual(Object.keys(src.regions).sort());
  });
});
