# ADR-0060 — Media library: một ảnh là một publicId, sửa ghi công một lần cho mọi chỗ dùng, hàng dọn chỉ đọc, ảnh điểm đến có trình sửa riêng

- **Trạng thái:** Accepted (2026-10-19)
- **Bối cảnh thi hành:** P4f Media library, [spec 16/10](../specs/2026-10-16-p4f-media-library-design.md)
  Yuri duyệt ngày 19/10. Đi trước code theo luật CLAUDE.md #5. Số ADR giữ từ 15/10. Thi công hai
  PR nối nhau: Media A (§1 đến §7), rồi Media B (§8).
- **Liên quan:** [ADR-0005](0005-media-read-build-url.md) (đọc media) ·
  [ADR-0016](0016-web-data-layer.md) (bust cache web) ·
  [ADR-0020](0020-real-images-sourcing.md) Hệ quả (giấy phép đòi hiện ghi công) ·
  [ADR-0021](0021-media-write-surface.md) (ký upload) ·
  [ADR-0024](0024-deploy-targets.md) AMEND 5 (chạy bù job hằng ngày) ·
  [ADR-0035](0035-media-lifecycle.md) (hàng dọn; AMEND 4 trỏ về đây) ·
  [ADR-0047](0047-tour-editor-sections.md) §3 (một version cho cả tour) ·
  [ADR-0048](0048-tour-photos.md) (tab Photos của tour) ·
  [ADR-0051](0051-posts-admin.md) §7 (ảnh bìa bài viết) ·
  [ADR-0052](0052-admin-staff-tier.md) (Staff) ·
  [ADR-0059](0059-site-slot-appearance.md) (danh mục khe, vùng tải lên `site`)

## Bối cảnh

Sự thật đo được (spec §2, production đọc chỉ ngày 16/10):

1. Site dùng 241 ảnh ở 517 dòng `media_assets` (bỏ REVIEW và video), rải trên bốn loại chủ: tour
   (306 dòng), thư viện ảnh điểm đến (155), bài viết (9), khe site (47). 137 ảnh vừa ở thư viện
   vừa ở tour; một ảnh có tối đa 6 dòng. Không chỗ nào trong admin trả lời "ảnh này dùng ở đâu".
2. Các dòng của cùng một ảnh chưa bao giờ lệch nhau: 0 ảnh có alt khác nhau, 0 ảnh có ghi công
   khác nhau giữa các dòng.
3. Không trình sửa nào ghi ghi công; `licenseUrl` không có đường ghi nào. Cả 3 ảnh CC thiếu link
   giấy phép, trong khi email và app đã in dòng ghi công.
4. `media-upload.mjs` ghi lại alt và ghi công của mọi dòng điểm đến mỗi lần chạy (khe site đã được
   ADR-0059 §6 chặn); `apply-alt-text.mjs` ghi alt của dòng điểm đến và khe theo fixture. Sửa ở
   admin sẽ mất ở lần chạy script kế tiếp.
5. Thư viện ảnh điểm đến chỉ thêm được bằng script trên máy.
6. Handler `media-gc` không trả `SweepReport`, nên mọi job pg-boss lưu output rỗng. Không ai xem
   được hàng dọn.
7. Cloudinary có 251 ảnh dưới `tourism/`: 240 khớp catalog, 1 logo email ghim trong code, 10 ảnh
   trong vùng tải lên và cả 10 đều có dòng `media_garbage`. Không có ảnh mồ côi nào nằm ngoài hàng
   dọn.

## Quyết định

### 1. Một ảnh là một publicId

Mỗi dòng `media_assets` loại `IMAGE` có chủ `TOUR`, `DESTINATION`, `POST` hay `SITE` là một chỗ
dùng (chủ, vai, thứ tự). Dòng `REVIEW` và avatar không phải chỗ dùng của trang này: review duyệt
ở `/reviews`, avatar thuộc tài khoản khách. Hai loại ấy chỉ hiện ở hàng dọn (§4).

- **Nguồn:** `UPLOAD` khi publicId nằm trong vùng tải lên (`isUploadZonePublicId`), còn lại
  `CATALOG`.
- **Alt bắt buộc** khi ảnh có ít nhất một chỗ dùng là tour hay thư viện (luật tab Photos,
  ADR-0048: 1 đến 300 ký tự; thư viện là nguồn của tour). Ảnh chỉ dùng ở bài viết hay khe site
  được để trống: ảnh trang trí, web vẽ `alt=""`.
- **Cần chú ý** (`mediaAttention`, hàm thuần): `MISSING_ALT` khi alt bắt buộc mà có dòng để trống;
  `CREDIT_INCOMPLETE` khi giấy phép thuộc họ CC BY (chuỗi bắt đầu bằng `CC BY`, gồm cả CC BY-SA,
  CC BY-NC…) mà thiếu tác giả hay link giấy phép, vì giấy phép ấy đòi cả hai. "Không có thông tin
  nguồn" là bộ lọc riêng ở admin, không phải cờ chú ý: 161 ảnh không rõ nguồn sẽ nhấn chìm 3 ảnh
  thật sự thiếu.
- **Version của ảnh** là chuỗi `<số dòng>:<updatedAt lớn nhất>` trên mọi dòng của nó: đổi khi ai
  đó sửa alt hay ghi công, và khi một chủ mượn thêm hay gỡ ảnh.

### 2. `admin.media.list`: gom theo publicId, không phân trang

Mỗi ảnh một mục, ảnh có dòng mới nhất lên trước. URL dựng theo ADR-0005; kích thước, dung lượng,
format lấy từ dòng có số (ưu tiên dòng thư viện, vì 276 dòng tour mượn không có số). Alt và ghi
công là giá trị chung khi mọi dòng giống nhau; khi lệch thì lấy của dòng thư viện, không có thì
dòng cũ nhất, kèm cờ `altVaries` hay `creditVaries`. Mỗi chỗ dùng mang loại chủ, id, nhãn (tên
tour, tên điểm đến, tiêu đề bài), slug để dựng link, hay khoá khe; nhãn của khe dựng ở admin từ
chữ của Appearance, nên API trả khoá chứ không trả nhãn.

241 ảnh vừa một lần đọc; lọc và tìm làm trên trình duyệt.

### 3. `admin.media.update`: một lần sửa ghi mọi dòng của ảnh

`{ publicId, version, alt, author, license, licenseUrl, sourceUrl }`. Chuỗi rỗng thành `null`. Độ
dài theo cột (alt 300, tác giả 200, giấy phép 60, link giấy phép 300, link nguồn 500); hai link
phải là URL `http` hay `https`. Alt theo luật bắt buộc ở §1, phán trên tập chỗ dùng đã khoá.

Trong một transaction:

1. Đọc các dòng của ảnh, chưa khoá, để biết chủ. Không còn dòng nào thì `NOT_FOUND` (404).
2. **Khoá chủ trước, dòng ảnh sau**, theo thứ tự cố định: tour, điểm đến, bài viết, khe; trong mỗi
   loại theo id (`SELECT … FOR UPDATE`). Mọi trình sửa đang có đều giành hàng chủ trước rồi mới ghi
   dòng ảnh (`claimTour`, `claimPost`, dòng khe của ADR-0059); khoá dòng ảnh trước thì hai lệnh lưu
   cùng lúc có thể deadlock.
3. Khoá các dòng ảnh `FOR UPDATE` và tính lại version. Lệch version gửi lên, hay tập dòng khác lần
   đọc ở bước 1 (một chủ vừa mượn hay gỡ ảnh), thì `STALE_MEDIA` (409).
4. Ghi alt và ghi công vào mọi dòng đang khác giá trị mới. Không dòng nào khác thì dừng: không ghi,
   không chạm chủ, không bust.
5. **Chạm `updatedAt` của mọi chủ có dòng vừa đổi**, theo luật luôn tăng `nextTourVersion`. Tab
   Photos gửi lại alt của mọi ảnh mỗi lần lưu; không chạm thì một tab đang mở với alt cũ âm thầm
   ghi đè alt vừa sửa. Chạm thì lần lưu ấy nhận `STALE_TOUR` (hay `STALE_POST`, `STALE_SLOT`,
   `STALE_DESTINATION` ở Media B) và tải lại. Tiền lệ: ADR-0047 §3, lệnh chỉ đổi bảng con cũng đẩy
   version của tour.

Sau commit, bust theo các chủ đã đổi, gộp trùng: tour `tourRevalidationTags`; điểm đến
`writtenTags` (như lệnh sửa điểm đến); bài viết `postRevalidationTags`; khe
`siteMediaRevalidationTags`. Hàng dọn không bị đụng tới: lệnh này không gỡ chỗ dùng nào.

Giấy phép CC BY thiếu tác giả hay link giấy phép chỉ bị cảnh báo ở admin, không chặn lưu: điền dở
vẫn hơn không điền.

### 4. `admin.media.queue`: hàng dọn, chỉ đọc

Mỗi dòng `media_garbage` một trạng thái, xét theo thứ tự (cùng thứ tự `sweep` xét):

| Trạng thái | Khi nào |
| --- | --- |
| `REFUSED` | publicId ngoài vùng tải lên (ADR-0035 AMEND 3) |
| `GAVE_UP` | `attempts` chạm trần 5 |
| `IN_USE` | còn dòng `media_assets` hay `users.image` trỏ tới (cùng phép kiểm của `sweep`) |
| `WAITING` | còn lại; tới hạn lúc `createdAt` cộng số ngày ân hạn |

- Vùng và chủ suy từ đường dẫn: tour, bài viết, điểm đến, khe theo uuid (chủ đã xoá thì ghi
  "đã xoá"), review theo mã booking, avatar chỉ ghi "ảnh đại diện khách", không có URL ảnh lẫn
  danh tính. Hàm thuần `queueRowState` và `parseUploadZone`.
- `lastError` không trả ra: đó là chữ kỹ thuật tiếng Việt, còn chữ admin là tiếng Anh (luật 7).
- Trả kèm `gcEnabled`, `graceDays` (env) và `lastSweep`: job `media-gc` mới nhất trong
  `pgboss.job` (trạng thái, giờ xong, `SweepReport`), `null` khi schema hay queue chưa có (máy
  dev, nơi GC tắt).
- **Handler `media-gc` trả `SweepReport`**, để pg-boss lưu nó làm output của job. Job chạy trước
  bản này có output rỗng: `report: null`.

Không có nút xoá ngay, xếp lại hay bỏ khỏi hàng.

### 5. Không có nút xoá ảnh

Xoá thẳng một file trên Cloudinary bỏ qua cả hai lưới của ADR-0035: kiểm tham chiếu lúc xoá, và 7
ngày để đổi ý. Với ảnh catalog còn tệ hơn: file mất trong khi DB, seed và script vẫn trỏ tới nó.
Muốn bỏ một ảnh thì gỡ nó khỏi chỗ dùng ở trình sửa của chủ; ảnh tải lên vào lại hàng dọn và mất
sau 7 ngày. Cần xoá gấp (ảnh nhạy cảm) thì vẫn vào dashboard Cloudinary. ADR-0035 Giới hạn #5 thành
quyết định cố ý.

Cùng lý do, không có quét ngược Cloudinary (Nexora gọi là reconcile): số đo ở Bối cảnh #7 cho thấy
không còn gì để nó tìm; nó đảo chiều rủi ro mà ADR-0035 đã bỏ (logo email không có dòng DB nào sẽ
bị xoá); và dev với prod dùng chung một cloud, quét từ DB này coi ảnh của DB kia là mồ côi.
ADR-0035 Giới hạn #6 đóng bằng chính số đo ấy.

### 6. Script thôi đè dữ liệu admin

- `media-upload.mjs`: điểm đến đã có dòng ảnh thì bỏ qua, cùng luật đang áp cho tour, bài viết và
  khe (ADR-0059 §6).
- `apply-alt-text.mjs`: chỉ lấp alt còn trống, với mọi loại chủ.

DB mới dựng chưa có dòng nào nên hai script vẫn lấp như cũ. Lượt seed lại production giữ
`media_assets` không phải REVIEW, nên sửa ở `/media` sống qua lượt ấy.

### 7. Quyền và vết

`media.list`, `media.update`, `media.queue` đều là `staff` trong `ADMIN_ACCESS`, cùng bậc sửa tour và
bài viết (ADR-0052); giới hạn ghi của admin tự áp cho `update`. Không có bảng vết riêng, như mọi
trình sửa nội dung khác; API log một dòng `media updated` với publicId, số dòng và số chủ.

### 8. Media B: ảnh của điểm đến có trình sửa riêng

- Ảnh của một điểm đến là danh sách có thứ tự; ảnh đầu là ảnh bìa (vai `hero`), còn lại `gallery`,
  cùng ADR-0048 §1. Đọc ra theo `orderTourPhotos` (ảnh hero trước), nên lần lưu đầu không đổi ảnh
  bìa nào.
- `admin.destinations.setPhotos({ id, version, photos: [{ publicId, alt, upload? }] })` thay trọn
  danh sách, tối đa 30 ảnh, alt 1 đến 300 ký tự. Mỗi ảnh thuộc đúng một trong hai nguồn, phán bằng
  hàm thuần `planDestinationPhotos`: dòng đang có của chính điểm đến (giữ metadata và ghi công, đổi
  alt và thứ tự), hoặc ảnh tải lên trong `<root>/destinations/<id>/` kèm metadata Cloudinary
  (ADR-0048 §5; ghi công trống, điền sau ở `/media`). Ngoài hai nguồn thì cả lệnh bị từ chối,
  `PHOTO_NOT_ALLOWED` (400).
- Version là `updatedAt` của điểm đến: khoá hàng `FOR UPDATE`, lệch thì `STALE_DESTINATION` (409),
  lưu xong thì chạm. Lệnh sửa điểm đến hiện có (tên, mô tả) không so version; nó chỉ làm trang
  Photos đang mở nhận `STALE_DESTINATION` một lần.
- Gỡ ảnh: chỉ ảnh tải lên của chính điểm đến vào lại hàng dọn (`requeue`, ADR-0035 AMEND 2). Tour đã
  mượn ảnh giữ dòng của mình, và bộ dọn hoãn file chừng nào còn dòng ấy.
- Danh sách rỗng được phép (điểm đến mới tạo hôm nay đã như vậy); admin hỏi lại trước khi lưu danh
  sách rỗng cho một điểm đến đang hiện.
- `admin.destinations.signPhotoUploads({ id, count })`: lô tối đa 30, thư mục
  `<root>/destinations/<id>`, publicId vào hàng dọn ngay lúc ký (ADR-0035 §3). `destinations` với
  chủ dạng uuid vào `UPLOAD_ZONE_OWNERS` (ADR-0035 AMEND 3).
- Xoá điểm đến đưa ảnh tải lên của nó vào lại hàng dọn trong cùng transaction, như xoá tour
  (ADR-0048 §7). Thiếu bước này thì đồng hồ 7 ngày đếm từ lúc ký, và ảnh có thể mất ngay ở lượt dọn
  kế tiếp.
- Bust sau commit như lệnh sửa điểm đến (`writtenTags`). Ba thủ tục `photos`, `setPhotos`,
  `signPhotoUploads` là `staff`, cùng bậc `destinations.update`.

## Phương án đã cân nhắc và bỏ

- **Sửa alt riêng từng chỗ dùng ngay ở `/media`.** Việc ấy đã có trình sửa của chủ; làm thêm ở đây
  là hai đường ghi cho một ô.
- **Lưu ghi công ở một bảng ảnh riêng (một dòng mỗi publicId).** Đúng hình hơn về dữ liệu, nhưng
  cần migration, đổi mọi nơi đọc ghi công (email, schema media công khai, ba trình sửa) và backfill
  517 dòng, khi các dòng chưa từng lệch nhau. Ghi đều vào mọi dòng đạt cùng kết quả mà không đổi
  nơi đọc nào.
- **Khoá dòng ảnh trước, chủ sau.** Ít câu hơn, nhưng ngược chiều với mọi trình sửa đang có, nên
  hai lệnh lưu cùng lúc (tab Photos và `/media`) có thể deadlock.
- **Không chạm version của chủ.** Rẻ hơn, nhưng tab Photos đang mở ghi đè alt vừa sửa mà không ai
  biết.
- **Đọc lịch sử job bằng API của pg-boss.** `findJobs` của pg-boss 12 trả mọi job của queue, không
  sắp, không giới hạn; và instance pg-boss sống trong `startWorker`, ngoài cây module Nest. Một câu
  SELECT trên `pgboss.job` là đường ngắn nhất, và int test canh câu ấy (Giới hạn #3).
- **Tải ảnh lên thẳng `/media` không gắn chủ.** Ảnh tải lên phải có chủ ngay lúc ký thì hàng dọn mới
  phán được nó; nút thêm ảnh dẫn tới trang Photos của một điểm đến.

## Giới hạn đã biết

1. Sửa alt ở `/media` đè alt riêng mà một tour đã đặt cho ảnh ấy; admin cảnh báo khi các dòng
   lệch, không chặn.
2. Một lần sửa làm mọi trình sửa đang mở của các chủ liên quan nhận lỗi version một lần, kể cả
   bước không dính tới ảnh.
3. Tab Cleanup queue đọc thẳng `pgboss.job`. Nâng pg-boss (sau freeze) thì phải kiểm lại câu đọc;
   int test chạy pg-boss thật canh nó.
4. Restore original của Appearance lấy alt và ghi công từ bảng ảnh gốc (ADR-0059 §4), không lấy
   bản đã sửa ở `/media`.
5. Ảnh ghim trong code không hiện là chỗ dùng: logo email, sáu ảnh đăng nhập của app mobile.
6. Không phân trang. Lên vài nghìn ảnh thì cần (suy đoán, chưa đo).
7. Bộ dọn chỉ chạy khi API thức (gói free của Render ngủ), nên ngày tới hạn trên admin là ngày sớm
   nhất, không phải ngày chính xác.
8. Ảnh catalog bị gỡ khỏi mọi chỗ dùng nằm trên Cloudinary mãi; từ admin không thêm lại được.
9. Web chưa hiện ghi công (ADR-0020 Hệ quả); việc của web, thành một mục G riêng lúc merge Media A.
