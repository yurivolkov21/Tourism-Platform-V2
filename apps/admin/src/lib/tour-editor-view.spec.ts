import { type AdminTourDetail, tourReadiness } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { COVER_PHOTO, detailFixture } from '@/test/tour-detail';
import {
  activeTourStep,
  costBreakdown,
  formatDayList,
  onSaleShortfalls,
  optionLabel,
  projectedReadiness,
  readinessIssues,
  removedItineraryDays,
  TOUR_EDITOR_STEPS,
  tourCardPreview,
  tourPhotoThumb,
  tourStepHref,
  tourSteps,
} from './tour-editor-view';

describe('formatDayList', () => {
  it.each<[number[], string]>([
    [[3], '3'],
    [[3, 4, 5], '3–5'],
    [[2, 4, 5, 6], '2, 4–6'],
    [[1, 2, 4, 6, 7], '1–2, 4, 6–7'],
  ])('%j → %s', (days, text) => {
    expect(formatDayList(days)).toBe(text);
  });
});

describe('readinessIssues', () => {
  it('đủ thì rỗng; thiếu thì mỗi mục một link tới đúng tab và đúng ô', () => {
    const ready = tourReadiness({
      summary: 'x',
      destinations: [{ isPrimary: true }],
      durationDays: 1,
      itineraryDays: [1],
      hasCover: true,
    });
    expect(readinessIssues(ready, 'ha-long')).toEqual([]);

    const missing = tourReadiness({
      summary: null,
      destinations: [],
      durationDays: 4,
      itineraryDays: [1],
      hasCover: true,
    });
    expect(readinessIssues(missing, 'ha-long')).toEqual([
      { key: 'summary', label: 'A summary', href: '/tours/ha-long#tour-summary' },
      {
        key: 'primaryDestination',
        label: 'A primary destination',
        href: '/tours/ha-long#tour-destinations',
      },
      { key: 'days', label: 'An itinerary for days 2–4', href: '/tours/ha-long/itinerary#day-2' },
    ]);
  });

  it('một ngày thì nói "day", không "days"', () => {
    const one = tourReadiness({
      summary: 'x',
      destinations: [{ isPrimary: true }],
      durationDays: 2,
      itineraryDays: [1],
      hasCover: true,
    });
    expect(readinessIssues(one, 'ha-long')[0]?.label).toBe('An itinerary for day 2');
  });
});

describe('removedItineraryDays', () => {
  it('chỉ kể ngày ĐANG có hàng vượt số ngày mới', () => {
    const itinerary = [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 4 }];
    expect(removedItineraryDays(itinerary, 2)).toEqual([4]);
    expect(removedItineraryDays(itinerary, 1)).toEqual([2, 4]);
    expect(removedItineraryDays(itinerary, 5)).toEqual([]);
  });
});

describe('costBreakdown', () => {
  it('ba con số của contract, cộng biên lời so với giá gốc', () => {
    const items = [
      { amount: '30.00', basis: 'PER_PERSON' as const },
      { amount: '400.00', basis: 'PER_DEPARTURE' as const },
    ];
    expect(costBreakdown(items, '100.00', 20)).toEqual({
      perPerson: '30.00',
      perDeparture: '400.00',
      costPrice: '50.00',
      margin: { amount: '50.00', percent: 50 },
    });
  });

  it('không có dòng chi phí thì giá vốn và biên lời là null — tour chưa khai giá vốn', () => {
    expect(costBreakdown([], '100.00', 20)).toEqual({
      perPerson: '0.00',
      perDeparture: '0.00',
      costPrice: null,
      margin: null,
    });
  });

  it('lỗ thì biên lời âm, không kẹp về 0', () => {
    const items = [{ amount: '120.00', basis: 'PER_PERSON' as const }];
    expect(costBreakdown(items, '100.00', 10).margin).toEqual({ amount: '-20.00', percent: -20 });
  });
});

describe('projectedReadiness', () => {
  it('giảm số ngày thì bỏ ngày vượt khỏi phép đếm, tăng thì thêm ngày thiếu', () => {
    const detail = detailFixture({
      durationDays: 3,
      itinerary: [1, 2, 3].map((n) => ({ dayNumber: n, title: `D${n}`, description: null })),
    });

    expect(projectedReadiness(detail, { durationDays: 2 }).missingDays).toEqual([]);
    expect(projectedReadiness(detail, { durationDays: 5 }).missingDays).toEqual([4, 5]);
    expect(projectedReadiness(detail, { summary: '  ' }).summary).toBe(false);
    expect(projectedReadiness(detail, { itineraryDays: [1] }).missingDays).toEqual([2, 3]);
  });

  it('số ảnh đang soạn quyết ảnh bìa; vắng thì giữ ảnh bìa của server', () => {
    const detail = detailFixture();
    expect(projectedReadiness(detail, {}).cover).toBe(true);
    expect(projectedReadiness(detail, { photoCount: 0 }).cover).toBe(false);
    expect(projectedReadiness(detail, { photoCount: 0 }).ready).toBe(false);
    expect(projectedReadiness(detail, { photoCount: 2 }).cover).toBe(true);
  });
});

describe('onSaleShortfalls (G11)', () => {
  it('tour TẮT bán thì không có gì — tour nháp lưu thiếu thoải mái', () => {
    const offSale = detailFixture({ isPublished: false });
    expect(
      onSaleShortfalls(offSale, projectedReadiness(offSale, { summary: null, photoCount: 0 })),
    ).toEqual({
      summary: false,
      days: [],
      cover: false,
    });
  });

  it('tour đang bán: đếm đúng chỗ lệnh này làm hỏng', () => {
    const detail = detailFixture();
    expect(onSaleShortfalls(detail, projectedReadiness(detail, { summary: '  ' })).summary).toBe(
      true,
    );
    expect(onSaleShortfalls(detail, projectedReadiness(detail, { durationDays: 5 })).days).toEqual([
      4, 5,
    ]);
    expect(
      onSaleShortfalls(detail, projectedReadiness(detail, { itineraryDays: [1, 3] })).days,
    ).toEqual([2]);
    expect(onSaleShortfalls(detail, projectedReadiness(detail, { photoCount: 0 })).cover).toBe(
      true,
    );
  });

  it('chỗ thiếu có TỪ TRƯỚC (dữ liệu cũ) không bị đổ cho lệnh này', () => {
    // Tour đang bán mà đã thiếu tóm tắt, ngày 3 và ảnh bìa — server không để điều
    // này xảy ra, nhưng dữ liệu sửa tay thì có thể.
    const legacy = detailFixture({
      summary: null,
      itinerary: [
        { dayNumber: 1, title: 'One', description: null },
        { dayNumber: 2, title: 'Two', description: null },
      ],
      photos: [],
    });
    expect(onSaleShortfalls(legacy, projectedReadiness(legacy, { summary: null }))).toEqual({
      summary: false,
      days: [],
      cover: false,
    });
  });
});

describe('bước Photos và mục ảnh bìa (F18)', () => {
  it('Photos đứng ngay sau Details; Departures không phải bước', () => {
    expect(TOUR_EDITOR_STEPS).toEqual([
      'details',
      'photos',
      'itinerary',
      'content',
      'costs',
      'review',
    ]);
  });

  it('thiếu ảnh bìa là một mục readiness trỏ tới tab Photos', () => {
    const noCover = tourReadiness({
      summary: 'x',
      destinations: [{ isPrimary: true }],
      durationDays: 1,
      itineraryDays: [1],
      hasCover: false,
    });
    expect(readinessIssues(noCover, 'ha-long')).toEqual([
      { key: 'cover', label: 'A cover photo', href: '/tours/ha-long/photos' },
    ]);
  });
});

describe('tourPhotoThumb', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v17/tourism/x';
  it('thumbnail chèn w_320, KHÔNG bao giờ c_fill (ADR-0020 §4); URL lạ trả nguyên', () => {
    expect(tourPhotoThumb(url)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320/v17/tourism/x',
    );
    expect(tourPhotoThumb(url)).not.toContain('c_fill');
    expect(tourPhotoThumb('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
});

describe('optionLabel', () => {
  it('mục đang hiện giữ nguyên tên; mục đã ẩn mang "(hidden)"', () => {
    expect(optionLabel({ name: 'Day Tours', isActive: true })).toBe('Day Tours');
    expect(optionLabel({ name: 'Retired', isActive: false })).toBe('Retired (hidden)');
  });
});

/**
 * Bước là DỮ LIỆU (ADR-0049 §1–§2): thứ tự, đường dẫn, và trạng thái suy từ readiness
 * ĐÃ LƯU — nguồn duy nhất của thanh bước lẫn bước Review.
 */
describe('tourStepHref', () => {
  it('Details là gốc của tour; bước khác nối tên bước; slug được mã hoá', () => {
    expect(tourStepHref('ha long', 'details')).toBe('/tours/ha%20long');
    expect(tourStepHref('ha-long', 'review')).toBe('/tours/ha-long/review');
  });
});

describe('activeTourStep', () => {
  it.each([
    ['/tours/ha-long', 'details'],
    ['/tours/ha-long/photos', 'photos'],
    ['/tours/ha-long/costs', 'costs'],
    ['/tours/ha-long/review', 'review'],
    ['/tours/ha-long/khong-co', 'details'],
  ] as const)('%s → %s', (pathname, step) => {
    expect(activeTourStep(pathname, 'ha-long')).toBe(step);
  });

  it('Departures không phải bước — không bước nào sáng', () => {
    expect(activeTourStep('/tours/ha-long/departures', 'ha-long')).toBeNull();
  });
});

describe('tourSteps', () => {
  const s = messages.admin.tours.editor.steps;
  const byStep = (detail: AdminTourDetail) =>
    Object.fromEntries(tourSteps(detail).map((step) => [step.step, step]));

  it('đúng thứ tự thanh bước, đường dẫn và tên bước', () => {
    const steps = tourSteps(detailFixture());
    expect(steps.map((step) => step.step)).toEqual([
      'details',
      'photos',
      'itinerary',
      'content',
      'costs',
      'review',
    ]);
    expect(steps.map((step) => step.href)).toEqual([
      '/tours/ha-long-bay-cruise',
      '/tours/ha-long-bay-cruise/photos',
      '/tours/ha-long-bay-cruise/itinerary',
      '/tours/ha-long-bay-cruise/content',
      '/tours/ha-long-bay-cruise/costs',
      '/tours/ha-long-bay-cruise/review',
    ]);
    expect(steps.map((step) => step.title)).toEqual([
      'Details',
      'Photos',
      'Itinerary',
      'FAQ & policies',
      'Costs',
      'Review & publish',
    ]);
  });

  it('tour đủ và đang bán: ba bước bắt buộc xanh, hai tuỳ chọn, bước cuối nói "On sale"', () => {
    const detail = detailFixture();
    expect(tourSteps(detail).map((step) => step.status)).toEqual([
      'ok',
      'ok',
      'ok',
      'optional',
      'optional',
      'final',
    ]);
    const steps = byStep(detail);
    expect(steps.details?.summary).toBe(s.detailsReady);
    expect(steps.photos?.summary).toBe('1 photo · cover set');
    expect(steps.itinerary?.summary).toBe(s.itineraryReady);
    expect(steps.review?.summary).toBe('On sale');
    expect(tourSteps(detail).every((step) => step.fixHref === null)).toBe(true);
  });

  it('thiếu tóm tắt và điểm đến chính: Details vàng, kể cả hai mục, sửa từ ô tóm tắt', () => {
    const details = byStep(
      detailFixture({ isPublished: false, summary: null, destinations: [] }),
    ).details;
    expect(details?.status).toBe('warn');
    expect(details?.summary).toBe('Missing: a summary, a primary destination');
    expect(details?.fixHref).toBe('/tours/ha-long-bay-cruise#tour-summary');
  });

  it('thiếu ngày: Itinerary vàng kèm dải ngày, sửa từ ngày thiếu đầu tiên', () => {
    const itinerary = byStep(
      detailFixture({
        isPublished: false,
        itinerary: [{ dayNumber: 1, title: 'Board the boat', description: null }],
      }),
    ).itinerary;
    expect(itinerary?.status).toBe('warn');
    expect(itinerary?.summary).toBe('Missing: an itinerary for days 2–3');
    expect(itinerary?.fixHref).toBe('/tours/ha-long-bay-cruise/itinerary#day-2');
  });

  it('không có ảnh: Photos vàng, sửa ở bước Photos', () => {
    const photos = byStep(detailFixture({ isPublished: false, photos: [] })).photos;
    expect(photos?.status).toBe('warn');
    expect(photos?.summary).toBe('Missing: a cover photo');
    expect(photos?.fixHref).toBe('/tours/ha-long-bay-cruise/photos');
  });

  it('bước cuối: tắt bán mà đủ → "Ready to go on sale"; thiếu hai mục → "2 things to fix"', () => {
    expect(byStep(detailFixture({ isPublished: false })).review?.summary).toBe(
      'Ready to go on sale',
    );
    expect(
      byStep(detailFixture({ isPublished: false, summary: null, photos: [] })).review?.summary,
    ).toBe('2 things to fix');
  });

  it('bước tuỳ chọn đếm đúng số ít, số nhiều và số không', () => {
    const empty = byStep(detailFixture());
    expect(empty.content?.summary).toBe('Optional · 0 questions · 0 policies');
    expect(empty.costs?.summary).toBe('Optional · no cost lines');
    const one = byStep(
      detailFixture({
        faqs: [{ question: 'Q?', answer: 'A.' }],
        policies: [{ kind: 'GENERAL', title: 'Weather', body: 'We move you.' }],
        costItems: [{ category: 'MEALS', label: 'Lunch', amount: '9.00', basis: 'PER_PERSON' }],
      }),
    );
    expect(one.content?.summary).toBe('Optional · 1 question · 1 policy');
    expect(one.costs?.summary).toBe('Optional · 1 cost line');
  });
});

/**
 * Thẻ xem trước card /tours ở cột phải bước Details (spec F19 §2d.1): đọc giá trị ĐANG
 * GÕ, chữ và cách ghép giống card web (`tour-list-card.tsx`).
 */
describe('tourCardPreview', () => {
  const draft = {
    title: '  Ha Long Bay Cruise ',
    summary: 'Three days on the bay.',
    isFeatured: true,
    days: 3,
    groupSize: 12,
    basePrice: '199.00',
    primaryDestination: 'Hạ Long',
  };

  it('đọc bản đang gõ: tên cắt khoảng trắng, dữ kiện như card web, giá định dạng tiền', () => {
    expect(tourCardPreview(detailFixture({ ratingAvg: '4.66', ratingCount: 1280 }), draft)).toEqual(
      {
        coverUrl: COVER_PHOTO.url,
        title: 'Ha Long Bay Cruise',
        summary: 'Three days on the bay.',
        featured: true,
        facts: 'Hạ Long · 3 days · Max 12',
        rating: { value: '4.7', count: '1,280' },
        price: '$199.00',
      },
    );
  });

  it('ô gõ dở thì bỏ mẩu ấy; giá chưa hợp lệ in "—"; tên trống là "Untitled tour"; chưa có ảnh', () => {
    const vm = tourCardPreview(detailFixture({ photos: [] }), {
      ...draft,
      title: '  ',
      days: Number.NaN,
      groupSize: 0,
      basePrice: '12.',
      primaryDestination: null,
    });
    expect(vm.title).toBe('Untitled tour');
    expect(vm.facts).toBe('');
    expect(vm.price).toBe('—');
    expect(vm.coverUrl).toBeNull();
    // Fixture gốc: chưa ai đánh giá (`ratingAvg: null`) — card web in "Not yet reviewed".
    expect(vm.rating).toBeNull();
  });

  it('một ngày đọc "1 day"; giá 0 không phải giá gốc hợp lệ', () => {
    const vm = tourCardPreview(detailFixture(), { ...draft, days: 1, basePrice: '0' });
    expect(vm.facts).toBe('Hạ Long · 1 day · Max 12');
    expect(vm.price).toBe('—');
  });
});
