# Spec P4e-1 — Chuyến khởi hành và trạng thái đăng tour

21/09/2026 · mở màn **P4e catalog CRUD**, phase mà ADR-0026 §5 gọi là nặng
nhất. Đầu vào: [khảo sát parity admin 20/08](../analysis/2026-08-20-admin-parity-nexora.md)
§2 (*"khoảng cách lớn nhất là bề mặt GHI catalog — v2 chưa có endpoint ghi
nào"*) và món nợ [ADR-0041 §6](../adr/0041-single-cancellation-deadline.md):
công ty huỷ chuyến hoàn 100% mọi lý do, lõi đã viết sẵn nhưng **chưa có nút**.

Đánh số tính năng **F11–F13**, nối tiếp F1–F10 của P4b và P4c — cùng một dãy để
mỗi session thi công gọi tên được bằng một ký hiệu.

## 1. Mục tiêu & phạm vi

### Vì sao P4e-1 làm chuyến trước, không làm tour trước

P4e đầy đủ là CRUD cho tours · departures · categories · destinations · posts,
chạm tới bảy bảng chỉ riêng phần tour. Chốt 21/09: **chia theo vùng, dễ trước
khó sau** — P4e-1 chuyến và trạng thái đăng → P4e-2 danh mục và điểm đến →
P4e-3 tour CRUD → P4e-4 bài viết. Mỗi đợt một spec, demo được ngay.

Chuyến đi trước vì nó là vùng duy nhất đóng được một món nợ đang mở, và vì
CRUD kit của P4b đủ chín để làm chuyến mà không phải dựng gì mới.

### Trong phạm vi

- Trang `/tours` — danh sách 29 tour, công tắc bật/tắt đăng, cột chuyến sắp tới.
- Trang `/tours/[slug]/departures` — bảng chuyến, bốn thao tác: tạo · sửa ·
  đóng/mở lại · huỷ.
- Bảy endpoint `admin.tours.*` và `admin.departures.*`.
- Hàng đợi hoàn tiền khi công ty huỷ chuyến.

### Ngoài phạm vi, cố ý

| Không làm | Vì sao |
| --- | --- |
| Tạo · sửa · xoá **tour** | P4e-3 |
| Nội dung bán hàng, lịch trình, FAQ, chính sách của tour | P4e-3 |
| Chọn ảnh cho tour hay chuyến | Cần media library, P4f |
| Template email riêng cho "công ty huỷ chuyến" | Dùng lại `BOOKING_CANCELLED` sẵn có; thêm loại email là thêm một vòng copy mà nội dung gần trùng |
| Ngoại lệ `N` theo từng chuyến (ADR-0041 §2 để ngỏ) | Chưa ai cần. Luật là "chỉ được hạ `N`" nếu sau này thêm |
| Trang `/departures` phẳng cho toàn bộ tour | Đổi bản đồ sidebar đã duyệt ở P4a. Cột chuyến sắp tới ở `/tours` trả lời được câu hỏi lịch chạy; bí thật thì P7 tách riêng, lúc đó đã có dữ liệu dùng thật để biết có đáng không |

## 2. Quyết định thiết kế

### 2a. Màn lồng dưới tour, không phải vùng phẳng riêng

`nav.ts` từ P4a đã ghi: *"departures nằm LỒNG dưới tours (như bản cũ — trang
con `/tours/[slug]/departures`)"*. Giữ nguyên cấu trúc đó; mục `tours` trong
nhóm Content đổi `enabled: false` → `true`.

Nhượng bộ cho vận hành: `/tours` có **cột "chuyến sắp tới"** đếm số chuyến còn
mở trong khoảng lọc, cộng bộ lọc tháng khởi hành. Người điều hành hỏi "chuyến
nào tuần sau còn trống" trả lời được từ màn danh sách, không phải bấm vào 29
tour.

### 2b. Đổi ngày chuyến: chặn khi đã có booking

`Booking` lưu **bản sao** `departureStartDate` và `departureEndDate` tại thời
điểm đặt, và ADR-0041 tính hạn huỷ từ bản sao trên booking chứ không từ chuyến
(`cancellationBlocker` gọi `calendarDate(booking.departureStartDate)`). Nên đổi
ngày chuyến mà không đồng bộ xuống booking là tạo hai sự thật: web hiện ngày
mới, hạn huỷ của khách neo theo ngày cũ.

**Quyết định: chặn đổi ngày khi chuyến đã có booking ở trạng thái sống**
(`PENDING`, `PAID`, `PARTIALLY_REFUNDED`). Chuyến chưa ai đặt thì sửa ngày
thoải mái — đó mới là ca hay gặp khi đang dựng lịch.

Đã cân nhắc rồi loại: (b) cho đổi và đồng bộ xuống mọi booking — dời sớm lên là
âm thầm rút ngắn quyền huỷ của người đã trả tiền; (c) như (b) cộng email báo
khách — đúng nghiệp vụ nhất nhưng kéo theo một loại email mới và một vòng copy,
mà nhu cầu dời chuyến chưa từng phát sinh.

**Bất biến mới:** hạn huỷ không bao giờ xấu đi sau khi khách đã trả tiền.

### 2c. Hạ ghế: từ chối ở tầng API, không để lộ lỗi ràng buộc

CHECK `departures_seats_within_total` chặn ở tầng dữ liệu, nhưng lỗi 23514 phơi
lên màn hình là vô nghĩa với người dùng. API kiểm trước và trả thông báo đọc
được: *"chuyến đã có 12 khách, không hạ dưới 12"*. CHECK giữ nguyên vai backstop.

### 2d. Công ty huỷ chuyến KHÔNG dùng phép tính tiền của khách

`refundOnCancelForBooking` trả `0.00` khi đã quá hạn chót. Nhưng ADR-0041 §6
nói công ty huỷ thì hoàn **100%, mọi lý do** — kể cả huỷ trước ngày đi 2 ngày
trên tour có `N = 7`. Nên đường `operator` bỏ qua phép tính theo hạn chót và
luôn lấy **trọn phần chưa hoàn**; `expectedRefundAmount` đặt bằng chính
`refundAmount` vì không có hộp xác nhận từng booking để so.

`cancellationBlocker` **giữ nguyên**: nó chặn khi đã tới ngày khởi hành, và
chặn đúng — huỷ một chuyến đã đi là thao tác nhầm.

**Bất biến mới:** công ty huỷ chuyến luôn hoàn trọn phần chưa hoàn.

Thi công: `CancelInLockInput.initiator` hiện khai kiểu `'customer'`; mở thành
`'customer' | 'operator'` và nhánh chọn `refundAmount` rẽ theo đó. Lõi
`cancelInLock` đã nhận `decidedById` và `refundAmount` làm tham số chính vì lý
do này — không viết đường hoàn thứ hai.

### 2e. Hoàn tiền hàng loạt qua hàng đợi, một job mỗi booking

Một chuyến có `seatsTotal` cỡ 20, nên huỷ chuyến có thể phải gọi cổng thanh
toán 20 lần. Fastify `requestTimeout` là 30 giây (ADR-0024 AMEND 3) — chạy đồng
bộ là chắc chắn treo.

**Đồng bộ, trong một transaction:**

1. Khoá chuyến, đổi `status` → `CANCELLED`.
2. Chụp danh sách booking của chuyến theo ba nhóm: `PAID`/`PARTIALLY_REFUNDED`
   (phải hoàn) · `PENDING` (chỉ huỷ, chưa thu đồng nào — đúng ADR-0006) ·
   `CANCELLED`/`REFUNDED` (bỏ qua).
3. Huỷ ngay nhóm `PENDING` và trả ghế.
4. Đẩy **một job cho mỗi booking** nhóm phải hoàn.

Request trả về ngay, không chờ cổng.

**Trong hàng đợi, mỗi job một booking:** gọi `cancelInLock` với
`initiator: 'operator'`, `refundAmount` = trọn phần chưa hoàn, `decidedById` =
admin đã bấm. Khoá chống trùng lấy theo `capture` như đường hiện có nên job
chạy lại vẫn an toàn. Email `BOOKING_CANCELLED` đi qua outbox sẵn có.

**Một job mỗi booking, không phải một job mỗi chuyến:** một booking lỗi cổng
thì chỉ mình nó retry, không chặn 19 booking còn lại.

**Queue mang payload là mẫu mới trong repo.** Cả năm queue hiện có
(`outbox-drain`, `outbox-purge`, `booking-sweep`, `enquiry-retention`,
`media-gc`) đều chạy theo cron hoặc nudge **không tham số**. Đây là job đầu
tiên mang `bookingId`, và cũng là job đầu tiên THẬT SỰ cần retry — bốn queue
kia đặt `retryLimit: 0` vì lượt cron kế tiếp là đủ, còn ở đây bỏ một lượt là
một khách không được hoàn tiền. Khai `policy` và `retryLimit` tường minh,
đừng để mặc định.

### 2f. Trạng thái trung gian là có thật, và phải nhìn thấy được

Chuyến đã `CANCELLED` nhưng tiền chưa hoàn xong kéo dài vài giây tới vài phút,
lâu hơn nếu cổng lỗi. Bảng chuyến hiện **tiến độ ngay tại hàng** —
*"đã hoàn 12/15"* — đọc từ đếm booking, không cần bảng mới. Job kẹt thì con số
đứng yên; `/payment-events` là nơi tra chi tiết.

Ghế trả lại theo cơ chế cũ: mỗi job trả ghế của booking mình. Con số `seats_booked`
tụt dần chính là thứ nuôi cột tiến độ.

### 2g. Bust cache web sau khi transaction commit

`WebRevalidationService` đã có, tiền lệ ở `reviews.service.ts`: gọi
`void this.webRevalidation.revalidate(tags)` **sau** commit. Taxonomy tag hiện
là `tours` và `tour:<slug>` (`apps/web/src/lib/api/tags.ts`).

| Endpoint | Tag bust |
| --- | --- |
| `setPublished` | `tours` và `tour:<slug>` |
| `create` · `update` · `setStatus` · `cancel` | `tour:<slug>`, cộng `tours` nếu chuyến đó nuôi giá hiển thị ở card danh sách |

`cancel` gọi revalidate ngay sau transaction đồng bộ, **không** đợi hàng đợi
hoàn tiền xong: chuyến phải biến mất khỏi web lập tức, chuyện tiền là việc phía
sau.

### 2h. Bất biến phải giữ nguyên

Bốn cái đã có:

1. Sổ `refunds` chỉ-ghi-thêm; cổng thanh toán trước, ghi sổ sau.
2. Một advisory lock cho mọi đường hoàn của một booking — đường operator dùng
   chung lock với đường khách.
3. Trigger `SUM(refunds) ≤ total_amount`.
4. Khoá chống trùng xác định cho mọi lệnh gửi cổng.

Hai cái mới, đã nêu ở 2b và 2d.

## 3. Cắt tính năng — 1 tính năng = 1 session thi công

| # | Tính năng | Nhánh | Chạm tiền |
| --- | --- | --- | --- |
| F11 | `/tours` danh sách + công tắc đăng | `feat/p4e-tours-list` | không |
| F12 | Bảng chuyến + tạo · sửa · đóng/mở | `feat/p4e-departures-crud` | không |
| F13 | Huỷ chuyến qua hàng đợi | `feat/p4e-departure-cancel` | **có** |

**Thứ tự và song song.** F11 và F12 chạm file khác nhau và chạy song song được;
F13 phải đợi F12 vì nút huỷ gắn vào bảng chuyến. Hai chỗ F11 và F12 cùng đụng —
`libs/shared/contract/src/contract.ts` (thêm nhánh `admin.tours` và
`admin.departures`) và `apps/admin/src/lib/nav.ts` (bật mục `tours`) — nên
session nào merge sau phải rebase và xử lý xung đột ở đúng hai file đó.

### F11 — `/tours` danh sách + công tắc đăng

**Endpoint:** `admin.tours.list` · `admin.tours.setPublished`.

`list` trả mỗi tour: id, slug, tiêu đề, danh mục, `basePrice`, `isPublished`,
`isFeatured`, ảnh hero (dùng đường dựng URL của ADR-0005), và **số chuyến còn
mở** trong khoảng lọc. Lọc theo danh mục · trạng thái đăng · tháng khởi hành;
phân trang theo nếp `admin.bookings.list`.

`setPublished` nhận `{ id, isPublished }`, trả tour sau khi đổi, bust `tours`
và `tour:<slug>`.

**Màn:** bảng CRUD kit, công tắc ngay tại hàng (optimistic, hoàn nguyên khi
lỗi), hàng bấm được để sang trang chuyến.

**Ba chỗ dễ sai:** đếm chuyến còn mở phải theo **khoảng lọc** chứ không phải
toàn bộ lịch sử · tắt đăng một tour đang có booking sống là hợp lệ và không
được chặn (khách đã mua vẫn đi, chỉ thôi chào bán) · bust cache sau commit,
không trong transaction.

### F12 — Bảng chuyến + tạo · sửa · đóng/mở

**Endpoint:** `admin.departures.list` · `create` · `update` · `setStatus`.

`list` trả mỗi chuyến: id, ngày đi, ngày về, giá áp dụng (`priceOverride` hoặc
`basePrice` của tour), `seatsBooked`/`seatsTotal`, `status`, **hạn chót huỷ**
tính bằng `cancellationDeadline`, và số booking sống — con số này nuôi cả luật
chặn đổi ngày lẫn cột tiến độ của F13.

`create`: ngày về ≥ ngày đi · không tạo chuyến có ngày đi trong quá khứ ·
`seatsTotal ≥ 1` · giá để trống thì lấy `basePrice` của tour.

`update`: sửa giá và ghế tự do trong ràng buộc 2c; **sửa ngày chỉ khi chưa có
booking sống** (2b), vi phạm thì trả mã lỗi riêng để màn in đúng câu.

`setStatus`: `OPEN ↔ CLOSED`. Mở lại chỉ được khi chưa qua hạn chót. **Không**
nhận `CANCELLED` — huỷ là đường riêng của F13.

**Ba chỗ dễ sai:** `update` phải đọc số booking sống **trong cùng transaction**
với phép ghi, không đọc trước rồi ghi sau (bẫy
[read-then-write](../conventions/read-then-write-races.md)) · hạ ghế kiểm ở API
trước khi chạm CHECK · `setStatus` sang `CLOSED` không đụng booking nào.

### F13 — Huỷ chuyến qua hàng đợi

**Endpoint:** `admin.departures.cancel`, nhận `{ id, reason }` — lý do bắt
buộc, lên sổ.

**Hàng đợi:** một queue mới mang `{ bookingId, departureId, adminId }`, khai
`policy` và `retryLimit` tường minh, đăng ký trong `start-worker.ts` cạnh bốn
queue hiện có.

**Màn:** nút huỷ trong bảng chuyến, hộp xác nhận in **số chuyến và số khách bị
ảnh hưởng**, ô lý do bắt buộc. Sau khi bấm, hàng đổi sang `CANCELLED` kèm cột
tiến độ *"đã hoàn x/y"*.

**Ca lỗi:**

| Ca | Xử lý |
| --- | --- |
| Cổng thanh toán từ chối | Job retry theo `retryLimit`; hết lượt thì dừng, ghi `payment_events`, tiến độ đứng |
| Booking đã hoàn một phần | `refundAmount` = phần còn lại; trigger `SUM ≤ total` vẫn canh |
| Admin bấm huỷ hai lần | Lần hai thấy chuyến đã `CANCELLED` → từ chối, không đẩy job trùng |
| Chuyến đã tới ngày đi | `cancellationBlocker` chặn ngay ở bước xác nhận |
| Worker đang ngủ | Job nằm trong queue tới khi worker tỉnh — không mất, nhưng tiến độ đứng yên (xem Rủi ro) |

**Ba chỗ dễ sai:** đường operator **không** gọi `refundOnCancelForBooking` (2d)
· job phải idempotent vì pg-boss có thể giao lại · revalidate gọi ngay sau
transaction đồng bộ, không đợi hàng đợi.

## 4. Definition of done (mỗi tính năng)

- [ ] TDD trên logic thuần: luật hạ ghế · luật chặn đổi ngày · phép chọn
      `refundAmount` cho đường operator.
- [ ] Integration test (cần Postgres): huỷ chuyến có 3 booking hỗn hợp
      (`PAID` · `PENDING` · đã `CANCELLED`) vào đúng nhóm · job chạy hai lần
      không hoàn hai lần · hạ ghế dưới `seats_booked` bị từ chối ở tầng API
      chứ không phơi lỗi 23514.
- [ ] Component test (admin, jsdom): cột tiến độ · hộp xác nhận in đúng số
      khách · công tắc đăng/ẩn hoàn nguyên khi lỗi.
- [ ] `pnpm gate:int` trọn xanh (luật 11).
- [ ] Bust cache đúng tag, gọi sau commit.
- [ ] Comment code tiếng Việt (luật 8); copy người dùng thấy bằng tiếng Anh và
      nằm trong `@tourism/i18n` (luật 7).
- [ ] Entry CHANGELOG + cập nhật bản đồ nếu thêm tài liệu (luật 13).

## 5. Rủi ro đã biết

**Worker Render gói free ngủ sau 15 phút.** Worker và API chạy cùng image nhưng
là hai service. Nếu worker ngủ lúc admin bấm huỷ, job nằm trong queue tới khi
worker tỉnh: không mất dữ liệu, nhưng tiến độ đứng yên và admin không biết vì
sao. Chấp nhận cho đợt này — ngày bảo vệ thì cả hai service đều đang ấm — nhưng
màn nên có một dòng giải thích khi tiến độ không nhúc nhích quá lâu.

**Lượt seed lại prod khoảng 03/11** xoá mọi chuyến tạo tay trên production. Thử
nghiệm thoải mái trước mốc đó; đừng dựng lịch thật bằng tay rồi trông chờ nó
còn.
