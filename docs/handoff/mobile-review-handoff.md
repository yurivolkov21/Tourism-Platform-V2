# Bàn giao cụm đánh giá mobile (P5b-5) — viết · ảnh kèm · bài của tôi · sửa · rút

> Viết cho thành viên dựng màn. Như các cụm trước: **chỉ có bản vẽ**, người nhận dựng màn và
> nối dữ liệu thật. Đọc [mobile-browse-handoff.md](mobile-browse-handoff.md) trước — luật
> chung, cách đọc bản vẽ và quy ước code nằm ở đó; tài liệu này chỉ nói phần KHÁC.

Bản vẽ: `docs/design/mockups/mobile-review-screens.src.html` (7 khung) ·
Vòng đời và quyền sửa: [ADR-0032](../adr/0032-review-author-edit.md) ·
Trạng thái duyệt nói thật: [ADR-0031](../adr/0031-review-rejection.md) ·
Ảnh: [ADR-0021](../adr/0021-media-write-surface.md) ·
Khuôn code mẫu: `apps/web/src/components/account/review-form.tsx` và `review-composer.tsx`.

## 1. Vì sao cụm này tồn tại

P5b-3 đã vẽ khung P6 "chuyến đã kết thúc" với nút **Write a review** nhưng chưa có màn nào ở
đầu kia. Và vòng đời một bài đánh giá không phải một nút gửi: contract có **bốn** trạng thái
(`pending` · `approved` · `rejected` · `retracted`), có **hạn hai lần bị bác**, có đường sửa
và đường rút. Không vẽ thì người dựng màn phải tự đoán ba nhánh khó nhất.

## 2. Bốn luật cứng

1. **Trạng thái đọc `moderationState`, KHÔNG đọc `isApproved`.** Cờ boolean gộp mất hai ca
   (chờ duyệt và bị bác đều `false`), đúng lỗi ADR-0031 §6 đã sửa: khách bị bác vẫn thấy
   "đang chờ duyệt" vĩnh viễn.
2. **"Còn sửa được không" hỏi `canAuthorEdit` của `@tourism/contract`**, không tự so
   `rejectionCount` (ADR-0032 §6). Hàm đã chặn sẵn cả `approved` lẫn `retracted`.
3. **Sửa thì ảnh THAY TRỌN, không cộng dồn.** Vắng `photos` = không còn ảnh nào. Bài bị bác
   vì một tấm ảnh có mặt người khác mà khách không gỡ được ảnh thì đường sửa là đồ giả.
4. **Rút là chung cuộc.** Không có đường quay lại; ảnh bị xoá theo. Nói cả hai điều đó TRƯỚC
   khi khách bấm, không phải trong toast sau khi xong.

## 3. Việc phải làm trước

- **T0 của P5b-2** (tầng dữ liệu mobile) và phần nối Better Auth: `reviews.create`,
  `reviews.mine`, `reviews.update`, `reviews.retract` đều cần đăng nhập; `listByTour` thì không.
- `expo-image-picker` — cùng dependency với việc đổi ảnh đại diện ở P5b-4, ghi ADR-0040 một
  lần cho cả hai.
- Mở token `success`, `warning`, `rating`, `rating-muted` trong `MOBILE_COLOR_KEYS` nếu cụm
  trước chưa mở.

## 4. Chia việc đề xuất

| # | Việc | Khung | Phụ thuộc |
| --- | --- | --- | --- |
| X1 | Màn viết đánh giá + luật bật/tắt nút gửi | R1, R3 | T0, phiên đăng nhập |
| X2 | Chọn và tải ảnh lên Cloudinary | R2 | X1 |
| X3 | Danh sách "bài của tôi" với bốn trạng thái | R4 | T0 |
| X4 | Sửa khi bị bác, và ca hết lượt | R5, R6 | X3 |
| X5 | Rút bài đã đăng | R7 | X3 |

X1 và X3 chạy song song được.

## 5. Endpoint cho từng màn

| Màn | Endpoint | Ghi chú |
| --- | --- | --- |
| R1 | `reviews.create` | `CreateReviewInputSchema`: `bookingCode`, `rating` 1–5, `title` ≤120 (tuỳ chọn), `body` **10–2000**, `photos` ≤ `REVIEW_PHOTOS_MAX` (5). Lỗi `REVIEW_ALREADY_EXISTS` nghĩa là đã viết rồi — chuyển sang câu `alreadyReviewed*`, đừng hiện như lỗi đỏ |
| R2 | `media.signUpload` | Nhánh `REVIEW_PHOTO`, folder `reviews/<bookingCode>` (ADR-0021 §4). App tải THẲNG lên Cloudinary, chỉ `publicId` đi qua API của mình |
| R4 | `reviews.mine` | Có auth, phân trang, mới nhất trước; trả CẢ bài chưa duyệt (`MyReviewSchema`) |
| R5 | `reviews.update` | `UpdateReviewInputSchema` — không có `bookingCode` (đổi nó là chuyển bài sang chuyến khác). Gửi xong bài về lại hàng đợi duyệt |
| R7 | `reviews.retract` | Chỉ `id` |
| — | `bookings.byCode` | Đọc lại sau khi gửi để `reviewedAt` và khối `review` của màn chi tiết booking cập nhật theo |

## 6. Chữ — gần như không phải viết mới

Khối `reviews` trong `@tourism/i18n` đã có đủ cho cả cụm, dùng chung với web:

- Form: `heading`, `ratingLabel`, `ratingValueLabel`, `titleLabel`, `titlePlaceholder`,
  `bodyLabel`, `bodyPlaceholder`, `bodyCounter`, `bodyTooShort`, `ratingRequired`, `submit`,
  `submitting`.
- Bốn cặp trạng thái: `successTitle`/`successBody` · `pendingTitle`/`pendingBody` ·
  `rejectedTitle`/`rejectedReason`/`rejectedBody` · `retractedTitle`/`retractedBody`.
- Hai ca chặn: `tooEarlyTitle`/`tooEarlyBody` (chuyến chưa đi xong),
  `alreadyReviewedTitle`/`alreadyReviewedBody`.
- Rút bài: `retract.button`, `retract.retracting`, `retract.cancel`, `retract.confirm`, và
  cặp toast `retract.toast.done` / `retract.toast.error`.
- Lỗi ảnh: `photos.errNotImage`, `errTooLarge`, `errTooMany`, `errUpload`, `errorsTitle`.

Khoá MỚI chỉ còn vài câu, ghi rõ ở từng khung: nhãn bốn trạng thái trên thẻ (Published ·
Pending review · Not published · Retracted), cặp tiêu đề/thân của ca **hết lượt viết lại**,
nhãn "Last reason given", và nhãn dòng "My reviews" ở tab Account.

**Nội dung tour và lý do bác là DỮ LIỆU, không phải chữ i18n** — `moderationNote` in nguyên
văn, đừng diễn giải lại.

## 7. Ba chỗ dễ làm sai

1. **Chặn từ trước, đừng để thành lỗi.** Chỉ hiện nút viết khi `booking.reviewedAt === null`
   **và** hôm nay đã qua `departureEndDate`. Thiếu bước này thì khách gõ xong cả bài mới bị
   báo 409 — đúng lỗi mà field `reviewedAt` sinh ra để tránh.
2. **Bài đã rút VẪN nằm trong danh sách**, chỉ đổi tông sang muted. Cho nó biến mất là khách
   tưởng mất dữ liệu và gửi lại.
3. **"Hết lượt sửa" khác "không sửa được vì đã duyệt".** Contract tách hai hàm riêng đúng vì
   hai câu phải khác nhau. Ca hết lượt còn cần một dòng trấn an: chuyến và booking không bị
   ảnh hưởng.
