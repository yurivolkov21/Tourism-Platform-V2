import { describe, expect, it } from 'vitest';
import {
  activityHref,
  asActivityArea,
  hasActivityFilters,
  parseActivitySearchParams,
} from './activity-query';

const OWNER_ID = '0199f000-0000-7000-8000-000000000001';

describe('parseActivitySearchParams', () => {
  it('URL trần: trang 1, 20 dòng, không lọc gì — mọi ngày, mọi người, mọi khu vực', () => {
    expect(parseActivitySearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('đọc đủ bốn bộ lọc', () => {
    expect(
      parseActivitySearchParams({
        actor: OWNER_ID,
        area: 'tours',
        from: '2026-10-01',
        to: '2026-10-19',
        page: '2',
      }),
    ).toEqual({
      page: 2,
      limit: 20,
      actorId: OWNER_ID,
      area: 'tours',
      from: '2026-10-01',
      to: '2026-10-19',
    });
  });

  it('rác rơi im lặng: người không phải uuid, khu vực lạ, ngày sai', () => {
    expect(
      parseActivitySearchParams({ actor: 'owner', area: 'payments', from: '2026-02-31' }),
    ).toEqual({ page: 1, limit: 20 });
  });

  it('khoảng ngược giữ from, bỏ to (luật chung của kit)', () => {
    expect(parseActivitySearchParams({ from: '2026-10-19', to: '2026-10-01' })).toEqual({
      page: 1,
      limit: 20,
      from: '2026-10-19',
    });
  });
});

describe('activityHref', () => {
  const base = { page: 3, limit: 20, area: 'tours' as const };

  it('đổi bộ lọc về trang 1, thứ tự param cố định', () => {
    expect(activityHref(base, { actorId: OWNER_ID })).toBe(
      `/activity?actor=${OWNER_ID}&area=tours`,
    );
    expect(activityHref(base, { from: '2026-10-01', to: '2026-10-19' })).toBe(
      '/activity?area=tours&from=2026-10-01&to=2026-10-19',
    );
  });

  it('null xoá một bộ lọc; giữ trang khi chỉ đổi trang', () => {
    expect(activityHref(base, { area: null })).toBe('/activity');
    expect(activityHref(base, { page: 4 })).toBe('/activity?area=tours&page=4');
  });

  it('đổi số dòng mỗi trang cũng về trang 1', () => {
    expect(activityHref(base, { limit: 50 })).toBe('/activity?area=tours&limit=50');
  });
});

describe('asActivityArea và hasActivityFilters', () => {
  it('khu vực hợp lệ đi qua; sentinel All và chuỗi lạ thành null', () => {
    expect(asActivityArea('departures')).toBe('departures');
    expect(asActivityArea('ALL')).toBeNull();
    expect(asActivityArea('payments')).toBeNull();
  });

  it('chỉ trang và số dòng thì không tính là lọc', () => {
    expect(hasActivityFilters({ page: 2, limit: 50 })).toBe(false);
    expect(hasActivityFilters({ page: 1, limit: 20, to: '2026-10-19' })).toBe(true);
  });
});
