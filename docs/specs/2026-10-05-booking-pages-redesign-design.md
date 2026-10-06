# Spec P7 — Thiết kế lại ba trang đơn của khách: chi tiết đơn, voucher, My bookings

- **Ngày:** 2026-10-05 · **Trạng thái:** thiết kế duyệt qua wireframe trong chat cùng ngày
  (vòng v2 trang chi tiết; voucher phương án 1 cùng mảng trái "A"; danh sách giữ dáng cũ, lọc
  "cách 1", phân trang "kiểu 3"). User duyệt spec 05/10; Phần A thi công và review 06/10.
- **Quyết định kiến trúc:** [ADR-0054](../adr/0054-customer-bookings-list-phase-filters.md)
- **Nền:** [ADR-0041](../adr/0041-single-cancellation-deadline.md) (một hạn chót mỗi chuyến,
  `vietnamToday`) · [mobile-booking-handoff.md](../handoff/mobile-booking-handoff.md) (cụm P
  cùng ý đếm ngược) · bản vẽ đã duyệt:
  [booking-detail.src.html](../design/mockups/booking-detail.src.html),
  [booking-voucher.src.html](../design/mockups/booking-voucher.src.html),
  [booking-list.src.html](../design/mockups/booking-list.src.html)
- **Đóng:** đơn REFUNDED còn ngày đi tương lai hiện ở nhóm "sắp đi"; voucher mở lại vẫn bắn
  pháo giấy và in câu cũ; đơn đã huỷ vẫn hiện mã vạch kèm "Show this code"; đơn thứ 51 trở đi
  không tới được; trang chi tiết có hai thẻ `h1`.

## 1. Mục tiêu & phạm vi

### Vấn đề

- **Chi tiết đơn** (`/account/bookings/[code]`): khung trên là một thẻ "visa" hẹp
  (`max-w-3xl`), form review nằm dưới phải cuộn mới thấy. Chuyến sắp đi không có số ngày còn
  lại, không có gì nhắc chuẩn bị. Link quay lại ghi "← Passport" và trỏ về `/account`.
- **Voucher** (`/checkout/success?code=`): dáng hoá đơn phổ thông (ReUI Receipt 1). Mở lại
  về sau vẫn "Booking confirmed", vẫn "email đang tới đường", vẫn pháo giấy.
- **My bookings** (`/account/bookings`): không lọc, không tìm; "Load more" chạm trần 50 đơn;
  chia nhóm trên lát vừa tải nên sang lát mới thì thứ tự cũ xáo lại.

### Trong phạm vi

- Một luật giai đoạn đơn dùng chung (ADR-0054 §1).
- `bookings.mine` thêm lọc theo thời gian và trạng thái, tìm, thứ tự hành trình, số đếm
  (ADR-0054 §2–3).
- `ContentHero` thêm nút quay lại dạng icon cạnh breadcrumb.
- Chi tiết đơn: vé kiểu boarding pass, thanh hành trình có mốc "Today", hai cột; cột phải đổi
  theo giai đoạn (review, đếm ngược và chuẩn bị, ngày trong chuyến, hoàn tiền).
- Voucher: thẻ chia đôi, mảng teal; phân biệt vừa trả tiền và mở lại; đổi theo giai đoạn;
  bản in mới.
- My bookings: giữ dáng thẻ xổ; hàng tìm và lọc; 10 đơn mỗi trang; phân trang "Previous /
  Next".

### Ngoài phạm vi, cố ý

- Email nhắc trước ngày đi — user để sau.
- App mobile — thành viên khác dựng theo handoff cụm P.
- Trang tour bấm Reserve làm mất ngày đã chọn (thiếu `?departure=`) — sửa ở nhánh fix riêng.
- Nút Sort, ô tìm ⌘K, cột lọc bên trái, "Add to calendar" — đã cân nhắc ở wireframe, không
  chọn.
- Trang Passport (`/account`) chuyển sang `bookingPhase` — việc sau (mục 12).
- Trang huỷ thanh toán vẫn dùng `BookingReceipt` hiện có.

## 2. Luật hiển thị

### 2.1 Giai đoạn đơn

Mọi trang của đợt này đọc giai đoạn qua `bookingPhase` (ADR-0054 §1) với `today` là ngày lịch
Việt Nam do server tính (`vietnamToday`). Không trang nào so ngày bằng đồng hồ máy khách.

| Giai đoạn | Ý nghĩa với khách |
| --- | --- |
| `awaiting_payment` | Đã giữ chỗ, chưa trả tiền |
| `upcoming` | Đã trả, chưa tới ngày đi |
| `on_tour` | Đang trong chuyến |
| `travelled` | Đã đi xong |
| `cancelled` | Đã huỷ hoặc đã hoàn đủ |
| `lapsed` | Giữ chỗ không trả kịp, đã qua hạn chót (ADR-0054 §1, sửa 06/10) |

### 2.2 Thanh hành trình

Năm mốc, theo thứ tự:

1. **Booked** — ngày tạo đơn.
2. **Paid** — `paidAt`. Đơn chưa trả ghi "Awaiting payment".
3. **Free cancellation** — `cancellation.deadline` (đơn chưa trả đọc `cancellationDeadline`).
   Còn hạn ghi "Until {ngày}"; quá hạn ghi "Ended {ngày}" và tô mờ như mốc đã qua.
4. **Departure** — ngày đi; qua rồi thì ghi "Departed".
5. **Trip ends** — ngày về; qua rồi thì ghi "Trip ended".

- **Trạng thái mốc:** mốc có ngày ≤ hôm nay là xong, trừ hai mốc: Free cancellation chỉ xong
  khi đã QUA ngày chót (hạn hết 23:59 giờ Việt Nam), Trip ends chỉ xong ở giai đoạn `travelled`
  (ngày về khách vẫn đang đi). Mốc chưa xong đầu tiên là "đang tới", các mốc sau là "chưa tới".
  Mốc Paid của đơn chưa trả giữ nhãn "Paid", dòng phụ "Awaiting payment" (plan, quyết định 10).
- **Nhãn "Today":** nằm trên vạch nối, giữa mốc xong cuối cùng và mốc kế tiếp, vị trí theo tỷ
  lệ số ngày. Chỉ hiện ở `awaiting_payment`, `upcoming`, `on_tour`.
- **Chip góc phải:**

  | Giai đoạn | Chip |
  | --- | --- |
  | `upcoming` | "Departs in {n} days" ("Departs tomorrow" khi n = 1) |
  | `on_tour` | "Day {d} of {D}" |
  | `travelled` | "Completed" |
  | `awaiting_payment` | "Awaiting payment" |

- **Biến thể `cancelled`:** bốn mốc Booked → Paid (nếu có) → Cancelled (ngày `cancelledAt` —
  mọi đường huỷ đều ghi nó; không có thì `cancellationDecidedAt`, rồi `cancellationRequestedAt`,
  không có nữa thì bỏ ngày) → Refund (số tiền gọn theo `refundSummary`: "$147.00", "$73.50 of
  $147.00", "No refund due"). Đơn chưa từng thu tiền thì không có mốc Paid và mốc Refund. Chip
  "Cancelled" (plan, quyết định 9).
- **Biến thể `lapsed`:** hai mốc, Booked → "Payment not completed"; không có chip.
- **Điện thoại:** thanh ngang thành danh sách dọc; "Today" thành một dòng chen giữa hai mốc.

### 2.3 Đếm ngược và ngày trong chuyến

Tính trên ngày lịch (chuỗi `YYYY-MM-DD`), không tính giờ.

- `upcoming`: n = ngày đi − hôm nay (n ≥ 1). n = 1 thì ghi "Tomorrow".
- `on_tour`: d = hôm nay − ngày đi + 1, D = ngày về − ngày đi + 1.

### 2.4 Khối "Get ready" (giai đoạn `upcoming`)

Đầu khối là số ngày còn lại cỡ lớn và dòng "Departs {ngày} · {điểm đến}". Sau đó là các bước
đánh số 01, 02…; bước nào thiếu dữ liệu thì bỏ, các bước sau đánh số lại.

1. **Free cancellation** — chữ của `cancellationDeadlineText` hiện có: còn hạn hay đã hết hạn.
2. **Budget for what's not included** — mục `excluded` của tour, mỗi mục một ô tích. Trạng
   thái tích lưu `localStorage` theo mã đơn, chỉ trên máy này; ghi chú "Tick them off — saved
   on this device." Không có `excluded` thì bỏ bước.
3. **Pickup on {thứ ngày}** — `meetingPoint` của tour, in nguyên văn. Không có thì bỏ bước.
4. **Day 1 · {tiêu đề ngày 1}** — mô tả ngày 1 in nguyên văn (`white-space: pre-line`), cắt
   còn 4 dòng, kèm link "Full itinerary" tới `/tours/{slug}#itinerary`. Không tách giờ ra
   thành dữ liệu (luật của catalog).

Chân khối: "Your review opens after the trip ends on {ngày về}."

Dữ liệu tour lấy bằng `fetchTourDetail(slug)` có sẵn (cache 300 giây, tag `tour:<slug>`). Tour
đã gỡ (trả null) thì chỉ còn bước 1.

### 2.5 Cột phải trang chi tiết, theo giai đoạn

| Giai đoạn | Nội dung |
| --- | --- |
| `awaiting_payment` | Số tiền phải trả và các nút sẵn có của `BookingActions` (Pay now, huỷ giữ chỗ) |
| `upcoming` | Khối "Get ready" (2.4) |
| `on_tour` | "Day {d} of {D}", lịch trình đúng ngày đó in nguyên văn, điểm hẹn, "Need help today? Contact us" |
| `travelled` | Khu review hiện tại giữ nguyên mọi trạng thái `reviewSlot`; slot `hidden` thì thay bằng lời cảm ơn và "Browse tours" |
| `cancelled` | Ghi chú kết thúc của `bookingView`, chữ hoàn tiền của `refundSummary`, "Browse tours" |
| `lapsed` | "This booking wasn't paid in time." và "Browse tours" |

### 2.6 Voucher: vừa trả tiền và mở lại

- **Vừa trả tiền:** đơn PAID và `paidAt` cách lúc render không quá 30 phút (đồng hồ server
  web). Tiêu đề "Your day in {nơi} is booked." (chuyến 1 ngày) hoặc "Your trip to {nơi} is
  booked." (nhiều ngày). Có pháo giấy, vẫn một lần mỗi tab như hiện nay.
- **Mở lại:** tiêu đề "Your trip voucher", dòng phụ "Booked on {ngày} · a copy went to
  {email}", không pháo giấy.
- `{nơi}` là điểm đến đầu tiên của tour; tour không có điểm đến thì dùng tên tour.

Phần còn lại của voucher đổi theo giai đoạn:

| Giai đoạn | Ô mã và mã vạch | Dòng điều kiện | Nhật ký chuyến |
| --- | --- | --- | --- |
| `upcoming` | có | Show this code at pickup · hạn huỷ · giá đã gồm thuế phí | Booked and paid ✓ · Free cancellation ends · Pickup day |
| `on_tour` | có | Show this code at pickup · giá đã gồm thuế phí | Booked and paid ✓ · Trip started ✓ · Trip ends |
| `travelled` | có, không có mã vạch | giá đã gồm thuế phí | Booked and paid ✓ · Travelled ✓ · Write a review (hoặc Reviewed ✓) |
| `cancelled` | không; thay bằng dải "This booking was cancelled — this voucher is no longer valid." | — | Booked ✓ · Cancelled ✓ · Refund {trạng thái} |

PARTIALLY_REFUNDED là đơn còn hiệu lực: đi theo giai đoạn của nó, mục Receipt overview thêm
dòng "Refunded −{số tiền}".

Thiết kế mới chỉ áp cho đơn đã có `paidAt`. Mọi đơn chưa trả — PENDING đang xác nhận lẫn đơn
CANCELLED chưa từng trả (giữ chỗ hết hạn) — giữ nguyên hoá đơn hiện tại (`BookingReceipt`,
`CheckoutAutoRefresh`). Ba chi tiết chốt theo mã (plan, quyết định 11):

- **Sắp đi mà đã quá hạn huỷ:** bỏ dòng điều kiện hạn huỷ (dấu tích cạnh "đã hết hạn" đọc như
  quyền lợi); mốc nhật ký thành "Free cancellation ended" ✓.
- **"Write a review" chỉ cho PAID** — cổng `checkReviewEligibility` của API chỉ nhận PAID. Đơn
  PAID đã viết thì "Reviewed" ✓; PARTIALLY_REFUNDED chưa viết thì nhật ký còn hai mốc.
- **Dòng phụ lúc vừa trả** là "…and a copy is on its way to {email}." — email xác nhận đi qua
  outbox nên lúc trang render có thể chưa gửi.

### 2.7 Danh sách đơn

- **Thứ tự:** luôn theo hành trình (ADR-0054 §3): đang đi → sắp đi → đã đi.
- **10 đơn mỗi trang.** Hàng đầu của mỗi trang mở sẵn như hiện nay.
- **Lọc When** (chọn nhiều): On tour now · Upcoming · Past trips.
- **Lọc Status** (chọn nhiều): các trạng thái có số đếm > 0, cộng những trạng thái đang chọn.
  Nhãn lấy từ `booking.list.status`.
- **Tìm:** theo mã đơn, tên tour, tên điểm đến, không phân biệt dấu (ADR-0054 §3).
- **Số đếm** cạnh mỗi lựa chọn là tổng tĩnh trên mọi đơn của khách.
- **Trạng thái lọc nằm trên URL:** `?q=…&when=upcoming,past&status=paid&page=2`. Giá trị lạ
  thì bỏ qua. `page` vượt quá số trang thì chuyển về trang cuối.

## 3. Contract & API

Chi tiết quyết định ở ADR-0054 §2–3. Phần dưới là những gì đổi trong code.

- **`libs/shared/contract`:**
  - file mới `schemas/booking-phase.ts`: `bookingPhase`, `bookingWhen` (giai đoạn sang nhóm),
    `tripDayNumbers` (n, d, D của mục 2.3);
  - `BookingsListQuerySchema` thêm `when`, `q`, `order`; `status` nhận một giá trị hoặc mảng;
  - output mới `BookingsListResultSchema` = khuôn phân trang cộng `facets` và `overallTotal`;
  - route `bookings.mine` đổi output sang schema mới.
- **`apps/api` `BookingsService.mine`:** đọc tập khoá nhẹ, gắn giai đoạn, lọc, đếm, xếp, cắt
  trang, rồi nạp đủ dòng cho các id của trang bằng `bookingTourInclude` và lô ảnh bìa hiện có.
  Hàm bỏ dấu cho `q` là hàm thuần có test riêng.
- **Người gọi cũ:** Passport gọi như cũ (`order` mặc định `recent`), nhận thêm hai trường không
  dùng tới.
- **Không đổi DB, không migration.**

## 4. Web — phần dùng chung

### 4.1 `ContentHero` thêm `back`

Prop tuỳ chọn `back?: { href: string; label: string }`. Có prop thì hero vẽ một nút tròn icon
mũi tên trước breadcrumb: `aria-label` và `title` là `label`, viền trắng mờ trên nền tối. Mười
bảy chỗ đang dùng hero không truyền `back` nên giữ nguyên.

| Trang | Nút quay lại |
| --- | --- |
| Chi tiết đơn | `/account/bookings`, "Back to My bookings" |
| My bookings | `/account`, "Back to Passport" |

Bỏ hai link chữ "← Passport" nằm dưới hero.

### 4.2 Helper thuần mới ở `apps/web/src/lib` (mỗi hàm một test)

| Hàm | Làm gì |
| --- | --- |
| `journeyMilestones(booking, today)` | Các mốc, trạng thái từng mốc, vị trí nhãn "Today", chip (mục 2.2) |
| `getReadySteps(booking, tour, today)` | Số ngày còn lại và danh sách bước đã bỏ bước thiếu dữ liệu (mục 2.4) |
| `paymentProviderLabel(provider)` | Tên cổng thanh toán cho khách đọc, dùng chung cho biên nhận, vé, voucher (`lib/booking-vm.ts`) |
| `voucherView(booking, now, today)` | Vừa trả hay mở lại, tiêu đề, dòng điều kiện, nhật ký (mục 2.6) |
| `bookingsListParams(searchParams)` / `bookingsListHref(params)` | Đọc và dựng URL danh sách |
| `pagerView(params, totalPages, total, limit)` | Chữ và link của phân trang, giữ bộ lọc trên link (mục 7.4; plan, quyết định 17) |

Các dòng tiền (2 người lớn × đơn giá…) đang tính trong `BookingReceipt`: tách thành
`bookingPriceLines` ở `lib/checkout.ts` để trang chi tiết, voucher và trang huỷ dùng chung.
Mã vạch trang trí dùng lại `ticketBarcodeWidths` có sẵn ở cùng file (plan, quyết định 2–3).
Tiền định dạng theo CẢ ĐƠN (review 06/10): đơn giá chẵn thì đơn giá, các dòng và tổng in không
số lẻ như cũ; đơn giá có xu (giá khuyến mãi) thì cả ba in đủ hai số lẻ. Làm tròn riêng từng dòng
thì các dòng cộng không ra tổng, và tổng lệch số cổng thanh toán đã thu.

### 4.3 Mộc và màu

- Mộc dùng lại `VisaStamp` (nghiêng 4°, viền trong gạch đứt, mực loang).
- Mảng teal của voucher và dải màu trên vé dùng `bg-primary` với `text-primary-foreground`.
  Token `primary-emphasis` chỉ dành cho chữ (JSDoc `tokens.mjs`: "KHÔNG dùng cho `bg-*`"); ở chế
  độ tối nó là teal sáng, chữ trắng trên đó chỉ đạt khoảng 1,8:1. Ở chế độ sáng hai token cùng
  màu nên giao diện không đổi so với bản vẽ. Không thêm mã màu hex (luật CLAUDE.md #6; plan,
  quyết định 12).

## 5. Web — trang chi tiết đơn

Bản vẽ: [booking-detail.src.html](../design/mockups/booking-detail.src.html).

### 5.1 Khung

- Hero giữ breadcrumb "Booking", tiêu đề là tên tour, meta là mã đơn, thêm nút quay lại.
- Nội dung rộng `max-w-7xl`, lề ngang khớp hero để mép vé thẳng hàng với tiêu đề.
- Từ trên xuống: vé, thanh hành trình, rồi hai cột `minmax(0,1.08fr) minmax(0,1fr)` (trái là
  thông tin đơn, phải là khối theo giai đoạn).
- Điện thoại: một cột theo thứ tự vé → thanh hành trình → khối theo giai đoạn → thông tin đơn.
- Mốc màn hình (plan, quyết định 13): lề ngang khớp hero (`xl:px-32`) nên ở khổ 1280 nội dung
  chỉ còn 1024px — vé nằm ngang từ `xl`, dưới đó xếp dọc như điện thoại; thanh hành trình nằm
  ngang từ `md`; hai cột từ `lg`.

### 5.2 Vé kiểu boarding pass

- **Ba phần ngang:** ảnh bìa tour (`tourImage`, không có ảnh thì bỏ cột) · thân vé · cuống vé.
- **Ranh giới thân và cuống:** đường gạch đứt có hai vết khuyết nửa tròn ở mép trên và mép
  dưới. Vết khuyết che luôn đường viền ngang của vé (đã sửa ở wireframe).
- **Thân vé:**
  - dải màu trên ghi "Entry · Tour booking" và mã đơn;
  - mộc trạng thái góc phải;
  - tên tour (thẻ `h2`, hero giữ `h1` duy nhất) và link "View tour";
  - hàng DEPARTS → RETURNS: ngày cỡ lớn chữ mono ("03 NOV"), dưới là "Tue · 2026"; giữa là
    icon xe và "{D} day(s) · {điểm đến}";
  - bốn ô: Lead traveller · Travellers · Booked · Paid with.
- **Cuống vé:** dải "Admit {tổng số khách}", "Total paid" (đơn chưa trả ghi "Total"), số tiền,
  "Taxes and fees included", mã vạch (chỉ khi đơn còn hiệu lực và đã trả), mã đơn.
- **Điện thoại:** xếp dọc — ảnh 16:9, thân vé, cuống vé; đường xé nằm ngang, vết khuyết ở hai
  mép trái phải.

### 5.3 Cột trái: thông tin đơn

Bốn khối, theo kiểu ReUI Bookings 3:

1. **Lead traveller:** chữ cái đầu tên, họ tên, email, số điện thoại nếu có.
2. **Payment:** các dòng tiền và tổng. Có hoàn thì thêm dòng "Refunded −{số tiền}". Dưới là
   dòng "Paid in full by {cổng} on {ngày}" kèm ghi chú chế độ thử hiện có.
3. **Cancellation:** chữ của `cancellationDeadlineText` và ghi chú cũ nếu có. Đơn đã huỷ thì
   bỏ khối này (cột phải đã nói).
4. **Details:** Meeting point (khi có dữ liệu tour), Special requests (không có thì "None"),
   ngày đặt.

Hàng nút ở đáy:

- bên trái: "Cancel booking" khi `bookingView` cho phép (mở hộp huỷ sẵn có, gửi kèm số tiền
  khách vừa đọc như hiện nay);
- bên phải: "Contact us" và "View voucher" (giai đoạn `upcoming`, `on_tour`, `travelled`);
- đơn chưa trả: nút trả tiền nằm ở cột phải, không lặp ở đây.

### 5.4 Cột phải

Theo bảng mục 2.5. Khu review chỉ đổi chỗ, không đổi linh kiện, chữ hay luật hiện có.

## 6. Web — voucher

Bản vẽ: [booking-voucher.src.html](../design/mockups/booking-voucher.src.html).

### 6.1 Khung

- Hero giữ breadcrumb "Voucher", tiêu đề là tên tour, thêm meta là mã đơn, giữ nút Print ở góc
  phải.
- Dưới hero là một thẻ bo góc `max-w-7xl`: cột trái co giãn, cột phải 440px mảng teal.

### 6.2 Cột trái (cách "A")

- Mộc trạng thái ở góc phải, cùng hàng với tiêu đề (cột trái chỉ còn khoảng 584px ở khổ 1280
  vì lề khớp hero, đặt mộc nổi sẽ đè chữ — plan, quyết định 13).
- Tiêu đề và dòng phụ theo mục 2.6. Tiêu đề tab trình duyệt là "Voucher — Nexora" (trang mở
  lại được cả khi đơn đã huỷ).
- Thẻ ảnh lớn: ảnh bìa tour, lớp tối mờ dần ở đáy; trên đó là dòng nhỏ "{nơi} · {D} day(s)",
  tên tour, tổng tiền đã trả, và hai chip kính mờ (ngày đi, "{số khách} × {đơn giá}").
- Bốn ô có icon, lưới 2×2:
  - **Meeting point** — dữ liệu tour; tour đã gỡ thì ghi "Details are in your confirmation
    email.";
  - **Paid with {cổng}** — ngày trả, ghi chú chế độ thử;
  - **Lead traveller** — họ tên, email;
  - **Need help?** — "Reply to the confirmation email, or contact us."

### 6.3 Cột phải (mảng teal)

- Ô mã đơn: dùng lại `CopyCodeButton` hiện có. Dưới là ngày đi và "Admit {n}", rồi các dòng
  điều kiện có dấu tích và mã vạch (theo bảng mục 2.6).
- Receipt overview: các dòng tiền, tổng đã trả, dòng đã hoàn nếu có.
- Trip journal: ba mục theo giai đoạn.
- Nút trắng "View booking", dưới là link "Browse more tours".

### 6.4 Điện thoại, trang không tìm thấy, bản in

- **Điện thoại:** một cột. Ô mã đơn bản gọn hiện ngay dưới tiêu đề (khách mở voucher ở điểm
  đón cần thấy mã ngay); mảng teal xuống cuối và giấu ô mã của nó.
- **Không tìm thấy đơn:** nút "My bookings" trỏ đúng `/account/bookings` (hiện trỏ `/account`).
- **Bản in:** giấu navbar, hero, footer và mọi nút; thẻ in hết khổ, không ngắt trang giữa thẻ;
  mảng teal in nền trắng viền teal, chữ mực tối cho đỡ mực (kể cả khi in từ giao diện tối);
  mã vạch in đen; cột phải hẹp còn 17rem để khổ A4 (~718px) vẫn giữ hai cột. Giấu phần ngoài
  thẻ bằng `body:has([data-slot="voucher"])` thay vì gắn `print:hidden` vào linh kiện dùng chung.
  Quy tắc in cũ của biên nhận giữ cho trang huỷ.

## 7. Web — My bookings

Bản vẽ: [booking-list.src.html](../design/mockups/booking-list.src.html).

### 7.1 Khung

Hero thêm nút quay lại; meta "{overallTotal} trips". Nội dung giữ `max-w-5xl`.

### 7.2 Hàng tìm và lọc

- **Ô tìm:** "Search tour or booking code". Gõ xong 300 ms thì áp, Enter thì áp ngay; có chữ thì
  hiện nút ✕ để xoá.
- **Hai nút lọc When và Status** (kiểu faceted filter của shadcn/ui):
  - viền gạch đứt 1px, icon ⊕;
  - chọn một giá trị thì hiện vạch ngăn và nhãn giá trị; chọn từ hai trở lên thì "{n}
    selected";
  - đang mở menu thì chỉ đổi nền nhạt.
- **Menu:** mỗi dòng là ô tích, nhãn, số đếm. Có lựa chọn đang chọn thì chân menu có "Clear
  filters" (xoá riêng nút đó).
- **Nút "Reset":** dạng ghost, chỉ hiện khi đang lọc hoặc đang tìm.
- **Cỡ cố định:** mọi ô và nút cao 36px; hai nút lọc cùng rộng 176px, dù đã chọn hay chưa; ô
  tìm rộng 290px.
- **Điện thoại:** ô tìm chiếm cả hàng đầu; hai nút lọc chia đôi hàng hai; Reset chỉ còn icon.
- Lọc và tìm thay URL bằng `router.replace` (không làm dài lịch sử) và đưa `page` về 1.

### 7.3 Danh sách

- Dòng "{total} trips"; đang lọc hoặc tìm thì "{total} of {overallTotal} trips".
- `BookingAccordion` giữ nguyên; dòng phụ "In N days" và "Ends {ngày}" đọc từ `bookingPhase`.
  Đơn `lapsed` (chờ trả quá hạn chót) mang nhãn "Payment not completed", tông mờ, không có Pay
  now (review 06/10).
- Ô "Total paid" trong phần xổ ghi "Total" khi đơn chưa trả.
- Lọc ra không có đơn nào: "No trips match" · "Try another search or clear the filters." · nút
  Reset.
- Khách chưa có đơn nào: giữ trạng thái trống hiện có.

### 7.4 Phân trang "Previous / Next"

Chỉ hiện khi có từ 2 trang. Một hàng ba phần, kẻ vạch ở trên:

| Bên trái | Giữa | Bên phải |
| --- | --- | --- |
| "← Previous" về trang trước; trang 1 thì mờ, không bấm được | "Page {p} of {P} · trips {a}–{b} of {total}" | "Next", dòng nhỏ "Trips {c}–{d}", nút tròn mũi tên; trang cuối thì không có |

Link giữ nguyên các tham số lọc, là link thường (vào lịch sử trình duyệt). Nhãn "Previous /
Next" thay "Newer / Older trips" của bản vẽ (user chốt 06/10): thứ tự hành trình xếp chuyến sắp
đi từ gần tới xa, nên ở đoạn ấy "Older" dẫn tới chuyến đi xa hơn. Sang trang thì tiêu điểm về
dòng "Page … of …" để trình đọc màn hình đọc trang mới.

### 7.5 Gỡ

Logic `chunk`, link "Load more" và chuỗi `accountBookings.loadMore`. `BOOKINGS_MAX_LIMIT` giữ
nếu Passport còn dùng.

## 8. Chữ

Mọi chữ khách thấy là tiếng Anh, nằm trong `@tourism/i18n` (luật CLAUDE.md #7). Plan chốt tên
khoá; nhóm chữ mới:

| Nhóm | Chữ |
| --- | --- |
| Quay lại | Back to My bookings · Back to Passport |
| Vé | Entry · Tour booking · Departs · Returns · {n} day / {n} days · Admit {n} · Total paid · Total · Taxes and fees included |
| Hành trình | Trip journey · Booked · Paid · Awaiting payment · Free cancellation · Until {date} · Ended {date} · Departure · Departed · Trip ends · Trip ended · Today · Departs in {n} days · Departs tomorrow · Day {d} of {D} · Completed · Cancelled · Payment not completed |
| Get ready | Get ready · {n} days to go · Tomorrow · Budget for what's not included · Tick them off — saved on this device. · Pickup on {date} · Full itinerary · Your review opens after the trip ends on {date}. |
| Đang đi | Today's plan · Need help today? Contact us |
| Thông tin đơn | Lead traveller · Payment · Cancellation · Details · Meeting point · Special requests · None · Questions about this trip? |
| Voucher | Your day in {place} is booked. · Your trip to {place} is booked. · Your trip voucher · Booked on {date} · a copy went to {email} · Booking code · Show this code at pickup — printed or on your phone. · Receipt overview · Trip journal · Pickup day · Trip started · Travelled · Write a review · Reviewed · Browse more tours · Details are in your confirmation email. · This booking was cancelled — this voucher is no longer valid. |
| Danh sách | Search tour or booking code · When · Status · On tour now · Upcoming · Past trips · Reset · Clear filters · {n} selected · {n} trips · {n} of {total} trips · No trips match · Try another search or clear the filters. · Previous · Next · Page {p} of {P} · trips {a}–{b} of {total} · Trips {c}–{d} |
| Khác | This booking wasn't paid in time. · Thanks for travelling with us. |

Chữ đã có thì dùng lại: tên trạng thái, hạn huỷ, hoàn tiền, review, chế độ thử.

## 9. Đối chiếu Nexora (luật 10)

Các bản ghi trong `docs/analysis/` không có mục riêng cho ba trang này. Ghi chung về tầng dữ
liệu web (`2026-07-31-web-data-layer-parity-nexora.md`): Nexora phân trang ở client sau khi tải
100 dòng; v2 lọc và phân trang ở server, xếp loại **v2 tốt hơn**. Không có tính năng Nexora nào
bị mất.

## 10. Kiểm thử

TDD trên logic thuần, ≥80% trên logic mới. Xong việc thì chạy `pnpm gate:int`.

- **Contract:**
  - `booking-phase.spec.ts`: đủ năm trạng thái nhân với ngày trước, trong, sau chuyến; mốc
    biên đúng hôm nay; PARTIALLY_REFUNDED là đơn còn hiệu lực; PENDING quá ngày đi thành
    `lapsed`;
  - `BookingsListQuerySchema`: `status` một giá trị và mảng, `when` hợp lệ và không hợp lệ,
    `q` bị trim và giới hạn 80 ký tự, `order` mặc định `recent`.
- **API (int, `bookings.int.spec.ts`):**
  - thứ tự `journey` liền mạch qua hai trang;
  - lọc `when` với đơn đặt quanh hôm nay;
  - lọc nhiều `status`;
  - `q` khớp mã (có và không có `BK-`), tên tour, tên điểm đến có dấu khi gõ không dấu;
  - `facets` đếm bỏ qua bộ lọc; `overallTotal`;
  - không truyền tham số mới thì kết quả như cũ;
  - 401 khi chưa đăng nhập.
- **Web, hàm thuần:** mọi hàm của mục 4.2 và helper dòng tiền tách ra.
- **Web, linh kiện:**
  - `ContentHero` có và không có `back`;
  - hàng tìm và lọc: chọn lựa chọn thì đổi URL và đưa `page` về 1; Reset;
  - phân trang: trang đầu, trang giữa, trang cuối;
  - khối Get ready bỏ bước thiếu dữ liệu;
  - voucher: vừa trả, mở lại, đã huỷ;
  - cập nhật các spec hiện có (`passport.spec.tsx`, `booking-receipt`, `success-celebration`,
    `itinerary-panel` nếu chạm).

## 11. Thử tay trên production (sau merge, từng bước)

Làm từng bước, user báo xong mới sang bước kế.

1. **My bookings, tài khoản có từ 11 đơn:** hai trang; "Next" sang trang 2 mà thứ tự không
   xáo; "Previous" quay lại.
2. **Lọc:** When = Upcoming; thêm Status; Reset; số đếm đúng; URL giữ khi bấm Back.
3. **Tìm:** "hanoi", "ha noi", mã đơn có và không có `BK-`.
4. **Chi tiết một đơn sắp đi:** vé, thanh hành trình có "Today", số ngày, Get ready, tích một
   mục rồi tải lại trang.
5. **Chi tiết một đơn đã đi:** form review ở cột phải, gửi được như cũ.
6. **Chi tiết một đơn đã huỷ:** biến thể huỷ của thanh hành trình, chữ hoàn tiền.
7. **Voucher vừa trả tiền:** đặt một chuyến bằng thẻ thử Stripe; tiêu đề "is booked", pháo
   giấy.
8. **Voucher mở lại** từ "View voucher" sau 30 phút: "Your trip voucher", không pháo giấy.
9. **Bản in voucher:** xem trước bản in của trình duyệt.
10. **Điện thoại:** ba trang ở bề rộng 375px.

## 12. Rủi ro và việc để sau

- **Thời gian:** còn 10 ngày tới freeze 15/10, đợt sửa admin còn đang thi công. Plan chia ba
  phần, mỗi phần merge được riêng:
  - A: helper giai đoạn, API, trang danh sách;
  - B: trang chi tiết;
  - C: voucher.
- **Thử tay giai đoạn `on_tour`** cần một đơn có ngày đi bao trùm hôm thử; BK-KJZXKJU2 (5–7/10)
  sẽ hết hạn trước khi merge.
- **Trang Passport** vẫn tự phân loại đơn (`passport.ts`) và đọc 50 đơn theo `recent`; chuyển
  sang `bookingPhase` để sau.
- **Lịch trình:** mobile (P5) tô sáng theo giờ trong mô tả; web in nguyên văn, không tách giờ.
- **Ô tích "Budget for…"** chỉ nhớ trên một máy.
- **Ngưỡng 30 phút:** khách mở lại trong 30 phút sau khi trả vẫn thấy tiêu đề "is booked" —
  chấp nhận.
- **Thứ tự cột trên điện thoại** (khối giai đoạn lên trước thông tin đơn) khác thứ tự đọc của
  DOM; trình đọc màn hình vẫn đọc trái trước phải sau.
