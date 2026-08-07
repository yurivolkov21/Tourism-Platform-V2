# Spec — Cụm C: booking form + checkout success/cancel (2026-08-07)

- **Trạng thái:** Draft, chờ user duyệt
- **Nền:** [ADR-0002](../adr/0002-payment-gateway-refund-ledger.md) (gateway +
  ledger) · [ADR-0006](../adr/0006-pending-lifecycle.md) (vòng đời PENDING) ·
  [ADR-0016](../adr/0016-web-data-layer.md) (tầng dữ liệu web) ·
  [ADR-0017](../adr/0017-web-session-better-auth.md) (session) ·
  [booking-states](../conventions/booking-states.md) · thiết kế đã chốt ở
  [mockup booking-flow](../design/mockups/booking-flow.src.html)
- **Branch:** `feat/booking-checkout`

## 0. Vì sao cụm này đi TRƯỚC redesign account

Nút **Pay now** ở `/account/bookings/[code]` là nút thật: nó gọi
`api.bookings.checkout` rồi `window.location.assign(checkoutUrl)`
(`booking-actions.tsx:94,101`). Cổng thanh toán trả khách về
`/checkout/success?code=…` — **route không tồn tại**. Tức money-path đang có một
ngõ cụt 404 bấm chuột tới được, trên nhánh main đang sống.

Redesign khu account là làm đẹp trên các trang đã chạy được; cụm này vá một lỗ
thủng chức năng. Thứ tự vì thế là **C → B → redesign account** (user chốt
07/08).

**Không vẽ mockup riêng cho cụm này.** Ba màn đã chốt ở vòng thiết kế 04–06/08;
copy tiếng Anh đã nằm sẵn trong `@tourism/i18n` (khối `booking.page` · `form` ·
`success` · `cancel` · `errors`, hiện mồ côi 0 consumer). Spec này chỉ nối dây.

## 1. Phạm vi

Ba route mới, không route nào tồn tại hôm nay:

| Route | Vai trò | Auth |
| --- | --- | --- |
| `/tours/[slug]/book` | Form đặt chỗ — chọn đợt, số người, liên hệ, nơi thanh toán | Cần session |
| `/checkout/success` | Quay về sau khi trả tiền — confirmed hoặc đang xác nhận | Cần session |
| `/checkout/cancel` | Quay về khi khách bỏ ngang ở trang cổng | Cần session |

**Ngoài phạm vi:** redesign khu account (nợ A1) · cụm B (tim wishlist + form
review) · trang admin.

## 2. Luồng tiền — đọc kỹ trước khi code

```text
/tours/[slug]/book
   │  bookings.create  →  { booking, checkoutUrl }
   ↓
window.location.assign(checkoutUrl)      ← rời site sang Stripe/PayPal
   │
   ├── trả tiền xong  → /checkout/success?code=BK-…
   └── bỏ ngang       → /checkout/cancel?code=BK-…
```

Hai bất biến của API mà giao diện **không được nói ngược**:

1. **PENDING KHÔNG giữ ghế.** `create` chỉ soft-check số ghế; ghế được claim
   nguyên tử ở đường webhook PAID (`bookings.service.ts:152-156`). Cấm mọi câu
   kiểu "ghế đang được giữ cho bạn" hay "ghế sẽ được trả lại kệ".
2. **Trẻ em trả CÙNG giá người lớn.** `totalAmount(unitPrice, numAdults +
   numChildren)`. Nhãn `perAdult`/`perChild` trong i18n là nhãn tách nhóm, không
   phải hai mức giá — đừng cài giảm giá trẻ em không tồn tại.

## 3. Delta contract — 3 field, tất cả additive

Không đổi kiểu field nào đang có, nên không consumer nào vỡ.

| Field | Kiểu | Điền ở đâu | Vì sao |
| --- | --- | --- | --- |
| `refundedTotal` | `DecimalStringSchema` | chỉ `bookings.byCode` | Ô Payment của thiết kế là một **con số**, không phải tính từ. Đã hẹn trước ở [prompt booking](../design/prompts/booking.md) và ghi thành nợ M-2 trong CHANGELOG cụm A |
| `cancellationRequestedAt` | `z.iso.datetime().nullable()` | chỉ `bookings.byCode` | "Requested — pending review" không có ngày thì khách không biết yêu cầu đã tới chưa, và gửi lại lần hai |
| `cancellationDecidedAt` | `z.iso.datetime().nullable()` | chỉ `bookings.byCode` | Cặp với field trên cho nhánh DENIED |

Chi phí thi công **gần bằng không**: `byCode` đã chạy sẵn
`cancellationRequest.findFirst` với `select: { status: true }`
(`bookings.service.ts:364-368`) — chỉ thêm hai cột vào `select`. Còn
`refundedTotal` là một `SUM(amount)` trên bảng `Refund` vốn đã có
`@@index([bookingId])`, và trigger của [ADR-0009](../adr/0009-refund-correctness.md)
bảo đảm `SUM ≤ total` nên số liệu đáng tin.

**KHÔNG mở** `decisionNote` (lý do admin từ chối) cho khách. Đó là ghi chú nội
bộ; mở ra là biến nó thành copy user-facing không qua luật biên tập nào, và
capstone không có đội vận hành thật nên nội dung thực tế sẽ là chuỗi test.
Nhóm đã phân loại "privacy hợp lý" trong CHANGELOG cụm A. Nhánh DENIED dùng một
câu cố định cộng link `/cancellation-policy`.

`mine` (list) tiếp tục **không** điền ba field này — giữ nguyên lý do tránh N+1
đã ghi ở `bookings.service.ts:319-323`.

## 4. Ba màn — nội dung

Bám mockup đã chốt; đây là phần khác biệt so với mockup và các ràng buộc thật.

### 4.1 `/tours/[slug]/book`

- Hai chế độ qua một công tắc: **Scheduled departure** (mặc định khi tour có
  đợt mở) và **Private trip** (tự chọn khi `departures[]` rỗng → gửi
  `enquiries.create`, KHÔNG tạo booking).
- Hàng đợt khởi hành: dải ngày · giá/người · ghế còn theo ba mức
  (`departureStatus`: `>3` · `1–3` · `0`). Đợt hết chỗ hiện nhưng không chọn
  được. Có `compareAtPrice` thì gạch ngang giá cũ.
- Bộ đếm người lớn (min 1) / trẻ em (min 0). Trần = `min(tour.maxGroupSize,
  departure.seatsLeft)`; chạm trần thì một dòng giải thích, không phải toast.
- Khối liên hệ dùng primitive `field`: tên · email · phone (optional, min 6) ·
  special requests (optional, ≤1000).
- Chọn nơi thanh toán: Stripe hoặc PayPal. **Không có ô nhập thẻ ở bất kỳ đâu** —
  đây là chọn nơi chuyển hướng.
- Rail tổng tiền dính, cộng câu nhắc server tính lại số cuối.
- Nút chính `Continue to payment` → `bookings.create` → `assign(checkoutUrl)`.

### 4.2 `/checkout/success`

Hai tâm trạng, quyết bằng `booking.status` đọc từ `byCode`:

- `PAID` → **confirmed**: mã đặt chỗ ở mặt chữ mono, tour + ngày, một câu báo
  email xác nhận đang tới.
- Còn `PENDING` → **đang xác nhận**: webhook chưa về. Câu bình thản, tự làm mới
  bằng `router.refresh()` theo chu kỳ, kèm nút `Check now`
  (`booking.success.refresh` đã có sẵn trong i18n). **Không spinner toàn trang.**

### 4.3 `/checkout/cancel`

Booking vẫn còn, ở `PENDING`, trả tiếp được từ trang chi tiết. Nói đúng như vậy,
cộng một câu về việc booking chưa trả tiền sẽ bị huỷ sau khoảng một giờ —
**không đếm ngược**, và không nói gì về việc "trả ghế lại" (xem bất biến #1).

## 5. Kỹ thuật

- **Session:** `proxy.ts` matcher hiện chỉ `['/account/:path*']`. Thêm
  `/tours/:slug/book` và `/checkout/:path*`, GIỮ defense-in-depth: mỗi page tự
  gọi `requireSession` như 6 trang account đang làm. Cookie sống sót qua redirect
  top-level GET từ cổng thanh toán (SameSite=Lax cho phép) — đây là điều kiện
  để `/checkout/success` đọc được `byCode`.
- **Không cache:** cả ba trang là dynamic per-user, `cache: 'no-store'`, KHÔNG
  `loading.tsx` (luật soft-404 của repo).
- **Hạn 65 phút:** contract KHÔNG có `expiresAt`. Web tự tính
  `createdAt + PENDING_TTL_MINUTES`. Hằng số phải nhân bản sang web —
  đặt một chỗ trong `lib/booking.ts` kèm comment trỏ ngược về
  `apps/api/src/worker/pending-sweep.service.ts:15`.
- **i18n:** dùng khối `booking.*` đã có. Chỗ nào mockup lệch i18n thì **i18n
  thắng** (nó là copy đã duyệt) — trừ hai câu vi phạm bất biến #1, phải sửa i18n
  theo spec này.
- **robots:** `/checkout/` đã disallow sẵn. Sitemap KHÔNG thêm ba route này.
- Nhãn trạng thái dùng `messages.booking.list.status` (câu tiếng Anh), không in
  enum thô.

## 6. Test

- **Thuần (TDD):** tính trần số người (`min(maxGroupSize, seatsLeft)`) · dựng
  payload `CreateBookingInput` từ state form · quyết định tâm trạng màn success
  từ `status` · tính hạn còn lại từ `createdAt`.
- **jsdom:** công tắc hai chế độ · chạm trần hiện đúng một dòng · lỗi validate
  email + thiếu đợt · nút chính vào trạng thái pending khi submit.
- **Int (API):** `byCode` trả đúng ba field mới; `mine` vẫn để null/0.
- **Sống:** trả tiền sandbox Stripe end-to-end, xác nhận quay về
  `/checkout/success` KHÔNG còn 404 — đây là mục tiêu số một của cụm.

## 7. Nghiệm thu

1. Từ `/tours/[slug]` bấm Reserve → tới form → tạo booking → sang Stripe sandbox
   → trả tiền → quay về `/checkout/success` thấy mã đặt chỗ và trạng thái đúng.
2. Lặp lại nhưng bỏ ngang ở trang Stripe → `/checkout/cancel`, booking vẫn
   PENDING, trả lại được từ trang chi tiết.
3. Nút **Pay now** ở `/account/bookings/[code]` đi trọn vòng, không còn 404.
4. Tour không có đợt mở → form tự ở chế độ Private, gửi enquiry, KHÔNG tạo
   booking.
5. `pnpm gate:int` xanh.

## 8. Ngoài phạm vi (ghi để khỏi trôi)

- Redesign khu account (nợ A1) và nợ tương phản dark (A3) — cụm sau.
- Cụm B: tim wishlist trên card catalogue, form review ở booking detail. Mockup
  account đã **chừa chỗ tường minh** cho cả hai.
- Phân trang bookings > 50 (nợ chung với Nexora).
- Đo đường PayPal trên UI — mới smoke ở cụm ADR-0002, env dev còn thiếu
  webhook id.
