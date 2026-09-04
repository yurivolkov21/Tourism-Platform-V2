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
với một booking được trả tiền nhưng vẫn đi tour. Vì vậy approve-cancellation
đặt `CANCELLED` **tường minh**, không đi qua `deriveStatusAfterRefund`.

## Năm ngữ nghĩa terminal

| Flow | Status cuối | Ledger | Ghế | Vì sao |
| --- | --- | --- | --- | --- |
| **Approved cancellation** (W4: khách xin hủy booking PAID, admin duyệt) | `CANCELLED` + `cancelledAt` | 0..1 row — số tiền do BẬC CHÍNH SÁCH quyết (ADR-0030); **0 row** ở HAI ca: sổ đã settle từ trước (ADR-0029 §2), hoặc bậc cho 0% vì yêu cầu gửi sát ngày khởi hành (§AMEND 3). Cả hai đều KHÔNG gọi gateway — sổ append-only chỉ kể tiền thật sự đi | **Trả lại** (`seats_booked -= party`) — BẤT KỂ hoàn bao nhiêu | Khách chủ động thôi đi tour — chuyến đi kết thúc. Tiền đã trả nằm trọn trong ledger; status kể chuyện ghế/chuyến đi, không kể chuyện tiền. CancellationRequest → `REFUNDED` (enum của model — "resolved by refund"). |
| **Overbooked claim** (W2: thanh toán xong nhưng thua cuộc đua ghế) | `CANCELLED` + `cancelledAt` | 1 row full (adminId NULL = tự động) | Không đụng (chưa từng giữ) | Booking chưa bao giờ rời PENDING thành doanh thu, chưa bao giờ giữ ghế — hủy + hoàn là trạng thái đúng. |
| **Orphaned capture** (W2/W3: capture đến SAU khi booking đã CANCELLED) | `REFUNDED` (derive từ ledger) | 1 row full (adminId NULL) | Không đụng (CANCELLED chưa giữ ghế) | Tiền thật đã vào trên một booking đã chết → câu chuyện còn lại thuần về tiền; ledger derive ra terminal `REFUNDED` trung thực. |
| **Admin goodwill refund full** (W3: `admin.bookings.refund` không qua cancellation) | `REFUNDED` (derive từ ledger) | 1..n rows cộng dồn đến total | **KHÔNG trả ghế** | Khách VẪN đi tour — refund thiện chí không hủy chuyến. Trả ghế là đặc quyền của flow cancellation (W4). |
| **PENDING hết hạn / bỏ hoang / khách tự hủy** (ADR-0006: PAY-1 webhook `payment.expired` · WRK-1 cron TTL 65′ · BK-2 `bookings.cancelPending`) | `CANCELLED` + `cancelledAt` | KHÔNG có row (chưa charge) | Không đụng (PENDING chưa từng giữ ghế) | Booking chưa trả tiền, chưa rời PENDING thành doanh thu. Cả ba đường gate `status='PENDING'` nên idempotent với nhau. Không refund. |

(`PARTIALLY_REFUNDED` không terminal: ledger chưa đủ total, khách vẫn đi tour.)

**Ca thêm từ ADR-0029 §3 — `CANCELLED` mà ledger CÒN DƯ.** Approve với mức hoàn
một phần (bậc chính sách 50% hoặc 25%) để lại đúng trạng thái ấy: chuyến đã
huỷ, ghế đã trả, nhưng sổ chưa cộng đủ `total_amount`. Phần dư đó **vẫn hoàn
tiếp được** qua `admin.bookings.refund` — trước ADR-0029 nó là ngõ cụt 422.

⚠️ Khi hoàn nốt trên một booking `CANCELLED`, status **GIỮ NGUYÊN `CANCELLED`**,
KHÔNG chạy `deriveStatusAfterRefund`. Hàm ấy chỉ biết kể chuyện tiền; áp nó lên
một booking đã huỷ là ghi đè travel story bằng money story — khách hết huỷ,
`cancelled_at` mồ côi, và ghế đã nhả thì không ai đọc ra được nữa.

## Hệ quả cho code

- `deriveStatusAfterRefund` chỉ dành cho các flow **refund-only** (admin refund,
  orphaned capture). Approve-cancellation và overbook set `CANCELLED` cứng.
- Chỉ W4 approve được release ghế, và chỉ bằng single-statement
  `UPDATE tour_departures SET seats_booked = seats_booked - party WHERE id = …
  AND seats_booked >= party` (CHECK `departures_seats_nonneg` là backstop).
- Một booking `CANCELLED` có thể có ledger đầy (đã hoàn đủ) — đọc "đã hoàn bao
  nhiêu" LUÔN từ ledger, đừng suy từ status.
