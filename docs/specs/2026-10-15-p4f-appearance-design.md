# Spec P4f — Appearance: ảnh các khe của web

- **Ngày:** 2026-10-15 · **Trạng thái:** Yuri duyệt 19/10; thi công theo
  [plan 19/10](../plans/2026-10-19-p4f-appearance.md).
- **Quyết định kiến trúc:** [ADR-0059](../adr/0059-site-slot-appearance.md), viết từ §4 của spec
  này sau khi spec được duyệt, trước code (luật 5).
- **Nền:** [ADR-0005](../adr/0005-media-read-build-url.md) (đọc media) ·
  [ADR-0016](../adr/0016-web-data-layer.md) AMEND 2 (tag `site-media` chưa có ai bắn) ·
  [ADR-0020](../adr/0020-real-images-sourcing.md) §4 (không cắt ảnh phía máy chủ) ·
  [ADR-0021](../adr/0021-media-write-surface.md) (ký upload) ·
  [ADR-0035](../adr/0035-media-lifecycle.md) AMEND 3 (vùng tải lên của bộ dọn) ·
  [ADR-0048](../adr/0048-tour-photos.md) (thư viện là ảnh địa danh) ·
  [ADR-0051](../adr/0051-posts-admin.md) §7 (ảnh bìa bài viết, khuôn gần nhất) ·
  [ADR-0052](../adr/0052-admin-staff-tier.md) (Staff)
- **Đóng:** mục Appearance của sidebar admin (đang `enabled: false`). Media library có spec riêng.

## 1. Mục tiêu & phạm vi

### Vấn đề

Web có 47 khe ảnh "thương hiệu": hero trang chủ và About, ảnh khối Why choose us, bento,
timeline và Team của About, khung Contact, năm khoảnh khắc ở `/destinations`, 18 ô ảnh của ba
trang vùng, panel của sáu trang đăng nhập. Đổi một ảnh hôm nay phải chạy `media:upload` trên máy,
đẩy file đè lên Cloudinary rồi ghi `media_assets` bằng tay. Nexora có trang Appearance đọc và
thay ảnh theo khe, nên đây là thụt lùi cần vá (luật 10, bản đối chiếu admin 20/08 dòng
Appearance, loại [V]). Ba thành viên trong khối Team của About hiện vẫn là ảnh robot pixel giữ
chỗ, và chưa có đường nào để họ tự thay bằng ảnh thật.

### Trong phạm vi

- Trang `/appearance`: 47 khe nhóm theo trang web; mỗi khe xem ảnh đang dùng trong khung desktop
  và khung điện thoại đúng tỉ lệ khe.
- Thay ảnh của một khe: tải ảnh mới lên, hoặc chọn từ thư viện ảnh địa danh. Sửa alt.
- Về lại ảnh gốc của khe bằng một nút.
- Web hiện ảnh mới ngay sau khi lưu (API bắn tag `site-media`), thay vì chờ tối đa 5 phút.

### Ngoài phạm vi, cố ý

- Sửa chữ hay bố cục trang. Mọi chữ của web nằm trong `@tourism/i18n`, DB không giữ chuỗi nào.
- Khe video `about-cta-video`: chỉ xem. Thay video cần chữ ký upload video, ảnh poster, và
  ADR-0035 Giới hạn #3 (bộ dọn chưa kiểm poster).
- Năm khoá chỉ có trong seed mà web không đọc: `home-experiences`, `home-trust`,
  `content-hero`, `destinations-hero`, `about-team-ops`.
- Điểm lấy nét hay cắt ảnh. Web luôn căn giữa bằng `object-fit: cover`; thêm điểm lấy nét là đổi
  cả web lẫn schema.
- App mobile: sáu khung đăng nhập ghim URL ảnh gốc ngay trong code (`auth-media.ts`), không đọc API.
- Lịch sử nhiều phiên bản ảnh của một khe; chỉ có "về ảnh gốc".
- Làm trống một khe (web sẽ vẽ ô giữ chỗ trên site thật).

## 2. Hiện trạng đo được (15/10)

- **Production** (đọc chỉ): 52 dòng `site_media_slots`. Cả 47 khe web đọc, cộng `about-team-ops`,
  có đúng một ảnh, đều nằm ở `tourism/catalog/site/<key>` và đều có alt. Bốn khoá seed còn lại
  không có ảnh.
- **Web:** `siteMediaImage(key)` lấy ảnh đầu tiên của khe; `SlotImage` vẽ `object-cover` căn giữa,
  không component nào đặt `object-position`. Lệnh đọc gắn tag `site-media`, ISR 300 giây, nhưng
  API chưa bao giờ bắn tag ấy.
- **Không có danh mục khe nào trong code.** Comment `schema.prisma` (dòng 1065–1067) nói danh
  mục nằm trong API; thật ra chỉ có danh sách khoá trong seed (`SITE_SLOT_KEYS`) và ghi chú kích
  thước cho 29 khoá trong `media-tree.mjs`.
- **Ảnh có chú thích riêng.** 39 khe đi kèm câu chữ nói về cảnh trong ảnh: năm khoảnh khắc
  (`mocks/moments.ts`), 18 ô ảnh và bưu thiếp trang vùng (`regionPage.*.galleryTiles`,
  `postcards`), năm mục Why choose us, bốn mốc timeline, bốn ô bento About (tên vùng), ba người
  trong Team. Comment ở i18n đã dặn: "đổi ảnh thì phải đổi caption cùng chỉ số".
- **Ba ảnh Team là robot pixel giữ chỗ** (alt trên production ghi rõ), đúng ADR-0020 §7: không
  lấy ảnh người lạ làm "đội ngũ". Appearance là đường để nhóm tự tải chân dung thật.
- **Không ảnh site nào nằm trong thư viện:** 0 dòng `DESTINATION` trùng publicId với 48 ảnh site.

## 3. Danh mục khe

### 3.1 Vị trí và hình dạng

`libs/shared/contract/src/site-slots.ts` là danh mục DUY NHẤT: một mảng hằng 47 mục theo thứ tự
hiện trên trang admin. Mỗi mục:

| Trường | Ý nghĩa |
| --- | --- |
| `key` | khoá khe; `SiteSlotKey` là union của mọi khoá |
| `group` | trang web chứa khe (`home`, `about`, `contact`, `destinations`, `north`, `central`, `south`, `auth`) |
| `path` | URL trang web để mở xem |
| `kind` | `image` hay `video` |
| `frames` | `{ desktop: [w, h] \| null, phone: [w, h] \| null }`, `null` là khổ đó không hiện khe |
| `inMobileApp` | ảnh gốc của khe cũng được app mobile ghim trong code |

Nhãn, ghi chú và câu chú thích hiển thị ở admin là chữ tiếng Anh trong `@tourism/i18n`
(`admin.appearance`). Câu chú thích lấy thẳng chuỗi web khi chuỗi nằm ở i18n (ô ảnh và bưu
thiếp trang vùng, Why choose us, timeline). Câu nằm trong mock của web (khoảnh khắc, Team, tên
vùng của bốn ô bento) thì admin không import được, nên chép sang i18n và một spec phía web canh
hai bản khớp nhau.

Ba lưới canh lệch:

- Web gọi `siteMediaImage(key: SiteSlotKey)`: gõ sai khoá là lỗi typecheck.
- Spec phía web: mọi khoá ghép chuỗi (`region-gallery-*`, `region-signature-*`, khoá trong
  `MOMENTS`, `TEAM`, timeline) đều có trong danh mục.
- Spec phía API: mọi khoá trong danh mục có trong `SITE_SLOT_KEYS` của seed.

Sửa comment `schema.prisma` và comment `SITE_SLOT_KEYS` của seed để trỏ về danh mục. Sửa comment
schema không cần migration.

### 3.2 Khung đo được

Đo 15/10 bằng Chromium 141 trên web chạy ở máy (cùng CSS với production; production không mở
được từ session cloud nên đây là suy ra, chưa đo trên site thật). Số là `offsetWidth ×
offsetHeight` của khung bọc ảnh, đơn vị px CSS, ở khung nhìn 1440×900 và 390×844.

| Trang | Khe | Desktop | Điện thoại |
| --- | --- | --- | --- |
| Home | `home-hero` | 1436×900 | 390×844 |
| Home | `home-why-choose` và năm `why-*` | 486×411 | 358×411 |
| Home | `cta-band` | 1436×636 | 390×636 |
| About | `about-hero` | 1436×900 | 390×844 |
| About | `about-story` | 454×700 | 358×600 |
| About | bốn `about-timeline-*` | 512×208 | 358×176 |
| About | `about-gallery-north` | 628×544 | 358×420 |
| About | `about-gallery-central` | 628×260 | 358×260 |
| About | `about-gallery-south`, `about-gallery-all` | 302×260 | 358×260 |
| About | ba `about-team-*` | 411×320 | 358×320 |
| About | `about-cta-video` (chỉ xem) | 1280×384 | 358×384 |
| Contact | `contact-panel` | 589×790 | 356×619 |
| Destinations | `moment-lanha-kayak` | 586×442 | 358×269 |
| Destinations | bốn `moment-*` còn lại | 289×217 | 175×131 |
| Northern Vietnam | `region-gallery-north-1` … `-6` | 380×224, 288, 384, 160, 256, 240 | 358×176 |
| Central Vietnam | `region-gallery-central-1` … `-6` | 380×475 | 280×350 |
| Southern Vietnam | `region-gallery-south-1` | 1024×576 | 358×201 |
| Southern Vietnam | `region-gallery-south-2`, `-3` | 606×288, 398×288 | 358×224 |
| Southern Vietnam | ba `region-signature-south-*` | 377×503 | 358×477 |
| Sign-in pages | `auth-panel` | 720×900 | không hiện |

Cùng một ảnh bị cắt rất khác nhau giữa hai khổ: hero là khung ngang 16:10 trên desktop nhưng là
dải đứng 390×844 trên điện thoại. Vì vậy xem trước phải có cả hai khung.

## 4. Luật thao tác (nội dung ADR-0059)

### 4.1 Bốn nguồn của một lần lưu

`setSlot` nhận `{ key, version, image: { publicId, alt, upload? } }`. Ảnh gửi lên thuộc đúng
một nguồn, xét theo thứ tự:

1. **Ảnh đang dùng của khe:** giữ nguyên, chỉ đổi alt.
2. **Ảnh tải lên** trong thư mục của chính khe `<root>/site/<slotId>/`, kèm metadata Cloudinary
   do admin gửi (ADR-0048 §5). Ghi công để trống.
3. **Ảnh gốc của khe:** publicId đúng bằng ảnh gốc ghi trong bảng ảnh gốc (§4.4); metadata, alt
   gợi ý và ghi công chép từ bảng.
4. **Ảnh thư viện:** publicId có dòng `DESTINATION` loại `IMAGE` (ADR-0048 AMEND 2); server chép
   metadata và ghi công từ dòng đó, không nhận từ client.

Không thuộc nguồn nào thì cả lệnh bị từ chối, mã `PHOTO_NOT_ALLOWED`. Phán quyết nằm ở một hàm
thuần `planSlotImage`, cùng khuôn `planPostCover`.

### 4.2 Ghi

Trong một transaction:

1. Tạo dòng khe nếu chưa có (production có đủ; DB mới dựng có thể thiếu), rồi khoá dòng ấy
   `FOR UPDATE`.
2. So `version` (là `updatedAt` của dòng khe; `null` khi khe chưa từng có dòng). Lệch thì
   `STALE_SLOT` (409).
3. Xoá mọi dòng `SITE` của khe, ghi một dòng mới (role `hero`, `sortOrder` 0), chạm `updatedAt`
   của dòng khe.
4. Ảnh cũ chỉ vào lại hàng dọn khi nó nằm trong thư mục tải lên của chính khe (`requeue`,
   ADR-0035 AMEND 2b). Ảnh gốc và ảnh thư viện không bao giờ vào hàng dọn.

Sau khi commit: `void revalidate(['site-media'])`. Đây là nơi đầu tiên bắn tag này; bust trước
commit thì web đọc lại dữ liệu cũ rồi giữ thêm 300 giây.

### 4.3 Ký tải lên

`admin.appearance.signUpload({ key })` trả một bộ tham số ký giữ nguyên ADR-0021 AMEND 1–2,
thư mục `<root>/site/<slotId>`, và publicId vào hàng dọn ngay lúc ký (ADR-0035 §3). Thêm thư mục
`site` với chủ sở hữu dạng uuid vào `UPLOAD_ZONE_OWNERS`; ADR-0035 AMEND 3 đã dặn đúng việc này,
không thêm thì bộ dọn từ chối ảnh khe tải lên rồi bị thay (giữ ảnh, không mất ảnh). Ảnh gốc ở
`tourism/catalog/site/` nằm ngoài vùng tải lên nên bộ dọn không bao giờ xoá.

### 4.4 Bảng ảnh gốc

`apps/api/src/modules/site-media/site-slot-originals.ts` giữ 47 mục (publicId, version, kích
thước, format, alt, bốn cột ghi công), sinh một lần lúc thi công từ một câu SELECT chỉ đọc trên
production. Hôm nay cả 47 khe đang dùng đúng ảnh gốc, nên bảng là ảnh chụp trạng thái hiện tại.

Vì sao cần bảng: thay ảnh là xoá dòng `SITE` cũ, mà 48 ảnh site không có dòng `DESTINATION` nào,
nên sau một lần thay thì không còn đường nào trong admin để chọn lại ảnh gốc. Buổi thử thuyết
trình chắc chắn sẽ thay thử vài khe rồi cần trả lại như cũ.

Phương án đã bỏ: giữ dòng cũ trong `media_assets` dưới một vai khác. Web đọc mọi dòng `SITE` của
khe và lấy dòng đầu, nên giữ thêm dòng là phải đổi luật đọc ở cả API lẫn web.

### 4.5 Quyền

Ba thủ tục mới đều là `staff` trong `ADMIN_ACCESS`, cùng bậc với sửa bài viết (ADR-0052). Thư
viện ảnh dùng lại `admin.tours.photoLibrary`.

### 4.6 Script

`media-upload.mjs`: khe đã có dòng ảnh thì bỏ qua, cùng luật đang áp cho tour và bài viết. Không
có luật này thì chạy lại script sẽ thêm dòng ảnh gốc bên cạnh ảnh admin vừa chọn. Đợt reseed
production (khoảng 03/11) không đụng ảnh khe: `reset-operational-data.mjs` giữ `media_assets`
không phải REVIEW và giữ `site_media_slots`.

## 5. Contract `admin.appearance`

| Thủ tục | Vào | Ra | Lỗi |
| --- | --- | --- | --- |
| `list` | — | 47 khe theo thứ tự danh mục: `key`, `version`, `image` (publicId, url, alt, width, height, ghi công, `source`), `original` (publicId, url) | — |
| `signUpload` | `{ key }` | `SignedUploadParams` | — |
| `setSlot` | `{ key, version, image: { publicId, alt, upload? } }` | khe sau khi lưu, cùng hình một dòng của `list` | `STALE_SLOT` 409, `PHOTO_NOT_ALLOWED` 400 |

- `source` của ảnh đang dùng: `UPLOAD`, `ORIGINAL`, `LIBRARY`, hoặc `OTHER` (dòng script ghi mà
  không khớp nguồn nào; hiện không có).
- `key` của `signUpload` và `setSlot` chỉ nhận khe ảnh: khe video bị chặn ngay ở schema.
- `alt` tối đa 300 ký tự (độ rộng cột); trống là ảnh trang trí, web vẽ `alt=""` như hôm nay.

## 6. Giao diện admin

### 6.1 Trang `/appearance`

- Bật mục Appearance trong sidebar.
- Tám nhóm theo trang web: Home · About · Contact · Destinations · Northern Vietnam · Central
  Vietnam · Southern Vietnam · Sign-in pages. Đầu mỗi nhóm có link mở trang ấy trên web.
- Mỗi khe một thẻ: ảnh trong khung desktop đúng tỉ lệ, nhãn khe, nhãn nguồn (Original, Uploaded,
  From library), kích thước ảnh, nút **Replace**, và **Restore original** khi nguồn khác Original
  (kèm ảnh thu nhỏ của ảnh gốc).
- Khe có chú thích riêng in câu chữ web đặt cạnh ảnh, ví dụ "Caption on the site: Junks among the
  karst islands of Lan Hạ Bay", để chọn ảnh đúng cảnh.
- Sáu khe `inMobileApp` có một dòng: app mobile vẫn dùng ảnh gốc ở màn đăng nhập.
- Khe video chỉ có ảnh xem, không có nút.

### 6.2 Hộp Replace

- Hai cách lấy ảnh: **Upload** (một file, dùng lại `uploadPhoto`) và **From library** (hộp chọn
  ảnh địa danh đang dùng ở tab Photos của tour và ảnh bìa bài viết).
- Xem trước cạnh nhau: khung desktop và khung điện thoại thu nhỏ đúng tỉ lệ §3.2, cắt bằng
  `object-fit: cover` căn giữa y như web. Khung xem trước không vẽ chữ và lớp phủ tối của web.
  Khổ nào không hiện khe thì ghi rõ thay vì vẽ khung.
- Cảnh báo không chặn: ảnh hẹp hơn khung desktop (ví dụ ảnh 1200 px cho hero 1436 px) có thể mờ
  trên màn lớn.
- Alt: điền sẵn từ thư viện hoặc ảnh gốc, sửa được.
- Ghi công: chỉ đọc, theo nguồn.
- Khi ảnh đang dùng là ảnh tải lên: một dòng báo ảnh ấy sẽ bị xoá khỏi kho sau 7 ngày, vì không
  có đường nào chọn lại nó.
- Lưu thì báo toast; `STALE_SLOT` thì báo khe vừa bị người khác đổi rồi tải lại thẻ.

## 7. Web

Chỉ một thay đổi: `siteMediaImage` nhận `SiteSlotKey` thay vì `string`. Giao diện và cách đọc
giữ nguyên.

## 8. Test & nghiệm thu

### 8.1 Unit (TDD)

- Danh mục: khoá duy nhất, khung dương hoặc `null` đúng chỗ, `kind`, sáu khe `inMobileApp`.
- `planSlotImage`: đủ bốn nguồn; từ chối ảnh lạ, ảnh tải lên của khe khác, ảnh tải lên thiếu
  metadata, video trong thư viện; chỉ requeue ảnh tải lên của chính khe.
- `isUploadZonePublicId` nhận `<root>/site/<uuid>/<file>`, từ chối `<root>/site/<không uuid>/…`.
- Contract: alt quá dài, khoá video bị chặn ở `setSlot`.
- Admin: thẻ khe (nhãn nguồn, Restore original), hộp Replace (hai khung, cảnh báo cỡ ảnh, dòng
  7 ngày), hàm thuần thu nhỏ khung.
- Web: khoá ghép chuỗi và câu chú thích chép sang admin khớp bản gốc.

### 8.2 Int (Postgres)

- `list` trả đủ 47 khe theo thứ tự danh mục, nguồn đúng, khe chưa có dòng trả `image: null`.
- `setSlot` với từng nguồn; `STALE_SLOT`; `PHOTO_NOT_ALLOWED`; hàng dọn chỉ có ảnh tải lên cũ của
  khe; `revalidate` được gọi với `site-media` sau commit; khách bị 403, Staff được.
- `signUpload`: thư mục đúng khe, publicId vào hàng dọn.

### 8.3 Thử tay trên production sau merge (từng bước, chờ xác nhận)

1. Mở `/appearance`: 47 khe đều là Original.
2. Thay Home · Hero bằng một ảnh thư viện, mở trang chủ: thấy ảnh mới trong vòng một phút.
3. Bấm Restore original: trang chủ về ảnh cũ.
4. Tải một ảnh lên một khe Team rồi Restore original: hàng dọn có ảnh vừa tải với đồng hồ mới
   (kiểm bằng câu đọc chỉ).

## 9. Deploy

Không migration, không biến env mới, không đổi thiết lập Cloudinary (thư mục `tourism/site/` tự
có ở lần tải đầu). Push main thì Render dựng API, Vercel dựng admin và web.

## 10. Đối chiếu Nexora (luật 10)

| Nexora | v2 | Loại |
| --- | --- | --- |
| `GET` danh sách khe | `admin.appearance.list`, thêm khung và nguồn | v2 tốt hơn |
| `PUT :key/media` thay trọn danh sách ảnh của khe | `setSlot` một ảnh | làm khác mà tương đương: web chỉ đọc ảnh đầu |
| Upload qua `signed-url` chung | ký theo khe, theo dõi bằng hàng dọn 7 ngày | v2 tốt hơn |
| Không có | xem trước theo khung, về ảnh gốc | v2 tốt hơn |
| `lib/revalidate.ts` bust cache khi ghi | bắn `site-media` sau commit | tương đương |

## 11. Giới hạn đã biết

- Khung đo tay một lần. Đổi bố cục web làm khung lệch thì phải sửa số trong danh mục; không có
  test nào bắt được.
- Không xem trước khổ giữa (tablet, laptop nhỏ); khung ở đó nằm giữa hai khổ đã đo.
- Thay ảnh có chú thích mà chọn sai cảnh thì câu chữ trên web nói sai; admin chỉ nhắc, không chặn.
  Đổi câu chữ vẫn là sửa code.
- App mobile dùng ảnh gốc ở sáu khung đăng nhập cho tới khi app đọc API.
- Ảnh tải lên bị thay thì mất sau 7 ngày, không lấy lại được từ admin.
- Web chưa hiện ghi công ở đâu (ADR-0020 Hệ quả đòi gallery có dòng tác giả và trang `/credits`).
  Đây là việc của web, đề xuất thành một mục G riêng cùng spec Media.
