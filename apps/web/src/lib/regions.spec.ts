import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { TOURS } from '@/mocks/tours';
import {
  destinationsInRegion,
  longestTourInRegion,
  regionBySlug,
  regionGlance,
  regionOf,
  toursInRegion,
} from './regions';

describe('regionBySlug', () => {
  it('tìm được vùng theo slug', () => {
    expect(regionBySlug(REGIONS, 'central-vietnam')?.key).toBe('central');
  });

  it('slug lạ trả undefined — trang gọi sẽ notFound()', () => {
    expect(regionBySlug(REGIONS, 'atlantis')).toBeUndefined();
  });
});

describe('regionOf — chuẩn hoá chuỗi tự do của contract', () => {
  it('khớp tên hiển thị', () => {
    expect(regionOf(REGIONS, { region: 'Northern Vietnam' })).toBe('north');
  });

  it('không phân biệt hoa/thường và bỏ khoảng trắng thừa', () => {
    expect(regionOf(REGIONS, { region: '  southern vietnam ' })).toBe('south');
  });

  it('khớp cả dạng khoá ngắn', () => {
    expect(regionOf(REGIONS, { region: 'central' })).toBe('central');
  });

  it('chuỗi lạ trả null, KHÔNG đoán', () => {
    expect(regionOf(REGIONS, { region: 'Mekong' })).toBeNull();
  });

  it('null trả null', () => {
    expect(regionOf(REGIONS, { region: null })).toBeNull();
  });
});

describe('bất biến chống địa điểm tàng hình', () => {
  // Địa điểm không map được sẽ vắng mặt khỏi mọi trang vùng, mà index chỉ hiện 3
  // vùng → nó tàng hình trên TOÀN SITE. Test này để ai thêm một cái lạ thì đỏ,
  // thay vì một địa điểm biến mất im lặng.
  it('cả 9 destination đều map được về một vùng', () => {
    for (const d of DESTINATIONS) expect(regionOf(REGIONS, d), d.slug).not.toBeNull();
  });

  it('mỗi vùng đúng 3 địa điểm', () => {
    const counts = REGIONS.map((r) => destinationsInRegion(REGIONS, DESTINATIONS, r.key).length);
    expect(counts).toEqual([3, 3, 3]);
  });
});

describe('toursInRegion', () => {
  it('đếm tour DISTINCT — tour chạm 2 địa điểm cùng vùng chỉ tính 1 lần', () => {
    // ha-long-bay-cruise chạm cả ha-long và ninh-binh (đều vùng Bắc).
    const north = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'north');
    expect(north.filter((t) => t.slug === 'ha-long-bay-cruise')).toHaveLength(1);
  });

  it('mỗi vùng đúng 6 tour', () => {
    const counts = REGIONS.map((r) => toursInRegion(REGIONS, DESTINATIONS, TOURS, r.key).length);
    expect(counts).toEqual([6, 6, 6]);
  });

  it('tour xuyên vùng có mặt ở CẢ BA vùng', () => {
    for (const r of REGIONS) {
      const slugs = toursInRegion(REGIONS, DESTINATIONS, TOURS, r.key).map((t) => t.slug);
      expect(slugs, r.key).toContain('north-to-south-classic');
    }
  });

  it('tổng theo vùng KHÔNG bằng TOURS.length — cấm cộng dồn', () => {
    // 6+6+6 = 18 ≠ 16 vì north-to-south-classic thuộc cả ba vùng. Test này tồn tại
    // để không ai "sửa" TOTAL_TOURS của /about thành tổng cộng dồn.
    const total = REGIONS.reduce(
      (a, r) => a + toursInRegion(REGIONS, DESTINATIONS, TOURS, r.key).length,
      0,
    );
    expect(total).toBe(18);
    expect(total).not.toBe(TOURS.length);
  });
});

describe('regionGlance — chỉ những thứ PHÂN BIỆT được vùng', () => {
  const north = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'north');
  const south = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'south');

  it('fromPrice là string và lấy basePrice nhỏ nhất', () => {
    const glance = regionGlance(north);
    expect(typeof glance?.fromPrice).toBe('string');
    expect(glance?.fromPrice).toBe('68.00');
  });

  it('phổ độ khó xếp theo bậc, không theo thứ tự gặp', () => {
    expect(regionGlance(north)?.difficulties).toEqual(['EASY', 'MODERATE', 'CHALLENGING']);
  });

  it('BỎ QUA difficulty null, không in "null" và không coi null là một bậc', () => {
    // phu-quoc-reef-days có difficulty: null.
    expect(regionGlance(south)?.difficulties).toEqual(['EASY', 'MODERATE']);
  });

  it('chuyên mục là tập duy nhất, giữ thứ tự gặp đầu tiên', () => {
    expect(regionGlance(north)?.categories.map((c) => c.slug)).toEqual([
      'cruises',
      'trekking',
      'scenic',
      'culture',
    ]);
  });

  it('không tour nào thì trả null — trang sẽ ẩn cả dải', () => {
    expect(regionGlance([])).toBeNull();
  });
});

describe('longestTourInRegion — chuyến dài nhất RIÊNG của vùng', () => {
  const northTours = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'north');

  it('bỏ tour XUYÊN VÙNG dù nó dài nhất', () => {
    // `north-to-south-classic` 12 ngày có mặt ở cả ba vùng vì `toursInRegion()`
    // gom theo `some()`. In "12 days" trên trang miền Bắc là quảng cáo một chuyến
    // mà phần lớn thời gian ở nơi khác.
    expect(northTours.some((tour) => tour.slug === 'north-to-south-classic')).toBe(true);
    const longest = longestTourInRegion(REGIONS, DESTINATIONS, northTours, 'north');
    expect(longest?.slug).toBe('northern-highlands-loop');
    expect(longest?.durationDays).toBe(8);
  });

  it('mỗi vùng có chuyến riêng dài nhất của mình', () => {
    const central = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'central');
    const south = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'south');
    expect(longestTourInRegion(REGIONS, DESTINATIONS, central, 'central')?.slug).toBe(
      'central-heritage-week',
    );
    expect(longestTourInRegion(REGIONS, DESTINATIONS, south, 'south')?.slug).toBe(
      'phu-quoc-reef-days',
    );
  });

  it('chuyến trả về CHỈ chạm địa điểm trong vùng — bất biến của "riêng của vùng"', () => {
    for (const region of REGIONS) {
      const tours = toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key);
      const longest = longestTourInRegion(REGIONS, DESTINATIONS, tours, region.key);
      // Khẳng định NON-NULL trước vòng lặp: `for` trên mảng rỗng luôn xanh, nên
      // không có dòng này thì một hàm trả `null` mọi lúc vẫn qua được test.
      expect(longest, region.key).not.toBeNull();
      const slugs = new Set(
        destinationsInRegion(REGIONS, DESTINATIONS, region.key).map((d) => d.slug),
      );
      expect(longest?.destinations.length, region.key).toBeGreaterThan(0);
      for (const dest of longest?.destinations ?? []) {
        expect(slugs.has(dest.slug), `${region.key} → ${dest.slug}`).toBe(true);
      }
    }
  });

  it('vùng chỉ được tour liên vùng ghé qua thì trả null — KHÔNG mượn số của nó', () => {
    const crossOnly = TOURS.filter((tour) => tour.slug === 'north-to-south-classic');
    expect(crossOnly).toHaveLength(1);
    expect(longestTourInRegion(REGIONS, DESTINATIONS, crossOnly, 'north')).toBeNull();
  });

  it('không tour nào thì trả null', () => {
    expect(longestTourInRegion(REGIONS, DESTINATIONS, [], 'north')).toBeNull();
  });

  it('tour KHÔNG có điểm đến nào không thuộc vùng nào — `every` trên mảng rỗng là true', () => {
    // `TourCardSchema.destinations` là mảng, contract không cấm rỗng. Không chặn
    // thì `every()` trả true vô điều kiện và một tour vô-địa-điểm sẽ được nhận
    // làm "chuyến riêng" của MỌI vùng.
    const orphan = TOURS.map((tour) => ({ ...tour, destinations: [] }));
    expect(longestTourInRegion(REGIONS, DESTINATIONS, orphan, 'north')).toBeNull();
  });
});
