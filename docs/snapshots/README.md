# Snapshot dữ liệu — bản đồ ảnh và danh sách id

> Ảnh chụp cơ sở dữ liệu prod, xuất **trước mỗi đợt làm mới dữ liệu**. Đây là
> lưới an toàn, không phải tài liệu đọc hằng ngày. Sinh tự động, đừng sửa tay.

```bash
pnpm --filter @tourism/api snapshot:export
```

## Vì sao cần

Bảng `media_assets` là **bản đồ duy nhất** nối hơn 240 file trên Cloudinary với
nội dung dùng chúng — không có khoá ngoại nào ràng buộc hai bên. Xoá rồi tạo
lại chủ sở hữu với id mới là biến ảnh thành mồ côi **trong im lặng**: file vẫn
nằm trên Cloudinary, nhưng không còn ai biết tấm nào của tour nào.

Bản sao cục bộ trong `media-inbox/` không thay thế được (thiếu khoảng 40 file).
Mất bảng này là mất ảnh thật.

Script **chỉ đọc** — không có một câu `INSERT`/`UPDATE`/`DELETE` nào.

## Bảy file trong mỗi lượt

| File | Nội dung |
| --- | --- |
| `media-assets.json` | Toàn bộ bảng `media_assets` — bản đồ ảnh, file lớn nhất (~390 KB) |
| `site-media-slots.json` | Các khe ảnh cố định của site (hero trang chủ, video trang giới thiệu…) |
| `tours-ids.json` | id · slug · tiêu đề · đã đăng chưa |
| `destinations-ids.json` | id · slug · tên · vùng |
| `posts-ids.json` | id · slug · tiêu đề · trạng thái · ngày đăng |
| `tour-categories-ids.json` | id · slug · tên |
| `keep-list.json` | Tài khoản quản trị được giữ lại khi dọn dữ liệu, kèm lý do |

Bốn file `*-ids.json` **chỉ lấy id, slug và nhãn** — đủ để nối lại ảnh theo
slug, không kéo theo nội dung biên tập.

## Hai nơi, đừng trộn

| Thư mục | Nội dung | Git |
| --- | --- | --- |
| `docs/snapshots/<ngày>/` | Bản đồ ảnh + id, **không có dữ liệu cá nhân** | **commit** |
| `backups/<ngày>/` | Người dùng, đơn hàng, thanh toán, đánh giá… | **gitignored** |

Kho mã này công khai trên GitHub. Trộn hai thứ là đẩy email của khách lên mạng.

## Lượt nào đang có hiệu lực

**Lượt mới nhất**, luôn luôn. `reset-operational-data.mjs` đọc `keep-list.json`
ở **thư mục có ngày lớn nhất** để biết giữ lại tài khoản quản trị nào — nên thêm
một lượt mới là đổi luôn hành vi của script dọn dữ liệu.

Hiện tại: **`2026-09-18/`**.

## Bốn lượt đã có, và chuyện trùng lặp

| Lượt | Dịp |
| --- | --- |
| `2026-09-09` | Trước khi dọn tầng vận hành trên prod |
| `2026-09-10` | Trước khi seed toàn bộ dữ liệu mới |
| `2026-09-15` | Trước lượt seed prod 1 (trọn năm 2026) |
| `2026-09-18` | Trước khi triển khai luật hoàn tiền một hạn chót |

**Phần lớn nội dung trùng nhau, và điều đó bình thường** — đo ngày 21/09: bốn
file `*-ids.json` cộng `site-media-slots.json` giống hệt ở cả bốn lượt (danh mục
không đổi), `media-assets.json` có hai phiên bản, `keep-list.json` có ba. Lượt
`2026-09-18` trùng `2026-09-15` ở cả bảy file.

Đừng vội xoá lượt trùng: mỗi lượt là **bằng chứng của một bước đã làm**, và ba
lượt gần nhất đều được entry CHANGELOG nhắc đích danh. Cả bốn lượt cộng lại chỉ
1,7 MB.

## Khi nào xuất lượt mới

Trước bất cứ thao tác nào xoá hoặc tạo lại dữ liệu trên prod. Lượt kế tiếp đã
biết trước: **lượt seed 2, khoảng 03/11/2026** (xem [open-items](../open-items.md)).
