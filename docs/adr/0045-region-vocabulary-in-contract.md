# ADR-0045 — Ba vùng miền là từ vựng chung, sống ở `@tourism/contract`

- **Ngày:** 22/09/2026
- **Trạng thái:** Chấp nhận
- **Bối cảnh:** [Spec P4e-2](../specs/2026-09-22-p4e-2-categories-destinations-design.md) §2b

## Bối cảnh

Điểm đến có cột `region` kiểu `VARCHAR(80)`, chữ tự do. Web ghép nó với ba vùng
cố định bằng `regionOf` (`apps/web/src/lib/regions.ts`): so với `key`
(`north`) hoặc `name` (`Northern Vietnam`), đã lowercase và trim. Trượt cả hai
thì hàm trả `null`, và điểm đến ấy **biến khỏi mọi trang vùng mà không có lỗi
nào ở đâu cả**.

Ba vùng đang viết cứng ở `apps/web/src/mocks/regions.ts` — đúng 10 dòng, chỉ có
`key`/`slug`/`name`:

```ts
{ key: 'north',   slug: 'northern-vietnam', name: 'Northern Vietnam' },
{ key: 'central', slug: 'central-vietnam',  name: 'Central Vietnam' },
{ key: 'south',   slug: 'southern-vietnam', name: 'Southern Vietnam' },
```

P4e-2 cho admin sửa `region`, và đã chốt dùng **danh sách chọn** thay vì ô chữ
tự do (spec §2b). Danh sách ấy phải lấy ba giá trị từ đâu đó.

## Quyết định

**Ba vùng dời vào `@tourism/contract`.** Web, admin và API cùng đọc một nguồn;
`apps/web/src/mocks/regions.ts` thôi khai giá trị và chỉ còn tái xuất khẩu để
các trang vùng không phải sửa đường import.

Ba lý do, xếp theo sức nặng:

1. **Hai bản khai là hai bản sẽ trôi xa nhau.** Nếu picker của admin tự khai ba
   chuỗi và web tự khai ba chuỗi, không có gì bắt được lúc chúng lệch. Hậu quả
   không phải một lỗi đỏ mà là một điểm đến lặng lẽ không xuất hiện ở đâu.
2. **Đây đã là nếp của dự án.** ADR-0041 §8 chốt luật hoàn tiền là bộ hàm thuần
   ở contract vì "API, web, admin, seed và email gọi chung một bộ hàm". Từ vựng
   vùng miền cùng loại: nhiều bề mặt đọc, một nghĩa duy nhất.
3. **`mocks/` là chỗ SAI về ngữ nghĩa.** Thư mục ấy chứa dữ liệu giả của thời
   P3b tĩnh; ba vùng thì không giả chút nào — chúng là từ vựng mà dữ liệu thật
   trong DB phải khớp.

**Lưu `name` xuống DB**, không lưu `key`. Dữ liệu 18 hàng hiện có đang lưu
`name` (`Northern Vietnam`), và `regionOf` nhận cả hai dạng — nên lưu `name` là
không phải đụng một hàng nào.

## Hệ quả

- `@tourism/contract` nay sở hữu từ vựng vùng miền. Thêm hoặc đổi tên một vùng
  là sửa contract, và cả ba app cùng thấy.
- `generateStaticParams` của `/destinations/[region]` đọc gián tiếp qua bản tái
  xuất khẩu. **Dời sai là ba trang vùng biến khỏi bản build**, nên bước dời phải
  có test ghim đủ ba slug.
- Picker của admin không tự chế chuỗi nào.

## Điều này KHÔNG mở ra

**Vùng miền vẫn không phải dữ liệu.** Mỗi vùng có nguyên một trang với hero,
gallery, mùa trong năm và bưu thiếp — viết tay trong `apps/web`, lấy chữ từ
`messages.regionPage.regions[key]`. Thêm vùng thứ tư là một đợt việc của web,
không phải một dòng mới trong bảng. Contract giữ ba giá trị ấy như một enum
đóng, và admin chỉ được chọn trong đó.

Nếu sau này vùng miền thật sự cần thành dữ liệu (một bảng `regions` với nội
dung biên tập), đó là một ADR khác và một phase khác — đừng lặng lẽ nới enum
này ra thành chữ tự do.

## Đã cân nhắc và loại

- **Đổi cột `region` thành enum Postgres.** Chặt hơn thật, nhưng thêm một
  migration đổi kiểu trên cột mà web đang đọc, đúng giai đoạn sắp freeze; và
  enum của Postgres thì thêm giá trị mới phải `ALTER TYPE`. Lợi thêm so với một
  danh sách chọn ở tầng ứng dụng là không đáng.
- **Để nguyên ở `mocks/` rồi cho admin import từ đó.** `apps/admin` không phụ
  thuộc `apps/web` và không nên bắt đầu phụ thuộc vì ba dòng hằng.
- **Giữ ô chữ tự do, chỉ thêm cảnh báo khi không khớp.** Vẫn cho lưu một giá
  trị vô dụng; cảnh báo chỉ chuyển trách nhiệm sang người đang vội.
