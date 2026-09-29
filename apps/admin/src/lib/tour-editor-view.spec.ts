import { tourReadiness } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import {
  activeTourTab,
  costBreakdown,
  formatDayList,
  onSaleShortfalls,
  optionLabel,
  projectedReadiness,
  readinessIssues,
  removedItineraryDays,
  TOUR_EDITOR_TABS,
  tourPhotoThumb,
  tourTabHref,
} from './tour-editor-view';

describe('tab của khu làm việc', () => {
  it('đường của từng tab; Details là gốc /tours/[slug]', () => {
    expect(tourTabHref('ha-long', 'details')).toBe('/tours/ha-long');
    expect(tourTabHref('ha-long', 'itinerary')).toBe('/tours/ha-long/itinerary');
    expect(tourTabHref('ha-long', 'content')).toBe('/tours/ha-long/content');
    expect(tourTabHref('ha-long', 'costs')).toBe('/tours/ha-long/costs');
    expect(tourTabHref('ha-long', 'departures')).toBe('/tours/ha-long/departures');
  });

  it('tab đang mở đọc từ pathname', () => {
    expect(activeTourTab('/tours/ha-long', 'ha-long')).toBe('details');
    expect(activeTourTab('/tours/ha-long/costs', 'ha-long')).toBe('costs');
    expect(activeTourTab('/tours/ha-long/departures', 'ha-long')).toBe('departures');
  });
});

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

describe('tab Photos và mục ảnh bìa (F18)', () => {
  it('Photos đứng ngay sau Details', () => {
    expect(TOUR_EDITOR_TABS).toEqual([
      'details',
      'photos',
      'itinerary',
      'content',
      'costs',
      'departures',
    ]);
    expect(tourTabHref('ha-long', 'photos')).toBe('/tours/ha-long/photos');
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
