# Cụm trang Tours — kế hoạch triển khai

> **Cho agent thực thi:** SUB-SKILL BẮT BUỘC — dùng `superpowers:subagent-driven-development`
> (khuyến nghị) hoặc `superpowers:executing-plans` để chạy plan này theo từng task.
> Các bước dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Dựng `/tours` (listing có lọc/tìm/sắp xếp/phân trang) và `/tours/[slug]`
(chi tiết bố cục "Departure Board") chạy hoàn toàn bằng mock đã đắp lại theo
hình dạng contract, cộng bốn khoản nợ treo.

**Architecture:** Static-first. Mock gương đúng `TourCardSchema`/`TourDetailSchema`
nên cụm gắn API sau này chỉ đổi nguồn dữ liệu chứ không rename component. Toàn
bộ logic lọc/sắp xếp/định dạng nằm trong `lib/` thuần, test trước; component chỉ
render. Tương tác (lọc, chọn đợt khởi hành) chạy client, trạng thái ghi vào URL.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · `@tourism/ui`
(Base UI + shadcn vendored) · `@tourism/i18n` · `@tourism/tokens` · Vitest 4 ·
`@testing-library/react` (thêm ở Task 1) · Biome.

**Spec:** [docs/specs/2026-07-27-tours-pages-design.md](../specs/2026-07-27-tours-pages-design.md)
**Đối chiếu Nexora:** [docs/analysis/2026-07-27-tours-parity-nexora.md](../analysis/2026-07-27-tours-parity-nexora.md)

## Tiến độ

| Task | Trạng thái |
| --- | --- |
| 1 · ADR-0014 + hạ tầng test component | ✅ |
| 2 · `lib/text.ts` + `lib/paginate.ts` | ✅ |
| 3 · Mock 16 tour theo contract | ✅ |
| 4 · `lib/tours.ts` | ✅ |
| 5 · `/tours` hero + card | ✅ |
| 6 · Lọc / sắp xếp / phân trang | ✅ |
| 7 · Skeleton + LoadErrorState + vá navbar | ✅ |
| **⛔ Mốc dừng — user duyệt `/tours`** | ✅ **duyệt 27/07** |
| 8 · `/tours/[slug]` khung + hero | ✅ |
| 9 · Dải khởi hành + rail booking | ✅ |
| 10 · Itinerary · inclusions · good-to-know | ✅ |
| 11 · robots + sitemap | ⬜ |
| 12 · ArticleBody + phân trang `/blog` | ⬜ |
| 13 · `gate:int` → push → hỏi user → merge → docs sweep | ⬜ |

**Listing đi qua 4 vòng thiết kế lại trước khi được duyệt** — plan gốc chỉ dự
tính 1. Ghi lại để phase sau ước lượng đúng hơn:

| Vòng | Từ → Đến | Nguyên nhân |
| --- | --- | --- |
| 1 | chip rail ngang → **sidebar Nexora** | Plan chọn toolbar vì "API chỉ có 3 chiều lọc"; user muốn sidebar đầy đủ hơn Nexora |
| 2 | sidebar dính + cuộn nội bộ → **sidebar tĩnh** | Đo được: nội dung 1140px không vừa màn hình nào (608–968px), nên `sticky` là lời hứa không giữ được |
| 3 | sidebar → **drawer** | Bố cục hai cột biến trang bán tour thành trang quản trị, hero mất trọng lượng ở cả hai chế độ màu |
| 4 | thanh công cụ có khung → **hàng tiêu đề khu vực** | Khảo sát 13 sản phẩm thật: gốc rễ "trống hoác" là CÁI KHUNG, không phải ít phần tử |

**Bài học cho phase sau:** ba vòng đầu tôi sửa *thuộc tính* của thứ đang có
(màu, vị trí, thanh cuộn, đệm) mà không hỏi *thứ đó có nên tồn tại không*. Vòng
4 mới đi khảo sát sản phẩm thật và tìm ra nguyên nhân ở tầng cao hơn. Với UI có
tính thẩm mỹ, **khảo sát mẫu thật TRƯỚC, không phải sau vòng sửa thứ ba**.

Ngoài phạm vi plan nhưng đã làm (phát sinh từ các vòng review): token `hero` +
sửa hero cho `/tours` `/blog` `/faq` `/contact` · 6 lỗi trong `@tourism/ui`
(z-index ở `sheet`/`select`/`drawer`, `disabled:` ở `checkbox`, `Select.Value`
in giá trị thô, đệm `DrawerHeader`/`DrawerFooter`) · Lenis chặn cuộn trong modal
· chọn số tour/trang.

---

## Global Constraints

Áp cho **mọi task**, không lặp lại trong từng task:

- **KHÔNG đụng `apps/api`, `libs/shared/contract`, `apps/api/prisma/`.** Contract
  chỉ được đọc. Cụm này thuần web.
- **Tokens-only, KHÔNG hex.** Dùng class Tailwind ánh xạ token: `bg-background`,
  `text-muted-foreground`, `text-rating`, `text-price-compare`, `bg-warning`,
  `text-success`, `aspect-(--aspect-card)`, `aspect-(--aspect-hero)`,
  `z-(--z-sticky)`, `shadow-(--shadow-dropdown)`.
- **Copy user-facing bằng TIẾNG ANH**, đặt trong `libs/shared/i18n`. Không hard-code
  chuỗi tiếng Anh mới trong component nếu nó là copy sản phẩm.
- **Comment code bằng TIẾNG VIỆT** (`//` và `/** */`). Tên biến/hàm/identifier
  tiếng Anh. Áp cả cho code do subagent sinh ra.
- **Mọi ảnh dùng `ImagePlaceholder`** (`@/components/image-placeholder`). Không
  `next/image`, không đường dẫn ảnh.
- **Chỉ link tới trang CÓ THẬT.** Trang đã tồn tại: `/`, `/about`, `/contact`,
  `/faq`, `/terms`, `/privacy`, `/cancellation-policy`, `/blog`, `/blog/[slug]`,
  `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`,
  `/two-factor`. **Chưa tồn tại: `/destinations`, `/tours/[slug]/book`, `/checkout`.**
- **Hero của trang phải TỐI** — hero sáng làm navbar trong suốt bị tàng hình.
- **Conventional Commits, KHÔNG AI attribution.** Không có dòng `Co-Authored-By`,
  không `🤖 Generated with`.
- Chạy `pnpm lint:fix` trước mỗi commit; Biome là formatter duy nhất.
- **Không chạy `next build`** — user đang giữ dev server ở cổng 3000.

## Cấu trúc file

**Tạo mới**

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `docs/adr/0014-web-component-testing.md` | ADR jsdom + RTL |
| `apps/web/vitest.setup.ts` | Setup jsdom: matcher + cleanup |
| `apps/web/src/lib/text.ts` (+`.spec.ts`) | `foldAccents` dùng chung |
| `apps/web/src/lib/paginate.ts` (+`.spec.ts`) | `paginate` · `pageNumbers` — trung lập, `/blog` dùng lại |
| `apps/web/src/lib/tours.ts` (+`.spec.ts`) | Toàn bộ logic lọc/sắp/định dạng của tour |
| `apps/web/src/app/(site)/tours/(listing)/page.tsx` · `loading.tsx` | Route listing — **route group** `(listing)/`, xem ghi chú soft 404 dưới |
| `apps/web/src/app/(site)/tours/[slug]/page.tsx` | Route detail — **KHÔNG có `loading.tsx`**, cố ý |
| `apps/web/src/app/robots.ts` · `sitemap.ts` | SEO |
| `apps/web/src/components/tours/tours-hero.tsx` | Hero listing (tối, có search) |
| `apps/web/src/components/tours/tour-card.tsx` | Card tour |
| `apps/web/src/components/tours/tours-explorer.tsx` (+`.spec.tsx`) | Lọc/tìm/sort/phân trang + URL sync |
| `apps/web/src/components/tours/tour-toolbar.tsx` | Chip rail + destination + featured + sort |
| `apps/web/src/components/tours/pagination-bar.tsx` | Phân trang đánh số |
| `apps/web/src/components/tours/tour-hero.tsx` | Hero detail |
| `apps/web/src/components/tours/route-ribbon.tsx` | Chuỗi chặng từ `destinations[]` |
| `apps/web/src/components/tours/departure-strip.tsx` (+`.spec.tsx`) | Dải chip khởi hành |
| `apps/web/src/components/tours/booking-rail.tsx` | Rail dính + bar đáy mobile |
| `apps/web/src/components/tours/itinerary-timeline.tsx` | Timeline theo ngày |
| `apps/web/src/components/tours/inclusions.tsx` | Included / Excluded 2 cột |
| `apps/web/src/components/tours/departures-table.tsx` | Bảng đợt đầy đủ |
| `apps/web/src/components/tours/good-to-know.tsx` | FAQ + Policies |
| `apps/web/src/components/tours/related-tours.tsx` | Gợi ý cuối trang |
| `apps/web/src/components/feedback/load-error-state.tsx` | Phân biệt lỗi tải ≠ rỗng |
| `apps/web/src/components/content/article-body.tsx` | Thân bài dùng chung (Task 12) |

**Sửa**

| Đường dẫn | Việc |
| --- | --- |
| `apps/web/vitest.config.ts` | Thành 2 project: `node` + `dom` |
| `apps/web/package.json` | Thêm devDep test |
| `apps/web/src/mocks/types.ts` | Bỏ `MockTour`; thêm `MockTourCard`/`MockTourDetail` |
| `apps/web/src/mocks/tours.ts` | Viết lại, 16 tour |
| `apps/web/src/mocks/mocks.spec.ts` | Thêm bất biến cho mock tour |
| `apps/web/src/lib/blog.ts` | Import `foldAccents` từ `lib/text` |
| `apps/web/src/components/site-header.tsx` | Vá link chết |
| `apps/web/src/components/destinations-menu.tsx` | 3 vùng → 9 địa danh |
| `libs/shared/i18n/src/lib/messages.ts` | Cắt key mô tả tính năng không có |
| `apps/web/src/app/(site)/blog/page.tsx` | Phân trang (Task 12) |

**Xoá**

| Đường dẫn | Lý do |
| --- | --- |
| `apps/web/src/components/home/tour-card.tsx` | Không trang nào import; tái sinh ở `components/tours/` với field mới |

**Ngoài phạm vi, ghi nợ:** JSON-LD Product/Offer/AggregateRating + FAQPage ·
skip link · `images.remotePatterns` · cache-tag revalidation · `/destinations`.

### ⚠️ Soft 404 vì `loading.tsx` — đo được ở Task 8, ảnh hưởng Task 11

`loading.tsx` tạo Suspense boundary cho segment **và mọi route con**. Next stream
shell ra trước, nên HTTP 200 đã gửi xong trước khi thân trang kịp gọi
`notFound()`: slug lạ trả **200 kèm giao diện 404**. Crawler nhận 200 rồi đem
trang lỗi đi index — đúng route mà Task 11 đưa vào sitemap. Đo ở CẢ `next dev`
lẫn production build; `/blog/[slug]` không dính vì nó không có `loading.tsx` nào.

Cách chữa đã áp: listing chuyển vào route group **`(listing)/`** (URL không đổi,
`/tours` vẫn là `/tours`) nên `loading.tsx` của nó không còn bọc `[slug]`; và
`[slug]` **không có `loading.tsx`** — trang detail là SSG tĩnh, HTML về ngay, nên
skeleton không mua được gì, còn thêm vào là soft 404 quay lại.

Đã thử và **KHÔNG ăn** (đừng thử lại): `export const dynamicParams = false` —
404 của nó vẫn đi qua cùng Suspense boundary, đo vẫn ra 200; nó còn gài bẫy cho
lúc gắn API (tour mới publish 404 tới lần build kế).

Bẫy cho cụm gắn API: lúc đó trang detail cần skeleton thật, và thêm `loading.tsx`
là soft 404 quay lại. Phải đo status của slug lạ trong CÙNG lần thay đổi đó.

---

### Task 1: ADR-0014 + hạ tầng test component (jsdom + RTL)

> **Đã chạy spike xác minh 27/07 — phần code của task này ĐÃ XONG và đang nằm
> trong working tree chưa commit.** Kết quả đo ở cuối task. Việc còn lại của
> Task 1 là viết ADR rồi commit chung.

**Files:**
- Create: `docs/adr/0014-web-component-testing.md`
- Create: `apps/web/vitest.setup.ts` ✅
- Create: `apps/web/src/components/image-placeholder.spec.tsx` ✅
- Modify: `apps/web/vitest.config.ts` ✅
- Modify: `apps/web/package.json` ✅
- Modify: `pnpm-workspace.yaml` ✅ — **phát sinh từ spike, xem Bước 2b**
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: —
- Produces: project Vitest tên `node` (chạy `src/lib/**/*.spec.ts`,
  `src/mocks/**/*.spec.ts`) và `dom` (chạy `src/components/**/*.spec.tsx`).
  Mọi task sau viết test component dưới dạng `*.spec.tsx` trong `src/components/`.

- [ ] **Bước 1: Viết ADR-0014**

Dùng skill `documentation-and-adrs` để giữ đúng khuôn ADR của repo. Nội dung
bắt buộc phải có:

- **Bối cảnh:** `apps/web` mới chỉ test logic thuần (môi trường `node`). CHANGELOG
  đã chỉ đích danh việc thiếu test tầng component là gốc rễ 2 lỗi lọt CI. Cụm
  Tours là cụm tương tác nặng nhất từ trước tới nay (lọc, phân trang, chọn đợt
  khởi hành, accordion, drawer).
- **Quyết định:** thêm môi trường `jsdom` + `@testing-library/react` cho
  `apps/web`, cấu hình bằng `test.projects` của Vitest 4 — **một** test runner,
  hai project. KHÔNG thêm Jest, KHÔNG thêm Playwright component testing.
- **Ranh giới:** logic thuần vẫn ở `lib/*.spec.ts` chạy môi trường `node` (nhanh);
  `*.spec.tsx` chỉ dùng cho thứ **không** kiểm được ở tầng thuần — tương tác,
  a11y (role/label), đồng bộ trạng thái giữa nhiều component. Không viết lại
  test logic dưới dạng component test.
- **Hệ quả (số đo thật từ spike 27/07, không phải ước lượng):** `apps/web` thêm
  4 devDep; test web 83 test chạy 1,5s; `pnpm gate` toàn repo 8,0s với 15/18
  task cached; RTL không tự cleanup khi `globals: false` nên phải cleanup tường
  minh trong setup.
- **Hệ quả kéo theo — phải ghi rõ:** ADR này **buộc workspace ghim một bản
  React duy nhất** (`pnpm-workspace.yaml`, Bước 2b). Đó không phải chi tiết
  triển khai mà là ràng buộc mới cho toàn repo: từ nay nâng React phải nâng ở
  cả override lẫn `apps/web`, nếu lệch thì test component vỡ trước tiên. Đổi
  lại, ta gỡ được một quả bom âm ỉ — hai bản React trong cùng workspace vốn có
  thể gây lỗi context xuyên ranh giới package, Next chỉ đang che nó đi.
- **Phương án đã cân nhắc và loại:** `happy-dom` (nhanh hơn nhưng lệch chuẩn
  DOM ở form/dialog — cụm này có cả hai) · Playwright component testing (chồng
  chéo với ảnh chụp kiểm tra bằng playwright-core đang dùng thủ công).

- [x] **Bước 2: Cài devDependency**

```bash
pnpm --filter @tourism/web add -D jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**KHÔNG cần `@vitejs/plugin-react`** — đã đo: `apps/web/tsconfig.json` đặt
`"jsx": "react-jsx"` (automatic runtime), esbuild của Vite đọc thẳng setting đó
và transform `.tsx` đúng. Bớt được một dependency.

Bản resolve được: RTL 16.3.2 (hỗ trợ React 19), jest-dom 7.x, user-event 14.6.1.

- [x] **Bước 2b: Ghim MỘT bản React cho cả workspace** ← phát sinh từ spike

Không có bước này thì **mọi test chạm component Base UI đều nổ**
`TypeError: Cannot read properties of null (reading 'useRef')`.

Nguyên nhân: `apps/web` ghim cứng `react: "19.2.4"`, còn `libs/shared/ui` khai
peer `"^19"` nên pnpm tự cài thêm `19.2.7`, và `@base-ui/react` bám vào bản đó.
Store có HAI React. Next bundler tự dedupe nên dev/build không lộ, nhưng Vitest
thì lộ ngay: `react-dom@19.2.4` render component gọi hook của `react@19.2.7`
→ dispatcher null.

Hai cách chữa đã thử và **đều KHÔNG ăn** (đừng thử lại):

| Cách | Vì sao trượt |
| --- | --- |
| `resolve.dedupe: ['react','react-dom']` | Store cô lập của pnpm — symlink react riêng của `@base-ui/react` vẫn thắng |
| `resolve.alias` trỏ react về `apps/web/node_modules` | Vitest **externalize** `node_modules`, Node resolve thẳng nên không đi qua alias Vite |

Cách ăn: override ở `pnpm-workspace.yaml` (pnpm 11 **không còn đọc**
`pnpm.overrides` trong `package.json` — nó cảnh báo và bỏ qua). Thêm vào khối
`overrides:` đang có:

```yaml
  react: '19.2.4'
  react-dom: '19.2.4'
```

Ghim **đúng bản `apps/web` đang chạy** — đây là hạ xuống cho khớp, KHÔNG nâng
cấp. Kèm comment tiếng Việt giải thích, cùng giọng với các override khác trong
file đó.

Kiểm chứng sau khi `pnpm install`:

```bash
readlink -f libs/shared/ui/node_modules/@base-ui/react | sed 's|.*/.pnpm/||'
```

Kỳ vọng: chuỗi chứa `react-dom@19.2.4_react@19.2.4`, **không** phải `19.2.7`.

- [ ] **Bước 3: Viết setup file**

`apps/web/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Repo KHÔNG bật `globals: true` (test import describe/it/expect tường minh),
// nên RTL không tự gắn cleanup — phải gọi tay, nếu không DOM của test trước
// còn nguyên và query của test sau khớp nhầm phần tử.
afterEach(() => {
  cleanup();
});
```

- [ ] **Bước 4: Sửa vitest.config.ts thành 2 project**

```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Hai project, MỘT runner (ADR-0014): logic thuần chạy môi trường `node` cho
// nhanh, test component chạy `jsdom`. Alias khớp tsconfig paths vì Vitest
// không tự đọc "paths".
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/lib/**/*.spec.ts', 'src/mocks/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/components/**/*.spec.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
```

- [x] **Bước 5: Viết test khói chứng minh hạ tầng chạy**

`apps/web/src/components/image-placeholder.spec.tsx` — 3 test: có nhãn · không
nhãn · icon `aria-hidden`.

- [x] **Bước 6: Chạy test — cả hai project phải xanh**

```bash
pnpm --filter @tourism/web test
```

Đã đo: `Test Files 8 passed (8) · Tests 83 passed (83)`, mỗi dòng có nhãn
project `node` hoặc `dom`.

**Đã dò sẵn cả những component Base UI mà task sau mới dùng** (spike đã xoá,
nhưng kết quả còn giá trị — nếu Task 6/10 vỡ ở đây thì là lỗi mới, không phải
hạ tầng):

| Dò | Kết quả | Dùng ở |
| --- | --- | --- |
| `Badge`, `Button` từ `@tourism/ui` | ✅ | Task 5 |
| `messages` từ `@tourism/i18n` trong jsdom | ✅ | mọi task |
| `userEvent.click` + `useState` + `aria-pressed` | ✅ | Task 6, 9 |
| `Accordion` (Base UI) mở panel | ✅ | Task 10 FAQ |
| `Sheet` (Base UI, **có portal**) mở dialog | ✅ | Task 6 drawer mobile |
| `vi.mock('next/navigation')` | ✅ | Task 6 URL-sync |

- [x] **Bước 6b: Gate đầy đủ — override React không được phá gì khác**

```bash
pnpm gate
```

Đã đo: `Tasks: 18 successful, 18 total` · API `188 passed` · web `83 passed` ·
`next build` compile sạch, sinh 27 trang tĩnh · Biome không lỗi.

⚠️ Chỉ chạy `next build` khi cổng 3000 **trống** — kiểm trước bằng
`curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/`
(`000` = trống).

- [ ] **Bước 7: Thêm ADR vào bản đồ docs**

Trong `docs/README.md`, bảng ADR, thêm hàng:

```markdown
| [0014](adr/0014-web-component-testing.md) | Test tầng component cho `apps/web` — Vitest 2 project (node + jsdom) + Testing Library, ranh giới với test logic thuần |
```

- [ ] **Bước 8: Commit**

```bash
pnpm lint:fix
git add docs/adr/0014-web-component-testing.md docs/README.md apps/web/vitest.config.ts apps/web/vitest.setup.ts apps/web/package.json apps/web/src/components/image-placeholder.spec.tsx pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "test(web): hạ tầng test component — Vitest 2 project + Testing Library (ADR-0014)"
```

Commit này gộp cả override React vì hai thứ không tách được: không có override
thì hạ tầng test không chạy. Thông điệp commit phải nhắc điều đó ở phần thân.

---

### Task 2: `lib/text.ts` + `lib/paginate.ts`

**Files:**
- Create: `apps/web/src/lib/text.ts`, `apps/web/src/lib/text.spec.ts`
- Create: `apps/web/src/lib/paginate.ts`, `apps/web/src/lib/paginate.spec.ts`
- Modify: `apps/web/src/lib/blog.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `foldAccents(value: string): string`
  - `paginate<T>(items: readonly T[], page: number, limit: number): Paged<T>`
    với `Paged<T> = { items: T[]; page: number; limit: number; total: number; totalPages: number }`
  - `pageNumbers(page: number, totalPages: number): (number | 'ellipsis')[]`

- [ ] **Bước 1: Viết test thất bại cho `foldAccents`**

`apps/web/src/lib/text.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { foldAccents } from './text';

describe('foldAccents', () => {
  it('bỏ dấu tiếng Việt và hạ chữ thường', () => {
    expect(foldAccents('Hạ Long')).toBe('ha long');
  });

  it('đổi đ/Đ thành d — chữ này không phải dấu phụ nên NFD không tách được', () => {
    expect(foldAccents('Đà Nẵng')).toBe('da nang');
  });

  it('chuỗi không dấu giữ nguyên (chỉ hạ chữ thường)', () => {
    expect(foldAccents('Mekong Delta')).toBe('mekong delta');
  });
});
```

- [ ] **Bước 2: Chạy test — phải ĐỎ**

```bash
pnpm --filter @tourism/web test -- src/lib/text.spec.ts
```

Kỳ vọng: FAIL — `Failed to resolve import "./text"`.

- [ ] **Bước 3: Viết `lib/text.ts`**

Chuyển nguyên hàm private đang nằm trong `lib/blog.ts` (dòng 52–59) ra file
riêng, thêm `export`:

```ts
/** Bỏ dấu tiếng Việt để gõ "ha long" vẫn tìm ra "Hạ Long" — khách nước ngoài
    không gõ được dấu, mà địa danh trong dữ liệu thì có dấu đầy đủ.
    Tách khỏi lib/blog.ts vì cả blog lẫn tours đều cần. */
export function foldAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
```

- [ ] **Bước 4: Sửa `lib/blog.ts` dùng lại hàm chung**

Xoá hàm `foldAccents` private (dòng 50–59), thêm import ở đầu file:

```ts
import { foldAccents } from './text';
```

- [ ] **Bước 5: Chạy test — text + blog cùng xanh**

```bash
pnpm --filter @tourism/web test -- src/lib/text.spec.ts src/lib/blog.spec.ts
```

Kỳ vọng: PASS cả hai. Test blog cũ **không được sửa** — nếu nó đỏ nghĩa là
việc tách hàm làm đổi hành vi.

- [ ] **Bước 6: Viết test thất bại cho phân trang**

`apps/web/src/lib/paginate.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pageNumbers, paginate } from './paginate';

const items = Array.from({ length: 16 }, (_, i) => i + 1);

describe('paginate', () => {
  it('trả đúng hình dạng Paged của contract', () => {
    expect(paginate(items, 1, 12)).toEqual({
      items: items.slice(0, 12),
      page: 1,
      limit: 12,
      total: 16,
      totalPages: 2,
    });
  });

  it('trang cuối chỉ chứa phần dư', () => {
    expect(paginate(items, 2, 12).items).toEqual([13, 14, 15, 16]);
  });

  it('page vượt totalPages trả trang rỗng chứ không crash', () => {
    const result = paginate(items, 99, 12);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(2);
  });

  it('danh sách rỗng cho totalPages = 0, không phải 1', () => {
    expect(paginate([], 1, 12)).toEqual({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 0,
    });
  });

  it('page nhỏ hơn 1 được kẹp về 1', () => {
    expect(paginate(items, 0, 12).items).toEqual(items.slice(0, 12));
  });
});

describe('pageNumbers', () => {
  it('ít trang thì hiện hết, không ellipsis', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('đang ở đầu dải dài — ellipsis chỉ ở cuối', () => {
    expect(pageNumbers(2, 10)).toEqual([1, 2, 3, 'ellipsis', 10]);
  });

  it('đang ở giữa — ellipsis cả hai đầu', () => {
    expect(pageNumbers(6, 10)).toEqual([1, 'ellipsis', 5, 6, 7, 'ellipsis', 10]);
  });

  it('đang ở cuối — ellipsis chỉ ở đầu', () => {
    expect(pageNumbers(9, 10)).toEqual([1, 'ellipsis', 8, 9, 10]);
  });

  it('không trang nào thì trả mảng rỗng', () => {
    expect(pageNumbers(1, 0)).toEqual([]);
  });
});
```

- [ ] **Bước 7: Chạy test — phải ĐỎ**

```bash
pnpm --filter @tourism/web test -- src/lib/paginate.spec.ts
```

Kỳ vọng: FAIL — không resolve được `./paginate`.

- [ ] **Bước 8: Viết `lib/paginate.ts`**

```ts
/** Phong bì phân trang — gương đúng `PagedSchema` của contract để lúc gắn API
    swap thẳng. Đặt ở lib riêng (không phải lib/tours) vì /blog cũng dùng. */
export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Cắt một trang. `page` ngoài dải KHÔNG throw — trả trang rỗng, vì URL do
    người dùng gõ tay hoặc link cũ hoàn toàn có thể trỏ trang không tồn tại. */
export function paginate<T>(items: readonly T[], page: number, limit: number): Paged<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  // Danh sách rỗng cho totalPages = 0 (không phải 1): "0 trang" là sự thật,
  // và thanh phân trang dựa vào đó để tự ẩn.
  const current = Math.max(1, page);
  const start = (current - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page: current,
    limit,
    total,
    totalPages,
  };
}

/** Dãy số trang có ellipsis. Luôn giữ trang đầu, trang cuối và 1 trang kề hai
    bên trang hiện tại — dải cố định nên thanh phân trang không nhảy chiều
    ngang khi bấm qua lại. */
export function pageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const result: (number | 'ellipsis')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(totalPages - 1, page + 1);

  if (from > 2) result.push('ellipsis');
  for (let i = from; i <= to; i++) result.push(i);
  if (to < totalPages - 1) result.push('ellipsis');

  result.push(totalPages);
  return result;
}
```

- [ ] **Bước 9: Chạy test — phải XANH**

```bash
pnpm --filter @tourism/web test -- src/lib/paginate.spec.ts src/lib/text.spec.ts src/lib/blog.spec.ts
```

Kỳ vọng: PASS toàn bộ.

- [ ] **Bước 10: Commit**

```bash
pnpm lint:fix
git add apps/web/src/lib/text.ts apps/web/src/lib/text.spec.ts apps/web/src/lib/paginate.ts apps/web/src/lib/paginate.spec.ts apps/web/src/lib/blog.ts
git commit -m "feat(web): tách foldAccents dùng chung + helper phân trang trung lập"
```

---

### Task 3: Đắp lại mock theo hình dạng contract

**Files:**
- Modify: `apps/web/src/mocks/types.ts`
- Modify: `apps/web/src/mocks/tours.ts`
- Modify: `apps/web/src/mocks/mocks.spec.ts`
- Delete: `apps/web/src/components/home/tour-card.tsx`

**Interfaces:**
- Consumes: —
- Produces: `MockTourCard`, `MockTourDetail` (xem §4.2 của spec — chép nguyên
  vào `types.ts`), và `export const TOURS: MockTourDetail[]` gồm 16 phần tử.
  Mọi task sau import `TOURS` từ `@/mocks/tours` và kiểu từ `@/mocks/types`.

- [ ] **Bước 1: Xoá `MockTour` và card cũ**

```bash
git rm apps/web/src/components/home/tour-card.tsx
```

Component này không trang nào import (đã grep xác nhận) nên xoá là an toàn.
Thiết kế của nó được chép lại nguyên vẹn ở Task 5 — mở lại bằng
`git show HEAD:apps/web/src/components/home/tour-card.tsx` nếu cần đối chiếu.

Trong `apps/web/src/mocks/types.ts`, xoá `interface MockTour` (dòng 7–25).

- [ ] **Bước 2: Thêm kiểu mới vào `types.ts`**

Chép nguyên khối `MockTourCard` + `MockTourDetail` từ **spec §4.2** vào
`types.ts`, ngay chỗ `MockTour` vừa xoá. Giữ nguyên toàn bộ comment tiếng Việt
trong khối đó — chúng ghi lại chính những cái bẫy (tiền là string, `ratingAvg`
null ≠ 0, `startDate` là ngày lịch).

Thêm một comment dẫn đường phía trên:

```ts
// Gương đúng TourCardSchema/TourDetailSchema của @tourism/contract. Khác hẳn
// các mock khác trong thư mục này (shape tự do theo nhu cầu UI): tour có
// contract backend đã chốt và giàu hơn UI, nên mock đi theo contract ngay từ
// đầu để cụm gắn API là swap nguồn, không phải rename khắp component.
```

- [ ] **Bước 3: Viết test bất biến TRƯỚC khi có dữ liệu**

Thêm vào `apps/web/src/mocks/mocks.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './destinations';
import { TOURS } from './tours';

const DECIMAL = /^\d+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('TOURS — bất biến gương theo contract', () => {
  it('có đủ 16 tour để limit=12 sinh ra trang 2 thật', () => {
    expect(TOURS).toHaveLength(16);
  });

  it('slug và id không trùng', () => {
    expect(new Set(TOURS.map((t) => t.slug)).size).toBe(TOURS.length);
    expect(new Set(TOURS.map((t) => t.id)).size).toBe(TOURS.length);
  });

  it('mọi trường tiền là chuỗi thập phân, không phải number', () => {
    for (const tour of TOURS) {
      expect(tour.basePrice).toMatch(DECIMAL);
      if (tour.compareAtPrice !== null) expect(tour.compareAtPrice).toMatch(DECIMAL);
      for (const dep of tour.departures) {
        expect(dep.effectivePrice).toMatch(DECIMAL);
        if (dep.compareAtPrice !== null) expect(dep.compareAtPrice).toMatch(DECIMAL);
      }
    }
  });

  it('giá gạch luôn CAO HƠN giá gốc — ngược lại thì chip giảm giá vô nghĩa', () => {
    for (const tour of TOURS) {
      if (tour.compareAtPrice !== null) {
        expect(Number(tour.compareAtPrice)).toBeGreaterThan(Number(tour.basePrice));
      }
    }
  });

  it('mỗi tour có đúng MỘT destination isPrimary', () => {
    for (const tour of TOURS) {
      expect(tour.destinations.filter((d) => d.isPrimary)).toHaveLength(1);
    }
  });

  it('mọi destination slug đều tồn tại trong DESTINATIONS', () => {
    const known = new Set(DESTINATIONS.map((d) => d.slug));
    for (const tour of TOURS) {
      for (const dest of tour.destinations) expect(known).toContain(dest.slug);
    }
  });

  it('itinerary có đúng durationDays ngày, đánh số 1..n liên tục', () => {
    for (const tour of TOURS) {
      expect(tour.itinerary).toHaveLength(tour.durationDays);
      expect(tour.itinerary.map((d) => d.dayNumber)).toEqual(
        Array.from({ length: tour.durationDays }, (_, i) => i + 1),
      );
    }
  });

  it('departures là ngày lịch, sort tăng dần, endDate không trước startDate', () => {
    for (const tour of TOURS) {
      const starts = tour.departures.map((d) => d.startDate);
      expect(starts).toEqual([...starts].sort());
      for (const dep of tour.departures) {
        expect(dep.startDate).toMatch(ISO_DATE);
        expect(dep.endDate).toMatch(ISO_DATE);
        expect(dep.endDate >= dep.startDate).toBe(true);
        expect(dep.seatsLeft).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('ratingAvg null nghĩa là chưa ai đánh giá — ratingCount phải bằng 0', () => {
    for (const tour of TOURS) {
      if (tour.ratingAvg === null) expect(tour.ratingCount).toBe(0);
      else {
        expect(tour.ratingAvg).toBeGreaterThanOrEqual(0);
        expect(tour.ratingAvg).toBeLessThanOrEqual(5);
        expect(tour.ratingCount).toBeGreaterThan(0);
      }
    }
  });
});

describe('TOURS — mọi nhánh nullable phải có mock chứng minh', () => {
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
  it('có tour không có ngày nào mô tả rỗng lẫn tour có', () => {
    expect(TOURS.some((t) => t.itinerary.some((d) => d.description === null))).toBe(true);
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
```

- [ ] **Bước 4: Chạy test — phải ĐỎ**

```bash
pnpm --filter @tourism/web test -- src/mocks/mocks.spec.ts
```

Kỳ vọng: FAIL — `TOURS` còn shape cũ, gần như mọi assertion đều đỏ.

- [ ] **Bước 5: Viết lại `mocks/tours.ts`**

Ba tour mẫu dưới đây là **khuôn bắt buộc** — chép nguyên, rồi viết tiếp 13 tour
theo bảng ma trận ở Bước 6. Thứ tự mảng = thứ tự `createdAt desc`.

```ts
import type { MockTourDetail } from './types.js';

// 16 tour mock gương theo TourCardSchema/TourDetailSchema. THỨ TỰ MẢNG CHÍNH LÀ
// THỨ TỰ `createdAt desc`: contract không trả `createdAt` (nó chỉ là sort key
// phía server), nên sort "Newest" ở tầng tĩnh = giữ nguyên thứ tự mảng này.
// Địa danh giữ dấu tiếng Việt; mọi copy user-facing khác là tiếng Anh (luật #7).
export const TOURS: MockTourDetail[] = [
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e40',
    slug: 'ha-long-bay-cruise',
    title: 'Ha Long Bay Cruise',
    summary:
      'Two days aboard a traditional junk boat with kayaking, a cave visit, and fresh seafood dinners under lantern light.',
    basePrice: '189.00',
    compareAtPrice: '236.00',
    currency: 'USD',
    durationDays: 2,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: true,
    destinations: [
      { slug: 'ha-long', name: 'Hạ Long', isPrimary: true },
      { slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: false },
    ],
    category: { slug: 'cruises', name: 'Cruises' },
    ratingAvg: 4.9,
    ratingCount: 1204,
    suitableFor: ['COUPLE', 'FAMILY', 'FRIENDS'],
    badges: ['BEST_VALUE', 'POPULAR'],
    included: [
      'One night aboard a traditional wooden junk',
      'All meals from lunch on day one to breakfast on day two',
      'Kayak hire and a guided paddle through Luon cave',
      'Round-trip transfer from Hanoi old quarter',
      'English-speaking guide for the full trip',
    ],
    excluded: [
      'International and domestic flights',
      'Travel insurance',
      'Drinks outside the welcome tea service',
      'Tips for the crew',
    ],
    highlights: [
      'Wake up anchored between limestone karsts, before the day boats arrive',
      'Paddle into a cave that only opens at low tide',
      'Cook spring rolls with the boat chef on the sun deck',
    ],
    meetingPoint: 'Hanoi Opera House, west steps — 7:45am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Hanoi to the bay',
        description:
          'Morning transfer through the delta, boarding at midday, then an afternoon of kayaking before dinner on deck.',
      },
      {
        dayNumber: 2,
        title: 'Sunrise, caves, and back to the city',
        description:
          'Tai chi at first light, a cave walk after breakfast, and a slow cruise back to port for the afternoon road transfer.',
      },
    ],
    faqs: [
      {
        question: 'Do I need to be able to swim?',
        answer:
          'No. Kayaking is optional and every guest wears a buoyancy aid. The crew stays alongside in a tender for the whole paddle.',
      },
      {
        question: 'What happens if the weather turns?',
        answer:
          'The harbour authority can close the bay at short notice. When that happens we move you to the next available departure at no cost, or refund in full.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 7 days before departure',
        body: 'Cancel more than seven days ahead and you get a full refund. Between seven days and 48 hours we hold 50%. Inside 48 hours the departure is non-refundable, because the boat crew and provisions are already committed.',
      },
      {
        kind: 'BOOKING',
        title: 'Deposit and balance',
        body: 'A deposit confirms your seats and the balance falls due 14 days before departure. Bookings made inside 14 days are payable in full at checkout.',
      },
    ],
    departures: [
      {
        id: 'd1a00001-0000-4000-8000-000000000001',
        startDate: '2026-08-21',
        endDate: '2026-08-22',
        seatsLeft: 4,
        effectivePrice: '175.00',
        compareAtPrice: '236.00',
      },
      {
        id: 'd1a00001-0000-4000-8000-000000000002',
        startDate: '2026-09-04',
        endDate: '2026-09-05',
        seatsLeft: 9,
        effectivePrice: '189.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00001-0000-4000-8000-000000000003',
        startDate: '2026-09-18',
        endDate: '2026-09-19',
        seatsLeft: 0,
        effectivePrice: '189.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00001-0000-4000-8000-000000000004',
        startDate: '2026-10-02',
        endDate: '2026-10-03',
        seatsLeft: 12,
        effectivePrice: '199.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    // Tour MỚI mở bán: chưa ai đánh giá (ratingAvg null ≠ 0), chưa mở đợt nào.
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e41',
    slug: 'phu-quoc-reef-days',
    title: 'Phú Quốc Reef Days',
    summary: null,
    basePrice: '340.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: null,
    maxGroupSize: 8,
    isFeatured: false,
    destinations: [{ slug: 'phu-quoc', name: 'Phú Quốc', isPrimary: true }],
    category: { slug: 'beaches', name: 'Beaches & islands' },
    ratingAvg: null,
    ratingCount: 0,
    suitableFor: ['COUPLE', 'SOLO'],
    badges: ['NEW'],
    included: ['Three nights in a beachfront guesthouse', 'Two guided snorkel trips', 'Airport transfers'],
    excluded: ['Flights to the island', 'Lunch and dinner', 'Dive certification'],
    highlights: [
      'Snorkel the An Thới archipelago before the tour boats arrive',
      'Eat at the night market with a guide who grew up on the island',
    ],
    meetingPoint: null,
    itinerary: [
      { dayNumber: 1, title: 'Arrive and settle in', description: null },
      {
        dayNumber: 2,
        title: 'The southern reefs',
        description: 'A full day on the water with two snorkel stops and lunch cooked aboard.',
      },
      { dayNumber: 3, title: 'Slow morning, late flight', description: null },
    ],
    faqs: [],
    policies: [
      {
        kind: 'GENERAL',
        title: 'Reef conduct',
        body: 'We hand out reef-safe sunscreen and ask you to use it. Touching or standing on coral ends the snorkel session for the whole group — the reefs here are recovering and we would rather lose a booking than a reef.',
      },
    ],
    departures: [],
  },
  {
    // Tour DÀI, độ khó cao — ép nhánh CHALLENGING và itinerary nhiều ngày.
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e42',
    slug: 'ha-giang-loop-expedition',
    title: 'Hà Giang Loop Expedition',
    summary:
      'Eight days riding the northern frontier — hairpin passes, market towns, and nights in stilt houses above the Nho Quế river.',
    basePrice: '1480.00',
    compareAtPrice: '1690.00',
    currency: 'USD',
    durationDays: 8,
    difficulty: 'CHALLENGING',
    maxGroupSize: 10,
    isFeatured: true,
    destinations: [
      { slug: 'sa-pa', name: 'Sa Pa', isPrimary: true },
      { slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: false },
    ],
    category: { slug: 'trekking', name: 'Trekking' },
    ratingAvg: 4.7,
    ratingCount: 312,
    suitableFor: ['FRIENDS', 'SOLO'],
    badges: ['EXCLUSIVE', 'LIMITED_OFFER'],
    included: [
      'Seven nights in homestays and small guesthouses',
      'All breakfasts and six dinners',
      'Support vehicle and mechanic for the full loop',
      'Permits for the border zone',
    ],
    excluded: ['Motorbike hire', 'Lunches', 'Travel insurance — mandatory for this trip'],
    highlights: [
      'Ride the Mã Pí Lèng pass with the river a thousand metres below',
      'Sunday market at Đồng Văn, where four language groups trade in one square',
      'Sleep in a stilt house with the family that built it',
    ],
    meetingPoint: 'Hà Giang bus station, main gate — 6:30am',
    // 8 ngày — viết đủ 8 mục, dayNumber 1..8, ít nhất một mục description: null.
    itinerary: [],
    faqs: [
      {
        question: 'Do I need a motorbike licence?',
        answer:
          'Yes, and it must be valid in Vietnam. If you would rather not ride, book the same departure with a driver — say so in your enquiry and we pair you with one.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Cancellation on expedition trips',
        body: 'Permits for the border zone are bought in your name 30 days out and cannot be transferred. Cancel before that and we refund in full minus the deposit; after it, we refund half.',
      },
      {
        kind: 'GENERAL',
        title: 'Fitness and riding experience',
        body: 'Expect six to seven hours in the saddle on the longest days, on roads that are being repaired more or less permanently. This is not a first-week-of-riding trip.',
      },
    ],
    departures: [
      {
        id: 'd1a00003-0000-4000-8000-000000000001',
        startDate: '2026-09-12',
        endDate: '2026-09-19',
        seatsLeft: 2,
        effectivePrice: '1480.00',
        compareAtPrice: '1690.00',
      },
      {
        id: 'd1a00003-0000-4000-8000-000000000002',
        startDate: '2026-10-10',
        endDate: '2026-10-17',
        seatsLeft: 7,
        effectivePrice: '1480.00',
        compareAtPrice: null,
      },
    ],
  },
  // … 13 tour còn lại theo bảng ma trận ở Bước 6
];
```

**Chú ý:** `itinerary: []` của tour thứ ba là chỗ **phải điền đủ 8 ngày** — test
bất biến "itinerary có đúng durationDays ngày" sẽ đỏ cho tới khi điền xong. Đó
là ý đồ: test canh, không phải chép cho có.

- [ ] **Bước 6: Viết 13 tour còn lại theo ma trận**

Mỗi hàng là một tour. Các trường không nêu trong bảng (`included`, `excluded`,
`highlights`, `faqs`, `policies`, `itinerary`, `departures`) viết theo đúng
giọng của ba tour mẫu: câu hoàn chỉnh, tiếng Anh, nói được điều cụ thể về chuyến
đi — **không** dùng chuỗi kiểu "Item 1 / Item 2".

| # | slug | title | category | destinations (primary trước) | days | basePrice | compareAt | difficulty | rating / count | featured | departures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | `sa-pa-terraces-trek` | Sa Pa Terraces Trek | trekking | sa-pa | 3 | `145.00` | null | MODERATE | 4.8 / 897 | true | 3 đợt |
| 5 | `hoi-an-lantern-evening` | Hoi An Lantern Evening | culture | hoi-an | 1 | `59.00` | `72.00` | EASY | 4.9 / 2036 | true | 4 đợt |
| 6 | `hue-imperial-day` | Hue Imperial Day | culture | hue | 1 | `75.00` | null | EASY | 4.7 / 643 | false | 3 đợt |
| 7 | `mekong-delta-boats` | Mekong Delta Boats | cruises | can-tho, sai-gon | 2 | `129.00` | null | EASY | 4.8 / 758 | false | 3 đợt |
| 8 | `da-nang-coast-ride` | Da Nang Coast Ride | scenic | da-nang, hue | 1 | `89.00` | null | MODERATE | 4.6 / 512 | false | 2 đợt |
| 9 | `ninh-binh-river-caves` | Ninh Binh River Caves | scenic | ninh-binh | 1 | `68.00` | `85.00` | EASY | 4.8 / 941 | false | 4 đợt |
| 10 | `saigon-street-food-night` | Saigon Street Food Night | food | sai-gon | 1 | `45.00` | null | EASY | 4.9 / 1533 | true | 4 đợt |
| 11 | `hoi-an-cooking-market` | Hoi An Market and Kitchen | food | hoi-an | 1 | `62.00` | null | EASY | 4.9 / 1108 | false | 3 đợt |
| 12 | `can-tho-floating-dawn` | Can Tho Floating Dawn | food | can-tho | 2 | `118.00` | null | EASY | 4.7 / 402 | false | 2 đợt |
| 13 | `north-to-south-classic` | North to South Classic | culture | ha-long, hue, hoi-an, sai-gon | 12 | `1290.00` | `1450.00` | MODERATE | 4.8 / 268 | true | 3 đợt |
| 14 | `sa-pa-homestay-weekend` | Sa Pa Homestay Weekend | trekking | sa-pa | 2 | `132.00` | null | MODERATE | **null / 0** | false | 2 đợt |
| 15 | `phu-quoc-sunset-sail` | Phu Quoc Sunset Sail | cruises | phu-quoc | 1 | `78.00` | null | EASY | 4.6 / 289 | false | 4 đợt |
| 16 | `central-heritage-week` | Central Heritage Week | culture | hue, hoi-an, da-nang | 6 | `740.00` | null | EASY | 4.7 / 355 | false | 3 đợt |

Ràng buộc phải thoả (test đã canh sẵn ở Bước 3):

- Cả **9** slug destination phải xuất hiện ít nhất một lần trên toàn bảng.
- Ít nhất một đợt nữa có `seatsLeft: 0` ngoài tour #1.
- Mọi `startDate` nằm sau 27/07/2026 và sort tăng dần trong từng tour.
- `itinerary.length === durationDays` cho **mọi** tour — tour #13 cần 12 mục,
  tour #16 cần 6 mục.
- Mọi tour có `compareAtPrice` thì giá gạch phải lớn hơn `basePrice`.

- [ ] **Bước 7: Chạy test — phải XANH**

```bash
pnpm --filter @tourism/web test -- src/mocks/mocks.spec.ts
```

Kỳ vọng: PASS toàn bộ. Đỏ ở đâu thì sửa **dữ liệu**, không sửa test.

- [ ] **Bước 8: Typecheck — bắt mọi chỗ còn dùng `MockTour`**

```bash
pnpm --filter @tourism/web typecheck
```

Kỳ vọng: sạch. Nếu còn lỗi trỏ vào `MockTour` nghĩa là còn file tham chiếu kiểu
đã xoá — sửa file đó.

- [ ] **Bước 9: Commit**

```bash
pnpm lint:fix
git add apps/web/src/mocks/ apps/web/src/components/home/
git commit -m "feat(web): đắp lại mock tour theo hình dạng TourCard/TourDetailSchema"
```

---

### Task 4: `lib/tours.ts` — toàn bộ logic thuần

**Files:**
- Create: `apps/web/src/lib/tours.ts`, `apps/web/src/lib/tours.spec.ts`

**Interfaces:**
- Consumes: `MockTourCard`/`MockTourDetail` (Task 3) · `foldAccents` (Task 2)
- Produces:
  - `tourCategories(tours): { slug: string; name: string; count: number }[]`
  - `filterToursByCategory(tours, categorySlug?)` · `filterToursByDestination(tours, destinationSlug?)` · `filterToursByFeatured(tours, featured?)`
  - `searchTours(tours, query): T[]`
  - `type TourSortKey = 'createdAt' | 'basePrice' | 'durationDays' | 'title'`
  - `sortTours(tours, key: TourSortKey, order: 'asc' | 'desc'): T[]`
  - `routeChain(destinations): { slug: string; name: string; isPrimary: boolean }[]`
  - `discountPercent(basePrice: string, compareAtPrice: string | null): number | null`
  - `formatMoney(amount: string, currency: string): string`
  - `type DepartureStatus = 'sold-out' | 'limited' | 'available'`
  - `departureStatus(seatsLeft: number): DepartureStatus`
  - `formatDateRange(startDate: string, endDate: string): string`
  - `groupPoliciesByKind(policies)` → mảng `{ kind, items }` thứ tự cố định
  - `relatedTours(tours, slug, limit): MockTourCard[]`

- [ ] **Bước 1: Viết test thất bại**

`apps/web/src/lib/tours.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TOURS } from '@/mocks/tours';
import {
  departureStatus,
  discountPercent,
  filterToursByCategory,
  filterToursByDestination,
  filterToursByFeatured,
  formatDateRange,
  formatMoney,
  groupPoliciesByKind,
  relatedTours,
  routeChain,
  searchTours,
  sortTours,
  tourCategories,
} from './tours';

describe('tourCategories', () => {
  it('trả chuyên mục duy nhất kèm số tour, giữ thứ tự xuất hiện', () => {
    const cats = tourCategories(TOURS);
    expect(new Set(cats.map((c) => c.slug)).size).toBe(cats.length);
    expect(cats.reduce((sum, c) => sum + c.count, 0)).toBe(TOURS.length);
  });
});

describe('filterToursByCategory', () => {
  it('không truyền slug thì trả nguyên danh sách', () => {
    expect(filterToursByCategory(TOURS, undefined)).toHaveLength(TOURS.length);
  });

  it('slug lạ cho mảng RỖNG — không âm thầm rơi về "All"', () => {
    expect(filterToursByCategory(TOURS, 'khong-ton-tai')).toEqual([]);
  });

  it('lọc đúng theo slug chuyên mục', () => {
    const result = filterToursByCategory(TOURS, 'trekking');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.category.slug === 'trekking')).toBe(true);
  });
});

describe('filterToursByDestination', () => {
  it('mọi kết quả đều thật sự đi qua destination đó', () => {
    const result = filterToursByDestination(TOURS, 'ninh-binh');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.destinations.some((d) => d.slug === 'ninh-binh'))).toBe(true);
  });

  it('khớp cả khi destination chỉ là chặng PHỤ, không phải primary', () => {
    // ha-long-bay-cruise có primary = ha-long, ninh-binh là chặng phụ.
    // Nexora so theo tên destination CHÍNH nên bỏ lọt đúng trường hợp này.
    const result = filterToursByDestination(TOURS, 'ninh-binh');
    const halong = result.find((t) => t.slug === 'ha-long-bay-cruise');
    expect(halong).toBeDefined();
    expect(halong?.destinations.find((d) => d.slug === 'ninh-binh')?.isPrimary).toBe(false);
  });

  it('không truyền slug thì trả nguyên danh sách', () => {
    expect(filterToursByDestination(TOURS, undefined)).toHaveLength(TOURS.length);
  });

  it('slug lạ cho mảng rỗng', () => {
    expect(filterToursByDestination(TOURS, 'khong-ton-tai')).toEqual([]);
  });
});

describe('filterToursByFeatured', () => {
  it('undefined nghĩa là KHÔNG lọc, khác hẳn false', () => {
    expect(filterToursByFeatured(TOURS, undefined)).toHaveLength(TOURS.length);
  });
  it('true chỉ giữ tour featured', () => {
    expect(filterToursByFeatured(TOURS, true).every((t) => t.isFeatured)).toBe(true);
  });
  it('false chỉ giữ tour KHÔNG featured', () => {
    expect(filterToursByFeatured(TOURS, false).every((t) => !t.isFeatured)).toBe(true);
  });
});

describe('searchTours', () => {
  it('bỏ dấu hai phía — gõ không dấu vẫn ra địa danh có dấu', () => {
    expect(searchTours(TOURS, 'ha long').map((t) => t.slug)).toContain('ha-long-bay-cruise');
  });
  it('tìm cả trong tên destination, không chỉ tiêu đề', () => {
    expect(searchTours(TOURS, 'ninh binh').length).toBeGreaterThan(0);
  });
  it('chuỗi rỗng trả nguyên danh sách', () => {
    expect(searchTours(TOURS, '   ')).toHaveLength(TOURS.length);
  });
  it('tour có summary null không làm hàm nổ', () => {
    expect(() => searchTours(TOURS, 'reef')).not.toThrow();
  });
});

describe('sortTours', () => {
  it('basePrice so sánh theo SỐ dù lưu chuỗi — "89.00" phải nhỏ hơn "1480.00"', () => {
    const asc = sortTours(TOURS, 'basePrice', 'asc').map((t) => Number(t.basePrice));
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });
  it('durationDays sắp tăng dần đúng', () => {
    const asc = sortTours(TOURS, 'durationDays', 'asc').map((t) => t.durationDays);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });
  it('title dùng localeCompare, không so mã ký tự', () => {
    const asc = sortTours(TOURS, 'title', 'asc').map((t) => t.title);
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
  });
  it('createdAt desc giữ NGUYÊN thứ tự mảng mock', () => {
    expect(sortTours(TOURS, 'createdAt', 'desc').map((t) => t.slug)).toEqual(
      TOURS.map((t) => t.slug),
    );
  });
  it('createdAt asc là mảng đảo ngược', () => {
    expect(sortTours(TOURS, 'createdAt', 'asc').map((t) => t.slug)).toEqual(
      [...TOURS].reverse().map((t) => t.slug),
    );
  });
  it('không sửa mảng gốc tại chỗ', () => {
    const before = TOURS.map((t) => t.slug);
    sortTours(TOURS, 'basePrice', 'asc');
    expect(TOURS.map((t) => t.slug)).toEqual(before);
  });
});

describe('routeChain', () => {
  it('primary đứng đầu, phần còn lại giữ nguyên thứ tự', () => {
    const chain = routeChain([
      { slug: 'b', name: 'B', isPrimary: false },
      { slug: 'a', name: 'A', isPrimary: true },
      { slug: 'c', name: 'C', isPrimary: false },
    ]);
    expect(chain.map((d) => d.slug)).toEqual(['a', 'b', 'c']);
  });
  it('mảng rỗng trả mảng rỗng', () => {
    expect(routeChain([])).toEqual([]);
  });
});

describe('discountPercent', () => {
  it('làm tròn xuống phần trăm giảm', () => {
    expect(discountPercent('175.00', '236.00')).toBe(25);
  });
  it('không có giá gạch thì trả null', () => {
    expect(discountPercent('189.00', null)).toBeNull();
  });
  it('giá gạch KHÔNG cao hơn giá gốc thì trả null — không hiện −0% hay số âm', () => {
    expect(discountPercent('189.00', '189.00')).toBeNull();
    expect(discountPercent('189.00', '100.00')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('định dạng USD không phần lẻ', () => {
    expect(formatMoney('189.00', 'USD')).toBe('$189');
  });
  it('giữ nguyên độ chính xác của chuỗi lớn', () => {
    expect(formatMoney('1480.00', 'USD')).toBe('$1,480');
  });
});

describe('departureStatus', () => {
  it('0 ghế là hết chỗ', () => {
    expect(departureStatus(0)).toBe('sold-out');
  });
  it('1..3 ghế là sắp hết', () => {
    expect(departureStatus(1)).toBe('limited');
    expect(departureStatus(3)).toBe('limited');
  });
  it('từ 4 ghế trở lên là còn chỗ', () => {
    expect(departureStatus(4)).toBe('available');
  });
});

describe('formatDateRange', () => {
  it('gộp tháng khi cùng tháng', () => {
    expect(formatDateRange('2026-08-21', '2026-08-30')).toBe('21–30 Aug 2026');
  });
  it('không gộp khi khác tháng', () => {
    expect(formatDateRange('2026-08-28', '2026-09-04')).toBe('28 Aug – 4 Sep 2026');
  });
  it('khác năm thì hiện cả hai năm', () => {
    expect(formatDateRange('2026-12-28', '2027-01-05')).toBe('28 Dec 2026 – 5 Jan 2027');
  });
});

describe('groupPoliciesByKind', () => {
  it('thứ tự nhóm cố định Cancellation → Booking → General', () => {
    const groups = groupPoliciesByKind([
      { kind: 'GENERAL', title: 'g', body: 'g' },
      { kind: 'BOOKING', title: 'b', body: 'b' },
      { kind: 'CANCELLATION', title: 'c', body: 'c' },
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['CANCELLATION', 'BOOKING', 'GENERAL']);
  });
  it('nhóm rỗng bị loại khỏi kết quả', () => {
    const groups = groupPoliciesByKind([{ kind: 'BOOKING', title: 'b', body: 'b' }]);
    expect(groups.map((g) => g.kind)).toEqual(['BOOKING']);
  });
});

describe('relatedTours', () => {
  it('không bao giờ chứa chính nó', () => {
    const related = relatedTours(TOURS, 'ha-long-bay-cruise', 3);
    expect(related.map((t) => t.slug)).not.toContain('ha-long-bay-cruise');
  });
  it('ưu tiên cùng chuyên mục trước', () => {
    const related = relatedTours(TOURS, 'sa-pa-terraces-trek', 3);
    expect(related[0]?.category.slug).toBe('trekking');
  });
  it('trả đúng số lượng yêu cầu', () => {
    expect(relatedTours(TOURS, 'ha-long-bay-cruise', 3)).toHaveLength(3);
  });
  it('slug lạ vẫn trả danh sách chứ không nổ', () => {
    expect(relatedTours(TOURS, 'khong-ton-tai', 3)).toHaveLength(3);
  });
});
```

- [ ] **Bước 2: Chạy test — phải ĐỎ**

```bash
pnpm --filter @tourism/web test -- src/lib/tours.spec.ts
```

Kỳ vọng: FAIL — không resolve được `./tours`.

- [ ] **Bước 3: Viết `lib/tours.ts`**

```ts
import type { MockTourCard, MockTourDetail } from '@/mocks/types';
import { foldAccents } from './text';

type DestinationLink = MockTourCard['destinations'][number];
type Policy = MockTourDetail['policies'][number];
type PolicyKind = Policy['kind'];

/** Chuyên mục duy nhất kèm số tour — nguồn cho hàng chip lọc. Giữ thứ tự xuất
    hiện trong mảng gốc (không sắp lại) để chip không nhảy chỗ khi thêm tour. */
export function tourCategories(
  tours: readonly MockTourCard[],
): { slug: string; name: string; count: number }[] {
  const map = new Map<string, { slug: string; name: string; count: number }>();
  for (const tour of tours) {
    const existing = map.get(tour.category.slug);
    if (existing) existing.count += 1;
    else map.set(tour.category.slug, { ...tour.category, count: 1 });
  }
  return [...map.values()];
}

/** Lọc theo chuyên mục. Slug lạ (link cũ / gõ tay) phải cho mảng RỖNG để trang
    hiện trạng thái rỗng — KHÔNG âm thầm rơi về "All". Đây đúng là bug đã sửa ở
    /blog: lọc sạch tag lạ thành undefined làm URL vẫn ghi ?tag=… mà lưới hiện
    đủ bài với chip "All" sáng. */
export function filterToursByCategory<T extends MockTourCard>(
  tours: readonly T[],
  categorySlug?: string,
): T[] {
  if (!categorySlug) return [...tours];
  return tours.filter((tour) => tour.category.slug === categorySlug);
}

/** Lọc theo destination — khớp BẤT KỲ điểm nào tour đi qua, không chỉ primary
    (một tour đi qua nhiều nơi; đây là lý do contract trả cả mảng). */
export function filterToursByDestination<T extends MockTourCard>(
  tours: readonly T[],
  destinationSlug?: string,
): T[] {
  if (!destinationSlug) return [...tours];
  return tours.filter((tour) => tour.destinations.some((d) => d.slug === destinationSlug));
}

/** `undefined` = không lọc; `false` = chỉ tour KHÔNG featured. Hai thứ khác nhau,
    đừng gộp bằng falsy check. */
export function filterToursByFeatured<T extends MockTourCard>(
  tours: readonly T[],
  featured?: boolean,
): T[] {
  if (featured === undefined) return [...tours];
  return tours.filter((tour) => tour.isFeatured === featured);
}

/** Tìm trên tiêu đề + tóm tắt + tên destination + tên chuyên mục, bỏ dấu cả hai
    phía. `summary` nullable nên phải hứng null trước khi ghép chuỗi. */
export function searchTours<T extends MockTourCard>(tours: readonly T[], query: string): T[] {
  const q = foldAccents(query.trim());
  if (!q) return [...tours];
  return tours.filter((tour) => {
    const haystack = [
      tour.title,
      tour.summary ?? '',
      tour.category.name,
      ...tour.destinations.map((d) => d.name),
    ].join(' ');
    return foldAccents(haystack).includes(q);
  });
}

export type TourSortKey = 'createdAt' | 'basePrice' | 'durationDays' | 'title';

/**
 * Sắp xếp. Trả mảng MỚI — mock là hằng số dùng chung, sửa tại chỗ là làm hỏng
 * dữ liệu của mọi trang khác.
 *
 * `createdAt` KHÔNG phải field của contract (nó chỉ là sort key phía server, và
 * `TourCardSchema` không trả nó). Quy ước static-first: thứ tự mảng mock CHÍNH
 * LÀ thứ tự `createdAt desc`. Khi gắn API thật, nhánh này biến mất — server sắp
 * hộ và client chỉ truyền `sort=createdAt`.
 */
export function sortTours<T extends MockTourCard>(
  tours: readonly T[],
  key: TourSortKey,
  order: 'asc' | 'desc',
): T[] {
  const sign = order === 'asc' ? 1 : -1;
  if (key === 'createdAt') {
    return order === 'desc' ? [...tours] : [...tours].reverse();
  }
  return [...tours].sort((a, b) => {
    if (key === 'basePrice') {
      // So sánh theo SỐ: "89.00" < "1480.00" về mặt số nhưng ">" về mặt chuỗi.
      return (Number(a.basePrice) - Number(b.basePrice)) * sign;
    }
    if (key === 'durationDays') return (a.durationDays - b.durationDays) * sign;
    return a.title.localeCompare(b.title) * sign;
  });
}

/** Chuỗi chặng: destination chính đứng đầu, phần còn lại giữ nguyên thứ tự
    biên tập. Contract nói primary đứng đầu nhưng không bảo đảm, nên sắp lại ở
    đây thay vì tin vào thứ tự trả về. */
export function routeChain(destinations: readonly DestinationLink[]): DestinationLink[] {
  const primary = destinations.filter((d) => d.isPrimary);
  const rest = destinations.filter((d) => !d.isPrimary);
  return [...primary, ...rest];
}

/** Phần trăm giảm giá, làm tròn xuống. Trả null khi không có giá gạch HOẶC giá
    gạch không cao hơn giá gốc — dữ liệu lệch không được hiện "−0%" hay số âm. */
export function discountPercent(basePrice: string, compareAtPrice: string | null): number | null {
  if (compareAtPrice === null) return null;
  const base = Number(basePrice);
  const compare = Number(compareAtPrice);
  if (!(compare > base)) return null;
  return Math.floor(((compare - base) / compare) * 100);
}

/** Tiền từ chuỗi thập phân sang chữ hiển thị. Number() chỉ dùng ở BƯỚC CUỐI để
    định dạng, không bao giờ để tính tiền — nguồn sự thật vẫn là chuỗi. */
export function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export type DepartureStatus = 'sold-out' | 'limited' | 'available';

/** Trạng thái đợt khởi hành là SUY DIỄN Ở TẦNG UI từ `seatsLeft`, KHÔNG phải
    field của contract — đừng đi tìm `departure.status` khi gắn API. Ngưỡng 3
    là lựa chọn biên tập (spec §6.3), đổi ở đúng một chỗ này. */
export function departureStatus(seatsLeft: number): DepartureStatus {
  if (seatsLeft <= 0) return 'sold-out';
  if (seatsLeft <= 3) return 'limited';
  return 'available';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Dải ngày gọn: gộp phần trùng nhau. `startDate`/`endDate` là ngày lịch
    (YYYY-MM-DD) nên tách bằng chuỗi — KHÔNG dựng `new Date()` vì nó diễn giải
    chuỗi này theo UTC rồi hiển thị theo giờ máy, lệch một ngày ở múi giờ âm. */
export function formatDateRange(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split('-').map(Number) as [number, number, number];
  const [ey, em, ed] = endDate.split('-').map(Number) as [number, number, number];
  const sMonth = MONTHS[sm - 1];
  const eMonth = MONTHS[em - 1];
  if (sy !== ey) return `${sd} ${sMonth} ${sy} – ${ed} ${eMonth} ${ey}`;
  if (sm !== em) return `${sd} ${sMonth} – ${ed} ${eMonth} ${ey}`;
  return `${sd}–${ed} ${sMonth} ${sy}`;
}

// Thứ tự cố định: hủy chuyến là thứ khách lo nhất nên đứng đầu.
const POLICY_ORDER: PolicyKind[] = ['CANCELLATION', 'BOOKING', 'GENERAL'];

/** Gom policy theo `kind` với thứ tự cố định. Nhóm rỗng bị loại — không render
    tiêu đề nhóm trống. */
export function groupPoliciesByKind(
  policies: readonly Policy[],
): { kind: PolicyKind; items: Policy[] }[] {
  return POLICY_ORDER.map((kind) => ({
    kind,
    items: policies.filter((p) => p.kind === kind),
  })).filter((group) => group.items.length > 0);
}

/** Gợi ý cuối trang: cùng chuyên mục trước, rồi tour chia chung destination,
    rồi bù bằng phần còn lại. Nexora cắt 4 tour đầu không xét gì — đừng port. */
export function relatedTours<T extends MockTourCard>(
  tours: readonly T[],
  slug: string,
  limit: number,
): T[] {
  const current = tours.find((tour) => tour.slug === slug);
  const others = tours.filter((tour) => tour.slug !== slug);
  if (!current) return others.slice(0, limit);

  const destinationSlugs = new Set(current.destinations.map((d) => d.slug));
  const sameCategory = others.filter((tour) => tour.category.slug === current.category.slug);
  const sharesDestination = others.filter(
    (tour) =>
      tour.category.slug !== current.category.slug &&
      tour.destinations.some((d) => destinationSlugs.has(d.slug)),
  );
  const filler = others.filter(
    (tour) => !sameCategory.includes(tour) && !sharesDestination.includes(tour),
  );
  return [...sameCategory, ...sharesDestination, ...filler].slice(0, limit);
}
```

- [ ] **Bước 4: Chạy test — phải XANH**

```bash
pnpm --filter @tourism/web test -- src/lib/tours.spec.ts
```

Kỳ vọng: PASS toàn bộ. Nếu `relatedTours` đỏ ở "ưu tiên cùng chuyên mục", kiểm
tra mock #4 (`sa-pa-terraces-trek`) có đúng chuyên mục `trekking` không.

- [ ] **Bước 5: Commit**

```bash
pnpm lint:fix
git add apps/web/src/lib/tours.ts apps/web/src/lib/tours.spec.ts
git commit -m "feat(web): logic lọc/sắp/định dạng tour, test trước"
```

---

### Task 5: `/tours` — hero, card, lưới tĩnh

Mốc này để **nhìn thấy trang**, chưa có tương tác. Lọc/sort/phân trang ở Task 6.

**Files:**
- Create: `apps/web/src/components/tours/tours-hero.tsx`
- Create: `apps/web/src/components/tours/tour-card.tsx`
- Create: `apps/web/src/app/(site)/tours/page.tsx`
- Modify: `libs/shared/i18n/src/lib/messages.ts`

**Interfaces:**
- Consumes: `TOURS` · `routeChain`, `discountPercent`, `formatMoney`, `tourCategories`
- Produces: `<ToursHero eyebrow title subtitle searchSlot? />` ·
  `<TourCard tour={MockTourCard} />`

- [ ] **Bước 1: Cắt copy i18n nói dối**

Trong `libs/shared/i18n/src/lib/messages.ts`, khối `toursPage` (dòng ~1401):

- Xoá: `sortOptions.popular`, `sortOptions.rating`, `facets.duration`,
  `facets.price`, `facets.travelStyle`, `facets.theme`, `durationLabels`,
  `priceLabels`, `styleLabels`, `themeLabels`.
- Thêm vào `sortOptions`: `newest: 'Newest first'`, `durationAsc: 'Duration: short to long'`,
  `titleAsc: 'Name: A to Z'`.
- Sửa `title` từ `'All tours'` thành `'Every journey we run'` — H1 là chỗ trang
  cất tiếng nói, `'All tours'` là nhãn điều hướng chứ không phải tiêu đề. Nếu
  user muốn giữ nhãn trung tính thì đổi lại ở đúng một chỗ này.
- Sửa `subtitle` thành:
  `'Browse every journey we run — filter by category or destination to find the trip that fits you.'`
- Thêm: `resultSummary: (n: number, d: number) => \`${n} ${n === 1 ? 'tour' : 'tours'} across ${d} destinations\``
- Thêm: `notRated: 'Not yet reviewed'`
- Thêm: `featuredLabel: 'Featured'`
- Thêm: `allCategories: 'All'`

Trong khối `tourDetail` (dòng ~1465), xoá: `gallery`, `mealsLabel`,
`specs.accommodation`, `specs.travelStyle`, `specs.theme`.

Đặt comment tiếng Việt phía trên khối `toursPage`:

```ts
// CẢNH BÁO đã trả giá một lần: copy này port trọn gói từ Nexora nên từng mô tả
// filter/sort mà API v2 KHÔNG phục vụ được (duration/price/travelStyle/theme,
// sort theo rating). Đã cắt 27/07. Trước khi thêm key mới, đối chiếu
// ToursListQuerySchema — copy không phải bằng chứng tính năng tồn tại.
```

- [ ] **Bước 2: Chạy test i18n**

```bash
pnpm --filter @tourism/i18n test
```

Kỳ vọng: PASS. Đỏ nghĩa là có test đang khẳng định key vừa xoá — đọc test đó,
nếu nó canh key chết thì sửa test, ghi lý do trong commit.

- [ ] **Bước 3: Viết `ToursHero`**

`apps/web/src/components/tours/tours-hero.tsx`. Mượn **kết cấu** của
`components/content/content-hero.tsx` (scope `dark`, `TopoPattern`, scrim
gradient, spring animation) nhưng là component riêng vì nó mang thêm ô search
và dòng đếm trên H1:

```tsx
'use client';

import { ChevronRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { TopoPattern } from '@/components/topo-pattern';

// Hero riêng cho listing tour. KHÔNG tái dùng ContentHero: cái đó phục vụ trang
// nội dung dài (breadcrumb + title + meta + subtitle) và thêm ô search vào là
// biến nó thành phễu prop. Chung TopoPattern + scrim + nhịp spring là đủ để hai
// trang cảm thấy cùng một sản phẩm.
// Band phải TỐI — hero sáng làm navbar trong suốt bị tàng hình.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function ToursHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  /** Dòng đếm đặt TRÊN H1 — "16 tours across 9 destinations". */
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Ô tìm kiếm; nhận qua children vì nó là client state của ToursExplorer. */
  children?: ReactNode;
}) {
  return (
    <section className="dark relative w-full overflow-hidden bg-background px-4 pt-36 pb-14 text-foreground md:px-16 md:pb-16 lg:px-24 xl:px-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />
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
            Tours
          </span>
        </motion.nav>

        {/* Số kết quả đặt TRÊN H1 dạng câu chữ (mẫu GetYourGuide/G Adventures),
            không phải label khô cạnh dropdown sort. */}
        <motion.p
          className="mt-8 font-mono text-xs tracking-widest text-muted-foreground uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, ...SPRING }}
        >
          {eyebrow}
        </motion.p>

        <motion.h1
          className="mt-3 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          {title}
        </motion.h1>

        <motion.p
          className="mt-4 max-w-2xl text-pretty text-muted-foreground"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, ...SPRING }}
        >
          {subtitle}
        </motion.p>

        {children ? <div className="mt-8 max-w-md">{children}</div> : null}
      </div>
    </section>
  );
}
```

- [ ] **Bước 4: Viết `TourCard`**

`apps/web/src/components/tours/tour-card.tsx`. Giữ nguyên kết cấu thị giác của
card cũ (`Card` không padding trên, ảnh hover scale, footer giá + hành động),
đổi nguồn field:

```tsx
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { messages } from '@tourism/i18n';
import { HeartIcon, StarIcon, UsersIcon } from 'lucide-react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { discountPercent, formatMoney, routeChain } from '@/lib/tours';
import type { MockTourCard } from '@/mocks/types';

const DIFFICULTY_LABEL: Record<NonNullable<MockTourCard['difficulty']>, string> = {
  EASY: 'Easy',
  MODERATE: 'Moderate',
  CHALLENGING: 'Challenging',
};

// Card tour chuẩn — giữ thiết kế đã chốt ở trang Home, đổi nguồn sang field
// contract. Dùng cho listing, sau này cả trang vùng và wishlist.
export function TourCard({ tour }: { tour: MockTourCard }) {
  const chain = routeChain(tour.destinations);
  const primary = chain[0];
  const discount = discountPercent(tour.basePrice, tour.compareAtPrice);

  return (
    <Card className="group pt-0 transition-shadow hover:shadow-(--shadow-dropdown)">
      <div className="relative">
        {/* Trợ năng: KHÔNG dùng tour.title làm nhãn ảnh — nó trùng y hệt
            <CardTitle> ngay dưới, trình đọc màn hình đọc tiêu đề hai lần.
            Dùng tên destination chính làm mô tả riêng cho ảnh. */}
        <ImagePlaceholder
          label={primary?.name}
          className="aspect-(--aspect-card) w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {discount !== null ? (
          <Badge variant="destructive" className="absolute top-3 left-3">
            −{discount}%
          </Badge>
        ) : tour.isFeatured ? (
          <Badge className="absolute top-3 left-3">{messages.toursPage.featuredLabel}</Badge>
        ) : null}
      </div>

      <CardHeader>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {tour.category.name}
        </p>
        <CardTitle className="text-lg">
          <a href={`/tours/${tour.slug}`} className="after:absolute after:inset-0">
            {tour.title}
          </a>
        </CardTitle>
        {/* Chuỗi chặng — thứ duy nhất phân biệt card tour với card khách sạn.
            Điểm chính đậm, các chặng sau nhạt dần. */}
        <CardDescription className="font-mono text-xs">
          {chain.map((dest, i) => (
            <span key={dest.slug}>
              {i > 0 ? <span aria-hidden="true"> → </span> : null}
              <span className={dest.isPrimary ? 'font-medium text-foreground' : undefined}>
                {dest.name}
              </span>
            </span>
          ))}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {tour.durationDays} {tour.durationDays === 1 ? 'day' : 'days'}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <UsersIcon className="size-3!" aria-hidden="true" />
          max {tour.maxGroupSize}
        </Badge>
        {tour.difficulty ? (
          <Badge variant="secondary">{DIFFICULTY_LABEL[tour.difficulty]}</Badge>
        ) : null}

        {/* ratingAvg null = CHƯA AI đánh giá. Bỏ hẳn dòng sao thay vì hiện
            "0.0" hay 5 sao rỗng — mẫu GetYourGuide. */}
        <span className="ml-auto text-sm text-muted-foreground">
          {tour.ratingAvg === null ? (
            <span className="text-xs">{messages.toursPage.notRated}</span>
          ) : (
            <span className="flex items-center gap-1">
              <StarIcon className="size-3.5! fill-rating text-rating" aria-hidden="true" />
              <span className="font-medium text-foreground">{tour.ratingAvg}</span>(
              {tour.ratingCount.toLocaleString('en-US')})
            </span>
          )}
        </span>
      </CardContent>

      <CardFooter className="items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {formatMoney(tour.basePrice, tour.currency)}
        </span>
        {tour.compareAtPrice ? (
          <span className="text-sm text-price-compare tabular-nums line-through">
            {formatMoney(tour.compareAtPrice, tour.currency)}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">/ {messages.toursPage.perPerson}</span>
        <span className="relative z-10 ml-auto">
          <Button variant="ghost" size="icon-sm" aria-label={`Save ${tour.title} to wishlist`}>
            <HeartIcon />
          </Button>
        </span>
      </CardFooter>
    </Card>
  );
}
```

Ghi chú kỹ thuật cần giữ: `after:absolute after:inset-0` trên link tiêu đề biến
cả card thành vùng bấm; nút wishlist phải `relative z-10` để nổi lên trên lớp
phủ đó, nếu không bấm tim lại mở trang tour.

- [ ] **Bước 5: Viết `/tours/page.tsx` — lưới tĩnh**

```tsx
import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { TourCard } from '@/components/tours/tour-card';
import { ToursHero } from '@/components/tours/tours-hero';
import { DESTINATIONS } from '@/mocks/destinations';
import { TOURS } from '@/mocks/tours';

export const metadata: Metadata = {
  title: 'Tours — Tourism',
  description: messages.toursPage.subtitle,
  alternates: { canonical: '/tours' },
};

export default function ToursPage() {
  return (
    <>
      <ToursHero
        eyebrow={messages.toursPage.resultSummary(TOURS.length, DESTINATIONS.length)}
        title={messages.toursPage.title}
        subtitle={messages.toursPage.subtitle}
      />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOURS.map((tour) => (
            <TourCard key={tour.slug} tour={tour} />
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Bước 6: Xem trang thật trên dev server đang chạy**

Dev server của user ở cổng 3000 — **không** khởi động thêm, **không** chạy
`next build`. Chụp ảnh kiểm tra:

```bash
npx playwright screenshot --viewport-size=1440,2400 --full-page http://localhost:3000/tours /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/tours-grid.png
```

Kiểm bằng mắt: hero tối và navbar đọc được · 16 card chia 3 cột · chuỗi chặng
hiện đúng mũi tên · card `phu-quoc-reef-days` hiện "Not yet reviewed" chứ không
phải "0.0" · card `ha-long-bay-cruise` có chip `−25%`.

- [ ] **Bước 7: Typecheck + test**

```bash
pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web test
```

Kỳ vọng: sạch và xanh.

- [ ] **Bước 8: Commit**

```bash
pnpm lint:fix
git add apps/web/src/components/tours/ apps/web/src/app/\(site\)/tours/ libs/shared/i18n/src/lib/messages.ts
git commit -m "feat(web): trang /tours — hero tối, card tour theo field contract, lưới tĩnh"
```

---

### Task 6: `ToursExplorer` — lọc, tìm, sắp xếp, phân trang

**Files:**
- Create: `apps/web/src/components/tours/tours-explorer.tsx`
- Create: `apps/web/src/components/tours/tours-explorer.spec.tsx`
- Create: `apps/web/src/components/tours/tour-toolbar.tsx`
- Create: `apps/web/src/components/tours/pagination-bar.tsx`
- Modify: `apps/web/src/app/(site)/tours/page.tsx`

**Interfaces:**
- Consumes: mọi hàm của `lib/tours` + `paginate`/`pageNumbers` của `lib/paginate`
- Produces: `<ToursExplorer tours categories destinations initial={{category,destination,featured,q,sort,page}} />`

- [ ] **Bước 1: Viết test component thất bại**

`apps/web/src/components/tours/tours-explorer.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DESTINATIONS } from '@/mocks/destinations';
import { TOURS } from '@/mocks/tours';
import { tourCategories } from '@/lib/tours';
import { ToursExplorer } from './tours-explorer';

// next/navigation không chạy ngoài Next runtime — thay bằng đôi giả để kiểm
// đúng thứ ToursExplorer hứa: mỗi lần đổi bộ lọc thì URL được ghi lại.
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tours',
}));

function renderExplorer(initial = {}) {
  return render(
    <ToursExplorer
      tours={TOURS}
      categories={tourCategories(TOURS)}
      destinations={DESTINATIONS}
      initial={initial}
    />,
  );
}

describe('ToursExplorer', () => {
  it('mặc định hiện 12 tour đầu — đúng limit của contract', () => {
    renderExplorer();
    expect(screen.getAllByRole('article')).toHaveLength(12);
  });

  it('công bố tổng số kết quả qua vùng aria-live', () => {
    renderExplorer();
    expect(screen.getByRole('status')).toHaveTextContent('16 tours');
  });

  it('chọn chip chuyên mục thì lọc và ghi vào URL', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Trekking' }));
    expect(replace).toHaveBeenCalledWith('/tours?category=trekking', { scroll: false });
  });

  it('chuyên mục lạ trong URL cho trạng thái RỖNG, không âm thầm hiện hết', () => {
    renderExplorer({ category: 'khong-ton-tai' });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText(/no tours match/i)).toBeInTheDocument();
  });

  it('nút xoá bộ lọc đưa danh sách về đủ 12 card của trang 1', async () => {
    const user = userEvent.setup();
    renderExplorer({ category: 'khong-ton-tai' });
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.getAllByRole('article')).toHaveLength(12);
  });

  it('trang 2 hiện 4 tour còn lại', () => {
    renderExplorer({ page: 2 });
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('lọc xong thì thanh phân trang biến mất khi chỉ còn 1 trang', () => {
    renderExplorer({ category: 'trekking' });
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
  });
});
```

Cần thêm devDep: `pnpm --filter @tourism/web add -D @testing-library/user-event`

- [ ] **Bước 2: Chạy test — phải ĐỎ**

```bash
pnpm --filter @tourism/web test -- src/components/tours/tours-explorer.spec.tsx
```

Kỳ vọng: FAIL — không resolve được `./tours-explorer`.

- [ ] **Bước 3: Viết `PaginationBar`**

⚠️ `@tourism/ui` **đã có** `components/pagination.tsx` (shadcn vendored). Mở nó
ra trước; nếu nó phủ được nhu cầu thì dùng thẳng thay vì dựng lại — chỉ giữ
`pageNumbers()` để sinh dãy số. Code dưới đây là bản tự dựng, chỉ dùng khi
component có sẵn không khớp (ví dụ nó ép dùng `<a href>` mà ta cần `onClick`
để không reload trang).

```tsx
'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { pageNumbers } from '@/lib/paginate';

// Phân trang ĐÁNH SỐ (không "Load more"): back-button hoạt động đúng, URL chia
// sẻ được và crawler đi hết được catalogue. Tự ẩn khi chỉ có 0–1 trang.
export function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const numbers = pageNumbers(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </button>

      {numbers.map((entry, i) =>
        entry === 'ellipsis' ? (
          // Key theo vị trí là hợp lệ ở đây: hai ellipsis không phân biệt được
          // bằng giá trị, và dãy chỉ đổi khi page/totalPages đổi.
          <span key={`gap-${i}`} aria-hidden="true" className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={`size-9 cursor-pointer rounded-full text-sm tabular-nums transition-colors ${
              entry === page
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
```

- [ ] **Bước 4: Viết `TourToolbar`**

Thanh dính chứa: chip rail chuyên mục (cuộn ngang, có `All` dẫn đầu) · dòng
đếm + chip bộ lọc đang bật có nút xoá + `Clear all` · select destination ·
toggle `Featured` · select sort.

Yêu cầu bắt buộc:
- Bọc `sticky top-(--banner-offset) z-(--z-sticky)` + nền `bg-background/80 backdrop-blur`.
- Chip chuyên mục là `<button>` với `aria-pressed`.
- Dòng đếm là `<p role="status" aria-live="polite">`.
- Mỗi chip bộ lọc đang bật có `aria-label={`Remove filter ${label}`}`.
- Trên `<md`, gom destination + featured + sort vào `Sheet` của `@tourism/ui`
  với nút mở ghi `Filters (n)` — `n` là số bộ lọc đang bật.
- Nhãn select sort lấy từ `messages.toursPage.sortOptions`; 4 lựa chọn ánh xạ
  sang `TourSortKey` + order: `newest`→`createdAt/desc`, `priceAsc`→`basePrice/asc`,
  `priceDesc`→`basePrice/desc`, `durationAsc`→`durationDays/asc`, `titleAsc`→`title/asc`.

- [ ] **Bước 5: Viết `ToursExplorer`**

Ghép mọi thứ. Điểm bắt buộc, chép đúng mẫu URL-sync đã chạy thật ở
`components/blog/blog-explorer.tsx:37-50`:

```tsx
// Bỏ qua lần mount đầu: URL lúc đó đã đúng rồi (server render theo chính nó),
// replace lại là ghi đè vô ích và đá trang về đầu.
const firstRender = useRef(true);
useEffect(() => {
  if (firstRender.current) {
    firstRender.current = false;
    return;
  }
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (destination) params.set('destination', destination);
  if (featured) params.set('featured', 'true');
  if (query.trim()) params.set('q', query.trim());
  if (sortValue !== 'newest') params.set('sort', sortValue);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}, [category, destination, featured, query, sortValue, page, pathname, router]);
```

Quy tắc phải giữ:
- **Đổi bất kỳ bộ lọc nào thì `page` về 1.** Không thì lọc còn 3 tour mà đang ở
  trang 2 sẽ ra màn hình trắng.
- Thứ tự áp: `filterToursByCategory` → `filterToursByDestination` →
  `filterToursByFeatured` → `searchTours` → `sortTours` → `paginate`.
- Mỗi `TourCard` bọc trong phần tử có `role="article"` (test đếm theo role này).
- Trạng thái rỗng dùng đúng copy `messages.toursPage.empty`.
- Truyền `tours` **đã lọc trước khi phân trang** vào dòng đếm, không phải mảng gốc.

- [ ] **Bước 6: Nối vào `page.tsx`**

Đọc `searchParams` rồi truyền xuống làm `initial`. Truyền **thô**, không lọc
sạch giá trị lạ — slug lạ phải cho trạng thái rỗng, không phải 404 và không âm
thầm rơi về "All" (đúng bug đã sửa ở `/blog`).

```tsx
export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    destination?: string;
    featured?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const initial = {
    category: params.category,
    destination: params.destination,
    featured: params.featured === 'true',
    q: params.q,
    sort: params.sort,
    page: Number(params.page) || 1,
  };
  // …
}
```

- [ ] **Bước 7: Chạy test — phải XANH**

```bash
pnpm --filter @tourism/web test
```

Kỳ vọng: PASS cả project `node` lẫn `dom`.

- [ ] **Bước 8: Kiểm bằng mắt trên dev server**

```bash
npx playwright screenshot --viewport-size=1440,2000 --full-page "http://localhost:3000/tours?category=trekking" /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/tours-filtered.png
npx playwright screenshot --viewport-size=390,1600 --full-page http://localhost:3000/tours /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/tours-mobile.png
```

Kiểm: toolbar dính không đè navbar · chip `Trekking` sáng · dòng đếm khớp ·
mobile có nút `Filters` mở được drawer.

- [ ] **Bước 9: Commit**

```bash
pnpm lint:fix
git add apps/web/src/components/tours/ apps/web/src/app/\(site\)/tours/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): lọc/tìm/sắp xếp/phân trang cho /tours, trạng thái ghi vào URL"
```

---

### Task 7: `loading.tsx` + `LoadErrorState` + vá link chết navbar

**Files:**
- Create: `apps/web/src/app/(site)/tours/loading.tsx`
- Create: `apps/web/src/components/feedback/load-error-state.tsx`
- Modify: `apps/web/src/components/site-header.tsx`
- Modify: `apps/web/src/components/destinations-menu.tsx`

**Interfaces:**
- Consumes: `messages.toursPage.loadError`
- Produces: `<LoadErrorState title body onRetry? />`

- [ ] **Bước 1: Viết `LoadErrorState`**

```tsx
import { AlertTriangleIcon } from 'lucide-react';

// Phân biệt "API chết" với "rỗng thật". Nexora ghi thẳng bài học này trong
// comment app/tours/page.tsx: hiện "No tours match your filters" khi API lỗi là
// NÓI DỐI người dùng — họ sẽ đi gỡ bộ lọc mà chẳng bao giờ thấy tour.
//
// Ở cụm tĩnh này chưa có API để mà lỗi, nên đây là khung dựng sẵn chưa có dữ
// liệu chạy qua. Dựng bây giờ vì rẻ hơn nhét vào lúc wire API.
export function LoadErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
      className="mt-8 rounded-2xl border border-dashed border-destructive/40 p-12 text-center"
    >
      <AlertTriangleIcon
        className="mx-auto size-6 text-destructive"
        aria-hidden="true"
      />
      <h2 className="mt-4 font-heading text-xl font-medium text-foreground">{title}</h2>
      <p className="mt-2 text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}
```

- [ ] **Bước 2: Viết `tours/loading.tsx`**

Skeleton 12 card khớp lưới thật (3 cột lg / 2 sm / 1 base), dùng
`animate-pulse` + `bg-muted`, kèm khối giả cho hero và toolbar để trang không
nhảy layout khi nội dung thật về.

- [ ] **Bước 3: Vá `destinations-menu.tsx` — 3 vùng → 9 địa danh**

Dropdown đổi thành 3 nhóm vùng, mỗi nhóm 3 địa danh, mỗi mục trỏ
`/tours?destination=<slug>`. Giữ `data-region` ở cấp **nhóm** để chấm tint
`--region-primary` vẫn đúng màu vùng (ADR-0013 #4). Nhóm lấy từ
`REGIONS` + `DESTINATIONS` đang có trong `mocks/`.

Sửa comment đầu file — bỏ câu "Link tạm trỏ #gallery cho tới khi có trang vùng
riêng", thay bằng ghi chú vì sao dropdown liệt kê địa danh chứ không phải vùng:

```tsx
// Dropdown liệt kê ĐỊA DANH chứ không phải vùng: ToursListQuerySchema chỉ nhận
// `destination` (slug), không có tham số `region`. Trỏ một mục "North" sang
// /tours mà không lọc được gì thì vẫn là link nói dối. Vùng vẫn hiện dưới dạng
// tiêu đề nhóm + chấm tint. Trang /destinations riêng là cụm sau.
```

- [ ] **Bước 4: Vá `site-header.tsx`**

- `Tours` → `href="/tours"` (dòng 85).
- `MOBILE_LINKS`: mục `Tours` → `/tours`; ba mục `Destinations — North/Central/South`
  thay bằng 9 mục địa danh `/tours?destination=<slug>` (hoặc gọn hơn: một mục
  `Destinations` → `/tours`, rồi 9 địa danh — chọn cách nào thì giữ nhất quán
  với dropdown desktop).
- Cập nhật comment đầu file: bỏ mô tả link tạm, ghi rằng navbar giờ không còn
  link chết nào.

- [ ] **Bước 5: Kiểm mọi link trong navbar đều tới trang có thật**

```bash
npx playwright screenshot --viewport-size=1440,900 http://localhost:3000/ /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/nav-check.png
```

Rồi thử tay vài URL: `/tours`, `/tours?destination=sa-pa`, `/tours?destination=hoi-an`.
Mỗi cái phải ra lưới đã lọc, không phải trang rỗng.

- [ ] **Bước 6: Typecheck + test + commit**

```bash
pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web test
pnpm lint:fix
git add apps/web/src/
git commit -m "feat(web): skeleton + trạng thái lỗi tải cho /tours, vá link chết navbar"
```

---

## ⛔ MỐC DỪNG — user xem `/tours` trước khi làm trang detail

Sau Task 7, **DỪNG**. Báo user, gửi ảnh chụp (desktop + mobile + một trạng thái
đã lọc + trạng thái rỗng), chờ duyệt. Không bắt đầu Task 8 khi chưa có phản hồi.

---

### Task 8: `/tours/[slug]` — hero, route ribbon, khung trang

**Files:**
- Create: `apps/web/src/components/tours/route-ribbon.tsx`
- Create: `apps/web/src/components/tours/tour-hero.tsx`
- Create: `apps/web/src/app/(site)/tours/[slug]/page.tsx`
- Create: `apps/web/src/app/(site)/tours/[slug]/loading.tsx`

**Interfaces:**
- Consumes: `TOURS`, `routeChain`, `formatMoney`, `discountPercent`
- Produces: `<RouteRibbon destinations />` · `<TourHero tour={MockTourDetail} />`

- [ ] **Bước 1: Viết `RouteRibbon`**

Đường kẻ ngang với chấm cho từng chặng: chấm **đặc** cho `isPrimary`, chấm
**rỗng** cho phần còn lại, tên dưới mỗi chấm, mỗi tên là link
`/tours?destination=<slug>`.

Đây là **vector cấu trúc sinh từ dữ liệu thật**, không phải minh hoạ tự vẽ —
đúng bài học "vector tự vẽ = mùi AI". Nó thay cho bản đồ mà contract không có.
Trên mobile cuộn ngang, không xuống dòng.

- [ ] **Bước 2: Viết `TourHero`**

Band tối (`dark` scope + `TopoPattern` + scrim), chứa theo thứ tự: breadcrumb
`Home › Tours › <category.name>` · eyebrow `category · difficulty` · H1 ·
`summary` (ẩn khi null) · `RouteRibbon` · hàng meta (`durationDays`,
`maxGroupSize`) · góc phải rating hoặc chip `New — no reviews yet` · hàng badge
(tối đa 2 rồi `+N`) · giá `from {basePrice}` + giá gạch.

- [ ] **Bước 3: Viết `page.tsx` với metadata + static params**

```tsx
export function generateStaticParams() {
  return TOURS.map((tour) => ({ slug: tour.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tour = TOURS.find((t) => t.slug === slug);
  if (!tour) return { title: 'Tour not found — Tourism' };
  return {
    title: `${tour.title} — Tourism`,
    description: tour.summary ?? `${tour.durationDays}-day trip with Tourism.`,
    // Canonical: mẫu /blog bỏ sót cái này so với Nexora. Trang tour có thể tới
    // kèm query param theo dõi nên càng cần.
    alternates: { canonical: `/tours/${tour.slug}` },
    openGraph: {
      title: tour.title,
      description: tour.summary ?? undefined,
      type: 'website',
      url: absoluteUrl(`/tours/${tour.slug}`),
    },
  };
}
```

Body: `notFound()` khi không tìm thấy slug. Khung 3 cột như spec §6.2 — rail
`OnThisPage` ở `xl`, bỏ ở `lg`, 1 cột + bar đáy ở dưới `lg`. Ở task này các
section còn là chỗ trống có tiêu đề; nội dung vào ở Task 9–10.

Mục lục cho rail dựng bằng `tocFromSections` đang có (`lib/toc.ts`), truyền
mảng tiêu đề section cố định — id phải khớp `id` gắn trên thẻ `<section>`.

- [ ] **Bước 4: Viết `[slug]/loading.tsx`**

Skeleton khớp khung: band hero + dải khởi hành + 2 cột.

- [ ] **Bước 5: Kiểm bằng mắt + commit**

```bash
npx playwright screenshot --viewport-size=1440,2600 --full-page http://localhost:3000/tours/ha-long-bay-cruise /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/detail-shell.png
```

Kiểm thêm hai slug ép nhánh rỗng: `/tours/phu-quoc-reef-days` (summary null,
rating null, không departures) và một slug không tồn tại → phải ra trang 404.

```bash
pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web test
pnpm lint:fix
git add apps/web/src/
git commit -m "feat(web): khung trang chi tiết tour — hero tối, route ribbon, metadata"
```

---

### Task 9: Dải khởi hành + rail booking + bar đáy

**Files:**
- Create: `apps/web/src/components/tours/departure-strip.tsx`
- Create: `apps/web/src/components/tours/departure-strip.spec.tsx`
- Create: `apps/web/src/components/tours/booking-rail.tsx`
- Create: `apps/web/src/components/tours/departures-table.tsx`
- Modify: `apps/web/src/app/(site)/tours/[slug]/page.tsx`

**Interfaces:**
- Consumes: `departureStatus`, `formatDateRange`, `formatMoney`, `discountPercent`
- Produces: một component khách hàng bọc chung giữ state `selectedDepartureId`,
  truyền xuống `DepartureStrip` · `BookingRail` · `DeparturesTable`.

- [ ] **Bước 1: Viết test component thất bại**

`apps/web/src/components/tours/departure-strip.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DepartureStrip } from './departure-strip';

const DEPARTURES = [
  {
    id: 'a',
    startDate: '2026-08-21',
    endDate: '2026-08-22',
    seatsLeft: 4,
    effectivePrice: '175.00',
    compareAtPrice: '236.00',
  },
  {
    id: 'b',
    startDate: '2026-09-18',
    endDate: '2026-09-19',
    seatsLeft: 0,
    effectivePrice: '189.00',
    compareAtPrice: null,
  },
  {
    id: 'c',
    startDate: '2026-10-02',
    endDate: '2026-10-03',
    seatsLeft: 12,
    effectivePrice: '199.00',
    compareAtPrice: null,
  },
];

describe('DepartureStrip', () => {
  it('đợt đang chọn được đánh dấu aria-pressed', () => {
    render(
      <DepartureStrip
        departures={DEPARTURES}
        currency="USD"
        selectedId="a"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /21–22 Aug 2026/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('đợt hết chỗ bị vô hiệu hoá và không gọi onSelect', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartureStrip
        departures={DEPARTURES}
        currency="USD"
        selectedId="a"
        onSelect={onSelect}
      />,
    );
    const soldOut = screen.getByRole('button', { name: /18–19 Sep 2026/ });
    expect(soldOut).toBeDisabled();
    await user.click(soldOut);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('đợt còn ít ghế hiện cảnh báo kèm CON SỐ chính xác', () => {
    render(
      <DepartureStrip departures={DEPARTURES} currency="USD" selectedId="a" onSelect={vi.fn()} />,
    );
    expect(screen.getByText('Only 4 seats left')).toBeInTheDocument();
  });

  it('chọn đợt khác thì gọi onSelect với đúng id', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartureStrip departures={DEPARTURES} currency="USD" selectedId="a" onSelect={onSelect} />,
    );
    await user.click(screen.getByRole('button', { name: /2–3 Oct 2026/ }));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('không có đợt nào thì hiện dòng trạng thái thay vì dải rỗng', () => {
    render(<DepartureStrip departures={[]} currency="USD" selectedId={undefined} onSelect={vi.fn()} />);
    expect(screen.getByText(/no departures scheduled/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
```

- [ ] **Bước 2: Chạy test — phải ĐỎ, rồi viết `DepartureStrip`**

```bash
pnpm --filter @tourism/web test -- src/components/tours/departure-strip.spec.tsx
```

Yêu cầu bắt buộc khi hiện thực:
- Dải cuộn ngang `scroll-snap-type: x mandatory`, mỗi chip `scroll-snap-align: start`.
- Chip là `<button type="button" aria-pressed>`; đợt `sold-out` thêm `disabled`.
- Điều hướng bàn phím `←`/`→`/`Home`/`End` di chuyển giữa các chip **còn chỗ**.
- Màu theo `departureStatus`: `limited` dùng `text-warning`, `sold-out` dùng
  `text-muted-foreground` + `line-through` trên giá.
- Nhãn chip đọc được: `formatDateRange` + giá + trạng thái ghế.

- [ ] **Bước 3: Viết `BookingRail`**

Rail dính `lg:sticky lg:top-24`. Nội dung: nhãn `YOUR DEPARTURE` · dải ngày đã
chọn · `durationDays` · `effectivePrice` + giá gạch + chip `−N%` · thanh mức ghế
+ nhãn trạng thái · nút `Reserve` · **dòng test-mode**.

Bắt buộc theo spec §6.5 và §6.6:

```tsx
{/* Thanh toán LUÔN ở sandbox — nói thẳng ngay dưới nút, chỗ người dùng thật sự
    phân vân trước khi bấm. Không banner đỏ: banner phá nhịp trang. */}
<p className="mt-3 text-xs text-muted-foreground">Test mode — no card is charged.</p>
```

`Reserve` là `<button type="button">` **không điều hướng** — luồng đặt chỗ chưa
tồn tại, và luật cấm đẩy người dùng vào 404. Đúng tiền lệ nút `Book a tour` ở
`site-header.tsx:99`. CTA phụ `Ask about this trip` → `/contact`.

Khi `departures` rỗng: rail bỏ giá và nút `Reserve`, chỉ còn dòng
`No departures scheduled yet` + CTA `/contact`.

Bản mobile: cùng component, `fixed bottom-0 lg:hidden`, một hàng gọn
(giá · ngày · nút) + dòng test-mode rút gọn.

- [ ] **Bước 4: Viết `DeparturesTable`**

Bảng đầy đủ giữa trang. Mỗi hàng: dải ngày · `durationDays` · trạng thái ghế ·
giá + giá gạch · nút chọn. Hàng của đợt đang chọn được highlight
(`data-selected` + `bg-accent`). Hàng `sold-out` mờ và không bấm được.

Chân bảng, đúng chữ spec §6.5:

```tsx
<p className="mt-4 text-xs text-muted-foreground">
  Prices are for demonstration. Checkout runs on Stripe and PayPal sandbox accounts.
</p>
```

- [ ] **Bước 5: Nối state ở component bọc**

Một client component giữ `selectedDepartureId`, khởi tạo bằng **đợt còn chỗ đầu
tiên** (`departures.find(d => d.seatsLeft > 0)?.id`), truyền xuống cả ba. Một
hành động → ba nơi phản hồi.

- [ ] **Bước 6: Test xanh + kiểm mắt + commit**

```bash
pnpm --filter @tourism/web test
npx playwright screenshot --viewport-size=1440,2600 --full-page http://localhost:3000/tours/ha-long-bay-cruise /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/detail-departures.png
npx playwright screenshot --viewport-size=390,2000 --full-page http://localhost:3000/tours/phu-quoc-reef-days /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/detail-no-departures.png
```

```bash
pnpm lint:fix
git add apps/web/src/
git commit -m "feat(web): dải khởi hành + rail booking + bảng đợt, đồng bộ ba nơi"
```

---

### Task 10: Itinerary, inclusions, good-to-know, related

**Files:**
- Create: `apps/web/src/components/tours/itinerary-timeline.tsx`
- Create: `apps/web/src/components/tours/inclusions.tsx`
- Create: `apps/web/src/components/tours/good-to-know.tsx`
- Create: `apps/web/src/components/tours/related-tours.tsx`
- Modify: `apps/web/src/app/(site)/tours/[slug]/page.tsx`

**Interfaces:**
- Consumes: `groupPoliciesByKind`, `relatedTours`, `TourCard`

- [ ] **Bước 1: `ItineraryTimeline`**

Timeline dọc **mở hết**, không accordion (mô tả v2 ngắn, giấu đi thì trang trống).
`dayNumber` in lớn ở rail trái mỗi mục, đường kẻ dọc nối các ngày.
`description === null` → chỉ hiện `title`, giữ nguyên nhịp dọc.

`meetingPoint` (nếu không null) render thành thẻ nhỏ **gắn vào Day 1**:
`Meet at {meetingPoint}`. Đây là chỗ tự nhiên nhất — nó là thông tin của ngày
đầu, không phải của cả tour.

- [ ] **Bước 2: `Inclusions`**

Hai cột: trái `What's included` (icon tick, `text-success`), phải `Not included`
(icon cross, `text-muted-foreground`). Một bên rỗng → cột đó hiện `—`, **giữ
nguyên lưới 2 cột** để không lệch. Trên mobile xếp dọc.

Render **nguyên văn** chuỗi trong `included[]`/`excluded[]`. Không regex-parse
để rút ra meals/transport — đó là hack của Nexora (`tour-detail-derive.ts`), dễ
sai và không có field nào bảo đảm định dạng.

- [ ] **Bước 3: `GoodToKnow`**

Một section chứa hai khối: FAQ (accordion từ `faqs[]`) và Policies (gom bằng
`groupPoliciesByKind`, mỗi nhóm có tiêu đề, `body` render bằng `Typeset` preset
`reading` đã có trong `@tourism/ui`). Mảng rỗng → ẩn khối tương ứng; cả hai rỗng
→ ẩn cả section (và bỏ mục tương ứng khỏi `OnThisPage`).

- [ ] **Bước 4: `RelatedTours`**

`relatedTours(TOURS, slug, 3)` render bằng `TourCard`, lưới 3 cột. Tiêu đề dùng
`messages.tourDetail.youMightLike`.

- [ ] **Bước 5: Ghép hết vào `page.tsx`, kiểm mọi nhánh rỗng**

Chụp cả ba tour ép nhánh khác nhau:

```bash
npx playwright screenshot --viewport-size=1440,4000 --full-page http://localhost:3000/tours/ha-giang-loop-expedition /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/detail-long.png
npx playwright screenshot --viewport-size=1440,3000 --full-page http://localhost:3000/tours/phu-quoc-reef-days /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/detail-sparse.png
```

Kiểm: tour 8 ngày có đủ 8 mục timeline · tour `phu-quoc-reef-days` **không**
render section FAQ (mảng rỗng) và không có thẻ meeting point.

- [ ] **Bước 6: Test + commit**

```bash
pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web test
pnpm lint:fix
git add apps/web/src/
git commit -m "feat(web): itinerary timeline, inclusions, good-to-know, related tours"
```

---

### Task 11: `robots.ts` + `sitemap.ts`

**Files:**
- Create: `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`

- [ ] **Bước 1: Viết `robots.ts`**

```ts
import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

// Trang công khai cho crawler; chặn các nhánh riêng tư. Danh sách disallow ghi
// sẵn cả đường dẫn CHƯA tồn tại (checkout/account) — thêm bây giờ rẻ hơn nhớ ra
// sau khi trang đã lên và đã bị index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/checkout/', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
```

- [ ] **Bước 2: Viết `sitemap.ts`**

Phủ: trang tĩnh (`/`, `/about`, `/contact`, `/faq`, `/terms`, `/privacy`,
`/cancellation-policy`, `/blog`, `/tours`) · 16 `/tours/[slug]` · 9
`/blog/[slug]`. **Không** liệt kê trang auth (không có giá trị index).

`priority`: `/` 1.0 · `/tours` 0.9 · tour detail 0.8 · còn lại 0.6–0.7.

- [ ] **Bước 3: Kiểm output thật**

```bash
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml | head -30
```

Kỳ vọng: robots.txt có dòng `Sitemap:`; sitemap.xml chứa đủ 16 URL tour. Đếm:

```bash
curl -s http://localhost:3000/sitemap.xml | grep -c '/tours/'
```

Kỳ vọng: `17` (16 tour + trang `/tours`).

- [ ] **Bước 4: Commit**

```bash
pnpm lint:fix
git add apps/web/src/app/robots.ts apps/web/src/app/sitemap.ts
git commit -m "feat(web): robots.txt + sitemap.xml phủ tours và blog"
```

---

### Task 12: `ArticleBody` dùng chung + phân trang `/blog`

**Task độc lập — cắt được khỏi cụm mà không ảnh hưởng Task 1–11.**

**Files:**
- Create: `apps/web/src/components/content/article-body.tsx`
- Modify: `apps/web/src/components/legal/legal-article.tsx`
- Modify: `apps/web/src/app/(site)/blog/[slug]/page.tsx`
- Modify: `apps/web/src/app/(site)/blog/page.tsx`
- Modify: `apps/web/src/components/blog/blog-explorer.tsx`

- [ ] **Bước 1: Đọc hai chỗ render thân bài hiện tại**

```bash
cat apps/web/src/components/legal/legal-article.tsx
cat "apps/web/src/app/(site)/blog/[slug]/page.tsx"
```

Xác định phần **thật sự trùng nhau**: cả hai render mảng
`{ heading, paragraphs?, bullets? }[]` bằng `Typeset` với `id` từ `slugify`.
Chỉ tách phần đó. Nếu sau khi đọc thấy hai bên đã lệch nhiều (khác wrapper,
khác preset), **báo lại thay vì ép chung** — tách sai còn tệ hơn trùng lặp.

- [ ] **Bước 2: Viết `ArticleBody`**

```tsx
import { Typeset } from '@tourism/ui/components/typeset';
import { slugify } from '@/lib/slug';

// Thân bài dùng chung cho trang pháp lý và bài blog: cùng một hình dạng dữ liệu
// (mảng section có heading + paragraphs/bullets), cùng preset "reading", cùng
// quy tắc id-từ-heading để OnThisPage nhảy đúng chỗ.
export function ArticleBody({
  sections,
}: {
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
}) {
  return (
    <Typeset preset="reading">
      {sections.map((section) => (
        <section key={section.heading} id={slugify(section.heading)}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {section.bullets ? (
            <ul>
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </Typeset>
  );
}
```

- [ ] **Bước 3: Thay ở cả hai chỗ, chạy test cũ**

```bash
pnpm --filter @tourism/web test
```

Kỳ vọng: `legal-content.spec.ts` và `blog.spec.ts` vẫn PASS **không sửa gì**.
Đỏ nghĩa là việc tách làm đổi hành vi render.

- [ ] **Bước 4: Phân trang `/blog`**

`BlogExplorer` nhận thêm `initialPage`, dùng `paginate`/`pageNumbers` của
`lib/paginate` (Task 2) và `PaginationBar` (Task 6). `limit = 9` để lưới 3 cột
đầy đủ ba hàng. Đổi bộ lọc → `page` về 1, đúng quy tắc của `ToursExplorer`.

Bài featured (card `sm:col-span-2` khi chưa lọc) **chỉ hiện ở trang 1**.

- [ ] **Bước 5: Kiểm mắt + commit**

```bash
npx playwright screenshot --viewport-size=1440,2000 --full-page "http://localhost:3000/blog?page=2" /tmp/claude-1000/-home-yuriv-projects-tourism-v2/b50dd5c0-a459-4c27-8328-18d0f8147903/scratchpad/blog-page2.png
```

```bash
pnpm --filter @tourism/web typecheck && pnpm --filter @tourism/web test
pnpm lint:fix
git add apps/web/src/
git commit -m "refactor(web): tách ArticleBody dùng chung + phân trang /blog"
```

---

### Task 13: Gate đầy đủ + docs sweep

- [ ] **Bước 1: Gate ĐẦY ĐỦ**

```bash
pnpm gate:int
```

Kỳ vọng: xanh toàn bộ. `gate` trần **không đủ** để khai hoàn thành — nó không
đụng integration test (luật CLAUDE.md #11).

- [ ] **Bước 2: Cập nhật `docs/CHANGELOG.md`**

Một entry: ngày · hash · nội dung · review findings · số test trước→sau.

- [ ] **Bước 3: Cập nhật `docs/README.md`**

- Bảng ADR: hàng 0014 (đã thêm ở Task 1 — kiểm còn đúng).
- Bảng Specs: hàng cụm Tours, trạng thái ✅.
- Bảng Plans: hàng plan này, trạng thái ✅.
- Bảng Analysis: hàng đối chiếu Nexora 27/07.
- Dòng trạng thái P3b: thêm `/tours` + `/tours/[slug]`, ghi **kế tiếp:
  /destinations**.

- [ ] **Bước 4: Kiểm docs-freshness**

```bash
./scripts/docs-freshness.sh
```

Kỳ vọng: xanh — không còn commit `feat`/`fix` nào mới hơn entry CHANGELOG mới nhất.

- [ ] **Bước 5: Commit + đẩy branch**

```bash
git add docs/
git commit -m "docs: ghi lại cụm trang Tours"
git push -u origin feat/tours-pages
```

- [ ] **Bước 6: Chờ CI, rồi HỎI user trước khi merge**

```bash
gh run watch
```

CI xanh thì **hỏi user**, không tự merge. Sau khi được duyệt:

```bash
git checkout main && git pull --ff-only
git checkout feat/tours-pages && git rebase main
git checkout main && git merge --ff-only feat/tours-pages
git push && git branch -d feat/tours-pages
```

- [ ] **Bước 7: Dọn tiến trình**

Kill mọi tiến trình tự mở (không đụng dev server cổng 3000 của user), báo
"cổng sạch".

---

## Nợ ghi lại sau cụm này

Đưa vào spec/CHANGELOG, **không** làm ở đây:

1. **Năm lỗ contract** (spec §8): field ảnh · `nextDeparture*` trên card · sort
   theo rating · filter price/duration/difficulty · `suitableFor`/`badges` trên
   card. Cần một ADR mở rộng contract trước cụm gắn API.
2. **JSON-LD** Product + Offer + AggregateRating + FAQPage + BreadcrumbList tách
   thành module dùng chung (Nexora có `components/seo/json-ld.tsx`; v2 đang
   copy-paste inline ở blog).
3. **Skip link** — Nexora có ở `app/layout.tsx:62`, v2 chưa có ở đâu.
4. **`images.remotePatterns`** trong `next.config.ts` khi có ảnh thật.
5. **Cache-tag revalidation** khi gắn API — không có nó thì duyệt một review
   phải chờ hết TTL.
6. **`/destinations` + `/destinations/[slug]`** — cụm riêng, dựng từ
   `destinations.list` có `tourCount` thật (hơn fixture cứng của Nexora).
7. **Wishlist** — contract có `wishlist.check` batch nên nút tim trên **mọi**
   card listing là khả thi; hiện chưa nối.
