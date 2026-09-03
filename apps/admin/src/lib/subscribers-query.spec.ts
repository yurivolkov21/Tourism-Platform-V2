import { describe, expect, it } from 'vitest';
import {
  parseSubscribersSearchParams,
  SUBSCRIBERS_DEFAULT_HREF,
  subscribersExportHref,
  subscribersHref,
} from './subscribers-query';

/**
 * Trạng thái bảng `/subscribers` trên URL (spec P4c §3-F10). Điểm riêng của
 * vùng này so với ba vùng trước: `active` là cờ BA TRẠNG THÁI, nên `false`
 * phải sống được trên URL — nó là tab "Unsubscribed", không phải "tắt filter".
 */

const base = { page: 1, limit: 20 };

describe('parseSubscribersSearchParams', () => {
  it('URL trơn: trang 1, 20 dòng, không filter nào (tab All)', () => {
    expect(parseSubscribersSearchParams({})).toEqual(base);
  });

  it('`active` nhận ĐÚNG "true"/"false"; chuỗi khác rơi về không lọc', () => {
    expect(parseSubscribersSearchParams({ active: 'true' })).toEqual({ ...base, active: true });
    expect(parseSubscribersSearchParams({ active: 'false' })).toEqual({ ...base, active: false });
    // "1"/"yes"/"" là chỗ hai người đọc URL hiểu hai kiểu — không đoán hộ.
    expect(parseSubscribersSearchParams({ active: '1' })).toEqual(base);
    expect(parseSubscribersSearchParams({ active: 'yes' })).toEqual(base);
    expect(parseSubscribersSearchParams({ active: '' })).toEqual(base);
  });

  it('`q` trim + cắt trần 120 của contract; rỗng thì không lọc', () => {
    expect(parseSubscribersSearchParams({ q: '  ada@  ' }).search).toBe('ada@');
    expect(parseSubscribersSearchParams({ q: '   ' }).search).toBeUndefined();
    expect(parseSubscribersSearchParams({ q: 'x'.repeat(200) }).search).toHaveLength(120);
  });

  it('`source` trim + cắt trần 40 của cột; rỗng thì không lọc', () => {
    expect(parseSubscribersSearchParams({ source: ' footer ' }).source).toBe('footer');
    expect(parseSubscribersSearchParams({ source: '' }).source).toBeUndefined();
    expect(parseSubscribersSearchParams({ source: 'x'.repeat(60) }).source).toHaveLength(40);
  });

  it('page/limit rác rơi về mặc định, param lặp lấy giá trị ĐẦU', () => {
    expect(parseSubscribersSearchParams({ page: 'x', limit: '999' })).toEqual(base);
    expect(parseSubscribersSearchParams({ page: ['3', '9'] }).page).toBe(3);
  });
});

describe('subscribersHref', () => {
  it('mặc định thì href trơn — trang 1 và limit mặc định không viết ra URL', () => {
    expect(subscribersHref(base, {})).toBe('/subscribers');
  });

  it('`active: false` GHI ra URL (tab Unsubscribed), `null` mới là xoá filter', () => {
    expect(subscribersHref(base, { active: false })).toBe('/subscribers?active=false');
    expect(subscribersHref(base, { active: true })).toBe('/subscribers?active=true');
    expect(subscribersHref({ ...base, active: false }, { active: null })).toBe('/subscribers');
  });

  it('`undefined` GIỮ filter hiện tại — patch chỉ nói về thứ nó nhắc tới', () => {
    expect(subscribersHref({ ...base, active: false, search: 'ada' }, { page: 2 })).toBe(
      '/subscribers?active=false&q=ada&page=2',
    );
  });

  it('đổi filter hoặc số dòng mỗi trang đều ĐẶT LẠI trang về 1', () => {
    const current = { page: 5, limit: 20, active: true };
    expect(subscribersHref(current, { search: 'ada' })).toBe('/subscribers?active=true&q=ada');
    expect(subscribersHref(current, { limit: 50 })).toBe('/subscribers?active=true&limit=50');
    // Trừ khi patch nói rõ trang nào.
    expect(subscribersHref(current, { page: 3 })).toBe('/subscribers?active=true&page=3');
  });

  it('thứ tự param CỐ ĐỊNH — href ổn định giữa hai lần render', () => {
    expect(subscribersHref(base, { source: 'footer', search: 'ada', active: true })).toBe(
      '/subscribers?active=true&q=ada&source=footer',
    );
  });
});

describe('SUBSCRIBERS_DEFAULT_HREF', () => {
  it('mở thẳng tab Active — danh sách đang gửi thư là việc thường ngày', () => {
    expect(SUBSCRIBERS_DEFAULT_HREF).toBe('/subscribers?active=true');
    expect(subscribersHref(base, { active: true })).toBe(SUBSCRIBERS_DEFAULT_HREF);
  });
});

describe('subscribersExportHref', () => {
  it('mang trọn bộ lọc nhưng BỎ phân trang — file là cả tập, không phải trang đang xem', () => {
    expect(
      subscribersExportHref({ page: 3, limit: 50, active: false, search: 'ada', source: 'footer' }),
    ).toBe('/subscribers/export?active=false&q=ada&source=footer');
  });

  it('tab All không có filter nào: đường trơn — file là toàn bộ danh sách', () => {
    expect(subscribersExportHref(base)).toBe('/subscribers/export');
  });
});
