# ADR-0053 — Xoá danh mục và điểm đến khi chưa tour nào dùng

- **Trạng thái:** Accepted (2026-10-05)
- **Bối cảnh thi hành:** đợt sửa sạn giao diện admin (nhánh `fix/admin-ui-polish`), đi trước
  code theo luật CLAUDE.md #5. User chốt 05/10 qua brainstorm.
- **Liên quan:** spec [P4e-2](../specs/2026-09-22-p4e-2-categories-destinations-design.md)
  §2a (quyết định cũ "chỉ bật/tắt, không xoá") ·
  [ADR-0048](0048-tour-photos.md) §3 và §6 (tour chép ảnh thư viện địa danh thành dòng của
  riêng mình; ảnh thư viện không bao giờ vào hàng dọn) ·
  [ADR-0052](0052-admin-staff-tier.md) (bảng quyền Owner/Staff) · spec
  [2026-10-05-admin-ui-polish-design.md](../specs/2026-10-05-admin-ui-polish-design.md)

## Bối cảnh

Spec P4e-2 (22/09) cố ý chỉ cho ẩn danh mục và điểm đến, không cho xoá: ẩn thì đảo ngược
được bằng một cú bấm, còn khoá ngoại `tour_destinations.destination_id` khai
`ON DELETE CASCADE` — xoá một điểm đến thì DB **không chặn**, nó lặng lẽ gỡ điểm đến ấy
khỏi mọi tour.

Gần hai tuần dùng thật cho thấy cái giá của "không xoá": dòng tạo thử ở lại vĩnh viễn trong
bảng admin và giữ luôn slug. Prod đang có điểm đến thử `abc` (tạo 04/10, đã ẩn, 0 tour,
0 ảnh) mà không có cách dọn nào ngoài SQL tay. Lượt seed lại ~03/11 cũng không dọn:
`data:reset` giữ nguyên `tours`, `destinations` và `tour_categories`. Nexora có `DELETE` trần
cho cả hai bảng ([admin parity 20/08](../analysis/2026-08-20-admin-parity-nexora.md)).

Khoá ngoại đo trên `schema.prisma`:

| Quan hệ | `onDelete` | Xoá khi còn tour dùng thì |
| --- | --- | --- |
| `tours.category_id` → `tour_categories` | `Restrict` | DB từ chối (`P2003`) |
| `tour_destinations.destination_id` → `destinations` | `Cascade` | DB **gỡ âm thầm** khỏi mọi tour |
| `media_assets` chủ `DESTINATION` | không có khoá ngoại (bảng đa chủ) | dòng ảnh mồ côi |

## Quyết định

1. **Xoá được khi KHÔNG tour nào dùng** — mọi trạng thái, kể cả tour đang tắt bán. Không
   tour thì không booking: booking luôn đi qua một tour.
2. **Danh mục: để DB chặn ngay tại câu xoá.** `Restrict` biến câu `DELETE` thành phán quyết;
   bắt `P2003` → mã contract `IN_USE` (409), `P2025` → `NOT_FOUND`. Không SELECT kiểm
   trước (bài học 1–2 của vòng review F14). Câu xoá chạy trong `withCategoryOrderLock`: khoá
   ấy tuần tự hoá mọi lệnh ghi chạm vị trí tương đối của danh sách, và xoá một hàng đổi
   tập hàng xóm mà `move` đọc.
3. **Điểm đến: kiểm trong CÙNG transaction, dưới khoá hàng.** Giành khoá hàng điểm đến
   (`SELECT … FOR UPDATE`), đếm `tour_destinations`; còn dòng thì `IN_USE`, hết thì xoá các
   dòng `media_assets` chủ `DESTINATION` rồi xoá điểm đến. Câu chèn một liên kết tour mới
   phải giành `FOR KEY SHARE` trên chính hàng ấy (phép kiểm khoá ngoại của Postgres), mà
   khoá này xung đột với `FOR UPDATE`, nên không lệnh nào chen được vào giữa lúc đếm và lúc
   xoá. Lệnh lưu tour đến sau lượt xoá thì nhận `P2003` — mã có sẵn "điểm đến không tồn tại".
4. **File ảnh trên Cloudinary không vào hàng dọn.** Ảnh thư viện địa danh là ảnh catalog
   dùng chung: tour mượn ảnh bằng một dòng `media_assets` của riêng tour, trỏ đúng publicId
   ấy (ADR-0048 §3). Xoá dòng của điểm đến không đụng dòng của tour, và file vẫn phải còn —
   cùng luật "ảnh thư viện không bao giờ vào hàng dọn" (ADR-0048 §6).
5. **Bảng admin biết trước câu trả lời.** Hàng danh mục và điểm đến mang thêm số tour mọi
   trạng thái (`linkedTourCount`), suy từ cùng một lần đọc với `tourCount` (chỉ tour đang
   bán) nên luôn `tourCount ≤ linkedTourCount`. Nút Delete chỉ bật khi số ấy bằng 0; tắt
   thì tooltip nói vì sao và gợi ý ẩn. Server vẫn là phán quyết cuối: bảng có thể cũ hơn DB.
6. **Cache web:** bust `tours` sau commit, cùng tag các lệnh ghi khác của hai bảng. Lệnh xoá
   chỉ chạy khi không tour nào gắn, nên không có trang `tour:<slug>` nào phải bust kèm.
   Hỏng thì không bust.
7. **Quyền (P4f):** hai lệnh mới thuộc tầng Owner, cùng họ `tours.delete` và `posts.delete`.
   Plan P4f viết trước ADR này: số thủ tục admin và bảng `ADMIN_ACCESS` trong plan phải
   cộng hai khoá này.

## Phương án đã cân nhắc và bỏ

| Phương án | Vì sao bỏ |
| --- | --- |
| Giữ "chỉ ẩn" | Dòng thử ở lại mãi và giữ slug; dọn chỉ còn đường SQL tay trên prod |
| Xoá mềm (cột `deleted_at`) | Mọi đường đọc phải thêm luật lọc; gánh nặng không đáng cho dòng chưa ai dùng |
| Cho xoá cả khi còn tour, cascade gỡ khỏi tour | Đúng cái bẫy spec P4e-2 đã tránh: tour mất điểm đến mà không ai được báo |
| Bắt phải ẩn trước rồi mới xoá | Điều kiện 0 tour đã đủ an toàn; thêm bước chỉ thêm cú bấm |
| Nút Delete luôn bật, để server báo `IN_USE` | Admin bấm rồi mới biết; bảng đã có sẵn chỗ để nói trước |

## Giới hạn đã biết

1. Slug được giải phóng ngay và tạo lại được. Link lọc cũ theo slug ấy (`/tours?…=<slug>`)
   vốn đã ra danh sách rỗng vì 0 tour; xoá xong vẫn rỗng.
2. Xoá không đảo ngược được, và hộp xác nhận nói rõ điều này.
3. Điểm đến có ảnh thư viện mà 0 tour thì xoá kéo ảnh ra khỏi thư viện: mất dòng ghi công
   trong DB, file còn trên Cloudinary, tour đang dùng ảnh ấy vẫn giữ dòng của mình. Đo prod
   05/10: chỉ `abc` ở 0 tour, và nó không có ảnh nào.
