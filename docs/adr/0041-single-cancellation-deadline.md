# ADR-0041 — Một hạn chót mỗi chuyến: ngừng nhận đặt và hết huỷ miễn phí cùng lúc

- **Trạng thái:** Accepted (2026-09-15, phiên brainstorming; ADR đi trước code,
  CHƯA thi hành)
- **Sửa đổi:** AMEND 1 (2026-10-08, cuối file) — chuyến đã bị công ty huỷ thì
  khách không tự huỷ được nữa; §6 thắng §4.
- **Bối cảnh:** [spec 15/09](../specs/2026-09-15-refund-deadline-design.md). Đóng
  mục CÒN TREO "chốt chặn đặt chỗ 3 ngày" (CHANGELOG 04/09).
- **Liên quan:** [ADR-0030](0030-refund-policy-tiers.md) (thay bảng bậc, ân hạn,
  badge) · [ADR-0029](0029-cancellation-approve-partial-refund.md) (thay luồng
  duyệt huỷ) · [ADR-0009](0009-refund-correctness.md) (giữ khoá và trigger; đổi
  thước ngày của AMEND 2) · [ADR-0023](0023-tour-merchandising-fields.md) (bỏ
  `freeCancellationDays`) · [ADR-0033](0033-financial-model.md) (sửa định nghĩa
  doanh thu) · [ADR-0002](0002-payment-gateway-refund-ledger.md) (sổ hoàn tiền
  append-only giữ nguyên) · [ADR-0006](0006-pending-lifecycle.md) (vòng đời
  PENDING giữ nguyên)

## Bối cảnh

Hoàn tiền đang có ba luật chạy trên hai chiếc đồng hồ: bảng bậc 100/50/25/0 và
badge `freeCancellationDays` đếm ngày tới khởi hành, còn ân hạn 24 giờ đếm từ lúc
trả tiền. ADR-0030 §3c bỏ giới hạn ân hạn theo ngày khởi hành vì trông vào một
chốt chặn đặt chỗ 3 ngày làm sau. Phân tích chốt chặn đó ngày 15/09 cho thấy ghép
nó vào ba luật cũ sinh năm xung đột (spec §1), cùng một gốc: **lời hứa hoàn tiền
kéo dài qua lúc chỗ không còn bán lại được**. Vá từng chỗ cần thêm 3–4 luật phụ.

Cùng đợt đo được hai lỗi độc lập với chốt chặn: thước ngày UTC cho tour badge 1
ngày hoàn 100% cả sau giờ đón khách, và dòng trấn an ở checkout lệch với số tiền
server hoàn.

User chốt ưu tiên: một luật gọn, không luật chồng luật; hoàn tiền rộng rãi; chấp
nhận viết lại code và đổi kế hoạch seed.

## Quyết định

### 1. Nguyên tắc

Chỗ còn bán lại được thì hoàn đủ; không bán lại được nữa thì không tự hoàn. Mọi
quyết định bên dưới suy ra từ câu này.

### 2. Một hạn chót cho mỗi chuyến, tự tính từ độ dài chuyến

- `L` = ngày về − ngày đi + 1; `N` = 1 khi `L` = 1, 3 khi `L` là 2 hoặc 3, 7 khi
  `L` ≥ 4.
- Ngày chót = ngày khởi hành − `N`, hết lúc 23:59:59 giờ Việt Nam.
- Không ai cấu hình `N`. Ngoại lệ cho từng chuyến, nếu P4e-1 thêm, chỉ được hạ
  `N`.

Vì sao theo độ dài: luật công khai trọn trong một câu, không cột nào phải nhập hay
chụp (booking đã lưu ngày đi và ngày về), và so với seed hiện tại mọi thay đổi
đều hạ `N`. Vì sao tối đa 7: bảng bậc cũ vốn coi "dưới 7 ngày" là hết hoàn, nên
kẹp ở 7 thì không tour nào hoàn ít hơn hiện nay, trừ hai ca ghi ở Hệ quả.

### 3. Ngừng nhận đặt đúng hạn chót

`bookings.create` và `bookings.checkout` chặn sau hạn chót. Thanh toán đang dở vẫn
được claim nhận (gate claim chỉ giữ "chuyến OPEN và chưa khởi hành"); booking đó
không còn huỷ miễn phí. Khách cần đi gấp dùng form hỏi đáp của tour.

### 4. Khách tự huỷ, xử lý ngay, cả trước lẫn sau hạn

- Áp cho booking PAID hoặc PARTIALLY_REFUNDED, tới hết ngày trước ngày khởi hành.
- Trong hạn: hoàn toàn bộ phần chưa hoàn. Quá hạn: không hoàn.
- Một giao dịch trong advisory lock của booking: gọi cổng thanh toán trước (khoá
  chống trùng `cancel:<bookingId>:<tổng đã hoàn>`), rồi một CTE ghi booking
  CANCELLED, yêu cầu REFUNDED do chính khách quyết, dòng sổ khi có tiền, trả chỗ,
  email `BOOKING_CANCELLED`.
- Lệnh huỷ mang số tiền khách đã thấy trong hộp xác nhận; số server tính trong
  khoá khác số đó thì trả `REFUND_AMOUNT_CHANGED` (409) và không ghi gì. Hạn chót
  có thể trôi qua giữa lúc mở hộp và lúc bấm, và khách không được huỷ với một con
  số chưa thấy (bổ sung sau review nhánh, 17/09).
- Bỏ luồng khách gửi yêu cầu, admin duyệt. Trước hạn, quyết định là tất định nên
  duyệt tay chỉ thêm độ trễ, mà độ trễ làm chỗ nhả sau hạn. Sau hạn, phần cần con
  người chỉ là ngoại lệ.

### 5. Ngoại lệ là hoàn tiền thiện chí

Ốm đau, việc gấp: khách liên hệ; admin dùng `admin.bookings.refund` (bắt buộc số
tiền và lý do lên sổ), áp được cả cho booking CANCELLED còn tiền chưa hoàn. Không
có luồng duyệt riêng.

### 6. Công ty huỷ chuyến: hoàn 100%, mọi lý do

Kể cả bất khả kháng; bỏ lời hứa đổi ngày. Nút làm ở P4e-1 trên màn quản lý chuyến,
gọi lại lõi huỷ của §4 với mức "hoàn toàn bộ". Đợt này viết sẵn lõi và sửa văn
bản pháp lý.

### 7. Mọi mốc ngày theo giờ Việt Nam, tính ở server

Đảo phần thước UTC của ADR-0009 AMEND 2: `start_date` là ngày lịch Việt Nam, và
với tour `N` = 1, độ lệch 7 giờ vượt qua giờ đón khách thật. Vẫn MỘT thước cho cả
Node (`Intl` với `Asia/Ho_Chi_Minh`) lẫn SQL (`AT TIME ZONE 'Asia/Ho_Chi_Minh'`).
Trạng thái "ngừng nhận đặt" và "còn huỷ miễn phí" do API hoặc phần render phía
server tính, không dùng giờ trình duyệt. Chuỗi theo ngày của dashboard (ADR-0036)
giữ UTC.

### 8. Luật là bộ hàm thuần ở `@tourism/contract`

Giữ tinh thần ADR-0030 §6: API, web, admin, seed và email gọi chung một bộ hàm;
văn bản `/cancellation-policy`, `/terms`, FAQ và dòng hạn chót sinh từ đó. SQL
không viết lại luật `N`.

### 9. Báo cáo: tiền giữ lại là doanh thu

Sửa ADR-0033: doanh thu = thu trừ hoàn của mọi booking đã trả, kể cả booking đã
huỷ; giá vốn biến đổi chỉ tính khách thực đi (booking đã trả, không CANCELLED).
Báo cáo tháng đổi cặp approved/denied thành huỷ trong hạn và huỷ quá hạn.

## Hệ quả

### ADR bị thay hoặc sửa

| ADR | Phần bị ảnh hưởng | Sau ADR này |
| --- | --- | --- |
| 0030 | Bảng bậc, ân hạn 24 giờ, badge nâng ngưỡng, `OFF_POLICY_NOTE_REQUIRED` | Thay hết. Giữ: một nguồn luật ở contract (§6 của 0030); hoàn thiện chí bắt buộc số tiền và lý do (AMEND 1–2) |
| 0029 | Luồng request → approve/deny, stepper, chặn `CANCELLATION_OPEN` | Thay. Giữ khuôn kỹ thuật: gọi cổng thanh toán trong khoá, một CTE, hoàn 0 không ghi sổ nhưng vẫn huỷ và trả chỗ |
| 0009 | Thước ngày UTC (AMEND 2) | Đổi sang giờ Việt Nam. Advisory lock, trigger `SUM ≤ total`, gate claim theo trạng thái chuyến giữ nguyên |
| 0023 | Cột `free_cancellation_days` | Xoá, bằng migration chạy sau khi code mới đã sống |
| 0033 | Định nghĩa doanh thu, giá vốn biến đổi | Như §9 |

### Bất biến giữ nguyên

- Sổ `refunds` append-only; cổng thanh toán trước, sổ sau.
- Một advisory lock cho mọi đường hoàn của một booking; trigger
  `SUM(refunds) ≤ total_amount`.
- Khoá chống trùng xác định cho mọi lệnh hoàn gửi provider.
- `CANCELLED` là trạng thái tường minh, không suy từ sổ.
- Các luồng tự hoàn khi thanh toán: overbooked, departure-closed, orphaned
  capture.

### Bất biến mới

- Không tạo và không mở lại trang thanh toán cho booking sau hạn chót của chuyến.
- Mỗi lần khách huỷ có đúng một yêu cầu REFUNDED; huỷ trong hạn có đúng một dòng
  hoàn bằng phần còn lại, huỷ quá hạn không có dòng hoàn.
- Không phát sinh yêu cầu REQUESTED hay DENIED mới.

### Cái giá

- Tụt 100% → 0% ngay sau hạn chót; bù bằng ngày chót hiển thị ở mọi điểm chạm và
  hoàn thiện chí cho ngoại lệ.
- So với luật cũ có hai ca hoàn ít hơn: đặt đúng ngày chót rồi huỷ hôm sau trong
  24 giờ (ân hạn cũ cho 100%), và yêu cầu gửi trong khung 00:00–06:59 giờ Việt
  Nam (thước UTC cũ đếm dư một ngày; đây là sửa lỗi).
- Mất sắc thái riêng từng tour (vé hang động đặt trước, cabin du thuyền).
- Viết lại rộng: contract, API, web, admin (gỡ vùng Cancellations), seed, test,
  văn bản pháp lý; hai migration; deploy phải có thứ tự (API trước web và admin)
  và seed lại prod.
- Công ty huỷ chuyến chưa có nút cho tới P4e-1.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ bảng bậc, thêm chốt chặn, vá năm xung đột | Thêm 3–4 luật phụ |
| Chỉ bỏ ân hạn, không làm chốt chặn | Quay lại lỗi người đặt muộn không bao giờ được 100% |
| Tour dài giữ mốc 10–30 ngày, hoặc tách hai mốc | Ngừng nhận đặt quá sớm, hoặc booking sinh ra đã không hoàn được và khách phải hiểu hai ngày |
| N nhập tay cho từng tour | 29 con số ẩn, cần ô nhập và cột chụp |
| Admin vẫn duyệt, hoặc tự động duyệt ngầm | Duyệt cho có; độ trễ nhả chỗ sau hạn; thêm hàng đợi và trạng thái kẹt |
| Chặn cả lúc claim thanh toán sau hạn | Thu tiền rồi tự hoàn, email lý do sai, cho một khoảng trễ vài phút tới vài giờ |

Danh sách đầy đủ ở spec §13.

## AMEND 1 08/10 — chuyến đã bị công ty huỷ thì khách không tự huỷ được nữa

Lỗ hổng phát hiện ở vòng review P7 phần C (08/10), xác minh bằng đọc mã. §4 hỏi
trạng thái booking, capture và ngày khởi hành; nó KHÔNG hỏi "chuyến còn là chuyến
sẽ chạy không".

Đường đi của lỗi:

1. Admin huỷ chuyến (F13). Giao dịch huỷ chuyển chuyến sang `CANCELLED` và huỷ
   ngay booking `PENDING`; booking `PAID`/`PARTIALLY_REFUNDED` giữ nguyên tới
   khi job `departure-refund` chạy. Khoảng chờ có thật: worker gói free ngủ
   khoảng 15 phút, lưới quét chạy 10 phút một lần, cổng lỗi thì retry giãn luỹ
   thừa.
2. Trong khoảng chờ, `bookings.byCode` vẫn in nút huỷ và `bookings.cancel` vẫn
   nhận lệnh. Qua hạn chót thì khách được hoàn 0 và nhận email "không hoàn vì
   quá hạn chót".
3. Job tới sau thấy booking đã `CANCELLED`, coi là việc đã xong (`null`), và
   lưới quét chỉ tìm `PAID`/`PARTIALLY_REFUNDED` nên cũng không vớt. Khách mất
   khoản hoàn 100% mà §6 hứa, không có gì báo lại.

Soát prod 08/10 (chỉ đọc): chưa đơn nào dính — đơn duy nhất trên chuyến huỷ từ
F13 là đơn thử tay 22/09, do chính job hoàn trọn.

**Đổi:**

- **Thứ tự ưu tiên.** Từ lúc chuyến `CANCELLED`, §6 thắng §4: đường khách tự
  huỷ đóng lại cho mọi booking của chuyến ấy, tiền chỉ đi MỘT đường — job của
  công ty, trọn phần chưa hoàn. `bookings.cancel` trả 422 `NOT_CANCELLABLE`;
  `bookings.byCode.cancellation` trả `null`, vì luật huỷ của khách không còn
  áp dụng và số `refundAmount` theo hạn chót sẽ là một con số sai.
- **Trạng thái chuyến đọc SỐNG, ngày vẫn đọc bản sao.** Ngày là lời hứa lúc đặt
  (sửa chuyến không đổi hạn chót đã hứa); huỷ chuyến là một sự kiện xảy ra SAU
  lúc đặt, đọc bản sao là không bao giờ thấy nó.
- **Phép kiểm nằm trong bộ hàm luật thuần** (`cancellationBlocker`), cùng chỗ
  với ba chốt cũ, để `byCode` và lệnh huỷ không bao giờ nói ngược nhau. Đường
  khách BẮT BUỘC mang trạng thái chuyến (không có mặc định); đường công ty thì
  không, vì chuyến `CANCELLED` là tiền đề của nó.
- **Khoá thứ tự với lượt huỷ chuyến.** Trong advisory lock của booking, lõi huỷ
  khoá hàng chuyến bằng `SELECT status … FOR KEY SHARE` rồi mới quyết, TRƯỚC khi
  gọi cổng. Lượt huỷ chuyến khoá cùng hàng bằng `FOR UPDATE`, nên hai bên xếp
  hàng nhau:
  - admin tới trước → khách chờ, đọc thấy `CANCELLED`, bị từ chối;
  - khách tới trước → admin chờ khách commit, và danh sách cần hoàn chụp sau đó
    không còn booking ấy. Khách quyết huỷ lúc chuyến còn chạy nên luật của
    khách áp dụng — nhất quán với thứ tự thật.

  Kiểm không khoá là chưa đủ: khe giữa lúc kiểm và lúc ghi dài bằng một lần gọi
  cổng (`docs/conventions/read-then-write-races.md`). `KEY SHARE` chứ không
  `SHARE`: lõi huỷ còn `UPDATE seats_booked` trên chính hàng ấy, và hai khách
  cùng chuyến cầm `SHARE` rồi cùng nâng lên khoá ghi là deadlock — xảy ra SAU
  khi tiền đã đi. `KEY SHARE` chỉ xung đột với `FOR UPDATE`, nên phép khoá này
  đứng được là nhờ lượt huỷ chuyến khoá bằng `FOR UPDATE` tường minh; hạ nó
  xuống một câu `UPDATE` trần là mở lại khe.
- **Giao dịch huỷ chuyến nâng timeout lên 20 giây**, bằng khoá hoàn tiền: nó có
  thể phải chờ một lệnh hoàn của khách đang gọi cổng (trần 15 giây).

**Cái giá:** các lệnh sửa chuyến khác của admin (`FOR UPDATE`, timeout mặc định
5 giây) cũng phải chờ một lượt khách huỷ đang gọi cổng. Quá 5 giây thì lệnh sửa
lỗi và admin bấm lại, không ghi gì. Chấp nhận vì hiếm (phải trùng đúng lúc) và
an toàn.

**KHÔNG đổi:** số tiền của hai đường (§4, §6), cơ chế idempotent của job (`null`
khi booking đã đóng), lưới quét, chốt ngày khởi hành của từng đường.

**Để sau:** web chưa biết chuyến đã bị huỷ — trong khoảng chờ voucher và hoá
đơn vẫn hiện như thường. Cần một trường mới ở `BookingDetail` và một khối báo
trên trang; ghi ở `docs/open-items.md`, làm sau khi nhánh P7 B và C merge.
