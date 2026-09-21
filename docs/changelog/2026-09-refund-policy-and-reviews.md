# CHANGELOG — lưu trữ: luật hoàn tiền, đánh giá, tài chính và dashboard (04/09–05/09/2026)

Chính sách hoàn tiền thành bậc cưỡng chế một nguồn, duyệt huỷ bốn bước, đánh giá
có trạng thái "đã bác" và đường viết lại cho tác giả, mô hình tài chính cho báo
cáo tháng, dashboard nối số thật.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-09-05 — P4d merge + vòng review 8 mũi cho dashboard (nhánh `feat/p4d-dashboard`, 12 commit `a68b309..bb61aaf` ff vào main, 38 file, KHÔNG migration)

Entry ngay dưới ghi "chưa merge, chờ review ở session riêng" — đợt review ấy
làm ở session gốc theo nếp "review theo tầng" của vòng backend 05/09: 8
mũi finder theo miền (endpoint · contract · card · chart · bảng · ADR/docs ·
altitude · conventions), 3 verifier, `gate:int` chạy trong worktree riêng
`~/projects/tourism-v2-p4d` (API tạm cổng 3011 trên docker DB) để không chạm
cây user đang làm W1. 10 finding bảng + 5 món verifier xác nhận thêm, vá trong
4 commit rồi ff.

### Findings và cách vá (theo tầng)

**Tầng chính sách**

1. **Một khối hỏng kéo sập cả trang `/`** (`779b50f`, ADR-0036 AMEND 2 §1).
   `Promise.all` ba fetch: một endpoint 404 vài phút lúc lệch phiên bản deploy
   (ADR-0024) là cả trang chủ rơi vào `error.tsx` không shell — admin mất
   sidebar, tức mất đường sang các hàng đợi vẫn chạy tốt. Nay
   `Promise.allSettled`, khối rơi vẽ kit mới `SectionError` (i18n
   `admin.dashboard.loadError`) + `console.error`; luật "không nuốt lỗi" của
   `lib/api/stats.ts` vẫn đúng cho trang vùng một-khối.
2. **ADR bị sửa thân trong commit thi công** (`bb61aaf`). Quyết định "một
   trục" được chèn vào giữa §2 như quyết định gốc trong khi CHANGELOG khai
   "ghi thành AMEND" — vi phạm luật ADR đi trước code. Tách ra `AMEND 1 — ghi
   SAU thi công`, và `AMEND 2` liệt kê bảy sửa của vòng này.

**Tầng thiết kế**

3. **`series.period` bị vứt** (`779b50f`, AMEND 2 §2). Chart chỉ nhận
   `points`+`currency`; §2 nói bucket cuối là hôm nay ĐANG CHẠY nhưng UI không
   nói ra — 9h sáng diện tích luôn kết bằng vách đổ đọc thành "doanh thu sụp".
   Nay chart nhận cả `AdminDashboardSeries`: "today so far" khi `period.to`
   rơi vào ngày của point cuối, tab khoá theo `period.days` server trả (consumer
   xin 7 không được bày "Last 3 months"); hàng card nhận `period` như mọi vùng.
4. **Đồng tiền hỏi bằng query thứ hai** (`1ee8a00`, AMEND 2 §3).
   `revenueCurrency` quét lại cùng cửa sổ 90 ngày không index; nay
   `paidByDay` trả `MAX(currency)` theo ngày trong chính `GROUP BY`, nhãn =
   đồng của ngày có tiền gần nhất, 'USD' chỉ khi cửa sổ trống.
5. **Contract không canh `points.length === period.days`** (`1ee8a00`, AMEND 2
   §4). Chuỗi thiếu point từng qua contract rồi bị `sliceSeries` cắt đuôi im
   lặng; spec còn chấp nhận `points: []`. Nay `.refine`, ba literal 7/30/90 dẫn
   từ `DASHBOARD_RANGE_DAYS` (hết ba chỗ gõ tay: contract, admin `ChartRange`,
   spec tautology).

**Tầng code**

6. `indicator="dot"` chết vì kit bỏ qua nó khi có `formatter` — chấm màu vẽ
   trong formatter. 7. `formatChartDate` ném RangeError với ngày lạ,
   `points.slice` ném khi field thiếu (client oRPC KHÔNG validate response) —
   ngả về rỗng; effect mobile ép 7d mỗi lần đổi breakpoint kể cả sau khi người
   dùng đã chọn — chỉ ép khi chưa chạm; `onSelect` kiểm `isDashboardRangeDays`
   thay cast. 8. Ô Code của `/bookings` là bản chép của kit `BookingLink`
   (`454b944`) — kit nhận `href` mang bộ lọc, `toBookingRow(booking, query?)`
   hết dựng `BookingsQuery` giả. 9. Bảng Recent dựng `StatusFilterTabs` một
   mục không icon + `onSelect` rỗng, ô rỗng dùng copy của `/bookings`, spec
   phải stub `matchMedia` chỉ vì control chết — tiêu đề tĩnh, copy riêng, bỏ
   stub. 10. Int spec chụp `todayUtc` ở tầng describe (đỏ khi vắt nửa đêm UTC
   giữa load file và request), fixture PENDING hôm nay ở tương lai và không
   được khẳng định — chụp trong `beforeEach`, khẳng định không lọt bucket.
   Thêm: i18n comment "SẼ CÓ ở P4d" và `viewLabel` mồ côi, JSDoc `stat-card`
   trỏ `section-cards.tsx` đã xoá.

### Còn ghi, chưa chữa

`apps/admin/src/hooks/use-mobile.ts` là bản chép byte-một của hook trong
`@tourism/ui` (chart còn dùng để ép 7d) — dọn khi có vòng kit. Bốn card vẫn
cache 60s theo quyết định F5 (ADR-0036 §2 ghi nhận).

### Nghiệm thu

`gate:int` trọn trong worktree, API tạm :3011 kill sau khi xong: build web
73/73 · admin 16/16 · api; unit contract 247 · api 381 · admin 862 · web 1439 ·
ui 22 · tokens 10 · i18n 2; lint 976 file; **int 27 file / 397 test** — xanh.
Test đổi: contract 1 (từ chối chuỗi ngắn/rỗng/dư), admin dashboard-view 14
(lưới phòng thủ, `rangeOptions`, `endsInRunningBucket`), recent table +1
(tiêu đề tĩnh, không radiogroup). Không migration, Supabase không cần deploy.
Chưa kiểm bằng mắt trên localhost.

## 2026-09-05 — P4d: dashboard `/` nối số THẬT, một endpoint chuỗi theo ngày (nhánh `feat/p4d-dashboard`, 7 commit `a68b309..7b99638`, 34 file, KHÔNG migration — **chưa merge, chờ review ở session riêng**)

Trang `/` từ 20/08 là block `dashboard-01` tái hiện 1:1 rồi gọt sạch số demo
(21/08): bốn card `—`, biểu đồ mảng rỗng, bảng xương TanStack ăn `data.json`.
Đợt này CHỈ đổ dữ liệu vào ba khối, giữ nguyên dáng đã chốt — và chỉ thêm
đúng một thứ còn thiếu: nguồn cho biểu đồ. Quyết định đi trước code ở
[ADR-0036](../adr/0036-dashboard-daily-series.md). Mỗi khối một commit theo thứ
tự ADR → contract + API → card → chart → bảng → dọn demo → docs.

### Ba khối

1. **Bốn card** (`58581d5`) = `admin.stats.bookings()` KHÔNG tham số (cửa sổ
   trượt 28 ngày — đúng cách gọi ADR-0028 §1 đã hẹn) qua kit `StatCardRow` +
   `toBookingsStatCards` của `/bookings`. Xoá `section-cards.tsx`: kit
   `StatCard` vốn bê nguyên kiểu dáng của nó, giữ hai bản là giữ một bản sẽ
   trôi. Bốn nhãn cũ (`Reviews to moderate`, `New enquiries`) bỏ — muốn hàng
   đợi review/enquiry là gọi thêm hai endpoint chỉ để lấy hai ảnh chụp; hàng
   card `/bookings` là một bộ tự kiểm chéo (`revenue / paidBookings`, mẫu số
   của `cancellationRate`).
2. **Biểu đồ** (`4efffc9` API, `27cccc5` admin) = endpoint mới DUY NHẤT
   `admin.stats.dashboard?days=7|30|90` → một point mỗi ngày lịch UTC
   `{date, revenue, bookings}`, cả hai neo `paid_at` (gross) — là `revenue`/
   `paidBookings` của card chia nhỏ theo ngày; int spec đối chứng tổng 30
   point bằng `bookings?from&to` cùng khoảng. Cửa sổ `days` ngày TÍNH CẢ hôm
   nay (bucket đang chạy), biên nửa-mở, `date_trunc('day', paid_at)` raw SQL
   với `Prisma.sql`, ngày trống điền 0 ở tầng thuần `fillDaySeries` (9 spec).
   Trang fetch 90 một lần, bộ chọn 7/30 cắt đuôi ở client (`dashboard-view.ts`,
   8 spec) — giữ cả "admin không fetch từ browser" lẫn bộ chọn đổi tức thì.
   **KHÔNG cache** (luật F7–F10): kẻ ghi `paid_at` là webhook
   (`claimSeatsForPaid`), ngoài mọi `updateTag`. Theo skill dataviz, **MỘT
   trục**: doanh thu là diện tích (token `--chart-1`), số đơn đã trả ở dòng phụ
   tooltip — ghi thành AMEND trong ADR, endpoint vẫn trả cả hai số cho P5.
3. **Bảng Recent bookings** (`8223a75`) = `admin.bookings.list` limit 10,
   không lọc trạng thái/ngày, `includeMedia: false`, lắp vào
   `DataTableFrame`/`DataTableBody` + `serverTableFeatures`; cột Code qua
   `BookingLink` (href trần), thêm cột Created (`BookingRowVM.createdAt`),
   footer là link "View all bookings" thay `TablePagination`. Năm ô thân +
   nhãn/icon menu Columns tách ra `booking-cells.tsx` dùng CHUNG với
   `/bookings` — không có bản chép nào để thành "fork rút gọn" (nếp 31/08).

### Dọn demo (`9d32541`)

Xoá `data-table.tsx` (798 dòng) + `data.json`, gỡ bốn gói `@dnd-kit/*` khỏi
`apps/admin` (chỉ file ấy dùng; `@tourism/ui` vẫn giữ cho sortable của web),
bỏ copy `Awaiting live data`. JSDoc kit (`data-table-frame`/`table-pagination`/
`data-table-body`) từng trỏ "bê nguyên từ `data-table.tsx`" nay là nguồn duy nhất.

### Hai chỗ lộ ra lúc thi công, đã ghi ở JSDoc

- `z.literal([7, 30, 90])` (đa giá trị của Zod 4) làm `contract.spec` đỏ ngay
  lúc import — đường duyệt schema của oRPC đọc `.value`. Và
  `ZodSmartCoercionPlugin` KHÔNG ép chuỗi cho union của primitive (nhánh
  `union` chỉ so `propValues` của object) — `?days=7` trả 400 dù có mặc định.
  Chốt: `z.int().pipe(z.union([literal…]))` ở input; int spec khoá coercion
  qua URL thật.
- Bốn card trên `/` vẫn cache 60s theo `ADMIN_STATS_TAG` (quyết định vòng vá
  F5 cho `admin.stats.bookings`) trong khi chart và bảng đọc tươi — ADR-0036
  §2 ghi nhận, không sửa: hai khối không hứa khớp nhau (28 ngày trượt so với
  N ngày lịch) và sửa cache card là sửa hành vi `/bookings`.

### Nghiệm thu

`pnpm gate:int` trọn với API tạm trên docker DB theo công thức CI (kill sau
khi xong): build · typecheck · unit (contract 247 · api 381 · admin 858 · web
1439 · ui 22 · tokens 10 · i18n 2) · lint · **int 27 file / 397 test** — xanh.
Test mới: contract 6, api unit 9, int 7 (guard phủ cả tám path, biên ngày
UTC nửa-mở, coercion `?days=`, 400 cho độ dài lạ, đối chứng tổng = card, kỳ
rỗng), admin 12. Chưa kiểm bằng mắt trên localhost.

## 2026-09-05 — Vòng review 8 mũi cho cả nhánh backend, vá theo tầng (nhánh `fix/p4c-backend-logic`, 10 commit `6542fd5..f3dd78e`, ~90 file, KHÔNG migration mới)

Session gốc review TOÀN BỘ nhánh (76 commit, 8 ADR, 210 file) trước khi merge,
theo yêu cầu của user: không chỉ soi dòng code mà tách bạch **tầng chính
sách** (trái CLAUDE.md/ADR không?), **tầng thiết kế** (hướng xử lý có lỗ
hổng lý thuyết không?) và **tầng code**. Tám mũi finder chia theo miền (stats
theo bộ lọc · huỷ + hoàn tiền bậc · review bác/sửa · mô hình tài chính · Excel
· vòng đời media · kit admin + web · quy ước + docs + độ sâu) trả ~64 ứng
viên; năm verifier xác nhận, gộp trùng còn 10 mục bảng và ~35 mục phụ. User
duyệt vá tất cả theo thứ tự bảng → tầng 1 → tầng 2 → tầng 3, mỗi cụm một commit.

### Mười mục bảng, và vì sao chúng đứng đầu

1. **Seed giá vốn nhân đôi mỗi lượt chạy** (`6542fd5`). `tour_cost_items` là
   fixture catalog DUY NHẤT không có id tĩnh, bảng không có `@@unique` nào,
   nên `createMany({ skipDuplicates })` không có gì để bỏ qua — trên DB dùng
   chung dev/prod, `db:seed` lần hai là 130 dòng mới và booking snapshot giá
   vốn gấp đôi. Nay id uuid v5 từ `tourId` + `sortOrder`; bước 8 chỉ điền
   `costPrice`/`fixedCostAmount` còn null (là snapshot, ADR-0033 §3). Kiểm trên
   docker: seed hai lần cùng số dòng.
2. **`ReviewsService.update()` không khoá row** (`7255a46`). Đọc `existing`
   ngoài transaction rồi ghi không `FOR UPDATE`, trái hẳn khối "Ba điểm
   concurrency" của `moderate()` ngay dưới: admin approve chen giữa là nội
   dung mới đè lên review đang trên site, rating tour thừa một, cache web
   không bust. Nay khoá và kiểm lại `canAuthorEdit` trong tx.
3. **Bộ dọn ảnh xoá row còn dùng** (`bd3f6f3`, ADR-0035 AMEND 2). `sweep` xoá
   hẳn row `media_garbage` khi asset còn tham chiếu — làm AMEND 1b ("avatar cũ
   đã nằm sẵn trong hàng dọn, tuần sau tự tới lượt") tự mâu thuẫn: lượt quét
   đầu thấy avatar đang dùng là mất dấu vĩnh viễn. Nay HOÃN (đặt lại
   `created_at`); thêm `requeue` đặt lại đồng hồ lúc thật sự gỡ tham chiếu
   (cửa sổ 7 ngày §2 hứa từng là `7 − tuổi ảnh`).
4. **Range picker nối dài khoảng cũ** (`983d0f7`). Nháp gieo từ URL là khoảng
   đủ hai đầu, và `addToRange` của react-day-picker khi ấy SỬA ĐUÔI thay vì mở
   khoảng mới — bấm 10 rồi 20 trên 01–30 ra 01–20, thao tác thu hẹp phổ biến
   nhất trên màn hình mặc định. Hai test guard cũ đi qua nhánh may mắn (chọn
   lại đúng khoảng) nên không bắt được.
5. **Sổ settle mà gửi số ≠ 0 vẫn 200** (`aa89d84`). `noMoneyToMove` ép
   `amount = 0` bất kể client gửi gì — admin tin 50$ vừa đi trong khi sổ không
   dòng nào. Nay `NOTHING_LEFT` (422).
6. **Mail bác lần hai bị dedupe nuốt** (`7255a46`). `dedupeKey:
   review-rejected:<id>` không có số lần, nên lần bác chung cuộc (ADR-0032)
   không có thư. Nay `:<rejectionNo>`.
7. **`moderationNote` rò ra tác giả** (`7255a46`). `toMyReview` trả note của
   MỌI quyết định, kể cả ghi chú Unpublish mà i18n admin hứa "the author never
   sees it" — nằm trong response `mine`/`byCode` và RSC payload trang booking.
   Nay chỉ kéo event `toRejected` và chỉ trả khi `rejected`.
8. **Khối P&L của kỳ đã đóng đổi số** (`51c11d2`, ADR-0033 AMEND 1 + Giới hạn
   #5). Vế chuyến huỷ đã vá: khách còn PAID trên chuyến bị huỷ từng góp 500
   doanh thu + 0 tiền xe (càng huỷ nhiều chuyến báo cáo càng đẹp) — nay JOIN
   `tour_departures` cùng vế `status <> CANCELLED` với `fixedCostSlice`. Vế
   "refund tháng 7 viết lại tháng 5" **cố ý chưa chữa**: cần cột snapshot theo
   kỳ, ghi nợ ADR + JSDoc ⚠️.
9. **Màn hình mặc định `/bookings` bịa cú sụt** (`605929d`, ADR-0028 AMEND 3).
   Độn trọn tháng hiện tại rồi so 5 ngày đã trôi với 30 ngày trọn của kỳ trước
   → pill "↓ ~83%" gần cả tháng, dòng Showing khẳng định một kỳ chưa xảy ra.
   Nay `currentTo = min(to, now)`, kỳ trước dài bằng phần đã trôi; `from`
   tương lai → kỳ rỗng thay vì span âm; `StatsPeriod.picked` tường minh thay
   cho dấu hiệu `currentTo !== generatedAt` (sai ở nhánh chỉ-from).
10. **Route Excel thiếu `maxDuration`, Detail trống im lặng** (`51c11d2`,
    ADR-0034 AMEND 2). Route export duy nhất không khai trần 60s dù chạy đúng
    vòng gom 45s; sheet Detail trống khi vượt `EXPORT_MAX_ROWS` mà file không
    nói lý do. Nay có trần, một dòng lý do in trong sheet, autofilter phủ tới
    hàng cuối (`ref` chỉ `A1:G1` — LibreOffice/Sheets lọc trên một hàng),
    `columnCount` đọc một lần thay vì O(n²).

### Tầng chính sách — ADR chốt guard ở client, server phải theo

ADR-0029 §4 và ADR-0030 §5 đặt "vượt bậc phải ghi lý do" ở prop `noteRequired`
của dialog; `apps/api` không import gì từ `refund-policy.ts`. Mọi caller cầm
JWT admin approve được số bất kỳ ≤ phần dư mà không dấu vết. Nay server tính
lại bậc từ dữ liệu tươi trong lock và đòi `decisionNote` khi số khác mức chính
sách (`OFF_POLICY_NOTE_REQUIRED`) — **không khoá số**, chỉ đòi đúng thứ §5
hứa (ADR-0030 §5b). Cùng hình dạng: W3 `Issue refund` chỉ ẩn ở client, server
nay chặn khi có request mở (`CANCELLATION_OPEN`, ADR-0029 AMEND 4) — W3 hoàn đủ
rồi Deny từng làm ghế rò vĩnh viễn. Reject review không lý do cũng qua được
API → `superRefine` ở contract (ADR-0031 §7).

Số học tiền (`toCents`/`percentOfAmount`/`policyRefundAmount`) dời lên
`@tourism/contract`: web nhân float rồi `toFixed`, admin làm tròn cent — 50%
của 1199.01 là 599.50 ở dialog khách và 599.51 ở màn admin; "một điểm vào duy
nhất" §3b chỉ mới đúng cho phần trăm. Ân hạn 24 giờ gõ tay ở 5 câu nay sinh từ
`REFUND_GRACE_HOURS`; văn bản nói rõ ngày lịch đo theo UTC.

Dependency: `exceljs@4.4.0` kéo `uuid@8.3.2` dính GHSA-w5hq-g745-h8pq — advisory
duy nhất trong cây, workflow audit thứ Hai sẽ đỏ. Ghim cứng exceljs, override
`uuid@<11.1.1` (chỉ exceljs kéo uuid); `pnpm audit` sạch. `BRAND_SOFT` trong
xlsx là hex duy nhất không có token gốc → thành hằng dẫn xuất có công thức.
Hai AMEND ghi sau thi công (0034, 0035) đổi heading cho đúng thứ tự.

### Tầng thiết kế — những chỗ còn lại đã vá

Media: `not found` đếm riêng khỏi `ok` (lượt chạy đầu trên prod phân biệt được
"xoá thật" với "publicId sai dạng"), `env.ts` từ chối `MEDIA_GC_ENABLED` ngoài
production, publicId client có regex ở contract (nay là đối số của một lệnh
destroy), queue pg-boss khai `retryLimit: 0`, `markFailed` dùng `increment`;
ADR thôi hứa "co lại đáng kể lần đầu" — không có backfill (Giới hạn #6). Tài
chính: nhãn tiền có nguồn thứ ba từ tập P&L (tháng không payment mà có chuyến
chạy từng in `$` lên EUR), `departuresCostMissing` đếm chuyến thiếu tiền xe
thay vì COALESCE về 0 (hôm nay chỉ seed ghi cột ấy). Kit: Back từ
`BookingLink` về `?dates=all` (regression so với main), nút Clear trên
`/bookings` đổi nhãn "Show bookings from all dates" khi chỉ còn tháng mặc định
(kit JSDoc từng khẳng định nút tự ẩn — sai), `/reviews` có dòng Showing như
hai vùng kia, `rejectionCount` lên dialog admin (ADR-0032 §8 chưa thi công).

### Tầng code — vụn nhưng thật

Tiebreak `id desc` cho `moderationEvents`; tab Rejected thêm `isApproved:
false` để khớp prefix index; `OVER_TOTAL` vào nhóm trạng-thái-cũ (ở chế độ
chính sách con số bị khoá, admin từng kẹt gửi lại số cũ); stepper đo
`nothingLeft` bằng con số sắp gửi và nói "no money moves" ở ca 0đ;
`daysBeforeDeparture` ném với ngày hỏng thay vì 0% im lặng; wizard kẹp
`activeIndex` và panel có `aria-labelledby`; xoá `formatDateLabel`/
`parseTypedDate` chết cùng ô gõ tay; "hai consumer" → ba ở contract/controller;
`indent`/`emphasis` của bảng P&L lên VM có test.

### Cố ý KHÔNG chữa, đã ghi nợ

Khối P&L kỳ đã đóng đổi số khi hoàn tiền sau (ADR-0033 Giới hạn #5);
`pendingReviewsAt` đọc `rejected_at` hiện tại nên tác giả sửa review làm kỳ đã
đóng đổi số (ADR-0028 AMEND 3); ràng buộc dời lịch chuyến cho phase `/tours`
(ADR-0033 AMEND 1); backfill ảnh mồ côi trước ngày deploy.

### Nghiệm thu

`pnpm gate:int` trọn ở session gốc với API tạm trên docker DB theo công thức
CI: build web/admin/api · typecheck · unit (contract 241 · admin 846 · web 1439
· api 372 · ui 22 · tokens 10 · i18n 2) · lint 973 file · **int 27 file / 390
test** — xanh. Test mới: contract 9, admin 6, web 1, api unit 4, int 11. Hai
commit test hygiene: fixture `StatsPeriod` mang `picked`; `bookings.int.spec`
dọn `media_assets` của chính nó (một lần chạy dở lúc Postgres đang khởi động
để lại row và mọi lần sau đụng unique ở `beforeAll`). Supabase đã có đủ 19
migration từ session thi công — không deploy thêm; **chưa** `db:seed` giá vốn
lên Supabase, đó là bước mở khoá riêng user quyết.

## 2026-09-05 — Mô hình tài chính, xuất Excel, và ba vòng phụ (nhánh `fix/p4c-backend-logic`, 24 commit `231a4c7..74b51c0`, 86 file, 2 migration)

Đợt dài nhất từ đầu P4. Mở ra từ góp ý của giảng viên — *báo cáo nên xuất Excel
thay vì CSV* — nhưng mở file ra thì vấn đề nằm sâu hơn một tầng: **không có con
số nào để mà xuất cho đẹp.**

### Bốn sự thật đo được ở vòng rà, không phải đọc lướt

`Tour.costPrice` nằm trong schema từ migration `init` với comment "margin
analytics" và **không một dòng code nào đọc hay ghi nó**. `grep -in "tax|vat"`
toàn `schema.prisma` trả về đúng hai kết quả, cả hai là chữ *taxonomy* trong
comment bảng tag blog. `refundedTotal` cố ý KHÔNG trừ vào `revenue`. Và
`revenue` neo `paid_at` — tức **tiền vào, không phải doanh thu**: ngành tour
ghi nhận khi chuyến CHẠY, nên hệ đang gọi tiền đặt cọc của một chuyến tháng 12
là doanh thu tháng 9.

Bốn thứ cộng lại: bốn stat card của `/reports` không card nào nói được lãi lỗ,
và không thể có chừng nào chưa có giá vốn.

### Mô hình tài chính — [ADR-0033](../adr/0033-financial-model.md)

Chốt **THÊM một cách đọc, không đổi cách đọc cũ**: cột "Dòng tiền" (neo
`paid_at`) đứng cạnh cột "Kết quả kinh doanh" (neo `departure_end_date`, cùng
mốc mà `reviewSlot()` bên web đã dùng). Đổi nghĩa `revenue` là đổi ý nghĩa một
pill delta đang hiển thị trên ba trang.

Giá vốn khai ở bảng mới `tour_cost_items` với cờ `PER_PERSON`/`PER_DEPARTURE`.
Chính cờ ấy mới diễn đạt được luật huỷ: **chi phí cố định ở lại (xe vẫn chạy),
chi phí biến đổi đi theo khách**. Một cột giá vốn gộp không nói được điều đó.
Đóng băng vào giao dịch (`bookings.cost_per_person`,
`tour_departures.fixed_cost_amount`) vì join sống thì sửa giá thuê xe hôm nay
sẽ VIẾT LẠI lợi nhuận của báo cáo tháng trước — cùng lý do bảng `bookings` đang
snapshot `unit_price`. Cả hai nullable, và null KHÁC 0: báo cáo đếm số booking
thiếu dữ liệu rồi nói ra, còn `0.00` tự nhận là "tour không tốn gì" và biến một
lỗ hổng dữ liệu thành lợi nhuận.

Thuế tính **trên MARGIN** kiểu Tour Operators' Margin Scheme: giá bán đã gồm
thuế nên phải bóc bằng `rate/(1+rate)`, không nhân thẳng; margin âm thì không
có thuế — luật của scheme, không phải làm tròn, và bỏ vế ấy là sinh ra thuế ÂM
cộng vào lợi nhuận của tháng lỗ.

### Xuất Excel — [ADR-0034](../adr/0034-excel-report-export.md)

**Đảo** quyết định 0-dependency chốt 31/08. Lý do thật không phải cái đuôi
file: ô CSV chỉ mang được văn bản, nên `reportCsvRows` phải hy sinh cách trình
bày để cứu tính toán — JSDoc của chính nó thú nhận điều đó. Với ExcelJS thì số
là `number` kèm `numFmt`: file vừa đọc như tiền vừa SUM được. Năm sheet, và
sheet *Detail* có autofilter — thứ biến báo cáo thành kiểm chéo được thay vì
phải tin.

Ranh giới chốt: **báo cáo thì Excel, dữ liệu thì CSV** — `/bookings` và
`/subscribers` không đụng tới.

### Vòng đời media — [ADR-0035](../adr/0035-media-lifecycle.md)

Rà ra hệ có **bốn đường tạo ảnh và không đường nào xoá**; bảng `media_garbage`
đã được thiết kế sẵn làm hàng đợi xoá có retry từ migration `init` và chưa dòng
code nào chạm vào — y hệt `costPrice`. Đây là lỗ NỘI DUNG chứ không phải hoá
đơn lưu trữ: ảnh của review bị bác vẫn mở được bằng URL với bất kỳ ai có link.

Xoá đi qua hàng đợi **độ trễ 7 ngày** (destroy của Cloudinary không hoàn tác
được), và **chỉ xoá khi không còn tham chiếu, kiểm lúc XOÁ chứ không lúc xếp
hàng** — `@@unique([ownerType, ownerId, publicId])` là per-owner CỐ Ý nên một
publicId gắn được nhiều owner. Ký upload là *đăng ký theo dõi*: upload bỏ dở là
nguồn mồ côi lớn nhất và là nguồn duy nhất DB không bao giờ có row để biết.
Mặc định TẮT bằng cờ env vì dev/prod dùng chung một Cloudinary cloud.

### Vòng chỉnh thanh lọc admin

User chốt qua [bản demo](../design/mockups/admin-toolbar-sizing.src.html): hàng
điều khiển hạ 44px → **36px** (hạ CẢ dải tab, và giữ đệm `p-1` rồi hạ viên pill
xuống `h-7` — bóp đệm cũng ra 36px nhưng pill khi ấy chiếm 89% khung thay vì
82%, tức trông đặc hơn chứ không nhỏ đi); **một nút Clear** đỏ nhạt cho cả hàng
thay bảy nút rời; bộ lọc ngày thành **range picker một nút** lịch hai tháng.
Cộng trả nợ `/reviews`: hai ô lọc `source` và `rating` mà server đã lọc thật từ
F4 nhưng chưa có ô nào để bấm.

### Bốn thứ THI CÔNG mới lộ ra, ADR đã sai và phải sửa

1. **Avatar không có row `media_assets` nào** — `setAvatar` chỉ ghi một URL vào
   `User.image`. Phép kiểm tham chiếu chỉ hỏi `media_assets` sẽ destroy đúng
   avatar khách đang dùng, bảy ngày sau khi họ đổi nó. Vá ở ADR-0035 §AMEND 1.
2. **`dueBefore` với `graceDays` âm trả mốc ở TƯƠNG LAI** — mọi row đều quá hạn
   kể cả row vừa ghi. Một dấu trừ xoá sạch lưới an toàn 7 ngày. Test bắt.
3. **Sửa migration đã apply là drift** — plan tự viết bước ấy và người thi công
   dẫm phải; Prisma đòi `migrate reset`. CHECK chuyển sang migration riêng, và
   plan được sửa lại để không dạy ngược luật CLAUDE.md.
4. **`WorkerModule` import `MediaModule` làm worker chết lúc bootstrap** —
   module kia khai controller mang `ThrottlerGuard` mà worker không có tầng
   HTTP. Ba int spec worker đỏ ngay lượt đầu; tách `MediaGarbageModule` không
   controller.

### Hai lỗ dữ liệu có từ trước, phát hiện lúc viết test

**Catalogue chỉ có 29 tour, không phải 30** — Bắc 12 + Trung 9 + Nam 8, trong
khi roster spec cấp cho miền Nam dải #22–30 và mọi doc đều nói "30 tour".
**ADR-0007 là trích dẫn treo** — `schema.prisma` trỏ tới nó ở ba chỗ cho outbox
mà `docs/adr/` nhảy thẳng 0006 → 0008.

### Sự cố: `/reports` trả 500 sau Task 6

`migrate dev` chỉ áp docker local; Supabase không nhận gì, nên hai câu raw SQL
mới đọc `b.cost_per_person` trên một DB không có cột ấy. **Lần thứ hai dính
đúng cơ chế này** (12/08 là enum `REVIEW`). Nguy hiểm hơn lần đầu vì `pnpm gate`
VẪN XANH: unit chạy trên mock, int chạy trên `tourism_test` của docker đã
migrate — không gì trong bộ test bắt được sự lệch giữa docker local và Supabase.
Đã `migrate deploy` (user duyệt) và nghiệm thu bằng `information_schema` chứ
không tin dòng "successfully applied".

### Vòng chỉnh trình bày file Excel

User mở bản xuất đầu và chốt: đúng số nhưng **trông như dữ liệu dán vào bảng
tính** — mới có đậm nhạt, một nét kẻ và định dạng số. Dựng lại phần trình bày:
dải tiêu đề nền thương hiệu chữ trắng, hai khối tiền trong *Summary* có dải
riêng (chúng KHÔNG cộng vào nhau được nên phải thấy ngay là hai khối), viền bốn
cạnh mọi ô dữ liệu, dải xen kẽ, nhãn canh trái · số canh phải, dòng tổng có
viền trên đậm, dòng thành phần thụt lề. Số âm đổi sang `[Red]` — ngoặc là cách
kế toán viết số âm, đỏ để mắt bắt được tháng lỗ mà không phải đọc từng ô.

Bảng màu quy đổi từ CHÍNH token dự án (`oklch` → ARGB hex), mỗi hằng ghi kèm
`oklch` gốc. **Ngoại lệ có chủ đích** với luật tokens-only, cùng họ với khối
`@media print`: một file `.xlsx` không có CSS custom property nào để tham
chiếu. Nghiệm thu bằng một file mẫu dựng từ chính code ấy, user mở rồi chốt —
không commit file mẫu vào repo vì nó tái tạo được từ code, và bảy test mới đã
khoá phần trình bày lại.

**Review findings:** hook pre-commit chặn một lỗi thật trong spec Excel
(`valueOf` che global) cộng chín `!` — thay bằng một helper ném lỗi có kèm danh
sách sheet đang có. Dọn kèm 24 khoá copy chết, `date-picker-field.tsx` mồ côi,
và `reportCsvRows` cùng bộ máy chỉ nó cần.

Rà cuối phiên còn tìm thêm **hai chỗ ADR-0034 nay nói sai** (đã AMEND): sheet
*Detail* là booking TẠO trong tháng chứ không phải tập của khối P&L — hai tập
khác nhau nên tên sheet phải nói thẳng, và lời hứa "chỉ ra booking NÀO thiếu
giá vốn" bị gỡ vì cột ấy không có trong `BookingSchema` và thêm vào chỉ để phục
vụ một sheet là nới một base schema dùng rộng (đường dẫn tới OOM đã đo được);
§4 thì thiếu hẳn phần MÀU, tức thiếu một nửa yêu cầu gốc của giảng viên.

**Tests after:** 2.923 unit (10 tokens · 232 contract · 22 ui · 2 i18n · 370 api
· 849 admin · 1.438 web) và 382 integration. `build` chưa chạy được vì dev
server của user đang giữ `.next` — ghi nợ, phải xanh trước khi merge.

## 2026-09-05 — Review có trạng thái "đã bác", và tác giả có đường viết lại (nhánh `fix/p4c-backend-logic`, 7 commit `fbf0e09..d810a66`, ~40 file, 2 migration)

Bước 2 và 3 của kế hoạch ba bước, cộng một mục vá chen giữa. Cả đợt sinh ra từ
một câu hỏi của user khi nghiệm thu bước 1: *"reject xong thì khách làm gì?"*

### Bước 2 — bác bỏ là một phán quyết, không phải một cái cờ

Model chỉ có `isApproved: boolean`, nên card `Pending` (vừa dựng hôm trước)
**đếm gộp** "chưa ai xem" với "đã xem và đã bác" — hàng đợi không bao giờ dọn
sạch được. Tệ hơn, gỡ duyệt đưa review NGƯỢC về hàng đợi (đo ở int test cũ),
tức nó tự bơm chính mình.

Chốt **HAI TRỤC** ([ADR-0031](../adr/0031-review-rejection.md)): `is_approved` giữ
nguyên nghĩa "có đang trên site không", cột `rejected_at` mới trả lời "đã có
phán quyết chung cuộc chưa". Ba trạng thái suy từ hai cột, bất biến "không thể
vừa đăng vừa bị bác" do CHECK `reviews_verdict_shape` canh — có int test dựng
thẳng trạng thái ấy để chứng minh DB chặn, không phải code nhớ.

Loại phương án enum `ReviewStatus` dù sạch hơn: `is_approved` nằm trên đường
đọc CÔNG KHAI của site đang chạy (`listByTour` ba chỗ, recompute rating, bản
chép tay ở seed, ba index, 23 điểm đọc).

`moderate` thành ba động từ — `approve` (xoá `rejected_at`, phán quyết đảo
được) · `reject` (rời hàng đợi, gửi mail) · `unpublish` (gỡ xuống, Ở LẠI hàng
đợi). Guard no-op nay so CẢ HAI trục: trước đó `unpublish` lên một review đang
bị bác trông như no-op vì cùng `is_approved = false`, và review kẹt vĩnh viễn
ngoài hàng đợi.

`ReviewModerationEvent.note` — 500 ký tự, ghi mỗi lần moderate từ ngày đầu,
**chưa ai từng đọc** — nay là lý do bác: hiện ở dialog chi tiết và đi vào mail
`REVIEW_REJECTED` mới. Lý do là BẮT BUỘC (§7), gác ở kit `ConfirmWriteDialog`
(`noteRequired`) chứ không ở từng vùng.

### Vá lúc nghiệm thu: cột Moderation đọc thành "đã duyệt"

User bác một review xong thấy cột Moderation hiện pill xanh "Approve" trong khi
cột State nói Rejected. Không sai dữ liệu — đó là NÚT. Nhưng bốn thứ cộng lại
làm nó đọc thành nhãn: cột tên "Moderation" (danh từ), nút đặt TRƯỚC dấu vết,
tông approve trông y hệt badge `Approved` cột bên, và hàng đã bác chỉ có MỘT
nút trong khi hàng khác có hai — một cặp đọc ra là lựa chọn, một pill xanh
đứng một mình đọc ra là cái nhãn.

Sửa: dấu vết lên trước nút; hàng đã bác có hai nút **Approve · Reopen**; và
`Reopen` tách khỏi `Unpublish` vì cùng động từ nhìn từ chỗ khác thì phải khác
tên — từ một review đã bác, "Unpublish" nói sai, nó vốn đã không ở trên site.
Giao diện giữ `ModerateActionKind` (bốn việc bấm được) tách khỏi
`ReviewVerdict` (ba động từ contract nhận).

### Vá chen giữa: review bị bác thôi kéo tụt điểm trung bình

User hỏi review bị bác giữ mãi thì sao. Rà ra: **spam không tràn được** —
`checkReviewEligibility` đòi chủ booking + PAID + chuyến ĐÃ kết thúc, cộng
`bookingId @unique`, nên muốn viết một review spam thì phải mua và đi trọn một
tour.

Nhưng `averageRating` tính `AVG(rating)` trên MỌI review gửi trong kỳ, không
lọc trạng thái. Một review 1 sao spam ĐÃ BỊ BÁC vẫn kéo tụt card của admin dù
không ai đăng nó lên. Nay bỏ review bị bác khỏi phép trung bình, `submitted`
giữ nguyên — hai card chính thức tách tập, và ranh giới là: `submitted` đo
KHỐI LƯỢNG VIỆC, `averageRating` đo Ý KIẾN. KHÔNG suy ra "vậy lọc luôn theo
trạng thái duyệt": review đang CHỜ vẫn là ý kiến thật, chỉ chưa ai kịp đọc.

Phép suy trạng thái + ba mệnh đề `where` chuyển sang
`modules/reviews/review-state.ts` — `stats.service` nay cũng cần luật ấy.

### Bước 3 — đường quay lại cho tác giả

[ADR-0032](../adr/0032-review-author-edit.md). Ngoài chuyện "không có route sửa",
rà ra một lỗ nữa: **trang khách đang nói sai**. `reviewSlot()` chỉ đọc
`booking.reviewedAt` — một mốc thời gian không mang phán quyết — nên khách bị
bác quay lại đúng trang họ từng viết và đọc thấy *"bạn đã đánh giá chuyến này
rồi"* kèm một lời **cảm ơn**. Email nói thật, sản phẩm thì im.

`PATCH /api/reviews/{id}` cho tác giả viết lại; review quay về hàng đợi. Sửa
được ở `pending` + `rejected`, KHÔNG ở `approved` — sửa nội dung đang hiển thị
công khai là mở lớp rủi ro tráo-nội-dung sau lưng kiểm duyệt. Thay TRỌN nội
dung KÈM ẢNH: bác vì một tấm ảnh mà tác giả không gỡ được thì đường quay lại
là đồ giả.

**Trần: hai lần bác là hết đường**, đếm trên audit trail sẵn có. Luật "còn sửa
được không" là hàm THUẦN ở contract (`canAuthorEdit`), API dùng làm cổng còn
web dùng để quyết hiện form — bài học đã trả giá ở chính `reviewSlot`, nơi
JSDoc phải tự dặn *"web nói khác API thì khách gõ hết bài rồi mới bị từ chối"*.

`moderated_at` GIỮ sau khi sửa (lần quyết định ấy ĐÃ xảy ra), và KHÔNG ghi
`ReviewModerationEvent` — sổ ấy ghi hành vi người DUYỆT, nhét cú sửa của tác
giả vào là làm hỏng nghĩa cả sổ, kể cả phép đếm dựng nên chính cái trần.

### Một thiết kế phải sửa vì đo được

Bản đầu nhét `review` thẳng vào `BookingSchema`, và worker chạy
`contract.spec.ts` **hết bộ nhớ** (~24 giây, không stack JS).
`ContractInputs`/`ContractOutputs` suy kiểu cho TOÀN BỘ router, mà
`BookingSchema` có mặt ở khoảng mười route — mỗi route bỗng gánh thêm một
review lồng mảng media. Chứng minh bằng `git stash`: bỏ ra thì 35 test của file
ấy xanh lại.

Nay `review` sống ở `BookingDetailSchema` dùng cho ĐÚNG `bookings.byCode`. Luật
rút ra: **đừng thêm một schema LỒNG vào một schema NỀN dùng chung nhiều
route** — mở rộng ở route cần nó.

### Migration

Hai file, CHỈ THÊM: `rejected_at` / `rejected_by` / `to_rejected` (có default),
một index hàng đợi, hai CHECK, và một giá trị enum `REVIEW_REJECTED`. Cả hai
CHECK đúng sẵn với mọi dòng đang có vì `rejected_at` vừa sinh ra và toàn NULL.
Đã `migrate deploy` lên Supabase 05/09; không dòng dữ liệu nào bị đụng.

### Sổ nợ mở

- **Luồng khách chưa nghiệm thu bằng mắt.** Dữ liệu seed hiện không có tài
  khoản nào sở hữu chuyến đã kết thúc, mà đó là điều kiện để viết review
  (`checkReviewEligibility`). Luồng ĐƯỢC phủ bởi 8 int test trên Postgres thật
  (bác → sửa → về hàng đợi, trần hai lần, 404 review người khác, 409 đã duyệt,
  gỡ sạch ảnh, `byCode` trả trạng thái + lý do) — cái thiếu là một lượt nhìn.
  User đã có kế hoạch seed lại với phân bố đều; khi làm, nhớ chừa ít nhất một
  booking PAID có `departure_end_date` trong quá khứ cho MỖI trạng thái review.
- **Không có trang "Đánh giá của tôi".** `reviews.mine` có endpoint và int test
  nhưng không trang web nào gọi. Endpoint nay đã mang `moderationState` +
  `moderationNote` + `rejectionCount`, sẵn cho ngày trang ấy ra đời.
- **Dọn ảnh của review bị bác.** Giờ mới bàn được, vì ADR-0032 §1 vừa chốt xoá
  DÒNG review là sai đòn bẩy. `MediaService` hiện KHÔNG có hàm xoá nào và
  không chỗ nào gọi Cloudinary destroy — hệ thống chưa từng xoá một tấm ảnh.

Tests after: 2.827 unit (10 tokens · 227 contract · 22 ui · 2 i18n · 329 api ·
799 admin · 1.438 web) và 365 integration.

## 2026-09-05 — Đọc được review mà không phải mở nút quyết định (nhánh `fix/p4c-backend-logic`, 1 commit `3a4132c`, ~8 file, KHÔNG migration)

User hỏi 05/09: trang `/reviews` chỉ có nút duyệt, không thấy đường nào xem kỹ
khách viết gì.

Rà lại thì nội dung đầy đủ và ảnh đính kèm **vốn đã hiện** — nhưng chỉ hiện bên
trong dialog xác nhận Approve/Remove. Nghĩa là **cửa duy nhất để ĐỌC là một cái
cửa ghi "làm đi"**: muốn đọc kỹ phải mở một hành động ghi rồi bấm huỷ. Đó là
dạy người ta bấm nút quyết định khi chưa quyết. Ở bảng thì nội dung cắt còn hai
dòng, bản đầy đủ nhét trong thuộc tính `title` — tooltip vô hình trên cảm ứng
và không đọc nổi với 2000 ký tự.

Nay chính đoạn chữ trong bảng là nút mở **dialog chỉ-đọc**: nguyên văn giữ cả
chỗ xuống dòng, năm sao, badge trạng thái và nguồn, tour, dấu vết ai duyệt lúc
nào, cùng ảnh ở cỡ đọc được.

### Ba quyết định

**Ảnh dùng bản `c_limit` mới, không phải thumbnail `c_fill` của bảng.** Ảnh
review là BẰNG CHỨNG — khách chụp vết bẩn ở góc phòng hay tấm biển sai tên
tour. Cắt vuông có thể xén mất đúng thứ họ đang phàn nàn, và người duyệt thì
không biết mình vừa *không được nhìn* cái gì.

**Dialog KHÔNG có nút duyệt.** Trộn đọc với ghi là dựng lại đúng vấn đề vừa gỡ,
chỉ theo chiều ngược; hai nút quyết định vẫn nằm ngay cạnh trên cùng hàng.

**Bỏ nút X góc trên** (`showCloseButton={false}`), cùng lý do đã ghi ở
`ConfirmWriteDialog`: nó là `absolute` ngay trong phần tử cuộn nên trôi khuất,
mà dialog này sinh ra để cuộn qua 2000 ký tự.

Không đụng schema, không đụng contract, không tốn thêm request nào — mọi thứ
dialog cần đã nằm trong `ReviewRowVM` mà server component dựng sẵn.

### Đây mới là bước 1 trong ba

Vòng rà cùng ngày trả lời ba câu hỏi khác của user, và cả ba đều dẫn tới một
lỗ lớn hơn:

- **Khách review lại được không?** Ràng buộc là `bookingId @unique` — một
  review mỗi BOOKING, không phải mỗi tour. Đặt lại tour đó thì review lại
  được; cùng một booking thì 409.
- **Sửa review được không?** KHÔNG. Toàn hệ thống chỉ có ba route cho khách:
  xem theo tour · xem của mình · tạo. Không update, không delete. Gửi xong là
  đóng băng với cả khách lẫn admin.
- **Có nên thêm Reject?** Nên, và lý do mạnh nhất nằm đúng ở đợt trước: model
  chỉ có `isApproved: boolean`, không có trạng thái "đã xem và từ chối" — nên
  **card `Pending` đang đếm gộp "chưa ai xem" với "đã xem và không duyệt"**,
  tức hàng đợi không bao giờ dọn sạch được và con số vừa dựng đo một thứ chỉ
  có thể phình ra.

Hai phát hiện phụ, cùng loại "đã có nhưng không ai đọc": `ReviewModerationEvent.note`
(500 ký tự) được ghi mỗi lần moderate nhưng KHÔNG nơi nào đọc — write-only từ
đầu; và email `REVIEW_APPROVED` chỉ bắn khi `false→true`, nên gỡ duyệt hay từ
chối thì khách không được báo gì cả.

Bước 2 (Reject thành trạng thái chung cuộc — cần migration, ADR riêng, và đổi
nghĩa card Pending) và bước 3 (đường quay lại cho khách) làm ở đợt sau.

Tests after: 2.795 unit (10 tokens · 218 contract · 22 ui · 2 i18n · 315 api ·
794 admin · 1.434 web) và 345 integration.

## 2026-09-04 — `/reviews` mọc bộ lọc ngày, stat card ăn theo, và card mẫu số còn thiếu (nhánh `fix/p4c-backend-logic`, 2 commit `36eb501..0f10d50`, ~25 file, KHÔNG migration)

Vùng thứ ba áp ADR-0028, và là vùng đầu tiên **chưa có bộ lọc ngày nào cả** —
hai lần trước chỉ phải nối card vào một ô đã tồn tại. Nên đợt này làm đủ hai
vế: dựng bộ lọc, rồi cho card ăn theo.

### Bốn card thay vì ba

| Card | Trả lời | Kiểu |
| --- | --- | --- |
| Pending | còn tồn bao nhiêu | mực nước (ảnh chụp) |
| **Submitted** (mới) | nhận về bao nhiêu | dòng vào |
| Approved | xử được bao nhiêu | dòng ra |
| Average rating | khách nói gì | chất lượng |

`submitted` là **mẫu số đang thiếu**: không có nó thì "Approved 12" không đọc
được — 12 trên 12 hay 12 trên 300 là hai tình trạng khác hẳn. Nó cũng làm lộ
tập mà `averageRating` tính trên, vì hai card ấy cùng tập và cùng cột neo; một
int test khoá đúng quan hệ đó lại.

Không chọn "lượt GỠ duyệt" làm card thứ tư dù nó đối xứng với Approved và hiện
đang vô hình: hành vi ấy hiếm nên card sẽ đứng yên ở 0 gần như mọi lúc.

`pending` nay là ảnh chụp **cuối kỳ** so với **đầu kỳ** (luật AMEND 1 §3) thay
vì "bây giờ vs đầu kỳ". Chưa lọc thì `currentTo` chính là bây giờ, nên con số
vẫn khớp đúng số hàng `/reviews?status=pending` như lời hứa cũ.

### Cột lọc, và chỗ khó nhất của vùng này

Lọc theo `review.created_at` — ngày review được GỬI, cùng cột bảng đang sắp
xếp. KHÔNG lọc theo `moderated_at` dù nó khớp tuyệt đối với card Approved:
review chưa duyệt có `moderated_at` null, nên lọc cột ấy sẽ **quét sạch hàng
đợi khỏi bảng**, đúng cái bẫy đã bác ở `/cancellations`.

Mặc định **KHÔNG lọc**, theo `/cancellations` chứ không theo `/bookings`: hàng
đợi việc phải làm thì mở ra phải thấy đủ, kể cả review gửi từ tháng trước. Vì
URL trần chính là "xem tất cả" nên ở đây cũng không có sentinel `?dates=all`.

⚠️ Độ lệch "một khoảng, hai cột" ở vùng này **sâu hơn hẳn hai vùng trước**:
`Approved` neo `event.created_at`, còn bảng và hai card kia neo
`review.created_at`. Một review gửi tháng 6 mà duyệt tháng 9 đếm vào Approved
của tháng 9 nhưng không xuất hiện trong bảng lọc tháng 6. Ở `/cancellations`
sai số nhỏ vì vòng đời một request chỉ vài ngày; một review nằm hàng đợi vô
thời hạn nên độ lệch không có trần. Vẫn giữ `created_at` vì hai phương án kia
hoặc phá bản chất card Approved (nó đo CÔNG VIỆC ĐÃ LÀM, không đo lô hàng nào
được xử) hoặc quét sạch hàng đợi. Chỗ đọc ra điều đó là cặp nhãn
Submitted/Approved đứng cạnh nhau, KHÔNG phải caption — caption là khe của
phép so sánh, nhét câu cảnh báo vào đó là đổi mất con số kỳ trước.

### Hai thứ chuyển nhà vì nay ba vùng dùng chung

`CalendarDateSchema` từ `schemas/bookings.ts` sang `schemas/common.ts` — để
nguyên chỗ cũ thì schema review phải import từ schema booking, một cạnh phụ
thuộc không có lý do nghiệp vụ nào. `createdAtRange` từ `modules/bookings/`
lên `lib/created-at-range.ts`, cùng lý do.

### Phép dựng lại hàng đợi ở đây là XẤP XỈ, và nó xấu đi khi lọc lùi xa

Khác `/cancellations` (quyết định là chung cuộc, `decided_at` ghi một lần),
`moderated_at` của review chỉ giữ lần quyết định CUỐI. Đúng một ca cho sai:
review hiện chưa duyệt mà sau mốc đã đi qua cả một lượt duyệt lẫn một lượt gỡ.
Ca ấy đòi hai sự kiện moderation sau mốc trong đó có một lượt gỡ — hiếm, nên
chấp nhận. Nhưng ghi rõ chiều xấu đi: trước đợt này `pendingReviewsAt` chỉ
được gọi với mốc 28 ngày trước, từ nay `currentTo` lùi được hàng tháng.
`review_moderation_events` có đủ lịch sử nếu ngày nào cần chính xác tuyệt đối.

### Nghiệm thu lộ một khe deploy có thật

User mở `/reviews` sau khi restart và ăn `TypeError: Cannot read properties of
undefined (reading 'current')` ở `countCard`. Dựng lại bằng chứng: dist API có
`submitted`, contract dist có `submitted`, tiến trình API khởi động sau cả hai
— nên server trả đúng. Thủ phạm là **Data Cache của Next**: dev server admin
lên trước API 14 giây, và trong khe ấy nó lưu body của API CŨ với
`revalidate: 60`. Restart admin là sạch.

Khe ấy **có thật ở production**: admin trên Vercel, API trên Render, hai bên
lên độc lập — trong ≤60 giây sau một lần deploy đổi hình dạng stats, trang sẽ
rơi vào error boundary. Tự lành, nhưng áp cho mọi lần thêm field vào stats về
sau. Ghi vào sổ nợ, chưa vá.

### Sổ nợ mở

- Bộ lọc `source` (VERIFIED/CURATED) và `rating` đã được `adminList` lọc thật
  nhưng chưa có đường nào từ UI tới — việc của toolbar, tách đợt sau. Nhớ kèm:
  `averageRating` cố ý KHÔNG lọc theo nguồn, nên khi có bộ lọc ấy card này sẽ
  không ăn theo nó.
- Response stats chưa được parse bằng schema contract tại tầng fetch, nên lệch
  hình dạng nổ ở một helper dùng chung thay vì báo đúng field thiếu.

Tests after: 2.781 unit (10 tokens · 218 contract · 22 ui · 2 i18n · 315 api ·
780 admin · 1.434 web) và 345 integration. Build web/admin vẫn KHÔNG chạy được
trong đợt (dev server của user đang giữ `.next`, guard chặn đúng như thiết kế).

## 2026-09-04 — Approve trở thành quy trình bốn bước, và ba lỗ làm rò ghế được bịt (nhánh `fix/p4c-backend-logic`, 4 commit `31b9dfe..8a64d25`, ~20 file, KHÔNG migration)

Đợt này thi công ADR-0029 rồi phát hiện thêm hai ca nữa của **đúng một bug**:
ghế không bao giờ được nhả vì approve từ chối chạy.

### B1 — approve nhận số tiền, chịu được dư 0, và chặn ca chồng lấn

`decide` nhận `refundAmount`; approve trên booking đã hoàn đủ không còn ăn 422
mà vẫn đóng request, huỷ booking, nhả ghế; gate W3 nới cho booking `CANCELLED`
còn dư nhưng KHÔNG ghi đè `CANCELLED` bằng trạng thái derive từ sổ; nút
`Issue refund` tự ẩn khi booking đang có yêu cầu huỷ chờ xử lý (ADR-0029
§AMEND) — suy từ TRẠNG THÁI, không từ trang nào dẫn tới.

Hai record kẹt của user tự lành khi bấm Approve, không cần SQL tay. User đã
nghiệm thu: ghế nhả đúng.

### Dialog xin huỷ của khách: rộng gấp đôi, chia hai nửa

Dialog cũ rộng 24rem và chỉ nói MỘT nửa câu chuyện — in ước tính hoàn tiền mà
không hề nói con số ấy thuộc booking nào. Nay chia hai nửa: trái là thứ đang
huỷ (tour, đợt, số khách, mã), phải là con số hoàn làm neo thị giác cùng căn cứ
sinh ra nó. Thêm khối "What happens next" (duyệt ~2 ngày làm việc · hoàn về
đúng phương thức đã trả · 5–10 ngày làm việc lên sao kê).

Ba thứ phải làm cho đúng chứ không chỉ cho đẹp:

- `formatMoneyExact` mới giữ đủ hai số lẻ. `formatMoney` của trang tour cắt
  phần lẻ (giá tour tròn trăm, chuyện biên tập); dùng nó cho tiền hoàn là in
  "$600" trong khi khách nhận $599.50 — con số họ đối chiếu được với sao kê.
- Lớp mở rộng phải là `data-[size=default]:sm:max-w-2xl`. Một `sm:max-w-2xl`
  trần thua luật gốc về specificity và tailwind-merge không gộp hai lớp khác
  tập biến thể, nên nó sẽ nằm im trong DOM còn dialog vẫn 24rem. Đo bằng
  `twMerge` trước khi viết.
- `max-h` + `overflow-y-auto`: `AlertDialogContent` neo `top-1/2` mà không có
  trần chiều cao — nội dung dài trên màn thấp tràn ra cả hai đầu không cuộn
  được, tức mất luôn nút gửi.

Khối ước tính hoàn tiền trước nay **chưa có test nào**; bổ sung 9 ca.

### Stepper approve bốn bước (user chốt: hoàn tiền không nên bấm một hai nút là xong)

Request → Policy → Amount → Confirm, mỗi bước mang MỘT thứ mới: nguyên văn lý
do khách viết · căn cứ ra con số (mấy ngày, bậc nào, ân hạn hay badge có nâng
không, đã hoàn bao nhiêu) · quyết định duy nhất của luồng cùng câu cảnh báo
approve chỉ chạy một lần · ba hệ quả và ô ghi lý do bắt buộc khi lệch bậc.

Phần trăm đi qua `refundPercentForRequest` — ĐÚNG hàm mà dialog xin huỷ bên web
gọi — nên khách và admin không thể nhìn hai con số khác nhau.

Thanh bước nằm ở kit `wizard-steps.tsx`, dựng theo `@shadcn-space/stepper-03`
(dáng user chọn): đường ray liền tô dần bằng spring, chấm chạy theo tiến độ,
vòng nhấp nháy ở bước hiện tại, dấu tích xoay vào khi bước xong.

Vòng đầu mình dựng trên `Stepper` sẵn có của `@tourism/ui` và user nhận ra ngay
là không giống — bộ ấy chia đường nối thành TỪNG ĐOẠN giữa hai vòng tròn, mà
dáng stepper-03 cần một đường liền cho chấm chạy trên. Bốn chỗ không chép
nguyên bản gốc: `text-teal-400` → `text-primary-foreground` (tokens-only, và
dấu tích nằm trên nền `bg-primary`); hình học ghim `12.5%`/`75%` → suy từ
`steps.length`; nhảy cóc sang bước bất kỳ → `reached` là trần cứng; và nút bước
KHÔNG CÓ TÊN với trình đọc màn hình (nhãn nằm ngoài nút) → `aria-labelledby`
trỏ vào nhãn đang hiện, cộng roving tabindex và mũi tên trái/phải.

Bỏ `AnimatePresence mode="wait"` ở vùng nội dung: nó giữ khung rỗng suốt thời
gian exit, mà bốn bước cao thấp khác nhau nên dialog sập rồi phình mỗi lần bấm
Continue — bản gốc không lộ vì demo có `min-h-20` cố định.

### Ba phát hiện khi thi công

1. **`refundAmount` chưa từng rời client.** B1 mở contract nhưng type
   `DecideAction` không theo, nên approve vẫn âm thầm hoàn trọn phần dư — đúng
   hành vi mà ADR-0029 §1 định thay. Contract xanh, test xanh, và không có gì
   báo.
2. **Mức hoàn BẰNG 0 không approve được** (ADR-0029 §AMEND 3). Bậc cho 0% ở ca
   huỷ sát ngày khởi hành; con số ấy rơi vào `classifyRefundAmount` và ăn 422
   `ZERO_OR_NEGATIVE`, tức **ca thường gặp nhất** kẹt ở `REQUESTED` và GHẾ
   KHÔNG BAO GIỜ ĐƯỢC NHẢ. Cùng bug với §2, khác đường vào. Nay gộp thành một
   điều kiện `noMoneyToMove`: không đồng nào phải chuyển thì bỏ gate, không
   gọi gateway, không ghi sổ, nhưng vẫn đóng request, huỷ booking và nhả ghế.
3. **Hoàn một phần là MỘT LẦN ở back-office** (§AMEND 2). Sau approve booking
   thành `CANCELLED`, `canRefund` ẩn nút Issue refund, nên phần dư hết đường
   hoàn. Giữ nguyên — nới ra là dựng lại hai cửa cùng chuyển tiền — nhưng bước
   Amount phải NÓI THẲNG, vì một giới hạn không công bố là một cái bẫy.

### Review findings vá trong đợt

- `refund-panel.spec.tsx` dùng khoá i18n `t.issue` (không tồn tại; đúng là
  `t.cta`), nên `getByRole('button', { name: undefined })` khớp BẤT KỲ nút nào
  — cả 11 assertion về nhãn nút đều rỗng nghĩa, gồm hai ca mới của ADR-0029
  §AMEND. Test vẫn xanh; typecheck bị cache Turbo che, chỉ lộ khi `@tourism/i18n`
  đổi làm hash admin đổi.
- `consequences.refund` còn nói *"the full remaining balance"* trong khi
  approve nay hoàn theo bậc — sai ở mọi ca hoàn một phần; nay nhận số tiền
  thật làm tham số.
- jsdom không cài `window.matchMedia`, `Stepper` đọc breakpoint bằng media
  query nên ném ngay lúc mount; thêm shim vào `vitest.setup.ts` của admin.

### Vòng rà cuối: hai chỗ khách bị bỏ trong bóng tối

**Mail duyệt huỷ hứa một khoản tiền bằng không.** `'0.00'` là chuỗi TRUTHY, nên
mail in *"Refund issued 0.00 USD"* kèm *"your refund is on its way"*. Trước
§AMEND 3 ca ấy hiếm; sau nó thì mọi yêu cầu huỷ sát ngày khởi hành đều duyệt ở
mức 0%, tức khách huỷ muộn nhận một mail hứa tiền đang trên đường tới. Chặn ở
chỗ dựng `money` — một nơi cho MỌI loại mail — và ca không hoàn đồng nào nay
nói thẳng *"No further refund is due on this booking"* kèm link bảng bậc.

**Trang booking của khách không nói số tiền đã hoàn.** Sau một lần duyệt huỷ
hoàn một phần, khách thấy đúng chữ "Cancelled"; con số chỉ nằm trong hộp mail.
`refundSummary` mới kể ba ca — hoàn đủ, hoàn một phần (in CẢ hai số, vì một số
lẻ loi dễ bị đọc thành toàn bộ), và huỷ-không-hoàn (vẫn kể, kèm link bảng bậc).
Cổng đầu tiên là `paidAt` chứ không phải status: booking chưa từng thu tiền là
"chưa bao giờ có giao dịch", nói về hoàn tiền ở đó là bịa ra một giao dịch chưa
từng có.

Cùng đợt rà: báo cáo và stat card đọc SỔ CÁI thật (`refundsSlice` cộng từng
dòng) nên hoàn một phần và duyệt 0 đồng vào sổ đúng, không chỗ nào giả định
approve = hoàn trọn.

### Sổ nợ mở

- Chính sách chỉ cưỡng chế ở UI: server nhận bất kỳ số nào ≤ phần dư, và luật
  "lệch bậc phải ghi lý do" nằm hoàn toàn ở client. Một phần là chủ ý
  (ADR-0030 §5 cho phép vượt bậc), nhưng ràng buộc lý do thì chưa có gì gác.
- Chốt chặn 3 ngày trước khởi hành cho đặt tour: tách đợt sau, cần ADR riêng
  (đổi luật ĐẶT, không phải luật hoàn).

Tests after: 2.769 unit (10 tokens · 217 contract · 22 ui · 2 i18n · 315 api ·
769 admin · 1.434 web) và 336 integration. Build web/admin KHÔNG chạy được
trong đợt (dev server của user đang giữ `.next`, guard chặn đúng như thiết kế).

## 2026-09-04 — Ân hạn 24 giờ, và gỡ BỐN lời hứa "48 giờ" chỏi chính sách (nhánh `fix/p4c-backend-logic`, 3 commit, ~15 file, KHÔNG migration)

Đợt này sinh ra từ một câu hỏi của user lúc nghiệm thu, rồi lộ thêm một lỗ
nặng hơn khi rà lại **toàn bộ** cam kết với khách (user yêu cầu docs sweep +
đọc lại điều khoản trước khi làm tiếp).

### Lỗ nặng nhất: site hứa "miễn phí huỷ trước 48 GIỜ" ở bốn nơi

| Nơi | Câu |
| --- | --- |
| `top-bar.tsx` — chạy trên **mọi trang** | *"Free cancellation up to 48 hours before departure"* |
| `about-values.tsx` | *"Cancel up to 48 hours before departure for a full refund — no forms, no phone queue"* |
| `about-cta-video.tsx` | *"Free cancellation up to 48h"* |
| `mocks/faq.ts` | *"…for a full refund… Inside 48 hours we rebook you to a later date instead"* |

Chính sách nói **dưới 7 ngày = 0%**. 48 giờ = 2 ngày. Thanh trên cùng hứa hoàn
**100%** ở đúng cái mốc chính sách trả **0%** — và nếu khách khiếu nại, một câu
hiển thị trên mọi trang sẽ được đọc là cam kết.

FAQ còn hứa thêm *"we rebook you to a later date"* — **luồng đổi ngày KHÔNG hề
tồn tại**. Hai chỗ nói *"no forms"* trong khi huỷ CÓ form bắt nhập lý do và CÓ
xét duyệt tay.

Bốn câu ấy là khẩu hiệu viết TRƯỚC khi có bất kỳ chính sách nào — nên đổi mô
hình hoàn tiền cũng không chữa được, phải sửa chính chúng. Nay không câu nào
mang con số giờ, đúng bài học `trust-strip.tsx` đã học từ trước ("một con số
chung là nói sai" — đo 30 tour thấy mốc khác nhau). Một component đã được sửa
từ lâu, bốn cái còn lại thì không, và không ai biết cho tới lượt rà này.

### Bậc 25% đang VÔ HÌNH ở checkout

`computeCancellationAssurance` hardcode `30` và `15`, chỉ ba nhánh. Dải 25% mới
không lọt qua được: khách đặt tour còn 10 ngày đọc *"This departure is close"*
trong khi chính sách nói rõ họ được hoàn 25%. Nay đọc thẳng từ
`REFUND_POLICY_TIERS`, và nhánh `closeWindow` chỉ còn đúng nghĩa của nó — bậc
0%, thật sự không hoàn.

### Ân hạn 24 giờ sau thanh toán

User phát hiện: **người đặt muộn không bao giờ với tới bậc 100%.**

| Đặt | Khởi hành | Huỷ | Hoàn |
| --- | --- | --- | --- |
| 1/7 | 19/9 | 2/7 | **100%** |
| 4/9 | 19/9 | 5/9 | **50%** |

Cùng một hành vi — đổi ý ngay hôm sau — khác nhau 50 điểm, và khách không làm
gì sai. Gốc rễ: bảng bậc chỉ đo *còn bao xa tới khởi hành*, không đo *đã giữ
chỗ bao lâu* — mà người giữ chỗ mười phút rồi trả lại không gây tổn thất cho ai.

Luật thêm (ADR-0030 §3c): huỷ trong **24 giờ** kể từ `paidAt` → **100%**, KHÔNG
chặn theo ngày khởi hành. `refundPercentForRequest` thành **điểm vào duy nhất**
mà cả khách lẫn admin dùng. Dialog xin huỷ nói rõ vì sao được 100% — không có
câu ấy thì con số trông như may mắn và khách không biết cửa sổ sắp hết.

Bất biến có test quét mọi tổ hợp: **ân hạn chỉ có lợi**, không bao giờ hạ kết
quả so với bảng bậc thuần.

### Đã cân nhắc rồi loại: chuyển hẳn sang neo theo lúc thanh toán

User đề xuất bỏ mô hình neo-khởi-hành. Loại, vì thử trên một ca thật: đặt 1/1,
khởi hành 1/12, huỷ 1/6 → quá 24 giờ → **0%**, trong khi mô hình hiện tại cho
100% vì còn sáu tháng. Khách báo sớm thừa thãi thời gian bán lại chỗ mà không
được đồng nào — mô hình mới **khắc nghiệt hơn**, chỉ là với nhóm khách khác.

Hai mô hình đo hai thứ: neo khởi hành đo **tổn thất thật của mình**, neo thanh
toán đo **thời gian khách giữ chỗ** — thứ không liên quan tới tổn thất. Ân hạn
vì thế là lớp phủ chỉ-có-lợi, không phải vật thay thế.

*(Đề xuất kèm theo của user — "trong 48 giờ hoàn 100%, trong 24 giờ hoàn 75%"
— không chạy được: 24 giờ nằm TRONG 48 giờ, nên huỷ ở giờ thứ 10 thoả cả hai
vế. Cửa sổ hẹp hơn phải rộng rãi hơn.)*

### Còn treo

**Chốt chặn đặt chỗ 3 ngày** — user chốt tách đợt riêng. Ý: không cho đặt khi
còn dưới 3 ngày tới khởi hành, khách muốn đi gấp thì rẽ vào form "Inquire Now"
(phễu đã có sẵn, vùng `/enquiries` bên admin). Nó **chặn từ đầu** thay vì đền
bù về sau, và cần ADR riêng vì đổi luật ĐẶT CHỖ chứ không phải luật hoàn tiền.

**Đợt B** — API tính tiền theo bậc + stepper nhiều bước cho luồng approve
(ADR-0029 + ADR-0030 đã chốt, chưa thi công).

Tests after: 1418 web · 311 api · 329 api-int · 217 contract · 733 admin ·
22 ui · 10 tokens · 2 i18n. Thêm 9: 7 ân hạn, 2 `computeCancellationAssurance`.

## 2026-09-04 — Chính sách hoàn tiền thành bậc CƯỠNG CHẾ: một nguồn cho cả văn bản công khai lẫn phép tính (nhánh `fix/p4c-backend-logic`, 2 commit `f3d0da5..ad1c43f`, ~20 file, KHÔNG migration)

Đợt **A** của [ADR-0030](../adr/0030-refund-policy-tiers.md); phần API tính tiền +
stepper để đợt B (user chốt tách — văn bản pháp lý đáng được đọc riêng, không
trộn vào một diễn biến kỹ thuật). Kèm [ADR-0029](../adr/0029-cancellation-approve-partial-refund.md)
đi trước cho cơ chế approve.

### Bốn lỗ tìm được khi rà chính sách

Site ĐÃ công bố bậc hoàn tiền ở `/cancellation-policy` và `/terms` — tiền đề
"chưa nói rõ" là sai. Nhưng:

1. **Mất hẳn ngày 14.** Cả hai văn bản viết "15–29 ngày" rồi "dưới 14 ngày",
   bỏ rơi đúng ngày 14 chẵn.
2. **Công cụ admin mù chính sách.** Bậc chỉ sống dưới dạng văn xuôi trong
   i18n, không có dạng máy đọc được — hai admin xử hai ca giống hệt nhau ra
   hai con số khác nhau.
3. **Badge tour dừng nửa chừng.** "Free until 5 days out" không nói sau hạn
   thì sao, nên khách lỡ một ngày bị bất ngờ.
4. **Quyết định không lưu căn cứ.**

### Bậc mới 100 / 50 / 25 / 0

`≥30` · `15–29` · `7–14` · `<7`. Dải 25% là MỚI, và nó làm ba việc: vá lỗ ngày
14, hạ vực từ 50 xuống 25 điểm, và **chỉ nới rộng hơn** — ngày 7–14 đi từ 0%
lên 25%, các mốc khác giữ nguyên, nên **không booking nào đã đặt bị thiệt** so
với điều khoản khách đã đọc lúc mua. Đó chính là điều kiện để sửa được văn bản
công khai mà không phải xử lý riêng cho booking cũ.

Hằng `REFUND_POLICY_TIERS` đặt ở **contract** chứ không i18n: nó vừa là copy
khách đọc vừa là **luật tiền** server tính. Ở i18n thì API phải import một gói
copy để tính tiền, và một sửa đổi "chỉ đổi chữ" có thể âm thầm đổi số tiền trả
cho khách. Nay `/cancellation-policy`, `/terms` và (đợt B) màn quyết định của
admin đọc chung một bảng — gạch đầu dòng SINH ra từ hằng, biên trên của mỗi bậc
suy từ biên dưới của bậc trước nên lỗ ngày 14 không thể tái sinh.

### Hai câu bị bỏ khỏi văn bản công khai

- *"general guidelines rather than fixed rules"* — máy đã quyết thì đừng bảo
  khách rằng đó là gợi ý.
- *"less any non-recoverable supplier costs"* — **điều khoản bất khả thi
  hành**: hệ thống không biết chi phí nhà cung cấp, nên câu ấy chỉ làm con số
  công bố mập mờ mà không ai trừ được thật.

Thêm mục **"How we count the days"**: đếm theo NGÀY LỊCH (giờ trong ngày không
đổi kết quả) và tính từ lúc khách GỬI yêu cầu, không phải lúc ta xử xong.

### ⚠️ Test bác bỏ chính ADR — ghi lại vì đây là bài học, không phải sự cố

ADR-0030 bản đầu khai một sàn `MIN_FREE_CANCELLATION_DAYS = 7` và bắt sửa 5
tour trong seed, lý do "chặn vực 100 điểm". Viết test thì nó đỏ ngay, và lộ
HAI lỗi:

- **Sàn 7 không xoá được vực.** Đo thật: badge 7 thì ngày 6 vẫn rơi bậc `<7` =
  0%. Phải từ **8** trở lên ngày trước hạn mới chạm dải 25%.
- **Nâng sàn là SIẾT quyền khách.** `freeCancellationDays` là số ngày TỐI
  THIỂU để được miễn phí, nên nâng 5 → 8 lấy mất quyền huỷ miễn phí ở ngày 5,
  6, 7 trên 8 tour — trái thẳng luật "chỉ nới, không siết" của chính ADR ấy.

Và cái gọi là "vực" hoá ra **không phải mâu thuẫn với chính sách** — nó là
**hạn chót**. Khách lỡ hạn rơi về đúng bậc chuẩn của ngày hôm đó, tức bằng
đúng thứ một tour KHÔNG có badge sẽ trả; họ chỉ mất phần thưởng thêm. Áp tư
duy "thang bậc" lên một lời hứa vốn nhị phân là chỗ suy luận đã trượt.

Kết quả: **seed không đụng một dòng**, hằng sàn bị gỡ, thay bằng bất biến có
test — *badge chỉ NÂNG, không bao giờ HẠ* (quét mọi mốc × mọi ngày). Và một
test mới **đo** độ cao vực bằng số thay vì để người viết phỏng đoán.

### Chữa cái BẤT NGỜ thay vì vặn con số

Rủi ro thật không nằm ở mức %, mà ở chỗ khách không biết trước. Hai chỗ, không
đổi một con số nào:

- **Badge trang tour nói nốt vế sau** — thêm "After that, our standard refund
  schedule applies" kèm link về bảng bậc (tour không có badge giữ nguyên đường
  cũ về policy riêng của tour).
- **Dialog xin huỷ của khách hiện luôn kết quả**: còn bao nhiêu ngày, hoàn bao
  nhiêu phần trăm, bao nhiêu tiền — TRƯỚC khi bấm gửi, và trừ sẵn phần đã hoàn.

Cả hai dùng ĐÚNG hàm mà màn quyết định của admin sẽ dùng ở đợt B, nên khách và
admin **không thể** nhìn hai con số khác nhau. `BookingSchema` vì thế mang thêm
`freeCancellationDays` (join sống như `tourSlug`, không phải snapshot): thiếu
nó thì ước tính nói THẤP hơn thực tế ở 15 tour có badge — mà nói thấp còn tệ
hơn không nói.

### Còn treo sau đợt này

**Người đặt muộn không bao giờ với tới bậc 100%** (user phát hiện lúc nghiệm
thu): đặt 4/9 cho chuyến 19/9 thì dù huỷ ngay hôm sau cũng chỉ 50%, trong khi
người đặt từ tháng 7 huỷ cùng ngày được 100%. Cùng một hành vi, khác 50 điểm,
và khách không làm gì sai — bảng bậc chỉ đo "còn bao xa tới khởi hành", không
đo "đã giữ chỗ bao lâu". Hướng chữa đã thống nhất: **cửa sổ ân hạn sau khi
đặt**, chi tiết ở kế hoạch đợt kế.

Tests after: 1417 web · 311 api · 329 api-int · 210 contract · 733 admin ·
22 ui · 10 tokens · 2 i18n. Thêm 16 contract cho `refund-policy`.

⚠️ Build `apps/web` KHÔNG chạy trong đợt này: máy dev đang giữ `.next` (repo
cấm `next build` song song dev server). Toàn bộ test đã chạy; cần `gate:int`
đầy đủ trước khi merge.
