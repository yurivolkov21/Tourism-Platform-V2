# ADR-0054 — Đơn của khách: một luật giai đoạn dùng chung; `bookings.mine` lọc, tìm, xếp theo hành trình và phân trang ở server

- **Trạng thái:** Accepted (2026-10-06; đề xuất 2026-10-05)
- **Sửa đổi:** AMEND 1 (2026-10-08, cuối file) — giai đoạn đọc thêm `cancelledAt` và cờ chuyến
  bị công ty huỷ; REFUNDED do hoàn thiện chí đi theo ngày; `lapsed` không phải kết cục.
- **Bối cảnh thi hành:** đợt thiết kế lại ba trang đơn của khách (P7). Đi trước code theo luật
  CLAUDE.md #5. Thiết kế chốt qua wireframe trong chat ngày 05/10.
- **Liên quan:** [ADR-0041](0041-single-cancellation-deadline.md) (một hạn chót mỗi chuyến,
  `vietnamToday`) · spec
  [2026-10-05-booking-pages-redesign-design.md](../specs/2026-10-05-booking-pages-redesign-design.md)

## Bối cảnh

Sáu sự thật đo được (code ở `main` ngày 05/10, số liệu prod cùng ngày):

1. `bookings.mine` (`GET /api/bookings`) nhận `page` (1–10000), `limit` (1–50, mặc định 12) và
   MỘT `status` tuỳ chọn; service lọc `{ userId, status }`, xếp `createdAt desc, id asc`, cắt
   trang bằng `skip/take` (`bookings.service.ts:682-715`). Không có lọc theo ngày, không có tìm.
2. Trang `/account/bookings` tải `min(chunk × 12, 50)` đơn rồi mới chia nhóm "đang đi → sắp
   đi → đã đi" trên đúng lát vừa tải. Hệ quả: bấm "Load more" làm xáo thứ tự các dòng đã thấy,
   và đơn thứ 51 trở đi không bao giờ hiện.
3. Luật "đơn này đang ở giai đoạn nào" nằm rải ở sáu chỗ trên web (`groupBookingsByTime`,
   dòng phụ của accordion, `departed` của biên nhận, `passport.ts`, `reviewSlot`,
   `itineraryDayState`), API không có chỗ nào. `groupBookingsByTime` xếp đơn REFUNDED còn
   ngày đi ở tương lai vào nhóm "sắp đi".
4. Theo API, PARTIALLY_REFUNDED là đơn **còn hiệu lực**: `isCancellableStatus` nhận cả PAID
   lẫn PARTIALLY_REFUNDED (`booking-cancellation.ts:34`), chuyến vẫn đi.
5. Người gọi `bookings.mine` chỉ có web: trang danh sách đơn và trang Passport (`limit 50`,
   để tính thống kê và mộc). Mobile chưa gọi (màn chuyến của tôi còn là khung trống).
6. Prod 05/10: 707 đơn của 123 khách; khách nhiều nhất có **14** đơn, trung vị 5.

## Quyết định

### 1. Một luật giai đoạn, hàm thuần đặt ở contract

`bookingPhase({ status, departureStartDate, departureEndDate }, today)` đặt cạnh
`vietnamToday` trong `libs/shared/contract`, dùng chung cho API và web. `today` là ngày lịch
Việt Nam, do server tính.

| Giai đoạn | Điều kiện | Nhóm "When" |
| --- | --- | --- |
| `awaiting_payment` | PENDING, hôm nay ≤ hạn chót của chuyến | `UPCOMING` |
| `upcoming` | PAID hoặc PARTIALLY_REFUNDED, ngày đi sau hôm nay | `UPCOMING` |
| `on_tour` | PAID hoặc PARTIALLY_REFUNDED, ngày đi ≤ hôm nay ≤ ngày về | `ON_TOUR` |
| `travelled` | PAID hoặc PARTIALLY_REFUNDED, ngày về trước hôm nay | `PAST` |
| `cancelled` | CANCELLED hoặc REFUNDED, mọi ngày | `PAST` |
| `lapsed` | PENDING, hôm nay sau hạn chót | `PAST` |

Hạn chót là `cancellationDeadline` của ADR-0041 (ngày đi − N) — ngày cuối nhận đặt, và cổng trả
tiền của API đóng cùng mốc (`isWithinDeadline` ở `assertDepartureBookable`). Mốc ngày đi (bản đầu
của ADR này) để lọt một khoảng: đơn chờ trả còn sống qua hạn chót được mời trả tiền mà API từ chối
(review Phần A, 06/10).

Sửa luôn sự thật 3: đơn REFUNDED không còn lọt vào nhóm sắp đi. Ba trang của đợt này đọc
giai đoạn qua hàm này. Trang Passport giữ helper riêng, chuyển sau (xem Hệ quả).

### 2. Hợp đồng `bookings.mine` mở rộng, không phá người gọi cũ

Đầu vào thêm (đều tuỳ chọn):

- `when`: mảng `ON_TOUR | UPCOMING | PAST`;
- `status`: nhận một giá trị như cũ **hoặc** một mảng;
- `q`: chuỗi 1–80 ký tự sau khi trim;
- `order`: `recent` (mặc định, giữ đúng `createdAt desc` cho Passport) hoặc `journey`.

Đầu ra giữ nguyên khuôn phân trang `{ items, page, limit, total, totalPages }`, thêm:

- `facets: { when: Record<When, number>, status: Record<BookingStatus, number> }` — đếm trên
  **toàn bộ** đơn của khách, bỏ qua mọi bộ lọc và từ khoá;
- `overallTotal` — tổng đơn của khách, không lọc (cho dòng "N trips" ở hero).

`total` và `totalPages` tính SAU khi lọc.

### 3. Lọc và xếp ở service trên tập khoá nhẹ của chính khách

Mỗi lệnh `mine`:

1. Đọc tập khoá nhẹ của TOÀN BỘ đơn của khách: `id`, `code`, `status`, `createdAt`, ngày đi,
   ngày về, tên tour, tên các điểm đến.
2. Gắn giai đoạn bằng `bookingPhase(…, vietnamToday())`, đếm `facets`, lọc theo `when`,
   `status`, `q`.
3. Xếp theo `order`, cắt trang.
4. Nạp đủ dữ liệu cho đúng các id của trang bằng include và lô ảnh bìa có sẵn.

`q` khớp mã đơn (không phân biệt hoa thường, có hay không có tiền tố `BK-`), tên tour (snapshot
`tour_title` của đơn) và tên điểm đến, sau khi cả hai phía qua cùng một khoá: bỏ dấu, hạ chữ
thường, bỏ mọi ký tự không phải chữ hoặc số ("ha noi", "hanoi" và "Hà Nội" đều thành `hanoi`).

Thứ tự `journey`: `on_tour` theo ngày đi tăng dần, rồi `upcoming` và `awaiting_payment` theo
ngày đi tăng dần, rồi nhóm `PAST` theo ngày đi giảm dần. Hoà thì xếp `createdAt desc`, rồi
`id`.

### 4. Web: 10 đơn mỗi trang, trạng thái nằm trên URL, không có nút Sort

Trang danh sách gọi `order: 'journey'`, `limit: 10`. Bộ lọc, từ khoá và số trang nằm trên URL
(`?when=upcoming&status=paid&q=hanoi&page=2`). Nút phân trang ghi "Previous / Next" (user chốt
06/10, thay "Newer / Older trips" của bản vẽ: thứ tự hành trình xếp chuyến sắp đi từ gần tới xa,
nên ở đoạn ấy "Older" dẫn tới chuyến đi xa hơn). Trang KHÔNG có nút Sort.

## Hệ quả

- Một luật giai đoạn cho API và web; số đếm, bộ lọc và thứ tự luôn khớp nhau ở mọi trang.
- Thứ tự không còn xáo khi sang trang; đơn thứ 51 trở đi tới được.
- Mỗi lệnh `mine` đọc toàn bộ đơn của một khách (dạng nhẹ). Với 14 đơn là nhiều nhất hôm nay
  thì không đáng kể; ngưỡng cần đổi cách làm là hàng nghìn đơn mỗi khách.
- Service có hai thứ tự (`recent`, `journey`) trong cùng một đường code.
- Trang Passport vẫn đọc `limit 50` theo `recent` và còn helper riêng (`passport.ts`); chuyển
  nó sang `bookingPhase` là việc sau, ghi ở spec mục Rủi ro.

## Phương án đã loại

- **Lọc ở web trên 50 đơn tải về:** giữ nguyên trần 50 và chuyện xáo thứ tự; số đếm sai khi
  khách có hơn 50 đơn.
- **Viết luật giai đoạn bằng `CASE` trong SQL:** luật nằm hai nơi (TypeScript và SQL), khó
  test, và bỏ dấu tiếng Việt cần extension `unaccent` mà DB chưa bật.
- **Phân trang con trỏ:** không trả lời được "Page 1 of 2".
- **Cho khách tự chọn cách xếp:** thêm một nút và một trục nữa cho danh sách vài chục đơn;
  thứ tự hành trình đã đặt việc khách cần lo lên đầu.
- **Số đếm theo các bộ lọc đang chọn:** con số nhảy theo từng cú bấm; với vài chục đơn mỗi
  khách, tổng tĩnh dễ hiểu hơn.

## AMEND 1 08/10 — giai đoạn đọc thêm "đơn đã huỷ thật" và "chuyến bị công ty huỷ"

Phát hiện ở vòng review max P7 phần B và C (08/10), xác minh bằng đọc mã và test tạm.

**Bối cảnh.** Bảng §1 suy giai đoạn chỉ từ trạng thái đơn và hai ngày của chuyến. Ba chỗ lệch:

- REFUNDED không chỉ là kết cục huỷ. Admin hoàn thiện chí TRỌN (`refundByAdmin`) đặt REFUNDED
  mà không ghi `cancelledAt`, không nhả ghế: khách vẫn đi (`docs/conventions/booking-states.md`).
  Bảng §1 xếp mọi REFUNDED vào `cancelled`, nên cả ba trang gọi một chuyến còn đi là "Cancelled",
  giấu đếm ngược, voucher, và trang chi tiết mất luôn khu review (sửa, rút).
- Chuyến bị công ty huỷ (ADR-0041 AMEND 1): trong khoảng chờ job `departure-refund`, đơn vẫn PAID
  mà chuyến không chạy, nên trang chi tiết và voucher hiện như chuyến còn chạy (`open-items`, mục
  web của AMEND 1). Dữ liệu seed lượt 1 lại mô hình chuyến công ty huỷ bằng REFUNDED,
  `cancelledAt` null, chuyến CANCELLED, và chuyến seed không có `cancelled_at`.
- `lapsed` không phải kết cục chắc chắn. Mint và re-mint phiên thanh toán đóng ở hạn chót, nhưng
  claim của webhook vẫn nhận phiên mở TRƯỚC hạn (Stripe tới 60 phút, PayPal tới 3 giờ — ADR-0041
  §3). Câu "cổng trả tiền của API đóng cùng mốc" ở §1 chỉ đúng cho mint.

**Quyết định.**

1. `Booking` của contract thêm `departureCancelled: boolean`, API đọc từ `departure.status ===
   'CANCELLED'` — theo trạng thái chuyến, không theo mốc, vì chuyến seed không có `cancelled_at`.
2. `BookingPhaseInput` thêm `cancelledAt` (ISO hoặc null; mọi đường huỷ thật ghi cột này) và
   `departureCancelled`. Bảng §1 đổi hai dòng, thứ tự xét từ trên xuống:

   | Giai đoạn | Điều kiện |
   | --- | --- |
   | `cancelled` | chuyến bị công ty huỷ (mọi trạng thái đơn); hoặc CANCELLED; hoặc REFUNDED có `cancelledAt` |
   | `upcoming` · `on_tour` · `travelled` | PAID, PARTIALLY_REFUNDED, hoặc REFUNDED không `cancelledAt` (hoàn thiện chí), theo ngày như cũ |

   Hai dòng `awaiting_payment` và `lapsed` giữ nguyên mốc hạn chót.
3. `bookings.mine` đọc thêm hai trường vào khoá lọc (`BookingListKey`); luật vẫn một bản ở contract.
4. `lapsed` giữ mốc, nhưng chữ của web nói có điều kiện: ai đã mở trang thanh toán trước hạn thì
   hoàn tất ở đó, trả xong đơn tự sang PAID. Không khẳng định "đã lỡ".
5. Những thứ đi theo giai đoạn ở web — voucher, mã vạch, mộc trên vé — đọc qua MỘT hàm thuần cạnh
   `bookingPhase` (web), không vị từ riêng trong JSX của từng trang. Khu review đi theo
   `reviewSlot` (cổng của API), không theo giai đoạn.

**Hệ quả.** Đơn hoàn thiện chí sắp đi có lại đếm ngược, Get ready, voucher và mã vạch; đơn đã đi
giữ khu review. Đơn trên chuyến công ty huỷ thành `cancelled` ngay cả khi job hoàn tiền chưa chạy,
web in câu "công ty huỷ chuyến, tiền đang hoàn" — đóng mục web của ADR-0041 AMEND 1 trong
`open-items`. Seed lượt 1 hiển thị đúng mà không cần seed lại. Mobile chưa gọi `bookingPhase`;
trường mới chỉ thêm vào, không phá người đọc cũ.

**Phương án đã loại.** Chỉ dựa `cancelledAt`: chuyến seed lượt 1 bị huỷ thành `travelled` tới
lượt seed lại (~03/11). Sửa bộ sinh seed rồi seed lại ngay: đụng dữ liệu prod trước bảo vệ, và
vẫn không phủ khoảng chờ job của ADR-0041 AMEND 1. Cột mốc `departureCancelledAt`: chuyến seed
không có `cancelled_at`.
