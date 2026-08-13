# Spec — Trùng tu trang Tour Details theo mẫu ReUI `product-detail-1`

- **Ngày:** 2026-08-13
- **ADR liên quan:** [ADR-0022](../adr/0022-tour-detail-tabs.md) (hình dạng
  điều hướng), ADR-0019 (vai token màu), ADR-0020/0021 (media), ADR-0013 (hệ
  màu + font).
- **Wireframe đã duyệt:** phiên brainstorm 13/08, dựng bằng dữ liệu thật của
  tour `ha-giang-loop-4d3n` từ fixtures. Điểm neo cho reviewer: mọi số đo,
  token và hành vi dưới đây đã **đo được** trên bản demo, không phải mô tả suông.

## 1. Phạm vi

Chỉ `apps/web/src/app/(site)/tours/[slug]/page.tsx` và các component dưới
`components/tours/`. **Không** đụng listing `/tours`, không đụng khu account,
không đổi API trừ một mở rộng contract nêu ở §6.

Giữ nguyên: hero, dải khởi hành, `DepartureSelectionProvider`, `BookingRail`
(bar dính mobile), `Lightbox` dùng chung.

## 2. Bố cục trang

Bốn tầng, theo đúng thứ tự DOM:

1. **Hero** (`TourHero`) — giữ nguyên, kể cả `.dark contents` trên `bg-hero`.
2. **Khối gallery + panel đặt chỗ** — mới, thay khảm ảnh cũ.
3. **Năm tab** — mới, thay lưới `rail · main · booking`.
4. **You may also like** — `RelatedTours` + `TourCard` hiện có, lưới 3 cột.

### 2.1 Số đo bám bản gốc ReUI (đã đo bằng `getComputedStyle`)

| Thành phần | Giá trị |
| --- | --- |
| Container | `max-w-6xl` = 1152px, padding 40/24 → nội dung 1104px |
| Lưới trên | `minmax(0,1fr) 443px`, gap 40 → **621 \| 40 \| 443** |
| Ảnh chính | vuông **541×541**, radius 10, nền `--muted` |
| Thumb | 64×64, gap 8, **tối đa 7 ô** |
| Nút CTA | cao 36, radius `--radius-sm`, chữ 14/20 w500 |
| Tab list | cao 40, gap 24, viền đáy 1px; mỗi tab `flex:1` |
| Thân tab | `margin-top:24`, `max-width:768` cho panel dạng văn bản |
| Thẻ related | lưới 3 cột, gap 32/24, **không khung** |

> **Cột phải ghim 443px, KHÔNG dùng `1.4fr/1fr` như bản gốc.** Tỉ lệ đó chia
> 1104 ra 620.656 | 443.328; ảnh `aspect-ratio:1/1` thành cao 540.656 và **cả
> trang bên dưới thừa hưởng phần lẻ .656** — mọi đường kẻ 1px rơi lệch pixel,
> bị khử răng cưa thành dày-mỏng xen kẽ (đo được `tabs` bắt đầu ở 911.656).
> Ghim 443px cho ra đúng 621|40|443 và mọi thứ về số nguyên. Bản ReUI gốc cũng
> mắc lỗi này, chỉ tàng hình trên màn Retina.

### 2.2 Luật typography chống lệch pixel

Mọi dòng chữ trong các panel **phải khai `line-height` tường minh và CHẴN**.
Thiếu nó, chiều cao dòng do font quyết (Literata/Archivo) ra số lẻ → chiều cao
khối lẻ → đường kẻ 1px lệch pixel. Đặc biệt **không dùng `line-height: 22.75px`**
(`leading-relaxed` của ReUI = 1.625 × 14); dùng 23px.

## 3. Gallery + panel đặt chỗ

### 3.1 Gallery

- Dải dọc **7 thumb** 64×64 gap 8 → 7×64 + 6×8 = **496 ≤ 541**. Ô thứ 8 thành
  568 > 541, dài hơn ảnh và vỡ hàng — 7 là trần hình học, không phải số chọn đại.
- Còn ảnh chưa hiện → ô thứ 7 mang lớp phủ **"+N"**; bấm vào mở `Lightbox` tại
  đúng ảnh bị ẩn, không nhảy sang trang riêng.
- Ảnh chính bấm được, góc dưới-phải có nhãn "N photos".
- Dùng `components/media/lightbox.tsx` **y nguyên, không sửa một dòng**: bộ đếm
  mono, nút đóng, prev · caption · next, Esc + mũi tên, **không cuộn vòng**.
  Không thêm thu/phóng — bản hiện tại không có và user đã chốt bỏ.
- Nguồn ảnh: đổi `media={[]}` (đang hardcode ở dòng 231) thành `tour.media`.

### 3.2 Panel đặt chỗ (cột 443px)

Thứ tự khối: eyebrow `category.name` (MỘT segment — `TourCardSchema.category`
không có cấp con) → H1 → rating → summary `line-clamp-2` → giá → hairline →
`Select Departure` → CTA → ba thẻ policy.

- **Giá và badge cùng một hàng**: hàng ngoài canh `center`, hai con số canh
  `baseline` bên trong. Canh baseline cho cả badge sẽ làm badge tụt vài pixel.
- **4 ô ngày** (không phải 7): 4 đợt **còn chỗ** gần nhất, mỗi ô hiện ngày +
  số ghế còn, ô ≤3 ghế tô `--warning`. Đợt đang chọn mà nằm ngoài 4 ô thì
  **chen vào thay ô cuối** — nếu không, panel hiện một đằng còn nút Reserve
  nói một nẻo. Link "All N dates" mở modal §5.
- Viền ô ngày dùng **`--input`**, không phải `--border`: `tokens.mjs` ghi rõ
  hai token khác luật — `border` là đường phân cách trang trí, `input` là ranh
  giới điều khiển và được cân để đạt 3:1 (WCAG 1.4.11).
- **Ba thẻ dưới CTA sinh từ `policies[]`**, không hardcode. Icon map theo
  `policy.kind` — enum ĐÓNG (`CANCELLATION`/`BOOKING`/`GENERAL`) nên an toàn;
  nhãn lấy `policy.title`. Lưới `auto-fit` để tour có 1–2 policy vẫn cân hàng.
  Bấm vào nhảy sang tab Good to know.

## 4. Năm tab

Hai ràng buộc bắt buộc, chi tiết ở [ADR-0022](../adr/0022-tour-detail-tabs.md):

1. **Render đủ năm panel, ẩn bằng CSS** — không mount có điều kiện. Trang là
   SSG và nằm trong sitemap; kiểu "chỉ mount tab đang mở" khiến lịch trình biến
   mất khỏi HTML mà crawler nhận được.
2. **Tab đồng bộ với hash trên URL**, và `OnThisPage` **rời khỏi trang này** —
   tab bar thay vai mục lục, giữ cả hai là hai bộ điều hướng cho cùng một tập
   nội dung. Anchor cũ (`#itinerary`, `#departures`…) phải mở đúng tab tương ứng.
   Component `OnThisPage` vẫn dùng ở `/blog`, không xoá.

### 4.1 Overview

Dải **4 card dữ kiện** trải đều một hàng, theo mẫu card trong `playground.md`
(header có icon + nhãn, gạch ngăn, thân có mô tả và link nhỏ màu primary):
Duration · Group size · Difficulty · Good for. Hai card có link đi thật
(Duration → tab Itinerary, Difficulty → Good to know).

`difficulty` là enum `CHALLENGING` và `suitableFor` là mảng enum — ra giao diện
**phải map qua `@tourism/i18n`**, không in thẳng giá trị enum (luật 7).

Dưới đó: hai đoạn mô tả + danh sách `highlights` có tick.

### 4.2 Itinerary

Dùng `Timeline` của ReUI (`components/reui/timeline.tsx`, đã có trong repo).

- **Ngày của Day N = ngày khởi hành + (N−1)**, lấy từ đợt đang chọn. Đổi đợt ở
  chip hay modal thì lịch trình đổi ngày theo.
- **Hai chế độ:**
  - *Xem trước* (mặc định, mọi khách): node hiện **số ngày**, badge hiện ngày
    thật, không tick / không spinner / không làm mờ.
  - *Live*: chỉ khi session có booking **`PAID`** ở đúng đợt này. Ngày đã qua
    → tick + badge "Done"; ngày hôm nay → spinner + badge "Today", tự xổ nội
    dung; ngày chưa tới → node rỗng + mờ.
- Hàng gập: icon + `Day N · X stops · HH:MM–HH:MM`, chevron xoay. Panel xổ ra
  chứa các mốc giờ.
- **Nội dung mốc giờ render bằng markdown** (`react-markdown` + `remark-gfm`,
  đã là dependency và đang chạy ở blog qua `ArticleMarkdown`): **đậm** cho địa
  danh, *nghiêng* cho ghi chú mềm. Markdown thoái hoá êm nên **không cần
  migration** — mô tả cũ render y như chữ thường.
- Chữ mốc giờ dùng `--foreground`, KHÔNG dùng `--muted-foreground`: đây là nội
  dung chính của lịch trình, không phải chú thích.
- **Không có pill "Lunch included"/"Homestay"** — xem §7.
- Cuối tab: `included` / `excluded` hai cột.

### 4.3 Departures

**Không lặp lại danh sách ngày** (đó là việc của modal). Nội dung là tổng quan,
mọi con số **dẫn xuất từ chính mảng `departures`**:

- Bốn ô thống kê: đợt kế tiếp · số đợt còn mở / tổng · khoảng giá · tổng ghế còn.
- **Lịch theo tháng**: mỗi khối là một đợt (đặc = còn chỗ, `--warning` = ≤3 ghế,
  rỗng = hết), kèm tổng ghế và khoảng giá tháng đó; tự gắn nhãn *low season* /
  *peak* khi lệch giá gốc.
- Ba thẻ điều khoản liên quan tới ngày (deposit · huỷ · sức chứa).
- Nút "See all dates →" mở **cùng modal** với link ở panel — một cửa vào duy nhất.

### 4.4 Reviews

- Trái: điểm trung bình + sao + "Based on N verified riders" + nút **Show all
  reviews**. Dòng nhỏ: *Only travellers who finished this trip can leave a review.*
- Phải: **biểu đồ 5 mức sao**, bề rộng = `count / total` (tỉ lệ trên TỔNG, không
  chuẩn hoá theo cột cao nhất — chuẩn hoá kiểu đó thì 5★ luôn đầy khung ở mọi
  tour và mất thông tin). Track dùng **`--border`** chứ không `--muted`: muted
  chỉ hơn nền 1.26:1 nên hai mép 6px bị khử răng cưa ăn mòn, mắt đọc thanh rỗng
  thành sợi mảnh trong khi thanh đã tô đọc đủ 6px.
- Dưới: 2 review đầu làm mồi, phần còn lại đi qua modal §5.
- **Không có nút "Write a review"** — xem ADR-0022 mục Hệ quả.

### 4.5 Good to know

- `policies[]` thành các thẻ ngang (nhãn `kind` + `title` + `body`).
- `faqs[]` dạng accordion theo mẫu `playground.md`: **mỗi mục một thẻ riêng** có
  viền + nền `card`, cách nhau 12px, icon trong ô 32px bo góc, chevron xoay,
  phần trả lời thụt vào ngang mép chữ câu hỏi.
- **Một icon dùng chung cho mọi FAQ.** Không có trường icon trong
  `TourFaqSchema`; gán icon theo từ khoá là thứ sẽ sai ở tour thứ 40.

## 5. Hai modal

### 5.1 "All dates"

Dialog (`@tourism/ui/components/dialog`), rộng ~640px:

- Nhóm theo tháng, nhãn tháng dính khi cuộn.
- Mỗi hàng: khoảng ngày đi → về · chấm màu + số ghế · thời lượng · giá riêng
  của đợt (kèm giá gạch nếu có) · nút Select. Đợt hết chỗ mờ và không bấm được.
- Ô lọc "Only show dates with seats left".
- Chọn xong **đóng modal ngay**; chân modal hiện đợt đang chọn.

### 5.2 "Show all reviews"

Dialog rộng ~720px:

- **Sort** dạng `DropdownMenu` (đã có trong repo) theo mẫu `playground.md`:
  nút outline có chevron đẩy sát phải, menu có nhãn nhóm + item kèm icon +
  dấu tick ở mục đang chọn. Bốn lựa chọn: Newest · Oldest · Highest · Lowest.
- **Lọc theo sao** bằng `Rating` (`components/reui/rating.tsx`, **đã thêm vào
  repo** ở branch `feat/reui-rating`): bấm sao thứ N lọc đúng N sao, bấm lại
  chính sao đó thì bỏ lọc; nhãn bên cạnh nói rõ trạng thái.
- Toggle "With photos".
- Phân trang; hàng chân hiện "Showing a–b of N matching".
- Review của tài khoản đã xoá hiện "Deleted account" và **nằm cuối** — đúng
  `orderBy [authorDeleted asc, createdAt desc, id desc]` của service.

## 6. Mở rộng contract (một thay đổi duy nhất)

```ts
// libs/shared/contract/src/schemas/reviews.ts
export const ReviewSortSchema = z.enum(['newest', 'oldest', 'highest', 'lowest']);

export const ReviewsByTourQuerySchema = PageQuerySchema.extend({
  tourSlug: z.string().min(1).max(120),
  sort: ReviewSortSchema.default('newest'),
  rating: RatingSchema.optional(),      // lọc đúng MỘT mức sao
  withPhotos: z.boolean().optional(),
});

export const ReviewBreakdownSchema = z.object({
  1: z.int().nonnegative(), 2: z.int().nonnegative(), 3: z.int().nonnegative(),
  4: z.int().nonnegative(), 5: z.int().nonnegative(),
});
// contract.ts — reviews.byTour
.output(PagedSchema(PublicReviewSchema).extend({ breakdown: ReviewBreakdownSchema }))
```

Hai luật phía service **bắt buộc giữ**:

1. Khoá sắp xếp CHÍNH luôn là `authorDeleted asc` cho **mọi** kiểu sort — giữ
   nguyên luật sản phẩm hiện có.
2. Khoá CUỐI luôn là `id desc` để phân trang ổn định khi trùng ngày/trùng sao.

`breakdown` tính bằng `groupBy(['rating'])` trên cùng `where` nhưng **trước khi
lọc theo sao** — tính sau khi lọc thì chọn 5★ xong các mức khác về 0 và không
bấm lại được.

## 7. Ngoài scope, có lý do

| Món | Vì sao |
| --- | --- |
| Pill `Lunch included` / `Homestay` | `TourItineraryDaySchema` không có trường bữa ăn/chỗ ngủ. Thêm `meals`/`accommodation` kéo theo **73 row lịch trình trên 30 tour** phải soạn lại bằng tay, mỗi row là một phán đoán nội dung thật. Hợp lý nhất là làm cùng màn admin ở P4. Bù lại: người soạn **tô đậm chữ bữa ăn trong markdown** — nổi bật khi quét mắt mà không đoán từ khoá. |
| Thu/phóng trong lightbox | Bản dùng chung hiện không có; thêm vào sẽ nâng cấp luôn gallery trang vùng — ngoài phạm vi "trang Tour Details". |
| `freeCancellationDays` | Muốn thẻ nói "Free until 10 days out" bằng con số thật thay vì đọc-hiểu `policy.body`. Đổi contract + migration. |
| Ảnh thật | `MediaAsset` **rỗng hoàn toàn** trên DB dev — phải chạy `seed-media` mới thấy gallery. Đây là việc chặn khi nghiệm thu, không phải khi code. |

## 8. Kiểm chứng khi làm xong

- `pnpm gate:int` xanh. **Web build cần API sống ở :3001** để prerender trang
  tour SSG — không có nó thì `ECONNREFUSED` và build đỏ.
- Đo lại bằng trình duyệt thật: lưới trên ra đúng **621 | 40 | 443**, ảnh chính
  **541×541**, **0 hàng lệch nửa pixel** ở cả bốn tab.
- Tương phản ở **cả hai** chế độ sáng/tối: viền ô ngày và badge ≥ 3:1, chữ ≥ 4.5:1.
- Slug lạ vẫn trả **404 thật**, không phải soft-404 — luật `loading.tsx` ở đầu
  `page.tsx` vẫn phải giữ nguyên.
