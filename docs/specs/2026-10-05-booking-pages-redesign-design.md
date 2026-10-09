# Spec P7 — Thiết kế lại ba trang đơn của khách: chi tiết đơn, voucher, My bookings

- **Ngày:** 2026-10-05 · **Trạng thái:** thiết kế duyệt qua wireframe trong chat cùng ngày
  (vòng v2 trang chi tiết; voucher phương án 1 cùng mảng trái "A"; danh sách giữ dáng cũ, lọc
  "cách 1", phân trang "kiểu 3"). User duyệt spec 05/10; Phần A thi công và review 06/10.
  Phần B và C thi công 07–08/10, review max 08/10, đợt vá gộp 09/10: các mục dưới đây đã sửa
  theo mã sau đợt vá (luật giai đoạn theo ADR-0054 AMEND 1).
- **Quyết định kiến trúc:** [ADR-0054](../adr/0054-customer-bookings-list-phase-filters.md)
  (AMEND 1 08/10: giai đoạn đọc thêm `cancelledAt` và cờ chuyến bị công ty huỷ)
- **Nền:** [ADR-0041](../adr/0041-single-cancellation-deadline.md) (một hạn chót mỗi chuyến,
  `vietnamToday`) · [mobile-booking-handoff.md](../handoff/mobile-booking-handoff.md) (cụm P
  cùng ý đếm ngược) · bản vẽ đã duyệt:
  [booking-detail.src.html](../design/mockups/booking-detail.src.html),
  [booking-voucher.src.html](../design/mockups/booking-voucher.src.html),
  [booking-list.src.html](../design/mockups/booking-list.src.html)
- **Đóng:** đơn REFUNDED còn ngày đi tương lai hiện ở nhóm "sắp đi" (từ AMEND 1 chỉ đơn huỷ thật
  rời nhóm ấy; REFUNDED hoàn thiện chí trọn cố ý ở lại vì khách vẫn đi); voucher mở lại vẫn bắn
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
- Trang huỷ thanh toán vẫn dùng `BookingReceipt` hiện có cho đơn chưa trả; đơn đã trả thì
  chuyển sang voucher (đợt vá 09/10, mục 6.4).

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
| `cancelled` | Đã huỷ thật (CANCELLED, hay REFUNDED có `cancelledAt`), hoặc chuyến bị công ty huỷ |
| `lapsed` | Giữ chỗ chưa trả, đã qua hạn chót (ADR-0054 §1, sửa 06/10) — chưa phải kết cục |

AMEND 1 của ADR-0054 (08/10), xét từ trên xuống: chuyến bị công ty huỷ (`departureCancelled`,
API đọc `departure.status`) là `cancelled` với mọi trạng thái đơn, kể cả khi job hoàn tiền chưa
chạy; CANCELLED và REFUNDED có `cancelledAt` là `cancelled`; REFUNDED không `cancelledAt` (hoàn
thiện chí trọn, khách vẫn đi) đi theo ngày như PAID. `lapsed`: API thôi mở phiên thanh toán mới
từ hạn chót, nhưng claim của webhook vẫn nhận phiên mở trước hạn, trả xong thì đơn tự sang PAID.

Voucher, mã vạch và mộc trên vé đi theo giai đoạn qua MỘT hàm `bookingPass(booking, phase)`
(`lib/booking-vm.ts`) cho vé, nút "View voucher", voucher và accordion My bookings. Khu review
không theo giai đoạn mà theo `reviewSlot` (mục 2.5).

| Giai đoạn | Voucher | Mã vạch | Mộc |
| --- | --- | --- | --- |
| `upcoming`, `on_tour` | có (khi có `paidAt`) | có (khi có `paidAt`) | chữ theo trạng thái đơn, tông của `bookingView` |
| `travelled` | có (khi có `paidAt`) | không | như trên |
| `awaiting_payment` | không | không | "AWAITING PAYMENT" |
| `cancelled` | không | không | "REFUNDED" khi đơn REFUNDED, còn lại "CANCELLED"; mực xám |
| `lapsed` | không | không | "NOT PAID", mực xám |

### 2.2 Thanh hành trình

Năm mốc, theo thứ tự:

1. **Booked** — ngày tạo đơn.
2. **Paid** — `paidAt`. Đơn chưa trả ghi "Awaiting payment".
3. **Free cancellation** — `cancellation.deadline` (đơn chưa trả đọc `cancellationDeadline`).
   Còn hạn ghi "Until {ngày}"; quá hạn ghi "Ended {ngày}" và tô mờ như mốc đã qua. Còn hạn hay
   không CHỈ theo cờ server `cancellation.withinDeadline` (`freeCancellationOpen`); đơn chờ trả
   luôn "Until". Server không gửi thông tin huỷ (đơn hoàn thiện chí trọn) thì bỏ mốc, thanh còn
   bốn mốc (đợt vá 09/10: trước đó web tự so ngày chót và in "Ended" cho một ngày chưa tới).
4. **Departure** — ngày đi; qua rồi thì ghi "Departed".
5. **Trip ends** — ngày về; qua rồi thì ghi "Trip ended".

- **Ngày của mốc** (đặt, trả, huỷ) là ngày lịch Việt Nam của mốc thời gian (`vietnamDay`), không
  cắt chuỗi ISO theo UTC.
- **Trạng thái mốc:** mốc có ngày ≤ hôm nay là xong, trừ hai mốc: Free cancellation chỉ xong
  khi cờ server nói đã hết hạn (hạn hết 23:59 giờ Việt Nam), Trip ends chỉ xong ở giai đoạn
  `travelled` (ngày về khách vẫn đang đi). Mốc chưa xong đầu tiên là "đang tới", các mốc sau là
  "chưa tới". Mốc Paid của đơn chưa trả giữ nhãn "Paid", dòng phụ "Awaiting payment" (plan,
  quyết định 10).
- **Nhãn "Today":** nằm trên vạch nối, giữa mốc xong cuối cùng và mốc kế tiếp, vị trí theo tỷ
  lệ số ngày. Chỉ hiện ở `awaiting_payment`, `upcoming`, `on_tour`. Tỷ lệ chỉ kẹp trong đoạn;
  từ `md` nhãn kẹp theo px để tâm nhãn cách tâm mỗi mốc ít nhất 48px (không đè icon), vạch tô
  dừng đúng chỗ nhãn (đợt vá 09/10, thay phép kẹp 20% đoạn của plan quyết định 10).
- **Chip góc phải:**

  | Giai đoạn | Chip |
  | --- | --- |
  | `upcoming` | "Departs in {n} days" ("Departs tomorrow" khi n = 1) |
  | `on_tour` | "Day {d} of {D}" |
  | `travelled` | "Completed" |
  | `awaiting_payment` | "Awaiting payment" |

- **Biến thể `cancelled`:** bốn mốc Booked → Paid (nếu có `paidAt`) → Cancelled (ngày theo
  `cancelledOn`: `cancelledAt` — mọi đường huỷ thật đều ghi nó; không có thì
  `cancellationDecidedAt` CHỈ khi yêu cầu huỷ được duyệt, `cancellationStatus` REFUNDED; không có
  nữa thì bỏ ngày) → Refund (số tiền gọn theo `refundSummary`: "$147.00", "$73.50 of $147.00",
  "No refund due"). Đơn chưa từng thu tiền (`wasCharged`: không `paidAt` và chưa hoàn đồng nào)
  thì không có mốc Refund; đơn bị thu rồi hoàn tự động trước khi sang PAID vẫn có. Chip
  "Cancelled" (plan, quyết định 9). Chuyến bị công ty huỷ dùng biến thể này, nên không còn mốc
  Free cancellation; job hoàn tiền chưa chạy thì chưa có mốc Refund (cột phải nói tiền đang về).
- **Biến thể `lapsed`:** hai mốc, Booked → "Payment not completed"; mốc sau là mốc đang đứng
  (`now`), không tô như đã xong; không có chip.
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
   thành dữ liệu (luật của catalog). Link dừng ở dải tab của trang tour với Itinerary đã mở: mỗi
   nút tab mang `id` bằng hash của nó (đợt vá 09/10; trước đó không phần tử nào mang id ấy nên
   trang không cuộn).

Chân khối chỉ cho đơn PAID — cổng review của API chỉ nhận PAID:
"Your review opens on {ngày về}." (cổng mở từ 07:00 giờ Việt Nam của chính ngày về). Đơn hoàn
một phần hay hoàn thiện chí vẫn đi nhưng không viết review được, nên không có chân.

Dữ liệu tour lấy bằng `fetchTourDetailOrNull(slug)` (cache 300 giây, tag `tour:<slug>`; tour đã
gỡ hay API catalog lỗi đều ra null), và CHỈ ở hai giai đoạn cần nó — `upcoming`, `on_tour`
(`needsTourData`); giai đoạn khác không gọi API catalog. Tour null thì chỉ còn bước 1.

### 2.5 Cột phải trang chi tiết, theo giai đoạn

| Giai đoạn | Nội dung |
| --- | --- |
| `awaiting_payment` | Số tiền phải trả và các nút sẵn có của `BookingActions` (Pay now, huỷ giữ chỗ) |
| `upcoming` | Khối "Get ready" (2.4) |
| `on_tour` | "Day {d} of {D}", lịch trình đúng ngày đó in nguyên văn, điểm hẹn, "Need help today? Contact us" |
| `travelled` | Khu review (dưới bảng) là cả cột phải; slot `hidden` thì lời cảm ơn và "Browse tours" |
| `cancelled` | Ghi chú kết thúc theo trạng thái đơn, câu hoàn tiền (`refundSentence` của `refundSummary`), "Browse tours". Chuyến bị công ty huỷ (`cancelledByOperator`): tiêu đề "Departure cancelled", câu "We had to cancel this departure.", rồi "Your full refund is on its way." khi job hoàn tiền chưa chạy (`operatorRefundPending`: đơn còn PAID hay hoàn một phần) hoặc câu số đã hoàn |
| `lapsed` | Tiêu đề "Payment not completed", "This booking wasn’t paid by the deadline.", câu điều kiện "If you started paying before then, finish in that payment window — the booking confirms itself once it goes through.", "Browse tours". Không khẳng định đã lỡ (ADR-0054 AMEND 1 §4) |

**Khu review** đi theo cổng của API (`reviewSlot`), không theo giai đoạn (ADR-0054 AMEND 1 §5):
dựng ở MỌI giai đoạn khi slot khác `hidden` và `tooEarly` (`hasReviewArea`), đứng dưới khối của
giai đoạn — dưới "Today's plan" từ 07:00 giờ Việt Nam ngày về (cổng mở theo ngày UTC), dưới khối
đóng khi đơn đã có review rồi bị hoàn hay huỷ (API vẫn cho sửa, rút). Slot `tooEarly` không dựng
khu review — chân Get ready đã nói ngày mở. Thẻ cảm ơn chỉ cho `travelled` với slot `hidden`.
Trước đợt vá 09/10 khu review chỉ có ở `travelled` (ngày Việt Nam): mất form ~17 giờ mỗi chuyến,
và đơn có review rồi bị hoàn mất đường sửa, rút.

### 2.6 Voucher: vừa trả tiền và mở lại

- **Vừa trả tiền:** đơn PAID, voucher còn hiệu lực (`bookingPass(…).voucher` — đơn trên chuyến
  công ty huỷ không "vừa trả") và `paidAt` cách lúc render không quá 30 phút (đồng hồ server
  web, đọc MỘT lần cho cả phép đo này lẫn ngày hôm nay `vietnamToday(now)`). Tiêu đề "Your day
  in {nơi} is booked." (chuyến 1 ngày) hoặc "Your trip to {nơi} is booked." (nhiều ngày). Có
  pháo giấy, vẫn một lần mỗi tab như hiện nay; `canvas-confetti` chỉ tải khi thật sự bắn.
- **Mở lại:** tiêu đề "Your trip voucher", dòng phụ "Booked on {ngày} · a copy went to
  {email}", không pháo giấy.
- `{nơi}` là điểm đến đầu tiên của tour; tour không có điểm đến thì dùng tên tour.

Phần còn lại của voucher đổi theo giai đoạn:

| Giai đoạn | Ô mã và mã vạch | Dòng điều kiện | Nhật ký chuyến |
| --- | --- | --- | --- |
| `upcoming` | có | Show this code at pickup · hạn huỷ · giá đã gồm thuế phí | Booked and paid ✓ · Free cancellation ends · Pickup day |
| `on_tour` | có | Show this code at pickup · giá đã gồm thuế phí | Booked and paid ✓ · Trip started ✓ · Trip ends |
| `travelled` | có, không có mã vạch | giá đã gồm thuế phí | Booked and paid ✓ · Travelled ✓ · mốc review theo `reviewSlot` (xem dưới) |
| `cancelled` | không; thay bằng dải "This booking was cancelled — this voucher is no longer valid." — chuyến công ty huỷ: "We had to cancel this departure — this voucher is no longer valid." | — | Booked ✓ · Cancelled ✓ (ngày theo `cancelledOn`) · Refund (`refundSentence`; job hoàn tiền của chuyến công ty huỷ chưa chạy: "Your full refund is on its way.") |

Ô mã và mã vạch theo `bookingPass`, mộc cột trái theo `bookingPass(…).stamp` (bảng mục 2.1) —
cùng luật với vé của trang chi tiết đơn: đơn PAID trên chuyến công ty huỷ đóng "CANCELLED",
không "CONFIRMED". Dải "cancelled" nói "We had to cancel…" theo cùng vị từ `cancelledByOperator`
với cột phải trang chi tiết đơn.

PARTIALLY_REFUNDED là đơn còn hiệu lực: đi theo giai đoạn của nó, mục Receipt overview thêm
dòng "Refunded −{số tiền}". REFUNDED không `cancelledAt` (hoàn thiện chí trọn) cũng đi theo
giai đoạn của chuyến (ADR-0054 AMEND 1).

Thiết kế mới chỉ áp cho đơn đã có `paidAt`. Mọi đơn chưa trả — PENDING đang xác nhận lẫn đơn
CANCELLED chưa từng trả (giữ chỗ hết hạn) — giữ nguyên hoá đơn hiện tại (`BookingReceipt`,
`CheckoutAutoRefresh`). Câu dưới tiêu đề hoá đơn theo tâm trạng (`receiptNote`, đợt vá 09/10):
đang xác nhận thì câu chờ; kết cục khác thì kể khoản hoàn nếu đơn từng bị thu (thua đua ghế,
`paidAt` vẫn null), chưa thu thì "There’s nothing left to pay here…" — không còn "A copy of this
receipt was sent to {email}." cho đơn chưa trả. Ba chi tiết chốt theo mã (plan, quyết định 11):

- **Sắp đi mà đã quá hạn huỷ:** bỏ dòng điều kiện hạn huỷ (dấu tích cạnh "đã hết hạn" đọc như
  quyền lợi); mốc nhật ký thành "Free cancellation ended" ✓. Còn hạn hay không chỉ theo cờ
  server; server không gửi thông tin huỷ (đơn hoàn thiện chí trọn) thì không có dòng hạn huỷ lẫn
  mốc hạn huỷ (đợt vá 09/10).
- **Mốc review của `travelled` theo `reviewSlot`** (cùng luật khu review trang chi tiết đơn),
  không theo mốc `reviewedAt`: review đã duyệt hay đang chờ duyệt thì "Reviewed" ✓ kèm ngày viết;
  còn viết được (slot `form` — cổng `checkReviewEligibility` chỉ nhận PAID — hay bị bác còn lượt)
  thì "Write a review"; bị bác hết lượt, đã rút, hay không đủ điều kiện (PARTIALLY_REFUNDED chưa
  viết) thì nhật ký còn hai mốc.
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
| `voucherView(booking, now)` | Vừa trả hay mở lại, tiêu đề, mộc, dòng điều kiện, nhật ký (mục 2.6); hôm nay suy từ `now` |
| `bookingsListParams(searchParams)` / `bookingsListHref(params)` | Đọc và dựng URL danh sách |
| `pagerView(params, totalPages, total, limit)` | Chữ và link của phân trang, giữ bộ lọc trên link (mục 7.4; plan, quyết định 17) |

Đợt vá 09/10 gom các luật B và C từng chép riêng về một chỗ (`lib/booking-vm.ts` trừ khi ghi
khác): `vietnamDay` (ngày lịch Việt Nam của một mốc ISO), `wasCharged` (đã thu tiền: có `paidAt`
hoặc đã hoàn), `refundSentence` (một câu hoàn tiền cho cột phải và voucher), `cancelledOn`,
`freeCancellationOpen`, `bookingPass`, `cancelledByOperator`, `operatorRefundPending`;
`needsTourData` (`lib/get-ready.ts`), `hasReviewArea` (`lib/review.ts`), `voucherMeetingPoint`
(`lib/voucher.ts`), `receiptNote` và `cancelPageRedirect` (`lib/checkout.ts`),
`fetchTourDetailOrNull` (`lib/api/tours.ts`); linh kiện `TicketBarcode` vẽ mã vạch cho hoá đơn,
vé và voucher.

Các dòng tiền (2 người lớn × đơn giá…) đang tính trong `BookingReceipt`: tách thành
`bookingPriceLines` ở `lib/checkout.ts` để trang chi tiết, voucher và trang huỷ dùng chung.
Mã vạch trang trí dùng lại `ticketBarcodeWidths` có sẵn ở cùng file (plan, quyết định 2–3).
Tiền định dạng theo CẢ ĐƠN (review 06/10): đơn giá chẵn thì đơn giá, các dòng và tổng in không
số lẻ như cũ; đơn giá có xu (giá khuyến mãi) thì cả ba in đủ hai số lẻ. Làm tròn riêng từng dòng
thì các dòng cộng không ra tổng, và tổng lệch số cổng thanh toán đã thu.

### 4.3 Mộc và màu

- Mộc dùng lại `VisaStamp` (nghiêng 4°, viền trong gạch đứt, mực loang); chữ và tông theo giai
  đoạn qua `bookingPass(…).stamp` (bảng mục 2.1).
- Chip "Awaiting payment" của thanh hành trình: chữ `accent-foreground` trên `warning` pha 20%
  (cặp của huy hiệu "Almost full") — 7,38:1 sáng, 4,98:1 tối. Icon hạn huỷ đã qua: mực
  `warning-foreground` ở theme sáng, `warning` ở theme tối, vì chưa token mực cảnh báo nào đạt
  3:1 ở cả hai theme (đợt vá 09/10; token gốc là việc của open-items G32).
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
  ngang từ `md`; hai cột từ `lg`. Dưới `lg` lưới khai `grid-cols-1` (= `minmax(0,1fr)`): cột
  ngầm `auto` phình theo thẻ con, email dài không `truncate` được và trang cuộn ngang (đợt vá
  09/10).
- Chữ tự do (Special requests, Meeting point, mô tả ngày, lý do review bị bác) bẻ dòng ở bất kỳ
  đâu (`min-w-0 [overflow-wrap:anywhere]`): chuỗi liền dài từng làm trang 320–375px cuộn ngang.

### 5.2 Vé kiểu boarding pass

- **Ba phần ngang:** ảnh bìa tour (`tourImage` qua `SlotImage`, xin đúng cỡ bằng `sizes`; không
  có ảnh thì bỏ cột) · thân vé · cuống vé.
- **Ranh giới thân và cuống:** đường gạch đứt có hai vết khuyết nửa tròn ở mép trên và mép
  dưới. Vết khuyết che luôn đường viền ngang của vé (đã sửa ở wireframe).
- **Thân vé:**
  - dải màu trên ghi "Entry · Tour booking" và mã đơn;
  - mộc góc phải theo giai đoạn (`bookingPass(…).stamp`, bảng mục 2.1): "NOT PAID" mực xám cho
    `lapsed`, "CANCELLED" cho đơn chưa hoàn trên chuyến công ty huỷ — không còn "AWAITING
    PAYMENT" hay "CONFIRMED" sai giai đoạn;
  - tên tour (thẻ `h2`, hero giữ `h1` duy nhất) và link "View tour";
  - hàng DEPARTS → RETURNS: ngày cỡ lớn chữ mono ("03 NOV"), dưới là "Tue · 2026"; giữa là
    icon xe và "{D} day(s) · {điểm đến}" — dưới `sm` nhãn này xuống một hàng riêng trọn bề
    ngang, hai ngày dạt hai mép (đợt vá 09/10: ở 320–375px nhãn từng bọc 2–6 dòng tràn hộp cao
    30px, ở 320px đè lên chữ ngày);
  - bốn ô: Lead traveller · Travellers · Booked · Paid with. "Paid with" in tên cổng khi tiền đã
    đi một vòng (`wasCharged`), kể cả đơn bị thu rồi hoàn tự động trước khi sang PAID; chưa thu
    thì "Not paid".
- **Cuống vé:** dải "Admit {tổng số khách}", "Total paid" (đơn chưa trả ghi "Total"), số tiền,
  "Taxes and fees included", mã vạch (`bookingPass(…).barcode`: sắp đi, đang đi, đã trả), mã
  đơn.
- **Điện thoại:** xếp dọc — ảnh 16:9, thân vé, cuống vé; đường xé nằm ngang, vết khuyết ở hai
  mép trái phải.

### 5.3 Cột trái: thông tin đơn

Bốn khối, theo kiểu ReUI Bookings 3:

1. **Lead traveller:** chữ cái đầu tên, họ tên, email, số điện thoại nếu có.
2. **Payment:** các dòng tiền và tổng. Có hoàn thì thêm dòng "Refunded −{số tiền}". Dưới là
   dòng "Paid in full by {cổng} on {ngày}" kèm ghi chú chế độ thử hiện có.
3. **Cancellation:** chữ của `cancellationDeadlineText` và ghi chú cũ nếu có. Đơn đã huỷ thì
   bỏ khối này (cột phải đã nói).
4. **Details:** Meeting point (chỉ ở `upcoming`, `on_tour` — `needsTourData`, cùng luật trang
   dùng để quyết có đọc tour — và khi tour có điểm hẹn), Special requests (không có thì
   "None"), ngày đặt.

Hàng nút ở đáy:

- bên trái: "Cancel booking" khi `bookingView` cho phép (mở hộp huỷ sẵn có, gửi kèm số tiền
  khách vừa đọc như hiện nay);
- bên phải: "Contact us" và "View voucher" (theo `bookingPass(…).voucher`: `upcoming`,
  `on_tour`, `travelled` và đã trả);
- đơn chưa trả: nút trả tiền nằm ở cột phải, không lặp ở đây.

### 5.4 Cột phải

Theo bảng mục 2.5. Cột phải có thể xếp HAI khối: khối của giai đoạn rồi khu review (dưới
"Today's plan" ngày về, dưới khối đóng). Khu review có khung thẻ ở mọi khổ (trước đợt vá 09/10
dưới `sm` để trần). Form review (`review-form.tsx`, linh kiện dùng chung) đặt hàng sao và nút gửi
thành một hàng riêng dưới ô chữ ở MỌI khổ, dạt phải, nút xuống dòng khi hẹp; vạch ngăn ẩn khi khung
ô dưới 21rem (D2 của đợt vá). Lý do: slot `pending`, `rejected` từng làm trang 375px cuộn ngang và
cắt nút ở ~1024px, còn ở cột phải từ ~1100px hàng sao đứng cạnh và ép ô chữ còn 14–60px. Chữ và
luật của khu review không đổi.

## 6. Web — voucher

Bản vẽ: [booking-voucher.src.html](../design/mockups/booking-voucher.src.html).

### 6.1 Khung

- Hero giữ breadcrumb "Voucher", tiêu đề là tên tour, giữ nút Print ở góc phải. KHÔNG meta mã
  đơn (user chốt 08/10, D5 của đợt vá): mã đã ở ô mã của thẻ, voucher đã huỷ cố ý giấu mã, và
  voucher vừa trả từng hiện mã ba lần trên một màn.
- Dưới hero là một thẻ bo góc `max-w-7xl`: cột trái co giãn, cột phải 440px mảng teal. Thẻ chia
  đôi từ `xl` và ở MỌI bản in, dưới `xl` một cột; ngưỡng nằm một chỗ ở hai biến thể
  `voucher-split:` / `voucher-stack:` của `globals.css` thay vì cặp `max-xl:` / `print:` rải ở
  nơi gọi.

### 6.2 Cột trái (cách "A")

- Mộc theo giai đoạn (`bookingPass(…).stamp`, bảng mục 2.1) ở góc phải, cùng hàng với tiêu đề
  (cột trái chỉ còn khoảng 584px ở khổ 1280 vì lề khớp hero, đặt mộc nổi sẽ đè chữ — plan,
  quyết định 13).
- Tiêu đề và dòng phụ theo mục 2.6. Tiêu đề tab trình duyệt là "Voucher — Nexora" (trang mở
  lại được cả khi đơn đã huỷ).
- Thẻ ảnh lớn: ảnh bìa tour, lớp tối mờ dần ở đáy; trên đó là dòng nhỏ "{nơi} · {D} day(s)",
  tên tour, tổng tiền đã trả, và hai chip kính mờ (ngày đi, "{số khách} × {đơn giá}"). Ảnh xin
  đúng bề rộng ô ảnh ở từng khổ (`sizes` năm điều kiện) và nạp lười, không `priority`.
- Bốn ô có icon, lưới 2×2:
  - **Meeting point** — chỉ ở `upcoming`, `on_tour` (`VoucherView.showMeetingPoint` =
    `needsTourData`, cùng luật trang chi tiết đơn); trang chỉ đọc tour khi có ô này
    (`voucherMeetingPoint`). Không có điểm hẹn để in (tour đã gỡ, ô trống, API catalog lỗi) thì
    "Contact us for the meeting point — we reply within a day." với link `/contact` (D4: email
    xác nhận không mang điểm hẹn, không được hứa "Details are in your confirmation email.");
  - **Paid with {cổng}** — ngày trả, ghi chú chế độ thử;
  - **Lead traveller** — họ tên, email;
  - **Need help?** — "Reply to the confirmation email, or contact us."
- Voucher đã đi hay đã huỷ còn ba ô (không Meeting point), ô Need help trải trọn hàng.

### 6.3 Cột phải (mảng teal)

- Ô mã đơn: dùng lại `CopyCodeButton` hiện có. Mã không bẻ dòng; thiếu chỗ thì nút chép xuống
  hàng dưới mã. Dưới là ngày đi và "Admit {n}", rồi các dòng điều kiện có dấu tích và mã vạch
  (theo bảng mục 2.6).
- Receipt overview: các dòng tiền, tổng đã trả, dòng đã hoàn nếu có.
- Trip journal: ba mục theo giai đoạn (hai khi mốc cuối không có gì thật để nói). Vạch nối giữa
  hai mốc là viền của phần tử thật (không phải nền `::before`), nên in được cả khi tắt "in nền".
- Nút trắng "View booking" (`ButtonLink` của hệ, chữ 14px), dưới là link "Browse more tours".

### 6.4 Điện thoại, trang không tìm thấy, bản in

- **Dưới `xl` (điện thoại, máy tính bảng):** một cột. Ô mã đơn bản gọn hiện ngay dưới tiêu đề
  (khách mở voucher ở điểm đón cần thấy mã ngay); mảng teal xuống cuối và giấu ô mã của nó.
- **Không tìm thấy đơn:** nút "My bookings" trỏ đúng `/account/bookings` (hiện trỏ `/account`).
- **Bản in:** giấu navbar, hero, footer và mọi nút; thẻ in hết khổ, không ngắt trang giữa thẻ;
  mảng teal in nền trắng viền teal, chữ mực tối cho đỡ mực (kể cả khi in từ giao diện tối);
  mã vạch in đen; cột phải hẹp còn 17rem để khổ A4 (~718px) vẫn giữ hai cột (khai ở khối in của
  `globals.css`). Nền của trang, ô mã và dải huỷ cũng gỡ khi in: in từ giao diện tối có bật
  "in nền" từng ra chữ tối trên nền tối (~1,3:1). Mảng teal đệm ngang cố định 1.5rem khi in để
  mã một dòng ở mọi khổ giấy. Giấu phần ngoài thẻ bằng `body:has([data-slot="voucher"])` thay vì gắn
  `print:hidden` vào linh kiện dùng chung. Quy tắc in cũ của biên nhận giữ cho trang huỷ.
- **Trang huỷ thanh toán** (`/checkout/cancel`): đơn đã trả (trả ở tab khác rồi bấm huỷ ở cổng)
  chuyển sang voucher (`cancelPageRedirect`) thay vì dựng hoá đơn "Payment cancelled" kèm pill
  Paid và mã vạch.

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

- Dòng "{total} trips"; đang lọc hoặc tìm thì "{total} of {overallTotal} trips". Chưa lọc thì
  dòng ấy chỉ còn cho trình đọc màn hình — hero đã in tổng (`87ca93f9`, 08/10).
- `BookingAccordion` giữ nguyên; dòng phụ "In N days" và "Ends {ngày}" đọc từ `bookingPhase`.
  Đơn `lapsed` (chờ trả quá hạn chót) mang nhãn "Payment not completed", tông mờ, không có Pay
  now (review 06/10). Link "View voucher" theo `bookingPass(…).voucher` như trang chi tiết đơn
  (đợt vá 09/10; trước đó chỉ đơn PAID).
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
đi từ gần tới xa, nên ở đoạn ấy "Older" dẫn tới chuyến đi xa hơn. Sang trang bằng hai link này
thì tiêu điểm về dòng đếm ở đầu danh sách mới, kèm câu tóm tắt trang chỉ trình đọc màn hình nghe.

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
| Get ready | Get ready · {n} days to go · Tomorrow · Budget for what's not included · Tick them off — saved on this device. · Pickup on {date} · Full itinerary · Your review opens on {date}. |
| Đang đi | Today's plan · Need help today? Contact us |
| Thông tin đơn | Lead traveller · Payment · Cancellation · Details · Meeting point · Special requests · None · Questions about this trip? |
| Voucher | Your day in {place} is booked. · Your trip to {place} is booked. · Your trip voucher · Booked on {date} · a copy went to {email} · Booking code · Show this code at pickup — printed or on your phone. · Receipt overview · Trip journal · Pickup day · Trip started · Travelled · Write a review · Reviewed · Browse more tours · Contact us · for the meeting point — we reply within a day. · This booking was cancelled — this voucher is no longer valid. · We had to cancel this departure — this voucher is no longer valid. |
| Danh sách | Search tour or booking code · When · Status · On tour now · Upcoming · Past trips · Reset · Clear filters · {n} selected · {n} trips · {n} of {total} trips · No trips match · Try another search or clear the filters. · Previous · Next · Page {p} of {P} · trips {a}–{b} of {total} · Trips {c}–{d} |
| Khác | This booking wasn’t paid by the deadline. · If you started paying before then, finish in that payment window — the booking confirms itself once it goes through. · Departure cancelled · We had to cancel this departure. · Your full refund is on its way. · NOT PAID (mộc) · Thanks for travelling with us. |

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
    biên đúng hôm nay; PARTIALLY_REFUNDED là đơn còn hiệu lực; PENDING quá hạn chót thành
    `lapsed`; AMEND 1: REFUNDED có và không `cancelledAt`, `departureCancelled` thắng mọi
    trạng thái (kể cả PENDING còn trong hạn chót);
  - `BookingsListQuerySchema`: `status` một giá trị và mảng, `when` hợp lệ và không hợp lệ,
    `q` bị trim và giới hạn 80 ký tự, `order` mặc định `recent`.
- **API (int, `bookings.int.spec.ts`):**
  - thứ tự `journey` liền mạch qua hai trang;
  - lọc `when` với đơn đặt quanh hôm nay;
  - lọc nhiều `status`;
  - `q` khớp mã (có và không có `BK-`), tên tour, tên điểm đến có dấu khi gõ không dấu;
  - `facets` đếm bỏ qua bộ lọc; `overallTotal`;
  - không truyền tham số mới thì kết quả như cũ;
  - 401 khi chưa đăng nhập;
  - `departureCancelled` đúng ở `mine` (thứ tự, lọc, `facets`) và `byCode` (AMEND 1).
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
9. **Bản in voucher:** xem trước bản in của trình duyệt, cả từ giao diện tối.
10. **Điện thoại:** ba trang ở bề rộng 375px; đơn đã đi có khu review: khung thẻ, hàng sao và
    nút gửi dưới ô chữ, trang không cuộn ngang.
11. **Chuyến bị công ty huỷ** (thêm sau đợt vá 09/10; seed lượt 1 có sẵn đơn REFUNDED không
    `cancelledAt` trên chuyến CANCELLED): trang chi tiết "Departure cancelled · We had to cancel
    this departure.", không mã vạch; voucher có dải "We had to cancel this departure — this
    voucher is no longer valid.".
12. **Link "Full itinerary"** của Get ready (thêm 09/10): trang tour mở tab Itinerary, dải tab
    nằm ngay dưới navbar (máy bàn và 375px).
13. **`/checkout/cancel?code=` của một đơn đã trả** (thêm 09/10): chuyển sang voucher.
14. **Voucher đã đi hay đã huỷ** (thêm 09/10): ba ô thông tin, không ô Meeting point; hero không
    in mã đơn.

## 12. Rủi ro và việc để sau

- **Thời gian:** còn 10 ngày tới freeze 15/10, đợt sửa admin còn đang thi công. Plan chia ba
  phần, mỗi phần merge được riêng:
  - A: helper giai đoạn, API, trang danh sách;
  - B: trang chi tiết;
  - C: voucher.

  B và C rốt cuộc merge chung một lượt: review max 08/10 thấy nhiều lỗi chung gốc giữa hai
  trang, nên vá gộp trên một nhánh (09/10).
- **Thử tay giai đoạn `on_tour`** cần một đơn có ngày đi bao trùm hôm thử; BK-KJZXKJU2 (5–7/10)
  sẽ hết hạn trước khi merge.
- **Trang Passport** vẫn tự phân loại đơn (`passport.ts`) và đọc 50 đơn theo `recent`; chuyển
  sang `bookingPhase` để sau. Vì vậy nó chưa theo ADR-0054 AMEND 1: đơn còn PAID trên chuyến
  công ty huỷ vẫn là tem sắp đi ở đó trong khoảng chờ job hoàn tiền.
- **Ở `upcoming`, `on_tour`** trang chi tiết đơn và voucher vẫn đọc tour nối đuôi lượt đọc đơn:
  API catalog treo thì trang chờ tới ~62 giây (timeout 20 giây × 3 lượt). Chưa chặn (tour có
  cache 300 giây); cần thì đẩy phần dùng tour vào `<Suspense>` hay chặn bằng `Promise.race`.
  Giai đoạn khác không gọi API catalog (đợt vá 09/10).
- **Hash tab của trang tour là mốc cuộn thật** (đợt vá 09/10): bấm Back về một URL tour mang
  hash của tab thì Chromium đưa khách về dải tab thay vì đúng vị trí cũ (đo 09/10). Đường không
  có hash không đổi.
- **Quán tính Lenis** giành lại vị trí cuộn khi điều hướng mềm trong ~1,2 giây sau một cú lăn
  chuột — lỗi có sẵn toàn site, link "Full itinerary" cũng dính trong khe ấy (open-items G33).
- **Lịch trình:** mobile (P5) tô sáng theo giờ trong mô tả; web in nguyên văn, không tách giờ.
- **Ô tích "Budget for…"** chỉ nhớ trên một máy.
- **Ngưỡng 30 phút:** khách mở lại trong 30 phút sau khi trả vẫn thấy tiêu đề "is booked" —
  chấp nhận.
- **Thứ tự cột trên điện thoại** (khối giai đoạn lên trước thông tin đơn) khác thứ tự đọc của
  DOM; trình đọc màn hình vẫn đọc trái trước phải sau.
