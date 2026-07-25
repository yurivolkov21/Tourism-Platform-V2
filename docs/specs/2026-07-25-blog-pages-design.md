# Spec — Cụm trang Blog (static-first)

**Ngày**: 2026-07-25 · **Trạng thái**: user đã duyệt hướng thiết kế ·
**Branch**: `feat/blog-pages`

## Phạm vi

| Trang | Route | Ruột |
| --- | --- | --- |
| Danh sách | `/blog` | 9 bài mock, lưới tạp chí, chip lọc chuyên mục `?tag=` |
| Chi tiết | `/blog/[slug]` | hero ảnh cover, thân bài + TOC, ShareRow, PostNav, 3 bài liên quan |
| RSS | `/blog/rss.xml` | route trả XML sinh từ mock |

Chưa làm (ghi nợ): phân trang · gắn API thật · EnquiryCta cuối bài ·
related tours cuối bài.

## Đối chiếu Nexora (luật #10 — làm TRƯỚC)

Repo tham chiếu chỉ-đọc: `/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform`.

| Nexora có | v2 trước cụm này | Phân loại |
| --- | --- | --- |
| `/blog`, `/blog/[slug]`, `/blog/rss.xml` | 404 — chỉ có section `#journal` trên Home | thụt lùi → cụm này vá |
| `ScrollProgress` trên bài viết | ✅ `ReadingProgress` (cụm pháp lý 25/07) | v2 đã có |
| `OutlineRail` (TOC bài viết) | ✅ `OnThisPage` + `slugify` + `tocFromLegalDoc` | v2 đã có, chỉ cần tổng quát hoá |
| `PostContent` dùng `prose` | ✅ `Typeset preset="reading"` (ADR-0012) | v2 tốt hơn |
| `PostCard` · `ShareRow` · `PostNav` | thiếu | cụm này dựng |
| Chip lọc tag + ô search + phân trang | thiếu | chip lọc: làm; search + phân trang: **cố ý hoãn** (9 bài chưa cần) |
| `ArticleJsonLd` / `BreadcrumbJsonLd` | mới có JSON-LD `FAQPage` | cụm này thêm cho blog |
| `EnquiryCta` cuối bài · related tours | thiếu | **cố ý bỏ**: chưa có component CTA chung, chưa có trang tour detail |
| `lib/site.ts` (`absoluteUrl`) | thiếu — `apps/web` chưa có biến env nào | cụm này thêm (RSS cần URL tuyệt đối) |
| `loading.tsx` cho cả 2 route | thiếu | **cố ý bỏ**: mock đọc đồng bộ, không có trạng thái tải |

## Dữ liệu (static-first)

`MockJournalPost` mở rộng:

```ts
sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
updated?: string;
```

Mock **3 → 9 bài**: giữ nguyên 3 bài cũ (thêm `sections`), viết mới 6. Chuyên
mục trải đều — Packing · Food · Markets · Culture · Nature · Practical — để
chip lọc có đất diễn. Giọng văn bám câu chuyện thương hiệu: mỗi bài do một
guide bản địa đứng tên, khớp `author` đã có.

**Ảnh**: `public/mock/` hiện có 7 file, cần 9 → tải thêm **2 ảnh thật** từ
Wikimedia Commons (giấy phép CC), ghi nguồn vào `public/mock/CREDITS.md` đúng
nếp đang có.

Ứng viên schema khi gắn API: `blog_posts` (slug · title · excerpt · body ·
category · author · published_at · updated_at · read_minutes · hero_image).

## Helper thuần — nơi đặt toàn bộ test (luật #4)

`apps/web/src/lib/blog.ts`:

| Hàm | Trách nhiệm |
| --- | --- |
| `sortPostsByDate(posts)` | mới nhất trước; ổn định khi trùng ngày |
| `filterPostsByCategory(posts, category?)` | không truyền category thì trả nguyên |
| `postCategories(posts)` | danh sách chuyên mục duy nhất cho hàng chip |
| `adjacentPosts(posts, slug)` | `{ newer, older }`, biên là `undefined` |
| `relatedPosts(posts, slug, limit)` | cùng chuyên mục trước, thiếu thì bù bài mới nhất, không lặp chính nó |

Cộng refactor nhỏ: tách `tocFromLegalDoc` thành `tocFromSections(sections)`
dùng chung cho cả `LegalDoc` lẫn bài viết; `tocFromLegalDoc` gọi lại hàm mới
nên test hiện có giữ nguyên.

## `/blog` — danh sách

- `ContentHero` band tối (dùng lại nguyên).
- Hàng **chip chuyên mục URL-driven** (`?tag=`): server-render, crawl được,
  chạy không cần JS. Chip đang chọn có `aria-current`. Giá trị `tag` lạ →
  không khớp gì → trạng thái rỗng, không 404.
- **Lưới tạp chí**: bài mới nhất chiếm 2 cột (như Nexora `featured`), còn lại
  lưới 3 cột. Khi ĐANG lọc thì bỏ bài nổi bật — "nổi bật" nghĩa là mới nhất
  của cả blog, không phải đầu mỗi bộ lọc.
- Trạng thái rỗng khi lọc không ra gì, kèm link "Clear filter".

## `/blog/[slug]` — chi tiết

Hero **ảnh cover** phủ scrim tối (pattern "hero luôn tối", giống 404):
breadcrumb → tiêu đề → dòng meta (tác giả · ngày · số phút đọc · chip chuyên
mục). Thân bài dùng **đúng khuôn `LegalArticle`**: `ReadingProgress` + một cột
68ch `Typeset preset="reading"` + `OnThisPage` sticky bên phải, mobile đưa mục
lục lên đầu.

Cuối bài, theo thứ tự: `ShareRow` (copy link có phản hồi "Copied" + X +
Facebook) → `PostNav` (bài mới hơn / cũ hơn) → "More from the journal" (3
`PostCard`).

`generateStaticParams` sinh sẵn 9 slug; slug lạ → `notFound()` (trang 404 vừa
dựng đón sẵn). JSON-LD `Article` + `BreadcrumbList`, escape `<` như trang FAQ.

## Hạ tầng thêm

- `apps/web/src/lib/site.ts` — `siteUrl()` đọc `NEXT_PUBLIC_SITE_URL`, fallback
  `http://localhost:3000`; `absoluteUrl(path)`.
- `apps/web/.env.example` — file env đầu tiên của web, theo quy ước tên đã
  chốt 19/07 (`.env.local` dev · `.env.production` deploy · `.env.example`
  là file env DUY NHẤT được commit).
- `app/blog/rss.xml/route.ts` — sinh XML từ mock. Hàm escape ký tự XML là
  logic thuần → có test riêng.

## Nối lại link chờ

- Navbar "Travel Blog": `/#journal` → `/blog`.
- Footer nhóm Explore, mục "Journal": `/#journal` → `/blog`.
- Section Journal trên Home: nút "Read all" → `/blog`; mỗi card →
  `/blog/<slug>`.

## Nợ ghi sổ

- Phân trang `?page=` — 9 bài chưa cần, làm khi gắn API thật.
- Ô search trong `/blog` (Nexora có) — cùng lý do.
- Gắn API: bảng `blog_posts` + `post_tags`.
- `EnquiryCta` cuối bài — chờ component CTA enquiry dùng chung.
- Related tours cuối bài — chờ trang tour detail.
- `robots.ts` + `sitemap.ts`: sau cụm này đã có `lib/site.ts` nên cụm SEO nhẹ
  hơn hẳn.

## Quy trình dựng

`/blog` dựng TRƯỚC (mock + helper + listing) → screenshot tự kiểm → **dừng
chờ user duyệt** → `/blog/[slug]` → RSS + nối link → `pnpm gate:int` → push
chờ CI xanh → hỏi user rồi merge ff-only → docs sweep.

Demo qua dev server; **không** chạy `next build` cho web khi cổng 3000 còn
sống, và kill mọi tiến trình tự mở trước khi bàn giao.
