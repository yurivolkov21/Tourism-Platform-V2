import { describe, expect, it } from 'vitest';
import { postPageUrl, SITE_URL, tourPageUrl } from './site';

/** Địa chỉ site khách — một bản cho mọi link từ admin sang www. */
describe('tourPageUrl', () => {
  it('trang tour trên site khách; slug được mã hoá', () => {
    expect(SITE_URL).toBe('https://www.nexora-travel.agency');
    expect(tourPageUrl('ha-long-bay-cruise')).toBe(
      'https://www.nexora-travel.agency/tours/ha-long-bay-cruise',
    );
    expect(tourPageUrl('ha long')).toBe('https://www.nexora-travel.agency/tours/ha%20long');
  });
});

describe('postPageUrl', () => {
  it('trang bài trên site khách; slug được mã hoá', () => {
    expect(postPageUrl('eating-in-hoi-an')).toBe(
      'https://www.nexora-travel.agency/blog/eating-in-hoi-an',
    );
    expect(postPageUrl('a b')).toBe('https://www.nexora-travel.agency/blog/a%20b');
  });
});
