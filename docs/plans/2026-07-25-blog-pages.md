# Kế hoạch — Cụm trang Blog (P3b)

> **Cho agent thực thi:** SUB-SKILL BẮT BUỘC — dùng
> `superpowers:subagent-driven-development` hoặc `superpowers:executing-plans`
> để chạy plan này theo từng task. Các bước dùng checkbox (`- [ ]`).

**Spec**: [2026-07-25-blog-pages-design.md](../specs/2026-07-25-blog-pages-design.md)

**Goal:** Dựng `/blog` (danh sách 9 bài, chip lọc chuyên mục), `/blog/[slug]`
(bài viết đầy đủ + chia sẻ + điều hướng + bài liên quan) và `/blog/rss.xml`.

**Architecture:** Nội dung là mock tĩnh trong `apps/web/src/mocks/journal.ts`,
thân bài dạng `sections[]` giống `LegalDoc` nên dùng lại nguyên bộ xương của
cụm pháp lý (`Typeset preset="reading"` + `OnThisPage` + `ReadingProgress`).
Mọi logic chọn/lọc/sắp xếp nằm trong `lib/blog.ts` thuần, có test; component
chỉ trình bày.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · `@tourism/ui`
(Typeset, Input) · motion/react · Vitest (node env) · Biome.

## Global Constraints

- **Tokens-only, không hex** — màu qua token của `@tourism/tokens`.
- **Copy user-facing tiếng Anh**; **comment code tiếng Việt** (kể cả JSDoc).
- **Biome** là formatter/linter duy nhất.
- Hero của trang trong `(site)` **luôn tối** (`dark` scope) — navbar chưa cuộn
  dùng `text-on-media`.
- `TopoPattern` **tối đa 1 vị trí mỗi trang**.
- Import runtime trong `apps/web/src` viết **KHÔNG đuôi** (`'./slug'`):
  Turbopack không map `.js` → `.ts` dù Vitest map được.
- **Không chạy `next build` cho `@tourism/web`** khi dev server còn sống ở
  cổng 3000.
- Branch: `feat/blog-pages`. Conventional Commits, **không** AI attribution.

---

## Bố cục file

| File | Trách nhiệm |
| --- | --- |
| `apps/web/src/mocks/types.ts` | **Sửa** — `MockJournalPost` thêm `sections`, `updated?` |
| `apps/web/src/mocks/journal.ts` | **Sửa** — 3 → 9 bài, mỗi bài có thân |
| `apps/web/public/mock/{ninhbinh,hanoi-oldquarter}.jpg` + `CREDITS.md` | **Thêm** — 2 ảnh CC còn thiếu |
| `apps/web/src/lib/toc.ts` (+ spec) | **Sửa** — tách `tocFromSections` |
| `apps/web/src/lib/blog.ts` (+ spec) | **Tạo** — sort/filter/adjacent/related/categories |
| `apps/web/src/lib/site.ts` (+ spec) | **Tạo** — `siteUrl()` · `absoluteUrl()` |
| `apps/web/.env.example` | **Tạo** — `NEXT_PUBLIC_SITE_URL` |
| `apps/web/src/components/blog/post-card.tsx` | **Tạo** — card bài viết, biến thể `featured` |
| `apps/web/src/components/blog/category-chips.tsx` | **Tạo** — hàng chip lọc URL-driven |
| `apps/web/src/components/blog/share-row.tsx` | **Tạo** — copy link + X + Facebook |
| `apps/web/src/components/blog/post-nav.tsx` | **Tạo** — bài mới hơn / cũ hơn |
| `apps/web/src/components/blog/post-hero.tsx` | **Tạo** — hero ảnh cover + meta |
| `apps/web/src/app/(site)/blog/page.tsx` | **Tạo** — danh sách |
| `apps/web/src/app/(site)/blog/[slug]/page.tsx` | **Tạo** — chi tiết |
| `apps/web/src/app/blog/rss.xml/route.ts` | **Tạo** — feed XML |
| `apps/web/src/components/site-header.tsx` · `site-footer.tsx` · `home/journal.tsx` | **Sửa** — nối link `/blog` |

---

## Task 1: Mock 9 bài + 2 ảnh mới

**Files:**
- Modify: `apps/web/src/mocks/types.ts` (`MockJournalPost`, ~dòng 42)
- Modify: `apps/web/src/mocks/journal.ts`
- Modify: `apps/web/src/mocks/mocks.spec.ts`
- Create: `apps/web/public/mock/ninhbinh.jpg`, `apps/web/public/mock/hanoi-oldquarter.jpg`
- Modify: `apps/web/public/mock/CREDITS.md`

**Interfaces:**
- Produces: `JOURNAL_POSTS: MockJournalPost[]` gồm 9 phần tử; `MockJournalPost`
  thêm `sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[]`
  và `updated?: string`.

- [ ] **Bước 1: Tạo branch**

```bash
git switch -c feat/blog-pages
```

- [ ] **Bước 2: Tải 2 ảnh CC còn thiếu**

Dùng `Special:FilePath` của Wikimedia (tự chuyển hướng tới file thật):

```bash
curl -sL "https://commons.wikimedia.org/wiki/Special:FilePath/Tam%20Coc,%20Ninh%20Binh,%20Vietnam.jpg?width=1600" -o apps/web/public/mock/ninhbinh.jpg
curl -sL "https://commons.wikimedia.org/wiki/Special:FilePath/Hanoi%20Old%20Quarter%20street.jpg?width=1600" -o apps/web/public/mock/hanoi-oldquarter.jpg
file apps/web/public/mock/ninhbinh.jpg apps/web/public/mock/hanoi-oldquarter.jpg
```

Expected: cả hai báo `JPEG image data`, chiều rộng ≥ 1200px. Nếu file nào
không phải JPEG (tên file trên Commons đã đổi), mở
`https://commons.wikimedia.org/wiki/Category:Ninh_B%C3%ACnh_Province` hoặc
`Category:Old_Quarter,_Hanoi`, chọn ảnh khác có giấy phép CC/CC0, rồi tải lại
bằng đúng dạng URL trên và ghi đúng tên file + tác giả + license vào CREDITS.

- [ ] **Bước 3: Ghi công vào CREDITS.md**

Thêm vào cuối danh sách trong `apps/web/public/mock/CREDITS.md` hai dòng đúng
định dạng đang có (tên file · tên file gốc trên Commons · tác giả · license ·
nguồn), lấy đúng thông tin từ trang Commons của ảnh vừa tải.

- [ ] **Bước 4: Mở rộng kiểu `MockJournalPost`**

Trong `apps/web/src/mocks/types.ts`, thêm vào interface `MockJournalPost`:

```ts
  /** Ngày cập nhật gần nhất — chỉ có ở bài đã sửa lại sau khi đăng */
  updated?: string;
  /** Thân bài: cùng hình dạng với LegalDoc.sections nên dùng chung được
      tocFromSections + Typeset của cụm trang pháp lý */
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
```

- [ ] **Bước 5: Viết 9 bài trong `journal.ts`**

Giữ nguyên 3 bài cũ (thêm `sections`), viết mới 6 bài theo bảng sau. Mỗi bài:
**3–5 section**, mỗi section 1–3 đoạn, ít nhất 2 bài có `bullets`. Giọng văn:
guide bản địa kể chuyện, câu ngắn, cụ thể (tên món, tên bến, giờ giấc) — không
sáo ngữ marketing. Tiếng Anh (luật #7).

| slug | title | category | author | image | readMinutes |
| --- | --- | --- | --- | --- | --- |
| `what-to-pack-for-the-mist-season` | *(giữ)* | Packing | Mai — Sa Pa guide | `/mock/journal-mist.jpg` | 6 |
| `eating-your-way-through-hoi-an` | *(giữ)* | Food | Linh — Hội An guide | `/mock/hoian.jpg` | 8 |
| `floating-markets-before-sunrise` | *(giữ)* | Markets | Tâm — Cần Thơ guide | `/mock/mekong.jpg` | 5 |
| `reading-a-hue-royal-tomb` | Reading a Huế royal tomb | Culture | Quang — Huế guide | `/mock/hue.jpg` | 7 |
| `two-days-among-the-karsts` | Two days among the karsts | Nature | Hà — Ninh Bình guide | `/mock/ninhbinh.jpg` | 6 |
| `crossing-hanoi-on-foot` | Crossing Hanoi on foot | Practical | Dũng — Hà Nội guide | `/mock/hanoi-oldquarter.jpg` | 5 |
| `the-bay-without-the-crowds` | The bay without the crowds | Nature | Hải — Hạ Long guide | `/mock/halong.jpg` | 7 |
| `bridges-beaches-and-bun-cha-ca` | Bridges, beaches and bún chả cá | Food | Trang — Đà Nẵng guide | `/mock/danang.jpg` | 6 |
| `when-to-come-and-when-not-to` | When to come, and when not to | Practical | Mai — Sa Pa guide | `/mock/sapa.jpg` | 9 |

`date`: rải từ `2026-05-12` đến `2026-10-02`, **không trùng ngày** (bài mới
nhất giữ nguyên `2026-10-02`). Đặt `updated` cho đúng 2 bài.

- [ ] **Bước 6: Bổ sung test bất biến cho mock**

Thêm vào `apps/web/src/mocks/mocks.spec.ts`:

```ts
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
});
```

Thêm import `slugify` từ `../lib/slug.js` vào đầu file spec.

- [ ] **Bước 7: Chạy test**

```bash
pnpm --filter @tourism/web exec vitest run src/mocks/mocks.spec.ts
```

Expected: toàn bộ pass.

- [ ] **Bước 8: Commit**

```bash
pnpm lint:fix
git add apps/web/src/mocks apps/web/public/mock
git commit -m "feat(web): mock journal 9 bài có thân bài + 2 ảnh CC mới"
```

---

## Task 2: Helper thuần `lib/blog.ts` + tách `tocFromSections`

**Files:**
- Modify: `apps/web/src/lib/toc.ts`, `apps/web/src/lib/toc.spec.ts`
- Create: `apps/web/src/lib/blog.ts`, `apps/web/src/lib/blog.spec.ts`

**Interfaces:**
- Consumes: `JOURNAL_POSTS`, `MockJournalPost` (Task 1); `slugify`, `TocItem`.
- Produces:
  - `tocFromSections(sections: { heading: string }[]): TocItem[]`
  - `sortPostsByDate(posts): MockJournalPost[]`
  - `filterPostsByCategory(posts, category?): MockJournalPost[]`
  - `postCategories(posts): string[]`
  - `adjacentPosts(posts, slug): { newer?: MockJournalPost; older?: MockJournalPost }`
  - `relatedPosts(posts, slug, limit): MockJournalPost[]`

- [ ] **Bước 1: Tách `tocFromSections` (test trước)**

Thêm vào `apps/web/src/lib/toc.spec.ts`:

```ts
describe('tocFromSections', () => {
  it('dựng mục lục từ mảng section bất kỳ, không cần cả LegalDoc', () => {
    expect(tocFromSections([{ heading: 'Getting there' }, { heading: 'What to eat' }])).toEqual([
      { id: 'getting-there', label: 'Getting there', index: '01' },
      { id: 'what-to-eat', label: 'What to eat', index: '02' },
    ]);
  });

  it('mảng rỗng trả mảng rỗng', () => {
    expect(tocFromSections([])).toEqual([]);
  });
});
```

Sửa import đầu file spec thành:

```ts
import { tocFromLegalDoc, tocFromSections } from './toc.js';
```

- [ ] **Bước 2: Chạy test — FAIL**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/toc.spec.ts
```

Expected: FAIL — `tocFromSections is not a function`.

- [ ] **Bước 3: Refactor `toc.ts`**

Thay phần thân của `apps/web/src/lib/toc.ts` (giữ nguyên import và `TocItem`):

```ts
/** Dựng mục lục từ một mảng section — dùng chung cho LegalDoc và bài blog. */
export function tocFromSections(sections: { heading: string }[]): TocItem[] {
  return sections.map((section, i) => ({
    id: slugify(section.heading),
    label: section.heading,
    index: String(i + 1).padStart(2, '0'),
  }));
}

/** Mục lục của một LegalDoc; id phải khớp id gắn trên thẻ <section>. */
export function tocFromLegalDoc(doc: LegalDoc): TocItem[] {
  return tocFromSections(doc.sections);
}
```

- [ ] **Bước 4: Chạy lại — PASS**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/toc.spec.ts
```

Expected: 5 passed (3 test cũ của `tocFromLegalDoc` vẫn xanh).

- [ ] **Bước 5: Viết test cho `lib/blog.ts`**

Tạo `apps/web/src/lib/blog.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  adjacentPosts,
  filterPostsByCategory,
  postCategories,
  relatedPosts,
  sortPostsByDate,
} from './blog.js';

const post = (slug: string, date: string, category: string) =>
  ({
    slug,
    title: slug,
    excerpt: '',
    date,
    readMinutes: 5,
    image: '/mock/halong.jpg',
    category,
    author: 'Guide',
    sections: [],
  }) as const;

const POSTS = [
  post('a', '2026-01-10', 'Food'),
  post('b', '2026-03-01', 'Nature'),
  post('c', '2026-02-05', 'Food'),
];

describe('sortPostsByDate', () => {
  it('mới nhất lên đầu', () => {
    expect(sortPostsByDate(POSTS).map((p) => p.slug)).toEqual(['b', 'c', 'a']);
  });

  it('không sửa mảng gốc', () => {
    sortPostsByDate(POSTS);
    expect(POSTS.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('filterPostsByCategory', () => {
  it('không truyền chuyên mục thì trả nguyên danh sách', () => {
    expect(filterPostsByCategory(POSTS)).toHaveLength(3);
  });

  it('lọc đúng chuyên mục', () => {
    expect(filterPostsByCategory(POSTS, 'Food').map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('chuyên mục lạ trả mảng rỗng, không ném lỗi', () => {
    expect(filterPostsByCategory(POSTS, 'Submarine')).toEqual([]);
  });
});

describe('postCategories', () => {
  it('trả chuyên mục duy nhất theo thứ tự xuất hiện', () => {
    expect(postCategories(POSTS)).toEqual(['Food', 'Nature']);
  });
});

describe('adjacentPosts', () => {
  it('bài giữa có cả bài mới hơn lẫn cũ hơn', () => {
    const { newer, older } = adjacentPosts(POSTS, 'c');
    expect(newer?.slug).toBe('b');
    expect(older?.slug).toBe('a');
  });

  it('bài mới nhất không có bài mới hơn', () => {
    expect(adjacentPosts(POSTS, 'b').newer).toBeUndefined();
  });

  it('bài cũ nhất không có bài cũ hơn', () => {
    expect(adjacentPosts(POSTS, 'a').older).toBeUndefined();
  });

  it('slug lạ trả hai đầu rỗng', () => {
    expect(adjacentPosts(POSTS, 'zzz')).toEqual({ newer: undefined, older: undefined });
  });
});

describe('relatedPosts', () => {
  it('ưu tiên bài cùng chuyên mục và không bao giờ chứa chính nó', () => {
    const result = relatedPosts(POSTS, 'a', 2);
    expect(result.map((p) => p.slug)).not.toContain('a');
    expect(result[0]?.slug).toBe('c');
  });

  it('thiếu bài cùng chuyên mục thì bù bằng bài mới nhất', () => {
    const result = relatedPosts(POSTS, 'b', 2);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.slug)).not.toContain('b');
  });

  it('không trả quá limit', () => {
    expect(relatedPosts(POSTS, 'a', 1)).toHaveLength(1);
  });
});
```

- [ ] **Bước 6: Chạy test — FAIL**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/blog.spec.ts
```

Expected: FAIL — `Failed to resolve import "./blog.js"`.

- [ ] **Bước 7: Viết `lib/blog.ts`**

```ts
import type { MockJournalPost } from '@/mocks/types';

/** Sắp xếp mới-nhất-trước. Trả mảng MỚI — mock là hằng số dùng chung, sửa tại
    chỗ là làm hỏng dữ liệu của mọi trang khác. */
export function sortPostsByDate(posts: readonly MockJournalPost[]): MockJournalPost[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

/** Lọc theo chuyên mục; không truyền thì trả nguyên danh sách. */
export function filterPostsByCategory(
  posts: readonly MockJournalPost[],
  category?: string,
): MockJournalPost[] {
  if (!category) return [...posts];
  return posts.filter((post) => post.category === category);
}

/** Chuyên mục duy nhất, giữ thứ tự xuất hiện — nguồn cho hàng chip lọc. */
export function postCategories(posts: readonly MockJournalPost[]): string[] {
  return [...new Set(posts.map((post) => post.category))];
}

/** Bài liền kề theo dòng thời gian (mới hơn / cũ hơn) của bài đang đọc. */
export function adjacentPosts(
  posts: readonly MockJournalPost[],
  slug: string,
): { newer?: MockJournalPost; older?: MockJournalPost } {
  const sorted = sortPostsByDate(posts);
  const index = sorted.findIndex((post) => post.slug === slug);
  if (index === -1) return { newer: undefined, older: undefined };
  return { newer: sorted[index - 1], older: sorted[index + 1] };
}

/** Bài gợi ý cuối trang: cùng chuyên mục trước, thiếu thì bù bài mới nhất. */
export function relatedPosts(
  posts: readonly MockJournalPost[],
  slug: string,
  limit: number,
): MockJournalPost[] {
  const sorted = sortPostsByDate(posts).filter((post) => post.slug !== slug);
  const current = posts.find((post) => post.slug === slug);
  const sameCategory = current
    ? sorted.filter((post) => post.category === current.category)
    : [];
  const filler = sorted.filter((post) => !sameCategory.includes(post));
  return [...sameCategory, ...filler].slice(0, limit);
}
```

- [ ] **Bước 8: Chạy lại — PASS**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/
```

Expected: tất cả xanh.

- [ ] **Bước 9: Commit**

```bash
pnpm lint:fix
git add apps/web/src/lib
git commit -m "feat(web): helper blog thuần (sort/filter/adjacent/related) + tách tocFromSections"
```

---

## Task 3: `/blog` — danh sách — DỪNG CHỜ DUYỆT

**Files:**
- Create: `apps/web/src/components/blog/post-card.tsx`
- Create: `apps/web/src/components/blog/category-chips.tsx`
- Create: `apps/web/src/app/(site)/blog/page.tsx`

**Interfaces:**
- Consumes: `JOURNAL_POSTS` (Task 1); `sortPostsByDate`, `filterPostsByCategory`,
  `postCategories` (Task 2); `ContentHero` (`@/components/content/content-hero`);
  `Reveal` (`@/components/motion/reveal`).
- Produces: `<PostCard post={MockJournalPost} featured?={boolean} />` ·
  `<CategoryChips categories={string[]} active?={string} />` — Task 5 dùng lại `PostCard`.

- [ ] **Bước 1: Viết `PostCard`**

Tạo `apps/web/src/components/blog/post-card.tsx`:

```tsx
import { ClockIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { MockJournalPost } from '@/mocks/types';

// Card bài viết dùng chung cho lưới /blog và khối "More from the journal"
// cuối bài. `featured` là bài mới nhất — chiếm 2 cột, ảnh cao hơn (lối lưới
// tạp chí của Nexora). Ảnh mock là ảnh THẬT nên dùng next/image.
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function PostCard({
  post,
  featured = false,
}: {
  post: MockJournalPost;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40 ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <div className={`relative overflow-hidden ${featured ? 'aspect-16/9' : 'aspect-4/3'}`}>
        <Image
          src={post.image}
          alt=""
          fill
          sizes={featured ? '(min-width: 640px) 66vw, 100vw' : '(min-width: 640px) 33vw, 100vw'}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-4 left-4 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
          {post.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {post.readMinutes} min read
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{DATE_FMT.format(new Date(post.date))}</time>
        </div>

        <h3
          className={`font-heading font-medium text-balance text-foreground transition-colors group-hover:text-primary ${
            featured ? 'text-2xl md:text-3xl' : 'text-lg'
          }`}
        >
          {post.title}
        </h3>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
        <p className="mt-auto pt-5 text-xs text-muted-foreground">{post.author}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Bước 2: Viết `CategoryChips`**

Tạo `apps/web/src/components/blog/category-chips.tsx`:

```tsx
import Link from 'next/link';

// Chip lọc chuyên mục dựa hoàn toàn vào URL (?tag=) — server-render nên
// crawl được và chạy cả khi JS chưa tải, khác hẳn lọc bằng state client.
export function CategoryChips({
  categories,
  active,
}: {
  categories: string[];
  active?: string;
}) {
  const chip = (label: string, href: string, isActive: boolean) => (
    <Link
      key={label}
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filter by topic">
      {chip('All', '/blog', !active)}
      {categories.map((category) =>
        chip(category, `/blog?tag=${encodeURIComponent(category)}`, category === active),
      )}
    </div>
  );
}
```

- [ ] **Bước 3: Viết trang `/blog`**

Tạo `apps/web/src/app/(site)/blog/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentHero } from '@/components/content/content-hero';
import { CategoryChips } from '@/components/blog/category-chips';
import { PostCard } from '@/components/blog/post-card';
import { Reveal } from '@/components/motion/reveal';
import { filterPostsByCategory, postCategories, sortPostsByDate } from '@/lib/blog';
import { JOURNAL_POSTS } from '@/mocks/journal';

export const metadata: Metadata = {
  title: 'Journal — Tourism',
  description:
    'Notes from the road, written by the local guides who lead our trips — food, packing, seasons, and the places we keep going back to.',
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const categories = postCategories(JOURNAL_POSTS);
  // Tag lạ chỉ dẫn tới danh sách rỗng, KHÔNG 404: URL do người dùng gõ tay
  // hoặc link cũ thì trả trang trống có lối thoát vẫn tử tế hơn trang lỗi.
  const active = tag && categories.includes(tag) ? tag : undefined;
  const posts = sortPostsByDate(filterPostsByCategory(JOURNAL_POSTS, tag));

  return (
    <>
      <ContentHero
        breadcrumb="Journal"
        title="Notes from the road"
        subtitle="Written by the guides who lead the trips — what to pack, where to eat, and when not to come."
      />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl">
          <CategoryChips categories={categories} active={active} />

          {posts.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-dashed p-12 text-center">
              <h2 className="font-heading text-xl font-medium text-foreground">
                Nothing filed under “{tag}” yet
              </h2>
              <p className="mt-2 text-pretty text-muted-foreground">
                Try another topic — or read everything we have.
              </p>
              <Link
                href="/blog"
                className="mt-5 inline-block text-sm font-medium text-primary hover:underline"
              >
                Clear filter
              </Link>
            </div>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <Reveal
                  key={post.slug}
                  delay={index * 0.05}
                  className={!active && index === 0 ? 'sm:col-span-2' : ''}
                >
                  {/* Bài nổi bật = bài MỚI NHẤT CỦA CẢ BLOG, nên khi đang lọc
                      thì bỏ — "nổi bật" không có nghĩa là đầu mỗi bộ lọc. */}
                  <PostCard post={post} featured={!active && index === 0} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Bước 4: Typecheck + lint**

```bash
pnpm turbo run typecheck --filter=@tourism/web && pnpm exec biome check apps/web/src
```

Expected: cả hai xanh.

- [ ] **Bước 5: Screenshot tự kiểm**

Mở dev server nếu chưa chạy, rồi chụp `/blog` (1440 và 390) và
`/blog?tag=Food`. Đọc ảnh, soát: bài nổi bật có chiếm 2 cột không · chip đang
chọn có nổi bật không · khi lọc thì bài nổi bật phải BIẾN MẤT · ảnh không méo.

- [ ] **Bước 6: Commit**

```bash
pnpm lint:fix
git add apps/web/src/components/blog "apps/web/src/app/(site)/blog"
git commit -m "feat(web): trang /blog — lưới tạp chí 9 bài + chip lọc chuyên mục URL-driven"
```

- [ ] **Bước 7: DỪNG — trình user duyệt layout**

Gửi screenshot. **Không làm Task 4 trở đi cho tới khi user duyệt.**

---

## Task 4: `/blog/[slug]` — thân bài + TOC + JSON-LD

**Files:**
- Create: `apps/web/src/components/blog/post-hero.tsx`
- Create: `apps/web/src/app/(site)/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `JOURNAL_POSTS`; `tocFromSections` (Task 2); `slugify`;
  `ReadingProgress` (`@/components/content/reading-progress`); `OnThisPage`
  (`@/components/content/on-this-page`); `Typeset`
  (`@tourism/ui/components/typeset`); `Reveal`.
- Produces: `<PostHero post={MockJournalPost} />`; route `/blog/[slug]`.

- [ ] **Bước 1: Viết `PostHero`**

Tạo `apps/web/src/components/blog/post-hero.tsx`:

```tsx
import { ChevronRightIcon, ClockIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { MockJournalPost } from '@/mocks/types';

// Hero bài viết: ảnh cover thật + scrim tối. Bọc scope `dark` vì navbar chưa
// cuộn dùng chữ on-media — hero sáng làm navbar tàng hình (pattern chốt ở
// /contact). Khác ContentHero của trang pháp lý ở chỗ có ảnh: bài viết vốn
// bán bằng hình.
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export function PostHero({ post }: { post: MockJournalPost }) {
  return (
    <section className="dark relative w-full overflow-hidden px-4 pt-36 pb-16 text-foreground md:px-16 md:pb-20 lg:px-24 xl:px-32">
      <Image src={post.image} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/90 to-background/60"
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <Link href="/blog" className="transition-colors hover:text-foreground">
            Journal
          </Link>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            {post.category}
          </span>
        </nav>

        <h1 className="mt-6 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance md:text-5xl">
          {post.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="text-foreground">{post.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{DATE_FMT.format(new Date(post.date))}</time>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {post.readMinutes} min read
          </span>
          {post.updated ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Updated {DATE_FMT.format(new Date(post.updated))}</span>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Bước 2: Viết trang chi tiết**

Tạo `apps/web/src/app/(site)/blog/[slug]/page.tsx`:

```tsx
import { Typeset } from '@tourism/ui/components/typeset';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OnThisPage } from '@/components/content/on-this-page';
import { ReadingProgress } from '@/components/content/reading-progress';
import { PostHero } from '@/components/blog/post-hero';
import { Reveal } from '@/components/motion/reveal';
import { slugify } from '@/lib/slug';
import { tocFromSections } from '@/lib/toc';
import { JOURNAL_POSTS } from '@/mocks/journal';

// Sinh sẵn 9 slug lúc build; slug lạ rơi vào notFound() → trang 404 của cụm
// pháp lý đón. Thân bài dùng ĐÚNG khuôn LegalArticle nên /blog/[slug] và
// /terms là anh em cùng bộ xương.
export function generateStaticParams() {
  return JOURNAL_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = JOURNAL_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: 'Post not found — Tourism' };
  return {
    title: `${post.title} — Tourism`,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, images: [post.image] },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = JOURNAL_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const toc = tocFromSections(post.sections);

  // JSON-LD dựng từ mock TĨNH, escape `<` để không thoát khỏi thẻ script —
  // cùng pattern an toàn với trang /faq.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    ...(post.updated ? { dateModified: post.updated } : {}),
    author: { '@type': 'Person', name: post.author },
    image: post.image,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <ReadingProgress />
      <PostHero post={post} />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto flex max-w-7xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
          <div className="min-w-0 max-w-[68ch]">
            <Typeset preset="reading" className="text-muted-foreground">
              <p className="lead">{post.excerpt}</p>
            </Typeset>

            <div className="mt-10 divide-y divide-border border-t border-border">
              {post.sections.map((section, i) => (
                <section
                  key={section.heading}
                  id={slugify(section.heading)}
                  className="scroll-mt-28 py-10"
                >
                  <Reveal>
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
                  </Reveal>
                </section>
              ))}
            </div>
          </div>

          <aside className="order-first mb-12 lg:order-none lg:mb-0">
            <div className="max-h-64 overflow-y-auto lg:sticky lg:top-28 lg:max-h-none lg:overflow-visible">
              <OnThisPage items={toc} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Bước 3: Typecheck + kiểm chạy**

```bash
pnpm turbo run typecheck --filter=@tourism/web
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/blog/what-to-pack-for-the-mist-season
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/blog/khong-co-that
```

Expected: `200` rồi `404`.

- [ ] **Bước 4: Screenshot + commit**

Chụp một bài ở 1440 và 390; soát TOC bên phải, thanh tiến độ, ảnh hero.

```bash
pnpm lint:fix
git add apps/web/src/components/blog "apps/web/src/app/(site)/blog"
git commit -m "feat(web): trang /blog/[slug] — hero ảnh cover, thân bài Typeset + TOC, JSON-LD Article"
```

---

## Task 5: ShareRow + PostNav + "More from the journal"

**Files:**
- Create: `apps/web/src/components/blog/share-row.tsx`
- Create: `apps/web/src/components/blog/post-nav.tsx`
- Modify: `apps/web/src/app/(site)/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `adjacentPosts`, `relatedPosts` (Task 2); `PostCard` (Task 3);
  `absoluteUrl` **chưa có ở task này** — ShareRow tự dựng URL từ
  `window.location.href` phía client, nên KHÔNG phụ thuộc Task 6.
- Produces: `<ShareRow title={string} />` · `<PostNav newer? older? />`.

- [ ] **Bước 1: Viết `ShareRow`**

Tạo `apps/web/src/components/blog/share-row.tsx`:

```tsx
'use client';

import { CheckIcon, LinkIcon } from 'lucide-react';
import { useState } from 'react';

// Hàng chia sẻ. URL lấy từ window.location lúc bấm chứ không nhận qua props:
// component này là client, biết chính xác URL đang đứng, khỏi phải kéo
// NEXT_PUBLIC_SITE_URL vào chỉ để dựng lại đúng chuỗi đó.
export function ShareRow({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = (base: string) =>
    `${base}${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(title)}`;

  return (
    <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-border pt-8">
      <span className="mr-1 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Share
      </span>

      <button
        type="button"
        onClick={copy}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        {copied ? (
          <CheckIcon className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <LinkIcon className="size-4" aria-hidden="true" />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </button>

      <a
        href={share('https://twitter.com/intent/tweet?url=')}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        Share on X
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${
          typeof window === 'undefined' ? '' : encodeURIComponent(window.location.href)
        }`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        Share on Facebook
      </a>
    </div>
  );
}
```

- [ ] **Bước 2: Viết `PostNav`**

Tạo `apps/web/src/components/blog/post-nav.tsx`:

```tsx
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { MockJournalPost } from '@/mocks/types';

// Dải điều hướng cuối bài. Ô trống được giữ chỗ bằng <div /> để bài mới nhất
// và bài cũ nhất vẫn có ô còn lại nằm đúng bên phải/trái của nó.
export function PostNav({
  newer,
  older,
}: {
  newer?: MockJournalPost;
  older?: MockJournalPost;
}) {
  if (!newer && !older) return null;

  return (
    <nav
      aria-label="More articles"
      className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2"
    >
      {newer ? (
        <Link
          href={`/blog/${newer.slug}`}
          className="group rounded-2xl border p-5 transition-colors hover:border-primary/40"
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            Newer
          </span>
          <p className="mt-2 font-heading text-base font-medium text-balance text-foreground transition-colors group-hover:text-primary">
            {newer.title}
          </p>
        </Link>
      ) : (
        <div />
      )}

      {older ? (
        <Link
          href={`/blog/${older.slug}`}
          className="group rounded-2xl border p-5 text-right transition-colors hover:border-primary/40"
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Older
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </span>
          <p className="mt-2 font-heading text-base font-medium text-balance text-foreground transition-colors group-hover:text-primary">
            {older.title}
          </p>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
```

- [ ] **Bước 3: Gắn vào trang chi tiết**

Trong `apps/web/src/app/(site)/blog/[slug]/page.tsx`, thêm import:

```tsx
import { PostCard } from '@/components/blog/post-card';
import { PostNav } from '@/components/blog/post-nav';
import { ShareRow } from '@/components/blog/share-row';
import { adjacentPosts, relatedPosts } from '@/lib/blog';
```

Sau `const toc = ...` thêm:

```tsx
  const { newer, older } = adjacentPosts(JOURNAL_POSTS, slug);
  const more = relatedPosts(JOURNAL_POSTS, slug, 3);
```

Ngay sau thẻ `</div>` đóng khối các section (trước `<aside`), thêm:

```tsx
            <ShareRow title={post.title} />
            <PostNav newer={newer} older={older} />
```

Và sau khối `</div>` bọc grid 2 cột, trước thẻ đóng cuối cùng, thêm:

```tsx
      <section className="w-full px-4 pb-24 md:px-16 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 font-heading text-2xl font-medium text-foreground">
            More from the journal
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((related) => (
              <PostCard key={related.slug} post={related} />
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Bước 4: Kiểm tương tác thật**

Bằng playwright-core: mở một bài, bấm "Copy link" → nút phải đổi thành
"Copied"; bấm ô "Older" → URL đổi sang slug bài cũ hơn; đếm `More from the
journal` phải có đúng 3 card và **không** chứa bài đang đọc.

- [ ] **Bước 5: Commit**

```bash
pnpm lint:fix
git add apps/web/src
git commit -m "feat(web): ShareRow + PostNav + khối bài liên quan cuối bài viết"
```

---

## Task 6: `lib/site.ts` + `.env.example` + RSS

**Files:**
- Create: `apps/web/src/lib/site.ts`, `apps/web/src/lib/site.spec.ts`
- Create: `apps/web/.env.example`
- Create: `apps/web/src/app/blog/rss.xml/route.ts`

**Interfaces:**
- Consumes: `JOURNAL_POSTS`; `sortPostsByDate` (Task 2).
- Produces: `siteUrl(): string` · `absoluteUrl(path: string): string` ·
  `escapeXml(value: string): string`.

- [ ] **Bước 1: Viết test**

Tạo `apps/web/src/lib/site.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { absoluteUrl, escapeXml } from './site.js';

describe('absoluteUrl', () => {
  it('ghép đường dẫn tuyệt đối lên gốc site', () => {
    expect(absoluteUrl('/blog')).toMatch(/^https?:\/\/[^/]+\/blog$/);
  });

  it('không sinh dấu gạch đôi khi đường dẫn đã có / đầu', () => {
    expect(absoluteUrl('/blog')).not.toMatch(/[^:]\/\//);
  });

  it('nhận cả đường dẫn không có / đầu', () => {
    expect(absoluteUrl('blog')).toBe(absoluteUrl('/blog'));
  });
});

describe('escapeXml', () => {
  it('thoát 5 ký tự XML nguy hiểm', () => {
    expect(escapeXml(`<a href="x">Bún & phở 'ngon'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Bún &amp; phở &apos;ngon&apos;&lt;/a&gt;',
    );
  });

  it('thoát & TRƯỚC rồi mới tới các ký tự khác — không nhân đôi escape', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  it('chuỗi không có ký tự đặc biệt thì giữ nguyên', () => {
    expect(escapeXml('Hoi An at night')).toBe('Hoi An at night');
  });
});
```

- [ ] **Bước 2: Chạy test — FAIL**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/site.spec.ts
```

Expected: FAIL — `Failed to resolve import "./site.js"`.

- [ ] **Bước 3: Viết `lib/site.ts`**

```ts
// Gốc URL công khai của web. Cần cho RSS (feed bắt buộc URL tuyệt đối) và
// sau này cho sitemap/robots. Đọc từ env; khi dev chưa đặt thì rơi về
// localhost để feed vẫn hợp lệ thay vì sinh link gãy.
const FALLBACK = 'http://localhost:3000';

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : FALLBACK;
  return base.replace(/\/+$/, '');
}

/** Ghép thành URL tuyệt đối; chấp nhận đường dẫn có hoặc không có `/` đầu. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}/${path.replace(/^\/+/, '')}`;
}

/** Thoát ký tự đặc biệt của XML. `&` phải đi TRƯỚC, không thì escape chồng. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

- [ ] **Bước 4: Chạy lại — PASS**

```bash
pnpm --filter @tourism/web exec vitest run src/lib/site.spec.ts
```

Expected: 6 passed.

- [ ] **Bước 5: Tạo `.env.example`**

Tạo `apps/web/.env.example`:

```bash
# Gốc URL công khai của web — dùng cho RSS, sau này cho sitemap/robots.
# Dev: sao chép file này thành .env.local (file DUY NHẤT script pnpm tự đọc).
# Deploy thật: đặt trong .env.production, trỏ tường minh bằng --env-file.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Bước 6: Viết route RSS**

Tạo `apps/web/src/app/blog/rss.xml/route.ts`:

```ts
import { sortPostsByDate } from '@/lib/blog';
import { absoluteUrl, escapeXml } from '@/lib/site';
import { JOURNAL_POSTS } from '@/mocks/journal';

// Feed đặt NGOÀI route group (site): nó trả XML nên không được đi qua layout
// có navbar/footer.
export const dynamic = 'force-static';

export function GET() {
  const posts = sortPostsByDate(JOURNAL_POSTS);
  const items = posts
    .map((post) =>
      [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(absoluteUrl(`/blog/${post.slug}`))}</link>`,
        `      <guid isPermaLink="true">${escapeXml(absoluteUrl(`/blog/${post.slug}`))}</guid>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        `      <pubDate>${new Date(post.date).toUTCString()}</pubDate>`,
        `      <category>${escapeXml(post.category)}</category>`,
        '    </item>',
      ].join('\n'),
    )
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Tourism — Journal</title>',
    `    <link>${escapeXml(absoluteUrl('/blog'))}</link>`,
    '    <description>Notes from the road, written by our local guides.</description>',
    '    <language>en</language>',
    items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
}
```

- [ ] **Bước 7: Kiểm feed**

```bash
curl -s http://localhost:3000/blog/rss.xml | head -20
curl -s http://localhost:3000/blog/rss.xml | grep -c "<item>"
```

Expected: XML hợp lệ, đếm được `9`.

- [ ] **Bước 8: Commit**

```bash
pnpm lint:fix
git add apps/web/src/lib apps/web/.env.example apps/web/src/app/blog
git commit -m "feat(web): lib/site (siteUrl·absoluteUrl·escapeXml) + .env.example + feed /blog/rss.xml"
```

---

## Task 7: Nối link + gate + merge + docs sweep

**Files:**
- Modify: `apps/web/src/components/site-header.tsx` (`NAV_LINKS`, `MOBILE_LINKS`)
- Modify: `apps/web/src/components/site-footer.tsx` (nhóm `Explore`, mục Journal)
- Modify: `apps/web/src/components/home/journal.tsx` (nút "Read all stories" + card)

- [ ] **Bước 1: Navbar**

Trong `site-header.tsx`, đổi `{ label: 'Travel Blog', href: '/#journal' }` →
`{ label: 'Travel Blog', href: '/blog' }` ở CẢ `NAV_LINKS` và `MOBILE_LINKS`.

- [ ] **Bước 2: Footer**

Trong `site-footer.tsx`, nhóm `Explore`: `['Journal', '/#journal']` →
`['Journal', '/blog']`.

- [ ] **Bước 3: Section Journal trên Home**

Trong `home/journal.tsx`: nút "Read all stories" đổi `href="#journal"` →
`href="/blog"`; bọc mỗi `motion.article` bằng `<Link href={`/blog/${post.slug}`}>`
để card bấm được (hiện đang `cursor-pointer` mà không dẫn đi đâu).

- [ ] **Bước 4: Rà không còn link chờ**

```bash
grep -rn "#journal" apps/web/src
```

Expected: chỉ còn `id="journal"` của chính section trên Home.

- [ ] **Bước 5: Gate ĐẦY ĐỦ (luật #11)**

Dừng dev server (hỏi user), rồi:

```bash
docker start tourism-v2-postgres-1 && pnpm gate:int
```

Expected: tất cả xanh.

- [ ] **Bước 6: Push + chờ CI**

```bash
git add apps/web/src
git commit -m "feat(web): nối navbar/footer/Home Journal về /blog"
git push -u origin feat/blog-pages
gh run watch
```

- [ ] **Bước 7: HỎI user rồi mới merge**

```bash
git switch main && git pull --ff-only && git switch feat/blog-pages && git rebase main && git switch main && git merge --ff-only feat/blog-pages && git push && git branch -d feat/blog-pages && git push origin --delete feat/blog-pages
```

- [ ] **Bước 8: Docs sweep (luật #13)**

- Entry mới trong `docs/CHANGELOG.md` (ngày · hash · nội dung · review
  findings · số test).
- `docs/README.md`: thêm spec + plan vào 2 bảng, cập nhật dòng trạng thái P3b.
- `./scripts/docs-freshness.sh` phải xanh.

- [ ] **Bước 9: Dọn tiến trình**

```bash
ss -tlnp | grep -E ':(3000|3001)' || echo "CỔNG SẠCH"
```

Kill theo PID mọi server tạm mình mở (KHÔNG `pkill -f "next dev"`), đóng
chromium của script screenshot, rồi báo "cổng sạch".

---

## Tự rà lại kế hoạch

- **Phủ spec**: mock 9 bài + 2 ảnh (Task 1) · helper thuần + `tocFromSections`
  (Task 2) · `/blog` chip lọc + lưới tạp chí (Task 3) · `/blog/[slug]` hero
  ảnh + TOC + JSON-LD (Task 4) · ShareRow/PostNav/bài liên quan (Task 5) ·
  `lib/site` + `.env.example` + RSS (Task 6) · nối link + gate + sweep
  (Task 7). Nợ (phân trang, search, API, EnquiryCta, related tours) cố ý
  không có task — đã ghi trong spec.
- **Nhất quán tên**: `sortPostsByDate` · `filterPostsByCategory` ·
  `postCategories` · `adjacentPosts` → `{ newer, older }` · `relatedPosts` ·
  `tocFromSections` · `siteUrl`/`absoluteUrl`/`escapeXml` ·
  `PostCard{post,featured?}` · `CategoryChips{categories,active?}` ·
  `PostHero{post}` · `ShareRow{title}` · `PostNav{newer?,older?}`.
- **Rủi ro đã lường**: tên file ảnh trên Wikimedia có thể đã đổi → Task 1 bước
  2 có đường lui; `ShareRow` cố ý KHÔNG phụ thuộc `lib/site` nên Task 5 chạy
  được trước Task 6; route RSS đặt ngoài route group `(site)` để không dính
  layout HTML.
