# Kế hoạch: trùng tu trang Tour Details

> ⚠️ **PLAN NÀY ĐÃ KHAI TỬ (13/08/2026).** Nó dựng theo bản spec cũ vốn ghi sai
> số đo (1104 thay vì 1056) và ghi thêm một khối wireframe không có (dải khởi
> hành). Bản thi công theo nó đã bị **xoá trọn phần thân** để dựng lại bám thẳng
> markup wireframe. Giữ file để không gãy link từ CHANGELOG/README và để đọc lại
> phần còn đúng: mở rộng contract (Task 1), hàm thuần (Task 2), copy i18n
> (Task 3) — ba task đó KHÔNG bị xoá và vẫn đang chạy.
>
> Số đo và hành vi hiện hành nằm ở
> [spec đã viết lại](../specs/2026-08-13-tour-detail-redesign.md).
>
> **Đính chính một khẳng định trong thân file:** bảng nợ cuối plan ghi "Chạy
> `seed-media` cho tour". **Không có script nào tên vậy** — repo chỉ có
> `db:seed`, và `prisma/seed.ts` không tạo một row `MediaAsset` nào cho tour.
> Nợ ảnh tour theo dõi ở [backlog A8](../analysis/2026-08-06-backlog-no-ky-thuat.md).

> **For agentic workers:** REQUIRED SUB-SKILL: dùng `superpowers:subagent-driven-development`
> (khuyến nghị) hoặc `superpowers:executing-plans` để thi công từng task. Các bước dùng
> checkbox (`- [ ]`) để theo dõi.

**Goal:** Dựng lại `/tours/[slug]` theo mẫu ReUI `product-detail-1` — gallery 7 thumb,
panel đặt chỗ, 5 tab, hai modal, related dùng `TourCard` sẵn có — đúng bằng wireframe
đã duyệt 13/08.

**Architecture:** Trang giữ nguyên `TourHero` + `DepartureSelectionProvider`. Phần dưới
hero thay bằng ba khối mới: `TourMediaPanel` (gallery + booking panel), `TourTabs` (5 panel
render đủ, ẩn bằng CSS, đồng bộ hash), và khu related. Mọi phép tính tách thành hàm thuần
ở `lib/tour-detail.ts` để TDD ở môi trường node.

**Tech Stack:** Next 15 App Router (RSC + client islands), Base UI qua `@tourism/ui`,
Tailwind v4 + token `@tourism/tokens`, `react-markdown` + `remark-gfm`, Vitest.

## Global Constraints

- **Spec:** [`docs/specs/2026-08-13-tour-detail-redesign.md`](../specs/2026-08-13-tour-detail-redesign.md) ·
  **ADR:** [`docs/adr/0022-tour-detail-tabs.md`](../adr/0022-tour-detail-tabs.md)
- **Tokens-only, không hex** (luật 6). Màu lấy từ `@tourism/tokens`; `--input` cho viền
  điều khiển, `--border` cho đường phân cách, `--rating`/`--rating-muted` cho sao,
  `--price`/`--price-compare` cho giá.
- **Comment code bằng tiếng Việt** (luật 8); identifier tiếng Anh.
- **Copy user-facing English-only, đặt trong `@tourism/i18n`** (luật 7). Không hardcode chuỗi.
- **Commit Conventional Commits, message tiếng Việt CÓ DẤU, KHÔNG trailer AI** (luật 12).
- **`line-height` tường minh và CHẴN** cho mọi dòng chữ trong panel. Cấm `22.75px`; dùng `23px`.
- **Lưới trên ghim `minmax(0,1fr) 443px`**, không dùng `1.4fr/1fr` (gây lệch nửa pixel toàn trang).
- **Render đủ 5 panel, ẩn bằng CSS.** Cấm mount có điều kiện (trang là SSG trong sitemap).
- **KHÔNG sửa `components/media/lightbox.tsx`** — dùng y nguyên.
- **Ảnh thật dùng `next/image`.** Pre-flight 13/08 phát hiện `ImagePlaceholder` KHÔNG
  nhận `src` và `next.config.ts` chưa khai `remotePatterns` nào, nên "đổi `media={[]}`
  thành `tour.media`" là chưa đủ. User chốt: khai `remotePatterns` cho
  `res.cloudinary.com` (đóng luôn nợ ADR-0020 ghi trong `avatar-upload.tsx`).
  Việc này gộp vào Task 4 — task đầu tiên cần tới nó.
- **KHÔNG viết `page.spec.tsx`.** Repo có 0 test ở tầng page (cả 94 spec của web đều ở
  tầng component); user chốt theo tiền lệ đó. Bước nghiệm thu Playwright ở Task 12 GIỮ
  NGUYÊN — nó đo được thứ test đơn vị không đo được (lưới 621|40|443, lệch pixel, tương phản).
- **KHÔNG đụng** `apps/api/prisma/migrations/` và các entry CHANGELOG cũ.
- Chạy `pnpm gate:int` trước khi khai xong. **Web build cần API sống ở :3001**:
  `cd apps/api && node --env-file-if-exists=.env.local dist/main.js &` rồi kill sau khi xong.

---

## File Structure

**Tạo mới**

| File | Trách nhiệm |
| --- | --- |
| `apps/web/src/lib/tour-detail.ts` | Toàn bộ phép tính thuần của trang (ngày lịch trình, trạng thái node, chip ngày, tổng quan tháng, histogram, gallery) |
| `apps/web/src/lib/tour-detail.spec.ts` | Test cho file trên |
| `apps/web/src/components/tours/tour-media-panel.tsx` | Khối gallery 7 thumb + panel đặt chỗ (client) |
| `apps/web/src/components/tours/departure-dialog.tsx` | Modal "All dates" |
| `apps/web/src/components/tours/tour-tabs.tsx` | Vỏ 5 tab + đồng bộ hash |
| `apps/web/src/components/tours/panels/overview-panel.tsx` | Tab 1 |
| `apps/web/src/components/tours/panels/itinerary-panel.tsx` | Tab 2 |
| `apps/web/src/components/tours/panels/departures-panel.tsx` | Tab 3 |
| `apps/web/src/components/tours/panels/reviews-panel.tsx` | Tab 4 |
| `apps/web/src/components/tours/panels/good-to-know-panel.tsx` | Tab 5 |
| `apps/web/src/components/tours/reviews-dialog.tsx` | Modal "Show all reviews" |

**Sửa**

| File | Việc |
| --- | --- |
| `libs/shared/contract/src/schemas/reviews.ts` | Thêm `sort`/`rating`/`withPhotos` + `ReviewBreakdownSchema` |
| `libs/shared/contract/src/contract.ts` | `reviews.listByTour` đổi output |
| `apps/api/src/modules/reviews/reviews.service.ts` | Áp sort/filter + tính `breakdown` |
| `libs/shared/i18n/src/lib/messages.ts` | Copy mới cho tab, modal, panel |
| `apps/web/src/app/(site)/tours/[slug]/page.tsx` | Ghép ba khối mới, bỏ `OnThisPage` |
| `apps/web/src/lib/api/tours.ts` | Truyền tham số mới cho `fetchTourReviews` |

**Không đụng:** `lightbox.tsx`, `tour-hero.tsx`, `tour-card.tsx`, `related-tours.tsx`,
`departure-selection.tsx`, `booking-rail.tsx`.

---

### Task 1: Contract + service cho sort/filter/breakdown của reviews

**Files:**
- Modify: `libs/shared/contract/src/schemas/reviews.ts`
- Modify: `libs/shared/contract/src/contract.ts` (khối `reviews.listByTour`)
- Modify: `apps/api/src/modules/reviews/reviews.service.ts` (hàm `listByTour`, quanh dòng 456)
- Test: `apps/api/src/modules/reviews/reviews.int.spec.ts`

**Interfaces:**
- Produces: `ReviewSortSchema`, `ReviewBreakdownSchema`; `reviews.listByTour` nhận thêm
  `sort?: 'newest'|'oldest'|'highest'|'lowest'`, `rating?: 1..5`, `withPhotos?: boolean`;
  trả thêm `breakdown: Record<'1'|'2'|'3'|'4'|'5', number>`.

- [ ] **Step 1: Viết test int cho sort + filter + breakdown**

Thêm vào `reviews.int.spec.ts` (dùng đúng helper seed sẵn có trong file):

```ts
it('sort=highest xếp sao cao trước, tài khoản đã xoá VẪN nằm cuối', async () => {
  const res = await client.reviews.listByTour({ tourSlug, sort: 'highest', pageSize: 50 });
  const ratings = res.items.filter((r) => !r.authorDeleted).map((r) => r.rating);
  expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
  const deletedIdx = res.items.findIndex((r) => r.authorDeleted);
  if (deletedIdx !== -1) expect(deletedIdx).toBe(res.items.length - 1);
});

it('rating=5 chỉ trả review 5 sao', async () => {
  const res = await client.reviews.listByTour({ tourSlug, rating: 5, pageSize: 50 });
  expect(res.items.every((r) => r.rating === 5)).toBe(true);
});

it('withPhotos=true chỉ trả review có ảnh', async () => {
  const res = await client.reviews.listByTour({ tourSlug, withPhotos: true, pageSize: 50 });
  expect(res.items.every((r) => r.media.length > 0)).toBe(true);
});

it('breakdown tính trên tập CHƯA lọc theo sao', async () => {
  const all = await client.reviews.listByTour({ tourSlug, pageSize: 50 });
  const filtered = await client.reviews.listByTour({ tourSlug, rating: 5, pageSize: 50 });
  expect(filtered.breakdown).toEqual(all.breakdown);
  const sum = Object.values(all.breakdown).reduce((a, b) => a + b, 0);
  expect(sum).toBe(all.total);
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/api && pnpm test:int src/modules/reviews/reviews.int.spec.ts`
Expected: FAIL — `sort` không tồn tại trong input schema (Zod strip/throw).

- [ ] **Step 3: Mở rộng contract**

```ts
// libs/shared/contract/src/schemas/reviews.ts
export const ReviewSortSchema = z.enum(['newest', 'oldest', 'highest', 'lowest']);

export const ReviewsByTourQuerySchema = PageQuerySchema.extend({
  tourSlug: z.string().min(1).max(120),
  sort: ReviewSortSchema.default('newest'),
  rating: RatingSchema.optional(),
  withPhotos: z.boolean().optional(),
});

/** Số review theo từng mức sao. Khoá là chuỗi vì JSON không có khoá số. */
export const ReviewBreakdownSchema = z.object({
  '1': z.int().nonnegative(),
  '2': z.int().nonnegative(),
  '3': z.int().nonnegative(),
  '4': z.int().nonnegative(),
  '5': z.int().nonnegative(),
});
export type ReviewBreakdown = z.output<typeof ReviewBreakdownSchema>;
```

```ts
// libs/shared/contract/src/contract.ts — reviews.listByTour
.output(PagedSchema(PublicReviewSchema).extend({ breakdown: ReviewBreakdownSchema }))
```

- [ ] **Step 4: Áp vào service**

```ts
// apps/api/src/modules/reviews/reviews.service.ts — trong byTour()
// Khoá CHÍNH luôn là authorDeleted asc cho MỌI kiểu sort (giữ luật sản phẩm),
// khoá CUỐI luôn id desc để phân trang ổn định khi trùng ngày/trùng sao.
const sortKey = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  highest: { rating: 'desc' },
  lowest: { rating: 'asc' },
}[query.sort] as Prisma.ReviewOrderByWithRelationInput;

const where = {
  tourId: tour.id,
  isApproved: true,
  ...(query.rating ? { rating: query.rating } : {}),
  ...(query.withPhotos ? { media: { some: {} } } : {}),
};
// breakdown tính trên where KHÔNG có rating — nếu tính sau khi lọc thì chọn 5★
// xong các mức khác về 0 và người dùng không bấm lại được.
const breakdownWhere = { tourId: tour.id, isApproved: true,
  ...(query.withPhotos ? { media: { some: {} } } : {}) };

const [rows, total, grouped] = await Promise.all([
  prisma.review.findMany({ where, orderBy: [{ authorDeleted: 'asc' }, sortKey, { id: 'desc' }],
    skip, take }),
  prisma.review.count({ where }),
  prisma.review.groupBy({ by: ['rating'], where: breakdownWhere, _count: { _all: true } }),
]);
const breakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
for (const g of grouped) breakdown[String(g.rating) as keyof typeof breakdown] = g._count._all;
```

> **Lưu ý:** `media: { some: {} }` chỉ đúng nếu ảnh review là quan hệ. Ảnh review lưu ở
> `MediaAsset` với `ownerType: 'REVIEW'` — kiểm lại quan hệ trong `schema.prisma` trước khi
> viết; nếu không có relation thì lọc bằng `id: { in: await ids có media }`.

- [ ] **Step 5: Chạy lại int test**

Run: `cd apps/api && pnpm test:int src/modules/reviews/reviews.int.spec.ts`
Expected: PASS, 4 test mới xanh.

- [ ] **Step 6: Commit**

```bash
git add libs/shared/contract/src apps/api/src/modules/reviews
git commit -m "feat(contract): reviews.listByTour nhận sort/rating/withPhotos và trả breakdown theo sao"
```

---

### Task 2: Hàm thuần của trang chi tiết

**Files:**
- Create: `apps/web/src/lib/tour-detail.ts`
- Test: `apps/web/src/lib/tour-detail.spec.ts`

**Interfaces:**
- Produces:
  - `galleryThumbs<T>(media: readonly T[], slots?: number): { thumbs: T[]; hiddenCount: number }`
  - `visibleDepartureChips<T extends { id: string; seatsLeft: number }>(departures: readonly T[], selectedId: string | null, slots?: number): T[]`
  - `itineraryDayDate(startDate: string, dayNumber: number): Date`
  - `itineraryDayState(dayDate: Date, today: Date, live: boolean): 'preview' | 'done' | 'active' | 'upcoming'`
  - `departureMonths<T extends { startDate: string; seatsLeft: number; effectivePrice: string }>(departures: readonly T[]): { month: string; items: T[]; seatsLeft: number; minPrice: number; maxPrice: number }[]`
  - `ratingHistogram(breakdown: Record<string, number>): { star: number; count: number; percent: number }[]`

- [ ] **Step 1: Viết test**

```ts
import { describe, expect, it } from 'vitest';
import {
  departureMonths, galleryThumbs, itineraryDayDate, itineraryDayState,
  ratingHistogram, visibleDepartureChips,
} from './tour-detail';

describe('galleryThumbs', () => {
  const media = Array.from({ length: 10 }, (_, i) => ({ publicId: `p${i}` }));
  it('7 là trần: 7×64 + 6×8 = 496 ≤ 541 (cạnh ảnh vuông)', () => {
    const { thumbs, hiddenCount } = galleryThumbs(media);
    expect(thumbs).toHaveLength(7);
    expect(hiddenCount).toBe(3);
  });
  it('ít hơn trần thì không có ảnh ẩn', () => {
    expect(galleryThumbs(media.slice(0, 4)).hiddenCount).toBe(0);
  });
  it('rỗng thì không ném', () => {
    expect(galleryThumbs([])).toEqual({ thumbs: [], hiddenCount: 0 });
  });
});

describe('visibleDepartureChips', () => {
  const deps = [
    { id: 'a', seatsLeft: 6 }, { id: 'b', seatsLeft: 9 }, { id: 'c', seatsLeft: 3 },
    { id: 'd', seatsLeft: 0 }, { id: 'e', seatsLeft: 8 }, { id: 'f', seatsLeft: 5 },
  ];
  it('chỉ lấy đợt CÒN CHỖ, tối đa 4', () => {
    expect(visibleDepartureChips(deps, 'a').map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
  });
  it('đợt đang chọn nằm ngoài 4 ô thì chen vào thay ô cuối', () => {
    // nếu không, panel hiện một đằng còn nút Reserve nói một nẻo
    expect(visibleDepartureChips(deps, 'f').map((d) => d.id)).toEqual(['a', 'b', 'c', 'f']);
  });
  it('đợt đang chọn đã hết chỗ thì KHÔNG chen vào', () => {
    expect(visibleDepartureChips(deps, 'd').map((d) => d.id)).toEqual(['a', 'b', 'c', 'e']);
  });
});

describe('itineraryDayDate', () => {
  it('Day N = ngày khởi hành + (N-1)', () => {
    expect(itineraryDayDate('2026-09-14', 1).toISOString().slice(0, 10)).toBe('2026-09-14');
    expect(itineraryDayDate('2026-09-14', 4).toISOString().slice(0, 10)).toBe('2026-09-17');
  });
  it('nhảy qua ranh giới tháng đúng', () => {
    expect(itineraryDayDate('2026-09-28', 4).toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});

describe('itineraryDayState', () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it('không có booking thì LUÔN là preview, kể cả khi chuyến đang chạy', () => {
    // khách vãng lai không được thấy tick trên chuyến họ không đi
    expect(itineraryDayState(d('2026-09-14'), d('2026-09-15'), false)).toBe('preview');
  });
  it('có booking: ngày đã qua = done, hôm nay = active, chưa tới = upcoming', () => {
    expect(itineraryDayState(d('2026-09-14'), d('2026-09-15'), true)).toBe('done');
    expect(itineraryDayState(d('2026-09-15'), d('2026-09-15'), true)).toBe('active');
    expect(itineraryDayState(d('2026-09-16'), d('2026-09-15'), true)).toBe('upcoming');
  });
});

describe('departureMonths', () => {
  const deps = [
    { startDate: '2026-09-14', seatsLeft: 6, effectivePrice: '329.00' },
    { startDate: '2026-09-28', seatsLeft: 9, effectivePrice: '329.00' },
    { startDate: '2026-10-12', seatsLeft: 3, effectivePrice: '349.00' },
  ];
  it('gộp theo tháng, cộng ghế, lấy khoảng giá', () => {
    const [sep, oct] = departureMonths(deps);
    expect(sep.items).toHaveLength(2);
    expect(sep.seatsLeft).toBe(15);
    expect(sep.minPrice).toBe(329);
    expect(oct.minPrice).toBe(349);
    expect(oct.maxPrice).toBe(349);
  });
});

describe('ratingHistogram', () => {
  it('phần trăm tính trên TỔNG, không chuẩn hoá theo cột cao nhất', () => {
    const rows = ratingHistogram({ '1': 0, '2': 0, '3': 2, '4': 3, '5': 18 });
    expect(rows[0]).toEqual({ star: 5, count: 18, percent: (18 / 23) * 100 });
    expect(rows.map((r) => r.star)).toEqual([5, 4, 3, 2, 1]);
    expect(rows.reduce((s, r) => s + r.percent, 0)).toBeCloseTo(100);
  });
  it('không review nào thì mọi cột 0%, không chia cho 0', () => {
    const rows = ratingHistogram({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
    expect(rows.every((r) => r.percent === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/lib/tour-detail.spec.ts`
Expected: FAIL — không resolve được `./tour-detail`.

- [ ] **Step 3: Viết implementation**

```ts
// apps/web/src/lib/tour-detail.ts
/** Trần thumb: 7×64 + 6×8 = 496 ≤ 541 (cạnh ảnh vuông). Ô thứ 8 thành 568 > 541. */
export const GALLERY_THUMB_SLOTS = 7;
/** Số ô ngày ở panel; phần còn lại đi qua modal "All dates". */
export const DEPARTURE_CHIP_SLOTS = 4;

export function galleryThumbs<T>(media: readonly T[], slots = GALLERY_THUMB_SLOTS) {
  return { thumbs: media.slice(0, slots), hiddenCount: Math.max(0, media.length - slots) };
}

export function visibleDepartureChips<T extends { id: string; seatsLeft: number }>(
  departures: readonly T[], selectedId: string | null, slots = DEPARTURE_CHIP_SLOTS,
): T[] {
  const open = departures.filter((d) => d.seatsLeft > 0);
  const head = open.slice(0, slots);
  if (head.some((d) => d.id === selectedId)) return head;
  const picked = open.find((d) => d.id === selectedId);
  // Đợt đang chọn phải LUÔN nhìn thấy, nếu không panel và nút Reserve nói khác nhau.
  return picked ? [...head.slice(0, slots - 1), picked] : head;
}

export function itineraryDayDate(startDate: string, dayNumber: number): Date {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayNumber - 1);
  return d;
}

/** So theo NGÀY LỊCH UTC — cùng quy ước với `checkReviewEligibility` phía API. */
function dayKey(d: Date): number {
  return d.getUTCFullYear() * 10000 + d.getUTCMonth() * 100 + d.getUTCDate();
}

export function itineraryDayState(
  dayDate: Date, today: Date, live: boolean,
): 'preview' | 'done' | 'active' | 'upcoming' {
  // `live` = session có booking PAID ở đúng đợt này. Không có nó thì mọi ngày
  // đều "preview": không tick, không spinner, không làm mờ — làm mờ cả 4 ngày
  // của một chuyến tương lai khiến trang trông như hỏng.
  if (!live) return 'preview';
  const a = dayKey(dayDate), b = dayKey(today);
  return a < b ? 'done' : a === b ? 'active' : 'upcoming';
}

export function departureMonths<
  T extends { startDate: string; seatsLeft: number; effectivePrice: string },
>(departures: readonly T[]) {
  const out: { month: string; items: T[]; seatsLeft: number; minPrice: number; maxPrice: number }[] = [];
  for (const d of departures) {
    const month = d.startDate.slice(0, 7);
    let bucket = out.find((m) => m.month === month);
    if (!bucket) {
      bucket = { month, items: [], seatsLeft: 0, minPrice: Infinity, maxPrice: 0 };
      out.push(bucket);
    }
    const price = Number(d.effectivePrice);
    bucket.items.push(d);
    bucket.seatsLeft += d.seatsLeft;
    bucket.minPrice = Math.min(bucket.minPrice, price);
    bucket.maxPrice = Math.max(bucket.maxPrice, price);
  }
  return out;
}

export function ratingHistogram(breakdown: Record<string, number>) {
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  return [5, 4, 3, 2, 1].map((star) => {
    const count = breakdown[String(star)] ?? 0;
    return { star, count, percent: total === 0 ? 0 : (count / total) * 100 };
  });
}
```

- [ ] **Step 4: Chạy lại**

Run: `cd apps/web && pnpm vitest run src/lib/tour-detail.spec.ts`
Expected: PASS, 13 test xanh.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tour-detail.ts apps/web/src/lib/tour-detail.spec.ts
git commit -m "feat(web): hàm thuần cho trang tour — thumb, chip ngày, ngày lịch trình, tổng quan tháng, histogram"
```

---

### Task 3: Copy i18n cho toàn trang mới

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `tourDetail`, quanh dòng 1751)
- Test: `libs/shared/i18n/src/lib/messages.spec.ts`

**Interfaces:**
- Produces: `messages.tourDetail.tabs` (5 nhãn), `.mediaPanel`, `.itinerary`, `.departuresTab`,
  `.reviewsTab`, `.dialogs`.

- [ ] **Step 1: Viết test canh không lọt chuỗi rỗng**

```ts
it('tourDetail: mọi nhãn tab và copy modal đều có chữ', () => {
  const t = messages.tourDetail;
  expect(Object.values(t.tabs)).toHaveLength(5);
  for (const v of Object.values(t.tabs)) expect(v.trim().length).toBeGreaterThan(0);
  expect(t.dialogs.allDatesTitle.length).toBeGreaterThan(0);
  expect(t.dialogs.allReviewsTitle.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `pnpm turbo run test --filter=@tourism/i18n`
Expected: FAIL — `t.tabs` undefined.

- [ ] **Step 3: Thêm copy**

```ts
// trong khối tourDetail
tabs: {
  overview: 'Overview',
  itinerary: 'Itinerary',
  departures: 'Departures',
  reviews: 'Reviews',
  goodToKnow: 'Good to know',
},
mediaPanel: {
  photoCount: (n: number) => `${n} photo${n === 1 ? '' : 's'}`,
  morePhotos: (n: number) => `+${n}`,
  selectDeparture: 'Select departure',
  allDates: (n: number) => `All ${n} dates`,
  seatsLeft: (n: number) => `${n} seat${n === 1 ? '' : 's'} left`,
  reserve: (n: number) => `Reserve — ${n} seat${n === 1 ? '' : 's'} left`,
  soldOut: 'Sold out',
},
itinerary: {
  dayLabel: (n: number) => `Day ${n}`,
  stopsSummary: (day: number, stops: number, from: string, to: string) =>
    `Day ${day} · ${stops} stop${stops === 1 ? '' : 's'} · ${from}–${to}`,
  today: 'Today',
  done: 'Done',
  included: "What's included",
  excluded: 'Not included',
},
departuresTab: {
  nextDeparture: 'Next departure',
  datesOpen: 'Dates open',
  priceRange: 'Price range',
  seatsLeftTotal: 'Seats left',
  availabilityByMonth: 'Availability by month',
  blockLegend: 'Each block is one departure — filled means seats left, hollow means sold out.',
  seeAllDates: 'See all dates',
  lowSeason: 'low season',
  peak: 'peak',
},
reviewsTab: {
  basedOn: (n: number) => `Based on ${n} verified traveller${n === 1 ? '' : 's'}`,
  showAll: 'Show all reviews',
  onlyFinished: 'Only travellers who finished this trip can leave a review.',
  ordering: 'Newest first · reviews from deleted accounts appear last.',
  deletedAccount: 'Deleted account',
  verified: 'Verified traveller',
},
dialogs: {
  allDatesTitle: 'Choose a departure',
  onlyOpen: 'Only show dates with seats left',
  close: 'Close',
  select: 'Select',
  selected: 'Selected',
  noMatch: 'No departures match this filter.',
  allReviewsTitle: 'Reviews',
  sortBy: 'Sort reviews by',
  sortNewest: 'Newest first',
  sortOldest: 'Oldest first',
  sortHighest: 'Highest rated',
  sortLowest: 'Lowest rated',
  anyRating: 'Any rating',
  starsOnly: (n: number) => `${n} star${n === 1 ? '' : 's'} only`,
  withPhotos: 'With photos',
  showingRange: (a: number, b: number, total: number) => `Showing ${a}–${b} of ${total}`,
  noReviewsMatch: 'No reviews match these filters.',
},
```

- [ ] **Step 4: Chạy lại**

Run: `pnpm turbo run test --filter=@tourism/i18n`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/i18n/src
git commit -m "feat(i18n): copy cho 5 tab, panel media và hai modal của trang tour"
```

---

### Task 4: `TourMediaPanel` — gallery 7 thumb + panel đặt chỗ

**Files:**
- Create: `apps/web/src/components/tours/tour-media-panel.tsx`
- Test: `apps/web/src/components/tours/tour-media-panel.spec.tsx`

**Interfaces:**
- Consumes: `galleryThumbs`, `visibleDepartureChips` (Task 2); `messages.tourDetail.mediaPanel` (Task 3);
  `Lightbox` từ `@/components/media/lightbox`; `useDepartureSelection()` từ `departure-selection.tsx`.
- Produces: `<TourMediaPanel tour={TourDetailVM} />` — nút "All N dates" gọi
  `useDepartureSelection().openAllDates()`, KHÔNG nhận prop callback: modal chỉ có MỘT
  instance do trang render, mà cả panel này lẫn tab Departures đều cần mở nó.

- [ ] **Step 1: Viết test**

```tsx
it('hiện tối đa 7 thumb và gắn "+N" lên ô cuối khi còn ảnh ẩn', () => {
  render(<TourMediaPanel tour={tourWith(10)} />, { wrapper });
  expect(screen.getAllByRole('button', { name: /photo/i })).toHaveLength(7);
  expect(screen.getByText('+3')).toBeInTheDocument();
});

it('bấm ô "+N" mở lightbox tại đúng ảnh đang bị ẩn', async () => {
  render(<TourMediaPanel tour={tourWith(10)} />, { wrapper });
  await userEvent.click(screen.getByText('+3'));
  expect(screen.getByText('7 / 10')).toBeInTheDocument();
});

it('không có ảnh thì KHÔNG render khung gallery rỗng', () => {
  const { container } = render(<TourMediaPanel tour={tourWith(0)} />, { wrapper });
  expect(container.querySelector('[data-slot="tour-gallery"]')).toBeNull();
});

it('nút Reserve nói đúng số ghế của đợt đang chọn', () => {
  render(<TourMediaPanel tour={tourWith(3)} />, { wrapper });
  expect(screen.getByRole('button', { name: /Reserve — 6 seats left/ })).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/tour-media-panel.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement**

Khung bắt buộc (số đo lấy từ spec §2.1):

```tsx
'use client';
// Lưới ghim 443px cho cột phải — KHÔNG dùng 1.4fr/1fr của bản gốc ReUI: tỉ lệ đó
// chia 1104 ra số lẻ, ảnh vuông thành 540.656 và cả trang bên dưới lệch nửa pixel.
<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_443px]">
  <div className="flex items-start gap-4">
    <ul className="flex w-16 shrink-0 flex-col gap-2">{/* 7 × size-16 rounded-[10px] */}</ul>
    <button className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-[10px] border bg-muted" />
  </div>
  <div className="flex flex-col gap-5">{/* eyebrow · h1 · rating · summary · giá · rule · ngày · CTA · policy */}</div>
</div>
```

Ba luật không được đổi:
1. Ô ngày dùng `border-input`, không `border-border`.
2. Hàng giá canh `items-center`, hai con số bọc trong `<span className="flex items-baseline gap-2">`.
3. Ba thẻ policy sinh từ `tour.policies`, icon map theo `kind`, lưới `auto-fit`.

- [ ] **Step 4: Chạy lại + commit**

Run: `cd apps/web && pnpm vitest run src/components/tours/tour-media-panel.spec.tsx`
Expected: PASS.

```bash
git add apps/web/src/components/tours/tour-media-panel.tsx apps/web/src/components/tours/tour-media-panel.spec.tsx
git commit -m "feat(web): khối gallery 7 thumb và panel đặt chỗ cho trang tour"
```

---

### Task 5: `DepartureDialog` — modal "All dates"

**Files:**
- Create: `apps/web/src/components/tours/departure-dialog.tsx`
- Test: `apps/web/src/components/tours/departure-dialog.spec.tsx`

**Interfaces:**
- Consumes: `departureMonths` (Task 2); `Dialog` từ `@tourism/ui/components/dialog`;
  `useDepartureSelection()`.
- Produces: `<DepartureDialog />` — tự đọc `allDatesOpen`/`closeAllDates()` từ context.
- Sửa kèm: `departure-selection.tsx` thêm vào context `allDatesOpen: boolean`,
  `openAllDates(): void`, `closeAllDates(): void`. Đây là nơi DUY NHẤT giữ trạng thái modal.

- [ ] **Step 1: Viết test**

```tsx
it('nhóm theo tháng và liệt kê đủ mọi đợt', () => {
  render(<DepartureDialog />, { wrapper: openWrapper });
  expect(screen.getAllByRole('button', { name: /→/ })).toHaveLength(12);
  expect(screen.getByText('September 2026')).toBeInTheDocument();
});

it('lọc "only open" bỏ đợt hết chỗ', async () => {
  render(<DepartureDialog />, { wrapper: openWrapper });
  await userEvent.click(screen.getByLabelText(/seats left/i));
  expect(screen.queryByText(/Sold out/)).toBeNull();
});

it('chọn một đợt thì đóng modal và cập nhật lựa chọn dùng chung', async () => {
  render(<DepartureDialog />, { wrapper: openWrapper });
  await userEvent.click(screen.getAllByRole('button', { name: /→/ })[6]);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('đợt hết chỗ không bấm được', () => {
  render(<DepartureDialog />, { wrapper: openWrapper });
  expect(screen.getByRole('button', { name: /23 Nov/ })).toBeDisabled();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/departure-dialog.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement theo spec §5.1**

Bám đúng số đo và token ở spec; mọi dòng chữ khai `line-height` chẵn.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `cd apps/web && pnpm vitest run src/components/tours/departure-dialog.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): modal chọn đợt khởi hành, nhóm theo tháng kèm lọc còn chỗ"
```

---

### Task 6: `TourTabs` — vỏ 5 tab, render đủ panel, đồng bộ hash

**Files:**
- Create: `apps/web/src/components/tours/tour-tabs.tsx`
- Test: `apps/web/src/components/tours/tour-tabs.spec.tsx`

**Interfaces:**
- Consumes: `Tabs` từ `@tourism/ui/components/tabs`; `messages.tourDetail.tabs`.
- Produces: `<TourTabs panels={{ overview, itinerary, departures, reviews, goodToKnow }} />`
  — mỗi giá trị là `ReactNode`.

- [ ] **Step 1: Viết test — đây là ràng buộc SEO, không phải tuỳ chọn**

```tsx
it('render ĐỦ 5 panel vào DOM, chỉ ẩn bằng CSS', () => {
  // Trang là SSG nằm trong sitemap: mount có điều kiện = giấu lịch trình khỏi crawler.
  render(<TourTabs panels={panels} />);
  for (const text of ['OVERVIEW_BODY', 'ITINERARY_BODY', 'DEPARTURES_BODY',
    'REVIEWS_BODY', 'GOODTOKNOW_BODY']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
});

it('hash trên URL mở đúng tab', () => {
  window.location.hash = '#departures';
  render(<TourTabs panels={panels} />);
  expect(screen.getByRole('tab', { name: 'Departures' })).toHaveAttribute('aria-selected', 'true');
});

it('đổi tab thì ghi lại hash', async () => {
  render(<TourTabs panels={panels} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Reviews' }));
  expect(window.location.hash).toBe('#reviews');
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/tour-tabs.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement theo spec §4**

`forceMount` cho MỌI `TabsContent`, ẩn bằng CSS. Bám đúng số đo và token ở spec; mọi dòng chữ khai `line-height` chẵn.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `cd apps/web && pnpm vitest run src/components/tours/tour-tabs.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): vỏ 5 tab cho trang tour, render đủ panel và đồng bộ hash URL"
```

---

### Task 7: Panel Overview

**Files:**
- Create: `apps/web/src/components/tours/panels/overview-panel.tsx`
- Test: `apps/web/src/components/tours/panels/overview-panel.spec.tsx`

**Interfaces:**
- Consumes: `messages.tourDetail`; `TourDetailVM`.
- Produces: `<OverviewPanel tour={TourDetailVM} />`

- [ ] **Step 1: Viết test**

```tsx
it('4 card dữ kiện trên một hàng, dùng nhãn i18n chứ không in enum', () => {
  render(<OverviewPanel tour={tour} />);
  expect(screen.getByText('Challenging')).toBeInTheDocument();
  expect(screen.queryByText('CHALLENGING')).toBeNull();
  expect(screen.getByText('Friends · Solo travellers')).toBeInTheDocument();
});

it('tour không có highlights thì không render danh sách rỗng', () => {
  render(<OverviewPanel tour={{ ...tour, highlights: [] }} />);
  expect(screen.queryByRole('list')).toBeNull();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/overview-panel.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement theo spec §4.1**

Bám đúng số đo và token ở spec; mọi dòng chữ khai `line-height` chẵn.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/overview-panel.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): tab Overview với 4 card dữ kiện và danh sách điểm nhấn"
```

---

### Task 8: Panel Itinerary

**Files:**
- Create: `apps/web/src/components/tours/panels/itinerary-panel.tsx`
- Test: `apps/web/src/components/tours/panels/itinerary-panel.spec.tsx`

**Interfaces:**
- Consumes: `itineraryDayDate`, `itineraryDayState` (Task 2); `Timeline*` từ
  `@tourism/ui/components/reui/timeline`; `Markdown` (react-markdown + remark-gfm);
  `useDepartureSelection()`.
- Produces: `<ItineraryPanel tour={TourDetailVM} live={boolean} today={Date} />`
  — `live` do trang truyền xuống, `today` để test bơm được ngày cố định.

- [ ] **Step 1: Viết test**

```tsx
it('ngày của mỗi mục = ngày khởi hành + (N-1), đổi đợt là đổi theo', () => {
  render(<ItineraryPanel tour={tour} live={false} today={new Date('2026-08-13T00:00:00Z')} />);
  expect(screen.getByText('Mon 14 Sep')).toBeInTheDocument();
  expect(screen.getByText('Thu 17 Sep')).toBeInTheDocument();
});

it('khách chưa đặt: KHÔNG tick, KHÔNG spinner, node hiện số ngày', () => {
  render(<ItineraryPanel tour={tour} live={false} today={new Date('2026-09-15T00:00:00Z')} />);
  expect(screen.queryByText('Today')).toBeNull();
  expect(screen.getByText('01')).toBeInTheDocument();
});

it('đã đặt và đang trong chuyến: ngày qua = Done, hôm nay = Today', () => {
  render(<ItineraryPanel tour={tour} live today={new Date('2026-09-15T00:00:00Z')} />);
  expect(screen.getAllByText('Done')).toHaveLength(1);
  expect(screen.getByText('Today')).toBeInTheDocument();
});

it('mô tả render markdown: **đậm** thành <strong>, KHÔNG in ra dấu sao', () => {
  render(<ItineraryPanel tour={tour} live={false} today={new Date('2026-08-13T00:00:00Z')} />);
  expect(screen.getByText('Yên Minh').tagName).toBe('STRONG');
  expect(screen.queryByText(/\*\*/)).toBeNull();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/itinerary-panel.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement theo spec §4.2**

Bám đúng số đo và token ở spec; mọi dòng chữ khai `line-height` chẵn.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/itinerary-panel.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): tab Itinerary dùng Timeline ReUI, ngày bám đợt khởi hành, mô tả render markdown"
```

---

### Task 9: Panel Departures

**Files:**
- Create: `apps/web/src/components/tours/panels/departures-panel.tsx`
- Test: `apps/web/src/components/tours/panels/departures-panel.spec.tsx`

**Interfaces:**
- Consumes: `departureMonths` (Task 2); `messages.tourDetail.departuresTab`.
- Produces: `<DeparturesPanel tour={TourDetailVM} />` — nút "See all dates" gọi
  `useDepartureSelection().openAllDates()`, cùng một cửa vào với panel đặt chỗ.

- [ ] **Step 1: Viết test**

```tsx
it('mọi con số đều dẫn xuất từ mảng departures', () => {
  render(<DeparturesPanel tour={tour} />, { wrapper });
  expect(screen.getByText('10 / 12')).toBeInTheDocument();      // đợt còn mở / tổng
  expect(screen.getByText('$309.00–$369.00')).toBeInTheDocument();
});

it('KHÔNG lặp lại danh sách ngày — đó là việc của modal', () => {
  render(<DeparturesPanel tour={tour} />, { wrapper });
  expect(screen.queryByRole('table')).toBeNull();
});

it('tour không có đợt nào thì hiện trạng thái rỗng, không hiện lịch trống', () => {
  render(<DeparturesPanel tour={{ ...tour, departures: [] }} />, { wrapper });
  expect(screen.getByText(/no upcoming departures/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/departures-panel.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement theo spec §4.3**

Bám đúng số đo và token ở spec; mọi dòng chữ khai `line-height` chẵn.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/departures-panel.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): tab Departures thành tổng quan mùa vụ thay vì lặp lại danh sách ngày"
```

---

### Task 10: Panel Reviews + `ReviewsDialog`

**Files:**
- Create: `apps/web/src/components/tours/panels/reviews-panel.tsx`
- Create: `apps/web/src/components/tours/reviews-dialog.tsx`
- Modify: `apps/web/src/lib/api/tours.ts` (`fetchTourReviews` nhận sort/rating/withPhotos)
- Test: `apps/web/src/components/tours/panels/reviews-panel.spec.tsx`
- Test: `apps/web/src/components/tours/reviews-dialog.spec.tsx`

**Interfaces:**
- Consumes: `ratingHistogram` (Task 2); `Rating` từ `@tourism/ui/components/reui/rating`;
  `DropdownMenu*`; `breakdown` từ Task 1.
- Produces: `<ReviewsPanel tour={} page={} />`, `<ReviewsDialog open onOpenChange tourSlug />`

- [ ] **Step 1: Viết test**

```tsx
it('bề rộng cột = count/total, KHÔNG chuẩn hoá theo cột cao nhất', () => {
  render(<ReviewsPanel tour={tour} page={pageWith({ '5': 18, '4': 3, '3': 2, '2': 0, '1': 0 })} />);
  const bar5 = screen.getByTestId('rating-bar-5');
  expect(bar5).toHaveStyle({ width: `${(18 / 23) * 100}%` });
});

it('KHÔNG có nút Write a review trên trang tour', () => {
  // POST /api/reviews đòi bookingCode mà trang tour không có mã nào
  render(<ReviewsPanel tour={tour} page={page} />);
  expect(screen.queryByRole('button', { name: /write a review/i })).toBeNull();
  expect(screen.getByRole('button', { name: /show all reviews/i })).toBeInTheDocument();
});

it('review của tài khoản đã xoá hiện nhãn thay tên', () => {
  render(<ReviewsPanel tour={tour} page={pageWithDeletedAuthor()} />);
  expect(screen.getByText('Deleted account')).toBeInTheDocument();
});

// reviews-dialog.spec.tsx
it('bấm sao thứ 3 lọc đúng 3 sao, bấm lại thì bỏ lọc', async () => {
  render(<ReviewsDialog open onOpenChange={vi.fn()} tourSlug="x" />);
  await userEvent.click(screen.getByLabelText('Filter by 3 stars'));
  expect(screen.getByText('3 stars only')).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Filter by 3 stars'));
  expect(screen.getByText('Any rating')).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/reviews-panel.spec.tsx src/components/tours/reviews-dialog.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement theo spec §4.4 + §5.2**

Bám đúng số đo và token ở spec; mọi dòng chữ khai `line-height` chẵn.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/reviews-panel.spec.tsx src/components/tours/reviews-dialog.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): tab Reviews với biểu đồ bám dữ liệu và modal xem tất cả có sort/lọc"
```

---

### Task 11: Panel Good to know

**Files:**
- Create: `apps/web/src/components/tours/panels/good-to-know-panel.tsx`
- Test: `apps/web/src/components/tours/panels/good-to-know-panel.spec.tsx`

**Interfaces:**
- Consumes: `groupPoliciesByKind` (đã có ở `lib/tours.ts`); `Accordion*` từ `@tourism/ui`.
- Produces: `<GoodToKnowPanel tour={TourDetailVM} />`

- [ ] **Step 1: Viết test**

```tsx
it('mỗi FAQ là một thẻ riêng, dùng CHUNG một icon', () => {
  render(<GoodToKnowPanel tour={tour} />);
  const icons = screen.getAllByTestId('faq-icon');
  expect(icons).toHaveLength(tour.faqs.length);
  expect(new Set(icons.map((i) => i.dataset.icon)).size).toBe(1);
});

it('tour không có faq lẫn policy thì panel không render khung rỗng', () => {
  const { container } = render(<GoodToKnowPanel tour={{ ...tour, faqs: [], policies: [] }} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/good-to-know-panel.spec.tsx`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement theo spec §4.5**

Bám đúng số đo và token ở spec; mọi dòng chữ khai `line-height` chẵn.

- [ ] **Step 4: Chạy lại cho xanh**

Run: `cd apps/web && pnpm vitest run src/components/tours/panels/good-to-know-panel.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): tab Good to know với thẻ policy và accordion FAQ một icon dùng chung"
```

---

### Task 12: Ghép trang + nghiệm thu đo được

**Files:**
- Modify: `apps/web/src/app/(site)/tours/[slug]/page.tsx`

**Interfaces:**
- Consumes: mọi thứ từ Task 4–11.

- [ ] **Step 1: Ghép trang**

Thay `pageSections()`/`tocFromSections()`/lưới ba cột bằng:

```tsx
<DepartureSelectionProvider departures={tour.departures}>
  <div className="relative overflow-hidden bg-hero text-hero-foreground">
    <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />
    <TourHero tour={tour} />
    {/* dải khởi hành — giữ nguyên khối hiện có */}
  </div>

  <div className="w-full px-4 py-14 md:px-16 lg:px-24 xl:px-32">
    <div className="mx-auto max-w-6xl">
      <TourMediaPanel tour={tour} />
      <DepartureDialog />
      <TourTabs panels={{ /* 5 panel */ }} />
    </div>
  </div>

  <section aria-labelledby="related-heading" className="w-full px-4 pb-24 md:px-16 lg:px-24 xl:px-32">
    <div className="mx-auto max-w-6xl">
      <h2 id="related-heading" className="mb-6 font-heading text-2xl font-medium">{t.sections.related}</h2>
      <RelatedTours tours={relatedTours(tours, tour.slug, 3)} />
    </div>
  </section>

  <div aria-hidden="true" className="h-24 lg:hidden" />
  <BookingRailConnected slug={tour.slug} variant="bar" {...} />
</DepartureSelectionProvider>
```

⚠️ **Giữ nguyên khối JSDoc cảnh báo `loading.tsx`** ở đầu file — nó là lý do slug lạ trả
404 thật thay vì soft-404.

- [ ] **Step 2: Gate đầy đủ**

```bash
cd apps/api && (node --env-file-if-exists=.env.local dist/main.js &) && sleep 12
cd ../.. && pnpm gate:int
# xong thì kill API nền:
kill $(ss -ltnp | grep ':3001 ' | grep -oP 'pid=\K[0-9]+' | head -1)
```

Expected: 18/18 task, web build sinh đủ 74 trang tĩnh.

- [ ] **Step 3: Nghiệm thu đo được bằng trình duyệt thật**

Với dev server đang chạy, mở `/tours/ha-giang-loop-4d3n` và kiểm bằng script Playwright:

```js
// lưới trên phải ra ĐÚNG 621 | 40 | 443, ảnh chính 541×541
// 0 hàng lệch nửa pixel ở cả 4 tab
// viền ô ngày ≥ 3:1 ở CẢ hai chế độ sáng/tối
```

- [ ] **Step 4: Commit + docs sweep (luật 13)**

```bash
git add apps/web/src
git commit -m "feat(web): ghép trang Tour Details mới — gallery, panel đặt chỗ, 5 tab, related"
```

Thêm entry vào `docs/CHANGELOG.md` (ngày · hash · nội dung · review findings · số test).
**Grep `^+` trong file .md TRƯỚC khi `git add`** — dòng bắt đầu bằng `+` ở cột 0 là phép cộng,
không phải bullet.

---

## Sổ nợ mở (không thuộc plan này)

| Món | Ghi chú |
| --- | --- |
| Chạy `seed-media` cho tour | `MediaAsset` rỗng trên DB dev → gallery chưa có gì để hiện. Việc chặn khi **nghiệm thu**, không chặn khi code. |
| `freeCancellationDays` trên Tour | Để thẻ policy nói con số thật thay vì đọc-hiểu văn xuôi |
| `meals`/`accommodation` cho itinerary day | 73 row trên 30 tour phải soạn lại — làm cùng màn admin ở P4 |
| Thu/phóng trong lightbox | Sẽ nâng cấp luôn gallery trang vùng — ngoài phạm vi trang này |
