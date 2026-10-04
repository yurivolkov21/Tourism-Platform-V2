# Tiến độ nhánh `feat/mobile-review-screens` — 04/10/2026

Nguồn: git (branch, log, status) và kiểm tra trên máy. Không dựa vào file md trạng thái khác.

## Git

- Branch: `feat/mobile-review-screens`, tách từ `feat/mobile-booking-screens` (HEAD `cc02e089`).
- Chưa có commit riêng của nhánh này. Mọi thay đổi bên dưới đang uncommitted.
- Chưa push, chưa merge.

## Đã làm (mockup `mobile-review-screens`)

| Khung | Nội dung | Kiểm tra |
| --- | --- | --- |
| R1 Viết đánh giá | Form sao, title, nội dung (sàn 10, trần 2000), bộ đếm, nút Submit trong thanh đáy | Trên máy: gửi thành công |
| R2 Ảnh | Chọn nhiều ảnh (thư viện) hoặc một ảnh (camera), tải thẳng Cloudinary, tối đa 5, lỗi từng ô, thử lại | Trên máy: khối ảnh và sheet hiển thị. Chưa chọn ảnh thật |
| R3 Đã gửi | Pill "Pending review" có icon đồng hồ, nút "Back to my trip" rộng 220px, link "See my reviews" → R4 | Trên máy: khớp mockup (trước khi bổ sung icon và độ rộng nút). Link đã nối, chưa bấm lại trên máy |
| R4 Đánh giá của tôi | Bốn trạng thái, ngày bên phải, link hành động | Trên máy: khớp mockup |
| R5 Viết lại | Banner lý do, form điền sẵn, giữ/gỡ ảnh cũ, thêm ảnh mới, gửi `reviews.update` | Chưa test thêm ảnh mới trên máy |
| R6 Hết lượt | Màn lý do cuối, nút liên hệ tới `/enquiry`, link quay lại | Chưa test trên máy (cần `rejectionCount` ≥ 2) |
| R7 Rút bài | Sheet xác nhận, `reviews.retract`, thẻ đổi sang Retracted | Trên máy: đã rút thành công |

## Thay đổi phụ trợ

- API `reviews.mine`: thêm `bookingCode` và `tourImage` vào `MyReviewSchema` (contract + service). Test module review API pass.
- Hook dùng chung `useReviewPhotos` (R1 và R5).
- Mobile: `expo-image-picker` có sẵn, không thêm dependency mới.

## Thay đổi không thuộc review (cùng working tree)

- Account: sheet "Help & legal" gom 5 link pháp lý, link mở production (`PUBLIC_SITE_ORIGIN`).
- Account: dòng Password chuyển sang Personal details.
- Account: gỡ link "Gallery (dev)" và "Tour gallery (dev)".
- Nên tách thành commit/nhánh riêng khi commit.

## Chưa xong

- Test trên máy: chọn ảnh thư viện thật, R5 thêm ảnh mới, R6.
- Nguồn update lúc 14:54 làm `rejected_at` của một review test về null. Chưa xác định được. Đường code duy nhất đặt `rejectedAt` về null là `reviews.update`. Cần log API.
- Ảnh bìa tour trong R5 phụ thuộc `tourImage` từ API (đã thêm, chưa test trên máy).
- Chưa commit.

## Dữ liệu test

- Booking BK-UKK6AUWP: ngày 17/10, PAID, 0 review (đã khôi phục).
- Các review test "R4 test …", "R7 test" đã xoá. Kiểm tra DB: 0 review test còn lại, booking 17/10 PAID, 0 review.
- Bản backup ngày booking: `scratchpad/booking-dates-before-review.json` (ngoài repo).

## Việc tiếp theo

1. Quyết định cách commit: một commit cho review, commit riêng cho Account.
2. Test trên máy các phần chưa test.
3. Rebase nhánh review lên nhánh booking sau khi nhánh booking được commit.
