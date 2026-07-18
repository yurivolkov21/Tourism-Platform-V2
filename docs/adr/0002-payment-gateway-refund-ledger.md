# ADR-0002 — PaymentGateway interface, Refund ledger, và atomic claim thế hệ 2

- **Trạng thái:** Accepted (2026-07-18, cùng merge P2)
- **Bối cảnh:** spec P2 + schema audit (H1/H2/H4, M7) + Nexora ADR-0006/0009

## Quyết định

**1. `PaymentGateway` interface thay enum+branching.** Nexora inject thẳng
`StripeService`/`PayPalService` và rẽ nhánh if/else; v2 chuẩn hóa
`createCheckoutSession / verifyWebhook / refund` sau một interface + DI token,
FakeGateway cho test, impl thật đăng ký theo env. Thêm rail mới = thêm một
adapter. Cả hai impl viết raw trên seam `HttpPost` injectable — **không thêm
SDK dependency** (test offline được chữ ký/mapping; tôn trọng freeze 15/10).

**2. `Refund` ledger append-only là nguồn sự thật về tiền.**
`Booking.status` là projection: refund-only flows derive từ `SUM(refunds)` vs
`totalAmount`; các flow chấm dứt chuyến đi set `CANCELLED` tường minh. Bốn
trạng thái terminal chuẩn hóa tại
[booking-states.md](../conventions/booking-states.md). Partial refund cộng dồn
được (Nexora one-shot). Nguyên tắc bất di bất dịch: **gateway trước, ledger
sau** — không bao giờ ghi sổ khoản hoàn chưa xảy ra; mọi lệnh refund mang
idempotency key xác định (bảng key trong code) để provider khử trùng lặp.

**3. Atomic claim thế hệ 2 (kế thừa + sửa ADR-0009 Nexora).** Race EPQ có thật
được phát hiện khi review: qual `status='PENDING'` nằm trong CTE join sẽ đọc
snapshot cũ sau khi chờ lock → double-claim ghế. Nexora miễn nhiễm chỉ vì
`connection_limit=1` serialize mọi thứ; v2 pool 10 làm race sống dậy. Thiết kế
mới: (a) claim trên row bookings TRƯỚC — qual nằm trên bảng đích UPDATE nên
được re-check tươi; (b) trừ ghế vô điều kiện, chống overbook bằng CHECK
`departures_seats_within_total` abort nguyên statement (SQLSTATE 23514);
(c) phân loại outcome bằng follow-up SELECT snapshot tươi. Test concurrency
2-claim song song ×10 vòng nằm trong suite.

**4. Cancellation history theo D1-B (đóng audit M7).** Bỏ `@unique(bookingId)`;
partial unique index `WHERE status='REQUESTED'` giữ bất biến "một request
sống"; row DENIED tích lũy — lịch sử không mất. Lỗi trùng bắt qua 23505
(adapter chuẩn hóa thành `UniqueConstraintViolation` — verify thực nghiệm).

## Hệ quả

- PaymentEvent giờ mang `amount/currency/bookingId` (audit H4) — forensics
  tiền query được, không parse JSON.
- Webhook cần raw body (`rawBody: true` trên Fastify adapter).
- Capture-on-return của PayPal thuộc P3 (interface P2 không có surface capture
  — ghi trong docblock PayPalGateway).
- Smoke provider thật hoãn đến P3 (D2) — mọi verify hiện tại offline bằng
  payload tự ký / HTTP stub.

## Đã cân nhắc và loại

- SDK stripe/@paypal chính chủ — thêm dependency + không cải thiện độ phủ test
  offline; các bug hụt nằm ở logic của ta, không phải ở HTTP client.
- Trigger DB cho CHECK status↔ledger (audit H2 dạng cứng) — service-layer đủ
  cho capstone; cân nhắc lại nếu xuất hiện writer thứ hai ngoài API.
- Bảng con CancellationDecision — partial unique đạt cùng mục tiêu, rẻ hơn.
