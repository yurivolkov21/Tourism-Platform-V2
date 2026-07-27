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

// TOURS là mock DUY NHẤT gương theo contract backend (TourCard/TourDetailSchema)
// thay vì shape tự do như các mock khác — tour đã có contract chốt và giàu hơn
// UI, nên đi theo nó ngay từ đầu để lúc gắn API là swap nguồn, không phải
// rename khắp component. Bộ test dưới đây canh chính sự-gương-đúng đó.
const DECIMAL = /^\d+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('mock tours — bất biến gương theo contract', () => {
  it('có đủ 16 tour để limit=12 sinh ra trang 2 thật', () => {
    expect(TOURS).toHaveLength(16);
  });

  it('slug và id không trùng', () => {
    expect(new Set(TOURS.map((t) => t.slug)).size).toBe(TOURS.length);
    expect(new Set(TOURS.map((t) => t.id)).size).toBe(TOURS.length);
  });

  it('mọi trường tiền là chuỗi thập phân, không phải number', () => {
    for (const tour of TOURS) {
      expect(tour.basePrice, tour.slug).toMatch(DECIMAL);
      if (tour.compareAtPrice !== null) expect(tour.compareAtPrice, tour.slug).toMatch(DECIMAL);
      for (const dep of tour.departures) {
        expect(dep.effectivePrice, tour.slug).toMatch(DECIMAL);
        if (dep.compareAtPrice !== null) expect(dep.compareAtPrice, tour.slug).toMatch(DECIMAL);
      }
    }
  });

  it('giá gạch luôn CAO HƠN giá gốc — ngược lại thì chip giảm giá vô nghĩa', () => {
    for (const tour of TOURS) {
      if (tour.compareAtPrice !== null) {
        expect(Number(tour.compareAtPrice), tour.slug).toBeGreaterThan(Number(tour.basePrice));
      }
    }
  });

  it('mỗi tour có đúng MỘT destination isPrimary', () => {
    for (const tour of TOURS) {
      expect(
        tour.destinations.filter((d) => d.isPrimary),
        tour.slug,
      ).toHaveLength(1);
    }
  });

  it('mọi destination slug đều tồn tại trong DESTINATIONS', () => {
    const known = new Set(DESTINATIONS.map((d) => d.slug));
    for (const tour of TOURS) {
      for (const dest of tour.destinations) expect(known, tour.slug).toContain(dest.slug);
    }
  });

  it('itinerary có đúng durationDays ngày, đánh số 1..n liên tục', () => {
    for (const tour of TOURS) {
      expect(tour.itinerary, tour.slug).toHaveLength(tour.durationDays);
      expect(
        tour.itinerary.map((d) => d.dayNumber),
        tour.slug,
      ).toEqual(Array.from({ length: tour.durationDays }, (_, i) => i + 1));
    }
  });

  it('departures là ngày lịch, sort tăng dần, endDate không trước startDate', () => {
    for (const tour of TOURS) {
      const starts = tour.departures.map((d) => d.startDate);
      expect(starts, tour.slug).toEqual([...starts].sort());
      for (const dep of tour.departures) {
        expect(dep.startDate, tour.slug).toMatch(ISO_DATE);
        expect(dep.endDate, tour.slug).toMatch(ISO_DATE);
        expect(dep.endDate >= dep.startDate, tour.slug).toBe(true);
        expect(dep.seatsLeft, tour.slug).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('ratingAvg null nghĩa là chưa ai đánh giá — ratingCount phải bằng 0', () => {
    for (const tour of TOURS) {
      if (tour.ratingAvg === null) {
        expect(tour.ratingCount, tour.slug).toBe(0);
      } else {
        expect(tour.ratingAvg, tour.slug).toBeGreaterThanOrEqual(0);
        expect(tour.ratingAvg, tour.slug).toBeLessThanOrEqual(5);
        expect(tour.ratingCount, tour.slug).toBeGreaterThan(0);
      }
    }
  });
});

describe('mock tours — mọi nhánh nullable phải có mock chứng minh', () => {
  it('có tour chưa ai đánh giá', () => {
    expect(TOURS.some((t) => t.ratingAvg === null)).toBe(true);
  });
  it('có tour không giá gạch', () => {
    expect(TOURS.some((t) => t.compareAtPrice === null)).toBe(true);
  });
  it('có tour chưa mở đợt khởi hành nào', () => {
    expect(TOURS.some((t) => t.departures.length === 0)).toBe(true);
  });
  it('có đợt khởi hành đã hết chỗ', () => {
    expect(TOURS.some((t) => t.departures.some((d) => d.seatsLeft === 0))).toBe(true);
  });
  it('có tour không ghi độ khó', () => {
    expect(TOURS.some((t) => t.difficulty === null)).toBe(true);
  });
  it('có tour không có điểm hẹn', () => {
    expect(TOURS.some((t) => t.meetingPoint === null)).toBe(true);
  });
  it('có tour không có tóm tắt', () => {
    expect(TOURS.some((t) => t.summary === null)).toBe(true);
  });
  it('có ngày trong itinerary bỏ trống mô tả', () => {
    expect(TOURS.some((t) => t.itinerary.some((d) => d.description === null))).toBe(true);
  });
  it('có tour không có FAQ nào', () => {
    expect(TOURS.some((t) => t.faqs.length === 0)).toBe(true);
  });
  it('phủ đủ 3 mức độ khó', () => {
    const levels = new Set(TOURS.map((t) => t.difficulty).filter(Boolean));
    expect(levels).toEqual(new Set(['EASY', 'MODERATE', 'CHALLENGING']));
  });
  it('phủ ít nhất 5 chuyên mục và cả 9 địa danh', () => {
    expect(new Set(TOURS.map((t) => t.category.slug)).size).toBeGreaterThanOrEqual(5);
    const used = new Set(TOURS.flatMap((t) => t.destinations.map((d) => d.slug)));
    expect(used.size).toBe(DESTINATIONS.length);
  });
  it('có ít nhất 3 tour featured', () => {
    expect(TOURS.filter((t) => t.isFeatured).length).toBeGreaterThanOrEqual(3);
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
