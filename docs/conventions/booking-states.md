# Trạng thái cuối của một đơn

Trang này trả lời câu hỏi: khi một đơn (booking) kết thúc thì nó mang trạng thái
gì, và vì sao. Luật được chốt lúc xây luồng thanh toán (spec P2 §2 và §4). Nếu code
lệch tài liệu thì sửa tài liệu, nhưng hãy đọc phần lý do bên dưới trước.

Tóm tắt cho người mới: tiền và ghế được ghi ở hai nơi khác nhau. Muốn biết khách đã
được hoàn bao nhiêu thì đọc sổ hoàn tiền; muốn biết khách còn đi tour không thì đọc
trạng thái đơn. Hai câu hỏi này không suy ra được từ nhau.

## Nguyên tắc: hai câu chuyện, hai nơi ghi

- **Sổ hoàn tiền (`refunds`)** ghi câu chuyện tiền: mỗi dòng là một lần tiền thật
  đi ra, chỉ ghi thêm, và `SUM(amount)` so với `total_amount` là sự thật về tiền.
- **`Booking.status`** ghi câu chuyện ghế và chuyến đi: khách còn đi tour hay
  không. Đây là bản tóm tắt để đọc nhanh, không phải nguồn sự thật về tiền.

Huỷ đơn khác với chỉ hoàn tiền: một đơn bị huỷ (không đi tour nữa, ghế trả lại)
khác với một đơn được trả tiền mà khách vẫn đi tour. Vì vậy lõi huỷ (`cancelInLock`
trong `cancellations.service.ts`) đặt `CANCELLED` một cách tường minh, không đi qua
`deriveStatusAfterRefund`.

## Sáu cách một đơn kết thúc

| Tình huống | Trạng thái cuối | Sổ hoàn tiền | Ghế | Vì sao |
| --- | --- | --- | --- | --- |
| **Công ty huỷ chuyến** (tính năng F13, ADR-0041 §6: quản trị viên huỷ cả chuyến; job `departure-refund` huỷ từng đơn `PAID` hoặc `PARTIALLY_REFUNDED`, việc quét `booking-sweep` vớt job bị sót) | `CANCELLED` kèm `cancelledAt` | 1 dòng bằng trọn phần còn lại, không xét hạn chót, kể cả khi job chạy sau ngày khởi hành | Trả lại | Khách không đổi ý gì cả, nên luật hạn chót không áp dụng. `CancellationRequest` ở trạng thái `REFUNDED`, `decided_by` là quản trị viên đã huỷ chuyến, lý do là câu họ gõ lúc huỷ (cũng nằm ở `tour_departures.cancel_reason`). Email mang `initiator: 'operator'` và `reason`; khách đọc nguyên văn lý do trong email, trên trang đơn của web và trong app (ADR-0041 AMEND 2). Đơn `PENDING` của chuyến được huỷ ngay trong giao dịch huỷ chuyến, không qua job |
| **Khách tự huỷ** (ADR-0041: khách bấm Cancel trên đơn `PAID` hoặc `PARTIALLY_REFUNDED`, hôm nay theo giờ Việt Nam còn trước ngày khởi hành, và chuyến chưa bị công ty huỷ, theo AMEND 1) | `CANCELLED` kèm `cancelledAt` | 0 hoặc 1 dòng. Huỷ trong hạn chót thì 1 dòng bằng trọn phần còn lại. Không có dòng nào ở hai trường hợp: huỷ sau hạn chót (hoàn `0.00`, không gọi cổng thanh toán), hoặc sổ đã đủ từ trước. Sổ chỉ ghi tiền thật sự đi ra | Trả lại (`seats_booked -= party`), bất kể hoàn bao nhiêu | Khách chủ động thôi đi tour nên chuyến đi của khách kết thúc. Tiền đã trả nằm trọn trong sổ; trạng thái kể chuyện ghế, không kể chuyện tiền. `CancellationRequest` sinh ra ở trạng thái `REFUNDED` ngay (không qua `REQUESTED`), `decided_by` là chính chủ đơn; contract đưa ra thành `decidedByCustomer: true` để trang quản trị biết ai huỷ mà không cần join |
| **Giành ghế không thành** (gói việc W2 của spec P2: khách đã trả tiền nhưng đơn `PENDING` không chuyển được sang `PAID`, vì thua cuộc tranh ghế `overbooked`, chuyến đã đóng `departure-closed`, hoặc chuyến dời ngày `departure-moved` theo ADR-0009 AMEND 4; ba nguyên nhân khai ở `DEDUPE_PREFIX` của `payments.service.ts`) | `CANCELLED` kèm `cancelledAt` | 1 dòng hoàn toàn bộ (`adminId` rỗng nghĩa là hệ thống tự làm) | Không đụng tới (đơn chưa từng giữ ghế) | Đơn chưa bao giờ rời `PENDING` để thành doanh thu và chưa bao giờ giữ ghế, nên huỷ kèm hoàn tiền là trạng thái đúng |
| **Tiền về muộn** (gói việc W2 và W3 của spec P2: cổng thanh toán báo thu tiền sau khi đơn đã `CANCELLED`) | `REFUNDED` (suy từ sổ) | 1 dòng hoàn toàn bộ (`adminId` rỗng) | Không đụng tới (đơn `CANCELLED` không giữ ghế) | Tiền thật đã vào trên một đơn đã chết, nên câu chuyện còn lại chỉ là chuyện tiền; sổ suy ra trạng thái cuối `REFUNDED` một cách trung thực |
| **Quản trị viên hoàn thiện chí toàn bộ** (gói việc W3 của spec P2: `admin.bookings.refund`, không qua luồng huỷ) | `REFUNDED` (suy từ sổ) | 1 tới n dòng cộng dồn tới tổng tiền | Không trả ghế | Khách vẫn đi tour, vì hoàn tiền thiện chí không huỷ chuyến đi. Chỉ luồng huỷ (gói việc W4 của spec P2) mới được trả ghế |
| **Đơn chưa trả tiền hết hạn, bị bỏ, hoặc khách tự bỏ** (ADR-0006: webhook `payment.expired` của cổng thanh toán, việc định kỳ quét đơn quá 65 phút, và `bookings.cancelPending`) | `CANCELLED` kèm `cancelledAt` | Không có dòng nào (chưa thu tiền) | Không đụng tới (đơn `PENDING` chưa từng giữ ghế) | Đơn chưa trả tiền nên chưa thành doanh thu. Cả ba đường đều chỉ chạy khi `status='PENDING'` nên chạy lặp hay chạy chen nhau vẫn cho cùng kết quả. Không hoàn tiền |

`PARTIALLY_REFUNDED` không phải trạng thái cuối: sổ chưa đủ tổng tiền và khách vẫn
đi tour.

### Đơn `CANCELLED` mà sổ còn dư

Từ ADR-0041, trường hợp này chỉ còn một nguồn: khách huỷ sau hạn chót. Chuyến đi
đã huỷ, ghế đã trả, nhưng sổ không ghi thêm đồng nào, nên `total_amount` vẫn nằm
bên công ty. Phần dư đó vẫn hoàn tiếp được qua `admin.bookings.refund` (cửa này mở
cho đơn `CANCELLED` từ ADR-0029 §3; trước đó trả lỗi 422). Từ ADR-0041 §5, đây là
đường ngoại lệ chính thức: mọi trường hợp "luật nói không hoàn nhưng công ty vẫn
muốn hoàn" đi qua hoàn tiền thiện chí, có số tiền và lý do ghi vào sổ.

Khi hoàn nốt trên một đơn `CANCELLED`, trạng thái giữ nguyên `CANCELLED` và không
chạy `deriveStatusAfterRefund`. Hàm ấy chỉ biết chuyện tiền; áp nó lên một đơn đã
huỷ là ghi đè chuyện chuyến đi bằng chuyện tiền: đơn mất dấu đã huỷ, `cancelled_at`
thành dữ liệu mồ côi, và không ai đọc ra được là ghế đã được nhả.

## Hệ quả cho code

- `deriveStatusAfterRefund` chỉ dành cho các luồng chỉ hoàn tiền (quản trị viên
  hoàn tiền, tiền về muộn). Lõi huỷ và trường hợp giành ghế không thành đặt cứng
  `CANCELLED`.
- Chỉ lõi huỷ được trả ghế, và chỉ bằng một câu lệnh duy nhất
  `UPDATE tour_departures SET seats_booked = seats_booked - party WHERE id = …
  AND seats_booked >= party` (ràng buộc CHECK `departures_seats_nonneg` là lưới cuối).
- Một đơn `CANCELLED` có thể có sổ đầy (đã hoàn đủ). Muốn biết đã hoàn bao nhiêu
  thì luôn đọc từ sổ, đừng suy từ trạng thái.
- Không còn trạng thái chờ duyệt huỷ. App không sinh `CancellationRequest` nào ở
  `REQUESTED` hay `DENIED` nữa; mỗi lần huỷ là đúng một dòng `REFUNDED`. Dữ liệu
  production có thể còn dòng cũ của hai loại kia từ trước 15/09/2026 (tới lượt seed
  lại theo spec 15/09 §10 bước 6); chúng hiện dạng chỉ đọc trong lịch sử đơn.
- Ngày được so theo giờ Việt Nam. "Chuyến đã đi chưa" và "còn trong hạn chót
  không" đều đo bằng `vietnamToday(now)` ở Node và `vietnamDateSql` ở SQL
  (ADR-0009 AMEND 3). Không dùng UTC, không dùng đồng hồ trình duyệt.
- Một lõi cho hai người gọi. `cancelInLock` nhận `initiator: 'customer'`
  (`cancelByCustomer`) và `'operator'` (`cancelByOperator`, job công ty huỷ chuyến
  của F13). Cả hai dùng cùng một lõi, không có đường thứ hai; đó là lý do lõi nhận
  `decidedById` và `refundAmount` làm tham số thay vì tự đi tìm.
- Chuyến đã `CANCELLED` thì chỉ còn đường công ty huỷ (ADR-0041 AMEND 1). Từ lúc
  quản trị viên huỷ chuyến tới lúc job chạy, đơn `PAID` vẫn nằm đó, nhưng khách
  không tự huỷ được nữa (lỗi 422) và `bookings.byCode.cancellation` là `null`. Nếu
  cho khách tự huỷ trong khoảng chờ này thì luật hạn chót sẽ hoàn 0, rồi job thấy
  đơn đã `CANCELLED` và coi như xong. Trạng thái chuyến được đọc trực tiếp (khác
  với ngày, đọc từ bản sao); lõi khoá hàng chuyến bằng `FOR KEY SHARE` trước khi
  đọc, để xếp hàng sau `FOR UPDATE` của lượt huỷ chuyến.
