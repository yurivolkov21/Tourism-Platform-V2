# ADR-0054 — Đơn của khách: một luật giai đoạn dùng chung; `bookings.mine` lọc, tìm, xếp theo hành trình và phân trang ở server

- **Trạng thái:** Proposed (2026-10-05)
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
| `awaiting_payment` | PENDING, ngày đi sau hôm nay | `UPCOMING` |
| `upcoming` | PAID hoặc PARTIALLY_REFUNDED, ngày đi sau hôm nay | `UPCOMING` |
| `on_tour` | PAID hoặc PARTIALLY_REFUNDED, ngày đi ≤ hôm nay ≤ ngày về | `ON_TOUR` |
| `travelled` | PAID hoặc PARTIALLY_REFUNDED, ngày về trước hôm nay | `PAST` |
| `cancelled` | CANCELLED hoặc REFUNDED, mọi ngày | `PAST` |
| `lapsed` | PENDING, ngày đi ≤ hôm nay | `PAST` |

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

`q` khớp mã đơn (không phân biệt hoa thường, có hay không có tiền tố `BK-`), tên tour và tên
điểm đến, sau khi bỏ dấu và hạ chữ thường cả hai phía ("ha noi", "hanoi" và "Hà Nội" đều khớp
tour Hà Nội).

Thứ tự `journey`: `on_tour` theo ngày đi tăng dần, rồi `upcoming` và `awaiting_payment` theo
ngày đi tăng dần, rồi nhóm `PAST` theo ngày đi giảm dần. Hoà thì xếp `createdAt desc`, rồi
`id`.

### 4. Web: 10 đơn mỗi trang, trạng thái nằm trên URL, không có nút Sort

Trang danh sách gọi `order: 'journey'`, `limit: 10`. Bộ lọc, từ khoá và số trang nằm trên URL
(`?when=upcoming&status=paid&q=hanoi&page=2`). Nút phân trang ghi "Newer trips / Older
trips", hai nhãn chỉ đúng khi danh sách xếp theo hành trình, nên trang KHÔNG có nút Sort.

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
- **Cho khách tự chọn cách xếp:** "Newer / Older trips" sai nghĩa khi xếp theo giá hay ngày
  đặt.
- **Số đếm theo các bộ lọc đang chọn:** con số nhảy theo từng cú bấm; với vài chục đơn mỗi
  khách, tổng tĩnh dễ hiểu hơn.
