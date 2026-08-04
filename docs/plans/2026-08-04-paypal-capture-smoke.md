# Plan — Trả 2 nợ ADR-0002: capture-on-approved + smoke provider thật

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Step dùng checkbox (`- [ ]`).

**Goal:** PayPal hoàn tất được thanh toán end-to-end (capture server-side khi
webhook APPROVED) + cả hai provider được smoke bằng sandbox THẬT — theo
[spec](../specs/2026-08-04-paypal-capture-smoke-design.md) (Approved 04/08;
ADR-0002 khối "Cập nhật 2026-08-04").

**Architecture:** thêm member TUỲ CHỌN `followUp?(event)` vào interface
`PaymentGateway`; `webhooks.controller.handle()` gọi nó SAU `handleEvent`.
Kiến thức PayPal ở yên trong `PayPalGateway` (capture qua seam `this.post`
sẵn có — Bearer + `PayPal-Request-Id`). Int test wiring bằng FakeGateway
(môi trường int CHỈ đăng ký Fake — `payments.module.ts:59-66`); hành vi
capture test unit qua `httpPost` injectable (`paypal.gateway.ts:56`).

**Tech Stack:** không dep mới. Smoke dùng `stripe` CLI + `cloudflared`
(tunnel tạm, không account).

## Global Constraints (áp cho MỌI task)

- **Branch `feat/paypal-capture-smoke`** từ `main`. Conventional Commits.
  ⚠️ SAU MỖI COMMIT chạy `git log -1 --format='%B'`; NẾU chứa
  "Co-Authored-By" THÌ `git commit --amend` sạch rồi kiểm lại; NẾU không thì
  xong (lệnh một chiều).
- Comment/JSDoc tiếng Việt; import API đuôi `.js`; KHÔNG SDK provider
  (ADR-0002 đã loại); KHÔNG đụng migrations/contract/atomic-claim/đường
  `payment.completed`.
- TDD: test wiring + unit viết TRƯỚC khi nối. `pnpm gate:int` trước khi khai
  xong. Cổng sạch, PID ghi + kill, DB smoke dọn bằng SQL dán kèm.

---

### Task 1: Interface `followUp` + wiring controller + int test bằng Fake

**Files:**
- Modify: `apps/api/src/modules/payments/gateway.ts` (interface + JSDoc)
- Modify: `apps/api/src/modules/payments/webhooks.controller.ts` (~`:91` sau `handleEvent`)
- Modify: `apps/api/src/modules/payments/fake.gateway.ts` (+ instrument followUp)
- Modify: `apps/api/src/modules/payments/payments.int.spec.ts` (describe mới)

**Interfaces (Produces — Task 2 dùng nguyên văn):**
- `PaymentGateway.followUp?(event: VerifiedEvent): Promise<void>` — optional;
  controller gọi `await gateway.followUp?.(verified)` NGAY SAU
  `this.payments.handleEvent(...)` và TRƯỚC khi build response; throw từ
  followUp lan ra ngoài → global exception filter trả 500 (provider retry).
- FakeGateway: thêm `followUpCalls: VerifiedEvent[]` (ghi lại) +
  `followUpError?: Error` (đặt để giả lập throw) — cùng phong cách instrument
  các field sẵn có của Fake.

- [ ] **Step 1 (RED):** int test describe "webhook followUp wiring":
  1. POST webhook Fake hợp lệ → `fake.followUpCalls` có ĐÚNG event vừa
     verify (eventId khớp), gọi SAU khi PaymentEvent đã ghi (assert row tồn
     tại trong cùng test);
  2. đặt `fake.followUpError = new Error('boom')` → POST webhook → response
     **500** + PaymentEvent VẪN đã ghi (handleEvent chạy trước) — reset
     error sau test;
  3. webhook chữ ký SAI → 400 và `followUpCalls` KHÔNG tăng.
  Chạy đỏ (chưa có followUp). Interface chưa có member → test chưa compile
  là RED hợp lệ, ghi rõ output.
- [ ] **Step 2 (GREEN):** thêm member optional vào interface (JSDoc tiếng
  Việt: side-effect riêng của provider sau khi event đã verify + log; throw
  = xin provider retry); FakeGateway implement instrument; controller thêm
  đúng MỘT dòng `await gateway.followUp?.(verified);` sau `handleEvent`
  (comment: vì sao sau — PaymentEvent phải ghi xong kể cả khi follow-up nổ).
- [ ] **Step 3:** GREEN int (`pnpm test:int -- payments` — đọc package.json
  cách filter); typecheck + biome. Commit:
  `feat(api): PaymentGateway.followUp — webhook side-effect hook + wiring`.

---

### Task 2: `PayPalGateway.followUp` — capture-on-approved

**Files:**
- Modify: `apps/api/src/modules/payments/paypal.gateway.ts` (followUp + docblock `:43-46`)
- Modify: `apps/api/src/modules/payments/paypal.gateway.spec.ts`

**Interfaces:**
- Consumes: `followUp?` (Task 1) · seam `this.post<T>(path, payload, requestId?)`
  sẵn có (Bearer + `PayPal-Request-Id`).
- Hành vi (spec §2 — ngữ nghĩa lỗi là hợp đồng):
  - `raw.event_type !== 'CHECKOUT.ORDER.APPROVED'` → return ngay, KHÔNG gọi HTTP.
  - APPROVED → `this.post(`/v2/checkout/orders/${orderId}/capture`, {},
    `capture:${orderId}`)` với `orderId = raw.resource.id`; thiếu orderId →
    warn + return (payload dị dạng đã ký — không throw, không có gì retry được).
  - Response lỗi mà body chứa `ORDER_ALREADY_CAPTURED` → log + NUỐT
    (idempotent thành công — cũng chính là ca out-of-order APPROVED-đến-sau).
  - Lỗi khác (network/5xx/4xx lạ) → **THROW** (controller 500 → PayPal retry;
    an toàn nhờ Request-Id).
- Đọc kỹ helper lỗi sẵn có của file (`paypalErrorMessage`, cách `post` ném
  lỗi) để nhận diện ALREADY_CAPTURED đúng tầng — soi shape lỗi thật của
  `this.post` trước khi viết, đừng đoán.

- [ ] **Step 1 (RED):** unit spec (khuôn stub `httpPost` sẵn có trong file):
  APPROVED → gọi đúng URL + header Request-Id `capture:<orderId>`; body
  ALREADY_CAPTURED → resolve không throw; 503 → throw; event khác/thiếu
  resource.id → 0 call HTTP/không throw.
- [ ] **Step 2 (GREEN):** implement + cập nhật docblock `:43-46` (cơ chế
  mới: webhook-approved capture là đường chính, return-page bước 10 là lớp
  UX, webhook backstop).
- [ ] **Step 3:** GREEN unit + typecheck + biome; `pnpm gate` nhanh. Commit:
  `feat(api): PayPal capture-on-approved — idempotent, throw-de-retry`.

---

### Task 3: Smoke provider thật + gate:int + chốt

**Tiền đề:** user đã điền `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID/SECRET` vào
`apps/api/.env.local` — KIỂM TRƯỚC (grep tên biến, KHÔNG in giá trị); thiếu
→ BLOCKED chờ user, không tự chế.

- [ ] **Step 1 — Stripe:** API sống (env thật). Cài/kiểm `stripe` CLI →
  `stripe listen --forward-to localhost:3001/api/webhooks/stripe` (lấy
  `whsec_…` in ra → export `STRIPE_WEBHOOK_SECRET` cho PHIÊN API, không sửa
  file). Kịch bản spec §3: booking PENDING qua API thật (user thật sign-up)
  → checkout session → trả bằng 4242 4242 4242 4242 (playwright headless
  hoặc trình duyệt — ghi cách làm) → webhook về → **DB: booking PAID,
  providerPaymentId set** → refund MỘT PHẦN qua endpoint admin (cookie admin
  — nếp task-7 cụm auth) → ledger row + refund id thật → refund phần còn
  lại → booking REFUNDED. DÁN nguyên văn: response provider, SQL trước/sau.
- [ ] **Step 2 — PayPal:** `cloudflared tunnel --url http://localhost:3001`
  (ghi PID + URL) → tạo webhook sandbox trên app PayPal trỏ
  `<tunnel>/api/webhooks/paypal` (đủ event CHECKOUT.ORDER.APPROVED +
  PAYMENT.CAPTURE.*) → lấy `PAYPAL_WEBHOOK_ID` export cho phiên API →
  restart API. Kịch bản như Stripe, trả bằng buyer sandbox; chuỗi
  PaymentEvent phải đủ **APPROVED → (capture của ta) → CAPTURE.COMPLETED**
  — đây là bằng chứng sống của Task 2. Sandbox PayPal chậm là bình thường
  (spec §6) — ghi thời gian thật, retry tối đa 3 lần trước khi kết luận.
- [ ] **Step 3 — Âm bản:** webhook body sửa 1 byte giữ header cũ → 400;
  replay đúng event đã nhận (cùng eventId) → response cho thấy dedupe
  (không đổi trạng thái lần 2 — đọc hành vi thật mà khẳng định).
- [ ] **Step 4 — Dọn + chốt:** SQL xoá user/booking/ledger smoke (FK đúng
  thứ tự, dán số row); kill tunnel + stripe CLI + API theo PID, cổng `000`;
  xoá webhook sandbox tạm trên PayPal app (hoặc ghi rõ để user tự xoá).
  `pnpm gate:int` trọn. Commit chốt nếu có sửa vụn:
  `test(api): smoke sandbox that Stripe + PayPal`. DỪNG — final review →
  user quyết merge → docs sweep luật 13 (CHANGELOG; ADR-0002 nợ D2 + capture
  → ĐÃ TRẢ; README specs/plans/analysis-nợ-đến-hạn).
