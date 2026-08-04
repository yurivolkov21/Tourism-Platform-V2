# Spec — Trả 2 nợ ADR-0002: PayPal capture-on-approved + smoke provider thật (2026-08-04)

- **Trạng thái:** Approved 04/08 (2 quyết định khung user chốt cùng ngày:
  capture kích hoạt từ webhook APPROVED · smoke chạy luôn bằng key user cấp)
- **Nền:** [ADR-0002](../adr/0002-payment-gateway-refund-ledger.md) khối
  "Cập nhật 2026-08-04". Hiện trạng đo được: order PayPal tạo
  `intent: CAPTURE` nhưng không ai gọi capture — buyer approve xong,
  `CHECKOUT.ORDER.APPROVED` chỉ được log (`paypal.gateway.ts:46`), tiền
  không capture, booking treo PENDING tới khi sweep hủy.
- **Branch:** `feat/paypal-capture-smoke`.

## 1. Phạm vi

| # | Việc | Ghi chú |
| --- | --- | --- |
| A | Capture server-side khi webhook `CHECKOUT.ORDER.APPROVED` | hook `followUp` tuỳ chọn trên interface — kiến thức PayPal Ở YÊN trong gateway |
| B | Smoke thật: Stripe test-mode + PayPal sandbox | mỗi provider 1 thanh toán + 1 refund, DB assert |

KHÔNG đụng: atomic claim/đường `payment.completed` (capture thành công sẽ đẻ
webhook `PAYMENT.CAPTURE.COMPLETED` → đi đúng đường sẵn có); interface
`createCheckoutSession`/`refund`; migrations.

## 2. A — Capture-on-approved

- **Interface:** thêm member TUỲ CHỌN vào `PaymentGateway`:
  `followUp?(event: VerifiedEvent): Promise<void>` — side-effect riêng của
  provider SAU khi event đã được verify + `handleEvent` ghi PaymentEvent.
  `webhooks.controller` gọi `await gateway.followUp?.(verified)` sau
  `handleEvent`. Stripe/Fake không implement — không đổi gì.
- **PayPalGateway.followUp:** nếu `raw.event_type === 'CHECKOUT.ORDER.APPROVED'`
  → POST `/v2/checkout/orders/{orderId}/capture` (orderId = `resource.id`
  trong raw — gateway tự đọc raw của mình) với header
  `PayPal-Request-Id: capture:<orderId>` (idempotent — webhook retry không
  double-capture).
- **Ngữ nghĩa lỗi (điểm tinh nhất, test phải khoá):**
  - Capture 2xx → xong (COMPLETED sẽ về bằng webhook riêng — không đổi
    booking ở đây, giữ MỘT đường ghi trạng thái).
  - `ORDER_ALREADY_CAPTURED`/`422` dạng đã-capture → nuốt + log (idempotent
    thành công).
  - Lỗi khác (network/5xx provider) → **THROW** → controller trả 500 → PayPal
    RETRY webhook APPROVED → capture được thử lại (an toàn nhờ Request-Id).
    Nuốt lỗi + trả 200 là order không bao giờ được capture nữa — buyer chờ
    vô vọng.
- **Test:** unit paypal.gateway — APPROVED gọi đúng path + Request-Id;
  ALREADY_CAPTURED nuốt; 5xx throw; event khác không gọi gì. Int
  (`payments.int.spec.ts` nếp sẵn): inject webhook APPROVED tự ký → spy
  HttpPost capture được gọi; kiểm PaymentEvent log vẫn ghi.
- Docblock `paypal.gateway.ts:43-46` cập nhật theo cơ chế mới (ghi rõ
  return-page capture là lớp UX bước 10, webhook là backstop).

## 3. B — Smoke provider thật

Tiền đề user cấp key vào `apps/api/.env.local` (3 biến trước, 2 biến sinh
lúc chạy — xem checklist trong plan):
`STRIPE_SECRET_KEY` (sk_test_…) · `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`
(app sandbox REST) · `STRIPE_WEBHOOK_SECRET` (từ `stripe listen` lúc smoke) ·
`PAYPAL_WEBHOOK_ID` (tạo webhook sandbox trỏ tunnel lúc smoke).

- **Đường webhook về máy dev:** Stripe qua `stripe` CLI
  (`stripe listen --forward-to localhost:3001/...`); PayPal qua tunnel công
  khai tạm (`cloudflared tunnel --url`, không cần account) + webhook sandbox
  trỏ vào đó. Mọi tiến trình tunnel/CLI ghi PID, kill khi xong.
- **Kịch bản đo (mỗi provider, DÁN OUTPUT NGUYÊN VĂN):**
  1. Tạo booking PENDING qua API thật → `createCheckoutSession` → mở URL,
     trả bằng thẻ test (Stripe 4242…) / buyer sandbox (PayPal) →
     webhook về → **booking PAID trong DB**, `providerPaymentId` set,
     PaymentEvent đủ chuỗi (PayPal: APPROVED → capture → CAPTURE.COMPLETED).
  2. Refund MỘT PHẦN qua endpoint admin thật → ledger row + provider xác
     nhận (id refund thật) → refund nốt phần còn lại → booking `REFUNDED`
     (derive từ ledger).
  3. Âm bản: webhook chữ ký sai → 400; replay cùng eventId → không double
     (dedupe sẵn có).
- **Ranh giới:** sandbox/test-mode CỦA account user — không tiền thật (đúng
  tính chất capstone "không doanh thu"); dữ liệu smoke dọn khỏi DB sau khi
  đo (SQL dán kèm).

## 4. Nghiệm thu

1. Int + unit mới xanh; `pnpm gate:int` trọn.
2. Smoke §3 đủ 2 provider × (1 thanh toán + 2 refund) + 2 âm bản — output
   nguyên văn trong report; DB dọn sạch, PID/tunnel kill, cổng trống.
3. Docblock + ADR-0002 khối cập nhật khớp hành vi mới (docs sweep).

## 5. Ngoài phạm vi

- Capture-on-return ở trang success (bước 10 — lớp UX, webhook vẫn backstop).
- Trang checkout web (bước 10); SDK provider chính chủ (ADR-0002 đã loại).

## 6. Rủi ro

- **PayPal webhook APPROVED có thể tới SAU CAPTURE.COMPLETED** (out-of-order)
  khi capture xảy ra nhanh — follow-up lúc đó gặp ALREADY_CAPTURED → nuốt
  đúng thiết kế; test khoá case này.
- Sandbox PayPal chậm/chập chờn (nổi tiếng) — smoke có thể phải retry vài
  lần; ghi thời gian thật vào report, đừng kết luận vội "code hỏng".
- Tunnel công khai mở trong lúc smoke — chỉ expose webhook route, đóng ngay
  khi xong; secret không đi qua tunnel (chữ ký verify tại API).
