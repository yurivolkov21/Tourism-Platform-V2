import { describe, expect, it } from 'vitest';
import { withNextOptions } from './client';

describe('withNextOptions', () => {
  it('gắn next.revalidate + tags từ client context vào RequestInit', () => {
    const init = withNextOptions({ method: 'GET' }, { next: { revalidate: 300, tags: ['posts'] } });
    expect(init).toMatchObject({ method: 'GET', next: { revalidate: 300, tags: ['posts'] } });
  });
  it('không context thì trả init nguyên vẹn (không thêm field next rỗng)', () => {
    expect(withNextOptions({ method: 'GET' }, undefined)).toEqual({ method: 'GET' });
  });
});
