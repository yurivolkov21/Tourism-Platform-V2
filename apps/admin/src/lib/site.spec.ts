import { describe, expect, it } from 'vitest';
import { SITE_URL, tourPageUrl } from './site';

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
