# Rà UI/UX và logic app mobile — 01/11/2026

Ảnh chụp tại một thời điểm, nhánh `fix/ui-ux` (tách từ `main` 04fd87c1). Cách rà: đi qua các
màn chính trên máy thật (Galaxy S24 Ultra, Expo Go, API và Postgres local), đối chiếu với code,
và mở bản production đã cài trên cùng máy khi cần so sánh. Không phải rà toàn bộ 17 nghìn dòng
code mobile: luồng thanh toán Stripe/PayPal, viết đánh giá, đăng ký và xác minh email chưa đi
qua trên máy.

## Đã sửa trên nhánh này

| # | Lỗi | Sửa |
| --- | --- | --- |
| F1 | Màn đổi mật khẩu chỉ báo lỗi sau khi bấm lưu, không nói trước luật mật khẩu | Checklist 5 yêu cầu hiện khi chạm ô mật khẩu mới (cả màn đăng ký và đặt lại), dòng báo khớp/chưa khớp dưới ô xác nhận, lỗi khi mật khẩu mới trùng mật khẩu cũ |
| F2 | Nhãn nổi của ô nhập nhảy tức thì; checklist chen vào đẩy ô dưới nhảy | Nhãn trượt giữa chỗ placeholder và đường viền; checklist hiện dần; mọi `TextField` trượt tới chỗ mới khi thứ phía trên đổi cao |
| F4 (A1) | Chi tiết tour: cuộn ~60–280dp thì nút quay lại và nút tim khuất, header gọn chưa hiện | Hai nút ra ngoài `ScrollView`, cố định ở đỉnh tới khi header gọn thay chỗ |
| F5 (A2) | Tour trong ngày hiện "Wed 4 – Wed 4 Nov" | `formatDepartureRange` trả một ngày khi ngày đầu trùng ngày cuối (một chỗ, mọi màn ăn theo) |
| F6 (A3) | Thông báo và danh sách chờ đánh giá có dòng y hệt nhau cho các đơn cùng một đợt | Chỉ dòng trùng mới gắn thêm mã đơn (`lib/repeated-keys.ts`, `describeNotifications`) |
| F7 (A5) | Chi tiết đơn chờ thanh toán ghi "Your seats are held until you pay" — sai: API chỉ trừ ghế khi đã thanh toán (bất biến #1), web và thông báo `paymentDue` đều nói ngược lại | Đổi copy mobile thành "Seats aren’t held until you pay. Finish now to secure your place." Đơn quá hạn còn treo ở local là do không chạy worker `booking-sweep` (production huỷ sau 65 phút), không phải lỗi code |
| F3 | Bản production: bàn phím che tấm sửa tên (và mọi bottom sheet có ô nhập) trên Android. Expo Go thì không bị | `Modal` của bản build tràn viền (edge-to-edge) nên `adjustResize` không co nội dung. `BottomSheet` nay tự đệm đáy theo sự kiện `Keyboard` trên Android và ép `Modal` tràn viền ở mọi nơi để Expo Go giống bản build. Cần build APK mới để xác nhận trên production |

## Còn mở

| # | Mức | Lỗi | Bằng chứng | Hướng sửa |
| --- | --- | --- | --- | --- |
| A4 | Thấp | Bài viết không có ảnh bìa: dòng gọn hiện ô vuông xám trống | Màn Travel stories local — seed không có ảnh bìa (`cover: null` từ `/api/posts`). Production có ảnh thì không lộ | Đặt icon (vd `book-open`) giữa ô xám, hoặc bỏ hẳn ô khi không có ảnh |

## Đã xem, không thấy lỗi

Trang chủ, Explore (lọc, thẻ tour), Saved (trạng thái trống), Trips (chuyến đang đi, chờ thanh
toán, đã trả), Account, Personal details, Notifications (đánh dấu đã đọc), chi tiết đơn chờ thanh
toán, theo dõi chuyến sắp đi, My reviews.
