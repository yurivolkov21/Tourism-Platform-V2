# Spec — cụm trang Destinations (P3b): `/destinations` + `/destinations/[region]`

- **Trạng thái:** user duyệt design 28/07/2026, chờ plan
- **Phase:** P3b web, đợt 1 của loạt "trả nợ trang tĩnh còn thiếu"
- **Tiền đề:** [báo cáo tiến độ 28/07](../CHANGELOG.md) — v2 thiếu 11 trang khách so
  với Nexora; cụm này trả 2 trang đầu

## 1. Mục tiêu

Dựng **cổng khám phá theo VÙNG**: `/destinations` là bản đồ 3 vùng,
`/destinations/[region]` là trang bán vùng đó. Đây là trang duy nhất còn thiếu
thuộc luồng *khám phá* — hiện `/#gallery` đang gánh tạm.

### Trong phạm vi

- `/destinations` — **landing page 4 khu** (hero · 3 thẻ vùng có tint · Featured
  trips · CTA), xem §5.1.
- `/destinations/[region]` — 3 slug tĩnh.
- Đắp lại `MockDestination` cho **gương đúng `DestinationSchema`**.
- `lib/regions.ts` thuần + TDD: chuẩn hoá vùng, xếp nhóm, ba phép dẫn xuất.
- **Dropdown navbar 2 tầng** + **vá đường duyệt theo vùng trên mobile** (§6.1).
- Nối lại các link đang trỏ tạm (footer, `/#gallery`) + `sitemap.ts`.

### Ngoài phạm vi — nói rõ để không hiểu nhầm

- **Không gắn API.** Toàn bộ chạy trên mock (luật user 28/07).
- **Không đụng** `libs/shared/contract`, `apps/api`, `apps/api/prisma/`.
- **Không ảnh thật.** Giữ policy `ImagePlaceholder` toàn site.
- **Không** siết `region` thành enum trong contract (xem §7).
- **Không** trang cho từng địa điểm (`/destinations/[region]/[place]`) — Nexora
  cũng không có; `/tours?destinations=<slug>` đã là đích của một địa điểm.
- **Không** lọc/sắp xếp trong trang vùng.

## 2. Năm quyết định user đã chốt (28/07)

| # | Quyết định | Loại bỏ |
| --- | --- | --- |
| 1 | Cụm là **cổng khám phá theo vùng** | chỉ-mục địa điểm tra cứu · nội dung biên tập theo vùng |
| 2 | **Tint vùng + chữ + dữ liệu** gánh sức nặng thị giác; ảnh là gia vị | mock media ảnh-dẫn · tải ảnh thật vào `public/` |
| 3 | Index **lồng tên địa điểm trong thẻ vùng** | 3 thẻ full-bleed editorial · 3 thẻ + lưới 9 địa điểm riêng |
| 4 | URL là **`/destinations/northern-vietnam`** | `/destinations/north` · `/destinations/vietnam-north` |
| 5 | Chữ ký trang vùng = **tint chiếm trang + dải số liệu dẫn xuất** | chỉ tint · dùng lại RouteRibbon ở cấp vùng |

Lý do loại RouteRibbon (quyết định 5) đáng ghi lại: thứ tự ba địa điểm trong một
vùng là **tuỳ ý**, không phải hành trình theo thời gian — đúng cái bẫy mà
`RouteRibbon` đã cố tránh khi từ chối gắn nhãn Start/End trên trang chi tiết tour.

## 3. Đối chiếu Nexora (luật 10)

Rà cả hai tầng: trang/feature và hạ tầng xuyên suốt.

| Khoản | Nexora | v2 dự kiến | Phân loại |
| --- | --- | --- | --- |
| `/destinations` | có (89 dòng, **8 khu**) | có, **4 khu** — bỏ 3 khu chạy bằng dữ liệu không tồn tại, đổi `PopularTours` → `Featured trips` | **làm khác mà tương đương** (§5.1) |
| Dropdown navbar | 4 dòng phẳng, `hint` **gõ tay** | 4 mục **+ giữ 9 link địa điểm**, hint **dẫn xuất** | **v2 tốt hơn** (§6.1) |
| Duyệt theo vùng trên mobile | có (trải phẳng 4 mục) | **hiện KHÔNG có** → phải vá | **thụt lùi cần vá** (§6.1) |
| `/destinations/[region]` | có (192 dòng, 8 component: RegionHero · RegionIntro · RegionHighlights · 3 bản Signature · RegionTours) | có, cấu trúc gọn hơn | **làm khác mà tương đương** |
| Nguồn vùng | **hardcode trong code** (`regionSlugs()`, `getRegion()`) — KHÔNG lấy từ API | hardcode trong `lib/regions.ts` | parity (xem ghi chú dưới) |
| Vùng không khớp | gộp vào `'Other'` rồi **lọc bỏ** | `regionOf()` trả `null` + **test bất biến** chặn | **v2 tốt hơn** |
| Ảnh vùng | ~10 ảnh Unsplash **hardcode** mỗi vùng, tự ghi *"Temporary imagery (review only)"*; `deriveRegionImagery` fallback all-real-or-fixture | không ảnh; tint + chữ + dữ liệu | **cố ý bỏ** (quyết định 2) |
| Tint theo vùng | không có | 3 lớp `--region-*` (ADR-0013) | **v2 tốt hơn** |
| Dải số liệu dẫn xuất | không có | có (§5.2) | **v2 tốt hơn** |
| `tourCount` | fixture | **dẫn xuất từ TOURS** | **v2 tốt hơn** (§4.2) |
| sitemap phủ vùng | có | có (§6) | parity |

**Ghi chú quan trọng về "hardcode 3 vùng":** ban đầu tôi xếp đây là nợ của v2
("region là chuỗi tự do thì trang vùng dựa vào đâu"). Đọc Nexora mới thấy họ cũng
**không** lấy vùng từ API — vùng là khái niệm của tầng trình bày ở cả hai bản. Nên
3 vùng nằm trong code là *parity*, không phải đi tắt. `DestinationSchema.region`
chỉ dùng để **xếp** địa điểm vào 3 vùng đã biết.

## 4. Tầng dữ liệu — phần lớn nhất của cụm

### 4.1 Đối chiếu mock hiện có → contract

`MockDestination` là **mock duy nhất còn lại chưa gương contract** — nó có từ trước
khi cụm Tours lập ra luật "mock đắp theo contract, không theo nhu cầu UI".

| `DestinationSchema` | `MockDestination` hiện tại | Việc phải làm |
| --- | --- | --- |
| `id: z.uuid()` | **thiếu** | thêm |
| `slug` | có | giữ |
| `name` | có | giữ |
| `country: string` | **thiếu** | thêm (`'Vietnam'`) |
| `region: string \| null` | `MockRegionKey` (**hẹp hơn contract**) | nới thành `string \| null` |
| `description: string \| null` | `blurb: string` (**tên khác, không nullable**) | đổi tên + nullable |
| `tourCount: int` | có, **viết tay và SAI** | dẫn xuất (§4.2) |

**`region` phải nới đúng thành `string | null`, không được giữ enum hẹp.** Đây là
điểm quan trọng nhất của §4: mock hẹp hơn contract nghĩa là mọi ca hỏng chỉ lộ ra
lúc gắn API. Cùng lý lẽ mà cụm Tours đã dùng khi bắt mock gương
`TourCardSchema`/`TourDetailSchema`.

Đổi `blurb` → `description` là **breaking change với HAI consumer**, phải sửa cùng
lượt: `components/home/gallery.tsx:96` (dùng làm `label` của `ImagePlaceholder`) và
`components/destinations-menu.tsx:81` (dòng phụ trong dropdown navbar — chỗ này còn
có comment nói chiều rộng menu 34→42rem được chọn theo *"blurb dài nhất"*, nên đổi
độ dài text ở đây là đổi cả cơ sở của con số đó).

### 4.2 Ba con số đều DẪN XUẤT, không viết tay

Khuyết tật đo được: mọi `tourCount` trong mock đang phồng **2–5×**.

| Địa điểm | mock khai | tour thật chạm tới |
| --- | --- | --- |
| ha-long | 9 | **2** |
| hoi-an | 10 | **4** |
| da-nang | 9 | **2** |
| sa-pa | 8 | **3** |
| ninh-binh | 7 | **3** |
| hue | 8 | **4** |
| sai-gon | 6 | **3** |
| can-tho | 6 | **2** |
| phu-quoc | 5 | **2** |
| **tổng khai** | **68** | 16 tour / **25 lượt chạm** |

`REGIONS.tourCount` (24/27/17) chỉ là tổng của các số phồng đó.

Vì sao phải sửa, không phải vì gọn code mà vì **trung thực**: thiết kế đã chốt in
những con số này ngay trên thẻ, nên thẻ nói "Hạ Long 9 tours" rồi bấm sang
`/tours?destinations=ha-long` ra **2**. Đúng lớp lỗi "See all 1,204 reviews" mở ra
14 dòng mà cụm reviews vừa sửa bằng cách dẫn xuất `ratingAvg`/`ratingCount`.
Contract ghi `tourCount` là *"Number of PUBLISHED tours touching this destination"*
nên API thật sẽ trả số đúng — mock nói dối làm thiết kế được duyệt trên những con
số **không thể xảy ra**.

Ba phép dẫn xuất:

1. `destination.tourCount` = số tour **distinct** chạm địa điểm đó.
2. Tour của một vùng = tour **distinct** chạm **bất kỳ** địa điểm của vùng.
3. Dải at-a-glance = tính từ chính tập tour ở (2).

**Một sự thật phải tôn trọng:** `north-to-south-classic` chạm **cả ba vùng**, nên
6 + 6 + 6 = 18 ≠ 16. Trang **KHÔNG được** in "18 tours" hay bất kỳ tổng cộng dồn
nào; mỗi vùng chỉ nói con số của chính nó. Có test canh bất biến này.

### 4.3 `lib/regions.ts` — logic thuần, TDD trước

Dữ liệu vùng ở lại `mocks/regions.ts` (`REGIONS` đã có **5 consumer**); `lib/regions.ts`
**chỉ chứa hàm**, và mọi hàm nhận dữ liệu qua tham số — đúng khuôn `lib/tours.ts`.

- `MockRegion`: `key` (`north`, trỏ lớp token `--region-*`) · `slug`
  (`northern-vietnam`, từ vựng URL) · `name` · `tagline`. **`tourCount` viết tay bị
  xoá.** Hai từ vựng `slug` và `key` cố tình **tách**: URL là chuyện SEO, tên lớp
  token là chuyện thiết kế — trộn lại mới là nợ.
- `regionOf(regions, destination): RegionKey | null` — chuẩn hoá `region` chuỗi tự
  do; bảng nhận dạng **suy từ chính `regions`**, không khai riêng.
- `regionBySlug(regions, slug)` · `destinationsInRegion(regions, destinations, key)`
  · `toursInRegion(regions, destinations, tours, key)` · `regionGlance(tours)`.

**Ca `null` không được âm thầm bỏ.** Địa điểm không map được sẽ vắng mặt khỏi mọi
trang vùng, mà index chỉ hiện 3 vùng → nó **tàng hình trên toàn site**. Chốt: có
**test bất biến** khẳng định cả 9 destination đều map. Ai thêm một cái lạ thì test
đỏ, thay vì một địa điểm biến mất im lặng.

## 5. Hai trang

### 5.1 `/destinations` — landing page toàn cảnh 3 vùng

**Sửa phạm vi 28/07 (sau khi user hỏi lại):** bản đầu của spec này quy trang index
về "3 thẻ vùng". Đối chiếu lại Nexora thì trang `/destinations` của họ có **8 khu**
(`DestinationsHero` · `RegionGroup` · `BestTime` · `PopularTours` ·
`Gallery` editorial · `Testimonials` · `TravelTips` · `EnquiryCta`) — tức một landing
page thật. User muốn đúng hình dạng đó, "làm như Nexora nhưng tốt hơn". Ba khu trong
số đó **không dựng được trung thực** vì chạy bằng dữ liệu v2 không có.

| Khu Nexora | v2 | Lý do |
| --- | --- | --- |
| Hero | ✅ giữ | khuôn hero tối + topo đã có |
| RegionGroup | ✅ giữ, **hơn** | thêm tint vùng · số tour dẫn xuất · địa điểm là link thật |
| `BestTime` | ❌ **bỏ** | không field nào trong contract nói mùa/thời tiết; Nexora hardcode. Cùng loại copy bịa mà §7 đang cắt |
| `PopularTours` | ⚠️ **đổi tên** → `Featured trips` | contract không có tín hiệu popularity (§8 #3), **nhưng có `isFeatured`** thật — mock có đúng **6** tour gắn cờ. Dùng field thật, gọi đúng tên |
| Gallery editorial | ❌ **bỏ** | không có media cho destination (§8 #1) |
| Testimonials | ❌ **bỏ** | trang chủ đã có nguyên khu này; lặp lại là độn cho dài |
| `TravelTips` | ❌ **bỏ** | copy biên tập bịa, cùng loại `BestTime` |
| `EnquiryCta` | ✅ giữ | `/contact` là trang có thật |

**Sửa lần hai 28/07 — user xem bản dựng và bác:** *"3 cards vô hồn"*, và
*"không cần trình sẵn các tours ở trang này, trang này chủ yếu giới thiệu về các
vùng"*. Ba chẩn đoán cụ thể (không phải chuyện gu):

1. Bản đó làm ba vùng **trông giống nhau** — cùng hộp, cùng bố cục, cùng trường,
   chỉ khác 4px viền và màu nút. Mà việc của trang đúng là làm ba vùng **khác nhau**.
2. Nó **bỏ phí 9 câu `description`** đang có sẵn trong mock ("Misty rice terraces",
   "Limestone bay cruises"…) — thẻ chỉ hiện tên + số.
3. Nó dùng **2/6 slot** màu vùng (`surface` cho chip, `primary` cho nút);
   `--region-hero` vừa tạo ở Task 1 còn chưa dùng tới. Lớp màu vùng là tài sản
   Nexora **không có** mà trang lại tiêu như đồ trang trí.

**NĂM khu chốt** (bản cuối, sau ba vòng user duyệt): hero tối + `TopoPattern` →
**3 `RegionGroup`** (header căn giữa + dải ảnh full-bleed, kiểu Nexora) →
**Moments from the journey** → **Loved by travellers** → **Know before you go**.

**Hai khu đã bỏ**, cả hai theo quyết định user 28/07:

- `Featured trips` — trang này giới thiệu vùng, không bán tour.
- **CTA hỏi** ("Not sure where to begin?") — chỉ là vài dòng chữ căn giữa, không
  đủ thành một khu; và nền `bg-muted/30` của nó tạo hai dải màu sát nhau ngay
  trên footer, đọc rời rạc. Copy giữ nguyên ở `messages.enquiryCta` cho
  component `EnquiryCta` dùng chung khi nào dựng thật (nợ từ cụm pháp lý) —
  khối đó có sẵn biến thể tiêu đề cho home/faq/about/blog và `regionHeading`
  cho trang vùng, nên **hiện chưa consumer nào**.

⚠️ **Chữ ký đường kinh tuyến mô tả ở dưới đã BỊ THAY** ở vòng ba: user chỉ vào
bản Nexora và chốt dải ảnh full-bleed. Dải chạy sát mép nên không còn chỗ cho
đường kẻ dọc bên trái — giữ cả hai là nhồi hai chữ ký vào một khu. Phần dưới
giữ lại làm bản ghi lịch sử.

**Chữ ký: đường kinh tuyến.** Một đường dọc chạy suốt ba vùng, mỗi vùng là một
trạm. Thứ tự Bắc → Nam ở đây là **thông tin thật** (địa lý, và mock đã xếp đúng
trục đó) — khác hẳn ca đã từ chối ở quyết định 5, nơi thứ tự 3 địa điểm *trong*
một vùng là tuỳ ý. Nó cũng nói lại đúng ngôn ngữ hình mà `RouteRibbon` đã lập ở
trang tour, nhưng ở quy mô quốc gia.

**Nền mỗi vùng là PHỚT màu, không tô đặc:** `color-mix` sắc vùng với nền trang.
Bắt buộc pha vì `--region-surface` của Nam sáng 0.661 còn Bắc 0.855 — tô đặc thì
ba băng sáng khác nhau thấy rõ, đúng lỗi đã sửa cho hero ở §5.2.

**Ba khu mới, mỗi khu một nguồn dữ liệu THẬT:**

| Khu | Nguồn | Số lượng | Ghi chú |
| --- | --- | --- | --- |
| Moments from the journey | `MOMENTS` (`mocks/moments.ts`) | **5** | `title` + `credit` theo tour thật. Đây là phần *cảm xúc* mà bản cũ thiếu hẳn |
| Loved by travellers | `TESTIMONIALS` | lấy **3** / 8 | Trang chủ đã có marquee 8 cái → ở đây làm **trích dẫn lớn**, khác hình thức nên không thành bản sao |
| Know before you go | `FAQ_ITEMS` | **5** | Nội dung **thật, đã duyệt, đang chạy ở `/contact`**; kèm link `/faq` |

**Đảo lại phán quyết trước, ghi rõ để không lẫn:** bảng ở đầu §5.1 từng loại
`Gallery`/`Testimonials`/`TravelTips` với lý do "ảnh chưa có · trùng trang chủ ·
copy bịa". Hai trong ba lý do đó **sai**: toàn site vốn dùng `ImagePlaceholder`
nên khu ảnh dựng được, và "Know before you go" dựng bằng **FAQ có sẵn** thì không
bịa gì — đó mới là bản *tốt hơn* Nexora, vì họ hardcode travel tips còn ta dùng
nội dung mình thật sự duy trì. Lý do còn lại (trùng trang chủ) là chuyện gu, và
user đã quyết.

**Ba thứ cố tình KHÔNG làm** để chữ ký chỉ có một: không đánh số `01/02/03` (ba
vùng không phải các bước tuần tự) · không lật ảnh trái-phải xen kẽ (mặc định) ·
không cho mỗi vùng một băng tối chiếm trọn màn hình (đúng bẫy "khối to nói được
ít" đã khai tử `TourImageBand` 617px).

---

*Bản bốn khu dưới đây giữ lại làm bản ghi lịch sử của vòng trước:* hero tối +
`TopoPattern` → **3 thẻ vùng** → **Featured trips** → **CTA hỏi**.

Mỗi thẻ vùng: tên · tagline · số tour **dẫn xuất** · danh sách địa điểm kèm số tour
(mỗi tên là link `/tours?destinations=<slug>` — trang **có thật**) · CTA vào trang
vùng. Tint riêng từng thẻ qua `--region-*` (thứ Nexora **không** có).

`Featured trips`: lọc `TOURS` theo `isFeatured === true`, render bằng `TourCard` đã
duyệt. **Không** gọi là "popular"/"most loved"/"traveller favourites" — không có dữ
liệu nào đỡ những chữ đó, đúng lý lẽ đã loại badge `Verified` ở cụm reviews.

Không trùng `/#gallery`: ở đó địa điểm là thẻ cuộn ngang; ở đây là toàn cảnh theo
vùng có màu riêng, cộng lối đi tiếp vào từng vùng.

### 5.2 `/destinations/[region]`

**Sửa lần hai 29/07 — user xem bản dựng và BÁC, chốt dựng theo trang Nexora thật.**
Bản "Sửa 29/07" bên dưới (rail trong hero · PLACES dạng hàng · CTA vùng) đã dựng xong
và bị bác: *"thiết kế không đâu vào đâu"*. User chỉ vào
`nexora-travel.agency/destinations/northern-vietnam` và cho phép **dựng giống hệt
Nexora theo từng vùng**, chỉ **bỏ khu `Plan your trip`** trước footer.

Đối chiếu trang live: **8 khu, giữ 7**. Thứ tự: hero ảnh → `The best X tours` (intro +
intro2 + tags + bento 3 ô + CTA) → **Signature** ↔ `What makes X special` → `Tours`
(tab lọc địa điểm + lưới phân trang 8) → `X in photos` (10 ô) → `We've got you covered`.
Bắc để Signature **trước** Highlights (nhánh `isAdventure` của Nexora).

**"Xương chung — da riêng":** ba vùng chung bộ khung, riêng khu Signature khác hẳn
cấu trúc — Bắc dải số liệu trên băng tối · Trung timeline 3 chặng · Nam 3 bưu thiếp
so le. Cộng chiều cao hero và độ đậm scrim riêng. Đây là thứ làm trang Nexora đứng
được và là thứ bản trước thiếu (chỉ đổi tint nên ba trang đọc ra na ná).

**Ba chỗ CỐ Ý lệch Nexora, đều đã đo:**

| Khoản | Nexora | v2 | Vì sao |
| --- | --- | --- | --- |
| Địa danh trong copy | `Hà Giang` (350km · Mã Pí Lèng) · `Fansipan` 3.143m · `Lan Hạ` · `Pù Luông` · `Củ Chi` · `Marble Mountains` · tag `Caves` | thay bằng nơi CÓ THẬT trong mock: Ninh Bình · Mường Hoa · Ô Quy Hồ · Bắc Hà · Hải Vân · Bà Nà · Cần Thơ | 7 địa danh kia **0 lần** trong mock; §10 để đúng khoản này làm tiêu chí hoàn thành |
| `tags` + dải số liệu | hardcode | **dẫn xuất** từ `regionGlance()` và `toursInRegion()` | thêm/bớt tour thì chữ của Nexora sai âm thầm |
| `valueProps` | "Luxury transfers" · "vetted private drivers" · "Epic meals" | Small groups (12) · Local guides · Clear inclusions | không field nào đỡ ba lời hứa kia, trên capstone **không doanh thu** |

**Ảnh:** user chốt 29/07 dùng **ô gradient theo vùng** (`RegionTile`) — chính cơ chế
dự phòng Nexora đã thiết kế (`marketing/gallery.tsx` → `Tile` khi thiếu `src`: gradient
+ icon), khác ở chỗ pha bằng `--region-primary` → `--region-spark`. Lý do không dùng
`ImagePlaceholder` xám của repo: trang có **14 ô ảnh**, riêng khu `X in photos` là 10
ô liền nhau — mười hộp xám sọc chéo đọc thành "vùng ảnh hỏng", đúng lỗi đã đo ở
`destination-tile.tsx`. Có ảnh thật thì thêm `src`, không phải đụng bố cục.

**Hai khu của bản trước bị XOÁ:** dải at-a-glance và PLACES dạng hàng — Nexora không
có chúng; địa điểm xuất hiện dưới dạng **tab lọc** trong khu Tours. Hàm `regionGlance()`
ở `lib/regions.ts` **giữ nguyên**, nay nuôi `tags` và dải số liệu.

---

*Bản dưới đây giữ lại làm bản ghi lịch sử của vòng trước.*

**Sửa 29/07 — user duyệt bốn quyết định trước khi dựng (Task 5).** Bản 28/07 dưới
đây quy trang vùng về bốn khu xếp chồng. Rà lại trước khi dựng thì bản đó mang đúng
rủi ro đã giết `/destinations` vòng một: một dải số liệu rời + ba thẻ cạnh nhau là
hình dạng user đã bác bằng chữ *"3 cards vô hồn"*. Bốn điểm chốt lại:

| # | Quyết định | Thay cho | Vì sao |
| --- | --- | --- | --- |
| 1 | Dải at-a-glance nằm **TRONG hero**, thành rail đáy trên chính nền `--region-hero` | dải riêng dưới hero | Vừa đáp xuống là màu vùng + đúng ba con số *phân biệt được* vùng đến cùng lúc. Bớt một băng ngang; ba con số ở lại trong ngữ cảnh màu vùng thay vì trôi trên nền trắng |
| 2 | PLACES là **3 hàng rộng, kẻ mảnh** (tên cỡ lớn · `description` · số tour · mũi tên), cả hàng là link | 3 thẻ cạnh nhau | Khác hẳn dải ảnh full-bleed — **chữ ký của trang index** — nên hai trang không đọc thành bản sao; vẫn hiện đủ 9 câu `description` |
| 3 | **Có** băng CTA cuối trên nền `--region-hero`, dùng `enquiryCta.regionHeading(region)` | (bản cũ không nói) | Trang mở và đóng cùng một màu vùng. Khác hẳn CTA vừa bị bỏ ở `/destinations`: cái đó là vài dòng chữ căn giữa trên `bg-muted/30` nhạt sát footer, còn đây là một băng thật và heading nói đúng tên vùng |
| 4 | **Có** JSON-LD `BreadcrumbList` | (bản cũ chỉ canonical + OG) | Nexora có; v2 mới chỉ `/blog/[slug]` có — và ở cụm Blog nó **rơi mất từ lúc viết plan**, final review mới bắt (I1). Trang vùng có breadcrumb 3 cấp hiện hữu và sắp vào sitemap |

**`region.tagline` là tài sản thứ tư đang nằm không** (phát hiện 29/07): 3 chuỗi
trong `mocks/regions.ts`, **grep toàn repo = 0 consumer**. Nexora dùng nó ở
`RegionHero`. Task 5 là consumer đầu tiên — tagline làm phụ đề hero, còn
`regionPage.regions[key].intro` mở khu PLACES (không nhét cả hai vào hero).

Thứ tự khu chốt: **hero tint (kèm rail at-a-glance) → PLACES (intro + 3 hàng) →
TRIPS (lưới `TourCard`) → băng CTA vùng**.

Đối chiếu Nexora cho riêng trang này (luật 10) — họ có 9 khu / 765 dòng:

| Khoản Nexora | v2 | Phân loại |
| --- | --- | --- |
| `RegionHero` (ảnh cover + scrim + breadcrumb + name + tagline) | `--region-hero` + `TopoPattern` + breadcrumb + name + tagline | **làm khác mà tương đương** (quyết định 2: không ảnh) |
| `RegionIntro` (intro + intro2 + tags *best for* **hardcode** + bento 3 ảnh + CTA) | 1 câu `intro`; tags → **dẫn xuất** thành trip styles trong rail | **v2 tốt hơn** ở tags; cố ý bỏ bento (placeholder xếp khảm là ô trống, bài học `destination-tile`) |
| `RegionHighlights` · `RegionSignature` ×3 biến thể | rail at-a-glance dẫn xuất | **v2 tốt hơn** — số thật thay `350km` / `3,143m Fansipan` bịa |
| `RegionTours` (tab lọc theo địa điểm + phân trang 8) | lưới 6 `TourCard`, không lọc trong trang | **cố ý bỏ** — `/tours?destinations=<slug>` đã là trang lọc thật và mỗi hàng PLACES trỏ thẳng vào đó; spec §1 loại lọc khỏi phạm vi |
| `Gallery` 10 ảnh · `ValueProps` | bỏ | **cố ý bỏ** (§7 đã xoá copy, §8 #1 ghi nợ media) |
| `EnquiryCta` `regionHeading` | có (quyết định 3) | parity |
| `BreadcrumbJsonLd` | có (quyết định 4) | parity |

---

*Bản 28/07 dưới đây giữ lại làm bản ghi lịch sử.* Thứ tự khu:
**hero tint → dải at-a-glance → PLACES IN THIS REGION → TRIPS**.

**Hero: `--region-deep` phải chuẩn hoá độ tối trước khi dùng.** Đo được:

| | `--region-deep` L | `--hero` L |
| --- | --- | --- |
| north | 0.423 | 0.25 |
| central | 0.351 | 0.25 |
| south | 0.394 | 0.25 |

Chữ trắng trên cả ba vẫn đạt ~6–7:1 nên **không** vi phạm luật "hero luôn tối"
(luật đó tồn tại vì navbar chưa cuộn là trong suốt, hero sáng thì chữ navbar tàng
hình). Nhưng 0.351 so với 0.423 là bậc sáng **thấy được bằng mắt**, nên ba trang
vùng sẽ đọc thành thiếu nhất quán chứ không thành bản sắc. Chốt: pha về cùng một
bậc tối bằng `color-mix(in oklch, var(--region-deep), var(--hero) …)`, giữ nguyên
sắc. Repo đã có tiền lệ `color-mix(in oklch, …)` trong `button.tsx`.

Vẫn giữ đúng quy ước hero: `bg-*` trên `<section>` + wrapper `<div className="dark
contents">` bọc nội dung — **không bao giờ** đặt `dark` lên chính section.

**Dải at-a-glance: chỉ ba thứ THẬT SỰ phân biệt được vùng.** Đo cả bốn ứng viên:

| Vùng | trips | days | from | độ khó | chuyên mục |
| --- | --- | --- | --- | --- | --- |
| north | 6 | 1–12 | **$68** | easy→**challenging** | cruises · trekking · scenic · culture |
| central | 6 | 1–12 | **$59** | easy→moderate | culture · scenic · food |
| south | 6 | 1–12 | **$45** | easy→moderate | beaches · cruises · food · culture |

`trips` là **6/6/6** và `days` là **1–12 ở cả ba** — vì mock cố ý chia đều, và tour
12 ngày thuộc cả ba vùng. Một dải mà 2 trong 4 con số bằng nhau trên cả ba trang
thì hai con số đó là **trang trí, không phải thông tin** — nên dải chốt là
**`from $X` · phổ độ khó · chuyên mục có mặt**. Số tour dời sang tiêu đề khu
(`6 trips in the north`), nơi nó là ngữ cảnh chứ không giả làm điểm so sánh.

*(Sửa lại con số tôi nói sai lúc trình bày design: "from $175" là giá một **đợt
khởi hành**, không phải `basePrice`. Thật là **$68**.)*

`difficulty` **nullable** — `phu-quoc-reef-days` có `difficulty: null`. Phổ độ khó
bỏ qua giá trị null, **không** in chữ "null" và không coi null là một bậc.

**PLACES IN THIS REGION:** 3 thẻ, mỗi thẻ có `description` + số tour + link
`/tours?destinations=<slug>`.

**TRIPS:** dùng lại `TourCard` đã duyệt (bản 5 băng) — không dựng card mới.

**Metadata:** `alternates.canonical` + OG, cùng khuôn `/tours/[slug]`.

⚠️ **Tuyệt đối KHÔNG thêm `loading.tsx`** vào `destinations/` lẫn
`destinations/[region]/`. Đo được ở `/tours/[slug]` (cả `next dev` lẫn production):
chỉ cần một `loading.tsx` ở bất kỳ segment trong chuỗi là slug lạ trả **HTTP 200**
kèm giao diện 404 — `loading.tsx` tạo Suspense boundary, Next stream shell ra
trước, status 200 đã gửi xong trước khi thân trang gọi `notFound()`. Cụm này đưa
4 URL vào sitemap nên hậu quả y hệt.

## 6. Nối lại các link đang trỏ tạm

| Chỗ | Hiện tại | Sau cụm |
| --- | --- | --- |
| Footer `Destinations` | `/#gallery` | `/destinations` |
| Dropdown navbar (desktop) | 3 cột × 3 địa điểm, chỉ trỏ `/tours?destinations=` | **thêm** dòng `All destinations` → `/destinations`, **và** tiêu đề mỗi vùng thành link → `/destinations/<slug>`. Giữ 9 link địa điểm |
| Navbar `Destinations` (mobile) | `/tours` | **4 mục trải phẳng**: All + 3 vùng |
| `/#gallery` | không có lối ra | thêm link vào `/destinations` |
| `sitemap.ts` | 34 URL | **38** (1 index + 3 vùng) |

### 6.1 Dropdown — chỗ v2 hơn Nexora rõ nhất

Nexora có **đúng 4 dòng** (`messages.nav.destinationsMenu`): `All destinations` +
3 vùng, mỗi dòng một `hint` **gõ tay** (`'Hạ Long, Sa Pa, Ninh Bình'`). Muốn tới một
địa điểm cụ thể thì phải vào trang vùng rồi tìm tiếp.

v2 giữ **cả hai tầng** trong cùng một menu — bố cục 3 cột **đã dựng sẵn**, chỉ thêm
hàng "All destinations" và biến tiêu đề vùng thành link:

```text
Destinations ▾
┌────────────────────────────────────────────────────┐
│  ALL DESTINATIONS →         Browse every place     │
├──────────────┬──────────────┬──────────────────────┤
│ NORTHERN  →  │ CENTRAL   →  │ SOUTHERN          →  │
│ 6 tours      │ 6 tours      │ 6 tours              │
│  Hạ Long   2 │  Huế       4 │  Sài Gòn           3 │
│  Sa Pa     3 │  Hội An    4 │  Cần Thơ           2 │
│  Ninh Bình 3 │  Đà Nẵng   2 │  Phú Quốc          2 │
└──────────────┴──────────────┴──────────────────────┘
```

Tiêu đề vùng mang tint của vùng đó. Số tour **dẫn xuất**, không gõ tay — nên thêm
hay bớt địa điểm thì menu tự đúng, khác hẳn `hint` cứng của Nexora.

**Mobile là khoản THỤT LÙI phải vá.** Nexora trải phẳng 4 mục đó vào menu mobile
(`mobileNav` spread `destinationsMenu.items`). v2 hiện chỉ có `Destinations → /tours`,
tức trên điện thoại **không có đường nào duyệt theo vùng**. Comment trong
`site-header.tsx` ghi *"Một mục Destinations trỏ /tours là đủ"* — đúng ở thời điểm
chưa có trang nào để trỏ tới, sai từ khi cụm này tồn tại.

## 7. Copy i18n — CẮT phần bịa, THÊM phần điều hướng

`@tourism/i18n` **đã có sẵn ba khối** cho cụm này, port từ Nexora, **chưa ai dùng**:
`destinationsPage` (dòng 659) · `destinationDetail` (680) · `regionPage` (701) —
tổng **≈202 dòng**. Đúng tình huống khối `tourDetail` 188 dòng mà cụm Tours đã phải
cắt. Không rà là wire vào rồi mới phát hiện.

**Khuyết tật nặng nhất: copy quảng cáo những nơi sản phẩm KHÔNG bán.** Đếm được:

| Địa danh trong copy | Số lần trong copy | Số lần trong mock |
| --- | --- | --- |
| Hà Giang | **5** | **0** |
| Lan Hạ | 2 | **0** |
| Fansipan | 1 | **0** |
| Pù Luông | 1 | **0** |
| Mỹ Sơn | 3 | 3 ✓ |

Ship nguyên khối này là trang vùng hứa những chuyến không tồn tại. Nặng hơn lỗi
"See all 1,204 reviews", vì đây là **lời hứa về sản phẩm**, không chỉ là con số lệch.

Phải cắt, kèm lý do từng khoản:

| Khoản | Xử lý | Vì sao |
| --- | --- | --- |
| `destinationDetail` (cả khối) | **xoá** | Dành cho `/destinations/[slug]` — trang cho từng địa điểm mà cụm này cố ý không làm (§1) |
| `destinationDetail.valueProps` | **xoá** | 3 lời hứa tiếp thị bịa ("Luxury transfers", "vetted private drivers") không field nào đỡ, trên một capstone **không doanh thu** |
| `regionPage.signature.stats` | **xoá** | `350km`, `3,143m Fansipan`, `3+ Mountain regions` — số liệu biên tập bịa, và trỏ vào nơi không có trong mock |
| `regionPage.highlights` | **xoá** | 3 mục biên tập mỗi vùng, cùng bệnh trên |
| `regionPage.tags` | **xoá** | Hardcode `['Cruises','Trekking','Hill-tribe culture','Mountain passes']` trong khi §5.2 **dẫn xuất** chuyên mục từ tour thật; giữ cả hai là hai nguồn sự thật |
| `regionPage.gallery*` | **xoá** | Gallery ảnh — quyết định 2 đã bỏ |
| `regionPage.allTab` | **xoá** | Ngụ ý tab/lọc, ngoài phạm vi |
| `regionPage.introHeading` "The best …" | **viết lại** | Superlative không có dữ liệu xếp hạng đỡ (spec Tours §8 #3: không sort được theo rating/popularity) |
| `destinationsPage.regionHeading` "Top destinations in …" | **viết lại** | "Top" ngụ ý xếp hạng không tồn tại — cùng lý lẽ đã đổi "highlight" thành "Most recent" ở cụm reviews |
| `destinationsPage.popular*` | **xoá** | "Most popular journeys" / "Traveller favourites" — **không có tín hiệu popularity trong contract**, đúng họ với badge "Verified" đã bị loại ở reviews |
| `regionPage.noTours` | **viết lại** | Nói "destination" trên trang **vùng**, và "coming soon" là hứa thứ không ai cam kết |
| `destinationsPage.breadcrumbCurrent: 'Vietnam tours'` | **viết lại** | Đây là trang địa điểm, không phải trang tour |
| `regionIntro` / `regions` keyed by `'Northern Vietnam'` | **đổi khoá** | Đang khoá bằng **chuỗi user-facing** (`Record<string,string>`); đổi một chữ trong tên hiển thị là copy biến mất im lặng. Khoá bằng `key`/`slug` của vùng |
| `regionPage.regions[*].tagline` · `intro` · `intro2` | **giữ, soi lại từng câu** | Đây là phần dùng được — nhưng phải bỏ mọi câu nhắc 4 địa danh không bán |

### 7.1 Phần phải THÊM

Cắt xong thì thiếu copy cho hai thứ mới, phải viết:

- **`nav.destinationsMenu`** — nhãn 4 mục của dropdown (`All destinations` + 3 vùng)
  và nhãn cho hàng "All". **Không** kèm `hint` gõ tay như Nexora: hint sinh từ dữ
  liệu (§6.1), nên i18n chỉ giữ nhãn tĩnh.
- **`destinationsPage.featured`** — tiêu đề + phụ đề khu `Featured trips`. Chữ dùng
  phải trung thực với `isFeatured`: được gọi là *featured* (do biên tập chọn), **không**
  được gọi là *popular* / *most loved* / *traveller favourites* — không dữ liệu nào
  đỡ những chữ đó.

## 8. Nợ ghi sổ — KHÔNG vá ở đây

1. **Media cho destination.** `DestinationSchema` không có field ảnh, dù
   `MediaOwnerType` đã có sẵn `DESTINATION` và ADR-0005 đã chốt hình dạng
   `MediaItem`. Cùng một khoản với [nợ #1 của cụm Tours](2026-07-27-tours-pages-design.md).
   Cụm này **thiết kế để không cần ảnh** nên nó không bị chặn — thêm ảnh về sau
   không phải đụng bố cục. Đây là lý do chọn quyết định 2.
2. **`region` là chuỗi tự do nullable trong contract** trong khi hệ thiết kế có
   đúng 3 lớp tint. Static an toàn nhờ test bất biến ở §4.3, nhưng **lúc gắn API
   sẽ có destination `region` không map được và nó cần một chỗ để ở** — quyết định
   đó thuộc cụm gắn API: hoặc contract siết enum, hoặc index có khu "khác".
3. **Không có `destinations.bySlug`** trong contract. Cụm này không cần (trang vùng
   không phải trang địa điểm), nhưng nếu về sau muốn trang cho từng địa điểm thì
   phải mở rộng contract.
4. **Khối `messages.mobile` là dead code port từ Nexora, mang đúng hai bệnh mà §7
   vừa dọn** (phát hiện khi làm Task 3, 28/07): nó bịa địa danh
   (`location: 'Hà Giang, Việt Nam'` — v2 không bán Hà Giang) và khoá `Record` bằng
   **chuỗi user-facing** (`mobile.home.regionShort['Northern Vietnam']`). Đo được
   **0 consumer** trên toàn repo. Cố ý không dọn ở đây vì nó thuộc **P5 mobile** chưa
   khởi động — nhưng phải dọn khi P5 mở, nếu không app di động sẽ ship đúng lỗi mà
   web vừa sửa.

## 9. Logic thuần + TDD

Test trước cho `lib/regions.ts` (project Vitest `node`, theo ADR-0014):

- `regionOf`: khớp đúng · khác hoa/thường · khoảng trắng · `null` → `null`.
- Xếp nhóm: mỗi vùng đúng 3 địa điểm; tổng 9.
- `tourCount` dẫn xuất khớp đúng số tour distinct — **có case cho tour chạm 2 địa
  điểm cùng vùng, phải đếm 1 lần**.
- `toursInRegion`: `north-to-south-classic` xuất hiện ở **cả ba** vùng.
- Bất biến chống nói dối: **tổng tour theo vùng KHÔNG bằng `TOURS.length`** (18 ≠ 16)
  — test khẳng định điều này để không ai "sửa" nó thành cộng dồn.
- `regionGlance`: bỏ qua `difficulty: null`; giá nhỏ nhất là `basePrice` chứ không
  phải giá đợt khởi hành.
- Bất biến: **mọi destination đều map được về một vùng**.

Test component (project `dom`): index render đúng 3 vùng và mọi link địa điểm trỏ
`/tours?destinations=`; trang vùng có dải at-a-glance khớp đúng danh sách tour bên
dưới nó.

## 10. Tiêu chí hoàn thành

- `pnpm gate:int` xanh (CI xác minh — máy này không có Docker CLI).
- Slug vùng lạ trả **404 thật**, đo bằng `curl` trên **bản production**, không chỉ
  bằng unit test.
- `sitemap.xml` có đúng 38 URL.
- Không còn link nào trỏ `/#gallery` với nhãn "Destinations".
- **Menu mobile có đủ 4 mục** (All + 3 vùng) — không còn `Destinations → /tours`.
- Dropdown desktop có `All destinations` và 3 tiêu đề vùng đều là link sang trang vùng.
- Khu `Featured trips` render đúng **6** tour (`isFeatured === true`), và **không**
  chữ nào trên `/destinations` gọi chúng là "popular"/"most loved"/"favourites".
- Không còn `blurb` trong codebase (2 consumer ở §4.1 đã đổi).
- **Không còn `Hà Giang` / `Lan Hạ` / `Fansipan` / `Pù Luông` trong chuỗi
  user-facing của `destinationsPage` · `regionPage` · `nav`** — grep **loại trừ
  comment và khối `mobile:`**. (Phát biểu lại 28/07: bản đầu ghi "grep toàn file = 0"
  nhưng nó tự mâu thuẫn — §7 yêu cầu comment giải thích *có nêu tên* `Fansipan` để
  nói rõ đã cắt gì, và khối `mobile:` là nợ Nexora riêng, xem §8 #4.)
- `destinationDetail` đã bị xoá khỏi i18n (trang đó không thuộc cụm này).
- Không key nào trong i18n còn khoá bằng chuỗi user-facing `'Northern Vietnam'`.
- Kiểm mắt cả **light và dark** cho cả 3 vùng — ba hero về cùng một bậc tối.
- **Rebuild `@tourism/i18n`** sau khi sửa `messages.ts` (web đọc qua `dist`).

## 11. Mốc dừng bắt buộc

- Sau khi đắp lại mock + `lib/regions.ts` (§4): báo số liệu dẫn xuất thật để user
  đối chiếu **trước khi** vẽ giao diện.
- Sau `/destinations`: user xem ảnh, duyệt rồi mới sang trang vùng.
- Trước mọi merge/push: hỏi user (luật 2).
