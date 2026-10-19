import { SITE_SLOTS } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { SITE_SLOT_KEYS } from './site-slot-keys.js';

describe('khoá khe của seed (ADR-0059 §1)', () => {
  it('seed tạo dòng cho mọi khe của danh mục ở contract', () => {
    const seeded = new Set<string>(SITE_SLOT_KEYS);
    expect(SITE_SLOTS.filter((slot) => !seeded.has(slot.key)).map((slot) => slot.key)).toEqual([]);
  });

  it('ngoài danh mục chỉ còn năm khoá web không đọc', () => {
    const catalogue = new Set<string>(SITE_SLOTS.map((slot) => slot.key));
    expect(SITE_SLOT_KEYS.filter((key) => !catalogue.has(key)).sort()).toEqual([
      'about-team-ops',
      'content-hero',
      'destinations-hero',
      'home-experiences',
      'home-trust',
    ]);
  });
});
