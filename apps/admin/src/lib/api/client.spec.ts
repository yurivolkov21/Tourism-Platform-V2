import { describe, expect, it } from 'vitest';
import { withAdminAuth, withAdminOptions } from './client';

/**
 * Client oRPC của admin (spec P4b §2.3) rút gọn từ bản web: chỉ còn ĐƯỜNG
 * SERVER cookie-forward, không có nhánh browser-credentials và không có
 * revalidate/tag — back-office luôn đọc dữ liệu tươi.
 */
describe('withAdminAuth', () => {
  it('bọc cookie thành context dùng thẳng cho call oRPC', () => {
    expect(withAdminAuth('better-auth.session_token=abc')).toEqual({
      cookie: 'better-auth.session_token=abc',
    });
  });
});

describe('withAdminOptions', () => {
  it('forward cookie mà GIỮ header oRPC đã đặt trên request gốc', () => {
    const request = new Request('http://api.test/x', { headers: { accept: 'application/json' } });
    const init = withAdminOptions(request, { method: 'GET' }, { cookie: 'session=abc' });

    const headers = init.headers as Headers;
    expect(headers.get('cookie')).toBe('session=abc');
    expect(headers.get('accept')).toBe('application/json');
    expect(init.method).toBe('GET');
  });

  it('LUÔN no-store — mọi bề mặt admin là dữ liệu quản trị, không được cache', () => {
    const request = new Request('http://api.test/x');
    expect(withAdminOptions(request, {}, { cookie: 'session=abc' }).cache).toBe('no-store');
  });

  it('không có context vẫn no-store, và không bịa header cookie rỗng', () => {
    const request = new Request('http://api.test/x');
    const init = withAdminOptions(request, { method: 'GET' }, undefined);
    expect(init).toEqual({ method: 'GET', cache: 'no-store' });
  });
});
