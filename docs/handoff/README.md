# Bàn giao — tài liệu viết cho người khác dựng màn

> Khác `conventions/` ở chỗ: luật thì áp dụng mãi mãi, còn **bàn giao thì có
> ngày hết hạn** — dựng xong cụm màn là tài liệu tương ứng thành bản ghi lịch
> sử. Tách khỏi `conventions/` ngày 21/09/2026.

Mỗi tài liệu trả lời đúng một câu hỏi: *"tôi nhận cụm màn này, giờ làm gì?"* —
đọc bản vẽ ở đâu, luật nào bắt buộc, chia việc thế nào, gọi endpoint nào, ba
chỗ dễ làm sai.

## Năm cụm màn app điện thoại (P5b)

| Cụm | Tài liệu | Tình trạng |
| --- | --- | --- |
| P5b-1 đăng nhập | [mobile-auth-handoff](mobile-auth-handoff.md) | Giao diện **đã dựng xong** (17 khung tĩnh); việc còn lại là nối Better Auth thật |
| P5b-2 xem tour | [mobile-browse-handoff](mobile-browse-handoff.md) | Mới có bản vẽ — **đọc file này trước ba file dưới**, luật chung nằm ở đây |
| P5b-3 đặt tour | [mobile-booking-handoff](mobile-booking-handoff.md) | Mới có bản vẽ. Cụm chạm tiền: bốn luật cứng |
| P5b-4 tài khoản | [mobile-account-handoff](mobile-account-handoff.md) | Mới có bản vẽ |
| P5b-5 đánh giá | [mobile-review-handoff](mobile-review-handoff.md) | Mới có bản vẽ |

Bản vẽ gốc: [`design/mockups/`](../design/mockups/README.md) — file
`mobile-*-screens.src.html`, mở thẳng bằng trình duyệt. Bản vẽ là **bản ghi bất
biến** của một vòng thiết kế đã duyệt, đừng sửa.

Vòng lặp chạy thử app: [`conventions/mobile-dev-loop.md`](../conventions/mobile-dev-loop.md).

## Một lưu ý khi tra đường

Năm file này **từng nằm ở `docs/conventions/`**. Entry CHANGELOG cũ và các plan
của P5b vẫn trỏ đường cũ — chúng là bản ghi lịch sử nên không sửa. Gặp đường dẫn
`docs/conventions/mobile-*-handoff.md` ở đâu đó thì hiểu là file này.
