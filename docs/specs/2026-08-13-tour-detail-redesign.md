# Trùng tu trang Tour Details — spec

> **Viết lại toàn bộ ngày 13/08/2026.** Bản đầu bị **xoá nội dung** vì nó là
> nguồn của hai lỗi đã lan thẳng vào code — xem §0. Bản này không mô tả thiết kế
> bằng lời nữa: nó **trỏ vào file wireframe** và chỉ chép lại số đo **trích bằng
> máy** từ chính file đó.

## 0. Nguồn sự thật, và hai lỗi của bản spec cũ

**Nguồn sự thật DUY NHẤT của trang này là**
[`docs/design/mockups/tour-detail.src.html`](../design/mockups/tour-detail.src.html)
— bản wireframe user đã duyệt sau ~20 vòng chỉnh. Khi spec và wireframe nói khác
nhau, **wireframe thắng**. Khi code và wireframe nói khác nhau, đó là bug.

File đó là **mảnh HTML** (không `<!doctype>`, không `<meta charset>`) vì nó vốn
được nhúng vào khung của công cụ brainstorm. Muốn mở xem thì bọc shell tối thiểu,
nếu không chữ tiếng Việt vỡ hết:

```bash
python3 - <<'PY'
src = open('docs/design/mockups/tour-detail.src.html', encoding='utf-8').read()
open('/tmp/wf/index.html', 'w', encoding='utf-8').write(
  '<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body>' + src + '</body></html>')
PY
python3 -m http.server 4173 --directory /tmp/wf
```

**Hai lỗi bản cũ mắc phải — đừng lặp lại:**

1. **Số đo đo nhầm nguồn.** Bản cũ ghi container nội dung **1104px**, lưới trên
   **621 | 40 | 443**, ảnh chính **541×541**. Cả ba đo từ **bản ReUI gốc**, không
   phải từ wireframe đã duyệt. Wireframe có **hai `<div class="shell">` lồng
   nhau**, mỗi cái `padding:40px 24px`, nên đệm cộng dồn 48/bên và nội dung thật
   là **1056px** → **573 | 40 | 443**, ảnh **493×493**. Trang dựng theo spec cũ
   rộng hơn bản duyệt 48px ở mọi khối.
2. **Ghi thêm thứ wireframe không có.** Bản cũ viết "giữ nguyên: hero, **dải khởi
   hành**". Wireframe KHÔNG có dải khởi hành dưới hero — panel đặt chỗ ngay dưới
   đã mang đúng bốn ô ngày đó, nên giữ cả hai là in cùng một thông tin hai lần
   cách nhau một màn cuộn.

Bài học chung: **spec không được tả lại thiết kế bằng lời.** Nó chỉ được trỏ vào
wireframe và chép số đo trích bằng máy. Mọi câu "giữ nguyên X" / "khoảng Y px"
viết tay đều là một cơ hội để bản ship trôi khỏi bản duyệt.

## 1. Phạm vi

Chỉ `apps/web/src/app/(site)/tours/[slug]/page.tsx` và các component dưới
`components/tours/`. **Không** đụng listing `/tours`, không đụng khu account.

Giữ nguyên (đã đo khớp wireframe, không dựng lại): `TourHero`, khu
"You might also like" (`RelatedTours` + `TourCard`), `DepartureSelectionProvider`,
`BookingRail` (bar dính mobile), `Lightbox`, `ImagePlaceholder`.

## 2. Số đo — TRÍCH BẰNG MÁY từ wireframe

Đo ở viewport 1440×1200. Mọi con số dưới đây là `getBoundingClientRect()` +
`getComputedStyle()` đọc từ chính file wireframe, không phải ước lượng.

### 2.1 Khung trang

| Thành phần | Số đo |
| --- | --- |
| Container `.shell` | max-width 1152, `padding:40px 24px` **× 2 lớp lồng** → nội dung **1056** |
| Base bo góc | `--radius: 1rem` → sm **9.6** · md **12.8** · lg **16** |

> **`--radius` của wireframe là `1rem`, của site là `0.375rem`.** Wireframe dùng
> ĐÚNG thang bậc dự án (`radiusScale` sm .6 · md .8 · lg 1) nhưng base khác, nên
> bo góc bản duyệt là 9.6/12.8 còn site ra 3.6/4.8. `tokens.css` sinh mọi bậc
> bằng `calc(var(--radius) * …)` nên **đè base tại container trang** là cả cây con
> khớp mà vẫn dùng utility token — KHÔNG hardcode px, và KHÔNG đổi token gốc
> (0.375rem là bo góc của cả site).

### 2.2 Khối trên: gallery + panel đặt chỗ

| Thành phần | Số đo |
| --- | --- |
| Lưới `.top` | `573px 443px`, gap **40** — cột phải GHIM 443, không dùng `1.4fr/1fr` |
| `.gal` | 573×507, gap 16 |
| `.thumbs` | 64×496, gap 8, **tối đa 7 ô** (7×64 + 6×8 = 496 ≤ 493+…) |
| 1 thumb | 64×64, radius **9.6**, border 1 |
| `.main-img` | **493×493**, radius **12.8**, border 1 |
| `.panel` | 443×507, flex-col gap **20**, **7 con** |
| `.cat` | 443×**14**, mono 11px, tracking .12em, uppercase |
| `.head` | 443×**114**, gap 8 — gom `title + rate + sum` vào MỘT con |
| `.title` | 443×32, **26px/32**, w500, tracking −0.3 |
| `.price-row` | 443×**28**, gap 10; giá **20/28 w600** màu `--price`; giá gạch 14px `--price-compare` |
| `.off-badge` | 67×**20**, radius 999, pad 2/8, **12/16 w500**, nền `--destructive`, chữ trắng, nội dung **"11% OFF"** |
| `.rule` | 443×**1** |
| `.sec` | 443×**88**, gap 12 |
| `.dates` | 4 cột đều, gap 8, `padding-top:4` |
| 1 ô ngày | 104.75×**52**, gap 2, radius **9.6**, border `--input`; ngày mono **14/1** dạng `14 Sep`; ghế 11px (`--warning` khi ≤3); đang chọn có tick 16×16 lệch góc −6/−6 |
| `.btns` | 443×**80**, grid gap 8 — **HAI nút**: Reserve (primary) + **Wishlist** (ghost) |
| `.btn` | 443×**36**, gap 6, radius **9.6**, **14/14 w500** |
| `.trust` | 443×**62**, 3 cột, gap 8 |
| `.trust-card` | 142.33×62, radius 9.6, pad **12/8**, gap 6, cột dọc icon-trên-chữ-dưới, chữ 12px |

### 2.3 Dải tab

| Thành phần | Số đo |
| --- | --- |
| `.tabs` | `margin-top:48` |
| `.tablist` | 1056×**40**, gap **24**, viền đáy 1px |
| `.tab` | **192**×38, `flex:1`, pad `2px 0 12px`, **14/20 w500** |
| `.pane` | `margin-top:24`, chữ nền **14/23** |
| `.pane.narrow` | **max-width 768** — CHỈ tab Itinerary dùng |

Chiều cao pane đo được (dữ liệu fixture của wireframe): Overview 500 · Itinerary
1146 · Departures 793 · Reviews 652 · Good to know 590.

### 2.4 Tab Overview

| Thành phần | Số đo |
| --- | --- |
| `.facts` | 4 cột **252px**, gap **16** (1056 − 3×16 = 1008 → 252 chẵn) |
| `.fcard` | 252×197, radius **12.8**, border 1, nền `--card` |
| `.fcard-h` | pad **12/16**, gap 8, viền đáy 1px, chữ muted |
| `.fcard-b` | pad **16**, gap 12, `flex:1` |
| `.fcard-v` | 14/20 w500 |
| `.fcard-l` | 12px w500 màu `--primary-emphasis`, `margin-top:auto` |

### 2.5 Hai modal

Khung dùng CHUNG (`.dlg` / `.dlg-box`):

| Thành phần | Số đo |
| --- | --- |
| `.dlg` (lớp phủ) | `position:fixed inset:0`, nền `oklch(0 0 0 / 0.6)`, pad 24, canh giữa |
| `.dlg-box` | radius **16** (`--radius-lg`), border 1, nền `--background`, `max-height:min(760px,100%)`, flex-col |
| `.dlg-head` | pad **20px 24px 16px**, viền đáy 1px |
| `.dlg-title` | font heading **20/26 w500** |
| `.dlg-sub` | **13/20** muted, `margin-top:4` |
| `.dlg-x` | **32×32**, radius 9.6, border 1, nền `--card`, absolute `top:16 right:16` |
| `.dlg-scroll` | `overflow-y:auto`, pad **8px 24px 16px** |
| `.dlg-foot` | viền trên 1px, pad **16px 24px**, `justify-content:space-between`, gap 16 |

Khác nhau đúng hai chỗ:

| | "All dates" | "Show all reviews" |
| --- | --- | --- |
| Bề rộng | **640** | **720** |
| Head cao | 117 (có ô lọc `.dlg-filter` 13px, `margin-top:14`) | 135 (có hàng `.rv-ctl` cao 32, gap 12) |
| Một hàng | 38, pad `16px 0 8px` | 245, pad `18px 0` |
| Chân | đợt đang chọn ⟷ nút Close | "Showing a–b of N" ⟷ Prev · `1 / 4` · Next |

### 2.6 Tab Departures — CỐ Ý KHÁC BẢN DUYỆT

Đây là chỗ DUY NHẤT của đợt trùng tu không dựng y wireframe, và lý do là kết quả
thử người dùng chứ không phải ý thích: bản duyệt vẽ mỗi tháng thành một dải khối
ngang (`.mseats i`), nhóm của user thử mà không đọc ra khối đó là gì.

**Nguyên nhân đo được.** Mỗi khối đáng lẽ là MỘT ĐỢT, nhưng CSS để `flex:1` nên
khối tự giãn kín cột — bề rộng không mang thông tin gì. Fixture thật là 3–6 đợt
mỗi tour, **nhiều nhất 2 đợt trong một tháng** (đếm trên
`apps/api/prisma/fixtures/catalog/tours-*.ts`), nên hầu hết dòng ra MỘT thanh đặc
kín chiều ngang, trông hệt thanh tiến độ 100%. Nó hỏng ở CẢ HAI đầu: 1 đợt ra
thanh đầy, 30 đợt (tour chạy tuyến hằng ngày) ra 30 lát 21px không đọc nổi. Việc
bản duyệt phải kèm một dòng chú thích mới hiểu chính là bằng chứng hình vẽ hỏng.

**Luật thay thế: mọi thứ trên dòng cha phải có chi phí O(1)** — không được dài ra
theo số đợt.

| Thành phần | Chi phí | Ở đâu |
| --- | --- | --- |
| Số tổng hợp (dates open · seats left · price range) | O(1) | dòng tháng |
| Thanh ghế chia đốt | O(`maxGroupSize`) = 10 | dòng đợt |
| Ô ngày / dải khối | O(N) — **loại** | không dùng |

Bản duyệt của phương án thay thế:
[`docs/design/mockups/tour-detail-departures.src.html`](../design/mockups/tour-detail-departures.src.html).

| Thành phần | Số đo |
| --- | --- |
| `.dep-stats` | 4 cột đều, gap 16 → 252px mỗi ô (giữ nguyên bản duyệt) |
| Khung bảng | 1056 rộng, radius **12.8** (`--radius-md`), border 1, nền `--card`, **`overflow:hidden`** |
| Cột | `40 · auto · 200 · 124 · 128 · 120` (phần dư dồn vào cột NGÀY) |
| Nhịp thụt hai đầu | `--row-pad: 20px` — mũi xổ và nút Select cách viền khung 20 |
| Hàng tháng | pad dọc 14, hover `bg-muted/40` phủ TRỌN bề ngang |
| Hàng đợt | pad dọc 10, nền `bg-muted/25` (lõm hơn hàng cha một tầng), viền trên `border/55` |
| Hàng đợt đang chọn | nền `bg-primary/10`, nút đổi sang `outline` + chữ "Selected" |
| Đốt ghế | **12×16px**, gap 4, radius 6, border 1 — port ReUI `stats-13`, đo tận DOM |
| Huy hiệu | cao 22, radius 999, pad ngang 9, chữ 11 w500 — dùng lại `.tl-badge` của tab Itinerary |
| Trần dòng xổ | `DEPARTURE_ROWS_PER_MONTH = 6`, phần dư sang modal "All dates" |

Ba quyết định đi kèm, mỗi cái vá một lỗi đã đo được:

1. **Đảo cực thanh ghế.** ReUI `stats-13` là card quản trị: tô đầy = đã dùng hết
   ("67% assigned"). Bê nguyên cực đó ra trang bán hàng thì đợt chưa ai đặt hiện
   thanh trắng trơn — đọc ra như tour ế hoặc như widget hỏng. Ở đây tô đầy =
   **ghế CÒN cho khách**.
2. **Huy hiệu tháng lấy trạng thái GẮT NHẤT và im lặng khi không có gì đáng nói**
   (`monthNotice`). Bản đầu gắn "All open" cho tháng 8 trong khi đợt duy nhất của
   nó còn 2 chỗ — dòng cha nói sai về chính con nó.
3. **`overflow:hidden` trên khung là bắt buộc.** Nền hàng và vệt hover là hình
   chữ nhật đặc; không cắt theo bán kính thì bốn góc lòi ra bốn mẩu vuông — cùng
   lỗi "hai cái tai" đã dính ở modal All dates.

Không port `DataGrid` của ReUI: repo chưa có `@tanstack/react-table`, và bảng này
cần đúng MỘT tính năng của nó (hàng xổ được) cho 4–6 dòng trên trang SSG. Cơ chế
giữ nguyên — mỗi tháng một `<tbody>`, hàng đợt nằm cùng `<tbody>` đó.

### 2.7 Tab Reviews

| Thành phần | Số đo |
| --- | --- |
| `.rvtop` | lưới **220px / 804px**, gap **32**, `align-items:start` (1056 − 220 − 32 = 804) |
| `.big` | font heading **40/44 w500** |
| `.stars` | cao **20**, chữ 14/20 — cụm sao là `inline-flex`, KHÔNG `flex` |
| `#rvBasedOn` | 13px, thừa hưởng lh **23** của `.pane` |
| CTA "Show all reviews" | `.btn-sm`: **32 cao**, đệm ngang 14, chữ 13, bo `--radius-sm` |
| Ghi chú dưới CTA | 12px/**23**, `max-width:200`, `margin-top:10` |
| `#rvHist .bar` | cao **27** (12px chữ trên lh 23 + pad 2/2), gap 8 |
| `.bar .t` · `.track` · `.bar .n` | **18** · `flex:1` (748) cao **6** bo tròn · **22** canh phải |
| `#rvPreview` | `max-width:768`, `margin-top:28` — **2** review làm mồi |
| `.rv-item` | pad `18px 0`, viền đáy 1px, mục cuối bỏ viền |
| `.rv-av` · `.rv-name` · `.rv-when` | **28×28** tròn, 12px/1 · 14/20 w500 · 12/20 muted |
| `.rv-title` · `.rv-body` | heading **15/22 w500**, mt 8 · **14/22**, mt 4 |
| `.rv-pics img` | **64×64**, bo `--radius-sm`, viền 1px |

Modal dùng khung chung ở §2.5, khác ở: bề rộng **720**, đầu cao 135 vì có hàng
`.rv-ctl` (cao 32, gap 12), một hàng 245, chân là "Showing a–b of N" ⟷ Prev ·
`1 / 4` · Next. Cỡ trang **6** (`REVIEWS_PAGE_SIZE`).

Hai điều bắt buộc về hành vi:

1. **Sort và lọc đi qua server**, không sắp lại ở client — client chỉ nắm một
   trang, "highest first" tính tại chỗ sẽ mâu thuẫn với trang kế. Đây là lý do
   contract nở thêm `sort`/`rating`/`withPhotos` ở T1.
2. **Trang 1 fetch ở SERVER** và truyền vào modal làm `initialPage`: hai review
   mồi phải nằm trong HTML tĩnh cho crawler, và mở modal ra là có chữ sẵn thay
   vì nháy một nhịp rỗng. Mở modal ở bản mặc định KHÔNG gọi lại API.

Ba con số phải khớp nhau và đã đo là khớp trên `ha-giang-loop-4d`: `ratingAvg`
4.4 · `ratingCount` 5 · `breakdown` 3★1 4★1 5★3 (tổng 5, 22/5 = 4.4). Điểm lớn
lấy từ `tour.ratingAvg` chứ KHÔNG tính lại từ breakdown — tính lại là giấu lỗi
cập nhật cột chuẩn hoá phía API thay vì để nó lộ ra.

Bề rộng cột biểu đồ là `count/total`, KHÔNG chuẩn hoá theo cột cao nhất: chuẩn
hoá kiểu đó làm mức phổ biến nhất luôn đầy 100% ở mọi tour.

## 3. Hành vi

Ràng buộc kiến trúc giữ nguyên theo
[ADR-0022](../adr/0022-tour-detail-tabs.md) — đọc ADR đó, không chép lại ở đây:
5 tab · render đủ 5 panel rồi ẩn bằng CSS (SSG + sitemap) · tab đồng bộ hash URL ·
`OnThisPage` rời trang này · trạng thái live của timeline chỉ hiện cho session có
booking PAID đúng đợt · không có nút "Write a review".

Hành vi phải bám wireframe, đã bị làm sai ở bản trước nên ghi rõ:

1. **Giá đi theo ĐỢT ĐANG CHỌN.** Panel treo ở `tour.basePrice` là sai — mỗi đợt
   có `effectivePrice` riêng, và badge giảm tính theo `compareAtPrice` của chính
   đợt đó. `BookingRail` đã đúng từ đầu; panel phải nói cùng con số với nó.
2. **Bấm ảnh mở lightbox**, kể cả khi tour chưa có ảnh thật (placeholder vẫn mở).
3. **"All N dates" và "See all dates" ở tab Departures mở CÙNG MỘT modal** — một
   instance duy nhất, trạng thái sống ở `DepartureSelectionProvider`.
4. **Sort/lọc của modal review đi qua server**, không sắp lại ở client: client chỉ
   nắm một trang, "highest first" tính tại chỗ sẽ mâu thuẫn với trang kế.

## 4. Dữ liệu — chỗ wireframe nói được mà contract không đỡ

Wireframe dựng trên fixture giàu hơn DB thật. Ghi ở đây để không ai tưởng là thi
công thiếu:

| | Wireframe | Dữ liệu thật (`ha-giang-loop-4d`) |
| --- | --- | --- |
| Ảnh | 7 thumb + ảnh lớn | **0** — `MediaAsset` rỗng, dùng `ImagePlaceholder` |
| Đợt khởi hành | 12 | 4 |
| Chặng | 4 | 1 → dải chặng co thành một dòng |
| Review | 23 | 5 |

Ba chỗ bản ship **cố ý khác wireframe** vì dữ liệu công khai không xác nhận được:
bỏ huy hiệu "Verified rider" (`listByTour` trả cả review `CURATED`, và
`PublicReviewSchema` không phơi `source`) · ngày review theo tháng+năm
(`formatReviewDate` đã có quy ước) · thẻ policy bỏ nhãn nhóm khi nhãn trùng đúng
`title`.

## 5. Mở rộng contract (đã làm, giữ nguyên)

`reviews.byTour` nhận `sort` (newest/oldest/highest/lowest) · `rating` ·
`withPhotos`, và trả thêm `breakdown` 5 mức sao. `breakdown` cố ý KHÔNG áp bộ lọc
`rating` (áp thì biểu đồ tự triệt tiêu thành một cột) nhưng CÓ áp `withPhotos` —
đó là phạm vi người đọc đang xem.

## 6. Nghiệm thu

Không khai xong bằng mắt. Chạy bộ so wireframe ⟷ trang thật trên **mọi phần tử
của cả 5 tab và 2 modal**, và chỉ báo user khi bảng lệch về **0**. Kèm:
`pnpm gate:int` xanh · build sinh đủ 74 trang tĩnh · 0 lỗi console.
