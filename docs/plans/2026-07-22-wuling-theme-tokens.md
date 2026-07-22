# Theme Wuling + region tint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổ hệ màu Wuling đã chốt vào pipeline `@tourism/tokens` có sẵn, thêm lớp `--region-*`, wire vào `@tourism/ui`, chốt font Be Vietnam Pro + Lora.

**Architecture:** Pipeline Style Dictionary P0 giữ nguyên — chỉ thay giá trị trong `tokens.mjs` (oklch), thêm export `regions`/`regionDefaults` và dạy `build.mjs` emit các khối `[data-region=…]`. `globals.css` của ui bỏ khối neutral tự có, import `@tourism/tokens/tokens.css`. Font đặt tại `apps/web` layout qua `next/font`.

**Tech Stack:** Style Dictionary 5 · culori · Vitest · Tailwind v4 · next/font.

Spec: [2026-07-22-wuling-theme-tokens-design.md](../specs/2026-07-22-wuling-theme-tokens-design.md) · Giá trị: [color-system.md](../conventions/color-system.md) · ADR: [0013](../adr/0013-wuling-theme-tokens.md)

## Global Constraints

- Comment tiếng Việt (CLAUDE.md #8); Conventional Commits không AI attribution (#12).
- KHÔNG sửa cấu trúc pipeline/`rn-convert.js` (chỉ được sửa 1 test brand-cũ, ghi chú rõ).
- Component/`@tourism/ui` KHÔNG tham chiếu `--region-*` (ADR-0013 #4).
- `pnpm gate:int` trước khi khai xong (#11). Không merge/push — chờ user review (#1/#2).
- Nhánh: `feat/theme-tokens` (đã tạo, ADR+spec+color-system đã commit `f1cfbf8`).

---

### Task 1: Giá trị Wuling + regions trong tokens.mjs (TDD)

**Files:**
- Modify: `libs/shared/tokens/src/lib/tokens.spec.ts` (viết lại toàn bộ)
- Modify: `libs/shared/tokens/src/lib/tokens.ts` (thay stub)
- Modify: `libs/shared/tokens/style-dictionary/tokens.mjs` (khối `color`, comment `fonts`, thêm exports)
- Modify: `libs/shared/tokens/src/lib/rn-convert.spec.ts` (1 test brand cũ)

**Interfaces:**
- Produces: `tokens.mjs` export thêm `regionDefaults: Record<string,string>` và `regions: Record<'north'|'central'|'south', Record<string,string>>` (giá trị oklch string, cùng bộ key: `primary`, `deep`, `surface`, `spark`, `on-surface`). `src/lib/tokens.ts` export `REGIONS = ['north','central','south'] as const` và `type Region`.

- [ ] **Step 1: Viết test FAIL** — thay toàn bộ `src/lib/tokens.spec.ts`:

```ts
import { oklch } from 'culori';
import { describe, expect, it } from 'vitest';
// biome-ignore lint/style/noNamespaceImport: cần cả default lẫn named exports của nguồn token
import * as src from '../../style-dictionary/tokens.mjs';
import { REGIONS } from './tokens.js';

// Bất biến của hệ màu Wuling (ADR-0013) — chặn regression khi chỉnh token.
const tokens = src.default;

describe('nguồn token màu', () => {
  it('mọi token màu có value + darkValue parse được (oklch hợp lệ)', () => {
    for (const [name, t] of Object.entries(tokens.color)) {
      expect(oklch(t.value), `${name}.value`).toBeDefined();
      expect(oklch(t.darkValue), `${name}.darkValue`).toBeDefined();
    }
  });

  it('primary light thuộc họ ngọc Wuling: hue ∈ [170,195], chroma ≤ 0.09', () => {
    const p = oklch(tokens.color.primary.value);
    expect(p?.h).toBeGreaterThanOrEqual(170);
    expect(p?.h).toBeLessThanOrEqual(195);
    expect(p?.c).toBeLessThanOrEqual(0.09);
  });
});

describe('lớp region (Bắc/Trung/Nam)', () => {
  const SLOTS = ['primary', 'deep', 'surface', 'spark', 'on-surface'];

  it('đúng 3 vùng, mỗi vùng đủ 5 slot, cùng bộ key với regionDefaults', () => {
    expect(Object.keys(src.regions).sort()).toEqual(['central', 'north', 'south']);
    expect(Object.keys(src.regionDefaults).sort()).toEqual([...SLOTS].sort());
    for (const [name, region] of Object.entries(src.regions)) {
      expect(Object.keys(region).sort(), name).toEqual([...SLOTS].sort());
      for (const v of Object.values(region)) expect(oklch(v)).toBeDefined();
    }
  });

  it('REGIONS (TS) khớp key của regions (nguồn token)', () => {
    expect([...REGIONS].sort()).toEqual(Object.keys(src.regions).sort());
  });
});
```

- [ ] **Step 2: Chạy để thấy FAIL**

Run: `pnpm turbo run test --filter=@tourism/tokens`
Expected: FAIL — `regions is not exported` / `REGIONS is not exported` (+ test hue fail vì primary còn 155).

- [ ] **Step 3: Thay `src/lib/tokens.ts`**

```ts
// Bề mặt TS của @tourism/tokens cho FE — vùng lãnh thổ (data-region).
// Giá trị màu KHÔNG nằm ở đây (nguồn: style-dictionary/tokens.mjs).
export const REGIONS = ['north', 'central', 'south'] as const;
export type Region = (typeof REGIONS)[number];
```

- [ ] **Step 4: Sửa khối `color` trong `tokens.mjs`** — thay bằng giá trị Wuling
  (oklch quy đổi culori từ hex chốt trong color-system.md; header comment của khối
  đổi từ "Emerald Heritage" sang tham chiếu color-system.md):

```js
export default {
  color: {
    // Hệ "Wuling" — chốt 22/07/2026, phân tích tại docs/conventions/color-system.md.
    // Quy đổi oklch từ hex chốt bằng culori (làm tròn 3 chữ số).
    background: c('oklch(0.977 0.003 174.5)', 'oklch(0.25 0.015 181.5)'),
    foreground: c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    card: c('oklch(0.996 0.002 174)', 'oklch(0.309 0.022 177.6)'),
    'card-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    popover: c('oklch(0.996 0.002 174)', 'oklch(0.309 0.022 177.6)'),
    'popover-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    primary: c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
    'primary-foreground': c('oklch(0.974 0.007 174.4)', 'oklch(0.974 0.007 174.4)'),
    'on-media': c('oklch(0.98 0.005 180)', 'oklch(0.98 0.005 180)'),
    secondary: c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'secondary-foreground': c('oklch(0.411 0.053 184.5)', 'oklch(0.822 0.041 180.6)'),
    muted: c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'muted-foreground': c('oklch(0.473 0.022 179.5)', 'oklch(0.748 0.026 174.5)'),
    accent: c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'accent-foreground': c('oklch(0.411 0.053 184.5)', 'oklch(0.822 0.041 180.6)'),
    destructive: c('oklch(0.516 0.136 27.3)', 'oklch(0.579 0.148 26.7)'),
    border: c('oklch(0.781 0.015 180.6)', 'oklch(0.402 0.026 173.6)'),
    input: c('oklch(0.781 0.015 180.6)', 'oklch(0.402 0.026 173.6)'),
    ring: c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
    overlay: c('oklch(0 0 0 / 0.5)', 'oklch(0 0 0 / 0.6)'),
    scrim: c('oklch(0.15 0.02 182 / 0.75)', 'oklch(0.13 0.02 182 / 0.8)'),
    'media-tint': c('oklch(0.35 0.05 184 / 0.1)', 'oklch(0.3 0.05 184 / 0.16)'),
    success: c('oklch(0.62 0.17 145)', 'oklch(0.7 0.15 145)'),
    'success-foreground': c('oklch(0.985 0 0)', 'oklch(0.205 0 0)'),
    warning: c('oklch(0.78 0.15 80)', 'oklch(0.82 0.14 80)'),
    'warning-foreground': c('oklch(0.27 0.04 80)', 'oklch(0.2 0.03 80)'),
    info: c('oklch(0.6 0.13 240)', 'oklch(0.7 0.13 240)'),
    'info-foreground': c('oklch(0.985 0 0)', 'oklch(0.205 0 0)'),
    rating: c('oklch(0.731 0.13 73.3)', 'oklch(0.78 0.13 75)'),
    'rating-muted': c('oklch(0.865 0.015 175.7)', 'oklch(1 0 0 / 0.2)'),
    price: c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    'price-compare': c('oklch(0.473 0.022 179.5)', 'oklch(0.748 0.026 174.5)'),
    'chart-1': c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
    'chart-2': c('oklch(0.535 0.057 239.5)', 'oklch(0.645 0.056 238.3)'),
    'chart-3': c('oklch(0.731 0.13 73.3)', 'oklch(0.78 0.13 75)'),
    'chart-4': c('oklch(0.516 0.136 27.3)', 'oklch(0.579 0.148 26.7)'),
    'chart-5': c('oklch(0.555 0.053 48.4)', 'oklch(0.661 0.052 51.2)'),
    sidebar: c('oklch(0.966 0.006 170.4)', 'oklch(0.29 0.02 178)'),
    'sidebar-foreground': c('oklch(0.275 0.021 196)', 'oklch(0.921 0.014 174.1)'),
    'sidebar-primary': c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
    'sidebar-primary-foreground': c('oklch(0.974 0.007 174.4)', 'oklch(0.974 0.007 174.4)'),
    'sidebar-accent': c('oklch(0.914 0.01 174.3)', 'oklch(0.367 0.028 178.3)'),
    'sidebar-accent-foreground': c('oklch(0.411 0.053 184.5)', 'oklch(0.822 0.041 180.6)'),
    'sidebar-border': c('oklch(0.865 0.015 175.7)', 'oklch(0.402 0.026 173.6)'),
    'sidebar-ring': c('oklch(0.494 0.067 184.3)', 'oklch(0.563 0.076 181.3)'),
  },
  radius: {
    DEFAULT: { value: '0.375rem', type: 'dimension' },
  },
};
```

(Giữ nguyên `const c = …` và mọi export khác của file; đổi comment `fonts.heading`
từ "Fraunces" thành "Lora".)

- [ ] **Step 5: Thêm exports region vào cuối `tokens.mjs`** (sau `baseRules`):

```js
// Lớp region Bắc/Trung/Nam (ADR-0013 #3) — 5 slot/vùng, chỉ page-level app dùng
// (component KHÔNG tham chiếu --region-*). Nguồn phân tích: docs/conventions/color-system.md §4.
export const regionDefaults = {
  primary: 'oklch(0.494 0.067 184.3)',
  deep: 'oklch(0.411 0.053 184.5)',
  surface: 'oklch(0.914 0.01 174.3)',
  spark: 'oklch(0.731 0.13 73.3)',
  'on-surface': 'oklch(0.411 0.053 184.5)',
};

export const regions = {
  // Bắc — thép sương núi + tím (codename Arcane)
  north: {
    primary: 'oklch(0.535 0.057 239.5)',
    deep: 'oklch(0.423 0.056 245.8)',
    surface: 'oklch(0.855 0.007 277.1)',
    spark: 'oklch(0.56 0.151 285.4)',
    'on-surface': 'oklch(0.423 0.056 245.8)',
  },
  // Trung — đỏ rượu hoàng thành + vàng hoàng gia (codename Tangtang)
  central: {
    primary: 'oklch(0.415 0.161 27.2)',
    deep: 'oklch(0.351 0.131 25.9)',
    surface: 'oklch(0.89 0.028 20.4)',
    spark: 'oklch(0.799 0.163 99.1)',
    'on-surface': 'oklch(0.31 0.006 214.4)',
  },
  // Nam — nâu phù sa + đỏ gạch nung (codename Gilberta)
  south: {
    primary: 'oklch(0.555 0.053 48.4)',
    deep: 'oklch(0.394 0.091 28.3)',
    surface: 'oklch(0.661 0.052 51.2)',
    spark: 'oklch(0.485 0.183 29.7)',
    'on-surface': 'oklch(0.303 0.037 35.2)',
  },
};
```

- [ ] **Step 6: Sửa test brand-cũ trong `rn-convert.spec.ts`** — test
  `keeps the emerald primary green-dominant` đổi thành primary Wuling (vẫn test
  đúng hành vi chuyển màu, chỉ đổi input theo brand mới):

```ts
  it('giữ primary ngọc Wuling green-dominant khi chuyển hex', () => {
    const hex = toRnColor('oklch(0.494 0.067 184.3)');
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    // Destructure với default 0: tsconfig v2 bật noUncheckedIndexedAccess (nghiêm hơn Nexora).
    const [r = 0, g = 0, b = 0] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((c) =>
      parseInt(c, 16),
    );
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThanOrEqual(b);
  });
```

- [ ] **Step 7: Chạy test PASS**

Run: `pnpm turbo run test typecheck --filter=@tourism/tokens`
Expected: PASS toàn bộ (tokens.spec 4 test + rn-convert specs).

- [ ] **Step 8: Commit**

```bash
git add libs/shared/tokens/src/lib/tokens.spec.ts libs/shared/tokens/src/lib/tokens.ts \
  libs/shared/tokens/style-dictionary/tokens.mjs libs/shared/tokens/src/lib/rn-convert.spec.ts
git commit -m "feat(tokens): hệ màu Wuling + lớp region north/central/south (ADR-0013)"
```

---

### Task 2: build.mjs emit region + rebuild

**Files:**
- Modify: `libs/shared/tokens/style-dictionary/build.mjs`

**Interfaces:**
- Consumes: `regions`, `regionDefaults` từ Task 1.
- Produces: `generated/tokens.css` có `--region-*` trong `:root` và 3 khối `[data-region='…']`.

- [ ] **Step 1: Import thêm trong build.mjs** — dòng import từ `./tokens.mjs` thêm `regionDefaults, regions`:

```js
import tokens, {
  baseRules,
  densityCompact,
  fonts,
  radiusScale,
  regionDefaults,
  regions,
  rootExtras,
  themeExtras,
} from './tokens.mjs';
```

- [ ] **Step 2: Emit region trong format `tourism/tailwind-css`**:

Trong mảng `root` (sau `...rootExtras.map(...)`) thêm:

```js
      ...Object.entries(regionDefaults).map(([k, v]) => `  --region-${k}: ${v};`),
```

Sau phần `.dark` (sau `'}'` và `''` của `.dark`, TRƯỚC `"[data-density='compact'] {"`) chèn:

```js
      ...Object.entries(regions).flatMap(([name, vals]) => [
        `[data-region='${name}'] {`,
        ...Object.entries(vals).map(([k, v]) => `  --region-${k}: ${v};`),
        '}',
        '',
      ]),
```

- [ ] **Step 3: Rebuild + verify**

```bash
pnpm turbo run build --filter=@tourism/tokens --force
grep -c "region-primary" libs/shared/tokens/generated/tokens.css
grep -n "data-region='central'" libs/shared/tokens/generated/tokens.css
grep -n "^  --primary:" libs/shared/tokens/generated/tokens.css
```

Expected: `region-primary` xuất hiện 4 lần (root + 3 vùng); có khối `central`; `--primary: oklch(0.494 0.067 184.3)`.

- [ ] **Step 4: Commit**

```bash
git add libs/shared/tokens/style-dictionary/build.mjs
git commit -m "feat(tokens): emit --region-* mặc định + khối [data-region] vào tokens.css"
```

---

### Task 3: Wire `@tourism/ui` vào tokens.css

**Files:**
- Modify: `libs/shared/ui/package.json` (dependency)
- Modify: `libs/shared/ui/src/styles/globals.css`

**Interfaces:**
- Consumes: `@tourism/tokens/tokens.css` (export map sẵn có của tokens).
- Produces: mọi app import `@tourism/ui/globals.css` nhận theme Wuling + region slots.

- [ ] **Step 1: Thêm dependency** — trong `libs/shared/ui/package.json` mục `dependencies` thêm `"@tourism/tokens": "workspace:*"`, rồi `pnpm install`.

- [ ] **Step 2: Sửa `globals.css`** — khối import đầu file thành:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@tourism/tokens/tokens.css";
@import "./typeset.css";
```

XÓA: toàn bộ khối `@theme inline { … }`, khối `:root { … }` và `.dark { … }`
(tokens.css cung cấp cả ba — đối chiếu key trước khi xóa: mọi var mà khối cũ
khai phải có mặt trong `generated/tokens.css`; tokens có THỪA không sao, THIẾU là dừng lại báo).
GIỮ: `@custom-variant dark (&:is(.dark *));` và khối `@layer base { … }` cuối file.

- [ ] **Step 3: Verify build web + CSS output**

```bash
pnpm exec biome check libs/shared/ui
pnpm turbo run build --filter=@tourism/web --force
grep -rlo "0.494 0.067 184.3" apps/web/.next/static/chunks/*.css | head -1
grep -rlo "data-region" apps/web/.next/static/chunks/*.css | head -1
```

Expected: biome sạch; build PASS; cả hai grep tìm thấy file CSS.

- [ ] **Step 4: Commit**

```bash
git add libs/shared/ui/package.json libs/shared/ui/src/styles/globals.css pnpm-lock.yaml
git commit -m "feat(ui): globals.css dùng @tourism/tokens/tokens.css thay khối neutral shadcn"
```

---

### Task 4: Font Be Vietnam Pro + Lora tại apps/web

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: biến `--font-sans`/`--font-heading`/`--font-mono` ở `<html>` — tokens @theme và typeset.css ăn theo.

- [ ] **Step 1: Thay layout.tsx**

```tsx
import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Geist_Mono, Lora } from 'next/font/google';
import './globals.css';

// Font brand (ADR-0013 #6): Be Vietnam Pro (thân/UI) + Lora (heading) — cả hai
// có subset vietnamese cho địa danh; Geist Mono giữ cho code/kbd.
const sans = Be_Vietnam_Pro({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
});

const heading = Lora({
  variable: '--font-heading',
  subsets: ['latin', 'vietnamese'],
});

const mono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Tourism',
  description: 'Book tours across Vietnam',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

(Ghi chú: metadata.description đổi sang tiếng Anh theo luật #7 — copy user-facing.)

- [ ] **Step 2: Verify**

Run: `pnpm turbo run build typecheck --filter=@tourism/web`
Expected: PASS (next/font tải font lúc build — cần mạng).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(web): font brand Be Vietnam Pro + Lora (+font-mono), metadata copy tiếng Anh"
```

---

### Task 5: Kiểm chứng visual + gate đầy đủ

**Files:**
- Create tạm → XÓA: `apps/web/src/app/theme-preview/page.tsx`

- [ ] **Step 1: Page tạm** (copy tiếng Anh; component brand + 3 khối region):

```tsx
import { Typeset } from '@tourism/ui/components/typeset';
import { Button } from '@tourism/ui/components/button';
import { Badge } from '@tourism/ui/components/badge';

// Page tạm kiểm chứng theme Wuling + region tint — XÓA sau khi chụp bằng chứng.
const regions = ['north', 'central', 'south'] as const;

export default function ThemePreviewPage() {
  return (
    <main className="mx-auto grid max-w-4xl gap-8 p-8">
      <section className="grid gap-3">
        <h1 className="font-heading text-3xl">Wuling theme preview</h1>
        <p className="text-muted-foreground">Body Be Vietnam Pro — Sa Pa, Hội An, Đà Nẵng.</p>
        <div className="flex gap-3">
          <Button>Book now</Button>
          <Button variant="secondary">Wishlist</Button>
          <Button variant="destructive">Cancel booking</Button>
          <Badge>Nature</Badge>
        </div>
        <Typeset preset="docs">
          <h2>Itinerary</h2>
          <p>Two days aboard a junk boat with <strong>kayaking</strong> and fresh seafood.</p>
          <blockquote>Best trip of our lives.</blockquote>
        </Typeset>
      </section>
      <section className="grid grid-cols-3 gap-4">
        {regions.map((r) => (
          <div key={r} data-region={r} className="grid gap-2 rounded-lg border p-4">
            <span
              className="rounded px-2 py-1 text-xs font-bold uppercase tracking-wide"
              style={{ background: 'var(--region-surface)', color: 'var(--region-on-surface)' }}
            >
              {r}
            </span>
            <div className="h-10 rounded" style={{ background: 'var(--region-primary)' }} />
            <div className="h-4 rounded" style={{ background: 'var(--region-spark)' }} />
          </div>
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Dev server + screenshot light/dark**

```bash
pnpm --filter @tourism/web dev  # nền
npx playwright screenshot --viewport-size=1280,900 --full-page http://localhost:3000/theme-preview \
  /tmp/claude-1000/-home-yuriv-projects-tourism-v2/cf4cf8d0-d7ab-40d4-acf7-541d75569b6e/scratchpad/theme-light.png
```

Dark: chụp bằng cách thêm class `dark` (playwright CLI không toggle được — dùng
`npx playwright screenshot` với `--wait-for-timeout` + evaluate không có; thay
bằng: tạm gắn `className="dark"` vào `<html>` trong layout, chụp, gỡ — hoặc chụp
qua script node playwright `page.addInitScript(() => document.documentElement.classList.add('dark'))`).
Expected: light = sương/ngọc/mực đúng demo đã duyệt; dark = đêm trúc; 3 khối
region đổi màu rõ (thép/đỏ rượu/nâu phù sa); heading serif Lora, thân Be Vietnam Pro.

- [ ] **Step 3: Xóa page tạm, tắt dev, cây sạch**

```bash
rm -rf apps/web/src/app/theme-preview
git status --short
```

- [ ] **Step 4: Gate đầy đủ**

Run: `pnpm gate:int`
Expected: TẤT CẢ xanh. Nếu int fail vì thiếu Postgres → ghi rõ, KHÔNG khai xong.

- [ ] **Step 5: Báo cáo** — screenshot + số test; KHÔNG merge/push.

## Self-review

- Spec coverage: tokens.mjs values (T1) · region emit (T2) · wire ui (T3) · fonts (T4) · nghiệm thu (T5). Non-goals không lấn (không trang vùng, không dark-region, không đổi pipeline).
- Placeholder: không còn.
- Type consistency: `regions`/`regionDefaults`/`REGIONS`/slot keys thống nhất T1↔T2↔T5; oklch primary `0.494 0.067 184.3` thống nhất T1↔T2↔T3 grep.
