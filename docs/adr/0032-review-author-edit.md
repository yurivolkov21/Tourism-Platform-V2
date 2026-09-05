# ADR-0032 — Đường quay lại cho tác giả: sửa review bị bác, và một trần cho vòng lặp

- **Trạng thái:** Accepted (2026-09-05)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0031](0031-review-rejection.md) (ADR này **hoàn tất** phần
  bị hoãn ở đó) · [ADR-0021](0021-media-write-surface.md) (ảnh review ký theo folder
  booking) · spec P3a §Review

## Bối cảnh

ADR-0031 dựng được trạng thái "đã bác" nhưng để lại một lỗ mà chính nó ghi ra:

> Một review bị bác là review của booking ấy **mất hẳn**, chỉ khác trước ở chỗ
> khách được BIẾT và biết VÌ SAO.

Ba sự thật đo được ở code, không phải suy đoán:

**1. Không có route sửa hay xoá.** Toàn hệ thống chỉ có ba đường cho khách:
`reviews.listByTour` · `reviews.mine` · `reviews.create`. Gửi xong là đóng
băng, với cả khách lẫn admin.

**2. `booking_id` là UNIQUE.** Một review mỗi booking, vĩnh viễn. Nên "viết
lại" không thể là "tạo cái mới".

**3. Trang khách nói SAI sau khi bị bác.** `reviewSlot()` chỉ nhìn
`booking.reviewedAt !== null` — một mốc thời gian, không biết gì về phán quyết.
Khách quay lại đúng trang họ từng viết và đọc thấy *"bạn đã đánh giá chuyến này
rồi"*. Email có nói, sản phẩm thì im.

## Quyết định

### 1. Đường quay lại là SỬA chính review đó

Không xoá rồi tạo lại, không cho nhiều review mỗi booking.

| Phương án | Vì sao loại |
| --- | --- |
| Xoá rồi cho viết lại | Mất bằng chứng *"vì sao review của tôi không lên site"* — thứ duy nhất trả lời được khi khách hỏi lại. Và nó biến một thao tác DỌN DẸP thành cơ chế CẤP QUYỀN, đúng cái bẫy ADR-0031 đã ghi. |
| Nhiều review mỗi booking | Phá `booking_id @unique` — đổi một bất biến DB để giải một bài toán giao diện. |

Sửa giữ nguyên dòng dữ liệu, nên sổ moderation của nó cũng nguyên vẹn: người
duyệt sau thấy được *"đã bác vì X, rồi tác giả viết lại"*.

### 2. Sửa được ở `pending` và `rejected`, KHÔNG ở `approved`

- `rejected` — lý do ADR này tồn tại.
- `pending` — vô hại: chưa ai đăng, chưa ai quyết. Và nó chữa được lỗi gõ
  trước khi người duyệt đọc, thay vì bắt khách chờ bị bác mới sửa được.
- `approved` — **KHÔNG**, và đây là ranh giới an toàn chứ không phải tiện tay:
  cho sửa nội dung ĐANG hiển thị công khai là mở một lớp rủi ro mới hẳn — được
  duyệt một bài tử tế rồi tráo thành spam, sau lưng kiểm duyệt.

Ngày nào muốn mở `approved`, luật bắt buộc đi kèm là: **sửa xong phải rơi về
chờ duyệt lại**, tức nội dung rời site ngay lúc bấm lưu.

### 3. Sửa là thay TRỌN nội dung, kèm ảnh

Rating, tiêu đề, nội dung, **và danh sách ảnh** — cùng hình dạng với `create`,
đi qua cùng phép kiểm folder của ADR-0021 (ảnh phải nằm trong folder đúng
booking ấy).

Không cho đổi ảnh là làm đường quay lại thành đồ giả: một review bị bác vì tấm
ảnh có mặt người khác thì sửa chữ không cứu được gì.

### 4. Sửa xong thì QUAY VỀ hàng đợi

`rejected_at`/`rejected_by` xoá về `NULL`; `is_approved` vẫn `false`. Review đi
qua kiểm duyệt lần nữa như một review mới tới.

**`moderated_at`/`moderated_by` thì GIỮ.** Chúng ghi "lần quyết định gần nhất",
và lần ấy ĐÃ xảy ra — xoá đi là giả vờ nó chưa từng có. Người duyệt thấy một
review `pending` mang dấu vết đã-từng-bị-quyết, và đó chính là ngữ cảnh họ cần.

**KHÔNG ghi `ReviewModerationEvent`.** Bảng ấy ghi hành vi của NGƯỜI DUYỆT
(`actor_id` là admin); nhét một cú sửa của tác giả vào đó là làm hỏng nghĩa của
cả sổ. Dấu vết của tác giả là `updated_at`, cột đã có sẵn.

### 5. Trần vòng lặp: hai lần bác là hết đường

Không có trần thì khách ép admin đọc lại cùng một review vô hạn: bác → sửa →
vào hàng đợi → bác → … Vòng ấy vốn đã bị chặn ở đầu nguồn (một review mỗi
booking, mà booking thì phải trả tiền), nhưng chi phí mỗi vòng vẫn là một lượt
đọc của người thật.

**Sau lần bác thứ HAI, đường sửa đóng.** Số lần bác đếm trên chính audit trail
đã có (`review_moderation_events` với `to_rejected = true`) — không cột mới,
không migration.

Con số 2 là một lựa chọn biên tập, và nó nói được thành câu cho khách nghe:
*"chúng tôi đã xem lại hai lần"*. Một lần thì quá gắt với một hiểu lầm; ba lần
thì đã là kiên nhẫn giả vờ.

### 6. Luật "còn sửa được không" là HÀM THUẦN ở contract

`canAuthorEdit({ moderationState, rejectionCount })` sống ở `@tourism/contract`,
cùng chỗ và cùng lý do với `refundPercentForRequest` (ADR-0030 §6): API dùng nó
làm CỔNG, web dùng nó để quyết hiện form hay hiện câu "hết đường" — hai bên
không thể nói khác nhau.

Bài học đã trả giá ở `reviewSlot()`: nó "soi gương" `checkReviewEligibility`
bằng cách **chép tay luật sang TypeScript**, và JSDoc của chính nó phải dặn
"nếu web nói khác API thì khách gõ hết bài rồi mới bị từ chối". Lần này không
chép nữa.

### 7. Trang khách phải NÓI RA trạng thái

`reviewSlot` hiện chỉ đọc `booking.reviewedAt` — một mốc thời gian không mang
phán quyết nào. Nên `admin.bookings.byCode`… đúng hơn là `bookings.byCode` của
khách, trả kèm chính review ấy (`MyReview`, đã có `moderationState` +
`moderationNote` từ ADR-0031), và slot mọc thêm hai trạng thái:

| Trạng thái | Khách thấy |
| --- | --- |
| `pending` | "đang chờ duyệt" + nút sửa |
| `rejected`, còn sửa được | LÝ DO bác + form sửa, điền sẵn nội dung cũ |
| `rejected`, hết lượt | LÝ DO bác + câu nói rõ đã xem hai lần, và lối liên hệ |
| `approved` | như hôm nay ("đã đăng") |

### 8. Admin thấy được "đã bác rồi viết lại"

`AdminReviewSchema` thêm `rejectionCount`. Một con số phục vụ ba chỗ: cổng của
§5, câu "đã bác N lần" ở dialog chi tiết, và ngữ cảnh cho người duyệt đang đọc
một review `pending` từng bị bác — kèm lý do bác lần trước, thứ
`moderationNote` đã mang sẵn.

## Hệ quả

### Việc phải làm cùng đợt

| Tầng | Việc |
| --- | --- |
| Contract | route `reviews.update`; `canAuthorEdit` + `REVIEW_REJECTION_LIMIT`; `MyReview`/`AdminReview` thêm `rejectionCount`; `Booking` thêm `review` |
| API | `ReviewsService.update` (sở hữu · trạng thái · trần · folder ảnh) và thay trọn media; `byCode` trả kèm review |
| Web | `reviewSlot` mọc hai trạng thái; form sửa điền sẵn; hiện lý do bác |
| i18n | copy cho lý do, form sửa, và câu hết-lượt |

KHÔNG migration: mọi thứ suy từ cột và bảng đã có.

### Đo lúc thi công: `review` mở rộng ở ROUTE, không thêm vào `BookingSchema`

Bản đầu nhét `review` thẳng vào `BookingSchema`, và worker chạy
`contract.spec.ts` **hết bộ nhớ** (OOM, ~24 giây, không stack JS).

Nguyên nhân: `ContractInputs`/`ContractOutputs` suy kiểu cho TOÀN BỘ router, mà
`BookingSchema` xuất hiện ở khoảng mười route — mỗi route bỗng phải mang thêm
một review lồng một mảng media, và phép nhân ấy làm nổ suy kiểu. Chứng minh
bằng `git stash`: bỏ thay đổi ra thì 35 test của file ấy xanh trở lại.

Nên `review` sống ở `BookingDetailSchema` — `BookingSchema.extend(...)` dùng
cho ĐÚNG `bookings.byCode`, cùng khuôn `AdminBookingDetailSchema` đã có. Chi
phí kiểu trả một lần thay vì mười.

Luật rút ra cho về sau: **đừng thêm một schema LỒNG vào một schema NỀN dùng
chung nhiều route** — mở rộng ở route cần nó.

### Điều KHÔNG được suy ra

ADR này **không** cho khách xoá review của mình, và **không** cho sửa review đã
duyệt. Cũng không đụng tới việc lưu trữ review bị bác — dọn ảnh của chúng là
việc riêng, và giờ mới bàn được, vì §1 vừa chốt rằng xoá dòng review là sai
đòn bẩy.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Không làm gì; mail bác đã mời "reply to this email" | Đúng về mặt lịch sự, nhưng đẩy một việc sản phẩm làm được sang hộp thư của một người. Và nó để nguyên câu SAI trên trang booking ("bạn đã đánh giá rồi"). |
| Ghi cú sửa của tác giả vào `ReviewModerationEvent` | Bảng ấy ghi hành vi của người duyệt, `actor_id` là admin. Nhét tác giả vào là làm hỏng nghĩa của cả sổ, và mọi phép đếm dựa trên nó (kể cả trần ở §5) sẽ đếm nhầm. |
| Cho sửa cả review ĐÃ DUYỆT | Nội dung đang hiển thị công khai đổi sau lưng kiểm duyệt. Muốn mở thì phải kèm luật "sửa là gỡ xuống", và đó là một quyết định khác, không phải một dòng thêm vào ADR này. |
| Trần đếm theo số lần SỬA thay vì số lần BỊ BÁC | Đếm sai thứ: một khách sửa ba lần rồi được duyệt là một câu chuyện tốt. Thứ tốn công người thật là số lần BỊ BÁC. |
| Không có trần nào | Vòng bác–sửa–bác ép admin đọc lại vô hạn. Rẻ để chặn (dữ liệu đã có), và câu "đã xem hai lần" nói được thành lời với khách. |
