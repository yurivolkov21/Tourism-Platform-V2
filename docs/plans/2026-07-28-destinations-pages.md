# Cụm Destinations tĩnh — Implementation Plan

> **Cho agent thực thi:** dùng `superpowers:subagent-driven-development` (khuyến nghị)
> hoặc `superpowers:executing-plans` để làm từng task. Các bước dùng checkbox
> (`- [ ]`) để theo dõi.

**Goal:** Dựng `/destinations` + `/destinations/[region]` hoàn toàn tĩnh trên mock,
đóng khoản parity cuối của luồng *khám phá*.

**Architecture:** Vùng là khái niệm của **tầng trình bày** (Nexora cũng vậy) — 3 vùng
sống trong `lib/regions.ts`, còn `DestinationSchema.region` (chuỗi tự do) chỉ dùng để
*xếp* địa điểm vào 3 vùng đã biết. Mọi con số (`tourCount`, tour mỗi vùng, dải
at-a-glance) **dẫn xuất từ `TOURS`**, không viết tay. Tint vùng đến từ
`[data-region]` đã có trong `tokens.css`.

**Tech Stack:** Next.js 16 App Router (Turbopack) · React 19 · Tailwind v4 ·
Vitest 4 (2 project: `node` + `jsdom`) · Biome · `@tourism/tokens` · `@tourism/i18n`.

**Spec:** [2026-07-28-destinations-pages-design](../specs/2026-07-28-destinations-pages-design.md)

## Global Constraints

Áp cho **mọi** task, không nhắc lại trong từng task:

- **Chỉ giao diện tĩnh.** Không gắn API, không `fetch`, không oRPC client.
- **KHÔNG đụng** `libs/shared/contract`, `apps/api`, `apps/api/prisma/`.
- Comment code + JSDoc: **tiếng Việt**. Tên biến/hàm: tiếng Anh.
- Copy user-facing: **tiếng Anh**, tập trung trong `@tourism/i18n`. Không chuỗi inline.
- **Tokens-only, không hex.** Dùng `@tourism/tokens`.
- Ảnh: `ImagePlaceholder`. Không ảnh thật, không URL ngoài.
- Chỉ link tới trang **có thật**. `/destinations/[region]/[place]` KHÔNG tồn tại.
- Tiền **luôn là string**; `Number()` chỉ ở bước format cuối.
- **Value import trong `src/mocks/` phải BỎ đuôi `.js`** (Turbopack không map
  `.js`→`.ts`; Vitest thì map, nên test xanh mà `next build` đỏ). `import type` giữ
  `.js` được vì bị xoá lúc biên dịch.
- Vitest project `node` quét `src/lib/**` + `src/mocks/**`; project `dom` quét
  `src/components/**/*.spec.tsx`. **Không** quét `src/app/**`.
- Sau khi sửa `libs/shared/i18n` hoặc `libs/shared/tokens`: **rebuild package đó**
  (`pnpm turbo run build --filter=@tourism/i18n`), vì web đọc qua `dist`.
- Trước khi khai một task xong: `pnpm gate`. Trước khi khai **cả cụm** xong:
  `pnpm gate:int` (máy này không có Docker CLI → **CI là nơi xác minh**).
- **KHÔNG chạy `next build` khi cổng 3000 đang có dev server của user.** Kiểm bằng
  `curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/`
  (`000` = trống).
- Commit theo Conventional Commits. **KHÔNG** AI attribution.
- **Hỏi user trước mọi merge/push.**

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `libs/shared/tokens/style-dictionary/tokens.mjs` | **Sửa** — thêm slot `hero` cho 3 vùng |
| `apps/web/src/mocks/types.ts` | **Sửa** — `MockDestination` gương `DestinationSchema`; bỏ `tourCount` khỏi interface nguồn |
| `apps/web/src/mocks/destinations.ts` | **Sửa** — 9 địa điểm theo shape mới; `tourCount` dẫn xuất |
| `apps/web/src/lib/regions.ts` | **Tạo** — 3 vùng + chuẩn hoá + xếp nhóm + 3 phép dẫn xuất |
| `apps/web/src/lib/regions.spec.ts` | **Tạo** — test logic thuần |
| `libs/shared/i18n/src/lib/messages.ts` | **Sửa** — cắt ~202 dòng copy port từ Nexora |
| `apps/web/src/components/destinations/region-card.tsx` | **Tạo** — thẻ vùng của index |
| `apps/web/src/components/destinations/region-glance.tsx` | **Tạo** — dải số liệu dẫn xuất |
| `apps/web/src/components/destinations/place-card.tsx` | **Tạo** — thẻ địa điểm của trang vùng |
| `apps/web/src/components/destinations/*.spec.tsx` | **Tạo** — test component |
| `apps/web/src/app/(site)/destinations/page.tsx` | **Tạo** — index |
| `apps/web/src/app/(site)/destinations/[region]/page.tsx` | **Tạo** — trang vùng |
| `apps/web/src/components/home/gallery.tsx` | **Sửa** — `blurb` → `description`, thêm link ra `/destinations` |
| `apps/web/src/components/destinations-menu.tsx` | **Sửa** — `blurb` → `description` |
| `apps/web/src/components/site-header.tsx` | **Sửa** — `Destinations` → `/destinations` |
| `apps/web/src/components/site-footer.tsx` | **Sửa** — `Destinations` → `/destinations` |
| `apps/web/src/lib/sitemap.ts` + `.spec.ts` | **Sửa** — thêm 4 URL |
| `apps/web/src/mocks/mocks.spec.ts` | **Sửa** — 2 test destination đang khoá số liệu cũ |

⚠️ **KHÔNG tạo** `destinations/loading.tsx` lẫn `destinations/[region]/loading.tsx`.

---

### Task 1: Token `--region-hero` cho 3 vùng

**Vì sao task này đứng đầu:** trang vùng ở Task 6 cần nó, và spec §5.2 để mở cách
hiện thực. Spec đề xuất `color-mix(in oklch, var(--region-deep), var(--hero) …)`;
tính ra thì cách đó **không dùng được**: để `--region-deep` của Bắc (L 0.423) về
L≈0.28 cần pha **83% `--hero`**, tức xoá gần hết sắc vùng, và ba vùng cần ba tỉ lệ
khác nhau (60% / 31% / 51%) nên sẽ thành ba con số ma trong component. Giá trị màu
thuộc **tầng token**, nên tác thẳng một slot mới là đúng chỗ hơn.

**Files:**

- Modify: `libs/shared/tokens/style-dictionary/tokens.mjs` (`regionDefaults` + `regions`)
- Test: `libs/shared/tokens/style-dictionary/tokens.spec.mjs` (file test hiện có)

**Interfaces:**

- Produces: biến CSS `--region-hero`, có mặt ở `:root` (mặc định) và trong cả ba
  khối `[data-region='north'|'central'|'south']` của `generated/tokens.css`.

- [ ] **Step 1: Đọc test hiện có để biết khuôn**

Run: `sed -n '1,40p' libs/shared/tokens/style-dictionary/tokens.spec.mjs`
Mục đích: bắt chước đúng cách file này khẳng định slot vùng, không tự phát minh khuôn mới.

- [ ] **Step 2: Viết test thất bại**

Thêm vào `tokens.spec.mjs`:

```js
// `--region-hero`: nền hero của trang vùng. Tách khỏi `--region-deep` vì deep
// sáng 0.35–0.42 — dùng trực tiếp thì ba trang vùng sáng khác nhau thấy rõ, và
// navbar lúc chưa cuộn là trong suốt nên hero phải TỐI (luật CLAUDE.md).
describe('slot --region-hero', () => {
  it('cả ba vùng đều có slot hero', () => {
    for (const key of ['north', 'central', 'south']) {
      expect(regions[key], key).toHaveProperty('hero');
    }
  });

  it('regionDefaults cũng có hero để :root không thiếu biến', () => {
    expect(regionDefaults).toHaveProperty('hero');
  });

  it('hero của cả ba vùng TỐI và CÙNG một bậc — chênh nhau ≤ 0.02 L', () => {
    // Đây là bất biến sinh ra task này: `--region-deep` chênh 0.351 vs 0.423 nên
    // ba trang vùng đọc thành thiếu nhất quán chứ không thành bản sắc.
    const lightness = (v) => Number(/oklch\(([\d.]+)/.exec(v)[1]);
    const ls = ['north', 'central', 'south'].map((k) => lightness(regions[k].hero));
    for (const l of ls) expect(l).toBeLessThanOrEqual(0.26);
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThanOrEqual(0.02);
  });

  it('ba hero KHÁC nhau — nếu giống hết thì tint vùng vô nghĩa', () => {
    const set = new Set(['north', 'central', 'south'].map((k) => regions[k].hero));
    expect(set.size).toBe(3);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận ĐỎ**

Run: `pnpm turbo run test --filter=@tourism/tokens`
Expected: FAIL — `expect(regions.north).toHaveProperty('hero')`.

- [ ] **Step 4: Thêm slot vào `tokens.mjs`**

Trong `regionDefaults`, thêm dòng:

```js
  // Nền hero của trang vùng. Bằng `--hero` bản light để vùng không rõ vẫn ra
  // hero chuẩn của site, không ra một màu lạ.
  hero: 'oklch(0.25 0.015 181.5)',
```

Trong `regions.north` thêm:

```js
    // L 0.24 — cùng bậc tối với `--hero` (0.25) nên ba trang vùng sâu như nhau;
    // giữ hue 245.8 của Bắc, hạ chroma so với `deep` để hero không gào.
    hero: 'oklch(0.24 0.04 245.8)',
```

Trong `regions.central` thêm:

```js
    hero: 'oklch(0.235 0.08 25.9)',
```

Trong `regions.south` thêm:

```js
    // Hue lấy theo `primary` (48.4) chứ không theo `deep` (28.3): deep của Nam
    // gần như trùng hue với Trung (25.9), hai hero sẽ khó phân biệt.
    hero: 'oklch(0.24 0.05 45)',
```

- [ ] **Step 5: Chạy test, xác nhận XANH**

Run: `pnpm turbo run test --filter=@tourism/tokens`
Expected: PASS.

- [ ] **Step 6: Build tokens và kiểm biến có thật trong CSS**

Run: `pnpm turbo run build --filter=@tourism/tokens && grep -c "region-hero" libs/shared/tokens/generated/tokens.css`
Expected: `4` (1 ở `:root` + 3 khối `[data-region]`).

- [ ] **Step 7: Commit**

```bash
git add libs/shared/tokens/style-dictionary/tokens.mjs libs/shared/tokens/style-dictionary/tokens.spec.mjs
git commit -m "feat(tokens): slot --region-hero cho 3 vùng, cùng một bậc tối"
```

---

### Task 2: Đắp lại `MockDestination` gương contract

**Files:**

- Modify: `apps/web/src/mocks/types.ts` (`MockDestination`, quanh dòng 224)
- Modify: `apps/web/src/mocks/destinations.ts` (toàn file)
- Modify: `apps/web/src/mocks/mocks.spec.ts` (2 test quanh dòng 205–230)
- Modify: `apps/web/src/components/home/gallery.tsx:96`
- Modify: `apps/web/src/components/destinations-menu.tsx:81`

**Interfaces:**

- Produces:
  - `interface MockDestination { id: string; slug: string; name: string; country: string; region: string | null; description: string | null; tourCount: number }`
  - `const DESTINATIONS: MockDestination[]` — 9 phần tử, `tourCount` **dẫn xuất**
  - `const DESTINATIONS_SOURCE: Omit<MockDestination, 'tourCount'>[]` — dữ liệu tay

**Ghi chú bắt buộc:** `region` phải là `string | null`, **không** phải
`MockRegionKey`. Mock hẹp hơn contract nghĩa là mọi ca hỏng chỉ lộ lúc gắn API.
Giá trị dùng **tên hiển thị** (`'Northern Vietnam'`) chứ không phải `'north'`: nếu
mock chứa đúng khoá thì hàm chuẩn hoá ở Task 3 thành hàm đồng nhất và không bao giờ
được kiểm bằng input thật.

- [ ] **Step 1: Viết test thất bại**

Thay **cả hai** `it` trong `describe('mock destinations …')` của `mocks.spec.ts`
bằng:

```ts
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

  it('có đủ field contract yêu cầu, id là uuid', () => {
    for (const d of DESTINATIONS) {
      expect(d.id, d.slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);
      expect(d.country, d.slug).toBe('Vietnam');
      expect(typeof d.description, d.slug).toBe('string');
    }
  });

  it('slug duy nhất', () => {
    expect(new Set(DESTINATIONS.map((d) => d.slug)).size).toBe(9);
  });

  // Bất biến quan trọng nhất của task này. `tourCount` viết tay đang phồng 2–5×
  // (Hạ Long khai 9, thật 2) nên thẻ nói "9 tours" mà bấm sang
  // /tours?destinations=ha-long ra 2 — đúng lỗi "See all 1,204 reviews" mở ra 14.
  it('tourCount DẪN XUẤT khớp số tour thật chạm địa điểm', () => {
    for (const d of DESTINATIONS) {
      const real = TOURS.filter((t) => t.destinations.some((x) => x.slug === d.slug)).length;
      expect(d.tourCount, d.slug).toBe(real);
    }
  });

  it('con số thật NHỎ hơn số cũ viết tay — chốt chặn chống hồi quy', () => {
    // Nếu ai đó nhét lại literal thì tổng sẽ về 68.
    expect(DESTINATIONS.reduce((a, d) => a + d.tourCount, 0)).toBe(25);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/mocks/mocks.spec.ts`
Expected: FAIL — `region` đang là `'north'`, và `d.id` undefined.

- [ ] **Step 3: Sửa `MockDestination` trong `types.ts`**

Thay khối `MockDestination` hiện tại bằng:

```ts
/**
 * Gương đúng `DestinationSchema` của `@tourism/contract` — NGOẠI LỆ thứ hai của
 * luật "shape mock tự do" ở đầu file (cái đầu là tour).
 *
 * `region` để `string | null` Y NHƯ contract, KHÔNG siết thành `MockRegionKey`:
 * contract khai `z.string().max(80).nullable()`, và mock hẹp hơn contract nghĩa là
 * mọi ca hỏng chỉ lộ ra lúc gắn API. Việc xếp chuỗi tự do này vào 3 vùng đã biết
 * là việc của `lib/regions.ts`.
 *
 * `tourCount` KHÔNG viết tay — xem cuối `destinations.ts`.
 */
export interface MockDestination {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string | null;
  /** Contract dùng `description`; mock cũ gọi là `blurb` (đã đổi 28/07). */
  description: string | null;
  /** Số tour đã publish CHẠM địa điểm này — dẫn xuất từ `TOURS`. */
  tourCount: number;
}
```

- [ ] **Step 4: Viết lại `destinations.ts`**

```ts
import type { MockDestination } from './types.js';
// Value import BỎ đuôi `.js` — Turbopack không map `.js`→`.ts` (bẫy đã ghi ở
// đầu tours.ts và trong lib/toc.ts).
import { TOURS } from './tours';

// 9 địa điểm, mỗi vùng 3, xếp liền mạch Bắc → Trung → Nam theo trục địa lý.
//
// `region` mang TÊN HIỂN THỊ ('Northern Vietnam') chứ không mang khoá ('north'):
// contract khai region là chuỗi tự do, nên mock phải chứa thứ trông giống dữ liệu
// thật. Nếu để đúng khoá thì `regionOf()` thành hàm đồng nhất và không bao giờ
// được kiểm bằng input thật.
const DESTINATIONS_SOURCE: Omit<MockDestination, 'tourCount'>[] = [
  // ── Bắc ──
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000001',
    slug: 'sa-pa',
    name: 'Sa Pa',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'Misty rice terraces',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000002',
    slug: 'ha-long',
    name: 'Hạ Long',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'Limestone bay cruises',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000003',
    slug: 'ninh-binh',
    name: 'Ninh Bình',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'River caves & karst peaks',
  },
  // ── Trung ──
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000004',
    slug: 'hue',
    name: 'Huế',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: 'Imperial citadel & royal food',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000005',
    slug: 'da-nang',
    name: 'Đà Nẵng',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: 'Coast rides & Golden Bridge',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000006',
    slug: 'hoi-an',
    name: 'Hội An',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: 'Lantern-lit old town',
  },
  // ── Nam ──
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000007',
    slug: 'sai-gon',
    name: 'Sài Gòn',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description: 'Street food & history',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000008',
    slug: 'can-tho',
    name: 'Cần Thơ',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description: 'Floating markets at dawn',
  },
  {
    id: '7b1f0c3a-1111-4a11-8a01-000000000009',
    slug: 'phu-quoc',
    name: 'Phú Quốc',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description: 'Island reefs & fish sauce',
  },
];

/**
 * `tourCount` DẪN XUẤT, không viết tay — cùng lý lẽ với `ratingAvg`/`ratingCount`
 * của tour: con số in trên thẻ phải là con số của chính danh sách người đọc bấm
 * vào xem được. Bản viết tay trước đây phồng 2–5× (Hạ Long khai 9, thật 2), nên
 * thẻ nói "9 tours" rồi mở ra 2. Ở API thật đây là COUNT trên bảng join, nên dẫn
 * xuất phản chiếu đúng quan hệ đó.
 */
export const DESTINATIONS: MockDestination[] = DESTINATIONS_SOURCE.map((dest) => ({
  ...dest,
  tourCount: TOURS.filter((tour) => tour.destinations.some((d) => d.slug === dest.slug)).length,
}));
```

- [ ] **Step 5: Sửa 2 consumer của `blurb`**

`apps/web/src/components/home/gallery.tsx:96` — đổi:

```tsx
<ImagePlaceholder label={dest.description ?? dest.name} className="h-full w-full" />
```

`apps/web/src/components/destinations-menu.tsx:81` — đổi:

```tsx
{dest.description}
```

Giữ nguyên `line-clamp-1` và chiều rộng menu: comment ở đó nói con số 34→42rem chọn
theo "blurb dài nhất", mà độ dài text **không đổi** (chỉ đổi tên field), nên cơ sở
của con số vẫn đúng.

- [ ] **Step 6: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/mocks/mocks.spec.ts`
Expected: PASS.

- [ ] **Step 7: Xác nhận `blurb` đã tuyệt chủng**

Run: `grep -rn "blurb" apps/web/src libs/shared/ui/src | grep -v node_modules`
Expected: không dòng nào (comment trong `destinations-menu.tsx` nhắc chữ "blurb"
thì sửa lại thành "description").

- [ ] **Step 8: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/mocks apps/web/src/components/home/gallery.tsx apps/web/src/components/destinations-menu.tsx
git commit -m "fix(web): MockDestination gương DestinationSchema, tourCount dẫn xuất"
```

---

### Task 3: `lib/regions.ts` — logic thuần, TDD

**Files:**

- Create: `apps/web/src/lib/regions.ts`
- Create: `apps/web/src/lib/regions.spec.ts`

**Interfaces:**

- Consumes: `MockDestination` (Task 2), `MockTourCard`, `DESTINATIONS`, `TOURS`
- Produces:
  - `type RegionKey = 'north' | 'central' | 'south'`
  - `interface Region { key: RegionKey; slug: string; name: string; tagline: string }`
  - `const REGIONS: Region[]` (3, thứ tự Bắc→Trung→Nam)
  - `regionBySlug(slug: string): Region | undefined`
  - `regionOf(destination: { region: string | null }): RegionKey | null`
  - `destinationsInRegion<T extends { region: string | null }>(destinations: readonly T[], key: RegionKey): T[]`
  - `toursInRegion<T extends MockTourCard>(tours: readonly T[], destinations: readonly MockDestination[], key: RegionKey): T[]`
  - `interface RegionGlance { fromPrice: string; difficulties: MockTourDifficulty[]; categories: { slug: string; name: string }[] }`
  - `regionGlance(tours: readonly MockTourCard[]): RegionGlance | null`

- [ ] **Step 1: Viết test thất bại**

Tạo `apps/web/src/lib/regions.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  destinationsInRegion,
  REGIONS,
  regionBySlug,
  regionGlance,
  regionOf,
  toursInRegion,
} from './regions';
import { DESTINATIONS } from '@/mocks/destinations';
import { TOURS } from '@/mocks/tours';

describe('REGIONS', () => {
  it('đúng 3 vùng, thứ tự Bắc → Trung → Nam', () => {
    expect(REGIONS.map((r) => r.key)).toEqual(['north', 'central', 'south']);
  });

  it('slug là từ vựng URL, TÁCH khỏi key trỏ lớp token', () => {
    // Trộn hai từ vựng này mới là nợ: URL là chuyện SEO, tên lớp token
    // (`[data-region='north']`) là chuyện thiết kế.
    expect(REGIONS.map((r) => r.slug)).toEqual([
      'northern-vietnam',
      'central-vietnam',
      'southern-vietnam',
    ]);
  });

  it('KHÔNG còn tourCount viết tay', () => {
    for (const r of REGIONS) expect(r).not.toHaveProperty('tourCount');
  });
});

describe('regionBySlug', () => {
  it('tìm được vùng theo slug', () => {
    expect(regionBySlug('central-vietnam')?.key).toBe('central');
  });

  it('slug lạ trả undefined — trang gọi sẽ notFound()', () => {
    expect(regionBySlug('atlantis')).toBeUndefined();
  });
});

describe('regionOf — chuẩn hoá chuỗi tự do của contract', () => {
  it('khớp tên hiển thị', () => {
    expect(regionOf({ region: 'Northern Vietnam' })).toBe('north');
  });

  it('không phân biệt hoa/thường và bỏ khoảng trắng thừa', () => {
    expect(regionOf({ region: '  southern vietnam ' })).toBe('south');
  });

  it('khớp cả dạng khoá ngắn', () => {
    expect(regionOf({ region: 'central' })).toBe('central');
  });

  it('chuỗi lạ trả null, KHÔNG đoán', () => {
    expect(regionOf({ region: 'Mekong' })).toBeNull();
  });

  it('null trả null', () => {
    expect(regionOf({ region: null })).toBeNull();
  });
});

describe('bất biến chống địa điểm tàng hình', () => {
  // Địa điểm không map được sẽ vắng mặt khỏi mọi trang vùng, mà index chỉ hiện 3
  // vùng → nó tàng hình trên TOÀN SITE. Test này để ai thêm một cái lạ thì đỏ,
  // thay vì một địa điểm biến mất im lặng.
  it('cả 9 destination đều map được về một vùng', () => {
    for (const d of DESTINATIONS) expect(regionOf(d), d.slug).not.toBeNull();
  });

  it('mỗi vùng đúng 3 địa điểm, tổng 9', () => {
    const counts = REGIONS.map((r) => destinationsInRegion(DESTINATIONS, r.key).length);
    expect(counts).toEqual([3, 3, 3]);
  });
});

describe('toursInRegion', () => {
  it('đếm tour DISTINCT — tour chạm 2 địa điểm cùng vùng chỉ tính 1 lần', () => {
    // ha-long-bay-cruise chạm cả ha-long và ninh-binh (đều vùng Bắc).
    const north = toursInRegion(TOURS, DESTINATIONS, 'north');
    expect(north.filter((t) => t.slug === 'ha-long-bay-cruise')).toHaveLength(1);
  });

  it('mỗi vùng đúng 6 tour', () => {
    const counts = REGIONS.map((r) => toursInRegion(TOURS, DESTINATIONS, r.key).length);
    expect(counts).toEqual([6, 6, 6]);
  });

  it('tour xuyên vùng có mặt ở CẢ BA vùng', () => {
    for (const r of REGIONS) {
      const slugs = toursInRegion(TOURS, DESTINATIONS, r.key).map((t) => t.slug);
      expect(slugs, r.key).toContain('north-to-south-classic');
    }
  });

  it('tổng theo vùng KHÔNG bằng TOURS.length — cấm cộng dồn', () => {
    // 6+6+6 = 18 ≠ 16 vì north-to-south-classic thuộc cả ba vùng. Test này tồn
    // tại để không ai "sửa" con số thành tổng cộng dồn rồi in "18 tours".
    const total = REGIONS.reduce((a, r) => a + toursInRegion(TOURS, DESTINATIONS, r.key).length, 0);
    expect(total).toBe(18);
    expect(total).not.toBe(TOURS.length);
  });
});

describe('regionGlance — chỉ những thứ PHÂN BIỆT được vùng', () => {
  const north = toursInRegion(TOURS, DESTINATIONS, 'north');
  const south = toursInRegion(TOURS, DESTINATIONS, 'south');

  it('fromPrice là string và lấy basePrice nhỏ nhất, KHÔNG lấy giá đợt khởi hành', () => {
    const glance = regionGlance(north);
    expect(typeof glance?.fromPrice).toBe('string');
    expect(glance?.fromPrice).toBe('68.00');
  });

  it('phổ độ khó xếp theo bậc, không theo thứ tự gặp', () => {
    expect(regionGlance(north)?.difficulties).toEqual(['EASY', 'MODERATE', 'CHALLENGING']);
  });

  it('BỎ QUA difficulty null, không in "null" và không coi null là một bậc', () => {
    // phu-quoc-reef-days có difficulty: null.
    expect(regionGlance(south)?.difficulties).toEqual(['EASY', 'MODERATE']);
  });

  it('chuyên mục là tập duy nhất, giữ thứ tự gặp đầu tiên', () => {
    expect(regionGlance(north)?.categories.map((c) => c.slug)).toEqual([
      'cruises',
      'trekking',
      'scenic',
      'culture',
    ]);
  });

  it('không tour nào thì trả null — trang sẽ ẩn cả dải', () => {
    expect(regionGlance([])).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/lib/regions.spec.ts`
Expected: FAIL — `Failed to resolve import "./regions"`.

- [ ] **Step 3: Viết `lib/regions.ts`**

```ts
import type { MockDestination, MockTourCard, MockTourDifficulty } from '@/mocks/types';

/** Khoá vùng — TRỎ LỚP TOKEN `[data-region='…']` trong `tokens.css`. */
export type RegionKey = 'north' | 'central' | 'south';

export interface Region {
  key: RegionKey;
  /** Từ vựng URL. Cố tình KHÁC `key`: URL là chuyện SEO, `key` là chuyện thiết kế. */
  slug: string;
  name: string;
  tagline: string;
}

/**
 * 3 vùng sống ở TẦNG TRÌNH BÀY, không đến từ API — Nexora cũng vậy
 * (`regionSlugs()`), nên đây là parity chứ không phải đi tắt.
 * `DestinationSchema.region` (chuỗi tự do) chỉ dùng để XẾP địa điểm vào 3 vùng này.
 *
 * KHÔNG có `tourCount`: nó dẫn xuất từ `TOURS` qua `toursInRegion`.
 */
export const REGIONS: Region[] = [
  {
    key: 'north',
    slug: 'northern-vietnam',
    name: 'Northern Vietnam',
    tagline: 'Limestone bays, misty terraces, mountain passes',
  },
  {
    key: 'central',
    slug: 'central-vietnam',
    name: 'Central Vietnam',
    tagline: 'Imperial cities, lantern towns, coastal roads',
  },
  {
    key: 'south',
    slug: 'southern-vietnam',
    name: 'Southern Vietnam',
    tagline: 'River markets, orchards, delta life',
  },
];

export function regionBySlug(slug: string): Region | undefined {
  return REGIONS.find((region) => region.slug === slug);
}

/** Bảng nhận dạng: mỗi vùng nhận cả tên hiển thị lẫn khoá ngắn. Cố tình NGẮN —
    thêm alias là đoán, và đoán sai thì xếp địa điểm vào vùng sai. */
const ALIASES: Record<RegionKey, string[]> = {
  north: ['north', 'northern vietnam'],
  central: ['central', 'central vietnam'],
  south: ['south', 'southern vietnam'],
};

/**
 * Xếp `region` chuỗi tự do của contract vào một vùng đã biết.
 * Trả `null` khi không nhận ra — KHÔNG đoán. Trang gọi phải tự quyết làm gì với
 * `null`; xem bất biến "không địa điểm nào tàng hình" trong `regions.spec.ts`.
 */
export function regionOf(destination: { region: string | null }): RegionKey | null {
  if (destination.region === null) return null;
  const needle = destination.region.trim().toLowerCase();
  for (const key of Object.keys(ALIASES) as RegionKey[]) {
    if (ALIASES[key].includes(needle)) return key;
  }
  return null;
}

export function destinationsInRegion<T extends { region: string | null }>(
  destinations: readonly T[],
  key: RegionKey,
): T[] {
  return destinations.filter((dest) => regionOf(dest) === key);
}

/**
 * Tour của một vùng = tour DISTINCT chạm bất kỳ địa điểm của vùng.
 *
 * Distinct là phần dễ sai nhất: `ha-long-bay-cruise` chạm cả `ha-long` và
 * `ninh-binh` (cùng vùng Bắc) nên cộng theo địa điểm sẽ đếm nó hai lần.
 */
export function toursInRegion<T extends MockTourCard>(
  tours: readonly T[],
  destinations: readonly MockDestination[],
  key: RegionKey,
): T[] {
  const slugs = new Set(destinationsInRegion(destinations, key).map((dest) => dest.slug));
  return tours.filter((tour) => tour.destinations.some((dest) => slugs.has(dest.slug)));
}

export interface RegionGlance {
  /** `basePrice` nhỏ nhất — STRING, đúng luật "tiền luôn là string". */
  fromPrice: string;
  difficulties: MockTourDifficulty[];
  categories: { slug: string; name: string }[];
}

/** Bậc độ khó theo thứ tự tăng dần — để phổ in ra không phụ thuộc thứ tự gặp. */
const DIFFICULTY_ORDER: MockTourDifficulty[] = ['EASY', 'MODERATE', 'CHALLENGING'];

/**
 * Dải "at a glance" của một vùng. CHỈ ba thứ phân biệt được vùng.
 *
 * Cố tình KHÔNG có số tour và khoảng số ngày: đo trên mock thì số tour là 6/6/6 và
 * khoảng ngày là 1–12 ở CẢ BA vùng (mock chia đều, và tour 12 ngày thuộc cả ba),
 * nên hai con số đó là trang trí chứ không phải thông tin. Số tour chuyển sang
 * tiêu đề khu, nơi nó là ngữ cảnh chứ không giả làm điểm so sánh.
 */
export function regionGlance(tours: readonly MockTourCard[]): RegionGlance | null {
  if (tours.length === 0) return null;

  let fromPrice = tours[0]?.basePrice ?? '0';
  for (const tour of tours) {
    if (Number(tour.basePrice) < Number(fromPrice)) fromPrice = tour.basePrice;
  }

  // `difficulty` nullable: bỏ qua null, không in "null" và không coi nó là một bậc.
  const present = new Set(tours.map((t) => t.difficulty).filter((d) => d !== null));
  const difficulties = DIFFICULTY_ORDER.filter((level) => present.has(level));

  const categories: { slug: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const tour of tours) {
    if (seen.has(tour.category.slug)) continue;
    seen.add(tour.category.slug);
    categories.push(tour.category);
  }

  return { fromPrice, difficulties, categories };
}
```

- [ ] **Step 4: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/lib/regions.spec.ts`
Expected: PASS, 18 test.

- [ ] **Step 5: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/lib/regions.ts apps/web/src/lib/regions.spec.ts
git commit -m "feat(web): lib/regions — 3 vùng, chuẩn hoá region tự do, 3 phép dẫn xuất"
```

- [ ] **Step 6: 🛑 MỐC DỪNG (spec §11) — báo user số liệu dẫn xuất**

In bảng thật rồi **chờ user đối chiếu trước khi vẽ giao diện**:

```bash
cd apps/web && npx vitest run src/lib/regions.spec.ts src/mocks/mocks.spec.ts --reporter=verbose
```

Báo: `tourCount` từng địa điểm (2–4), tour mỗi vùng (6/6/6), `fromPrice`
($68/$59/$45), phổ độ khó, chuyên mục từng vùng.

---

### Task 4: Cắt copy i18n port từ Nexora

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (`destinationsPage` ~659,
  `destinationDetail` ~680, `regionPage` ~701 — tổng ≈202 dòng)

**Interfaces:**

- Produces: `messages.destinationsPage` + `messages.regionPage` với hình dạng mới;
  `messages.destinationDetail` **bị xoá hẳn**.

**Vì sao task này trước khi dựng trang:** trang tiêu thụ copy. Và khối hiện có
quảng cáo **4 địa danh v2 không bán** — `Hà Giang` (5 lần), `Lan Hạ`, `Fansipan`,
`Pù Luông` đều 0 lần trong mock. Wire nguyên khối là để trang vùng hứa những chuyến
không tồn tại.

- [ ] **Step 1: Đọc trọn ba khối trước khi cắt**

Run: `sed -n '655,865p' libs/shared/i18n/src/lib/messages.ts`

- [ ] **Step 2: Thay cả ba khối bằng bản đã cắt**

```ts
  // `/destinations` — cổng khám phá theo VÙNG.
  //
  // ĐÃ CẮT khỏi bản port từ Nexora, mỗi khoản một lý do:
  //  · `popularHeading`/`popularSubtitle` ("Most popular journeys" / "Traveller
  //    favourites") — KHÔNG có tín hiệu popularity trong contract (spec Tours §8 #3:
  //    chưa sort được theo rating/popularity). Cùng họ với badge "Verified" đã bị
  //    loại ở cụm reviews.
  //  · `regionHeading` cũ là "Top destinations in …" — "Top" ngụ ý xếp hạng không
  //    tồn tại. Cùng lý lẽ đã đổi "highlight" thành "Most recent" ở reviews.
  //  · `breadcrumbCurrent` cũ là 'Vietnam tours' — đây là trang địa điểm, không
  //    phải trang tour.
  //  · `viewMore` — không có trang nào để "xem thêm" tới.
  destinationsPage: {
    breadcrumbCurrent: 'Destinations',
    heroTitle: 'Explore Vietnam by region',
    heroSubtitle:
      'Three regions, nine places. Start where the journey makes sense for you.',
    regionHeading: (region: string) => `Places in ${region}`,
    placesLabel: 'Places',
    toursLabel: (n: number) => `${n} ${n === 1 ? 'tour' : 'tours'}`,
    exploreRegion: (region: string) => `Explore ${region}`,
  },

  // `/destinations/[region]`.
  //
  // ĐÃ CẮT: `gallery*` (không có gallery ảnh — quyết định 2 chốt tint+chữ+dữ liệu
  // gánh trang) · `highlights` và `signature.stats` (số liệu biên tập bịa như
  // "350km", "3,143m Fansipan", và trỏ vào nơi KHÔNG có trong mock) · `tags`
  // (hardcode, trong khi chuyên mục được DẪN XUẤT từ tour thật — giữ cả hai là hai
  // nguồn sự thật) · `allTab` (ngụ ý tab/lọc, ngoài phạm vi) · `bestForLabel`
  // (`suitableFor` nằm trên TourDetail, không nằm trên vùng) · `introHeading` cũ
  // "The best … tours" (superlative không có dữ liệu xếp hạng đỡ).
  //
  // `regions` KHOÁ BẰNG `key` của vùng, KHÔNG khoá bằng tên hiển thị: bản cũ dùng
  // Record<string,string> khoá bằng 'Northern Vietnam', nên đổi một chữ trong tên
  // hiển thị là copy biến mất im lặng.
  regionPage: {
    backToAll: 'All destinations',
    placesHeading: (region: string) => `Places in ${region}`,
    toursHeading: (region: string) => `Trips in ${region}`,
    toursCount: (n: number) => `${n} ${n === 1 ? 'trip' : 'trips'}`,
    noTours: 'No trips run in this region yet.',
    noToursBody: 'Tell us where you want to go and we will plan something.',
    glance: {
      fromLabel: 'From',
      difficultyLabel: 'Difficulty',
      categoriesLabel: 'Trip styles',
      /** Phổ 1 bậc in một chữ; ≥2 bậc in "easy → challenging". */
      difficultyRange: (from: string, to: string) => `${from} → ${to}`,
    },
    regions: {
      north: {
        intro:
          'Limestone bays, terraced highlands and cool mountain air — the north is Vietnam at its most dramatic.',
      },
      central: {
        intro:
          'Imperial citadels and lantern-lit old towns strung along a golden coastline between mountains and sea.',
      },
      south: {
        intro:
          'River deltas, island beaches and the easy warmth of the Mekong — the south takes its time.',
      },
    },
  },
```

**Xoá hẳn** khối `destinationDetail` — nó dành cho `/destinations/[slug]`, trang mà
cụm này cố ý không làm (spec §1). Trong đó `valueProps` còn hứa "Luxury transfers"
và "vetted private drivers", không field nào đỡ, trên một capstone **không doanh thu**.

- [ ] **Step 3: Xác nhận 4 địa danh đã tuyệt chủng**

Run:

```bash
for p in "Hà Giang" "Lan Hạ" "Fansipan" "Pù Luông"; do printf "%s=%s\n" "$p" "$(grep -c "$p" libs/shared/i18n/src/lib/messages.ts)"; done
```

Expected: cả bốn `=0`.

- [ ] **Step 4: Xác nhận không còn khoá bằng chuỗi user-facing**

Run: `grep -n "'Northern Vietnam':" libs/shared/i18n/src/lib/messages.ts`
Expected: không dòng nào.

- [ ] **Step 5: Xác nhận `destinationDetail` đã xoá**

Run: `grep -c "destinationDetail" libs/shared/i18n/src/lib/messages.ts`
Expected: `0`.

- [ ] **Step 6: Rebuild i18n + gate**

Run: `pnpm turbo run build --filter=@tourism/i18n && pnpm gate`
Expected: XANH. Nếu đỏ vì có chỗ đang đọc `messages.destinationDetail` thì đó là
consumer chết — xoá luôn.

- [ ] **Step 7: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts
git commit -m "refactor(i18n): cắt copy Destinations port từ Nexora — bỏ 4 địa danh v2 không bán"
```

---

### Task 5: `/destinations` — trang index

**Files:**

- Create: `apps/web/src/components/destinations/region-card.tsx`
- Create: `apps/web/src/components/destinations/region-card.spec.tsx`
- Create: `apps/web/src/app/(site)/destinations/page.tsx`

**Interfaces:**

- Consumes: `REGIONS`, `destinationsInRegion`, `toursInRegion` (Task 3);
  `DESTINATIONS` (Task 2)
- Produces: `RegionCard({ region, destinations, tourCount })` —
  `region: Region`, `destinations: MockDestination[]`, `tourCount: number`

- [ ] **Step 1: Viết test thất bại**

Tạo `region-card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MockDestination } from '@/mocks/types';
import { REGIONS } from '@/lib/regions';
import { RegionCard } from './region-card';

const NORTH = REGIONS[0]!;

function dest(slug: string, name: string, tourCount: number): MockDestination {
  return {
    id: `id-${slug}`,
    slug,
    name,
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: `About ${name}`,
    tourCount,
  };
}

const PLACES = [dest('ha-long', 'Hạ Long', 2), dest('sa-pa', 'Sa Pa', 3)];

describe('RegionCard', () => {
  it('CTA vào trang vùng dùng slug URL, không dùng key token', () => {
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={6} />);
    const cta = screen.getByRole('link', { name: /explore northern vietnam/i });
    expect(cta).toHaveAttribute('href', '/destinations/northern-vietnam');
  });

  it('mỗi địa điểm là LINK sang trang lọc tour CÓ THẬT', () => {
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByRole('link', { name: /Hạ Long/ })).toHaveAttribute(
      'href',
      '/tours?destinations=ha-long',
    );
  });

  it('in số tour của VÙNG, không cộng dồn số của từng địa điểm', () => {
    // 2 + 3 = 5 nhưng vùng có 6 (tour distinct). In tổng cộng dồn là nói sai.
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText('6 tours')).toBeInTheDocument();
    expect(screen.queryByText('5 tours')).not.toBeInTheDocument();
  });

  it('gắn data-region để lớp token tint đúng vùng', () => {
    const { container } = render(
      <RegionCard region={NORTH} destinations={PLACES} tourCount={6} />,
    );
    expect(container.querySelector('[data-region="north"]')).not.toBeNull();
  });

  it('số ÍT khi vùng chỉ có 1 tour', () => {
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={1} />);
    expect(screen.getByText('1 tour')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/components/destinations/region-card.spec.tsx`
Expected: FAIL — không resolve được `./region-card`.

- [ ] **Step 3: Viết `region-card.tsx`**

Yêu cầu bắt buộc:

- Gốc thẻ có `data-region={region.key}` để `[data-region]` trong `tokens.css` gán
  `--region-*` cho cây con.
- Tint dùng `style={{ background: 'var(--region-surface)', color: 'var(--region-on-surface)' }}`
  cho chip, `var(--region-primary)` cho accent — **không hex**.
- Tên địa điểm là `<a href={`/tours?destinations=${dest.slug}`}>`; CTA vùng là
  `<a href={`/destinations/${region.slug}`}>`.
- Copy lấy từ `messages.destinationsPage` (`toursLabel`, `exploreRegion`,
  `placesLabel`). **Không** chuỗi inline.
- Dùng `ButtonLink` (`@tourism/ui/components/button-link`) nếu CTA cần dáng nút —
  **không** dùng `Button render={<a/>}` (nó gắn `role="button"` lên anchor).

- [ ] **Step 4: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/components/destinations/region-card.spec.tsx`
Expected: PASS, 5 test.

- [ ] **Step 5: Viết `app/(site)/destinations/page.tsx`**

Yêu cầu:

- Server component. `export const metadata: Metadata` có `title`, `description`,
  `alternates: { canonical: '/destinations' }`, `openGraph`.
- Hero theo đúng khuôn đã chốt, ba lớp: `<section className="… bg-hero …
  text-hero-foreground">` bọc ngoài · `<TopoPattern className="bg-primary
  opacity-[0.12] dark:opacity-[0.2]" />` đặt **ngoài** scope `dark` ·
  `<div className="dark contents">` bọc nội dung. **Không** đặt `dark` lên chính
  `<section>`.
- Ba thẻ vùng dựng bằng:

```tsx
{REGIONS.map((region) => (
  <RegionCard
    key={region.key}
    region={region}
    destinations={destinationsInRegion(DESTINATIONS, region.key)}
    tourCount={toursInRegion(TOURS, DESTINATIONS, region.key).length}
  />
))}
```

- ⚠️ **KHÔNG tạo `loading.tsx`** trong `destinations/`.

- [ ] **Step 6: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/components/destinations apps/web/src/app/\(site\)/destinations
git commit -m "feat(web): trang /destinations — 3 thẻ vùng lồng địa điểm"
```

- [ ] **Step 7: 🛑 MỐC DỪNG (spec §11) — user duyệt `/destinations` trước khi sang trang vùng**

Kiểm cổng 3000 rồi chụp ảnh cả **light và dark**, gửi user. Chờ duyệt.

---

### Task 6: `/destinations/[region]` — trang vùng

**Files:**

- Create: `apps/web/src/components/destinations/region-glance.tsx`
- Create: `apps/web/src/components/destinations/region-glance.spec.tsx`
- Create: `apps/web/src/components/destinations/place-card.tsx`
- Create: `apps/web/src/app/(site)/destinations/[region]/page.tsx`

**Interfaces:**

- Consumes: `regionGlance`, `regionBySlug`, `REGIONS`, `toursInRegion`,
  `destinationsInRegion` (Task 3); `formatMoney` từ `@/lib/tours`
- Produces: `RegionGlanceBar({ glance })` — `glance: RegionGlance`;
  `PlaceCard({ destination })` — `destination: MockDestination`

- [ ] **Step 1: Viết test thất bại cho `RegionGlanceBar`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RegionGlanceBar } from './region-glance';

const GLANCE = {
  fromPrice: '68.00',
  difficulties: ['EASY', 'MODERATE', 'CHALLENGING'] as const,
  categories: [
    { slug: 'cruises', name: 'Cruises' },
    { slug: 'trekking', name: 'Trekking' },
  ],
};

describe('RegionGlanceBar', () => {
  it('in giá "từ" đã format, KHÔNG in chuỗi thô', () => {
    render(<RegionGlanceBar glance={{ ...GLANCE, difficulties: [...GLANCE.difficulties] }} currency="USD" />);
    expect(screen.getByText('$68')).toBeInTheDocument();
    expect(screen.queryByText('68.00')).not.toBeInTheDocument();
  });

  it('phổ ≥2 bậc in dạng khoảng', () => {
    render(<RegionGlanceBar glance={{ ...GLANCE, difficulties: [...GLANCE.difficulties] }} currency="USD" />);
    expect(screen.getByText('Easy → Challenging')).toBeInTheDocument();
  });

  it('phổ đúng 1 bậc in MỘT chữ, không in "Easy → Easy"', () => {
    render(<RegionGlanceBar glance={{ ...GLANCE, difficulties: ['EASY'] }} currency="USD" />);
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('KHÔNG in số tour và KHÔNG in khoảng ngày', () => {
    // Cả hai bằng nhau ở cả ba vùng (6/6/6 và 1–12) nên chúng là trang trí.
    render(<RegionGlanceBar glance={{ ...GLANCE, difficulties: [...GLANCE.difficulties] }} currency="USD" />);
    expect(screen.queryByText(/trips?$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/days/)).not.toBeInTheDocument();
  });

  it('liệt kê chuyên mục có mặt', () => {
    render(<RegionGlanceBar glance={{ ...GLANCE, difficulties: [...GLANCE.difficulties] }} currency="USD" />);
    expect(screen.getByText(/Cruises/)).toBeInTheDocument();
    expect(screen.getByText(/Trekking/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/components/destinations/region-glance.spec.tsx`
Expected: FAIL — không resolve `./region-glance`.

- [ ] **Step 3: Viết `region-glance.tsx` + `place-card.tsx`**

`RegionGlanceBar` yêu cầu:

- Nhận `glance: RegionGlance` + `currency: string`; dùng `formatMoney` từ
  `@/lib/tours` (đừng tự format tiền).
- Nhãn độ khó lấy từ `messages.toursPage.difficultyLabels` (đã có, đừng khai lại —
  `TourCard` từng mắc đúng lỗi này).
- Copy nhãn lấy từ `messages.regionPage.glance`.

`PlaceCard` yêu cầu: tên + `description` + `tourCount` (dùng
`messages.destinationsPage.toursLabel`) + link `/tours?destinations=<slug>`.

- [ ] **Step 4: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/components/destinations/region-glance.spec.tsx`
Expected: PASS, 5 test.

- [ ] **Step 5: Viết `app/(site)/destinations/[region]/page.tsx`**

```tsx
export function generateStaticParams() {
  return REGIONS.map((region) => ({ region: region.slug }));
}
```

Yêu cầu:

- `const region = regionBySlug(slug); if (!region) notFound();`
- `generateMetadata` có `alternates.canonical` + OG, cùng khuôn `/tours/[slug]`.
- Hero: `<section style={{ background: 'var(--region-hero)' }}>` với
  `data-region={region.key}` đặt ở **phần tử bọc ngoài** để lớp token gán biến
  trước khi hero đọc nó. Giữ đúng quy ước: `dark` bọc **nội dung**
  (`<div className="dark contents">`), KHÔNG đặt lên `<section>`.
- Thứ tự khu: hero → `RegionGlanceBar` → `placesHeading` + 3 `PlaceCard` →
  `toursHeading` + lưới `TourCard`.
- `TourCard` import từ `@/components/tours/tour-card` — **dùng lại**, không dựng card mới.
- Nhánh rỗng: `regionGlance` trả `null` → ẩn cả dải; không tour nào → `noTours` +
  `noToursBody` (link `/contact`).
- ⚠️ **KHÔNG tạo `loading.tsx`** trong `[region]/`.

- [ ] **Step 6: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/components/destinations apps/web/src/app/\(site\)/destinations
git commit -m "feat(web): trang /destinations/[region] — tint chiếm trang + dải số liệu dẫn xuất"
```

---

### Task 7: Nối dây nav/footer/gallery + sitemap

**Files:**

- Modify: `apps/web/src/lib/sitemap.ts` (`STATIC_PAGES` + comment dòng 22–23)
- Modify: `apps/web/src/lib/sitemap.spec.ts`
- Modify: `apps/web/src/components/site-header.tsx:34` (mobile) và mục
  `Destinations` của desktop
- Modify: `apps/web/src/components/site-footer.tsx:25`
- Modify: `apps/web/src/components/home/gallery.tsx` (thêm link ra `/destinations`)

**Interfaces:**

- Consumes: `REGIONS` (Task 3)
- Produces: `sitemapEntries(tours, posts)` trả **38** mục

- [ ] **Step 1: Viết test thất bại**

Thêm vào `sitemap.spec.ts`:

```ts
it('có /destinations và cả 3 trang vùng', () => {
  const urls = sitemapEntries(TOURS, JOURNAL_POSTS).map((e) => e.url);
  expect(urls).toContain(absoluteUrl('/destinations'));
  for (const region of REGIONS) {
    expect(urls, region.slug).toContain(absoluteUrl(`/destinations/${region.slug}`));
  }
});

it('tổng 38 URL', () => {
  // 9 tĩnh cũ + 1 index destinations + 3 vùng + 16 tour + 9 blog.
  expect(sitemapEntries(TOURS, JOURNAL_POSTS)).toHaveLength(38);
});
```

- [ ] **Step 2: Chạy test, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/lib/sitemap.spec.ts`
Expected: FAIL — thiếu `/destinations`, tổng là 34.

- [ ] **Step 3: Sửa `lib/sitemap.ts`**

Thêm vào `STATIC_PAGES` sau `/tours`:

```ts
  { path: '/destinations', priority: 0.9 },
```

Trong `sitemapEntries`, thêm sau nhóm `STATIC_PAGES`:

```ts
    ...REGIONS.map((region) => ({
      url: absoluteUrl(`/destinations/${region.slug}`),
      priority: 0.8,
    })),
```

Sửa comment dòng 22–23 — nó đang nói *"`/destinations` … CHƯA tồn tại"*, giờ sai:

```ts
 * `/tours/[slug]/book` CHƯA tồn tại nên không có ở đây; sitemap trỏ vào 404 là
 * cách nhanh nhất để crawler hạ tin cậy cả file. (`/destinations` đã có từ 28/07.)
```

- [ ] **Step 4: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/lib/sitemap.spec.ts`
Expected: PASS.

- [ ] **Step 5: Đổi 3 link đang trỏ tạm**

`site-footer.tsx` — `['Destinations', '/#gallery']` → `['Destinations', '/destinations']`,
và xoá phần comment nói `/destinations` chưa tồn tại.

`site-header.tsx` — mục `Destinations` trong `MOBILE_LINKS` (dòng 34) đổi `'/tours'`
→ `'/destinations'`. Mục `Destinations` ở desktop là `DestinationsMenu` (dropdown):
**giữ** các link địa điểm trỏ `/tours?destinations=`, nhưng thêm một dòng chân menu
`All destinations →` trỏ `/destinations`.

`home/gallery.tsx` — thêm link `/destinations` ở hàng tiêu đề khu (cùng hình dạng
"tiêu đề khu vực + điều khiển đuôi" mà listing chốt ở vòng 4).

- [ ] **Step 6: Xác nhận không còn link "Destinations" trỏ `/#gallery`**

Run: `grep -rn "'/#gallery'" apps/web/src`
Expected: không dòng nào.

- [ ] **Step 7: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/lib/sitemap.ts apps/web/src/lib/sitemap.spec.ts apps/web/src/components
git commit -m "feat(web): nối /destinations vào nav, footer, gallery và sitemap"
```

---

### Task 8: Đo thật + kiểm mắt + đóng cụm

**Files:** không sửa code; task này là cửa kiểm.

- [ ] **Step 1: Kiểm cổng 3000 trống**

Run: `curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://localhost:3000/`
Expected: `000`. Nếu `200` thì **dừng** — dev server của user đang chạy, hỏi trước.

- [ ] **Step 2: Build production**

Run: `cd apps/web && npx next build`
Expected: có `/destinations` (○) và `/destinations/[region]` (● SSG **3** slug).

- [ ] **Step 3: Đo status slug vùng lạ — bẫy soft 404**

```bash
cd apps/web && npx next start -p 3100 &
sleep 6
curl -s -o /dev/null -w "hop-le=%{http_code}\n" http://localhost:3100/destinations/northern-vietnam
curl -s -o /dev/null -w "la=%{http_code}\n" http://localhost:3100/destinations/atlantis
```

Expected: `hop-le=200`, **`la=404`**. Nếu `la=200` thì có `loading.tsx` lọt vào đâu
đó trong chuỗi segment — tìm và xoá.

- [ ] **Step 4: Đếm URL sitemap trên bản production**

Run: `curl -s http://localhost:3100/sitemap.xml | grep -c "<url>"`
Expected: `38`.

- [ ] **Step 5: Kill server, xác nhận cổng sạch**

```bash
kill %1
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://localhost:3100/
```

Expected: `000`. Báo user "cổng sạch".

- [ ] **Step 6: Kiểm mắt light + dark cho cả 3 vùng**

Chụp `/destinations` và cả 3 trang vùng ở hai theme. Khẳng định: ba hero **cùng một
bậc tối** nhưng **khác sắc**; chip tint đọc được ở cả hai theme.

- [ ] **Step 7: `pnpm gate:int`**

Run: `pnpm gate:int`
Nếu máy không có Docker CLI thì báo rõ **CI là nơi xác minh** và ghi vào entry
CHANGELOG.

- [ ] **Step 8: Docs sweep (luật 13)**

- 1 entry `docs/CHANGELOG.md`: ngày · hash · nội dung · review findings · số test.
- Cập nhật dòng cụm Destinations trong `docs/README.md` từ 🚧 sang ✅.
- Cập nhật dòng `P3b Web` trong `docs/README.md` (thêm cụm Destinations; đổi "kế
  tiếp" sang khoản kế trong loạt).
- **`git diff` file `.md` TRƯỚC khi stage** — formatter markdown đổi `+` đầu dòng
  thành `-` và làm sai số liệu trong entry cũ (đã dính 28/07, xem gotcha CLAUDE.md).
- Entry mới **không** để `+` ở đầu dòng.

- [ ] **Step 9: Hỏi user merge/push**

Không tự merge. Không tự push.

---

## Self-Review

**Spec coverage:**

| Spec | Task |
| --- | --- |
| §1 phạm vi | 1–8 |
| §2 năm quyết định | 1 (tint) · 5 (index lồng địa điểm) · 3 (slug URL) · 6 (chữ ký) |
| §3 parity Nexora | 3 (vùng trong code) · 4 (bỏ ảnh/copy bịa) |
| §4.1 mock gương contract | 2 |
| §4.2 ba phép dẫn xuất | 2 (tourCount) · 3 (vùng + glance) |
| §4.3 `lib/regions.ts` + ca `null` | 3 |
| §5.1 `/destinations` | 5 |
| §5.2 trang vùng + hero + glance | 1 · 6 |
| §6 nối dây + sitemap | 7 |
| §7 cắt copy i18n | 4 |
| §8 nợ ghi sổ | không có task — cố ý, đây là nợ |
| §9 TDD | 1 · 2 · 3 · 5 · 6 · 7 |
| §10 tiêu chí hoàn thành | 8 |
| §11 mốc dừng | 3 Step 6 · 5 Step 7 · 8 Step 9 |

**Type consistency:** `RegionKey` · `Region` · `RegionGlance` khai ở Task 3 và
dùng nguyên tên ở Task 5–7. `MockDestination` khai ở Task 2, dùng ở 3/5/6.
`regionGlance` trả `RegionGlance | null` và Task 6 xử lý nhánh `null`.

**Placeholder scan:** không có "TBD"/"TODO"/"tương tự Task N"/"xử lý edge case cho
phù hợp". Mọi bước đổi code đều có code thật hoặc danh sách yêu cầu đủ cụ thể để
kiểm được bằng test đã viết ở bước trước nó.

**Đã tự sửa khi soi lại:** khối `REGIONS` ở Task 3 ban đầu có một biểu thức vô nghĩa
ở `REGIONS[2].name` và tôi định thêm một Step để sửa nó. Đó là **lỗi của plan**, không
phải giải pháp — người thực thi copy nguyên khối là mang lỗi vào code. Đã sửa thẳng
khối code và bỏ Step đó.
