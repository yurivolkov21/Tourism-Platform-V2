# CHANGELOG — lưu trữ: trang quản trị P4a–P4c (31/08–03/09/2026)

Dựng vỏ trang quản trị rồi mở lần lượt mười vùng: đơn hàng, hoàn tiền, duyệt
đánh giá, báo cáo, hàng đợi email, sổ webhook, câu hỏi khách, danh sách nhận tin.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-09-03 — P4c F10: Subscribers (danh sách nhận tin, unsubscribe + CSV) + vòng vá — KHÉP P4c (nhánh `feat/p4c-subscribers`, 3 commit `7ed7bde..c8a7279`, ~40 file, không migration)

Tính năng cuối P4c ([spec P4c](../specs/2026-09-02-p4c-operations-design.md)
§3-F10, có mục AMEND): contract `admin.subscribers.list/unsubscribe` +
`admin.stats.subscribers` (mở rộng `newsletter.ts`), module API
`modules/newsletter` thêm controller/service admin (controller riêng để không
thừa kế `@Public()` của đường khách), trang `/subscribers` (tab Active/
Unsubscribed/All, Select nguồn từ `sources` distinct của chính response, tìm
email, nút Unsubscribe có `ConfirmWriteDialog`, Export CSV qua route
`/subscribers/export`), vòng gom trang export nâng lên `lib/export-pages.ts`
dùng chung với bookings. Nghiệm thu review 8 mũi → 10 findings (8 CONFIRMED ·
2 PLAUSIBLE), user duyệt vá một mạch (`c8a7279`):

- **Mặc định tab Active ở tầng parse**: bản đầu chỉ đặt mặc định ở href nav,
  nên `/subscribers` trần (bookmark) rơi vào All và nút Export dựng file gồm cả
  địa chỉ đã rút consent. Nay URL trần = Active, All viết tường minh
  `?active=all`, route export dùng chung hàm parse; nav trỏ literal (hết kéo
  barrel contract vào chunk client chung).
- **Export**: `list` có `includeSources` (export tắt → không GROUP BY toàn bảng
  20 lần); `fetchAllPages` phát hiện tập đổi kích thước giữa chừng và trả
  `changed` → route 409 "xuất lại" thay vì giao file thiếu hàng cũ nhất im
  lặng; `lib/export-route.ts` gom gác quyền 502→401→403 + audit có `outcome`
  (cả 413/409/502) + response CSV cho ba route (reports trước đó không audit);
  copy nút Export nhắc cả ô tìm email; `ExportButton` sang kit.
- **Dùng chung**: `newsletter/unsubscribe-claim.ts` một luật claim cho đường
  khách lẫn admin; `ToolbarSelect` có `toFreeValue`/`fromFreeValue` để giá trị
  tự do từ DB không đụng sentinel "All" (áp cả Select type payment events).
- **Stats** một câu `COUNT(*) FILTER` cho năm con số thay 5 count rời; mục
  Index ghi `subscribers` (bảng không index — ứng viên đầu tiên chạm ngưỡng);
  caption "Active now" nói rõ đếm toàn danh sách.
- **Dọn**: bỏ spread chết ở `subscribersHref`, bỏ union đổi tên `bookings`
  (route đọc `items` như subscribers), `EXPORT_MAX_ROWS` một nhà, memo cột theo
  giá trị nguyên thuỷ, gộp int test trùng, thêm spec `subscribers-export-link`.
- Chấp nhận có ghi chú: card "Unsubscribed 28d" đếm trên trạng thái (không
  bảng audit consent — P4c không thêm migration).

**P4c khép 03/09**: bốn vùng F7–F10 đủ, 40 findings vá, hai migration
(`outbox_status_skipped`, `enquiry_status_events`) đã deploy Supabase.

Tests after: 1417 web · 300 api · 316 api-int · 186 contract · 22 ui ·
10 tokens · 2 i18n · 598 admin.

## 2026-09-03 — Vá 8 alert Dependabot mới (4 high fast-uri · 4 moderate fastify) + 2 `pnpm audit` thấy thêm (nhánh `fix/deps-dependabot-0903`, ff-only, 1 commit)

Gốc rễ: cả 8 advisory được công bố **02/09 15:13–15:44 UTC — SAU** đợt vá cùng
ngày (13:04), không phải hồi quy. Chúng nhắm vào fastify (framework HTTP của
API, ghim cứng 5.10.0) và fast-uri (bộ parse URI của nó); alert kiểu này sẽ
còn xuất hiện mỗi khi có CVE mới, việc đúng là một nhịp `pnpm audit` đều đặn
chứ không phải "sửa một lần là hết".

- **fastify → 5.12.1** (`apps/api` nâng dep trực tiếp + override scoped
  `fastify@>=5.0.0 <5.12.1: 5.12.1`, vì `@nestjs/platform-fastify` ghim cứng
  fastify — 11.1.28 → 5.10.0, bản 11.2.3 mới nhất cũng chỉ 5.11.3 — không
  override là hai fastify trong store, adapter Nest chạy bản cũ). Hai advisory:
  X-Forwarded-* spoofing dưới `trustProxy` dạng hop-count — **đúng dạng API
  đang dùng (`trustProxy: 1`)** nên `req.ip` cho rate limit giả mạo được; và
  schema validation bypass với body schema primitive (không áp dụng — API
  validate bằng zod/oRPC). 5.12.1 **bỏ hẳn dạng số** khỏi option → adapter đổi
  sang danh sách địa chỉ proxy được tin qua env mới `TRUST_PROXY` (mặc định
  `loopback,linklocal,uniquelocal` — ingress Render/Railway nối từ mạng riêng);
  `bootstrap.spec.ts` pin cả hai chiều: proxy nội bộ forward → IP khách thật,
  client công khai tự gửi XFF → bị bỏ qua.
- **fast-uri**: hai override cũ nới dải (`<3.1.6 → ^3.1.6`, `<4.1.3 → ^4.1.3`;
  lock 3.1.7 / 4.1.3) — `pnpm audit` (DB npm) ghi dòng 3.x dính cùng bốn GHSA
  dù Dependabot chỉ liệt kê 4.x; vá cả hai, không tin một nguồn.
- **qs** (`<6.16.0 → ^6.16.0`): `pnpm audit` thấy trước khi Dependabot mở
  alert; đường @orpc/nest → express → qs, API không dùng express nên là code
  chết trong store.
- `minimumReleaseAgeExclude` thêm fastify 5.12.1 / fast-uri 3.1.7 / qs 6.16.0
  (bản vá xuất bản cùng ngày với advisory). `pnpm audit` về 0.

**Tests after:** `gate:int --force` không cache — 21/21 task, 295/295 int,
api unit 296 (thêm 4 test trustProxy); API tạm build + boot thật trên fastify
5.12.1 cho web prerender.

## 2026-09-03 — P4c F9: Enquiries + notes (CRM lead, hai hành vi ghi có audit) + vòng vá (nhánh `feat/p4c-enquiries`, 3 commit `f59499f..a8a3894`, ~45 file, migration `20260903013002_enquiry_status_events` đã deploy Supabase)

Tính năng thứ ba P4c ([spec P4c](../specs/2026-09-02-p4c-operations-design.md)
§3-F9, có mục AMEND): bảng audit `enquiry_status_events` (append-only,
`adminId`), contract `admin.enquiries.list/byId/setStatus/addNote` +
`admin.stats.enquiries`, module API `modules/enquiries` thêm controller/service
admin (`setStatus` = `FOR UPDATE` + update + insert event trong một transaction,
no-op khi cùng trạng thái), trang `/enquiries` (tab năm trạng thái, tìm
tên/email, chip `tourId`) và `/enquiries/[id]` (thẻ lead, message nguyên văn,
đổi trạng thái qua `ConfirmWriteDialog` nêu from → to, thread note append-only,
lịch sử trạng thái), stat card New/Won/Open. Nghiệm thu review 8 mũi → 10
findings (7 CONFIRMED · 3 PLAUSIBLE), user duyệt vá một mạch (`a8a3894`):

- **Tên tài khoản rỗng**: `admin.name ?? admin.email` cho `''` lọt vào
  `author_name` trong khi contract `min(1)` — một note là `byId` 500 vĩnh
  viễn (thread không xoá được). Nay `accountDisplayName` (`trim() || email`)
  dùng cho cả note lẫn audit; int test có ca admin `name = ''`.
- **Stats cache lệch bảng**: vùng cache 60s với lý do "chỉ admin bấm nút mới
  đổi số", nhưng form "Inquire Now" công khai ghi lead NEW ngoài mọi
  `updateTag`. Nay không cache (cùng luật outbox/payment events), hai action bỏ
  `updateTag`; JSDoc ghi luật chung: cache theo tag chỉ khi mọi kẻ ghi bảng là
  server action admin.
- **Hai lệnh ghi**: `setStatus` trả `{ id, name, status, changed }` (no-op có
  toast riêng, không log giả, transaction không đọc lại detail trong lúc cầm
  lock); `addNote` trả `{ id }` — bản đầu đọc lại ngoài transaction nên một
  `NOT_FOUND` ở bước đọc biến note đã lưu thành "not saved". Nhánh catch của
  note-form nay refresh như GENERIC (tránh note đúp).
- **Đường về + chip tour**: link chi tiết mang `?back=` (validate chỉ nhận
  `/enquiries…`) để "Back to enquiries" về đúng tab/trang/ô tìm; chip tour là
  chữ cố định thay vì tên suy từ hàng đầu của trang.
- **Won 28d đếm lead** (`COUNT(DISTINCT enquiry_id)`), không đếm lượt bấm;
  `previous` = 0 trong 56 ngày đầu vì bảng audit mới.
- **Dọn field/dùng chung**: `EnquiryRow` bỏ `phone` (PII, chỉ detail) và
  `tourSlug`; hai `select` sống cạnh mapper với kiểu `Prisma.EnquiryGetPayload`;
  `apps/api/src/lib/like.ts` `escapeLike` cho mọi `contains` (Prisma không escape
  `%`/`_` — áp cả bookings và outbox), `apps/api/src/lib/calendar-date.ts` gộp
  bốn bản, kit `components/kit/timeline.tsx` (lịch sử huỷ booking + hai timeline
  enquiries), `orphanPageHref` ở `table-query` thay sáu bản chép, caption "Open
  now" dựng từ `OPEN_ENQUIRY_STATUSES`.

Tests after: 1417 web · 292 api · 295 api-int · 168 contract · 22 ui ·
10 tokens · 2 i18n · 539 admin.

## 2026-09-02 — Vá 3 alert Dependabot (3 high, đều bắc cầu) (nhánh `fix/deps-dependabot-0902`, ff-only, 1 commit)

Hai override SCOPED thêm vào `pnpm-workspace.yaml` theo nếp 04/08 (chỉ áp
trong dải dính lỗ hổng, không ghim chết bản sau), comment tại chỗ ghi đủ đường
kéo vào và mức độ thực tế: `browserslist@<4.28.7 → ^4.28.7` (alert #28 #29 —
prototype write qua `browserslist-stats.json`, tăng bộ nhớ không giới hạn;
kéo vào qua shadcn CLI → @babel/core, chỉ chạy lúc `shadcn add` trên máy dev,
Next đóng gói browserslist riêng) và `mysql2@<3.22.0 → ^3.22.0` (alert #27 —
downgrade auth plugin lộ mật khẩu; prisma CLI 7.8.0 ghim cứng 3.15.3 và
7.9/7.10 vẫn vậy, 8.0 còn rc sát freeze; DB là Postgres, `parseEnv` từ chối
`mysql://`, không file nào require mysql2 — code chết trong node_modules).
Lock lên 4.28.8 / 3.24.2; `pnpm audit` về 0.

**Tests after:** `gate:int --force` không cache — 21/21 task, 263/263 int;
`prisma generate` + `migrate status` trên docker DB xanh với cây mới.

## 2026-09-02 — P4c F8: Payment events (sổ webhook, read-only) + vòng vá (nhánh `feat/p4c-payment-events`, 3 commit `3e48516..b73a4e1`, ~49 file, không migration)

Tính năng thứ hai P4c ([spec P4c](../specs/2026-09-02-p4c-operations-design.md)
§3-F8, có mục AMEND): contract `admin.paymentEvents.list/byId` +
`admin.stats.paymentEvents`, service/controller trong `modules/payments`
(list bỏ `payload`, `bookingCode` join tay vì cột không FK), trang
`/payment-events` (tab provider, Select type, tìm eventId, toggle
"Unprocessed only", badge + tooltip cho `processedAt` null), drawer JSON nâng
lên kit `components/kit/json-drawer.tsx` (consumer thứ hai — outbox dùng lại),
payload tải khi mở qua server action đọc `getPaymentEventAction`. Nghiệm thu
review 8 mũi → 10 findings (9 CONFIRMED · 1 PLAUSIBLE), user duyệt vá một mạch
(`b73a4e1`):

- **Drawer**: trạng thái tải gắn `id` (đổi hàng A→B không lộ JSON của A ở
  frame đầu, kết quả A về muộn không ghi đè); loader ném → câu lỗi GENERIC
  thay vì treo "Loading…". Lỗi đọc đi qua `createWriteErrorCodec` với option
  mới `transportCopy` (i18n tách `detail.errors` chỉ mã contract /
  `detail.transportErrors`, test đối chiếu `errorMap`).
- **Stat card**: contract thêm `stuck` + `PAYMENT_EVENT_STUCK_MINUTES = 5` —
  card Unprocessed chỉ kêu đỏ khi có row chưa xong quá 5 phút (webhook vừa tới
  mà handler đang chạy là bình thường), `unprocessed` giữ nghĩa khớp bảng;
  admin bỏ cache 60s (cùng luật outbox: kẻ đổi sổ ngoài `updateTag`, bảng đọc
  tươi); `paymentEventsSlice` một `aggregate` thay hai `count`.
- **Lọc type tự do**: parser admin nhận chuỗi như contract (cột varchar),
  Select thêm mục tạm cho giá trị ngoài tuple; `PaymentEventTypeSchema` xuất
  từ contract; int test có row `payment.chargeback`.
- **Redact dùng chung** `apps/api/src/lib/redact.ts` cho outbox + payment
  events (che theo tên khoá mọi độ sâu, tập khoá hợp hai vùng,
  `Object.create(null)`); badge bỏ `title` trùng tooltip; kit
  `components/kit/booking-link.tsx` thay ba bản chép link booking
  (cancellations, bảng, drawer); VM bỏ `bookingHref`/`unprocessed`; thêm spec
  render `OutboxDetailSheet`.

Tests after: 1417 web · 281 api · 263 api-int · 143 contract · 22 ui ·
10 tokens · 2 i18n · 473 admin.

## 2026-09-02 — P4c F7: Outbox (hàng đợi email, retry) + vòng vá (nhánh `feat/p4c-outbox`, 3 commit `dea5566..ae5221a`, ~50 file, migration `20260902090000_outbox_status_skipped`)

Tính năng đầu P4c ([spec P4c](../specs/2026-09-02-p4c-operations-design.md) §3-F7):
contract `admin.outbox.list/retry` + `admin.stats.outbox`, module API
`modules/outbox` (guard cấp class, int test 401/403), trang `/outbox` (tab
trạng thái, Select loại email, tìm kiếm, drawer payload, retry qua
`ConfirmWriteDialog` — consumer đầu tiên không có ô note), `OUTBOX_MAX_ATTEMPTS`
một nguồn ở contract (worker import lại), `recipient` tái dùng đúng
`worker/recipient.ts`. Thi công đúng khuôn P4b, ba quyết định tự chọn có
JSDoc. Nghiệm thu review 8 mũi → 10 findings (8 CONFIRMED · 2 PLAUSIBLE),
user duyệt vá một mạch (`ae5221a`):

- **Bảo mật**: payload PASSWORD_RESET mang URL có token, EMAIL_OTP mang mã,
  và `auth.config.ts` nhét cả hai vào `dedupeKey` — trang `/outbox` từng phơi
  cho mọi admin. Mapper API nay che `url`/`otp`/`token` (theo tên khoá, mọi
  loại email) và cắt dedupeKey của email auth còn tiền tố; int test khẳng
  định token không xuất hiện trong response.
- **Trượt mục tiêu**: ô tìm chỉ khớp `dedupeKey` mà key thật là
  `<event>:<uuid>` — gõ `BK-…` như placeholder gợi ý luôn rỗng (fixture test
  bịa format nên xanh). Nay khớp `payload.code`/`email`/`to` + dedupeKey,
  không phân biệt hoa/thường; fixture theo quy ước thật.
- **Stat card nói dối ba cách**: "Sent 28d" đếm cả hàng newsletter bị skip
  (worker đánh SENT không gửi) → trạng thái **`SKIPPED`** mới (migration, đã
  deploy Supabase), purge dọn cùng SENT; kỳ trước của Sent bị purge 30 ngày
  xoá gần hết → `sent` thành số đơn không delta; Queued/Failed cache 60s trong
  khi worker đổi hàng đợi mỗi phút → stats outbox không cache; card Failed
  mượn `delta: 'flat'` để lấy tông đỏ → StatCard thêm khe `callout`.
- **Retry**: một câu `update` có guard `status = FAILED` (hết khe hở đọc lại
  ngoài UPDATE, hết P2025 thành 500); nhãn Attempts đọc dấu vết retry
  (`attempts 0` + `lastError`) — "Re-queued by an operator" / "Sent after a
  manual retry" thay vì "0/5"/"First try" cho hàng phải can thiệp 6 lượt.
- **Kit đến ngưỡng §2.1**: `ConfirmWriteDialog` union `noteId`+`noteLabel`
  (audit note không thể biến mất mà typecheck xanh); `createWriteErrorCodec`
  nhận `stale` (ba `isStaleStateCode` tay bỏ); `ToolbarSelect` nâng từ ba bản
  chép; `clampSearch`/`pickPatch` ở `table-query`; `AdminPageQuerySchema` ở
  contract; `toPaged` ở API; commit đầu reword cho có câu tiếng Việt (luật 12).

Tests after: 1417 web · 267 api · 245 api-int · 130 contract · 22 ui ·
10 tokens · 2 i18n · 425 admin.

## 2026-09-02 — P4b polish: bề mặt admin, chọn hàng export, date picker + vòng vá (nhánh `fix/p4b-ui-polish`, 1 commit `32dce27`, 34 file)

Vòng chỉnh chi tiết F1–F6 do user cầm ở session riêng (01/09, không commit
— nghiệm thu trên working tree): [ADR-0027](../adr/0027-admin-surface-palette.md)
vỏ tối/ruột trắng lạnh khoanh vào `[data-admin-surface]` (không đụng
`@tourism/tokens` dùng chung với web); [spec + plan export theo lựa
chọn](../specs/2026-09-01-bookings-export-selection-design.md) — nút Export vào
ô tiêu đề bảng, cột checkbox, `sel=` khoá trong trang đang xem (route lấy MỘT
trang rồi giao theo mã, không đổi contract), 409 khi trang đã đổi; ô ngày
kiểu `date-picker-04` (Calendar/Popover có sẵn), nhãn nổi ô tìm kiếm, pill
trạng thái có icon, `DecisionButton` vào kit (2 consumer), `motion` (cùng
bản web) vào admin. Review 8 mũi → 10 findings (8 CONFIRMED · 2 PLAUSIBLE),
user duyệt vá một mạch (cùng commit):

- **Tiền đề "tích chết theo trang" sai**: đổi page/filter là soft navigation
  cùng segment nên React giữ `useState` của bảng, và v9
  `getIsSomeRowsSelected` đếm KEY chứ không đếm hàng — checkbox tiêu đề kẹt
  `mixed` không gỡ được. Bảng nay tự đặt lại tích khi query đổi, ô "một phần"
  đếm hàng đang hiện, `selectableTableFeatures` tách khỏi bộ chung. Export có
  chọn trả 409 khi thiếu BẤT KỲ hàng nào đã tích (bản đầu chỉ chặn ca 0
  hàng), kèm `includeMedia=false` + ngân sách 45s như export-all.
- **Cơ chế đè token hở hai chỗ** (ADR-0027 §AMEND 02/09): script pre-paint
  vẫn gắn `.dark` theo OS trong khi lớp đè khai 23/48 token — máy dark mode
  từng có chữ gần-trắng trên nền gần-trắng ở badge/hover menu → gỡ script
  (admin một diện mạo cố định); overlay portal ra `body` thoát khỏi lớp đè →
  selector thêm `body:has([data-admin-surface])`, login vẫn tự miễn nhiễm.
- **Ba component mới**: nút Export dừng vòng xáo khi nhãn đổi và tên khả truy
  cập là nhãn thật (không còn "░▒#$%" cho screen reader); ô ngày — bấm icon
  lịch không blur, focus đi vào lịch không chốt (hết "lịch đóng ngay khi vừa
  mở"); `parseTypedDate` chặn ISO một phần khỏi `new Date` (UTC lệch một ngày
  ở múi giờ âm); ô tìm kiếm `key` bọc cả cụm ô + state `focused`.
- **Docs/luật 13**: spec + plan 01/09 vào bản đồ; plan sửa dòng "không thêm
  dependency". Nợ ghi sổ: kit import full `motion/react` cho một viên pill
  (LazyMotion/CSS thuần khi P4d chạm kit); highlight hàng đã tích, bản đồ
  icon chép 6 file, registry `{style}` — chưa động.

Tests after: 1417 web · 259 api · 223 api-int · 114 contract · 22 ui ·
10 tokens · 2 i18n · 374 admin.

## 2026-09-01 — P4b F6: báo cáo tháng + Export CSV, đóng P4b 6/6 (nhánh `feat/p4b-reports-export`, 8 commit `0f773e2..1c46b4b`, ~50 file)

Tính năng cuối P4b (user đặt hàng 31/08, 0 dependency mới — CSV tự dựng,
"PDF" là `window.print()` + `@media print`): lọc khoảng ngày `from`/`to` trên
`/bookings` (hai ô date native, URL-state), nút Export CSV của ĐÚNG tập đang
lọc qua route handler TỰ gác quyền (`decideAdminAccess` — route không đi qua
layout), trang `/reports?month=YYYY-MM` in được + CSV, chạy trên endpoint MỚI
`admin.reports.monthly` (endpoint riêng thay vì tham số hoá `admin.stats`:
cửa sổ đôi 28 ngày phải DÀI BẰNG NHAU, tháng 28/31 ngày phá bất biến đó —
JSDoc `schemas/reports.ts`). Aggregate tách ra `stats-aggregates.ts` cho
StatsService + ReportsService dùng chung — doanh thu vẫn MỘT định nghĩa.
Session thi công tự vá 3 vòng (route export đọc URL đúng luật trang, hạ trần
export 5000→2000, 502 có lời). Nghiệm thu review 8 mũi → 10 findings
(9 CONFIRMED · 1 PLAUSIBLE), user duyệt vá theo 3 đoạn (`1c46b4b`):

- **Chặn năm 1900–2099 ở contract**: `?month=9999-12` từng sinh mốc năm 10000
  làm chính output schema từ chối response (trang lỗi thay vì "tháng trống"),
  `0050-06` âm thầm thành 1950 (luật year 0–99 của `Date.UTC`); `from`/`to`
  bookings cùng trần qua `CalendarDateSchema` mới — admin import thẳng, hết
  bản khai lại. Nhãn tiền báo cáo hỏi lần lượt payment tháng → sổ hoàn
  (`refundCurrency` mới) → USD: tháng chỉ có refund EUR hết bị dán nhãn đô.
- **Đường export chịu được đời thật**: guard nonce ô date đúng từ trang 2+
  (so phần lọc với page ghim cả hai vế); vòng gom song song theo đợt 5 trang
  và MỘT `AbortSignal` 45s chung + `maxDuration 60` (quá ngân sách là 502 có
  lời, không phải response cụt của Vercel); dedupe theo `code` (offset
  pagination trên tập đang trôi); cờ contract `includeMedia=false` cắt 20
  query media/payload ảnh chỉ để vứt.
- **Nói thật + để vết**: session phân loại `ok/none/unreachable` — API sập là
  502 `exportFailed`, hết 401 "phiên hết hạn" giả; nút Export tự tắt kèm câu
  413 làm tooltip khi `total` vượt trần (biết TRƯỚC cú click); audit log xuất
  PII (adminId + bộ lọc + số hàng, `search` chỉ ghi có/không); danh sách 8
  metric của bảng vận hành và CSV gộp về MỘT bảng mô tả (`raw`/`display`),
  `formatCount` dùng chung stats-view.

Tests after: 1417 web · 259 api · 223 api-int · 114 contract · 22 ui ·
10 tokens · 2 i18n · 331 admin.

## 2026-09-01 — P4b F5: stat card 28 ngày cho ba trang vùng + vòng vá (nhánh `feat/p4b-area-stats`, 5 commit `e4f6a1a..f9e47b6`, ~50 file)

Tính năng user đặt hàng (AMEND spec 31/08) — contract `admin.stats` MỚI (3
endpoint, mỗi metric mang CẢ kỳ này + kỳ trước, client không tự chế delta),
`StatsService` module riêng có JSDoc định nghĩa TỪNG metric đối soát được
(revenue neo `paid_at`, gross; cancellationRate mẫu số = paidBookings), kit
`StatCard` (style ăn section-cards, polarity một nguồn ở `stats-view.ts`) gắn
`/bookings` `/cancellations` `/reviews`. Session thi công cũng TRẢ NỢ kit từ
F4 (`ConfirmWriteDialog` + `TableSearchForm` — mũi review B xác minh tái lập
1-1, không test nào mất) và nâng scrollbar custom lên `@tourism/ui` (một
nguồn cho cả web + admin). Nghiệm thu review 8 mũi → 10 findings, user duyệt
vá theo 3 đoạn (`f9e47b6`):

- **Metric hết nói dối**: `cancellationRate` đếm cả `REFUNDED` (hoàn đủ qua
  refund trực tiếp không bao giờ đụng `CANCELLED` — card từng in 0% khi 30%
  tiền đã về); `Approved 28d` của reviews đếm LƯỢT DUYỆT trên audit trail
  `review_moderation_events` (un-approve hôm nay hết xoá ngược kỳ đã đóng);
  `revenueCurrency` chặn cả hai đầu cửa sổ. Int test khoá từng ngữ nghĩa,
  guard 401/403 phủ cả 3 endpoint.
- **Delta đúng đơn vị**: metric vốn là %/sao hết ăn pill tương đối —
  cancellationRate ra điểm phần trăm ("↑2.0 pp" thay "↑100.0%"),
  averageRating ra hiệu số thô; 0 → N hiện pill "New" (hàng đợi 0 → 40 từng
  render y hệt 40 → 40).
- **Kit một máy confirm-write**: nhánh success ra khỏi `try` (onSettled ném
  hết sinh toast lỗi cạnh toast thành công); vòng đời lệnh ghi rút thành hook
  `useConfirmWrite` — `RefundDialog` hai-bước của F2 (bản chép thứ ba bị bỏ
  quên trên đường tiền thật) giờ chạy cùng một máy.
- **Hiệu năng**: stats cache 60s theo tag + `updateTag` ở 3 action ghi (hết
  refetch mỗi click, hết kéo dài thời gian khoá nút); gộp query `groupBy`
  fan-out 13→9; scrollbar thêm `height` (thanh ngang bảng admin hết thành
  vệt primary dày); `money()` → `grossAmount` hết trùng tên payments.

Tests after: 1416 web · 249 api · 205 api-int · 101 contract · 22 ui ·
10 tokens · 2 i18n · 243 admin.

## 2026-08-31 — P4b F4: hàng đợi moderation review + vòng vá (nhánh `feat/p4b-reviews`, 2 commit `ee0cb20..5f0010f`, ~30 file)

Tính năng thứ tư, thi công TỐT nhất bốn vòng (bẫy pageSize-vs-limit né đúng
có test khoá qua chính schema contract, kit dùng đủ, quy ước sạch, deviation
contract chỉ là type alias khai minh bạch). Nghiệm thu review 8 mũi → 10
findings, user duyệt vá theo 3 đoạn nhỏ (`5f0010f`) — lần này phần nặng nằm
ở NGỮ NGHĨA moderation và đụng cả service API + migration:

- **API an toàn trạng thái**: guard trạng-thái-trùng cho `moderate` (no-op —
  tab cũ bấm approve lên review đã duyệt không còn ghi đè `moderatedBy`
  thành người-không-quyết-gì hay đẩy event from===to vào audit trail); gate
  email thêm `!deletedAt` — hết xếp thư tới `deleted+…@tombstone.local`
  (xoá tài khoản là soft-delete, gate cũ chỉ soi user?.email). 2 int test.
- **Dialog không lật chiều**: `approve` đóng băng vào state LÚC BẤM — queue
  refresh giữa lúc dialog mở (hàng khác vừa quyết, admin B đụng cùng hàng)
  từng lật dialog Approve thành Unapprove, cú click gửi lệnh ngược ý định.
- **Copy hệ quả hết nói quá**: nhánh không-gắn-tour cho publish/hide; câu
  rating khi unapprove nói thẳng ca review-duy-nhất → tour MẤT cụm sao trên
  site tới khi review khác được duyệt; sr-only báo số ảnh trước khi duyệt
  công khai (alt thường rỗng).
- **Ảnh + index**: `reviewPhotoThumb` chèn `w_128,h_128,c_fill` + lazy +
  width/height (hết kéo ảnh gốc 10MB vẽ ô 32px); migration MỚI
  `reviews_moderation_queue_index` phủ tab/sort hàng đợi, đã deploy Supabase
  tường minh theo gotcha prisma.config; trgm cho search ghi sổ chờ dữ liệu.
- **Đồng bộ với web**: sao rating token `fill-rating` (vàng như 8 component
  web), `ratingLabel` cùng câu "out of 5 stars" (hoist `RATING_LABEL_COPY`),
  "Deleted account" một hằng cho 3 bề mặt; `ALL_FILTER_VALUE` lên kit; dọn
  field/key chết (tourSlug, moderate.review) + JSDoc tả cascade sai.
- **Nợ ghi sổ, xử ở ĐẦU F5**: nâng máy confirm-write (ModerateDialog ≅
  DecideDialog) thành kit `ConfirmWriteDialog` + kit `TableSearchForm` — bản
  chép thế hệ ba đã đủ consumer để tổng quát hoá.

Tests after: 1416 web · 238 api · 187 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n · 200 admin.

## 2026-08-31 — P4b F3: hàng đợi cancellations + vòng vá review (nhánh `feat/p4b-cancellations`, 2 commit `2da536e..9c38df6`, ~30 file)

Tính năng thứ ba theo nếp session-per-feature. Session thi công dựng:
`/cancellations` trên kit (URL-state, server component) + server action
decide approve/deny theo đúng khuôn F2 (codec lỗi derive từ i18n, signal 30s,
confirm nêu 3 hệ quả, có test khoá) + tự tổng quát hoá `table-query.ts` khi
consumer thứ hai xuất hiện (đúng spec §2.1 — mũi review B xác minh tái lập
1-1, 22 test cũ giữ nguyên). Nghiệm thu review 8 mũi → 10 findings, user
duyệt vá tại chỗ (`9c38df6`), lại đụng cả contract + API vì fix gốc rễ nằm ở
tầng dữ liệu:

- **Tiền vào queue**: `AdminCancellationRequestSchema` thêm
  totalAmount/refundedTotal/currency (groupBy một query chống N+1) — dialog
  approve HIỆN số tiền sẽ hoàn (phần còn lại), hết bấm lệnh tiền mù. Đây
  cũng là câu trả lời cho câu hỏi vận hành của user: approve luôn hoàn TOÀN
  BỘ phần còn lại; muốn thu phí huỷ thì deny + refund partial thủ công.
- **Lỗi trạng-thái-cũ tự refresh**: NOT_FOUND/ALREADY_DECIDED/NOT_REFUNDABLE
  đóng dialog + toast + kéo queue tươi (copy hứa "queue has been refreshed"
  thì UI làm thật — admin B hết bấm lặp trên hàng đã quyết); REFUND_FAILED
  retryable ở lại dialog; `useTransition` khoá nút tới khi refresh xong; MỘT
  dialog mỗi hàng (50 hàng từng mount 100 cây dialog).
- **Page mồ côi**: cả hai bảng redirect về trang cuối còn thật khi tập kết
  quả co dưới chân URL — hết "bảng rỗng cạnh Page 2 of 2".
- **Kit hoá nốt phần chép verbatim** (~270 dòng): StatusFilterTabs +
  DataTableBody + ColumnVisibilityMenu vào `components/kit`;
  `createWriteErrorCodec` (refund + decide cùng dùng); `resolvePagePatch`
  (luật reset-page một bản); cảnh báo bẫy `limit` vs `pageSize` của F4 ghi
  thẳng vào JSDoc `TablePaging`.
- Lặt vặt: ô Decision fallback gạch ngang khi decidedAt null; badge
  cancellation một luật màu ở cả queue lẫn booking detail; sidebar mở thẳng
  `?status=REQUESTED` (hàng đợi = việc cần làm) + pageTitle so pathname bỏ
  query; nhãn dialog dùng chung hằng với header cột.

Tests after: 1416 web · 238 api · 185 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n · 140 admin.

## 2026-08-31 — P4b F2: refund money-path + vòng vá review (nhánh `feat/p4b-bookings-refund`, 2 commit `0a20cdc..8951e68`, ~20 file)

Tính năng thứ hai theo nếp session-per-feature. Session thi công dựng: server
action `refundBookingAction` (tự đọc cookie, quyền chặn ở AuthGuard API) +
dialog confirm 2 bước + 6 mã lỗi contract mỗi mã một câu + TDD. Nghiệm thu
review 8 mũi → 10 findings, user duyệt vá tại chỗ (`8951e68`) — vòng vá này
ĐỤNG CẢ contract + API vì fix gốc rễ nằm ở tầng dữ liệu:

- **Sổ cái thật từ `byCode`**: `AdminBookingDetailSchema` thêm `refunds[]`,
  `adminByCode` điền `refundedTotal` aggregate — ledger in từ DB ngay khi mở
  trang (kể cả auto-refund overbook), trần validate = phần CÒN HOÀN ĐƯỢC.
  Trước đó UI phải "giải thích endpoint thiếu gì" bằng 3 câu i18n — lỗ tầng
  dữ liệu vá bằng tầng copy, và câu "No refunds" có thể nói dối ở crash
  window của auto-refund.
- **Chống refund đúp**: trần 30s riêng cho lệnh ghi tiền (signal per-call
  qua context, link đọc giữ 10s); kết cục KHÔNG RÕ (GENERIC) → đóng dialog,
  toast lỗi, refresh — hết nút "Refund now" nạp đạn sẵn sau lỗi mập mờ
  (idempotency key phía API đổi theo ledger nên provider không đỡ được).
- **Hết thành-công-báo-thất-bại**: `try` chỉ ôm lời gọi tiền; `refresh()`
  rời action (client refresh sau toast); `formatAmount` không nổ RangeError.
  **Hết lỗi tàng hình**: dialog không đóng được khi đang bắn, khối lỗi đứng
  ngoài hai bước, panel props-driven (bỏ state dính đè prop refresh).
- **Nền cho F3/F4**: `lib/api/write-error.ts` dùng chung — `isDefinedError`
  thật của oRPC (mã trùng tên không giả được phán quyết contract), copy
  transport một chỗ `admin.errors.write`; `REFUND_CONTRACT_CODES` derive từ
  keys i18n (một nguồn — ba danh sách chép tay từng lệch "NĂM/SÁU mã" ngay
  trong một PR); action re-parse input → `INVALID_INPUT` riêng; lỗi validate
  derive (gõ sửa là tự biến), hiểu dấu phẩy thập phân; trang cắt subset 5
  field (giấu `decisionNote` khỏi Flight payload).

Mỗi lỗi có test khoá chống tái hiện: admin 56 → 95 test, api-int 184 → 185.
User test tay happy-path refund trên dev: đạt.

Tests after: 1416 web · 238 api · 185 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n · 95 admin.

## 2026-08-31 — P4b F1: vùng bookings đọc + vòng vá review (nhánh `feat/p4b-bookings-read`, 4 commit `8807961..80d35cd`, ~30 file)

Tính năng ĐẦU TIÊN thi công theo quy trình mới "một tính năng = một session":
session gốc viết spec + phát prompt, session thi công làm F1 trên branch,
quay về session gốc nghiệm thu. Nghiệm thu chạy review 8 mũi song song
(line-by-line · removed-behavior · cross-file · reuse · simplification ·
efficiency · altitude · conventions) trên diff, verify trực tiếp trên code
→ 10 findings, user duyệt vá tại chỗ (commit `a8f8bb6`).

Phần thi công (session F1): client oRPC admin port từ web (cookie forward,
no-store, timeout 10s) + `/bookings` bảng kit (trạng thái trên URL —
searchParams → fetch server-side → TanStack chỉ lo ẩn/hiện cột) + chi tiết
`/bookings/[code]` read-only + kit `components/kit/` (frame/pagination) mọc
từ consumer đầu tiên đúng spec §2.1; TDD 39 test mới cho logic thuần
(parse searchParams, mapper hiển thị, fetch options). Quy ước sạch tuyệt đối
(tokens-only, i18n, comment Việt, phạm vi đúng F1).

Vòng vá 10 findings đáng nhớ: admin CHƯA có `error.tsx`/`not-found.tsx` nào
(401 giữa chừng/timeout/API sập nổ trang lỗi thô — thêm hai lưới ở root);
`/bookings/foo` 500 thay vì 404 (soi định dạng `BK-` tại client); nhãn
"Price per adult" sai nghĩa (API nhân unitPrice với TỔNG khách — đổi "per
person"); clamp page hiển thị (`?page=99` từng in "1961–5 of 5 · Page 99 of
1"); `parse` throw trong event handler → `safeParse`; `formatGuests` chế bản
thứ hai của `travellers()` i18n đã lệch số nhiều ngay lúc viết → dùng chung;
gỡ cụm TanStack `manualPagination`/`rowCount` không ai đọc; gỡ `cache()` có
docstring tả call site không tồn tại; session + fetch lên `Promise.all`;
thêm landmark `<nav>` phân trang. Cùng đợt: user duyệt AMEND spec P4b thêm
F5 (stat card 3 vùng — mở namespace `admin.stats`) và F6 (reports/export
CSV + trang in, 0 dependency mới) — admin thành công cụ thống kê/báo cáo,
không chỉ xem và CRUD.

Tests after: 1416 web · 238 api · 184 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n · 56 admin.

## 2026-08-31 — Shell admin theo block dashboard-01 (nhánh `feat/p4-admin-shell-dashboard01`, 7 commit `7e1a9e1..efc8b5c`, 21 file)

Vòng redesign shell sau login theo quy trình quen: user chọn block chính chủ
shadcn `dashboard-01`, cài qua CLI (components.json mới cho admin, CLI tự
chọn biến thể Base UI + đổi icon tabler→lucide) và **tái hiện 1:1 NGAY trong
cổng gác thật** (không wireframe), rồi gọt từng bước — mỗi bước user nghiệm
thu trên localhost mới đi tiếp (nếp mới: agent chỉ báo cáo text, user tự
kiểm; agent cũng KHÔNG tự restart dev server nữa — ba lần treo vì `pnpm dev`
chạy từ root không có script `dev`).

Sáu bước gọt: (1) sidebar logo Slidex + 15 mục/3 nhóm thật từ `lib/nav.ts`
(giữ Quick Create + ô mail theo ý user; bỏ chip "back office"; wordmark
"Nexora" viết hoa N — áp cả web); (2) nav-user ăn session thật, avatar tròn
đồng nhất 4 tầng (override vuông lộ góc → bỏ hẳn); (3) header đổi tiêu đề
theo trang, tra MỘT nguồn `lib/nav.ts` khớp tiền tố dài nhất; (4) 4 card +
chart giữ kiểu, số demo dọn sạch — nhãn theo 4 metric thật chờ P4d
(doanh thu PAID · bookings PAID · reviews chờ · enquiries NEW), giá trị "—"
và "Awaiting live data", KHÔNG bịa số; (5) data-table: 68 dòng demo → rỗng,
3 tab demo + Add Section bỏ, header cột theo nghĩa bảng recent-bookings
(Code/Tour/Status/Guests/Amount/Customer), máy móc TanStack và dnd và
Columns và phân trang GIỮ làm xương CRUD kit P4b; (6) dọn xác AppShell P4a
và nav-documents/nav-secondary và key i18n `dashboardPlaceholder`.

Hai fix đáng ghi: card status hai màu lệch demo vì Card nova có
`CardFooter border-t + bg-muted/50` — override cục bộ, không đụng Card dùng
chung; **Sign out không bấm được** (user phát hiện) vì viết `onSelect` idiom
Radix trong khi menu `@tourism/ui` là Base UI chỉ nhận `onClick` — user-menu
web đúng từ đầu, đối chiếu là ra.

Tests after: 1416 web · 238 api · 184 api-int · 87 contract · 22 ui ·
10 tokens · 2 i18n · 17 admin.
