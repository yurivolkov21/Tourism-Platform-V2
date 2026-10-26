# Thông báo trong app (mobile) — thiết kế

Ngày 25/10/2026. Phạm vi: `apps/mobile`. Không đổi API, không migration, không thêm dependency
(freeze 31/10).

## Mục tiêu

Một chỗ trong app gom những việc khách cần biết về chuyến của mình: chuyến sắp đi, đơn chờ thanh toán,
chuyến vừa đi xong chưa viết review, kết quả duyệt review. Truy cập bằng biểu tượng chuông ở đầu Home.

## Quyết định

**Danh sách được suy ra ở máy**, không có bảng thông báo ở máy chủ. Nguồn là hai truy vấn app đã gọi:
`bookings.mine` (cùng khoá cache với tab Trips) và `reviews.mine` (cùng cache với My reviews). Lý do:
không cần migration/deploy hạ tầng (luật 15), dữ liệu luôn khớp tab Trips, tách được phần logic thuần để
test.

Đánh đổi chấp nhận: không phải thời gian thực (chỉ cập nhật khi app mở và tải lại dữ liệu), không gửi khi
app đóng (đó là việc của push, chưa có), trạng thái "đã đọc" chỉ lưu trên máy.

## Luật sinh thông báo

`buildNotifications({ bookings, reviews, today, now })` — hàm thuần, không đọc đồng hồ.

| Loại | Điều kiện | Mở tới |
| --- | --- | --- |
| `payment_due` | giai đoạn `awaiting_payment` | `/bookings/<code>` |
| `on_tour` | giai đoạn `on_tour` | `/trips/<code>` |
| `departing` | giai đoạn `upcoming`, còn ≤ 30 ngày | `/trips/<code>` |
| `trip_cancelled` | chuyến bị công ty huỷ (`departureCancelled`), chưa quá 30 ngày sau ngày về | `/bookings/<code>` |
| `refunded` | REFUNDED có mốc huỷ, chuyến không bị công ty huỷ, chưa quá 30 ngày sau ngày về | `/bookings/<code>` |
| `review_prompt` | đã về ≤ 60 ngày, `tripsAwaitingReview` coi là còn mời được | `/trips/<code>/review` |
| `review_rejected` | `moderationState = rejected` | `/reviews/<id>` |
| `review_approved` | `approved`, tạo ≤ 14 ngày | `/reviews/<id>` |

Không sinh thông báo cho: đơn khách tự huỷ (khách biết rồi), đơn chờ trả đã quá hạn (`lapsed`), review chờ
duyệt hoặc đã rút, đơn REFUNDED không có mốc huỷ (khách đã nhận tiền lại nên không nhắc "đang đi" hay
"sắp đi").

Thứ tự: `payment_due`, `on_tour`, `departing` (ngày đi gần nhất trước), `trip_cancelled`/`refunded`,
`review_prompt`, `review_rejected`, `review_approved`. Mỗi thông báo có `id` ổn định
`<loại>:<mã đơn hoặc id review>`.

## Đã đọc / chưa đọc

Tập `id` đã đọc lưu trong `expo-secure-store` (khoá `nexora-notifications-read-v1`, JSON mảng). Đọc lỗi thì
coi như chưa đọc nào; ghi lỗi thì chỉ mất trạng thái, không ném (cùng tinh thần `readHasSeen`). Chấm đỏ ở
chuông = số thông báo có `id` không nằm trong tập đã đọc. Mở màn thông báo không tự đánh dấu đã đọc; bấm
một thông báo thì đánh dấu thông báo đó; có nút "Mark all as read".

## Giao diện

- Chuông (`bell`) nằm bên phải hàng đầu Home (cùng hàng avatar và lời chào), kèm chấm đỏ có số khi chưa
  đọc. Khách chưa đăng nhập: không hiện chuông.
- Màn `/notifications`: header native "Notifications"; thẻ có ảnh tour, tiêu đề, một dòng phụ, chấm chưa
  đọc; thẻ hiện so le như các danh sách khác; rỗng thì `EmptyState` "You're all caught up".
- Chữ sản phẩm tiếng Anh, tập trung ở `@tourism/i18n` (`mobile.notifications`).

## Không làm ở đợt này

Push ngoài app, email nhắc chuyến, đồng bộ "đã đọc" giữa thiết bị, thông báo thời gian thực.
