# Typeset (shadcn) trong `@tourism/ui` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor `typeset.css` của shadcn vào `@tourism/ui`, thêm 3 preset (docs/chat/reading) + wrapper `<Typeset>` type-safe, mọi app hưởng qua `@tourism/ui/globals.css`.

**Architecture:** Một file CSS vendored (lõi upstream giữ nguyên, preset tự viết) import trong `globals.css`; một component cva/useRender mỏng theo đúng idiom 59 component base-nova; unit test vitest đầu tiên của package `@tourism/ui`.

**Tech Stack:** Tailwind v4 · shadcn/typeset (vendor 2026-07-22) · cva · @base-ui/react useRender · Vitest 4.1.10.

Spec: [docs/specs/2026-07-22-ui-typeset-design.md](../specs/2026-07-22-ui-typeset-design.md) · ADR: [ADR-0012](../adr/0012-typeset-typography.md)

## Global Constraints

- Comment code tiếng Việt (CLAUDE.md #8) — NGOẠI TRỪ phần lõi vendor của `typeset.css` (giữ nguyên nguyên bản, ADR-0012 #3).
- KHÔNG thêm Prettier/ESLint/`@tailwindcss/typography`.
- Conventional Commits, không AI attribution.
- `pnpm gate:int` phải xanh trước khi khai xong (CLAUDE.md #11).
- Không đụng `apps/api`, `prisma/migrations`.
- Nhánh làm việc: `feat/ui-typeset` (đã tạo).

---

### Task 1: Vendor `typeset.css` + preset + wire vào `globals.css`

**Files:**
- Create: `libs/shared/ui/src/styles/typeset.css`
- Modify: `libs/shared/ui/src/styles/globals.css` (đầu file, khối `@import`)
- Modify: `biome.json` (`files.includes`)

**Interfaces:**
- Produces: class CSS `.typeset`, `.typeset-docs`, `.typeset-chat`, `.typeset-reading`, escape hatch `.not-typeset`/`[data-not-typeset]` — Task 2 và mọi app dùng các class này.

- [ ] **Step 1: Tải lõi upstream (đã có sẵn bản tải lúc recon — dùng lại nếu còn)**

```bash
curl -sL "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/(app)/(typeset)/typeset.css" \
  -o /tmp/claude-1000/-home-yuriv-projects-tourism-v2/cf4cf8d0-d7ab-40d4-acf7-541d75569b6e/scratchpad/typeset-upstream.css
wc -l /tmp/claude-1000/-home-yuriv-projects-tourism-v2/cf4cf8d0-d7ab-40d4-acf7-541d75569b6e/scratchpad/typeset-upstream.css
```

Expected: ~490 dòng, mở đầu bằng comment `shadcn/typeset`.

- [ ] **Step 2: Tạo `libs/shared/ui/src/styles/typeset.css`**

Cấu trúc file = header tiếng Việt (nguồn/ngày/luật sửa) + LÕI UPSTREAM NGUYÊN BẢN + khối preset. Header chèn TRƯỚC dòng đầu upstream:

```css
/*
 * Vendor từ shadcn/typeset — ADR-0012.
 * Nguồn: shadcn-ui/ui@main apps/v4/app/(app)/(typeset)/typeset.css (tải 2026-07-22).
 * PHẦN LÕI (từ comment "shadcn/typeset" tới hết fallback :first-child) giữ
 * NGUYÊN BẢN để diff được với upstream — muốn đổi hành vi, sửa ở khối preset
 * cuối file hoặc override trong app, đừng sửa lõi.
 * File này nằm ngoài Biome (biome.json files.includes) — không auto-format.
 */
```

Sau đó nối toàn bộ nội dung upstream không sửa gì, rồi nối khối preset:

```css
/*
 * Preset tourism-v2 (ADR-0012 #4) — mỗi preset chỉ đặt lại 3 biến điều khiển.
 */
@layer components {
  /* Mặc định rộng rãi: mô tả tour, itinerary, FAQ, admin preview (P3b/P4). */
  .typeset-docs {
    --typeset-size: 1em;
    --typeset-leading: 1.75;
    --typeset-flow: 1.25em;
  }

  /* Chặt + chữ nhỏ cho chat streaming (P6) — tương đương prose-sm ở Nexora. */
  .typeset-chat {
    --typeset-size: 0.875em;
    --typeset-leading: 1.6;
    --typeset-flow: 1em;
  }

  /* Thoáng + chữ lớn cho trang đọc dài: about, policy, blog. */
  .typeset-reading {
    --typeset-size: 1.0625em;
    --typeset-leading: 1.8;
    --typeset-flow: 1.5em;
  }
}
```

Lệnh ghép (rồi kiểm tra bằng mắt đầu/cuối file):

```bash
cat > /tmp/claude-1000/-home-yuriv-projects-tourism-v2/cf4cf8d0-d7ab-40d4-acf7-541d75569b6e/scratchpad/typeset-header.css <<'EOF'
[header ở trên]
EOF
cat > /tmp/claude-1000/-home-yuriv-projects-tourism-v2/cf4cf8d0-d7ab-40d4-acf7-541d75569b6e/scratchpad/typeset-presets.css <<'EOF'
[khối preset ở trên]
EOF
cat scratchpad/typeset-header.css scratchpad/typeset-upstream.css scratchpad/typeset-presets.css \
  > libs/shared/ui/src/styles/typeset.css
```

- [ ] **Step 3: Import trong `globals.css`**

Trong `libs/shared/ui/src/styles/globals.css`, khối import hiện tại:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

Thêm dòng cuối khối (typeset PHẢI sau Tailwind):

```css
@import "./typeset.css";
```

- [ ] **Step 4: Loại `typeset.css` khỏi Biome (vendored artifact)**

Trong `biome.json`, `files.includes` thành:

```json
"includes": ["**", "!**/generated", "!**/dist", "!**/dist-seed", "!**/public", "!libs/shared/ui/src/styles/typeset.css"]
```

- [ ] **Step 5: Verify lint + build web ăn CSS mới**

```bash
pnpm exec biome check .
pnpm turbo run build --filter=@tourism/web
grep -c "typeset" apps/web/.next/static/chunks/*.css 2>/dev/null || grep -rlc "typeset-docs" apps/web/.next/ | head -3
```

Expected: biome sạch; build web PASS; class `typeset-docs` xuất hiện trong CSS output (nếu Tailwind purge không đụng file import thuần thì grep .next thấy chuỗi `typeset`).

- [ ] **Step 6: Commit**

```bash
git add libs/shared/ui/src/styles/typeset.css libs/shared/ui/src/styles/globals.css biome.json
git commit -m "feat(ui): vendor shadcn/typeset + 3 preset docs/chat/reading (ADR-0012)"
```

---

### Task 2: Vitest cho `@tourism/ui` + component `<Typeset>` (TDD)

**Files:**
- Create: `libs/shared/ui/vitest.config.ts`
- Create: `libs/shared/ui/src/components/typeset.spec.ts`
- Create: `libs/shared/ui/src/components/typeset.tsx`
- Modify: `libs/shared/ui/package.json` (script `test`, devDep `vitest`)

**Interfaces:**
- Consumes: class CSS từ Task 1 (`typeset`, `typeset-docs|chat|reading`).
- Produces: `Typeset` (component, props `useRender.ComponentProps<'div'> & VariantProps<typeof typesetVariants>`, preset mặc định `'docs'`) và `typesetVariants` (hàm cva `(opts?: { preset?: 'docs'|'chat'|'reading'|null }) => string`) export từ `@tourism/ui/components/typeset`.

- [ ] **Step 1: Setup vitest cho package**

`libs/shared/ui/package.json`: thêm vào `scripts`: `"test": "vitest run"`; thêm vào `devDependencies`: `"vitest": "4.1.10"` (khớp root/api). Rồi `pnpm install`.

`libs/shared/ui/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit test logic thuần (cva) — không cần jsdom. Alias khớp tsconfig paths
// vì Vitest không tự đọc "paths" của tsconfig.
export default defineConfig({
  resolve: {
    alias: {
      '@tourism/ui': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  esbuild: {
    // File .tsx dùng JSX runtime tự động của React 19.
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 2: Viết test FAIL trước (TDD)**

`libs/shared/ui/src/components/typeset.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { typesetVariants } from './typeset';

// Logic thuần duy nhất của wrapper: mapping preset → chuỗi class (ADR-0012 #5).
describe('typesetVariants', () => {
  it('mặc định rơi về preset docs', () => {
    expect(typesetVariants()).toBe('typeset typeset-docs');
  });

  it.each([
    ['docs', 'typeset-docs'],
    ['chat', 'typeset-chat'],
    ['reading', 'typeset-reading'],
  ] as const)('preset %s sinh class %s kèm class gốc typeset', (preset, expected) => {
    const classes = typesetVariants({ preset }).split(' ');
    expect(classes).toContain('typeset');
    expect(classes).toContain(expected);
  });

  it('preset undefined vẫn dùng defaultVariants docs', () => {
    expect(typesetVariants({ preset: undefined })).toBe('typeset typeset-docs');
  });
});
```

- [ ] **Step 3: Chạy để thấy FAIL**

```bash
pnpm turbo run test --filter=@tourism/ui
```

Expected: FAIL — `Cannot find module './typeset'` (hoặc tương đương).

- [ ] **Step 4: Implement `typeset.tsx` (đúng idiom badge.tsx)**

`libs/shared/ui/src/components/typeset.tsx`:

```tsx
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cn } from '@tourism/ui/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// Wrapper typography cho nội dung render (markdown/rich-text) — ADR-0012.
// Preset đặt 3 biến điều khiển của shadcn/typeset (size/leading/flow),
// định nghĩa trong styles/typeset.css. Thoát style cho phần tử con:
// class `not-typeset` hoặc attr `data-not-typeset`.
const typesetVariants = cva('typeset', {
  variants: {
    preset: {
      docs: 'typeset-docs',
      chat: 'typeset-chat',
      reading: 'typeset-reading',
    },
  },
  defaultVariants: {
    preset: 'docs',
  },
});

function Typeset({
  className,
  preset = 'docs',
  render,
  ...props
}: useRender.ComponentProps<'div'> & VariantProps<typeof typesetVariants>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(typesetVariants({ preset }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'typeset',
      preset,
    },
  });
}

export { Typeset, typesetVariants };
```

- [ ] **Step 5: Chạy test PASS + typecheck + lint**

```bash
pnpm turbo run test typecheck --filter=@tourism/ui
pnpm exec biome check libs/shared/ui
```

Expected: 5 test PASS, typecheck sạch, biome sạch.

- [ ] **Step 6: Commit**

```bash
git add libs/shared/ui/vitest.config.ts libs/shared/ui/src/components/typeset.spec.ts \
  libs/shared/ui/src/components/typeset.tsx libs/shared/ui/package.json pnpm-lock.yaml
git commit -m "feat(ui): component Typeset (preset docs/chat/reading) + vitest đầu tiên cho @tourism/ui"
```

---

### Task 3: Kiểm chứng render thật trong apps/web + gate đầy đủ

**Files:**
- Create tạm → XÓA trước khi xong: `apps/web/src/app/typeset-preview/page.tsx`

**Interfaces:**
- Consumes: `Typeset` từ `@tourism/ui/components/typeset` (Task 2), CSS từ Task 1.
- Produces: bằng chứng screenshot 3 preset (scratchpad) cho báo cáo; không để lại code.

- [ ] **Step 1: Page tạm** (copy sample TIẾNG ANH — luật #7 không áp vì page sẽ xóa, nhưng giữ tiếng Anh luôn cho sạch)

`apps/web/src/app/typeset-preview/page.tsx`:

```tsx
import { Typeset } from '@tourism/ui/components/typeset';

// Page tạm để kiểm chứng typeset render — XÓA sau khi chụp bằng chứng.
const sample = (
  <>
    <h1>Ha Long Bay Cruise</h1>
    <p>
      Two days aboard a traditional junk boat, with <strong>kayaking</strong>, a{' '}
      <a href="#cave">cave visit</a>, and <code>fresh seafood</code>.
    </p>
    <h2>Itinerary</h2>
    <ul>
      <li>Day 1 — Embark, lunch on board, kayak at sunset</li>
      <li>Day 2 — Sung Sot cave, cooking class, return</li>
    </ul>
    <blockquote>Best trip of our lives — the crew was wonderful.</blockquote>
    <pre>
      <code>{'POST /bookings { "tourId": "halong-2d1n" }'}</code>
    </pre>
  </>
);

export default function TypesetPreviewPage() {
  return (
    <main className="mx-auto grid max-w-6xl grid-cols-3 gap-8 p-8">
      <Typeset preset="docs">{sample}</Typeset>
      <Typeset preset="chat">{sample}</Typeset>
      <Typeset preset="reading">{sample}</Typeset>
    </main>
  );
}
```

- [ ] **Step 2: Dev server + screenshot bằng playwright MCP**

```bash
pnpm --filter @tourism/web dev  # nền, đợi ready
```

Mở `http://localhost:3000/typeset-preview` bằng playwright → screenshot lưu
scratchpad (`typeset-preview.png`). Expected: 3 cột khác biệt rõ (chat nhỏ/chặt,
reading lớn/thoáng), heading đậm, list có bullet, blockquote có lề — tức CSS đã
ăn qua chuỗi import.

- [ ] **Step 3: Xóa page tạm, tắt dev server**

```bash
rm -rf apps/web/src/app/typeset-preview
git status --short   # phải sạch ngoài các file đã commit
```

- [ ] **Step 4: Gate đầy đủ (luật #11)**

```bash
pnpm gate:int
```

Expected: build + typecheck + unit + lint + int test TẤT CẢ xanh. (Int test cần
Postgres local — nếu môi trường thiếu DB thì ghi rõ trong báo cáo, KHÔNG khai xong.)

- [ ] **Step 5: Không merge/push** — báo cáo cho user review (quy ước #1/#2), kèm screenshot + số test.

## Self-review

- Spec coverage: file map spec ↔ Task 1 (css/globals/biome), Task 2 (component/test/vitest), Task 3 (kiểm chứng + gate) — đủ; non-goals không bị lấn.
- Placeholder: không còn TBD; mọi step có code/lệnh thật.
- Type consistency: `typesetVariants` cùng chữ ký ở Task 2 Step 2/4; preset union `docs|chat|reading` khớp CSS Task 1.
