import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { regionTheme } from './region-theme';

describe('regionTheme', () => {
  it('mỗi vùng một biến thể signature KHÁC nhau — đó là cả điểm của "da riêng"', () => {
    const variants = REGIONS.map((r) => regionTheme(r.key).signature);
    expect(new Set(variants).size).toBe(3);
  });

  it('Bắc dựng dải số liệu, Trung dựng timeline, Nam dựng bưu thiếp', () => {
    expect(regionTheme('north').signature).toBe('stats');
    expect(regionTheme('central').signature).toBe('timeline');
    expect(regionTheme('south').signature).toBe('postcards');
  });

  it('CHỈ Bắc để signature TRƯỚC highlights (nhánh isAdventure của Nexora)', () => {
    expect(regionTheme('north').signatureFirst).toBe(true);
    expect(regionTheme('central').signatureFirst).toBe(false);
    expect(regionTheme('south').signatureFirst).toBe(false);
  });

  it('hero của Bắc CAO hơn hai vùng kia — "mood" riêng, đúng heroHeight của Nexora', () => {
    expect(regionTheme('north').heroMinH).not.toBe(regionTheme('central').heroMinH);
    expect(regionTheme('central').heroMinH).toBe(regionTheme('south').heroMinH);
  });
});
