import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JOURNAL_POSTS } from './journal.js';
import { REGIONS } from './regions.js';
import { TESTIMONIALS } from './testimonials.js';
import { TOURS } from './tours.js';

// Bất biến của mock trang Home — mock là công cụ khám phá schema nên shape tự do,
// nhưng dữ liệu phải tự nhất quán (ảnh tồn tại, slug duy nhất, đủ 3 vùng).
const PUBLIC_DIR = join(import.meta.dirname, '../../public');

describe('mock tours', () => {
  it('đúng 6 tour, slug duy nhất', () => {
    expect(TOURS).toHaveLength(6);
    expect(new Set(TOURS.map((t) => t.slug)).size).toBe(6);
  });

  it('ảnh nằm trong /mock/ và file tồn tại thật', () => {
    for (const t of TOURS) {
      expect(t.image, t.slug).toMatch(/^\/mock\/[a-z-]+\.jpg$/);
      expect(existsSync(join(PUBLIC_DIR, t.image)), t.image).toBe(true);
    }
  });

  it('rating hợp lệ [0,5] và mỗi vùng có ít nhất 1 tour', () => {
    for (const t of TOURS) {
      expect(t.rating).toBeGreaterThanOrEqual(0);
      expect(t.rating).toBeLessThanOrEqual(5);
    }
    const regions = new Set(TOURS.map((t) => t.region));
    expect([...regions].sort()).toEqual(['central', 'north', 'south']);
  });

  it('tối đa 1 tour có flag khuyến mãi (đỏ sơn mài dùng tiết chế)', () => {
    expect(TOURS.filter((t) => t.flag).length).toBeLessThanOrEqual(1);
  });
});

describe('mock regions / testimonials / journal', () => {
  it('đủ 3 vùng north/central/south', () => {
    expect(REGIONS.map((r) => r.key).sort()).toEqual(['central', 'north', 'south']);
  });

  it('3 testimonial rating hợp lệ, 3 bài journal có ảnh tồn tại', () => {
    expect(TESTIMONIALS).toHaveLength(3);
    for (const t of TESTIMONIALS) {
      expect(t.rating).toBeGreaterThanOrEqual(4);
      expect(t.rating).toBeLessThanOrEqual(5);
    }
    expect(JOURNAL_POSTS).toHaveLength(3);
    for (const p of JOURNAL_POSTS) {
      expect(existsSync(join(PUBLIC_DIR, p.image)), p.image).toBe(true);
    }
  });
});
