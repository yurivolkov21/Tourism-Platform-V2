import { POST_TITLE_MAX } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  parsePostsSearchParams,
  parsePostsStatus,
  postsHref,
  toPostsListInput,
} from './posts-query';

describe('parsePostsSearchParams', () => {
  it('rác trên URL rơi về mặc định an toàn, không ném lên API', () => {
    expect(parsePostsSearchParams({ status: 'archived', q: '   ', page: 'x' })).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('đọc tab, ô tìm (trim) và trang', () => {
    expect(parsePostsSearchParams({ status: 'scheduled', q: '  Hoi An ', page: '2' })).toEqual({
      page: 2,
      limit: 20,
      status: 'scheduled',
      search: 'Hoi An',
    });
  });

  it('ô tìm cắt đúng trần tiêu đề của contract', () => {
    const query = parsePostsSearchParams({ q: 'x'.repeat(POST_TITLE_MAX + 5) });
    expect(query.search).toHaveLength(POST_TITLE_MAX);
  });
});

describe('parsePostsStatus', () => {
  it('chỉ ba tab; "all" và chữ hoa là không hợp lệ (URL dùng chữ thường)', () => {
    expect(parsePostsStatus('draft')).toBe('draft');
    expect(parsePostsStatus('all')).toBeNull();
    expect(parsePostsStatus('DRAFT')).toBeNull();
  });
});

describe('postsHref', () => {
  const base = { page: 3, limit: 20, status: 'draft' as const, search: 'tea' };

  it('đổi tab đặt lại trang về 1', () => {
    expect(postsHref(base, { status: 'published' })).toBe('/posts?status=published&q=tea');
  });

  it('`null` xoá bộ lọc; về mặc định thì không còn dấu `?`', () => {
    expect(postsHref(base, { status: null, search: null })).toBe('/posts');
  });

  it('đổi trang giữ bộ lọc, thứ tự param cố định', () => {
    expect(postsHref({ ...base, page: 1 }, { page: 2 })).toBe('/posts?status=draft&q=tea&page=2');
  });
});

describe('toPostsListInput', () => {
  it('vắng tab là all; vắng ô tìm thì không gửi', () => {
    expect(toPostsListInput({ page: 1, limit: 20 })).toEqual({ page: 1, limit: 20, status: 'all' });
  });
});
