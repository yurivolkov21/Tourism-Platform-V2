import { describe, expect, it } from 'vitest';
import { liveSeatsMax, nextTourVersion } from './tour-editor-rules.js';

describe('nextTourVersion (plan F17, quyết định 3)', () => {
  const version = '2026-09-24T10:00:00.000Z';

  it('đồng hồ đã qua phiên bản cũ thì lấy đồng hồ', () => {
    const now = new Date('2026-09-24T10:00:05.000Z');
    expect(nextTourVersion(version, now).toISOString()).toBe('2026-09-24T10:00:05.000Z');
  });

  it('cùng mili-giây với phiên bản cũ thì cộng 1 ms — hai phiên bản không bao giờ trùng', () => {
    const now = new Date(version);
    expect(nextTourVersion(version, now).toISOString()).toBe('2026-09-24T10:00:00.001Z');
  });

  it('đồng hồ server lùi (NTP) vẫn cho phiên bản lớn hơn bản cũ', () => {
    const now = new Date('2026-09-24T09:59:59.000Z');
    expect(nextTourVersion(version, now).toISOString()).toBe('2026-09-24T10:00:00.001Z');
  });
});

describe('liveSeatsMax (spec §2e, ADR-0046)', () => {
  // 10:00 sáng 10/10 giờ Việt Nam.
  const now = new Date('2026-10-10T03:00:00.000Z');
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const departure = (
    seatsTotal: number,
    start: string,
    end: string,
    status: 'OPEN' | 'CLOSED' | 'CANCELLED' = 'OPEN',
  ) => ({ seatsTotal, startDate: d(start), endDate: d(end), status });

  it('không có chuyến nào thì null', () => {
    expect(liveSeatsMax([], now)).toBeNull();
  });

  it('chỉ có chuyến đã về hay đã huỷ thì null', () => {
    expect(
      liveSeatsMax(
        [
          departure(30, '2026-10-01', '2026-10-03'),
          departure(40, '2026-11-01', '2026-11-02', 'CANCELLED'),
        ],
        now,
      ),
    ).toBeNull();
  });

  it('lấy số ghế lớn nhất của chuyến chưa về và chưa huỷ — kể cả chuyến đang chạy và chuyến đã đóng', () => {
    const departures = [
      departure(30, '2026-10-01', '2026-10-03'), // đã về — bỏ
      departure(40, '2026-11-01', '2026-11-02', 'CANCELLED'), // đã huỷ — bỏ
      departure(25, '2026-10-09', '2026-10-11'), // đang chạy — tính
      departure(20, '2026-11-05', '2026-11-06', 'CLOSED'), // đã đóng — tính
      departure(12, '2026-12-01', '2026-12-02'), // đang bán — tính
    ];
    expect(liveSeatsMax(departures, now)).toBe(25);
  });
});
