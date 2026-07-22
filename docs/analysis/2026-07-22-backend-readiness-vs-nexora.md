# Rà soát độ sẵn sàng backend + đối chiếu Nexora — trước khi mở P3b Web (22/07/2026)

Tổng hợp 4 đợt rà song song (endpoint · hạ tầng cross-cutting · money-path/worker · auth/read-surface/chất lượng),
đọc code thật **cả hai** codebase (v2 + Nexora `/mnt/c/.../Tourism-Platform`) và cập nhật theo hiện trạng
**sau các merge 21–22/07** (refund correctness, admin-bootstrap, P3a closeout).

## TL;DR + Go/No-Go

- **Backend customer-facing + money-path + auth (phạm vi P1–P3a): ĐÃ XONG và đã hardened.** Không thụt lùi ở
  bất kỳ bất biến money/security lõi nào; v2 **vượt Nexora** ở hệ tiền (VÀO+RA), auth/session/GDPR, moderation audit.
- **Chưa xong:** suite **admin CRUD (P4, ~58 endpoint)** — *phase chưa mở hợp lệ, không phải regression*; và cụm
  **vòng đời PENDING (ADR-0006, Proposed)** — đây là chỗ **thật sự** v2 còn kém Nexora.
- **Web KHÔNG bị chặn cứng.** Bề mặt đọc khách đủ, CORS `credentials:true`+origin sẵn. Nhưng **nên đóng 2 việc
  trước khi web checkout đi vào sandbox thật:** (A) cụm PENDING-lifecycle (ADR-0006), (B) đợt infra-hardening ngắn
  (global exception filter + helmet + Sentry).

## 1. "Backend đã xong hết chưa?" — theo tầng

| Tầng | Trạng thái | Ghi chú |
|---|---|---|
| Customer read (catalog/reviews/posts/site-media/destinations/categories) | ✅ đủ | 3 gap nhỏ web-only/composable |
| Booking + money-path **Stripe** | ✅ chạy độc lập (webhook-driven PAID) | cần Stripe test key để chạy live (code xong) |
| Money-path **PayPal** | ⚠️ thiếu capture endpoint | cố ý hoãn P3 (cần web return-page) |
| Refund (admin/cancel-approve/auto overbook+orphan) | ✅ hardened, **vượt Nexora** | ADR-0009 đã merge |
| Auth/account/security | ✅ ngang-hoặc-hơn Nexora | SEC-1/AUTH-1/AUTH-2 verify đóng trong code |
| Wishlist/enquiry/newsletter | ✅ (v2 hơn: check batch, unsubscribe công khai) | |
| **Vòng đời PENDING mồ côi** | ❌ ADR-0006 Proposed, chưa code | BK-1/BK-2/PAY-1/WRK-1 |
| **Admin CRUD (P4)** | ❌ chưa mở | ~58 endpoint — phase sau, không phải regression |
| Chat AI (P6) | ❌ chưa mở | cần LLM key |
| Hạ tầng cross-cutting | ✅ vững, 4/8 lỗ 19/07 đã đóng | còn 3 TB "độ chín production" |

## 2. Ma trận endpoint (~107 Nexora → phân loại phần v2 thiếu)

| Loại | Đếm | Ý nghĩa |
|---|---|---|
| P4-ADMIN | 58 | suite quản trị chưa mở (đúng roadmap) |
| P6-AI | 2 | chat concierge (cần key) |
| KEY-BLOCKED | 3 | avatar suite (Cloudinary) |
| WEB-ONLY | 3 | PayPal capture · reviews.featured · reviews.summary (dựng cùng P3b homepage) |
| **GAP-NOW** | **3** | tự-hủy PENDING · re-checkout · departures-filter — **cả 3 đã tracked** (ADR-0006 + C2) |
| DROPPED-OK | 1 | root ping (thay bằng /health) |
| EQUIVALENT | 11 | auth-sync, user me/patch/delete (qua Better Auth), wishlist add/remove… |
| 1:1 | ~26 | — |

→ **60/70 "thiếu" là P4/P6 chưa mở**; chỉ 3 GAP-NOW đều đã biết, không cái nào chặn web đọc.

## 3. Hạ tầng cross-cutting — 4/8 lỗ 19/07 đã đóng; 3 TB còn

**Đã đóng (verify code):** CORS, HTTP outbound timeout (15s AbortSignal), health-DB (SELECT 1 + no-leak),
rate-limit + `trustProxy:1` (chống spoof XFF).

**Còn lại (không chặn cứng web, là độ chín production):**
- **TB-1 Global exception filter** — v2 KHÔNG có `APP_FILTER`. Route Nest thuần (`/api/account/*`, webhooks, health)
  trả shape lỗi khác procedure oRPC → FE parse `.error.code` sẽ vấp. **Nên vá trước khi web lộ các route này.**
- **TB-2 Helmet/security headers** — v2 không có header bảo mật nào. Cài `@fastify/helmet` (rẻ, một lần).
- **TB-3 Sentry/observability** — không error-capture bền; 500 bay theo restart. Chấp nhận hoãn cho capstone nhưng là điểm mù.
- Thấp: prisma `$disconnect` on shutdown + eager `$connect`; API versioning (`/api` phẳng, không `v1` — nên ghi ADR nếu giữ); cron cancel-abandoned-booking (thuộc WRK-1).

## 4. Money-path — kết luận

Stripe khép kín backend-only (create→hosted checkout→webhook completed→PAID→email worker); PAID xác nhận từ
webhook, không từ redirect → **không cần web**. Refund + idempotency (PaymentEvent 2 lớp) + advisory lock +
trigger SUM≤total **đầy đủ**. PayPal dừng ở APPROVED (thiếu capture endpoint, defer P3). Cần key để chạy live:
Stripe + Resend (code xong, `.env.local` chưa set); int test dùng FakeGateway nên không cần key.

## 5. v2 vs Nexora — bên nào tốt hơn

### ✅ v2 tốt hơn (ưu thế ở tầng lõi/bất biến — đúng mục tiêu "tối ưu hơn Nexora")
- **Tiền-VÀO:** atomic seat-claim gen-2 race-safe trên pool>1 (không dựa `connection_limit=1`); oversell ép DB CHECK; dedupe webhook `[provider,eventId]`; **Decimal xuyên suốt** (Nexora IEEE754 một bước).
- **Tiền-RA:** trigger `SUM(refunds)≤total` + `pg_advisory_xact_lock` per-booking bọc refund‖cancel-approve → đóng double-refund mà **Nexora để hở** (auto-refund Nexora không có idempotency key); ledger append-only cộng dồn; approve-flow nguyên tử (Nexora không có).
- **Auth/GDPR:** session revoke tức thì (Nexora JWT không); tombstone giữ review+lịch-sử-tài-chính + right-to-erasure không bị chặn bởi booking; `role:input:false` server-owned; PII-minimization (public + admin không phơi email).
- **Reviews:** ModerationEvent append-only audit (Nexora last-write-wins); rating denormalize; eligibility đòi chuyến ĐÃ kết thúc.
- **Catalog:** pagination tie-breaker ổn định; count chỉ-published (Nexora lộ draft); costPrice chặn-rò theo cấu trúc contract.
- **Hạ tầng:** graceful shutdown thật fire trên SIGTERM (Nexora có hook nhưng thiếu `enableShutdownHooks` → không fire); worker tách process; env validation `superRefine` chặn dev-default lọt prod (mạnh hơn Joi).

### ❌ v2 kém hơn / còn thiếu (tập trung ở vòng đời + polish)
- **Vòng đời PENDING (ADR-0006 Proposed):** gateway-lỗi→PENDING mồ côi + 500 opaque (thiếu `CHECKOUT_FAILED` typed + re-checkout); `checkout.session.expired` không hủy (Nexora `onCheckoutExpired`); không cron sweep 15′ (Nexora `cancelAbandonedBookings`); không self-cancel PENDING. → **v2 chưa có đường nào đưa PENDING mồ côi về terminal.**
- **Departure-cancel cascade:** Nexora `runCancellationPass` tự refund mọi PAID + kill PENDING khi hủy một departure — v2 chưa có (gắn với admin-departures = P4, nhưng logic là money-path).
- **Observability:** thiếu Sentry/error-capture bền (Nexora có); global exception filter; helmet.
- **Nợ chưa-live:** email-change (D1, template có nhưng chưa nối), avatar/self-media (D2), web-cache revalidation (D4, chờ P3b).

## 6. Khuyến nghị trước khi mở P3b Web

Web đọc **sẵn sàng ngay**. Để web **checkout sạch + để thật sự "tối ưu hơn Nexora"**, nên đóng theo thứ tự:

1. **Cụm PENDING-lifecycle (ADR-0006 → Accept rồi code)** — đây là khoảng cách thật duy nhất so Nexora chạm UX
   checkout (khách abandon/retry/hủy đơn chưa trả). Web checkout sẽ exercise đúng các đường này. **Ưu tiên cao nhất.**
2. **Infra-hardening ngắn** — global exception filter (shape lỗi đồng nhất cho FE) + helmet + Sentry. Nửa ngày, một lần.
3. **Kèm P3b (không cần trước):** reviews.featured/summary + destination/category detail (dựng cùng trang chủ/detail web); departures-filter (C2).
4. **Defer đúng phase:** admin CRUD (P4), PayPal capture (P3 return-page), chat (P6), avatar (P4), email-change (D1).

**Kết luận đi/không:** Backend **đủ điều kiện mở P3b Web**; điều kiện để web checkout "sạch và vượt Nexora" =
đóng #1 (PENDING-lifecycle) + #2 (infra-hardening) trước khi checkout đi vào Stripe sandbox thật.
