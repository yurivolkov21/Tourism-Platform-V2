# ADR-0041 — Một hạn chót mỗi chuyến: ngừng nhận đặt và hết huỷ miễn phí cùng lúc

- **Trạng thái:** Accepted (2026-09-15, phiên brainstorming; ADR đi trước code,
  CHƯA thi hành)
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
  chống trùng `cancel:<bookingId>`), rồi một CTE ghi booking CANCELLED, yêu cầu
  REFUNDED do chính khách quyết, dòng sổ khi có tiền, trả chỗ, email
  `BOOKING_CANCELLED`.
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
