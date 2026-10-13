import { afterEach, describe, expect, it, vi } from 'vitest';
import { postPageUrl, resolveWebOrigin, tourPageUrl, webUrl } from './site';

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Origin site khách mà admin link sang (G19). Trước đây là hằng cứng của prod, nên ở máy dev
 * "View on site" của tour trong DB local mở trang prod: 404, hoặc một tour khác cùng slug.
 */
describe('resolveWebOrigin (G19)', () => {
  it('không khai, production: origin thật — bản deploy chưa có biến này mà link vẫn đúng', () => {
    expect(resolveWebOrigin({ raw: undefined, nodeEnv: 'production' })).toBe(
      'https://www.nexora-travel.agency',
    );
  });

  it('chuỗi rỗng là "không khai" — nền tảng deploy gửi "" khi ô bị bỏ trống', () => {
    expect(resolveWebOrigin({ raw: '', nodeEnv: 'production' })).toBe(
      'https://www.nexora-travel.agency',
    );
    expect(resolveWebOrigin({ raw: '', nodeEnv: 'development' })).toBe('http://localhost:3000');
  });

  it('không khai, dev và test: web local ở cổng mặc định của `next dev`, không phải prod', () => {
    expect(resolveWebOrigin({ raw: undefined, nodeEnv: 'development' })).toBe(
      'http://localhost:3000',
    );
    expect(resolveWebOrigin({ raw: undefined, nodeEnv: 'test' })).toBe('http://localhost:3000');
  });

  it('có khai: lấy ORIGIN, bỏ dấu / cuối và path thừa', () => {
    expect(resolveWebOrigin({ raw: 'http://localhost:4000/', nodeEnv: 'development' })).toBe(
      'http://localhost:4000',
    );
    expect(
      resolveWebOrigin({ raw: 'https://staging.example.com/vi/home', nodeEnv: 'production' }),
    ).toBe('https://staging.example.com');
  });

  it('giá trị hỏng hoặc không phải http(s): ném, và câu lỗi nêu tên biến', () => {
    // Thiếu scheme thì `URL` đọc "localhost:" thành scheme — phải ném, không được trả 'null'.
    for (const raw of ['not a url', 'localhost:3000', 'javascript:alert(1)']) {
      expect(() => resolveWebOrigin({ raw, nodeEnv: 'production' })).toThrow(/NEXT_PUBLIC_WEB_URL/);
    }
  });
});

describe('webUrl', () => {
  it('đọc NEXT_PUBLIC_WEB_URL — KHÔNG phải NEXT_PUBLIC_SITE_URL, thứ là origin của chính admin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3002');
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'http://localhost:4000');

    expect(webUrl()).toBe('http://localhost:4000');
  });
});

describe('tourPageUrl', () => {
  it('trang tour trên site khách; slug được mã hoá', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://www.nexora-travel.agency');

    expect(tourPageUrl('ha-long-bay-cruise')).toBe(
      'https://www.nexora-travel.agency/tours/ha-long-bay-cruise',
    );
    expect(tourPageUrl('ha long')).toBe('https://www.nexora-travel.agency/tours/ha%20long');
  });

  it('theo origin đang khai — ở máy dev là web local', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'http://localhost:3000');

    expect(tourPageUrl('ha-long-bay-cruise')).toBe(
      'http://localhost:3000/tours/ha-long-bay-cruise',
    );
  });
});

describe('postPageUrl', () => {
  it('trang bài trên site khách; slug được mã hoá', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://www.nexora-travel.agency');

    expect(postPageUrl('eating-in-hoi-an')).toBe(
      'https://www.nexora-travel.agency/blog/eating-in-hoi-an',
    );
    expect(postPageUrl('a b')).toBe('https://www.nexora-travel.agency/blog/a%20b');
  });
});
