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
  const SLOTS = ['primary', 'deep', 'surface', 'spark', 'on-surface', 'hero'];

  it('đúng 3 vùng, mỗi vùng đủ 6 slot, cùng bộ key với regionDefaults', () => {
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

  // `--region-hero`: nền hero của trang vùng. Tách khỏi `--region-deep` vì deep
  // sáng 0.35–0.42 — dùng trực tiếp thì ba trang vùng sáng khác nhau thấy rõ, và
  // navbar lúc chưa cuộn là trong suốt nên hero phải TỐI (luật CLAUDE.md).
  //
  // Phép "cả ba vùng CÓ slot hero" không cần test riêng: `SLOTS` ở trên đã khẳng
  // định bộ key đúng bằng 6 phần tử cho cả 3 vùng lẫn `regionDefaults`.
  it('hero của cả ba vùng TỐI và CÙNG một bậc — chênh nhau ≤ 0.02 L', () => {
    // Đây là bất biến sinh ra slot này: `--region-deep` chênh 0.351 vs 0.423 nên
    // ba trang vùng đọc thành thiếu nhất quán chứ không thành bản sắc.
    const ls = ['north', 'central', 'south'].map((k) => {
      const value = (src.regions as Record<string, Record<string, string>>)[k]?.hero ?? '';
      // Đọc L qua culori thay vì regex — cùng công cụ mà cả file này đang dùng.
      const parsed = oklch(value) as { l?: number } | undefined;
      expect(parsed, k).toBeDefined();
      return parsed?.l ?? 1;
    });
    for (const l of ls) expect(l).toBeLessThanOrEqual(0.26);
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThanOrEqual(0.02);
  });

  it('ba hero KHÁC nhau — nếu giống hết thì tint vùng vô nghĩa', () => {
    const heroes = ['north', 'central', 'south'].map(
      (k) => (src.regions as Record<string, Record<string, string>>)[k]?.hero,
    );
    expect(new Set(heroes).size).toBe(3);
  });
});
