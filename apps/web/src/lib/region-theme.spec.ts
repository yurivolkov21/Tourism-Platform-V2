import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { regionTheme } from './region-theme';

describe('regionTheme', () => {
  it('mỗi vùng một biến thể signature KHÁC nhau — đó là cả điểm của "da riêng"', () => {
    const variants = REGIONS.map((r) => regionTheme(r.key).signature);
    expect(new Set(variants).size).toBe(3);
  });

  it('Bắc dựng dải mùa, Trung dựng timeline, Nam dựng bưu thiếp', () => {
    // Bắc đi `stats` → `itinerary` → `seasons` (29/07). `stats` bỏ vì dải số liệu
    // đã lên hero; `itinerary` bỏ vì nó kể hành trình của MỘT tour, thuộc về
    // `/tours/[slug]` (`ItineraryTimeline` đã làm đúng việc đó) chứ không phải
    // trang vùng. `seasons` nói về chính VÙNG.
    expect(regionTheme('north').signature).toBe('seasons');
    expect(regionTheme('central').signature).toBe('timeline');
    expect(regionTheme('south').signature).toBe('postcards');
  });

  it('hero của Bắc CAO hơn hai vùng kia — "mood" riêng, đúng heroHeight của Nexora', () => {
    expect(regionTheme('north').heroMinH).not.toBe(regionTheme('central').heroMinH);
    expect(regionTheme('central').heroMinH).toBe(regionTheme('south').heroMinH);
  });
});
