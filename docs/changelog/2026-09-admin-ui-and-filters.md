# CHANGELOG — lưu trữ: vòng chỉnh giao diện admin và bộ lọc ngày (04/09/2026)

Bốn ô lọc gộp thành một menu, và ba vùng admin được sửa để thẻ số liệu ăn theo
đúng bộ lọc ngày người dùng chọn — thay vì trả lời một câu hỏi khác với bảng
ngay bên dưới.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-09-04 — Điều chỉnh backend #3: tách route chi tiết cho `/cancellations`, quyết định rời khỏi bảng (nhánh `fix/p4c-backend-logic`, 2 commit `829f340..cce9d90`, ~10 file, KHÔNG migration)

User chốt: hai vùng phải có trang chi tiết RIÊNG, dùng chung kiểu thiết kế chứ
không chung route. Trước đó cả `/bookings` lẫn `/cancellations` đều trỏ về
`/bookings/[code]`, nên nút quyết định buộc phải nằm trong bảng — và một lệnh
vừa hoàn tiền vừa nhả ghế được bấm từ một hàng.

**Khối trình bày tách sang `booking-detail-sections.tsx`** (server component
thuần): back link · header · ba card ngữ cảnh · sổ hoàn tiền · lịch sử huỷ.
Cắt theo KHỐI MÀN HÌNH chứ không theo từng thẻ — hai trang phải nhìn ra là một
hệ, chia nhỏ hơn thì mỗi trang tự ghép một kiểu rồi lại trôi lệch. Ở
`components/bookings/` chứ không phải kit: chúng biết `AdminBookingDetail` từ
đầu tới cuối, tức là trình bày của MIỀN booking. `LedgerTable` cũng rời
`refund-panel.tsx` (`'use client'`) sang đây — người dùng thứ hai chỉ đọc,
không cần một byte JavaScript nào để in một cái bảng.

**Route mới `/cancellations/[code]`** định danh bằng MÃ BOOKING chứ không phải
id request: một booking có nhiều nhất một request đang mở, còn các dòng DENIED
là lịch sử của cùng booking ấy — trang kể trọn câu chuyện thay vì một mảnh.
Dùng lại `admin.bookings.byCode` (đã trả `cancellationRequests` + `refunds` +
`refundedTotal` thật) nên **không thêm endpoint nào**. Khác `/bookings/[code]`
ở phần GHI: nơi kia là `RefundPanel`, nơi này là cụm quyết định, còn sổ hoàn
tiền hiện THUẦN ĐỌC — nó là bằng chứng để quyết, không phải chỗ phát lệnh tiền.

**Cột Decision bỏ hai nút**, thay bằng một nút "Review request" mang theo bộ
lọc đang xem để lượt quay về không nhả filter (cùng luật vòng đi–về của
`/bookings`). Bảng từ nay **không phát lệnh ghi nào** — `CancellationsTable`
hết nhận prop `decide`.

**Nút dựng theo `@shadcn-space/button-06`** (viền gradient xoay). Ba chỗ bản
registry không dùng thẳng được: nó hardcode `#2b7fff` (luật 6 là tokens-only →
đổi sang `--primary`, nhờ vậy đi theo cả chế độ tối); animation VÔ HẠN không
có guard (thêm `motion-reduce:animate-none` — đúng thứ `prefers-reduced-motion`
sinh ra để tắt, và tắt rồi vẫn còn viền gradient tĩnh); và bản gốc là
`<Button>` trong khi đây là ĐIỀU HƯỚNG nên dùng `ButtonLink` để giữ role
`link`.

**Trang chi tiết huỷ chia hai cột**: BẰNG CHỨNG bên trái (2/3 — sổ hoàn tiền
và lịch sử, hai bảng cần bề ngang và KHÔNG gộp vì một cái là sổ tiền, một cái
là dấu vết quyết định), VIỆC PHẢI LÀM bên phải (1/3 — khối Decision,
`lg:sticky` để không trôi khỏi tầm mắt khi cột trái dài ra).

Tests after: 733 admin (thêm 5 cho vòng đi–về `/cancellations/[code]`).

## 2026-09-04 — Điều chỉnh backend #2: `/cancellations` có bộ lọc ngày, stat card ăn theo bộ lọc, hai control lên kit (nhánh `fix/p4c-backend-logic`, 4 commit `917a08a..1cda886`, ~20 file, KHÔNG migration)

Đợt thứ hai, cùng nhánh và cùng ngày với đợt #1. Khác đợt #1 ở một điểm quyết
định phạm vi: `/bookings` đã sẵn hai ô ngày nên chỉ việc nối card vào, còn
`/cancellations` **chưa có bộ lọc ngày nào** — nên đợt này là "thêm bộ lọc cho
vùng, rồi mới nối card", đụng cả contract lẫn UI.

Quyết định ở [ADR-0028 §AMEND](../adr/0028-bookings-stats-follow-filter.md) (đi
TRƯỚC code), AMEND [spec P4b §3-F3](../specs/2026-08-31-p4b-admin-ready-areas-design.md).

### Ba chỗ khuôn của đợt #1 KHÔNG phủ

ADR gốc hẹn "vùng nào mọc bộ lọc ngày thì lặp lại đúng khuôn này". Lần đầu áp
dụng thì lộ ra ba chỗ phải quyết mới:

**1. Cột lọc là `createdAt`, không phải `decidedAt`.** Ngày khách GỬI yêu cầu,
cùng cột bảng đang sắp xếp. `decidedAt` khớp tuyệt đối với hai card
Approved/Denied nhưng hàng `REQUESTED` có `decidedAt` **null**, nên lọc theo
cột ấy sẽ **quét sạch hàng đợi đang mở khỏi bảng** ngay khi admin bật bộ lọc —
tức xoá mất lý do tồn tại của trang.

**2. Mặc định KHÔNG lọc ngày — cố ý khác `/bookings`.** Hai trang không đối
xứng, và đó là chủ đích: `/bookings` là **sổ**, người ta đọc theo kỳ nên "tháng
này" là mặc định đúng; `/cancellations` là **hàng đợi việc phải làm**, nó tồn
tại để được dọn sạch. Mặc định lọc tháng hiện tại sẽ giấu mất một request khách
gửi tháng 8 mà tới giờ vẫn `REQUESTED` — không ai xoá nó, nhưng cũng không ai
còn thấy nó. Hệ quả dễ chịu: **không cần sentinel `?dates=all`**, vì URL trần
CHÍNH LÀ xem tất cả và xoá trắng hai ô ngày là đường về hiển nhiên.

**3. Metric ẢNH CHỤP dưới một kỳ đã chọn = cuối kỳ vs đầu kỳ.** Khuôn đợt #1
chỉ nói về metric đếm-trong-kỳ (cả bốn card `/bookings` đều vậy).
`pendingQueue` là ảnh chụp: lọc tháng 7 mà card vẫn nói "hàng đợi bây giờ" thì
nó tái lập đúng nghịch lý đợt #1 sinh ra để dẹp. Nay `current` là ảnh chụp tại
`currentTo`, `previous` tại `currentFrom` — card đọc thành "hàng đợi đã dịch
chuyển thế nào trong kỳ bạn đang xem".

Ba điều khiến luật ấy không tốn gì: `pendingRequestsAt` **đã tồn tại** và dựng
lại được hàng đợi tại bất kỳ mốc nào; nó dựng **chính xác** chứ không xấp xỉ
(quyết định cancellation là chung cuộc, `decided_at` ghi một lần — thứ reviews
F5 và enquiries F9 phải thêm bảng audit mới có); và với cửa sổ trượt thì
`currentTo === now` nên hành vi chưa lọc **không đổi một con số nào**.

⚠️ Lời hứa `pendingQueue.current` "khớp đúng số hàng `?status=REQUESTED`" nay
chỉ còn đúng **khi chưa lọc ngày** — và đó chính là lúc nó có nghĩa. Có một int
test khoá riêng điều này.

### Chữ trên card phải đổi theo kỳ, không chỉ con số

Hai chỗ sai nghĩa nếu để nguyên:

- Card ảnh chụp nói **"vs 2 28 days ago"** — nhưng "28 ngày trước" tính từ hôm
  nay sẽ trỏ vào một mốc chẳng liên quan gì tới tháng 5. Kỳ đã chọn thì đứng
  yên nên **gọi được tên nó**: "vs 2 on May 1, 2026".
- Nhãn **"Approved 31d"** đọc thành "31 ngày gần nhất", tức một cửa sổ TRƯỢT.
  Lọc tháng 5 là một kỳ đứng yên, và khoảng ngày đã nói ở dòng ngay trên hàng
  card — nên nhãn bỏ hậu tố, còn "Approved".

### Hai control lên kit — vì có consumer thứ hai

- **`parseDateRange`** (ngày rác rơi im lặng, khoảng ngược giữ `from` bỏ `to`)
  rời `bookings-query.ts` sang `table-query.ts`. Hai vùng phải khoan dung y
  hệt nhau, và hai bản chép là hai bản sẽ trôi lệch.
- **`ToolbarDateRange`** — nâng CẢ control, không chỉ hai cái ô. Thứ đáng dùng
  chung không phải `DatePickerField` (nó vốn đã tổng quát, chỉ đổi đường
  import) mà là **guard "patch bị vứt"**: khi giá trị vừa chốt bị luật
  khoảng-ngược loại thì URL đích trùng URL hiện tại nên không có điều hướng
  nào, và ô đứng đó khoe một bộ lọc không tồn tại. Cơ chế ấy học được qua hai
  vòng review F6; chép sang vùng thứ hai là chép đúng thứ khó nhất.
  `BookingsDateRange` thành vỏ mỏng và **spec 12 test của nó không đổi một
  dòng** — đó là bằng chứng lần nâng này không đổi hành vi.

Input stats cũng gộp: `AdminBookingsStatsQuerySchema` đổi tên thành
**`AdminStatsRangeQuerySchema`** dùng chung cho cả hai vùng.

### Ô rỗng có lưới an toàn như `/bookings`

Nói thẳng khoảng đang lọc kèm link "xem tất cả". Rủi ro nhẹ hơn `/bookings`
(vùng này mặc định không lọc) nhưng vẫn thật: admin đặt khoảng rồi đổi tab
trạng thái, bảng rỗng, và thủ phạm là hai ô ngày họ đặt từ lúc trước.

### Vá lúc user kiểm bằng mắt: hai con số dính nhau trong caption

`vs 0 28 days ago` đọc thành "028". Đây là caption DUY NHẤT của cả bề mặt
stats có hai con số đứng cạnh nhau chỉ cách một khoảng trắng — ba câu còn lại
đều có chữ chen giữa (`prior`, `on`) hoặc dấu `·`. Nay là `vs 0 · 28 days ago`,
dùng đúng dấu phân cách mà `comparisonRange` đã dùng. Ảnh hưởng HAI trang:
`/cancellations` (Pending queue) và `/reviews` (Pending).

Khoá bằng một test regex `\d\s+\d` áp cho CẢ BỐN caption, nên lần sau ai
viết lại thành hai số dính nhau là đỏ ngay — rẻ hơn nhiều so với trông chờ mắt
người bắt lại.

### Chưa làm, cố ý

`search` cho `/cancellations`: contract chưa có và đợt này không thêm. Tra theo
mã booking là nhu cầu thật nhưng là một tính năng riêng, không phải hệ quả của
việc cho card ăn theo bộ lọc.

Năm vùng stats còn lại (reviews · outbox · payment events · enquiries ·
subscribers) giữ nguyên cửa sổ 28 ngày cố định — trang của chúng chưa có bộ
lọc ngày.

Tests after: 1417 web · 311 api · 329 api-int · 194 contract · 728 admin ·
22 ui · 10 tokens · 2 i18n. Thêm 28 so với đợt #1: 4 contract (mặc định không
lọc, cùng schema và trần năm với /bookings, khoảng ngược 400, refine không
nuốt shape), 7 api-int (1 cho list — cắt đúng khoảng kể cả row 23:59:59.500 và
hàng REQUESTED không bị loại; 6 cho stats — ảnh chụp hai đầu kỳ,
approved/denied theo decidedAt, period.currentTo, không tham số rơi về 28
ngày, khoảng ngược 400, và lời hứa khớp `?status=REQUESTED` khi chưa lọc), 14
admin (8 `cancellations-query`, 4 `stats-view`, 2 bất biến caption).

## 2026-09-04 — Điều chỉnh backend #1: stat card `/bookings` ăn theo bộ lọc ngày, chốt cột lọc, trả 3 mục kit còn treo (nhánh `fix/p4c-backend-logic`, 9 commit `9f89886..ab1da85`, ~25 file, KHÔNG migration)

Đợt điều chỉnh backend ĐẦU TIÊN sau vòng chỉnh UI — user báo trước là sẽ còn
nhiều đợt nữa. Đóng **mục 3 và mục 4** của "Bàn giao — còn treo" 04/09 (entry
ngay dưới), cộng ba mục kit nhỏ để lại từ vòng vá review polish 2.

Quyết định + lý do đầy đủ ở [ADR-0028](../adr/0028-bookings-stats-follow-filter.md)
(đi TRƯỚC code theo luật 5); [plan 8 task](../plans/2026-09-04-bookings-stats-follow-filter.md);
AMEND ở [spec P4b §3-F5](../specs/2026-08-31-p4b-admin-ready-areas-design.md) (nơi
khai sinh cửa sổ 28 ngày) và [spec P4c §1](../specs/2026-09-02-p4c-operations-design.md)
(bốn vùng F7–F10 KHÔNG đổi).

### Vấn đề: hai vùng trên cùng màn hình đo hai kỳ khác nhau

Vòng chỉnh UI đặt bộ lọc bảng về trọn tháng hiện tại, còn hàng card vẫn là cửa
sổ TRƯỢT 28 ngày. Đọc ngày 04/09 thì card tính 08/08–04/09 còn bảng tính
01/09–30/09. Không con số nào sai, nhưng người trực đọc "Revenue $12,400" rồi
nhìn xuống bảng tháng 9 sẽ cộng nhẩm ra một câu chuyện không tồn tại. User chốt
phương án (b) trong ba phương án đã liệt: **cho card nhận bộ lọc**.

### Contract: `admin.stats.bookings` mọc `.input({ from?, to? })`

Dùng lại `CalendarDateSchema` và ĐÚNG hai tên field của `admin.bookings.list`
— `?from=`/`?to=` trên URL nuôi cả bảng lẫn card, không có bản dịch thứ hai để
trôi lệch. Cả hai optional nên `?dates=all` (sentinel admin cố ý bỏ lọc) và
P4d dashboard sau này rơi về cửa sổ trượt 28 ngày mà không cần tham số thứ ba.
Khoảng ngược là 400, cùng luật với list. **Sáu endpoint `admin.stats.*` còn
lại không đổi** — trang của chúng chưa có bộ lọc ngày nào.

### Kỳ trước: dài ĐÚNG BẰNG kỳ này, lùi liền kề — không phải tháng lịch trước

Đây là chỗ phải đọc kỹ nhất. Bất biến của F5 là "server trả cả hai số, và pill
delta chỉ nói thật khi hai kỳ dài bằng nhau" — chính lý do `schemas/reports.ts`
viện ra để tách `admin.reports.monthly`. Cửa sổ lùi-liền-kề GIỮ bất biến ấy với
mọi khoảng admin kéo ra: lọc 01/09–30/09 thì so với 02/08–31/08. So với "tháng
lịch liền trước" thì hỏng ngay khi khoảng lẻ — 05/09–12/09 (8 ngày) đặt cạnh 31
ngày của tháng 8 là một pill `↓74%` bịa từ hư không.

Bốn nhánh của `statsWindowFromRange` (hàm thuần, `stats-math.ts`): hai đầu ·
chỉ `from` (kết ở now) · chỉ `to` (lấy đúng `STATS_WINDOW_DAYS` kết ở `to`, vì
không có đầu nào để đo độ dài) · không đầu nào (rơi về đúng `statsWindow`).
Hai ca một-đầu tồn tại thật: `parseBookingsSearchParams` giữ `from` bỏ `to` khi
khoảng ngược, và admin gõ được một ô.

### Biên: nửa-mở, KHÔNG `00:00:01` / `23:59:59`

User đề xuất cặp mốc `00:00:01` và `23:59:59` — trông đúng, và sẽ còn được đề
xuất lại, nên ADR-0028 §3 có nguyên một bảng đối chiếu. Hai kẽ hở thật: mốc đầu
bỏ rơi trọn giây đầu tiên của ngày, còn `created_at` là `timestamp`
**microsecond** nên `lte 23:59:59` bỏ rơi mọi row từ `.000001` tới `.999999` —
gần trọn một giây của ngày cuối kỳ, đúng khung giờ khách đặt tour nhiều. Mốc
thật dùng là `[from 00:00:00.000, to+1d 00:00:00.000)`, đúng công thức
`createdAtRange` mà bảng đang dùng, nên card và bảng cắt CÙNG MỘT NHÁT.
`startOfDayUtc` vì thế lên `lib/calendar-date.ts` — một bản cho cả hai nơi.
Không có giờ giấc nào đi qua hợp đồng: contract chỉ nhận `YYYY-MM-DD`.

Int spec khoá đúng kẽ hở đó bằng một fixture lúc `2026-05-31T23:59:59.500Z` —
nó PHẢI được đếm.

### `StatsPeriod` thêm `currentTo`; caption in ngày thật

Tới nay cuối kỳ luôn bằng `generatedAt` nên một field là đủ; có bộ lọc thì hai
mốc rời nhau. Hai mốc TRÙNG nhau nay chính là dấu hiệu "cửa sổ đang trượt", và
client đọc đúng dấu hiệu ấy để chọn câu chữ — nó vẫn KHÔNG tự cắt cửa sổ nào.

Kỳ do admin chọn: một dòng `Showing Sep 1 – Sep 30, 2026` trên cả hàng (một
khoảng thì nói một lần), và caption từng card đổi thành
`vs $900.00 · Aug 2 – Aug 31, 2026`. Nhãn in ngày CUỐI CÙNG nằm trong kỳ chứ
không in mốc chặn — mốc là 00:00 ngày 1/10 nhưng ngày cuối là 30/09, in thẳng
mốc là nói dối đúng một ngày ở mọi khoảng. Năm viết đủ hai lần khi kỳ vắt qua
giao thừa. Đọc theo UTC, cùng thước với cột `Created` của bảng.

`windowDays` không còn trả thẳng hằng số mà đo từ chính cửa sổ, **sàn 1**:
contract khai `z.int().positive()`, mà lọc `?from=` bằng ngày hôm nay cho một
span vài giờ sẽ làm tròn thành 0 và response tự nó không parse nổi.

### Chốt: giữ cột `createdAt`, KHÔNG thêm `dateField`

Mục 4 còn treo hỏi có nên đổi hai ô ngày sang ngày khởi hành. User chốt không,
và lý do là nghiệp vụ chứ không phải kỹ thuật: *"chúng ta đang thống kê các
dòng bookings xuất hiện trong 1 tháng chứ không phải theo ngày khởi hành; một
khách có thể đặt tour từ tháng 9 và tour khởi hành tháng 10, thống kê phải theo
ngày đặt thì mới chính xác."* Đây cũng là cột bảng đang sắp xếp và cột
`newBookings` đang đếm.

⚠️ **Điều KHÔNG được suy ra:** ăn theo bộ lọc không có nghĩa bốn con số cùng
đếm trên một cột. `revenue`/`paidBookings`/`cancellationRate` vẫn neo `paid_at`,
`newBookings` neo `created_at`. Booking tạo 28/08 mà trả tiền 02/09 VÀO
`revenue` tháng 9 nhưng KHÔNG có trong bảng tháng 9 — đúng, vì doanh thu là
ngày tiền về. Ba trong bốn card cố ý không khớp bảng, và luôn vậy từ F5. Nay
ghi thẳng vào JSDoc `StatsService` để lần sau không ai đọc thành lỗi.

### Cache stats giữ nguyên

Data Cache của Next key theo URL, mà `from`/`to` nằm trên query string → mỗi
khoảng một entry, `ADMIN_STATS_TAG` vẫn `updateTag` được cả cụm. Không phải bỏ
cache như bốn vùng P4c (ở đó lý do là kẻ ghi nằm ngoài admin, không phải chuyện
tham số).

### Ba mục kit còn treo — trả hết

- **`unknownItem` lên `ToolbarFilterMenu`.** Hai vùng tự dựng "nhóm mục lạ" và
  đặt nó ở HAI vị trí khác nhau (`/payment-events` sau tập chính quy,
  `/subscribers` trước danh sách nguồn). Kit nay chốt: **CUỐI CÙNG**, dưới một
  separator — thứ tự đọc là "tất cả → chính quy → ngoại lệ". ⚠️ Thay đổi NHÌN
  THẤY ở `/subscribers`: mục nguồn lạ chuyển từ đầu xuống cuối. Nút trigger nay
  dò cả `unknownItem` nên vẫn đọc ra đúng giá trị lạ (bài học review F10).
- **`LabelValueRow` tách khỏi 6 bản chép** (`/bookings/[code]`,
  `/enquiries/[id]`, dialog Refund, `ConfirmWriteDialog`, và hai bản trong
  `JsonDrawer`). Sáu bản khác nhau đúng hai thứ: bề rộng cột nhãn và việc nhãn
  có tự ngắt dòng. Bề rộng là biến thể khai sẵn (sm/md/lg) chứ không phải chuỗi
  lúc chạy — Tailwind quét class tĩnh. `value` nhận `ReactNode` nên tông mờ và
  số thô của `PayloadRow` đi vào chính giá trị, kit không mọc prop cho một
  consumer. Bất biến `wrap-anywhere` + `minmax(0,1fr)` nay khoá bằng test thay
  vì bằng trí nhớ — bản chép thứ 5 từng lọt trọn một vòng vá tràn chữ vì không
  ai biết nó tồn tại.
- **Gọt JSDoc kể lịch sử ở 5 file `*-menu.tsx`.** Chúng đang kể trình tự các
  đợt thi công ("đợt 1 … đợt 2 … đợt 3", "Trước 03/09 là `ToolbarSelect`") —
  lịch sử là việc của CHANGELOG và git. Giữ nguyên mọi lý do kỹ thuật còn hiệu
  lực. Không đổi dòng code nào.

### Chưa làm, cố ý

Chưa thêm index cho `paid_at` dù cửa sổ nay lùi được rất xa (`?from=2020-01-01`).
Cùng ngưỡng đã khai ở JSDoc `StatsService`: xem lại khi `bookings` vượt ~10k
row. Ghi ở ADR-0028 §Hệ quả để lần chạm ngưỡng đầu tiên biết chỗ mà tìm.

Sáu vùng stats còn lại nay không đối xứng với `bookings` (một cái có input, sáu
cái không). Chấp nhận: thêm input không ai gửi là nợ, không phải tính năng.

### Bẫy bắt được lúc user kiểm bằng mắt: lệch phiên bản khi deploy

User mở `/bookings` gặp `RangeError: Invalid time value`. Nguyên nhân trực
tiếp ở máy dev: script `dev` của `apps/api` là `pnpm build && node dist/main.js`
— **không watch** — nên tiến trình khởi động lúc 12:33 vẫn phục vụ bản build
cũ, trả `period` không có `currentTo`.

Nhưng cùng tình huống ấy CÓ THẬT trên production, và đó mới là điều đáng ghi:
theo [ADR-0024](../adr/0024-deploy-targets.md) push lên main thì Vercel dựng admin
và Render dựng API **độc lập, không nguyên tử**, mà Vercel gần như luôn xong
trước. Vài phút liền bản admin MỚI đứng cạnh bản API CŨ. Client oRPC **không
validate response theo output schema** (bằng chứng: field thiếu đi thẳng tới
tầng hiển thị thay vì bị chặn ở link), nên `Date.parse(undefined)` cho NaN và
`Intl.format` của một `Invalid Date` ném `RangeError` — 500 MỌI lượt vào
`/bookings` trong cửa sổ đó.

`isPickedPeriod` nay kiểm CẢ BA mốc có đọc được không, chứ không chỉ so hai
chuỗi — `previousFrom`/`currentFrom` mới là cặp caption đọc, kiểm mỗi
`currentTo` thì lỗi chỉ dời xuống một dòng. Thiếu mốc thì ngả về đúng hành vi
TRƯỚC ADR-0028: caption "prior N days", không có dòng khoảng ngày. Vẫn là con
số thật, chỉ kém cụ thể — đúng thứ một trang admin nên làm khi tầng dưới nó
vừa lùi một phiên bản.

**Bài học rộng hơn bề mặt này:** mọi lần thêm field BẮT BUỘC vào response của
một endpoint mà consumer deploy riêng đều mở đúng cửa sổ ấy. Field mới nên có
đường ngả an toàn ở phía đọc, hoặc phải deploy API trước rồi mới đẩy consumer.

### Vòng đi–về bảng ↔ chi tiết giữ bộ lọc (user báo lúc kiểm bằng mắt)

Bấm một mã booking rồi bấm "Back to bookings" thì mất bộ lọc — nút ấy trỏ CỨNG
`?dates=all`. Hàng của bảng nay mang trạng thái danh sách sang link chi tiết
(`bookingDetailHref`: status · q · from · to · dates · page · limit) và nút
quay về dựng lại đúng URL đó (`bookingsBackHref`). Mang cả page/limit: về đúng
trang vừa cuộn tới.

**Điều này THAY quyết định `?dates=all` của vòng vá polish 2**, và thay được vì
lý do sinh ra nó đã hết: cái đó tồn tại để booking vừa xem không biến khỏi bảng
khi `/bookings` trần độn tháng hiện tại — nhưng bấm được vào một hàng nghĩa là
booking ấy NẰM TRONG bộ lọc, nên quay về đúng bộ lọc ấy luôn thấy nó.

Ngày mặc định được viết RA tường minh trên link chi tiết thay vì để URL trần:
bấm lúc 23:59 ngày cuối tháng rồi bấm Back lúc 00:01 vẫn về đúng tháng đã xem.
`bookingsBackHref` đi qua `parseBookingsSearchParams` rồi dựng lại chứ không
chuyển tiếp chuỗi thô — URL trang chi tiết cũng là thứ người gõ được.

⚠️ **Ca còn lại, có ghi:** tới trang chi tiết KHÔNG qua bảng — vào thẳng URL,
hoặc từ `BookingLink` của `/payment-events` và `/cancellations` — thì không có
bộ lọc nào để giữ, nút quay về cho `/bookings` trần tức tháng hiện tại. Nếu
booking ấy tạo tháng khác thì nó không nằm trong danh sách vừa mở. Chấp nhận:
ở ca đó "Back to bookings" là "sang danh sách bookings", không phải "quay lại
chỗ tôi vừa đứng".

### Nghiệm thu

`pnpm gate:int` xanh, chạy trên API dev đang sống ở `:3001` (không dựng API
tạm). Chưa qua review 8 mũi — session gốc nghiệm thu bằng `git diff` rồi mới
merge.

Tests after: 1417 web · 311 api · 322 api-int · 190 contract · 714 admin ·
22 ui · 10 tokens · 2 i18n. Thêm 53 so với entry trước: 11 api (`statsWindowFromRange`
bốn nhánh, hai kỳ bằng nhau ở khoảng lẻ, tháng nhuận, một ngày, không sửa Date
của caller, `windowDays` đo từ cửa sổ và sàn 1), 6 api-int (cắt đúng khoảng kể
cả row `23:59:59.500`, kỳ trước lùi liền kề, `currentTo` tách `generatedAt`,
không tham số rơi về 28 ngày, 400 cho khoảng ngược và ngày rác), 4 contract
(hai đầu optional, khoảng ngược, từ chối mốc có giờ, ngày không tồn tại), 22
admin (9 `stats-view`, 3 `stats-view` cho ca lệch phiên bản, 2 kit
`stat-card`, 5 kit `toolbar-filter-menu`, 6 kit `label-value-row`, 7
`bookings-query`/`bookings-view` cho vòng đi–về).

## 2026-09-04 — Vòng chỉnh UI admin sau P4c: bốn ô lọc thành MỘT menu kit theo `dropdown-menu-10`, vá tràn chữ ở dialog ghi, drawer Details đổi vỏ + hai chế độ xem payload + nhãn và giá trị payload đọc được, `/bookings` mặc định lọc theo tháng (nhánh `fix/p4c-ui-polish`, 1 commit `b2eb60b`, ~46 file, không migration)

Vòng thiết kế chạy bằng bản demo, không có spec riêng: file
[`design/mockups/outbox-type-menu.src.html`](../design/mockups/outbox-type-menu.src.html)
CHÍNH LÀ bản ghi (cùng lệ với cụm `/contact` và checkout của P3b). User chốt
qua ba đợt trong một phiên.

**Đợt 1 — `/outbox`.** `/outbox` có BỐN control hình dropdown, nên bản demo
đánh số cả bốn để user chỉ đúng cái: tab trạng thái · lọc loại email · menu
Columns · rows-per-page. Chốt: ô lọc loại email, theo phương án dựng menu bám
khuôn `@ss-components/dropdown-menu-10` (`align="end"`, rộng `w-66`,
separator chia nhóm) mà KHÔNG đụng `libs/shared/ui`. Lý do đáng đổi: 13 loại
email cộng mục "All" là danh sách dài nhất cả admin và chúng chia đúng năm họ
— thứ một Select phẳng không nói ra được.

Ba chỗ bản registry không lo hộ, phải tự vá và mỗi chỗ có một test canh:

- **dm-10 dùng `DropdownMenuItem` trơn, không có trạng thái chọn.** Đây là bộ
  LỌC nên phải `RadioGroup` — chép y nguyên là mất dấu hiệu "đang lọc cái nào",
  thứ một Select vốn hiển nhiên có.
- **`MenuRadioItem` của Base UI mặc định `closeOnClick = false`** (hợp cho menu
  bấm nhiều lần như menu Columns). Ở đây chọn xong là ĐIỀU HƯỚNG, nên phải bật
  tường minh — không thì menu treo lại trên trang vừa mở.
- **Khe `DropdownMenuShortcut` cố ý bỏ trống.** Thứ đáng nằm ở đó là số hàng
  theo từng mục, mà không endpoint stats nào trả con số ấy — thêm là sửa
  `apps/api` cộng contract, ngoài phạm vi. Đo thêm: `Shortcut` dùng `ml-auto`
  còn `RadioItem` đặt dấu tích ở `absolute right-2` với `pr-8`, nên dùng cả hai
  sẽ đè nhau — muốn dùng khe ấy là phải sửa `libs/shared/ui` dùng chung với web.

**Đợt 2 — `/payment-events` và `/subscribers`.** Consumer thứ ba xuất hiện nên
hình dạng lên kit `components/kit/toolbar-filter-menu.tsx` và cả ba vùng tiêu
thụ lại (đúng đường `ToolbarSelect` đã đi ở vòng vá review F7; luật kit ≥2
consumer, spec P4c §2 mục 6). Hai bất biến của vòng vá trước được giữ nguyên và
nay có test riêng: tiền tố `v:` (`toFreeValue` — một hàng `source`/`type` bằng
`'ALL'` không được biến thành mục xoá filter, review F10) và mục TẠM cho giá
trị ngoài tập (review F8). Giá trị lạ đứng ở nhóm riêng dưới separator, mang
dấu chấm hỏi — nó không thuộc tập chính quy và menu nói đúng điều đó.

**Đợt 3 — ô tháng `/reports`, cộng đối chiếu bộ icon.** Ô tháng là consumer
DUY NHẤT không có mục "tất cả" (một báo cáo luôn thuộc đúng một tháng), nên
`allItem` của kit nới thành tuỳ chọn; không có nó thì nhóm đầu cũng không cần
separator. Separator cắt ở mỗi lần ĐỔI NĂM qua `groupMonthOptions` (logic thuần
trong `lib/reports-query.ts`, 4 test) — gom theo ĐOẠN LIÊN TIẾP chứ không theo
khoá, vì `monthOptions` chèn tháng đang xem lên đầu nên cùng một năm có thể
thành hai đoạn rời nhau, và gom lại sẽ kéo tháng ấy xuống dưới. Bản Select cũ
ghim `w-48`, bản menu để nút tự co như ba nút kia: thanh `/reports` là
`justify-between` nên ô tháng đứng một mình bên trái, co giãn vào khoảng trống
chứ không đẩy nút Print/Export.

User dặn dùng đúng bộ icon dự án đã dùng xuyên suốt. Đối chiếu bằng
`git grep` vốn glyph ở `main` cho ra 11 glyph tôi tự đặt mới; năm khái niệm
trong đó dự án ĐÃ có glyph, nên đổi hết sang bản có sẵn: `TicketCheck` thành
`Ticket` (booking — user-menu web, cột bookingCode), `Banknote` thành
`RotateCcw` (trạng thái REFUNDED — tab bookings), `CalendarX` thành
`CircleDashed` (chưa xử lý — tab enquiries), `ThumbsUp`/`ThumbsDown` thành
`ShieldCheck`/`ShieldX` (duyệt/từ chối — `decision-button.tsx`), `CircleHelp`
thành `CircleQuestionMark` (panel good-to-know web). `AtSign` cũng bỏ vì trùng
cột `recipient` của menu Columns ngay trên cùng trang, thay bằng `PenLine`.
Còn bảy glyph mới thật sự vì dự án chưa có gì cho khái niệm đó — `BellRing`
`KeyRound` `Megaphone` `RectangleEllipsis` `Shapes` `Tags` `TimerOff` — cả bảy
vẫn là `lucide-react`, không thêm nguồn icon nào.

**Đợt 4 — vá tràn chữ ở dialog xác nhận ghi.** User chụp màn hình dialog
Retry của `/outbox`: dòng `Last error` chạy vượt hẳn mép phải dialog. Nguyên
nhân KHÔNG phải dialog hẹp mà là hai thứ cộng lại. `grid-cols-[8rem_1fr]`:
`1fr` trần là `minmax(auto,1fr)` và `auto` lấy **min-content**, nên một token
không dấu cách — JSON nguyên văn của Resend,
`{"statusCode":401,"name":"validation_error",…}` — làm phình cột. Và
`break-words` (`overflow-wrap: break-word`) trông như đã lo chuyện này nhưng
KHÔNG tính vào min-content, nên nó không cứu được cột đã phình. Vá bằng
`minmax(0,1fr)` (cột co được dưới min-content) cộng `wrap-anywhere`
(`overflow-wrap: anywhere` — Tailwind 4.1+, bản repo 4.3.3; nó CÓ tính vào
min-content).

Cùng cấu trúc ấy có ở bốn chỗ, vá cả bốn vì hai chỗ đầu in ĐÚNG chuỗi lỗi đó:
kit `confirm-write-dialog` (mọi dialog ghi của admin), kit `json-drawer`
(drawer Details của cùng hàng outbox — cả `JsonDrawerField` lẫn khối chữ
nguyên văn `JsonDrawerText`), và hai bản chép ở vùng là `refund-panel` và
trang chi tiết `/enquiries/[id]` (nơi này rủi ro thật vì email dài cũng là
token không dấu cách).

Đi kèm là trần chiều cao `max-h-[85dvh] overflow-y-auto` đắp ở kit
`ConfirmWriteDialog`: vá tràn ngang mà bỏ chiều cao là đổi một lỗi lấy một lỗi
khác — `lastError` trần 1000 ký tự, ngắt dòng xong thành khối cao, mà
`DialogContent` căn giữa bằng `-translate-y-1/2` và không có trần cao nào, nên
nút Cancel/Confirm sẽ trôi khỏi màn hình không cuộn tới được. Đắp ở kit admin
chứ KHÔNG sửa `DialogContent` của `@tourism/ui` — file đó dùng chung với
`apps/web` đang chạy thật. `dvh` chứ không `vh` vì thanh địa chỉ mobile.

Hai test mới đo bằng CLASS chứ không bằng hình học, và ghi rõ lý do trong
spec: jsdom không có layout engine nên `offsetWidth` luôn 0, không assert tràn
được; class chính LÀ hợp đồng ở đây, và cái bẫy `break-words` đủ tinh vi để
đáng khoá lại.

**Đợt 5 — drawer *Details*: đổi vỏ, cộng chế độ xem cho người không đọc JSON.**
User báo hai chuyện: chuyển động panel "chưa thật sự thiết kế tốt", và sheet
"khá hẹp". Đo ra thì lời phàn nàn về chuyển động có gốc rất cụ thể — `Sheet`
KHÔNG thật sự trượt vào: nó chỉ `translate-x-[2.5rem]`, tức nhích **40px** rồi
mờ dần, 200ms `ease-in-out`. Một tấm cao hết màn rộng 576px mà dịch 40px thì
mắt đọc ra là "pop" tại chỗ chứ không phải panel đi vào từ mép phải.

Đổi sang `Drawer` cấu hình theo `@shadcn-space/drawer-02` (user chốt qua bản
demo có panel chạy thật, [`design/mockups/details-drawer.src.html`](../design/mockups/details-drawer.src.html)):
trượt TRỌN từ ngoài mép màn, 450ms `cubic-bezier(0.22,1,0.36,1)`, kéo-để-đóng
với tốc độ ăn theo lực vẩy; rộng 576 lên **626px**; panel NỔI cách mép 16px
thay vì dính mép. Thứ đáng giá nhất về mặt dùng là cái thứ ba: đầu panel nay
ĐỨNG YÊN, trước đó cuộn xuống đọc payload là mất luôn tiêu đề và dedupe key —
không còn biết đang xem hàng nào.

Không thêm dependency nào. drawer-02 khai `canvas-confetti` nhưng chỉ để bắn
pháo giấy lúc đủ tiền free-ship, ta không lấy file; và `Drawer` của
`@tourism/ui` vốn đã là bản đầy đủ (swipe, `--drawer-content-width`,
`--drawer-inset`, xếp chồng) nên đây là đổi cách LẮP chứ không phải thay thư
viện. Vỏ chia hai lớp: `Popup` ngoài trong suốt (phải trải hết chiều cao cho
phép tính vuốt chạy đúng), hình hài panel đắp lên lớp trong
`data-slot=drawer-content`.

Cùng đợt, khối payload có **hai chế độ xem** — lý do user đưa ra: back-office
này không phải ai cũng đọc được JSON. **Simple** là mặc định (người không biết
mà bấm cũng phải xem được), **Developer** giữ nguyên khối JSON thụt lề cũ.
Simple trải payload thành danh sách nhãn · giá trị **PHẲNG** — user chốt dứt
khoát là không lồng thụt vào, vì khối lồng cũng bắt người đọc dựng lại cây
trong đầu y như JSON. Đường dẫn nằm gọn trong nhãn
("Data › Object › Metadata › Booking code"). Logic ở hàm thuần
`lib/payload-fields.ts` (10 test): nhãn sinh bằng MÁY từ chính khoá JSON
(`bookingId` → "Booking id") chứ không phải từ điển dịch tay — thêm loại email
mới là nó tự chạy; boolean đọc thành Yes/No; `null` ra gạch ngang còn chuỗi
rỗng ra "(empty)" vì hai chuyện đó khác nhau; mảng đánh số từ 1. Và nó KHÔNG
lọc bớt field nào, kể cả object rỗng lồng bên trong — một bề mặt vận hành mà
giấu field là bề mặt nói dối (spec P4c §2 mục 3 có mục AMEND ghi lại điều này).

Nhãn khối bỏ chữ "(JSON)" ở cả hai vùng: chế độ nay do cụm nút nói ra, và ở
chế độ Simple thì chữ ấy là sai. (Đợt 6 bên dưới đổi tiếp hai nhãn này sang
chữ đời thường.) Nhãn đọc-màn-hình
của nút đóng cũng về `@tourism/i18n` — trước đó nó nằm cứng trong
`SheetContent` của `@tourism/ui`, còn drawer mới tự dựng nút đóng.

**Đợt 6 — nhãn payload payment events, cho người không đọc code.** User mở
drawer `/payment-events` và chỉ ra cột TRÁI của khối *Provider payload*: chỉ
người biết chút code mới hiểu. Gốc rễ: payload vùng này là **nguyên văn
webhook** (`payload: verified.raw` ở `payments.service.ts`), nên nhãn chính là
tên trường do Stripe/PayPal đặt. Dựng ba phương án trên đúng một payload thật
([`design/mockups/payload-labels.src.html`](../design/mockups/payload-labels.src.html)),
user chốt **B**:

- **Cắt khúc bao bì.** Mọi dòng Stripe mở đầu bằng `data › object` (PayPal là
  `resource`) — vỏ bọc webhook, không mang nghĩa nào. Cắt khỏi NHÃN; `path`
  giữ nguyên vì nó là khoá React và là sự thật về vị trí.
- **Từ điển cho trường provider** (`messages.admin.paymentEvents.detail.payloadFields`,
  31 mục — đúng tập trường mà ba event Stripe và một event PayPal dự án nhận
  thực sự gửi về). Trường lạ vẫn rơi êm về cách đọc bằng máy.

Khoá từ điển tra theo HAI cách, đường dẫn đầy đủ trước rồi mới tới tên trường
trần. Cần cả hai vì sau khi cắt bao bì thì `id` của sự kiện và `data.object.id`
của phiên checkout đọc ra **cùng một chữ** — hai dòng cùng tên khác giá trị.
Có test riêng cho đúng ca đó.

Vì sao ở đây LÀ từ điển được, trong khi payload `/outbox` cố ý không có (đợt 5):
tên trường này do người khác sở hữu, ta không thêm bớt, và nó chỉ đổi khi
provider đổi API — không mục theo tính năng của mình. Bảng thiếu một mục cũng
không gãy gì.

`toPayloadFields` nhận thêm tham số `PayloadHints` (6 test mới); kit
`JsonDrawer` nhận thêm prop `payloadHints`. **Prop này chỉ có MỘT consumer** —
ngoại lệ có chủ ý so với luật "kit chỉ nhận prop mới khi có ≥2 consumer", vì
đường còn lại là fork khối payload ra vùng, thứ user cấm dứt khoát 31/08. Nó
là dữ liệu thuần và có fallback rõ (không truyền thì đọc bằng máy như cũ), nên
không mở ra nhánh hành vi nào để mà mục.

Cùng đợt, hai tiêu đề khối cũng bỏ chữ kỹ thuật: "Provider payload" →
**"What the payment provider sent"**, và bên `/outbox` "Payload" →
**"Email contents"**.

**Đợt 7 — diễn giải GIÁ TRỊ, giữ số thô bên cạnh.** Cùng vấn đề, phía cột
phải, và nguy hơn: `amount_total: 11700` là **đơn vị nhỏ nhất** (117,00 USD),
`created: 1756876800` là giây Unix. Người non-coding đọc hai con số đó sẽ hiểu
sai — và tệ hơn đọc JSON thô, vì sau khi nhãn đã đẹp thì con số càng trông như
đã được trình bày tử tế. User chốt làm, kèm điều kiện giữ số gốc.

Cái bẫy đắt nhất là **tiền tệ không có đơn vị nhỏ**: chia 100 cho VND là sai
đúng 100 lần. `apps/api` giải bằng danh sách `ZERO_DECIMAL_CURRENCIES` chép
tay, nhưng admin không với tới được (khác app) và chép bản thứ hai là bản sẽ
lệch. Lối ra: **đọc số chữ số minor từ ICU** —
`Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits` cho 2 với
USD/EUR, **0 với VND/JPY**, 3 với KWD. Không bảng nào phải nuôi, và nó còn
ĐÚNG HƠN danh sách nhị phân bên api, thứ coi mọi tiền tệ không-zero là 2 chữ số
nên sai với KWD.

Mọi ca không chắc đều rơi về in thô — thà hiện `11700` trơ còn hơn in một con
số sai trên bề mặt đối soát: không tìm thấy tiền tệ trong tầm, mã tiền tệ sai
hình dạng, giá trị không phải số nguyên hữu hạn. Tiền tệ lấy ở tầng GẦN NHẤT
bao quanh số tiền (một số tiền thuộc về chính object cũng mang currency của
nó), có test riêng cho ca lồng hai tầng khác currency.

Trường nào là tiền / là thời gian do vùng KHAI TƯỜNG MINH, không đoán theo
tên: `resource.purchase_units.0.amount` của PayPal là một OBJECT chứa `value`
dạng chuỗi decimal — đã đọc được sẵn, "đổi" nó là làm hỏng; `create_time` của
PayPal cũng đã là ISO. (An toàn kép: phép diễn giải chỉ chạy trên số.)

Giá trị đã đổi LUÔN in kèm số thô nhạt bên cạnh (`$117.00` · `11700`) — đây là
bề mặt đối soát, không có số gốc là bắt người ta tin phép đổi của ta.
Dùng lại `formatAmount`/`formatDateTime` của `bookings-view` để số tiền trong
drawer đọc ra cùng một kiểu với cột Amount của bảng.

⚠️ Một biên đã đo và ghi lại: ICU không phân biệt "mã ba chữ cái chưa được
gán" với "mã có thật" — `zzz` vẫn ăn mặc định 2 chữ số. Chấp nhận vì provider
chỉ gửi mã thật và số thô nằm ngay bên cạnh.

⚠️ **Chưa qua kiểm chứng bởi người ngoài.** Mục tiêu của đợt 6–7 là "người
non-coding đọc có hiểu không", mà cả người viết lẫn người duyệt đều đã biết
sẵn hai cột ấy nói gì — nhìn vào là hiểu, nên không tự đánh giá đúng được
(user nêu 03/09). Sẽ có thành viên khác trong nhóm thử rồi mới kết luận. Nếu
phải sửa thì rẻ: toàn bộ chữ nằm ở `messages.admin.paymentEvents.detail.payloadFields`
và `messages.admin.payload`, còn trường nào là tiền/thời gian thì khai ở
`PAYLOAD_HINTS` của vùng — đổi câu chữ không phải đụng component nào.

**Đợt 8 — `/bookings` mặc định lọc theo THÁNG HIỆN TẠI.** URL trần trước đây
hiện mọi booking từ đầu thời gian — một tập lớn dần vô hạn. User chốt 04/09
mặc định là trọn tháng dương lịch của hôm nay (4/9 → 01/09–30/09; 14/10 →
01/10–31/10), với lý do đắt hơn cả chuyện hiệu năng: **tool admin này còn dùng
để xuất file báo cáo hàng tháng**, nên mặc định theo tháng khớp đúng việc chính
nó phục vụ, và nút Export từ nay dựng ra đúng file của tháng thay vì cả tập.

Mặc định đặt ở **tầng parse** (`parseBookingsSearchParams(raw, now)`), không ở
hàm dựng href — đúng đường F10 subscribers đã trả giá: bản đầu bên đó đặt mặc
định lúc điều hướng, nên URL trần từ bookmark rơi về "tất cả" và file export
khác hẳn cái đang thấy trên màn hình. Trang và route export ở đây gọi CÙNG một
hàm nên không đường nào lệch được. `now` là THAM SỐ chứ không đọc trong hàm:
hàm vẫn thuần và test được mọi tháng.

Ba trạng thái, "cái cụ thể hơn thắng": có ngày trên URL (dù chỉ một đầu) → dùng
đúng thứ người ta viết, KHÔNG độn nốt đầu kia; `?dates=all` → không lọc;
URL trần → tháng này. Ngày rác và `dates` rác đều rơi về **tháng này** chứ
không về "tất cả" — mở toang cả tập vì một ký tự gõ nhầm là đắt hơn nhiều.
Ngày cuối tháng tính bằng lịch (`Date.UTC(y, m + 1, 0)`), không bảng chép tay,
nên năm nhuận tự đúng.

Đường về "xem tất cả" là **xoá trắng hai ô ngày** → URL mang `?dates=all`
(user chốt). Không có sentinel này thì không ai về được: xoá xong ra URL trần,
rồi bị parse độn lại đúng cái vừa xoá. Sentinel bookmark được và truyền sang
route export được — cùng cách F10 viết `?active=all`.

**Lưới an toàn cho ca tra cứu.** Ba bộ lọc cộng dồn AND, nên khách gọi báo mã
booking tạo từ tháng trước là bảng RỖNG — người trực sẽ kết luận "không có
booking đó", trong khi thủ phạm là hai ô ngày họ chưa từng đụng. Nên ô rỗng
nay nói thẳng khoảng ngày đang lọc và mở sẵn một link "xem toàn bộ" ngay tại
chỗ. Kit `DataTableBody.empty` nới từ `string` sang `ReactNode` để đặt được
link ấy — chuỗi vẫn là `ReactNode` nên chín vùng còn lại không phải đổi gì.

⚠️ **Hai điều đã nêu, user biết và chấp nhận:** (a) hai ô lọc theo `createdAt`
— ngày TẠO booking, không phải ngày khởi hành; booking tạo 20/8 cho chuyến
15/9 sẽ không nằm trong mặc định tháng 9. Đổi sang cột khởi hành là đụng
contract + `apps/api`, ngoài phạm vi nhánh này. (b) Hàng stat card dùng cửa sổ
CỐ ĐỊNH 28 ngày (`STATS_WINDOW_DAYS`), không ăn theo bộ lọc — ngày 4/9 thì card
tính 8/8–4/9 còn bảng tính 1/9–30/9. Không sai (card có caption ghi rõ kỳ của
nó) nhưng hai con số cạnh nhau trả lời hai câu hỏi khác nhau.

`ToolbarSelect` KHÔNG bị thay: nó ở lại kit với hai consumer còn lại là nhánh
mobile của `StatusFilterTabs` và ô đổi trạng thái `/enquiries` — cái sau là
control GHI chứ không phải lọc. Hai control cùng sống, mỗi cái một việc.

### Nghiệm thu 04/09 — review 8 mũi → 10 findings (8 CONFIRMED · 2 PLAUSIBLE), vá bốn phần trong `b2eb60b`

- **Cụm mặc định tháng `/bookings`**: xoá ngày bằng chuỗi rỗng nay phát cờ
  `dates=all` như `null` (test cũ từng khoá kỳ vọng sai); link "Back to
  bookings" trỏ `?dates=all` để booking vừa xem không biến khỏi bảng; bỏ
  `min`/`max` chéo hai ô ngày (mặc định tháng làm lịch xám chặn lùi tháng);
  ô rỗng có câu riêng cho khoảng một đầu; audit export ghi `dates: all|range`.
- **Dialog/drawer**: trần chiều cao `DIALOG_FRAME` không che nút đóng nữa
  (`showCloseButton={false}` — nút X `absolute` trong phần tử cuộn từng trôi
  khuất) và áp cho dialog Refund; ruột drawer giữ qua animation đóng 450ms;
  vá nốt bản chép thứ 5 của khối dt/dd ở `/bookings/[code]`.
- **Nhãn/giá trị payload**: từ điển chỉ tra ĐƯỜNG DẪN đầy đủ (khoá trần từng
  áp mọi độ sâu — `resource.id` PayPal đọc thành "Event reference"), nhãn
  trung lập cho `data.object` (không còn giả định checkout session); KWD in đủ
  ba chữ số thay vì làm tròn qua `formatAmount`; cache `Intl.NumberFormat`;
  drawer chỉ nấu biểu diễn đang xem.
- **Kit**: giao ước giá trị lọc (sentinel All + tiền tố `v:`) về
  `kit/filter-value.ts`; spec vùng bỏ assertion chép của kit; spec P4c §2.6
  ghi ngoại lệ prop dữ-liệu-thuần một consumer. Để lại (nhỏ, có ghi):
  `unknownItem` chưa lên kit (hai vùng đặt mục lạ ở hai vị trí), JSDoc kể
  lịch sử ở 5 file, `LabelValueRow` chưa tách.

### Bàn giao — còn treo, gom một chỗ

Session chỉnh UI khép 04/09. Bốn thứ chưa xong, cố ý để lại:

1. **Chưa qua review 8 mũi.** Session gốc nghiệm thu bằng `git diff HEAD` rồi
   mới vá và merge. **15 file mới đã đánh dấu `git add -N`** để chúng hiện
   trong diff ấy (`git diff HEAD` không thấy file untracked) — `git reset` là
   gỡ được, chưa có commit nào vượt trước `origin/main`.
2. **Nhãn payload chưa qua mắt người ngoài** (đợt 6–7). Thành viên khác trong
   nhóm sẽ thử rồi mới kết luận; sửa thì rẻ vì toàn bộ chữ nằm ở
   `messages.admin.paymentEvents.detail.payloadFields` + `messages.admin.payload`.
3. **Bốn stat card của `/bookings` KHÔNG ăn theo bộ lọc** — và sau đợt 8 thì
   hai vùng trên cùng màn hình lệch nhau: card là cửa sổ TRƯỢT 28 ngày
   `[now−28d, now)`, bảng là THÁNG LỊCH. User hỏi tận nơi 04/09; ba đường xử
   lý, chi phí rất khác: (a) chỉ sửa caption cho nói rõ "28 ngày gần nhất" —
   rẻ, làm được trong nhánh này; (b) cho card nhận bộ lọc — phải thêm
   `.input()` vào `admin.stats.bookings` ở contract + sửa `stats.service.ts`,
   tức **đụng `apps/api` và `libs/shared/contract`**, cần nhánh riêng; (c) đổi
   cửa sổ card sang tháng lịch — cũng đụng `apps/api`, và làm hỏng phép so
   "kỳ trước cùng độ dài" ở mốc giao tháng. **Chưa chốt cái nào.**
4. **Ô ngày `/bookings` lọc theo `createdAt`, không phải ngày khởi hành.**
   Booking tạo 20/8 cho chuyến 15/9 không nằm trong mặc định tháng 9. Đổi cột
   là đụng contract + `apps/api` — cùng nhóm với mục 3.

Bảy glyph lucide mới (bell-ring · key-round · megaphone · rectangle-ellipsis ·
shapes · tags · timer-off) user đã xem danh sách và chốt GIỮ — không phải nợ.

Tests after (sau vá): 1417 web · 300 api · 316 api-int (không đụng `apps/api`) ·
186 contract · 22 ui · 10 tokens · 2 i18n · 682 admin (thêm 84: 10 kit
`toolbar-filter-menu`, 7 outbox, 5 payment events, 7 subscribers, 6 reports
menu, 4 `groupMonthOptions`, 2 kit `confirm-write-dialog`, 26
`payload-fields`, 5 kit `json-drawer`, 2 drawer payment events, 12
`bookings-query`).
