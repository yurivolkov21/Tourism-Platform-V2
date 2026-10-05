import { describe, expect, it } from 'vitest';
import { CREATE_PARAM, createHref, wantsCreate, withoutCreateParam } from './create-param';

/** Tham số URL của Quick Create (spec 2026-10-05 §2.5). */
describe('create-param', () => {
  it('createHref gắn `create=1` vào trang vùng', () => {
    expect(createHref('/categories')).toBe('/categories?create=1');
    expect(CREATE_PARAM).toBe('create');
  });

  it('wantsCreate chỉ nhận đúng giá trị 1', () => {
    expect(wantsCreate({ create: '1' })).toBe(true);
    expect(wantsCreate({ create: '0' })).toBe(false);
    expect(wantsCreate({})).toBe(false);
    expect(wantsCreate({ create: ['1', '1'] })).toBe(false);
  });

  it('withoutCreateParam gỡ riêng `create`, giữ mọi tham số khác', () => {
    expect(withoutCreateParam('/tours', 'create=1&status=live')).toBe('/tours?status=live');
    expect(withoutCreateParam('/tours', 'create=1')).toBe('/tours');
  });
});
