# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

## 2026-07-22 — P3a contract closeout: C1·R1·R2 (branch `feat/p3a-contract-closeout`)

Đóng 3 gap hình dạng contract customer/admin API TRƯỚC khi mở P3b Web (đổi sau = rework
component), theo [spec](specs/2026-07-21-p3a-contract-closeout-design.md) —
parity từ [sweep parity toàn code](analysis/2026-07-21-full-parity-sweep-pre-p3ab.md).
3 commit feat `7319426..728c020`, mỗi cái TDD (không ADR — thuần additive; không migration):
- **C1** (`7319426`) `TourCard`/`TourDetail` trả `destinations[]` (`{slug,name,isPrimary}`, primary
  đứng đầu) thay `primaryDestination` đơn — tour đi qua nhiều nơi không còn mất destination phụ.
  `cardInclude` bỏ `where isPrimary/take:1`.
- **R1** (`810a724`) `reviews.mine` thêm `tourSlug`/`tourTitle` (+ `include tour`) — trang "Đánh giá
  của tôi" hiện tên + link tour.
- **R2** (`728c020`) `admin.reviews.list` thêm filter `source`/`rating`/`search` (body/title/tên) +
  output `moderatedBy`(tên admin)/`tourTitle`. Chỉ include (FK `moderatedById` có sẵn), không migration.
  PII khách (email) cố ý không phơi (admin UI P4 chưa xây).

Quyết định shape (chốt với user): C1 bỏ hẳn `primaryDestination` (web chưa xây → đổi contract free);
R2 không userEmail. Không mutation-test (không phải logic money/security; test filter đã discriminating).
Tests after: `pnpm gate:int` xanh (141 integration).

## 2026-07-21 — Refund correctness: đóng tiền-RA (branch `feat/refund-correctness`)

Sub-project B của "chùm refund" — vá ba gốc double-refund/resurrection ở đường tiền-RA
theo [ADR-0009](adr/0009-refund-correctness.md), 8 commit `47d906d..96cc1a6`, mỗi bước
TDD + mutation-proof:
- **BK-R1** (`7e90bbc`·`666f3c6`·`f2bd9c4`) trigger DB `SUM(refunds) ≤ total` (lưới cứng)
  + `withBookingRefundLock` (advisory `pg_advisory_xact_lock` per-booking bao
  read→gateway→ledger) bọc `refundByAdmin` VÀ `cancellations.approve` — hai admin refund
  đồng thời, hoặc refund‖cancel-approve cross-path, giờ serialize: đúng 1 refund + 1 gateway
  call, flow thua nhận `RefundNothingLeftError`. Mutation gỡ lock → double-refund `[200,200]`/500 ĐỎ.
- **PAY-R1** (`23b30b9`) `refundOrphanedCapture` chỉ re-derive REFUNDED khi refund vừa phát
  MỚI (`issueFullAutoRefund='refunded'`); `'already-refunded'` (booking đã refund qua
  overbook/W4) → giữ CANCELLED, không email lần hai. **Sửa cơ chế ADR** (`1572f98`): bỏ gate
  `paid_at` (không phân biệt được overbook-retry với orphan-thật — cả hai NULL; lại phá test
  orphan + bỏ sót ca W4). Vá luôn W4-cancelled resurrection.
- **TOCTOU** (`96cc1a6`) bọc `issueFullAutoRefund` bằng cùng advisory lock, re-check
  existing-Refund trong lock → hai webhook auto-refund đồng thời (eventId khác) chỉ gọi
  gateway 1 lần. Mutation gỡ lock → double gateway `[200,500]` ĐỎ.

Ngoại lệ có chủ đích của "gateway ngoài transaction" (giữ 1 connection lúc HTTP) — giới hạn
cho đường refund hiếm, đổi lấy money-integrity (ADR-0009 §Quyết định 1). Đánh đổi PAY-R1:
crash đúng khe của orphan-thật → kẹt CANCELLED (tiền vẫn hoàn đủ; orphan-thật = pending-expiry
của sub-project A chưa dựng). Tests after: `pnpm gate:int` xanh (140 integration).

## 2026-07-21 — Admin bootstrap emailVerified-gated + AUTH-2 email (branch `feat/admin-bootstrap-verified`)

Đóng **SEC-1** (priv-esc) + **AUTH-1** (no self-heal) + **AUTH-2** (email chưa dây)
theo [ADR-0008](adr/0008-admin-bootstrap-verified.md) — 8 commit `8283fbd..112fd0a`,
mỗi bước TDD + mutation-proof:
- **AUTH-2** (`51d3ebf`·`37c4593`·`2833f9e`) EmailType +PASSWORD_RESET/EMAIL_VERIFICATION;
  `sendResetPassword`/`sendVerificationEmail` ghi outbox → Resend (thay console.log);
  `sendOnSignUp:true`. Vá luôn reset-mật-khẩu prod đang hỏng.
- **AUTH-1** (`bb7c43b`) `reconcileAdmins` + `AdminReconcileService` (OnApplicationBootstrap)
  — self-heal promote email thêm vào `ADMIN_EMAILS` sau, promote-only.
- **SEC-1** (`648da2a`) bỏ auto-promote signup-hook; promote qua `afterEmailVerification`
  (chỉ sau khi chứng minh sở hữu email). `requireEmailVerification` giữ false — khách
  không bị chặn, verify chỉ gate đặc quyền admin.
- **Ripple test** (`112fd0a`) fixture int: admin promote thẳng DB sau signup (guard đọc
  role tươi); lọc `EMAIL_VERIFICATION` khỏi assertion đếm outbox.

Edge email-squatting ghi nhận trong ADR (không priv-esc). Tests after: `pnpm gate:int` xanh.

## 2026-07-21 — Vá parity nhỏ CAT-4 · BK-3 · ENQ-1 (branch `worktree-fix+enquiry-name-min2`)

Ba finding parity **Nhỏ** còn lại từ đợt rà soát (khôi phục quy tắc Nexora), làm ở
branch song song, rebase+ff lên main — 2 commit `098e92d..9b74186`, kèm test contract:
- **ENQ-1** (`098e92d`) enquiry `name` `min(1)`→`min(2)` — parity `@MinLength(2)`.
- **CAT-4 + BK-3** (`9b74186`) `TourSortKeySchema` + `SORT_COLUMN` thêm `updatedAt`;
  booking `contactPhone` `min(1)`→`min(6)` — parity `@Length(6,30)`.

Tests after: `pnpm gate:int` xanh (128 integration).

## 2026-07-21 — Rà soát độc lập + vá P0 batch (branch `fix/review-p0-batch`)

Rà soát độc lập toàn `apps/api` (parity vs Nexora + review defect v2 tự sinh, fan-out
8+6 agent, tự kiểm chứng 4 High) — báo cáo
[independent-review](analysis/2026-07-21-independent-review.md). Vá 6 finding
an-toàn/không-cần-ADR (5 commit `d776d02..2a0cff3`), mỗi cái TDD + mutation-proof:

- **ENQ-R1** (`d776d02`) `trustProxy:1` (không `true`) — throttle chống spam bypass
  được bằng spoof `X-Forwarded-For`; +e2e regression (đỏ dưới mutation `true`).
- **TQ-1** (`c654b2e`) `FakeGateway.failRefunds` + int test nhánh refund-thất-bại
  (502 · không ledger/outbox · giữ PAID) — nhánh W3 trước đây test-chết.
- **CAT-R1** (`b07fc1e`) serialize tiền `.toFixed(2)` ở `catalog` VÀ `bookings` API
  response ("39"→"39.00") — lệch mọi serializer khác; test cũ so-bằng-`Number` không bắt.
- **INF-R1** (`024f459`) prod-guard `RESEND_API_KEY` — thiếu → email im lặng rớt (SENT giả).
- **NL-R1** (`2a0cff3`) `deleteAccount` xóa HẲN `Subscriber` trùng email (GDPR erasure;
  chốt hard-delete: bảng lá, nhất quán scrub-PII của User tombstone).

Kèm **[ADR-0006](adr/0006-pending-lifecycle.md)** trạng thái **Proposed** (vòng đời
PENDING) — chùm refund production (BK-R1/PAY-R1) + SEC-1/AUTH-2 chờ chốt ADR/hướng
mới code. Tests after: `pnpm gate:int` xanh (128 integration).

## 2026-07-21 — P3a-C: Posts · Site-media (branch `feat/p3a-c-posts-site-media`)

Hai module ĐỌC công khai cuối của P3a — blog (`posts.{list, bySlug, tags}`) và
`siteMedia.list` — cùng hạ tầng **media-đọc** (dựng Cloudinary URL) mà v2 chưa
từng có. 7 commit feat `8f5dc97..8c5fc79`. Thực thi subagent-driven (7 task,
mỗi task 1 implementer + 1 review).

Hai ADR đi trước code (luật 5):
- **[ADR-0004](adr/0004-post-visibility-helper.md)** — helper bắt buộc
  `publishedPostWhere()`: mọi path public đọc Post lọc `status=PUBLISHED ∧
  publishedAt<=now()`. Loại Prisma extension (cản admin P4) + repository wrapper.
- **[ADR-0005](adr/0005-media-read-build-url.md)** — API dựng & trả Cloudinary
  URL lúc đọc (chỉ cần `CLOUDINARY_CLOUD_NAME` công khai, không secret upload).
  Web dumb; đổi transform không phải migrate.

- **T1** (`82e1529`) Helper thuần `buildCloudinaryUrl` + env
  `CLOUDINARY_CLOUD_NAME` (default dev, chặn prod). Review bắt 2 Important:
  implementer (haiku) **tự thêm `Co-Authored-By: Claude`** vào commit — vi phạm
  luật 12, amend bỏ; guard prod thiếu test hai chiều → thêm theo khuôn sibling.
- **T2** (`f65a3fa`) `MediaService.resolveForOwners` — resolve batch (MỘT
  query, chống N+1) → `Map<ownerId, MediaItem[]>` đã dựng URL. Tie-break
  hero-đầu dựa Postgres sort enum `MediaRole` theo declaration order.
- **T3** (`74174f1`) `publishedPostWhere()` (ADR-0004). Fix: test đổi cast
  `as {lte}` → `expect.any(Date)` (tuân luật không-cast).
- **T4** (`58acc83`) `posts.list` — card GỌN (không `content`), cover role
  `hero`, tie-breaker `[{sort},{id:desc}]`, lọc tag, search title. `pageSize`
  (query) → `limit` (output). Mutation-test ADR-0004: bỏ guard → bài
  future/draft lọt, test đỏ.
- **T5** (`7c634e3`) `posts.bySlug` — detail đầy đủ + full media + related
  tours (dùng `toTourCard` catalog, **KHÔNG media**, tour unpublish rớt âm
  thầm). Draft/future → `POST_NOT_FOUND` 404, không phân biệt với không tồn tại.
- **T6** (`0ac24c2`) `posts.tags` — tag có ≥1 bài published + `count`, MỘT
  query `_count` nested where (chống N+1), order name asc, path `/api/posts-tags`.
  Review bắt Minor "order-assert vacuous" (mảng 1 phần tử → luôn đúng) → thêm
  tag-mixed (published+draft+future, count phải =1) + tên đảo thứ tự tạo.
- **T7** (`8c5fc79`) `siteMedia.list` — đọc `site_media_slots`, resolve batch
  `SITE`, chỉ trả slot CÓ media. YAGNI: không tạo slot-catalog (việc admin P4).

**Final review toàn nhánh** (model mạnh nhất) — Ready to merge: **Yes**, không
Critical/Important. Xác nhận cả 8 bề mặt (visibility 3 path canh thật · N+1 sạch
· enum SITE/POST · `@Public()` 2 controller · related-tours-no-media ·
no-cast-kể-cả-test · coherence). Đính chính: `cover=media.find(role==='hero')`
ROBUST với sort order (find theo predicate, không vị trí) — hero-first rủi ro
thấp. Nếp mutation-test hai chiều áp cho cả 3 path visibility + honeypot filter.

**Bài học quy trình:** implementer subagent (nhất là model rẻ) có xu hướng tự
thêm AI attribution — từ Task 2 trở đi brief nhấn mạnh + kiểm `git log` sau mỗi
task, không tái phạm.

**Cố ý để lại (cleanup đợt sau, không chặn merge):** `siteMedia` findMany
thiếu `orderBy` (thứ tự phi tất định — web tra theo `key` nên không hại) ·
literal `'demo'` lặp tay ở `env.ts` (nên tách hằng `DEV_*`) · thiếu comment
cảnh báo THỨ TỰ cạnh enum `MediaRole` (schema chỉ cảnh báo đổi TÊN) · khoảng
trống phủ test (phân trang page 2, video có poster URL tuyệt đối).

- Tests after: **361** (234 unit — api 175 · contract 51 · tokens 7 · i18n 1 —
  + 127 integration), `gate:int` xanh.

## 2026-07-19 — P3a-B: Wishlist · Enquiry · Newsletter (branch `feat/p3a-b-customer-writes`)

Ba endpoint GHI công khai đầu tiên (khách chưa đăng nhập gọi được) + hạ tầng
rate limiting đi kèm. 16 commit, `6d3d49c..8a5d71c`.

- **T1** (`33fb899`..`35706bf`) `EmailType.ENQUIRY_ADMIN_ALERT` + template
  deliverer. Security review tự động báo XSS → **dương tính giả** (`f()` đã
  escape đủ; fix nó đề xuất sẽ escape hai lần), nhưng chạm đúng lỗi thật kề
  bên: subject là plain text KHÔNG được escape → thêm `subjectText()` + cắt
  CR/LF chặn header injection. Review còn bắt lỗi trong **chính plan**:
  `deliver()` lấy người nhận từ `payload.email`, mà Task 4 dùng chung payload
  cho ack khách + alert admin → alert bay về hộp thư khách. Thêm `to` thắng
  `email`, vá luôn plan.
- **T2** (`0370206`, `fcb0397`) Rate limiting cho endpoint ghi công khai. Test
  không canh được `trustProxy` của `main.ts` (reviewer tái hiện: gỡ khỏi
  `main.ts` mà suite vẫn xanh) → `createFastifyAdapter()` dùng chung.
- **T3** (`a2ec198`) Wishlist set/list/check idempotent + cờ `unavailable`.
- **T4** (`b232c66`..`477b457`) Enquiry công khai: honeypot, throttle, outbox
  kép trong `$transaction`. Implementer tự phát hiện gỡ `$transaction` mà
  KHÔNG test nào đỏ → thêm test atomicity ép outbox thứ hai hỏng. Review (7
  mutation độc lập) bắt 2 Important: 6/10 field input không test nào chạm
  (hoán đổi `nationality`/`budgetTier` mà 8/8 vẫn xanh) · `adminEmails[0]`
  fallback **im lặng** về email khách khi `ADMIN_EMAILS=" "` — bug A13 quay
  lại đường khác → fail-fast ở `env.ts` + `primaryAdminEmail`.
- **T5** (`5fb13a4`..`c8665fa`) Newsletter subscribe im lặng chống dò email.
  Review bắt **Critical** (chạy thật trên DB, đo được 2 dedupeKey): email chưa
  normalize khi ghép `dedupeKey`. `Subscriber.email` là `citext` nhưng
  `Outbox.dedupeKey` là `VarChar` thường → `Jane@X.com` vs `jane@x.com` ra hai
  key → welcome gửi **2 lần**. Test cũ tưởng phủ ca này nhưng chỉ assert
  `subscriber.count()`, không nhìn outbox.
- **T6** (`97eef44`, `d991054`) Unsubscribe tự phục vụ, token HMAC, tách
  GET/POST (GET thuần đọc — email client prefetch link để quét virus). I1:
  đăng ký lại sau khi huỷ là ngõ cụt câm lặng → `resubscribe` dùng LẠI token
  HMAC làm bằng chứng chính chủ, **bắt buộc POST** (GET sẽ bị prefetch tự
  đăng ký lại đúng người vừa huỷ). I2: link huỷ vào email welcome + header
  `List-Unsubscribe`; **cố ý không** one-click RFC 8058 (mail provider POST
  body không khớp schema JSON).

**Final review toàn nhánh** (3 reviewer song song, mảng tách rời) — 7 phát
hiện đã vá (`f0d4528`, `8a5d71c`):

- **Honeypot enquiries phân biệt được với thành công**: trả `{id: null}` còn
  nhánh thành công trả `{id: <uuid>}` → bot đọc body là biết mình bị bắt. Ba
  comment + JSDoc contract đều *khẳng định* tính chất mà code không có. Sửa:
  trả uuid giả không bao giờ persist; siết `EnquiryResultSchema` sang
  non-nullable (contract nói dối thì sửa contract).
- **Guard "đã huỷ bản tin" không có test canh phạm vi**: xoá
  `NEWSLETTER_EMAIL_TYPES.has(row.type) &&` khiến guard chặn MỌI loại email
  mà **110/110 test vẫn xanh** → người huỷ bản tin sẽ mất luôn
  `BOOKING_CONFIRMATION`. Lần verify thủ công trước đây (`sent:2`) chưa bao
  giờ được commit. Đã commit test canh.
- **Guard đọc `payload.email` còn deliverer ưu tiên `payload.to`** → loại email
  tương lai mang `to` sẽ bị kiểm đồng thuận ở địa chỉ này, gửi tới địa chỉ
  kia. Gộp về `resolveRecipient()` dùng chung.
- **Wishlist `createdAt` không được pin**: mutation `update: {createdAt}` qua
  6/6 test. `createdAt` quyết thứ tự list → sentinel `2000-01-01`.
- **Oracle `@updatedAt` biên chỉ 4–19ms** (đo 25 lần) → đổi sang sentinel,
  biên ~26 năm, hết phụ thuộc timing.
- **`website` honeypot không giới hạn độ dài và bị log nguyên văn** — field
  user-controlled DUY NHẤT không có `.max()` (các field anh em đều có). Log
  injection qua CR/LF, ~1MB/request. Sửa: **cắt ngắn 200 ký tự chứ không
  reject** — Fastify parse hết body TRƯỚC khi zod chạy nên reject không tiết
  kiệm gì mà lại trả 400, dựng lại đúng tín hiệu lộ honeypot vừa xoá ở trên.
- **`subscribe()` ghi subscriber + outbox không transaction** trong khi
  `enquiries` có → bọc `$transaction` cho khớp bất biến outbox-producer.

Nếp mutation-test hai chiều bắt thêm 2 ca "xanh mà không canh gì": int test
**không thể** quan sát truncation (giá trị không vào DB, cũng không còn vào
log) → gỡ `.transform()` mà 114 int vẫn xanh, phải thêm `honeypot.spec.ts` ở
tầng contract. Tổng 26+ mutation, 23 bị bắt ngay.

**Cố ý để lại** (không phải quên): `timingSafeEqual` → `===` không test nào
bắt được — side-channel timing không thể canh bằng assertion giá trị, ghi nhận
thay vì dựng test giả · `subjectText` trả `''` với tên toàn CR/LF và case body
thiếu `??` (zod `.trim().min(1)` chặn từ tầng trên) · N+1 `findUnique` trong
drain (≤50 query/phút) · row bị skip vẫn ghi `SENT` — cần `OutboxStatus.SKIPPED`
tức là migration mới, không phải blocker · `trustProxy: true` khiến khoá
throttle giả mạo được qua `X-Forwarded-For` (phụ thuộc cách deploy) · throttler
in-memory nên trần là per-process.

**Nợ chưa trả — đến hạn ở P3b, KHÔNG chặn P3a-C** (ghi rõ để không tưởng đã
xong): link huỷ đăng ký trong email welcome trỏ tới `apps/web/` — hiện mới chỉ
có `.gitkeep`. Không chặn Posts/Site-media (P3a-C) vì hai module đó không đụng
web; đây là **điều kiện tiên quyết trước khi bật `RESEND_API_KEY` ở
production**, mà trang unsubscribe thuộc web (P3b). Chừng nào Resend chưa bật
thì chưa cắn, nhưng nghĩa là **lý do GDPR của T6 chưa đạt đầu-cuối**. Liên
quan: chỗ DUY NHẤT user nhận được token resubscribe là email welcome vốn chỉ
gửi một lần vĩnh viễn (`dedupeKey` theo email) → ca "tôi xoá mất email rồi" vẫn
là ngõ cụt. I1 coi như **đóng một nửa**.

- Tests after: **340** (226 unit — api 167 · contract 51 · tokens 7 · i18n 1 —
  - 114 integration), `gate:int` xanh.

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
