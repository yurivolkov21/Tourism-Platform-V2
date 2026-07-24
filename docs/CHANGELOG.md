# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

## 2026-07-24 — P3b: trang /contact (branch `feat/contact-page`, merge `19e639f`)

Trang thứ ba của P3b — kế hoạch 5 section user duyệt trước khi dựng, sau đó
2 vòng điều chỉnh nâng "wow" (user chấm bản đầu 6.5 vì quá an toàn):
- **5 section**: Hero tối ngắn (kiểu Nexora ContentHero, breadcrumb + dòng
  "presence" chấm jade thở "Mai is on replies today") · Split form+info
  (ShadcnSpace Contact 01 — trái info + mini-marquee Featured-by tái dùng
  PARTNERS qua export, phải form card) · Location & hours (Nexora
  ContactLocation — map placeholder + 2 card văn phòng HN/Sa Pa) · Mini-FAQ
  (ShadcnSpace FAQ 01 — card rời, item mở đổi nền; 5 câu pre-sales, link /faq
  tương lai) · CTA 01 aurora HỒI SINH từ git history (tránh trùng CTA 02 của
  /about).
- **Chữ ký "LÁ THƯ"** (skill frontend-design, đặt cược một chỗ = form vì luận
  đề "not a hotline"): bản 1 mad-libs blank-giữa-câu bị chê rối mắt → bản 2 bố
  cục thư rõ ràng — "Hello tourism," + từng dòng nhãn-câu-hỏi + chỗ điền gạch
  nét đứt mực jade italic + "Yours," + tem la bàn + P.S. người thật đọc thư.
- Mock mới TDD: `offices` (2 văn phòng) + `faq` (5 câu) — ứng viên schema;
  Select vùng mock từ REGIONS (nợ API categories như Nexora); navbar/footer
  Contact trỏ /contact (section Home giữ song song như Nexora).
- Kỹ thuật: hero PHẢI scope dark (navbar chưa-cuộn chữ on-media theo pattern
  "hero luôn tối" — hero sáng làm navbar tàng hình); export ContactField/
  BARE_FIELD/EMAIL/PHONE từ home/contact thay vì nhân bản.
Tests after: gate:int xanh 18/18 task — web unit 11 (mocks +offices/faq) ·
int 145/17 · tokens 10 · ui 5 · typecheck · biome sạch; CI branch `success`
2m28s trước merge.

## 2026-07-24 — P3b: trang /about hoàn chỉnh (branch `feat/about-page`, merge `5e9dd08`)

Trang thứ hai của P3b, dựng TỪNG SECTION theo quy trình demo → review → chốt
(khác Home dựng cả trang một lượt) — 16 file, +1.207 dòng. Nguồn mở rộng:
ngoài 12 template PrebuiltUI còn khai thác **ShadcnSpace** (đọc source thật qua
registry `/r/<block>.json`, chỉ dùng block free).
- **8 khối**: Hero (forged/Hero — reveal 3 dòng từng dòng, stats CountUp, scroll
  cue) · Story (forged/About — ảnh + floating box "12+", 2 quote guide) ·
  Timeline (prompt2app/build-process — trục TỰ VẼ theo scroll, 4 mốc nhuộm màu
  vùng, zigzag chữ-ảnh + TiltCard, sửa lỗi thứ tự mobile của template gốc) ·
  Numbers (forged/Stats — lưới hairline + watermark "NUMBERS" + nền ảnh mờ,
  "0 Scripts" làm điểm dừng mắt) · Values (forged/Services — 6 lời hứa, thẻ
  highlight No scripts, khép vòng các teaser pill/marquee) · Gallery (ShadcnSpace
  Gallery 01 — bento 3 vùng + tổng, số derive từ REGIONS) · Team (ShadcnSpace
  Team 01 — portrait grayscale hover, CHỈ founder theo quyết định user; TDD mock
  `team_members`) · CTA (ShadcnSpace CTA 02 — video placeholder + marquee cam
  kết nền primary, thắng CTA 01 aurora sau khi demo cả hai).
- **Điều hướng**: navbar/footer anchor sang dạng `/#...`, About Us trỏ `/about`;
  Partners bị BỎ khỏi About (dải tối cô lập CTA) — trust do Numbers gánh.
- **Nhất quán dữ liệu**: phát hiện + vá Numbers hardcode 96 tour ≠ 68 tổng
  REGIONS — cả Numbers lẫn Gallery giờ derive cùng nguồn.
- Chẩn đoán phụ trong review: cảnh báo hydration `fdprocessedid` là do browser
  extension (IDM) của user, không phải bug — không vá, đã giải thích.
Review findings đáng nhớ: hero container thử kiểu forged rồi user chọn bản gốc
(comment chống "sửa lại" đã ghi tại chỗ); script screenshot dùng sai tham số
`viewportSize` → toàn bộ ảnh soát trước đó chụp 1280 thay 1920, đã sửa; bài học
build-chen-dev-server thành memory + được tuân thủ suốt branch này.
Tests after: gate:int xanh 18/18 task — web unit 9 (mocks +team) · int 145/17 ·
tokens 10 · ui 5 · typecheck · biome sạch; CI branch `success` 2m39s trước merge.

## 2026-07-23 — P3b: nâng cấp navbar (branch `feat/navbar-upgrade`, merge `4e8f981`)

Điều chỉnh Home sau chốt (đổi hướng lộ trình: nhóm trang marketing trước
listing) — navbar lên đủ đồ theo đối chiếu Nexora site-header, 6 vòng điều
chỉnh với user:
- **Destinations dropdown** (NavigationMenu Base UI): 3 vùng + hint + chấm màu
  `--region-primary` theo `data-region` (lần đầu region token lên navbar);
  trigger LỘT nền muted mặc định của shadcn để đồng bộ link trần (#2).
- **UserMenu** (convert Nexora): chưa đăng nhập → "Log in" (/login, phase auth);
  đã đăng nhập → avatar + dropdown (mock `MOCK_SESSION` trong mocks/auth.ts —
  flip sang SAMPLE_USER để xem). Nav thêm Travel Blog (#journal) + About Us;
  bỏ Reviews (#3 — navbar chỉ chứa đích đến là trang thật).
- **AnimatedThemeToggler @magicui** vào `@tourism/ui` qua shadcn CLI (lan tròn
  View Transitions) + script init theme trước paint đầu (localStorage/system,
  chống chớp trắng khi reload) + `@types/react-dom` còn thiếu.
- **2 bug dark-theme lộ ra khi user lần đầu bật được dark**: (a) autofill
  Chrome ép nền trắng — vá inset-shadow theo token card + transition trick; ghi
  chú giới hạn: trạng thái preview (`:-internal-autofill-previewed`) là UA cấm
  đè, không fix được; (b) field Contact HAI lớp màu — `dark:bg-input/30` của
  shadcn Input/Textarea không bị `bg-transparent` gỡ (khác variant), phải thêm
  `dark:bg-transparent` tường minh.
Review findings đáng nhớ: screenshot tự soát bắt lỗi `slice(1)` nuốt mất mục
"Travel Blog" trước khi tới tay user; bài học tw-merge-không-gỡ-variant-khác
vào comment BARE_FIELD.
Tests after: gate:int xanh 18/18 task — int 145/17 · web 8 · tokens 10 · ui 5 ·
typecheck · biome sạch; CI branch `success` 2m48s trước merge.

## 2026-07-23 — CI xanh lại + vá 5 alert Dependabot (branch `fix/ci-test-db-and-dep-vulns`, merge `69cac5a`)

CI main đỏ **suốt 21→23/07** (từ merge ADR-0008) mà không ai nhận ra vì merge
kiểu ff không qua PR — phát hiện khi push trang Home. Lỗi HAI TẦNG cùng một
triệu chứng P2021:
- **Tầng 1**: ADR-0008 thêm reconcile admin lúc `onApplicationBootstrap` → 4 e2e
  spec trong task `test` (bootstrap · fail-closed · throttle · health) boot cả
  AppModule nên chạm bảng `User`; CI chỉ tạo + migrate `tourism_test` trong
  globalSetup của `test:int` — chạy SAU. Sửa: đảo `test:int` lên trước bước gate
  trong ci.yml (tái dùng cơ chế idempotent duy nhất, không nhân đôi vào YAML).
- **Tầng 2** (che tầng 1 khỏi chẩn đoán): turbo **strict env** lột `DATABASE_URL`
  khỏi task `test` (turbo.json không khai báo `env`) → e2e rơi về db mặc định
  `tourism` — ở CI db này TỒN TẠI nhưng RỖNG (image Postgres tự tạo db trùng tên
  POSTGRES_USER), nên lỗi hiện ra là "thiếu bảng" chứ không phải "thiếu db".
  Sửa: `"env": ["DATABASE_URL"]` cho task `test`.
- **5 alert Dependabot**: fast-uri 3.1.4/4.1.1 (2 high — `pnpm update` trong
  range) · sharp 0.35.3 (high, chạy prod thật qua next/image — override
  `>=0.35.0` vì Next khai báo ^0.34) · postcss 8.5.22 (moderate — override
  `>=8.5.10` vì Next pin cứng 8.4.31) · @hono/node-server GIỮ 1.x + dismiss
  tolerable-risk có ghi lý do (path traversal chỉ Windows, transitive của
  dev-tooling, bản vá 2.0.5 là major phá `@prisma/dev`) — lý do nằm tại comment
  pnpm-workspace.yaml.
Review findings: bài học "CI chạy mọi branch" phát huy — fix được CI thật xác
nhận (run `success` 2m48s) TRƯỚC khi merge vào main, đúng lỗ hổng mà quy ước
này sinh ra để vá.
Tests after: gate:int xanh 18/18 task — API unit 188/21 file (có mô phỏng điều
kiện CI: unit chạy trên `tourism_test`) · int 145/17 · web 8 · tokens 10 · ui 5 ·
typecheck · biome sạch.

## 2026-07-23 — P3b: trang Home tĩnh hoàn chỉnh (branch `feat/home-page`, merge `2d98be3`)

Trang Home static-first đầu tiên của P3b — 40 commit, **33 vòng điều chỉnh** review
từng-section với user (quy trình: demo → user review local → điều chỉnh đánh số).
Nguồn thiết kế: convert **nguyên bố cục template Estate** (quyết định vòng 1 sau khi
bản tự-compose bị chê "chán"), sau đó thay/bồi từng section bằng convert từ
**forged** (Partners marquee, CTA banner tràn viền, footer newsletter+watermark,
Journal/Insight Hub, thanh cuộn 4px + ::selection) — luật chung: *bố cục + motion
100% template, da thịt 100% token/font dự án* (bài học #25: không ép Literata
ALL-CAPS 900).
- **10 khối**: Hero fullscreen · Partners marquee · Stats (CountUp + slider) ·
  Destinations sticky-scroll ngang (9 địa danh 3 vùng, chip tint `--region-*`) ·
  WhyChooseUs (accordion + ảnh đổi theo mục + caption/chấm điều hướng) ·
  Testimonials (marquee dọc 2 cột ngược chiều + bảng điểm 4.9 tính từ mock) ·
  Journal (3 card, khôi phục sau khi bị bỏ rơi ở vòng convert) · CTA banner
  (heading 2 dòng accent italic, nút glow) · Contact (form icon-field + panel
  primary gradient: timeline 3 bước + card liên hệ, lai Nexora "Plan your trip") ·
  shell TopBar/pill-navbar/footer/ScrollToTop (convert Nexora).
- **Mocks = công cụ khám phá schema** (`apps/web/src/mocks/`, 8 test bất biến):
  ứng viên đã ghi chú tại chỗ — destinations · trip_moments · announcements ·
  newsletter_subscribers · blog_posts.
- **Chính sách placeholder**: mọi ảnh dùng `ImagePlaceholder` (kèm biến thể
  `corner`); ảnh thật thay khi trang chốt. 7 ảnh Commons/Unsplash đã tải sẵn
  (CREDITS.md) cho lúc đó.
- **Nợ ghi nhận cho lúc gắn API** (đối chiếu Nexora): form Contact/newsletter
  đang no-op — phải vá validate + honeypot + rate-limit + success state như
  `plan-trip-form` Nexora; độ giàu trường (phone·groupSize·budget·interests) là
  quyết định sản phẩm còn mở.
Review findings đáng nhớ: import sót sau xóa file làm typecheck đỏ (bắt trước khi
giao — bài học replace-không-assert); flex `justify-between` vỡ khi thêm con thứ 3
(bọc khối); watermark đè link sửa bằng z-âm; JourneyScrubber thử rồi gỡ theo review
(#20) — giá thử rẻ vì component độc lập.
Tests after: gate:int xanh 18/18 task — web unit 8 (mocks) · tokens 10 · ui 5 ·
API int 145/17 file · typecheck · biome sạch.

## 2026-07-22 — P3b: bộ font chính thức (branch `feat/fonts-final`, merge `9e26959`)

Chốt bộ 3 font theo vai trò sau 2 vòng specimen trực quan với user (font thật nhúng
trang, đủ dấu tiếng Việt): **Literata** (heading — user chọn trực tiếp) ·
**Archivo** (sans thân/UI — grotesque ghép giọng editorial với Literata) ·
**IBM Plex Mono** (mã đặt chỗ/số kỹ thuật — có subset vietnamese, hơn Geist Mono cũ).
Thay bộ tạm Be Vietnam Pro + Lora + Geist Mono của ADR-0013 — ADR ghi khối
"cập nhật cùng ngày" thay vì sửa lặng lẽ; [color-system §6](conventions/color-system.md)
ghi bộ chốt + lịch sử. Chỉ đổi `layout.tsx` (next/font, subset latin+vietnamese)
+ comment tokens.mjs — cơ chế wire `--font-*` giữ nguyên.
Review findings: không phát sinh (đổi 1 file code; verify = build web + 20 woff2
self-host + 3 family có mặt trong CSS build).
Tests after: gate:int xanh — tokens 10 · ui 5 · int 145/17 file · typecheck · biome sạch.

## 2026-07-22 — P3b: theme Wuling + region tokens + fonts (branch `feat/theme-tokens`, merge `be43756`)

Rebrand hoàn chỉnh theo [ADR-0013](adr/0013-wuling-theme-tokens.md), hệ màu chốt cùng user qua 6 vòng
demo trực quan (bản ghi đầy đủ: [conventions/color-system](conventions/color-system.md) — brand "Wuling"
+ 3 region tint theo 3 operator Endfield, codename nội bộ, kèm ghi chú pháp lý):
- **Phát hiện quan trọng**: `@tourism/tokens` KHÔNG phải stub — P0 đã port nguyên pipeline Style
  Dictionary 5 + culori của Nexora (type scale, shadow, z-index, density, semantic colors, rn-convert
  cho P5). Giữ nguyên kiến trúc, chỉ thay giá trị + mở rộng.
- `tokens.mjs`: toàn bộ màu brand light+dark → hệ Wuling (oklch, quy đổi culori từ hex chốt); chart
  ramp = 5 hue brand+vùng; scrim/media-tint đổi hue theo họ ngọc.
- **Lớp region mới**: 5 slot `--region-*` mặc định brand trên `:root`, override qua
  `[data-region='north|central|south']` — luật 90/10: component shared CẤM tham chiếu `--region-*`.
- `@tourism/ui/globals.css`: bỏ khối neutral shadcn, import `@tourism/tokens/tokens.css` (đối chiếu
  key: tokens phủ 100% biến cũ trước khi xóa).
- Fonts: **Be Vietnam Pro** (sans) + **Lora** (heading) qua next/font — subset `vietnamese` (Geist+
  Fraunces Nexora không đủ dấu); metadata description sang tiếng Anh (luật #7).
- TDD: 4 test mới nguồn token (oklch hợp lệ · primary hue 170–195 · region đủ slot · REGIONS khớp);
  sửa 1 test rn-convert theo brand mới (ghi chú trong file); +`@types/culori`.

Review findings: tự kiểm chứng — visual light/dark + 3 region tint qua page tạm (đã gỡ); bug quy trình
tự bắt: gắn class `dark` trước hydration bị React ghi đè (chụp dark phải gắn sau load).
Tests after: gate:int xanh — tokens 10 unit (4 mới) · ui 5 · int **145/17 file** · typecheck · biome sạch.

## 2026-07-22 — P3b: shadcn/typeset trong `@tourism/ui` (branch `feat/ui-typeset`, merge `985f911`)

Tích hợp **Typeset** (shadcn 10/07/2026 — hệ typography cho HTML/markdown render trong MỘT file CSS
sở hữu repo) theo [ADR-0012](adr/0012-typeset-typography.md), thay `@tailwindcss/typography` của Nexora:
- `libs/shared/ui/src/styles/typeset.css`: lõi vendor NGUYÊN BẢN từ `shadcn-ui/ui@main` (490 dòng, pin
  nguồn+ngày, loại khỏi Biome như artifact để diff upstream) + **3 preset tự viết**: `typeset-docs`
  (tour/FAQ/admin preview) · `typeset-chat` (chặt, ≈`prose-sm` cũ, dành cho AI concierge P6) ·
  `typeset-reading` (thoáng, trang đọc dài). Import trong `globals.css` → web+admin hưởng tự động.
- Component `<Typeset preset>` (cva + `useRender`, idiom base-nova) + **vitest đầu tiên của `@tourism/ui`**
  (5 unit test `typesetVariants`, TDD).
- Đối chiếu Nexora (#10): `prose prose-sm dark:prose-invert` (chat-panel/post-content/tour-itinerary) →
  v2 tương đương hoặc tốt hơn (streaming-safe, bớt plugin dependency).

Review findings: tự kiểm chứng render (page tạm + screenshot chromium — 3 preset khác biệt đúng thiết kế,
class có mặt trong CSS build production; page đã gỡ). Font còn fallback serif — chờ task rebrand/tokens.
Tests after: gate:int xanh — unit 5 (ui) + int **145/17 file** · typecheck · biome sạch.

## 2026-07-22 — P3b: bộ shared UI shadcn `@tourism/ui` (branch `feat/p3b-shared-ui`)

Dựng bộ **components/blocks dùng chung** cho web+admin theo [ADR-0011](adr/0011-p3b-web-architecture.md):
gói **`libs/shared/ui` (`@tourism/ui`)** — shadcn monorepo mode, style **base-nova (Base UI, KHÔNG Radix)**,
baseColor neutral, icon lucide. **59 components** (tất cả registry `@shadcn` *trừ* `native-select` theo yêu cầu).
Runtime deps (cmdk/recharts/sonner/date-fns/react-day-picker…) khai ở chính `@tourism/ui` (self-contained
cho admin tái dùng); `apps/web` consume qua `@tourism/ui/components/*` + `transpilePackages` + theme dùng chung.

**Rà từng component xử cảnh báo Biome** (khác ESLint-next của Nexora nên soi kỹ hơn, nhất là a11y):
- Sửa thật 6: `pagination` bỏ `role` thừa · `field` `===`+key-theo-message · `chart` 2 array-key→`item.name`/`item.value` · `scroll-area` gỡ import React thừa.
- `biome-ignore` + lý do (11 file): pattern primitive canonical shadcn/Base-UI (a11y role trên div/span, `dangerouslySetInnerHTML` chart, `noArrayIndexKey` slider, `noDocumentCookie`+`useExhaustiveDependencies` sidebar) — không sửa được sạch mà không phá primitive.

Setup monorepo: `components.json` ở cả `@tourism/ui` lẫn `apps/web`; `sharp` allowBuilds; Biome bật
`css.parser.tailwindDirectives` + loại `!**/public`. Theme wire vào `@tourism/tokens` để **giai đoạn sau**.
Tests after: `@tourism/ui` typecheck xanh · `@tourism/web` build (Turbopack) xanh · biome sạch (không đụng backend, gate:int giữ 145 int).

## 2026-07-22 — P3b: scaffold web Next.js 16 (branch `feat/p3b-web-scaffold`)

Mở phase P3b — dựng nền `apps/web` (`@tourism/web`) theo [ADR-0011](adr/0011-p3b-web-architecture.md):
**Next.js 16.2.11** (App Router · Turbopack) + React 19 + Tailwind v4, tích hợp Turborepo + **Biome
(KHÔNG ESLint)**. Reconcile monorepo: xóa nested `pnpm-workspace.yaml`/`CLAUDE.md` create-next-app thêm;
tên `@tourism/web`; `sharp` vào `allowBuilds`; biome bật `css.parser.tailwindDirectives` (Tailwind v4
`@theme`) + loại `public/` (asset không lint); gỡ SVG demo; page/metadata placeholder sạch.

Bộ **shared components/blocks (`libs/shared/ui`)** + shadcn + trang thật là **bước phối hợp kế tiếp** (chờ
user điều phối bộ legacy components). Verify: `pnpm --filter @tourism/web build` (Turbopack) xanh + typecheck
+ biome sạch. Không đụng backend (gate:int giữ nguyên 145 int).

## 2026-07-22 — Infra hardening trước P3b (branch `feat/infra-hardening`)

Đóng 2/3 gap "độ chín production" (TB) từ [độ sẵn sàng backend](analysis/2026-07-22-backend-readiness-vs-nexora.md)
theo [ADR-0010](adr/0010-infra-hardening.md), trước khi web P3b lộ FE. 2 commit `a0cb221..dc1beec`, TDD:
- **Global exception filter** (`APP_FILTER` `AllExceptionsFilter`) — chuẩn hoá MỌI lỗi rơi vào pipeline Nest
  (guard 401/403, route Nest thuần, lỗi bất ngờ) về envelope oRPC `{defined, code, status, message, data}`;
  FE một parser. oRPC procedure-error + webhook `{code}` giữ nguyên (không bị đụng — verify). 500 ẩn stack.
  Unit 5 + e2e 401.
- **`@fastify/helmet`** trong `configureHttp` (test e2e phủ) — security headers, **CSP tắt** (API JSON, CSP để P3b).
- **Sentry seam** env-gated (`SENTRY_DSN` + `captureException`) — filter gọi cho 500; hiện no-op (interim:
  Logger.error → platform stdout). Cài `@sentry/node` là follow-up khi provision DSN (trừ phần cần key).

Guard 401/403 đổi shape body (thêm `code`) — không test nào assert body-shape lỗi nên **zero ripple**.
Tests after: `pnpm gate:int` xanh (145 integration + unit filter/e2e).

## 2026-07-22 — Vòng đời PENDING: đóng lỗ mồ côi (branch `feat/pending-lifecycle`)

Đưa booking PENDING mồ côi về terminal theo [ADR-0006](adr/0006-pending-lifecycle.md) (Accepted 22/07) —
gap "v2 kém Nexora" duy nhất chạm checkout, phát hiện ở
[độ sẵn sàng backend 22/07](analysis/2026-07-22-backend-readiness-vs-nexora.md). 4 feat + 2 chore commit
`d40597b..63af354`, mỗi feat TDD (không migration — enum/cột sẵn có):
- **PAY-1** (`d40597b`) `VerifiedEvent` +type `payment.expired`; Stripe `checkout.session.expired` tách khỏi
  `payment.failed`; `handleEvent` → flip PENDING→CANCELLED (gate `status='PENDING'`, không đụng ghế).
- **WRK-1** (`988e8b8`) `PendingSweepService` + pg-boss job `booking-sweep` lịch 10′, TTL 30′ — backstop khi
  webhook expired rớt. Idempotent với PAY-1.
- **BK-1** (`f5b546a`) create bọc try/catch → `CHECKOUT_FAILED` (502 typed) thay 500 opaque; procedure
  `bookings.checkout` re-mint session cho PENDING của chủ. FE phân biệt được gateway-lỗi vs hết-ghế.
- **BK-2** (`3e17568`) procedure `bookings.cancelPending` — khách tự hủy PENDING chưa trả (không refund),
  tách khỏi cancellation-request (PAID).
- Chore (`bb3bd8d`·`63af354`) dọn 2 comment "nói dối" pending-expiry-sweep + `booking-states.md` thêm hàng
  PENDING→CANCELLED; unit ripple stripe expired→payment.expired.

Ba đường cancel (webhook · cron · self-cancel) đều gate `status='PENDING'` → idempotent chồng nhau;
capture-đến-muộn sau CANCELLED đã được PAY-R1 fresh-refund guard lo (ADR-0009). Không chạm bất biến ghế/tiền
(PENDING không giữ ghế). Tests after: `pnpm gate:int` xanh (145 integration).

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
