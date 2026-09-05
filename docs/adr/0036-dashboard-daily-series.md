# ADR-0036 — Dashboard `/` nối số thật: MỘT chuỗi theo ngày, ăn lại kit đã có

- **Trạng thái:** Accepted (2026-09-05)
- **Bối cảnh thi hành:** nhánh `feat/p4d-dashboard` (P4d theo thứ tự
  [ADR-0026](0026-p4-admin-app.md) §P4d), đi trước code theo luật CLAUDE.md #5
- **Liên quan:** [ADR-0028](0028-bookings-stats-follow-filter.md) (cửa sổ
  nửa-mở UTC, luật "client không tự cắt kỳ", §1 chốt dashboard gọi
  `admin.stats.bookings` KHÔNG tham số) ·
  [spec P4b §3-F5](../specs/2026-08-31-p4b-admin-ready-areas-design.md) (kit
  `StatCardRow`/`stats-view.ts` và định nghĩa `revenue`/`paidBookings`) ·
  `apps/api/src/modules/stats/stats.service.ts` (JSDoc định nghĩa metric — ADR
  này THÊM một mục, không sửa mục nào) · `apps/admin/src/lib/api/stats.ts`
  (luật vùng nào cache, vùng nào không)

## Bối cảnh

Trang `/` của admin từ 20/08 là block `dashboard-01` của shadcn tái hiện 1:1
(user chốt), rồi gọt sạch số demo ở vòng 21/08: bốn card in `—`, biểu đồ nhận
mảng rỗng nhưng vẫn giữ bộ chọn 7/30/90 ngày, bảng vẫn là xương TanStack ăn
`data.json` mẫu (kèm drag-row, checkbox, drawer — tất cả không có nghĩa gì với
dữ liệu thật). Cả ba khối đều ghi "chờ P4d".

Tới nay bảy endpoint `admin.stats.*` (P4b/P4c) và `admin.bookings.list` (P4b
F1) đã sống, kit admin đã có `StatCardRow`, `DataTableFrame`/`DataTableBody`,
`BookingLink`, `StatusFilterTabs`. Việc của P4d vì thế KHÔNG phải dựng bề mặt
mới, mà là nối ba khối vào những thứ ấy — và **chỉ một thứ còn thiếu**: nguồn
cho biểu đồ. Bảy endpoint stats đều trả TỔNG của một kỳ (cặp hai số), không
endpoint nào trả chuỗi theo ngày.

Ràng buộc kế thừa, không bàn lại:

- Dáng đã chốt 1:1 — chỉ đổ dữ liệu, không "thuần hoá" bố cục.
- Mọi bảng admin lắp vào kit khung `dashboard-01`, cấm fork rút gọn (user chốt
  31/08).
- Admin KHÔNG fetch từ browser: server component fetch qua cookie forward,
  trạng thái sống trên URL hoặc trong props (spec P4b §2.2).
- Không migration; dev/prod chung Supabase.

## Quyết định

### 1. Bốn card = `admin.stats.bookings()` không tham số, qua đúng kit của `/bookings`

Card render `toBookingsStatCards(stats)` bằng `StatCardRow` — cùng bốn metric
Revenue · Paid bookings · New bookings · Cancellation rate, cửa sổ TRƯỢT 28
ngày (ADR-0028 §1 đã hẹn đúng cách gọi này). `section-cards.tsx` (bản gọt của
block, bốn nhãn `—`) bị XOÁ: kit `StatCard` vốn bê nguyên kiểu dáng của chính
file ấy (JSDoc `stat-card.tsx` ghi rõ), nên giữ hai bản là giữ một bản sẽ
trôi.

Bốn nhãn cũ của block (`Reviews to moderate`, `New enquiries`) KHÔNG giữ: mỗi
card là một cặp hai kỳ của MỘT endpoint; muốn hàng đợi review/enquiry thì phải
gọi thêm hai endpoint chỉ để lấy hai ảnh chụp, còn hàng card của `/bookings`
đã là một bộ tự kiểm chéo được nhau (`revenue / paidBookings` = giá trị đơn
trung bình; `cancellationRate` có mẫu số chính là `paidBookings`). Dashboard
trả lời "tiền vào thế nào", các hàng đợi có trang riêng của chúng ở sidebar.

### 2. Biểu đồ = MỘT endpoint mới `admin.stats.dashboard` trả chuỗi theo NGÀY

`GET /api/admin/stats/dashboard?days=7|30|90` → `{ period, currency, points[] }`
với mỗi point `{ date: 'YYYY-MM-DD', revenue: '1240.50', bookings: 3 }`.

**Metric — MỘT cột neo, cùng tập với hai card đầu:**

- `revenue` — `SUM(total_amount)` của booking có `paid_at` trong ngày, GROSS
  (không trừ hoàn) — ĐÚNG định nghĩa `revenue` của card, chỉ chia nhỏ theo
  ngày. Cộng 90 point lại phải ra `revenue.current` của một kỳ `?from/?to`
  cùng khoảng — đó là cách đối chứng.
- `bookings` — `COUNT(*)` của CHÍNH tập ấy (đã trả tiền trong ngày), tức
  `paidBookings` theo ngày.

Không neo `bookings` theo `created_at` (số "New bookings" của card) dù nó cũng
có lý: hai chuỗi trên một biểu đồ mà neo hai cột thì tooltip của một ngày kể
hai chuyện — tiền của đơn trả hôm nay và đơn tạo hôm nay — mà không có gì
trên màn hình nói ra khác biệt ấy. Card đứng ngay trên đã tách bạch hai con số
(§6 ADR-0028), biểu đồ chỉ cần kể MỘT chuyện: tiền về mỗi ngày, và bao nhiêu
đơn mang tiền ấy. Định nghĩa ghi vào JSDoc `StatsService` như bảy mục kia.

**Cửa sổ:** `[00:00 UTC của (hôm nay − (days − 1)), generatedAt)` — `days`
ngày lịch gần nhất TÍNH CẢ hôm nay, và hôm nay là bucket ĐANG CHẠY (nửa ngày
thì nửa số). Khác `statsWindow` (neo vào `now` để hai kỳ dài bằng nhau): ở đây
không có phép so sánh hai kỳ nào để bảo vệ, và người trực mở dashboard là để
xem HÔM NAY — cắt hôm nay ra khỏi biểu đồ là giấu đúng point họ đang tìm.
`period.to` = `generatedAt` nên response tự nói bucket cuối đầy tới đâu.

**Biên:** nửa-mở UTC như mọi cửa sổ của module (`stats-math.ts`, ADR-0028
§3). Bucket ngày cắt bằng `date_trunc('day', paid_at)` — cột là `timestamp`
không tz và mọi đường ghi đều UTC (`now()` với session TimeZone=UTC), nên
`date_trunc` cho đúng ngày UTC mà `calendarDate()` in ra; không có
`AT TIME ZONE` nào chen vào.

**Điền 0 ở tầng THUẦN:** SQL `GROUP BY` chỉ trả ngày có row; ngày trống điền
`{ revenue: '0.00', bookings: 0 }` ở hàm thuần `fillDaySeries(rows, window)`
trong `stats-math.ts` (có spec TDD). Điền ở SQL bằng `generate_series` cũng
được, nhưng đường thuần test được từng nhánh (đầu/cuối cửa sổ, kỳ rỗng, row
lạc ngoài cửa sổ) mà không cần Postgres, và "0 là câu trả lời thật, không phải
thiếu dữ liệu" là quyết định của tầng dựng response chứ không phải của câu
query — cùng nếp `bookingsCreatedByStatus` trả Map thưa còn response điền đủ
enum. Bất biến: `points.length === days`, ngày tăng dần, không lỗ, không trùng.

**Raw SQL với `Prisma.sql`** (một câu, `SUM` + `COUNT` cùng `GROUP BY`):
Prisma `groupBy` không group theo biểu thức, và hai con số cùng một lượt quét
chụp cùng một khoảnh khắc — đúng lý do `subscribersStats` đã đi đường này.

**`?days=` là literal `7 | 30 | 90`, mặc định 90** — ba giá trị mà bộ chọn có,
không phải một số tự do: "42 ngày" không có nút nào gọi ra, và một tham số mở
là một nhánh phải nghĩ về trần. `ZodSmartCoercionPlugin` ép `"30"` trên query
string thành số như đã ép `page`/`limit`; int spec phải chứng minh điều đó
qua URL thật, kèm 400 cho `days=42`, và 401/403 cho guard cấp class.

**Trang fetch `days=90` MỘT lần; bộ chọn 7/30 cắt ĐUÔI ở client.** Đây là cách
duy nhất giữ CẢ HAI ràng buộc: admin không fetch từ browser, và bộ chọn của
block đổi tức thì không tải lại trang (chính bản gốc cũng lọc client trên một
mảng 90 ngày). Cắt đuôi là an toàn vì bucket là ngày lịch UTC cố định — 7
point cuối của chuỗi 90 ngày CHÍNH LÀ chuỗi 7 ngày, không phải xấp xỉ. Tham số
`days` vì thế tồn tại cho endpoint tự mô tả và cho consumer sau (P5 mobile chỉ
cần 7), không phải để trang này gọi ba lần.

**KHÔNG cache** (khác ba vùng P4b, cùng luật F7–F10 ở `lib/api/stats.ts`):
kẻ ghi `paid_at` là WEBHOOK của provider — `PaymentsService` gọi
`claimSeatsForPaid` trong API, ngoài mọi server action của admin — nên không
ai gọi được `updateTag(ADMIN_STATS_TAG)` hộ nó. Luật đã chốt: cache theo tag
CHỈ khi mọi kẻ ghi đều là server action của admin. Ở đây cache 60s còn LỘ hơn
mọi vùng khác: bucket hôm nay ở khung 7 ngày là con số người trực nhìn vào
ngay sau khi khách trả tiền.

⚠️ Ghi nhận, không sửa trong ADR này: `admin.stats.bookings` (bốn card ở §1)
ĐANG cache 60s theo tag dù `paid_at` có cùng kẻ ghi ngoài — quyết định của
vòng vá review F5, với lý lẽ "cửa sổ 28 ngày nên 60s là số lẻ thứ năm". Vậy
trên `/` bốn card có thể trễ tối đa 60s còn biểu đồ và bảng thì tươi. Chấp
nhận: hai khối không hứa khớp nhau (28 ngày trượt so với N ngày lịch), và sửa
cache của card là sửa hành vi của `/bookings` — ngoài phạm vi P4d.

### 3. Bảng "Recent bookings" = `admin.bookings.list` limit 10, đổ vào kit

`admin.bookings.list({ page: 1, limit: 10, includeMedia: false })` — không
lọc trạng thái, không lọc ngày (KHÔNG độn tháng hiện tại như `/bookings`:
"gần nhất" là gần nhất tuyệt đối), server đã `orderBy createdAt desc`.
`includeMedia: false` vì bảng không có cột ảnh (cùng lý do đường export).

Bảng lắp vào `DataTableFrame` + `DataTableBody` với `serverTableFeatures`
(không checkbox: không có hành vi hàng loạt nào trên dashboard):

- khe `views` = `StatusFilterTabs` MỘT mục "Recent bookings" (copy
  `dashboard.table.tab`/`viewLabel` đã có từ 01/09 cho đúng chỗ này);
- khe `actions` = `ColumnVisibilityMenu` — cùng menu, cùng icon với `/bookings`;
- khe `footer` = link "View all bookings" → `/bookings` thay cho
  `TablePagination`: mười hàng là một cửa sổ nhìn, không phải một tập để lật.

Cột: Code (qua `BookingLink` của kit — href trần `/bookings/{code}`, không
mang bộ lọc vì dashboard không có bộ lọc để mang) · Tour · Status · Guests ·
Amount · Customer · **Created**. Cột Created thêm vì "recent" cần một con dấu
thời gian mới đọc được; `BookingRowVM` mang thêm `createdAt` đã format
(`formatDateTime`, UTC), `/bookings` chưa hiện cột này — thêm khi có nhu cầu,
không phải trong ADR này.

Ô thân của Tour/Status/Guests/Amount/Customer tách thành component nhỏ dùng
CHUNG với `bookings-table.tsx` (`booking-cells.tsx`), để hai bảng không thành
hai bản chép của cùng sáu ô — đó chính là "fork rút gọn" mà nếp 31/08 cấm.
Phần riêng của mỗi bảng chỉ còn: toolbar, cột chọn/xuất, và footer.

**Xoá** `components/data-table.tsx` + `app/(admin)/data.json` (không còn ai
dùng) và bốn gói `@dnd-kit/*` (chỉ file ấy import). Hai điểm kit từng trỏ về
file này để "bê nguyên" (`data-table-frame.tsx`, `table-pagination.tsx`) nay
là nguồn duy nhất — JSDoc của chúng sửa theo.

### 4. Không đụng tới, cố ý

- Không thêm `?range=` lên URL của `/`: bộ chọn là tiện ích nhìn, không phải
  trạng thái đáng bookmark, và mọi lựa chọn đều nằm trong 90 point đã tải.
- Không "cần chú ý" (failed outbox, stuck payment events…) trên dashboard dù
  spec P4c §ngoài-phạm-vi có nhắc: đó là bốn endpoint không cache, gọi thêm
  chỉ để hiện một hàng pill — một đợt riêng với thiết kế riêng, không nhét vào
  đợt nối số.
- Không so sánh kỳ trước cho biểu đồ (đường mờ "kỳ trước"): chuỗi ngày không
  có bất biến "hai kỳ dài bằng nhau" để bảo vệ, và block gốc không có nó.

## Hệ quả

- Contract thêm `AdminDashboardQuerySchema` + `AdminDashboardSeriesSchema`
  (`schemas/stats.ts`) và route thứ tám trong `admin.stats`; `contract.spec`
  liệt kê route mới, và mệnh đề "admin.stats không khai lỗi nghiệp vụ" tự phủ
  nó.
- `StatsService` thêm `adminDashboard(days)`; `stats-aggregates.ts` thêm
  `paidByDay(from, to)`; `stats-math.ts` thêm `dashboardWindow`/`fillDaySeries`
  thuần có spec.
- Admin: `lib/api/stats.ts` thêm fetcher KHÔNG cache; `lib/dashboard-view.ts`
  (thuần: cắt đuôi theo dải, format tooltip) có spec; bảng mới
  `components/bookings/recent-bookings-table.tsx`; `page.tsx` fetch ba thứ
  trong một `Promise.all` cùng session.
- i18n `admin.dashboard`: bỏ bốn nhãn card (kit dùng `admin.stats.bookings.*`),
  đổi `chart.description` khỏi câu "chờ P4d", thêm copy bảng (View all,
  Created, ô rỗng).
- Chỉ số quét: cửa sổ 90 ngày theo `paid_at` — cùng ngưỡng "xem lại index khi
  `bookings` vượt ~10k row" đã ghi ở ADR-0028.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Gọi `admin.stats.bookings` 90 lần (mỗi ngày một `?from=&to=`) | Đúng số, sai giá: 90 × 5 query cho một biểu đồ. Endpoint tổng không phải endpoint chuỗi. |
| Chuỗi từ `admin.reports.monthly` | Độ phân giải tháng, không có 7/30 ngày; và báo cáo trả tổng tuyệt đối của kỳ ĐÓNG, dashboard cần cả hôm nay. |
| `?from=&to=` tự do như ADR-0028 thay cho `days` | Bộ chọn chỉ có ba nút; tham số tự do là trần phải nghĩ (10 năm = 3650 point) và nhánh không ai gọi. Ngày dashboard có ô ngày thật thì mở, kèm trần. |
| Ba lần fetch theo `?range=` trên URL (mỗi nút một điều hướng) | Bộ chọn của block đổi tức thì; điều hướng cả trang cho 83 point bị cắt đi là đắt hơn cả tải 90 point một lần. |
| `bookings` theo `created_at` (mọi trạng thái) | Hai cột neo trên một biểu đồ, không chỗ nào nói ra; tooltip một ngày kể hai chuyện. Card đã tách hai số đó. |
| Điền 0 bằng `generate_series` trong SQL | Chạy được, nhưng luật "0 là câu trả lời thật" thuộc tầng dựng response và tầng thuần test không cần DB — cùng nếp Map thưa của báo cáo tháng. |
| Cache 60s theo `ADMIN_STATS_TAG` như card | Kẻ ghi `paid_at` là webhook, ngoài `updateTag`; bucket hôm nay ở khung 7 ngày lộ độ trễ ngay. Luật F7–F10. |
| Giữ `data-table.tsx` làm bảng dashboard (đã có TanStack, drawer, drag) | Là fork thứ hai của kit với drag/checkbox/drawer không mang nghĩa; user chốt 31/08 mọi bảng đi qua kit. |
| Tái dùng nguyên `BookingsTable` cho 10 hàng | Nó mang toolbar lọc/tìm/xuất và phân trang URL — dashboard không có URL state nào để nuôi; tách ô thân dùng chung là đủ. |
