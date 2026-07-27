# Đối chiếu Nexora — cụm trang Tours (trước P3b listing + detail)

Ngày 27/07/2026 · phục vụ [spec cụm Tours](../specs/2026-07-27-tours-pages-design.md)

Rà theo luật CLAUDE.md #10, **cả hai tầng**: (a) trang/tính năng, (b) hạ tầng
xuyên suốt. Repo tham chiếu `/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform`
đọc-only, không sửa gì.

Bốn nhãn phân loại: **thụt lùi cần vá** · **cố ý bỏ (ghi lý do)** ·
**làm khác mà tương đương** · **v2 tốt hơn**.

## Bản đồ file Nexora — cụm này lớn cỡ nào

| Vùng | File | LOC |
| --- | --- | --- |
| Route | `app/tours/page.tsx` · `loading.tsx` · `[slug]/page.tsx` · `[slug]/loading.tsx` · `[slug]/book/page.tsx` | 53 · 5 · 247 · 5 · ~90 |
| Route destinations | `app/destinations/page.tsx` · `[region]/page.tsx` | 89 · 192 |
| Component | `components/tours/*` — 22 file (listing 519, filters 178, booking-box 160, itinerary 170, list-card 134, reviews/see-all 262, …) | ~2 300 |
| SEO | `components/seo/json-ld.tsx` (Organization · Breadcrumb · Tour · Article) | 157 |
| Skeleton | `skeletons/tours-listing-skeleton.tsx` · `tour-detail-skeleton.tsx` | 52 · 35 |
| Lib | `lib/api/tours.ts` · `api/tour-detail.ts` · `tours.ts` · `tours/availability.ts` · `tour-detail-derive.ts` · `paginate.ts` · `reviews-pager.ts` · `core/tours-filter.ts` | ~620 |

**≈ 4 000 LOC** cho riêng cụm tours (chưa tính destinations). v2 hiện **chưa có
route nào** trong hai đường dẫn này.

## (a) Tầng trang / tính năng

### Listing `/tours`

| Tính năng | Nexora | v2 | Phân loại |
| --- | --- | --- | --- |
| Trang `/tours` tồn tại | `app/tours/page.tsx` | ❌ navbar còn trỏ `/#tours` | **thụt lùi cần vá** |
| Facet Category | `tours-filters.tsx:143` | API có `category` | hạ tầng đủ, UI chưa |
| Facet Destination | so theo **tên** primary | API lọc theo **slug**, bất kỳ link M:N | **v2 tốt hơn** |
| Facet Duration (`1`/`2-3`/`4+`) | `tours-filters.tsx:157` | ❌ API không có `minDays/maxDays` | **thụt lùi cần vá** |
| Facet Price (`<100`/`100-300`/`300+`) | `tours-filters.tsx:168` | ❌ API không có `minPrice/maxPrice` | **thụt lùi cần vá** |
| Facet Travel style / Theme | khai báo nhưng **đã tắt** — comment gốc: *"API doesn't model these tags"* | ❌ | **cố ý bỏ** — Nexora tự thừa nhận là nợ |
| Facet Difficulty | ❌ | `TourCardSchema.difficulty` có sẵn | **v2 tốt hơn** (dữ liệu có, thiếu tham số query) |
| Sort popular / rating | `sortTours` client | ❌ `TourSortKeySchema` không whitelist rating | **thụt lùi cần vá** |
| Sort price / duration / title / newest | client | API có đủ | **v2 tốt hơn** (server-side) |
| Search bỏ dấu tiếng Việt | `normalizeText` fold dấu + `đ` | API `contains insensitive` — **không fold dấu** | **thụt lùi cần vá** (nhỏ) |
| Phân trang số trang + ellipsis | `paginate.ts` client, sau khi tải `pageSize:100` | API trả `{page,limit,total,totalPages}` | **v2 tốt hơn** — Nexora không mở rộng quá 100 tour |
| Rows-per-page (10/15/25) | có | ❌ | thụt lùi (nhỏ) |
| "Showing X–Y of Z" `aria-live` | có | mẫu tương đương ở `blog-explorer.tsx:81` | **làm khác mà tương đương** |
| Chip filter đang bật + Clear all | `tours-listing.tsx:294` | `category-chips.tsx` (chọn 1, chưa phải chip xoá) | thụt lùi (nhỏ) |
| Sidebar thu/mở + drawer mobile | có | ❌ | thụt lùi (nên có) |
| Empty state có CTA clear | có | mẫu ở `blog-explorer.tsx:85` | **làm khác mà tương đương** |
| Phân biệt "API lỗi" vs "rỗng thật" | `settle()` + `LoadErrorState` | ❌ | **thụt lùi cần vá** |
| Skeleton `loading.tsx` | có | ❌ **v2 không có `loading.tsx` ở bất kỳ route nào** | **thụt lùi cần vá** |
| URL-sync bộ lọc | **1 chiều** — seed `?category`/`?q` rồi thôi, filter không ghi URL | `blog-explorer.tsx:38-50` `router.replace` scroll:false | **v2 tốt hơn** |

### Detail `/tours/[slug]`

| Tính năng | Nexora | v2 | Phân loại |
| --- | --- | --- | --- |
| Hero + breadcrumb + meta | `[slug]/page.tsx:112` | ❌ (có mẫu `ContentHero`) | thụt lùi cần vá |
| Gallery ảnh | dùng `marketing/gallery`; `tour-gallery.tsx` là **dead code** | ❌ | **cố ý bỏ** — contract không có field ảnh, site đang dùng `ImagePlaceholder` |
| One-page-scroll (không tabs) | `[slug]/page.tsx:190` | — | tiền lệ IA đáng giữ |
| Sidebar booking sticky | `booking-box.tsx:50` | ❌ | thụt lùi cần vá |
| Itinerary stepper + Markdown | `tour-itinerary.tsx` render Markdown | `TourItineraryDaySchema.description` là **text thuần ≤2000** | **làm khác mà tương đương** — v2 render text thuần, không parse Markdown |
| Included / Excluded | `tour-included.tsx` + **regex-parse** meals/transport từ `included[]` | API `included[]`/`excluded[]` | **v2 tốt hơn** — không port cái hack regex |
| Highlights | có | API `highlights[]` | hạ tầng đủ |
| Meeting point | ❌ | `meetingPoint` | **v2 tốt hơn** |
| FAQ | accordion | API `faqs[]` | hạ tầng đủ |
| Policies | map `title→body` phẳng, đoán nhóm theo tiêu đề | API `policies[].kind` enum | **v2 tốt hơn** |
| **Departures / chọn ngày** | liệt kê ngày — **nhưng `departures: []` hardcode** (`lib/api/tour-detail.ts:77`), khối luôn ẩn | `TourDepartureSchema` thật: ngày, `seatsLeft`, `effectivePrice`, `compareAtPrice`; chỉ OPEN + tương lai, sort tăng | **v2 tốt hơn (rõ rệt)** — Nexora *giả vờ có* |
| "Seats left" trên card listing | `nextDepartureDate/SeatsLeft` trên card | ❌ không có trên `TourCardSchema` | **thụt lùi cần vá** |
| Giá + giá gạch | `Number(dto.basePrice)` — mất chính xác | string decimal | **v2 tốt hơn** |
| Rating | aggregate live mỗi page-load | denormalize atomically, `ratingAvg` **nullable** (null ≠ 0) | **v2 tốt hơn** |
| Review list + "See all" dialog | trả nguyên row Prisma | `PublicReviewSchema` strip PII bằng Zod | **v2 tốt hơn** (an toàn), UI chưa có |
| Related tours | `pickRelated` = **cắt 4 tour đầu**, không xét vùng/chuyên mục | ❌ | thụt lùi (nên có) — đừng port bản Nexora |
| Wishlist | chỉ signed-in, fetch toàn bộ id rồi `.includes` | contract có `wishlist.check` **batch** | **v2 tốt hơn** (API), UI chưa có |
| Share | ❌ | `components/blog/share-row.tsx` | **v2 tốt hơn** |
| `/tours/[slug]/book` | có | ❌ | **cố ý bỏ** — luồng booking ngoài phạm vi cụm trang tĩnh |

### `/destinations`

Nexora có `/destinations` (hub theo vùng) + `/destinations/[region]`, dựng từ
**fixture cứng** `lib/regions.ts`. Quan hệ với `/tours` là **trang riêng**, không
phải filter. v2 chưa có; API `destinations.list` trả `tourCount` thật nên bản v2
sẽ dựng từ dữ liệu chứ không phải fixture → **v2 tốt hơn** khi làm.

**Quyết định 27/07: tách cụm riêng.** Cụm Tours chỉ vá link chết trong navbar
bằng cách trỏ sang `/tours?destination=<slug>` — xem spec §3.

## (b) Tầng hạ tầng xuyên suốt

| Hạng mục | Nexora | v2 | Phân loại |
| --- | --- | --- | --- |
| `generateMetadata` + OG | có | mẫu ở `blog/[slug]` | làm khác mà tương đương |
| `alternates.canonical` | `[slug]/page.tsx:57` | ❌ mẫu blog bỏ sót | **thụt lùi cần vá** |
| `generateStaticParams` | từ API slug list | từ mock (blog) | làm khác mà tương đương |
| JSON-LD Product + Offer + AggregateRating | `json-ld.tsx:78` | ❌ | **thụt lùi cần vá** |
| JSON-LD BreadcrumbList | module dùng chung | inline ở blog | nên tách module |
| JSON-LD FAQPage | ❌ | ❌ (nhưng v2 có `faqs[]` cấu trúc) | **cơ hội — v2 làm được, Nexora không** |
| `robots.ts` / `sitemap.ts` | có cả hai, phủ `/tours` + mọi slug | ❌ | **thụt lùi cần vá** |
| ISR `revalidate` | 300s cả 2 trang | chưa có chiến lược (đang mock) | thụt lùi khi gắn API |
| Cache tag + on-demand revalidate | `TAGS.TOURS` / `tourTag(slug)`, bust khi publish/duyệt review | ❌ | **thụt lùi cần vá** khi gắn API |
| `react.cache()` chống double-fetch metadata↔body | `tour-detail.ts:122` | chưa cần (mock) | khi gắn API |
| `loading.tsx` cấp route | cả 2 trang | ❌ **không có ở bất kỳ route nào** | **thụt lùi cần vá** |
| `error.tsx` / `not-found.tsx` | chỉ ở root | cũng chỉ ở root | làm khác mà tương đương |
| Skip link | `app/layout.tsx:62` | ❌ | thụt lùi (nên có) |
| `aria-expanded`/`aria-controls` trên facet | có | — | chi tiết đáng port |
| `aria-live` số kết quả | có | `blog-explorer.tsx:81` | làm khác mà tương đương |
| Focus management khi filter đổi | ❌ | ❌ | điểm mù chung — không phải thụt lùi |
| `images.remotePatterns` | unsplash + cloudinary | `next.config.ts` chưa có | thụt lùi khi có ảnh thật |
| Analytics / "view item" | **không có** (grep 0 hit) | không có | làm khác mà tương đương |
| Middleware liên quan tours | matcher chỉ `/tours/:slug/book` — `/tours` public tuyệt đối static | chưa có middleware | làm khác mà tương đương — nguyên tắc đáng giữ |
| Test tầng component (jsdom + RTL) | `review-card.spec.tsx`, `see-all-reviews.spec.tsx` | ❌ nợ đã ghi, "gốc rễ 2 lỗi lọt CI" | **thụt lùi cần vá** |

## Thụt lùi cần vá — xếp mức độ

**Quan trọng**

1. `TourCardSchema`/`TourDetailSchema` **không có field ảnh nào**. Nexora có
   `media[]` role=hero; Prisma `MediaAsset` có `ownerType: TOUR` nhưng không code
   nào query cho tour. Chính sách `ImagePlaceholder` che được ở cụm này, nhưng
   đây là lỗ contract thật.
2. **Sort popular/rating bất khả thi** — cột `ratingAvg`/`ratingCount` đã
   denormalize sẵn, chỉ thiếu whitelist trong `TourSortKeySchema`.
3. **Không có filter duration/price** — hai facet Nexora hiển thị, copy i18n v2
   đã port sẵn, nhưng API không nhận tham số nào.
4. **Mất next-departure trên card listing** — toàn bộ đòn bẩy urgency của listing.
5. **Không có `robots.ts`/`sitemap.ts`** — trang catalogue vô hình với crawler.
6. **Không có JSON-LD Product/Offer/AggregateRating** — mất rich result giá + sao.
7. **Không có cache-tag revalidation** — duyệt một review phải chờ hết TTL.

**Nên có**

8. Không có `loading.tsx` ở bất kỳ route nào.
9. Không có `settle()` + `LoadErrorState` → API lỗi hiện "No tours match your
   filters", tức **nói dối người dùng**. Nexora ghi thẳng bài học này trong
   comment `app/tours/page.tsx:16-18`.
10. Thiếu `alternates.canonical`.
11. Không có skip link.
12. Không có jsdom/RTL cho `apps/web` — cụm tours là cụm tương tác nặng nhất.
13. `next.config.ts` chưa có `images.remotePatterns`.
14. Related tours (và đừng port `pickRelated` hời hợt của Nexora).

**Nhỏ**

15. Rows-per-page + "Showing X–Y of Z".
16. Sidebar collapse + drawer mobile.
17. JSON-LD Organization/TravelAgency site-wide.
18. Search không fold dấu ở tầng API.

## v2 tốt hơn — cơ hội thiết kế

| v2 có | Nexora | Vì sao là cơ hội |
| --- | --- | --- |
| `departures[]` **thật** | hardcode `[]` | Chọn ngày + giá theo đợt + ghế còn là feature Nexora chưa từng có → **điểm nhấn số 1 của trang detail** |
| `difficulty` trên card | ❌ | Chip card, không tốn migration |
| `suitableFor[]` | có nhưng chỉ hiển thị | Thay hẳn cặp facet Nexora **buộc phải tắt** |
| `maxGroupSize` | ❌ | "Up to 12 guests" — khớp câu chuyện thương hiệu |
| `meetingPoint` | ❌ | Gắn vào Day 1 của itinerary |
| `policies[].kind` enum | phẳng | Nhóm đúng ngữ nghĩa thay vì đoán theo tiêu đề |
| `destinations[]` M:N, primary đứng đầu | chỉ dùng `[0].name` | **Chuỗi chặng** "Hạ Long → Cát Bà → Ninh Bình" |
| `category.toursCount` / `destination.tourCount` | ❌ / fixture cứng | Nhãn "Adventure (7)"; chỉ đếm tour đã publish (Nexora lộ cả draft) |
| Tiền là string decimal | `Number()` | Không mất chính xác |
| `ratingAvg` nullable | aggregate live | "Chưa có đánh giá" ≠ "0.0 ★"; đọc rẻ hơn |
| Phân trang server + tie-break `id asc` | client sau `pageSize:100` | Mở rộng được quá 100 tour |
| `PublicReviewSchema` strip PII | trả nguyên row Prisma | An toàn theo cấu trúc |
| `wishlist.check` batch | fetch toàn bộ rồi `.includes` | Nút wishlist trên **mọi card listing** khả thi |
| URL-sync filter (mẫu `blog-explorer`) | 1 chiều | Link chia sẻ được, F5 giữ bộ lọc |

## Cảnh báo — copy i18n đã port nhưng SAI hình dạng

`libs/shared/i18n/src/lib/messages.ts` đã có sẵn `toursPage` (1401–1464),
`tourDetail` (1465–1652), `travellerTypes` (1394), `tours.suitableFor` (1390),
`availability` (1092), `pagination` (451), `enquiryCta` (1653).

Nhưng đó là copy **hình dạng Nexora**. Những key sau mô tả tính năng API v2
**không phục vụ được**, phải cắt hoặc để lại có chú thích:

- `toursPage.sortOptions.popular` · `.rating` — không có sort theo rating
- `toursPage.facets.duration` · `.price` · `.travelStyle` · `.theme`
- `toursPage.durationLabels` · `priceLabels` · `styleLabels` · `themeLabels`
- `tourDetail.gallery` · `.mealsLabel` — không có field ảnh, không có field bữa ăn
- `tourDetail.specs.accommodation` · `.travelStyle` · `.theme`

Bài học: copy port trọn gói từ repo cũ **không phải bằng chứng tính năng tồn
tại**. Đối chiếu copy ↔ contract trước khi dựng UI theo copy.

## Điểm mù — không kết luận được

1. **Không đọc backend Nexora.** Mọi khẳng định về `TourSummaryDto`/`TourDetailDto`
   suy từ cách FE tiêu thụ, không mở `apps/api` của repo cũ.
2. **Không rõ `TourItineraryDay.description` v2 có định là Markdown không** —
   schema chỉ nói `string().max(2000).nullable()`. Cụm này render **text thuần**.
3. **Không xác minh được đã có ADR nào cố ý bỏ `media` khỏi `TourCardSchema`.**
   `docs/analysis/2026-07-22-backend-readiness-vs-nexora.md` không nhắc tới media
   tour. Coi đây là lỗ chưa phát hiện, chưa loại trừ khả năng có quyết định ở
   nơi chưa đọc.
4. **Analytics không tồn tại ở cả hai repo** — không phải thụt lùi, là khoảng
   trắng chung.
5. Không chạy build/dev repo nào — mọi kết luận thuần đọc mã.
