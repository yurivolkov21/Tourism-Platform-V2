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

> **Sửa 27/07 sau vòng review đầu.** Bản đầu dùng chip rail + toolbar ngang với
> lý do "API chỉ có 3 chiều lọc nên sidebar sẽ rỗng". User chốt lại: **sidebar
> kiểu Nexora, và đầy đủ hơn Nexora**. Kéo theo: facet đa chọn, thêm Duration ·
> Price · Pace, và danh sách card hàng ngang thay lưới. Phần dưới đã viết lại
> theo quyết định đó; §8 ghi thêm nợ contract phát sinh.

**Bộ lọc nằm trong DRAWER. Trang là MỘT cột rộng.**

> **Sửa lần 3, 27/07 — bỏ hẳn sidebar.** Hai bản trước đều là sidebar (bản 1
> dính + cuộn nội bộ, bản 2 tĩnh + thanh công cụ dính). Cả hai đều sai ở tầng
> cao hơn: bố cục hai cột biến trang bán tour thành trang quản trị, và hero mất
> trọng lượng ở **cả light lẫn dark** — đúng nghĩa thụt lùi so với Nexora.
> Khảo sát lại toàn bộ mẫu ở shadcnspace + shadcnstudio (27 + 31 mẫu, render
> thật trong trình duyệt, đọc source registry) rồi chốt hướng drawer.

**Nguồn thiết kế và lấy gì từ đâu:**

| Nguồn | Lấy về |
| --- | --- |
| **Drawer 01 — Onboarding Checklist** (shadcnspace) | Vỏ: `30rem`, `rounded-none` dính mép, header 2 tầng (danh tính + lối thoát / **trạng thái định lượng**), bọc mỗi nhóm trong MỘT thẻ có viền chia hàng bằng `border-b`, cả hàng là vùng bấm |
| **Drawer 12 — Filter** (shadcnstudio) | Mở từ **phải**, ranh giới nhóm chạy hết mép, lọc **tức thì** không Apply |
| **Sheet 04 — Filter Panel** (shadcnspace) | Footer dính + huy hiệu đếm trên trigger |
| **Category Filter 1** (shadcnstudio) | "Show all" cắt danh sách dài |
| **Category Filter 6** (shadcnstudio) | Hàng **pill** cho nhóm 3 lựa chọn thay checkbox dọc |
| **Category Filter 3** (shadcnstudio) | Hàng chip filter đang bật — nhưng đẩy **RA NGOÀI** trang, không để trong drawer |

**Quyết định và lý do:**

| Hạng mục | Chốt | Vì sao |
| --- | --- | --- |
| Hướng mở | Phải | Trigger ở cuối phải thanh kết quả → drawer bung ra ngay dưới con trỏ. Trái là địa bàn của menu điều hướng |
| Bề rộng | `30rem` desktop (mặc định component là `24rem`) | Đủ để hàng pill Duration/Price/Pace nằm gọn MỘT hàng, nên chỉ Category + Destination phải cuộn. **Phải override bằng đúng tiền tố `data-[swipe-axis=x]:sm:`** — viết `sm:` trần thì bộ chọn gốc ưu tiên cao hơn |
| Header | Title + `✕` + **số kết quả sống** | Drawer 01 để thanh progress ở đây; lọc thì KHÔNG có đích nên thay bằng số kết quả — header thành phản hồi, không phải nhãn |
| Footer | `Clear all` (ghost) · `Show N tours` (primary) | KHÔNG chia 50/50 như Sheet 04 — hai nút không cùng trọng lượng. Nút phải là **lối thoát mang kết quả**, không phải lệnh commit |
| Áp dụng | **Tức thì**, không Apply | Mỗi option mang số đếm; nếu hoãn áp dụng thì số đếm tính trên trạng thái chờ, tức là một con số không phản ánh gì đang có trên trang |
| Nhóm 3 lựa chọn | Hàng **pill** `aria-pressed` (vẫn đa chọn) | Ba lựa chọn xếp dọc tốn ba hàng cho một quyết định đơn giản; pill gói vào một hàng và tách thị giác "chọn khoảng" khỏi "chọn từ danh sách" |
| **Sort** | **Ngoài trang**, không nhét vào drawer | Lọc *thu hẹp tập kết quả*, sắp xếp *đổi thứ tự cùng tập* — hai mô hình khác nhau, gộp chung dạy người dùng sai. Và sort dùng nhiều hơn lọc; chôn sau hai cú bấm là phạt đúng hành vi phổ biến nhất |

**Cụm điều khiển — sửa lần 4, 27/07.** Ba bản trước đều vẽ một cái **thẻ**
rộng gần hết màn hình rồi nhét ba thứ nhỏ vào, nên giữa trống hoác; sửa màu và
vị trí không giải quyết được. Khảo sát **13 sản phẩm thật** (Viator · Klook ·
Airbnb · Booking · Intrepid · G Adventures · Expedia · Tripadvisor · Etsy ·
ASOS · Zalando · REI · TourRadar — chụp thật + đọc computed style) cho hai kết
luận đảo ngược cách tiếp cận:

1. **Gốc rễ không phải ít phần tử, mà là CÁI KHUNG vẽ quanh chúng.** ASOS đặt
   đúng 3 thứ trên dải 1300px và không ai thấy sai — vì không có container.
   Chỉ 3/13 sản phẩm vẽ thứ gì giống một cái thanh có nền, và cả ba đều là
   thanh **dính đã được lấp đầy** bằng chip danh mục.
2. **9/13 không dính gì cả.** Baymard **không có số liệu nào** về sticky
   toolbar trên desktop; luật sticky của họ chỉ áp cho **mobile**. Bốn site có
   dính đều phục vụ 600–800+ kết quả với danh sách vô tận — không phải ta.

Cách chữa: nâng số kết quả lên cỡ **tiêu đề khu vực** (`h2`) làm neo trái, điều
khiển bám mép phải cùng baseline, một đường kẻ khép khoảng hở và kiêm cạnh trên
của danh sách. Hàng đọc thành "tiêu đề + điều khiển đuôi" — hình dạng 6/13 sản
phẩm dùng (Booking · G Adventures · Intrepid · REI · Tripadvisor · Expedia).
Không khung, không nền, **không dính**.

| Thành phần | Chốt |
| --- | --- |
| Số kết quả | `h2` + `role="status"`. `16 tours` · đang lọc thì `6 of 16 tours` |
| Sort | `Select`, luôn hiện giá trị đang chọn. 13/13 sản phẩm có sort đều dùng dropdown; không ai dùng segmented |
| Filters | Nút **viền** + icon + huy hiệu số. Không nút đặc, không icon-only trên desktop, **không nút nổi** — không sản phẩm desktop nào dùng |
| Chip đang bật | Dòng thứ hai, chỉ render khi có lọc. Baymard: 72% site có phần này; "chỉ hiện số trên nút Filters" là lỗi khả dụng |
| Ngăn cách | Một đường `border-b` — khoảng trắng giữa hai cụm thành khoảng trắng **có biên** |

**Phân trang:** mặc định **10 tour/trang**, người dùng đổi được **10 / 20 / 50**
(đều ≤ trần `limit` 50 của contract). Thanh phân trang có neo ba chỗ:
`[10 ▾] per page` trái · số trang giữa · `Showing 1–10 of 16` phải — nên nó
không lặp lại lỗi "trống hoác". Đóng luôn khoản nợ rows-per-page mà Nexora có
và v2 thiếu (ghi ở đối chiếu §"Nhỏ" mục 15).

**Trang chính sau khi bỏ sidebar:**

```
┌──────────── hero TỐI full-bleed, lấy lại trọng lượng ─────────────┐
│ Home › Tours                                                      │
│ 16 tours across 9 destinations                                    │
│ H1 · subtitle · [🔍 search]                                       │
└───────────────────────────────────────────────────────────────────┘
┌── thanh kết quả, DÍNH ở top-32 ───────────────────────────────────┐
│ 16 tours  ⓧ Trekking  ⓧ Sa Pa  Clear all                         │
│                            Sort by [Newest ▾]  [⚙ Filters ②]      │
└───────────────────────────────────────────────────────────────────┘
  card hàng ngang, MỘT cột rộng, xếp dọc
  ‹ 1 2 ›
```

Trái thanh = **trạng thái** (số kết quả + chip đang bật), phải = **điều khiển**
(sort + mở bộ lọc). Chip thay vai trò sidebar: khi drawer đóng, đó là chỗ DUY
NHẤT nói cho người dùng biết họ đang lọc gì. Không có filter thì không render
hàng chip rỗng.

### 5.2 Card tour — `TourListCard`

Card **hàng ngang** theo Nexora `tour-list-card.tsx`: ảnh trái · thân giữa ·
rail giá phải, xếp dọc trên mobile.

| Vùng | Nguồn | Giới hạn dòng |
| --- | --- | --- |
| Ảnh (`sm:w-60 lg:w-72`) | `ImagePlaceholder`, nhãn = tên destination chính | — |
| Huy hiệu góc ảnh | `−N%` từ `compareAtPrice`; không có thì `Featured` khi `isFeatured` | 1 dòng |
| Meta | `destination chính` · `durationDays` · `maxGroupSize`, mono in hoa | **1 dòng**, `truncate` |
| Tiêu đề | `title` | **2 dòng**, giữ chỗ 2 dòng |
| Tóm tắt | `summary` (null → chuỗi rỗng, VẪN giữ chỗ) | **2 dòng**, giữ chỗ 2 dòng |
| Chuỗi chặng | `routeChain(destinations)`, mono, primary đậm | **1 dòng**, `truncate` |
| Rating | `ratingAvg` + `ratingCount`; `null` → nhãn `Not yet reviewed`, tuyệt đối không `0.0` | 1 dòng |
| Chip | `category.name` + `difficulty` | **1 dòng, tối đa 2 chip** |
| Rail giá (`sm:w-40`) | `compareAtPrice` gạch + `basePrice` + `per person` + ♡ + `View tour` | 1 dòng mỗi phần tử |

**Hợp đồng số dòng là bắt buộc, không phải trang trí.** `line-clamp` một mình
KHÔNG đủ: nó cắt phần thừa nhưng không giữ chỗ, nên tiêu đề 1 dòng và tiêu đề
2 dòng vẫn cho hai chiều cao card khác nhau. Mỗi ô vừa `line-clamp-N` vừa
`min-h-[Nlh]`. Nhờ đó tour không có `summary` vẫn cao đúng bằng tour có.

Giới hạn **2 chip** là bắt buộc, không phải thẩm mỹ: ba chip từng làm chip cuối
bị `overflow-hidden` xén ngang chữ trên tour có tên chuyên mục dài — CSS không
có cách "chỉ hiện item nào vừa đủ", nên phải chặn ở nguồn.

**Chuỗi chặng là điểm chống "mùi template" chính của card.** Template viết
`7 days • Small group • Vietnam`; chuỗi chặng là dữ liệu thật từ `destinations[]`
và là thứ duy nhất phân biệt card tour với card khách sạn.

Card dọc `tour-card.tsx` giữ lại cho "You might also like" ở trang detail —
Nexora cũng giữ cả hai biến thể.

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

Năm khoản đã xác định. Không cái nào chặn cụm tĩnh; tất cả chặn cụm gắn API.

> **Sửa cách gọi tên (28/07):** mục này ban đầu gọi cả năm là "lỗ contract", hàm
> ý cả năm đều là chỗ bị bỏ sót. Không đúng cho **#1**: nó là một quyết định đã
> ghi trong ADR đã Accepted, hoãn có chủ đích. #2–#5 mới là lỗ thật. Phân biệt
> này đổi việc phải làm: #1 **không cần ADR mới**, #2–#5 thì cần.

1. **Media tour — HOÃN CÓ CHỦ ĐÍCH, không phải bỏ sót.** `TourCardSchema` lẫn
   `TourDetailSchema` đều chưa có field ảnh; Prisma `MediaAsset` có
   `ownerType: TOUR` nhưng chưa code nào query cho tour. Nhưng
   [ADR-0005](../adr/0005-media-read-build-url.md) đã **chốt sẵn hình dạng và
   đặt tên phase kế thừa**: bối cảnh của nó nói thẳng là chốt hợp đồng "trước khi
   các module media sau (**tour media**, admin CRUD ở P4) kế thừa", và phần Hệ quả
   ghi "Khi catalog thêm media (**P3b/P4**) thì related tự có". Nên đây là khoản
   *đã thiết kế, chưa thực thi*.

   **Chi phí thật nhỏ hơn nhiều so với cách viết cũ hàm ý** — hạ tầng đã generic
   sẵn, không phải dựng mới:
   - `MediaService.resolveForOwners(ownerType, ownerIds)` nhận **bất kỳ**
     `MediaOwnerType`, và `TOUR` là giá trị **đầu tiên** của enum đó.
   - `MediaItemSchema` đã tồn tại; `PostDetailSchema` đã dùng đúng cặp
     `cover: MediaItemSchema.nullable()` + `media: z.array(MediaItemSchema)` —
     tiền lệ nằm ngay trong contract này.
   - `buildCloudinaryUrl` có escape-hatch "publicId đã là URL tuyệt đối thì trả
     nguyên", tức seed/placeholder chạy được ngay mà không cần tài khoản
     Cloudinary thật.

   Việc còn lại đúng bằng: thêm field vào schema + inject `MediaService` vào
   `CatalogService` và gọi `resolveForOwners('TOUR', ids)`, đúng như
   `PostsService` đang làm.

   **Nhưng mức độ ĐÃ TĂNG sau đợt 28/07**, vì [gallery ảnh đã được
   dựng](../changelog/2026-07-p3b-static.md): khảm + lightbox + `MockMediaItem` gương đúng
   `MediaItemSchema`. Lúc gắn API mà `tour.media` không tồn tại thì `TourGallery`
   trả `null` và cả khu ảnh **biến mất khỏi trang**. So với #4: #4 gãy **im
   lặng** (trả kết quả thiếu, không dấu hiệu), #1 gãy **ồn ào** (mất hẳn một khu
   nhìn thấy được) — dễ phát hiện hơn, nhưng vẫn là mất một khối UI đã thiết kế.
   Thêm nữa `TourCardSchema` được `PostDetailSchema` tái dùng làm `relatedTours`,
   nên thêm ảnh vào **card** vá luôn khoản "related tours không ảnh" mà ADR-0005
   đã ghi là điểm tạm khác Nexora — một sửa, hai chỗ được.
2. **Không có `nextDepartureDate` / `nextDepartureSeatsLeft` trên card** →
   listing mất đòn bẩy urgency mà Nexora có.
3. **Không sort được theo rating/popularity** dù cột đã denormalize sẵn.
4. **Không filter được theo price / duration / difficulty** (Nexora có 2/3).
   **Nâng mức độ sau review 27/07:** ba facet này đã được DỰNG và đang chạy
   bằng lọc client trên mock. Chúng sẽ **gãy im lặng** khi chuyển sang phân
   trang server nếu contract chưa mở rộng — server trả 12 tour của trang hiện
   tại, client lọc tiếp trong 12 tour đó, và người dùng thấy kết quả thiếu mà
   không có dấu hiệu gì. Đây giờ là **điều kiện chặn** của cụm gắn API, không
   còn là "nên có": hoặc mở rộng `ToursListQuerySchema`
   (`minDays`/`maxDays`/`minPrice`/`maxPrice`/`difficulty`), hoặc gỡ ba facet.
5. **`suitableFor` và `badges` chưa có trên card**.

Đề xuất, tách theo đúng phân biệt ở trên — **không gộp cả năm vào một ADR**:

- **#1 media: không cần ADR mới.** ADR-0005 đã quyết định hình dạng (`MediaItem`,
  API dựng URL lúc đọc, resolve theo batch) và đã hẹn phase. Chỉ cần **một khối
  "cập nhật cùng ngày" vào ADR-0005** ghi rõ đã thực thi cho `TOUR`, quyết định
  card mang `cover` hay không, rồi làm. Viết ADR mới ở đây là ra quyết định lần
  hai cho cùng một việc.
- **#2–#5: cần một ADR thật**, vì chúng mở rộng bề mặt query/response chưa ai
  quyết định: `ToursListQuerySchema`
  (`minDays`/`maxDays`/`minPrice`/`maxPrice`/`difficulty` + `sort`) và
  `TourCardSchema` (`nextDeparture*`, `suitableFor`, `badges`).

Thứ tự nên làm: **#4 trước** (nó là khoản duy nhất gãy *im lặng*), rồi #1, rồi
phần còn lại. Không làm cái nào ở đây — cụm này là cụm tĩnh.

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
