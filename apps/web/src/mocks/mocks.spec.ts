import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sortPostsByDate } from '../lib/blog.js';
import { slugify } from '../lib/slug.js';
import { averageRating } from '../lib/tours.js';
import { DESTINATIONS } from './destinations.js';
import { JOURNAL_POSTS } from './journal.js';
import { REGIONS } from './regions.js';
import { TESTIMONIALS } from './testimonials.js';
import { TOUR_REVIEWS } from './tour-reviews.js';
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

describe('mock destinations — gương DestinationSchema', () => {
  it('đúng 9 địa điểm, xếp liền mạch Bắc → Trung → Nam', () => {
    expect(DESTINATIONS).toHaveLength(9);
    expect(DESTINATIONS.map((d) => d.region)).toEqual([
      'Northern Vietnam',
      'Northern Vietnam',
      'Northern Vietnam',
      'Central Vietnam',
      'Central Vietnam',
      'Central Vietnam',
      'Southern Vietnam',
      'Southern Vietnam',
      'Southern Vietnam',
    ]);
  });

  it('có đủ field contract yêu cầu, id là uuid v4', () => {
    for (const d of DESTINATIONS) {
      expect(d.id, d.slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);
      expect(d.country, d.slug).toBe('Vietnam');
      expect(typeof d.description, d.slug).toBe('string');
    }
  });

  it('slug duy nhất', () => {
    expect(new Set(DESTINATIONS.map((d) => d.slug)).size).toBe(9);
  });

  // Bất biến quan trọng nhất. `tourCount` viết tay đang phồng 2–5× (Hạ Long khai 9,
  // thật 2) nên thẻ nói "9 tours" mà bấm sang /tours?destinations=ha-long ra 2 —
  // đúng lỗi "See all 1,204 reviews" mở ra 14 dòng.
  it('tourCount DẪN XUẤT khớp số tour thật chạm địa điểm', () => {
    for (const d of DESTINATIONS) {
      const real = TOURS.filter((t) => t.destinations.some((x) => x.slug === d.slug)).length;
      expect(d.tourCount, d.slug).toBe(real);
    }
  });

  it('tổng lượt chạm là 25 — chốt chặn nếu ai nhét lại literal (tổng cũ 68)', () => {
    expect(DESTINATIONS.reduce((a, d) => a + d.tourCount, 0)).toBe(25);
  });
});

describe('mock regions', () => {
  it('có slug URL cho cả 3 vùng', () => {
    expect(REGIONS.map((r) => r.slug)).toEqual([
      'northern-vietnam',
      'central-vietnam',
      'southern-vietnam',
    ]);
  });

  it('KHÔNG còn tourCount viết tay', () => {
    for (const r of REGIONS) expect(r, r.key).not.toHaveProperty('tourCount');
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

describe('TOURS.media — bất biến gương theo MediaItemSchema', () => {
  it('mỗi tour có tối đa MỘT ảnh role hero', () => {
    // Bố cục khảm dựa vào đúng một ảnh dẫn; hai hero thì không quyết được ô lớn
    // là ảnh nào, và thứ tự sẽ phụ thuộc vào may mắn của sortOrder.
    for (const tour of TOURS) {
      expect(tour.media.filter((m) => m.role === 'hero').length).toBeLessThanOrEqual(1);
    }
  });

  it('media sắp tăng dần theo sortOrder', () => {
    for (const tour of TOURS) {
      const orders = tour.media.map((m) => m.sortOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it('publicId không trùng trong cùng một tour', () => {
    for (const tour of TOURS) {
      const ids = tour.media.map((m) => m.publicId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('mọi url là URL tuyệt đối hợp lệ — sitemap/JSON-LD sau này cần vậy', () => {
    for (const tour of TOURS) {
      for (const item of tour.media) {
        expect(() => new URL(item.url)).not.toThrow();
      }
    }
  });

  it('hiện tại KHÔNG có media type VIDEO — UI chưa xử lý nhánh đó', () => {
    // Contract cho phép VIDEO (kèm posterUrl), nhưng gallery mới chỉ render ảnh.
    // Test này ĐỎ khi ai đó thêm VIDEO vào mock — đó là ý đồ: nó nhắc phải dựng
    // UI video trước, chứ không phải để chặn dữ liệu vĩnh viễn.
    for (const tour of TOURS) {
      for (const item of tour.media) expect(item.type).toBe('IMAGE');
    }
  });
});

describe('TOURS.media — mọi nhánh bố cục phải có mock chứng minh', () => {
  it('có tour KHÔNG ảnh nào — gallery phải biến mất sạch', () => {
    expect(TOURS.some((t) => t.media.length === 0)).toBe(true);
  });

  it('có tour đúng MỘT ảnh — không đủ để xếp khảm', () => {
    expect(TOURS.some((t) => t.media.length === 1)).toBe(true);
  });

  it('có tour ít ảnh (2–4) và tour nhiều ảnh (≥6)', () => {
    expect(TOURS.some((t) => t.media.length >= 2 && t.media.length <= 4)).toBe(true);
    expect(TOURS.some((t) => t.media.length >= 6)).toBe(true);
  });

  it('có ảnh alt null — ép nhánh đường lùi cho nhãn trình đọc màn hình', () => {
    expect(TOURS.some((t) => t.media.some((m) => m.alt === null))).toBe(true);
  });

  it('có ảnh không có width/height — bố cục không được phụ thuộc tỉ lệ nội tại', () => {
    expect(TOURS.some((t) => t.media.some((m) => m.width === null && m.height === null))).toBe(
      true,
    );
  });
});

describe('TOUR_REVIEWS — bất biến gương theo PublicReviewSchema', () => {
  const all = Object.values(TOUR_REVIEWS).flat();

  it('rating là số NGUYÊN trong 1..5 (RatingSchema)', () => {
    for (const review of all) {
      expect(Number.isInteger(review.rating)).toBe(true);
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
  });

  it('id không trùng trên TOÀN BỘ mock, không chỉ trong một tour', () => {
    // Khi gắn API, id là uuid toàn cục; mock trùng id giữa hai tour sẽ che mất lỗi
    // key trùng ở React lúc dialog render danh sách gộp.
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('authorDeleted và authorName luôn nhất quán', () => {
    // Schema ghi rõ: authorName null KHI tác giả đã xoá tài khoản. Một review có
    // tên mà authorDeleted=true (hoặc ngược lại) là dữ liệu tự mâu thuẫn.
    for (const review of all) {
      expect(review.authorDeleted).toBe(review.authorName === null);
    }
  });

  it('body không rỗng và createdAt là ISO datetime parse được', () => {
    for (const review of all) {
      expect(review.body.trim().length).toBeGreaterThan(0);
      expect(Number.isNaN(new Date(review.createdAt).getTime())).toBe(false);
      // Có múi giờ tường minh — đây là lý do formatReviewDate được dùng new Date()
      // trong khi departures thì không.
      expect(review.createdAt).toMatch(/Z$/);
    }
  });
});

describe('TOUR_REVIEWS — rating của tour phải DẪN XUẤT đúng từ review', () => {
  it('ratingCount bằng số review, ratingAvg bằng trung bình thật', () => {
    // Bất biến quan trọng nhất của cụm này: hero in "4.8 (12)" thì 12 phải là số
    // review người đọc bấm vào xem được, và 4.8 phải tính từ chính 12 cái đó.
    for (const tour of TOURS) {
      const reviews = TOUR_REVIEWS[tour.slug] ?? [];
      expect(tour.ratingCount).toBe(reviews.length);
      expect(tour.ratingAvg).toBe(averageRating(reviews));
    }
  });

  it('có tour chưa ai đánh giá — ratingAvg null, KHÔNG phải 0', () => {
    const unrated = TOURS.filter((t) => t.ratingAvg === null);
    expect(unrated.length).toBeGreaterThan(0);
    for (const tour of unrated) expect(tour.ratingCount).toBe(0);
  });
});

describe('TOUR_REVIEWS — mọi nhánh UI phải có mock chứng minh', () => {
  const counts = TOURS.map((t) => t.ratingCount);

  it('có tour đúng MỘT review — ép nhánh số ít "1 review"', () => {
    expect(counts).toContain(1);
  });

  it('có tour ĐÚNG 3 review — dưới ngưỡng nên KHÔNG có nút xem tất cả', () => {
    expect(counts).toContain(3);
  });

  it('có tour >10 review để dialog có nhiều hơn một trang', () => {
    expect(counts.some((c) => c > 10)).toBe(true);
  });

  it('có review của tài khoản đã xoá, có review không tiêu đề', () => {
    const all = Object.values(TOUR_REVIEWS).flat();
    expect(all.some((r) => r.authorDeleted)).toBe(true);
    expect(all.some((r) => r.title === null)).toBe(true);
    expect(all.some((r) => r.title !== null)).toBe(true);
  });
});
