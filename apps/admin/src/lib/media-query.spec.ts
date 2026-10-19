import { describe, expect, it } from 'vitest';
import { MEDIA_SEARCH_MAX, mediaHref, parseMediaSearchParams } from './media-query';

describe('parseMediaSearchParams', () => {
  it('rác trên URL rơi về mặc định: tab In use, không lọc', () => {
    expect(parseMediaSearchParams({ tab: 'trash', used: 'videos', show: 'x', q: '  ' })).toEqual({
      tab: 'inUse',
    });
  });

  it('đọc tab, hai bộ lọc và ô tìm (trim)', () => {
    expect(
      parseMediaSearchParams({ tab: 'queue', used: 'library', show: 'nocredit', q: ' Hoi An ' }),
    ).toEqual({ tab: 'queue', used: 'library', show: 'nocredit', search: 'Hoi An' });
  });

  it('param lặp lấy giá trị đầu; ô tìm cắt ở trần', () => {
    const query = parseMediaSearchParams({
      used: ['posts', 'tours'],
      q: 'x'.repeat(MEDIA_SEARCH_MAX + 5),
    });
    expect(query.used).toBe('posts');
    expect(query.search).toHaveLength(MEDIA_SEARCH_MAX);
  });
});

describe('mediaHref', () => {
  const base = { tab: 'inUse' as const, used: 'tours' as const, show: 'attention' as const };

  it('thứ tự param cố định; tab mặc định không viết ra URL', () => {
    expect(mediaHref(base, { search: 'lantern' })).toBe(
      '/media?used=tours&show=attention&q=lantern',
    );
  });

  it('`null` xoá bộ lọc; về mặc định thì không còn dấu `?`', () => {
    expect(mediaHref(base, { used: null, show: null })).toBe('/media');
  });

  it('sang tab Cleanup queue giữ bộ lọc của In use để quay lại không mất', () => {
    expect(mediaHref(base, { tab: 'queue' })).toBe('/media?tab=queue&used=tours&show=attention');
    expect(mediaHref({ ...base, tab: 'queue' }, { tab: 'inUse' })).toBe(
      '/media?used=tours&show=attention',
    );
  });
});
