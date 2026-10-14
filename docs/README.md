# Tài liệu — tourism-v2

Đây là **cửa vào duy nhất**. Mọi tài liệu của dự án nằm dưới `docs/`. Mỗi thư
mục có một `README.md` làm mục lục, và bản đồ này trỏ tới từng mục lục; tài
liệu không nằm trong mục lục nào coi như không tồn tại.

## Bạn đang cần gì?

| Câu hỏi | Đọc |
| --- | --- |
| Dự án này là gì, ai dùng, chạy thế nào? | [overview.md](overview.md) |
| Từ này nghĩa là gì? | [glossary.md](glossary.md) |
| Còn nợ việc gì? | [open-items.md](open-items.md) · việc đã đóng ở [open-items-closed.md](open-items-closed.md) |
| Vì sao lại chọn cách làm này? | [adr/](adr/README.md) |
| Đợt vừa rồi đã đổi những gì? | [CHANGELOG.md](CHANGELOG.md) · trước 13/10 xem [lịch sử theo giai đoạn](changelog/README.md) |
| Luật nào áp dụng mãi mãi? | [conventions/](conventions/README.md) |
| Thử app trên điện thoại thế nào? Đăng nhập chạy ra sao? | [guides/](guides/README.md) |
| Skill nào đã cài, dùng khi nào? | [skills.md](skills.md) |
| Quy ước làm việc trong kho mã? | [../CLAUDE.md](../CLAUDE.md) |

## Chín thể loại, đừng lẫn

| Thư mục | Trả lời câu hỏi | Viết khi nào |
| --- | --- | --- |
| [`adr/`](adr/README.md) | **Vì sao** chọn thế này? | TRƯỚC khi code (luật CLAUDE.md #5) |
| [`specs/`](specs/README.md) | **Sẽ xây gì** ở đợt này? | Đầu mỗi đợt, user duyệt rồi mới code |
| [`plans/`](plans/README.md) | **Làm theo bước nào**? | Sau khi spec được duyệt; prompt giao session thi công ở `plans/prompts/` |
| [`analysis/`](analysis/README.md) | **Đo được gì**? | Khi cần dữ liệu để ra quyết định |
| [`conventions/`](conventions/README.md) | Quy tắc **áp dụng mãi mãi** | Khi một bài học cần thành luật |
| [`guides/`](guides/README.md) | Việc này **làm thế nào**, luồng này chạy ra sao? | Khi một cách làm được dùng lại nhiều lần |
| [`handoff/`](handoff/README.md) | **Người khác** nhận việc này thì làm gì? | Khi giao một cụm việc cho thành viên khác |
| [`reviews/`](reviews/README.md) | Nhánh của **thành viên khác** đang ra sao? | Khi soát hoặc review nhánh người khác dựng |
| [`design/`](design/README.md) | Đồ nghề thiết kế | Khi cần dựng trang mới ngoài code |

Ba ranh giới dễ lẫn nhất:

- **conventions ↔ handoff**: luật thì áp dụng mãi mãi, bàn giao thì có ngày hết
  hạn — dựng xong cụm màn là tài liệu ấy thành lịch sử.
- **conventions ↔ guides**: luật nói được làm gì và cấm gì, kèm lý do; hướng dẫn
  chỉ nói cách làm.
- **analysis ↔ reviews**: analysis đo cả dự án hay một vùng; reviews soát đúng
  một nhánh do người khác dựng.

Ngoài ra có hai thư mục lưu trữ: [`changelog/`](changelog/README.md) giữ lịch sử
CHANGELOG theo giai đoạn, [`snapshots/`](snapshots/README.md) giữ ảnh chụp cơ sở
dữ liệu prod xuất trước mỗi đợt làm mới dữ liệu (KHÔNG chứa dữ liệu cá nhân vì
kho mã này công khai).

## CHANGELOG

[CHANGELOG.md](CHANGELOG.md) — một entry mỗi lần gộp nhánh: ngày · hash · nội
dung · phát hiện khi review · tổng số test. File chính **chỉ giữ đợt đang chạy**
(từ 13/10/2026); lịch sử trước đó nằm ở [`changelog/`](changelog/README.md), 19
file theo giai đoạn, vào bằng mục lục kể lại dự án đã đi qua những gì.

**Entry đã ghi là bất biến** — cùng luật với `migration.sql`. Archive là di
chuyển nguyên văn, chỉ được sửa đường dẫn tương đối của link.

## Quy tắc viết

- **ADR trước code**; spec được user duyệt trước khi triển khai.
- **CHANGELOG là nơi duy nhất** giữ lịch sử và tiến trình số test.
- Doc hiện-trạng giữ NGẮN, chỉ phản ánh hiện tại; chuyện đã qua để CHANGELOG lo.
- **Doc mới thêm một dòng vào `README.md` của thư mục nó nằm.** Thư mục mới thì
  thêm một dòng vào bảng thể loại ở trên. Bản đồ này chỉ trỏ tới các mục lục,
  không liệt kê từng file.
- **Mục lục chỉ dẫn đường, không tóm tắt nội dung.** Mỗi mục một dòng; chi tiết
  sống trong chính tài liệu đó. Mục lục mà dài bằng tài liệu thì không ai đọc.
- Dòng văn bản gói ở khoảng 80 cột như phần còn lại của kho mã.
- **Tên file đặt bằng tiếng Anh** (`overview.md`, `booking-states.md`), không
  dùng tiếng Việt bỏ dấu. Nội dung bên trong vẫn viết tiếng Việt có dấu đầy đủ.
  Bảy file đặt tên theo lối cũ (`…-no-ky-thuat`, `…-thi-cong`, `…-khung-2026`,
  `…-cac-phase-con-lai`, `…-lich-van-hanh-2026`, `huong-dan-test-may-that`)
  **giữ nguyên**: entry CHANGELOG là bất biến và đang gọi đích danh chúng, đổi
  tên là làm gãy bản ghi lịch sử. Dời thư mục thì được, miễn sửa link theo.
- Spec sinh từ skill `superpowers:brainstorming` cũng ghi vào `specs/`, plan ghi
  vào `plans/` — **không tạo thư mục riêng cho skill**.
