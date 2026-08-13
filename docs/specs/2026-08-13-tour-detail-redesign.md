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
