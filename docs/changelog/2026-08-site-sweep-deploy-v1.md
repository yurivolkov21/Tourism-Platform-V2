# CHANGELOG — lưu trữ: rà toàn site và lên sóng thật (19/08–20/08/2026)

Rà 31 route bằng máy lẫn bằng mắt, wizard đặt chỗ 4 bước, email giao dịch dựng
bằng react-email, rồi đưa site lên sóng ở nexora-travel.agency.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-08-20 — Siết verify email: bỏ qua OTP là chưa có tài khoản để dùng (nhánh `feat/require-email-verification`, 1 commit `3bab8e2`, 18 file)

Tester trong nhóm user lách được bước OTP (đăng ký xong chuyển route thẳng
vẫn có session) → user quyết siết theo phương án "bỏ qua verify = khách vãng
lai", KHÔNG chặn trang public (chặn theo emailVerified toàn site phá SSG
ADR-0016 và tạo nghịch lý khách-ẩn-danh-xem-được). Chi tiết ở
[ADR-0017 §6 AMEND](../adr/0017-web-session-better-auth.md) — đảo quyết định
"GIỮ false" của 03/08.

TDD đúng nghĩa: `require-verification.int.spec.ts` viết TRƯỚC (đỏ 2/4 với cờ
cũ), đo được cả chốt UX **verify-email KHÔNG tự đăng nhập** → web đưa về
/login sau verify. API: `requireEmailVerification: true` + `autoSignIn:
false`; login chưa verify → 403 `EMAIL_NOT_VERIFIED`. Web: form login bắt
code này → gửi OTP MỚI (mã signup có thể quá hạn 10') + sang `/verify-email`
giữ redirect; OtpForm xong → `/login?redirect=…`; dải warning
`VerifyEmailBanner` cho session TÀN DƯ chưa verify (loài tự tuyệt chủng —
session hết hạn 7 ngày và không sinh mới được). Admin: form login chỉ dẫn
verify bên www. SEC-1 giữ nguyên, nay cộng hưởng (chưa verify còn không đăng
nhập nổi). Vá 9 file int spec cũ (92 test signup-rồi-dùng-cookie-ngay) —
verify qua DB trong helper vì các test đó không nhắm flow OTP. Một bẫy test
đáng ghi: `vi.clearAllMocks` KHÔNG xả hàng đợi `mockResolvedValueOnce` —
test mới fail giữa chừng làm mock Once rò sang test sau, 2 test cũ đỏ oan.
User test tay 2 luồng chính trên dev: đạt.

Tests after: 1416 web · 238 api · 184 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n · 17 admin.

## 2026-08-20 — Pháo giấy trang thanh toán thành công (nhánh `feat/checkout-confetti`, 1 commit, 6 file)

User duyệt ý tưởng confetti "side cannons" của MagicUI cho `/checkout/success`
(Stripe/PayPal redirect về đây với `?code=`). Island `SuccessCelebration`:
gọi `confetti()` GLOBAL của canvas-confetti theo đúng mẫu Side Cannons —
hai mép bắn chéo ~3 giây, màu lễ hội từ token (primary/rating/sale/info/
success); CHỈ render ở mood `confirmed` (PAID — không ăn mừng đơn PENDING),
guard sessionStorage theo mã booking, tôn trọng reduced-motion. 5 test mới.
Component `@magicui/confetti` cài vào `@tourism/ui` (registry đã khai sẵn);
island cuối cùng KHÔNG dùng wrapper `<Confetti>` của nó — giữ lại trong lib
cho ConfettiButton về sau.

Ba bài học ĐO ĐƯỢC, tốn nguyên buổi truy vết: (1) **guard phải ghi Ở KHUNG
BẮN ĐẦU** — StrictMode dev mount đôi hủy rAF trước khung đầu, ghi guard lúc
effect chạy là mount#2 thấy guard rồi bỏ, pháo không bao giờ nổ trong dev;
(2) **Turbopack dev không hot-reload đáng tin với file trong libs/ lẫn
island** — nhiều vòng đo trúng bundle CŨ, từ nay đổi code xong phải restart
dev server rồi mới tin số đo; (3) **headless chromium không composite canvas
của canvas-confetti** (đường component lẫn global, dù lib vẽ được khi test
cô lập cùng browser) — nghiệm thu CUỐI bằng mắt user trên Chrome thật:
pháo nổ, kể cả booking mới user tự tạo. Demo E2E tự dựng user + booking ép
PAID rồi DỌN SẠCH khỏi DB (dev/prod chung) sau mỗi lượt.

Tests after: 1413 web · 238 api · 180 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n · 16 admin.

## 2026-08-20 — Login admin: ghim sóng BOLD + logo topbar to (nhánh `fix/admin-login-visibility`, 1 commit, 2 file)

User xem bản live chê nền "khó nhận biết" + logo nhỏ. Vòng chỉnh có một bài
học ĐO TỪ SHADER thay vì mò màu: GradientWaves đặt `alpha = fogDepth/dist` —
vùng xa TRONG SUỐT, lộ nền trắng của trang (demo reactbits.dev "đậm" vì nền
họ TỐI, không phải sóng họ đậm); hai vòng đầu chỉnh brightness/màu pastel đều
vô ích. Thuốc đúng: TĂNG `fogDepth` 15→28 (nới vùng đặc màu) + crest mang
`secondary` thay vì trắng + thân sóng `ink`, amplitude 3.2 — user chấm mức
BOLD trong cặp so sánh, param `?waves=` demo đã gỡ. Logo topbar bỏ override
thu nhỏ, mark h-7. gate:int 21/21.

## 2026-08-20 — P4a khép: deploy admin sống + redesign login 2 vòng (nhánh `feat/p4-admin-login-redesign`, 1 commit `8727003`, 14 file)

**Deploy P4a (tay, sau merge `a59381b`)**: Vercel project `admin` (root
`apps/admin`, env import) + domain `admin.nexora-travel.agency` (Vercel DNS,
TLS tự cấp) + `TRUSTED_ORIGINS` thêm origin admin trên Render — smoke từ
ngoài: `/` 307 về `/login` đúng redirect param, CORS preflight 204 với
origin admin, cookie chung nghiệm thu tay (đăng nhập admin ↔ www thấy nhau).
URL `*.vercel.app` bị Vercel Authentication chế độ `all_except_custom_domains`
— GIỮ: thêm một lớp cho back-office, domain thật vẫn do cổng login mình gác.

**Redesign login theo nếp copy-link-scan-wireframe**: vòng 1 bám ReUI
`auth-1` (2 cột, card ảnh Ninh Bình) → user chê input xuyên thấu nền; vòng 2
đổi mẫu `auth-8` (mockup lưu `docs/design/mockups/admin-login/`): card ĐẶC
giữa màn (khung muted bọc card trắng, input `bg-card`), topbar pill "Looking
for the main site?", caption tagline. Nền: user chọn **GradientWaves của
React Bits** — cài component GỐC qua registry shadcn
(`@react-bits/GradientWaves-TS-TW` → `@tourism/ui`, WebGL/ogl, dep mới
`ogl`); wrapper `login-waves.tsx` nhuộm màu token (hex từ
`@tourism/tokens/theme`) + `prefers-reduced-motion` (speed 0), thông số giữ
đúng mặc định panel Customize (khối hằng khớp 1-1 nhãn panel). **Logo Slidex
đồng bộ**: port `logo.tsx` sang admin (login + shell hết ô "N" tự chế); mail
cũng thay — mark xuất PNG 4.7KB lên CDN (`tourism/brand/nexora-mark`) vì
Gmail lột inline SVG, thay cả mini-header lẫn monogram; sửa phụ tagline
footer mail bị `toLowerCase` nuốt chữ hoa "Vietnam".

Bẫy đo được: (1) registry component dính 3 lỗi `noUncheckedIndexedAccess`
(đúng gotcha CLAUDE.md) — vá guard + hàm `uni()`, `any`→`unknown`;
(2) `Button render={<a>}` của Base UI cảnh báo nativeButton → dùng
`ButtonLink` (JSDoc của nó giải thích vụ role link); (3) Next 16 dev CHẶN
cross-origin: chụp headless qua `127.0.0.1` làm chunk 403 → trang không
hydrate — phải dùng `localhost`; (4) Google OAuth `redirect_uri_mismatch`
trên prod: client ID tái dùng từ Nexora cũ chỉ cho redirect về hệ cũ —
hướng dẫn user thêm origin + redirect URI mới trên Google Console (kết quả
ghi khi user xác nhận).

Tests after: 1408 web · 238 api · 180 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n và 16 admin (gate:int 21/21).

## 2026-08-20 — P4a: scaffold app admin riêng + cổng đăng nhập (nhánh `feat/p4a-admin-scaffold`, 1 commit `a59381b`, 27 file)

Mở P4 theo [ADR-0026](../adr/0026-p4-admin-app.md) + [spec P4a](../specs/2026-08-20-p4a-admin-scaffold-design.md)
(sau [khảo sát Nexora cũ](../analysis/2026-08-20-admin-parity-nexora.md): 40
trang · 18 vùng · ~60 endpoint admin). `apps/admin` mới: Next 16.3.0 + React
19.2.4 (đúng bản workspace ghim — KHÔNG đuổi mới nhất, luật một-React), cổng
3002, tái dùng tokens/ui/i18n (khối copy `admin` mới trong `@tourism/i18n`).
Cổng đăng nhập 3 nhánh đo E2E THẬT bằng browser trên dev: chưa đăng nhập →
`/login?redirect=…` (proxy kiểm cookie 2 tên như bài học I-1 của web);
CUSTOMER đăng nhập đúng mật khẩu → màn `/not-authorized` nói rõ (layout gác
bằng hàm thuần `decideAdminAccess`, fail-closed role lạ/rỗng); ADMIN → shell
sidebar 3 nhóm × 15 mục phủ 18 vùng (mục chưa mở badge "Soon" disabled, không
link chết) + nav-user. Smoke dùng user tạo tạm mật khẩu ngẫu nhiên và XOÁ
sạch khỏi DB sau chụp (dev/prod chung DB — không để account ADMIN trôi nổi);
user seed `admin@tourism.test` hoá ra là tác giả posts trong seed, FK chặn
đúng lúc — không đụng. Bẫy đo được: `@tourism/ui` nền Base UI dùng `render`
prop, KHÔNG có `asChild` kiểu Radix; app con cần `.gitignore` riêng
(`next-env.d.ts` do Next sinh làm Biome pre-commit đỏ); Next 16 tự sinh
`AGENTS.md`/`CLAUDE.md` trong app — commit như web. 14 test mới (ma trận
gate 7 + form login 5 + validate 2), gate:int 21/21 task. Còn lại của P4a:
deploy tay (Vercel project admin + domain + `TRUSTED_ORIGINS`) — hướng dẫn
từng bước như deploy v1, xong sẽ ghi tiếp vào entry này hoặc entry mới.

Tests after: 1408 web · 238 api · 180 api-int · 87 contract · 22 ui · 10 tokens
· 2 i18n và 14 admin.

## 2026-08-20 — Rà tiến độ + đồng bộ docs về hiện thực (sweep docs-only)

User hỏi "có bỏ lỡ gì không" → rà bằng ĐO chứ không nhớ:
[báo cáo tiến độ 20/08](../analysis/2026-08-20-progress-report.md) (31 route ·
36 endpoint · 1.947 test · ảnh phủ đủ query từ DB — 29/29 tour, 18/18 địa
danh, 9/9 bài, 48/52 khe với 4 khe trống là seed-only chưa ai đọc). Kết luận:
không còn món chặn; kế tiếp P4 admin. Docs lệch hiện thực được kéo về:
CLAUDE.md roadmap (P3b ✅ + deploy v1 ✅ + cảnh báo "sửa gì cũng là sửa đồ
đang chạy"), README khép dòng P3b/Hộ chiếu (2 dòng còn ghi 🔶 chờ dù đã merge
11/08), backlog gạch A8+E4 (nợ ảnh — số liệu 17/08 đã lỗi thời) và thêm mục F
(nợ sau deploy: Resend webhooks · payload mail thiếu hero/rating · preview
origin · dev/prod chung DB · Render ngủ 15′), spec deploy §10 gạch món
react-email. Hai rủi ro trước bảo vệ nêu ở báo cáo: dev/prod chung DB và
Render free ngủ 15 phút.

Tests after: không đổi (1408 web · 238 api · 180 api-int · 87 contract ·
22 ui · 10 tokens · 2 i18n) — sweep docs-only.

## 2026-08-20 — Email giao dịch render react-email, hệ Barebone port từ Nexora cũ (nhánh `feat/email-react-templates`, 1 commit `6a3725b`, 10 file)

User xem mail thật sau deploy và chê "trắng, chán" → [ADR-0025](../adr/0025-transactional-email-react-email.md):
chọn react-email v6 in-code, LOẠI Resend Templates dashboard sau khi đối chiếu
docs chính thức (chỉ thay biến `{{{VAR}}}` không if/else — 13 loại mail đầy
khối tuỳ chọn sẽ bùng nổ template con; thiếu biến không fallback = mail không
gửi, outbox FAILED âm thầm; template sống ngoài repo — không test, không CI).
Vòng 1 tự dựng layout tối giản → user loại; vòng 2 khảo mẫu đúng nếp
design-research (gallery react.email + kho Nexora cũ) và phát hiện
`email.templates.ts` của repo cũ chính là port "Barebone" (MIT, react.email)
user đã duyệt 13/07 → port nguyên hệ: khung trắng 640 (N-square + wordmark) ·
card xám căn giữa heading serif · data card nhãn/giá-trị hairline (booking
hiện cả ngày khởi hành — payload có sẵn) · quote card · pill trạng thái · nút
CTA route thật derive từ `FRONTEND_URL` · footer "why you got this" +
unsubscribe; copy bản cũ giữ lại ("You're going, Alice!"); field v2 thiếu
(hero tour, rating sao) degrade monogram, không bịa. Kèm bản plain-text mỗi
mail (2 part). Kỹ thuật: `renderEmail` async (render() streaming React);
`.swcrc` tách config theo đuôi file (`.tsx` parser tsx + react automatic,
`.ts` giữ decorator); bỏ `escapeHtml` tự chế (React escape, subject vẫn cắt
CR/LF); khối `brand` của `@tourism/i18n` có consumer đầu tiên (tagline
footer); `pnpm-workspace.yaml` chốt `esbuild: false` (dep bắc cầu react-email,
binary từ optional dep). Hai vòng duyệt visual qua artifact preview 13 mail.
Bẫy đo được: nhiều text node JSX liền nhau bị React chèn `<!-- -->` — chuỗi
hiển thị phải gộp MỘT template literal.

Tests after: 1408 web · 238 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-20 — Deploy v1 bước 4–7: lên sóng thật + smoke 5/5 (làm tay trên dashboard, sweep docs-only)

Khép [spec deploy v1](../specs/2026-08-19-deploy-v1-design.md) (ADR-0024 →
"Đã triển khai"). Bước 4–6: API Docker lên Render free (`nexora-api`,
Singapore, worker inline, health 200), DNS `api` CNAME trong Vercel DNS
(domain mua qua Vercel), web lên Vercel (root `apps/web`) gắn
`www.nexora-travel.agency` + apex; Vercel tự deploy theo push main — đã
kiểm bằng vòng nhãn checklist mật khẩu. Bước 7: Resend verify domain,
Stripe Workbench tạo event destination trỏ `api…/api/payments/stripe/webhook`.
Bẫy đo được: (1) API key Resend tạo TRƯỚC khi domain verified → mọi mail 400
`"The associated domain with your API key is not verified"`, outbox kẹt
PENDING→FAILED dù worker drain đúng nhịp; fix = key MỚI sau verify. (2) Hàng
outbox FAILED (hết 5 attempts) không tự sống lại — OTP bấm resend, welcome
subscribe lại. (3) PayPal secret copy khi chưa bấm reveal → giá trị cụt;
sanity check PASS/FAIL (không in secret) bắt được. Smoke chốt bằng dữ liệu
prod: `EMAIL_OTP SENT` · user verified + promote ADMIN (SEC-1) · booking
PAID với `payment_events.payment.completed` (webhook Stripe sống) ·
BOOKING_CONFIRMATION/ENQUIRY_RECEIVED/ENQUIRY_ADMIN_ALERT/NEWSLETTER_WELCOME
đều SENT; user xác nhận nhận đủ mail ở inbox thật. Sổ nợ sau deploy ghi ở
spec §10 (Resend webhooks + Audience, react-email, preview origin, dev/prod
chung DB, Render ngủ 15′).

Tests after: 1408 web · 222 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n (không đổi — sweep docs-only).

## 2026-08-20 — Checklist mật khẩu: từ thật thay viết tắt (nhánh `fix/password-checklist-labels`, 1 commit, 1 file)

User xem bản live sau deploy và bắt lại một quyết định của vòng nén 768p
(19/08): nhãn pill `a–z · A–Z · 0–9 · !@#` đọc như KÝ TỰ LỖI với người dùng
thường — "mình test thì biết nghĩa, nhưng phán đoán của mình không đại diện
cho người dùng". Đổi sang từ thật `8+ chars · lowercase · uppercase · number ·
symbol`, vẫn MỘT dòng (điều kiện vừa laptop 768p): "8+ characters" nguyên chữ
làm "symbol" gãy xuống dòng hai lẻ loi nên chốt `8+ chars` + `gap-x-2`. Đo
worst-case 1366×681 (3 lỗi + checklist): overflow 0, pill 1 dòng. Câu đầy đủ
giữ ở tooltip + sr-only. Đây là fix đầu tiên đi theo vòng ĐỜI mới: merge →
push → Vercel tự deploy — không còn "xong trên dev" là hết chuyện.

Tests after: 1408 web · 222 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-20 — Deploy v1 bước 3: code chuẩn bị prod (nhánh `feat/deploy-v1-prep`, 1 commit, 9 file)

Theo [spec deploy v1](../specs/2026-08-19-deploy-v1-design.md) §3 (ADR-0024).
`COOKIE_DOMAIN` (env optional) bật `advanced.crossSubDomainCookies` — đường
CHUẨN ADR-0017 §4, dev không set nên hành vi giữ nguyên từng byte.
`WORKER_INLINE='true'` (giá trị lạ ném lúc boot): ruột vòng worker tách ra
`worker/start-worker.ts` dùng chung hai entrypoint — `dist/worker.js` (process
riêng, kiến trúc gốc) và INLINE trong tiến trình API (Render free không có
Background Worker — user chốt 20/08). Hai bẫy ĐO ĐƯỢC khi làm: bắt SIGTERM tay
cho worker inline thì đua với shutdown hook của Nest và thua (process thoát
trước khi pg-boss stop graceful xong) → dừng phải đi qua hook `onClose` của
Fastify để được await trong `app.close()`; và `addHook` sau `listen` ném
`FST_ERR_INSTANCE_ALREADY_LISTENING` → hook đăng ký TRƯỚC listen với ref
`stopWorker` gán SAU listen (worker khởi động sau listen cho health check thấy
cổng ngay). Smoke trên DB docker: health 200 · loops started · SIGTERM →
stopped → thoát sạch. Kèm: `render.yaml` một service Docker (env `sync:false`),
mẫu `.env.production` hai app (gitignored — user điền rồi import "Add from
.env"/"Import .env" thay vì điền tay từng ô; rà đủ 26/26 biến schema, sanity
check 15 PASS không in giá trị), `.env.example` +2 key, 3 test env mới.
Bước 1–2 (user làm tay): domain gỡ khỏi 2 project Nexora cũ — DNS ở VERCEL
nameservers (mua qua Vercel, hạn 07/2027); DB prod dùng chung Supabase v2
(kiểm: 29 tour · 52 khe · 12 migration; ⚠ dev/prod chung DB).

Tests after: 1408 web · 222 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Khép đợt rà toàn site: 31 route rà máy + rà tay (nhánh `fix/page-sweep-round-2`, 1 commit, 1 file)

Sau ba vá lẻ (Book a tour, 2 `<h1>` trang tour, ...), rà tự động phần còn lại —
`/destinations` + 3 vùng, `/blog` + bài, `/about`, `/contact`, `/faq`, 3 pháp lý,
unsubscribe, 6 auth, 404 ×2, `/enquire` — với cùng một lưới: ảnh vỡ, ô giữ chỗ,
ô gradient sót, số `<h1>`, link chết (`#`, `#top` ngoài social), anchor không
đích, lỗi console, chữ "Tourism" sót, title. Tất cả sạch; hai lỗi console ở 404
tour là artefact dev của Next/React. Một món: 404 chung có `<title>` "Nexora"
trần trong khi 404 của tour/bài/vùng đều "… not found — Nexora" → `not-found.tsx`
export `metadata` tĩnh (thử chèn `<title>` tay trước: ra HAI thẻ và trình duyệt
lấy thẻ đầu của layout — bỏ). Khu account/checkout/wizard cần đăng nhập nên user
rà tay: ổn. User chốt từ đây gom sửa của một đợt rà vào một nhánh, merge một lần
để không chờ CI nhiều lượt.

Tests after: 1408 web · 219 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Rà `/tours` + `/tours/[slug]`: một `<h1>` mỗi trang (nhánh `fix/tour-detail-double-h1`, 1 commit, 2 file)

Rà tự động `/tours` (10 card, 0 ảnh vỡ, 0 ô giữ chỗ, `priceFrom` sống sau khi
user restart API — card Vũng Tàu "from $119 −20%") và 4 trang chi tiết qua đủ 5
tab: 0 link chết, anchor card dữ kiện là hash tab thật, Reserve đúng ghế đợt
đang chọn. Một lỗi: **2 `<h1>`/trang** — `TourHero` giữ `<h1>` và
`TourMediaPanel` lặp tiêu đề cũng bằng `<h1>` (cùng họ lỗi receipt đã vá cùng
ngày). Panel dùng `<p>` cùng lớp chữ (không đổi pixel), test "panel không có
heading cấp 1".

Tests after: 1408 web · 219 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Rà trang Home: nút "Book a tour" navbar là link thật (nhánh `fix/navbar-book-link`, 1 commit, 2 file)

Đợt user rà từng trang. Rà tự động Home (1440×900, cuộn hết): 25 ảnh, 0 vỡ, 0 ô
giữ chỗ, 0 lỗi console, một `<h1>`, 59 link đều trỏ route thật — trừ 7 icon mạng
xã hội `#top` (user chốt GIỮ, chờ URL thật — sổ nợ A16). User bắt bằng mắt: nút
**"Book a tour"** trên navbar không làm gì — `<button type="button">` không
handler từ bản static-first. Nay là link tới `/tours` (chọn tour để đặt; Reserve
nằm ở trang chi tiết), giữ skin hai chế độ nền; `site-header.spec.tsx` mới khoá
CTA là link `/tours` + 4 link chính đúng route.

Tests after: 1407 web · 219 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Dọn sổ nợ nhỏ P3b: 774 dòng i18n mồ côi, `TourCard.priceFrom` (nhánh `chore/p3b-debt-sweep`, 1 commit, 20 file)

**B1 mở rộng.** Sổ nợ ghi "khối `contact.*` mồ côi ~90 dòng"; quét có hệ thống
(mỗi khoá cấp-1 của `messages`, grep `messages.<khoá>` ở apps/web + libs/ui, bỏ
spec) lộ **21 khối / 774 dòng** không consumer — `auth` (230 dòng, nháp form
static-first trước khi có `authForms`), `about`, `contact`, `footer`, `hero`,
`features`, `fieldErrors` (bản cũ, nay là `formErrors`), `trustBand`… — toàn
nháp static-first hoặc port Nexora đã bị thay bằng copy trong component/khối
mới. Xoá hết; **giữ** `mobile` (P5), `chatBot`/`contactLauncher` (P6), `brand`
vì đó là copy cho phase tới, không phải nháp. Cách quét ghi ở đầu `messages.ts`
để lần sau không phải dò lại. Nợ còn lại thuộc họ này nhưng là việc riêng:
copy Home/user-menu đang literal trong component (luật 7) — một "i18n sweep".

**A14 (sổ nợ cùng ngày).** Thẻ `/tours` in `basePrice` "from $129" trong khi chi
tiết có đợt thấp điểm $119 — list không mang departures nên card không biết.
Contract `TourCard.priceFrom` = `min(priceOverride ?? basePrice)` trên đợt OPEN
sắp tới, API tính **một query cho cả trang** (hai cột, lọc y như detail; không
N+1), không đợt → `basePrice`; detail dùng lại departures đã load. Card dùng
`priceFrom ?? basePrice` và tính % giảm trên `priceFrom` — rơi về có chủ đích:
field additive, API deploy SAU web (hoặc API dev chạy bản build cũ — script
`dev` là build-một-lần) thì card vẫn ra số thay vì vỡ trang vì một field. Int
test `catalog` assert `priceFrom` = basePrice khi override đắt hơn; card test.

**CI đỏ một nhịp (`fa4f8e7` → vá `fix/contract-spec-pricefrom`).** Mình chạy build
contract mà KHÔNG chạy test contract: fixture `catalog.spec.ts` thiếu `priceFrom`
→ 9 test ZodError. Bài học đúng luật #11: gate là `turbo run build typecheck test`
cho MỌI package, không phải chạy lẻ từng mảnh vừa sửa — đợt này đã chạy đủ (15
task xanh) trước khi vá lên. Thêm test "priceFrom bắt buộc" để field này không
rơi khỏi fixture lần nữa.

**E5 rà lại:** 4/6 đã trả ở đợt redesign account (connected-accounts qua i18n ·
saved-grid có nhánh 401 riêng · `refundedTotal` trên contract · DENIED không
hiện lý do là CỐ Ý — `decisionNote` không mở cho khách); còn `user-menu` label
literal và load-more cap 50. **A5** tem thư "Hà Nội · Sa Pa" không đụng — user
chốt 06/08 giữ làm motif. Backlog cập nhật (thêm mục A″: A14 ✅, A15 register
<681px).

Tests after: 1405 web · 219 api · 180 api-int · 87 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Vòng motion cho năm nhóm trang còn tĩnh (4 nhánh `feat/motion-*`, 4 commit, 26 file, +727/−413)

User nhớ "vài trang thiết kế lại chưa có motion". Rà 31 route theo code (motion/react,
`Reveal*`, keyframe `animate-*-in`; bỏ qua hover `transition-*`): Home/About/Contact/
Destinations+3 vùng/Tours listing/Blog/FAQ/6 trang auth + `ContentHero` đã đủ;
**năm nhóm tĩnh** đều là trang dựng lại gần đây từ wireframe chưa qua vòng motion.
Làm theo thứ tự khách đi qua nhiều nhất, mỗi nhóm một nhánh, toàn bộ bằng vật liệu
sẵn có (`RevealItem` rise/slide/bloom, `SPRING`, `STAGGER.grid`, `REVEAL_EASE`),
transform-only trừ hero mount — cùng luật SSG của `reveal-item.tsx`:

1. **`/tours/[slug]`** — đổi tab: keyframe CSS `pane-in` trên panel `:not([hidden])`
   (fade + trượt 10px, 360ms): panel `keepMounted` chỉ bật/tắt `hidden` (ADR-0022),
   mà toggle `display:none` → hiển thị KHỞI ĐỘNG LẠI animation CSS, nên không cần
   state/AnimatePresence; 4 card dữ kiện, 4 stat card, thẻ policy, 2 review mồi, 3
   tour liên quan trồi bậc thang; hàng bảng Departures dùng lại `tour-card-in` khi
   tháng xổ ra (`<tr hidden>` cùng cơ chế). Đo: pane opacity 0→1/y 10→0, stat card y
   lệch pha, hàng bảng `animationName: tour-card-in`.
2. **Wizard `/book`** — bước mới trượt vào theo HƯỚNG (tiến từ phải 24px, lùi/Edit từ
   trái), chỉ animate bước VÀO, bước cũ unmount ngay — cố ý không AnimatePresence:
   `wait` để cột trống một nhịp, `popLayout` chồng chữ hai bước ~200ms; vạch stepper
   scale ngang từ trái khi đổi bước (`initial={false}` — không chạy lúc tải); tổng
   tiền trượt lên 6px mỗi lần đổi (`key` theo số tiền).
3. **Khu Account "Hộ chiếu"** — tấm hộ chiếu `bloom`; nhật ký từng năm, booking
   accordion từng mục, thẻ đã lưu `rise` bậc thang (wrapper ngoài `AccordionItem` —
   Base UI nối item qua context); **chữ ký mới `stamp`** (scale 1.22→1, −6°→0°) cho
   con dấu visa ở chi tiết booking — biên độ mạnh có chủ đích, đây là khoảnh khắc
   kể chuyện chứ không phải ô lưới.
4. **Hoá đơn checkout** — "in ra" 4 khối nối nhau (đầu phiếu → 3 cột → tổng → cuống);
   bản in/JS tắt vẫn đủ chữ vì transform-only.
5. **Hero bài blog** — vào cùng đúng số với `ContentHero` (breadcrumb −16/.1 → h1
   40/.2 → meta 20/.3, `animate` lúc mount như mọi hero). Pháp lý đã có `ContentHero`,
   thân bài đọc dài **cố ý để yên**; `/enquire` là form, cố ý tĩnh.

7 spec thêm stub `IntersectionObserver` CỤC BỘ (quy ước `reveal-item.spec.tsx`).

Tests after: 1404 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Tên thương hiệu về lại "Nexora" (nhánh `feat/brand-nexora`, 1 commit, 48 file, +80/−76)

User quyết định dùng lại tên **Nexora** của bản tiền nhiệm thay cho tên tạm
"Tourism". Đổi ở MỌI chuỗi user-facing: wordmark `Logo` (`nex|ora`, giữ lối chữ
thường hai tông), `aria-label` navbar/footer/auth, watermark + © footer,
`messages.brand.name` và các câu có tên ("Why travelers choose…", "Your journeys
with…", Concierge, "Hi Nexora!", "Hello Nexora," ở thư /contact, "Why Nexora" ở
Home, copy /about), 33 title metadata `— Nexora`, RSS, ba văn bản pháp lý (+ địa
chỉ bưu điện), email Resend (chữ ký, subject newsletter), PayPal `brand_name`,
`EMAIL_FROM` mặc định + `.env.example`. Spec pháp lý đảo guard: trước cấm sót
"Nexora" (khi brand là Tourism), nay cấm sót "Tourism" viết hoa (tên riêng —
không bắt "tourism" nghĩa chung). **Cố ý không đổi:** scope package `@tourism/*`,
email `tourism.platform.online@gmail.com` và `*@tourism.test`, folder Cloudinary
`tourism/…` (đổi là đứt publicId), partner "Vietnam Tourism Board", comment
tiếng Việt (lịch sử). Ghi chú môi trường: container Postgres docker local đã tắt
từ trước (không do đợt này) làm 4 e2e api đỏ khi chạy tay — bật lại là xanh.

Tests after: 1404 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Ba bưu thiếp khối Signature trang Nam có ảnh thật (nhánh `feat/region-signature-images`, 1 commit, 6 file)

Ngay sau đợt "in photos", user chỉ ra khối **Signature "Life on the water"** của
trang Nam (`RegionSignaturePostcards`, 3 bưu thiếp 3/4 dọc) vẫn là gradient —
đợt trước mình chỉ rà section gallery. Cùng cách A: 3 khe
`region-signature-south-1..3` (seed → 52 khe site), ảnh lấy lại từ gallery địa
danh đã duyệt/đang sống trên CDN: `ben-tre/06` (sampan trong rạch dừa) ·
`ho-chi-minh-city/14` (nhà thờ Tân Định giữa phố — đúng "City energy &
history") · `phu-quoc/04` (tháp đồng hồ lúc hoàng hôn). Caption Phú Quốc đổi
"Island beaches" → "Island sunsets" vì caption đi theo ảnh, kho chưa có ảnh bãi
biển Phú Quốc. Component nhận `images` theo chỉ số bưu thiếp, page fetch chỉ
khi vùng có `postcards`; `NEEDED.md` +3; 2 test mới. Rà lại: Bắc/Trung không có
khối tương đương (intro chữ / timeline chữ) → **ba trang vùng không còn ô giữ
chỗ nào**.

Tests after: 1404 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Footer phản ánh đúng bản đồ route (nhánh `fix/footer-links`, 1 commit, 2 file)

User để ý footer "để các mục không liên quan": 'Destinations' còn trỏ
`/#gallery` (trang /destinations có từ 30/07), bốn mục Company 'Our guides /
Careers / Press / Partners' trỏ `#top` — link chết cho trang không tồn tại,
'Booking help' trùng FAQ, bottom bar là chữ trơ "Privacy · Terms · Cookies" không
bấm được và không có trang Cookies. Sửa thành ba nhóm đúng route: Explore
(Tours · Destinations · Journal · About us · Traveller reviews — anchor `/#reviews`
thật) · **Your account** (My bookings · Saved tours · Profile · Settings · Log in;
`/account/*` qua `proxy.ts` nên để cho mọi khách được) · Support (Contact us ·
FAQ · Cancellation policy · Terms · Privacy); Privacy/Terms ở bottom bar thành
link, bỏ Cookies. Social icon vẫn `#top` giữ chỗ — chưa có tài khoản thật, URL
bịa còn tệ hơn. Test mới: **mọi link chữ trong footer phải thuộc bản đồ route
thật** (23 route/anchor liệt kê trong spec) — thêm route thì thêm vào đó, link
chết là đỏ ngay chứ không đợi khách bấm phải.

Tests after: 1402 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Ba trang vùng hết ô giữ chỗ: 15 ô "… in photos" có ảnh thật (nhánh `feat/region-gallery-images`, 1 commit, 8 file, +225/−44)

Section `RegionGallery` (Bắc 6 ô peaks · Trung 6 lanterns · Nam 3 panorama) là
chỗ cuối cùng trên ba trang vùng còn nền gradient — CHANGELOG 18/08 đã ghi là
"lựa chọn thiết kế cũ chưa rà lại". User chọn đường A (như đợt Moments 18/08):
**không tìm tấm nào mới**, lấy lại ảnh gallery địa danh đã duyệt và đang sống
trên CDN, chọn theo HÌNH Ô rồi viết caption theo ảnh. Mình dựng contact sheet
133 ảnh cục bộ (Sa Pa/Hạ Long/Huế/Cần Thơ không có ảnh trong inbox), chọn 15
tấm — ưu tiên phủ nhiều địa danh (Bắc 5/7, Trung 3/5, Nam 3/6), ảnh dọc cho ô
dọc, ảnh 1.86 cho ô 16/9 — dựng bảng cắt đúng tỉ lệ ô cho user duyệt trước khi
upload (ADR-0020). 15 khe site mới `region-gallery-<vùng>-<n>` khoá theo VÙNG +
VỊ TRÍ Ô (hình ô là bất biến của bố cục đã duyệt; đổi ảnh giữ khoá, caption ở
i18n `galleryTiles` cùng chỉ số); thêm vào `SITE_SLOT_KEYS`, chạy lại seed trên
Supabase dev (upsert, 49 khe), `media:upload` (publicId cố định, ảnh cũ không
đổi), `NEEDED.md` +15 dòng. Code: `RegionTile` nhận `image` — đổi ruột, giữ bố
cục/trợ năng/lightbox; page fetch 6/6/3 khe qua `siteMediaImage` (một lần gọi
nhờ `cache()`); 7 test mới. Sổ nợ 18/08 về `RegionTile` gradient: **đã trả**.

**Bẫy gặp lại, và đã ghi một lần ở 17/08:** page (server) import `TILE_COUNT`
từ `region-gallery.tsx` (`'use client'`) → hằng thành client-reference proxy →
`TILE_COUNT[variant]` là `undefined` → `Array.from({length: undefined})` = `[]`
→ trang render bình thường, chỉ… không có ảnh, không một dòng lỗi. Phát hiện vì
HTML SSR thiếu publicId dù API đã trả đủ 15 khe. Dời `TILE_COUNT`/`GalleryVariant`
sang `lib/region-theme.ts` (module không client), `region-gallery.tsx` re-export
để consumer/spec cũ không đổi. Đo sau: Bắc 6/6 · Trung 6/6 · Nam 3/3 ảnh load.

Tests after: 1399 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Thẻ địa danh ở gallery trang chủ có đích thật (nhánh `fix/home-gallery-links`, 1 commit, 2 file)

User hỏi: bấm thẻ ở section "From the northern mists to the southern delta" thì
chỉ cuộn xuống form Contact — "chủ ý hay chưa gắn link?". Không phải chủ ý:
`href="#contact"` là chỗ để tạm từ bản static-first (chưa có trang đích) rồi bị
bỏ quên qua cả đợt nối API destinations. Đích đúng theo tiền lệ
`destination-tile.tsx` ở /destinations: `/tours?destinations=<slug>` (danh sách
tour lọc theo địa danh — không có trang riêng từng địa danh, trang vùng là cấp
trên). Kiểm sống `/tours?destinations=sa-pa` → 200, lọc còn 2 tour. Test mới
khoá href và khẳng định không còn `a[href="#contact"]` trong gallery.

Tests after: 1392 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Một giá gốc duy nhất trên trang tour, hero bám đợt đang chọn (nhánh `fix/tour-price-anchor`, 2 commit, 8 file)

User hỏi: hero in "from $129 was $149 −13%" mà khối chọn ngày lại "$119 was
$129 7% off" — "rốt cuộc giá gốc ở đâu?". Soi dữ liệu thật: 22/29 tour có HAI
neo chồng nhau — `tour.compareAtPrice` (niêm yết 149 trên base 129) và
`departure.compareAtPrice` (seed đặt = base cho đợt thấp điểm: 119 neo 129).
Mỗi bề mặt lấy một neo: hero theo neo tour + `basePrice` (sai kép — "from" mà
không phải giá thấp nhất khi có đợt 119); panel ảnh/rail/strip/bảng theo neo
đợt (Sep/Nov không gạch gì dù hero vừa hứa −13%; Oct rẻ hơn lại "giảm ít hơn").

Sửa hai tầng. (1) `resolveDepartureAnchors` áp MỘT LẦN ở `fetchTourDetail`: mỗi
đợt có ĐÚNG MỘT giá gạch = neo cao nhất áp được `max(neo đợt, neo tour)`, chỉ
giữ khi thật sự cao hơn giá trả — neo tour là giá niêm yết đã công bố nên áp
cho mọi đợt là trung thực, đợt cao điểm có neo riêng cao hơn giữ neo riêng; mọi
bề mặt đọc cùng dữ liệu nên tự đồng bộ. (2) Hero: vòng 1 làm "from" = đợt rẻ
nhất còn chỗ (`heroPrice`); **user bác ở vòng 2** — "khách chỉ hiểu một giá,
giữ giá rẻ nhất cố định trên hero trong khi bên dưới đổi theo đợt là hai con
số cho một quyết định, chọn nhầm ngày là rắc rối". Nên hero BÁM ĐỢT ĐANG CHỌN
qua `useOptionalDepartureSelection` (không ném khi thiếu provider — `/book`,
`/enquire` dựng hero qua `TourHeroBoard`), nhãn "from" bỏ khi đang bám đợt (đó
là giá của đúng ngày đó) → "per person"; "from" + đợt rẻ nhất chỉ còn khi không
có bộ chọn hoặc mọi đợt hết chỗ. Đo: chọn 19 Sep → hero lẫn panel cùng "$129
was $149 −13%"; 17 Oct → cùng "$119 was $149 −20%". 8 test lib + 4 test hero.

Sổ nợ: thẻ ở `/tours` vẫn in `basePrice` "from $129 −13%" — contract list không
mang departures nên không biết đợt 119; muốn khớp cần thêm `minPrice` vào
contract list (việc API, đợt khác).

Tests after: 1391 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Cột ghế bảng đợt khởi hành rộng theo sức chứa (nhánh `fix/departures-seats-column`, 1 commit, 2 file)

User báo tab Departures: tour từ ~11 chỗ trở lên thì thanh ghế tràn sang cột
Status. Nguyên nhân: cột Seats ghim cứng 200px (trừ `pr-3` còn 188) mà thanh
`inline-flex` mỗi đốt 12 + khe 4 → chứa được đúng 11 đốt; dữ liệu thật có 16
(Vũng Tàu, Grand Journey), 20 (Lan Hạ) và 22 chỗ (Hạ Long cruise) — 22 tràn tới
tận cột Price. Contract chỉ ép `positive()` (DB mặc định 20) nên admin P4 đặt
40 cũng hợp lệ. Sửa: `seatsColumnWidth(n) = min(16·n + 32, 400)` — cột ghế
rộng theo sức chứa, thêm 20px thở trước Status (user góp ý vòng 2: "sát quá",
cột Month/Date đang dư nên nhường), kẹp trần 400 để tour 40 chỗ không nuốt cột
ngày; Status 124 → 112 (huy hiệu dài nhất "Almost full" ~90). Lưới an toàn: dưới
`xl` kẹp 30% bảng và thanh ghế đổi `inline-flex` → `flex` để đốt CO ĐỀU thay vì
tràn — không viewport nào tràn được nữa, vẫn "một đốt = một ghế". Bẫy đo được:
Chromium coi `min(px, %)` trên ô bảng `table-fixed` là `auto` (327px thay vì
264) — chỉ px trần / % / `var()` được tôn trọng, nên bề rộng đi qua biến CSS
trên `<th>` (ô hàng đầu quyết cột). Đo khung 1054: 22 chỗ → Seats 384 / Date
270, 16 chỗ → 288 / 366; ở 1024 đốt co 8,3px, 820 co 5,5px. 2 test mới.

Tests after: 1379 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Phân trang ba explorer: hết hở trắng, cuộn về đầu lưới, và cuộn phải đi qua Lenis (nhánh `fix/blog-pagination-gap`, 3 commit, 13 file, +297/−14)

User báo `/blog` sang trang 2 thì "footer bị đẩy lên, lộ khoảng trắng, rồi tự
hết". Đo bằng Chromium headless trên dev server thay vì đoán: **không phải load
chậm** — cả 9 bài đã ở client. Lưới co ngay 1832 → 829px (trang 2 chỉ 3 bài) nên
footer nhảy lên ~1000px, nhưng khung hình vẫn đứng ở toạ độ thanh phân trang cũ,
giờ là vùng footer; đồng thời `AnimatePresence mode="popLayout"` ép 6 thẻ cũ
thành `position:absolute` tại chỗ cũ trong ~600ms để fade-out, và vì lưới không
`relative`, khối chứa của chúng là `body` → chúng KÉO chiều cao cuộn của trang
(2340 thay vì 2020) và đè lên footer; ghost unmount thì trang tụt về, trình duyệt
kẹp scroll → "trở lại bình thường". Sửa gốc hai điểm: đổi trang thì cuộn về ĐẦU
LƯỚI (hành vi mọi phân trang; chỉ khi bấm thanh phân trang — lọc/tìm cũng về
trang 1 nhưng người dùng đang đứng ở sidebar), và lưới `relative overflow-clip`
để ghost không kéo chiều cao trang hay đè footer (áp cả khi lọc). Đo sau: docH
đúng ngay tại t=50ms, cuộn mượt về đầu lưới. Cùng đợt dời dòng "N stories" vào
hàng đầu của khung filter cạnh "Filters" (góp ý user) — hết chiếm riêng một dòng.

Rà tiếp hai nơi phân trang còn lại: `/tours` và `/destinations/[region]` không
có ghost (không dùng AnimatePresence) nhưng cùng bệnh đứng-ở-nút-chuyển-trang;
ở Southern trang 2 ngắn hơn, footer nhảy lên 422px ngay dưới mắt. Gom
`lib/scroll-to-list-top.ts` dùng chung ba explorer (offset 128px vì thẻ mở đầu
bằng ảnh sát mép — `scroll-mt-28` của tiêu đề không đủ, đo ảnh).

**Rồi user để ý "lúc được lúc không" ở /tours** — thí nghiệm có đối chứng 5 lần:
bấm số trang khi con lăn CÒN quán tính (ngay / sau 150ms) thì đứng nguyên; đợi
~2,5s cho lắng rồi bấm thì chạy. Nguyên nhân: **Lenis** (smooth scroll toàn
site) bắt con lăn và tự ghi `scrollY` mỗi frame tới khi animation của nó xong;
`window.scrollTo({behavior:'smooth'})` là tài xế thứ hai cùng cầm vô-lăng và
thua. `ScrollToTop` dùng `window.scrollTo` mang cùng lỗi ngầm. Sửa gốc:
`lib/smooth-scroll.ts` — cuộn lập trình ĐI QUA `lenis.scrollTo` khi Lenis đang
cầm lái, rơi về native khi không có (reduced-motion không khởi tạo Lenis);
`LenisScroll` đăng ký/huỷ instance; module không import `lenis` để chỗ dùng
không kéo thư viện. Đối chứng lại: 5/5 ca về đầu lưới. Test: 3 case blog
(cuộn/không cuộn, overflow-clip, count trong sidebar) + 1 tours + 1 region + 3
helper cuộn + 3 helper Lenis.

Tests after: 1377 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Card `/register` vừa laptop 768p (nhánh `fix/register-fit-768p`, 1 commit, 4 file)

Trả nốt giới hạn ghi ở entry sweep bắt lỗi form: ở 1366×768 (viewport Chrome
≈681px) card đăng ký còn cuộn 168px thường / 234px khi hiện 3 lỗi. Ngân sách
card kể cả lỗi ≈557px, nên đây là một vòng nén thiết kế chứ không chỉ bớt đệm.
Sáu điều chỉnh theo mức xâm lấn tăng dần, mỗi cái đo bằng Chromium headless
trên dev server: (1) `auth-screen` cột `py-5` + wrapper `py-2`, (2)
`ticket-card` `p-6/p-8` + cuống `py-3` — hai cái này áp cả sáu trang auth;
(3) heading register giữ `text-2xl` ở mọi cỡ → một dòng thay vì hai (−42);
(4) **Full name + Email cùng hàng** từ `sm`, mobile vẫn dọc, hai dòng lỗi
chia chung một hàng (−68/−90); (5) `gap-3` RIÊNG register — form dày nhất,
các form auth khác giữ `gap-4`; (6) checklist mật khẩu từ lưới 2 cột × 3 hàng
(user chốt 06/08) sang **một hàng pill** `8+ chars · a–z · A–Z · 0–9 · !@#`,
icon tick/x giữ, câu đầy đủ ở `title` + sr-only nên spec/reader không đổi
(−36) — khối duy nhất còn cắt được chừng ấy mà không mất thông tin; user duyệt
qua ảnh trước khi merge. Kết quả: 1366×681 card 535 thường / 579 với 3 lỗi,
KHÔNG cuộn ở cả ba cỡ đo (1366×681 · 1536×760 · 1920×945). Ảnh hưởng chéo:
`PasswordStrengthField` dùng chung nên /reset-password và đổi mật khẩu trong
hồ sơ cũng nhận hàng pill.

Tests after: 1366 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Form liên hệ trang chủ nối `enquiries.create` (nhánh `feat/home-contact-api`, 1 commit, 3 file, +352/−17)

Trả món nợ ghi ngay ở entry dưới: `home/contact.tsx` là mock no-op còn sót từ
static-first (submit `preventDefault` rồi thôi — bề mặt duy nhất trên site còn
nuốt input của khách trong im lặng). Nối theo ĐÚNG khuôn `contact-split.tsx`
theo yêu cầu user, không mở khuôn mới: dùng chung `ContactFormState` +
`validateEnquiry` + `buildEnquiryPayload` (không khai lại rule), honeypot
`website`, toast phân loại qua `submitToast`/`classifySubmitError`, điền sẵn
tên từ session với cùng chốt `filledOnce`, `noValidate` + lỗi inline từng ô.

Khác biệt DUY NHẤT với /contact, và có lý do: ô *Region* từ text tự do sang
`<select>` bốn lựa chọn (Anywhere + 3 miền). `buildEnquiryPayload` map
`region` → `interests[0]` theo key vùng; nhận chuỗi khách gõ ("Northern
Vietnam", "north", "miền Bắc") thì `interests` thành rác không lọc được. Ô
*Travel dates* giữ text tự do vì contract vốn không có ngày-khoảng; ghép vào
cuối message như /contact vẫn làm. Toast có bản `homeContact` riêng vì copy
"letter" của /contact là ẩn dụ lá thư; lỗi từng ô dùng chung `contactForm.errors`.

Một lỗi chỉ lộ khi chụp ảnh thật: `Input`/`Textarea` của `@tourism/ui` tự vẽ
ring đỏ khi `aria-invalid`, mà ở form này viền là của WRAPPER — kết quả hai lớp
đỏ lồng nhau. Trạng thái lỗi chuyển sang viền wrapper (`ContactField` nhận
`error`), `BARE_FIELD` gỡ luôn `aria-invalid:*`; input chỉ giữ `aria-invalid`
cho máy đọc. Spec mới 9 case, gồm cả ca chốt "region Anywhere → `interests: []`,
KHÔNG gửi `'any'`" (cùng finding cũ của contact-split).

Tests after: 1366 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Sweep bắt lỗi form: mọi ô nhập nói đúng lỗi của mình (nhánh `feat/form-validation-sweep`, 5 commit, 32 file, +1.213/−82)

Rà toàn bộ form có submit ở web theo yêu cầu user: bấm gửi khi trống thì từng ô
phải tự báo, sai gì báo đúng nấy, và **tuyệt đối không dùng validate HTML**
(`required`, bong bóng `type=email`). Contact/newsletter/review/dialog huỷ đã
đúng khuôn từ trước (validate bằng schema contract + lỗi inline + `noValidate`)
nên giữ nguyên; phần còn lại thiếu ở ba mức.

**Cụm auth không validate gì ở client.** Login/register/forgot/reset/OTP gửi
thẳng lên Better Auth, 400 quay về, `mapAuthError` gom thành "Something went
wrong" — khách không biết ô nào sai. Reset-password còn tệ hơn: ô *Confirm* chưa
nối state, gõ gì cũng qua. Nay có `lib/auth-form.ts` (thuần, TDD, 21 test) theo
ĐÚNG khuôn `validateEnquiry`: dùng schema contract thay vì khai lại rule
(`EmailSchema` mới, `PasswordSchema` soi gương ngưỡng 8–128 của Better Auth —
đối chiếu `sign-up.mjs` gói pin, không đoán), rồi tự soi giá trị thô để chọn
câu required/invalid/tooShort vì zod nói `too_small` cho cả hai. Login cố ý chỉ
bắt trống + định dạng email; đúng/sai mật khẩu là việc của server và 401 vẫn ở
khối lỗi chung để không lộ ô nào sai.

**`mapAuthError` bỏ sót năm mã server nói rõ chuyện gì.** `INVALID_PASSWORD`
(đổi mật khẩu nhưng mật khẩu HIỆN TẠI sai), `PASSWORD_TOO_SHORT/LONG`,
`INVALID_EMAIL`, `CREDENTIAL_ACCOUNT_NOT_FOUND` đều rơi vào `generic`. Thêm
năm key + `fieldOfAuthError` để lỗi server rơi xuống ĐÚNG ô (email đã tồn tại
→ dưới ô email, mật khẩu ngắn → dưới ô mật khẩu). So `code` BẰNG chứ không
`includes`: `INVALID_EMAIL` là tiền tố của `INVALID_EMAIL_OR_PASSWORD`.

**Hai form đặt chỗ nói một câu cho mọi lỗi.** `INVALID_CONTACT` "Please enter a
valid name and email." trả lời cả phone sai lẫn lời nhắn quá ngắn; và wizard
nuốt MỌI lỗi `bookings.create` thành `CHECKOUT_FAILED` dù i18n đã có sẵn câu cho
hết ghế / đợt đóng / hết phiên — có copy mà không ai dùng. Khối `formErrors`
mới trong i18n dùng chung cho auth + hồ sơ + hai form đặt chỗ; `INVALID_CONTACT`
gỡ hẳn; `bookingSubmitErrorCopy` khớp `code`/`status` của `ORPCError` cùng
nguồn sự thật với `classifyActionError`.

A11y đi kèm: mọi ô có lỗi mang `aria-invalid` + `aria-describedby` trỏ tới
`<FieldError id>`; gõ lại vào ô đang lỗi thì lỗi của RIÊNG ô đó biến mất.

**Vòng 2 cùng nhánh — card `/register` tràn khung hình.** User phát hiện thanh
cuộn "vài pixel" ở trạng thái thường và card dài ra theo mỗi dòng lỗi. Đo bằng
Chromium headless trên dev server ở 1920×945: card 777px trong ngân sách 773
(tràn 4px), thêm 3 lỗi thành 843. Thủ phạm là khoảng thở lồng nhau chứ không
phải nội dung: `py-10` của wrapper LỒNG trong `py-8` của cột (144px dọc), 8
`gap-5` (160px), và một dòng chữ trạng thái mật khẩu đứng riêng (22px). Ba
chỉnh không đổi visual/thứ tự: `py-10`→`py-4`, `gap-5`→`gap-4` ở cả 5 form auth
cho nhịp thống nhất, chữ trạng thái lên cùng hàng nhãn mép phải. Sau chỉnh:
725px thường / 791px với 3 lỗi, cả hai KHÔNG cuộn (dư ~30px). Nói thật giới hạn:
1536×864 vẫn cuộn ~150px — checklist 5 yêu cầu + Google + terms không cỡ nào
dưới ~850px vừa mà không đổi thiết kế; dừng ở "vừa 1080p" như user yêu cầu
(**đã giải cùng ngày** bằng một vòng nén thiết kế, entry phía trên).

Sổ nợ để lại: `home/contact.tsx` (form trang chủ) vẫn là mock no-op từ
static-first — chưa nối API nên chưa có validate (**đã trả cùng ngày**, entry
ngay trên); `maxLength` trên textarea
review/lý do huỷ giữ nguyên (cap gõ + bộ đếm, không phải bắt lỗi HTML).

Tests after: 1357 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Receipt thay tấm vé ở CẢ hai màn quay-về (nhánh `feat/receipt-success`, 9 commit, 14 file, +977/−439)

`/checkout/success` và `/checkout/cancel` nay dùng chung một khuôn hoá đơn kiêm
cuống vé, dựng theo wireframe đã duyệt. `CheckoutShell` (tấm vé boarding-pass)
**xoá hẳn** cùng `TicketTear`/`TicketBarcode`/`TicketToneEdge` — hết consumer.
`ticketSerial`/`ticketBarcodeWidths` ở lại vì `BookingReceipt` vẫn dùng.

**Đợt này vá một LỜI HỨA SAI đang sống, và đó mới là phần đáng nhớ.** Trang
cancel trước đó in barcode cùng câu "Show this code at the meeting point" cho
một booking PENDING — tức ngụ ý mã đã là voucher và ghế đã được giữ, sai thẳng
invariant #1 của API (PENDING KHÔNG giữ seat nào). Repo đã bị ĐÚNG lớp lỗi này
một lần: câu "Your reservation is held" bị bác ở final review cụm C vì cùng lý
do, và chính comment ghi lại chuyện đó đã giúp nhận ra lần này. Nên
`BookingReceipt` tự SUY `isVoucher` từ `paidAt` chứ không nhận qua prop — caller
không đặt sai được: chưa trả thì bỏ barcode (barcode nghĩa là "quét tôi ở
cổng"), đổi dòng hint, và nhãn tổng dùng `Total` thay vì `Total paid` (in "Total
paid" cho khoản chưa trả là nói dối bằng nhãn).

**Con số 64 vạch trong wireframe hoá ra SAI, và chỉ lộ khi cài đặt.** Lúc dựng
wireframe tôi tính bề ngang mã vạch trên ĐÚNG MỘT MÃ (154px, trông vừa). Bề rộng
mỗi vạch phụ thuộc ký tự nên mã khác cho tổng khác: quét 200k mã hợp lệ thấy xấu
nhất 164px, TRÀN cuống vé dọc 160px của trang cancel. Hạ xuống **52 phần tử (26
vạch)** cho xấu nhất 148px. Bài học ghi vào test chứ không vào comment: có case
canh chính RÀNG BUỘC BỀ NGANG, và chỉ canh trên mã HỢP LỆ theo `BookingCodeSchema`
— mã ngắn như `BK-1` cho tổng lớn hơn hẳn nhưng không tồn tại được, bắt nó là tự
trói vào ràng buộc giả. Wireframe đã sửa về 52 để mockup không nói khác thứ chạy.

Cùng đợt bỏ `gap` giữa các phần tử mã vạch: mã vạch thật thì vạch và khoảng
trắng kề sát, một khe đều 1px chen giữa làm hình đọc thành dãy sọc trang trí.

**Hai lỗi chỉ lộ khi ĐO trang thật, test không bắt được.** (1) Dòng `Date` và
`Paid` in "19 AUG" vì tôi dùng `formatTicketDate` — hàm đó cố ý bỏ năm vì dành
cho khoảnh khắc primary CỠ LỚN trên vé, còn đây là HOÁ ĐƠN và JSDoc của
`formatDate` nói đúng chỗ này: thiếu năm là mơ hồ thật sự. (2) Cả hai trang có
**hai thẻ `h1`** (`ContentHero` một, receipt một) nên trình đọc màn hình báo hai
tiêu đề cấp một; hạ tiêu đề hoá đơn xuống `h2` và thêm test khoá lại.

**In ấn được xử lý như một yêu cầu, không phải trang trí.** Mặc định trình duyệt
KHÔNG in background, và vạch mã vạch vẽ bằng `background` — tắt background là mã
vạch biến mất, tờ giấy vô dụng ở chính nơi nó tồn tại để phục vụ.
`print-color-adjust: exact` đặt vào ĐÚNG hai chỗ mà nền mang thông tin (mã vạch,
pill trạng thái), không ép cả trang. Đo bản in mô phỏng kịch bản xấu: 26/52 phần
tử còn mực, viền cuống `dashed 1px`, băng tone `3px`.

Không có nút "Download PDF": repo không sinh PDF ở đâu cả nên nút đó sẽ chết.
Hộp thoại in của trình duyệt đều có Save as PDF, nên nhu cầu lưu hoá đơn vẫn
được phục vụ mà không phải hứa tính năng chưa có. Nút `Print` đi vào slot
`action` sẵn có của `ContentHero` thay vì đẻ thêm một hàng nút.

Nghiệm thu chạy trên dữ liệu THẬT qua `demo:account`, đủ ba mood. Mood `settled`
ban đầu không kiểm được vì `checkoutMood` chỉ trả nó khi CANCELLED/REFUNDED mà
script không tạo ca đó — ép một booking demo sang CANCELLED rồi đo, thay vì khai
là đã phủ.

Ba test của `checkout-shell.spec` chuyển sang thành năm; ca "không có code" rời
khỏi component vì không có booking thì không có hoá đơn nào để dựng — trang tự
lo bằng nhánh sớm, đã nghiệm thu cả hai nhánh.

Tests after: 1298 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-19 — Wizard 4 bước cho trang đặt chỗ, tách `/enquire`, và vòng thiết kế receipt (nhánh `feat/checkout-wizard`, 16 commit, 32 file, +2.614/−868)

Trang `/tours/[slug]/book` từ MỘT form dài thành wizard bốn bước
**Dates → Travellers → Review → Pay**, dựng theo bốn wireframe user duyệt 18/08.
Nhánh "chuyến riêng" tách sang route CÔNG KHAI `/tours/[slug]/enquire`.

**Nợ tôi tự tạo rồi tự trả trong cùng đợt.** Route `/enquire` vừa sinh ra đã
mang một lỗi: `site-header.tsx` phải dò `startsWith('/tours/') && endsWith('/book')`
để biết trang nào không có hero, và `/enquire` không nằm trong danh sách nên
navbar dùng chữ sáng trên nền sáng — tàng hình ở light mode cho tới khi cuộn.
Đo được: chữ `lab(97.7…)`. Đây đúng là bệnh của luật đi-theo-đường-dẫn: nó rách
ngay khi có route mới mà không có gì báo. User chốt cho hai trang một hero thật,
nên đoạn dò đường dẫn ĐÃ XOÁ và luật navbar về đồng nhất — đo lại bằng pixel
sau navbar: `/book`, `/enquire`, `/tours/[slug]` đều `rgb(28,43,40)`, 14:1.
Comment ở `site-header.tsx` nay ghi rõ: **danh sách hero-less chỉ nên NGẮN đi**;
hai lần trước (`/account` 11/08, `/book` 19/08) đều giải bằng cách cho trang một
hero thật rồi rút khỏi danh sách, không phải thêm đường dẫn vào.

**Điều đắt nhất của wizard được canh bằng test riêng**: MỘT state cho cả bốn
bước, bốn thân bước không tự giữ gì. Đó là thứ làm nút Back giữ được dữ liệu, và
hỏng nó thì lỗi chỉ lộ khi có người bấm Back — muộn. Nghiệm thu cả trong test
lẫn trên trang thật (đi 4 bước, Back hai lần, ô phone vẫn còn `0901234567`).

**Bước Pay có một test chốt chặn** khẳng định KHÔNG `input`/`textarea`/`select`
nào tồn tại: mẫu ReUI gốc có sẵn khối Name-on-card/CVC và nó rất dễ bị chép lại
ở một lần sửa sau. Luồng là redirect — số thẻ gõ trên trang của Stripe/PayPal.

**Trước khi xoá `booking-form.spec.tsx` đã đối chiếu từng `it()`** — 9/11 chuyển
sang spec mới, 2 chết theo thiết kế (heading ba card, công tắc mode). Cụm booking
11 → 20 `it()`. Xoá một file test là cách dễ nhất để tổng số test vẫn tăng mà độ
phủ lại tụt.

**Hai lỗi chỉ lộ khi ghép vào trang thật, test không bắt được**: tiêu đề trang và
tiêu đề wizard chồng nhau; `CheckoutSummary` tự bọc card trong khi `<aside>` đã
có `border-l` — hai lớp khung.

**Giá riêng cho trẻ em: CỐ Ý BỎ** (user giao quyết định). Căn cứ nặng nhất là đối
chiếu Nexora theo luật 10 — Nexora CÓ `childPriceRatio` nhưng mặc định 1, không
chỗ nào truyền giá trị khác, không cột DB nào rót vào; nên bỏ không phải thụt
lùi. Ba lý do còn lại: nó nằm trên đường tiền mà 10 file test đang canh; dự án
không doanh thu; còn bốn phase trong hai tháng trước freeze. Hình dạng tối thiểu
nếu sau này muốn làm đã ghi ở bản đồ docs. Giao diện nói thật thay vì im lặng:
bước Travellers ghi rõ trẻ em tính cùng giá người lớn.

**Vòng thiết kế trang receipt** chạy theo hai pha user yêu cầu. Pha 1 dựng bản
sao TRUNG THÀNH của ReUI `receipt-1`; bản đầu bị bác vì cao hơn gốc 246px — tôi
đo kiểu chữ mà KHÔNG đo hình học, và `line-height: 1.5` (gốc dùng 1.375) làm mỗi
dòng dày thêm 2px, nhân ~40 dòng ra đúng khoảng đó. Dựng lại bằng một bộ so hình
học lấy toạ độ 15 mốc trên cả hai bản rồi lặp tới khi hội tụ: **lệch lớn nhất
2px**, và 5 đường kẻ trùng khít từng hàng pixel. Phép quét pixel còn chặn một sai
lầm suýt mắc — tôi tưởng mẫu gốc có kẻ ngang giữa dòng email và `SHIP TO`; quét
cột pixel cho thấy KHÔNG có, sửa theo mắt là tự tay làm lệch 17px.

Pha 2 nắn sang dữ liệu thật, rồi hợp nhất với tấm vé qua **bốn bước có review**:
khung/đường xé · nền cuống + băng trạng thái · ruột cuống · in ấn. Cách hợp nhất
chốt được là **giữ receipt làm tài liệu, biến dải chân thành cuống vé** — dải đó
vốn đã tràn hết bề rộng card và ngăn bằng một đường ở mép dưới, tức đúng giải
phẫu một phần xé rời. Cố ý KHÔNG dùng `border: dashed` và KHÔNG thêm notch bán
nguyệt: JSDoc `CheckoutShell` ghi rõ bản trước nó bị bác vì đúng combo đó.

**Rủi ro in ấn nặng hơn tưởng**: vạch mã vạch vẽ bằng `background`, nên trình
duyệt tắt background graphics là mã vạch BIẾN MẤT — tờ giấy vô dụng ở chính nơi
nó tồn tại để phục vụ. Vá bằng `print-color-adjust: exact` đặt đúng vào mã vạch
và pill, không ép cả trang. Mô phỏng kịch bản xấu nhất: 32/64 phần tử còn mực.

Ba lỗi tự bắt được nhờ ĐỌC ẢNH thay vì tin code: đường xé dựng thành thẻ riêng
thì ăn luôn `gap:16px` của card nên lơ lửng cách cuống 16px; mã vạch có `gap`
đều giữa mọi phần tử nên đọc thành dãy sọc trang trí (mã vạch thật thì vạch và
khoảng trắng dính liền, và 14 vạch là quá thưa — nâng lên 32); và `border` dạng
rút gọn trong `@media print` ghi đè luôn `border-bottom` mang màu trạng thái.

Nợ để lại, có chủ đích: `/checkout/success` CHƯA đổi sang receipt — wireframe đã
chốt nhưng cài đặt là đợt sau. `/checkout/cancel` giữ `CheckoutShell` (user
chốt), và nó truyền `code` nên dùng nhánh vé đầy đủ, không để lại nửa component
chết. Khi cài đặt sẽ cần nâng `TICKET_BARCODE_BAR_COUNT` 28 → 64.

Tests after: 1281 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.
