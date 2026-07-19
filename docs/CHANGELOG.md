# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

## 2026-07-19 — Đợt vá sau P3a-A (8 merge nhỏ vào `main`)

Bắt nguồn từ việc user phát hiện v2 **thiếu rate limiting** trong khi Nexora
có — rồi rà lại đúng tầng thì lòi ra nhiều hơn.

- **Env** (`8958e95`, `938dc6b`, `aad7131`): `superRefine` chặn `DATABASE_URL`
  mặc định ở production (bỏ sót cạnh 2 guard đã có). Biến rỗng `KEY=` là
  **chuỗi rỗng** chứ không phải undefined nên `.default()` không chạy còn
  `.min(1)` fail — copy file mẫu rồi để trống 9 biến optional là app không
  boot; nền tảng deploy cũng gửi chuỗi rỗng khi ô bị bỏ trống. Chốt quy ước
  tên `.env.local` / `.env.production` / `.env.example`, `.gitignore` viết
  không kèm đường dẫn để app sinh sau tự được che (verify 13 trường hợp).
- **Supabase** (không commit — thao tác hạ tầng): `migrate deploy` + seed lên
  Session pooler, 33 bảng khớp local, `citext` 1.6, pg-boss chạy trọn vòng
  đời. Direct connection IPv6 **không tới được từ WSL** (đã đo).
- **Hạ tầng** (`b407c68`): CORS thiếu hoàn toàn (chặn cứng P3b) · `trustProxy`
  (thiếu là rate limit sau này tự DoS) · health probe chạm DB, 503 khi hỏng ·
  `provider-http` timeout 15s (`fetch()` trần không có timeout mặc định —
  money-path đã chạy thật). Tách `configureHttp()` sang `bootstrap.ts` để test
  chạm được. Mutation-test cả 4.
- **Catalog** (`d88487d`): P3a xây `ratingAvg/ratingCount` xử lý race rất kỹ
  nhưng catalog **chưa hề đọc ra** — dữ liệu trong DB mà FE không lấy được.
  Thêm `toursCount` cho category (chỉ đếm tour đã publish).
- **Auth** (`e5c382a`, [ADR-0003](adr/0003-auth-fail-closed.md)): đảo mặc định
  sang **fail-closed** — `APP_GUARD` toàn cục + `@Public()`. Test canh chính
  cái mặc định bằng cách đăng ký controller mới không khai gì ngay trong test.
- **Docs** (`de61748`, `12f1db4`, `bfcf5a8`): quét sâu 1.377 file Nexora,
  bảng theo dõi A1–A11 (A1/A5/A9 đã vá). Bác bỏ 1 dương tính giả (`seatsLeft`
  clamp — CHECK constraint khiến trạng thái đó bất khả thi). CLAUDE.md thêm
  luật 10: chủ động đối chiếu Nexora ở CẢ hai tầng trước mỗi phase.
- Tests after: **284** (204 unit + 80 integration), `gate:int` xanh, CI xanh.

## 2026-07-19 — P3a-A: Nền chung + API reviews (branch `feat/p3-customer`)

- **T1** Schema query dùng chung: `PageQuerySchema`, `SearchQuerySchema`,
  `sortQuerySchema(keys)` generic suy ra literal union (không phải `string`).
- **T2** Migration `p3a_customer`: `Tour.ratingAvg/ratingCount`,
  `Review.featuredRank`, `Subscriber.unsubscribedAt/updatedAt`,
  `Enquiry.email → citext`, bảng `ReviewModerationEvent`, CHECK
  `reviews_source_shape`. ⚠️ DROP+ADD trên `enquiries.email` và
  `subscribers.updated_at NOT NULL` — fail cứng (rollback, KHÔNG mất data
  âm thầm) trên DB có dữ liệu; phải viết migration MỚI trước khi staging
  P3b có traffic thật.
- **T3** `checkReviewEligibility` TDD thuần: ownership kiểm TRƯỚC status
  (không rò trạng thái booking người khác), so sánh calendar-day UTC.
- **T4** `reviews.create` — P2002 → 409 `REVIEW_ALREADY_EXISTS`.
- **T5** `admin.reviews.moderate` transaction 4-trong-1: flip trạng thái +
  audit trail append-only + recompute rating + outbox dedupe. **Review phát
  hiện lost update** khi duyệt 2 review cùng tour song song. Cách sửa đầu
  tiên (gộp một câu `UPDATE … FROM (SELECT …)`) **đo thực nghiệm cho thấy
  VẪN sai** — EvalPlanQual không tính lại subquery khi statement chờ lock.
  Fix đúng: `SELECT … FOR UPDATE` ở statement riêng. Lần thứ hai EPQ cắn dự
  án (lần đầu: claim ghế P2-W2) → [read-then-write-races.md](conventions/read-then-write-races.md).
- **T6** `reviews.listByTour` + `reviews.mine` (endpoint spec W1 có nhưng
  **plan bỏ sót**, phát hiện khi review) + integration suite vòng đời.
  Review findings: rating tour bị testimonial `CURATED` đội lên (gate theo
  `tourId` thay vì `source`), và test canh nó là **test rỗng trá hình**.
- **Final review (mutation-test)**: xoá `@Roles(ADMIN)` khỏi controller admin
  → 72/72 test vẫn xanh; xoá `isApproved`+`isPublished` khỏi list công khai
  → vẫn xanh. Nguyên nhân gốc: `gate` chưa bao giờ chạy integration test và
  CI không có Postgres — một int spec hỏng từ T2 sống tới T6. Đã nối
  `test:int` vào turbo + CI service; `gate:int` giờ là điều kiện khai xong.
  Cũng vá: tombstone bật cờ mà quên scrub `authorName` (spec §4.2).
- Review findings: 3 Important (lost update rating · CURATED đội rating ·
  bề mặt bảo mật không có test canh) + 1 Important hạ tầng (int test không
  có lưới) — tất cả đã fix. Bác bỏ 1 đề xuất của chính controller (thống
  nhất outbox `refunds` theo `reviews` — hai `dedupeKey` khác ngữ nghĩa).
- Tests after: **266** (189 unit + 77 integration), gate:int xanh.

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
