# Bàn giao dựng màn

Mỗi file trong thư mục này giao một cụm màn cho người dựng, và trả lời câu hỏi
"tôi nhận cụm màn này, giờ làm gì?": bản vẽ nằm ở đâu, luật nào bắt buộc, chia
việc thế nào, gọi endpoint nào, chỗ nào dễ làm sai.

Khác với [quy ước](../conventions/README.md): quy ước áp dụng lâu dài, còn tài
liệu bàn giao hết hạn khi cụm màn dựng xong. Từ lúc đó file trở thành bản ghi
lịch sử và không được cập nhật theo code nữa.

## Năm cụm màn của app điện thoại

Cả năm cụm đã dựng xong và gộp vào nhánh chính từ 09/10 tới 12/10/2026, nên năm
file dưới đây là bản ghi lịch sử. Việc còn mở sau các lần gộp nằm ở
[danh sách việc còn mở](../open-items.md).

| Cụm màn | Tài liệu | Kết quả |
| --- | --- | --- |
| Đăng nhập (P5b-1) | [mobile-auth-handoff](mobile-auth-handoff.md) | Giao diện dựng 16/09; nối hệ thống đăng nhập thật 09/10; đăng nhập Google bằng SDK gốc 13/10 ([ADR-0056](../adr/0056-mobile-google-native-signin.md)) |
| Xem tour (P5b-2) | [mobile-browse-handoff](mobile-browse-handoff.md) | Gộp 09/10 và 12/10. Luật chung cho cả năm cụm nằm ở file này |
| Đặt tour (P5b-3) | [mobile-booking-handoff](mobile-booking-handoff.md) | Gộp 12/10. Cụm này chạm tới tiền nên có bốn luật cứng |
| Tài khoản (P5b-4) | [mobile-account-handoff](mobile-account-handoff.md) | Gộp 09/10 |
| Đánh giá (P5b-5) | [mobile-review-handoff](mobile-review-handoff.md) | Gộp 12/10 |

Bản vẽ gốc nằm ở [design/mockups/](../design/mockups/README.md), các file
`mobile-*-screens.src.html`, mở thẳng bằng trình duyệt. Bản vẽ là bản ghi bất biến
của một vòng thiết kế đã duyệt, nên đừng sửa.

Cách chạy thử app nằm ở [mobile-dev-loop](../conventions/mobile-dev-loop.md).

## Nâng cấp giao diện app theo Material 3

Đang làm trong đợt 23–30/10/2026. Bản vẽ được chủ dự án duyệt ngày 19/10 sau bốn
vòng. Bản demo chạy trên Android nên giao diện đi theo Material 3
([ADR-0040](../adr/0040-mobile-app-expo.md), AMEND 7).

| Việc | Tài liệu | Tình trạng |
| --- | --- | --- |
| Lớp giao diện Material 3 cho cả app, đổi bố cục năm cụm màn demo | [mobile-ui-upgrade-handoff](mobile-ui-upgrade-handoff.md) | Giao ngày 19/10; bản vẽ `mobile-ui-upgrade.src.html` |

## Đường dẫn cũ

Năm file bàn giao của app từng nằm ở `docs/conventions/`. Các entry CHANGELOG cũ
vẫn ghi đường dẫn cũ vì là bản ghi lịch sử. Gặp `docs/conventions/mobile-*-handoff.md`
ở đâu đó thì hiểu là file cùng tên trong thư mục này.
