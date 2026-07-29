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

> **Bản 29/07.** User duyệt bốn quyết định trước khi dựng (spec §5.2 "Sửa 29/07"):
> (1) dải at-a-glance nằm **trong hero** thành rail đáy, không phải băng riêng ·
> (2) PLACES là **3 hàng rộng kẻ mảnh**, không phải 3 thẻ · (3) **có** băng CTA
> cuối trên nền `--region-hero` · (4) **có** JSON-LD `BreadcrumbList`.
> Bản Task 5 cũ (4 khu xếp chồng, 3 thẻ) đã bị thay — đừng quay lại nó.

**Files:**

- Create: `apps/web/src/components/destinations/region-glance.tsx`
- Create: `apps/web/src/components/destinations/region-glance.spec.tsx`
- Create: `apps/web/src/components/destinations/place-card.tsx`
- Create: `apps/web/src/components/destinations/place-card.spec.tsx`
- Create: `apps/web/src/app/(site)/destinations/[region]/page.tsx`

**Interfaces:**

- Consumes: `regionGlance`, `regionBySlug`, `toursInRegion`, `destinationsInRegion`,
  type `RegionGlance` (Task 2, `@/lib/regions`) · `REGIONS` (`@/mocks/regions`) ·
  `formatMoney` (`@/lib/tours`) · `TourCard` (`@/components/tours/tour-card`) ·
  `SectionEyebrow` (`@/components/home/section-eyebrow`) · `Reveal`
  (`@/components/motion/reveal`) · `TopoPattern` (`@/components/topo-pattern`) ·
  `ButtonLink` (`@tourism/ui/components/button-link`) · `absoluteUrl` (`@/lib/site`)
- Produces: `RegionGlanceBar({ glance, currency })` — `glance: RegionGlance`,
  `currency: string`; `PlaceCard({ destination })` — `destination: MockDestination`

⚠️ **Chữ ký hàm `@/lib/regions`: `regions` LUÔN là tham số đầu.** Gọi
`regionBySlug(REGIONS, slug)`, `destinationsInRegion(REGIONS, DESTINATIONS, key)`,
`toursInRegion(REGIONS, DESTINATIONS, TOURS, key)`, `regionGlance(tours)`.

**Bốn tài sản Task 5 là consumer ĐẦU TIÊN** — không cái nào cần tạo mới:
`--region-hero` (Task 1) · `region.tagline` (`mocks/regions.ts`, **0 consumer toàn
repo**) · `messages.enquiryCta.regionHeading(region)` · gần trọn
`messages.regionPage` (mới chỉ `regions[key].intro` được `RegionGroup` dùng).

- [ ] **Step 1: Viết test thất bại cho `RegionGlanceBar`**

Tạo `apps/web/src/components/destinations/region-glance.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RegionGlance } from '@/lib/regions';
import { RegionGlanceBar } from './region-glance';

const GLANCE: RegionGlance = {
  fromPrice: '68.00',
  difficulties: ['EASY', 'MODERATE', 'CHALLENGING'],
  categories: [
    { slug: 'cruises', name: 'Cruises' },
    { slug: 'trekking', name: 'Trekking' },
  ],
};

describe('RegionGlanceBar', () => {
  it('in giá "từ" đã format, KHÔNG in chuỗi thô', () => {
    render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    expect(screen.getByText('$68')).toBeInTheDocument();
    expect(screen.queryByText('68.00')).not.toBeInTheDocument();
  });

  it('phổ ≥2 bậc in dạng khoảng đầu → cuối', () => {
    render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    expect(screen.getByText('Easy → Challenging')).toBeInTheDocument();
  });

  it('phổ đúng 1 bậc in MỘT chữ, không in "Easy → Easy"', () => {
    render(<RegionGlanceBar glance={{ ...GLANCE, difficulties: ['EASY'] }} currency="USD" />);
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  // Thay bản cũ dùng `queryByText(/trips?$/)`: component không bao giờ render
  // chữ đó nên phép phủ định luôn đúng dù code làm gì — xanh mà không canh.
  // Khẳng định DANH SÁCH NHÃN thì thêm mục thứ tư (số tour, khoảng ngày) là đỏ.
  it('ĐÚNG BA mục, đúng ba nhãn — không số tour, không khoảng ngày', () => {
    const { container } = render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    const labels = [...container.querySelectorAll('dt')].map((el) => el.textContent);
    expect(labels).toEqual(['From', 'Difficulty', 'Trip styles']);
  });

  it('liệt kê chuyên mục có mặt', () => {
    render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    expect(screen.getByText(/Cruises/)).toBeInTheDocument();
    expect(screen.getByText(/Trekking/)).toBeInTheDocument();
  });

  // Nhánh CÓ THẬT khi gắn API: `difficulty` nullable, một vùng mà mọi tour đều
  // null thì `difficulties` rỗng. Bỏ hẳn mục, không in nhãn treo giá trị rỗng.
  it('không bậc độ khó nào thì BỎ HẲN mục đó, không in nhãn rỗng', () => {
    const { container } = render(
      <RegionGlanceBar glance={{ ...GLANCE, difficulties: [] }} currency="USD" />,
    );
    const labels = [...container.querySelectorAll('dt')].map((el) => el.textContent);
    expect(labels).toEqual(['From', 'Trip styles']);
  });
});
```

- [ ] **Step 2: Viết test thất bại cho `PlaceCard`**

Tạo `apps/web/src/components/destinations/place-card.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MockDestination } from '@/mocks/types';
import { PlaceCard } from './place-card';

function dest(overrides: Partial<MockDestination> = {}): MockDestination {
  return {
    id: 'id-sa-pa',
    slug: 'sa-pa',
    name: 'Sa Pa',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'Misty rice terraces',
    tourCount: 3,
    ...overrides,
  };
}

describe('PlaceCard', () => {
  it('CẢ HÀNG là một link sang trang lọc tour CÓ THẬT', () => {
    render(<PlaceCard destination={dest()} />);
    expect(screen.getByRole('link', { name: /Sa Pa/ })).toHaveAttribute(
      'href',
      '/tours?destinations=sa-pa',
    );
  });

  it('HIỆN description — đây là thứ bản 3-thẻ bỏ phí', () => {
    render(<PlaceCard destination={dest()} />);
    expect(screen.getByText('Misty rice terraces')).toBeInTheDocument();
  });

  it('in số tour DẪN XUẤT, số nhiều', () => {
    render(<PlaceCard destination={dest()} />);
    expect(screen.getByText('3 tours')).toBeInTheDocument();
  });

  it('số ÍT khi địa điểm chỉ có 1 tour', () => {
    render(<PlaceCard destination={dest({ tourCount: 1 })} />);
    expect(screen.getByText('1 tour')).toBeInTheDocument();
  });

  // `description` nullable trong contract (`DestinationSchema`) — không render
  // đoạn rỗng, và không in chữ "null".
  it('description null thì bỏ hẳn đoạn, không in "null"', () => {
    render(<PlaceCard destination={dest({ description: null })} />);
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sa Pa/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Chạy cả hai, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/components/destinations/region-glance.spec.tsx src/components/destinations/place-card.spec.tsx`
Expected: FAIL — không resolve `./region-glance` và `./place-card`.

- [ ] **Step 4: Viết `region-glance.tsx`**

Rail at-a-glance ĐẶT TRONG hero (quyết định 1), nên nó render trên nền
`--region-hero` bên trong scope `dark`.

- Nhận `glance: RegionGlance` + `currency: string`. Dùng `formatMoney` từ
  `@/lib/tours` — **đừng tự format tiền**.
- Nhãn độ khó lấy từ `messages.toursPage.difficultyLabels` — **đừng khai lại**
  bảng nhãn thứ hai (`TourCard` từng mắc đúng lỗi này).
- Copy nhãn lấy từ `messages.regionPage.glance` (`fromLabel` · `difficultyLabel` ·
  `categoriesLabel` · `difficultyRange`). Không chuỗi inline.
- Đánh dấu bằng `<dl>` với cặp `<dt>` (nhãn) / `<dd>` (giá trị) — cùng khuôn
  `know-before-you-go.tsx` đã dùng, và là thứ test Step 1 đếm.
- Phổ độ khó: 1 bậc in một chữ; ≥2 bậc in `difficultyRange(đầu, cuối)`. Mảng rỗng
  → **bỏ hẳn cặp `<dt>/<dd>` đó**.
- Chuyên mục: nối `name` bằng dấu ` · ` (cùng dấu phân cách mà `TourCard` dùng cho
  hàng duration · difficulty).
- Bố cục: hàng ngang cuộn được ở hẹp, `flex-wrap` ở rộng; ngăn cách bằng
  `border-t border-border` phía trên rail.

- [ ] **Step 5: Viết `place-card.tsx`**

Một HÀNG rộng (quyết định 2), **không phải thẻ có khung** — dải ảnh full-bleed và
thẻ có khung đều là hình dạng của trang khác.

- Gốc là `<a href={`/tours?destinations=${destination.slug}`}>` bọc CẢ hàng, có
  `group` + `relative`. Đúng một link mỗi hàng.
- Nội dung: tên (`font-heading`, `text-2xl md:text-3xl`, `text-foreground`) ·
  `description` (`text-muted-foreground`) · `messages.destinationsPage.toursLabel(
  destination.tourCount)` · `ArrowRightIcon` dịch phải khi hover.
- `description === null` → không render đoạn đó.
- Tint hover: một `<div aria-hidden>` phủ tuyệt đối, `style={{ background:
  'var(--region-primary)' }}`, `opacity-0` → `group-hover:opacity-[0.06]
  group-focus-visible:opacity-[0.06]`, có `transition-opacity duration-300` và
  `motion-reduce:transition-none`. **Không** đổi màu chữ khi hover — nền phớt 6%
  không đủ đổi nền để chữ phải theo.
- Vạch ngăn giữa các hàng do phía gọi lo (`divide-y divide-border` trên container),
  **không** để `PlaceCard` tự vẽ viền — nếu không hàng cuối thừa một vạch.

- [ ] **Step 6: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/components/destinations/region-glance.spec.tsx src/components/destinations/place-card.spec.tsx`
Expected: PASS, 6 + 5 = 11 test.

- [ ] **Step 7: Viết `app/(site)/destinations/[region]/page.tsx`**

```tsx
export function generateStaticParams() {
  return REGIONS.map((region) => ({ region: region.slug }));
}
```

Bốn khu, theo thứ tự: **hero (kèm rail) → PLACES → TRIPS → băng CTA vùng**.

- Server Component thuần. `const region = regionBySlug(REGIONS, slug); if (!region)
  notFound();` — **`REGIONS` là tham số đầu**, đừng gọi `regionBySlug(slug)`.
- `generateMetadata` cùng khuôn `/tours/[slug]`: slug lạ → trả
  `{ title: 'Region not found — Tourism' }` (KHÔNG `notFound()` trong metadata);
  slug hợp lệ → `title: \`${region.name} — Tourism\``, `description` =
  `messages.regionPage.regions[region.key].intro`, `alternates.canonical:
  \`/destinations/${region.slug}\``, `openGraph` với `absoluteUrl(...)`.
- **`data-region={region.key}` đặt trên MỘT `<div>` bọc toàn trang** — lớp token
  `[data-region]` phải gán `--region-*` trước khi bất kỳ khu nào đọc chúng.
- **Hero — khuôn bắt buộc, ba lớp:** `bg` đặt bằng
  `style={{ background: 'var(--region-hero)' }}` trên chính `<section>` (kèm
  `text-hero-foreground`), `<TopoPattern className="bg-primary opacity-[0.12]
  dark:opacity-[0.2]" />` đặt **NGOÀI** scope `dark`, rồi
  `<div className="dark contents">` bọc **nội dung**. **TUYỆT ĐỐI không** đặt class
  `dark` lên chính `<section>` — hero sẽ trùng màu nền trang ở dark mode.
  Padding theo đúng hero `/destinations`: `px-4 pt-36 pb-14 md:px-16 md:pb-16
  lg:px-24 xl:px-32`.
- Hero chứa: breadcrumb **3 cấp** (`Home` → `Destinations` (`/destinations`) →
  `region.name`, dùng `messages.regionPage.backToAll` cho nhãn cấp 2) · `<h1>` =
  `region.name` · `<p>` = **`region.tagline`** · rồi `<RegionGlanceBar>`.
  `regionGlance(tours)` trả `null` → **ẩn hẳn rail**, hero vẫn đứng.
- **PLACES:** `SectionEyebrow` = `messages.destinationsPage.placesLabel` · `<h2>` =
  `messages.regionPage.placesHeading(region.name)` · đoạn dẫn =
  `messages.regionPage.regions[region.key].intro` · rồi container
  `divide-y divide-border border-y border-border` chứa 3 `<PlaceCard>`.
- **TRIPS:** `SectionEyebrow` = `messages.regionPage.toursCount(n)` · `<h2>` =
  `messages.regionPage.toursHeading(region.name)` · lưới `TourCard` **dùng lại
  nguyên khuôn `related-tours.tsx`**: `grid grid-cols-1 gap-x-6 gap-y-8
  sm:grid-cols-2 lg:grid-cols-3`. Không dựng card mới.
  Không tour nào → `messages.regionPage.noTours` + `noToursBody` +
  `ButtonLink` → `/contact` (**không** `Button render={<a/>}`).
- **Băng CTA cuối:** `<section style={{ background: 'var(--region-hero)' }}
  className="… text-hero-foreground">` + `<div className="dark contents">` bọc nội
  dung (cùng khuôn hero, cùng cảnh báo). Nội dung: `<h2>` =
  `messages.enquiryCta.regionHeading(region.name)` · `<p>` =
  `messages.enquiryCta.subtitle` · `ButtonLink` = `messages.enquiryCta.cta` →
  `/contact`. **Không** dựng form ở đây — `/contact` là trang có thật.
- **JSON-LD `BreadcrumbList`** 3 cấp khớp breadcrumb đang hiện, chép đúng khuôn
  escape `<` của `/blog/[slug]` (`JSON.stringify(x).replace(/</g, '\\u003c')` +
  `biome-ignore` kèm lý do).
- `Reveal` bọc NGOÀI từng khu, đúng cách `/destinations/page.tsx` làm.
- Cỡ `h2` của khu: `text-3xl md:text-[40px]/12 leading-tight font-medium` — cỡ
  chuẩn trang marketing. **KHÔNG** `md:text-4xl` (cỡ đó của `/contact`).
- ⚠️ **KHÔNG tạo `loading.tsx`** trong `destinations/[region]/` lẫn
  `destinations/`. Một `loading.tsx` ở bất kỳ segment nào trong chuỗi làm slug lạ
  trả **HTTP 200** kèm giao diện 404 (đã đo ở `/tours/[slug]`); cụm này đưa 4 URL
  vào sitemap nên hậu quả y hệt.

- [ ] **Step 8: Đo tương phản CẢ BA vùng, CẢ HAI theme**

Đây là bước bắt buộc — cụm này đã dính **4 lỗi tương phản liên tiếp**, và **3 lần
phép đo sai** (đọc `lab()` bằng regex `rgb()` cho ra 1.16:1 hoàn toàn bịa).

- Phương pháp ĐÚNG: vẽ màu computed lên `canvas` rồi đọc pixel sRGB. **Không**
  parse chuỗi màu bằng regex — trình duyệt trả `lab()`/`oklch()`.
- Đo trên `/destinations/northern-vietnam`, `/central-vietnam`, `/southern-vietnam`,
  ở **light và dark**: chữ hero (h1, tagline) · **mọi `<dt>`/`<dd>` của rail** ·
  chữ băng CTA cuối. Ngưỡng AA: 4.5:1 chữ thường, 3:1 chữ lớn (≥24px).
- Ghi con số đo được vào report. Lưu ý giúp: `--region-hero` và scope `dark` đều
  **bất biến theo theme**, nên cặp nền/chữ trong hero giống hệt nhau ở hai theme —
  nhưng vẫn phải đo cả hai để bắt được chỗ nào lỡ dùng token theo-theme.

- [ ] **Step 9: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src/components/destinations apps/web/src/app/\(site\)/destinations
git commit -m "feat(web): trang /destinations/[region] — tint chiếm trang + rail số liệu dẫn xuất"
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

---

### Task 4b: Thiết kế lại `/destinations` — hành trình dọc kinh tuyến

**Vì sao có task này:** user xem bản dựng ở Task 4 và bác — *"3 cards vô hồn"*,
*"không cần trình sẵn các tours ở trang này"*. Xem spec §5.1 (sửa lần hai) cho
chẩn đoán đầy đủ. Task này **thay** khu 2 và **bỏ** khu Featured, **thêm** 3 khu.

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (thêm copy 3 khu mới)
- Rewrite: `apps/web/src/components/destinations/region-card.tsx` → thành
  `region-band.tsx` (đổi tên file, xoá file cũ)
- Rewrite: `apps/web/src/components/destinations/region-card.spec.tsx` → `region-band.spec.tsx`
- Create: `apps/web/src/components/destinations/journey-moments.tsx`
- Create: `apps/web/src/components/destinations/traveller-quotes.tsx`
- Create: `apps/web/src/components/destinations/know-before-you-go.tsx`
- Modify: `apps/web/src/app/(site)/destinations/page.tsx`

**Interfaces:**

- Consumes: `REGIONS` (`@/mocks/regions`) · `DESTINATIONS` · `TOURS` ·
  `MOMENTS` (`@/mocks/moments`) · `TESTIMONIALS` (`@/mocks/testimonials`) ·
  `FAQ_ITEMS` (`@/mocks/faq`) · `destinationsInRegion` · `toursInRegion`
- Produces:
  - `RegionBand({ region, destinations, tourCount, isLast })`
  - `JourneyMoments({ moments })` · `TravellerQuotes({ testimonials })` ·
    `KnowBeforeYouGo({ items })`

**Thứ tự khu của trang:** hero (giữ nguyên) → 3 `RegionBand` → `JourneyMoments`
→ `TravellerQuotes` → `KnowBeforeYouGo` → CTA (giữ nguyên).

- [ ] **Step 1: Thêm copy i18n cho 3 khu mới**

Trong `messages.destinationsPage`, thêm:

```ts
    moments: {
      heading: 'Moments from the journey',
      subtitle: 'Sent in by travellers, from the road.',
    },
    quotes: {
      heading: 'Loved by travellers',
      subtitle: 'A few words from people who went.',
    },
    know: {
      heading: 'Know before you go',
      subtitle: 'The questions we get asked most, answered plainly.',
      seeAll: 'See all questions',
    },
```

**Xoá** khối `featured` đã thêm ở Task 3 — khu đó bị bỏ. Rồi rebuild i18n.

- [ ] **Step 2: Viết test thất bại cho `RegionBand`**

Tạo `region-band.spec.tsx` (thay `region-card.spec.tsx`, xoá file cũ):

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import type { MockDestination } from '@/mocks/types';
import { RegionBand } from './region-band';

const NORTH = REGIONS[0]!;

function dest(slug: string, name: string, description: string, tourCount: number): MockDestination {
  return {
    id: `id-${slug}`,
    slug,
    name,
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description,
    tourCount,
  };
}

const PLACES = [
  dest('sa-pa', 'Sa Pa', 'Misty rice terraces', 3),
  dest('ha-long', 'Hạ Long', 'Limestone bay cruises', 2),
];

describe('RegionBand', () => {
  it('HIỆN mô tả từng địa điểm — đây là thứ bản thẻ cũ bỏ phí', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText('Misty rice terraces')).toBeInTheDocument();
    expect(screen.getByText('Limestone bay cruises')).toBeInTheDocument();
  });

  it('mỗi địa điểm là link sang trang lọc tour CÓ THẬT', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByRole('link', { name: /Sa Pa/ })).toHaveAttribute(
      'href',
      '/tours?destinations=sa-pa',
    );
  });

  it('CTA vùng dùng slug URL', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByRole('link', { name: /explore northern vietnam/i })).toHaveAttribute(
      'href',
      '/destinations/northern-vietnam',
    );
  });

  it('in số tour của VÙNG, không cộng dồn số của từng địa điểm', () => {
    // 3 + 2 = 5 nhưng vùng có 6 (tour distinct). Cộng dồn là nói sai.
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText(/6 tours/)).toBeInTheDocument();
    expect(screen.queryByText(/5 tours/)).not.toBeInTheDocument();
  });

  it('gắn data-region để lớp token tint đúng vùng', () => {
    const { container } = render(
      <RegionBand region={NORTH} destinations={PLACES} tourCount={6} />,
    );
    expect(container.querySelector('[data-region="north"]')).not.toBeNull();
  });

  it('KHÔNG đánh số thứ tự vùng — ba vùng không phải các bước tuần tự', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.queryByText(/^0?1$/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận ĐỎ**

Run: `cd apps/web && npx vitest run src/components/destinations/region-band.spec.tsx`
Expected: FAIL — không resolve `./region-band`.

- [ ] **Step 4: Viết `region-band.tsx`**

Yêu cầu bắt buộc:

- **Bố cục hai cột** (dồn một cột dưới `md`): trái là nội dung, phải là
  `ImagePlaceholder` tỉ lệ 4/3 với `label` là tên **địa điểm chính** của vùng
  (địa điểm đầu trong danh sách) — nhãn phải là dữ liệu thật, không bịa.
- **Kinh tuyến**: cột mảnh bên trái mang một đường dọc `w-px` + một chấm trạm
  (`size-2.5 rounded-full`) ngang tiêu đề vùng. Chấm tô `var(--region-primary)`.
  Đường kẻ dùng `bg-border`. `isLast` → đường dừng lại ở chấm (không kéo tiếp
  xuống), để hành trình có điểm kết.
- **Nền phớt**: `background: color-mix(in oklch, var(--region-surface), var(--background) 78%)`.
  **KHÔNG** tô đặc `--region-surface` — Nam sáng 0.661 vs Bắc 0.855, tô đặc thì ba
  băng sáng khác nhau thấy rõ.
- Tên vùng: `font-heading` cỡ lớn (`text-3xl md:text-4xl`), màu `text-foreground`.
- Danh sách địa điểm: **mỗi dòng có tên · `description` · số tour**, cả dòng là
  link `/tours?destinations=<slug>`. Đây là điểm sửa chính — bản cũ bỏ phí 9 câu
  mô tả này.
- CTA cuối band: `ButtonLink` → `/destinations/${region.slug}`,
  `style={{ background: 'var(--region-primary)' }}` + chữ trắng.
- `data-region={region.key}` đặt ở phần tử **bọc ngoài cùng** của band.
- **KHÔNG** đánh số 01/02/03.

Xoá `region-card.tsx` và `region-card.spec.tsx` sau khi chuyển xong.

- [ ] **Step 5: Chạy test, xác nhận XANH**

Run: `cd apps/web && npx vitest run src/components/destinations/region-band.spec.tsx`
Expected: PASS, 6 test.

- [ ] **Step 6: Viết 3 component khu mới**

`journey-moments.tsx` — băng **TỐI** (dùng `bg-hero` + `text-hero-foreground` +
wrapper `<div className="dark contents">`, đúng khuôn hero của repo). Khảm 5
`ImagePlaceholder`: 1 ô lớn + 4 ô nhỏ (cùng họ với `TourGallery` đã duyệt).
`moment.title` là caption đè lên ảnh, `moment.credit` là dòng nhỏ dưới caption.
**Không** lightbox — đây là khu giới thiệu, không phải gallery tương tác.

`traveller-quotes.tsx` — **3** testimonial đầu, dạng **trích dẫn lớn**
(`font-heading`, cỡ `text-xl`), kèm `name · location` và số sao. Cố ý KHÁC kiểu
marquee 2 cột ở trang chủ để không thành bản sao.

`know-before-you-go.tsx` — 5 `FAQ_ITEMS` dạng lưới 2 cột (1 cột dưới `md`), mỗi
mục `question` in đậm + `answer` bên dưới. Kèm link `See all questions` → `/faq`
(trang **có thật**).

Cả ba nhận dữ liệu qua **prop**, không tự import mock — để test được với fixture.

- [ ] **Step 7: Viết lại `page.tsx`**

Giữ nguyên hero và CTA cuối. Thay khu 3 thẻ bằng 3 `RegionBand`, **xoá** khu
Featured trips (và import `TourCard` không còn dùng). Thêm 3 khu mới đúng thứ tự.
Giữ `Reveal` bọc từng khu như Task 4 đã làm.

⚠️ `page.tsx` **phải vẫn là Server Component**, giữ `export const metadata`.
⚠️ **KHÔNG** tạo `loading.tsx`.

- [ ] **Step 8: `pnpm gate` rồi commit**

```bash
pnpm turbo run build --filter=@tourism/i18n
pnpm gate
git add apps/web/src libs/shared/i18n
git commit -m "feat(web): /destinations thành hành trình dọc kinh tuyến + 3 khu giới thiệu"
```

---

### Task 5b: Nền cho bản dựng lại theo Nexora — copy i18n + bản đồ biến thể + ô gradient

**Vì sao có task này:** user xem bản Task 5 và bác (29/07, vòng bốn của cụm). Yêu cầu:
dựng **giống trang Nexora thật** (`nexora-travel.agency/destinations/northern-vietnam`)
cho từng vùng, **bỏ khu `Plan your trip`** trước footer. Đã đối chiếu trang live: 8 khu,
giữ 7. Xem spec §5.2 "Sửa lần hai 29/07".

⚠️ **Bản Task 5 cũ bị THAY.** `region-glance.tsx` và `place-card.tsx` (+ 2 spec) sẽ bị
xoá ở Task 5c — Nexora không có hai khu đó. Hàm `regionGlance()` trong `lib/regions.ts`
thì **GIỮ**: nó là nguồn dẫn xuất cho `tags` và dải số liệu.

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `regionPage`, viết lại toàn bộ)
- Create: `apps/web/src/lib/region-theme.ts` + `.spec.ts`
- Create: `apps/web/src/components/destinations/region-tile.tsx` + `.spec.tsx`

**Interfaces:**

- Produces: `messages.regionPage` hình dạng mới (dưới đây) ·
  `regionTheme(key): { signature: 'stats' | 'timeline' | 'postcards'; heroPad: string; scrim: string }` ·
  `RegionTile({ label, className })`

- [ ] **Step 1: Viết lại khối `regionPage` trong `messages.ts`**

Thay TOÀN BỘ khối `regionPage` hiện có bằng khối dưới. Giữ nguyên comment giải thích
đã có ở đầu khối (lý do khoá bằng `key`), thêm ghi chú vì sao copy lệch Nexora.

```ts
  // `/destinations/[region]` — dựng theo trang vùng THẬT của Nexora (7 khu, bỏ
  // khu `Plan your trip`; user chốt 29/07).
  //
  // Copy port từ Nexora nhưng ĐÃ THAY mọi địa danh v2 KHÔNG bán — `Hà Giang`
  // (+ Mã Pí Lèng, 350km Loop), `Fansipan`, `Lan Hạ`, `Pù Luông`, `Củ Chi`,
  // `Marble Mountains`, và `Caves` ở tags của Trung. Thay bằng nơi có thật trong
  // mock: Ninh Bình · Mường Hoa · Ô Quy Hồ · Bắc Hà · Hải Vân · Bà Nà · Cần Thơ.
  // Đây là tiêu chí hoàn thành ở spec §10, không phải chuyện gu.
  //
  // `tags` và dải số liệu của khu Signature KHÔNG nằm ở đây: chúng DẪN XUẤT từ
  // `regionGlance()` và `toursInRegion()` — Nexora gõ tay nên thêm/bớt tour là
  // chữ sai âm thầm.
  regionPage: {
    backToAll: 'All destinations',
    introHeading: (region: string) => `The best ${region} tours`,
    /** CTA cuối khu intro. Nexora trỏ `#itineraries` (trang họ không có) — ở đây
        trỏ neo `#tours` NGAY TRÊN CÙNG TRANG, là khu có thật. */
    browseCta: (region: string) => `Browse ${region} trips`,
    bestForLabel: 'Best for',
    highlightsHeading: (region: string) => `What makes ${region} special`,
    toursHeading: 'Tours',
    allTab: 'All',
    noTours: 'No trips run in this region yet.',
    noToursBody: 'Tell us where you want to go and we will plan something.',
    galleryHeading: (region: string) => `${region} in photos`,
    gallerySubtitle: 'A glimpse of the landscapes, towns, and moments that await.',
    /** Nhãn cho dải số liệu khu Signature. GIÁ TRỊ dẫn xuất ở tầng trang. */
    statLabels: {
      from: 'From',
      longest: 'Longest trip',
      hardest: 'Hardest grade',
      styles: 'Trip styles',
      dayTrips: 'Trips done in a day',
      places: 'Places',
    },
    // "We've got you covered" — GIỮ khu, VIẾT LẠI nội dung. Bản Nexora hứa
    // "Luxury transfers" và "vetted private drivers": không field nào đỡ, trên một
    // capstone KHÔNG doanh thu. Ba mục dưới đây đều tựa vào thứ mock có thật —
    // `maxGroupSize` (12), giọng đã dùng ở footer, và `included`/`excluded`.
    valuePropsHeading: "We've got you covered",
    valueProps: [
      {
        title: 'Small groups',
        body: 'Twelve travellers at most, so you are never following a flag through a crowd.',
      },
      {
        title: 'Local guides',
        body: 'Led by people who grew up in the valleys, old towns and delta villages you came to see.',
      },
      {
        title: 'Clear inclusions',
        body: 'Every trip lists what is covered and what is not, before you book.',
      },
    ],
    regions: {
      north: {
        tagline:
          'From Sa Pa to Hạ Long Bay — culture and natural wonders in the misty north.',
        intro:
          'Awe-inspiring landscapes of limestone bays and terraced highlands, diverse hill-tribe cultures, and the high passes of the far north — this is Northern Vietnam at its most dramatic.',
        // Nexora: "ride the legendary Hà Giang Loop" → thay bằng Ô Quy Hồ, đèo có
        // thật trong itinerary ngày 3 của `northern-highlands-loop`.
        intro2:
          'Cruise the emerald karsts of Hạ Long, trek between Hmong and Dao villages around Sa Pa, and ride the switchbacks over Ô Quy Hồ. Browse our trips below.',
        highlights: [
          {
            title: 'Emerald bays',
            body: 'Overnight on a junk among the limestone islands of Hạ Long Bay.',
          },
          {
            title: 'Highland treks',
            body: 'Walk the rice terraces and hill-tribe trails of the Mường Hoa valley around Sa Pa.',
          },
          {
            title: 'River caves',
            body: 'Row between the karst peaks and flooded caves of Ninh Bình.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'Great northern adventures',
          body: 'The north rewards travellers who go further — onto the water, into the mountains, and out to the high passes. These are the journeys that define the region.',
          points: [
            'Overnight cruises through Hạ Long Bay',
            'Multi-day treks with Hmong and Dao guides',
            'The high passes above Sa Pa and Bắc Hà',
          ],
        },
      },
      central: {
        tagline: 'Imperial heritage, lantern-lit old towns and a golden coastline.',
        // Nexora: "some of the world's largest cave systems" → v2 không bán tour
        // hang động nào ở miền Trung. Thay bằng Chăm temple towers (Mỹ Sơn, có
        // thật ở itinerary ngày 5 của `central-heritage-week`).
        intro:
          'Ancient citadels and UNESCO old towns beside a golden coast, and Chăm temple towers in the hills — Central Vietnam is the country’s cultural heart.',
        intro2:
          'Step inside the walled citadel of Huế, wander the lantern-lit lanes of Hội An, and explore the Chăm temples of Mỹ Sơn. Browse our trips below.',
        highlights: [
          {
            title: 'Imperial Huế',
            body: 'The citadel, royal tombs, and refined cuisine of the Nguyễn emperors.',
          },
          {
            title: 'Hội An lanterns',
            body: 'A car-free UNESCO old town of tailors, tea houses, and riverside lights.',
          },
          {
            title: 'Golden coast',
            body: 'Đà Nẵng’s beaches, the Hải Vân pass, and the Bà Nà hills above.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'The heritage trail',
          body: 'Few stretches of Vietnam hold so much history in so little distance. Follow the thread of empires and trade from the citadel to the old port.',
          points: [
            'The walled citadel and royal tombs of Huế',
            'Lantern-lit Hội An and the Thu Bồn river',
            'The Chăm sanctuary of Mỹ Sơn',
          ],
          timeline: [
            {
              title: 'Huế',
              era: 'Imperial capital',
              body: 'The walled citadel, the Forbidden Purple City, and the royal tombs of the Nguyễn emperors along the Perfume river.',
            },
            {
              title: 'Hội An',
              era: 'Trading port',
              body: 'A lantern-lit UNESCO old town of tailor shops, tea houses, and the Japanese covered bridge over the Thu Bồn.',
            },
            {
              title: 'Mỹ Sơn',
              era: 'Chăm sanctuary',
              body: 'Red-brick temple towers set in a jungle valley — the spiritual heart of the Chăm kingdom for a thousand years.',
            },
          ],
        },
      },
      south: {
        tagline: 'River deltas, island beaches and the restless energy of Sài Gòn.',
        intro:
          'Floating markets and flooded paddies, a restless city and tropical islands — the warm, easy-going south runs at the pace of the water.',
        // Nexora: "from the Củ Chi tunnels to the colonial centre" → v2 không bán
        // Củ Chi. Thay bằng Cần Thơ và đêm ăn đường phố Sài Gòn, cả hai là tour thật.
        intro2:
          'Drift the Mekong’s waterways from Cần Thơ, eat your way through Sài Gòn after dark, and unwind on the reefs of Phú Quốc. Browse our trips below.',
        highlights: [
          {
            title: 'The Mekong',
            body: 'Floating markets at dawn, orchards, and riverside mornings around Cần Thơ.',
          },
          {
            title: 'Sài Gòn energy',
            body: 'Colonial landmarks by day and endless street food after dark.',
          },
          {
            title: 'Island escapes',
            body: 'White-sand beaches and clear reefs on Phú Quốc.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'Life on the water',
          body: 'In the south, the river is the road. Slow down to the rhythm of the delta and the islands, where days unfold on boats and beaches.',
          points: [
            'Dawn floating markets on the Mekong Delta',
            'Riverside mornings and orchard villages',
            'Island hopping around Phú Quốc',
          ],
          postcards: [
            { title: 'The Mekong Delta', caption: 'Floating markets & waterways' },
            { title: 'Sài Gòn', caption: 'City energy & history' },
            { title: 'Phú Quốc', caption: 'Island beaches' },
          ],
        },
      },
    },
  },
```

- [ ] **Step 2: Xác nhận 7 địa danh bịa đã tuyệt chủng**

Run:

```bash
FILTERED=$(awk '/^  mobile: \{/{skip=1} skip&&/^  \},$/{skip=0;next} !skip' libs/shared/i18n/src/lib/messages.ts | grep -vE '^[[:space:]]*(//|\*|/\*)')
for p in "Hà Giang" "Lan Hạ" "Fansipan" "Pù Luông" "Mã Pí Lèng" "Củ Chi" "Marble Mountains"; do printf "%s=%s\n" "$p" "$(printf '%s\n' "$FILTERED" | grep -c "$p")"; done
```

Expected: cả bảy `=0`.

⚠️ Lệnh phải LOẠI TRỪ dòng comment và khối `mobile:`, đúng cách spec §10 đã phát
biểu lại — bản đầu (`grep -c` thẳng cả file) **không bao giờ thoả được**, vì:

- Step 1 ngay trên đây BẮT viết khối comment *có nêu tên* cả bảy địa danh để nói
  rõ đã cắt gì (`// … 'Hà Giang' (+ Mã Pí Lèng, 350km Loop), 'Fansipan', …`), nên
  cổng tự mâu thuẫn với chính task sinh ra nó;
- `mobile:` là nợ P5 riêng (`location: 'Hà Giang, Việt Nam'` trong testimonial) —
  spec §8 #4 nói rõ đừng sửa.

Đây là lỗi CỦA PLAN và đã dính một lần ở Task 2. Cổng chỉ được đếm **chuỗi
user-facing của `destinationsPage` · `regionPage` · `nav`**, đúng như §10 khai.

- [ ] **Step 3: Viết test thất bại cho `lib/region-theme.ts`**

Tạo `apps/web/src/lib/region-theme.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { regionTheme } from './region-theme';

describe('regionTheme', () => {
  it('mỗi vùng một biến thể signature KHÁC nhau — đó là cả điểm của "da riêng"', () => {
    const variants = REGIONS.map((r) => regionTheme(r.key).signature);
    expect(new Set(variants).size).toBe(3);
  });

  it('Bắc dựng dải số liệu, Trung dựng timeline, Nam dựng bưu thiếp', () => {
    expect(regionTheme('north').signature).toBe('stats');
    expect(regionTheme('central').signature).toBe('timeline');
    expect(regionTheme('south').signature).toBe('postcards');
  });

  it('CHỈ Bắc để signature TRƯỚC highlights (nhánh isAdventure của Nexora)', () => {
    expect(regionTheme('north').signatureFirst).toBe(true);
    expect(regionTheme('central').signatureFirst).toBe(false);
    expect(regionTheme('south').signatureFirst).toBe(false);
  });

  it('hero của Bắc CAO hơn hai vùng kia — "mood" riêng, đúng heroHeight của Nexora', () => {
    expect(regionTheme('north').heroMinH).not.toBe(regionTheme('central').heroMinH);
    expect(regionTheme('central').heroMinH).toBe(regionTheme('south').heroMinH);
  });
});
```

- [ ] **Step 4: Viết `lib/region-theme.ts`**

```ts
import type { MockRegionKey } from '@/mocks/types';

/** Biến thể khu Signature. Tên theo CẤU TRÚC nó dựng, không theo tên vùng —
    `stats`/`timeline`/`postcards` đọc là biết render gì. */
export type SignatureVariant = 'stats' | 'timeline' | 'postcards';

export interface RegionTheme {
  signature: SignatureVariant;
  /** Bắc để Signature TRƯỚC Highlights; hai vùng kia ngược lại. Đây là nhánh
      `isAdventure` trong `page.tsx` của Nexora, giữ nguyên. */
  signatureFirst: boolean;
  /** Chiều cao tối thiểu hero — "mood" riêng từng vùng (Nexora: `heroHeight`). */
  heroMinH: string;
  /** Độ đậm scrim hero (Nexora: `heroScrim`). */
  scrim: string;
}

/**
 * "Xương chung — da riêng": ba vùng dùng chung bộ khung nhưng mỗi vùng một biến
 * thể Signature và một mood hero. Port thẳng ý của `lib/region-theme.ts` bên
 * Nexora, KHÁC hai chỗ:
 *  · Không có `accentText`/`accentBg`/`chipOn`: v2 đã có lớp token `[data-region]`
 *    nên màu đến từ `--region-*`, không cần chuỗi class Tailwind theo vùng.
 *  · Khoá bằng `MockRegionKey` (`north`) chứ không bằng slug URL — cùng lý do §7
 *    đã bỏ khoá-bằng-chuỗi-user-facing.
 */
const THEMES: Record<MockRegionKey, RegionTheme> = {
  north: {
    signature: 'stats',
    signatureFirst: true,
    heroMinH: 'min-h-[26rem] lg:min-h-[34rem]',
    scrim: 'from-scrim via-scrim/55 to-scrim/15',
  },
  central: {
    signature: 'timeline',
    signatureFirst: false,
    heroMinH: 'min-h-80 lg:min-h-96',
    scrim: 'from-scrim via-scrim/35 to-transparent',
  },
  south: {
    signature: 'postcards',
    signatureFirst: false,
    heroMinH: 'min-h-80 lg:min-h-96',
    scrim: 'from-scrim via-scrim/25 to-transparent',
  },
};

export function regionTheme(key: MockRegionKey): RegionTheme {
  return THEMES[key];
}
```

- [ ] **Step 5: Viết test thất bại cho `RegionTile`**

Tạo `apps/web/src/components/destinations/region-tile.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RegionTile } from './region-tile';

describe('RegionTile', () => {
  it('là ảnh khả truy cập mang nhãn mô tả, không phải div trơ', () => {
    render(<RegionTile label="Terraced rice fields" />);
    expect(screen.getByRole('img', { name: 'Terraced rice fields' })).toBeInTheDocument();
  });

  it('KHÔNG in nhãn thành chữ — nhãn chỉ cho trình đọc màn hình', () => {
    render(<RegionTile label="Terraced rice fields" />);
    expect(screen.queryByText('Terraced rice fields')).not.toBeInTheDocument();
  });

  it('nền pha từ token vùng, KHÔNG hex', () => {
    const { container } = render(<RegionTile label="x" />);
    const style = container.querySelector('[role="img"]')?.getAttribute('style') ?? '';
    expect(style).toContain('--region-primary');
    expect(style).toContain('--region-spark');
    expect(style).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
```

- [ ] **Step 6: Viết `region-tile.tsx`**

```tsx
import { cn } from '@tourism/ui/lib/utils';
import { ImageIcon } from 'lucide-react';

/**
 * Ô giữ chỗ ảnh CHO TRANG VÙNG. Đây là cơ chế dự phòng của chính Nexora
 * (`marketing/gallery.tsx` → `Tile` khi thiếu `src`: nền gradient + icon), khác
 * ở chỗ gradient pha bằng token VÙNG nên mỗi vùng một sắc.
 *
 * Vì sao KHÔNG dùng `ImagePlaceholder` xám của repo ở đây (user chốt 29/07):
 * trang này có 14 ô ảnh, trong đó khu `X in photos` là 10 ô liền nhau. Mười hộp
 * xám sọc chéo cạnh nhau đọc thành "vùng ảnh hỏng" chứ không thành gallery —
 * đúng lỗi đã đo ở `destination-tile.tsx`. Gradient có màu thì đọc được là chủ ý.
 *
 * Khi có ảnh thật: thêm prop `src` và render `next/image`, KHÔNG phải đổi bố cục.
 */
export function RegionTile({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        background:
          'linear-gradient(135deg, var(--region-primary), color-mix(in oklch, var(--region-spark), var(--region-deep) 45%))',
      }}
      className={cn('flex items-center justify-center overflow-hidden rounded-xl', className)}
    >
      <ImageIcon aria-hidden="true" className="size-7 text-on-media/70" />
    </div>
  );
}
```

- [ ] **Step 7: Rebuild i18n + gate + commit**

```bash
pnpm turbo run build --filter=@tourism/i18n
pnpm gate
git add libs/shared/i18n apps/web/src/lib/region-theme.ts apps/web/src/lib/region-theme.spec.ts apps/web/src/components/destinations/region-tile.tsx apps/web/src/components/destinations/region-tile.spec.tsx
git commit -m "feat(web): nền trang vùng theo Nexora — copy, bản đồ biến thể, ô gradient"
```

---

### Task 5c: Bảy khu trang vùng + lắp ráp `page.tsx`

**Tham chiếu CHỈ ĐỌC** (tuyệt đối không sửa):
`/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform/apps/web/src/` —
`app/destinations/[region]/page.tsx` · `components/destinations/region-{hero,intro,highlights,signature,signature-adventure,signature-timeline,signature-delta,tours}.tsx` ·
`components/marketing/gallery.tsx` · `components/destinations/value-props.tsx`.
Đọc kỹ từng file trước khi viết bản v2 tương ứng.

**Files:**

- Create: `components/destinations/region-hero.tsx`
- Create: `components/destinations/region-intro.tsx`
- Create: `components/destinations/region-highlights.tsx`
- Create: `components/destinations/region-signature-stats.tsx`
- Create: `components/destinations/region-signature-timeline.tsx`
- Create: `components/destinations/region-signature-postcards.tsx`
- Create: `components/destinations/region-tours.tsx` (**client**) + `.spec.tsx`
- Create: `components/destinations/region-gallery.tsx`
- Create: `components/destinations/region-value-props.tsx`
- Rewrite: `app/(site)/destinations/[region]/page.tsx`
- **Delete**: `components/destinations/region-glance.tsx` + `.spec.tsx` ·
  `components/destinations/place-card.tsx` + `.spec.tsx`

⚠️ **Xoá 4 file trên là CÓ CHỦ Ý** — Nexora không có khu "dải at-a-glance" lẫn khu
"places dạng hàng"; địa điểm xuất hiện dưới dạng **tab lọc** trong khu Tours. Hàm
`regionGlance()` ở `lib/regions.ts` thì **GIỮ NGUYÊN**: nó nuôi `tags` và dải số liệu.

**Thứ tự khu** (khớp trang live, bỏ khu 8 `Plan your trip`):

1. `RegionHero` → 2. `RegionIntro` → 3/4. Signature ↔ Highlights (**Bắc: signature
trước**, theo `regionTheme(key).signatureFirst`) → 5. `RegionTours` → 6. `RegionGallery`
→ 7. `RegionValueProps`.

- [ ] **Step 1: `region-hero.tsx`**

- `<section>` `relative isolate flex items-end overflow-hidden` + `regionTheme(key).heroMinH`.
- Nền: `<RegionTile>` phủ tuyệt đối `-z-10` (nhãn = tên vùng) + lớp scrim
  `absolute inset-0 -z-10 bg-linear-to-t` với `regionTheme(key).scrim`.
- Nội dung: breadcrumb 3 cấp (`Home` → `All destinations` `/destinations` → tên vùng,
  nhãn cấp 2 lấy `messages.regionPage.backToAll`) · `<h1>` tên vùng · `<p>` tagline.
- Chữ dùng `text-on-media` (token CỐ ĐỊNH, đúng cặp với scrim tối) — **KHÔNG**
  `text-foreground`, nó lật theo theme và sẽ tàng hình ở một trong hai theme.
- ⚠️ Hero này KHÔNG dùng khuôn `bg-hero` + `dark contents` như các hero khác của
  repo: nền ở đây là ảnh/tile phủ scrim, giống Nexora. Vì vậy **không** đặt class
  `dark` ở đâu trong khu này.

- [ ] **Step 2: `region-intro.tsx`**

Bố cục 2 cột (dồn 1 cột dưới `lg`), khớp `region-intro.tsx` của Nexora:

- Trái: `<h2>` `introHeading(name)` · vạch accent `h-1 w-12 rounded-full` nền
  `var(--region-primary)` · `<p>` intro (cỡ `text-lg`) · `<p>` intro2 ·
  hàng `bestForLabel` + **chip `tags` DẪN XUẤT** từ `regionGlance(tours).categories`
  (chip viền `border-border`, chữ `text-muted-foreground`) · `ButtonLink` →
  `#tours` với nhãn `browseCta(name)`, nền `var(--region-primary)` chữ `text-on-media`.
- Phải: bento 3 ô `RegionTile` — 1 ô cao `row-span-2` bên trái, 2 ô xếp chồng bên
  phải, khung `grid h-96 grid-cols-2 grid-rows-2 gap-3 sm:gap-4`. Nhãn từng ô lấy
  **tên 3 địa điểm thật của vùng**, không bịa.

- [ ] **Step 3: `region-highlights.tsx`**

`<h2>` `highlightsHeading(name)` + lưới 3 thẻ (`md:grid-cols-3`). Mỗi thẻ: chip icon
tròn `size-12` nền `color-mix(in oklch, var(--region-primary), var(--background) 88%)`
màu `var(--region-primary)` · `<h3>` title · `<p>` body. Icon theo thứ tự
`SparklesIcon` · `CompassIcon` · `MapPinIcon` (đúng Nexora). Thẻ nền `bg-card` viền
`border border-border rounded-2xl p-6`.

- [ ] **Step 4: Ba biến thể Signature**

`region-signature-stats.tsx` (**Bắc**) — băng TỐI full-bleed, nền
`var(--region-hero)`, chữ `text-on-media`. Eyebrow · `<h2>` · body · danh sách
`points` (chấm tròn `var(--region-spark)`) · `<dl>` 4 mục
`grid-cols-2 sm:grid-cols-4`, mỗi mục viền trên `border-t border-on-media/15`,
`<dt>` giá trị cỡ lớn `font-heading text-3xl sm:text-4xl` màu `var(--region-spark)`,
`<dd>` nhãn nhỏ. **Giá trị dẫn xuất, truyền từ page qua prop `stats`** — component
không tự tính.

`region-signature-timeline.tsx` (**Trung**) — nền
`color-mix(in oklch, var(--region-surface), var(--background) 88%)`. Eyebrow · `<h2>` ·
body · `<ol>` 3 chặng `sm:grid-cols-3`, mỗi chặng viền trên + huy hiệu số tròn
`size-8` (viền + chữ `var(--region-primary)`, nền `bg-background`) đặt `-top-4`,
rồi `era` (mono, hoa) · `<h3>` title · `<p>` body. **Đánh số ở đây HỢP LỆ** — đó là
trình tự lịch sử/địa lý có thật, khác ba vùng vốn không phải các bước tuần tự.

`region-signature-postcards.tsx` (**Nam**) — nền
`color-mix(in oklch, var(--region-surface), var(--background) 92%)`. Eyebrow · `<h2>` ·
body · 3 `<figure>` `aspect-4/5` `sm:grid-cols-3`, ô giữa `sm:-translate-y-4` hai ô
ngoài `sm:translate-y-4` (bọc `motion-reduce:transform-none`). Mỗi figure:
`RegionTile` phủ nền + scrim `bg-linear-to-t from-scrim` + caption gồm vạch
`h-1 w-9` nền `var(--region-spark)` · `caption` (mono, hoa) · `<h3>` title.

Cả ba nhận dữ liệu qua **prop**, không tự import i18n theo khoá vùng.

- [ ] **Step 5: `region-tours.tsx` — client, tab lọc + phân trang**

- `'use client'`. Props: `tours: MockTourCard[]`, `places: { slug: string; name: string }[]`.
- Tab: hàng chip `All` + 3 địa điểm. Chip đang chọn nền `var(--region-primary)` chữ
  `text-on-media`; chip tắt viền `border-border`. Dùng `<button aria-pressed>`.
- Lọc: tour có `destinations.some((d) => d.slug === active)`. `All` → tất cả.
- Phân trang **8/trang** (đúng Nexora `REGION_PAGE_SIZE`). Đổi tab → về trang 1.
  Mỗi vùng chỉ 6 tour nên hiện chỉ có 1 trang — **vẫn dựng phân trang** vì nó là
  nhánh có thật khi gắn API, nhưng **ẩn thanh phân trang khi chỉ 1 trang**.
- Lưới `TourCard` dùng lại khuôn `related-tours.tsx`:
  `grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3`.
- Trạng thái rỗng khi lọc ra 0 tour: `noTours` + `noToursBody`. Đây là nhánh CÓ THẬT
  (chip một địa điểm ít tour) — **phải có test**.
- `id="tours"` đặt trên `<section>` để CTA của khu intro neo tới được.

Test bắt buộc (`region-tours.spec.tsx`), dùng `userEvent`:

```tsx
it('mặc định hiện tất cả tour của vùng', …)
it('bấm chip một địa điểm thì chỉ còn tour chạm địa điểm đó', …)
it('chip đang chọn mang aria-pressed=true, các chip khác false', …)
it('lọc ra 0 tour thì hiện trạng thái rỗng, KHÔNG phải lưới rỗng', …)
it('chỉ một trang thì KHÔNG render thanh phân trang', …)
```

⚠️ Spec này render `TourCard`; nếu nó kéo theo `SectionEyebrow`/`whileInView` thì
stub `IntersectionObserver` **cục bộ trong chính file spec** (xem `region-group.spec.tsx`).
Đã đo: dời stub lên `vitest.setup.ts` chung làm **19 test ở 3 file khác gãy**.

- [ ] **Step 6: `region-gallery.tsx`**

`<h2>` `galleryHeading(name)` + `<p>` `gallerySubtitle`, rồi khảm **10 ô** theo đúng
nhịp Nexora: 1 ô lớn → cụm 2×2 → cụm 2×2 → 1 ô lớn. Ô lớn `aspect-16/9`, ô cụm
`aspect-square`. Tất cả là `RegionTile`. Nhãn từng ô lấy từ danh sách mô tả cảnh
**chung, không gắn địa danh cụ thể** (Nexora làm y vậy ở `PLACEHOLDER_SECTIONS`) —
đặt danh sách nhãn trong i18n hay trong chính component đều được, nhưng **không bịa
tên địa danh**. **KHÔNG lightbox** — đây là khu giới thiệu.

- [ ] **Step 7: `region-value-props.tsx`**

Băng nền `var(--region-hero)` chữ `text-on-media` (Nexora dùng ảnh + scrim; ta dùng
nền tint vùng). `<h2>` `valuePropsHeading` + 3 mục căn giữa `sm:grid-cols-3`, mỗi mục
chip icon tròn `size-12` viền `border-on-media/25` nền `bg-on-media/10`, icon
`CarIcon`/`RouteIcon`/`UtensilsCrossedIcon`… — **đổi icon cho khớp nội dung mới**:
`UsersIcon` (Small groups) · `MapPinIcon` (Local guides) · `ListChecksIcon`
(Clear inclusions). `<h3>` title + `<p>` body từ `messages.regionPage.valueProps`.

- [ ] **Step 8: Viết lại `page.tsx`**

- Giữ nguyên `generateStaticParams`, `generateMetadata` (canonical + OG), `notFound()`
  cho slug lạ, JSON-LD `BreadcrumbList`, và `data-flush-footer`… **KHÔNG**: khu cuối
  giờ là `RegionValueProps` (nền `--region-hero`, vẫn là băng có nền) → **GIỮ**
  `data-flush-footer` trên chính khu đó.
- `data-region={region.key}` trên `<div>` bọc toàn trang.
- Dải số liệu của Bắc dẫn xuất TẠI ĐÂY rồi truyền xuống prop `stats`:
  `from` = `formatMoney(glance.fromPrice, currency)` · `longest` = số ngày lớn nhất
  trong các tour **riêng của vùng** · `hardest` = bậc cuối của `glance.difficulties`
  (nhãn từ `messages.toursPage.difficultyLabels`) · `styles` = `glance.categories.length`.
  Nhãn lấy từ `messages.regionPage.statLabels`.
- `Reveal` bọc ngoài từng khu, như `/destinations/page.tsx`.
- ⚠️ **KHÔNG tạo `loading.tsx`.**
- Xoá 4 file của Task 5 (`region-glance*`, `place-card*`) và mọi import tới chúng.

- [ ] **Step 9: Đo tương phản CẢ BA vùng × CẢ HAI theme**

Bắt buộc — cụm này đã dính 4 lỗi tương phản và 3 lần đo sai. Phương pháp ĐÚNG: vẽ
màu computed lên `canvas` rồi đọc pixel sRGB; **không** regex `rgb()` (trình duyệt
trả `lab()`). Đo: chữ hero trên scrim · chữ trên băng `--region-hero` (signature Bắc
+ value props) · chip tab đang chọn · caption bưu thiếp · chữ trên nền phớt
`--region-surface`. Ngưỡng AA 4.5 (chữ thường) / 3.0 (chữ ≥24px). Ghi số vào report.

- [ ] **Step 10: `pnpm gate` rồi commit**

```bash
pnpm gate
git add apps/web/src
git commit -m "feat(web): trang vùng dựng lại theo Nexora — 7 khu, 3 biến thể signature"
```

---

### Task 5d: Hero trang vùng chuyển sang kiểu `AboutHero` + Bắc đổi Signature sang timeline itinerary

**Vì sao:** user duyệt từng khu một, bắt đầu từ hero (29/07). Chốt ba điều:
(1) hero lấy **kiểu `AboutHero`** đầy đủ, không phải `ContactHero` (cái đó cố ý nhẹ,
dành cho trang tiện ích) · (2) hero mang **hàng số liệu**, nên băng Signature của Bắc
(đang là dải số liệu) **đổi sang timeline itinerary thật** để không lặp ·
(3) hero cao **~70–80vh**, giữ Bắc cao hơn hai vùng kia.

**Đánh đổi đã nói rõ với user:** Bắc và Trung cùng thành timeline đánh số. Giữ khác
biệt bằng HÌNH: Bắc là timeline **DỌC 8 chặng theo ngày**, Trung là timeline **NGANG
3 chặng theo thời kỳ**.

**Files:**

- Rewrite: `components/destinations/region-hero.tsx`
- Modify: `lib/region-theme.ts` + `.spec.ts`
- Create: `components/destinations/region-signature-itinerary.tsx`
- **Delete**: `components/destinations/region-signature-stats.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (thêm nhãn cho hero + itinerary)
- Modify: `app/(site)/destinations/[region]/page.tsx`

- [ ] **Step 1: `region-theme.ts` — biến thể mới + chiều cao mới**

- `SignatureVariant`: `'stats'` → **`'itinerary'`**. north dùng `'itinerary'`.
- `heroMinH`: north `min-h-[80vh]`, central/south `min-h-[70vh]`. Giữ `signatureFirst`
  y nguyên (north vẫn `true`).
- Cập nhật `region-theme.spec.ts`: test "ba biến thể khác nhau" giữ nguyên; test
  khẳng định `north.signature === 'stats'` đổi thành `'itinerary'`.

- [ ] **Step 2: `region-hero.tsx` — dựng theo `AboutHero`**

Đọc `components/about/about-hero.tsx` trước; bê **cấu trúc và nhịp**, thay nội dung.

Khung (đúng thứ tự trong DOM):

1. `<section className="relative flex w-full items-center overflow-hidden text-on-media">`
   + `regionTheme(key).heroMinH`.
2. Nền: `<div className="dark absolute inset-0 -z-10">` chứa `RegionTile` **trang trí**
   (`decorative`, không `role="img"`) phủ `h-full w-full`, rồi lớp gradient
   `absolute inset-0 bg-linear-to-r` + `regionTheme(key).scrim`. Hướng `to-r` (chữ
   nằm trái) — đúng `AboutHero`, khác `to-t` của bản cũ.
3. Nội dung: `<div className="dark w-full px-4 pt-28 pb-12 md:px-16 lg:px-24 xl:px-32">`
   - **Breadcrumb** 3 cấp GIỮ NGUYÊN (nav thật, và JSON-LD `BreadcrumbList` ở
     `page.tsx` phải soi đúng nó) — dòng nhỏ, `text-on-media/70`.
   - **Badge pill** viền accent kiểu About: icon `CompassIcon` + **hai chuyên mục đầu
     của vùng**, dẫn xuất từ `glance.categories`, nối bằng ` · `. Nhận qua prop
     `styles: string`. Vùng không có chuyên mục nào → **bỏ hẳn pill**.
   - `<h1>` = `region.name`, bọc trong khuôn `RevealLine` của `AboutHero`
     (`overflow-hidden` + `y:120→0`, ease `[0.16, 1, 0.3, 1]`). Một dòng — tên vùng
     hai chữ, đừng ép ba dòng.
   - `<p>` = **tagline lấy từ i18n qua prop** (`messages.regionPage.regions[key].tagline`),
     `max-w-md`.
   - Hai nút kiểu About: `ButtonLink` chính → `#tours` nhãn
     `messages.regionPage.browseCta(name)`, nền `var(--region-primary)` chữ
     `text-on-media`; nút phụ viền → `/destinations` nhãn `messages.regionPage.backToAll`.
     **`ButtonLink`, KHÔNG `Button render={<a/>}`.**
   - **Hàng số liệu** trên hairline `border-t border-on-media/15 pt-7`, nhận prop
     `stats: RegionStat[]` (kiểu chuyển từ `region-signature-stats.tsx` sang đây).
     Giá trị **thuần số** dùng `CountUp` (`@/components/motion/count-up`); giá trị có
     chữ (`$68`, `8 days`, `Challenging`) in thẳng — **đừng ép CountUp lên chuỗi**.
     Nhãn nhỏ `uppercase` dưới mỗi số. `stats` rỗng → bỏ cả hàng lẫn hairline.
4. Chỉ báo `Scroll` dọc mép phải, y `AboutHero`, có guard `motion-reduce`.

⚠️ Khu này **không** dùng khuôn `bg-hero` + `dark contents` của các hero khác — nền là
tile phủ gradient. Chữ dùng token **cố định** `text-on-media`. Đúng như bản hiện tại.

- [ ] **Step 3: i18n — thêm nhãn cho itinerary**

Trong `messages.regionPage`, thêm:

```ts
    /** Nhãn từng chặng của timeline itinerary (biến thể `itinerary`, miền Bắc). */
    dayLabel: (n: number) => `Day ${n}`,
    /** Dòng ghi công dưới timeline: itinerary này là của MỘT tour có thật. */
    itineraryNote: (tour: string) => `Day by day on ${tour}`,
```

`regions.north.signature` GIỮ NGUYÊN `eyebrow`/`heading`/`body`/`points` — biến thể
itinerary vẫn dùng cả bốn.

- [ ] **Step 4: `region-signature-itinerary.tsx`**

Timeline **DỌC** (khác timeline ngang 3 cột của Trung — đây là điểm giữ cho hai vùng
không đọc thành một):

- Nền `color-mix(in oklch, var(--region-surface), var(--background) 88%)` — cùng công
  thức hai biến thể kia.
- Eyebrow · `<h2>` · body · danh sách `points` (như bản `stats` đã có).
- `<ol>` các chặng, mỗi `<li>` là lưới `[nhãn ngày | thân]`: cột trái
  `messages.regionPage.dayLabel(day.dayNumber)` (mono, hoa, `text-muted-foreground`);
  cột phải có **đường dọc** `w-px bg-border` chạy suốt và **chấm trạm** tròn — chặng
  đầu và chặng cuối tô đặc `var(--region-primary)`, các chặng giữa để rỗng (viền
  `var(--region-primary)`, nền `bg-background`). Chặng cuối **không** kéo đường xuống.
- Mỗi chặng: `<h3>` `day.title` + `<p>` `day.description` — `description` là
  **nullable**, null thì bỏ hẳn đoạn, KHÔNG in "null".
- Dưới cùng: `messages.regionPage.itineraryNote(tour.title)` kèm link
  `/tours/${tour.slug}` (trang CÓ THẬT).
- Nhận qua prop: `eyebrow` · `heading` · `body` · `points` · `tour: { slug, title }` ·
  `days: MockItineraryDay[]`. Không tự import mock.

- [ ] **Step 5: `page.tsx`**

- Chọn tour nuôi timeline: **tour dài nhất mà MỌI destination của nó đều thuộc vùng**
  (Bắc → `northern-highlands-loop`, 8 ngày). Đây đúng là hàm đã dùng cho ô "Longest
  trip" ở đợt fix trước — **tách thành một helper dùng chung**, đừng viết hai bản.
  Không có tour riêng nào → **bỏ hẳn khu signature** cho vùng đó.
- Truyền `stats` xuống **hero** (không còn xuống signature), thêm `styles` (2 chuyên
  mục đầu) và `tagline`.
- Nhánh chọn biến thể: `itinerary` → `RegionSignatureItinerary` · `timeline` →
  bản cũ · `postcards` → bản cũ. Giữ cách guard bằng CẢ `regionTheme` LẪN hình dạng
  dữ liệu thật sự có (`'timeline' in signature`…), đúng như hiện tại.
- Xoá import `RegionSignatureStats` và file của nó.
- ⚠️ `data-flush-footer` vẫn phải nằm đúng một chỗ, trên khu CUỐI (`region-value-props`).
- ⚠️ **KHÔNG tạo `loading.tsx`.**

- [ ] **Step 6: Đo tương phản hero mới, cả 3 vùng × 2 theme**

Nền hero giờ là tile gradient + scrim `to-r`, khác bản cũ (`to-t`) → **mọi phép đo cũ
cho hero hết hiệu lực**, phải đo lại: breadcrumb · badge pill (chữ + viền) · h1 ·
tagline · nhãn/giá trị hàng số liệu · chữ trên hai nút.
Cách đúng: composite **nền dưới → nền phần tử (kể cả alpha) → mới so với màu chữ**,
tất cả bằng `canvas` đọc pixel sRGB. Không regex `rgb()`. Không lấy pixel rơi trúng
nét chữ (đã suýt dính lần thứ tư ở đợt fix trước). Ngưỡng AA 4.5 / 3.0 cho chữ ≥24px.
Chữ trên gradient phải đo ở **chỗ nền sáng nhất dưới khối chữ**, không phải tâm.

- [ ] **Step 7: Gate rồi commit**

Nếu cổng 3000 đang có dev server của user thì **không chạy `pnpm gate`** — chạy
`pnpm typecheck` + `pnpm test` + `pnpm lint`, và ghi rõ bước build còn nợ.

```bash
git add apps/web/src libs/shared/i18n
git commit -m "feat(web): hero trang vùng theo kiểu AboutHero, Bắc đổi sang timeline itinerary"
```

---

### Task 5e: Gộp `What makes X special` vào khu intro, bỏ bento ảnh

**Vì sao:** user duyệt tiếp khu 2 (29/07). Nhận xét: gallery đã là khu trình bày ảnh
riêng, nên bento 3 ô ở khu intro là **ảnh lặp lại không thêm thông tin**. Chốt: bỏ
bento, thay cột phải bằng **3 thẻ highlight** — gộp hẳn khu `What makes X special`
vào đây. Bố cục giữ **hai cột**: chữ trái, 3 highlight xếp dọc phải.

**Hệ quả đã nói rõ với user:** nhánh `signatureFirst` hết ý nghĩa (không còn Highlights
để đảo thứ tự với Signature) → **gỡ hẳn cờ đó**, đừng để lại một cờ chết kèm test chết.
Ba vùng vẫn khác nhau nhờ ba biến thể Signature.

**Files:**

- Modify: `components/destinations/region-intro.tsx`
- **Delete**: `components/destinations/region-highlights.tsx`
- Modify: `lib/region-theme.ts` + `.spec.ts` (gỡ `signatureFirst`)
- Modify: `app/(site)/destinations/[region]/page.tsx`
- Modify: `components/destinations/region-tile.tsx` (xem bước 4)

- [ ] **Step 1: `region-intro.tsx` — cột phải thành 3 highlight**

- Bỏ hẳn bento `RegionTile`. Component **không còn import `RegionTile`**.
- Thêm prop `highlights: { title: string; body: string }[]`.
- Cột phải: một tiêu đề nhỏ = `messages.regionPage.highlightsHeading(name)` (cỡ
  `text-xl md:text-2xl font-heading`, **không** cỡ `h2` khu — nó là tiêu đề phụ trong
  một khu, không phải tiêu đề khu), rồi 3 mục xếp dọc.
- Mỗi mục giữ đúng ngôn ngữ hình của `region-highlights.tsx` đang có: chip icon tròn
  `size-12` nền `color-mix(in oklch, var(--region-primary), var(--background) 88%)`,
  icon `SparklesIcon` · `CompassIcon` · `MapPinIcon` theo thứ tự, `<h4>` title,
  `<p>` body. Bố cục mỗi mục: icon bên trái, chữ bên phải (khác lưới 3 cột cũ vì
  giờ xếp dọc trong một cột hẹp).
- `highlights` rỗng → bỏ hẳn cột phải, cột trái trải rộng `max-w-2xl`.
- Cột trái giữ nguyên: `<h2>` `introHeading` · vạch accent · `intro` · `intro2` ·
  hàng `bestForLabel` + chip tags dẫn xuất · `ButtonLink` → `#tours`.

- [ ] **Step 2: `region-theme.ts` — gỡ `signatureFirst`**

Gỡ field khỏi interface và cả ba entry. Gỡ test khẳng định nó trong `region-theme.spec.ts`
(**gỡ, không phải sửa cho luôn đúng** — cờ không còn thì test của nó cũng không còn
việc). Ba test kia giữ nguyên.

- [ ] **Step 3: `page.tsx`**

- Xoá khu `RegionHighlights` và nhánh lật thứ tự. Thứ tự mới, cố định cho cả ba vùng:
  Hero → Intro (kèm highlights) → Signature → Tours → Gallery → Value props.
- Truyền `highlights={t.regions[region.key].highlights}` xuống `RegionIntro`.
- Xoá import `RegionHighlights` và file của nó.
- ⚠️ `data-flush-footer` vẫn ở khu CUỐI (`region-value-props`). ⚠️ **KHÔNG** tạo `loading.tsx`.

- [ ] **Step 4: Ô nền trang trí không được hiện icon giữ chỗ**

Lỗi user chỉ ra ở hero: `RegionTile` dùng làm **nền trang trí** vẫn vẽ `ImageIcon` ở
chính giữa, nên trên hero căn trái nó nổi lên như một vật thể lạ giữa khoảng trống.

Sửa ở `region-tile.tsx`: chế độ `decorative` **không render icon** (nền gradient trơn).
Chế độ có nhãn giữ nguyên icon — ở gallery/bưu thiếp icon là tín hiệu "đây là chỗ của
ảnh", còn ở nền trang trí nó là nhiễu. Cập nhật `region-tile.spec.tsx`: thêm test
khẳng định chế độ `decorative` **không có** icon, chế độ có nhãn **có** icon.

- [ ] **Step 5: Kiểm mắt + gate**

Chụp 3 vùng × 2 theme, xác nhận: khu intro hai cột không còn ô ảnh nào · không còn khu
`What makes X special` đứng riêng · hero không còn icon lạ.
Nếu cổng 3000 có dev server của user thì **không chạy `pnpm gate`** — chạy
`pnpm typecheck` + `pnpm test` + `pnpm lint`, ghi rõ bước build còn nợ.

```bash
git add apps/web/src
git commit -m "feat(web): gộp highlights vào khu intro, bỏ bento ảnh trùng gallery"
```

---

### Task 5f: Chuẩn hoá header khu cho cả trang vùng theo quy ước Home/About/Contact

**Vì sao:** user duyệt tới khu intro và chỉ ra header/typography lệch chuẩn site, yêu
cầu **đo từ Home/About/Contact rồi áp đúng thông số**. Đo được (29/07):

| Thứ | Chuẩn site | Bằng chứng |
| --- | --- | --- |
| Eyebrow khu | `SectionEyebrow` | **21 component** dùng |
| `h2` khu | `font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12` | 12/14 |
| eyebrow → h2 | `mt-4` | 7/12 |
| h2 → đoạn dẫn | `mt-2 text-pretty text-muted-foreground` | 9 lần |
| Container | `mx-auto max-w-7xl` | 23 lần |
| Lưới 2 cột | `gap-12 lg:grid-cols-2 lg:gap-16` | 2 lần |

Trang vùng: **0/6 khu** dùng `SectionEyebrow`, và **3 khu Signature tự chế eyebrow**
bằng `font-mono text-xs tracking-widest uppercase` — port thẳng từ Nexora, không phải
quy ước repo. User chốt: **chuẩn hoá cả 5 khu một lượt** (hero miễn — nó có badge pill
riêng, đúng như `AboutHero` và `ContactHero` cũng không dùng `SectionEyebrow`), và
**bỏ vạch accent `h-1 w-12`** (chấm vuông của eyebrow đã là dấu accent của site).

**Files:**

- Modify: `libs/shared/ui/src/components/…` **KHÔNG** — `SectionEyebrow` nằm ở
  `apps/web/src/components/home/section-eyebrow.tsx`. Sửa file đó (thêm `tone`).
- Modify: `components/destinations/region-intro.tsx` · `region-signature-itinerary.tsx`
  · `region-signature-timeline.tsx` · `region-signature-postcards.tsx` ·
  `region-tours.tsx` · `region-gallery.tsx` · `region-value-props.tsx`
- Modify: `components/destinations/region-tours.spec.tsx` (stub `IntersectionObserver`)
- Modify: `libs/shared/i18n/src/lib/messages.ts` (3 nhãn eyebrow mới)

- [ ] **Step 1: `SectionEyebrow` — thêm biến thể `onMedia`**

⚠️ **Đây là bẫy đã đo:** component hardcode `bg-foreground` + `text-foreground`, mà
`--foreground` **lật theo theme**. Khu `We've got you covered` có nền
`var(--region-hero)` — tối **cố định, KHÔNG lật**. Đặt eyebrow mặc định lên đó thì ở
**light mode** chữ thành tối-trên-tối. Đây đúng lớp lỗi cụm này đã dính 5 lần.

Thêm prop `tone?: 'default' | 'onMedia'`:
- `'default'` (mặc định): giữ **byte-identical** `bg-foreground` / `text-foreground` —
  21 chỗ đang dùng không được đổi một pixel nào.
- `'onMedia'`: `bg-on-media` / `text-on-media` (token **cố định**, đúng cặp với nền tối
  cố định).

Thêm test cho cả hai chế độ vào một spec cạnh component (nếu chưa có spec thì tạo).
Spec render `SectionEyebrow` → **phải stub `IntersectionObserver` cục bộ trong chính
file đó** (nó dùng `whileInView`; dời stub lên `vitest.setup.ts` chung đã đo là làm
**19 test ở 3 file khác gãy**).

- [ ] **Step 2: Ba nhãn eyebrow mới trong `messages.regionPage`**

```ts
    /** Eyebrow các khu — quy ước `SectionEyebrow` của site (21 component dùng).
        Khu Signature dùng lại `regions[key].signature.eyebrow` đã có; khu Tours
        dùng SỐ TOUR dẫn xuất, đúng cách `region-group.tsx` làm ở trang index. */
    introEyebrow: 'Overview',
    galleryEyebrow: 'Gallery',
    valuePropsEyebrow: 'How we travel',
```

- [ ] **Step 3: Áp header chuẩn cho 5 khu**

Khuôn dùng chung cho MỌI khu: `SectionEyebrow` → `<h2 className="mt-4 font-heading
text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">`
→ đoạn dẫn `<p className="mt-2 text-pretty text-muted-foreground">` (nếu khu có).

| Khu | Eyebrow | `tone` |
| --- | --- | --- |
| `region-intro` | `t.introEyebrow` | default |
| 3 khu Signature | `eyebrow` sẵn có trong prop | default (nền phớt, sáng) |
| `region-tours` | `messages.destinationsPage.toursLabel(tours.length)` — DẪN XUẤT | default |
| `region-gallery` | `t.galleryEyebrow` | default |
| `region-value-props` | `t.valuePropsEyebrow` | **`onMedia`** |

Ba khu Signature: **xoá `<p className="font-mono text-xs tracking-widest …">{eyebrow}</p>`
tự chế**, thay bằng `<SectionEyebrow>`. Giữ nguyên các chỗ khác còn dùng
`font-mono tracking-widest` cho **nhãn dữ liệu** (nhãn ngày của timeline, caption bưu
thiếp) — đó là nhãn dữ liệu, không phải eyebrow khu.

`region-value-props` hiện căn giữa; giữ căn giữa nhưng eyebrow là `inline-flex` nên
phải bọc để nó căn giữa theo (`flex justify-center` hoặc `mx-auto w-fit`).

- [ ] **Step 4: `region-intro` — bỏ vạch accent, sửa nhịp dọc**

- **Xoá** khối `<div aria-hidden style={{ background: 'var(--region-primary)' }}
  className="mt-5 h-1 w-12 rounded-full" />`.
- Nhịp dọc theo chuẩn: eyebrow → `mt-4` h2 → `mt-2` đoạn `intro` → `mt-4` đoạn `intro2`.
  (Đoạn `intro` bỏ `text-lg`? **KHÔNG** — `mt-4 text-lg text-pretty text-muted-foreground`
  là biến thể có thật của site, 3 lần dùng. Giữ `text-lg` cho `intro`, nhưng đổi
  `mt-5` → `mt-2` cho khớp khoảng cách h2→đoạn dẫn.)
- Lưới hai cột: `gap-10` → **`gap-12`**, giữ `lg:gap-16`.

- [ ] **Step 5: `region-tours.spec.tsx` — stub `IntersectionObserver`**

Khu Tours giờ render `SectionEyebrow` (dùng `whileInView`) nên spec sẽ gãy nếu thiếu
stub. Thêm stub **cục bộ trong chính file spec**, copy khuôn từ
`components/destinations/region-group.spec.tsx`. **Đừng** dời lên `vitest.setup.ts`.

- [ ] **Step 6: Đo tương phản eyebrow trên MỌI nền nó xuất hiện**

Bắt buộc — đây là bước bắt lỗi của Step 1. Đo chữ + chấm vuông của `SectionEyebrow` ở:
nền trang (`region-intro`, `region-tours`, `region-gallery`) · nền phớt
`color-mix(--region-surface, --background 88%)` (3 khu Signature) · nền
`var(--region-hero)` (`region-value-props`, `tone="onMedia"`).
**Cả 3 vùng × cả 2 theme.** Ngưỡng AA 4.5 cho chữ eyebrow (cỡ `text-sm`).

Cách đúng: composite nền dưới → nền phần tử (kể cả alpha) → rồi mới so với màu chữ,
tất cả bằng `canvas` đọc pixel sRGB. **Không** regex `rgb()`. Không lấy pixel rơi
trúng nét chữ.

- [ ] **Step 7: Xác nhận 21 chỗ dùng cũ KHÔNG đổi**

Run: `git diff --stat` — ngoài các file liệt kê ở trên, **không file nào khác được
đổi**. `section-eyebrow.tsx` chỉ thêm nhánh `tone`, mặc định giữ nguyên chuỗi class cũ.

- [ ] **Step 8: Gate rồi commit**

Nếu cổng 3000 có dev server của user thì chạy `pnpm typecheck` + `pnpm test` + `pnpm lint`
và ghi rõ bước build còn nợ; nếu trống thì chạy `pnpm gate`.

```bash
pnpm turbo run build --filter=@tourism/i18n
git add apps/web/src libs/shared/i18n
git commit -m "style(web): chuẩn hoá header 5 khu trang vùng theo quy ước SectionEyebrow"
```

---

### Task 5g: Thay khu Signature của miền Bắc bằng `When to visit` (dải 12 tháng)

**Vì sao:** user xem khu `Great northern adventures` và bác — *"nó giống trang tour
details hơn"*. Đúng: khu đó đang kể **itinerary 8 ngày của MỘT tour**, mà việc đó thuộc
`/tours/[slug]` và repo đã có `ItineraryTimeline` làm. Triệu chứng phụ: tiêu đề vẫn là
copy Nexora ("Great northern adventures") trong khi ruột đã thành lịch trình một chuyến
— tiêu đề và nội dung trôi khỏi nhau.

**Đây là lỗi của bản kế hoạch, hai lần:** Nexora để Bắc là 4 thẻ số liệu bịa
(`350km Hà Giang Loop`, `3.143m Fansipan`), tôi thay bằng "dữ liệu thật giàu nhất của
Bắc" = itinerary; rồi Task 5d đưa số liệu lên hero nên Bắc lại phải đổi, và tôi chọn
đúng cái itinerary đó lần nữa.

**Chốt (user 29/07):** thay bằng **`When to visit`** — thứ duy nhất còn lại vừa thuộc
về VÙNG (không phải một tour), vừa đã có copy sẵn cho cả ba vùng.

⚠️ **Đảo quyết định spec §5.1**, vốn cắt `BestTime` khỏi `/destinations` vì "không field
nào trong contract nói mùa/thời tiết". Lý do đó **không áp cho ca này**: mùa đẹp của một
vùng là sự thật công khai về nơi chốn, khác hẳn `3.143m Fansipan` vốn là **lời hứa về
sản phẩm ta không bán**. Cái giá thật vẫn phải ghi: đây là copy gõ tay, không ai duy trì.

**Files:**

- Modify: `libs/shared/i18n/src/lib/messages.ts`
- Create: `components/destinations/region-seasons.tsx` + `.spec.tsx`
- **Delete**: `components/destinations/region-signature-itinerary.tsx`
- Modify: `lib/region-theme.ts` + `.spec.ts`
- Modify: `app/(site)/destinations/[region]/page.tsx`

- [ ] **Step 1: i18n — mùa thành DỮ LIỆU CÓ CẤU TRÚC**

Trong mỗi `regionPage.regions[key]`, **thay** khối `signature` của `north` (và thêm cho
cả ba vùng) bằng:

```ts
        /** Mùa đẹp nhất — mảng SỐ THÁNG (1–12), không phải chuỗi 'Mar–May'.
            Dải 12 ô ở `region-seasons.tsx` đọc thẳng mảng này; nếu lưu chuỗi thì
            component phải parse copy, và copy sửa một chữ là dải vỡ âm thầm. */
        season: {
          months: [3, 4, 5, 9, 10, 11], // north
          note: 'Cool, dry and clear — ideal for Hạ Long and the mountains. Winters turn chilly up high; summers bring rain.',
        },
```

- `central`: `months: [2, 3, 4, 5, 6, 7, 8]` · note `'Warm and dry along the coast and old towns. Avoid Oct–Dec, the wettest and most storm-prone months.'`
- `south`: `months: [12, 1, 2, 3, 4]` · note `'The dry season for the Mekong and the islands. May–Nov is wetter but stays warm with short showers.'`

Thêm nhãn dùng chung trong `regionPage`:

```ts
    seasonsEyebrow: 'Seasons',
    seasonsHeading: (region: string) => `When to visit ${region}`,
    /** Chú giải dải tháng — dải là đồ hoạ nên cần nhãn chữ cho trình đọc màn hình. */
    seasonsBestLabel: 'Best months',
    seasonsOtherLabel: 'Shoulder & wet months',
```

**Xoá:**
- Khối `signature` của `north` (`eyebrow`/`heading`/`body`/`points`) — khu đó không còn.
- `regionPage.dayLabel` và `regionPage.itineraryNote` — chỉ khu itinerary dùng.
- Khối **`bestTime`** ở cấp cao nhất (`messages.ts` ~dòng 902): 0 consumer, và nội dung
  của nó vừa chuyển vào `regions[key].season`. Giữ lại là hai nguồn cho cùng một sự thật.
  `subtitle` của nó (*"Vietnam runs over 1,600km north to south … a quick guide by
  region"*) vốn viết cho trang hiện CẢ BA vùng nên sai ngữ cảnh ở trang một vùng.
- **KHÔNG đụng** `travelTips` — cũng 0 consumer nhưng là nợ có từ trước, ngoài phạm vi.

- [ ] **Step 2: `region-theme.ts`**

`SignatureVariant`: `'itinerary'` → **`'seasons'`**; `north` dùng `'seasons'`.
Cập nhật `region-theme.spec.ts` (test khẳng định `north.signature`).

- [ ] **Step 3: Test thất bại cho `RegionSeasons`**

Tạo `components/destinations/region-seasons.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RegionSeasons } from './region-seasons';

const PROPS = {
  regionName: 'Northern Vietnam',
  months: [3, 4, 5, 9, 10, 11],
  note: 'Cool, dry and clear.',
};

describe('RegionSeasons', () => {
  it('vẽ ĐỦ 12 ô tháng, không chỉ các tháng đẹp', () => {
    const { container } = render(<RegionSeasons {...PROPS} />);
    expect(container.querySelectorAll('[data-month]')).toHaveLength(12);
  });

  it('đánh dấu ĐÚNG các tháng đẹp, không thừa không thiếu', () => {
    const { container } = render(<RegionSeasons {...PROPS} />);
    const best = [...container.querySelectorAll('[data-month][data-best="true"]')].map((el) =>
      Number(el.getAttribute('data-month')),
    );
    expect(best).toEqual([3, 4, 5, 9, 10, 11]);
  });

  // Tháng 12 quấn qua tháng 1 ở miền Nam — dải phải đánh dấu cả hai đầu,
  // không được coi [12,1,2,3,4] là một khoảng liên tục rồi tô nhầm 5..11.
  it('mùa vắt qua năm (12→4) đánh dấu đúng hai đầu dải', () => {
    const { container } = render(<RegionSeasons {...PROPS} months={[12, 1, 2, 3, 4]} />);
    const best = [...container.querySelectorAll('[data-month][data-best="true"]')].map((el) =>
      Number(el.getAttribute('data-month')),
    );
    expect(best).toEqual([1, 2, 3, 4, 12]);
  });

  it('in ghi chú thời tiết', () => {
    render(<RegionSeasons {...PROPS} />);
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });

  it('không tháng nào thì BỎ HẲN dải, vẫn giữ ghi chú', () => {
    const { container } = render(<RegionSeasons {...PROPS} months={[]} />);
    expect(container.querySelectorAll('[data-month]')).toHaveLength(0);
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });
});
```

⚠️ Spec này render `SectionEyebrow` (dùng `whileInView`) → **stub `IntersectionObserver`
cục bộ trong chính file spec**, copy khuôn từ `region-group.spec.tsx`. Đừng dời lên
`vitest.setup.ts` (đã đo: làm 19 test ở 3 file khác gãy).

- [ ] **Step 4: `region-seasons.tsx`**

- Nền `color-mix(in oklch, var(--region-surface), var(--background) 88%)` — cùng công
  thức hai biến thể Signature kia, để ba vùng vẫn cùng một họ nền.
- Header chuẩn (Task 5f): `SectionEyebrow` = `seasonsEyebrow` → `<h2 className="mt-4 …
  md:text-[40px]/12">` = `seasonsHeading(regionName)` → `<p className="mt-2 …">` = `note`.
- **Dải 12 tháng**: 12 ô `grid grid-cols-6 sm:grid-cols-12`, mỗi ô mang
  `data-month={n}` và `data-best={boolean}`. Ô "đẹp" nền `var(--region-primary)` chữ
  `text-on-media`; ô còn lại nền `bg-muted` chữ `text-muted-foreground`.
  Nhãn tháng lấy bằng `Intl.DateTimeFormat('en-US', { month: 'short' })` — cùng tiền lệ
  `formatMoney` và `toLocaleString` đang dùng, không gõ 12 chuỗi vào i18n.
- **Khả truy cập**: dải là đồ hoạ, nên bọc bằng `role="img"` với
  `aria-label` liệt kê rõ các tháng đẹp bằng chữ, HOẶC dùng `<dl>` có nhãn
  `seasonsBestLabel`/`seasonsOtherLabel`. Chọn một, giải thích trong comment. **Không**
  để dải chỉ có màu làm tín hiệu duy nhất — người mù màu phải đọc được.
- `months` rỗng → bỏ dải, giữ `note`.

- [ ] **Step 5: `page.tsx`**

- Nhánh `seasons` → `<RegionSeasons regionName={region.name} months={…} note={…} />`.
- Xoá import `RegionSignatureItinerary` và file của nó; xoá chỗ tra tour dài nhất **chỉ
  dùng cho khu itinerary**. ⚠️ **GIỮ** `longestTourInRegion` — hero vẫn dùng nó cho ô
  số liệu "Longest trip".
- Nhánh chọn biến thể vẫn guard bằng CẢ `regionTheme` LẪN hình dạng dữ liệu có thật.
- ⚠️ `data-flush-footer` vẫn ở khu CUỐI. ⚠️ **KHÔNG** tạo `loading.tsx`.

- [ ] **Step 6: Đo tương phản dải tháng**

Ô "đẹp" (`--region-primary` + `text-on-media`) và ô thường (`bg-muted` +
`text-muted-foreground`) — **cả 3 vùng × cả 2 theme**. Ngưỡng AA 4.5 (nhãn tháng cỡ nhỏ).
⚠️ Cặp `muted-foreground`/`muted` đã đo **3.35:1 ở light** trong một ca trước của cụm —
nếu lại rớt thì đổi sang `text-foreground/70` hoặc tương đương rồi đo lại.
Cách đúng: composite nền dưới → nền ô → rồi so với màu chữ, bằng `canvas` đọc pixel
sRGB. Không regex `rgb()`. Không lấy pixel rơi trúng nét chữ.

- [ ] **Step 7: Gate rồi commit**

```bash
pnpm turbo run build --filter=@tourism/i18n
# cổng 3000 trống → pnpm gate; đang bận → typecheck + test + lint, ghi rõ nợ build
git add apps/web/src libs/shared/i18n
git commit -m "feat(web): miền Bắc đổi khu chữ ký sang When to visit — dải 12 tháng"
```

