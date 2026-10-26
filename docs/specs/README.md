# Đặc tả (spec)

Mỗi spec mô tả sẽ xây gì trong một đợt việc: phạm vi, giao diện, luật nghiệp vụ
và cách kiểm tra. Spec được viết ở đầu đợt, chủ dự án duyệt rồi mới bắt tay làm.
Bản đồ chung của tài liệu ở [../README.md](../README.md).

## Cách đọc

- Tên file bắt đầu bằng ngày viết. Spec là bản ghi lúc viết, nên dòng trạng thái
  ở đầu file có thể đã cũ; phần đã chạy thật xem ở [CHANGELOG](../CHANGELOG.md)
  hoặc trong code.
- Lý do của các lựa chọn kiến trúc nằm ở [ADR](../adr/README.md); spec chỉ trỏ tới.
- Spec dùng mã đợt như P4e-3a hay G42. Nghĩa của các mã ấy tra ở
  [thuật ngữ](../glossary.md#mã-nội-bộ-trong-tài-liệu).

## Nền móng API và luật tiền

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 18/07/2026 | [P1 API lõi](2026-07-18-p1-api-core.md) | Khung máy chủ API, cấu trúc cơ sở dữ liệu, đăng nhập và các endpoint catalog đầu tiên |
| 18/07/2026 | [P2 luồng tiền](2026-07-18-p2-money-path.md) | Thanh toán qua Stripe và PayPal, sổ hoàn tiền, chuyển từ dự án tiền nhiệm sang nền mới |
| 19/07/2026 | [P3a API cho khách](2026-07-19-p3a-customer-api.md) | Sáu module cho web: đánh giá, tour yêu thích, câu hỏi khách, bản tin, bài viết, ảnh của site |
| 21/07/2026 | [P3a khép contract](2026-07-21-p3a-contract-closeout-design.md) | Bổ sung dữ liệu còn thiếu ở phần đọc catalog và đánh giá trước khi dựng web |
| 15/09/2026 | [Một hạn chót mỗi chuyến](2026-09-15-refund-deadline-design.md) | Đơn giản hoá luật hoàn tiền và chặn đặt chỗ sau hạn chót ([ADR-0041](../adr/0041-single-cancellation-deadline.md)) |

## Web khách: dựng trang

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 22/07/2026 | [Kiểu chữ typeset](2026-07-22-ui-typeset-design.md) | Đưa shadcn/typeset vào thư viện giao diện chung cho nội dung dài |
| 22/07/2026 | [Theme Wuling](2026-07-22-wuling-theme-tokens-design.md) | Đưa theme Wuling vào token thiết kế, nối vào giao diện và phông chữ |
| 23/07/2026 | [Trang chủ](2026-07-23-home-page-design.md) | Trang chủ và khung trang dùng chung |
| 24/07/2026 | [Trang đăng nhập](2026-07-24-auth-pages-design.md) | Cụm trang đăng nhập, đăng ký, quên mật khẩu |
| 25/07/2026 | [Blog](2026-07-25-blog-pages-design.md) | Cụm trang blog |
| 25/07/2026 | [Pháp lý và tiện ích](2026-07-25-legal-utility-pages-design.md) | Bốn trang nội dung dài (điều khoản, quyền riêng tư, chính sách huỷ, câu hỏi thường gặp) và ba trang lỗi |
| 27/07/2026 | [Tour](2026-07-27-tours-pages-design.md) | Trang danh sách tour và trang chi tiết tour |
| 28/07/2026 | [Điểm đến](2026-07-28-destinations-pages-design.md) | Trang điểm đến và trang từng vùng |

## Web khách: nối dữ liệu thật

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 31/07/2026 | [Blog và nền gọi API](2026-07-31-blog-api-design.md) | Nối cụm blog vào API và dựng lớp gọi API chung của web |
| 31/07/2026 | [Điểm đến](2026-07-31-destinations-api-design.md) | Nối cụm điểm đến, bỏ phần dữ liệu giả còn lộ ra |
| 31/07/2026 | [Catalog thật](2026-07-31-tours-catalogue-api-design.md) | Seed lại khoảng 30 tour và nối trang tour vào API |
| 03/08/2026 | [Liên hệ và bản tin](2026-08-03-contact-newsletter-api-design.md) | Form liên hệ, đăng ký bản tin, trang bỏ đăng ký |
| 03/08/2026 | [Đăng nhập thật](2026-08-03-auth-pages-api-design.md) | Sáu trang đăng nhập nối Better Auth, phiên đăng nhập ở web |
| 03/08/2026 | [Dựng lại trang theo yêu cầu](2026-08-03-on-demand-revalidation-design.md) | API báo web dựng lại trang ngay khi dữ liệu đổi |
| 04/08/2026 | [Khu tài khoản](2026-08-04-account-area-design.md) | Phiên đăng nhập phía trình duyệt và khu Account |
| 04/08/2026 | [PayPal và kiểm tra cổng thật](2026-08-04-paypal-capture-smoke-design.md) | PayPal thu tiền ngay khi khách duyệt; bài kiểm tra nhanh với cổng thanh toán ở chế độ thử |
| 06/08/2026 | [Bản đồ trang liên hệ](2026-08-06-contact-map-offices-design.md) | Bản đồ thật và một nguồn duy nhất cho thông tin liên hệ |
| 07/08/2026 | [Đặt tour và thanh toán](2026-08-07-booking-checkout-design.md) | Form đặt tour và các trang báo thanh toán thành công hoặc bị huỷ |

## Web khách: thiết kế lại

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 08/08/2026 | [Khu tài khoản, vòng đầu](2026-08-08-account-redesign-design.md) | Thay giao diện khu tài khoản, giữ nguyên phần dữ liệu |
| 10/08/2026 | [Thanh toán và tài khoản](2026-08-10-checkout-account-redesign.md) | Thiết kế lại trang đặt tour, trang kết quả thanh toán và khu tài khoản |
| 11/08/2026 | [Tài khoản kiểu "hộ chiếu"](2026-08-11-account-passport-redesign.md) | Dựng lại khu tài khoản theo hình ảnh cuốn hộ chiếu của người đi |
| 13/08/2026 | [Chi tiết tour](2026-08-13-tour-detail-redesign.md) | Làm lại trang chi tiết tour |
| 05/10/2026 | [Ba trang đơn của khách](2026-10-05-booking-pages-redesign-design.md) | Chi tiết đơn, voucher, danh sách My bookings |
| 09/10/2026 | [Saved và Settings](2026-10-09-account-saved-settings-redesign-design.md) | Thiết kế lại trang tour đã lưu và trang cài đặt tài khoản |
| 10/10/2026 | [Bản in và file xuất](2026-10-10-print-and-export-redesign-design.md) | Voucher, hoá đơn chờ và báo cáo tháng khi in; file Excel của báo cáo và danh sách, cho cả web khách và trang quản trị |
| 13/10/2026 | [Hoá đơn chờ](2026-10-13-g42-pending-receipt-design.md) | Thẻ hoá đơn chờ cho đơn chưa trả ở các trang kết quả thanh toán |

## Triển khai và bảo mật

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 19/08/2026 | [Triển khai lần đầu](2026-08-19-deploy-v1-design.md) | Tên miền, API trên Render, web trên Vercel, email qua Resend |
| 07/09/2026 | [Header bảo mật của web (W3)](2026-09-07-w3-web-shell-headers-design.md) | Header bảo mật và CSP, robots và metadata, địa chỉ API, chữ còn sót |
| 07/09/2026 | [Kênh khách gửi vào và email (W4)](2026-09-07-w4-inbound-channels-design.md) | Thư xác nhận, đồng ý nhận tin, danh sách chặn gửi, giãn thời gian gửi lại, ký upload |

## Dữ liệu mẫu

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 10/09/2026 | [Lịch vận hành 2026](2026-09-10-seed-lich-van-hanh-2026-design.md) | Dựng lại lịch khởi hành và dữ liệu vận hành cho cả năm 2026 |
| 14/09/2026 | [Seed trọn năm 2026](2026-09-14-seed-khung-2026-design.md) | Khung thời gian của dữ liệu mẫu, mốc "hôm nay", sửa hình dạng dữ liệu |

## Trang quản trị

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 20/08/2026 | [P4a khung app](2026-08-20-p4a-admin-scaffold-design.md) | Dựng app quản trị, chặn đăng nhập từ trang đầu tiên, khung điều hướng |
| 31/08/2026 | [P4b bộ bảng và ba vùng đầu](2026-08-31-p4b-admin-ready-areas-design.md) | Bộ công cụ bảng dữ liệu dùng chung; vùng đơn, yêu cầu huỷ, duyệt đánh giá |
| 01/09/2026 | [Xuất theo lựa chọn](2026-09-01-bookings-export-selection-design.md) | Chọn hàng trong danh sách đơn rồi xuất file |
| 02/09/2026 | [P4c vận hành](2026-09-02-p4c-operations-design.md) | Hàng đợi email, sổ sự kiện thanh toán, câu hỏi khách, người đăng ký bản tin |
| 21/09/2026 | [P4e-1 chuyến khởi hành](2026-09-21-p4e-1-departures-design.md) | Quản lý chuyến khởi hành và trạng thái đăng tour |
| 22/09/2026 | [P4e-2 danh mục và điểm đến](2026-09-22-p4e-2-categories-destinations-design.md) | Quản trị danh mục tour và điểm đến |
| 23/09/2026 | [Giai đoạn chuyến (F16)](2026-09-23-departure-phase-design.md) | Suy giai đoạn của chuyến từ ngày thay vì đọc cột trạng thái |
| 24/09/2026 | [Tạo và sửa tour (F17, P4e-3a)](2026-09-24-p4e-3a-tour-editor-design.md) | Trình sửa tour theo từng khối và điều kiện đăng tour |
| 28/09/2026 | [Ảnh tour (F18, P4e-3b)](2026-09-28-p4e-3b-tour-photos-design.md) | Tải, sắp xếp ảnh tour và chọn ảnh từ kho địa danh |
| 28/09/2026 | [Khu sửa tour dạng thanh bước (F19, P4e-3c)](2026-09-28-p4e-3c-tour-workspace-steps-design.md) | Chia trình sửa tour thành các bước, bước cuối là xem lại và đăng |
| 02/10/2026 | [P4e-4 bài viết](2026-10-02-p4e-4-posts-admin-design.md) | Soạn, xem trước và đăng bài blog |
| 02/10/2026 | [P4f người dùng: Owner và Staff](2026-10-02-p4f-users-staff-design.md) | Hai bậc nhân sự, cấp quyền và khoá tài khoản |
| 05/10/2026 | [Sửa giao diện quản trị](2026-10-05-admin-ui-polish-design.md) | Ô chọn dùng chung, tạo nhanh (Quick Create), xoá danh mục và điểm đến, các lỗi giao diện nhỏ |
| 13/10/2026 | [Chọn hàng và lọc ngày ở `/subscribers` (G43)](2026-10-13-g43-subscribers-selection-dates.md) | Chọn hàng và lọc theo ngày đăng ký trong danh sách người nhận bản tin |
| 13/10/2026 | [Lọc `/bookings` theo một tài khoản (G45)](2026-10-13-g45-bookings-account-filter.md) | Xem mọi đơn của một tài khoản trong danh sách đơn |
| 15/10/2026 | [P4f Appearance](2026-10-15-p4f-appearance-design.md) | Thay ảnh cho các khe ảnh của web |
| 16/10/2026 | [P4f Media library](2026-10-16-p4f-media-library-design.md) | Một chỗ xem và sửa mọi ảnh |
| 19/10/2026 | [Nhật ký thao tác](2026-10-19-admin-activity-log-design.md) | Ghi lại thao tác của quản trị viên và trang Activity để xem |

## App điện thoại

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 08/09/2026 | [P5a khung app](2026-09-08-p5a-mobile-template-design.md) | Khung Expo, điều hướng, thư viện giao diện mobile |
| 16/09/2026 | [P5b-1 đăng nhập](2026-09-16-p5b-auth-wireframe-design.md) | 17 khung màn đăng nhập và hợp đồng với hạ tầng |
| 09/10/2026 | [Đăng nhập Google native](2026-10-09-mobile-google-native-signin-design.md) | Đăng nhập Google bằng SDK gốc và ID token |
| 25/10/2026 | [Thông báo trong app](2026-10-25-in-app-notifications-design.md) | Nút chuông ở Home và danh sách thông báo về đơn và đánh giá, suy ra ngay trên máy từ dữ liệu đã tải, không thêm bảng ở máy chủ |

Các cụm màn còn lại của app (xem tour, đặt tour, tài khoản, đánh giá) và đợt giao
diện Material 3 không có spec riêng; tài liệu của chúng nằm ở
[handoff/](../handoff/README.md).

## Trợ lý AI

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 29/09/2026 | [P6 trợ lý tư vấn tour](2026-09-29-p6-ai-concierge-design.md) | Khung chat tư vấn tour trên web, chạy trong API, có trần chi phí |

## Công cụ cho người phát triển

| Ngày viết | Spec | Xây gì |
| --- | --- | --- |
| 02/10/2026 | [Mod `tourism-status`](2026-10-02-tourism-status-mod-design.md) | Dải trạng thái trong Claude Code, canh CI, nhắc cập nhật CHANGELOG. Mod chạy trên máy người phát triển, không nằm trong repo |
