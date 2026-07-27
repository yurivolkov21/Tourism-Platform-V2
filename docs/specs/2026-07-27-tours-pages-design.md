# Spec — cụm trang Tours (P3b): `/tours` + `/tours/[slug]`

Ngày 27/07/2026 · nối tiếp [cụm Blog](2026-07-25-blog-pages-design.md) ·
đối chiếu Nexora: [phân tích 27/07](../analysis/2026-07-27-tours-parity-nexora.md)

## 1. Mục tiêu

Dựng hai trang tour **tĩnh, chạy bằng mock**, theo quy trình static-first đã
dùng cho Home / auth / pháp lý / Blog. Điểm khác biệt của cụm này so với các
cụm trước: **backend đã có contract tour hoàn chỉnh và giàu hơn mock rất nhiều**
(`libs/shared/contract/src/schemas/catalog.ts`). Nên mock được **đắp lại theo
đúng tên field của contract ngay từ đầu**, để cụm gắn API sau này là *swap
nguồn dữ liệu*, không phải *rename khắp component*.

### Trong phạm vi

- `/tours` — listing có lọc, tìm, sắp xếp, phân trang.
- `/tours/[slug]` — trang chi tiết, bố cục "Departure Board".
- Viết lại `mocks/tours.ts` + kiểu mock theo hình dạng `TourCardSchema` /
  `TourDetailSchema`; nâng 6 → 16 tour để `limit=12` có trang 2 thật.
- Vá link chết trong navbar (Tours + 3 mục Destinations).
- Bốn khoản nợ treo (§9).

### Ngoài phạm vi — nói rõ để không hiểu nhầm

- **Không đụng `apps/api`.** Không sửa contract, không sửa `catalog.service.ts`,
  không thêm tham số query. Contract chỉ được **đọc** để lấy tên field.
- Không gắn API. Không `fetch`, không `NEXT_PUBLIC_API_URL`.
- Không `/destinations` (tách cụm riêng — §3).
- Không luồng đặt chỗ `/tours/[slug]/book`, không thanh toán.
- Không ảnh thật — toàn bộ dùng `ImagePlaceholder` theo chính sách hiện hành.

## 2. Bốn quyết định đã chốt (27/07)

| # | Quyết định | Lý do |
| --- | --- | --- |
| 1 | `/destinations` **tách cụm riêng** | Nexora tốn 281 LOC + 16 component cho mảng này; gộp vào đây là gấp đôi cụm |
| 2 | Filter **chỉ ship cái API phục vụ được**, ghi nợ | Không dựng filter mà backend không đỡ được; không đụng API trong cụm tĩnh |
| 3 | Detail dùng bố cục **B — Departure Board** | Điểm nhấn trùng đúng chỗ dữ liệu v2 mạnh nhất và Nexora không có |
| 4 | Trả **cả 4** khoản nợ treo | §9 |

**Ghi chú về quyết định 4.** Khoản nợ thứ tư (tách `ArticleBody` + phân trang
`/blog`) không liên quan trực tiếp tới cụm Tours. Nó được xếp thành **task cuối
cùng, độc lập**, để có thể cắt khỏi cụm mà không ảnh hưởng gì nếu thấy loãng.

## 3. Vá link chết trong navbar

Hiện trạng `apps/web/src/components/site-header.tsx`:

- `Tours` → `/#tours` (anchor này thật ra trỏ tới section Stats, không phải tour)
- `Destinations — North/Central/South` → `/#gallery` (cả ba trỏ cùng một chỗ)

Sau cụm này:

- `Tours` → `/tours`
- Dropdown `Destinations` **đổi từ 3 vùng thành 9 địa danh nhóm theo vùng**,
  mỗi mục → `/tours?destination=<slug>`.

Lý do đổi cấu trúc dropdown: menu hiện liệt kê **vùng** (north/central/south),
nhưng `ToursListQuerySchema` không có tham số `region` — chỉ có `destination`
(slug). Trỏ vùng sang `/tours` mà không lọc được gì thì vẫn là link nói dối.
Chín địa danh trong `mocks/destinations.ts` (Sa Pa · Hạ Long · Ninh Bình · Huế ·
Đà Nẵng · Hội An · Sài Gòn · Cần Thơ · Phú Quốc) khớp đúng tham số API và giữ
được chấm tint `--region-primary` theo nhóm vùng (ADR-0013 #4).

`MOBILE_LINKS` cập nhật tương ứng.

## 4. Mock đắp lại theo contract

### 4.1 Đối chiếu mock cũ → contract

| `MockTour` hiện tại | Contract | Xử lý |
| --- | --- | --- |
| `slug` `title` `summary` | y hệt | giữ (`summary` thành nullable) |
| `days` | `durationDays` | đổi tên |
| `priceUsd: number` | `basePrice: string` + `currency: string` | **đổi kiểu** — tiền LUÔN là string |
| `compareUsd?: number` | `compareAtPrice: string \| null` | đổi tên + kiểu + nullable tường minh |
| `rating: number` | `ratingAvg: number \| null` | đổi tên; **null ≠ 0** |
| `reviews: number` | `ratingCount: number` | đổi tên |
| `region` | ❌ không có trên card | bỏ khỏi tour; vùng vẫn sống ở `mocks/destinations.ts` |
| `place: "Quảng Ninh · junk boat · kayaking"` | ❌ | thay bằng **chuỗi chặng** dẫn xuất từ `destinations[]` |
| `tags: string[]` | ❌ | thay bằng `category` + `difficulty` |
| `image: string` | ❌ **không field ảnh nào** | bỏ; `ImagePlaceholder` không cần đường dẫn |
| `flag: "−20% TODAY"` | `badges[]` chỉ có ở **detail** | chip giảm giá trên card **dẫn xuất từ `compareAtPrice`** |
| — | thiếu `id` `currency` `difficulty` `maxGroupSize` `isFeatured` `destinations[]` `category` | thêm |
| — | thiếu **toàn bộ 10 field** của detail | thêm |

Đây là **viết lại**, không phải sửa.

### 4.2 Kiểu mock mới (`mocks/types.ts`)

Gương đúng contract, tách card / detail như contract tách:

```ts
/** Gương TourCardSchema — mọi tên field khớp contract để lúc gắn API swap thẳng. */
export interface MockTourCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  /** Chuỗi thập phân, KHÔNG phải number — tiền luôn là string. */
  basePrice: string;
  compareAtPrice: string | null;
  currency: string;
  durationDays: number;
  difficulty: 'EASY' | 'MODERATE' | 'CHALLENGING' | null;
  maxGroupSize: number;
  isFeatured: boolean;
  destinations: { slug: string; name: string; isPrimary: boolean }[];
  category: { slug: string; name: string };
  /** null = CHƯA AI đánh giá. Khác hẳn 0 = bị chấm 0 điểm. */
  ratingAvg: number | null;
  ratingCount: number;
}

/** Gương TourDetailSchema = card + nội dung bán hàng + đợt khởi hành. */
export interface MockTourDetail extends MockTourCard {
  suitableFor: ('FAMILY' | 'COUPLE' | 'FRIENDS' | 'SOLO' | 'BUSINESS')[];
  badges: ('BEST_VALUE' | 'LIMITED_OFFER' | 'EXCLUSIVE' | 'NEW' | 'POPULAR')[];
  included: string[];
  excluded: string[];
  highlights: string[];
  meetingPoint: string | null;
  itinerary: { dayNumber: number; title: string; description: string | null }[];
  faqs: { question: string; answer: string }[];
  policies: { kind: 'CANCELLATION' | 'BOOKING' | 'GENERAL'; title: string; body: string }[];
  departures: {
    id: string;
    /** YYYY-MM-DD — @db.Date serialize thành ngày lịch, không phải datetime. */
    startDate: string;
    endDate: string;
    seatsLeft: number;
    effectivePrice: string;
    compareAtPrice: string | null;
  }[];
}
```

`MockTour` cũ bị xoá. Ba chỗ đang tham chiếu nó (`mocks/tours.ts`,
`mocks/types.ts`, `components/home/tour-card.tsx`) đều nằm trong cụm này.

### 4.3 Dữ liệu mock

- **16 tour** phủ 9 địa danh × 5 chuyên mục, độ dài 1–12 ngày, giá $59–$1 480.
- Vài tour cố tình `ratingAvg: null` (tour mới) để chứng minh nhánh "chưa có
  đánh giá"; vài tour `compareAtPrice: null`; ít nhất một tour
  `departures: []`; ít nhất một đợt `seatsLeft: 0`; vài tour `difficulty: null`,
  `meetingPoint: null`, `summary: null` — mock phải ép **mọi nhánh nullable**
  hiện ra, nếu không thì trang chỉ đẹp với dữ liệu đẹp.
- **Không có field `createdAt`** — contract không trả nó (nó chỉ là *sort key*).
  Quy ước: **thứ tự mảng mock = thứ tự `createdAt desc`**. Sort "Newest" trả
  nguyên thứ tự mảng; đây là giới hạn static-first, ghi rõ trong comment.

## 5. Trang `/tours` — listing

### 5.1 Bố cục

Chọn **chip rail + toolbar dính**, không sidebar. Lý do cứng: API chỉ có 3
chiều lọc (category · destination · featured) + search. Một rail 280px chứa 3
nhóm là khoảng rỗng trông thấy; Baymard cũng khuyến nghị thanh ngang khi ≤8
nhóm filter, sidebar chỉ hợp khi ≥5–10. Bố cục này còn tái dùng nguyên
`CategoryChips` + mẫu URL-sync của `BlogExplorer` đã chạy thật ở `/blog`.

```
┌─────────────────── hero TỐI (~40vh, không ảnh) ───────────────────┐
│ Home › Tours                                                      │
│ 16 tours across 9 destinations          ← số đếm TRÊN H1          │
│ H1 (font-heading)                                                 │
│ subtitle                                                          │
│ [🔍  search tours…]                                               │
└───────────────────────────────────────────────────────────────────┘
┌── toolbar dính ───────────────────────────────────────────────────┐
│ ‹ All · Cruises · Trekking · Culture · Food · Beaches ›  (chip)   │
│ 16 tours  ⓧ Trekking  ⓧ Sa Pa   Clear all                        │
│                    [Destination ▾] [Featured] [Sort: Newest ▾]    │
└───────────────────────────────────────────────────────────────────┘
  lưới card 3 cột (lg) · 2 (sm) · 1 (base)
  ‹ 1 2 › phân trang đánh số
```

- Hero **tối** (hero sáng làm navbar tàng hình). `ContentHero` hiện tại phục vụ
  trang nội dung dài (breadcrumb + title + meta + subtitle) và **không nhận
  thêm gì được nữa mà không thành cái phễu prop**. Nên cụm này có hero riêng:
  `components/tours/tours-hero.tsx`. Nó **dùng lại `TopoPattern` + lớp scrim +
  nhịp animation** của `ContentHero`, không dùng lại chính component đó.
- Chip rail lấy từ `category.name` **duy nhất** trong 16 tour mock, giữ thứ tự
  xuất hiện — cùng quy tắc `postCategories()` của `/blog`, thêm mục `All` dẫn đầu.
- **Số kết quả đặt TRÊN H1** dạng câu chữ, không phải label khô cạnh dropdown.
- Toolbar `sticky` dưới navbar; trên mobile gom `Destination`/`Featured`/`Sort`
  vào một drawer `Filters (n)`.
- Phân trang **đánh số** (không "Load more"): back-button hoạt động đúng, URL
  chia sẻ được, và `limit=12` với catalog capstone thì số trang ít.

### 5.2 Card tour

Giữ nguyên thiết kế card đã có ở `components/home/tour-card.tsx` (hướng đã chốt
ở cụm Blog: "lấy thiết kế Home áp cho trang listing"), **chuyển file** sang
`components/tours/tour-card.tsx` — nó hiện không trang nào import, nên đây là
dọn dẹp không rủi ro — rồi thay nguồn field:

| Vùng trên card | Nguồn |
| --- | --- |
| Ảnh | `ImagePlaceholder`, nhãn = tên destination chính (không dùng `title` — trùng `CardTitle` ngay dưới, trình đọc màn hình đọc hai lần) |
| Badge góc ảnh | `−N%` dẫn xuất từ `compareAtPrice`, hoặc `Featured` khi `isFeatured` |
| Eyebrow | `category.name` |
| Tiêu đề | `title` |
| Dòng chặng | **chuỗi chặng** `Hạ Long → Cát Bà → Ninh Bình` in mono, `isPrimary` đậm |
| Meta | `durationDays` · `maxGroupSize` · `difficulty` (null thì bỏ chip) |
| Rating | `ratingAvg` + `ratingCount`; **`null` → bỏ hẳn dòng sao**, thay bằng nhãn `Not yet reviewed`. Tuyệt đối không render `0.0` hay 5 sao rỗng |
| Giá | `basePrice` + `compareAtPrice` gạch + `/ person` |
| Hành động | nút wishlist (chưa nối) + `View tour` → `/tours/[slug]` |

**Chuỗi chặng là điểm chống "mùi template" chính của card.** Template viết
`7 days • Small group • Vietnam`; chuỗi chặng là dữ liệu thật từ `destinations[]`
và là thứ duy nhất phân biệt card tour với card khách sạn.

### 5.3 Trạng thái

- **Rỗng do lọc**: `No tours match your filters` + nút `Clear all filters`.
- **Lỗi tải**: `LoadErrorState` riêng biệt (§9.3) — *không* dùng lại empty
  state. Nexora ghi thẳng bài học này trong comment: hiện "No tours match your
  filters" khi API chết là **nói dối người dùng**.
- **Đang tải**: `loading.tsx` với skeleton 12 card.

## 6. Trang `/tours/[slug]` — "Departure Board"

### 6.1 Vì sao bố cục này

Trong 8 sản phẩm thật đã khảo sát (G Adventures, Intrepid, TourRadar, Much
Better Adventures, Explore, Wild Frontiers, Contiki, Flash Pack), **không sản
phẩm nào đặt lịch khởi hành lên đầu** — tất cả giấu sau một cú click
(`See all dates`, `View dates & book`, `VIEW DATES`).

Với v2 thì `departures[]` lại là dữ liệu **giàu nhất và độc quyền**: Nexora
hardcode `departures: []`, khối UI của họ luôn ẩn. Đưa nó lên làm xương sống là
trung thực với dữ liệu, không phải trang trí.

### 6.2 Thứ tự section

Hero của detail mang nhiều thứ hơn hẳn hero listing (rating, route ribbon, chip
meta, badges, giá "from") nên cũng là component riêng —
`components/tours/tour-hero.tsx`. Cả ba hero (`ContentHero`, `ToursHero`,
`TourHero`) chia sẻ `TopoPattern` + scrim + nhịp animation, không chia sẻ
component.

```
┌─── hero TỐI, typographic (TopoPattern + scrim) ──────────────────┐
│ Home › Tours › Cruises                                           │
│ ▪ CRUISES · EASY                            ★ 4.9  1,204 reviews │
│ H1                                                               │
│ summary                                                          │
│ ── Hạ Long ●───── Cát Bà ○───── Ninh Bình ○ ──   (route ribbon)  │
│ 2 days · max 12 guests            from $189  $̶2̶3̶6̶   [BEST VALUE] │
├──────────────────────────────────────────────────────────────────┤
│ NEXT DEPARTURES  ◀ [21–30 Aug $175 · 4 left][04–13 Sep …] ▶      │
└──────────────────────────────────────────────────────────────────┘
   ImagePlaceholder band 21:9, full-bleed
┌── rail ──┬───────── main ──────────┬──── booking dính ──────────┐
│ Trip     │ Why this trip           │ YOUR DEPARTURE             │
│ Included │ Good for                │ 21–30 Aug 2026 · 10 days   │
│ Dates    │ Itinerary (timeline)    │ $175   was $236            │
│ Know     │ What's included / not   │ ▮▮▮▮▯▯ Only 4 seats left   │
│          │ All departures (bảng)   │ [ Reserve ]                │
│          │ Good to know (FAQ+pol)  │ Test mode — no card is     │
│          │ You might also like     │ charged.                   │
└──────────┴─────────────────────────┴────────────────────────────┘
```

- **≥1280 (xl)**: 3 cột — rail `OnThisPage` trái · main · booking dính phải.
- **1024–1279 (lg)**: 2 cột — main · booking dính. Bỏ rail trái.
- **< 1024**: 1 cột + **bar dính đáy** (giá · ngày đã chọn · `Reserve`).

### 6.3 Dải khởi hành — cơ chế

Chọn một chip ở dải → chip khoá `aria-pressed` → **ba nơi cùng đồng bộ**: rail
booking, bar đáy mobile, và hàng tương ứng trong bảng "All departures" được
highlight. Một hành động, ba phản hồi — đây là điểm nhấn có tổ chức thay vì
hiệu ứng rải rác.

- Dải hiện **4–6 đợt gần nhất**; bảng đầy đủ nằm giữa trang.
- `scroll-snap` + điều hướng bàn phím (`←`/`→`, `Home`/`End`).
- Ngưỡng `seatsLeft`: `0` → `Sold out`, hàng mờ, **không chọn được**;
  `1–3` → `Only N seats left` (màu cảnh báo); `>3` → `N seats available`.
  **Đây là suy diễn ở tầng UI, không phải field của contract** — ghi rõ trong
  comment để lúc gắn API không ai đi tìm field `status`.
- `departures: []` → dải đổi thành dòng `No departures scheduled yet`, rail
  booking đổi CTA thành link `Ask about this trip` → `/contact`.

### 6.4 Ánh xạ field → chỗ hiển thị

| Field | Nơi hiển thị |
| --- | --- |
| `title` | H1 trong hero |
| `summary` | Dòng dưới H1; `null` → ẩn cả dòng |
| `basePrice` `currency` | Hero (`from $189`) + giá mặc định rail khi chưa chọn đợt |
| `compareAtPrice` | Gạch ngang + tính `%` cho badge; `null` → không render, không hiện `0%` |
| `durationDays` | Chip meta hero + nhãn rail |
| `difficulty` | Eyebrow hero cạnh category; `null` → bỏ |
| `maxGroupSize` | Chip meta hero (`max 12 guests`) |
| `destinations[]` | **Route ribbon** dưới H1; `isPrimary` = chấm đặc, đứng đầu |
| `category` | Eyebrow hero + mắt xích breadcrumb |
| `ratingAvg` `ratingCount` | Góc phải hero; `null` → chip `New — no reviews yet`, **không bao giờ `0.0`** |
| `suitableFor[]` | Khối **Good for** — hàng chip có icon; rỗng → ẩn section |
| `badges[]` | Chip hero cạnh giá, tối đa 2 rồi `+N`; `LIMITED_OFFER` dùng token cảnh báo |
| `highlights[]` | Section **Why this trip** — bullet chấm vuông, **không đánh số** |
| `included[]` `excluded[]` | Section 2 cột: trái tick, phải cross; một bên rỗng → cột đó hiện `—`, giữ lưới 2 cột |
| `meetingPoint` | Thẻ nhỏ gắn vào **Day 1** của timeline (`Meet at …`); `null` → ẩn |
| `itinerary[]` | Timeline dọc **mở hết** (không accordion — mô tả v2 ngắn); `dayNumber` in lớn ở rail trái mỗi mục; `description` null → chỉ hiện title |
| `faqs[]` | Accordion trong **Good to know**; rỗng → ẩn |
| `policies[]` | Cùng section, **gom nhóm theo `kind`**; `body` render bằng `Typeset` preset reading |
| `departures[]` | **3 nơi**: dải chip · rail booking · bảng đầy đủ |
| `isFeatured` | **Không hiển thị** — không có chỗ tự nhiên trên trang detail; chỉ dùng để xếp thứ tự ở "You might also like" |

Đánh số **chỉ ở itinerary**, nơi thứ tự thật sự mang nghĩa. `highlights[]`
không phải chuỗi có thứ tự nên dùng chấm vuông của `SectionEyebrow`.

### 6.5 Copy chế độ test — đặt đúng 2 chỗ

- Dưới nút CTA trong rail booking, 12px `text-muted-foreground`:
  **`Test mode — no card is charged.`**
- Chân bảng "All departures":
  **`Prices are for demonstration. Checkout runs on Stripe and PayPal sandbox accounts.`**

Câu ngắn nằm sát nút bấm là nơi người dùng thật sự phân vân; câu dài đặt ở chỗ
con số xuất hiện dày nhất. Không lặp ở hero, không dùng banner đỏ — banner phá
nhịp trang và làm sản phẩm trông như bản nháp.

### 6.6 CTA không được dẫn vào 404

Luồng đặt chỗ chưa tồn tại. Nên:

- CTA chính `Reserve` là `<button>` không điều hướng — **đúng tiền lệ đang có**:
  nút `Book a tour` trên navbar cũng là `<button>` chưa nối
  (`site-header.tsx:99`).
- CTA phụ `Ask about this trip` → `/contact` (trang có thật).

## 7. Logic thuần + TDD

Tách hết vào `apps/web/src/lib/tours.ts`, test trước (`tours.spec.ts`), ≥80%
trên logic mới:

| Hàm | Bất biến cần canh |
| --- | --- |
| `filterToursByCategory` | slug lạ → mảng rỗng, **không** âm thầm rơi về "All" (đúng bug đã sửa ở `/blog`) |
| `filterToursByDestination` | khớp **bất kỳ** destination trong mảng, không chỉ primary |
| `filterToursByFeatured` | `undefined` ≠ `false` |
| `searchTours` | bỏ dấu cả hai phía — "ha long" ra "Hạ Long" |
| `sortTours` | `basePrice` so sánh **theo số** dù lưu string; `title` dùng `localeCompare`; `createdAt` = thứ tự mảng |

Hai hàm phân trang **không** nằm trong `lib/tours.ts` mà tách riêng
`apps/web/src/lib/paginate.ts` — đặt tên trung lập ngay từ đầu vì `/blog` sẽ
dùng lại chúng ở §9.4 (đổi tên sau là churn vô ích):

| Hàm | Bất biến cần canh |
| --- | --- |
| `paginate<T>` | trả đúng hình dạng `Paged<T>` của contract; `page` vượt `totalPages` → trang rỗng chứ không crash |
| `pageNumbers` | ellipsis đúng ở đầu/giữa/cuối, `totalPages` 0 và 1 |
| `routeChain` | primary đứng đầu, phần còn lại giữ nguyên thứ tự |
| `discountPercent` | `compareAtPrice` null → `null`; `compareAtPrice ≤ basePrice` → `null` (không hiện `−0%` hay số âm) |
| `formatMoney` | string decimal → `$189`, không đi qua float |
| `departureStatus` | ngưỡng 0 / 1–3 / >3 |
| `formatDateRange` | gộp tháng khi cùng tháng (`21–30 Aug 2026`), không gộp khi khác |
| `groupPoliciesByKind` | thứ tự nhóm cố định Cancellation → Booking → General |
| `relatedTours` | cùng category trước, rồi cùng destination, rồi bù; **không bao giờ chứa chính nó** |

`foldAccents` hiện nằm private trong `lib/blog.ts` — tách ra `lib/text.ts` dùng
chung, `blog.ts` import lại. Test cũ của blog phải vẫn xanh.

## 8. Nợ contract — ghi lại, KHÔNG vá trong cụm này

Năm lỗ đã xác định. Không cái nào chặn cụm tĩnh; tất cả chặn cụm gắn API:

1. **Không có field ảnh** trên `TourCardSchema` lẫn `TourDetailSchema`. Prisma
   `MediaAsset` có `ownerType: TOUR` nhưng không code nào query cho tour.
2. **Không có `nextDepartureDate` / `nextDepartureSeatsLeft` trên card** →
   listing mất đòn bẩy urgency mà Nexora có.
3. **Không sort được theo rating/popularity** dù cột đã denormalize sẵn.
4. **Không filter được theo price / duration / difficulty** (Nexora có 2/3).
5. **`suitableFor` và `badges` chưa có trên card**.

Đề xuất: một ADR mở rộng `ToursListQuerySchema` + `TourCardSchema` trước cụm
gắn API. Không làm ở đây.

## 9. Bốn khoản nợ trả trong cụm

### 9.1 jsdom + RTL cho `apps/web` — cần ADR trước

Cụm này là cụm tương tác nặng nhất từ trước tới nay: filter, phân trang, chọn
đợt khởi hành, accordion, drawer. CHANGELOG đã chỉ đích danh việc thiếu test
tầng component là **gốc rễ 2 lỗi lọt CI**.

**ADR-0014** (viết trước code, luật #5): thêm môi trường `jsdom` +
`@testing-library/react` cho `apps/web`, phạm vi áp dụng, và ranh giới với test
logic thuần hiện có (Vitest node). Vitest giữ nguyên — không thêm test runner
thứ hai.

Test component tối thiểu trong cụm: `ToursExplorer` (lọc → URL đổi, chip lạ →
empty state), `DepartureStrip` (chọn chip → rail đồng bộ, đợt `seatsLeft: 0`
không chọn được).

### 9.2 `robots.ts` + `sitemap.ts`

Nexora có cả hai, phủ `/tours` + mọi slug. `lib/site.ts` (`absoluteUrl`) đã sẵn.
Sitemap phủ: trang tĩnh hiện có + 16 tour + 9 bài blog. Robots: allow `/`,
disallow các nhánh riêng tư khi chúng xuất hiện.

### 9.3 `loading.tsx` + `LoadErrorState`

`apps/web` hiện **không có `loading.tsx` ở bất kỳ route nào**. Thêm cho `/tours`
và `/tours/[slug]`.

`LoadErrorState` (`components/feedback/`) tách bạch "API lỗi" khỏi "rỗng thật".
`settle()` đã có sẵn trong `@tourism/i18n` (`lib/resilience.ts`).

**Nói thẳng giới hạn:** ở cụm tĩnh này chưa có API để mà lỗi, nên `LoadErrorState`
là *khung dựng sẵn chưa có dữ liệu chạy qua*. Làm bây giờ vì rẻ hơn nhét vào lúc
wire, nhưng nó chưa chứng minh được gì cho tới cụm gắn API.

### 9.4 Tách `ArticleBody` + phân trang `/blog`

Khoản duy nhất không liên quan cụm Tours. Xếp **task cuối, độc lập**:

- Tách phần thân bài dùng chung giữa `/terms` (và 3 trang pháp lý) và
  `/blog/[slug]` thành `components/content/article-body.tsx`.
- Phân trang cho `/blog` (9 bài, `limit` khớp lưới 3 cột) — dùng thẳng
  `paginate`/`pageNumbers` từ `lib/paginate.ts` (§7), không viết lại.

## 10. Copy i18n — phải cắt trước khi dùng

`messages.ts` đã có sẵn `toursPage` (1401–1464) và `tourDetail` (1465–1652),
nhưng đó là copy **hình dạng Nexora**. Những key sau mô tả tính năng API v2
không phục vụ được và **phải xoá hoặc đánh dấu là chưa dùng**:

`toursPage.sortOptions.popular` · `.rating` · `facets.duration` · `.price` ·
`.travelStyle` · `.theme` · `durationLabels` · `priceLabels` · `styleLabels` ·
`themeLabels` · `tourDetail.gallery` · `.mealsLabel` · `specs.accommodation` ·
`.travelStyle` · `.theme`

`toursPage.subtitle` hiện viết *"filter by destination, length, travel style and
theme"* — nói dối về ba thứ không có. Viết lại.

Bài học ghi vào analysis: **copy port trọn gói từ repo cũ không phải bằng chứng
tính năng tồn tại.** Đối chiếu copy ↔ contract trước khi dựng UI theo copy.

## 11. Tiêu chí hoàn thành

- [ ] `/tours` render 16 tour, lọc/tìm/sắp xếp/phân trang chạy, trạng thái ghi
      vào URL, F5 giữ nguyên bộ lọc.
- [ ] `/tours/[slug]` render đủ 10 field detail, chọn đợt khởi hành đồng bộ 3 nơi.
- [ ] Mọi nhánh nullable có mock chứng minh (rating null, không departures,
      sold out, difficulty null, summary null).
- [ ] Navbar không còn link chết; mọi link trỏ tới trang có thật.
- [ ] Toàn bộ ảnh là `ImagePlaceholder`; không một mã hex nào; copy user-facing
      tiếng Anh trong `@tourism/i18n`; comment code tiếng Việt.
- [ ] ADR-0014 viết TRƯỚC khi thêm jsdom.
- [ ] `pnpm gate:int` xanh.
- [ ] Chụp ảnh kiểm tra bằng playwright-core trên dev server cổng 3000 (không
      chạy `next build` khi cổng đó còn sống).

## 12. Mốc dừng bắt buộc

Dựng xong **`/tours` listing thì DỪNG** cho user xem trước khi làm trang detail.
