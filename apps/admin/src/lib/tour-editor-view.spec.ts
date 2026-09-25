import { tourReadiness } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import {
  activeTourTab,
  costBreakdown,
  formatDayList,
  optionLabel,
  projectedReadiness,
  readinessIssues,
  removedItineraryDays,
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
    });
    expect(readinessIssues(ready, 'ha-long')).toEqual([]);

    const missing = tourReadiness({
      summary: null,
      destinations: [],
      durationDays: 4,
      itineraryDays: [1],
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
});

describe('optionLabel', () => {
  it('mục đang hiện giữ nguyên tên; mục đã ẩn mang "(hidden)"', () => {
    expect(optionLabel({ name: 'Day Tours', isActive: true })).toBe('Day Tours');
    expect(optionLabel({ name: 'Retired', isActive: false })).toBe('Retired (hidden)');
  });
});
