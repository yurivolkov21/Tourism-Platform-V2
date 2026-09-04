# Spec P4c — Vận hành: outbox · payment events · enquiries · subscribers

02/09/2026 · tiếp nối [spec P4b](2026-08-31-p4b-admin-ready-areas-design.md)
(kit đã trưởng thành qua 6 tính năng + vòng polish 01–02/09) và ADR-0026 §5
(thứ tự P4c → P4d → P4e → P4f). Đầu vào: [khảo sát parity admin 20/08](../analysis/2026-08-20-admin-parity-nexora.md)
§2 — bốn vùng dưới đây đều là `[V]` (Nexora có, v2 thiếu), và nhu cầu đã chứng
minh bằng chính sự cố 20/08 (vụ Resend key phải soi outbox bằng SQL tay).

Đánh số tính năng **F7–F10**, nối tiếp F1–F6 của P4b — cùng một dãy để mỗi
session thi công gọi tên được bằng một ký hiệu.

## 1. Mục tiêu & phạm vi

Bốn vùng vận hành có dữ liệu thật ở DB nhưng **0 endpoint admin**. Khác P4b
(ăn API sẵn), mỗi vùng ở đây thêm endpoint MỚI vào `contract.ts` §admin —
contract-first như mọi phase (ADR-0026 §4), guard `AuthGuard` + `@Roles(ADMIN)`
ở controller, int test 401/403 cho từng endpoint.

| Vùng | Bảng đã có | Endpoint mới (nhóm `admin.*`) | Ghi | Ký hiệu |
| --- | --- | --- | --- | --- |
| Outbox email | `outbox` (PENDING/SENT/FAILED, `attempts`, `lastError`, `dedupeKey`) | `outbox.list` · `outbox.retry` | 1 | **F7** |
| Payment events | `payment_events` (provider, type, payload, `processedAt`) | `paymentEvents.list` · `paymentEvents.byId` | 0 — đọc | **F8** |
| Enquiries + notes | `enquiries` (5 trạng thái) · `enquiry_notes` | `enquiries.list` · `byId` · `setStatus` · `addNote` (+ migration audit) | 2 | **F9** |
| Subscribers | `subscribers` (`source`, `unsubscribedAt`) | `subscribers.list` · `subscribers.unsubscribe` | 1 | **F10** |

Mỗi vùng kèm **stat card 28 ngày** trên đầu trang (nếp F5): thêm endpoint
`admin.stats.<vùng>` theo đúng mẫu `admin.stats.bookings` — mỗi metric mang
cặp `{current, previous}`, định nghĩa ghi ở JSDoc `StatsService` (nguồn duy
nhất), query dùng chung `stats-aggregates.ts`. Metric nào là ẢNH CHỤP (không
có mốc thời gian để so hai kỳ) thì contract khai một số đơn, card không có
delta — cùng luật F5.

*AMEND 04/09 (nhánh `fix/p4c-backend-logic`, đợt điều chỉnh backend #1):* bốn
endpoint `admin.stats.*` của P4c (F7–F10) **giữ nguyên** cửa sổ 28 ngày cố
định — trang của chúng chưa có bộ lọc ngày nào. Chỉ `admin.stats.bookings`
(P4b-F5) mọc `.input({ from?, to? })` để ăn theo hai ô ngày của `/bookings`;
xem [AMEND ở P4b §3-F5](2026-08-31-p4b-admin-ready-areas-design.md) và
[ADR-0028](../adr/0028-bookings-stats-follow-filter.md). Ngày một vùng P4c
mọc bộ lọc ngày thì lặp lại đúng khuôn ấy (`statsWindowFromRange` +
`currentTo` đã dùng chung sẵn), đừng dựng cửa sổ thứ hai.

Ngoài phạm vi P4c: dashboard `/` (P4d — sẽ ăn lại các số "cần chú ý" của
P4c: review chờ, enquiry NEW, outbox FAILED), catalog CRUD (P4e), media/users
(P4f).

## 2. Quyết định thiết kế

Kế thừa nguyên §2 spec P4b (kit mọc từ consumer · list page = server
component, trạng thái trên URL · client oRPC cookie-forward · hành vi ghi có
confirm + lỗi contract hiện nguyên nghĩa · i18n/tokens/comment Việt). Thêm
cho P4c:

1. **Contract mới đặt đúng nhà.** Schema vào `libs/shared/contract/src/schemas/`
   — `outbox.ts`, `payment-events.ts` mới; `enquiries.ts` và `newsletter.ts`
   ĐÃ có (schema public create/unsubscribe) thì mở rộng, không tách file thứ
   hai cùng vùng. Router `admin.<vùng>` mount trong `contract.ts` cạnh
   `admin.bookings`. Mỗi vùng một module API (`modules/outbox` mới; enquiries/
   newsletter/payments thêm `admin-*.controller.ts` + service method).
2. **Đọc là mặc định, ghi là ngoại lệ có vết.** F8 hoàn toàn read-only. Ba
   hành vi ghi còn lại (retry / setStatus + addNote / unsubscribe) đều:
   confirm trước khi bắn (`ConfirmWriteDialog` + `useConfirmWrite`), mã lỗi
   riêng trong contract (`createWriteErrorCodec`), `updateTag(ADMIN_STATS_TAG)`
   sau thành công, và **quy được về người** — `adminId` ghi vào bảng audit
   (F9) hoặc log có cấu trúc (F7/F10, cùng nếp audit log export bookings).
3. **Payload JSON là dữ liệu, không phải giao diện.** Outbox `payload` và
   payment event `payload` hiện trong drawer/trang chi tiết dưới dạng JSON
   thụt lề, mono, cuộn — KHÔNG map thành form. Nếu payload có địa chỉ email
   khách thì vẫn hiện (admin đã thấy email ở bảng bookings), nhưng KHÔNG
   copy payload vào log server.
   *AMEND 03/09 (vòng chỉnh UI sau khi P4c khép, nhánh `fix/p4c-ui-polish`):*
   khối payload nay có **hai chế độ xem** — **Simple** (danh sách nhãn · giá
   trị PHẲNG, mặc định) và **Developer** (JSON nguyên văn như mô tả trên).
   Lý do user đưa ra: back-office này không phải ai cũng đọc được JSON. Điều
   luật này nói vẫn đúng và không bị nới: Simple KHÔNG map payload thành form
   và KHÔNG lọc bớt field nào — nó chỉ đổi cách trình bày, mọi lá đều ra một
   dòng (`lib/payload-fields.ts`, hàm thuần có test). Cùng đợt, vỏ panel đổi
   từ `Sheet` sang `Drawer` khuôn `@shadcn-space/drawer-02`. Chi tiết ở
   CHANGELOG 03/09.
4. **Không xoá.** Nexora có `DELETE` cho outbox và subscribers; v2 cố ý bỏ:
   outbox SENT đã có purge cron dọn, FAILED giữ lại để triage (chính lý do
   `MAX_ATTEMPTS` park nó thay vì xoá), subscriber huỷ = set `unsubscribedAt`
   (giữ mốc rút consent — cùng luật đường khách). Xoá dữ liệu vì GDPR là
   việc riêng, có spec riêng khi cần.
5. **Trạng thái không có audit thì không có metric.** Bài học F5 (approved
   reviews đếm trên `review_moderation_events`): F9 thêm bảng
   `enquiry_status_events` (append-only, `adminId`) trong CÙNG transaction
   với `setStatus`, để "Won 28d"/"Lost 28d" đếm được thật thay vì đoán qua
   `updatedAt`. Migration mới → phải `prisma migrate deploy` lên Supabase
   tường minh (CLAUDE.md gotcha) — session nghiệm thu làm, ghi vào báo cáo.
6. **Kit không mở thêm trừ khi có ≥2 consumer.** Bảng nào cũng lắp
   `DataTableFrame`/`DataTableBody`/`StatusFilterTabs`/`TablePagination`/
   `ColumnVisibilityMenu`/`TableSearchForm`/`StatCardRow`; URL qua
   `table-query.ts` (`parsePaging`/`appendPaging`/`tableHref`/`resolvePagePatch`).
   Drawer xem JSON của F7 và F8 là consumer thứ nhất/thứ hai của cùng một
   thứ → F8 nâng nó lên `components/kit/json-drawer.tsx` (F7 để ở vùng).
   Bảng có cột checkbox thì dùng `selectableTableFeatures`, không thì
   `serverTableFeatures` (đừng đăng ký thứ không ai đọc).
   *AMEND 03/09 (vòng chỉnh UI sau khi P4c khép, nhánh `fix/p4c-ui-polish`):*
   ba ô **Select lọc** mô tả ở §3-F7 (loại email), §3-F8 (type) và §3-F10
   (source) — cộng ô tháng `/reports` của P4b-F6 — nay là kit MỚI
   `components/kit/toolbar-filter-menu.tsx`, dựng theo khuôn
   `@ss-components/dropdown-menu-10` (user chốt qua bản demo
   [`design/mockups/outbox-type-menu.src.html`](../design/mockups/outbox-type-menu.src.html)).
   Consumer thứ ba là thứ đẩy nó lên kit, đúng ngưỡng ≥2 của mục này.
   `ToolbarSelect` ở lại kit cho hai nơi còn lại: nhánh mobile của
   `StatusFilterTabs` và ô đổi trạng thái §3-F9 (control GHI, không phải lọc).
   Chi tiết ở CHANGELOG 03/09.
   *Ngoại lệ ghi rõ (review polish 2):* kit được nhận prop **dữ liệu thuần có
   fallback** với MỘT consumer (`JsonDrawer.payloadHints`, `DataTableBody.empty:
   ReactNode`) — đường còn lại là fork khối kit ra vùng, thứ user cấm 31/08;
   prop **hành vi/nhánh render** vẫn cần ≥2 consumer. Giao ước giá trị lọc
   (sentinel All + tiền tố `v:`) sống ở `kit/filter-value.ts`.
7. **`nav.ts` đã có sẵn bốn mục `enabled: false`** (outbox, paymentEvents,
   enquiries, subscribers) — mỗi feature chỉ lật `enabled: true` của mục
   mình, không sắp lại nhóm.

## 3. Cắt tính năng — 1 tính năng = 1 session thi công

Quy trình mỗi tính năng (không đổi so với P4b): session mới nhận prompt (phát
từ session gốc) → làm ĐÚNG phạm vi trên branch riêng → `pnpm gate:int` xanh
→ commit (KHÔNG merge, KHÔNG push) → báo cáo → user kiểm localhost → quay về
session gốc nghiệm thu (review 8 mũi → vá → merge rebase+ff → docs sweep).

### F7 — Outbox (branch `feat/p4c-outbox`)

- **Contract** `admin.outbox.list` — input `{ page, limit, status?: OutboxStatus,
  type?: EmailType, search?: string (khớp `dedupeKey` contains, ≤120) }` →
  `Paged<OutboxRow>`; `OutboxRow` = id · type · status · attempts · dedupeKey
  · lastError · createdAt · processedAt · **`recipient`** (email đích rút từ
  payload — logic rút đã có ở `worker/recipient.ts`, tái dùng, không chép)
  · payload (JSON). Sắp xếp: `createdAt desc`.
  `admin.outbox.retry` — input `{ id }` → row sau khi đặt lại. Luật: chỉ hàng
  **FAILED** mới retry được; đặt `status = PENDING`, `attempts = 0`, giữ
  `lastError` (worker sẽ ghi đè ở lượt kế); `updateMany` với guard
  `status: FAILED` → 0 row thì `NOT_FAILED` (409-kiểu contract, hiện nguyên
  nghĩa: "hàng này không còn ở trạng thái FAILED"); không tìm thấy →
  `NOT_FOUND`. Worker drain mỗi phút tự nhặt — KHÔNG gọi worker từ API.
  Log có cấu trúc `[admin] outbox retry {adminId, outboxId, type}`.
- **Trang `/outbox`**: tab trạng thái (All/PENDING/SENT/FAILED — mặc định
  URL nav trỏ `?status=FAILED`, vì đó là lý do trang tồn tại), lọc `type`
  (Select từ enum `EmailType`), ô tìm `dedupeKey`, cột: Type · Recipient ·
  Status (badge) · Attempts (`3/5` — `MAX_ATTEMPTS` export từ contract hay
  echo qua response, chọn một và ghi lý do) · Last error (truncate, title
  đầy đủ) · Created · Processed · hành động Retry (chỉ FAILED). Drawer xem
  chi tiết: payload JSON + lastError đầy đủ.
- **Stat card** `admin.stats.outbox`: Sent 28d (`processedAt`, status SENT)
  · Queued now (PENDING, ảnh chụp) · Failed now (FAILED, ảnh chụp, callout đỏ
  khi > 0). *AMEND 02/09 sau review F7:* cả ba là số ĐƠN, không delta — purge
  30 ngày xoá gần hết kỳ 28–56 ngày trước nên "vs kỳ trước" của Sent là số
  bịa; card Failed dùng khe `callout` của StatCard (không mượn `delta`);
  stats outbox KHÔNG cache 60s vì kẻ đổi hàng đợi là worker, không phải
  server action.
- *AMEND 02/09 (review F7):* thêm trạng thái **`SKIPPED`** (migration
  `20260902090000_outbox_status_skipped`) cho row worker cố ý không gửi (người
  nhận newsletter đã huỷ đăng ký) — trước đó bị đánh SENT nên "Sent" nói dối;
  purge dọn SKIPPED cùng lịch SENT. `payload`/`dedupeKey` của email auth
  (PASSWORD_RESET, EMAIL_OTP…) được **redact** ở mapper API: chúng mang token
  reset/mã OTP, admin không được cầm credential của admin khác. Ô tìm khớp
  thêm `payload.code`/`email`/`to` (dedupeKey thật là `<event>:<uuid>`, không
  mang mã `BK-…`).
- `nav.ts`: Outbox enabled, href `/outbox?status=FAILED`.
- Test: int cho list (filter/search/paging + 401/403), retry (FAILED→PENDING
  attempts 0; SENT/PENDING → NOT_FAILED; không tồn tại → NOT_FOUND), stats
  (cửa sổ + guard); unit cho mapper VM + href.

### F8 — Payment events (branch `feat/p4c-payment-events`)

- **Contract** `admin.paymentEvents.list` — input `{ page, limit,
  provider?: PaymentProvider, type?: string (≤100), search?: string (khớp
  `eventId` contains) , unprocessed?: boolean }` → `Paged<PaymentEventRow>`;
  row = id · provider · eventId · type · amount/currency (nullable) ·
  bookingCode (join `booking`, nullable — link sang `/bookings/[code]`) ·
  receivedAt · processedAt. Sắp xếp `receivedAt desc` (index `[provider,
  receivedAt]` có sẵn). `admin.paymentEvents.byId` → row + payload.
  **Read-only** — không endpoint ghi.
- **Trang `/payment-events`**: tab provider (All/STRIPE/PAYPAL) qua
  `StatusFilterTabs` (nó là segmented control — dùng đúng vai), ô tìm
  `eventId`, toggle "Unprocessed only", cột: Provider · Type · Amount ·
  Booking (link) · Received · Processed (hoặc badge "Unprocessed" — `processedAt`
  null = đã nhận chưa xong; ý nghĩa ghi ở tooltip từ i18n). Drawer JSON —
  nâng drawer của F7 lên `components/kit/json-drawer.tsx` (consumer thứ hai).
- **Stat card** `admin.stats.paymentEvents`: Received 28d (delta, neutral) ·
  Unprocessed now (ảnh chụp) · Linked to a booking 28d (đếm `bookingId` not
  null, delta neutral).
- `nav.ts`: Payment events enabled.
- Test: int list/byId/filters/401/403 + stats; unit mapper.
- *AMEND 02/09 (review F8):*
  - Stats thêm **`stuck`** (row chưa xong đã nhận quá
    `PAYMENT_EVENT_STUCK_MINUTES` = 5 phút): card Unprocessed CHỈ kêu đỏ theo
    `stuck`, `unprocessed` giữ nghĩa "khớp bảng" — row vừa tới mà handler
    đang chạy là bình thường. Admin **không cache** stats vùng này (cùng luật
    outbox): kẻ đổi sổ là webhook ngoài `updateTag`, bảng thì đọc tươi.
  - Filter `type` nhận **chuỗi tự do** như contract (cột varchar): `?type=`
    ngoài tuple vẫn lọc; Select thêm một mục tạm cho giá trị đó thay vì
    hiện nhầm "All". `PaymentEventTypeSchema` xuất từ contract.
  - Redact payload **dùng chung** `apps/api/src/lib/redact.ts` cho cả outbox
    và payment events: che theo tên khoá ở mọi độ sâu, tập khoá là hợp của
    hai vùng; object dựng bằng `Object.create(null)`.
  - Drawer: trạng thái tải gắn id (không lộ JSON hàng cũ ở frame đầu), loader
    ném → lỗi GENERIC; lỗi đọc đi qua `createWriteErrorCodec` với
    `transportCopy` (i18n tách `detail.errors` chỉ mã contract /
    `detail.transportErrors`). Kit mới `components/kit/booking-link.tsx`
    (dùng cho cancellations + payment events); VM bỏ `bookingHref`/`unprocessed`.

### F9 — Enquiries + notes (branch `feat/p4c-enquiries`)

- **Migration** `enquiry_status_events` (id uuid, enquiryId FK cascade,
  fromStatus, toStatus, adminId FK SetNull, createdAt; index
  `[enquiryId, createdAt]`, `[toStatus, createdAt]`). File migration MỚI;
  session nghiệm thu deploy Supabase.
- **Contract** `admin.enquiries.list` — `{ page, limit, status?: EnquiryStatus,
  search?: string (name/email contains, insensitive, ≤120), tourId? }` →
  `Paged<EnquiryRow>` (id · name · email · phone · tourTitle/tourSlug
  nullable · travelDate · groupSize · budgetTier · status · createdAt ·
  updatedAt · notesCount). `byId` → row đầy đủ (message, nationality,
  interests) + `notes[]` (authorName, body, createdAt, append order) +
  `statusEvents[]`. `setStatus` `{ id, status }` → transaction: update
  status + insert status event (adminId = session) — cùng trạng thái →
  no-op có chủ đích (không insert event, trả row — nếp F4). Mã lỗi
  `NOT_FOUND`. `addNote` `{ id, body (1..2000) }` → insert note với
  authorId/authorName từ session; `NOT_FOUND`. Chuyển trạng thái **tự do**
  giữa 5 giá trị (không ép luồng — CRM nhỏ, admin biết mình làm gì), nhưng
  confirm dialog nêu rõ from → to.
- **Trang `/enquiries`**: tab 5 trạng thái + All (mặc định `?status=NEW`),
  tìm tên/email, cột: Name (link chi tiết) · Email · Tour · Travel date ·
  Group · Status · Notes (count) · Created. **Trang `/enquiries/[id]`**: thẻ
  thông tin lead, message, đổi trạng thái (Select + confirm), timeline notes
  (append-only, form thêm note dưới cùng, không sửa/xoá), lịch sử trạng thái.
  Server action pattern F2→F5 (safeParse input, codec lỗi, `updateTag`).
- **Stat card** `admin.stats.enquiries`: New 28d (`createdAt`, delta,
  polarity up-good) · Won 28d (đếm status event `toStatus = WON`, delta,
  up-good) · Open now (NEW+CONTACTED+QUOTED, ảnh chụp).
- `nav.ts`: Enquiries enabled, href `/enquiries?status=NEW`.
- Test: int list/byId/setStatus (audit row + no-op) /addNote/401/403 +
  stats (won đếm trên events, không trên `updatedAt`); unit mapper/href/
  consequences copy.
- *AMEND 03/09 (review F9):*
  - `setStatus` trả **`{ id, name, status, changed }`** thay vì cả detail:
    no-op (`changed: false`) phải phân biệt được — toast nói "không có gì
    đổi", log server không ghi chuyển trạng thái; transaction chỉ giữ hai câu
    ghi, không đọc lại detail trong lúc cầm `FOR UPDATE`. `addNote` trả
    **`{ id }`** — không đọc lại ngoài transaction (một `NOT_FOUND` ở bước đọc
    từng biến note đã lưu thành "not saved"). Trang chi tiết `router.refresh()`
    là nguồn sự thật, không `updateTag`.
  - Stats vùng này **không cache** (cùng luật outbox/payment events): form
    "Inquire Now" công khai ghi lead NEW ngoài mọi `updateTag`. Luật chung:
    cache theo tag chỉ khi mọi kẻ ghi bảng là server action của admin.
  - **`won` đếm `DISTINCT enquiry_id`** (lead, không phải lượt bấm) —
    `previous` = 0 trong 56 ngày đầu vì bảng audit mới có từ 03/09.
  - `authorName`/`adminName` qua **`accountDisplayName`** (`trim() ||
    email`): tên rỗng từng lọt DB rồi làm `byId` vỡ `min(1)` vĩnh viễn.
  - `EnquiryRow` bỏ `phone` (PII, chỉ detail) và `tourSlug` (chưa có link);
    hai `select` sống cạnh mapper, kiểu row derive bằng `Prisma.EnquiryGetPayload`.
  - Link chi tiết mang **`?back=`** (đường nội bộ `/enquiries…`, validate
    chống open redirect) để "Back to enquiries" về đúng tab/trang/ô tìm; chip
    tour lọc là chữ cố định (tên tour không suy từ hàng đầu của trang nữa).
  - Dùng chung: `apps/api/src/lib/calendar-date.ts` (bốn bản `slice(0, 10)`
    gộp một), `apps/api/src/lib/like.ts` `escapeLike` cho mọi `contains`
    (Prisma không escape `%`/`_`), kit `components/kit/timeline.tsx` (lịch sử
    huỷ booking + thread note + lịch sử trạng thái), `orphanPageHref` ở
    `table-query` cho sáu trang; caption "Open now" dựng từ
    `OPEN_ENQUIRY_STATUSES`.

### F10 — Subscribers (branch `feat/p4c-subscribers`)

- **Contract** `admin.subscribers.list` — `{ page, limit, active?: boolean
  (true = `unsubscribedAt` null), search?: string (email contains, ≤120),
  source?: string }` → `Paged<SubscriberRow>` (id · email · source ·
  createdAt · unsubscribedAt). `admin.subscribers.unsubscribe` `{ id }` →
  `updateMany` guard `unsubscribedAt: null` → 0 row thì `ALREADY_UNSUBSCRIBED`;
  không tồn tại → `NOT_FOUND`. Không đi qua HMAC (đường khách) — admin đã
  qua guard. Log `[admin] subscriber unsubscribe {adminId, subscriberId}`.
  KHÔNG có resubscribe phía admin (consent phải từ khách).
- **Trang `/subscribers`**: tab Active/Unsubscribed/All (mặc định Active),
  tìm email, lọc `source` (Select từ giá trị distinct — endpoint list trả
  thêm `sources: string[]` hoặc hardcode từ web; chọn và ghi lý do), cột:
  Email · Source · Subscribed at · Unsubscribed at · hành động Unsubscribe
  (chỉ hàng active, confirm). **Export CSV** tập đang lọc: tái dùng
  `lib/csv.ts` + khuôn route `bookings/export` (gác quyền tự thân, 502
  trước 401, trần `EXPORT_MAX_ROWS`, audit log — email là PII).
- **Stat card** `admin.stats.subscribers`: New 28d (`createdAt`, delta,
  up-good) · Unsubscribed 28d (`unsubscribedAt`, delta, up-bad) · Active
  now (ảnh chụp).
- `nav.ts`: Subscribers enabled.
- Test: int list/unsubscribe (guard + đã huỷ)/401/403 + stats; unit CSV
  rows + href + mapper.
- *AMEND 03/09 (review F10):*
  - **Mặc định tab Active ở tầng parse**: `/subscribers` trần = Active; tab
    All phải viết tường minh `?active=all` (bản đầu đặt mặc định ở nav nên
    bookmark trần rơi vào All và Export dựng cả địa chỉ đã rút consent). Nav
    trỏ `/subscribers` literal — không import lib vùng vào chunk client chung.
  - `list` có **`includeSources`** (mặc định bật; export tắt) — cùng khuôn
    `includeMedia`: GROUP BY toàn bảng không chạy 20 lần cho một file không
    có cột nguồn.
  - `fetchAllPages` trả **`changed`** khi `total` trang sau ≠ trang đầu →
    route 409 "xuất lại" thay vì giao file thiếu hàng cũ nhất im lặng.
  - Dùng chung: `lib/export-route.ts` (gác quyền 502→401→403, audit có
    `outcome` cho cả 413/409/502, response CSV) cho ba route export;
    `newsletter/unsubscribe-claim.ts` cho cả đường khách lẫn admin;
    `ExportButton` sang `components/kit`; `ToolbarSelect` có
    `toFreeValue`/`fromFreeValue` để giá trị tự do từ DB không đụng sentinel
    "All" (áp cho cả Select type của payment events).
  - Stats vùng này là **một câu `COUNT(*) FILTER`** cho cả năm con số; mục
    Index của StatsService ghi `subscribers` (bảng không index, ứng viên đầu
    tiên chạm ngưỡng); caption "Active now" nói rõ đếm toàn danh sách.
  - Chấp nhận có ghi chú: card "Unsubscribed 28d" đếm trên trạng thái (không
    bảng audit consent — P4c không thêm migration; JSDoc contract nêu việc
    phải làm khi cần con số bất động).

## 4. Definition of done (mỗi tính năng)

1. `pnpm gate:int` xanh (Docker Postgres `tourism-v2-postgres-1` — nếu
   container ngủ thì `docker start` rồi chờ healthy; web build trong gate
   cần API sống ở :3001 — dựng theo công thức CI trên docker DB, KHÔNG dùng
   `.env.local`).
2. Contract → controller có `@Roles(ADMIN)` → int test 401/403 phủ MỌI
   endpoint mới; TDD trên logic thuần (mapper VM, href, aggregate thuần).
3. Copy English trong `@tourism/i18n` khối `admin.<vùng>` (+ `admin.errors`
   cho mã lỗi mới); tokens-only; comment/JSDoc tiếng Việt.
4. Commit Conventional tiếng Việt có dấu, KHÔNG AI-attribution (kiểm
   `git log` sau commit — trailer hay tự chèn). Migration (F9) là file mới,
   không sửa migration đã apply.
5. Ở lại trên branch — merge, deploy migration lên Supabase, docs sweep là
   việc của session nghiệm thu.
6. Báo cáo cuối phiên: gì đã đổi, endpoint nào, file nào, test bao nhiêu,
   quyết định tự chọn (và lý do), lệnh dev server cho user tự kiểm
   (`cd apps/api && pnpm dev` · `cd apps/admin && pnpm dev`).
