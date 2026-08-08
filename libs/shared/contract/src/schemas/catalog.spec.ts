import {
  DestinationSchema,
  HealthSchema,
  PagedSchema,
  TourCardSchema,
  TourCategorySchema,
  TourDetailSchema,
  TourSortKeySchema,
  ToursListQuerySchema,
} from './catalog.js';

const validCard = {
  id: 'd0000001-0000-4000-8000-000000000001',
  slug: 'hoi-an-walking-tour',
  title: 'Hội An Ancient Town Walking Tour',
  summary: 'A guided half-day stroll.',
  basePrice: '39.00',
  compareAtPrice: '49.00',
  currency: 'USD',
  durationDays: 1,
  difficulty: 'EASY',
  maxGroupSize: 12,
  isFeatured: true,
  destinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
  category: { slug: 'day', name: 'Day Tours' },
  ratingAvg: 4.5,
  ratingCount: 12,
  // ADR-0020: khoá bắt buộc, giá trị nullable. null = tour chưa có ảnh nào.
  cover: null,
};

const validDetail = {
  ...validCard,
  media: [],
  suitableFor: ['COUPLE', 'FAMILY'],
  badges: ['POPULAR'],
  included: ['Guide'],
  excluded: ['Lunch'],
  highlights: ['Lantern-lit old town'],
  meetingPoint: '78 Lê Lợi street',
  itinerary: [{ dayNumber: 1, title: 'Old town on foot', description: null }],
  faqs: [{ question: 'Is it kid-friendly?', answer: 'Yes.' }],
  policies: [
    {
      kind: 'CANCELLATION',
      title: 'Free cancellation',
      body: 'Up to 48h before.',
    },
  ],
  departures: [
    {
      id: 'e0000001-0000-4000-8000-000000000001',
      startDate: '2026-07-31',
      endDate: '2026-07-31',
      seatsLeft: 8,
      effectivePrice: '39.00',
      compareAtPrice: null,
    },
  ],
};

/** Một MediaItem đủ trường, dùng chung cho các ca ảnh bên dưới (ADR-0020). */
const validMedia = {
  publicId: 'tourism/seed/destinations/hoi-an/commons-hoi-an-01',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/x',
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2400,
  height: 1600,
  alt: 'Lanterns over the Thu Bồn river',
  sortOrder: 0,
  author: 'www.viajar24h.com',
  license: 'CC BY 2.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hoi_An_lanterns.jpg',
};

describe('TourCardSchema', () => {
  it('parses a valid card', () => {
    expect(TourCardSchema.parse(validCard)).toEqual(validCard);
  });

  it('mang cover — đóng "nợ contract #1", tour trước đây không có đường nào ra ảnh', () => {
    const card = { ...validCard, cover: validMedia };
    expect(TourCardSchema.parse(card).cover?.license).toBe('CC BY 2.0');
  });

  it('cover null khi tour chưa có ảnh nào — khoá vẫn phải có mặt', () => {
    expect(TourCardSchema.parse({ ...validCard, cover: null }).cover).toBeNull();
    const { cover: _c, ...thieuCover } = { ...validCard, cover: null };
    expect(() => TourCardSchema.parse(thieuCover)).toThrow();
  });

  it('accepts nullable fields as null', () => {
    const card = {
      ...validCard,
      summary: null,
      compareAtPrice: null,
      difficulty: null,
      destinations: [], // mảng rỗng hợp lệ (tour chưa gắn destination nào)
    };
    expect(TourCardSchema.parse(card)).toEqual(card);
  });

  it('rejects numeric basePrice (money must be a decimal STRING)', () => {
    expect(() => TourCardSchema.parse({ ...validCard, basePrice: 39 })).toThrow();
    expect(() => TourCardSchema.parse({ ...validCard, basePrice: 'free' })).toThrow();
    expect(() => TourCardSchema.parse({ ...validCard, basePrice: '-1.00' })).toThrow();
  });

  it('rejects unknown difficulty and malformed id', () => {
    expect(() => TourCardSchema.parse({ ...validCard, difficulty: 'BRUTAL' })).toThrow();
    expect(() => TourCardSchema.parse({ ...validCard, id: 'not-a-uuid' })).toThrow();
  });
});

describe('TourDetailSchema — gallery (ADR-0020)', () => {
  it('mang mảng media nuôi khảm gallery, KHÁC cover một tấm của card', () => {
    const detail = {
      ...validDetail,
      cover: validMedia,
      media: [validMedia, { ...validMedia, role: 'gallery', sortOrder: 1 }],
    };
    expect(TourDetailSchema.parse(detail).media).toHaveLength(2);
  });

  it('media rỗng là hợp lệ — gallery tự ẩn, không phải lỗi', () => {
    const detail = { ...validDetail, cover: null, media: [] };
    expect(TourDetailSchema.parse(detail).media).toEqual([]);
  });
});

describe('TourDetailSchema', () => {
  it('parses a full detail incl. departures', () => {
    expect(TourDetailSchema.parse(validDetail)).toEqual(validDetail);
  });

  it('rejects non-calendar departure dates and negative seatsLeft', () => {
    const bad = (patch: object) => ({
      ...validDetail,
      departures: [{ ...validDetail.departures[0], ...patch }],
    });
    expect(() => TourDetailSchema.parse(bad({ startDate: '31/07/2026' }))).toThrow();
    expect(() => TourDetailSchema.parse(bad({ seatsLeft: -1 }))).toThrow();
  });

  it('rejects unknown policy kind / badge / traveller type', () => {
    expect(() =>
      TourDetailSchema.parse({
        ...validDetail,
        policies: [{ kind: 'WEATHER', title: 'x', body: 'y' }],
      }),
    ).toThrow();
    expect(() => TourDetailSchema.parse({ ...validDetail, badges: ['SHINY'] })).toThrow();
    expect(() => TourDetailSchema.parse({ ...validDetail, suitableFor: ['PETS'] })).toThrow();
  });
});

describe('ToursListQuerySchema', () => {
  it('applies defaults on empty input', () => {
    expect(ToursListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 12,
      sort: 'createdAt',
      order: 'desc',
    });
  });

  it('accepts a full filter set', () => {
    const query = {
      page: 2,
      limit: 24,
      category: 'day',
      destination: 'hanoi',
      search: 'lantern',
      featured: true,
      sort: 'basePrice',
      order: 'asc',
    };
    expect(ToursListQuerySchema.parse(query)).toEqual(query);
  });

  it('rejects out-of-range pagination', () => {
    expect(() => ToursListQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => ToursListQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => ToursListQuerySchema.parse({ limit: 51 })).toThrow();
    expect(() => ToursListQuerySchema.parse({ page: 1.5 })).toThrow();
  });

  it('rejects overlong search and unknown sort', () => {
    expect(() => ToursListQuerySchema.parse({ search: 'x'.repeat(101) })).toThrow();
    expect(() => ToursListQuerySchema.parse({ sort: 'price' })).toThrow();
    expect(() => ToursListQuerySchema.parse({ order: 'up' })).toThrow();
  });

  it('does NOT coerce strings — HTTP coercion is the server plugin’s job', () => {
    expect(() => ToursListQuerySchema.parse({ page: '2' })).toThrow();
    expect(() => ToursListQuerySchema.parse({ featured: 'true' })).toThrow();
  });
});

describe('TourSortKeySchema', () => {
  it('accepts updatedAt (parity Nexora sort whitelist)', () => {
    expect(TourSortKeySchema.safeParse('updatedAt').success).toBe(true);
  });
});

describe('PagedSchema', () => {
  const PagedCards = PagedSchema(TourCardSchema);

  it('parses an envelope', () => {
    const paged = {
      items: [validCard],
      page: 1,
      limit: 12,
      total: 1,
      totalPages: 1,
    };
    expect(PagedCards.parse(paged)).toEqual(paged);
  });

  it('rejects a missing/negative total', () => {
    expect(() => PagedCards.parse({ items: [], page: 1, limit: 12, totalPages: 0 })).toThrow();
    expect(() =>
      PagedCards.parse({
        items: [],
        page: 1,
        limit: 12,
        total: -1,
        totalPages: 0,
      }),
    ).toThrow();
  });

  it('validates each item', () => {
    expect(() =>
      PagedCards.parse({
        items: [{ ...validCard, basePrice: 39 }],
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1,
      }),
    ).toThrow();
  });
});

describe('DestinationSchema / TourCategorySchema / HealthSchema', () => {
  it('parses a destination with tourCount', () => {
    const destination = {
      id: 'c0000001-0000-4000-8000-000000000001',
      slug: 'hanoi',
      name: 'Hà Nội',
      country: 'Vietnam',
      region: 'Northern Vietnam',
      description: 'A thousand-year-old capital.',
      tourCount: 5,
      cover: null,
    };
    expect(DestinationSchema.parse(destination)).toEqual(destination);
    expect(() => DestinationSchema.parse({ ...destination, tourCount: -1 })).toThrow();
  });

  it('địa danh mang cover — MỘT tấm, vì không có trang chi tiết địa danh', () => {
    // ADR-0020 §5: tile địa danh chỉ hiện 1 ảnh. Kho 10 ảnh/địa danh tồn tại
    // để nuôi gallery TOUR, không phải để trưng ở đây — nên chỗ này là `cover`
    // đơn lẻ chứ không phải mảng `media`.
    const destination = {
      id: 'c0000001-0000-4000-8000-000000000001',
      slug: 'hanoi',
      name: 'Hà Nội',
      country: 'Vietnam',
      region: 'Northern Vietnam',
      description: 'A thousand-year-old capital.',
      tourCount: 5,
      cover: validMedia,
    };
    expect(DestinationSchema.parse(destination).cover?.author).toBe('www.viajar24h.com');
    expect(DestinationSchema.parse({ ...destination, cover: null }).cover).toBeNull();
  });

  it('parses a category', () => {
    const category = {
      id: 'b0000001-0000-4000-8000-000000000001',
      slug: 'day',
      name: 'Day Tours',
      description: null,
      order: 1,
      toursCount: 7,
    };
    expect(TourCategorySchema.parse(category)).toEqual(category);
    expect(() => TourCategorySchema.parse({ ...category, order: 'first' })).toThrow();
    expect(() => TourCategorySchema.parse({ ...category, toursCount: -1 })).toThrow();
  });

  it('parses health and rejects a non-ok status', () => {
    const health = {
      status: 'ok',
      uptimeSec: 3,
      timestamp: '2026-07-18T08:00:00.000Z',
    };
    expect(HealthSchema.parse(health)).toEqual(health);
    expect(() => HealthSchema.parse({ ...health, status: 'down' })).toThrow();
  });
});
