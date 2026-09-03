import { describe, expect, it } from 'vitest';
import { enquiriesHref, parseEnquiriesSearchParams } from './enquiries-query';

/**
 * Trạng thái bảng `/enquiries` sống TRÊN URL (spec P4c §3-F9, cùng khuôn
 * `outbox-query`): ba filter (status · q = name/email · tourId) + phân trang
 * dùng chung `table-query.ts`. URL là thứ người gõ — mọi giá trị rác rơi về
 * mặc định an toàn, không ném 400 lên API.
 */

const TOUR_ID = '0198c000-0000-7000-8000-0000000000aa';

describe('parseEnquiriesSearchParams', () => {
  it('không param nào → trang 1, limit mặc định, KHÔNG filter (bỏ trống = tất cả)', () => {
    expect(parseEnquiriesSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('cả NĂM trạng thái của enum contract đều lọc được', () => {
    for (const status of ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'] as const) {
      expect(parseEnquiriesSearchParams({ status })).toEqual({ page: 1, limit: 20, status });
    }
  });

  it('status lạ (kể cả trạng thái của vùng khác) rơi êm về "tất cả"', () => {
    expect(parseEnquiriesSearchParams({ status: 'ARCHIVED' })).toEqual({ page: 1, limit: 20 });
    expect(parseEnquiriesSearchParams({ status: 'PAID' })).toEqual({ page: 1, limit: 20 });
  });

  it('q → search: trim, rỗng thì không lọc, quá dài cắt đúng trần 120', () => {
    expect(parseEnquiriesSearchParams({ q: '  Ada Lovelace ' })).toEqual({
      page: 1,
      limit: 20,
      search: 'Ada Lovelace',
    });
    expect(parseEnquiriesSearchParams({ q: '   ' })).toEqual({ page: 1, limit: 20 });
    expect(parseEnquiriesSearchParams({ q: 'x'.repeat(130) }).search).toHaveLength(120);
  });

  it('tourId phải là uuid — chuỗi khác bị BỎ thay vì ném 400 lên API', () => {
    expect(parseEnquiriesSearchParams({ tourId: TOUR_ID })).toEqual({
      page: 1,
      limit: 20,
      tourId: TOUR_ID,
    });
    expect(parseEnquiriesSearchParams({ tourId: 'hoi-an-lantern-evening' })).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('phân trang dùng chung luật clamp (page rác → 1, limit vượt trần → mặc định)', () => {
    expect(parseEnquiriesSearchParams({ page: '0', limit: '500' })).toEqual({ page: 1, limit: 20 });
    expect(parseEnquiriesSearchParams({ page: '3', limit: '50', status: ['WON', 'LOST'] })).toEqual(
      { page: 3, limit: 50, status: 'WON' },
    );
  });
});

describe('enquiriesHref', () => {
  it('trạng thái mặc định → đường dẫn trơn, không query cụt', () => {
    expect(enquiriesHref({ page: 1, limit: 20 }, {})).toBe('/enquiries');
  });

  it('giữ mọi filter khi chỉ đổi trang; thứ tự param ổn định status · q · tourId', () => {
    expect(
      enquiriesHref(
        { page: 1, limit: 20, status: 'NEW', search: 'ada', tourId: TOUR_ID },
        { page: 3 },
      ),
    ).toBe(`/enquiries?status=NEW&q=ada&tourId=${TOUR_ID}&page=3`);
  });

  it('đổi status ĐẶT LẠI trang về 1, giữ filter khác', () => {
    expect(
      enquiriesHref({ page: 5, limit: 20, status: 'NEW', search: 'ada' }, { status: 'WON' }),
    ).toBe('/enquiries?status=WON&q=ada');
  });

  it('null = XOÁ filter, undefined = giữ nguyên', () => {
    expect(
      enquiriesHref({ page: 4, limit: 20, status: 'NEW', tourId: TOUR_ID }, { tourId: null }),
    ).toBe('/enquiries?status=NEW');
    expect(enquiriesHref({ page: 4, limit: 20, status: 'NEW' }, { search: 'grace' })).toBe(
      '/enquiries?status=NEW&q=grace',
    );
  });

  it('đổi số dòng mỗi trang cũng đặt lại trang về 1', () => {
    expect(enquiriesHref({ page: 7, limit: 20, status: 'QUOTED' }, { limit: 50 })).toBe(
      '/enquiries?status=QUOTED&limit=50',
    );
  });

  it('search từ patch cũng bị trim/cắt trần trước khi ghi lên URL', () => {
    expect(enquiriesHref({ page: 1, limit: 20 }, { search: '  ada  ' })).toBe('/enquiries?q=ada');
    const url = new URL(
      enquiriesHref({ page: 1, limit: 20 }, { search: 'x'.repeat(200) }),
      'http://x',
    );
    expect(url.searchParams.get('q')).toHaveLength(120);
  });
});
