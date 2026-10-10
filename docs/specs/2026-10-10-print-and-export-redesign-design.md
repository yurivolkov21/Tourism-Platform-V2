# Spec G40 — Thiết kế lại bản in và file xuất

- **Ngày:** 2026-10-10 · **Trạng thái:** thiết kế duyệt qua bản thảo trong chat cùng ngày — voucher
  phương án 5b (user tự cắt ghép từ các phương án 1–4), hoá đơn chờ B1, báo cáo tháng C2, Excel D1;
  danh sách xuất chuyển từ CSV sang Excel sau khi đo trên máy user. Chờ user duyệt spec.
- **Quyết định kiến trúc:** [ADR-0057](../adr/0057-print-documents.md) (bản in là tài liệu riêng,
  trang in `doc` A4 lề 0, khung chung) · [ADR-0034](../adr/0034-excel-report-export.md) AMEND 3
  (danh sách xuất Excel thay CSV; ngày `[$-409]`).
- **Bản vẽ đã duyệt** (`docs/design/mockups/`):
  [print-voucher.src.html](../design/mockups/print-voucher.src.html) (phương án 5b; 1–5a giữ làm
  bản ghi), [print-receipt.src.html](../design/mockups/print-receipt.src.html) (B1),
  [print-report.src.html](../design/mockups/print-report.src.html) (C2),
  [excel-report-d1.xlsx](../design/mockups/excel-report-d1.xlsx) (D1). Số liệu trong các bản thảo
  là minh hoạ (tháng 9/2026 lấy gần đúng từ prod; thuế 10% và phí thanh toán 2,9% + $0.30 là giả
  định để ra số).
- **Đóng:** G40; phần chữ của G37 (cuống hoá đơn của đơn chưa trả đã đóng).

## 1. Mục tiêu & phạm vi

### Vấn đề

- **Voucher in** (`/checkout/success`, đơn đã trả): bố cục màn hình ép vào A4 — email gãy giữa
  chữ, tiêu đề gãy dòng, mộc chen sát tiêu đề, một phần ba dưới trang trống, không logo, trình
  duyệt in kèm ngày giờ, tiêu đề tab và URL.
- **Hoá đơn chờ in** (đơn chưa trả): không có khối in riêng — in cả navbar, hero tối, footer, nút
  Copy.
- **Báo cáo tháng in** (admin `/reports`, cũng là "Xuất PDF"): CSS in chung mọi trang admin, không
  logo, không đầu hay chân trang.
- **Excel báo cáo**: đã có màu và định dạng số, nhưng chưa đặt font, chưa có metadata, chưa có đầu
  và chân trang khi in, và ngày ra "5 Thg10 2026" trên Windows tiếng Việt.
- **CSV bookings, subscribers**: bấm đúp trên Windows tiếng Việt thì dồn hết vào cột A (đo 10/10,
  ADR-0034 AMEND 3).

### Phạm vi

| Mã | Đầu ra | Bản chốt |
| --- | --- | --- |
| A | Voucher in | 5b |
| B | Hoá đơn chờ in | B1 |
| C | Báo cáo tháng in | C2 |
| D | Excel báo cáo tháng | D1 |
| E | Xuất danh sách bookings | Excel thay CSV |
| F | Xuất danh sách subscribers | Excel thay CSV |

**Ngoài phạm vi:** email (G34), app mobile, PDF phía server, bản in của các trang khác (blog,
trang tour), trang Passport.

## 2. Khung chung (ADR-0057)

### 2.1 Trang in

- `@page doc { size: A4; margin: 0 }`; phần tử `[data-print-doc]` mang `page: doc`.
- Tài liệu 210 × 297 mm, cột dọc; đệm trên 14 mm (11 mm khi trang mở bằng bìa ảnh), ngang 15 mm,
  dưới 11 mm. Chân trang dính đáy (`margin-top: auto`).
- **Một tài liệu = một trang** với dữ liệu thật; nội dung dài theo luật cắt ở từng mục dưới đây.
- Chữ: Literata (tiêu đề), Archivo (thân), IBM Plex Mono (mã, nhãn nhỏ) — chính font `next/font`
  của app. Cỡ thân 9.5 pt; nhãn nhỏ 6.8–7.5 pt mono viết hoa, giãn chữ.

### 2.2 Đầu trang

- **Trái:** `LOGO_MARK` rộng 11 mm và wordmark "Nex**ora**" 17 pt. Dưới là dòng liên hệ 7.5 pt:
  - tài liệu của khách: `www.nexora-travel.agency · tourism.platform.online@gmail.com · +84 24 3826 0126`
    (chỉ còn website khi nằm trên ảnh bìa);
  - tài liệu nội bộ: `Back office · www.nexora-travel.agency`.
- **Phải:** loại tài liệu (mono, hoa), số tài liệu (mã đơn hay kỳ `YYYY-MM`), dòng mốc ("Issued
  {ngày trả}", "Booked {ngày, giờ đặt}", "Generated {giờ tạo} UTC").
- Trên bìa ảnh: logo đảo màu (viên trước trắng, viên sau teal nhạt), chữ trắng.

### 2.3 Chân trang

- Viền trên 0.6 pt. **Trái:** tài liệu khách — "Need help? Reply to your confirmation email or
  write to {email}" (hoá đơn chờ thêm số điện thoại); tài liệu nội bộ — "Nexora back office ·
  Monthly report {YYYY-MM} · Internal — not for distribution".
- **Phải:** "Printed {d Mon yyyy, HH:mm}" theo giờ Việt Nam, đóng dấu ở client lúc `beforeprint`
  (ADR-0057 §3). Không in "Page x of y" (ADR-0057 §2) — các bản thảo có dòng "Page 1 of 1", khi
  dựng thì bỏ.

### 2.4 Màu & mực

- Token mới: `chart-gain`, `chart-cost`, `pending`, `pending-soft` (giá trị ở ADR-0057 §5). Mọi
  màu khác dùng token sẵn có (`primary`, `primary-emphasis`, `hero`, `paper`, `ink`,
  `muted-foreground`…).
- `print-color-adjust: exact` cho: ảnh bìa và lớp phủ, dải teal của vé, cuống gạch chéo, các dải
  nền nhạt, mã vạch, thanh biểu đồ.
- **In trắng đen vẫn đủ thông tin:** chi phí có vân 45°, trạng thái luôn có chữ, không thông tin
  nào chỉ nằm ở màu.

### 2.5 Linh kiện

- `@tourism/ui` → `print-doc/`: `DocPage` (khổ, trang tên, `data-print-doc`), `DocLetterhead`
  (biến thể `paper` / `photo`; nhận logo, dòng liên hệ, loại, số, mốc), `DocFooter`, `PrintedAt`
  (client, `beforeprint`), `DocStamp` (tông `confirmed` / `pending` / `muted`).
- Web: `components/print/voucher-print.tsx`, `receipt-print.tsx` cùng view-model thuần
  `lib/print/voucher-print.ts`, `receipt-print.ts`.
- Admin: `components/reports/report-print.tsx`, `waterfall.tsx` (SVG) cùng
  `lib/report-print.ts`.
- CSS: gỡ khối in cũ của voucher và hoá đơn ở `apps/web/src/app/globals.css`; luật cô lập tài liệu
  khi in nằm ở CSS chung của `@tourism/ui`, không bám DOM của app (ADR-0057 §1, sửa sau review
  Phần 1). Lớp chữ in dùng chung (`PRINT_LABEL`, `PRINT_SECTION`) ở `@tourism/ui/lib/print-styles`.

## 3. Voucher in — 5b

### 3.1 Cấu trúc, từ trên xuống

1. **Bìa ảnh 62 mm.** `<img loading="eager">` ảnh tour (`booking.tourImage`), lớp phủ gradient
   tối dần xuống dưới. Letterhead đảo màu: loại "Trip voucher", mốc "Issued {ngày trả}". Đáy bìa:
   kicker mono "{nơi} · {N} day(s) · {Ddd D Mon YYYY}" và tên tour Literata 27 pt (tối đa hai dòng;
   dài hơn thì 22 pt).
2. **Tấm vé có cuống** — cùng hình tấm vé trang chi tiết đơn:
   - Dải teal "Entry · Tour booking" cùng mã đơn.
   - Tên tour 14 pt và mộc (`bookingPass.stamp`).
   - Departs / Returns: ngày lớn mono, dòng phụ "Ddd · YYYY" (thêm "· meet HH:MM" khi tách được giờ
     hẹn, §3.2), đường nối "{N} day(s) · {nơi}".
   - Lưới bốn ô: Lead traveller · Travellers · Booked · Paid with.
   - Cuống 52 mm: dải "Admit {tổng khách}", "Total paid", số tiền, "Taxes and fees included", mã
     vạch (`TicketBarcode`, chỉ khi `bookingPass.barcode`), mã đơn.
   - Viền teal 0.9 pt, đường chấm cắt giữa vé và cuống, nửa vòng tròn đục lỗ ở hai đầu.
3. **Dòng xé** "Show the ticket at pickup — printed or on your phone" (chỉ khi có mã vạch).
4. **"Your day · {tiêu đề ngày}"**: dòng thời gian hai cột, chấm teal, giờ mono.
5. **Included / Not included**: hai cột, dấu ✓ và –.
6. **Dải ba cột** nền `paper`: Where to meet · Cancellation · Payment.
7. Chân trang khách.

### 3.2 Nguồn dữ liệu

- `BookingDetail`, `voucherView(booking, now)`, `bookingPass(booking, phase)`, `refundSentence`.
- Dữ liệu tour (`BookingTourData` thêm `included`) khi `needsTourData(phase)` — đã đọc sẵn cho ô
  Meeting point; không thêm vòng API.
- **Giờ hẹn:** dòng đầu của lịch trình ngày đầu khớp `^\d{1,2}:\d{2}` thì lấy giờ ấy; không khớp
  thì bỏ "· meet HH:MM".
- **Lịch trình một ngày:** mỗi dòng "HH:MM — …" là một mục; dòng không có giờ in nguyên văn.

### 3.3 Biến thể theo giai đoạn (`bookingPhase`, ADR-0054 AMEND 1)

| Giai đoạn | Mộc | Mã vạch, dòng xé | Lịch trình, Included | Dải cuối |
| --- | --- | --- | --- | --- |
| `upcoming` | theo `bookingPass` (CONFIRMED…) | có | có | Where to meet · Cancellation · Payment |
| `on_tour` | như trên | có | "Your day" là ngày đang đi của chuyến | như trên |
| `travelled` | như trên | không | không (không đọc tour) | Payment · Booking reference |
| `cancelled` | CANCELLED / REFUNDED | không; thân vé thay bằng dải hết hiệu lực của `voucherView.cancelledNotice` | không | Refund (`refundSentence`) · Payment |

Đơn chưa trả (`awaiting_payment`, `lapsed`) không có voucher — in hoá đơn chờ (§4).

### 3.4 Luật nội dung dài (giữ một trang)

- **Tour nhiều ngày** (sắp đi): "Your trip · {N} days" liệt kê "Day k · {tiêu đề}" tối đa 8 dòng
  (2 cột × 4). Hơn 8 ngày: in 7 dòng, dòng cuối "+{N − 7} more days — full itinerary at
  nexora-travel.agency/tours/{slug}".
- **Tour một ngày:** tối đa 10 mục; hơn thì 9 mục và "…".
- **Included / Not included:** tối đa 6 mục mỗi cột; hơn thì "+{n} more".
- **Tên tour** trên bìa: tối đa hai dòng (cắt bằng dấu …); trên vé cũng hai dòng.
- **Kẹp số dòng** (sửa sau review Phần 1 — đo hai tour seed dài thì chân trang tràn tới mép giấy, vì
  luật cắt đếm mục, không đếm dòng gãy): mỗi mục lịch trình và mục gồm tối đa hai dòng, chữ mỗi cột
  dải cuối tối đa bốn dòng. Mục gồm bỏ mục trống, mục trùng (cùng luật khối Get ready). Ngày cần in
  không có mô tả thì bỏ lịch trình. Đang đi từ ngày 2 thì dải cuối không in giờ hẹn của ngày 1.
- **Thiếu ảnh tour:** nền `hero`, letterhead vẫn đảo màu.
- **Thiếu dữ liệu tour** (API lỗi): bỏ lịch trình và Included; ô Where to meet dùng câu dự phòng
  sẵn có ("Contact us for the meeting point — we reply within a day.").

## 4. Hoá đơn chờ in — B1

### 4.1 Khi nào in

`/checkout/success` với đơn chưa có `paidAt` (đang dựng `BookingReceipt`) và `/checkout/cancel`.
Nút Print chỉ ở `/checkout/success` như hiện nay; trang cancel in bằng Ctrl+P.

### 4.2 Đơn đang chờ trả (PENDING)

1. Bìa ảnh 46 mm, letterhead đảo màu: "Booking receipt", "Booked {d Mon yyyy, HH:mm}".
2. **Tấm vé ở trạng thái chờ:** viền đứt xám, dải xám "Booking · payment pending" cùng mã đơn, mộc
   "Payment pending" (`pending`); route và lưới như voucher, ô cuối là "Payment" (cổng thanh toán
   hay "—"). Cuống gạch chéo: dải "Unpaid", nhãn "Not yet a voucher", tổng tiền, "Total · includes
   all taxes and fees", "Pay by {HH:MM · D Mon}".
3. Dòng xé: "This code becomes your voucher once payment is complete".
4. **Summary:** bảng Item · Travellers · Price · Amount, dòng Total, "Includes all taxes and fees."
5. **Dải ba cột:** How to pay ("Open My bookings on nexora-travel.agency and choose Pay now." cùng
   câu test mode) · If it stays unpaid ("The booking is released at {HH:MM, d Mon yyyy} (Vietnam
   time). Seats aren't held until you pay.") · Booking reference (mã, email người đặt).
6. Chân trang khách, thêm số điện thoại.

"Pay by" lấy từ `createdAt + CHECKOUT_SESSION_MINUTES` (60 phút — phiên ngắn nhất, Stripe; TTL quét 65 phút
của API là lưới khi webhook rớt, hứa theo nó là hứa dư 5 phút — sửa sau review Phần 1) (thêm helper
`pendingDeadline`, cùng nguồn với `pendingExpiry`), kẹp ở hết ngày hạn chót của chuyến (23:59:59 giờ Việt Nam) — qua mốc ấy API thôi
mở phiên trả mới (sửa sau review Phần 1). Không đồng hồ đếm ngược, không chữ "held" hay "reserved"
(đơn chờ không giữ chỗ).

### 4.3 Đơn chưa trả đã đóng (G37)

- Mộc "Closed" (`muted`); cuống: "No payment was taken" thay cho "Pay by".
- Dòng xé: "This booking is closed — no payment was taken." — không hứa thành voucher.
- Dải: What happened (câu lapsed hay cancelled hiện có) · Book again (link `/tours/{slug}`) ·
  Booking reference.
- Đơn bị thu rồi hoàn tự động (`paidAt` null, đã hoàn): thêm câu `refundSentence`; giấy KHÔNG nói
  "No payment was taken" hay "Unpaid" cạnh khoản đã hoàn — dải cuống là trạng thái đơn, cuống không
  hộp chân, dòng xé là câu kết cục theo trạng thái (`closedStubSentence`, sửa sau review Phần 1).
- Chuyến công ty huỷ: What happened là câu "We had to cancel this departure." như trang chi tiết đơn
  (`closedNarrative`).
- **Màn hình** `BookingReceipt` sửa cuống theo cùng câu cho đơn đã đóng — đóng phần chữ của G37.

### 4.4 Đơn chờ trả qua hạn chót (`lapsed`)

Sửa sau review Phần 1: `lapsed` chưa phải kết cục — claim của API còn nhận phiên mở trước hạn
(ADR-0054 AMEND 1 §4), màn hình cùng trang còn nói "Confirming". Giấy kể như trang chi tiết đơn:
mộc trung tính "Not paid", dải vé "Booking · payment not completed", What happened là câu sự việc
rồi câu điều kiện (`notPaidByDeadline`, `finishOpenPayment`); không "Closed", không "No payment was
taken", không hạn trả (API thôi mở phiên mới), không dòng xé.

## 5. Báo cáo tháng in — C2

### 5.1 Cấu trúc

1. Letterhead nội bộ: "Monthly report", số kỳ `YYYY-MM`, "Generated {d Mon yyyy, HH:mm} UTC"; gạch
   mực dưới.
2. Tiêu đề "Monthly report — {Month YYYY}" và dòng "{kỳ (reportPeriodLabel)} · all amounts in
   {currency} · tax on margin {rate}".
3. Bốn ô số: Revenue recognised (nền nhạt) · Gross profit (dòng phụ "Gross margin {pct}") · Net
   profit · Cash collected (dòng phụ "{n} paid bookings").
4. "From revenue to net profit": thác nước SVG (trái) và bảng lãi lỗ kế toán (phải, 64 mm) — số
   âm trong ngoặc, gạch ở dòng cộng, gạch kép dưới lãi ròng, dòng "{n} departures ran this month."
5. Cảnh báo thiếu giá vốn (`costWarning`), nếu có, một dòng ngay dưới bảng.
6. "Bookings created this month": thanh 100% theo trạng thái, chú thích nhãn · số · %, "Total".
7. "Money and operations": lưới 4 × 2 tám chỉ số.
8. "How to read these numbers": bảy chú giải đánh số, hai cột, 7.2 pt.
9. Chân trang nội bộ.

### 5.2 Thác nước

- Bảy cột: Revenue recognised (tổng) → Cost per traveller (−) → Cost per departure (−) → Gross
  profit (tổng phụ) → Tax on margin (−) → Payment fees (−) → Net profit (tổng).
- Cột tổng màu `chart-gain`; cột trừ `chart-cost` và vân 45°. Cột rộng tối đa 46 đơn vị, đầu bo
  4 px, chân vuông; nối bậc bằng nét chấm.
- Nhãn ngắn ở đầu cột ($39.6k, −$992); nhãn hạng mục hai dòng dưới trục. Lưới ngang mờ ở các mốc
  tròn tự tính; trục 0 đậm.
- **Lãi âm:** thang chạy từ min tới max; cột tổng âm đi dưới trục 0, màu `chart-cost`, nhãn có
  dấu trừ.
- **Tháng chưa bắt đầu hay chưa có số:** thay biểu đồ bằng "No figures for this month yet."; bảng
  vẫn in số 0.
- Bảng số bên cạnh là bản "table view" của biểu đồ (yêu cầu trợ năng của skill dataviz).

## 6. Excel báo cáo tháng — D1

### 6.1 Workbook

- Metadata: creator và lastModifiedBy "Nexora back office", title "Nexora — monthly report
  {YYYY-MM}", subject, company "Nexora Travel", created = giờ tạo báo cáo.
- Mọi sheet: A4, `fitToWidth: 1`, căn giữa ngang, lề 0.5″ / 0.8″; đầu trang `&L Nexora back office
  &C Monthly report · {Month YYYY} &R Internal — not for distribution`; chân trang `&L Generated {…}
  UTC &R Page &P of &N`.
- Font: Calibri (thân), Cambria (tiêu đề), Consolas (mã và số trong bảng).
- Định dạng: tiền `#,##0.00;(#,##0.00)`; đếm `#,##0`; phần trăm `0.0%`; ngày `[$-409]d mmm yyyy`;
  ngày-giờ `[$-409]d mmm yyyy hh:mm`.
- Tab: Summary màu thương hiệu, Definitions xám nhạt, còn lại xám. Summary và Definitions ẩn lưới.

### 6.2 Summary — dashboard

Bố cục ô theo `excel-report-d1.xlsx`:

1. Tiêu đề Cambria 20 (B2:I2) và dòng kỳ (B3:I3).
2. Bốn ô số, mỗi ô 2 cột, hàng 5–7 (nhãn mono, số 17 pt, dòng phụ), viền mảnh; ô đầu nền nhạt.
3. "From revenue to net profit": Line (B:D) · Amount (E) · "Share of revenue" (F:I) — thanh
   `=REPT("█", MAX(1, ROUND(ABS(E{r}) / $E${hàng doanh thu} * 30, 0)))`, chữ màu gain hay cost theo
   dòng. Gạch ở Gross profit, gạch trên và gạch kép dưới ở Net profit.
4. "Bookings created this month": Status · Bookings · Share (`=C/Total`) · thanh `REPT` theo Share.
5. "Money and operations": tám chỉ số hai cột.
6. Dòng chỉ sang sheet Definitions.

### 6.3 Các sheet còn lại

- **Bookings** (trạng thái · số · Share), **Operations** (Metric · Value): hàng tiêu đề nền thương
  hiệu chữ trắng, canh trái; đóng băng hàng 1.
- **Detail (created this month):** Code (hyperlink tới trang đơn admin, Consolas) · Tour ·
  Departure ends · Travellers · Total · Refunded · Status (nhãn; "Cancelled" chữ màu cost); sọc
  dòng; đóng băng; `autoFilter` tới hàng cuối; hàng Total dùng `SUBTOTAL(109, …)`; giữ luật dòng
  ghi chú của AMEND 2 (vượt trần, lệch tập). Khổ ngang, lặp hàng tiêu đề khi in.
- **Definitions:** tiêu đề, bảy chú giải đánh số, chữ xuống dòng, cột 100.
- Hex trong file dẫn xuất từ token như hiện nay (ADR-0034 AMEND 2); thêm hex của `chart-gain` và
  `chart-cost`.

## 7. Xuất danh sách — Excel thay CSV

### 7.1 Bookings — `nexora-bookings-YYYY-MM-DD.xlsx`

Một sheet "Bookings", hàng tiêu đề ở hàng 1 (bộ lọc), đóng băng, sọc dòng, khổ ngang. Cột:

Booking code (hyperlink) · Status (nhãn admin) · Tour · Departure start · Departure end · Adults ·
Children · Guests · Price per person · Total · Refunded · Currency · Customer · Email · Phone ·
Booked at (Vietnam time) · Paid at (Vietnam time) · Cancelled at (Vietnam time).

- Hàng Total (`SUBTOTAL(109, …)`) cho Guests, Total, Refunded.
- Đầu trang khi in: `&L Nexora back office &C Bookings · {tóm tắt bộ lọc} &R Internal — not for
  distribution`. Tóm tắt bộ lọc: trạng thái, khoảng ngày, từ khoá — hoặc "All bookings".

### 7.2 Subscribers — `nexora-subscribers-YYYY-MM-DD.xlsx`

Email · Source (nguyên văn) · Status (Active · Awaiting confirmation · Unsubscribed) · Subscribed at
· Confirmed at · Unsubscribed at (giờ Việt Nam). Cùng kiểu sheet.

### 7.3 Giữ và gỡ

- **Giữ:** gác quyền, audit, trần 2000 hàng (413, nút tắt kèm tooltip), xuất hàng đã chọn (tối đa
  100, 409 khi lệch), `maxDuration = 60`, `no-store`, hiệu ứng của `ExportButton`.
- **Đổi:** nhãn nút "Export Excel" / "Export {n} row(s)"; content-type spreadsheetml.
- **Gỡ:** `csv.ts`, `bookings-csv.ts`, `subscribers-csv.ts`, `csvExportResponse` và test của chúng.
- Giờ Việt Nam: đổi UTC sang UTC+7 (không có giờ mùa hè) rồi ghi ô ngày-giờ.

## 8. Chữ và token

- Chữ mới vào `@tourism/i18n` (luật 7): namespace `printDoc` cho khung chung và chữ của voucher,
  hoá đơn chờ; `admin.reports.print` cho báo cáo in; nhãn nút xuất ở `admin.bookings` và
  `admin.subscribers`. Dùng lại khoá sẵn có khi trùng nghĩa: nhãn tấm vé
  (`passportVisa.labels.*`), `refundSentence`, `cancellationDeadline.full`, chú giải
  `admin.reports.definitions.*`.
- Token mới ở `@tourism/tokens`: `chart-gain`, `chart-cost`, `pending`, `pending-soft`.

## 9. Kiểm thử

- **Unit, TDD** ở tầng view-model:
  - `voucherPrintView`: bốn giai đoạn, cắt lịch trình một ngày và nhiều ngày, tách giờ hẹn, thiếu
    ảnh, thiếu dữ liệu tour.
  - `receiptPrintView`: đang chờ, đã đóng, bị thu rồi hoàn.
  - Hình học thác nước: thang, lãi âm, nhãn ngắn.
  - Builder Excel đọc lại buffer: tên sheet, `numFmt` có `[$-409]`, hyperlink, `SUBTOTAL`, đầu và
    chân trang, metadata, công thức `REPT`.
  - Route export trả xlsx: content-type, tên file, 413 và 409 giữ nguyên.
- **Component:** cấu trúc DOM của tài liệu in theo biến thể; `PrintedAt` điền giờ ở `beforeprint`.
- **Đo bố cục** bằng Edge headless in PDF — mỗi tài liệu đúng một trang, chữ Việt đúng, không tràn:
  - voucher: bốn giai đoạn × {một ngày, 12 ngày, không ảnh};
  - hoá đơn chờ: {đang chờ, đã đóng, bị thu rồi hoàn};
  - báo cáo: {tháng 9, tháng chưa bắt đầu, lãi âm}.
- **Excel:** mở bằng Excel thật (COM) chụp Summary và Detail; mở trên máy vi-VN để kiểm ngày.
- User duyệt bằng mắt từng phần trước khi merge.

## 10. Thử tay production (sau mỗi phần merge)

1. In voucher của một đơn sắp đi một ngày và một đơn nhiều ngày; xem trước bản in sáng, tối, tắt
   "Background graphics".
2. In voucher đơn đã đi và đơn công ty huỷ.
3. Đặt một đơn rồi huỷ thanh toán ở cổng: in hoá đơn chờ ở `/checkout/cancel`.
4. In `/reports` tháng 9 và tháng hiện tại.
5. Tải Excel báo cáo, mở bằng Excel trên máy tiếng Việt: ngày tiếng Anh, thanh `REPT`, hyperlink.
6. Xuất bookings (có lọc, có chọn hàng) và subscribers: mở bằng bấm đúp, cột đúng, số cộng được.

## 11. Chia phần & thi công

| Phần | Nội dung | App |
| --- | --- | --- |
| 1 | Khung chung (`@tourism/ui`, token), voucher in, hoá đơn chờ in, G37 màn hình | web |
| 2 | Báo cáo tháng in, thác nước | admin |
| 3 | Excel báo cáo D1, hai danh sách Excel, gỡ CSV | admin |

Mỗi phần một nhánh, merge riêng. Không thêm dependency, không migration, không đổi API. Thi công
bằng agent Opus hoặc session riêng; review max; user duyệt bằng mắt trước merge.

## 12. Rủi ro & việc để sau

- **Safari dưới 18.2** không hỗ trợ trang tên: bản in có lề và có thể kèm đầu, chân trang của
  trình duyệt.
- **Ảnh bìa** tải từ Cloudinary: bấm Print ngay khi trang vừa mở có thể in trước khi ảnh về —
  ảnh để `loading="eager"`, khổ ảnh vừa đủ in (rộng 1400 px).
- **Tên tour rất dài** hay **nơi đến nhiều điểm**: cắt theo §3.4; đo trong ma trận §9.
- **In từ điện thoại:** cùng khổ A4, không có bố cục riêng.
- **Excel trên máy không có Calibri, Cambria, Consolas** (LibreOffice): font thay thế, bố cục giữ.
