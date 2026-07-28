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
| `libs/shared/tokens/src/lib/tokens.spec.ts` | **Sửa** — `SLOTS` 5 → 6 + 2 test mới |
| `apps/web/src/mocks/types.ts` | **Sửa** — `MockDestination` gương `DestinationSchema`; `MockRegion` thêm `slug`, **xoá** `tourCount` |
| `apps/web/src/mocks/destinations.ts` | **Sửa** — 9 địa điểm theo shape mới; `tourCount` dẫn xuất |
| `apps/web/src/mocks/regions.ts` | **Sửa** — thêm `slug`, xoá `tourCount` viết tay |
| `apps/web/src/lib/regions.ts` | **Tạo** — CHỈ hàm (dữ liệu vùng ở `mocks/regions.ts`): chuẩn hoá + xếp nhóm + 3 phép dẫn xuất |
| `apps/web/src/lib/regions.spec.ts` | **Tạo** — test logic thuần |
| `apps/web/src/components/about/about-numbers.tsx` | **Sửa** — `TOTAL_TOURS` 68 → `TOURS.length` (16) |
| `apps/web/src/components/about/about-gallery.tsx` | **Sửa** — `TOTAL_TOURS` + 3 số theo vùng thành dẫn xuất |
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

**Vì sao task này đứng đầu:** trang vùng ở Task 5 cần nó, và spec §5.2 để mở cách
hiện thực. Spec đề xuất `color-mix(in oklch, var(--region-deep), var(--hero) …)`;
tính ra thì cách đó **không dùng được**: để `--region-deep` của Bắc (L 0.423) về
L≈0.28 cần pha **83% `--hero`**, tức xoá gần hết sắc vùng, và ba vùng cần ba tỉ lệ
khác nhau (60% / 31% / 51%) nên sẽ thành ba con số ma trong component. Giá trị màu
thuộc **tầng token**, nên tác thẳng một slot mới là đúng chỗ hơn.

**Files:**

- Modify: `libs/shared/tokens/style-dictionary/tokens.mjs` (`regionDefaults` + `regions`)
- Modify: `libs/shared/tokens/src/lib/tokens.spec.ts` (file test THẬT — nó
  `import * as src from '../../style-dictionary/tokens.mjs'` và dùng `oklch` của
  `culori`)

**Interfaces:**

- Produces: biến CSS `--region-hero`, có mặt ở `:root` (mặc định) và trong cả ba
  khối `[data-region='north'|'central'|'south']` của `generated/tokens.css`.

⚠️ **Task này LÀM ĐỎ một test đang xanh.** `tokens.spec.ts` (quanh dòng 28) có
`const SLOTS = ['primary', 'deep', 'surface', 'spark', 'on-surface']` và khẳng định
mỗi vùng có **đúng** bộ key đó. Thêm slot thứ 6 là vỡ test ấy — **đó là hành vi
đúng của test**, nên phải cập nhật `SLOTS` thành 6 phần tử, không phải nới lỏng
phép khẳng định.

- [ ] **Step 1: Đọc test hiện có để biết khuôn**

Run: `sed -n '1,50p' libs/shared/tokens/src/lib/tokens.spec.ts`
Mục đích: bắt chước đúng cách file này khẳng định slot vùng, không tự phát minh khuôn mới.

- [ ] **Step 2: Viết test thất bại**

Trong `tokens.spec.ts`, sửa `SLOTS` của `describe('lớp region …')` thành:

```ts
  const SLOTS = ['primary', 'deep', 'surface', 'spark', 'on-surface', 'hero'];
```

Rồi thêm vào **cùng** `describe` đó:

```ts
  // `--region-hero`: nền hero của trang vùng. Tách khỏi `--region-deep` vì deep
  // sáng 0.35–0.42 — dùng trực tiếp thì ba trang vùng sáng khác nhau thấy rõ, và
  // navbar lúc chưa cuộn là trong suốt nên hero phải TỐI (luật CLAUDE.md).
  //
  // Phép "cả ba vùng CÓ slot hero" không cần test riêng: `SLOTS` ở trên đã khẳng
  // định bộ key đúng bằng 6 phần tử cho cả 3 vùng lẫn `regionDefaults`.
  it('hero của cả ba vùng TỐI và CÙNG một bậc — chênh nhau ≤ 0.02 L', () => {
    // Đây là bất biến sinh ra slot này: `--region-deep` chênh 0.351 vs 0.423 nên
    // ba trang vùng đọc thành thiếu nhất quán chứ không thành bản sắc.
    const ls = ['north', 'central', 'south'].map((k) => {
      const value = (src.regions as Record<string, Record<string, string>>)[k]?.hero ?? '';
      // Đọc L qua culori thay vì regex — cùng công cụ mà cả file này đang dùng.
      const parsed = oklch(value) as { l?: number } | undefined;
      expect(parsed, k).toBeDefined();
      return parsed?.l ?? 1;
    });
    for (const l of ls) expect(l).toBeLessThanOrEqual(0.26);
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThanOrEqual(0.02);
  });

  it('ba hero KHÁC nhau — nếu giống hết thì tint vùng vô nghĩa', () => {
    const heroes = ['north', 'central', 'south'].map(
      (k) => (src.regions as Record<string, Record<string, string>>)[k]?.hero,
    );
    expect(new Set(heroes).size).toBe(3);
  });
```

- [ ] **Step 3: Chạy test, xác nhận ĐỎ**

Run: `pnpm turbo run test --filter=@tourism/tokens`
Expected: FAIL — test `SLOTS` đỏ trước (`regions.north` chưa có key `hero`), rồi hai
test mới cũng đỏ.

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
git add libs/shared/tokens/style-dictionary/tokens.mjs libs/shared/tokens/src/lib/tokens.spec.ts
git commit -m "feat(tokens): slot --region-hero cho 3 vùng, cùng một bậc tối"
```

---

### Task 2: Số liệu trở thành DẪN XUẤT — mock gương contract + `lib/regions.ts`

**Vì sao một task chứ không hai:** reshape mock chỉ có nghĩa *vì* có dẫn xuất, mà
dẫn xuất cần shape mới. Tách ra thì task đầu phải viết logic đếm tạm cho
`about-gallery` rồi task sau thay — tức cố tình dựng bản trùng. Không reviewer nào
duyệt được nửa này mà từ chối nửa kia.

**Files:**

- Modify: `apps/web/src/mocks/types.ts` (`MockDestination` ~224 · `MockRegion` ~155)
- Modify: `apps/web/src/mocks/destinations.ts` (toàn file)
- Modify: `apps/web/src/mocks/regions.ts` (thêm `slug`, **xoá** `tourCount`)
- Create: `apps/web/src/lib/regions.ts`
- Create: `apps/web/src/lib/regions.spec.ts`
- Modify: `apps/web/src/mocks/mocks.spec.ts` (2 test quanh dòng 205–230)
- Modify: `apps/web/src/components/home/gallery.tsx` (dòng 96 `blurb`)
- Modify: `apps/web/src/components/destinations-menu.tsx:81` (`blurb`)
- Modify: `apps/web/src/components/about/about-numbers.tsx:23` (`TOTAL_TOURS`)
- Modify: `apps/web/src/components/about/about-gallery.tsx` (dòng 17 · 82 · 90 · 99)

**Interfaces:**

- Consumes: `MockTourCard`, `MockTourDifficulty`, `TOURS` (đã có)
- Produces:
  - `interface MockDestination { id: string; slug: string; name: string; country: string; region: string | null; description: string | null; tourCount: number }`
  - `interface MockRegion { key: MockRegionKey; slug: string; name: string; tagline: string }` — **`tourCount` bị xoá**
  - `const DESTINATIONS: MockDestination[]` — 9 phần tử, `tourCount` dẫn xuất
  - `const REGIONS: MockRegion[]` — vẫn ở `mocks/regions.ts`, giờ có `slug`
  - `lib/regions.ts`:
    - `type RegionKey = MockRegionKey`
    - `regionBySlug(regions: readonly MockRegion[], slug: string): MockRegion | undefined`
    - `regionOf(regions: readonly MockRegion[], destination: { region: string | null }): RegionKey | null`
    - `destinationsInRegion<T extends { region: string | null }>(regions: readonly MockRegion[], destinations: readonly T[], key: RegionKey): T[]`
    - `toursInRegion<T extends MockTourCard>(regions: readonly MockRegion[], destinations: readonly MockDestination[], tours: readonly T[], key: RegionKey): T[]`
    - `interface RegionGlance { fromPrice: string; difficulties: MockTourDifficulty[]; categories: { slug: string; name: string }[] }`
    - `regionGlance(tours: readonly MockTourCard[]): RegionGlance | null`

Hàm nhận dữ liệu qua **tham số**, không import `DESTINATIONS`/`TOURS` — đúng khuôn
`lib/tours.ts` hiện có (`filterTours(tours, …)`), và nhờ đó test được với fixture nhỏ.

⚠️ **Phạm vi rộng hơn cụm này — user đã chốt "dẫn xuất toàn site" (28/07).**
`tourCount` viết tay đang chạy trên HAI trang đã duyệt:

| Chỗ | Đang hiện | Sau task |
| --- | --- | --- |
| `/about` stat "Tours running" | 68 | **16** |
| `/about` gallery 3 vùng | 24 / 27 / 17 | **6 / 6 / 6** |
| `/` thẻ địa điểm `#gallery` | Hạ Long 9 | **2** |

**`TOTAL_TOURS` phải là `TOURS.length` (16), TUYỆT ĐỐI không phải tổng theo vùng
(=18).** `north-to-south-classic` thuộc cả ba vùng nên cộng dồn là đếm nó ba lần.

- [ ] **Step 1: Viết test thất bại cho mock**

Thay **cả hai** `it` trong `describe('mock destinations …')` của `mocks.spec.ts`:

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
```

- [ ] **Step 2: Viết test thất bại cho `lib/regions.ts`**

Tạo `apps/web/src/lib/regions.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { TOURS } from '@/mocks/tours';
import {
  destinationsInRegion,
  regionBySlug,
  regionGlance,
  regionOf,
  toursInRegion,
} from './regions';

describe('regionBySlug', () => {
  it('tìm được vùng theo slug', () => {
    expect(regionBySlug(REGIONS, 'central-vietnam')?.key).toBe('central');
  });

  it('slug lạ trả undefined — trang gọi sẽ notFound()', () => {
    expect(regionBySlug(REGIONS, 'atlantis')).toBeUndefined();
  });
});

describe('regionOf — chuẩn hoá chuỗi tự do của contract', () => {
  it('khớp tên hiển thị', () => {
    expect(regionOf(REGIONS, { region: 'Northern Vietnam' })).toBe('north');
  });

  it('không phân biệt hoa/thường và bỏ khoảng trắng thừa', () => {
    expect(regionOf(REGIONS, { region: '  southern vietnam ' })).toBe('south');
  });

  it('khớp cả dạng khoá ngắn', () => {
    expect(regionOf(REGIONS, { region: 'central' })).toBe('central');
  });

  it('chuỗi lạ trả null, KHÔNG đoán', () => {
    expect(regionOf(REGIONS, { region: 'Mekong' })).toBeNull();
  });

  it('null trả null', () => {
    expect(regionOf(REGIONS, { region: null })).toBeNull();
  });
});

describe('bất biến chống địa điểm tàng hình', () => {
  // Địa điểm không map được sẽ vắng mặt khỏi mọi trang vùng, mà index chỉ hiện 3
  // vùng → nó tàng hình trên TOÀN SITE. Test này để ai thêm một cái lạ thì đỏ,
  // thay vì một địa điểm biến mất im lặng.
  it('cả 9 destination đều map được về một vùng', () => {
    for (const d of DESTINATIONS) expect(regionOf(REGIONS, d), d.slug).not.toBeNull();
  });

  it('mỗi vùng đúng 3 địa điểm', () => {
    const counts = REGIONS.map((r) => destinationsInRegion(REGIONS, DESTINATIONS, r.key).length);
    expect(counts).toEqual([3, 3, 3]);
  });
});

describe('toursInRegion', () => {
  it('đếm tour DISTINCT — tour chạm 2 địa điểm cùng vùng chỉ tính 1 lần', () => {
    // ha-long-bay-cruise chạm cả ha-long và ninh-binh (đều vùng Bắc).
    const north = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'north');
    expect(north.filter((t) => t.slug === 'ha-long-bay-cruise')).toHaveLength(1);
  });

  it('mỗi vùng đúng 6 tour', () => {
    const counts = REGIONS.map((r) => toursInRegion(REGIONS, DESTINATIONS, TOURS, r.key).length);
    expect(counts).toEqual([6, 6, 6]);
  });

  it('tour xuyên vùng có mặt ở CẢ BA vùng', () => {
    for (const r of REGIONS) {
      const slugs = toursInRegion(REGIONS, DESTINATIONS, TOURS, r.key).map((t) => t.slug);
      expect(slugs, r.key).toContain('north-to-south-classic');
    }
  });

  it('tổng theo vùng KHÔNG bằng TOURS.length — cấm cộng dồn', () => {
    // 6+6+6 = 18 ≠ 16 vì north-to-south-classic thuộc cả ba vùng. Test này tồn tại
    // để không ai "sửa" TOTAL_TOURS của /about thành tổng cộng dồn.
    const total = REGIONS.reduce(
      (a, r) => a + toursInRegion(REGIONS, DESTINATIONS, TOURS, r.key).length,
      0,
    );
    expect(total).toBe(18);
    expect(total).not.toBe(TOURS.length);
  });
});

describe('regionGlance — chỉ những thứ PHÂN BIỆT được vùng', () => {
  const north = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'north');
  const south = toursInRegion(REGIONS, DESTINATIONS, TOURS, 'south');

  it('fromPrice là string và lấy basePrice nhỏ nhất', () => {
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

- [ ] **Step 3: Chạy cả hai, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/mocks/mocks.spec.ts src/lib/regions.spec.ts`
Expected: FAIL — `Failed to resolve import "./regions"`, và `region` đang là `'north'`.

- [ ] **Step 4: Sửa `MockDestination` + `MockRegion` trong `types.ts`**

```ts
/**
 * Gương đúng `DestinationSchema` của `@tourism/contract` — NGOẠI LỆ thứ hai của
 * luật "shape mock tự do" ở đầu file (cái đầu là tour).
 *
 * `region` để `string | null` Y NHƯ contract, KHÔNG siết thành `MockRegionKey`:
 * contract khai `z.string().max(80).nullable()`, và mock hẹp hơn contract nghĩa là
 * mọi ca hỏng chỉ lộ ra lúc gắn API. Việc xếp chuỗi tự do này vào 3 vùng đã biết
 * là việc của `lib/regions.ts`.
 */
export interface MockDestination {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string | null;
  /** Contract dùng `description`; mock cũ gọi là `blurb` (đã đổi 28/07). */
  description: string | null;
  /** Số tour đã publish CHẠM địa điểm này — dẫn xuất, xem cuối `destinations.ts`. */
  tourCount: number;
}
```

```ts
export interface MockRegion {
  key: MockRegionKey;
  /** Từ vựng URL của `/destinations/[region]`. Cố tình KHÁC `key`: `key` trỏ lớp
      token `[data-region='…']`, còn slug là chuyện SEO — trộn lại mới là nợ. */
  slug: string;
  name: string;
  tagline: string;
  // `tourCount` ĐÃ XOÁ (28/07): viết tay và sai (khai 24/27/17, thật 6/6/6). Số
  // tour của một vùng dẫn xuất bằng `toursInRegion()` ở lib/regions.ts.
}
```

Xoá luôn comment lạc hậu ở `MockDestination.tourCount` cũ ("tổng theo vùng phải khớp
MockRegion.tourCount") — bất biến đó không còn tồn tại.

- [ ] **Step 5: Viết lại `destinations.ts`**

```ts
import type { MockDestination } from './types.js';
// Value import BỎ đuôi `.js` — Turbopack không map `.js`→`.ts` (bẫy đã ghi ở đầu
// tours.ts và trong lib/toc.ts).
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
 * của tour: con số in trên thẻ phải là con số của chính danh sách người đọc bấm vào
 * xem được. Bản viết tay trước đây phồng 2–5× (Hạ Long khai 9, thật 2). Ở API thật
 * đây là COUNT trên bảng join, nên dẫn xuất phản chiếu đúng quan hệ đó.
 */
export const DESTINATIONS: MockDestination[] = DESTINATIONS_SOURCE.map((dest) => ({
  ...dest,
  tourCount: TOURS.filter((tour) => tour.destinations.some((d) => d.slug === dest.slug)).length,
}));
```

- [ ] **Step 6: Thêm `slug`, xoá `tourCount` trong `mocks/regions.ts`**

Mỗi vùng thêm `slug` (`'northern-vietnam'` · `'central-vietnam'` ·
`'southern-vietnam'`) và **xoá cả ba dòng `tourCount`**.

- [ ] **Step 7: Viết `lib/regions.ts`**

```ts
import type {
  MockDestination,
  MockRegion,
  MockRegionKey,
  MockTourCard,
  MockTourDifficulty,
} from '@/mocks/types';

/** Khoá vùng — TRỎ LỚP TOKEN `[data-region='…']` trong `tokens.css`. Tái dùng
    `MockRegionKey` thay vì khai union thứ hai: web chỉ nên có MỘT kiểu khoá vùng. */
export type RegionKey = MockRegionKey;

/**
 * Logic vùng. 3 vùng sống ở TẦNG TRÌNH BÀY, không đến từ API — Nexora cũng vậy
 * (`regionSlugs()`), nên đây là parity chứ không phải đi tắt.
 * `DestinationSchema.region` (chuỗi tự do) chỉ dùng để XẾP địa điểm vào 3 vùng đó.
 *
 * Dữ liệu vùng nằm ở `mocks/regions.ts`; file này chỉ có hàm, và nhận dữ liệu qua
 * tham số — đúng khuôn `lib/tours.ts`, nhờ đó test được với fixture nhỏ.
 */
export function regionBySlug(
  regions: readonly MockRegion[],
  slug: string,
): MockRegion | undefined {
  return regions.find((region) => region.slug === slug);
}

/**
 * Xếp `region` chuỗi tự do của contract vào một vùng đã biết. Nhận cả tên hiển thị
 * ('Northern Vietnam') lẫn khoá ngắn ('north'), không phân biệt hoa/thường.
 *
 * Bảng nhận dạng SUY TỪ chính `regions` chứ không khai riêng — một bảng alias tách
 * rời là một nguồn nữa có thể trôi khỏi danh sách vùng.
 *
 * Trả `null` khi không nhận ra — KHÔNG đoán, vì đoán sai thì địa điểm bị xếp vào
 * vùng sai. Xem bất biến "không địa điểm nào tàng hình" trong `regions.spec.ts`.
 */
export function regionOf(
  regions: readonly MockRegion[],
  destination: { region: string | null },
): RegionKey | null {
  if (destination.region === null) return null;
  const needle = destination.region.trim().toLowerCase();
  const match = regions.find(
    (region) => region.key === needle || region.name.toLowerCase() === needle,
  );
  return match?.key ?? null;
}

export function destinationsInRegion<T extends { region: string | null }>(
  regions: readonly MockRegion[],
  destinations: readonly T[],
  key: RegionKey,
): T[] {
  return destinations.filter((dest) => regionOf(regions, dest) === key);
}

/**
 * Tour của một vùng = tour DISTINCT chạm bất kỳ địa điểm của vùng.
 *
 * Distinct là phần dễ sai nhất: `ha-long-bay-cruise` chạm cả `ha-long` và
 * `ninh-binh` (cùng vùng Bắc) nên cộng theo địa điểm sẽ đếm nó hai lần.
 */
export function toursInRegion<T extends MockTourCard>(
  regions: readonly MockRegion[],
  destinations: readonly MockDestination[],
  tours: readonly T[],
  key: RegionKey,
): T[] {
  const slugs = new Set(destinationsInRegion(regions, destinations, key).map((d) => d.slug));
  return tours.filter((tour) => tour.destinations.some((dest) => slugs.has(dest.slug)));
}

export interface RegionGlance {
  /** `basePrice` nhỏ nhất — STRING, đúng luật "tiền luôn là string". */
  fromPrice: string;
  difficulties: MockTourDifficulty[];
  categories: { slug: string; name: string }[];
}

/** Bậc độ khó tăng dần — để phổ in ra không phụ thuộc thứ tự gặp. */
const DIFFICULTY_ORDER: MockTourDifficulty[] = ['EASY', 'MODERATE', 'CHALLENGING'];

/**
 * Dải "at a glance" của một vùng. CHỈ ba thứ phân biệt được vùng.
 *
 * Cố tình KHÔNG có số tour và khoảng số ngày: đo trên mock thì số tour là 6/6/6 và
 * khoảng ngày là 1–12 ở CẢ BA vùng (mock chia đều, và tour 12 ngày thuộc cả ba),
 * nên hai con số đó là trang trí chứ không phải thông tin. Số tour chuyển sang tiêu
 * đề khu, nơi nó là ngữ cảnh chứ không giả làm điểm so sánh.
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

- [ ] **Step 8: Sửa 4 consumer**

`components/home/gallery.tsx:96` — `label` của `ImagePlaceholder` đổi sang
`dest.description ?? dest.name`. Dòng 114 (`{dest.tourCount} tours`) **giữ nguyên** —
nó tự đúng vì `tourCount` giờ dẫn xuất.

`components/destinations-menu.tsx:81` — `{dest.blurb}` → `{dest.description}`. Giữ
nguyên `line-clamp-1` và chiều rộng menu 42rem: comment ở đó chọn con số theo "blurb
dài nhất", mà **độ dài text không đổi**. Sửa chữ "blurb" trong comment thành
"description".

`components/about/about-numbers.tsx:23` — `REGIONS.reduce((a, r) => a + r.tourCount, 0)`
không còn biên dịch được. Đổi thành:

```tsx
// 16 tour thật, KHÔNG cộng dồn theo vùng (=18): north-to-south-classic thuộc cả ba
// vùng nên cộng dồn là đếm nó ba lần. Comment cũ ở đây ghi "vá mâu thuẫn 96 hardcode
// ≠ 68 tổng mock" — hoá ra chính con 68 cũng sai, giờ dẫn xuất hết (user chốt 28/07).
const TOTAL_TOURS = TOURS.length;
```

`components/about/about-gallery.tsx` — dòng 17 sửa `TOTAL_TOURS` y như trên; ba chỗ
`count={...tourCount...}` (dòng 82 · 90 · 99) đổi sang:

```tsx
const regionTourCount = (key: MockRegionKey) =>
  toursInRegion(REGIONS, DESTINATIONS, TOURS, key).length;
```

rồi dùng `count={`${regionTourCount('north')} tours`}` … cho ba vùng.

- [ ] **Step 9: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/mocks/mocks.spec.ts src/lib/regions.spec.ts`
Expected: PASS.

- [ ] **Step 10: Kiểm `blurb` và `tourCount` viết tay đã tuyệt chủng**

Run: `grep -rn "blurb\|r\.tourCount\|region\.tourCount" apps/web/src`
Expected: không dòng nào (kể cả trong comment).

- [ ] **Step 11: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/mocks apps/web/src/lib/regions.ts apps/web/src/lib/regions.spec.ts apps/web/src/components
git commit -m "fix(web): số liệu vùng và địa điểm chuyển sang dẫn xuất từ TOURS"
```

- [ ] **Step 12: 🛑 MỐC DỪNG (spec §11) — báo user số liệu dẫn xuất**

In bảng thật rồi **chờ user đối chiếu trước khi vẽ giao diện**: `tourCount` từng địa
điểm (2–4), tour mỗi vùng (6/6/6), `fromPrice` ($68/$59/$45), phổ độ khó, chuyên mục
từng vùng, và số mới trên `/about` (16 · 6/6/6).

---

### Task 3: Copy i18n — cắt phần bịa, thêm phần điều hướng

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (`destinationsPage` ~659,
  `destinationDetail` ~680, `regionPage` ~701 — tổng ≈202 dòng; **và** khối `nav`)

**Interfaces:**

- Produces: `messages.destinationsPage` + `messages.regionPage` với hình dạng mới;
  `messages.destinationDetail` **bị xoá hẳn**; **thêm** `messages.nav.destinationsMenu`
  và `messages.destinationsPage.featured`.

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
    // Khu tour nổi bật của landing page. Gọi là "featured" vì nó lọc đúng field
    // `isFeatured` (biên tập chọn) — TUYỆT ĐỐI không gọi "popular"/"most loved"/
    // "traveller favourites": contract không có tín hiệu popularity nào đỡ những
    // chữ đó (spec Tours §8 #3), và đó chính là lý do khối `popular*` bị cắt ở trên.
    featured: {
      heading: 'Featured trips',
      subtitle: 'Journeys our team keeps coming back to, across all three regions.',
      viewAll: 'View all tours',
    },
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

- [ ] **Step 3: THÊM `nav.destinationsMenu` cho dropdown**

Trong khối `messages.nav`, thêm:

```ts
    // Dropdown Destinations trên navbar. Nexora có đúng 4 dòng phẳng, mỗi dòng một
    // `hint` GÕ TAY ('Hạ Long, Sa Pa, Ninh Bình') — thêm/bớt địa điểm là chữ đó sai
    // mà không ai biết. v2 CỐ TÌNH không có `hint` ở đây: menu sinh hint và số tour
    // từ dữ liệu (xem spec §6.1), nên i18n chỉ giữ nhãn tĩnh.
    destinationsMenu: {
      label: 'Destinations',
      all: 'All destinations',
      allHint: 'Browse every place we cover',
      /** Nhãn cho link tiêu đề vùng trong menu — điều hướng sang trang vùng. */
      exploreRegion: (region: string) => `Explore ${region}`,
    },
```

Không thêm mảng `items` cứng như Nexora: 3 vùng đã có trong `REGIONS`
(`mocks/regions.ts`) kèm `slug`, nên menu map từ đó. Một danh sách vùng thứ hai nằm
trong file copy là một nguồn nữa có thể trôi.

- [ ] **Step 4: Xác nhận 4 địa danh đã tuyệt chủng**

Run:

```bash
for p in "Hà Giang" "Lan Hạ" "Fansipan" "Pù Luông"; do printf "%s=%s\n" "$p" "$(grep -c "$p" libs/shared/i18n/src/lib/messages.ts)"; done
```

Expected: cả bốn `=0`.

- [ ] **Step 5: Xác nhận không còn khoá bằng chuỗi user-facing**

Run: `grep -n "'Northern Vietnam':" libs/shared/i18n/src/lib/messages.ts`
Expected: không dòng nào.

- [ ] **Step 6: Xác nhận `destinationDetail` đã xoá**

Run: `grep -c "destinationDetail" libs/shared/i18n/src/lib/messages.ts`
Expected: `0`.

- [ ] **Step 7: Rebuild i18n + gate**

Run: `pnpm turbo run build --filter=@tourism/i18n && pnpm gate`
Expected: XANH. Nếu đỏ vì có chỗ đang đọc `messages.destinationDetail` thì đó là
consumer chết — xoá luôn.

- [ ] **Step 8: Commit**

```bash
git add libs/shared/i18n/src/lib/messages.ts
git commit -m "refactor(i18n): copy Destinations — cắt phần bịa, thêm menu điều hướng"
```

---

### Task 4: `/destinations` — landing page toàn cảnh 3 vùng

**Files:**

- Create: `apps/web/src/components/destinations/region-card.tsx`
- Create: `apps/web/src/components/destinations/region-card.spec.tsx`
- Create: `apps/web/src/app/(site)/destinations/page.tsx`

**Interfaces:**

- Consumes: `REGIONS`, `destinationsInRegion`, `toursInRegion`, `DESTINATIONS`,
  `TOURS` (Task 2) · `messages.destinationsPage` (Task 3) · `TourCard` (đã có)
- Produces: `RegionCard({ region, destinations, tourCount })` —
  `region: MockRegion`, `destinations: MockDestination[]`, `tourCount: number`

**Bốn khu, không phải "3 thẻ"** (spec §5.1 sửa 28/07 sau khi đối chiếu lại Nexora —
trang `/destinations` của họ có 8 khu, ta giữ 4 khu dựng được trung thực):

1. **Hero** tối + `TopoPattern` (tối đa 1 vị trí/trang).
2. **3 thẻ vùng** — `RegionCard`, mỗi thẻ mang tint riêng.
3. **`Featured trips`** — lọc `TOURS.filter((t) => t.isFeatured)` (đúng **6** tour
   trong mock), render bằng `TourCard` đã duyệt, kèm link `View all tours` → `/tours`.
4. **CTA hỏi** → `/contact` (dùng `ButtonLink`, KHÔNG dùng `Button render={<a/>}`).

Ba khu của Nexora **cố tình bỏ**, ghi lý do vào comment đầu file page: `BestTime` và
`TravelTips` (copy du lịch bịa — không field nào trong contract nói về mùa/thời tiết)
· `Gallery` ảnh biên tập (chưa có media cho destination) · `Testimonials` (trang chủ
đã có nguyên khu, lặp lại là độn cho dài).

⚠️ Khu Featured **không** được gọi là "popular"/"most loved"/"traveller favourites" —
`isFeatured` là cờ biên tập, không phải tín hiệu phổ biến. Dùng đúng
`messages.destinationsPage.featured`.

- [ ] **Step 1: Viết test thất bại**

Tạo `region-card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MockDestination } from '@/mocks/types';
import { REGIONS } from '@/mocks/regions';
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
- Ba thẻ vùng dựng bằng — **chú ý chữ ký hàm: `regions` là tham số ĐẦU**:

```tsx
{REGIONS.map((region) => (
  <RegionCard
    key={region.key}
    region={region}
    destinations={destinationsInRegion(REGIONS, DESTINATIONS, region.key)}
    tourCount={toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key).length}
  />
))}
```

- Khu `Featured trips` ngay sau đó:

```tsx
const featured = TOURS.filter((tour) => tour.isFeatured);
// …
{featured.map((tour) => (
  <TourCard key={tour.slug} tour={tour} />
))}
```

  Tiêu đề/phụ đề lấy từ `messages.destinationsPage.featured`. Link `viewAll` →
  `/tours`. Nếu `featured.length === 0` thì **ẩn cả khu**, đừng render tiêu đề rỗng.

- Khu CTA cuối: dùng `ButtonLink` → `/contact`.
- ⚠️ **KHÔNG tạo `loading.tsx`** trong `destinations/`.

- [ ] **Step 6: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/components/destinations apps/web/src/app/\(site\)/destinations
git commit -m "feat(web): landing page /destinations — 3 vùng có tint + featured trips"
```

- [ ] **Step 7: 🛑 MỐC DỪNG (spec §11) — user duyệt `/destinations` trước khi sang trang vùng**

Kiểm cổng 3000 rồi chụp ảnh cả **light và dark**, gửi user. Chờ duyệt.

---

### Task 5: `/destinations/[region]` — trang vùng

**Files:**

- Create: `apps/web/src/components/destinations/region-glance.tsx`
- Create: `apps/web/src/components/destinations/region-glance.spec.tsx`
- Create: `apps/web/src/components/destinations/place-card.tsx`
- Create: `apps/web/src/app/(site)/destinations/[region]/page.tsx`

**Interfaces:**

- Consumes: `regionGlance`, `regionBySlug`, `REGIONS`, `toursInRegion`,
  `destinationsInRegion` (Task 2); `formatMoney` từ `@/lib/tours`
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

- `const region = regionBySlug(REGIONS, slug); if (!region) notFound();` —
  **`regions` là tham số đầu**, đừng gọi `regionBySlug(slug)`.
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

### Task 6: Nối dây nav/footer/gallery + sitemap

**Files:**

- Modify: `apps/web/src/lib/sitemap.ts` (`STATIC_PAGES` + comment dòng 22–23)
- Modify: `apps/web/src/lib/sitemap.spec.ts`
- Modify: `apps/web/src/components/site-header.tsx:34` (mobile) và mục
  `Destinations` của desktop
- Modify: `apps/web/src/components/site-footer.tsx:25`
- Modify: `apps/web/src/components/home/gallery.tsx` (thêm link ra `/destinations`)

**Interfaces:**

- Consumes: `REGIONS` (mocks) + `toursInRegion` (Task 2)
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

- [ ] **Step 5: Dropdown navbar — thêm 2 tầng điều hướng (spec §6.1)**

Đây là phần v2 hơn Nexora rõ nhất, và **bố cục 3 cột đã dựng sẵn** trong
`destinations-menu.tsx` — chỉ thêm vào, không dựng lại:

1. **Hàng `All destinations`** trên đầu menu, trải hết chiều ngang, trỏ
   `/destinations`. Nhãn + hint lấy từ `messages.nav.destinationsMenu`
   (`all` / `allHint`).
2. **Tiêu đề mỗi cột vùng thành LINK** → `/destinations/${region.slug}`, kèm số tour
   dẫn xuất `toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key).length`. Tiêu đề
   mang tint vùng: đặt `data-region={region.key}` trên cột rồi dùng
   `style={{ color: 'var(--region-primary)' }}`.
3. **Giữ nguyên 9 link địa điểm** trỏ `/tours?destinations=<slug>` — đây chính là
   tầng Nexora KHÔNG có (họ chỉ 4 dòng, muốn tới Hội An phải vào trang vùng tìm tiếp).

Số tour **dẫn xuất**, tuyệt đối không gõ tay — Nexora gõ `hint` cứng
(`'Hạ Long, Sa Pa, Ninh Bình'`) nên thêm/bớt địa điểm là chữ đó sai âm thầm.

⚠️ `destinations-menu.spec.tsx` đã tồn tại (4 test từ Task 2) và mở menu bằng
`userEvent` trước khi query. **Bổ sung test** cho hai thứ mới: hàng `All destinations`
trỏ `/destinations`, và mỗi tiêu đề vùng là link trỏ đúng `/destinations/<slug>`.

- [ ] **Step 6: Mobile — vá thụt lùi so với Nexora**

`site-header.tsx`, `MOBILE_LINKS`: mục `{ label: 'Destinations', href: '/tours' }`
hiện làm điện thoại **không có đường nào duyệt theo vùng** — Nexora trải phẳng 4 mục
vào menu mobile, v2 đang tệ hơn. Thay bằng 4 mục:

```tsx
  { label: 'All destinations', href: '/destinations' },
  ...REGIONS.map((region) => ({
    label: region.name,
    href: `/destinations/${region.slug}`,
  })),
```

Sửa luôn comment phía trên nó — nó đang ghi *"Một mục Destinations trỏ /tours là
đủ"*, đúng ở thời điểm chưa có trang nào để trỏ tới, sai từ khi cụm này tồn tại.

- [ ] **Step 7: Footer + gallery**

`site-footer.tsx` — `['Destinations', '/#gallery']` → `['Destinations', '/destinations']`,
và xoá phần comment nói `/destinations` chưa tồn tại.

`home/gallery.tsx` — thêm link `/destinations` ở hàng tiêu đề khu (cùng hình dạng
"tiêu đề khu vực + điều khiển đuôi" mà listing chốt ở vòng 4).

- [ ] **Step 8: Xác nhận không còn link "Destinations" trỏ `/#gallery`**

Run: `grep -rn "'/#gallery'" apps/web/src`
Expected: không dòng nào.

- [ ] **Step 9: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/lib/sitemap.ts apps/web/src/lib/sitemap.spec.ts apps/web/src/components
git commit -m "feat(web): dropdown 2 tầng + mobile 4 mục + sitemap 38 URL"
```

---

### Task 7: Đo thật + kiểm mắt + đóng cụm

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
| §1 phạm vi | 1–7 |
| §2 năm quyết định | 1 (tint) · 4 (index lồng địa điểm) · 2 (slug URL) · 5 (chữ ký) |
| §3 parity Nexora | 2 (vùng trong code) · 3 (bỏ copy bịa) |
| §4.1 mock gương contract | 2 |
| §4.2 ba phép dẫn xuất | 2 |
| §4.3 logic vùng + ca `null` | 2 |
| §5.1 `/destinations` | 4 |
| §5.2 trang vùng + hero + glance | 1 (token hero) · 5 |
| §6 nối dây + sitemap | 6 |
| §7 cắt copy i18n | 3 |
| §8 nợ ghi sổ | không có task — cố ý, đây là nợ |
| §9 TDD | 1 · 2 · 4 · 5 · 6 |
| §10 tiêu chí hoàn thành | 7 |
| §11 mốc dừng | **2 Step 12** · **4 Step 7** · 7 Step 9 |

**Type consistency:** `RegionKey` (= `MockRegionKey`, không khai union thứ hai) ·
`RegionGlance` khai ở Task 2, dùng nguyên tên ở Task 4–6. `MockDestination` và
`MockRegion` khai ở Task 2, dùng ở 4/5/6. `regionGlance` trả `RegionGlance | null`
và Task 5 xử lý nhánh `null`. Mọi hàm của `lib/regions.ts` nhận `regions` làm tham
số đầu — đúng khuôn `lib/tours.ts`.

**Placeholder scan:** không có "TBD"/"TODO"/"tương tự Task N"/"xử lý edge case cho
phù hợp". Mọi bước đổi code đều có code thật hoặc danh sách yêu cầu đủ cụ thể để
kiểm được bằng test đã viết ở bước trước nó.

**Bốn thứ pre-flight bắt được và đã sửa (28/07, trước khi dispatch):**

1. Task 1 ghi sai đường dẫn test — file thật là `libs/shared/tokens/src/lib/tokens.spec.ts`
   (TS, namespace import `src.*`, dùng `oklch` của `culori`), không phải `.mjs`.
2. Task 1 sẽ **làm đỏ một test đang xanh**: `SLOTS` hardcode 5 slot và khẳng định mỗi
   vùng có ĐÚNG bộ đó. Đã thêm bước cập nhật `SLOTS` — không nới lỏng phép khẳng định.
3. **Task 2 và Task 3 cũ đã GỘP.** Bản cũ tách "reshape mock" khỏi "lib/regions", nhưng
   `about-gallery` cần `toursInRegion` ngay khi `MockRegion.tourCount` bị xoá — tách ra
   thì task đầu phải viết logic đếm tạm rồi task sau thay, tức cố tình dựng bản trùng.
4. Bản cũ định khai `REGIONS` mới trong `lib/regions.ts`, nhưng `mocks/regions.ts` **đã
   có `REGIONS` với 5 consumer**. Nay `lib/regions.ts` chỉ chứa hàm; dữ liệu vùng ở
   mocks. Kèm phát hiện phạm vi: `tourCount` viết tay đang chạy trên `/about` và
   `/#gallery` — user chốt **dẫn xuất toàn site**, nên `/about` đổi 68 → 16.

**Đã tự sửa khi soi lại lần đầu:** khối `REGIONS` có một biểu thức vô nghĩa ở
`name` và tôi định thêm một Step để sửa nó. Đó là **lỗi của plan**, không phải giải
pháp — người thực thi copy nguyên khối là mang lỗi vào code. Đã sửa thẳng khối code.
