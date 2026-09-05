# ADR-0028 — Stat card `/bookings` ăn theo bộ lọc ngày của admin

- **Trạng thái:** Accepted (2026-09-04)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [spec P4b §3-F5](../specs/2026-08-31-p4b-admin-ready-areas-design.md)
  (khai sinh cửa sổ 28-ngày-đôi) · [spec P4c](../specs/2026-09-02-p4c-operations-design.md)
  §3-F7…F10 (sáu vùng stats còn lại, ADR này **không** đụng) ·
  `libs/shared/contract/src/schemas/reports.ts` (lý do tách `admin.reports.monthly`
  khỏi `admin.stats.*` — ADR này **sửa một phần**, xem §Hệ quả)

## Bối cảnh

Vòng chỉnh UI 04/09 đặt bộ lọc ngày mặc định của `/bookings` về **trọn tháng
hiện tại**. Hàng stat card bên trên bảng thì vẫn tính trên **cửa sổ trượt 28
ngày** `[now − 28d, now)` — hằng số `STATS_WINDOW_DAYS`, cố định từ F5.

Nên từ 04/09, hai vùng trên **cùng một màn hình** trả lời hai câu hỏi khác nhau:

| Vùng | Kỳ đang tính (đọc ngày 04/09) |
| --- | --- |
| Hàng stat card | 08/08 → 04/09 |
| Bảng bên dưới | 01/09 → 30/09 |

Không có con số nào SAI — caption của card ghi rõ kỳ của nó. Nhưng người trực
đọc "Revenue $12,400" rồi nhìn xuống bảng tháng 9 sẽ cộng nhẩm ra một câu
chuyện không tồn tại. User hỏi tận nơi 04/09 và chốt: **card phải chuyển số
theo bộ lọc**, không cố định 28 ngày.

CHANGELOG 04/09 ("Bàn giao — còn treo", mục 3) đã liệt ba đường xử lý —
(a) chỉ sửa caption, (b) cho card nhận bộ lọc, (c) đổi cửa sổ card sang tháng
lịch — và để ngỏ. ADR này chốt **(b)**.

### Vì sao (a) và (c) không đủ

- **(a) chỉ sửa caption** trả lời câu "card đang nói về kỳ nào" nhưng không trả
  lời câu user thực sự hỏi: *xem thống kê của khoảng tôi vừa chọn*. Chọn
  01/07–31/07 thì card vẫn in số của 28 ngày gần nhất.
- **(c) đổi cửa sổ card sang tháng lịch** đúng cho đúng một ca (lọc trọn
  tháng) và hỏng cho mọi ca còn lại: bộ lọc là hai ô `<input type="date">` tự
  do, admin kéo 05/09–12/09 lúc nào cũng được.

## Quyết định

### 1. `admin.stats.bookings` nhận `.input({ from?, to? })`

Hai field **optional**, kiểu `CalendarDateSchema` — **đúng schema và đúng tên**
mà `admin.bookings.list` đang dùng cho hai ô ngày. Một chữ trên URL
(`?from=2026-09-01&to=2026-09-30`) nuôi cả bảng lẫn card; không có bản dịch
thứ hai để trôi lệch.

Thiếu **cả hai** → giữ nguyên hành vi cũ (cửa sổ trượt 28 ngày). Nhờ vậy:

- `?dates=all` (admin cố ý bỏ lọc — sentinel của `bookings-query.ts`) tự nhiên
  rơi về cửa sổ trượt, không cần tham số thứ ba;
- P4d dashboard sau này gọi `admin.stats.bookings()` không tham số vẫn chạy;
- thêm field optional là thay đổi **tương thích ngược** — bỏ nó đi thì không.

Sáu endpoint `admin.stats.*` còn lại **không đổi**. Trang của chúng chưa có bộ
lọc ngày nào, nên thêm input ở đó là thêm một tham số không ai gửi.

### 2. Kỳ trước = **đúng độ dài, lùi liền kề** — không phải tháng lịch trước

| Bộ lọc | Kỳ này | Kỳ trước |
| --- | --- | --- |
| `from=01/09` `to=30/09` | `[01/09, 01/10)` — 30 ngày | `[02/08, 01/09)` — 30 ngày |
| chỉ `from=05/09` | `[05/09, generatedAt)` | cùng độ dài, lùi liền kề |
| chỉ `to=30/09` | 28 ngày kết ở `01/10` | 28 ngày trước đó |
| không có gì | `[now − 28d, now)` | `[now − 56d, now − 28d)` |

Đây là chỗ ADR phải nói to nhất, vì nó **giữ** đúng bất biến mà
`schemas/stats.ts` luật #1 dựng lên: server trả CẢ HAI số, và pill delta chỉ
nói thật khi hai kỳ **dài bằng nhau**.

Cám dỗ là so với **tháng lịch liền trước** ("tháng 9 vs tháng 8") vì nó đọc
tự nhiên. Nhưng bộ lọc không phải bộ chọn tháng — nó là hai ô ngày tự do:

- lọc 05/09–12/09 (8 ngày) thì "tháng trước" là 31 ngày → pill in `↓74%` hoàn
  toàn bịa;
- kể cả khi lọc trọn tháng, tháng 2 (28 ngày) so tháng 1 (31 ngày) là một cú
  sụt ~10% sinh ra từ hư không. Đây **đúng** lý do `schemas/reports.ts` đã
  viện ra để tách `admin.reports.monthly` thành endpoint riêng thay vì nhét
  `{from,to}` vào `admin.stats.*`.

Cửa sổ lùi-liền-kề giữ được bất biến ấy với **mọi** khoảng admin kéo ra, kể cả
khoảng lẻ. Caption vì thế không nói "vs last month" mà nói thẳng ngày
(§4 dưới).

Hai ca một-đầu tồn tại vì `parseBookingsSearchParams` sinh ra được chúng
(khoảng ngược giữ `from`, bỏ `to`; admin cũng gõ được một ô). Quy tắc chung:
**độ dài kỳ này là bao nhiêu thì kỳ trước bấy nhiêu**. Với ca chỉ có `to`
không có đầu nào để đo, nên lấy đúng `STATS_WINDOW_DAYS` kết ở `to` — một
mặc định khai báo được, không phải một cửa sổ vô hạn.

### 3. Biên: nửa-mở `[00:00:00.000, +1 ngày 00:00:00.000)` — KHÔNG `23:59:59`

Ngày lịch → mốc đúng công thức `createdAtRange` mà bảng đang dùng, nên card và
bảng cắt **một nhát duy nhất**:

| | Mốc thường bị đề xuất | Mốc thật sự dùng |
| --- | --- | --- |
| Đầu kỳ | `01/09 00:00:01` | `01/09 00:00:00.000`, dấu `>=` |
| Cuối kỳ | `30/09 23:59:59` | `01/10 00:00:00.000`, dấu `<` |

Ghi lại đây vì cặp `00:00:01` / `23:59:59` **trông** đúng và sẽ còn được đề
xuất lại. Nó có hai kẽ hở thật:

- `00:00:01` bỏ rơi trọn giây đầu tiên — booking tạo lúc `00:00:00.412` thuộc
  ngày 1 nhưng không được đếm;
- `created_at` là `timestamp` **microsecond** của Postgres, nên `<= 23:59:59`
  (tức `.000000`) bỏ rơi mọi row từ `23:59:59.000001` tới `23:59:59.999999` —
  gần trọn một giây của ngày cuối kỳ, đúng khung giờ khách đặt tour nhiều.

Mốc `01/10 00:00:00.000` với dấu `<` không có kẽ nào **và** khít với kỳ tháng
10: không row nào bị đếm hai lần ở chỗ giáp ranh, cũng không row nào rơi vào
khe giữa hai kỳ. Cùng nếp nửa-mở với `statsWindow`, `monthWindow`,
`createdAtRange` — toàn bộ module này chỉ có MỘT luật biên.

**Không có giờ nào đi qua hợp đồng.** Contract nhận `YYYY-MM-DD`, URL mang
`YYYY-MM-DD`, caption in `Sep 1 – Sep 30`. Phép đổi ngày → mốc là chuyện của
tầng API, không phải thứ admin phải nghĩ tới.

Múi giờ: mốc là **UTC**, như mọi cửa sổ khác của module (`stats-math.ts`).
Chọn "01/09" nhận đúng những booking mà sổ audit của API gọi là ngày 01/09 —
nhất quán với cột `Created` mà bảng đang in, không theo giờ máy người xem.

### 4. `StatsPeriod` thêm `currentTo`; caption in ngày thật

Trước ADR này, cuối kỳ hiện tại **luôn** là `generatedAt` nên không cần phơi
riêng. Có bộ lọc thì hai mốc đó khác nhau (lọc tháng 7, đọc ngày 4/9), nên
`StatsPeriod` thêm `currentTo`. Client nhờ đó dựng được **cả hai** khoảng —
kỳ này `[currentFrom, currentTo)`, kỳ trước `[previousFrom, currentFrom)` — mà
vẫn không tự cắt một cửa sổ thời gian nào. Luật "client không tự tính kỳ" giữ
nguyên.

Hiển thị (user chốt 04/09 — "hiển thị rõ khoảng thời gian từ ngày nào đến ngày
nào"):

- **một dòng cho cả hàng card**, không lặp 4 lần: `Showing Sep 1 – Sep 30, 2026`;
- **caption từng card**: `vs $12,400 · Aug 2 – Aug 31, 2026`.

Nhãn khoảng in ngày CUỐI CÙNG nằm trong kỳ, không in mốc chặn: mốc là
`2026-10-01T00:00:00Z` nhưng ngày cuối là 30/09 — in thẳng mốc là nói dối
đúng một ngày ở mọi khoảng. Năm viết một lần ở cuối khi hai đầu cùng năm, và
đủ hai lần khi kỳ vắt qua giao thừa (`Dec 2, 2025 – Jan 1, 2026`): lọc tháng
1 thì kỳ trước rơi vào tháng 12 năm ngoái, và một nhãn `Dec 2 – Jan 1` không
nói ra điều đó là nhãn đánh đố. Ngày đọc theo **UTC**, cùng thước với cột
`Created` của bảng.

Ở chế độ không lọc, caption giữ nguyên câu cũ `vs $12,400 prior 28 days`: lúc
ấy cửa sổ **trượt** theo đồng hồ, in ngày cụ thể sẽ cũ đi từng phút.
`windowDays` vì thế ở lại contract (sáu vùng kia vẫn dùng), nhưng với kỳ do
admin chọn thì nó là **độ dài đã làm tròn**, không phải nguồn của câu chữ.

### 5. Cột lọc: **giữ `createdAt`** — chốt, không thêm `dateField`

Mục 4 của "Bàn giao — còn treo" hỏi có nên đổi hai ô ngày sang **ngày khởi
hành**. Chốt: **không**. Lý do user nêu 04/09, ghi nguyên vì nó là lý do
nghiệp vụ chứ không phải lý do kỹ thuật:

> Chúng ta đang thống kê các dòng bookings xuất hiện trong 1 tháng chứ không
> phải thống kê theo ngày khởi hành. Một khách có thể đặt tour từ tháng 9 và
> tour khởi hành tháng 10; thống kê phải theo ngày đặt thì mới chính xác.

Đặt tháng 9 cho chuyến tháng 10 vẫn là **doanh số tháng 9**. Đây cũng là cột
mà bảng đang sắp xếp (`createdAt desc`) và cột mà `newBookings` đang đếm — đổi
nó là đổi định nghĩa của cả ba thứ cùng lúc.

Không thêm tham số `dateField` "cho linh hoạt": một tham số không ai chọn là
một nhánh không ai test, và câu hỏi "tháng này có chuyến nào khởi hành" là câu
hỏi của một bề mặt khác (lịch khởi hành), không phải của sổ booking.

### 6. Điều KHÔNG được suy ra: một khoảng, vẫn hai cột

Card ăn theo bộ lọc **không** có nghĩa bốn con số cùng đếm trên một cột. Neo
của từng metric giữ **nguyên** như F5 định nghĩa:

| Metric | Neo | Ý nghĩa khi lọc 01/09–30/09 |
| --- | --- | --- |
| `revenue` | `paid_at` | tiền **về** trong tháng 9 |
| `paidBookings` | `paid_at` | số đơn đã thu tiền trong tháng 9 |
| `cancellationRate` | tập `paid_at` trên | % của chính tập ấy |
| `newBookings` | `created_at` | đơn **tạo** trong tháng 9 — cùng cột với bảng |

Nên booking tạo 28/08 mà trả tiền 02/09 sẽ **vào** `revenue` tháng 9 nhưng
**không** có trong bảng tháng 9. Đó là đúng — doanh thu là ngày tiền về, đã
ghi ở JSDoc `StatsService` từ F5 và ADR này không sửa. Cái ADR này sửa là
**cửa sổ**, không phải cột neo.

Nói ra vì đây là chỗ dễ đọc thành lỗi: "card ăn theo bộ lọc rồi mà số vẫn
không khớp bảng". Ba trong bốn card **cố ý** không khớp bảng, và luôn như vậy
kể từ F5.

## Hệ quả

### `reports.ts` bị sửa một phần — nhưng lý do gốc còn nguyên

JSDoc đầu `schemas/reports.ts` viết `admin.stats.*` "là kỳ này SO VỚI kỳ
trước" và không nhận `{from,to}`. Vế thứ hai nay sai với `bookings`. Vế thứ
nhất — cái **thật sự** biện minh cho việc tách endpoint — thì còn nguyên, và
ADR này giữ nó bằng cửa sổ lùi-liền-kề (§2).

`admin.reports.monthly` **không** bị thay thế: nó là tổng tuyệt đối của một kỳ
đóng cộng những con số card không có (phân rã trạng thái, tổng hoàn tiền), và
không cần ảnh chụp hàng đợi. Hai bề mặt vẫn trả lời hai câu hỏi. JSDoc
`reports.ts` phải sửa để trỏ về ADR này.

### Cache stats vẫn dùng được

Data Cache của Next key theo **URL**, mà `from`/`to` nằm trên query string →
mỗi khoảng một entry, TTL 60s, `ADMIN_STATS_TAG` vẫn `updateTag` được cả cụm
sau mỗi lệnh ghi. Không phải bỏ cache như F7–F10 (ở đó lý do là kẻ ghi nằm
ngoài admin, không phải chuyện tham số).

Chi phí: admin xem nhiều khoảng khác nhau thì nhiều entry hơn. Không đáng lo —
mặc định là tháng hiện tại nên đại đa số lượt truy cập chung một key.

### Chưa có index cho `paid_at`

Cửa sổ do admin chọn có thể lùi rất xa (`?from=2020-01-01`), trong khi cửa sổ
28 ngày trước đây luôn quét phần đuôi bảng. Vẫn **cố ý chưa thêm index** —
cùng ngưỡng đã khai ở JSDoc `StatsService`: xem lại khi `bookings` vượt ~10k
row. Nhắc ở đây để lần chạm ngưỡng đầu tiên biết chỗ mà tìm.

### Sáu vùng stats còn lại thành ra không đối xứng

Từ nay `admin.stats.bookings` có input còn sáu cái kia thì không. Chấp nhận:
trang của chúng chưa có bộ lọc ngày, và thêm input không ai gửi là nợ chứ
không phải tính năng. Ngày một vùng khác mọc bộ lọc ngày thì **lặp lại đúng
khuôn này** (`statsWindowFromRange` + `currentTo` đã dùng chung sẵn), đừng
phát minh cửa sổ thứ hai.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Chỉ sửa caption cho nói rõ "28 ngày gần nhất" | Rẻ nhất, và trung thực — nhưng không trả lời câu user hỏi. Chọn 01/07–31/07 thì card vẫn in số 28 ngày gần nhất. |
| Đổi cửa sổ card sang **tháng lịch** của bộ lọc | Đúng cho đúng một ca. Bộ lọc là hai ô ngày tự do; khoảng lẻ (05/09–12/09) không có "tháng" nào. |
| Kỳ trước = **tháng lịch liền trước** | Phá bất biến "hai kỳ dài bằng nhau" — nền móng khiến pill delta đáng tin. Tháng 2 vs tháng 1 là cú sụt 10% bịa. |
| **Bỏ** kỳ trước khi đang lọc (card thành số đơn) | An toàn nhưng mất pill delta ở **màn hình mặc định** — vì mặc định giờ CHÍNH LÀ có lọc (tháng này). Card mất hết xu hướng đúng lúc cần nhất. |
| Thêm `dateField=created\|departure` | Một tham số không ai chọn là một nhánh không ai test. "Tháng này có chuyến nào khởi hành" là câu hỏi của bề mặt lịch khởi hành, không phải sổ booking. |
| Dùng lại `admin.reports.monthly` cho hàng card | Hình dạng response khác hẳn (tổng tuyệt đối, không cặp hai kỳ, không ảnh chụp) và chỉ nhận trọn tháng — không phủ được khoảng lẻ. |

---

## AMEND 04/09 (cùng ngày, đợt điều chỉnh #2) — vùng thứ hai: `/cancellations`

ADR gốc đã hẹn: "ngày một vùng khác mọc bộ lọc ngày thì **lặp lại đúng khuôn
này**, đừng phát minh cửa sổ thứ hai". Đây là lần đầu áp dụng, và nó lộ ra hai
chỗ khuôn gốc **không phủ** — ghi lại để vùng thứ ba khỏi suy luận lại.

### 1. Cột lọc: `createdAt` — ngày khách GỬI yêu cầu

Cùng cột bảng đang sắp xếp, và cùng họ lý do với `/bookings`.

Không dùng `decidedAt` dù nó khớp tuyệt đối với hai card Approved/Denied: hàng
`REQUESTED` có `decidedAt` **null**, nên lọc theo cột ấy sẽ **quét sạch hàng đợi
đang mở khỏi bảng** ngay khi admin bật bộ lọc. Đó là xoá mất lý do tồn tại của
trang.

Hệ quả là cùng loại lệch đã chấp nhận ở §6: một khoảng, vẫn hai cột neo —
Approved/Denied đếm theo `decided_at` còn bảng lọc theo `created_at`. Ở đây sai
số NHỎ hơn `/bookings` nhiều vì vòng đời một request rất ngắn (khách gửi, admin
quyết trong vài ngày), nhưng ở biên tháng thì vẫn có.

### 2. Mặc định KHÔNG lọc ngày — cố ý KHÁC `/bookings`

`/bookings` mặc định trọn tháng hiện tại. `/cancellations` mặc định **không lọc
gì cả**. Hai trang không đối xứng, và đó là chủ đích:

- `/bookings` là **sổ** — người ta đọc nó theo kỳ, và "tháng này" là kỳ mặc
  định đúng đắn.
- `/cancellations` là **hàng đợi việc phải làm** — nó tồn tại để được DỌN SẠCH.
  Mặc định lọc tháng hiện tại sẽ giấu mất một request khách gửi tháng 8 mà tới
  giờ vẫn `REQUESTED`: không ai xoá nó, nhưng cũng không ai còn thấy nó. Một
  hàng đợi mà màn hình mặc định không hiện đủ là một hàng đợi sẽ có mục bị bỏ
  quên.

Hệ quả kỹ thuật dễ chịu: **không cần sentinel `?dates=all`**. Ở `/bookings`
sentinel ấy phải có vì URL trần bị độn tháng hiện tại, nên không có nó thì
không ai về lại được "xem tất cả". Ở đây URL trần CHÍNH LÀ xem tất cả — hai ô
ngày trống là trạng thái nghỉ, và xoá trắng chúng là đường về hiển nhiên.

Chưa lọc thì stat card giữ nguyên cửa sổ trượt 28 ngày như trước ADR này —
đúng nhánh "thiếu cả hai đầu" của `statsWindowFromRange`, không có mã mới.

### 3. Metric ẢNH CHỤP dưới một kỳ đã chọn: **cuối kỳ vs đầu kỳ**

Khuôn gốc chỉ nói về metric ĐẾM TRONG KỲ (cả bốn card của `/bookings` đều
vậy). `/cancellations` có `pendingQueue` là **ảnh chụp**: `current` = số hàng
`REQUESTED` *ngay bây giờ*, `previous` = hàng đợi dựng lại tại đầu kỳ. Lọc
tháng 7 mà card vẫn nói "hàng đợi bây giờ" thì nó tái lập đúng nghịch lý ADR
này sinh ra để dẹp — hai vùng trên một màn hình đo hai kỳ khác nhau.

Luật mới, áp cho mọi metric ảnh chụp về sau: **`current` là ảnh chụp tại
`window.currentTo`, `previous` tại `window.currentFrom`.** Card đọc thành "hàng
đợi đã dịch chuyển thế nào trong kỳ bạn đang xem".

Ba điều khiến luật này áp được ở đây mà không tốn gì:

- `pendingRequestsAt(at)` **đã tồn tại** và dựng lại được hàng đợi tại BẤT KỲ
  mốc nào — không cần cột mới, không migration.
- Dựng lại **chính xác** chứ không xấp xỉ, vì quyết định cancellation là chung
  cuộc: `decided_at` ghi một lần, append-only (spec P2 D1-B). Đây là thứ
  reviews (F5) và enquiries (F9) phải dựng bảng audit mới có, còn subscribers
  (F10) tới giờ vẫn không có.
- Với cửa sổ TRƯỢT, `currentTo === generatedAt === now`, nên
  `pendingRequestsAt(currentTo)` cho ra **đúng** `count(status = REQUESTED)` —
  hành vi khi chưa lọc không đổi một con số nào.

⚠️ **Lời hứa bị nới, có chủ đích.** JSDoc `StatsService` hứa `pendingQueue.current`
"đúng bằng số hàng của `/cancellations?status=REQUESTED`". Lời hứa ấy nay chỉ
còn đúng **khi chưa lọc ngày** — và đó chính là lúc nó có nghĩa. Đang xem tháng
7 thì con số đúng phải là hàng đợi cuối tháng 7, không phải hàng đợi hôm nay;
bảng bên dưới lúc ấy cũng đang nói về tháng 7.

### 4. Không đụng tới, cố ý

`search` cho `/cancellations`: contract chưa có, và đợt này không thêm. Tra
theo mã booking là nhu cầu thật nhưng nó là một tính năng riêng, không phải hệ
quả của việc cho card ăn theo bộ lọc.

## AMEND 2 04/09 (đợt điều chỉnh #4) — vùng thứ ba: `/reviews`

Vùng thứ ba, và là vùng đầu tiên **chưa có bộ lọc ngày nào cả** — hai lần
trước chỉ phải nối card vào một ô lọc đã tồn tại. Nên ở đây khuôn được áp đủ
cả hai vế: dựng bộ lọc, rồi cho card ăn theo.

### 1. Cột lọc: `review.created_at` — ngày review được GỬI

Cùng cột bảng đang sắp xếp (`orderBy [createdAt desc, id desc]`), cùng họ lý
do với hai vùng trước.

⚠️ **Ở vùng này độ lệch "một khoảng, hai cột" (§6) SÂU hơn hẳn, và phải nói
ra.** Card `approved` đếm LƯỢT DUYỆT trên audit trail, neo `event.created_at`;
bảng và `averageRating` neo `review.created_at`. Một review gửi tháng 6 mà tới
tháng 9 mới duyệt sẽ đếm vào Approved của tháng 9 nhưng **không bao giờ xuất
hiện** trong bảng lọc tháng 6.

Ở `/cancellations` sai số ấy nhỏ vì vòng đời một request chỉ vài ngày. Một
review thì có thể nằm hàng đợi vô thời hạn, nên độ lệch ở đây không có trần.

Vẫn chọn `created_at`, vì hai phương án kia tệ hơn:

- Neo card `approved` theo `review.created_at` là **phá chính bản chất của
  nó**: nó đo CÔNG VIỆC ĐÃ LÀM trong kỳ, không đo lô hàng nào được xử.
- Lọc bảng theo `moderated_at` là quét sạch mọi review CHƯA duyệt khỏi bảng
  (`moderated_at` null), tức xoá mất hàng đợi — đúng cái bẫy đã bác ở
  `/cancellations` §1.

Cách sống chung: card `approved` giữ nguyên nhãn nói rõ nó đếm lượt duyệt, và
`submitted` (§4) đứng ngay cạnh làm mẫu số neo ĐÚNG cột của bảng. Hai con số
cạnh nhau, một cái đo dòng vào một cái đo dòng ra, thì chuyện chúng không khớp
là điều đọc ra được chứ không phải một lỗi ngầm.

### 2. Mặc định KHÔNG lọc ngày — theo `/cancellations`, không theo `/bookings`

Cùng lập luận đã ghi ở AMEND 1 §2: `/reviews` là **hàng đợi việc phải làm**,
tồn tại để được dọn sạch. Mặc định lọc tháng hiện tại sẽ giấu mất một review
gửi tháng 8 mà tới giờ vẫn chờ duyệt.

Nên ở đây cũng KHÔNG có sentinel `?dates=all`: URL trần chính là xem tất cả.

### 3. Ảnh chụp `pending` theo luật AMEND 1 §3 — nhưng dựng lại là XẤP XỈ

`current` = ảnh chụp tại `window.currentTo`, `previous` tại
`window.currentFrom`. `pendingReviewsAt(at)` đã nhận bất kỳ mốc nào nên không
tốn mã mới.

Khác `/cancellations` ở một điểm phải ghi: phép dựng lại ở đó **chính xác**
(quyết định cancellation là chung cuộc, `decided_at` ghi một lần), còn ở đây
nó **xấp xỉ**. `moderated_at` chỉ giữ lần quyết định CUỐI, nên đúng một ca cho
sai: review hiện đang chưa duyệt, mà sau mốc đã đi qua **cả một lượt duyệt lẫn
một lượt gỡ** — lúc ấy tại mốc nó đang chờ, nhưng công thức đếm nó là không
chờ.

Ca ấy đòi hai sự kiện moderation sau mốc, trong đó có một lượt GỠ duyệt — hành
vi hiếm. Chấp nhận, không dựng bản chính xác trong đợt này.

⚠️ Nhưng ghi rõ chiều xấu đi: trước ADR này `pendingReviewsAt` chỉ được gọi với
mốc 28 ngày trước, còn từ nay `currentTo` có thể lùi hàng tháng — tức tập "sự
kiện sau mốc" lớn dần theo độ xa của bộ lọc. Ngày nào cần chính xác tuyệt đối
thì `review_moderation_events` có đủ lịch sử: trạng thái tại mốc là
`to_approved` của sự kiện cuối cùng TRƯỚC mốc, và trạng thái lúc sinh ra khi
chưa có sự kiện nào.

### 4. Card thứ tư: `submitted` — mẫu số đang thiếu

Ba card hiện có kể được *còn tồn bao nhiêu · xử bao nhiêu · chất lượng thế
nào*, nhưng thiếu vế đầu: **nhận về bao nhiêu**. Không có nó thì "duyệt 12" là
một con số không đọc được — 12 trên 12 hay 12 trên 300 là hai tình trạng khác
hẳn.

`submitted` = `COUNT(*)` review có `created_at` trong kỳ. Nó cũng làm lộ ra tập
mà `averageRating` đang tính trên: **cùng một tập**, cùng một cột neo. Hai card
ấy vì thế đứng cạnh nhau.

**AMEND 05/09 — hai card ấy nay TÁCH tập, có chủ đích.** Sau ADR-0031 tồn tại
trạng thái "đã bị bác", và một review 1 sao spam đã bị bác **vẫn kéo tụt**
`averageRating` dù không ai đăng nó lên. Nên `averageRating` bỏ review bị bác,
còn `submitted` giữ nguyên.

Chúng đo hai thứ khác nhau, và câu này là ranh giới: **`submitted` đo KHỐI
LƯỢNG VIỆC** (một review bị bác vẫn là một review có người phải đọc), **còn
`averageRating` đo Ý KIẾN** (nội dung đã bị phán quyết là không thật thì không
phải ý kiến của ai).

⚠️ KHÔNG suy ra được "vậy lọc luôn theo trạng thái duyệt": một review **đang
chờ** vẫn là ý kiến thật, chỉ chưa ai kịp đọc — lọc nó ra sẽ làm một hàng đợi
tồn đọng tự bóp méo con số mà chẳng khách nào đổi ý. Đó vẫn là lý do gốc của
§4, và nó không đổi.

Phép suy trạng thái + hai mệnh đề `where` chuyển sang
`modules/reviews/review-state.ts` cùng đợt: `stats.service` nay cũng phải biết
luật ấy, và một bản chép thứ hai là một bản sẽ trôi lệch.

Không chọn "lượt GỠ duyệt" làm card thứ tư dù nó đối xứng với `approved` và
hiện đang vô hình: đó là hành vi hiếm, nên card sẽ đứng yên ở 0 gần như mọi
lúc — một ô màn hình không kể gì. Audit trail vẫn giữ đủ dữ liệu nếu ngày nào
cần.

### 5. Không đụng tới, cố ý

`source` (VERIFIED/CURATED) và `rating` đã được `adminList` lọc thật nhưng
chưa có đường nào từ UI tới. Đó là việc của TOOLBAR, không phải của stat card,
và trộn vào đây sẽ làm một AMEND về kỳ thống kê gánh thêm một tính năng lọc —
tách đợt sau.

Hệ quả cần nhớ khi làm đợt ấy: `averageRating` **cố ý** không lọc theo nguồn,
nên khi toolbar có bộ lọc source, card ấy sẽ không ăn theo nó. Hoặc chấp nhận
và nói rõ trên nhãn, hoặc lúc đó mới quyết cho nó ăn theo.

