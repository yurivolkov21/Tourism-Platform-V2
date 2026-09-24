import { describe, expect, it } from 'vitest';
import { type TourReadinessInput, tourReadiness } from './tour-readiness.js';

/** Một tour 3 ngày đủ để bán — mỗi ca đổi ĐÚNG một thứ so với nó. */
const READY: TourReadinessInput = {
  summary: 'Three days on the bay.',
  destinations: [{ isPrimary: true }, { isPrimary: false }],
  durationDays: 3,
  itineraryDays: [1, 2, 3],
};

describe('tourReadiness (ADR-0047 §4)', () => {
  it('đủ cả ba thì ready, không thiếu ngày nào', () => {
    expect(tourReadiness(READY)).toEqual({
      summary: true,
      primaryDestination: true,
      missingDays: [],
      ready: true,
    });
  });

  it('tóm tắt null hoặc chỉ có khoảng trắng là thiếu', () => {
    for (const summary of [null, '', '   ']) {
      const result = tourReadiness({ ...READY, summary });
      expect(result.summary).toBe(false);
      expect(result.ready).toBe(false);
    }
  });

  it('không có điểm chính, hay có HAI điểm chính, đều là thiếu', () => {
    const none = tourReadiness({ ...READY, destinations: [{ isPrimary: false }] });
    const two = tourReadiness({
      ...READY,
      destinations: [{ isPrimary: true }, { isPrimary: true }],
    });

    expect(none.primaryDestination).toBe(false);
    expect(none.ready).toBe(false);
    expect(two.primaryDestination).toBe(false);
    expect(two.ready).toBe(false);
  });

  it('ngày thiếu liệt kê tăng dần, kể cả khi ngày có sẵn đến lộn xộn', () => {
    const result = tourReadiness({ ...READY, durationDays: 5, itineraryDays: [4, 1, 2] });

    expect(result.missingDays).toEqual([3, 5]);
    expect(result.ready).toBe(false);
  });

  it('tour 1 ngày: thiếu ngày 1 rồi đủ', () => {
    expect(tourReadiness({ ...READY, durationDays: 1, itineraryDays: [] }).missingDays).toEqual([
      1,
    ]);
    expect(tourReadiness({ ...READY, durationDays: 1, itineraryDays: [1] }).ready).toBe(true);
  });

  it('ngày vượt số ngày không bù cho ngày thiếu', () => {
    // Ngày 4 của một tour 3 ngày không lấp được ngày 2 đang trống.
    const result = tourReadiness({ ...READY, itineraryDays: [1, 3, 4] });

    expect(result.missingDays).toEqual([2]);
  });
});
