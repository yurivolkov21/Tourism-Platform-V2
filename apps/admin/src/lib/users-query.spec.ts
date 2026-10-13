import { describe, expect, it } from 'vitest';
import { parseUsersSearchParams, userDetailHref, usersBackHref, usersHref } from './users-query';

const ID = '11111111-1111-4111-8111-111111111111';

describe('parseUsersSearchParams', () => {
  it('URL trần: trang 1, 20 dòng, tab All (không có view)', () => {
    expect(parseUsersSearchParams({})).toEqual({ page: 1, limit: 20 });
  });

  it('view staff/locked giữ; all và rác rơi về All', () => {
    expect(parseUsersSearchParams({ view: 'staff' }).view).toBe('staff');
    expect(parseUsersSearchParams({ view: 'locked' }).view).toBe('locked');
    expect(parseUsersSearchParams({ view: 'all' }).view).toBeUndefined();
    expect(parseUsersSearchParams({ view: 'owners' }).view).toBeUndefined();
  });

  it('q được trim; rỗng là không lọc; quá dài cắt đúng 120', () => {
    expect(parseUsersSearchParams({ q: '  ada  ' }).search).toBe('ada');
    expect(parseUsersSearchParams({ q: '   ' }).search).toBeUndefined();
    expect(parseUsersSearchParams({ q: 'x'.repeat(130) }).search).toHaveLength(120);
  });
});

describe('usersHref', () => {
  it('đổi tab hay ô tìm thì về trang 1; giữ filter còn lại', () => {
    const current = { page: 3, limit: 20, view: 'staff' as const, search: 'ada' };
    expect(usersHref(current, { view: 'locked' })).toBe('/users?view=locked&q=ada');
    expect(usersHref(current, { search: null })).toBe('/users?view=staff');
    expect(usersHref(current, { page: 2 })).toBe('/users?view=staff&q=ada&page=2');
  });

  it('view null xoá tab — URL trần là tab All', () => {
    expect(usersHref({ page: 1, limit: 20, view: 'staff' }, { view: null })).toBe('/users');
  });
});

describe('userDetailHref / usersBackHref', () => {
  it('chỉ mang ?back= khi danh sách đang đứng KHÁC URL trần', () => {
    expect(userDetailHref(ID, '/users')).toBe(`/users/${ID}`);
    expect(userDetailHref(ID, '/users?view=locked')).toBe(
      `/users/${ID}?back=%2Fusers%3Fview%3Dlocked`,
    );
  });

  it('back chỉ nhận đường /users — chống open redirect', () => {
    expect(usersBackHref('/users?view=staff&q=ada')).toBe('/users?view=staff&q=ada');
    expect(usersBackHref('https://evil.example/users')).toBe('/users');
    expect(usersBackHref('/bookings')).toBe('/users');
    expect(usersBackHref(`/users/${ID}`)).toBe('/users');
    expect(usersBackHref(undefined)).toBe('/users');
  });
});
