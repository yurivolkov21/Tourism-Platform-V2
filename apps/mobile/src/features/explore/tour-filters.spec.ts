import type { Destination, TourCard } from '@tourism/contract';
import {
  countActiveFilters,
  destinationRegionMap,
  durationBucket,
  EMPTY_TOUR_FILTERS,
  filterTours,
  priceBucket,
  regionOfTour,
  searchTours,
} from './tour-filters';

function tour(overrides: Partial<TourCard> = {}): TourCard {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: 'hoi-an-lantern-evening',
    title: 'Hội An Old Town & Lantern Evening',
    summary: null,
    basePrice: '39.00',
    compareAtPrice: null,
    priceFrom: '39.00',
    currency: 'USD',
    durationDays: 1,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    category: { slug: 'day-tours', name: 'Day Tours' },
    ratingAvg: 4.8,
    ratingCount: 20,
    cover: null,
    ...overrides,
  };
}

function destination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: 'hoi-an',
    name: 'Hội An',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: null,
    tourCount: 1,
    cover: null,
    ...overrides,
  };
}

describe('durationBucket', () => {
  it('1 ngày → "1"; 2–3 ngày → "2-3"; 4+ ngày → "4+"', () => {
    expect(durationBucket(1)).toBe('1');
    expect(durationBucket(2)).toBe('2-3');
    expect(durationBucket(3)).toBe('2-3');
    expect(durationBucket(4)).toBe('4+');
  });
});

describe('priceBucket', () => {
  it('biên 100 và 300 thuộc nhóm giữa', () => {
    expect(priceBucket('99.00')).toBe('<100');
    expect(priceBucket('100.00')).toBe('100-300');
    expect(priceBucket('300.00')).toBe('100-300');
    expect(priceBucket('300.01')).toBe('300+');
  });
});

describe('destinationRegionMap + regionOfTour', () => {
  it('lấy vùng của destination CHÍNH (isPrimary) trước', () => {
    const map = destinationRegionMap([
      destination({ slug: 'hoi-an', region: 'Central Vietnam' }),
      destination({ slug: 'hanoi', region: 'Northern Vietnam' }),
    ]);
    const t = tour({
      destinations: [
        { slug: 'hanoi', name: 'Hà Nội', isPrimary: false },
        { slug: 'hoi-an', name: 'Hội An', isPrimary: true },
      ],
    });
    expect(regionOfTour(t, map)).toBe('Central Vietnam');
  });

  it('không có destination nào isPrimary → lấy destination ĐẦU có vùng biết', () => {
    const map = destinationRegionMap([destination({ slug: 'hanoi', region: 'Northern Vietnam' })]);
    const t = tour({ destinations: [{ slug: 'hanoi', name: 'Hà Nội', isPrimary: false }] });
    expect(regionOfTour(t, map)).toBe('Northern Vietnam');
  });

  it('destination không nằm trong map (địa danh bị ẩn/xoá) → null', () => {
    const t = tour({ destinations: [{ slug: 'unknown', name: 'Unknown', isPrimary: true }] });
    expect(regionOfTour(t, destinationRegionMap([]))).toBeNull();
  });
});

describe('filterTours', () => {
  const map = destinationRegionMap([destination({ slug: 'hoi-an', region: 'Central Vietnam' })]);

  it('facet rỗng = không lọc', () => {
    expect(filterTours([tour()], EMPTY_TOUR_FILTERS, map)).toHaveLength(1);
  });

  it('OR trong cùng facet, AND giữa các facet', () => {
    const easy1Day = tour({ difficulty: 'EASY', durationDays: 1 });
    const moderate4Day = tour({ slug: 'b', difficulty: 'MODERATE', durationDays: 4 });
    const tours = [easy1Day, moderate4Day];

    expect(
      filterTours(tours, { ...EMPTY_TOUR_FILTERS, difficulties: ['EASY', 'MODERATE'] }, map),
    ).toHaveLength(2);
    expect(
      filterTours(tours, { ...EMPTY_TOUR_FILTERS, difficulties: ['EASY'], durations: ['4+'] }, map),
    ).toHaveLength(0);
  });

  it('tour không ghi độ khó (null) không lọt bất kỳ nhóm difficulty nào', () => {
    const noDifficulty = tour({ difficulty: null });
    expect(
      filterTours([noDifficulty], { ...EMPTY_TOUR_FILTERS, difficulties: ['EASY'] }, map),
    ).toHaveLength(0);
  });

  it('lọc theo region qua destinationRegionMap', () => {
    const t = tour();
    expect(
      filterTours([t], { ...EMPTY_TOUR_FILTERS, regions: ['Central Vietnam'] }, map),
    ).toHaveLength(1);
    expect(
      filterTours([t], { ...EMPTY_TOUR_FILTERS, regions: ['Northern Vietnam'] }, map),
    ).toHaveLength(0);
  });

  it('lọc theo price bucket', () => {
    const t = tour({ priceFrom: '250.00' });
    expect(filterTours([t], { ...EMPTY_TOUR_FILTERS, prices: ['100-300'] }, map)).toHaveLength(1);
    expect(filterTours([t], { ...EMPTY_TOUR_FILTERS, prices: ['<100'] }, map)).toHaveLength(0);
  });
});

describe('countActiveFilters', () => {
  it('đếm tổng số option đang bật trên mọi facet', () => {
    expect(countActiveFilters(EMPTY_TOUR_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        regions: ['Central Vietnam'],
        durations: ['1', '4+'],
        prices: [],
        difficulties: ['EASY'],
      }),
    ).toBe(4);
  });
});

describe('searchTours', () => {
  const tours = [
    tour({ slug: 'hanoi-old-quarter', title: 'Hanoi Old Quarter Walk' }),
    tour({ slug: 'ha-long-bay', title: 'Hạ Long Bay Cruise' }),
    tour({ slug: 'ha-giang-loop', title: 'Hà Giang Loop' }),
    tour({ slug: 'phong-nha', title: 'Phong Nha Cave Discovery' }),
  ];

  it('gõ không dấu khớp tiêu đề CÓ dấu (bỏ dấu cả hai phía)', () => {
    const result = searchTours(tours, 'ha long');
    expect(result.map((t) => t.slug)).toEqual(['ha-long-bay']);
  });

  it('khớp NHIỀU tour cùng chứa chuỗi con đã bỏ dấu (chuỗi con bất kỳ vị trí, port nguyên `includes` của web — không phải chỉ đầu từ)', () => {
    const result = searchTours(tours, 'ha');
    // "Phong Nha" cũng khớp vì "ha" là chuỗi con của "Nha" — ĐÚNG với ngữ
    // nghĩa `searchTours` của web (includes trên chuỗi đã bỏ dấu), không
    // phải lỗi. Khớp-đầu-từ-tuyệt-đối thuộc `matchDestinationsByPrefix`
    // (E2), một hàm khác, chỉ áp cho TÊN ĐỊA DANH.
    expect(result.map((t) => t.slug)).toEqual(
      expect.arrayContaining(['hanoi-old-quarter', 'ha-long-bay', 'ha-giang-loop', 'phong-nha']),
    );
  });

  it('query rỗng (sau trim): trả nguyên danh sách', () => {
    expect(searchTours(tours, '   ')).toEqual(tours);
  });

  it('tìm trên summary/category/tên destination, không chỉ title', () => {
    const withSummary = [
      tour({
        slug: 'unrelated',
        title: 'Some Tour',
        summary: 'A trip through Đà Lạt highlands',
        destinations: [{ slug: 'da-lat', name: 'Đà Lạt', isPrimary: true }],
      }),
    ];
    expect(searchTours(withSummary, 'da lat').map((t) => t.slug)).toEqual(['unrelated']);
  });
});
