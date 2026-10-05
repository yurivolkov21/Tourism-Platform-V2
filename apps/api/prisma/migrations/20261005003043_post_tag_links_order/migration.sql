-- Thứ tự tag của một bài (vòng review P4e-4), cùng khuôn `post_tours.order`.
--
-- Web lấy tag ĐẦU TIÊN làm chip danh mục trên thẻ bài, mà bảng nối không có cột
-- thứ tự nên "đầu tiên" là thứ tự vật lý của Postgres: một lần lưu từ admin
-- (xoá rồi chèn lại dây tag) có thể đổi chip dù không ai đổi tag.
--
-- Dòng có từ trước đều nhận 0 — dữ liệu không còn dấu vết thứ tự cũ để khôi
-- phục. Đường đọc sắp theo `order` rồi tới tên tag, nên các dòng ấy đứng yên
-- theo vần cho tới lần lưu kế hoặc lượt seed lại.

-- AlterTable
ALTER TABLE "post_tag_links" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
