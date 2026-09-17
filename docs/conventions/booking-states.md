# Quy ước trạng thái terminal của Booking

Chốt ở P2-W4 (design của lead, spec P2 §2 D1 + §4). Một chỗ duy nhất trả lời
câu hỏi "booking đã kết thúc thì mang status gì?" — code lệch doc này thì sửa
doc, nhưng sửa SAU khi đã đọc lý do bên dưới.

## Nguyên tắc: hai câu chuyện, hai nơi ghi

- **Refund ledger (`refunds`)** ghi **câu chuyện tiền**: mỗi row là một lần
  tiền thật đi ra, append-only, `SUM(amount)` so với `total_amount` là sự thật.
- **`Booking.status`** ghi **câu chuyện ghế/chuyến đi**: khách còn đi tour hay
  không. Nó là projection đọc-nhanh, KHÔNG phải nguồn sự thật về tiền.

Cancellation ≠ refund-only: một booking bị hủy (hết đi tour, ghế trả lại) khác
với một booking được trả tiền nhưng vẫn đi tour. Vì vậy lõi huỷ (`cancelInLock`
trong `cancellations.service.ts`) đặt `CANCELLED` **tường minh**, không đi qua
`deriveStatusAfterRefund`.

## Năm ngữ nghĩa terminal

| Flow | Status cuối | Ledger | Ghế | Vì sao |
| --- | --- | --- | --- | --- |
| **Khách tự huỷ** (ADR-0041: khách bấm Cancel trên booking `PAID` hoặc `PARTIALLY_REFUNDED`, ngày hôm nay theo giờ Việt Nam còn trước ngày khởi hành) | `CANCELLED` + `cancelledAt` | 0..1 row — **1 row bằng trọn phần còn lại** khi huỷ TRONG hạn chót của chuyến; **0 row** ở hai ca: huỷ SAU hạn chót (hoàn `0.00`, không gọi cổng thanh toán), hoặc sổ đã settle từ trước. Sổ append-only chỉ kể tiền thật sự đi | **Trả lại** (`seats_booked -= party`) — BẤT KỂ hoàn bao nhiêu | Khách chủ động thôi đi tour — chuyến đi kết thúc. Tiền đã trả nằm trọn trong ledger; status kể chuyện ghế/chuyến đi, không kể chuyện tiền. `CancellationRequest` sinh ra ở trạng thái `REFUNDED` NGAY (không qua `REQUESTED`), `decided_by` = chính chủ booking — contract phơi ra thành `decidedByCustomer: true` để admin đọc được "ai huỷ" mà không cần join |
| **Overbooked claim** (W2: thanh toán xong nhưng thua cuộc đua ghế) | `CANCELLED` + `cancelledAt` | 1 row full (adminId NULL = tự động) | Không đụng (chưa từng giữ) | Booking chưa bao giờ rời PENDING thành doanh thu, chưa bao giờ giữ ghế — hủy + hoàn là trạng thái đúng. |
| **Orphaned capture** (W2/W3: capture đến SAU khi booking đã CANCELLED) | `REFUNDED` (derive từ ledger) | 1 row full (adminId NULL) | Không đụng (CANCELLED chưa giữ ghế) | Tiền thật đã vào trên một booking đã chết → câu chuyện còn lại thuần về tiền; ledger derive ra terminal `REFUNDED` trung thực. |
| **Admin goodwill refund full** (W3: `admin.bookings.refund` không qua cancellation) | `REFUNDED` (derive từ ledger) | 1..n rows cộng dồn đến total | **KHÔNG trả ghế** | Khách VẪN đi tour — refund thiện chí không hủy chuyến. Trả ghế là đặc quyền của flow cancellation (W4). |
| **PENDING hết hạn / bỏ hoang / khách tự hủy** (ADR-0006: PAY-1 webhook `payment.expired` · WRK-1 cron TTL 65′ · BK-2 `bookings.cancelPending`) | `CANCELLED` + `cancelledAt` | KHÔNG có row (chưa charge) | Không đụng (PENDING chưa từng giữ ghế) | Booking chưa trả tiền, chưa rời PENDING thành doanh thu. Cả ba đường gate `status='PENDING'` nên idempotent với nhau. Không refund. |

(`PARTIALLY_REFUNDED` không terminal: ledger chưa đủ total, khách vẫn đi tour.)

**Ca `CANCELLED` mà ledger CÒN DƯ.** Từ ADR-0041 nó đến từ MỘT nguồn duy nhất
thay vì bậc chính sách: khách huỷ SAU hạn chót. Chuyến đã huỷ, ghế đã trả,
nhưng sổ không cộng thêm đồng nào — `total_amount` nằm nguyên bên công ty. Phần
dư đó **vẫn hoàn tiếp được** qua `admin.bookings.refund` (gate mở cho
`CANCELLED` từ ADR-0029 §3, trước đó là ngõ cụt 422), và từ ADR-0041 §5 đây là
**đường ngoại lệ chính thức**: mọi ca "luật nói không hoàn nhưng ta vẫn muốn
hoàn" đi qua hoàn thiện chí, có số tiền và lý do ghi vào sổ, không có bậc nào
để tranh cãi.

⚠️ Khi hoàn nốt trên một booking `CANCELLED`, status **GIỮ NGUYÊN `CANCELLED`**,
KHÔNG chạy `deriveStatusAfterRefund`. Hàm ấy chỉ biết kể chuyện tiền; áp nó lên
một booking đã huỷ là ghi đè travel story bằng money story — khách hết huỷ,
`cancelled_at` mồ côi, và ghế đã nhả thì không ai đọc ra được nữa.

## Hệ quả cho code

- `deriveStatusAfterRefund` chỉ dành cho các flow **refund-only** (admin refund,
  orphaned capture). Lõi huỷ và overbook set `CANCELLED` cứng.
- Chỉ lõi huỷ được release ghế, và chỉ bằng single-statement
  `UPDATE tour_departures SET seats_booked = seats_booked - party WHERE id = …
  AND seats_booked >= party` (CHECK `departures_seats_nonneg` là backstop).
- Một booking `CANCELLED` có thể có ledger đầy (đã hoàn đủ) — đọc "đã hoàn bao
  nhiêu" LUÔN từ ledger, đừng suy từ status.
- **Không còn trạng thái chờ.** App không sinh `CancellationRequest` nào ở
  `REQUESTED` hay `DENIED` nữa; mỗi lần huỷ là đúng một dòng `REFUNDED`. Dòng cũ
  hai loại kia còn trên prod tới lượt seed lại (spec 15/09 §10 bước 6) và vẫn
  hiện dạng chỉ đọc trong lịch sử booking.
- **Ngày so bằng giờ Việt Nam.** "Chuyến đã đi chưa" và "còn trong hạn chót
  không" đều đo bằng `vietnamToday(now)` ở Node, `vietnamDateSql` ở SQL
  (ADR-0009 AMEND 3). Không dùng UTC, không dùng đồng hồ trình duyệt.
- **Một lõi cho hai người gọi.** `cancelInLock` hôm nay chỉ có đầu vào
  `initiator: 'customer'`; nút "Cancel departure" của P4e-1 sẽ thêm
  `'operator'` vào chính lõi ấy chứ không viết đường thứ hai — đó là lý do lõi
  nhận `decidedById` và `refundAmount` làm tham số thay vì tự đi tìm.
