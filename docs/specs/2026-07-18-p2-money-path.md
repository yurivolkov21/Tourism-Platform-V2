# Spec P2 — Money-path

- **Ngày:** 2026-07-18 · **Branch:** `feat/p2-money-path` · **Trạng thái:** đã triển khai (W1–W6) — xem [ADR-0002](../adr/0002-payment-gateway-refund-ledger.md); D1=B, D2=hoãn P3
- **Phụ lục:** [Spec P1](2026-07-18-p1-api-core.md) · [Schema audit](2026-07-18-schema-audit-nexora.md) (H1/H2/B-findings/M7) · Nexora ADR-0006/0009 (tham chiếu chỉ đọc)

## 1. Mục tiêu

Port toàn bộ money-path đã tôi luyện của Nexora lên nền v2, với 3 nâng cấp đã
chốt ở audit: **interface `PaymentGateway` thật** (thay enum+branching),
**`Refund` ledger** (thay 4 cột nullable), và **snapshots** đã có sẵn từ W2.
Stripe/PayPal chạy **test/sandbox mode** (capstone — không tiền thật).

**Ngoài phạm vi:** UI checkout (P3 web) · PaymentSheet mobile (P5) · email
template đẹp bằng react-email (P3 trở đi — P2 dùng HTML/text đơn giản).

## 2. Quyết định cần chốt cùng spec

**D1 — M7 audit trail cho CancellationRequest (khuyến nghị ✅ phương án B):**
- (A) Giữ nguyên Nexora: `@unique(bookingId)`, row DENIED bị ghi đè khi
  re-request — mất lịch sử lần từ chối.
- **(B — khuyến nghị)** Bỏ `@unique(bookingId)`, mỗi request một row append-only
  + **partial unique index** `WHERE status = 'REQUESTED'` (một request "sống"
  mỗi booking, lịch sử DENIED giữ nguyên vẹn). Migration nhỏ, không cần bảng
  con, đọc lịch sử = `findMany orderBy createdAt`.

**D2 — Smoke với provider thật:** code Stripe/PayPal test-mode viết và unit-test
đầy đủ bằng FakeGateway; smoke chạm Stripe/PayPal **thật** (tạo checkout
session test) cần bạn cung cấp key test (Stripe secret key + webhook secret,
PayPal sandbox client id/secret). Có thể làm ngay trong P2 nếu bạn đưa key,
hoặc hoãn smoke sang lúc P3 dựng UI checkout (code vẫn xong từ P2).

## 3. Kiến trúc

```
libs/shared/contract/src/schemas/bookings.ts   # Zod: CreateBookingInput, BookingSchema,
                                               # CancellationSchema, RefundSchema, admin queries
libs/shared/contract/src/contract.ts           # + bookings.{create,mine,byCode,cancel}
                                               # + admin.bookings.{list,refund,decideCancellation}
apps/api/src/modules/payments/
  gateway.ts            # interface PaymentGateway + VerifiedEvent + token
  stripe.gateway.ts     # test-mode impl (createCheckoutSession/verifyWebhook/refund)
  paypal.gateway.ts     # sandbox impl (createOrder/captureOnReturn/verifyWebhook/refund)
  fake.gateway.ts       # in-memory cho test — mô phỏng cả retry/duplicate webhook
  payments.service.ts   # PaymentEvent idempotency (beginEvent/finishEvent) — GHI
                        # amount/currency/bookingId (audit H4) từ payload đã verify
  webhooks.controller.ts# POST /api/webhooks/{stripe,paypal} — RAW BODY (Fastify config)
apps/api/src/modules/bookings/
  bookings.service.ts   # create PENDING (không giữ ghế) → PAID qua webhook bằng
                        # single-statement atomic claim CTE (port ADR-0009 nguyên tư duy:
                        # claim ghế + flip status + enqueue outbox ON CONFLICT DO NOTHING
                        # trong MỘT statement; outcome 'claimed'|'overbooked'|'cancelled')
  refunds.service.ts    # ledger: insert Refund row + derive status từ SUM(refunds)
                        # vs totalAmount (PAID → PARTIALLY_REFUNDED → REFUNDED);
                        # auto-refund orphaned capture (webhook đến sau khi cancel)
  cancellations.service.ts # request/approve/deny theo D1
```

- **Snapshots lúc create** (tourTitle, dates, unitPrice — cột đã có từ W2).
- **Emails**: `ResendDeliverer` implement `EMAIL_DELIVERER` (worker W5 đã chừa
  token); `RESEND_API_KEY` không set → giữ ConsoleDeliverer (dev boots không
  cần email — pattern Nexora). Port 5 EmailTypes booking-side trước
  (BOOKING_CONFIRMED, CANCELLATION_REQUESTED/APPROVED/DENIED, REFUND_ISSUED);
  3 loại auth-side nối vào flow Better Auth ở P3.
- **Env mới (đều optional ở dev)**: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID, RESEND_API_KEY — validate tổ hợp khi
  NODE_ENV=production.
- **Trạng thái derive nhưng LƯU**: `Booking.status` vẫn là cột (state machine
  đọc nhanh); mọi transition liên quan refund bắt buộc đi qua RefundsService
  (ledger là nguồn sự thật, status là projection — CHECK H2 mềm ở service,
  cứng ở P-sau nếu cần trigger).

## 4. Bất biến money-path phải giữ (port từ Nexora, test bắt buộc)

1. Booking PENDING **không giữ ghế**; ghế chỉ bị trừ ở PAID-claim atomic.
2. Webhook duplicate/retry → **đúng một lần hiệu lực** (PaymentEvent
   `[provider,eventId]` + processedAt semantics + handler idempotent).
3. Claim khi hết ghế → outcome `overbooked` → **auto-refund** + booking CANCELLED.
4. Payment hoàn tất **sau khi** booking đã cancel → orphaned capture →
   auto-refund + REFUNDED (bug 7e51a24 Nexora đã trả giá).
5. Partial refund **cộng dồn được** (nâng cấp mới nhờ ledger): tổng refund <
   total → PARTIALLY_REFUNDED; = total → REFUNDED; > total → reject 422.
6. Currency mismatch giữa refund và booking → reject (không FX).
7. Email enqueue nằm TRONG transaction claim (outbox), dedupeKey theo
   [quy ước](../conventions/outbox-dedupe-key.md).

## 5. Workstream & nghiệm thu

| W | Nội dung | Nghiệm thu |
|---|---|---|
| W1 | Contract bookings/cancellations/admin + gateway interface + FakeGateway + create booking PENDING (snapshot, validate departure OPEN/còn hạn) | int test: create qua API thật, snapshot đúng, chưa trừ ghế |
| W2 | Webhook infra (raw body) + PaymentEvent idempotency + **PAID atomic claim CTE** + outbox emails | int test: duplicate webhook 1 hiệu lực; claim trừ ghế đúng; overbook → refund; outbox row đúng dedupeKey |
| W3 | RefundsService ledger + admin refund (partial/full) + orphaned capture | int test: partial cộng dồn → PARTIALLY → REFUNDED; quá tổng → 422; orphaned → auto-refund |
| W4 | Cancellation theo D1 + admin decide + emails | int test: request→deny→re-request (lịch sử giữ per D1-B); approve → Refund row |
| W5 | Stripe + PayPal impl thật (test mode) sau interface; ResendDeliverer | unit verify signature/mapping; smoke thật nếu có key (D2) |
| W6 | Docs sweep: ADR-0002 (PaymentGateway + Refund ledger), CHANGELOG, README | gate + CI xanh; merge rebase+ff |

TDD bắt buộc cho logic thuần (derive status, phân loại refund, outcome claim).
FakeGateway là công cụ test chính — mô phỏng duplicate, out-of-order, orphaned.
