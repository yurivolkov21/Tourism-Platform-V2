# Bàn giao cụm đặt tour mobile (P5b-3) — đặt chỗ · thanh toán · chuyến của tôi

> Viết cho thành viên dựng màn. Như P5b-2: **chỉ có bản vẽ**, người nhận dựng màn và nối
> dữ liệu thật luôn. Đọc [mobile-browse-handoff.md](mobile-browse-handoff.md) trước — luật
> chung, cách đọc bản vẽ và quy ước code nằm ở đó, tài liệu này chỉ nói phần KHÁC.

Bản vẽ: `docs/design/mockups/mobile-booking-screens.src.html` (25 khung) ·
Luật hạn chót và hoàn tiền: [ADR-0041](../adr/0041-single-cancellation-deadline.md) ·
Thanh toán mobile: [ADR-0001 AMEND 1](../adr/0001-tech-stack.md) ·
Khuôn code mẫu: cụm auth trong `apps/mobile/src/features/auth`.

## 1. Bốn luật cứng của cụm chạm tiền

1. **Số tiền và ngày do SERVER tính.** Hạn huỷ (`cancellation.deadline`), còn-trong-hạn
   (`withinDeadline`), số hoàn (`refundAmount`), còn-huỷ-được (`canCancel`) đều đọc từ API.
   Không so ngày bằng giờ máy — giáo viên hay chỉnh đồng hồ khi chấm.
2. **Không để khách trả hai lần.** Booking PENDING đã mang sẵn `checkoutUrl`: mở LẠI đúng
   link đó. Chỉ gọi `bookings.checkout` khi link cũ hỏng hoặc hết hạn. Mọi màn chờ có
   đường "kiểm tra lại", không có nút tạo thanh toán mới.
3. **App không tự kết luận đã trả tiền.** Đóng trình duyệt xong thì HỎI LẠI
   `bookings.byCode` vài lượt giãn dần (2s, 4s, 8s) rồi dừng ở khung B7.
4. **Huỷ phải gửi kèm số tiền khách vừa đọc** (`expectedRefundAmount`). Lệch thì server trả
   `REFUND_AMOUNT_CHANGED`, app đọc lại và hỏi lại — không huỷ với con số khách chưa đồng ý.
5. **Đếm ngược chạy theo giờ SERVER.** Gọi `health.check` một lần lúc mở app, lấy `timestamp`,
   lưu độ lệch so với đồng hồ máy, rồi dùng độ lệch đó cho MỌI phép trừ ngày ở cụm P (P1–P6).
   Giáo viên hay chỉnh đồng hồ máy khi chấm; chỉnh xong màn đếm ngược vẫn phải đúng. Riêng
   trạng thái hạn huỷ thì đọc thẳng `cancellation.withinDeadline` — server đã tính sẵn.

## 2. Việc phải làm trước

- **T0 của P5b-2** (tầng dữ liệu mobile + ADR) phải xong. Mọi endpoint ở đây đều **cần đăng
  nhập**, nên phần nối Better Auth của cụm auth cũng phải chạy thật.
- Thêm `expo-web-browser` (mở trang thanh toán) — dependency mới thì theo đúng nếp
  [ADR-0040](../adr/0040-mobile-app-expo.md) §AMEND 1: ghi vào ADR trước.
- Mở token `success` trong `MOBILE_COLOR_KEYS` (nhãn PAID, hộp đã hoàn tiền).
- Mở token `warning` nếu chưa có trong `MOBILE_COLOR_KEYS` (dải nhắc B2, khung lỗi B9).
- **Thêm BIẾN THỂ cho `TextField`, không sửa kiểu mặc định:** ví dụ prop
  `iconStyle="box"` — icon nằm trong ô vuông 40dp (bo `radius.base × 2`, nền `secondary`,
  icon `primary-emphasis`), ô cao tối thiểu `spacing(15)`, cách dòng `spacing(3)`, ô sai thì
  ô vuông icon cũng đổi sang tông lỗi. Thêm bản `multiline`.
  **Cụm auth của P5b-1 đã xong và giữ nguyên kiểu cũ** (user chốt 21/09): mặc định của
  primitive phải là kiểu cũ, chỉ màn của P5b-3 và P5b-4 truyền prop mới. Sửa xong chạy lại
  test của cụm auth để chắc bốn màn kia không đổi.

## 3. Chia việc đề xuất

| # | Việc | Khung | Phụ thuộc |
| --- | --- | --- | --- |
| W1 | Ba bước đặt tour + lỗi tạo booking | B1–B4, B9 | T0, phiên đăng nhập |
| W2 | Quãng qua trình duyệt và xác nhận | B5–B8 | W1 |
| W3 | Tab Trips: danh sách, rỗng, chặn khi chưa đăng nhập | T1–T3 | T0 |
| W4 | Chi tiết booking (đã trả · chưa trả · đã huỷ) | T4, T5, T8 | W3 |
| W5 | Huỷ booking (trong hạn và quá hạn) | T6, T7 | W4 |
| W6 | Hỏi về chuyến | E1, E2 | T0 |
| W7 | Đồng hồ server + màn bám ngày khởi hành | P1, P2, P6 | W4 |
| W8 | Lịch trình của chuyến đã mua và ngày đang đi | P3, P4, P5 | W7 |

W1 và W3 chạy song song được. W7 làm trước W8 vì W8 dùng lại đồng hồ lệch của W7.

### Cụm P bám ngày khởi hành — luật vào màn

Thẻ chuyến ở tab Trips KHÔNG mở thẳng hoá đơn nữa. Chạm thẻ đi đâu tuỳ trạng thái và ngày:

| Trạng thái | Hôm nay so với đợt | Màn | Ghi chú |
| --- | --- | --- | --- |
| PAID | trước `departureStartDate` | P1 (P2 khi còn ≤ 3 ngày) | màn khách quay lại nhiều nhất |
| PAID | trong khoảng đi–về | P5 | ngày đang chạy = `today − start + 1` |
| PAID | sau `departureEndDate` | P6 | mời viết đánh giá |
| PENDING | bất kỳ | T5 | trả tiền trước đã |
| CANCELLED · REFUNDED · PARTIALLY_REFUNDED | bất kỳ | T8 | |

Hoá đơn T4 luôn ở một chạm nữa, sau nút "Booking details". Lý do đảo thứ tự: khách quay lại
để xem còn mấy ngày và cần mang gì, không phải để đọc lại số tiền.

Cụm P chỉ cần THÊM một lượt đọc `catalog.tours.bySlug` (công khai, cache được) bên cạnh
`bookings.byCode` đã có — **không có endpoint mới, không có cột mới, không có migration**.

## 4. Endpoint cho từng màn

| Màn | Endpoint | Ghi chú |
| --- | --- | --- |
| B1–B4 | — (chỉ dựng dữ liệu) | Đợt lấy từ `catalog.tours.bySlug`; trần nhóm là `maxGroupSize`, ghế còn là `seatsLeft` |
| B4 → B5 | `bookings.create` | Trả `Booking` PENDING kèm `checkoutUrl`. Bốn lỗi: `DEPARTURE_NOT_AVAILABLE` 400 · `SEATS_UNAVAILABLE` 409 · `PARTY_TOO_LARGE` 422 · `CHECKOUT_FAILED` 502 |
| B5, T5 | `bookings.checkout` | CHỈ khi cần link mới. Lỗi `NOT_PENDING` 422 nghĩa là booking đã trả rồi — chuyển thẳng sang B8 |
| B6–B8 | `bookings.byCode` | Đọc `status`: PAID → B8, PENDING → B7 |
| T1 | `bookings.mine` | Phân trang, mới nhất trước. Lọc Upcoming/Past làm ở máy — API chưa có tham số đó |
| T4, T5, T8 | `bookings.byCode` | `BookingDetail` có thêm khối `cancellation` và `review` |
| T6, T7 | `bookings.cancel` | Lỗi: `NOT_CANCELLABLE` 422 · `REFUND_AMOUNT_CHANGED` · `REFUND_FAILED` 502 (booking GIỮ NGUYÊN PAID — câu lỗi không được nói là đã hoàn) |
| T5 (bỏ booking chưa trả) | `bookings.cancelPending` | Nhả ghế ngay, không dính luật hoàn tiền |
| E1 | `enquiries.create` | Có honeypot và trần request phía API |
| P1, P2, P6 | `bookings.byCode` + `health.check` | Mốc rail: `createdAt` · `paidAt` · `cancellation.deadline` · `departureStartDate`. `health.check` chỉ để lấy đồng hồ server (gọi một lần mỗi phiên) |
| P2, P3 | `catalog.tours.bySlug` | `meetingPoint`, `included[]`, `excluded[]`, `policies[]` lọc `kind: 'GENERAL'`, `faqs[]` |
| P4, P5 | `catalog.tours.bySlug` | `itinerary[]`; `description` là chuỗi nhiều dòng "HH:MM — việc", chẻ theo `
` rồi tách ở dấu "—" |
| P6 | `reviews.create` | Chỉ mở khi `booking.reviewedAt === null` (ràng buộc `bookingId` duy nhất) |

## 5. Chữ

Khối `mobile.booking` và `mobile.enquiry` trong `@tourism/i18n` có sẵn phần lớn — đáng chú ý
là ba câu khó viết đã nằm sẵn: `browserHint`, `stillPendingTitle`, `stillPendingBody`.

Khoá mới (ghi rõ ở từng khung trong bản vẽ): nhãn Adults/Children và câu giá trẻ em, tiêu đề
"Payment method" và tên hai cổng, nhãn các dòng bảng tiền, nhãn trạng thái booking, chip lọc
Upcoming/Past, "Finish payment", "I've finished paying", và `authPrompts.tripsGateTitle` /
`tripsGateBody`. Câu lỗi của `bookings.create` và `cancel` **dùng chung với web** — cùng API
thì hai client không được nói hai kiểu.

Riêng cụm P gom vào khối `mobile.trip`: "Departing in" · "Tomorrow" / "Today" · bốn nhãn mốc
("Booking confirmed", "Paid in full", "Free cancellation until {date}", "Departure") · "Get
ready" · "What to bring" · "Packing checklist" · "Ticks are kept on this phone only." ·
"Included in your fare" · "Not included — sort these yourself" · "Show all {n}" · "Good to
know" · "On tour now" · "Day {n} of {total}" · "Today" · "Tomorrow · Day {n}" · "Welcome
back" · "How was it?" · "Write a review" · "Where to next?". **Nội dung tour (đồ mang theo,
mục included/excluded, lịch trình, FAQ) là DỮ LIỆU, không phải chữ i18n** — in nguyên văn,
không dịch, không viết lại trong app.

## 6. Hai thứ cụm P cố tình KHÔNG làm

**Danh sách đồ mang theo dựng từ dữ liệu đang có, không bịa.** DB không có cột "đồ cần mang".
Bản vẽ ghép từ ba nguồn thật: policy `kind: 'GENERAL'` của tour (seed viết sẵn cho cả 30 tour,
kiểu "Pack light — the itinerary changes hotels three times"), `excluded[]` (bảo hiểm, tiền
tip, bữa ngoài lịch trình — đúng là thứ khách phải tự lo), và `included[]` (thứ khỏi lo).
Muốn một danh sách biên tập hẳn hoi thì phải thêm cột `packingList String[]` vào `Tour` —
việc đó cần ADR + migration + ô nhập ở admin P4, **để sau, đừng tự thêm giữa đợt này**.
Ô tích của khách lưu `AsyncStorage` theo mã booking: ghi chú riêng của máy, không phải dữ
liệu đơn hàng, nên API không có và cũng không nên có chỗ chứa.

**Theo dõi vị trí thật (GPS) — đã cân, KHÔNG làm.** Ý hay nhưng không có gì đỡ:

- Bảng `destinations` chỉ có `slug`, `name`, `country`, `region`, `description` —
  **không có toạ độ**. Cả schema không có lat/lng ở đâu cả, nên không chấm được một điểm
  thật nào lên bản đồ.
- Không có nguồn vị trí: hướng dẫn viên không có app, không có bảng lưu toạ độ theo thời
  gian, không có kênh realtime (oRPC chạy HTTP thường, Render gói free còn ngủ khi rảnh).
- Làm cho đủ nghĩa là dựng thêm một app cho hướng dẫn viên + quyền vị trí nền + hạ tầng
  realtime. Quá tầm một đợt, và tới buổi bảo vệ thì cái chấm trên bản đồ vẫn là số bịa —
  ngược hẳn với chỗ còn lại của nền tảng (seed thật, luồng tiền thật).

Thứ thay thế đã vẽ (P5) bám **lịch trình** thay vì bám GPS: lịch trình seed đã ghi giờ từng
việc, nên chỉ cần mốc "bây giờ" là màn tự chạy suốt ngày — việc đã qua gạch mờ, việc đang
tới in đậm — mà không cần thêm một byte dữ liệu nào. Muốn có bản đồ sau này thì việc ĐẦU
TIÊN là thêm `latitude`/`longitude` vào `Destination` (ADR + migration + seed 30 tour), rồi
mới tính tới chuyện vẽ tuyến TĨNH của chuyến. Vị trí SỐNG thì vẫn không nên.

## 7. Ba chỗ dễ làm sai

1. **Tổng tiền = đơn giá × TỔNG chỗ.** API không có giá trẻ em riêng (`totalAmount(unitPrice,
   seats)`), nên màn phải nói thẳng "Same price as adults" thay vì để khách tự suy.
2. **Ghế chỉ được giữ sau khi booking đã tạo.** Khách ngồi lâu ở bước 3 rồi mới bấm trả tiền
   thì `SEATS_UNAVAILABLE` là chuyện thường — xử như một nhánh bình thường, không phải sự cố.
3. **Quá hạn vẫn huỷ được, chỉ là không hoàn tiền** (ADR-0041). Đừng khoá nút huỷ; hãy nói
   trước số tiền hoàn là $0 và mở đường liên hệ cho trường hợp bất khả kháng.
