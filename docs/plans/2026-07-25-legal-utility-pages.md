# Kế hoạch — Cụm trang pháp lý / utility (P3b)

> **Cho agent thực thi:** SUB-SKILL BẮT BUỘC — dùng
> `superpowers:subagent-driven-development` hoặc `superpowers:executing-plans`
> để chạy plan này theo từng task. Các bước dùng checkbox (`- [ ]`).

**Spec**: [2026-07-25-legal-utility-pages-design.md](../specs/2026-07-25-legal-utility-pages-design.md)

**Goal:** Dựng 4 trang nội dung dài (`/terms`, `/privacy`,
`/cancellation-policy`, `/faq`) cộng bộ 3 route boundary còn thiếu
(`not-found`, `error`, `global-error`), vá đúng chỗ thụt lùi so với Nexora.

**Architecture:** Nội dung lấy từ `@tourism/i18n` (đã port sẵn, cần sửa brand +
thêm mục test-mode). Ba trang pháp lý dùng chung `LegalArticle` (band tối mỏng
`ContentHero` + thân bài `Typeset preset="reading"` + `OnThisPage` sticky bên
phải). `/faq` dùng lại `ContentHero` + `OnThisPage` + `FaqExplorer` (search
client, dữ liệu truyền xuống qua props). Chrome site tách thành `SiteChrome`
để `app/not-found.tsx` cũng có navbar/footer.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 ·
`@tourism/ui` (Typeset ADR-0012, Accordion, Input) · `@tourism/i18n` ·
motion/react · Vitest (node env) · Biome.

## Global Constraints

- **Tokens-only, không hex** — mọi màu qua token của `@tourism/tokens`
  (`bg-primary`, `text-muted-foreground`, `border-border`…).
- **Copy user-facing tiếng Anh**; **comment code tiếng Việt** (kể cả JSDoc).
- **Biome** là formatter/linter duy nhất — không thêm Prettier/ESLint.
- Hero của trang trong `(site)` **luôn tối** (`dark` scope): navbar chưa cuộn
  dùng `text-on-media`, hero sáng sẽ làm navbar tàng hình.
- `TopoPattern` **tối đa 1 vị trí mỗi trang**.
- **Không chạy `next build` / `turbo run build` cho `@tourism/web`** khi dev
  server của user còn sống ở cổng 3000 (tranh `.next`, đầu độc cache
  Turbopack). Verify bằng `turbo run typecheck` + `biome check` + `vitest`.
- Branch: `feat/legal-utility-pages`. Conventional Commits, **không** AI
  attribution.

---

## Bố cục file

| File | Trách nhiệm |
| --- | --- |
| `libs/shared/i18n/src/lib/resilience.ts` | **Tạo** — tách cụm copy 404/error ra module riêng để client boundary không kéo cả `messages.ts` 83KB vào bundle |
| `libs/shared/i18n/src/lib/messages.ts` | **Sửa** — import lại `resilience`; đổi brand Nexora → Tourism |
| `libs/shared/i18n/src/lib/legal/{terms,privacy,cancellation}.ts` | **Sửa** — brand, `updated`, `reviewNote`, mục "Test-mode payments" |
| `libs/shared/i18n/src/index.ts` | **Sửa** — export `./lib/resilience.js` |
| `apps/web/src/lib/slug.ts` (+ `.spec.ts`) | **Tạo** — `slugify` cho id section/anchor |
| `apps/web/src/lib/toc.ts` (+ `.spec.ts`) | **Tạo** — `tocFromLegalDoc` |
| `apps/web/src/lib/faq-filter.ts` (+ `.spec.ts`) | **Tạo** — `filterFaqCategories` |
| `apps/web/src/lib/legal-content.spec.ts` | **Tạo** — canh nội dung i18n (hết "Nexora", slug duy nhất) |
| `apps/web/src/components/content/content-hero.tsx` | **Tạo** — band tối mỏng dùng chung 4 trang |
| `apps/web/src/components/content/on-this-page.tsx` | **Tạo** — TOC sticky phải + scroll-spy |
| `apps/web/src/components/legal/legal-article.tsx` | **Tạo** — render `LegalDoc` |
| `apps/web/src/components/faq/faq-explorer.tsx` | **Tạo** — search + nhóm + accordion |
| `apps/web/src/components/feedback/error-state.tsx` | **Tạo** — panel lỗi tối giản |
| `apps/web/src/components/site-chrome.tsx` | **Tạo** — TopBar+Header+Footer+ScrollToTop dùng chung |
| `apps/web/src/app/(site)/{terms,privacy,cancellation-policy,faq}/page.tsx` | **Tạo** — 4 trang |
| `apps/web/src/app/{not-found,error,global-error}.tsx` | **Tạo** — 3 boundary |
| `apps/web/src/app/(site)/layout.tsx` | **Sửa** — dùng `SiteChrome` |
| `apps/web/src/components/site-footer.tsx` | **Sửa** — 4 link Support trỏ route thật |
| `apps/web/package.json` | **Sửa** — thêm `@tourism/i18n` |

---

## Task 1: Helper thuần `slugify` + `tocFromLegalDoc` (TDD)

**Files:**
- Create: `apps/web/src/lib/slug.ts`, `apps/web/src/lib/slug.spec.ts`
- Create: `apps/web/src/lib/toc.ts`, `apps/web/src/lib/toc.spec.ts`

**Interfaces:**
- Consumes: kiểu `LegalDoc` từ `@tourism/i18n` (đã tồn tại: `{ title, breadcrumb, updated, reviewNote?, intro: string[], sections: { heading, paragraphs?, bullets? }[] }`).
- Produces: `slugify(value: string): string` · `tocFromLegalDoc(doc: LegalDoc): TocItem[]` với `type TocItem = { id: string; label: string; index: string }`.

- [ ] **Bước 1: Thêm dependency `@tourism/i18n` cho web**

Sửa `apps/web/package.json`, thêm vào `dependencies` (giữ thứ tự alphabet,
ngay trước `@tourism/ui`):

```json
    "@tourism/i18n": "workspace:*",
```

Rồi chạy:

```bash
pnpm install
```

- [ ] **Bước 2: Build `@tourism/i18n` (dev server cần `dist/`)**

Gói này export qua `./dist/index.js`; task `dev` của Turbo **không**
`dependsOn ^build` nên dev server sẽ không resolve được nếu chưa build.
Build một mình gói i18n — **không** đụng `.next` của web:

```bash
pnpm turbo run build --filter=@tourism/i18n
```

Expected: `Tasks: 1 successful`, sinh `libs/shared/i18n/dist/index.js`.

- [ ] **Bước 3: Viết test cho `slugify` (chưa có code → phải fail)**

Tạo `apps/web/src/lib/slug.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
  it('hạ chữ thường và nối bằng gạch ngang', () => {
    expect(slugify('Booking and your contract')).toBe('booking-and-your-contract');
  });

  it('gộp ký tự không phải chữ/số thành một gạch', () => {
    expect(slugify('Prices, inclusions & payment')).toBe('prices-inclusions-payment');
  });

  it('cắt gạch thừa ở hai đầu', () => {
    expect(slugify('— Travel insurance —')).toBe('travel-insurance');
  });

  it('trả chuỗi rỗng khi không còn ký tự hợp lệ', () => {
    expect(slugify('———')).toBe('');
  });
});
```

- [ ] **Bước 4: Chạy test để chắc chắn FAIL**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/slug.spec.ts
```

Expected: FAIL — `Failed to resolve import "./slug.js"`.

- [ ] **Bước 5: Viết `slugify`**

Tạo `apps/web/src/lib/slug.ts`:

```ts
/** Slug chữ thường nối gạch ngang — dùng chung cho id section và anchor TOC. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

- [ ] **Bước 6: Chạy lại test — PASS**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/slug.spec.ts
```

Expected: `4 passed`.

- [ ] **Bước 7: Viết test cho `tocFromLegalDoc`**

Tạo `apps/web/src/lib/toc.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tocFromLegalDoc } from './toc.js';

const doc = {
  title: 'Terms',
  breadcrumb: 'Terms',
  updated: 'Last updated: 25 July 2026',
  intro: ['Intro paragraph.'],
  sections: [
    { heading: 'Booking and your contract', paragraphs: ['a'] },
    { heading: 'Prices, inclusions and payment', paragraphs: ['b'] },
  ],
};

describe('tocFromLegalDoc', () => {
  it('mỗi section thành một mục, id khớp slugify', () => {
    expect(tocFromLegalDoc(doc)).toEqual([
      { id: 'booking-and-your-contract', label: 'Booking and your contract', index: '01' },
      { id: 'prices-inclusions-and-payment', label: 'Prices, inclusions and payment', index: '02' },
    ]);
  });

  it('đánh số hai chữ số cho cột mono', () => {
    const many = { ...doc, sections: Array.from({ length: 11 }, (_, i) => ({ heading: `Section ${i}` })) };
    expect(tocFromLegalDoc(many).at(-1)?.index).toBe('11');
  });

  it('doc không có section thì trả mảng rỗng', () => {
    expect(tocFromLegalDoc({ ...doc, sections: [] })).toEqual([]);
  });
});
```

- [ ] **Bước 8: Chạy test để chắc chắn FAIL**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/toc.spec.ts
```

Expected: FAIL — `Failed to resolve import "./toc.js"`.

- [ ] **Bước 9: Viết `tocFromLegalDoc`**

Tạo `apps/web/src/lib/toc.ts`:

```ts
import type { LegalDoc } from '@tourism/i18n';
import { slugify } from './slug.js';

/** Một mục trong "On this page" — `index` là số thứ tự đã pad cho cột mono. */
export type TocItem = { id: string; label: string; index: string };

/** Dựng mục lục từ một LegalDoc; id phải khớp id gắn trên thẻ <section>. */
export function tocFromLegalDoc(doc: LegalDoc): TocItem[] {
  return doc.sections.map((section, i) => ({
    id: slugify(section.heading),
    label: section.heading,
    index: String(i + 1).padStart(2, '0'),
  }));
}
```

- [ ] **Bước 10: Chạy lại test — PASS**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/toc.spec.ts
```

Expected: `3 passed`.

- [ ] **Bước 11: Format + commit**

```bash
pnpm lint:fix
git add apps/web/package.json apps/web/src/lib pnpm-lock.yaml
git commit -m "feat(web): helper slugify + tocFromLegalDoc cho mục lục trang nội dung dài"
```

---

## Task 2: Dọn nội dung i18n (brand · test-mode · reviewNote · tách resilience)

**Files:**
- Create: `libs/shared/i18n/src/lib/resilience.ts`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (khối `resilience` ở ~dòng 503; 7 chỗ chuỗi "Nexora")
- Modify: `libs/shared/i18n/src/lib/legal/terms.ts`, `privacy.ts`, `cancellation.ts`
- Modify: `libs/shared/i18n/src/index.ts`
- Create: `apps/web/src/lib/legal-content.spec.ts`

**Interfaces:**
- Consumes: `slugify` từ Task 1.
- Produces: `resilience` export mới từ `@tourism/i18n`; 3 `LegalDoc` đã sạch
  brand, có `reviewNote`, `updated: 'Last updated: 25 July 2026'`; `termsDoc`
  có thêm section `Test-mode payments`.

- [ ] **Bước 1: Viết test canh nội dung (fail trước khi sửa)**

Tạo `apps/web/src/lib/legal-content.spec.ts`:

```ts
import { cancellationDoc, privacyDoc, termsDoc } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

const DOCS = [
  ['terms', termsDoc],
  ['privacy', privacyDoc],
  ['cancellation', cancellationDoc],
] as const;

describe('nội dung pháp lý', () => {
  it.each(DOCS)('%s không còn nhắc brand cũ Nexora', (_name, doc) => {
    expect(JSON.stringify(doc)).not.toMatch(/Nexora/i);
  });

  it.each(DOCS)('%s có slug section duy nhất (anchor TOC phụ thuộc)', (_name, doc) => {
    const slugs = doc.sections.map((s) => slugify(s.heading));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => s.length > 0)).toBe(true);
  });

  it.each(DOCS)('%s có reviewNote cảnh báo tài liệu mẫu', (_name, doc) => {
    expect(doc.reviewNote).toBeTruthy();
  });

  it.each(DOCS)('%s ghi ngày cập nhật thống nhất', (_name, doc) => {
    expect(doc.updated).toBe('Last updated: 25 July 2026');
  });

  it('terms nói rõ thanh toán chạy test mode', () => {
    const testModeSection = termsDoc.sections.find((s) => s.heading === 'Test-mode payments');
    expect(testModeSection).toBeDefined();
    expect(JSON.stringify(testModeSection)).toMatch(/test mode/i);
  });

  it('cancellation nhắc lại chuyện không có tiền thật', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/test mode/i);
  });
});
```

- [ ] **Bước 2: Chạy test — FAIL**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/legal-content.spec.ts
```

Expected: FAIL — các assertion về `Nexora`, `reviewNote`, `updated`,
`Test-mode payments`.

- [ ] **Bước 3: Đổi brand + ngày + reviewNote trong 3 doc**

Trong `libs/shared/i18n/src/lib/legal/terms.ts` và `privacy.ts`: thay **mọi**
chuỗi `Nexora` bằng `Tourism` (3 chỗ mỗi file, gồm cả comment JSDoc đầu file —
comment giữ tiếng Việt như luật #8; nếu comment đang tiếng Anh thì viết lại
tiếng Việt luôn).

Trong cả 3 file, đặt:

```ts
  updated: 'Last updated: 25 July 2026',
```

và thêm ngay dưới `updated` (dùng đúng câu này cho cả 3 doc):

```ts
  reviewNote:
    'This document is sample content for a student capstone project, not legal advice. Tourism does not sell real trips here: payments run entirely in Stripe and PayPal test/sandbox mode, and no money changes hands.',
```

- [ ] **Bước 4: Thêm section "Test-mode payments" vào `termsDoc`**

Trong `libs/shared/i18n/src/lib/legal/terms.ts`, chèn section này **ngay sau**
section `Prices, inclusions and payment`:

```ts
    {
      heading: 'Test-mode payments',
      paragraphs: [
        'This site is a demonstration platform. Stripe and PayPal are connected in test/sandbox mode only, so no card is ever charged, no money is transferred, and no booking creates a real financial obligation for either side.',
        'Any amount, invoice, or receipt you see is generated for demonstration purposes. Use the payment providers’ published test card numbers; never enter real card details on this site.',
      ],
    },
```

- [ ] **Bước 5: Nhắc test mode trong `cancellationDoc`**

Trong `libs/shared/i18n/src/lib/legal/cancellation.ts`, thêm câu này vào cuối
mảng `intro`:

```ts
    'Because this site runs payments in test/sandbox mode, every refund described below is simulated: nothing was charged, so nothing is returned to a real account.',
```

- [ ] **Bước 6: Tách `resilience` ra module riêng**

Tạo `libs/shared/i18n/src/lib/resilience.ts` — **cắt** nguyên khối
`resilience: { … }` đang nằm trong `messages` (khoảng dòng 503–531 của
`messages.ts`) sang đây:

```ts
// Tầng chống chịu (W2): copy cho loading/error/404 dùng ở web. Để RIÊNG module
// này vì error.tsx/global-error.tsx là client component — import cả
// `messages.ts` (~83KB chuỗi) vào bundle client chỉ để lấy vài câu là phí.
export const resilience = {
  loadError: {
    title: 'We couldn’t load this',
    body: 'Something interrupted the connection. Please try again in a moment.',
    retry: 'Try again',
  },
  error: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred on our end. Please try again — if it keeps happening, get in touch.',
    retry: 'Try again',
    home: 'Back home',
  },
  notFound: {
    title: 'Page not found',
    body: 'The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.',
    home: 'Back home',
    tours: 'Browse tours',
    blog: 'Read the journal',
  },
  globalError: {
    title: 'Something went wrong',
    body: 'The page failed to load. Please reload to try again.',
    retry: 'Reload',
  },
  checkoutError: {
    title: 'We’re confirming your payment',
    body: 'Your payment is safe. We hit a snag loading this page, but your booking isn’t lost — try again, or check your trips in a moment.',
    retry: 'Try again',
    account: 'View my trips',
  },
};
```

Trong `messages.ts`, thêm import ở đầu file:

```ts
import { resilience } from './resilience.js';
```

và thay khối vừa cắt bằng đúng một dòng (giữ `messages.resilience` chạy như cũ):

```ts
  resilience,
```

Trong `libs/shared/i18n/src/index.ts`, thêm (giữ thứ tự alphabet):

```ts
export * from './lib/resilience.js';
```

- [ ] **Bước 7: Đổi nốt 7 chỗ "Nexora" còn lại trong `messages.ts`**

```bash
grep -n "Nexora" libs/shared/i18n/src/lib/messages.ts
```

Sửa từng chỗ sang `Tourism` (gồm cả comment `%s — Nexora` nói về
`title.template` — viết lại thành `%s — Tourism`).

- [ ] **Bước 8: Build lại i18n rồi chạy test**

```bash
pnpm turbo run build --filter=@tourism/i18n && pnpm --filter @tourism/web exec vitest run src/lib/legal-content.spec.ts
```

Expected: `Tasks: 1 successful` rồi `13 passed`.

- [ ] **Bước 9: Chắc chắn không sót brand cũ trong toàn gói i18n**

```bash
grep -rn "Nexora" libs/shared/i18n/src || echo "SẠCH"
```

Expected: `SẠCH`.

- [ ] **Bước 10: Test + typecheck cả hai gói**

```bash
pnpm turbo run typecheck test --filter=@tourism/i18n --filter=@tourism/web
```

Expected: tất cả xanh.

- [ ] **Bước 11: Format + commit**

```bash
pnpm lint:fix
git add libs/shared/i18n apps/web/src/lib
git commit -m "feat(i18n): dọn nội dung pháp lý cho v2 — brand Tourism, mục test-mode payments, reviewNote, tách resilience"
```

---

## Task 3: Trang MẪU `/terms` (ContentHero + LegalArticle + OnThisPage) — DỪNG CHỜ DUYỆT

**Files:**
- Create: `apps/web/src/components/content/content-hero.tsx`
- Create: `apps/web/src/components/content/on-this-page.tsx`
- Create: `apps/web/src/components/legal/legal-article.tsx`
- Create: `apps/web/src/app/(site)/terms/page.tsx`

**Interfaces:**
- Consumes: `tocFromLegalDoc`, `TocItem` (Task 1); `termsDoc`, `messages` (Task 2); `TopoPattern` (`@/components/topo-pattern`); `Typeset` (`@tourism/ui/components/typeset`).
- Produces: `<ContentHero breadcrumb title meta? subtitle? />` · `<OnThisPage items={TocItem[]} />` · `<LegalArticle doc={LegalDoc} />` — Task 4 và 5 dùng lại nguyên si.

- [ ] **Bước 1: Tạo branch**

```bash
git switch -c feat/legal-utility-pages
```

(Nếu Task 1–2 đã commit trên `main` thì cherry-pick không cần thiết — branch
tạo từ `main` hiện tại đã chứa chúng.)

- [ ] **Bước 2: Viết `ContentHero`**

Tạo `apps/web/src/components/content/content-hero.tsx`:

```tsx
'use client';

import { ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { TopoPattern } from '@/components/topo-pattern';

// Header dùng chung cho trang nội dung dài (terms/privacy/cancellation/faq).
// Band NGẮN và TỐI: khác Nexora ContentHero (ảnh full-bleed) — theo mẫu
// Vercel/Linear, trang pháp lý mở bằng typography chứ không bằng ảnh. Vẫn phải
// scope `dark` vì navbar chưa cuộn dùng chữ on-media; hero sáng làm navbar
// tàng hình (pattern "hero luôn tối" chốt ở /contact).
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function ContentHero({
  breadcrumb,
  title,
  meta,
  subtitle,
}: {
  breadcrumb: string;
  title: string;
  /** Dòng "Last updated: …" — trang FAQ không có. */
  meta?: string;
  subtitle?: string;
}) {
  return (
    <section className="dark relative w-full overflow-hidden bg-background px-4 pt-36 pb-14 text-foreground md:px-16 md:pb-16 lg:px-24 xl:px-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
      {/* Gia vị topo — đúng 1 vị trí trên trang này */}
      <TopoPattern className="bg-primary opacity-[0.10]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <motion.nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, ...SPRING }}
        >
          <a href="/" className="transition-colors hover:text-foreground">
            Home
          </a>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            {breadcrumb}
          </span>
        </motion.nav>

        <motion.h1
          className="mt-6 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          {title}
        </motion.h1>

        {meta ? (
          <motion.p
            className="mt-5 font-mono text-xs tracking-widest text-muted-foreground uppercase"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, ...SPRING }}
          >
            {meta}
          </motion.p>
        ) : null}

        {subtitle ? (
          <motion.p
            className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, ...SPRING }}
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Bước 3: Viết `OnThisPage`**

Tạo `apps/web/src/components/content/on-this-page.tsx`:

```tsx
'use client';

import { cn } from '@tourism/ui/lib/utils';
import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/toc';

// Mục lục sticky cho trang nội dung dài — đặt bên PHẢI theo mẫu Vercel
// (Nexora để bên trái). Scroll-spy bằng IntersectionObserver: rootMargin cắt
// 96px trên (chiều cao navbar pill) và 70% dưới nên mục "đang đọc" là mục gần
// đỉnh màn nhất, không phải mục vừa lấp ló đáy.
export function OnThisPage({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | undefined>(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-4 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        On this page
      </p>
      <ul className="space-y-0.5 border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                '-ml-px flex gap-2.5 border-l-2 py-1.5 pl-4 text-pretty transition-colors',
                active === item.id
                  ? 'border-primary font-medium text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="font-mono text-xs tabular-nums opacity-60">{item.index}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Bước 4: Viết `LegalArticle`**

Tạo `apps/web/src/components/legal/legal-article.tsx`:

```tsx
import type { LegalDoc } from '@tourism/i18n';
import { Typeset } from '@tourism/ui/components/typeset';
import { TriangleAlertIcon } from 'lucide-react';
import { ContentHero } from '@/components/content/content-hero';
import { OnThisPage } from '@/components/content/on-this-page';
import { slugify } from '@/lib/slug';
import { tocFromLegalDoc } from '@/lib/toc';

// Khung chung cho 3 trang pháp lý dài. Kỷ luật lấy từ mẫu Vercel/Linear:
// một cột đo hẹp (~68ch), số section bằng font mono, hairline chia đoạn —
// thay vòng tròn primary của Nexora. Thân chữ chạy bọc <Typeset preset="reading">
// (ADR-0012) để cỡ chữ/leading/nhịp dọc do hệ typography lo, không chế tay.
export function LegalArticle({ doc }: { doc: LegalDoc }) {
  const toc = tocFromLegalDoc(doc);

  return (
    <>
      <ContentHero breadcrumb={doc.breadcrumb} title={doc.title} meta={doc.updated} />

      <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
          <div className="min-w-0 max-w-[68ch]">
            {doc.reviewNote ? (
              <div className="mb-12 flex gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-5 text-sm">
                <TriangleAlertIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <p className="leading-relaxed text-pretty text-foreground/80">{doc.reviewNote}</p>
              </div>
            ) : null}

            <Typeset preset="reading" className="text-muted-foreground">
              {doc.intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Typeset>

            <div className="mt-12 divide-y divide-border border-t border-border">
              {doc.sections.map((section, i) => (
                <section
                  key={section.heading}
                  id={slugify(section.heading)}
                  className="scroll-mt-28 py-10"
                >
                  <div className="mb-4 flex items-baseline gap-4">
                    <span className="font-mono text-xs tabular-nums text-primary">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h2 className="font-heading text-2xl leading-snug font-medium text-balance text-foreground">
                      {section.heading}
                    </h2>
                  </div>

                  <Typeset preset="reading" className="text-muted-foreground">
                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {section.bullets ? (
                      <ul>
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                  </Typeset>
                </section>
              ))}
            </div>
          </div>

          <aside className="mt-14 lg:mt-0">
            <div className="lg:sticky lg:top-28">
              <OnThisPage items={toc} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Bước 5: Viết trang `/terms`**

Tạo `apps/web/src/app/(site)/terms/page.tsx`:

```tsx
import { messages, termsDoc } from '@tourism/i18n';
import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/legal-article';

// Trang pháp lý MẪU của cụm — layout chốt ở đây rồi mới nhân sang
// /privacy và /cancellation-policy. Nội dung là LegalDoc trong @tourism/i18n.
export const metadata: Metadata = {
  title: `${messages.pageMeta.terms.title} — Tourism`,
  description: messages.pageMeta.terms.description,
};

export default function TermsPage() {
  return <LegalArticle doc={termsDoc} />;
}
```

- [ ] **Bước 6: Typecheck + lint (KHÔNG build web)**

```bash
pnpm turbo run typecheck --filter=@tourism/web && pnpm exec biome check apps/web/src libs/shared/i18n/src
```

Expected: typecheck xanh, Biome `Checked … No fixes applied`.

- [ ] **Bước 7: Tự screenshot kiểm bằng playwright-core**

Dev server của user đang chạy ở `http://localhost:3000`. Chụp 3 ảnh (đầu
trang · giữa trang để thấy TOC sticky bám · mobile):

```bash
node /tmp/claude-1000/-home-yuriv-projects-tourism-v2/58e419fc-6a47-45c7-a68d-ce87649797f4/scratchpad/shot.mjs "http://localhost:3000/terms" /tmp/claude-1000/-home-yuriv-projects-tourism-v2/58e419fc-6a47-45c7-a68d-ce87649797f4/scratchpad/terms-top.png 1440 1200
```

Rồi lặp lại với `scrollY` = 1800 (đối số thứ 6) cho ảnh giữa trang, và
`390 844` cho ảnh mobile. Đọc từng ảnh và tự soát:
navbar có đọc được trên band tối không · TOC có nằm bên phải và bám sticky
không · đo cột chữ có ~68ch không · mobile TOC có rơi xuống dưới không.

- [ ] **Bước 8: Commit**

```bash
pnpm lint:fix
git add apps/web/src/components/content apps/web/src/components/legal "apps/web/src/app/(site)/terms"
git commit -m "feat(web): trang /terms mẫu — ContentHero band tối mỏng + LegalArticle Typeset + OnThisPage sticky phải"
```

- [ ] **Bước 9: DỪNG — trình user duyệt layout**

Gửi screenshot + tóm tắt quyết định thị giác. **Không làm Task 4 trở đi cho
tới khi user duyệt.** Nếu user yêu cầu chỉnh, sửa trong Task 3 rồi trình lại.

---

## Task 4: Nhân ra `/privacy` và `/cancellation-policy`

**Files:**
- Create: `apps/web/src/app/(site)/privacy/page.tsx`
- Create: `apps/web/src/app/(site)/cancellation-policy/page.tsx`

**Interfaces:**
- Consumes: `LegalArticle` (Task 3), `privacyDoc`/`cancellationDoc`/`messages` (Task 2).
- Produces: hai route hoạt động — link chờ ở `/register` hết 404.

- [ ] **Bước 1: Trang `/privacy`**

Tạo `apps/web/src/app/(site)/privacy/page.tsx`:

```tsx
import { messages, privacyDoc } from '@tourism/i18n';
import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/legal-article';

// Cùng khung với /terms — chỉ đổi LegalDoc.
export const metadata: Metadata = {
  title: `${messages.pageMeta.privacy.title} — Tourism`,
  description: messages.pageMeta.privacy.description,
};

export default function PrivacyPage() {
  return <LegalArticle doc={privacyDoc} />;
}
```

- [ ] **Bước 2: Trang `/cancellation-policy`**

Tạo `apps/web/src/app/(site)/cancellation-policy/page.tsx`:

```tsx
import { cancellationDoc, messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/legal-article';

// Cùng khung với /terms — chỉ đổi LegalDoc.
export const metadata: Metadata = {
  title: `${messages.pageMeta.cancellation.title} — Tourism`,
  description: messages.pageMeta.cancellation.description,
};

export default function CancellationPolicyPage() {
  return <LegalArticle doc={cancellationDoc} />;
}
```

- [ ] **Bước 3: Typecheck + screenshot 2 trang**

```bash
pnpm turbo run typecheck --filter=@tourism/web
```

Chụp `http://localhost:3000/privacy` và
`http://localhost:3000/cancellation-policy` bằng `shot.mjs` như Task 3 bước 7,
đọc ảnh, xác nhận TOC sinh đúng số mục của từng doc.

- [ ] **Bước 4: Commit**

```bash
pnpm lint:fix
git add "apps/web/src/app/(site)/privacy" "apps/web/src/app/(site)/cancellation-policy"
git commit -m "feat(web): trang /privacy và /cancellation-policy dùng chung LegalArticle"
```

---

## Task 5: Trang `/faq` (filter thuần TDD + FaqExplorer + JSON-LD)

**Files:**
- Create: `apps/web/src/lib/faq-filter.ts`, `apps/web/src/lib/faq-filter.spec.ts`
- Create: `apps/web/src/components/faq/faq-explorer.tsx`
- Create: `apps/web/src/app/(site)/faq/page.tsx`

**Interfaces:**
- Consumes: `ContentHero`, `OnThisPage` (Task 3); `slugify`, `TocItem` (Task 1); `messages.faqPage` (Task 2); `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` từ `@tourism/ui/components/accordion`; `Input` từ `@tourism/ui/components/input`.
- Produces: `type FaqItem = { question: string; answer: string }` · `type FaqCategory = { title: string; items: readonly FaqItem[] }` · `filterFaqCategories(categories: readonly FaqCategory[], query: string): FaqCategory[]` · `<FaqExplorer categories={FaqCategory[]} />`.

- [ ] **Bước 1: Viết test cho bộ lọc FAQ**

Tạo `apps/web/src/lib/faq-filter.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterFaqCategories } from './faq-filter.js';

const CATEGORIES = [
  {
    title: 'Booking & payment',
    items: [
      { question: 'How do I book a tour?', answer: 'Browse our tours and send an enquiry.' },
      { question: 'Do I pay a deposit?', answer: 'Most tours are held with a deposit.' },
    ],
  },
  {
    title: 'Guides & on-trip',
    items: [{ question: 'Do guides speak English?', answer: 'Every guide leads in English.' }],
  },
];

describe('filterFaqCategories', () => {
  it('query rỗng trả nguyên danh sách', () => {
    expect(filterFaqCategories(CATEGORIES, '   ')).toEqual(CATEGORIES);
  });

  it('lọc theo câu hỏi, không phân biệt hoa thường', () => {
    const result = filterFaqCategories(CATEGORIES, 'DEPOSIT');
    expect(result).toHaveLength(1);
    expect(result[0]?.items).toHaveLength(1);
    expect(result[0]?.items[0]?.question).toBe('Do I pay a deposit?');
  });

  it('lọc được cả theo nội dung câu trả lời', () => {
    const result = filterFaqCategories(CATEGORIES, 'enquiry');
    expect(result[0]?.items[0]?.question).toBe('How do I book a tour?');
  });

  it('bỏ hẳn nhóm không còn câu nào khớp', () => {
    const result = filterFaqCategories(CATEGORIES, 'english');
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Guides & on-trip');
  });

  it('không khớp gì thì trả mảng rỗng', () => {
    expect(filterFaqCategories(CATEGORIES, 'submarine')).toEqual([]);
  });
});
```

- [ ] **Bước 2: Chạy test — FAIL**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/faq-filter.spec.ts
```

Expected: FAIL — `Failed to resolve import "./faq-filter.js"`.

- [ ] **Bước 3: Viết bộ lọc**

Tạo `apps/web/src/lib/faq-filter.ts`:

```ts
export type FaqItem = { question: string; answer: string };
export type FaqCategory = { title: string; items: readonly FaqItem[] };

/**
 * Lọc catalogue FAQ theo từ khoá — khớp cả câu hỏi lẫn câu trả lời, bỏ nhóm
 * rỗng. Tách khỏi component để test được mà không cần dựng DOM.
 */
export function filterFaqCategories(
  categories: readonly FaqCategory[],
  query: string,
): FaqCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories.map((category) => ({ ...category }));

  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        `${item.question} ${item.answer}`.toLowerCase().includes(q),
      ),
    }))
    .filter((category) => category.items.length > 0);
}
```

- [ ] **Bước 4: Chạy lại test — PASS**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/faq-filter.spec.ts
```

Expected: `5 passed`.

- [ ] **Bước 5: Viết `FaqExplorer`**

Tạo `apps/web/src/components/faq/faq-explorer.tsx`:

```tsx
'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@tourism/ui/components/accordion';
import { Input } from '@tourism/ui/components/input';
import {
  CompassIcon,
  CreditCardIcon,
  type LucideIcon,
  PlaneIcon,
  RefreshCwIcon,
  RouteIcon,
  SearchIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { type FaqCategory, filterFaqCategories } from '@/lib/faq-filter';
import { slugify } from '@/lib/slug';

// Ruột trang /faq: ô search + 5 nhóm + accordion card rời — kế thừa nguyên
// style đã chốt ở contact-faq (bo 2xl, item mở đổi nền muted), thêm icon cho
// từng nhóm. Dữ liệu nhận qua props từ server page: import thẳng `messages`
// vào client component sẽ kéo cả catalogue ~83KB vào bundle.
const CATEGORY_ICONS: readonly LucideIcon[] = [
  CreditCardIcon,
  RouteIcon,
  CompassIcon,
  RefreshCwIcon,
  PlaneIcon,
];

const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function FaqExplorer({
  categories,
  searchPlaceholder,
  searchLabel,
  noResults,
}: {
  categories: FaqCategory[];
  searchPlaceholder: string;
  searchLabel: string;
  noResults: string;
}) {
  const [query, setQuery] = useState('');
  const groups = filterFaqCategories(categories, query);

  return (
    <div>
      <div className="relative mb-12">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="h-12 rounded-full bg-background pr-4 pl-11 text-sm"
        />
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-pretty text-muted-foreground">{noResults}</p>
      ) : (
        <div className="space-y-14">
          {groups.map((group, groupIndex) => {
            const Icon = CATEGORY_ICONS[groupIndex] ?? CompassIcon;
            return (
              <section key={group.title} id={slugify(group.title)} className="scroll-mt-28">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-heading text-xl font-medium text-foreground">
                    {group.title}
                  </h2>
                </div>

                <Accordion className="flex w-full flex-col gap-4">
                  {group.items.map((item, index) => (
                    <motion.div
                      key={item.question}
                      initial={{ y: 30, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ ...SPRING, delay: index * 0.06 }}
                    >
                      <AccordionItem
                        value={item.question}
                        className="rounded-2xl border px-6 transition-colors data-open:bg-muted/50"
                      >
                        <AccordionTrigger className="cursor-pointer py-5 text-left font-heading text-base font-medium hover:no-underline md:text-lg">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    </motion.div>
                  ))}
                </Accordion>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Bước 6: Viết trang `/faq`**

Tạo `apps/web/src/app/(site)/faq/page.tsx`:

```tsx
import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { ContentHero } from '@/components/content/content-hero';
import { OnThisPage } from '@/components/content/on-this-page';
import { FaqExplorer } from '@/components/faq/faq-explorer';
import { slugify } from '@/lib/slug';
import type { TocItem } from '@/lib/toc';

export const metadata: Metadata = {
  title: `${messages.pageMeta.faq.title} — Tourism`,
  description: messages.pageMeta.faq.description,
};

// JSON-LD FAQPage cho rich result. Dựng từ catalogue TĨNH của mình (không có
// input người dùng); escape `<` sau JSON.stringify để một giá trị bất kỳ
// không thể thoát ra khỏi thẻ <script> — pattern an toàn port từ Nexora.
function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: messages.faqPage.categories.flatMap((category) =>
      category.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    ),
  };
}

export default function FaqPage() {
  const t = messages.faqPage;
  const toc: TocItem[] = t.categories.map((category, i) => ({
    id: slugify(category.title),
    label: category.title,
    index: String(i + 1).padStart(2, '0'),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd()).replace(/</g, '\\u003c'),
        }}
      />

      <ContentHero breadcrumb={t.breadcrumbCurrent} title={t.title} subtitle={t.subtitle} />

      <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
          <div className="min-w-0 max-w-3xl">
            <FaqExplorer
              categories={t.categories.map((c) => ({ title: c.title, items: c.items }))}
              searchPlaceholder={t.searchPlaceholder}
              searchLabel={t.searchLabel}
              noResults={t.noResults}
            />
          </div>

          <aside className="mt-14 lg:mt-0">
            <div className="lg:sticky lg:top-28">
              <OnThisPage items={toc} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Bước 7: Typecheck + test + screenshot**

```bash
pnpm turbo run typecheck test --filter=@tourism/web
```

Expected: xanh. Nếu Biome không có rule `noDangerouslySetInnerHtml` thì bỏ
dòng `biome-ignore` (Biome sẽ báo "unused suppression comment").

Chụp `http://localhost:3000/faq` (1440 và 390 rộng), đọc ảnh: search có bo
tròn không · icon nhóm có đúng 5 không · TOC bên phải có nhảy active khi cuộn.

- [ ] **Bước 8: Commit**

```bash
pnpm lint:fix
git add apps/web/src/lib/faq-filter.ts apps/web/src/lib/faq-filter.spec.ts apps/web/src/components/faq "apps/web/src/app/(site)/faq"
git commit -m "feat(web): trang /faq — search lọc thuần có test, 5 nhóm accordion, JSON-LD FAQPage"
```

---

## Task 6: Bộ 3 route boundary + `SiteChrome`

**Files:**
- Create: `apps/web/src/components/site-chrome.tsx`
- Create: `apps/web/src/components/feedback/error-state.tsx`
- Create: `apps/web/src/app/not-found.tsx`, `apps/web/src/app/error.tsx`, `apps/web/src/app/global-error.tsx`
- Modify: `apps/web/src/app/(site)/layout.tsx`

**Interfaces:**
- Consumes: `resilience` (Task 2); `TopBar`/`SiteHeader`/`SiteFooter`/`ScrollToTop`; `TopoPattern`.
- Produces: `<SiteChrome>{children}</SiteChrome>` · `<ErrorState title body>{actions}</ErrorState>`.

**Ghi chú nút bấm (đã kiểm code thật):** `Button` của `@tourism/ui` là Base UI —
prop là `render`, **không có `asChild`**; và web hiện dựng CTA bằng thẻ `<a>`/
`<Link>` pill bo tròn tự style (`home/call-to-action.tsx`, `contact/contact-cta.tsx`),
`Button` chỉ dùng cho nút nhỏ trong `tour-card`. Nên 3 trang boundary dùng
đúng idiom pill của site, khai báo một lần ở đầu mỗi file:

```tsx
const PILL_PRIMARY =
  'inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80';
const PILL_OUTLINE =
  'inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted';
```

- [ ] **Bước 1: Tách `SiteChrome`**

Tạo `apps/web/src/components/site-chrome.tsx`:

```tsx
import { ScrollToTop } from '@/components/scroll-to-top';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TopBar } from '@/components/top-bar';

// Chrome chung của site. Tách khỏi (site)/layout.tsx vì app/not-found.tsx —
// trang bắt URL không khớp — chỉ render trong ROOT layout, không đi qua layout
// của route group, nên nếu không dùng lại khối này thì 404 sẽ trần trụi
// không navbar/footer. error.tsx và global-error.tsx CỐ Ý không dùng: chúng
// phải sống được cả khi cây trang đã hỏng.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ScrollToTop />
    </>
  );
}
```

Sửa `apps/web/src/app/(site)/layout.tsx` thành:

```tsx
import { SiteChrome } from '@/components/site-chrome';

// Shell chung cho các trang "site" (Home/About/Contact/pháp lý...) — nội dung
// chrome nằm trong SiteChrome để app/not-found.tsx dùng lại được.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
```

- [ ] **Bước 2: Kiểm trang cũ không vỡ**

```bash
pnpm turbo run typecheck --filter=@tourism/web
```

Chụp lại `http://localhost:3000/` và `http://localhost:3000/contact`, xác nhận
navbar/footer/scroll-to-top vẫn y như trước khi tách.

- [ ] **Bước 3: Viết `ErrorState`**

Tạo `apps/web/src/components/feedback/error-state.tsx`:

```tsx
import { AlertCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Panel lỗi tối giản cho route boundary (error / global-error). Thuần trình
// bày, KHÔNG hook — để dùng được trong cả server và client boundary. Cố ý
// không ảnh, không chrome: nó phải render được khi phần còn lại đã hỏng.
export function ErrorState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertCircleIcon className="size-8" aria-hidden="true" />
      </span>
      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="text-pretty text-muted-foreground">{body}</p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Bước 4: Viết `not-found.tsx` (có ảnh thật + chrome)**

Tạo `apps/web/src/app/not-found.tsx`:

```tsx
import { resilience } from '@tourism/i18n';
import Image from 'next/image';
import Link from 'next/link';
import { SiteChrome } from '@/components/site-chrome';
import { TopoPattern } from '@/components/topo-pattern';

// 404 là trang utility khách THẬT SỰ nhìn thấy nên làm hẳn màn ảnh (mẫu
// Intrepid): ảnh phong cảnh thật + scrim + câu ấm + đường thoát. Ảnh lấy từ
// bộ mock đã có credit trong public/mock/CREDITS.md.
const PILL_PRIMARY =
  'inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80';
const PILL_OUTLINE =
  'inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted';

export default function NotFound() {
  const t = resilience.notFound;

  return (
    <SiteChrome>
      <section className="dark relative flex min-h-[80vh] w-full items-center overflow-hidden px-4 py-32 text-foreground md:px-16 lg:px-24 xl:px-32">
        <Image
          src="/mock/halong.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/85 to-background/60"
        />
        <TopoPattern className="bg-primary opacity-[0.10]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <p className="font-mono text-xs tracking-widest text-primary uppercase">Error 404</p>
          <h1 className="mt-5 max-w-2xl font-heading text-4xl leading-tight font-medium text-balance md:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-md text-pretty text-muted-foreground">{t.body}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={PILL_PRIMARY}>
              {t.home}
            </Link>
            <Link href="/#tours" className={PILL_OUTLINE}>
              {t.tours}
            </Link>
            <Link href="/#journal" className={PILL_OUTLINE}>
              {t.blog}
            </Link>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
```

- [ ] **Bước 5: Viết `error.tsx` và `global-error.tsx`**

Tạo `apps/web/src/app/error.tsx`:

```tsx
'use client';

import { resilience } from '@tourism/i18n';
import Link from 'next/link';
import { ErrorState } from '@/components/feedback/error-state';

// Boundary lỗi runtime. Cố ý KHÔNG bọc SiteChrome: lỗi có thể phát từ chính
// chrome, bọc lại là mời lỗi tái diễn ngay trong màn báo lỗi.
const PILL_PRIMARY =
  'inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80';
const PILL_OUTLINE =
  'inline-flex items-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = resilience.error;

  return (
    <ErrorState title={t.title} body={t.body}>
      <button type="button" onClick={reset} className={PILL_PRIMARY}>
        {t.retry}
      </button>
      <Link href="/" className={PILL_OUTLINE}>
        {t.home}
      </Link>
    </ErrorState>
  );
}
```

Tạo `apps/web/src/app/global-error.tsx`:

```tsx
'use client';

import { resilience } from '@tourism/i18n';
import { ErrorState } from '@/components/feedback/error-state';
import './globals.css';

// Boundary cuối: lỗi ở chính root layout. Phải tự dựng <html>/<body> vì root
// layout đã hỏng. Nút Reload dùng thẻ <button> trần, không phụ thuộc gói UI.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = resilience.globalError;

  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorState title={t.title} body={t.body}>
          <button
            type="button"
            onClick={reset}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            {t.retry}
          </button>
        </ErrorState>
      </body>
    </html>
  );
}
```

- [ ] **Bước 6: Typecheck + kiểm 404 bằng ảnh**

```bash
pnpm turbo run typecheck --filter=@tourism/web
```

Chụp `http://localhost:3000/khong-ton-tai` (1440 và 390), xác nhận có
navbar + footer, chữ đọc được trên ảnh, 3 nút hiện đủ.

- [ ] **Bước 7: Commit**

```bash
pnpm lint:fix
git add apps/web/src/components/site-chrome.tsx apps/web/src/components/feedback "apps/web/src/app/(site)/layout.tsx" apps/web/src/app/not-found.tsx apps/web/src/app/error.tsx apps/web/src/app/global-error.tsx
git commit -m "feat(web): bộ 3 route boundary — 404 ảnh thật dùng SiteChrome, error/global-error panel tối giản"
```

---

## Task 7: Nối link chờ + gate đầy đủ

**Files:**
- Modify: `apps/web/src/components/site-footer.tsx` (nhóm `Support` trong `LINK_GROUPS`, ~dòng 34–42)

**Interfaces:**
- Consumes: 4 route của Task 3–5.
- Produces: footer không còn link `#top` giả cho nhóm Support.

- [ ] **Bước 1: Trỏ link Support về route thật**

Trong `apps/web/src/components/site-footer.tsx`, thay nhóm `Support`:

```tsx
  {
    title: 'Support',
    links: [
      ['FAQ', '/faq'],
      ['Booking help', '/faq'],
      ['Cancellation policy', '/cancellation-policy'],
      ['Terms', '/terms'],
      ['Privacy policy', '/privacy'],
    ],
  },
```

- [ ] **Bước 2: Rà không còn link chờ nào của cụm này**

```bash
grep -rn "'/terms'\|'/privacy'\|'/faq'\|'/cancellation-policy'" apps/web/src --include='*.tsx'
```

Expected: thấy link ở `site-footer.tsx`, `register-form.tsx`, `contact-faq.tsx`
— tất cả đều trỏ route đã tồn tại.

- [ ] **Bước 3: Gate ĐẦY ĐỦ (luật #11) — cần cổng web rảnh**

Dừng dev server của user trước (hỏi user), rồi:

```bash
docker start tourism-v2-postgres-1 && pnpm gate:int
```

Expected: build + typecheck + unit test + lint + integration test đều xanh.
Nếu cổng 3000 còn sống thì **không** chạy bước này (bài học Turbopack cache).

- [ ] **Bước 4: Commit + push**

```bash
pnpm lint:fix
git add apps/web/src/components/site-footer.tsx
git commit -m "feat(web): nối link footer Support về 4 trang pháp lý/FAQ vừa dựng"
git push -u origin feat/legal-utility-pages
```

- [ ] **Bước 5: Chờ CI xanh rồi HỎI user mới merge**

```bash
gh run watch
```

Sau khi xanh: **hỏi user**, rồi mới:

```bash
git switch main && git pull --ff-only && git switch feat/legal-utility-pages && git rebase main && git switch main && git merge --ff-only feat/legal-utility-pages && git push && git branch -d feat/legal-utility-pages
```

- [ ] **Bước 6: Docs sweep (luật #13)**

- Thêm 1 entry vào `docs/CHANGELOG.md`: ngày · hash · nội dung · review
  findings · số test.
- Cập nhật `docs/README.md`: thêm spec + plan mới vào 2 bảng, cập nhật dòng
  trạng thái P3b (thêm cụm pháp lý/utility + ghi nợ robots/sitemap).
- Chạy `./scripts/docs-freshness.sh` — phải xanh.

```bash
git add docs && git commit -m "docs: sweep sau merge cụm trang pháp lý/utility" && git push
```

- [ ] **Bước 7: Dọn tiến trình trước khi bàn giao**

```bash
ss -tlnp | grep -E ':(3000|3001)' || echo "CỔNG SẠCH"
```

Kill theo PID mọi server tạm mình mở (KHÔNG `pkill -f "next dev"`), đóng hết
chromium của script screenshot, rồi báo "cổng sạch" trong report.

---

## Tự rà lại kế hoạch

- **Phủ spec**: 4 trang (Task 3–5) · 3 boundary (Task 6) · nội dung i18n +
  test-mode + reviewNote (Task 2) · helper + test thuần (Task 1, 5) · nối link
  (Task 7) · gate/push/merge/docs sweep (Task 7). Nợ robots/sitemap + EnquiryCta
  + gắn API FAQ đã ghi trong spec, cố ý không có task.
- **Nhất quán tên**: `slugify` · `tocFromLegalDoc`/`TocItem{id,label,index}` ·
  `filterFaqCategories`/`FaqCategory{title,items}` · `ContentHero{breadcrumb,
  title,meta?,subtitle?}` · `LegalArticle{doc}` · `FaqExplorer{categories,
  searchPlaceholder,searchLabel,noResults}` · `ErrorState{title,body,children?}` ·
  `SiteChrome{children}` — dùng đúng các tên này ở mọi task.
- **Rủi ro đã lường**: `@tourism/i18n` export qua `dist/` nên phải build trước
  khi dev server thấy (Task 1 bước 2); nút bấm dùng pill `<Link>` chứ không
  dùng `Button` vì Base UI không có `asChild` (ghi chú ở Task 6); dòng
  `biome-ignore` có thể thừa (Task 5 bước 7).
