# Spec F16 — Giai đoạn của chuyến khởi hành

23/09/2026 · sinh ra từ lượt thử tay F14 trên production, làm chen trước F15
(điểm đến, plan đã sẵn). Quyết định kiến trúc nằm ở
[ADR-0046](../adr/0046-departure-phase-derived.md); spec này nói cách làm.

Đánh số **F16** — F15 vẫn giữ cho điểm đến.

## 1. Mục tiêu & phạm vi

### Vấn đề

Màn `/tours/[slug]/departures` in thẳng cột `status` làm trạng thái của chuyến.
Lượt thử tay 23/09 cho thấy hai cách đọc sai: chuyến đang chạy vẫn ghi *Open*,
còn chuyến đã về ghi *Closed* khiến người xem tưởng hệ thống tự đóng chuyến.
Bằng chứng đo trên DB production: ADR-0046 §Bối cảnh.

**Mục tiêu:** màn hình nói đúng chuyến đang ở đâu trong vòng đời, tự đổi theo
ngày, mà không thêm một nguồn sự thật thứ hai.

### Trong phạm vi

- Hàm thuần `departurePhase` cùng hai schema (`DeparturePhaseSchema`,
  `DeparturePhaseFilterSchema`) ở `@tourism/contract`.
- `AdminDepartureRow` thêm field `phase`, do server tính.
- `admin.departures.list` lọc theo **nhóm giai đoạn** (`phase`) thay cho `status`.
- Admin: huy hiệu theo giai đoạn (6 nhãn, kèm icon), 5 tab lọc, nút Close/Reopen
  ẩn từ ngày khởi hành.
- Copy tiếng Anh mới trong `@tourism/i18n`.

### Ngoài phạm vi, cố ý

| Không làm | Vì sao |
| --- | --- |
| Job/cron đổi trạng thái, cột hay enum mới, migration | ADR-0046 §Đã cân nhắc và loại |
| Đổi cổng tạo booking, câu SQL claim, bộ lọc chuyến của web | ADR-0046 §Điều này KHÔNG mở ra |
| Server chặn Close sau ngày khởi hành | ADR-0046: UI thôi mời bấm là đủ |
| Web, mobile | Đã tính theo ngày từ trước |
| Sửa seed (124 chuyến lịch sử ghi `CLOSED`) | Giai đoạn của chúng là `completed` bất kể cột ghi gì; lượt seed 2 (~03/11) cũng không cần đổi |
| Đổi thứ tự sắp theo tab (vd *Upcoming* gần nhất trước) | Chưa ai cần; mọi tab giữ `startDate desc` như hiện nay |
| Báo "tour chưa đăng" ngay trên màn chuyến | Đề xuất riêng, chưa duyệt — xem §7 |

## 2. Quyết định thiết kế

### 2a. Sáu giai đoạn

"Hôm nay" luôn là `vietnamToday(now)`. Xét từ trên xuống, dòng khớp đầu tiên
thắng:

| # | Điều kiện | Giai đoạn | Nhãn | Vì sao đứng ở vị trí này |
| --- | --- | --- | --- | --- |
| 1 | `status = CANCELLED` | `cancelled` | Cancelled | Chuyến đã huỷ thì ngày tháng không còn nghĩa gì |
| 2 | hôm nay > `endDate` | `completed` | Completed | Đã về — bất kể công tắc ghi gì |
| 3 | `startDate` ≤ hôm nay ≤ `endDate` | `departed` | Departed | Tính cả ngày đi lẫn ngày về |
| 4 | `status = CLOSED` | `closed` | Closed | Ý muốn của admin thắng hạn chót, nhưng chỉ ở chuyến chưa đi |
| 5 | `!isWithinDeadline(now, startDate, endDate)` | `deadline-passed` | Deadline passed | Cùng MỘT vị từ với cổng tạo booking (`assertDepartureBookable`) |
| 6 | còn lại | `on-sale` | On sale | `OPEN`, chưa đi, còn hạn |

Hai hệ quả phải giữ đúng:

- `on-sale` nghĩa là cổng tạo booking nhận chuyến này (xét riêng chuyến; tour
  chưa đăng là một trục khác — §7).
- **Ngày khởi hành đã là `departed`**, khớp hai cổng huỷ: khách huỷ online
  (`canCancelOnline`) và công ty huỷ chuyến (`departureCancelBlocker`) đều chỉ
  cho khi hôm nay < ngày đi. Cổng claim thì vẫn nhận khoản trả trễ trong chính
  ngày đó — cố ý (ADR-0046 mục cuối). Đừng đổi cổng claim cho "khớp".

Giá trị viết thường, nối bằng gạch ngang, theo hai nếp có sẵn cho giá trị SUY
RA: `ReviewModerationStateSchema` (viết thường) và mã lý do của claim
(`departure-closed`). Nhìn là biết chúng không phải giá trị enum trong DB (viết
hoa).

### 2b. Hàm và chỗ đặt

File mới `libs/shared/contract/src/schemas/departure-phase.ts`, export qua
`libs/shared/contract/src/index.ts`:

```ts
export const DeparturePhaseSchema = z.enum([
  'on-sale',
  'deadline-passed',
  'closed',
  'departed',
  'completed',
  'cancelled',
]);
export type DeparturePhase = z.output<typeof DeparturePhaseSchema>;

export function departurePhase(input: {
  status: AdminDepartureStatus;
  startDate: string; // YYYY-MM-DD, ngày lịch Việt Nam
  endDate: string;
  now: Date;
}): DeparturePhase;

export const DeparturePhaseFilterSchema = z.enum(['upcoming', 'departed', 'completed', 'cancelled']);
export type DeparturePhaseFilter = z.output<typeof DeparturePhaseFilterSchema>;

export const DEPARTURE_PHASE_FILTER_GROUPS: Readonly<
  Record<DeparturePhaseFilter, readonly DeparturePhase[]>
> = {
  upcoming: ['on-sale', 'deadline-passed', 'closed'],
  departed: ['departed'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};
```

- Tham số là MỘT object: `startDate` và `endDate` cùng kiểu chuỗi, truyền theo
  vị trí thì tráo nhau không ai biết.
- `AdminDepartureStatus` lấy bằng `import type` từ `admin-departures.ts`. File
  ấy lại import `DeparturePhaseSchema` từ đây, nên nếu hai chiều đều import giá
  trị thì thành vòng lặp module.
- So ngày bằng so chuỗi ISO (thứ tự từ điển trùng thứ tự thời gian — nếp của
  `departures-view.ts` và `assertNotInPast`). Luật 5 gọi thẳng
  `isWithinDeadline`, không tự so với `cancellationDeadline`.
- `now` là Invalid Date thì `vietnamToday` ném `RangeError`. Để nó ném.

### 2c. Server tính, admin chỉ hiển thị

- `toRow` trong `apps/api/src/modules/catalog/admin-departures.service.ts` nhận
  thêm `now: Date` và điền `phase`. Nó KHÔNG tự gọi `new Date()`: mọi chỗ gọi
  truyền mốc của chính lượt xử lý. `list` dùng một mốc cho cả lượt đọc;
  `create`, `update`, `setStatus` đã có sẵn `now`; `rowById(id, now = new Date())`
  vì đường huỷ chuyến F13 (`departure-cancel.service.ts`) gọi nó.
- Admin đọc `row.phase`, không tính lại bằng đồng hồ nào. `today` do trang đưa
  xuống vẫn dùng cho hai thứ gắn với hạn chót, như cũ: chữ "Passed" dưới cột
  hạn chót, và nút Reopen mờ.

Cờ của VM (`toDepartureRowVM` ở `apps/admin/src/lib/departures-view.ts`). Trong
bảng, `upcoming` là `DEPARTURE_PHASE_FILTER_GROUPS.upcoming.includes(row.phase)`
— tức chuyến còn thao tác được, đúng tập của tab *Upcoming*:

| Cờ | Công thức | So với trước |
| --- | --- | --- |
| `phase`, `phaseLabel` | `row.phase`, `t.phase[row.phase]` | thay `statusLabel` |
| `deadlinePassed` | `today > row.cancellationDeadline` | giữ |
| `canEdit` | `row.phase !== 'cancelled'` | tương đương |
| `showToggle` | `upcoming` | mới |
| `canClose` | `row.phase` là `on-sale` hoặc `deadline-passed` | trước là mọi hàng `OPEN` chưa huỷ |
| `canReopen` | `row.phase === 'closed' && !deadlinePassed` | tương đương |
| `canCancel` | `upcoming` | trước là `today < startDate`; nay theo cùng mốc với huy hiệu |
| `refundOutstanding` | như cũ, "đã huỷ" đọc từ `row.phase` | tương đương |

`status` vẫn nằm trong VM: nút công tắc cần nó để biết gửi `CLOSED` hay `OPEN`.

### 2d. Bốn tab lọc

`All · Upcoming · Departed · Completed · Cancelled`. Trên URL là
`?phase=upcoming`; All là không có tham số, và vẫn là tab mặc định.

API lọc TRONG BỘ NHỚ bằng chính `departurePhase`:

1. Đọc MỌI chuyến của tour (`DEPARTURE_SELECT`, `startDate desc, id asc`).
2. Tính giai đoạn với MỘT `now`, giữ các hàng thuộc nhóm của tab.
3. `total` là số hàng còn lại SAU lọc; cắt trang `[(page − 1) × limit, page × limit)`.
4. `bookingCounts` chỉ cho các hàng của trang — một câu gom nhóm như cũ.

Vì sao không dịch sang SQL: luật sẽ sống ở hai nơi (TS và SQL), và chỉ cần lệch
một dấu so sánh là tab nói khác huy hiệu. Mỗi tour chỉ có vài chục chuyến (lịch
2026 khoảng 10 chuyến mỗi tour), nên đọc hết không đáng kể.

URL cũ `?status=OPEN` hết nghĩa mà không ai ăn lỗi: admin bỏ qua tham số lạ và
rơi về All; API bỏ qua key lạ (Zod mặc định strip).

### 2e. Huy hiệu

Chỉ dùng biến thể có sẵn của `Badge` (luật 6). Luật màu gói trong một câu:
**xanh đặc = còn nhận tiền được**.

| Giai đoạn | `variant` | Icon (lucide) |
| --- | --- | --- |
| `on-sale` | `default` | `CircleCheckIcon` |
| `deadline-passed` | `outline` | `ClockIcon` |
| `closed` | `secondary` | `LockIcon` |
| `departed` | `outline` | `PlaneIcon` |
| `completed` | `secondary` | `FlagIcon` |
| `cancelled` | `destructive` | `BanIcon` |

- Hai cặp chung biến thể phân biệt bằng chữ và icon. Icon mang
  `data-icon="inline-start"` và `aria-hidden` (Badge có sẵn khe cho nó); nghĩa
  nằm ở chữ, không ở icon.
- `departurePhaseBadgeVariant(phase)` ở `departures-view.ts` (thuần, có test)
  thay `departureStatusBadgeVariant`. Bảng icon là một
  `Record<DeparturePhase, …>` ở `departures-table.tsx`, cùng nếp `STATUS_ICONS`
  hiện nay, để quên một giai đoạn là đỏ typecheck.
- Icon của tab: All `ListIcon` · Upcoming `CalendarClockIcon` · Departed
  `PlaneIcon` · Completed `FlagIcon` · Cancelled `BanIcon`.

### 2f. Nút theo giai đoạn

| Giai đoạn | Edit | Close / Reopen | Cancel departure |
| --- | --- | --- | --- |
| `on-sale` | có | Close | có |
| `deadline-passed` | có | Close — giữ, vì checkout mở trước hạn chót vẫn có thể đang dở | có |
| `closed` | có | Reopen, mờ khi đã qua hạn chót (như cũ) | có |
| `departed`, `completed` | có, để sửa nhầm lẫn; luật ngày ở server vẫn chặn như cũ | **ẩn** | ẩn (như cũ) |
| `cancelled` | không có nút nào (như cũ) | | |

Ô của nút bị ẩn **vẫn giữ chỗ cùng cỡ**, theo nếp ô giữ chỗ của nút huỷ (lượt
thử tay F14): một `span` `aria-hidden` mượn
`buttonVariants({ variant: 'outline', size: 'sm' })` cộng lớp `invisible`, chứa
icon và `StableLabel` với cùng `reserve` của nút thật để bề rộng trùng khít.
Không phải một `Button` bị ẩn.

### 2g. Copy (tiếng Anh, `messages.admin.departures`)

- `phase`: `'on-sale': 'On sale'` · `'deadline-passed': 'Deadline passed'` ·
  `closed: 'Closed'` · `departed: 'Departed'` · `completed: 'Completed'` ·
  `cancelled: 'Cancelled'`.
- `list.phaseFilter`: `upcoming: 'Upcoming'` · `departed: 'Departed'` ·
  `completed: 'Completed'` · `cancelled: 'Cancelled'`.
- Giữ nguyên `list.all`, `list.filterLabel` và tiêu đề cột "Status".
- Map `status` (OPEN/CLOSED/CANCELLED) hết chỗ dùng thì xoá — grep lại trước khi
  xoá.

## 3. Bề mặt API

Không thêm endpoint, không thêm mã lỗi. Controller truyền thẳng `input` xuống
service nên không đổi.

| Thứ | Trước | Sau |
| --- | --- | --- |
| `DeparturePhaseSchema`, `departurePhase()` | chưa có | mới, `schemas/departure-phase.ts` |
| `DeparturePhaseFilterSchema`, `DEPARTURE_PHASE_FILTER_GROUPS` | chưa có | mới, cùng file |
| `AdminDepartureRowSchema` | có `status` | có `status` và `phase` |
| `AdminDeparturesListQuerySchema` | lọc bằng `status` (ba giá trị công tắc) | lọc bằng `phase` (bốn nhóm) |
| Đầu ra `create`, `update`, `setStatus`, `cancel` | hàng không có `phase` | hàng có `phase` (cùng `toRow`) |
| URL admin | `?status=OPEN` | `?phase=upcoming` |

`AdminDepartureStatusSchema` vẫn export — hàng vẫn chở `status`.

### Bản đồ file

| Gói | File |
| --- | --- |
| contract | `schemas/departure-phase.ts` (mới) và spec · `schemas/admin-departures.ts` và spec · `index.ts` |
| i18n | `src/lib/messages.ts` |
| api | `modules/catalog/admin-departures.service.ts` · `admin-departures.int.spec.ts` |
| admin | `lib/departures-view.ts` · `lib/departures-query.ts` · `components/departures/departures-table.tsx` · `components/departures/departure-row-actions.tsx` · `app/(admin)/tours/[slug]/departures/page.tsx` (chỉ comment) · spec tương ứng và `departures-table.spec.tsx` (mới) |

## 4. Chỗ dễ sai

1. **Thứ tự luật là luật.** Đảo luật 2 với 3, hay đưa 4 lên trên 3, đều cho ra
   một bảng trông hợp lý mà sai ở biên. Test phải bắt được từng phép đảo (§5).
2. **Nửa đêm Việt Nam là 17:00 UTC hôm trước.** Test biên dùng
   `…T16:59:59.999Z` và `…T17:00:00.000Z`, không dùng giờ địa phương của máy.
3. **Ngày về vẫn là `departed`**; `completed` bắt đầu từ ngày sau đó.
4. **Ngày đi đã là `departed`**, khớp hai cổng huỷ. Cổng claim vẫn nhận khoản
   trả trễ trong ngày đó — không đổi cổng claim.
5. **Một mốc `now` cho mỗi lượt xử lý.** `list` lọc và in giai đoạn bằng cùng
   một `now`; `toRow` không tự gọi `new Date()`.
6. **`total` đếm SAU khi lọc**, không phải mọi chuyến của tour. Sai chỗ này thì
   phân trang in "trang 1/3" cho một tab chỉ có hai hàng.
7. **Không đụng vào cổng tiền.** `bookings.service.ts`, câu SQL claim và
   `catalog.service.ts` không đổi một dòng; diff chạm vào chúng là lý do trả
   review.
8. **Admin không tính giai đoạn.** Code `apps/admin` không gọi `departurePhase`
   — ngoại lệ duy nhất là helper dựng fixture trong test (§5).
9. **Ô giữ chỗ là `span`, không phải nút**, và phải `aria-hidden`.
10. **Fixture phải nhất quán.** Mọi `AdminDepartureRow` trong test nay cần
    `phase`, và typecheck sẽ chỉ ra từng chỗ. Đừng điền đại `'on-sale'` cho một
    hàng mà `today` đã qua ngày đi.

## 5. Kiểm thử

TDD trên logic thuần; mỗi test ghi rõ nó bắt đột biến nào.

**Contract — `departure-phase.spec.ts` (mới).** Bảng biên trên một chuyến 5 ngày
`2026-10-10 → 2026-10-14` (N = 7, hạn chót `2026-10-03`):

| `now` | Ngày VN | `status` | Mong đợi |
| --- | --- | --- | --- |
| `2026-10-03T16:59:59.999Z` | 03/10, 23:59 | OPEN | `on-sale` |
| `2026-10-03T17:00:00.000Z` | 04/10, 00:00 | OPEN | `deadline-passed` |
| `2026-10-09T16:59:59.999Z` | 09/10 | OPEN | `deadline-passed` |
| `2026-10-09T17:00:00.000Z` | 10/10 | OPEN | `departed` |
| `2026-10-14T16:59:59.999Z` | 14/10 | OPEN | `departed` |
| `2026-10-14T17:00:00.000Z` | 15/10 | OPEN | `completed` |
| `2026-10-01T05:00:00.000Z` | 01/10 | CLOSED | `closed` |
| `2026-10-05T05:00:00.000Z` | 05/10 | CLOSED | `closed` — Closed thắng quá hạn |
| `2026-10-10T05:00:00.000Z` | 10/10 | CLOSED | `departed` |
| `2026-10-20T05:00:00.000Z` | 20/10 | CLOSED | `completed` |
| `2026-10-01T05:00:00.000Z` | 01/10 | CANCELLED | `cancelled` |
| `2026-10-20T05:00:00.000Z` | 20/10 | CANCELLED | `cancelled` |

Thêm ba ca: chuyến 1 ngày `2026-10-10` (N = 1, hạn chót 09/10) ra `on-sale` ngày
09/10, `departed` ngày 10/10, `completed` ngày 11/10; `now` là Invalid Date thì
ném `RangeError`; sáu giai đoạn chia đúng một nhóm lọc mỗi giai đoạn (không giai
đoạn nào mồ côi khỏi tab, không giai đoạn nào nằm hai tab).

Đột biến phải chết: bỏ luật 1 · đảo luật 2 và 3 · `>=` ở luật 2 · `>` ở vế ngày
đi của luật 3 · đưa luật 4 lên trên luật 3 · bỏ luật 4 · lật dấu luật 5.

**Contract — `admin-departures.spec.ts`.** Hàng thiếu `phase` hoặc mang giá trị
lạ thì trượt; query nhận bốn nhóm và từ chối `'OPEN'`; key `status` cũ bị bỏ qua
chứ không ném.

**API — `admin-departures.int.spec.ts`.** Thay ca "lọc theo trạng thái" bằng một
`describe` riêng, có `beforeEach` chèn thêm bốn chuyến. Không thêm vào bộ
fixture chung, để ca "gần nhất trước" giữ nguyên:

| Chuyến | Ngày (so với hôm nay) | `status` | Giai đoạn |
| --- | --- | --- | --- |
| `RUNNING` | −1 → +1 | OPEN | `departed` |
| `ENDED_OPEN` | −10 → −8 | OPEN | `completed` — `OPEN` không giữ được chuyến đã về |
| `LAST_CALL` | +3 → +7 | OPEN | `deadline-passed` (5 ngày, N = 7) |
| `PAUSED` | +20 → +22 | CLOSED | `closed` (3 ngày, N = 3, còn hạn) |

Bộ chung có sẵn cho thêm: `BOOKED`, `FREE` ra `on-sale`; `PAST` ra `completed`;
`DEADLINE_GONE` (đi hôm nay) ra `departed`; `CANCELLED` ra `cancelled`.

Ca phải có:

- mỗi hàng mang đúng giai đoạn;
- từng tab trả đúng tập hàng, đúng thứ tự `startDate desc`, đúng `total` —
  *upcoming* là `FREE, BOOKED, PAUSED, LAST_CALL`; *departed* là
  `DEADLINE_GONE, RUNNING`; *completed* là `ENDED_OPEN, PAST`; *cancelled* là
  `CANCELLED`;
- phân trang trên tập đã lọc: `phase=upcoming&limit=2&page=2` ra
  `PAUSED, LAST_CALL`, `total` 4, `totalPages` 2;
- `phase` lạ → 400;
- `setStatus` đóng rồi mở lại `FREE` trả `closed` rồi `on-sale`.

**Admin.**

- `departures-view.spec.ts`: bảng cờ §2c cho cả sáu giai đoạn; `canReopen` tắt
  với `closed` đã quá hạn; biến thể huy hiệu cho sáu giai đoạn.
- `departures-query.spec.ts`: đọc `phase` hợp lệ; bỏ giá trị rác và `status` cũ;
  đổi tab đặt lại trang 1; xoá tab thì mất tham số.
- `departure-row-actions.spec.tsx`: `departed` và `completed` chỉ còn đúng một
  nút (Edit), ô công tắc là `span` `aria-hidden`; `deadline-passed` có Close bấm
  được và có Cancel; ca "đã khởi hành" cũ nay còn một nút thay vì hai.
- `departures-table.spec.tsx` (mới, theo khuôn `tours-table.spec.tsx`): năm tab
  đúng nhãn, bấm tab đẩy `?phase=…`; ô Status in nhãn giai đoạn.

Fixture admin dựng `phase` bằng `departurePhase` với `now` là 12:00 giờ Việt Nam
của `today` (`${today}T05:00:00.000Z`) — một helper test, để hàng và `today`
không bao giờ nói khác nhau.

## 6. Definition of done

- `pnpm gate:int` xanh trên nhánh `feat/departure-phase`, kèm số test từng gói.
- Review ở session gốc, vá hết phát hiện; rebase lên `main` rồi
  `git merge --ff-only`; CI trên `main` xanh.
- Entry `docs/CHANGELOG.md` viết đúng NGÀY MERGE (rebase đổi ngày commit, và
  `docs-freshness` so theo ngày ấy); plan có mặt trong `docs/README.md`.
- Thử tay trên production sau khi CẢ Render lẫn Vercel deploy xong, từng bước,
  chờ xác nhận. Phải thấy: chuyến đang chạy hiện *Departed*; chuyến seed đã về
  hiện *Completed*; tab *Upcoming* không còn chuyến nào đã đi; hàng *Departed* và
  *Completed* không còn nút Close/Reopen mà cột nút vẫn thẳng.
- Không migration, không đổi env, không đụng hạ tầng sống (luật 15) — tính năng
  này không cần gì từ hạ tầng.

## 7. Rủi ro đã biết

- **Khe deploy.** Vercel thường xong trước Render. Trong vài phút giữa hai mốc,
  admin mới đọc API cũ: hàng chưa có `phase`, huy hiệu có thể trống hoặc trang
  lỗi. Chỉ admin thấy, không chạm tiền; thử tay chỉ bắt đầu khi cả hai đã xong.
  Chiều ngược lại vô hại: API mới bỏ qua `status` mà admin cũ gửi.
- **Trang để mở qua nửa đêm Việt Nam** in giai đoạn cũ tới khi refresh — y như
  cột hạn chót hiện nay.
- **Lọc trong bộ nhớ** hợp với vài chục chuyến mỗi tour. Tour nào tiến tới hàng
  nghìn chuyến thì dịch sang SQL, kèm một test đối chiếu hai bản luật.
- **Tour chưa đăng vẫn hiện *On sale*.** Giai đoạn chỉ tả chuyến; đăng hay chưa
  là công tắc cấp tour, hiện ở `/tours`. Đề xuất riêng, chưa duyệt, chưa làm:
  một dòng nhắc dưới tiêu đề màn chuyến khi tour chưa đăng — cần thêm
  `isPublished` vào `AdminDepartureTourSchema`.
