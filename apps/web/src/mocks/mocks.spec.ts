import { describe, expect, it } from 'vitest';
import { MOMENTS } from './moments.js';
import { REGIONS } from './regions.js';
import { TESTIMONIALS } from './testimonials.js';

// Bất biến của mock trang Home — mock là công cụ khám phá schema nên shape tự do,
// nhưng dữ liệu phải tự nhất quán (ảnh tồn tại, slug duy nhất, đủ 3 vùng).
//
// `mocks/tours.ts` + `mocks/destinations.ts` + `mocks/tour-media.ts` +
// `mocks/tour-reviews.ts` đã khai tử ở Task 7 (cụm destinations-api) — mọi
// describe canh bất biến của bốn mock đó (gương TourCard/TourDetailSchema,
// MediaItemSchema, PublicReviewSchema, DestinationSchema) đã bị CẮT theo cùng
// đợt: catalogue giờ đọc thẳng API, và test tương đương đã chuyển sang nghiệm
// thu production build (spec §4). Dữ liệu cũ chưa mất hẳn — nó sống tiếp làm
// fixture test THUẦN LOGIC ở `test/fixtures/catalog.ts` (xem file đó).

describe('mock regions / testimonials', () => {
  it('đủ 3 vùng north/central/south', () => {
    expect(REGIONS.map((r) => r.key).sort()).toEqual(['central', 'north', 'south']);
  });

  it('8 testimonial (marquee 2 cột × 4) đủ trường', () => {
    // Marquee của template Estate cần 2 cột × 4 card để loop mượt.
    expect(TESTIMONIALS).toHaveLength(8);
    for (const t of TESTIMONIALS) {
      expect(t.rating).toBeGreaterThanOrEqual(4);
      expect(t.rating).toBeLessThanOrEqual(5);
      expect(t.location.length).toBeGreaterThan(0);
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
  it('2 văn phòng đủ trường, toạ độ nằm trong khung Việt Nam', async () => {
    const { OFFICES } = await import('./offices.js');
    expect(OFFICES).toHaveLength(2);
    for (const o of OFFICES) {
      expect(o.city.length).toBeGreaterThan(0);
      expect(o.name.length).toBeGreaterThan(0);
      expect(o.addressLines.length).toBeGreaterThan(0);
      expect(o.hours.length).toBeGreaterThan(0);
      // Toạ độ MapLibre là [kinh độ, vĩ độ] — KHÔNG phải [lat, lng]. Khung
      // Việt Nam: kinh độ 102–110, vĩ độ 8–24. Test này chặn lỗi đảo cặp số,
      // thứ sẽ ném marker sang giữa Ấn Độ Dương mà nhìn map vẫn thấy "có pin".
      const [lng, lat] = o.coords;
      expect(lng).toBeGreaterThan(102);
      expect(lng).toBeLessThan(110);
      expect(lat).toBeGreaterThan(8);
      expect(lat).toBeLessThan(24);
      expect(o.mapHref.startsWith('https://')).toBe(true);
    }
  });

  it('trụ sở đứng đầu danh sách văn phòng', async () => {
    const { OFFICES } = await import('./offices.js');
    const [hq] = OFFICES;
    expect(hq?.city).toBe('Hà Nội');
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

// Mock journal đã khai tử Task 10 — cụm blog giờ đọc thẳng API (xem
// apps/api posts + lib/api/posts.ts). Bất biến "9 bài mới nhất 2026-07-22
// đứng đầu" giờ canh ở nghiệm thu production build, không còn canh được
// bằng mock tĩnh nữa.

// Roster tour THẬT — canh cho `mock moments` dưới đây. `moments` là mock SỐNG
// (không đổi nguồn sang API, xem Global Constraints của plan), nhưng nó trỏ
// sang tour thật bằng `tourSlug` nên phải canh với DỮ LIỆU THẬT, không phải
// mock `TOURS` (mock đó đã khai tử ở Task 7 — spec canh moments không phải
// consumer chặn việc đó).
//
// Copy TAY 30 slug/title từ `apps/api/prisma/fixtures/catalog/tours-{north,
// central,south}.ts` (12 Bắc + 9 Trung + 9 Nam, đúng thứ tự khai báo trong
// fixture). KHÔNG import trực tiếp từ `apps/api` — web và api là hai app tách
// biệt, không package chung. Đây là bản SAO TĨNH: ai đổi fixture (thêm/xoá/đổi
// tên tour) phải tự tay đồng bộ lại danh sách này — không có cơ chế tự động.
const REAL_TOUR_ROSTER: { slug: string; title: string }[] = [
  // ---- Miền Bắc (tours-north.ts) ----
  { slug: 'hanoi-old-quarter-food-night', title: 'Hanoi Old Quarter Street Food by Night' },
  { slug: 'hanoi-heritage-day', title: 'Hanoi Heritage in a Day' },
  { slug: 'red-river-craft-villages-day', title: 'Bát Tràng & Red River Craft Villages' },
  { slug: 'ninh-binh-trang-an-day', title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields' },
  { slug: 'halong-bay-overnight-cruise', title: 'Hạ Long Bay Overnight Cruise 2D1N' },
  { slug: 'lan-ha-kayak-cruise-3d', title: 'Lan Hạ Bay & Cát Bà Kayak Cruise 3D2N' },
  { slug: 'sapa-terraces-homestay-2d', title: 'Sa Pa Terraces & Homestay Trek 2D1N' },
  { slug: 'sapa-fansipan-summit-3d', title: 'Sa Pa Villages & Fansipan Summit 3D2N' },
  { slug: 'ha-giang-loop-4d', title: 'Hà Giang Loop by Easyrider 4D3N' },
  { slug: 'mai-chau-cycling-2d', title: 'Mai Châu Valley Cycling & Stilt House 2D1N' },
  { slug: 'northern-highlights-5d', title: 'Northern Highlights: Hanoi–Hạ Long–Ninh Bình 5D4N' },
  { slug: 'vietnam-grand-journey-12d', title: 'Vietnam Grand Journey: North to South 12D11N' },
  // ---- Miền Trung (tours-central.ts) ----
  { slug: 'hue-imperial-day', title: 'Huế Imperial City & Royal Tombs' },
  { slug: 'phong-nha-paradise-cave-day', title: 'Phong Nha & Paradise Cave Day Trip' },
  { slug: 'hoi-an-lantern-evening', title: 'Hội An Old Town & Lantern Evening' },
  { slug: 'hoi-an-countryside-cooking-day', title: 'Hội An Countryside, Basket Boat & Cooking' },
  { slug: 'bana-hills-golden-bridge-day', title: 'Bà Nà Hills & Golden Bridge Day Trip' },
  { slug: 'my-son-sunrise-halfday', title: 'Mỹ Sơn Sanctuary at Sunrise' },
  { slug: 'central-heritage-4d', title: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N' },
  { slug: 'quy-nhon-coastal-3d', title: 'Quy Nhơn Coastal Escape 3D2N' },
  { slug: 'central-honeymoon-5d', title: 'Central Vietnam Honeymoon 5D4N' },
  // ---- Miền Nam (tours-south.ts) ----
  { slug: 'vung-tau-coastal-2d', title: 'Vũng Tàu Coastal Escape 2D1N' },
  { slug: 'saigon-cu-chi-day', title: 'Sài Gòn City & Củ Chi Tunnels' },
  { slug: 'saigon-after-dark-vespa', title: 'Sài Gòn After Dark by Vespa' },
  { slug: 'mekong-can-tho-2d', title: 'Mekong Delta & Cái Răng Floating Market 2D1N' },
  { slug: 'ben-tre-coconut-day', title: 'Bến Tre Coconut Country Day Trip' },
  { slug: 'da-lat-highlands-3d', title: 'Đà Lạt Highlands, Waterfalls & Farms 3D2N' },
  { slug: 'phu-quoc-island-hopping-day', title: 'Phú Quốc 4-Island Hopping & Snorkelling' },
  { slug: 'phu-quoc-honeymoon-4d', title: 'Phú Quốc Honeymoon Hideaway 4D3N' },
  { slug: 'con-dao-history-nature-3d', title: 'Côn Đảo History & Nature 3D2N' },
];

describe('mock moments', () => {
  it('mỗi khoảnh khắc trỏ tới một tour CÓ THẬT', () => {
    // Bất biến sinh ra khi ô khoảnh khắc ở /destinations thành link (28/07).
    // `tourSlug` ghi tay chứ không bóc từ chuỗi `credit` — nên phải có test
    // canh, nếu không một slug gõ sai sẽ dẫn thẳng sang trang 404. Canh với
    // ROSTER THẬT (không phải mock TOURS): moments không đổi nguồn nhưng phải
    // trỏ đúng tour đang sống trên API.
    const known = new Set(REAL_TOUR_ROSTER.map((t) => t.slug));
    for (const m of MOMENTS) {
      expect(known.has(m.tourSlug), `${m.credit} → ${m.tourSlug}`).toBe(true);
    }
  });

  it('credit có nhắc đúng tour mà tourSlug trỏ tới', () => {
    // Chống lệch âm thầm: đổi credit mà quên đổi slug (hoặc ngược lại) thì
    // caption nói một tour còn link dẫn sang tour khác.
    for (const m of MOMENTS) {
      const tour = REAL_TOUR_ROSTER.find((t) => t.slug === m.tourSlug);
      expect(tour, m.tourSlug).toBeDefined();
      expect(m.credit, m.tourSlug).toContain(tour?.title ?? '\u0000');
    }
  });
});
