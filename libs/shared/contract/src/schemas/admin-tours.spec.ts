import { describe, expect, it } from 'vitest';
import { contract } from '../contract.js';
import {
  AdminPhotoLibrarySchema,
  AdminTourCostsInputSchema,
  AdminTourCreateInputSchema,
  AdminTourDetailSchema,
  AdminTourDetailsInputSchema,
  AdminTourFaqsPoliciesInputSchema,
  AdminTourItineraryInputSchema,
  AdminTourPhotoSchema,
  AdminTourSignPhotoUploadsInputSchema,
} from './admin-tours.js';

/**
 * Contract của khu làm việc tour (spec F17 §3, ADR-0047). Mỗi trần có đúng hai
 * ca: N (qua) và N+1 (bị bắt) — một trần lệch một đơn vị là thứ bảng ca này
 * sinh ra để bắt (bài học 7 của plan F17).
 */
const ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const DEST_A = '33333333-3333-4333-8333-333333333333';
const DEST_B = '44444444-4444-4444-8444-444444444444';
const VERSION = '2026-09-24T10:11:12.345Z';
const text = (length: number) => 'x'.repeat(length);
const many = <T>(length: number, make: (index: number) => T) =>
  Array.from({ length }, (_, index) => make(index));

const CREATE = {
  title: 'Ha Long Bay Cruise',
  slug: 'ha-long-bay-cruise',
  categoryId: CATEGORY,
  primaryDestinationId: DEST_A,
  durationDays: 3,
  maxGroupSize: 12,
  basePrice: '199.00',
};

const DETAILS = {
  id: ID,
  version: VERSION,
  title: 'Ha Long Bay Cruise',
  summary: 'Three days on the bay.',
  categoryId: CATEGORY,
  difficulty: null,
  isFeatured: false,
  durationDays: 3,
  maxGroupSize: 12,
  basePrice: '199.00',
  destinations: [
    { destinationId: DEST_A, isPrimary: true },
    { destinationId: DEST_B, isPrimary: false },
  ],
  suitableFor: [],
  badges: [],
  highlights: [],
  included: [],
  excluded: [],
  meetingPoint: null,
  factDurationNote: null,
  factGroupSizeNote: null,
  factDifficultyNote: null,
  factGoodForNote: null,
};

/** [tên ca, input, có qua không] — mỗi trần một cặp N / N+1. */
type Case = [string, Record<string, unknown>, boolean];

const detailsCases: Case[] = [
  // Trần tên là cột snapshot HẸP hơn `bookings.tour_title` VARCHAR(160), không
  // phải `tours.title` (vòng review F17): tên dài hơn làm mọi lượt đặt chỗ 500.
  ['tên 160', { title: text(160) }, true],
  ['tên 161', { title: text(161) }, false],
  ['tên toàn khoảng trắng', { title: '   ' }, false],
  ['tóm tắt 500', { summary: text(500) }, true],
  ['tóm tắt 501', { summary: text(501) }, false],
  ...(
    ['factDurationNote', 'factGroupSizeNote', 'factDifficultyNote', 'factGoodForNote'] as const
  ).flatMap((field): Case[] => [
    [`${field} 280`, { [field]: text(280) }, true],
    [`${field} 281`, { [field]: text(281) }, false],
  ]),
  ['điểm hẹn 300', { meetingPoint: text(300) }, true],
  ['điểm hẹn 301', { meetingPoint: text(301) }, false],
  ['số ngày 30', { durationDays: 30 }, true],
  ['số ngày 31', { durationDays: 31 }, false],
  ['số ngày 0', { durationDays: 0 }, false],
  ['số khách 100', { maxGroupSize: 100 }, true],
  ['số khách 101', { maxGroupSize: 101 }, false],
  ['số khách 0', { maxGroupSize: 0 }, false],
  ['giá 0.01', { basePrice: '0.01' }, true],
  ['giá 0.00', { basePrice: '0.00' }, false],
  ['giá 3 chữ số lẻ', { basePrice: '1.234' }, false],
  // Trần mọi ô tiền admin gõ tay (vòng review F17) — trần một lần thu của Stripe.
  ['giá 999999.99', { basePrice: '999999.99' }, true],
  ['giá 1000000', { basePrice: '1000000' }, false],
  ['giá 1000000.00', { basePrice: '1000000.00' }, false],
  ...(['highlights', 'included', 'excluded'] as const).flatMap((field): Case[] => [
    [`${field} 15 dòng`, { [field]: many(15, () => 'a') }, true],
    [`${field} 16 dòng`, { [field]: many(16, () => 'a') }, false],
    [`${field} một dòng 200`, { [field]: [text(200)] }, true],
    [`${field} một dòng 201`, { [field]: [text(201)] }, false],
  ]),
  ['một dòng trắng', { excluded: ['   '] }, false],
  ['khách trùng', { suitableFor: ['FAMILY', 'FAMILY'] }, false],
  ['huy hiệu trùng', { badges: ['NEW', 'NEW'] }, false],
  [
    '10 điểm đến',
    {
      destinations: many(10, (i) => ({
        destinationId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        isPrimary: i === 0,
      })),
    },
    true,
  ],
  [
    '11 điểm đến',
    {
      destinations: many(11, (i) => ({
        destinationId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        isPrimary: i === 0,
      })),
    },
    false,
  ],
  ['không điểm đến nào', { destinations: [] }, false],
  ['không điểm chính', { destinations: [{ destinationId: DEST_A, isPrimary: false }] }, false],
  [
    'hai điểm chính',
    {
      destinations: [
        { destinationId: DEST_A, isPrimary: true },
        { destinationId: DEST_B, isPrimary: true },
      ],
    },
    false,
  ],
  [
    'điểm đến trùng',
    {
      destinations: [
        { destinationId: DEST_A, isPrimary: true },
        { destinationId: DEST_A, isPrimary: false },
      ],
    },
    false,
  ],
];

describe('AdminTourDetailsInputSchema', () => {
  it.each(detailsCases)('%s', (_name, patch, ok) => {
    expect(AdminTourDetailsInputSchema.safeParse({ ...DETAILS, ...patch }).success).toBe(ok);
  });

  it('không nhận slug — khoá sau khi tạo (ADR-0047 §7)', () => {
    const parsed = AdminTourDetailsInputSchema.parse({ ...DETAILS, slug: 'another-slug' });
    expect(parsed).not.toHaveProperty('slug');
  });

  it('ô chữ tuỳ chọn để trống thành null, chữ được cắt khoảng trắng', () => {
    const parsed = AdminTourDetailsInputSchema.parse({
      ...DETAILS,
      title: '  Ha Long  ',
      summary: '   ',
      meetingPoint: '',
    });
    expect(parsed.title).toBe('Ha Long');
    expect(parsed.summary).toBeNull();
    expect(parsed.meetingPoint).toBeNull();
  });

  it('version giữ nguyên mili-giây qua một lượt parse', () => {
    expect(AdminTourDetailsInputSchema.parse(DETAILS).version).toBe(VERSION);
  });
});

const createCases: Case[] = [
  ['tên 160', { title: text(160) }, true],
  ['tên 161', { title: text(161) }, false],
  ['slug 120', { slug: text(120) }, true],
  ['slug 121', { slug: text(121) }, false],
  ['slug có khoảng trắng và chữ hoa', { slug: 'Ha Long' }, false],
  ['slug mở đầu bằng gạch', { slug: '-ha-long' }, false],
  ['slug hai gạch liền', { slug: 'ha--long' }, false],
  ['giá 0.01', { basePrice: '0.01' }, true],
  ['giá 0', { basePrice: '0' }, false],
  ['giá 0.00', { basePrice: '0.00' }, false],
  ['giá 999999.99', { basePrice: '999999.99' }, true],
  ['giá 1000000', { basePrice: '1000000' }, false],
  ['số ngày 1', { durationDays: 1 }, true],
  ['số ngày 30', { durationDays: 30 }, true],
  ['số ngày 0', { durationDays: 0 }, false],
  ['số ngày 31', { durationDays: 31 }, false],
  ['số khách 1', { maxGroupSize: 1 }, true],
  ['số khách 100', { maxGroupSize: 100 }, true],
  ['số khách 0', { maxGroupSize: 0 }, false],
  ['số khách 101', { maxGroupSize: 101 }, false],
  ['thiếu điểm đến chính', { primaryDestinationId: undefined }, false],
];

describe('AdminTourCreateInputSchema', () => {
  it.each(createCases)('%s', (_name, patch, ok) => {
    expect(AdminTourCreateInputSchema.safeParse({ ...CREATE, ...patch }).success).toBe(ok);
  });
});

const day = (patch: Record<string, unknown> = {}) => ({
  dayNumber: 1,
  title: 'Arrive',
  description: null,
  ...patch,
});
const ITINERARY = { id: ID, version: VERSION, days: [day()] };

const itineraryCases: Case[] = [
  ['ngày 30', { days: [day({ dayNumber: 30 })] }, true],
  ['ngày 0', { days: [day({ dayNumber: 0 })] }, false],
  ['ngày 31', { days: [day({ dayNumber: 31 })] }, false],
  ['hai ngày cùng số', { days: [day(), day({ title: 'Again' })] }, false],
  ['tiêu đề 200', { days: [day({ title: text(200) })] }, true],
  ['tiêu đề 201', { days: [day({ title: text(201) })] }, false],
  ['tiêu đề trắng', { days: [day({ title: '  ' })] }, false],
  ['mô tả 2000', { days: [day({ description: text(2000) })] }, true],
  ['mô tả 2001', { days: [day({ description: text(2001) })] }, false],
  ['không ngày nào — lưu dở được', { days: [] }, true],
];

describe('AdminTourItineraryInputSchema', () => {
  it.each(itineraryCases)('%s', (_name, patch, ok) => {
    expect(AdminTourItineraryInputSchema.safeParse({ ...ITINERARY, ...patch }).success).toBe(ok);
  });

  it('mô tả trống thành null', () => {
    const parsed = AdminTourItineraryInputSchema.parse({
      ...ITINERARY,
      days: [day({ description: '' })],
    });
    expect(parsed.days[0]?.description).toBeNull();
  });
});

const faq = (patch: Record<string, unknown> = {}) => ({ question: 'Q?', answer: 'A.', ...patch });
const policy = (patch: Record<string, unknown> = {}) => ({
  kind: 'GENERAL',
  title: 'Weather',
  body: 'We sail when it is safe.',
  ...patch,
});
const CONTENT = { id: ID, version: VERSION, faqs: [], policies: [] };

const contentCases: Case[] = [
  ['hai danh sách rỗng', {}, true],
  ['20 câu hỏi', { faqs: many(20, () => faq()) }, true],
  ['21 câu hỏi', { faqs: many(21, () => faq()) }, false],
  ['câu hỏi 300', { faqs: [faq({ question: text(300) })] }, true],
  ['câu hỏi 301', { faqs: [faq({ question: text(301) })] }, false],
  ['trả lời 2000', { faqs: [faq({ answer: text(2000) })] }, true],
  ['trả lời 2001', { faqs: [faq({ answer: text(2001) })] }, false],
  ['10 chính sách', { policies: many(10, () => policy()) }, true],
  ['11 chính sách', { policies: many(11, () => policy()) }, false],
  ['chính sách loại BOOKING', { policies: [policy({ kind: 'BOOKING' })] }, true],
  ['chính sách loại CANCELLATION', { policies: [policy({ kind: 'CANCELLATION' })] }, false],
  ['tiêu đề chính sách 200', { policies: [policy({ title: text(200) })] }, true],
  ['tiêu đề chính sách 201', { policies: [policy({ title: text(201) })] }, false],
  ['nội dung chính sách 4000', { policies: [policy({ body: text(4000) })] }, true],
  ['nội dung chính sách 4001', { policies: [policy({ body: text(4001) })] }, false],
];

describe('AdminTourFaqsPoliciesInputSchema', () => {
  it.each(contentCases)('%s', (_name, patch, ok) => {
    expect(AdminTourFaqsPoliciesInputSchema.safeParse({ ...CONTENT, ...patch }).success).toBe(ok);
  });
});

const cost = (patch: Record<string, unknown> = {}) => ({
  category: 'MEALS',
  label: 'Lunch',
  amount: '8.50',
  basis: 'PER_PERSON',
  ...patch,
});
const COSTS = { id: ID, version: VERSION, items: [] };

const costsCases: Case[] = [
  ['30 dòng', { items: many(30, () => cost()) }, true],
  ['31 dòng', { items: many(31, () => cost()) }, false],
  ['nhãn 120', { items: [cost({ label: text(120) })] }, true],
  ['nhãn 121', { items: [cost({ label: text(121) })] }, false],
  ['số tiền 0 — chi phí 0 là có thật', { items: [cost({ amount: '0' })] }, true],
  ['số tiền 0.00', { items: [cost({ amount: '0.00' })] }, true],
  ['số tiền âm', { items: [cost({ amount: '-1' })] }, false],
  ['số tiền 3 chữ số lẻ', { items: [cost({ amount: '1.234' })] }, false],
  // Trần từng dòng giữ luôn TỔNG 30 dòng cách xa trần cột Decimal(14,2) của
  // `cost_price` và `fixed_cost_amount` (vòng review F17).
  ['số tiền 999999.99', { items: [cost({ amount: '999999.99' })] }, true],
  ['số tiền 1000000', { items: [cost({ amount: '1000000' })] }, false],
  ['hạng mục lạ', { items: [cost({ category: 'FOOD' })] }, false],
];

describe('AdminTourCostsInputSchema', () => {
  it.each(costsCases)('%s', (_name, patch, ok) => {
    expect(AdminTourCostsInputSchema.safeParse({ ...COSTS, ...patch }).success).toBe(ok);
  });
});

describe('AdminTourDetailSchema', () => {
  const DETAIL = {
    ...DETAILS,
    slug: 'ha-long-bay-cruise',
    isPublished: true,
    currency: 'USD',
    costPrice: null,
    ratingAvg: '4.5',
    ratingCount: 12,
    itinerary: [{ dayNumber: 1, title: 'Arrive', description: null }],
    faqs: [],
    policies: [],
    costItems: [],
    departureCount: 0,
    liveSeatsMax: null,
    bookingCount: 0,
    photos: [],
    readiness: {
      summary: true,
      primaryDestination: true,
      missingDays: [],
      cover: true,
      ready: true,
    },
  };

  it('một tour đủ field parse qua, liveSeatsMax null hay số đều được', () => {
    expect(AdminTourDetailSchema.safeParse(DETAIL).success).toBe(true);
    expect(AdminTourDetailSchema.safeParse({ ...DETAIL, liveSeatsMax: 12 }).success).toBe(true);
  });

  it('liveSeatsMax 0 vẫn đọc được — DB chỉ canh seats_total >= 0 (vòng review F17)', () => {
    // Một chuyến 0 ghế (UPDATE tay) mà schema đòi số dương thì oRPC chặn ở
    // output: `get` 500 và cả khu làm việc sập, kể cả tab Departures dùng để sửa nó.
    expect(AdminTourDetailSchema.safeParse({ ...DETAIL, liveSeatsMax: 0 }).success).toBe(true);
  });
});

describe('contract.admin.tours (F17)', () => {
  const codes = (procedure: { '~orpc': { errorMap?: object } }) =>
    Object.keys(procedure['~orpc'].errorMap ?? {}).sort();
  const t = contract.admin.tours;

  it('route của bảy thao tác mới', () => {
    expect(t.create['~orpc'].route).toMatchObject({ method: 'POST', path: '/api/admin/tours' });
    expect(t.get['~orpc'].route).toMatchObject({ method: 'GET', path: '/api/admin/tours/{slug}' });
    expect(t.updateDetails['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/tours/{id}/details',
    });
    expect(t.setItinerary['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/tours/{id}/itinerary',
    });
    expect(t.setFaqsPolicies['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/tours/{id}/faqs-policies',
    });
    expect(t.setCosts['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/tours/{id}/costs',
    });
    expect(t.delete['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/tours/{id}/delete',
    });
  });

  it('mỗi thao tác khai ĐÚNG tập mã của spec §3', () => {
    expect(codes(t.get)).toEqual(['NOT_FOUND']);
    expect(codes(t.create)).toEqual(['NOT_FOUND', 'SLUG_TAKEN']);
    expect(codes(t.updateDetails)).toEqual([
      'DURATION_LOCKED',
      'GROUP_SIZE_BELOW_SEATS',
      'NOT_FOUND',
      'STALE_TOUR',
      'TOUR_NOT_READY',
    ]);
    expect(codes(t.setItinerary)).toEqual(['NOT_FOUND', 'STALE_TOUR', 'TOUR_NOT_READY']);
    expect(codes(t.setFaqsPolicies)).toEqual(['NOT_FOUND', 'STALE_TOUR']);
    expect(codes(t.setCosts)).toEqual(['NOT_FOUND', 'STALE_TOUR']);
    expect(codes(t.delete)).toEqual(['NOT_FOUND', 'TOUR_HAS_BOOKINGS']);
  });

  it('mọi mã "thế giới đã đổi" là 409', () => {
    const map = t.updateDetails['~orpc'].errorMap as Record<string, { status: number }>;
    for (const code of [
      'STALE_TOUR',
      'DURATION_LOCKED',
      'GROUP_SIZE_BELOW_SEATS',
      'TOUR_NOT_READY',
    ]) {
      expect(map[code]?.status).toBe(409);
    }
    expect(
      (t.delete['~orpc'].errorMap as Record<string, { status: number }>).TOUR_HAS_BOOKINGS?.status,
    ).toBe(409);
    expect(
      (t.create['~orpc'].errorMap as Record<string, { status: number }>).SLUG_TAKEN?.status,
    ).toBe(409);
  });
});

describe('AdminTourDetailSchema.photos (F18)', () => {
  it('nhận ảnh có hoặc không có ghi công; nguồn chỉ là UPLOAD hay LIBRARY', () => {
    const photo = {
      publicId: 'tourism/catalog/destination/hoi-an/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x',
      alt: 'Lanterns',
      width: 2400,
      height: 1600,
      source: 'LIBRARY',
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    };
    expect(AdminTourPhotoSchema.parse(photo)).toEqual(photo);
    expect(AdminTourPhotoSchema.safeParse({ ...photo, source: 'CATALOG' }).success).toBe(false);
    expect(
      AdminTourPhotoSchema.safeParse({ ...photo, alt: null, author: null, license: null }).success,
    ).toBe(true);
  });
});

describe('AdminTourSignPhotoUploadsInputSchema (ADR-0048 §4)', () => {
  const id = '7a1b2c3d-0000-4000-8000-000000000001';
  it('count từ 1 tới 30 — trần ảnh của một tour', () => {
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 1 }).success).toBe(true);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 30 }).success).toBe(true);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 0 }).success).toBe(false);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 31 }).success).toBe(false);
    expect(AdminTourSignPhotoUploadsInputSchema.safeParse({ id, count: 1.5 }).success).toBe(false);
  });
});

describe('AdminPhotoLibrarySchema (ADR-0048 §9)', () => {
  it('mỗi nhóm một địa danh kèm ảnh; ảnh mang ghi công khi có', () => {
    const library = [
      {
        destination: { id: '7a1b2c3d-0000-4000-8000-0000000000d1', name: 'Hội An' },
        photos: [
          {
            publicId: 'tourism/catalog/destination/hoi-an/1',
            url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/x',
            alt: 'Lanterns',
            width: 2400,
            height: 1600,
            author: 'J. Nguyen',
            license: 'CC BY-SA 4.0',
          },
        ],
      },
    ];
    expect(AdminPhotoLibrarySchema.parse(library)).toEqual(library);
  });
});
