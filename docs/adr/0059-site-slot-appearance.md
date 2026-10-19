# ADR-0059 — Appearance: danh mục khe ở contract, bốn nguồn ảnh của một lần lưu, bảng ảnh gốc

- **Trạng thái:** Accepted (2026-10-19)
- **Bối cảnh thi hành:** P4f Appearance, [spec 15/10](../specs/2026-10-15-p4f-appearance-design.md)
  Yuri duyệt ngày 19/10. Đi trước code theo luật CLAUDE.md #5. Số ADR giữ từ 15/10.
- **Liên quan:** [ADR-0005](0005-media-read-build-url.md) (đọc media) ·
  [ADR-0016](0016-web-data-layer.md) AMEND 2 (tag `site-media`) ·
  [ADR-0021](0021-media-write-surface.md) AMEND 1–2 (ký upload) ·
  [ADR-0035](0035-media-lifecycle.md) §3, AMEND 2b, AMEND 3 (hàng dọn, vùng tải lên) ·
  [ADR-0048](0048-tour-photos.md) §5, AMEND 2 (metadata tải lên, thư viện là ảnh địa danh) ·
  [ADR-0051](0051-posts-admin.md) §7 (ảnh bìa bài viết, khuôn gần nhất) ·
  [ADR-0052](0052-admin-staff-tier.md) (Staff)

## Bối cảnh

Năm sự thật đo được (spec §2, production đọc chỉ ngày 15/10 và 19/10):

1. Web đọc 47 khe ảnh qua `siteMediaImage(key: string)`. Khoá là chuỗi rời rạc ở từng trang, có
   khoá ghép chuỗi (`region-gallery-${region}-${n}`); không có danh mục khe nào trong code. Comment
   của `schema.prisma` nói danh mục nằm trong API, nhưng thật ra chỉ có danh sách khoá của seed.
2. Production có 52 dòng `site_media_slots`. 47 khe web đọc (và `about-team-ops`) có đúng một ảnh,
   role `hero`, `sortOrder` 0, nằm ở `tourism/catalog/site/<key>`. Cả 52 dòng có
   `created_at = updated_at`: chưa đường ghi nào chạm bảng này sau seed.
3. 48 ảnh site không có dòng `DESTINATION` nào trùng publicId. Thay ảnh một khe bằng cách xoá
   dòng `SITE` cũ thì không còn đường nào trong admin để chọn lại ảnh gốc.
4. Web gắn tag `site-media` cho lượt đọc khe (ISR 300 giây) nhưng API chưa bao giờ bắn tag ấy.
5. Bộ dọn ảnh chỉ xoá trong vùng tải lên (`UPLOAD_ZONE_OWNERS`, ADR-0035 AMEND 3); vùng ấy chưa có
   thư mục `site`.

## Quyết định

### 1. Danh mục khe là một mảng hằng ở contract

`libs/shared/contract/src/site-slots.ts` giữ 47 mục theo thứ tự trang admin bày: `key`, `group`
(tám trang web), `path`, `kind` (`image` hay `video`), `frames` (`{ desktop, phone }`, mỗi khổ là
`[w, h]` đo được hoặc `null` khi khổ đó không hiện khe) và `inMobileApp`. `SiteSlotKey` là union
của mọi khoá; `siteMediaImage` của web nhận `SiteSlotKey`, nên gõ sai khoá là lỗi typecheck.

Danh mục nằm ở contract vì cả ba bên đọc nó: web (kiểu khoá), API (thứ tự và kiểu của `list`,
chặn khe video ở schema), admin (nhóm, khung xem trước). Chữ hiển thị (nhãn khe, câu chú thích)
ở `@tourism/i18n`, không ở danh mục.

Hai lưới canh lệch ngoài typecheck: spec phía web kiểm mọi khoá ghép chuỗi và mọi khoá trong mock
có trong danh mục, và câu chú thích chép sang admin khớp bản của web; spec phía API kiểm mọi khoá
của danh mục có trong `SITE_SLOT_KEYS` của seed.

### 2. Một lần lưu nhận ảnh từ đúng một trong bốn nguồn

`admin.appearance.setSlot({ key, version, image: { publicId, alt, upload? } })`. Ảnh gửi lên
được xét theo thứ tự:

1. **Ảnh đang dùng của khe:** giữ cột, chỉ đổi alt.
2. **Ảnh tải lên** trong thư mục của chính khe `<root>/site/<slotId>/`, kèm metadata Cloudinary
   (ADR-0048 §5). Ghi công để trống.
3. **Ảnh gốc của khe** (§4): metadata và ghi công chép từ bảng ảnh gốc.
4. **Ảnh thư viện:** dòng `DESTINATION` loại `IMAGE` cùng publicId; server chép metadata và ghi
   công từ dòng ấy.

Không thuộc nguồn nào thì cả lệnh bị từ chối, mã `PHOTO_NOT_ALLOWED` (400): chuỗi này là đối số
của một lệnh destroy sau này (ADR-0035). Phán quyết là hàm thuần `planSlotImage`, khuôn
`planPostCover`. Nguồn của ảnh đang dùng mà `list` trả: `ORIGINAL` (publicId bằng ảnh gốc),
`UPLOAD` (thư mục tải lên của khe), `LIBRARY` (có dòng thư viện), còn lại `OTHER`.

### 3. Ghi trong một transaction, phiên bản là `updatedAt` của dòng khe

1. Tạo dòng khe nếu chưa có (`INSERT … ON CONFLICT DO NOTHING`; production có đủ, DB mới dựng có
   thể thiếu), rồi khoá dòng ấy `FOR UPDATE`.
2. So phiên bản. `list` trả `version` là `updatedAt` dạng ISO, hoặc `null` khi khe chưa có dòng.
   `null` khớp dòng chưa từng được lưu (`updatedAt = createdAt`), để dòng mà `signUpload` vừa tạo
   giữa lúc admin mở trang và lúc bấm lưu không làm lệnh lưu đầu tiên thành `STALE_SLOT`. Phiên
   bản khác thì phải bằng đúng `updatedAt`. Lệch là `STALE_SLOT` (409).
3. Xoá mọi dòng `SITE` của khe, ghi một dòng mới (role `hero`, `sortOrder` 0), đặt `updatedAt` của
   dòng khe bằng `nextTourVersion`: hai lần lưu trong một mili-giây vẫn ra hai phiên bản.
4. Ảnh cũ chỉ vào lại hàng dọn khi nó nằm trong thư mục tải lên của chính khe (cùng transaction,
   ADR-0035 AMEND 2b). Ảnh gốc và ảnh thư viện không bao giờ vào hàng dọn.

Sau commit: `void revalidate(['site-media'])`, đường đầu tiên bắn tag này. Bust trước commit thì web
đọc lại dữ liệu cũ rồi giữ thêm 300 giây. Lệnh ghi hỏng thì không bust.

### 4. Bảng ảnh gốc trong code API

`apps/api/src/modules/site-media/site-slot-originals.ts` giữ một mục cho mỗi khe của danh mục
(publicId, version, kích thước, format, bytes, alt, bốn cột ghi công), sinh một lần lúc thi công từ
một câu SELECT chỉ đọc trên production. Hôm nay cả 47 khe đang dùng đúng ảnh gốc, nên bảng là ảnh
chụp trạng thái ấy. Nút Restore original là một lần `setSlot` với publicId của ảnh gốc.

Bảng cũng lấp được khe trống của một DB mới dựng (máy dev, CI): ảnh gốc là nguồn hợp lệ cả khi khe
chưa có dòng ảnh nào.

### 5. Ký tải lên theo khe

`admin.appearance.signUpload({ key })` tạo dòng khe nếu chưa có (cần `id` để đặt thư mục), rồi trả
một bộ tham số ký giữ nguyên ADR-0021 AMEND 1–2 vào thư mục `<root>/site/<slotId>`; publicId vào
hàng dọn ngay lúc ký (ADR-0035 §3). `UPLOAD_ZONE_OWNERS` thêm `site` với chủ sở hữu dạng uuid.
Ảnh gốc ở `tourism/catalog/site/` nằm ngoài vùng tải lên nên bộ dọn không bao giờ xoá.

`key` của `signUpload` và `setSlot` chỉ nhận khe ảnh: khe video `about-cta-video` bị chặn ngay ở
schema.

### 6. Quyền, thư viện, script

- `appearance.list`, `appearance.signUpload`, `appearance.setSlot` đều là `staff` trong
  `ADMIN_ACCESS`, cùng bậc với sửa bài viết.
- Hộp chọn ảnh dùng lại `admin.tours.photoLibrary`.
- `media-upload.mjs` bỏ qua khe đã có dòng ảnh, cùng luật đang áp cho tour và bài viết; không có
  luật này thì chạy lại script sẽ thêm ảnh gốc bên cạnh ảnh admin vừa chọn.

## Phương án đã cân nhắc và bỏ

- **Giữ dòng ảnh cũ trong `media_assets` dưới một vai khác** để chọn lại được. Web đọc mọi dòng
  `SITE` của khe và lấy dòng đầu, nên giữ thêm dòng là đổi luật đọc ở cả API lẫn web.
- **Đưa 48 ảnh site vào thư viện** (thêm dòng `DESTINATION`). Ảnh site không gắn địa danh nào;
  thư viện thành kho lẫn ảnh thương hiệu và ảnh đội ngũ.
- **Danh mục khe chỉ ở API.** Web không kiểm được khoá lúc typecheck, admin phải gọi API mới biết
  nhóm và khung.
- **Giành dòng bằng một câu `UPDATE … WHERE updated_at = ?`** như `claimPost`. Không phủ được
  khe chưa có dòng; tạo dòng trước rồi `FOR UPDATE` cho một luật cho cả hai ca.
- **Ký bằng `media.signUpload` chung** (như Nexora). Không có thư mục theo khe thì bộ dọn không
  biết ảnh nào của khe nào, và ảnh tải lên bỏ dở không bao giờ bị dọn.
- **Cho thay video, điểm lấy nét, nhiều phiên bản ảnh mỗi khe:** ngoài phạm vi (spec §1).

## Giới hạn đã biết

1. Khung trong danh mục đo tay một lần (Chromium, 1440×900 và 390×844). Đổi bố cục web làm khung
   lệch thì phải sửa số; không test nào bắt được.
2. Bảng ảnh gốc là ảnh chụp ngày thi công. Ai thay ảnh gốc bằng script thì phải sinh lại bảng.
3. Thay một ảnh có chú thích mà chọn sai cảnh thì câu chữ trên web nói sai; admin chỉ nhắc.
4. App mobile ghim URL ảnh gốc ở sáu khung đăng nhập (`auth-media.ts`), không đọc API.
5. Ảnh tải lên bị thay thì bộ dọn xoá sau 7 ngày, không lấy lại được từ admin.
6. Web chưa hiện ghi công ở đâu (ADR-0020); việc của web, đề xuất thành mục G riêng.
