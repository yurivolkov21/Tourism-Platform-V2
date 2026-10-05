# ADR-0051 — Quản trị bài viết: markdown kèm xem trước, slug đặt một lần, đủ mới được đăng, cache bài viết đi theo tag `tours`

- **Trạng thái:** Accepted (2026-10-02)
- **Bối cảnh thi hành:** P4e-4, đi trước code theo luật CLAUDE.md #5. Thiết kế chốt qua
  brainstorm 02/10, từng câu một.
- **Liên quan:** [ADR-0004](0004-post-visibility-helper.md) (luật "đã đăng" và chỗ đọc
  nháp của admin) · [ADR-0016](0016-web-data-layer.md) (tag cache và route bust của web) ·
  [ADR-0035](0035-media-lifecycle.md) và [ADR-0048](0048-tour-photos.md) (vòng đời ảnh) ·
  [ADR-0047](0047-tour-editor-sections.md) (khuôn phiên bản và cổng "đủ mới được bán") ·
  spec [2026-10-02-p4e-4-posts-admin-design.md](../specs/2026-10-02-p4e-4-posts-admin-design.md)

## Bối cảnh

Bảng `posts`, `post_tags`, `post_tag_links`, `post_tours` có từ migration init, chín bài
seed, web đọc qua ba endpoint công khai. Admin chưa có đường ghi nào; mục Posts của
sidebar đang "Soon". Bốn sự thật đo được quyết định thiết kế:

1. **Thân bài là markdown thuần** (`##`, đoạn văn, `- `), web vẽ bằng `react-markdown` +
   `remark-gfm`, không bật HTML thô. App mobile (nhánh của thành viên khác) chỉ hiểu đúng
   ba cú pháp ấy. CSP của web cố ý không mở ảnh từ host lạ.
2. **Chưa nơi nào phát tag cache `posts` hay `post:<slug>`.** G9 (sửa hay xoá tour không
   làm tươi bài viết nhúng tour đó) chỉ là một ca của khe hở này.
3. **Web bỏ qua tour liên quan:** `toJournalPostDetail` vứt `relatedTours`, và `fetchPosts`
   dừng ở 50 bài — cùng lỗi G10 đã vá cho tour.
4. **Nexora** có danh sách, sửa, tag, thay ảnh bìa và xoá bài, KHÔNG có tạo bài mới; tối đa
   3 tour liên quan; hẹn giờ bằng `publishedAt` ở tương lai, không cron.

## Quyết định

### 1. Markdown giữ nguyên, trình soạn là ô markdown có hàng nút và tab xem trước

Hàng nút (H2, đậm, nghiêng, gạch đầu dòng, link) chỉ CHÈN cú pháp markdown; tab Preview
vẽ bằng chính bộ render của web, chuyển về `@tourism/ui` để web và admin dùng một bản.
Không thêm thư viện: `react-markdown` và `remark-gfm` đã nằm trong lockfile.

Luật nội dung, kiểm ở contract: tối đa 20.000 ký tự; từ chối ảnh nhúng `![…](…)` và thẻ
HTML thô. Ảnh trong thân bài cần CSP, vòng đời media và parser mobile — ngoài phạm vi.

### 2. Slug đặt một lần; đọc theo slug, ghi theo `id` kèm phiên bản

Như tour (ADR-0047): slug chốt lúc tạo, nên link cũ không gãy, không phải bust slug cũ,
và lượt seed lại (upsert theo slug) không sinh bài trùng. Lệnh ghi mang `version`
(`updatedAt`); người khác vừa lưu thì `STALE_POST`.

### 3. Trạng thái giữ hai giá trị, hiển thị ba

`PostStatus` vẫn `DRAFT | PUBLISHED`. Admin hiển thị Draft, Scheduled (PUBLISHED, ngày đăng
ở tương lai) hoặc Published — suy bằng MỘT hàm thuần. Đăng là chọn ngày giờ (mặc định bây
giờ, UTC như mọi giờ của admin); `publishedAt` bắt buộc khi PUBLISHED (ADR-0004 đã dặn).
Hẹn giờ không cần cron: tới giờ, chu kỳ ISR 300 giây của web đưa bài lên.

### 4. Đủ mới được đăng, và bài đang đăng phải luôn đủ

Điều kiện: nội dung, tóm tắt, ảnh bìa — đúng ba thứ card trên `/blog` và trang chủ cần.
Nháp lưu thiếu thoải mái. Lệnh ghi đưa bài về PUBLISHED, hay sửa một bài đang PUBLISHED,
mà thiếu thì `POST_NOT_READY` — cùng cổng "đang bán thì phải đủ" của tour.

### 5. Tag gõ thẳng trong form, tour liên quan tối đa 3

Tối đa 5 tag mỗi bài; tên chưa có thì tạo khi lưu, slug sinh từ tên. Tour liên quan tối đa
3, có thứ tự; chọn được tour đang tắt bán, web chỉ hiện tour đang bán (API đã lọc). Web
thêm khối "Tours in this story" dùng lại `RelatedTours`.

### 6. Cache: lệnh ghi bài bust `posts` + `post:<slug>`; trang bài viết mang thêm tag `tours`

Mọi lệnh ghi bài (sửa, đăng, gỡ, xoá) bust hai tag ấy. G9 đóng bằng cách cho lượt đọc chi
tiết bài trên web mang thêm tag `tours` — mọi lệnh ghi tour vốn đã bust tag này — nên API
không phải tra `post_tours` trước khi xoá tour (cascade xoá liên kết trong cùng lệnh).
Danh sách bài trên web đi hết các trang (`collectAllPages`).

### 7. Ảnh bìa: tải lên hoặc chọn từ thư viện, vòng đời theo ADR-0035/0048

Ký upload vào `<root>/posts/<postId>`; publicId vào hàng dọn lúc ký. Lưu thì ghi dòng
`media_assets` (owner POST, role hero, alt). Ảnh bìa bị thay hay bài bị xoá: chỉ ảnh nằm
trong thư mục tải lên của chính bài đó quay lại hàng dọn; ảnh thư viện và catalog không bao
giờ. Xoá bài xoá dòng media của nó trong cùng transaction.

### 8. Chỉ tách thứ ảnh bìa cần; khu sửa tour giữ nguyên

Đường tải ảnh và hộp thư viện của F18 tách ra dùng chung (đóng một phần G15). Form bài viết
có khung riêng một nút Save; `EditorFormFrame`, `useSectionSave`, `useTourFormState` của
tour không đổi.

## Phương án đã cân nhắc và bỏ

- **Soạn thảo trực quan (WYSIWYG, ví dụ TipTap).** Thêm thư viện lớn sát freeze 15/10, phải
  chuyển qua lại markdown; ba cú pháp của mobile càng dễ vỡ.
- **Thân bài dạng khối JSON.** Bản audit schema đã chốt giữ markdown; đổi là migration và
  viết lại cả web lẫn mobile.
- **Khu làm việc nhiều bước như tour.** Một bài viết là một form; chia bước là lưu theo
  từng phần cho một thứ không có phần nào nặng.
- **API tra `post_tours` trước khi xoá tour rồi bust `post:<slug>`.** Nhiều code hơn, phải
  làm ở mọi đường ghi tour, trong khi tag `tours` đã phủ hết với giá vài chục bài.
- **Cho đổi slug.** Phải bust cả slug cũ lẫn mới, link chia sẻ gãy, lượt seed lại sinh bài
  trùng.
- **Chỉ xoá được nháp / không xoá.** Thêm một bước, hoặc để bài thử nằm mãi; xoá có hộp xác
  nhận nói rõ hậu quả là đủ.
- **Tổng quát hoá cả bộ khung sửa tour.** Sửa lại code F19 vừa merge ngay trước freeze.

## Giới hạn đã biết

1. Bài hẹn giờ lên web trễ tối đa ~5 phút sau giờ đăng (ISR), không có lượt bust đúng giờ.
2. Không có trang xem trước nháp trên web; Preview của admin là bản vẽ cùng bộ render.
3. Không dùng `metaTitle`/`metaDescription`; không có ảnh trong thân bài.
4. Xoá một bài seed thì lượt seed lại ~03/11 tạo lại nó (upsert theo slug) với id mới và
   không có ảnh bìa. Cách gỡ là đặt lại ảnh bìa ở trang sửa bài (tải lên hoặc chọn từ thư
   viện), không phải chạy lại `media:upload`: thư mục `media-inbox/` mà script đọc không còn
   trên máy dev từ lần dựng lại 14/09 (sửa ở vòng review P4e-4). `seed:verify` báo ca này
   bằng bất biến readiness của bài viết.
5. Parser mobile chưa hiểu đậm, nghiêng, link mà hàng nút chèn — ghi vào tài liệu bàn giao
   mobile.
6. Mỗi lần sửa tour làm tươi mọi trang bài viết (tag `tours`) — rẻ ở quy mô vài chục bài,
   cần xem lại nếu blog lớn lên.
