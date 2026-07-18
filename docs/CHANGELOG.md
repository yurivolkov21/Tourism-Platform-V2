# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

## 2026-07-18 — P2: Money-path (branch `feat/p2-money-path`)

- **W1** Contract `bookings.{create,mine,byCode}` (procedure authed đầu tiên —
  `@UseGuards` ghép class-level với `@Implement`); **`PaymentGateway`
  interface** + FakeGateway (mô phỏng duplicate/orphaned); create PENDING với
  snapshot, soft seats check (bất biến #1: PENDING không giữ ghế); P2002-retry
  thay pre-flight SELECT của Nexora (đóng TOCTOU).
- **W2** Webhook raw-body + PaymentEvent idempotency (ghi amount/currency/
  bookingId — audit H4). **Atomic claim thiết kế lại sau khi lead review phát
  hiện race EPQ thật** (Nexora miễn nhiễm nhờ connection_limit=1; pool 10 của
  v2 làm race sống dậy): bookings-first claim, trừ ghế vô điều kiện + CHECK
  abort (23514), phân loại follow-up SELECT. Test concurrency ×10 vòng ổn định
  qua 3 lần chạy suite. Review findings: 1 (race — fixed).
- **W3** `refund-math` TDD + RefundsService: partial refund CỘNG DỒN
  (PAID → PARTIALLY_REFUNDED → REFUNDED theo SUM ledger); currency mismatch
  bất khả biểu diễn by construction; orphaned → REFUNDED, overbook → CANCELLED;
  admin refund không nhả ghế (thuộc approve W4). `admin.bookings.{list,byCode,refund}`.
- **W4** Cancellation D1-B: partial unique `WHERE status='REQUESTED'`, lịch sử
  DENIED append-only (đóng audit M7); approve = gateway refund → một CTE
  [Refund row + CANCELLED + nhả ghế + flip request + outbox];
  `booking-states.md` chuẩn hóa 4 terminal states; 23505 adapter-normalized
  (verify thực nghiệm). EmailType += CANCELLATION_APPROVED.
- **W5** Stripe + PayPal test-mode **raw, zero SDK mới** (seam HttpPost
  injectable): HMAC t=/v1= timingSafeEqual + tolerance 5′, PayPal OAuth cache +
  verify-webhook-signature; `money.ts` minor-units Decimal (zero-decimal set).
  Idempotency key 4 flow refund. ResendDeliverer 9 EmailTypes (bind theo env).
- **W6** ADR-0002 (gateway interface + ledger + claim gen-2 + D1-B), docs sweep.
- Tests after: **186** (unit 128 · integration 58 trên PG thật).

## 2026-07-18 — P1: API lõi (branch `feat/p1-api-core`)

- **W1** NestJS 11 **ESM-first** + Fastify (D1 thắng — zero friction, không cần
  fallback CJS): SWC emit + tsc/TS7 typecheck, Vitest qua unplugin-swc, Zod env
  validation fail-fast, `/health`, compose Postgres 17.
- **W2** Prisma schema v2: 30 model (27 port + 4 Better Auth + `Refund` ledger),
  toàn bộ delta audit áp xong (snapshots Booking, PaymentEvent forensics,
  `authorDeleted`, 8 chỉnh index, Decimal 14,2, uuidv7, TourDifficulty enum,
  citext Subscriber). `hardening-v2.sql` = migration thứ hai (CHECK + citext +
  RLS **31/31 bảng**, vá `cancellation_requests` Nexora sót). Seed 177 catalog
  rows + booking PAID có snapshot. Verify sống: CHECK chống oversell nổ đúng,
  citext khớp case-insensitive.
- **W3** Better Auth 1.6.23 tại `/api/auth/*`: `generateId:false` (id base62
  mặc định của BA sẽ vỡ cột uuid — phát hiện quan trọng), `role input:false`,
  ADMIN_EMAILS bootstrap promote-only, AuthGuard chặn session user tombstone.
  `DELETE /api/account` = tombstone MỘT transaction (scrub PII, email
  `deleted+uuid@tombstone.local` giải phóng email gốc, xóa sessions/accounts,
  flip `Review.authorDeleted`) — chủ đích không dùng BA deleteUser (hard-delete
  vs FK Restrict).
- **W4** `@tourism/contract` (Zod 4 + oRPC) + CatalogModule qua `@orpc/nest`
  `@Implement`: `/api/tours` (+filters/pagination), `/api/tours/{slug}` (404
  typed), `/api/destinations`, `/api/categories`, `/api/health`.
  ZodSmartCoercionPlugin giữ schema thuần cho client types. expectTypeOf chứng
  minh `ContractRouterClient` suy `Paged<TourCard>` — **zero codegen**.
- **W5** Worker pg-boss 12 process riêng (`dist/worker.js`, ESM thuần — hết
  dynamic-import): cron `outbox-drain` 1′ (batch 50, MAX_ATTEMPTS 5, updateMany
  guard chống resurrect) + `outbox-purge` SENT >30d (giữ FAILED). Deliverer
  console sau token EMAIL_DELIVERER (P2 thay Resend). Smoke bắt tick cron thật.
- **W6** Docker: multi-stage Dockerfile (kiêm artifact deploy) + compose trọn hệ
  (postgres + migrate one-shot idempotent + api + worker). Quy ước dedupeKey
  văn bản hóa (`docs/conventions/outbox-dedupe-key.md`).
- Tests after: **63** (unit 22 api + 22 libs · integration 19 trên PG thật).

## 2026-07-18 — P0: khung xương monorepo

- Khởi tạo repo trong WSL: pnpm 11 + Turborepo 2.10 · TypeScript 7.0 (tsgo) ·
  Biome 2.5 · Vitest 4.1 · Node 24. `.gitattributes` ép LF toàn repo.
- Port từ Nexora (chỉ đọc): `@tourism/tokens` (Style Dictionary + RN hex theme,
  build artifact `generated/` chuyển sang gitignore + turbo outputs) và
  `@tourism/i18n` (messages + legal). Chuyển targets Nx → package scripts +
  turbo; Jest → Vitest (globals mode, spec giữ nguyên trừ 1 chỉnh
  `noUncheckedIndexedAccess` trong `rn-convert.spec.ts`).
- Docs skeleton: ADR-0001 (tech stack), CLAUDE.md, README. CI GitHub Actions.
- Tests after: **7** (tokens 5 · i18n 2, chuyển từ Jest sang Vitest).
