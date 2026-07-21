# Rà soát độc lập toàn bộ API — parity + review defect (21/07/2026)

Đợt rà **độc lập** trên toàn bộ `apps/api` tại `main@5e773a1` (sau khi P3a-C
posts/site-media merge). Hai lăng kính:

- **(A) Parity vs Nexora** — thứ Nexora có mà v2 thiếu (6 agent song song, không
  đọc doc parity có sẵn để tránh neo; đối chiếu chéo ở bước cuối).
- **(B) Review defect** — lỗi v2 TỰ SINH bất kể Nexora: correctness · concurrency ·
  bảo mật · error-handling · test-gap (8 agent theo module/lăng kính).

**Kỷ luật:** mỗi finding trích `file:line`, kịch bản hỏng cụ thể, tự kiểm chứng
lần hai; nghi ngờ thì bỏ (chống dương-tính-giả, CLAUDE.md #10 + mutation-test).
**Bốn finding High + SEC-1 đã được người điều phối tự đọc code xác minh lại** (không
tin mù agent). Cả hai repo chỉ đọc, không sửa mã. Chi tiết từng vùng: scratchpad
`parity/*.md` + `review/*.md` (ephemeral) — bằng chứng cốt lõi đã inline dưới đây.

> Nexora: `/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform` (chỉ đọc).
> Ngoài phạm vi review sâu: `admin.*` CRUD (P4), mobile (P5), concierge (P6).

---

## Kết luận một dòng

**Hệ tiền-VÀO (claim ghế, oversell CHECK, idempotency webhook) chắc như đá; hệ
tiền-RA (refund / cancellation / webhook-retry) là chỗ tụ lỗ.** Không có
Critical. **4 High** (đều quanh refund/spam), một chùm Medium, phần còn lại Low/
parity. 19 invariant lõi được test canh mạnh (codebase mutation-aware thật sự).

## ✅ Đã vá + verify trong phiên (21/07) — chưa commit

- **ENQ-R1** (High) — `bootstrap.ts` `trustProxy: 1`; e2e regression chống spoof-XFF
  (`config/throttle.e2e.spec.ts`), **mutation-proven** (ĐỎ với `true`).
- **TQ-1** (High test-gap) — `FakeGateway.failRefunds` toggle + int test nhánh
  refund-thất-bại (`refunds.int.spec.ts`: 502 + KHÔNG ledger/outbox + giữ PAID),
  **mutation-proven** (nuốt lỗi → ĐỎ).
- **CAT-R1** (Medium) — `catalog.service.ts` money `.toFixed(2)`; đồng thời phát hiện
  & vá **sibling y hệt** ở `bookings.service.ts` (API response `totalAmount`/`unitPrice`
  "117"→"117.00"), cả hai kèm test format assertion (RED→GREEN).
- **INF-R1** (Medium) — `config/env.ts` prod `superRefine` guard cho `RESEND_API_KEY`
  (thiếu → email im lặng rớt, đánh dấu SENT); `env.spec.ts` +test yêu-cầu-prod, RED→GREEN.
- **NL-R1** (Medium, GDPR) — `account.service.ts` deleteAccount **xoá hẳn** `Subscriber`
  trùng email (đọc email gốc trước scrub); test mở rộng `auth.int.spec.ts`, RED→GREEN.
  *Quyết định: hard-delete (không soft-unsubscribe) vì account-deletion = right-to-erasure —
  cần anh xác nhận nếu muốn soft thay hard.*
- typecheck + biome xanh. **Còn lại:** refund production BK-R1/PAY-R1 (chờ ADR-0006),
  SEC-1/AUTH-2, các Low.

---

## B. REVIEW — bảng defect v2 tự sinh (đã xác minh)

| id | Phát hiện | Mức | Loại | Anchor |
| --- | --- | --- | --- | --- |
| **BK-R1** | Refund admin + cancellation-approve **đồng thời** → hoàn tiền HAI LẦN (key idempotency khác cấu trúc, không CHECK `SUM≤total`, không lock) | **High** | concurrency/money | `refunds.service.ts:133` · `cancellations.service.ts:384` · migration chỉ `refunds_amount_positive` |
| **PAY-R1** | Booking overbook-cancelled bị re-derive `CANCELLED→REFUNDED` + email hoàn tiền lần 2 khi webhook retry (vi phạm invariant W3 code tự ghi) | **High** | correctness/money-state | `payments.service.ts:134-142,170-176` |
| **ENQ-R1** | Throttle chống spam public-write **bypass bằng spoof `X-Forwarded-For`** (`trustProxy:true` thay vì `1`) | **High** | security/spam | `bootstrap.ts:19` · `app.module.ts:42` |
| **TQ-1** | Nhánh refund-THẤT-BẠI **test-chết**: `FakeGateway.refund` không có fail mode; **0** assertion `REFUND_FAILED`/502 toàn repo → đảo thứ tự ledger↔gateway vẫn xanh | **High** (test) | test-gap | `fake.gateway.ts:88` |
| **SEC-1** | Đăng ký ẩn danh bằng email ∈ `ADMIN_EMAILS` → **auto-promote ADMIN** không cần chứng minh sở hữu (vì `requireEmailVerification:false`) | **Medium**→High* | priv-esc | `auth.config.ts:37,79-85` · test `auth.int.spec.ts:69-79` |
| CAT-R1 | Serialize tiền bằng `.toString()` trần → `39.00`→`"39"`, lệch mọi serializer khác (đều `.toFixed(2)`) | Medium | correctness/contract | `catalog.service.ts:15` |
| TQ-2 | Nhánh `beginEvent` crash-recovery `'retry'` (processedAt=NULL) không test → gộp nhầm thành `'duplicate'` để booking PAID kẹt PENDING | Medium | test-gap | payments int-spec |
| NL-R1 | Tombstone xóa tài khoản **không** hủy/erase `Subscriber` trùng email → vẫn gửi marketing cho user "đã xóa" (GDPR) | Medium | privacy | `auth/*` không đụng Subscriber |
| WRK-R1 | Drain outbox không row-claim; `policy:'short'` chỉ dedupe state *queued* → double-send nếu **≥2 worker** (1 worker an toàn) | Medium | concurrency (điều kiện) | worker drain |
| INF-R1 | `RESEND_API_KEY` **thiếu prod `superRefine`** (khác mọi var prod khác) → deploy sót key thì email im lặng rớt, vẫn đánh dấu SENT | Medium | config/reliability | `config/env` |
| BK-R2 · PAY-R2 · TQ-3 | Chùm TOCTOU auto-refund: `issueFullAutoRefund` không re-check `PENDING`; concurrent → 500; guard `already-refunded` là TOCTOU | Low | concurrency | refunds/payments |
| CAT-R2 | Biên "upcoming departure" theo UTC, không theo ngày-địa-phương (cửa sổ ~7h) | Low | timezone | `catalog.service.ts` |
| SEC-2 | URL reset/verify (token dùng-một-lần) log ra stdout | Low | secret-leak | = AUTH-2 |
| SEC-3 | Không rate-limit app-level cho `/api/auth/*` (Better Auth có built-in) | Low/info | authn | — |
| PAY-R3 | POST webhook PayPal ẩn danh → gọi outbound PayPal mỗi request + lộ chi tiết lỗi provider | Low | resource/info-leak | webhooks |
| NL-R2 | Token unsubscribe HMAC không hết hạn + đảo ngược được (tradeoff có ghi) | Low | security | newsletter |
| WL-R1 · PSM-P5 | `totalPages:0` khi rỗng (lệch `Math.max(1,…)` của reviews) — lỗi convention lặp toàn repo | Low | correctness | wishlist/posts |
| INF-R2 · WRK-R2 · WRK-R3 | 2 pool DB/worker (~20 conn); unsubscribe ngoài try/catch; không backoff (head-of-line block) | Low | infra | worker |
| TQ-4 · TQ-5 · PSM-R1 · PSM-R2 | Nhánh tombstone/no-bookingId không test; posts `pageSize` vs `limit` lệch; site-media không `orderBy` | Low | test/robustness | — |

\*SEC-1 = High nếu địa chỉ `ADMIN_EMAILS` đoán được và chưa đăng ký lúc launch.

---

## Ba chùm gốc (để vá theo cụm, không vá lẻ)

**1. Tiền-RA / refund / webhook-retry — điểm yếu chính.**
BK-R1 (double-refund đồng thời) · PAY-R1 (re-derive state khi retry) · TQ-1 (không
test refund-fail) · BK-R2/PAY-R2/TQ-3 (TOCTOU) · **+ parity gói pending-expiry**
(BK-1/BK-2/PAY-1/WRK-1 — sweep ma chưa port, xem nháp **ADR-0006**). Cùng một mảng.
Gốc chung: các nhánh refund/cancel thiếu **khóa hàng + re-check trạng thái + CHECK
tổng** và **không có đường test thất bại**.

**2. Độ tin cậy email/notification.**
AUTH-2 (reset chưa dây Resend, comment hứa "P2" đã lỡ hạn) · SEC-2 (log token) ·
INF-R1 (không prod-guard key) · WRK-R2/R3 (batch mong manh, không backoff) · NL-R1
(tombstone bỏ Subscriber). Email vừa dễ rớt vừa thiếu lưới.

**3. Bảo mật bootstrap-admin — liên khóa.**
SEC-1 (priv-esc qua signup) + AUTH-1 (bootstrap không self-heal). Vá đúng SEC-1 là
gate `emailVerified===true` — **nhưng email verification đang là `console.log`
(AUTH-2)**, nên phải vá AUTH-2 trước, HOẶC seed admin out-of-band. Ba thứ phải làm cùng.

---

## A. PARITY vs Nexora (tóm tắt — chi tiết ở scratchpad `parity/`)

- **Không invariant lõi nào thụt lùi.** Thụt lùi ở read-shape + vòng đời PENDING + vài mảnh hạ tầng.
- **Should:** CAT-1 (card mất next-departure) · CAT-3 (detail thu M:N→primary) · REV-1
  (`reviews.mine` mất danh tính tour) · INF-1 (mất helmet) · INF-2 (mất Sentry) ·
  AUTH-1 (bootstrap không self-heal) · AUTH-2 (reset email chưa dây — **đã xác minh**) ·
  gói **pending-expiry** BK-1/BK-2/PAY-1/WRK-1 (→ ADR-0006).
- **PAY-4 = by-design** (đã xác minh `booking-states.md`: goodwill-refund KHÔNG trả ghế — v2 sạch hơn, KHÔNG phải thụt lùi).
- **Hạ tầng (so [infra-parity 19/07](2026-07-19-infra-parity-nexora.md)):** #1 CORS · #2
  timeout · #3 health-DB · #4 trust-proxy = **đã vá** (nhưng #4 vá thành `trustProxy:true`
  → đẻ ra **ENQ-R1**). Còn hở: #6 exception-filter · #7 helmet+Sentry · #8 cron PENDING.

---

## Điểm mạnh đã xác nhận (đừng đụng khi vá)

Oversell CHECK `departures_seats_within_total` · atomic PAID claim (EPQ race ×10,
đúng số ghế) · dedupe webhook `[provider,eventId]` unique · refund-math Decimal +
over-refund guard · 403/401 authz cả 3 admin surface (test-proven) · fail-closed
global guard (ADR-0003) · Stripe/PayPal HMAC verify trên raw bytes · visibility
unpublished tour/post/review (mỗi cái viết để giết mutation 72/72) · `role:input:false`
đọc tươi (không cookie-cache) · outbox transaction boundary nguyên tử (không dual-write) ·
`enableShutdownHooks` drain in-flight · không IDOR trên mọi customer surface. **19 invariant.**

---

## Đề xuất thứ tự vá (chỉ đề xuất — chưa đụng code)

**P0 — trước khi mở P3 web / có traffic thật:**
1. **ENQ-R1** — `trustProxy: 1` (một dòng, `bootstrap.ts:19`). Rẻ nhất, chặn spam ngay.
2. **PAY-R1** — gate re-derive orphan bằng `paid_at IS NOT NULL`.
3. **BK-R1** — `SELECT … FOR UPDATE`/advisory lock qua aggregate→gateway→ledger + trigger `SUM(refunds) ≤ total`.
4. **SEC-1** — gate promote `emailVerified===true` HOẶC seed admin out-of-band.
5. **TQ-1** (song song 2-4) — thêm `failRefunds` cho FakeGateway + 3 test failure-path (điều kiện để refactor refund an toàn).

**P1:** gói **pending-expiry (ADR-0006)** · **AUTH-2** dây Resend (mở khóa SEC-1) ·
INF-R1 prod-guard · CAT-R1 money-format · NL-R1 tombstone→Subscriber · TQ-2.

**P2:** các Low · parity Minor · hardening batch INF-1/INF-2 (helmet+Sentry) · WRK-R1
(khi định scale ≥2 worker).

**Kiểm chứng khi vá (bắt buộc):** mỗi fix chùm-1 kèm mutation-test — gỡ lock/CHECK/gate
phải có test ĐỎ; nếu xanh khi gỡ = test không canh gì.

---

## Cảnh báo & giới hạn

- 4 High + SEC-1 **đã tự đọc code xác minh**; các Medium/Low dựa trên một agent (kỷ
  luật chống-FP đã áp, nhưng nên liếc khi vá).
- WRK-R1 chỉ sống khi **≥2 worker**; 1 worker chứng minh an toàn. INF-R1 cần deploy sót key.
- ENQ-R1 giả định ingress *append* XFF (chuẩn của Render/Railway) chứ không overwrite.
- Chưa chạy test/build; thuần đọc tĩnh. Doc này **chưa commit** — để review diff.
- Nháp **ADR-0006** (vòng đời PENDING) đã soạn, trạng thái Proposed — sẽ đưa vào
  `docs/adr/0006-pending-lifecycle.md` khi chốt quyết định, rồi mới code (ADR đi trước, #5).
