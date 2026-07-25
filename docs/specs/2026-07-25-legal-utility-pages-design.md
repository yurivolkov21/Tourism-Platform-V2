# Spec — Cụm trang pháp lý / utility (static-first)

**Ngày**: 2026-07-25 · **Trạng thái**: user đã duyệt hướng thiết kế ·
**Branch**: `feat/legal-utility-pages`

## Phạm vi

4 trang nội dung dài + 3 route boundary còn thiếu:

| Trang | Route | Ruột |
| --- | --- | --- |
| Terms & Conditions | `/terms` | `termsDoc` — 10 mục, có mục mới "Test-mode payments" |
| Privacy Statement | `/privacy` | `privacyDoc` |
| Cancellation & Refund | `/cancellation-policy` | `cancellationDoc` |
| FAQs | `/faq` | `messages.faqPage` — 5 nhóm / 15 câu, có search + JSON-LD |
| 404 | `app/not-found.tsx` | màn ảnh thật + 3 CTA |
| Lỗi runtime | `app/error.tsx` | panel tối giản + Retry / Home |
| Lỗi tầng root | `app/global-error.tsx` | panel tối giản tự render `<html>` |

## Đối chiếu Nexora (luật #10 — làm TRƯỚC, cả 2 tầng)

Repo tham chiếu chỉ-đọc: `/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform`.

| Nexora có | v2 trước cụm này | Phân loại |
| --- | --- | --- |
| `/terms`, `/privacy`, `/cancellation-policy` qua `LegalArticle` | 404 | thụt lùi → cụm này vá |
| `/faq` qua `FaqExplorer` + JSON-LD `FAQPage` | 404 | thụt lùi → cụm này vá |
| `not-found.tsx` · `error.tsx` · `global-error.tsx` (`ErrorState`) | **thiếu cả 3** | thụt lùi → cụm này vá |
| `lib/slug.ts` (`slugify` cho anchor TOC) | thiếu | thụt lùi nhỏ → cụm này vá |
| `components/content/{content-hero,on-this-page}` | thiếu | thụt lùi → cụm này vá (làm khác: không ảnh) |
| `robots.ts` · `sitemap.ts` | thiếu | thụt lùi **ngoài phạm vi** — user chốt để cụm SEO riêng |
| `ContentHero` có ảnh full-bleed + Appearance slot site-media | — | **cố ý làm khác**: v2 dùng band tối typographic (xem "Khảo sát") |
| `EnquiryCta` cuối trang FAQ | — | **cố ý bỏ ở cụm này**: v2 chưa có component CTA enquiry dùng chung; ghi nợ |

**Nội dung đã có sẵn**: `libs/shared/i18n/src/lib/legal/{terms,privacy,cancellation}.ts`
(kiểu `LegalDoc`) + `messages.{faqPage,resilience,pageMeta,common}` đã port
nguyên từ Nexora hồi 18/07 nhưng chưa trang nào dùng. Cụm này là lần đầu
`apps/web` import `@tourism/i18n`.

## Khảo sát mẫu thật (memory `design-research-before-decorating`)

Screenshot 6 mẫu bằng playwright-core: Vercel `/legal/terms`, Linear `/terms`,
Stripe `/legal/ssa`, Much Better Adventures, Black Tomato, Intrepid (404).

- **Không mẫu hiện đại nào dùng ảnh hero cho trang pháp lý.** Header là
  typographic: tiêu đề khổ lớn + đúng một dòng meta "Last updated…".
  Vercel thêm lưới crosshair mờ — cùng thủ pháp `TopoPattern` v2 đang có.
- Thân bài: một cột hẹp ~68ch + **TOC sticky**; Vercel đặt bên **phải**,
  Stripe/Nexora bên trái. Linear mở đầu bằng danh sách mục đánh số kiểu mono.
- FAQ (Dribbble `faq-page-design`): search nổi bật + nhóm chủ đề + accordion
  card rời — trùng hướng `FaqExplorer` của Nexora và `contact-faq` của v2.
- 404 Intrepid: ảnh phong cảnh thật + breadcrumb + câu ấm + 2 CTA.

## Thiết kế (hướng "band tối mỏng + kỷ luật Vercel")

### Header dùng chung — `ContentHero`

Band **tối, mỏng** (`dark` scope, `pt-36 pb-12`): breadcrumb → h1 → dòng
`Last updated` → `TopoPattern` mờ. Bắt buộc tối vì `SiteHeader` lúc chưa cuộn
dùng `text-on-media` trên nền trong suốt — hero sáng làm navbar tàng hình
(pattern "hero luôn tối" đã chốt ở `/contact`). Không ảnh: khác Nexora, theo
mẫu Vercel/Linear.

### Thân bài — `LegalArticle`

- Một cột đo ~68ch, `<Typeset preset="reading">` (ADR-0012) cho phần chữ chạy.
- Section đánh số bằng **IBM Plex Mono** (chữ ký mono đã dùng ở cuống vé auth),
  hairline `divide-border` chia đoạn — thay vòng tròn primary của Nexora.
- `OnThisPage` sticky **bên phải** (`lg:grid-cols-[1fr_14rem]`), scroll-spy
  `IntersectionObserver`, nhãn đánh số mono.
- Callout `reviewNote` bật cho cả 3 doc: nói rõ đây là tài liệu mẫu của một
  dự án capstone, thanh toán chạy test/sandbox mode, không phải tư vấn pháp lý.

### `/faq`

`ContentHero` + `OnThisPage` (mục = 5 nhóm) + `FaqExplorer`: ô search bo tròn,
mỗi nhóm một icon lucide, accordion **card rời bo 2xl** đổi nền khi mở — kế
thừa nguyên style đã chốt ở `contact-faq`, cộng motion stagger như trang khác.
JSON-LD `FAQPage` sinh từ chính catalogue tĩnh, `JSON.stringify` rồi escape
`<` → `<` (giữ nguyên pattern an toàn của Nexora).

### Bộ 3 trang lỗi

- **`not-found.tsx`**: màn tối dùng ảnh mock có sẵn (`public/mock/halong.jpg`)
  + scrim + `TopoPattern` + copy `messages.resilience.notFound` + 3 CTA
  (Home · Tours · Journal). Có chrome — xem "Vướng kiến trúc" bên dưới.
- **`error.tsx`** và **`global-error.tsx`**: `ErrorState` tối giản (icon tròn +
  tiêu đề + body + nút), **cố ý không** ảnh, không chrome — chúng phải render
  được cả khi cây trang đã hỏng; `global-error` tự dựng `<html>`/`<body>`.

### Vướng kiến trúc phải xử lý: chrome của 404

Chrome site (TopBar + SiteHeader + SiteFooter + ScrollToTop) nằm ở
`app/(site)/layout.tsx`, còn 404 của URL không khớp chỉ render trong **root**
layout → sẽ trần trụi, không navbar/footer. Cách chọn: tách
`components/site-chrome.tsx` bọc đúng 4 thành phần đó, dùng chung cho
`(site)/layout.tsx` và `app/not-found.tsx`. (`error.tsx`/`global-error.tsx`
cố ý KHÔNG dùng.)

## Nội dung (sửa gì trong `@tourism/i18n`)

1. 13 chỗ chuỗi **"Nexora" → "Tourism"** (3 trong `terms.ts`, 3 trong
   `privacy.ts`, 7 trong `messages.ts`).
2. `updated` của cả 3 doc → `Last updated: 25 July 2026`.
3. **Thêm mục "Test-mode payments"** vào `termsDoc` + một đoạn nhắc trong
   `cancellationDoc`: Stripe/PayPal chạy sandbox/test mode, không phát sinh
   giao dịch thật, không có doanh thu.
4. Bật `reviewNote` cho 3 doc.
5. `apps/web/package.json` thêm dependency `@tourism/i18n`.

Copy user-facing tiếng Anh (luật #7), comment tiếng Việt (luật #8),
tokens-only không hex (luật #6).

## Nối lại link chờ

- `/register` — checkbox điều khoản đã trỏ `/terms`, `/privacy`: chỉ cần trang
  tồn tại (hết 404).
- `/contact` mini-FAQ — "see the full list" đã trỏ `/faq`.
- `site-footer.tsx` nhóm **Support**: `FAQ`, `Cancellation policy`, `Terms`,
  `Privacy policy` đang trỏ `#top` → trỏ route thật.

## Test (luật #4 — TDD trên logic thuần)

| Đối tượng | Vì sao đáng test |
| --- | --- |
| `slugify` | anchor TOC phụ thuộc hoàn toàn vào nó |
| `filterFaqCategories(categories, query)` (tách khỏi component) | logic lọc thuần, có nhánh rỗng |
| `tocFromLegalDoc(doc)` | ánh xạ doc → mục lục đánh số |
| Spec canh nội dung i18n | (a) không còn chuỗi "Nexora"; (b) mọi heading trong 3 doc sinh slug **duy nhất** — trùng slug là gãy TOC âm thầm |

## Nợ ghi sổ

- `robots.ts` + `sitemap.ts` — cụm SEO riêng (user chốt hoãn), phụ thuộc danh
  sách route cuối cùng (tours/blog/destinations chưa có).
- Gắn API cho `/faq` — ứng viên bảng `faqs` (question · answer · category ·
  sort_order); hiện đọc tĩnh từ i18n. Mock `apps/web/src/mocks/faq.ts` (5 câu
  của Contact) **giữ nguyên**, không gộp trong cụm này.
- `EnquiryCta` cuối trang FAQ — chờ component CTA enquiry dùng chung.
- i18n sweep: copy inline của Home/About/Contact/auth gom về `@tourism/i18n`.

## Quy trình dựng

`/terms` dựng TRƯỚC làm mẫu (ContentHero + LegalArticle + OnThisPage) →
screenshot tự kiểm → **dừng chờ user duyệt layout** → nhân ra `/privacy`,
`/cancellation-policy`, `/faq` + bộ 3 trang lỗi → nối link footer →
`pnpm gate:int` → push chờ CI xanh → hỏi user rồi merge ff-only → docs sweep.

Demo qua dev server user đang chạy; **không** chạy `next build` khi cổng 3000
còn sống (memory `process-hygiene-handover`).
