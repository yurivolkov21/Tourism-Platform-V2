import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sortPostsByDate } from '../lib/blog.js';
import { slugify } from '../lib/slug.js';
import { DESTINATIONS } from './destinations.js';
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

  it('8 testimonial (marquee 2 cột × 4) đủ trường; mỗi bài journal có ảnh tồn tại + category/author', () => {
    // Marquee của template Estate cần 2 cột × 4 card để loop mượt.
    expect(TESTIMONIALS).toHaveLength(8);
    for (const t of TESTIMONIALS) {
      expect(t.rating).toBeGreaterThanOrEqual(4);
      expect(t.rating).toBeLessThanOrEqual(5);
      expect(t.location.length).toBeGreaterThan(0);
    }
    // Số lượng chính xác (9 bài) được canh riêng ở describe('mock journal') bên dưới.
    for (const p of JOURNAL_POSTS) {
      expect(existsSync(join(PUBLIC_DIR, p.image)), p.image).toBe(true);
      // Card Journal (#33, convert forged/Blog) cần chip chuyên mục + tác giả
      expect(p.category.length, p.slug).toBeGreaterThan(0);
      expect(p.author.length, p.slug).toBeGreaterThan(0);
    }
  });
});

describe('mock team (About §5 — chỉ founder/vận hành, quyết định user 23/07)', () => {
  it('4 thành viên, đủ tên/chức danh/chữ ký, tên duy nhất', async () => {
    const { TEAM } = await import('./team.js');
    expect(TEAM).toHaveLength(4);
    expect(new Set(TEAM.map((m: { name: string }) => m.name)).size).toBe(4);
    for (const m of TEAM) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.role.length).toBeGreaterThan(0);
      expect(m.line.length).toBeGreaterThan(0);
    }
  });
});

describe('mock contact page (offices + faq)', () => {
  it('2 văn phòng đủ trường', async () => {
    const { OFFICES } = await import('./offices.js');
    expect(OFFICES).toHaveLength(2);
    for (const o of OFFICES) {
      expect(o.city.length).toBeGreaterThan(0);
      expect(o.addressLines.length).toBeGreaterThan(0);
      expect(o.hours.length).toBeGreaterThan(0);
    }
  });

  it('5 câu FAQ pre-sales, câu hỏi duy nhất', async () => {
    const { FAQ_ITEMS } = await import('./faq.js');
    expect(FAQ_ITEMS).toHaveLength(5);
    expect(new Set(FAQ_ITEMS.map((f: { question: string }) => f.question)).size).toBe(5);
    for (const f of FAQ_ITEMS) {
      expect(f.answer.length).toBeGreaterThan(0);
    }
  });
});

describe('mock destinations (gallery Home — review #14)', () => {
  it('đúng 9 địa điểm, mỗi vùng 3, xếp liền nhau Bắc → Trung → Nam', () => {
    expect(DESTINATIONS).toHaveLength(9);
    // Nhóm liền mạch theo thứ tự vùng — không xen kẽ
    expect(DESTINATIONS.map((d) => d.region)).toEqual([
      'north',
      'north',
      'north',
      'central',
      'central',
      'central',
      'south',
      'south',
      'south',
    ]);
  });

  it('tổng số tour mỗi vùng khớp với REGIONS (một nguồn sự thật)', () => {
    for (const region of REGIONS) {
      const sum = DESTINATIONS.filter((d) => d.region === region.key).reduce(
        (acc, d) => acc + d.tourCount,
        0,
      );
      expect(sum, region.key).toBe(region.tourCount);
    }
  });
});

describe('mock journal', () => {
  it('đúng 9 bài, slug duy nhất', () => {
    expect(JOURNAL_POSTS).toHaveLength(9);
    expect(new Set(JOURNAL_POSTS.map((p) => p.slug)).size).toBe(9);
  });

  it('ngày đăng không trùng nhau — sắp xếp mới-nhất-trước mới ổn định', () => {
    const dates = JOURNAL_POSTS.map((p) => p.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('ảnh nằm trong /mock/ và file tồn tại thật', () => {
    for (const post of JOURNAL_POSTS) {
      expect(post.image.startsWith('/mock/')).toBe(true);
      expect(existsSync(join(PUBLIC_DIR, post.image))).toBe(true);
    }
  });

  it('mỗi bài có ít nhất 3 section, heading sinh slug duy nhất', () => {
    for (const post of JOURNAL_POSTS) {
      expect(post.sections.length).toBeGreaterThanOrEqual(3);
      const slugs = post.sections.map((s) => slugify(s.heading));
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  // Canh đúng lỗi vừa xảy ra (task 3c mục 1): Task 1 nâng mock 3→9 bài làm
  // Home render tràn 9 card trong lưới md:grid-cols-3 vốn thiết kế cho 3.
  // Review sau đó chỉ ra bản cũ của test này tự tính lại
  // `sortPostsByDate(...).slice(0, 3)` rồi assert độ dài 3 — tautology, luôn
  // đúng bất kể component/hàm thật làm gì (đổi HOME_TEASER_COUNT 3→5 thì test
  // này vẫn xanh). Phần có giá trị duy nhất là bài mới nhất trong mock đúng
  // ngày nào — giữ lại đúng phần đó, bỏ phần đếm độ dài vô nghĩa. Việc "lấy
  // đúng 3 bài" đã có test riêng canh HOME_TEASER_COUNT/homeTeaserPosts ở
  // lib/blog.spec.ts; verify HTML thật (curl vào section#journal) mới bắt
  // được lỗi runtime nếu component bỏ .slice().
  it('bài mới nhất trong mock journal là 2026-10-02', () => {
    expect(sortPostsByDate(JOURNAL_POSTS)[0]?.date).toBe('2026-10-02');
  });
});
