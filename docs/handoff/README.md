# Bàn giao — tài liệu viết cho người khác dựng màn

> Khác `conventions/` ở chỗ: luật thì áp dụng mãi mãi, còn **bàn giao thì có
> ngày hết hạn** — dựng xong cụm màn là tài liệu tương ứng thành bản ghi lịch
> sử. Tách khỏi `conventions/` ngày 21/09/2026.

Mỗi tài liệu trả lời đúng một câu hỏi: *"tôi nhận cụm màn này, giờ làm gì?"* —
đọc bản vẽ ở đâu, luật nào bắt buộc, chia việc thế nào, gọi endpoint nào, ba
chỗ dễ làm sai.

## Năm cụm màn app điện thoại (P5b)

> **Cả năm cụm đã dựng xong và gộp vào `main` từ 09/10 tới 12/10/2026**, nên năm
> file dưới đây giờ là **bản ghi lịch sử** (cập nhật 14/10). Việc còn mở sau các
> lần gộp nằm ở [open-items](../open-items.md); bản review và tóm tắt nhánh ở
> [`reviews/`](../reviews/README.md).

| Cụm | Tài liệu | Tình trạng |
| --- | --- | --- |
| P5b-1 đăng nhập | [mobile-auth-handoff](mobile-auth-handoff.md) | Giao diện dựng 16/09; nối Better Auth thật gộp cùng nhánh tài khoản 09/10; đăng nhập Google native 13/10 (ADR-0056) |
| P5b-2 xem tour | [mobile-browse-handoff](mobile-browse-handoff.md) | Gộp 09/10 cùng nhánh tài khoản, phần còn lại của nhánh gộp 12/10. Luật chung cho cả năm cụm nằm ở file này |
| P5b-3 đặt tour | [mobile-booking-handoff](mobile-booking-handoff.md) | Gộp 12/10 (nhánh `fix/mobile-booking-screens`). Cụm chạm tiền: bốn luật cứng |
| P5b-4 tài khoản | [mobile-account-handoff](mobile-account-handoff.md) | Gộp 09/10 (nhánh `feat/mobile-account-screens`) |
| P5b-5 đánh giá | [mobile-review-handoff](mobile-review-handoff.md) | Gộp 12/10 (nhánh `fix/mobile-review-screens`) |

Bản vẽ gốc: [`design/mockups/`](../design/mockups/README.md) — file
`mobile-*-screens.src.html`, mở thẳng bằng trình duyệt. Bản vẽ là **bản ghi bất
biến** của một vòng thiết kế đã duyệt, đừng sửa.

Vòng lặp chạy thử app: [`conventions/mobile-dev-loop.md`](../conventions/mobile-dev-loop.md).

## Nâng cấp giao diện app theo Material 3 (đợt 23–30/10)

> **Đang mở.** Bản vẽ user duyệt 19/10 sau bốn vòng (vòng 1 của Nghĩa 14/10); demo chạy Android
> nên theo Material 3. ADR-0040 AMEND 7 (đề xuất 19/10) phải được duyệt trước khi code.

| Việc | Tài liệu | Tình trạng |
| --- | --- | --- |
| Lớp áo Material 3 cho cả app, đổi bố cục năm cụm màn demo | [mobile-ui-upgrade-handoff](mobile-ui-upgrade-handoff.md) | Viết 19/10 để giao Nghĩa; bản vẽ `mobile-ui-upgrade.src.html` |

## Một lưu ý khi tra đường

Năm file này **từng nằm ở `docs/conventions/`**. Entry CHANGELOG cũ và các plan
của P5b vẫn trỏ đường cũ — chúng là bản ghi lịch sử nên không sửa. Gặp đường dẫn
`docs/conventions/mobile-*-handoff.md` ở đâu đó thì hiểu là file này.
