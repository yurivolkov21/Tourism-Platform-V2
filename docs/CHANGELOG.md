# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

> Entry cũ hơn 30/07/2026 nằm trong `changelog/` — file này chỉ giữ phase đang chạy:
> [P3b tĩnh 22–28/07](changelog/2026-07-p3b-static.md) ·
> [P0→P3a backend 18–22/07](changelog/2026-07-p0-p3a-backend.md).
> Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`) — archive là di chuyển
> nguyên văn, không sửa một ký tự.

## 2026-08-06 — Cụm A bước 8–10: hạ tầng session client + khu Account 6 route sống thật (branch `feat/account-area`, ff-only, 12 commit `c88b2c0..2cebb8b`)

Cụm lớn nhất P3b (51 file, hơn 4.100 dòng), đi trọn quy trình static-first
HAI PHA user yêu cầu: T1–T4 dựng tĩnh trên mock gương contract → **mốc DỪNG
T5 user duyệt visual trên localhost** (2 fix từ vòng test của user: checklist
mật khẩu sang lưới 2 cột; giải oan "Alex Nguyên là ai" = mock A1 vs session
thật ở navbar) → T6a/T6/T7 wire thật → T8 nghiệm thu sống. User chốt kèm
tuyên bố: visual mức dựng-tạm, KHU ACCOUNT SẼ THIẾT KẾ LẠI ở session khác.

- **Hạ tầng session client (nửa còn lại ADR-0017):** `proxy.ts` matcher chỉ
  `/account/:path*` (kiểm cookie tồn tại, nhận cả tên `__Secure-` cho prod
  https) + defense-in-depth `requireSession` từng page + `getServerSession`
  React-cache + đường gọi authed (browser `credentials: 'include'`; server
  cookie-forward + `no-store`, tách hẳn cache catalogue).
- **6 route:** dashboard (stats/nextTrip/upcoming/saved) · bookings list
  (badge tone một nguồn `booking-vm`, Load more theo pagination contract) ·
  booking detail (hành động theo máy trạng thái: PENDING pay-now/cancel;
  PAID request-cancellation 3 biến thể) · profile hợp nhất (updateUser +
  changePassword + danger-zone gõ-DELETE; avatar/đổi-email PARK có hồ sơ) ·
  security → redirect 308 (parity Nexora) · saved (optimistic + rollback).
- **Mở rộng contract có phép (user duyệt 06/08):** `bookings.byCode` thêm
  `cancellationStatus` (request mới nhất — enum thật REQUESTED/REFUNDED/
  DENIED; plan ghi nhầm APPROVED, implementer bắt và theo code).
- `mocks/account.ts` sống đúng một cụm rồi khai tử (0 hit).

**Review findings (9 vòng task + final fable + 3 vòng fix) — 4 bug thật:**

1. **CORS chặn DELETE từ MỌI browser** (smoke sống T7 bắt): `@fastify/cors`
   v11 mặc định chỉ GET/HEAD/POST — route `DELETE /api/account` (duy nhất
   trong contract) chết ở preflight từ khi sinh ra; offline test không thấy
   vì inject không qua preflight. Vá bootstrap khai `methods` tường minh +
   e2e canh. Cùng lớp giá trị với smoke ADR-0002.
2. **Proxy đá user đã đăng nhập trên prod https** (final review bắt): chỉ
   kiểm tên cookie trần, BA gắn `__Secure-` khi baseURL https → lockout
   loop /account. Vá nhận cả hai tên + spec 3 ca RED-proof + trích source
   `SECURE_COOKIE_PREFIX` làm bằng chứng.
3. **Link chết tour unavailable** ở preview saved của dashboard (review T3
   render sống chứng minh) — vá tái dùng `UnavailableCard` một nguồn.
4. **Lỗ test orderBy "mới nhất"** của cancellationStatus (reviewer T6a
   mutation-bite: đảo asc vẫn 158/158 xanh vì test chỉ có 1 row) — vá test
   2-row re-request, bite được xác nhận độc lập.

**Sự cố quy trình (ghi để không tái diễn):** implementer T7 build `.next`
trong `apps/web` khi dev server của user đang chạy cùng thư mục → crash dev
server của user. Rule có trong memory nhưng CHƯA từng nằm trong brief —
từ nay mọi brief có khả năng build web bắt buộc kèm lệnh cấm + đường
worktree tạm (T8 đã chạy đúng kiểu worktree + cổng 3002/3003).

**Nợ ghi sổ (phân loại ở final review):** textarea lý do hủy — spec §3 đòi
nhưng A1 bỏ sót, khoá không-đụng-visual chặn fix → làm khi redesign khu
account (session user tự lo) · terminal-note "số tiền đã hoàn" không nguồn
(BookingSchema khách không mang ledger — M-2, cân thêm field khi cần) ·
DENIED không hiện lý do admin (privacy hợp lý; cân fallback "contact
support") · Load-more cap 50 không lối thoát khi >50 booking · user-menu
label hardcode (có TRƯỚC branch, `auth.menu.*` mồ côi) · connected-accounts
một dòng cứng (sẽ nói dối khi bật Google) · saved-grid 401 thiếu nhánh
sessionExpired · PayPal checkout UI chưa đo trong cụm (env dev thiếu
webhook id; đường PayPal đã smoke ở cụm ADR-0002).

**Tests after:** web **900** unit (74 file; +47 của cụm) · api **209** unit
và **158** int (+5 SEC/orderBy/CORS mới) — `gate:int` 1343 test tổng, CI
branch run `30977237984` success trước merge. Nghiệm thu sống: vòng đời
đăng-ký→booking→hủy→xoá-tài-khoản đo bằng playwright + SQL; proxy và page
redirect đo TÁCH LỚP; trang public giữ ISR HIT xuyên suốt.

## 2026-08-04 — Nâng Next 16.3.0 và phủ TypeScript 7 cho web/ui — toàn repo một đời TS (branch `chore/nang-next-16-3-phu-ts7`, ff-only, 1 commit `4ece778`)

Cửa sổ trước freeze tận dụng đúng lúc: Next 16.3.0 GA 03/08 (một ngày trước)
với hỗ trợ TS7 chính thức cho `next build`. Nâng `next` 16.2.11 → 16.3.0 và
`typescript` `^5` → `7.0.2` ghim cứng ở `apps/web` + `libs/shared/ui` — từ
nay CẢ REPO chạy một đời TS 7 (tsgo). Đổi code đúng MỘT dòng:
`libs/shared/ui/tsconfig.json` thêm `"types": ["node"]` — tsgo không tự gom
mọi `@types` trong node_modules như TS5 (API sống sót từ đầu nhờ đã khai
tường minh). Đo được: build web 28s → 19s; typecheck toàn workspace 2.6s;
KHÔNG breaking (`revalidateTag` 2-arg + `{expire: 0}` nguyên vẹn — thiết kế
ổn định từ 16.0). Nghiệm thu production: sitemap 52 URL · soft-404 404 thật ·
ISR HIT · auth/blog 200; `gate:int --force` xanh trọn; CI branch run
`30879275087` success trước khi merge (nếp mới sau luật 14).

**Phát hiện ngoài lề trong lúc đo — DB dev có 21 tour ZOMBIE** (series id
`d0000001-…` thời mock, sitemap phồng 72 URL): root cause chốt được cho món
nợ "điều tra compose-seed" ghi 03/08 — **compose service `migrate` mang image
build cũ** (fixtures roster cũ nướng bên trong), container restart là nó chạy
seed cũ, chèn 21 tour rồi gãy giữa chừng ở FK `tourDestination` (seed không
transaction). User đã `migrate reset` + seed lại (DB về 30 tour chuẩn). Nợ
đổi trạng thái: hết "điều tra", thành việc cụ thể — **rebuild image
(`docker compose build migrate`) hoặc gỡ service `migrate` khỏi compose**;
kèm bài học vận hành: seed nên chạy trong transaction để không bao giờ chèn
nửa chừng. Bài học đo đạc cùng phiên: pkill theo pattern có thể tự giết
shell của chính mình (lệnh chứa chuỗi khớp) và server cũ chưa chết hẳn sẽ
ghi ISR đè vào build mới — kill theo PID của cổng, xác nhận cổng `000` rồi
mới build/đo.

**Tests after:** không đổi số test (805 web · 208 api unit · 156 int) —
gate:int --force + CI full pipeline đều xanh trên `4ece778`.

## 2026-08-04 — Fix CI đỏ ÂM THẦM từ 31/07: build web cần API sống mà workflow không mở (branch `fix/ci-api-song-cho-web-build`, ff-only, 1 commit `a1cdb0f`)

Phát hiện khi user nhờ check CI: **main đỏ liên tục từ 31/07 04:23** (ngay
sau merge bước 1 nối API) mà không ai hay — `test:int` phía trên vẫn xanh,
rồi build web chết `fetch failed` vì quyết định ADR-0016 "build với API
sống" chưa bao giờ được phản ánh vào `ci.yml`; merge kiểu rebase+ff không
chờ check nên đèn đỏ không cản được ai. Đúng phiên bản CI của bài học
"int spec hỏng 4 task không ai biết" (lý do sinh ra luật 11).

Vá: khối mới trong `ci.yml` — `prisma migrate deploy` + `db:seed` lên db
`tourism` (Postgres service tự tạo, tách khỏi `tourism_test` của int) +
build & start API nền + chờ health 200 tối đa 60s (fail thì dump log API)
TRƯỚC bước `turbo run build typecheck test`. Đo trên chính CI: run branch
`30875942867` success — lần xanh đầu của pipeline đầy đủ kể từ 31/07.

**Nợ quy trình ghi nhận:** khoảng mù 31/07–04/08 tồn tại vì không ai nhìn
đèn CI sau merge; cân nhắc (a) bật branch-protection đợi check trước push
main, hoặc (b) nếp "liếc `gh run list` sau mỗi push main" — chưa chốt, chờ
user quyết ở dịp gần nhất.

**Tests after:** không đổi code app — gate:int local đã xanh ở `9aa338f`;
CI branch run full pipeline success (int 156 và build web SSG với API sống
và lint và freshness).

## 2026-08-04 — Trả 2 nợ ADR-0002: PayPal capture-on-approved + smoke sandbox THẬT 2 provider (branch `feat/paypal-capture-smoke`, ff-only, 5 commit `d7a49fb..9aa338f`)

PayPal end-to-end LẦN ĐẦU trong lịch sử dự án: hook tuỳ chọn
`PaymentGateway.followUp?` (side-effect sau verify+log; throw = xin provider
retry) → `PayPalGateway` capture server-side khi webhook
`CHECKOUT.ORDER.APPROVED` (`PayPal-Request-Id: capture:<orderId>` idempotent;
`ORDER_ALREADY_CAPTURED` nuốt — cũng chính là ca out-of-order; lỗi khác
throw-để-retry). Đường `payment.completed`/atomic claim không đổi một dòng.
Smoke sandbox thật do user cấp key: PayPal buyer approve → capture của ta →
COMPLETED → PAID trong 23 giây + refund 2 nhịp id thật; Stripe 4242 trọn
vòng và refund 2 nhịp; âm bản chữ-ký-giả → 400, replay → duplicate không
double.

**Review findings (2 vòng task + final fable + 2 vòng fix) — cả 3 bug đều
thuộc lớp "chỉ lộ khi chạm đời thật":**

1. **Reviewer T2 bắt nhánh nuốt ALREADY_CAPTURED là DEAD CODE với lỗi PayPal
   thật** — mã máy-đọc nằm `details[0].issue`, top-level message chỉ là
   boilerplate; unit cũ xanh GIẢ nhờ stub bịa shape. Vá `f0f4400`
   (issue-first trong `paypalErrorMessage`, RED proof trên shape 422 thật,
   thêm case `INSTRUMENT_DECLINED` vẫn throw). Bài học: test chống lỗi
   provider phải dùng SHAPE THẬT từ docs, không tự bịa cho khớp code.
2. **Smoke bắt Stripe session bị từ chối 100%** (4/4): `expires_at` đặt ĐÚNG
   floor 30' của Stripe không chừa lề, đồng hồ máy lệch −86s là đủ rớt. Vá
   `43d7a2b` (60' + comment bất biến floor-theo-đồng-hồ-Stripe). Đúng giá
   trị của nợ D2 — mọi verify offline trước đây không thể thấy.
3. **Final review bắt hệ quả dây chuyền:** TTL sweep 30' (comment cũ "khớp
   hạn Stripe") giờ NHỎ HƠN hạn session 60' → cửa sổ 30–60' buyer trả tiền
   cho booking đã bị sweep hủy (tiền an toàn nhờ orphan-refund, UX tệ). Vá
   `9aa338f`: TTL 65' + unit khoá BẤT BIẾN `TTL*60 > SESSION_EXPIRY_SECONDS`
   (import hằng thật — đổi hạn ở đâu là đỏ ngay), int spec derive từ hằng
   chống drift. Ghi chú TTL mới đã vào ADR-0006.

**Nợ mở:** capture-on-return ở trang success = lớp UX bước 10 (webhook vẫn
backstop — ADR-0002 khối 04/08); bất biến TTL>expiry mới assert Stripe,
gateway nào thêm hạn session riêng phải vào spec đó (comment đã dặn).
Đồng hồ WSL lệch −86s — khuyên user `sudo hwclock -s` (code đã chừa lề,
không chặn).

**Tests after:** api unit 208 (+9: followUp 5 + shape-thật 2 + expiry 1 +
bất biến TTL 1) · int 156 (+3 wiring followUp qua Fake) · web 805 không đổi
— `gate:int` xanh trọn tại `9aa338f`. Smoke: 2 provider × (1 thanh toán +
2 refund) + 2 âm bản, DB/webhook sandbox/tiến trình dọn verified.

## 2026-08-04 — Vá 13 alert Dependabot (5 high, 8 moderate) + 1 audit thấy thêm (branch `fix/deps-dependabot`, ff-only, 1 commit `8089401`)

Toàn bộ là dependency bắc cầu, vá bằng overrides SCOPED trong
`pnpm-workspace.yaml` (sinh bởi `pnpm audit --fix=override` — chỉ áp trong
dải dính lỗ hổng, không ghim chết bản sau): `fast-uri` 3.1.5/4.1.2 (đường
HTTP thật của API — fastify/ajv), `undici` 7.29.0 (5 alert, dev-tooling
jsdom/vitest/dotenvx), `ip-address` ≥10.3.1 và `hono` 4.12.34 (MCP-sdk của
shadcn CLI), `postcss` ≥8.5.23, `brace-expansion` override sẵn có nâng
`^5.0.8`→`^5.0.9` (@swc/cli).

Điểm phân xử: `audit --fix` đòi nhảy `@hono/node-server` 1.x→2.0.5, ĐÈ lên
quyết định 23/07 (ghim 1.x vì 2.x có thể phá `@prisma/dev`; alert
path-traversal đã dismiss `tolerable_risk` có hồ sơ — chỉ Windows,
dev-tooling). Gỡ rule đó, giữ ghim 1.x → `pnpm audit` còn đúng 1 moderate =
alert đã dismiss, là trạng thái chấp nhận có chủ đích chứ không phải sót.

**Tests after:** `gate:int --force` toàn bộ KHÔNG cache — 18/18 task, biome
504 file, 153/153 int; build API qua `@swc/cli` chạy thật trên
brace-expansion 5.0.9 (đúng phép thử comment workspace.yaml dặn từ 27/07).

## 2026-08-03 — Bước 7 nối API: 6 trang auth + session Better Auth ở web (branch `feat/auth-pages-api`, ff-only, 7 commit `ec33797..9a0c30a`)

Cụm auth theo [ADR-0017](adr/0017-web-session-better-auth.md) (Accepted cùng
ngày): cookie httpOnly thẳng browser↔API, không proxy/Bearer. 5/6 form nối
thật (two-factor PARK đúng §5b); UI đã duyệt 24–25/07 không đổi pixel.

- **API:** verify email chuyển link → **OTP** (plugin `emailOTP`, migration
  MỚI `EMAIL_OTP` + template worker); bất biến SEC-1 (promote admin sau
  verify — ADR-0008) đo sống ở đường OTP bằng int test HAI CHIỀU (admin
  promote / customer giữ role). Gotcha đắt nhất cụm: Better Auth merge
  option plugin bằng `defu` — GIỮ `sendVerificationEmail` cũ là override
  của plugin bị nuốt IM LẶNG, link flow vẫn bắn; phải xoá field đó (reviewer
  xác minh tới source `defu@6.1.7` + `email-otp/index.mjs`; plan chỗ này đã
  AMEND).
- **Web:** nền `lib/auth-client.ts` (ghim `better-auth@1.6.23` đúng version
  API) + `safeRedirect` whitelist chống open-redirect (phủ mọi chỗ đọc
  `?redirect=`/callbackURL) + `mapAuthError` một chỗ; login/register (+
  Google `signIn.social` — dev chưa cấu hình thì lỗi inline thân thiện,
  không ẩn nút); forgot **anti-enumeration tuyệt đối** (không nhánh phân
  biệt); reset với panel token-hỏng kiểu TicketCard; verify-OTP tái dùng
  countdown 60s; user-menu sang `useSession` + signOut client-side (navbar
  đổi ngay — bài học Nexora), `mocks/auth.ts` + `MockSessionUser` khai tử
  sạch.
- **Nghiệm thu sống 6/6** (production build + DB thật + playwright headless):
  vòng đời register→OTP-từ-outbox→verified; SEC-1 hai chiều qua env
  `ADMIN_EMAILS` runtime; vòng reset trọn (token dùng lại → panel lỗi);
  redirect ác `//evil` → `/`; trang public không thụt lùi (ISR `[slug]`
  STALE→HIT, slug lạ 404 thật); cookie httpOnly — `document.cookie` không
  thấy token. `gate:int` 153/153.

**Review findings (6 vòng task + final trên fable + 1 vòng fix):**

1. **Final review bắt bug Important cả 6 task-review lọt:** lỗi mạng THẬT
   (promise reject — API sập/offline) làm nút kẹt `pending` vĩnh viễn ở 4
   form + resend + Google vì `await authClient.*` không try/catch — trong
   khi chính forgot-form của cùng cụm có khuôn đúng. Chứng minh bằng source
   `@better-fetch/fetch` (fetch ngoài try/catch, không `catchAllError`). Vá
   `9a0c30a`: try/catch 7 điểm await → `errors.generic`, kèm map
   `TOO_MANY_ATTEMPTS`→`tooManyRequests` (sau 5 lần OTP sai). Bài học: khuôn
   xử lỗi phải là HỢP ĐỒNG của nền (Task 2), không phải nếp tự chọn per-form.
2. **Reviewer T5 tự mutation-bite** countdown resend (thêm reset vào nhánh
   lỗi → test đỏ đúng chỗ, revert sạch) — nếp reviewer-tự-đo tiếp tục giữ.
3. Deviation có bằng chứng được duyệt: prop `email` của OtpForm thành
   optional (dùng chung TwoFactorForm mode tĩnh); panel token-hỏng đặt trong
   TicketCard (nhất quán khung auth hơn khuôn unsubscribe).

**Nợ ghi sổ (backlog, không chặn):** confirm-password chưa validate mismatch
(thừa kế mock tĩnh); register chưa chuyển tiếp `?redirect=` sang verify-email;
resend OTP double-click có thể bắn 2 mã và 429 reset countdown im (vô hại);
test signOut chưa assert thứ tự await-trước-push; route link-verify cũ của BA
còn mount nhưng mồ côi vô hại (không ai phát link); comment `seed.ts` (~206)
tả sai Better Auth khi sign-up trùng email admin (422). Dependabot cảnh báo
1 high trên main sau push — chờ user quyết (chính sách freeze chưa tới,
nâng dep là quyết định user).

**Tests after:** web 63 file / 805 unit (đo lại trên main sau merge; cụm thêm
57: 748→805) và api 199 unit + int 153 (17 file; 4 SEC-1/OTP mới) —
`gate:int` xanh trọn trên `9a0c30a`.

## 2026-08-03 — On-demand revalidation: duyệt review là trang tour tươi NGAY — trả nợ quá hạn ADR-0016 (branch `feat/on-demand-revalidation`, ff-only, 5 commit `a6136ea..6be5abe`)

Nợ "bước riêng sau bước 1–4" của ADR-0016 §3 (bị khối đại tu docs cùng ngày
đánh dấu QUÁ HẠN) trả xong trong ngày: web thêm route handler ĐẦU TIÊN
(`POST /api/revalidate` — secret so constant-time `timingSafeEqual`, whitelist
gương đúng taxonomy `tags.ts`, max 20 tag, lõi thuần 22 test tách khỏi vỏ
route vì glob vitest không cover `src/app/**`); API thêm module
`web-revalidation` (fire-and-forget 3s timeout, mọi lỗi chỉ warn — đo sống:
tắt web, moderate vẫn 200) móc vào `reviews.moderate` SAU khi transaction
commit, chỉ khi review gắn tour và trạng thái duyệt THỰC SỰ đổi
(`moderationRevalidationTags` thuần). Thân transaction 3-điểm-concurrency
nguyên vẹn ngoài đúng 1 dòng bắt `fromApproved`. Env: `REVALIDATE_SECRET`
nếp `DEV_*_SECRET` + superRefine prod; dùng lại `FRONTEND_URL` (spec AMENDED
lúc lập plan — `WEB_URL` mới là lặp env). ISR 300s vẫn là lưới đúng đắn;
đường này chỉ mua độ tươi.

**Review findings (4 vòng task + final trên fable):**

1. **Reviewer T1 bắt ngữ nghĩa Next 16 đổi ngầm:** implementer theo warning
   của chính Next dùng `revalidateTag(tag, 'max')`, reviewer đào
   `incremental-cache` chứng minh `'max'` là SWR MỀM (request đầu sau bust
   vẫn trả bản cũ một lần) — trái câu nghiệm thu "thấy NGAY". Controller
   phân xử bằng source `revalidate.js:209`: `{ expire: 0 }` đi đúng đường
   hard-bust legacy, không dính deprecation warning. Vá `70f8500`; nghiệm
   thu sống xác nhận `x-nextjs-cache` HIT→MISS ngay lập tức. Bài học: lời
   khuyên trong deprecation warning KHÔNG hứa giữ nguyên ngữ nghĩa cũ.
2. **Reviewer T3 mutation-bite điều kiện quyết định** (đổi
   `fromApproved === toApproved` → `false`): đúng ca "lặp trạng thái" đỏ với
   thông điệp spy chuẩn — chứng minh 4 int test cắn thật, rồi revert sạch.
3. Nghiệm thu lòi 2 ghi nhận ngoài diff: comment `seed.ts` (~206) tả sai
   Better Auth 1.6.23 (sign-up trùng email admin → 422, không "link vào
   row"); `FRONTEND_URL` KHÔNG có guard prod (tồn từ P2 — quên set là bust
   câm về localhost, ISR tự lành). Cùng Minor thứ ba: cột slug VarChar(120)
   nhưng whitelist cap 100 — chuyện P4 khi có form tạo tour. Cả ba ghi sổ,
   không chặn merge.

**Tests after:** gate:int xanh trọn — web 748 unit (22 mới revalidate-route),
api 199 unit (9 service + 6 env mới), int 149 (4 mới moderate-bust trong 24
của reviews). Nghiệm thu spec §7 đủ 5/5 trên production build, DB dọn sạch
mồi, cổng trả về trống.

## 2026-08-03 — Bước 5+6 nối API: form Contact + Newsletter + trang unsubscribe — site có hành vi GHI đầu tiên (branch `feat/contact-newsletter-api`, ff-only, 6 commit `60df01a..5afddf8`)

Hai bề mặt ghi công khai đầu tiên, đúng ranh giới ADR-0016 §2 đã chốt từ trước:
**browser gọi thẳng API** (throttle `PUBLIC_WRITE_THROTTLE` 5 req/60s tính theo
IP — đi qua server Next là dồn mọi khách vào 1 IP). Quyết định user 03/08:
**sonner Toaster toàn site** (khác khuyến nghị panel-inline — món nợ "toast hay
không" của ADR-0016 chính thức chốt).

- **Form contact "lá thư"** (`enquiries.create`): UI đã duyệt giữ nguyên pixel;
  validate client bằng CHÍNH `CreateEnquiryInputSchema` (không khai lại rule,
  lỗi inline theo field); mapping giữ-UI: ô "dates" text tự do GHÉP vào cuối
  message ("Preferred dates: …") thay vì ép parse thành `travelDate` (không
  bịa dữ liệu), count→groupSize parse-hoặc-bỏ 1..100, region→interests
  (`'any'` → mảng rỗng, không thành tag rác). Honeypot `website` ẩn đúng kỹ
  thuật (aria-hidden, tabIndex −1, đẩy khỏi viewport — KHÔNG display:none).
- **Newsletter footer** (`subscribe`): anti-enumeration TUYỆT ĐỐI — một nhánh
  toast success duy nhất, được chứng minh hai tầng: code không có if/switch
  trên response, và contract `{subscribed: literal true}` làm nhánh phân biệt
  bất-khả-biểu-diễn.
- **Trang MỚI `/newsletter/unsubscribe`**: server động per-token (noindex,
  không sitemap), GET `unsubscribeConfirm` KHÔNG side effect (bẫy email-client
  prefetch — contract thiết kế sẵn, comment cảnh báo tại chỗ); panel client
  3 trạng thái + 1 trạng thái lỗi cấp trang; token tái dùng cho vòng
  unsubscribe ↔ resubscribe (undo).
- **Hạ tầng feedback:** `classifySubmitError` (429→throttle, còn lại→error —
  shape lỗi XÁC MINH LIVE bằng spam 6 request qua đúng client stack, không
  đoán field) + `submitToast` (copy từ i18n truyền vào); Toaster mount root
  layout, z sonner 999999999 ≫ navbar 1100 (số thật ghi comment, không wire
  thừa).

**Review findings (7 vòng task + final):**

1. **Final review bắt bug ranh giới cả T2 lẫn reviewer T2 đều lọt:** điền ô
   "dates" vô hiệu hoá ngầm yêu cầu bắt buộc của ô lời nhắn (suffix
   "Preferred dates:" ≥18 ký tự tự thoả `message.min(10)` → lá thư rỗng ruột
   vẫn gửi). Vá `5afddf8`: loves luôn bắt buộc ≥10 ký tự độc lập với dates,
   RED thật trước fix; chi tiết then chốt là `return errors` thay `return {}`
   ở nhánh success để lỗi sống sót qua safeParse.
2. **Reviewer T2 bác lý do "Base UI Select flaky trong jsdom"** của implementer
   bằng tiền lệ ngay trong repo (tours-explorer.spec test đúng component đó,
   4/4 xanh) → buộc thêm interaction test với mutation-bite 3 bước (đổi state
   key → test đỏ đúng chỗ). Bài học: lý do bỏ test phải có bằng chứng, không
   phải giả định.
3. **Spec tự mâu thuẫn/giả định sai 2 vụ trong cùng spec** — §4 "4 trạng thái"
   vs §6 "3 trạng thái" (implementer đọc xuyên chữ nghĩa làm đúng theo thiết
   kế contract token-tái-dùng); §7.3 "email masked" trong khi API trả email
   TRẦN từ P3a (người cầm link là chủ email — thực hành chuẩn; spec đã amend).
   Cộng dồn 4 vụ qua 3 cụm → bài học spec-writing: mọi con số/khẳng định xuất
   hiện Ở HAI CHỖ trong spec phải cross-check lúc self-review, và khẳng định
   về hành vi API phải đối chiếu code trước khi viết.
4. Quy trình: một fixer (model rẻ) đọc NGƯỢC chỉ dẫn điều kiện gỡ trailer —
   từ đó chỉ dẫn viết dạng lệnh một-chiều và controller luôn tự kiểm
   `git log` sau mọi fixer (đã bắt thêm 1 vụ nhờ vậy).

**Nợ mở:** `source: 'footer'` của SubscribeInput chưa gửi (contract affordance
bỏ ngỏ — một từ cho admin P4 có data nguồn đăng ký) · re-export `toast` từ
`@tourism/ui` để ghim version sonner một chỗ (hiện web + ui cùng ^2.0.7, drift
tương lai sẽ tách store làm toast câm lặng) · trang unsubscribe gộp API-down
và token-hỏng vào một panel lỗi (tách được bằng isDefinedError khi cần) ·
service `migrate` trong docker compose fail ở seed (tourDestination FK — luồng
`db:seed` trực tiếp và CI đều sạch; NỢ ĐIỀU TRA RIÊNG cho đường compose-trọn-
gói) · `newsletterForm.submitting`/`inputLabel` i18n chưa dùng (nút icon-only).

Tests after: `pnpm gate` xanh 18/18 — web **726** (trước 657) · ui 10 · API
188 · contract 55 · tokens 10 · i18n 1, tổng **990**. `pnpm test:int` 145/145.
Nghiệm thu 5/5 trên production build + DB thật: enquiry vào đúng mapping ·
honeypot 200-giả không ghi row · 429 đúng ngưỡng rồi tự hồi sau cửa sổ ·
vòng token HMAC unsubscribe↔resubscribe trọn · toast không bị navbar đè
(elementFromPoint, desktop + 375px).

## 2026-08-03 — Bước 4 nối API: cụm Destinations + xoá TRỌN lớp lệch mock catalogue (branch `feat/destinations-api`, ff-only, 10 commit `dc55486..30fe3f9`)

Đợt "trả nợ khẩn" ngay sau bước 2+3: trang vùng có 14/16 card tour mock là link
chết 404. Sau merge này **không còn chỗ nào trên site kể chuyện catalogue bằng
mock hay số bịa** — nghiệm thu đo được: **24/24 link `/tours/…` trên 6 trang
production đều 200**. Thi công subagent-driven 7 task (1 moot) cùng final
review và gói fix pre-merge; net **−1.028 dòng**.

- **Đổi nguồn:** `/destinations` (19 điểm thật, tri-state theo khu — hero +
  moments/quotes/FAQ mock sống giữ nguyên khi API sập) · 3 trang vùng (tour
  12/10/10 theo ngữ nghĩa distinct-touch; **reviews vùng compose từ
  `fetchTourReviews` per-tour, settle TỪNG fetch** — đúng ranh giới mà mock
  `reviewsByTour` đã gương từ đầu; chỉ page 1/tour, comment ghi rõ giới hạn) ·
  Home (tiles + Stats) · `/about` (30/19 thật). `lib/regions.ts` sang VM —
  diff type-only từng hàm, mọi bất biến spec giữ.
- **Ba quyết định user giữa chừng:**
  1. Home gallery **chọn lọc 9/19** điểm đến (tourCount cao nhất) — giữ đúng
     thiết kế + heading "Nine places" đã duyệt; sau final review bổ sung:
     CHỌN theo sức nặng nhưng **HIỂN THỊ re-sort theo trục Bắc→Trung→Nam** để
     câu copy "north to south" đúng trở lại (`topDestinations()` hai bước,
     6 test + RED thật).
  2. Stats Home **"68+" → 30 thật** (vụ thứ ba của lớp "số có nguồn API mà
     vẫn bịa", sau Destinations-9 ở `/about` và chính số 68 từng bị vá một
     lần ngày 30/07); fetch fail → ẨN ô số, cấm rơi về số cũ.
  3. **Task 6 navbar = MOOT:** premise spec sai (grep đọc nhầm consumer —
     dropdown đã được user rút còn 4 link ngày 30/07, không phụ thuộc
     catalogue); user tái xác nhận giữ 4-link → **không có layout fetch nào**,
     rủi ro bán-kính-rộng nhất của spec tự biến mất. Spec §1E/§4.3 đã amend.
- **Khai tử:** `mocks/tours.ts` (1.486 dòng) · `mocks/destinations.ts` ·
  `tour-media.ts` · `tour-reviews.ts` (2 file sau là orphan phát hiện khi
  quét) + các type `Mock*` hết consumer + rehome 3 `import type` nợ từ cụm
  Tours. Specs chuyển sang `test/fixtures/catalog.ts` — **fixture đông lạnh
  test-only** (0 import runtime; data trích trung thực từ mock cũ, phần
  synthesized có khai trong header). Moments hết link chết (3 slug sửa +
  credit khớp title thật; test canh 2 chiều theo danh sách roster tĩnh).

**Review findings (8 vòng task + final):**

1. Hai "đứa em của Destinations-9" chỉ final review toàn-branch thấy: Stats
   68+ và câu copy gallery lệch thứ tự tile — cả hai thành quyết định user
   (mục 1–2 trên). Vòng task còn bắt: ô "Destinations: 9 — Three per region"
   ở `/about` hardcode cạnh dữ liệu đã fetch 3 dòng phía trên (vá `0315ac8`).
2. **Implementer T6 BLOCKED đúng lúc, đúng cách** khi phát hiện plan-vs-code
   drift thay vì tự ý đảo thiết kế 30/07 của user — có timeline + 3 phương án
   trong report. Bài học plan-level: premise spec phải kiểm được, không viết
   từ grep chưa xác minh.
3. Bài học plan-level thứ hai: số nghiệm thu trong plan phải **derive bằng
   đúng hàm trang sẽ dùng** — plan đếm theo file roster ra 12/9/9, ngữ nghĩa
   distinct-touch thật là 12/10/10 (grand tour đếm ở cả 3 miền).
4. Quy trình: fixer (model rẻ) **đọc ngược chỉ dẫn điều kiện** về trailer
   ("Present ✓ — no amend needed") — controller bắt bằng kiểm tay, amend gỡ;
   từ đó chỉ dẫn trailer viết dạng lệnh một-chiều và controller luôn tự kiểm
   `git log` sau mọi fixer.
5. Gotcha đo đạc mới: `.next` cache từ build cũ **che nhánh lỗi khi đo
   tri-state ở dev** — mọi phép đo tri-state phải `rm -rf .next` trước
   (bổ sung cho bài học Data-Cache-giữ-bản-thành-công của cụm Tours).

**Nợ mở:** danh sách slug roster đang chép tay ở HAI spec (`mocks.spec.ts` +
`sitemap.spec.ts`) — gộp về một module trong `test/fixtures/` để một chỗ sync ·
caption bento `/about` "12/10/10 cạnh 30" đúng ngữ nghĩa distinct-touch nhưng
đọc như toán sai — cân nhắc chữ "touching" (thuần biên tập) · compose reviews
vùng sẽ cần phân trang khi tour vượt 20 review (đã comment tại chỗ) · JSDoc
`ownToursInRegion` các con số ví dụ là của fixture test (đã chú thích).

Tests after: `pnpm gate` xanh **18/18** — web **657** (giảm so 701: khai tử
các spec canh mock, thêm test fixture/topDestinations) · ui 10 · API 188 ·
contract 55 · tokens 10 · i18n 1, tổng **921**. `pnpm test:int` **145/145**.
Nghiệm thu production: 24/24 link tour 200 · số "30" nhất quán toàn site ·
navbar 4 link · `/terms`/`/login` nguyên vẹn (không layout fetch).

## 2026-07-31 — Bước 2+3 nối API: catalogue THẬT thay trọn seed + `/tours` + detail (branch `feat/tours-catalogue-api`, ff-only, 14 commit `64f780f..5e80270`)

User chốt hướng: thay vì port 16 tour mock, **làm lại seed thành ~30 tour "như
thật"** — itinerary có mốc giờ từng hoạt động trong ngày. Thi công subagent-driven
10 task ([plan](plans/2026-07-31-tours-catalogue-api.md)) + final whole-branch
review + gói fix pre-merge.

- **Nửa A — catalogue mới (fixtures tách theo miền `fixtures/catalog/`):** 30 tour
  (Bắc 12 · Trung 9 · Nam 9, roster spec §3) · 19 destinations · 84 review CURATED
  trên 24 tour với **6 tour 0-review cố ý** (test `ratingAvg null ≠ 0`) ·
  departures tĩnh tương lai, mọi tour biên được kéo QUA mốc bảo vệ ~10-11/11/2026.
  Itinerary là text kỷ luật `HH:MM — hoạt động` trong `description` (không
  migration, không đổi contract; luật cứng: KHÔNG BAO GIỜ parse ngược). Tour mẫu
  `vung-tau-coastal-2d` khớp spec §5 **từng dòng** (reviewer đối chiếu). Content
  qua 3 vòng review riêng: địa lý thật (cung Hà Giang đúng lộ trình
  Quản Bạ→Đồng Văn→Mã Pí Lèng, chợ nổi Cái Răng đi 05:30), món/địa danh có thật,
  không câu khuôn lặp quá 2 lần toàn catalogue.
- **Hai quyết định user giữa chừng, đều là xung đột spec ↔ thực tại:**
  1. Spec §5 tự mâu thuẫn (4 đợt "cách tuần" 15/08 không thể tới 21/11) → chốt
     giãn ~tháng, đợt cuối 21/11 **sát ngày bảo vệ** để tour mẫu còn đợt tương lai
     lúc demo. Spec đã được amend cùng đợt docs này.
  2. **ĐẢO bất biến rating** (`bbd7b5a`): trước đây `moderate()` chỉ tính review
     VERIFIED vào `ratingAvg` (chống thổi điểm bằng testimonial) — nhưng capstone
     không có khách thật nên CURATED là nguồn sao duy nhất, và seed tính khác
     service là bug ngủ sẽ nổ đúng lúc demo viết review (bước 9). Giờ: MỌI review
     approved CÓ `tourId` đều tính (curated không gắn tour vẫn không tính). Service
     + seed MỘT công thức (`AVG(rating)::numeric(2,1)`, không shared helper — hai
     file sync theo quy ước, JSDoc ghi rõ); test int đảo assertion tương ứng.
     JSDoc `moderate()` giữ lại lịch sử quyết định cũ và lý do đảo.
- **Nửa B — web (đúng khuôn ADR-0016, đúng vết cụm Blog):** `lib/api/tours.ts`
  (VM = type contract qua `ContractOutputs`, KHÔNG khai lại field — nhờ vậy Task 9
  detail chỉ đổi 3 file, các component đã ăn đúng type từ trước) · `TAGS.TOURS` +
  `tourTag(slug)` · `/tours` tri-state với facet destinations TỪ API (19 slug mới —
  giữ mock là filter chết) · `/tours/[slug]` với Departure Board dữ liệu thật,
  itinerary xuống dòng bằng `whitespace-pre-line` (một class, không parse), reviews
  từ `reviews.listByTour`, gallery degrade sạch khi contract chưa có media
  (ADR-0005) · sitemap 38 → **52 URL** (bỏ 16 slug mock, vào 30 slug thật).
- **DB dev reset bởi user** (Prisma AI-safety guard chặn agent chạy
  `migrate reset` — lớp chắn hoạt động đúng, không lách); seed 2 lần idempotent;
  8 int spec đổi slug theo roster mới.

**Review findings (12 vòng task + final):**

1. Ba vòng fix content đều do reviewer độc lập bắt: 2 tour thiếu đợt promo (T2) ·
   câu CANCELLATION lặp nguyên văn 6 chỗ xuyên file (T3, khử ở T4) · tour
   `hoi-an-lantern-evening` cạn đợt từ 05/11 — NGAY TRƯỚC ngày bảo vệ, trong khi
   nó là tour phơi bày nhất (booking mẫu + 1 trong 2 link sống từ trang vùng)
   (final review, vá `5e80270` kèm 3 tour biên).
2. **Tile "Sài Gòn" ở `/destinations` lọc ra rỗng nói dối**: slug mock `sai-gon`
   ≠ slug API `ho-chi-minh-city`, 8/9 tile khác tình cờ khớp — chỉ góc nhìn
   toàn-branch mới thấy. Đã đổi slug mock đồng bộ (`5e80270`).
3. **Lệch tạm mock nặng hơn chữ nghĩa spec:** trang vùng `/destinations/[region]`
   hiện có **14/16 card tour mock là link chết 404** (chỉ `hoi-an-lantern-evening`
   và `hue-imperial-day` sống). Home và `/about` an toàn (chỉ lệch số đếm 16↔30,
   không có link tour). → **bước 4 (destinations lên API) cần đi NGAY sau đợt này.**
4. Chuỗi tự-bắt-lỗi đáng ghi: implementer T10 bắt lỗi số học "66 URL" trong chính
   dispatch của controller (thật: 38−16+30=52); fixer final bắt brief ước "+6"
   departures trong khi đúng nội dung là +5; T6 phát hiện 5 int spec hardcode slug
   cũ mà plan không lường.

**Nợ mở (triage ở final review):** làm tươi departures sau 01/2027 (bảng đợt-cuối
từng tour nằm trong report T10; sớm nhất còn lại: `hanoi-old-quarter-food-night`
20/11 — chấp nhận, dư ~9 ngày sau bảo vệ) · `fetchTourReviews` trần pageSize 20,
form review bước 9 sẽ phá giả định · **seed là ADDITIVE** — DB nào chưa reset mà
seed roster mới sẽ có 23 tour cũ lẫn 30 mới (DB remote/Supabase phải
`migrate reset` trước) · 3 component detail còn `import type` từ `@/mocks/types`
(structural-compatible; rehome khi mock chết ở bước 4+) · `pickPaidDeparture`
không lọc đợt tương lai dù JSDoc nói vậy (sửa comment hoặc thêm filter) · promo
tour mẫu 7.75% là ngoại lệ spec-định (đừng "sửa giúp" về 13-15%) · reviews
createdAt (01-07/2026) trước mọi departure seed (chấp nhận cho CURATED) · cân
nhắc phụ lục ADR-0016 cho bất biến rating mới khi mở P4 admin.

Tests after: `pnpm gate` xanh **18/18 task** (gồm `next build` fetch API sống) —
web **695** (trước 692) · ui 10 · API 188 · contract 55 · tokens 10 · i18n 1,
tổng **959**. `pnpm test:int` **17/17 file, 145/145** — 8 int spec đã theo roster
mới. Nghiệm thu production build: sitemap 52 URL (30 `/tours/…`, 0 slug mock) ·
slug lạ **404 thật** · `/tours` 30 tour + filter/search fold dấu · detail Vũng Tàu
hiện `07:30` xuống dòng đúng + rating 4.7/3 · tour 0-review hiện "chưa có đánh
giá" · tri-state đo tắt-API.

## 2026-07-31 — Bước 1 nối API: cụm Blog đọc dữ liệu thật + nền `lib/api` cho cả phase (branch `feat/blog-api`, ff-only, 13 commit `ffb8ea5..1cbe22c`)

Trang đầu tiên của web rời mock: `/blog` · `/blog/[slug]` · rss · sitemap · teaser
Journal trên Home đọc từ API oRPC theo [ADR-0016](adr/0016-web-data-layer.md) và
[spec 31/07](specs/2026-07-31-blog-api-design.md); plan 10 task thi công kiểu
subagent-driven, mỗi task một vòng review độc lập cộng final whole-branch review.

- **Nền `lib/api` dùng chung mọi bước sau:** `env.ts` (một module env duy nhất —
  sửa bài học Nexora lặp base-URL 8 file) · `client.ts` — `OpenAPILink` ghim
  `1.14.8`, timeout 10s, chuyển `next: {revalidate, tags}` per-call qua client
  context (đường context→fetch→Data Cache được final review xác minh tận nguồn
  Next 16.2.11: `init.next` được patch-fetch đọc trước, `signal` bị strip khi
  revalidate nên timeout không phá cache) · `tags.ts` (`TAGS.POSTS`,
  `postTag(slug)`) · khuôn tri-state `settle()`/`contentState()` (failed thắng
  isEmpty — cấm empty-state khi API sập) + `LoadErrorState` (retry =
  `router.refresh()`).
- **Seed 9 bài phía API** từ mock journal đã duyệt, copy verbatim (reviewer đối
  chiếu 3/9 bài từng heading/đoạn/bullet), sections → markdown. Bẫy đã né: 4/9
  ngày mock ở TƯƠNG LAI mà `publishedPostWhere()` (ADR-0004) lọc
  `publishedAt <= now` — bảng dời ngày giữ nguyên thứ tự trong
  `fixtures/posts.ts`. Upsert theo slug idempotent (chạy 2 lần đo được không
  nhân bản); `update: {}` cố ý không reconcile — comment tradeoff ghi tại chỗ.
- **SSG → ISR:** 4 route `revalidate = 300` + mọi fetch gắn cache-tag từ ngày
  đầu; một `fetchPosts()` (một cache key, một TTL) nuôi cả 5 consumer. Home diff
  đúng 11 dòng/1 hunk (trang duyệt kỹ nhất — chỉ fetch + props + revalidate).
  Bất đối xứng có chủ đích, comment tại chỗ: rss fail → 503 (feed sai tệ hơn
  feed vắng) còn sitemap fail → mảng rỗng (thiếu tạm còn hơn build đổ);
  `generateStaticParams` cố ý KHÔNG settle — API chết lúc build phải fail to.
- **Shape gap mock ↔ contract xử tường minh:** markdown render bằng
  `react-markdown` + `remark-gfm` trong Typeset preset reading (thay
  `ArticleBody sections`; cụm pháp lý giữ nguyên khuôn cũ); `tocFromMarkdown`
  hội tụ id với `ArticleMarkdown` qua một đường text-thuần chung; chip lọc
  chuyển category → tag (`posts.tags`, so theo slug, URL `?tag=<slug>`); chip
  "Updated" và JSON-LD `image`/`dateModified` cắt có chủ đích (contract không
  có nguồn thật). **Chip "min read" bỏ khỏi card**: `PostCardSchema` không có
  `content` nên số ở listing là bịa — detail vẫn hiện số thật tính từ content;
  muốn chip về lại card thì thêm `readMinutes` vào contract ở đợt riêng.
- **Khai tử `mocks/journal.ts`** (420 dòng) + `MockJournalPost`; grep
  `mocks/journal|MockJournalPost|JOURNAL_POSTS` toàn `apps/web/src` về rỗng
  thật sự (kể cả 2 JSDoc và 1 fixture trùng tên); `sitemap.spec.ts` chuyển
  fixture cục bộ lấy ngày từ seed thật.

**Review findings (10 vòng task + final):**

1. **Hai bug thật đều nảy từ code mẫu trong chính plan** — `slugify(String(children))`
   vỡ id khi heading có inline markdown (`[object Object]`) và ảnh `![alt](url)`
   lệch id hai phía. Cả hai fix theo TDD trung thực: test mới ĐỎ trên code cũ
   trước (17 rồi 3 test), xanh sau fix. Bài học plan-level: snippet đụng thư
   viện bên thứ ba trong plan cần đối chiếu docs như plan đã (đúng) bắt làm với
   oRPC — nơi implementer phát hiện docs online lệch `.d.ts` bản ghim (fetch 5
   tham số, option `url` đơn) và tin bản cài là chọn lựa đúng.
2. **Nghiệm thu đủ 8/8 mục spec §5 trên production build:** 9 bài + chip tag ·
   slug lạ **404 thật** (bẫy soft-404 không tái diễn, không `loading.tsx` nào
   mới) · JSON-LD sạch field bịa · teaser Home 3 bài mới nhất · rss 9 item ·
   sitemap 38 URL · search fold dấu · tri-state đo thật: tắt API thì `/blog`
   ra `LoadErrorState`, không "Nothing here yet". Khoảng trống bằng chứng mục
   tri-state do final review bắt được và vá bằng phép đo bổ sung.
3. **Hai commit dính trailer AI attribution** dù brief cấm — filter-branch gỡ
   trước khi push; các dispatch sau thêm bước tự kiểm `git log`.
4. **Giả định môi trường trong prompt session SAI:** máy này có Docker/Postgres —
   `pnpm test:int` chạy được và xanh. Assumption môi trường nên là điều kiện
   kiểm được, không phải khẳng định chết.

**Nợ mở (đã triage ở final review):** server-side pagination `/blog` (điều kiện
kích hoạt ghi ở spec §2C) · `metaTitle`/`metaDescription` contract có nhưng web
chưa dùng (P4 admin điền là web lờ đi âm thầm) · `toJournalPostDetail` chưa có
test riêng · bước on-demand revalidation phải quyết detail gắn thêm `TAGS.POSTS`
hay chỉ `postTag` (hiện chỉ `postTag` — bust `posts` không đụng trang detail) ·
visual `LoadErrorState` (không icon/màu lỗi) chờ user duyệt theo nếp
design-by-demo · `readMinutes` ở list VM là field không ai render, cân nhắc dời
sang detail VM.

Tests after: `pnpm gate` **18/18 task** kể cả `next build` fetch API sống · web
**692** (trước 656, đã trừ test journal mock bị khai tử) · ui 10 · API 188 ·
contract 55 · tokens 10 · i18n 1, tổng **956**. Lần ĐẦU đo được
`pnpm test:int` tại máy dev: **145/145** (17 file). Nghiệm thu production build
8/8 mục spec §5.

## 2026-07-30 — Dropdown navbar bị navbar đè: hai nguyên nhân, một lớp lỗi cũ bỏ sót (branch `fix/navbar-dropdown-stacking` rồi `fix/user-menu-stacking`, ff-only, commit code `e6f179f` và `00ea0d4`)

User báo: hover "Destinations" lúc đã cuộn thì dropdown bị thanh navbar đè lên. Điều
tra bằng `elementFromPoint` quét dọc vùng chồng cho ra **hai nguyên nhân độc lập**,
không phải một.

- **Overlap 18px — neo sai mốc.** Base UI đo `sideOffset` từ ANCHOR, tức chính
  trigger. Trigger cao 20px, căn giữa hàng cao 40px trong `p-4`, nên dải navbar còn
  thừa đúng **26px** bên dưới nó; với offset 8 thì `popup.top − navbar.bottom =
  −18px`. Con số này **giống nhau ở cả hai trạng thái cuộn**.
- **Navbar thắng cuộc chồng lấp — z-index.** Popup **portal ra `body`** nên stacking
  context của nó là **anh em** của `<nav>` trong context gốc, không phải con; navbar
  là `z-(--z-sticky)`=1100 còn bản vendor để `z-50`. Portal còn là con ĐẦU TIÊN của
  `body` nên kể cả bằng z vẫn thua. Hit-test: mọi y trong vùng chồng cho ra chính
  `<nav>`.
- **Vì sao chỉ thấy khi cuộn:** chưa cuộn nav là `rgba(0,0,0,0)` + `backdrop-filter:
  none` — chồng vẫn 18px nhưng không có gì để che. Cuộn xuống nó thành
  `bg-background/60 + blur(40px)`.

**Đây là lớp lỗi repo đã sửa BỐN lần** (`select.tsx`, `dialog.tsx`, `sheet.tsx`,
`drawer.tsx` đều có comment ghi đúng câu đó). `navigation-menu.tsx` là component
vendor **duy nhất bị bỏ sót** đợt ấy.

Vá: Positioner và Popup dùng `isolate z-(--z-popover)`; Root forward `sideOffset` và
`destinations-menu` truyền **34 = 26 + 8**, đặt ở **call site** vì 26px là đặc thù
`site-header`, không phải luật chung. Một con số cho cả hai trạng thái (user chốt
phương án (a)). Z cao vẫn cần dù đã hết chồng: Positioner mang cầu hover
`before:top-[-10px]` bắc qua khe, cầu nằm dưới navbar thì chuột đi xuống panel làm
menu đóng giữa đường.

**Hai phương án đã LOẠI, ghi để không ai thử lại:** `sideOffset` dạng hàm —
`OffsetFunction` của Base UI 1.6 chỉ cấp **kích thước**, không cấp vị trí; và neo vào
chính dải navbar — khi ấy `align='start'` căn theo mép dải chứ không theo trigger, mà
căn ngang theo trigger đo được **đang đúng 0px lệch** nên đó là ràng buộc phải giữ,
không phải lỗi thứ hai.

**Review findings:**

1. **Mutation không bite là phát hiện quan trọng nhất.** 2/3 đột biến bị bắt, nhưng
   gỡ `sideOffset={sideOffset}` ở Root thì **6/6 test vẫn xanh, `lint` im,
   `typecheck` im** — bug quay lại hoàn toàn âm thầm. Bịt bằng
   `libs/shared/ui/src/components/navigation-menu.spec.ts` mới, làm TDD trung thực:
   áp đột biến trước, viết test, xem đỏ, rồi bỏ đột biến. Spec đọc source vì "một prop
   có được forward hay không" **không hiện ra DOM**, và jsdom không dựng layout nên
   render không phân biệt offset 8 với 34.
2. **Câu hỏi của user có một tiền đề sai, đã sửa lại:** họ hỏi cả "không bị lệch",
   nhưng đo được `popup.left − trigger.left = 0px` — dropdown **không lệch**; đó là
   thứ phải giữ khi vá, không phải lỗi cần vá.

**Consumer thứ hai — cùng bug đang NGỦ, user chốt vá luôn** (commit `00ea0d4`).
`dropdown-menu.tsx` còn nguyên cặp `isolate z-50` / `z-50`, và `user-menu.tsx` render
nó **trong chính navbar đó** (`site-header.tsx:100`). Bug ngủ vì `MOCK_SESSION` là
`null` nên navbar hiện link "Log in", dropdown avatar không mở — nó sẽ thức đúng lúc
nối auth. Đo bằng cách **tạm** bật `MOCK_SESSION = SAMPLE_USER` (mock file ghi sẵn
cách làm), cả hai trạng thái cuộn: `positioner z=50` · `popup.top − nav.bottom =
−16px` · hit-test cho ra `<nav>`.

Con số **khác** menu Destinations, và đây là điểm phải hiểu đúng thay vì gộp: cùng một
dải navbar nhưng trigger khác chiều cao. Avatar `size-8` (32px) căn giữa hàng 40px
trong `p-4` → đệm còn **20px** → offset **28**. Trigger Destinations là CHỮ cao 20px →
đệm **26px** → offset **34**. Hai hằng số cố ý KHÔNG gộp, comment ghi lý do.
`user-menu.spec.tsx` là spec **đầu tiên** cho khu này (trước đó không có test nào) và
nó nói thẳng giới hạn: `MOCK_SESSION` là hằng module-scope nên chỉ test được nhánh
chưa-đăng-nhập cộng hằng số; nhánh dropdown test được khi phase auth thay mock bằng
session thật. Đo lại sau vá: `−16px → +8px`, hết chồng lấp, `align=end` giữ 0px lệch,
`z` 1500 > 1100. Mutation 3/3 bite.

**Nợ mở:** sáu component vendor còn `z-50` — `alert-dialog`, `combobox`,
`context-menu`, `hover-card`, `popover`, `tooltip` — **chưa file app nào dùng**. CỐ Ý
chưa đụng: thang z đúng cho mỗi cái phụ thuộc vai trò (`--z-modal` 1400 vs
`--z-popover` 1500 vs `--z-toast` 1700), và gán bừa cho sáu component không có
consumer lẫn test là quyết định không có cơ sở. **Trước khi dùng bất kỳ cái nào trong
sáu, vá `z-50` của nó trước** — nếu nó xuất hiện gần navbar thì bug này tái diễn.

Tests after: `pnpm gate` xanh — **18/18 task** kể cả `next build` · web 656 (trước
654) · ui **10** (trước 5) · API 188 · contract 55 · tokens 10 · i18n 1, tổng **920**.
`@types/node` thêm vào `libs/shared/ui` cho spec đọc file, khớp `26.1.1` mà `apps/api`
và `libs/shared/tokens` dùng. Đo lại trên Chromium cả hai trạng thái cuộn:
`popup.top − navbar.bottom` từ **−18px thành +8px** · căn ngang giữ **0px lệch** ·
z positioner **1500 > 1100** · chuột đi từ trigger qua khe xuống panel thì menu
**vẫn mở**. `pnpm test:int` không chạy được ở máy này.

## 2026-07-30 — Đóng cụm Destinations (Task 6/7) và dọn 4 khoản nợ phase giao diện tĩnh (branch `fix/sitemap-destinations`, ff-only, commit cuối `cf8f821`)

Đợt dọn nhà TRƯỚC khi nối API. User chốt: đóng Task 6 trước, rồi xử lý tồn đọng,
rồi ADR-0016 (tầng dữ liệu web) ở session mới.

- **Task 6 — sitemap thiếu 4 URL của trang đang sống.** `/destinations` và ba trang
  vùng ship 30/07 nhưng `STATIC_PAGES` không có, và không có nhóm URL vùng nào.
  Comment `lib/sitemap.ts` còn ghi *"`/destinations` … CHƯA tồn tại"* — đúng lúc
  viết, sai từ lúc trang lên. Bài học ghi vào comment: câu "chưa tồn tại" là khẳng
  định về HIỆN TRẠNG nên phải có **test** canh, không chỉ có comment.
  Thang priority: `/destinations` cùng bậc **0.9** với `/tours` (hai lối vào
  catalogue ngang hàng), trang vùng **0.8** cùng bậc tour detail. `regions` nhận qua
  **tham số** chứ không `import` trong lib — hàm này test được chính vì mọi nguồn dữ
  liệu đi vào từ ngoài; vỏ `app/sitemap.ts` truyền đúng `REGIONS` mà
  `generateStaticParams` dùng, nên sitemap không thể liệt kê URL chưa prerender.
- **Task 7 — đo trên PRODUCTION BUILD** (`next start`, không phải dev): 3 slug vùng
  → 200, slug lạ **và slug sai chính tả** → **404 thật** (không soft-404),
  `/tours/khong-co-tour` → 404, `sitemap.xml` → 200 với đúng **38 URL**.
- **Cặp `primary` dark: lỗi WCAG AA thật, vá.** `primary-foreground` KHÔNG lật theo
  theme mà dark `primary` lại SÁNG HƠN light → chữ 14px trên mọi nút primary ở dark
  đo **4.11:1**, dưới 4.5. Hạ dark L 0.563 → **0.53** (chữ 4.73 ✅, nút/nền 3.13 ✅).
  Phương án "chữ tối trên primary sáng" đã đo và **chết**: kể cả gần-đen (L=0.16)
  cũng chỉ 4.37. Tối hơn 0.50 thì nút tan vào nền trang (2.75).
- **`rating` light: 2.27 → 3.22.** Ngôi sao là graphic (ngưỡng 3:1) và bản cũ trượt
  ở CẢ `background` (2.27) lẫn `card` (2.40). 0.66 mới đạt 2.98 — vẫn dưới; **0.64**
  là mốc sáng nhất đạt trên cả hai. Dark giữ 0.78 (đã đạt).
- **Nội dung ẩn khi JS tắt — lớn hơn tưởng.** `motion` render `initial` thành `style`
  inline NGAY TRONG HTML server, nên `initial={{opacity:0}}` cộng `whileInView` là ẩn
  vĩnh viễn khi JS chết — mà mọi trang là SSG. Đo: trang chủ **62** phần tử, `/about`
  **60**, trang vùng 15, `/tours` 10, `/blog` 8. Vá bằng MỘT rule trong `<noscript>`
  ở `<head>` thay vì sửa từng component (`initial` là cách duy nhất motion biết điểm
  bắt đầu; bỏ nó là bỏ chuyển động đã duyệt ở 40+ chỗ). Đo được rule **không** nằm
  trong stylesheet đang áp khi JS bật, và 0 phần tử kẹt mờ.
- **Dedup bộ số spring: 62 bản copy → 1.** Trước: 21 file khai `const SPRING` nguyên
  văn, 19 chỗ gõ spring 240 inline, 22 chỗ gõ spring 320 inline, cộng `REVEAL_EASE`
  khai ở cả `reveal-line.tsx` lẫn `lib/motion.ts`. Hai spring **một-lần** giữ tại chỗ
  (`on-this-page` 420, `not-found-body` 260) — chúng không phải bản copy, và nhồi mọi
  giá trị một-lần vào `lib/motion.ts` biến file đó thành bãi hằng số.

**Review findings:**

1. **Test cũ đỏ vì thứ nó canh đã biến mất theo đúng ý muốn.** Ba test trong
   `motion.spec.ts` khẳng định "`lib/motion` KHỚP bản copy trong reveal.tsx /
   gallery.tsx / reveal-line.tsx" — hợp lý khi còn 62 bản copy. **Suy lại, không xoá
   cho xanh**: bất biến mới đi NGƯỢC chiều, canh rằng **chỉ còn một bản**. Nó không
   thể xanh giả — thêm lại một `const SPRING` là đỏ ngay, còn test cũ thì vẫn xanh
   miễn hai bên cùng giá trị. Thêm **allowlist** cho spring một-lần: file thứ ba gõ
   spring riêng sẽ đỏ và buộc trả lời "một-lần thật, hay bản copy thứ 22 sắp trôi?".
2. **Test `'phần còn lại không vượt 0.7'` của sitemap cũng phải suy lại.** Bản cũ
   liệt kê tay ba ngoại lệ; nối thêm ngoại lệ cho Destinations sẽ biến nó thành bản
   sao của chính thang priority — xanh với BẤT KỲ thang nào miễn hai bên khớp. Bản
   mới canh **THỨ TỰ** của thang nên đổi một giá trị là đỏ, mà thêm họ URL mới thì
   không phải sửa test.
3. **Tôi báo sai một lần rồi phép đo bác lại.** Đề xuất ban đầu cho
   `motion-reduce:transform-none` là "xoá, đổi 0 pixel"; đo lại thì nan quạt bưu
   thiếp **dẹp phẳng**. Truy ra không phải tailwind-merge — chính edit của tôi đánh
   rơi dòng so le. Làm lại đúng thì `translate` giống hệt hai chế độ.
4. **Con số 0.52 tôi đưa ra ban đầu là sai** vì đoán `background` dark = 0.208; giá
   trị thật là 0.25 nên cửa sổ hẹp hơn, và **0.53** mới là điểm tối ít nhất vượt
   ngưỡng.
5. **Tự kill shell hai lần** vì `pkill -f "next dev"` / `pgrep -f "next start"` khớp
   chính dòng lệnh chứa chuỗi đó trong commit message. Cách đúng: tra PID theo cổng
   (`ss -ltnp`) hoặc để message trong file rồi `-F`.

**Nợ mở:** nút primary đứng **trên card** ở dark đo 2.57 và **đã là 2.95 trước khi
sửa** — dưới 3:1 của WCAG 1.4.11 ở cả hai bản. Hạ L không tạo ra lỗi đó và cũng không
chữa được; chữa thật là đổi `card` dark hoặc cho nút một viền, và đó là quyết định
thiết kế riêng cần user xem. Còn lại: `apps/web` **chưa có API client** nào (xem
[rà soát 30/07](analysis/2026-07-30-docs-audit-progress.md)) — việc của ADR-0016.

Tests after: `pnpm gate` xanh — **18/18 task** kể cả `next build` · web **654**
(trước đợt này 649) · API 188 · contract 55 · tokens 10 · ui 5 · i18n 1, tổng **913**.
TDD sitemap: 6 test đỏ trước khi sửa code, 16/16 xanh sau, mutation **4/4 bite**.
Chứng minh dedup đổi 0 pixel: chụp **9 trang** fullPage ở chế độ reduce trước và sau
— **9/9 giống hệt từng byte**. `pnpm test:int` không chạy được ở máy này.

## 2026-07-30 — P3b: cụm Destinations — `/destinations` và ba trang vùng (branch `feat/destinations-pages`, ff-only, commit cuối `03569b4`, 60 commit)

Cụm dài nhất của P3b tới nay. `/destinations` dựng lại **2 lần**, `/destinations/[region]`
dựng lại **4 lần** — mỗi lần vì user xem trang thật rồi bác, và mỗi lần bác đều
chỉ ra một luật đúng mà bản trước vi phạm.

- **Hai trang mới.** `/destinations` (hành trình dọc, 3 vùng lồng địa điểm) và
  `/destinations/[region]` cho 3 slug qua `generateStaticParams`, slug lạ →
  `notFound()`. Mỗi miền **7 khu**, trong đó **6 khu riêng** — chỉ hero, lưới 6
  `TourCard` và footer là giống nhau, đúng ràng buộc user chốt.
- **ADR-0015: rút lớp tint theo vùng TOÀN SITE.** Cụm này *thêm* slot
  `--region-hero` ở Task 1 rồi *xoá cả ba khối* `[data-region]` ở Task 5i, vì user
  kết luận *"màu sắc có lẽ không phải là lựa chọn phù hợp"*. Bản sắc vùng chuyển
  hẳn sang **cấu trúc**: thứ tự khu riêng, gallery riêng ba bố cục
  (`peaks`/`lanterns`/`panorama`), khu chữ ký riêng, và ba **trục chuyển động**
  riêng (Bắc dọc · Trung ngang · Nam nở tại chỗ).
- **Số liệu thành DẪN XUẤT.** `tourCount` trong mock phồng 2–5× so với `TOURS`;
  `lib/regions.ts` tính lại từ nguồn duy nhất. Sửa này lan sang `/about`
  (68 → 16 tour) — một con số sai đã hiển thị công khai.
- **Copy: cắt phần bịa.** ≈202 dòng i18n port từ Nexora quảng cáo **4 địa danh v2
  không bán** (Hà Giang 5 lần, Lan Hạ, Fansipan, Pù Luông = 0 trong mock). Cùng họ
  lỗi ở nhãn gallery: ba vùng cắt chung MỘT danh sách nên trang miền Bắc chú thích
  *"Lantern-lit old town"* (Hội An, miền Trung).
- **Chuyển động (Task 5m/5n/5o).** `lib/motion.ts` giữ con số một chỗ,
  `motion/reveal-header.tsx` cascade cho cả 9 khu, và `motion/reveal-item.tsx` mang
  ba trục miền. Gallery miền Trung cuối cùng chuyển sang cơ chế cuộn của
  `home/gallery.tsx` nhưng lái `scrollLeft` chứ **không** `transform`.

**Review findings — mười lỗi đo được, phần lớn do tự đo chứ không do review báo:**

1. **Cặp `--primary`/`--primary-foreground` chỉ 4.11:1 trong scope dark** (chữ 14px,
   ngưỡng 4.5). Tìm ra sau khi review đã pass. Vá cục bộ bằng `variant="outline"`
   (11.19–12.22:1); **nợ toàn site vẫn còn**, ghi ở ADR-0015 §Hệ quả.
2. **Soft-404.** Một `loading.tsx` ở BẤT KỲ đâu trong chuỗi segment làm slug lạ trả
   **HTTP 200** kèm UI 404. Đo được, nên `destinations/` tuyệt đối không có file đó.
3. **`color-mix(in oklch)` trôi hue** khi cả hai đầu vào có chroma ≈ 0 — Chrome trả
   hue `none`/powerless, ra nền hồng. Chuyển sang `in oklab`.
4. **Nền phớt vùng pha `--region-surface` không đạt AA ở dark**; chip số tour cũng
   trượt. Cả hai do trộn token bất-biến-theme với token lật-theo-theme — một gốc, năm
   biểu hiện.
5. **Dải trắng trên footer.** `site-footer` mang `mt-32` sơn `--background`; khu cuối
   có nền riêng thì 128px đó hiện thành vạch sáng. Giả thuyết `-mb-32` **đo được là
   sai** (`body` là `flex flex-col` nên margin không collapse).
6. **`IntersectionObserver` cắt target qua tổ tiên có clip TRƯỚC khi so root**, nên ô
   4–6 của một dải `overflow-x-auto` không bao giờ bắn observer và **kẹt `initial`
   vĩnh viễn, kể cả ở chế độ giảm chuyển động**. Nới `rootMargin` và đặt
   `viewport.root` đều không chữa — đã thử, đã đo.
7. **`motion-reduce:transform-none` là NO-OP** (Tailwind v4 biên `translate-y-*`
   thành thuộc tính `translate` riêng). Grep toàn repo: đúng 1 chỗ; đã xoá, vì kể cả
   nếu chạy thì nó vẫn sai — `prefers-reduced-motion` xin bớt chuyển động, không xin
   đổi bố cục.
8. **Thẻ lệch pha vì số dòng không cố định**: thẻ chuyến-một-ngày lệch 28px ở hai
   hàng giữa, thẻ nhóm miền Bắc lệch 24px ở khổ 768 (chỗ đó có `border-t` nên hai
   thẻ cạnh nhau có vạch ngang lệch nhau). Hàng giá không lệch vì có `mt-auto`.
9. **Cỡ trang 8 không khớp lưới.** Lưới 2 và 3 cột thì 8 để lại ô mồ côi; 6 là con số
   duy nhất dưới 12 không bỏ ô lẻ ở bất kỳ khổ nào.
10. **Ba brief tôi viết cho subagent có lỗi thật và implementer bắt được**: một brief
    bắt `initial={{opacity:0}}` đồng thời đòi JS-tắt đọc được (không cùng đúng); một
    brief nói repo chưa có reveal trục x (thực có 4 file); một brief nói `scrollLeft`
    để trình duyệt tự kéo ô focus vào tầm (đo được: Tab tới ô 4 thì Chromium để nó
    kẹt 252px ngoài mép và **không** cuộn).

**Nợ mở, nói thẳng:**

- **Task 6 của plan CHƯA XONG: `/destinations` và 3 URL vùng KHÔNG có trong sitemap**,
  và comment `lib/sitemap.ts:22` vẫn ghi *"`/destinations` … CHƯA tồn tại"* — nay
  sai. Trang sống nhưng crawler không thấy.
- **Task 7 CHƯA XONG:** chưa đo 404 trên bản production build, chưa chạy `gate:int`
  ở máy (không có Postgres cục bộ — CI lo).
- `--rating` đo 2.27:1 trên light; 21 file khai `const SPRING` nguyên văn và 19 file
  gõ spring 240 inline, chưa dedup. Cả hai là nợ toàn site có trước cụm này.
- JS tắt còn 15 phần tử `opacity:0` (hero, eyebrow, footer) — pre-existing; cụm này
  làm **giảm** từ 20 xuống 15 vì gỡ 5 lớp `Reveal` bọc trọn khu.

Tests after: `pnpm gate` xanh — **18/18 task** kể cả `next build` · web 649 (trước
cụm 344) · API 188 · contract 55 · tokens 10 · ui 5 · i18n 1, tổng **908**.
Đo thêm bằng Chromium thật trên dev server: đồng bộ thẻ **0 vi phạm** trên 9 nhóm ×
3 miền ở 1440/768 · chế độ giảm chuyển động **0 phần tử kẹt** ở 3 miền × 2 theme ·
JS tắt cả 5 tiêu đề khu đọc được và dải Trung vẫn cuộn native · `body` không tràn
ngang ở 1440/390. `pnpm test:int` không chạy được ở máy này.

