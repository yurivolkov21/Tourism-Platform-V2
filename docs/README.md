# Tài liệu của dự án

Trang này là bản đồ của thư mục `docs/`: tài liệu nào trả lời câu hỏi nào, thư mục
nào còn được cập nhật và thư mục nào là bản ghi lịch sử. Mỗi thư mục có một
`README.md` làm mục lục riêng.

Đọc lần đầu thì bắt đầu từ [tổng quan sản phẩm](overview.md), rồi tới
[thuật ngữ](glossary.md). Cách chạy dự án trên máy nằm ở
[README của repo](../README.md#chạy-trên-máy).

## Bạn đang cần gì?

| Câu hỏi | Đọc |
| --- | --- |
| Sản phẩm làm gì, ai dùng? | [overview.md](overview.md) |
| Một từ, hay một mã như P4e, W2, G41, nghĩa là gì? | [glossary.md](glossary.md) |
| Vì sao hệ thống được làm theo cách này? | [adr/](adr/README.md) |
| Một tính năng được thiết kế ra sao trước khi xây? | [specs/](specs/README.md) |
| Viết code thì phải theo luật nào? | [conventions/](conventions/README.md) |
| Một luồng chạy thế nào, một việc lặp lại làm ra sao? | [guides/](guides/README.md) |
| Còn việc gì chưa làm? | [open-items.md](open-items.md); việc đã đóng ở [open-items-closed.md](open-items-closed.md) |
| Dự án đã thay đổi những gì, khi nào? | [CHANGELOG.md](CHANGELOG.md); trước 13/10/2026 ở [changelog/](changelog/README.md) |
| Repo làm việc với trợ lý AI thế nào? | [skills.md](skills.md) và [CLAUDE.md](../CLAUDE.md) |

## Các thư mục

| Thư mục | Chứa gì | Còn cập nhật không |
| --- | --- | --- |
| [adr/](adr/README.md) | Quyết định kiến trúc: chọn gì, vì sao, đã cân nhắc gì | Có. Quyết định mới thêm ADR; đổi quyết định thì thêm phần bổ sung (AMEND) |
| [specs/](specs/README.md) | Đặc tả viết trước khi xây một tính năng | Không. Spec là bản thiết kế lúc viết; hiện trạng nằm ở code |
| [conventions/](conventions/README.md) | Luật còn hiệu lực khi viết code, kèm lý do | Có |
| [guides/](guides/README.md) | Hướng dẫn từng bước và sơ đồ luồng | Có |
| [analysis/](analysis/README.md) | Bản đo đạc, rà soát và đối chiếu với dự án cũ | Chỉ sổ nợ kỹ thuật; còn lại là ảnh chụp tại một thời điểm |
| [handoff/](handoff/README.md) | Tài liệu giao một cụm màn cho người dựng | Không. Tài liệu thành lịch sử khi cụm màn dựng xong |
| [design/](design/README.md) | Mockup HTML của các bản thiết kế đã duyệt | Không. Mockup là bản ghi bất biến |
| [changelog/](changelog/README.md) | Lịch sử CHANGELOG theo giai đoạn, tới 12/10/2026 | Không. Bản ghi bất biến |
| [snapshots/](snapshots/README.md) | Bản đồ ảnh và danh sách id xuất từ cơ sở dữ liệu production trước mỗi đợt làm mới dữ liệu, không chứa dữ liệu cá nhân | Thêm một thư mục cho mỗi lượt xuất |

## Đọc tài liệu cũ

Tài liệu được viết trong lúc làm dự án, nên hay dùng mã nội bộ như P4e-3a, F17,
W2 hay G41. Bảng giải nghĩa các mã ấy nằm ở
[thuật ngữ](glossary.md#mã-nội-bộ-trong-tài-liệu).

Ba nhóm tài liệu là bản ghi lịch sử và không được sửa chữ, kể cả khi đã lỗi
thời: ADR, entry CHANGELOG cùng thư mục lưu trữ `changelog/`, và mockup. Muốn đổi
một quyết định thì thêm AMEND vào ADR, không sửa thân bài.

Ngày 26/10/2026, nhóm gỡ 89 file là bản ghi quá trình làm: `plans/` (kịch bản thi
công từng bước và prompt cho trợ lý AI), `reviews/` (review các nhánh mobile),
`analysis/progress/` (báo cáo tiến độ), ba file trong `design/` và một bản trùng
của sơ đồ đăng nhập. Link trong ADR và spec đã trỏ sang bản cố định trong git;
link trong CHANGELOG cũ vẫn ghi đường dẫn cũ. Mọi file đã gỡ vẫn xem được ở
[thư mục docs tại commit 6785326e](https://github.com/yurivolkov21/Tourism-Platform-V2/tree/6785326e69949d4ef566c5eaf7c3eaa3706859c8/docs).

## Viết thêm tài liệu

- Thêm một dòng vào `README.md` của thư mục chứa tài liệu mới. Tài liệu không
  nằm trong mục lục nào coi như không tồn tại.
- Câu đầu nói tài liệu để làm gì và cho ai. Viết hiện trạng; chuyện đã qua để
  CHANGELOG và ADR giữ.
- Lần đầu dùng mã nội bộ thì kèm tên dễ hiểu, ví dụ "khu sửa tour (F19)". Gọi
  người theo vai: chủ dự án, khách, nhân viên quản trị.
- Tên file đặt bằng tiếng Anh, nội dung viết tiếng Việt có dấu. Vài file cũ có
  tên tiếng Việt không dấu, như `huong-dan-test-may-that.md`, được giữ nguyên vì
  CHANGELOG gọi đích danh chúng.
- Không để dòng nào bắt đầu bằng dấu `+`: formatter Markdown sẽ đổi nó thành gạch
  đầu dòng. Xem `git diff` của file `.md` trước khi commit.
- Không ghi secret, email cá nhân hay địa chỉ IP vào tài liệu, vì repo công khai.
- Quy ước làm việc đầy đủ (nhánh, commit, kiểm tra trước khi gộp) nằm ở
  [CLAUDE.md](../CLAUDE.md).
