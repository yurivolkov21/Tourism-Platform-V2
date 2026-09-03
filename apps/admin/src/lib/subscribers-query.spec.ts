import { describe, expect, it } from 'vitest';
import {
  parseSubscribersSearchParams,
  subscribersExportHref,
  subscribersHref,
} from './subscribers-query';

/**
 * Trạng thái bảng `/subscribers` trên URL (spec P4c §3-F10). Điểm riêng của
 * vùng này so với ba vùng trước: `active` là cờ BA TRẠNG THÁI, nên `false`
 * phải sống được trên URL — nó là tab "Unsubscribed", không phải "tắt filter"
 * — và MẶC ĐỊNH là Active ngay ở tầng parse (vòng vá review F10): URL trần
 * không được rơi vào All, tập PII rộng nhất.
 */

const base = { page: 1, limit: 20 };
const active = { ...base, active: true };

describe('parseSubscribersSearchParams', () => {
  it('URL trơn: trang 1, 20 dòng, tab ACTIVE (mặc định an toàn, không phải All)', () => {
    expect(parseSubscribersSearchParams({})).toEqual(active);
  });

  it('`active`: "true" và rác đều là Active; "false" là Unsubscribed; "all" mới là mọi hàng', () => {
    expect(parseSubscribersSearchParams({ active: 'true' })).toEqual(active);
    expect(parseSubscribersSearchParams({ active: 'false' })).toEqual({ ...base, active: false });
    expect(parseSubscribersSearchParams({ active: 'all' })).toEqual(base);
    // "1"/"yes"/"" là chỗ hai người đọc URL hiểu hai kiểu — rơi về tập HẸP
    // nhất, không đoán hộ thành All.
    expect(parseSubscribersSearchParams({ active: '1' })).toEqual(active);
    expect(parseSubscribersSearchParams({ active: 'yes' })).toEqual(active);
    expect(parseSubscribersSearchParams({ active: '' })).toEqual(active);
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
    expect(parseSubscribersSearchParams({ page: 'x', limit: '999' })).toEqual(active);
    expect(parseSubscribersSearchParams({ page: ['3', '9'] }).page).toBe(3);
  });
});

describe('subscribersHref', () => {
  it('tab Active mặc định thì href TRƠN — không viết `active=true`, trang 1 và limit mặc định cũng không', () => {
    expect(subscribersHref(active, {})).toBe('/subscribers');
    expect(subscribersHref(base, { active: true })).toBe('/subscribers');
  });

  it('`active: false` GHI `active=false` (tab Unsubscribed); `null` = tab All GHI `active=all` tường minh', () => {
    expect(subscribersHref(active, { active: false })).toBe('/subscribers?active=false');
    expect(subscribersHref(active, { active: null })).toBe('/subscribers?active=all');
    expect(subscribersHref(base, {})).toBe('/subscribers?active=all');
  });

  it('`undefined` GIỮ filter hiện tại — patch chỉ nói về thứ nó nhắc tới', () => {
    expect(subscribersHref({ ...base, active: false, search: 'ada' }, { page: 2 })).toBe(
      '/subscribers?active=false&q=ada&page=2',
    );
  });

  it('đổi filter hoặc số dòng mỗi trang đều ĐẶT LẠI trang về 1', () => {
    const current = { page: 5, limit: 20, active: true };
    expect(subscribersHref(current, { search: 'ada' })).toBe('/subscribers?q=ada');
    expect(subscribersHref(current, { limit: 50 })).toBe('/subscribers?limit=50');
    // Trừ khi patch nói rõ trang nào.
    expect(subscribersHref(current, { page: 3 })).toBe('/subscribers?page=3');
  });

  it('thứ tự param CỐ ĐỊNH — href ổn định giữa hai lần render', () => {
    expect(subscribersHref(base, { source: 'footer', search: 'ada', active: null })).toBe(
      '/subscribers?active=all&q=ada&source=footer',
    );
  });

  it('parse ∘ href là đồng nhất trên cả ba tab (URL đi một vòng không đổi nghĩa)', () => {
    for (const href of ['/subscribers', '/subscribers?active=false', '/subscribers?active=all']) {
      const raw = Object.fromEntries(new URL(href, 'http://x').searchParams);
      expect(subscribersHref(parseSubscribersSearchParams(raw), {})).toBe(href);
    }
  });
});

describe('subscribersExportHref', () => {
  it('mang trọn bộ lọc nhưng BỎ phân trang — file là cả tập, không phải trang đang xem', () => {
    expect(
      subscribersExportHref({ page: 3, limit: 50, active: false, search: 'ada', source: 'footer' }),
    ).toBe('/subscribers/export?active=false&q=ada&source=footer');
  });

  it('tab All là `active=all` TƯỜNG MINH trên URL export — route không được hiểu nhầm thành Active', () => {
    expect(subscribersExportHref(base)).toBe('/subscribers/export?active=all');
    expect(subscribersExportHref(active)).toBe('/subscribers/export');
  });
});
