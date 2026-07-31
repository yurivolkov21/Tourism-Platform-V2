# Spec — Bước 1 nối API: cụm Blog + nền `lib/api` (2026-07-31)

- **Trạng thái:** Approved 31/07 — user duyệt trọn spec kể cả §2E (nối luôn
  teaser Home trong branch này); seed từ 9 bài mock đã chốt từ buổi duyệt
  thiết kế
- **Nền:** [ADR-0016](../adr/0016-web-data-layer.md) — mọi quyết định kiến trúc
  tầng dữ liệu đã chốt ở đó; spec này chỉ hiện thực hoá cho cụm đầu tiên.
- **Branch:** `feat/blog-api` (one feature = one branch, rebase + ff-only).

## 1. Vì sao blog KHÔNG phải "swap nguồn"

Khác cụm Tours (mock gương contract), `mocks/journal.ts` là shape tự do theo
quy trình static-first: `sections[]` thay vì `content` markdown, `category`
string thay vì `tags[]`, `author` string thay vì `{name, avatarUrl}`, có
`readMinutes`/`image`/`updated` mà contract không có. Và **DB không có Post
nào** — `prisma/seed.ts` chỉ seed catalog + user + site-media. Bước 1 vì thế
gồm cả seed nội dung lẫn đổi shape ở web, không chỉ đổi nguồn fetch.

## 2. Phạm vi — một branch, bốn tầng

### A. Nền `lib/api/` (lần đầu hiện thực ADR-0016 — dùng chung mọi bước sau)

- Deps `apps/web`: `@tourism/contract` (workspace) · `@orpc/client` ·
  `@orpc/openapi-client`, **ghim `1.14.8`** khớp API/contract.
- `lib/api/env.ts` — nguồn env duy nhất: `API_URL` (server) /
  `NEXT_PUBLIC_API_URL` (browser), origin trần không kèm `/api`.
- `lib/api/client.ts` — `OpenAPILink` + `createORPCClient`, kiểu
  `JsonifiedClient<ContractRouterClient<typeof contract>>`; custom fetch:
  `AbortSignal.timeout(10_000)`, nhận `next: {revalidate, tags}` per-call qua
  client context; không auto-retry.
- `lib/api/tags.ts` — taxonomy cache-tag: `TAGS.POSTS` + `postTag(slug)`
  (mở sẵn khuôn cho `TAGS.TOURS`… các bước sau).
- Khuôn lỗi ba mảnh: `lib/api/resilience.ts` (`settle()` không-throw +
  `contentState()` failed-thắng-empty — thuần, TDD) và component
  `components/feedback/load-error-state.tsx` (panel + retry =
  `router.refresh()`). Copy nút/nhãn vào `@tourism/i18n` (luật 7).

### B. Seed 9 bài phía API (`prisma/fixtures/posts.ts` + nối vào `seed.ts`)

- Convert 9 bài `mocks/journal.ts` (nội dung đã qua duyệt — giữ nguyên copy):
  `sections[]` → **markdown** (`## heading`, đoạn văn, `-` bullet);
  `excerpt` giữ nguyên (≤300); `publishedAt` từ `date` mock; `metaTitle`/
  `metaDescription` để null.
- Tag: `category` mock (từng bài) → tag chính; đặt thêm 1–2 tag phụ/bài từ
  nội dung. `PostTag` + `PostTagLink` seed cùng file.
- Author: gán user **admin seed** hiện có. Cover/media: **không seed** —
  chính sách `ImagePlaceholder` toàn site không đổi (ADR-0005).
- Idempotent `createMany skipDuplicates` đúng nếp `fixtures/catalog.ts`.
  **Không migration nào** — chỉ dữ liệu. KHÔNG đụng `prisma/migrations/`.

### C. Web — đổi nguồn cụm blog

- `lib/api/posts.ts`: fetch qua client + **map DTO → view-model** ngay cạnh
  fetch (component không biết DTO). React `cache()` bọc fetch detail để
  `generateMetadata` ↔ thân trang chung một request. Fetch gắn
  `revalidate: 300` + tag (`TAGS.POSTS` cho list/tags, `postTag(slug)` cho
  detail).
- `/blog` (listing): page fetch **trọn danh sách** server-side (pageSize 50 —
  hiện 9 bài) rồi truyền VM cho `blog-explorer`; lọc/tìm kiếm tương tác
  **giữ client-side như hiện tại** (bảo toàn UX fold dấu "bun cha" → "bún
  chả" mà server `search` không có). Server-side pagination là **nợ ghi rõ**,
  kích hoạt khi lượng bài vượt một trang fetch. Chip lọc chuyển từ
  `category` → **tag** (nguồn `posts.tags`).
- `/blog/[slug]` (detail): `generateStaticParams` từ API (build cần API sống
  — đã chốt ở ADR-0016); slug lạ → `notFound()` như hiện tại, **không thêm
  `loading.tsx` nào** (bẫy soft-404). `adjacentPosts`/`relatedPosts` đổi chữ
  ký sang VM; related tính theo **tag đầu tiên** thay vì category.
- `rss.xml`: bỏ `force-static`, chuyển fetch API + `revalidate: 300`.
- `sitemap.ts`: mục posts đổi nguồn sang API (lib sitemap vẫn nhận data qua
  tham số — giữ tính test được).
- `export const revalidate = 300` trên `/blog` và `/blog/[slug]`; tri-state:
  listing lỗi fetch → `LoadErrorState`, **cấm** rơi vào empty-state.

### D. Shape gap — xử lý tường minh (cắt/dẫn xuất có chủ đích)

| Mock có | Contract | Xử lý |
| --- | --- | --- |
| `sections[]` | `content` markdown | Render bằng **`react-markdown` + `remark-gfm`** trong Typeset preset `reading` (ADR-0012), thay `ArticleBody sections` ở trang blog (cụm pháp lý GIỮ `ArticleBody` — nội dung pháp lý vẫn là sections tĩnh). TOC: thêm `tocFromMarkdown()` thuần (TDD) cạnh `tocFromSections` |
| `readMinutes` | không có | Dẫn xuất từ word-count của `content` (~200 wpm) — hàm thuần có test |
| `category` chip | `tags[]` | Chip hiển thị tag đầu tiên; hàng chip lọc dùng `posts.tags` |
| `updated` chip + `dateModified` JSON-LD | không có updatedAt | **Cắt có chủ đích** — contract không trả; muốn lại thì mở rộng contract ở đợt riêng |
| `image` + JSON-LD `image` | `cover` nullable, seed không cover | Ảnh vẫn `ImagePlaceholder`; JSON-LD **bỏ field `image`** khi cover null (không bịa URL) |
| `author` string | `{name nullable, avatarUrl nullable}` | VM map, fallback tên qua i18n khi null |

### E. Consumer thứ hai của mock journal: teaser Home

`homeTeaserPosts` trên trang Home cũng đọc `JOURNAL_POSTS` — phát hiện sau
buổi duyệt thiết kế, nên đây là **điểm cần user xác nhận khi duyệt spec**.
Đề xuất: **nối luôn teaser Home trong branch này** (một fetch `posts.list` 3 bài, tag
`TAGS.POSTS`) để `mocks/journal.ts` chết trọn cùng test của nó — nội dung
hiển thị không đổi (9 bài seed chính là 9 bài mock). Hệ quả nhìn thẳng: Home
đổi SSG → ISR 300s trong bước này; điều đó là tất yếu muộn nhất ở bước 2
(featured tours), làm sớm ở đây với dữ liệu giống hệt là ca đổi an toàn nhất.
Các mock khác của Home (tours, testimonials, moments…) giữ nguyên — luật
"không trộn mock + API" áp **theo từng loại dữ liệu**, không cấm trang có cả
hai loại nguồn cho dữ liệu khác nhau.

## 3. Ngoài phạm vi (ghi để không trôi vào)

- Server-side pagination/search cho `/blog` (nợ có điều kiện kích hoạt ở §2C).
- On-demand revalidation (bước riêng sau bước 1–4 — ADR-0016).
- Mở rộng contract (updatedAt, cover cho seed) — đợt riêng nếu cần.
- Mọi trang khác ngoài `/blog`, `/blog/[slug]`, rss, sitemap, teaser Home.

## 4. Test & TDD (luật 4, ≥80% logic mới)

- Thuần, test-first: `tocFromMarkdown` · `readMinutes` (word-count) ·
  map DTO→VM trong `lib/api/posts.ts` · `settle()`/`contentState()` ·
  chữ ký mới của `adjacentPosts`/`relatedPosts` (spec `lib/blog.spec.ts`
  cập nhật theo VM).
- Component (jsdom, ADR-0014): `LoadErrorState` render + retry;
  `blog-explorer` với VM mới (spec hiện có cập nhật).
- Giữ nguyên lưới test sitemap (12 test) — đổi nguồn qua tham số không đổi
  chữ ký.

## 5. Đo nghiệm thu — trên PRODUCTION build, API sống

1. `/blog` render đúng 9 bài từ DB; chip tag lọc được; search fold dấu sống.
2. `/blog/<slug lạ>` → **HTTP 404 thật** (đo bằng curl, không phải nhìn UI).
3. `/blog/[slug]` đủ: markdown render trong Typeset, TOC, adjacent, related,
   JSON-LD Article (không field `image`) + BreadcrumbList hợp lệ.
4. Teaser Home hiện 3 bài mới nhất, Home vẫn build xanh.
5. `rss.xml` 200 + đủ 9 item; `sitemap.xml` giữ đủ URL blog.
6. `grep -r "mocks/journal" apps/web/src` → **rỗng**; file mock + test đã xoá.
7. `pnpm gate` xanh (API chạy trong lúc `next build`); nợ `test:int` cho CI
   ghi rõ nếu máy này không chạy được.
8. Tắt API rồi `router.refresh()` ở `/blog` → thấy `LoadErrorState`, không
   phải "no posts" (kiểm tri-state bằng tay, dev build).

## 6. Rủi ro & lưu ý thi công

- **Trang Home là trang được duyệt kỹ nhất** — thay teaser chỉ đổi nguồn dữ
  liệu, KHÔNG đổi component/layout; diff Home phải nhỏ.
- `content` markdown là **nội dung mình seed**, không phải user-input, nhưng
  `react-markdown` mặc định không render raw HTML — giữ mặc định đó, không
  bật `rehype-raw`.
- Seed chạy trên DB Supabase dùng chung — `skipDuplicates` idempotent, chạy
  lại không nhân bản; slug bài là khoá tự nhiên.
- Khi sửa `lib/blog.ts` sang VM, cấm quét vào `apps/api/prisma/migrations/`
  (bài học 19/07) — đợt này không có lý do gì đụng thư mục đó.
