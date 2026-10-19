# Spec P4f — Media library: một chỗ xem và sửa mọi ảnh

- **Ngày:** 2026-10-16 · **Trạng thái:** Yuri duyệt 19/10; thi công sau Appearance. Chưa có dòng
  code nào.
- **Quyết định kiến trúc:** ADR-0060 (số đã giữ), viết từ §3, §4 và §7 của spec này ngay khi
  spec được duyệt, trước code (luật 5). ADR-0035 thêm AMEND 4 ngắn trỏ sang ADR-0060.
- **Nền:** [ADR-0005](../adr/0005-media-read-build-url.md) (đọc media) ·
  [ADR-0016](../adr/0016-web-data-layer.md) (bust cache web) ·
  [ADR-0020](../adr/0020-real-images-sourcing.md) Hệ quả (giấy phép đòi hiện ghi công) ·
  [ADR-0021](../adr/0021-media-write-surface.md) (ký upload) ·
  [ADR-0024](../adr/0024-deploy-targets.md) AMEND 5 (chạy bù job hằng ngày, G41) ·
  [ADR-0035](../adr/0035-media-lifecycle.md) (hàng dọn; AMEND 2, AMEND 3, Giới hạn #5 và #6,
  phương án quét ngược đã bỏ) ·
  [ADR-0047](../adr/0047-tour-editor-sections.md) §3 (một version cho cả tour) ·
  [ADR-0048](../adr/0048-tour-photos.md) (tab Photos của tour, khuôn của Media B) ·
  [ADR-0051](../adr/0051-posts-admin.md) §7 (ảnh bìa bài viết) ·
  [ADR-0052](../adr/0052-admin-staff-tier.md) (Staff) ·
  [spec Appearance](2026-10-15-p4f-appearance-design.md) (danh mục khe, vùng tải lên `site`)
- **Đóng:** mục Media library của sidebar admin (đang `enabled: false`); ADR-0035 Giới hạn #5
  (không có đường xoá thủ công) thành quyết định cố ý ở §4.4; Giới hạn #6 (backfill ảnh mồ côi
  cũ) bằng số đo ở §2.3.
- **Hai PR nối nhau:** Media A (§3 đến §6), rồi Media B (§7). Media A cần Appearance đã lên main,
  vì nhãn khe và link `/appearance#<key>` lấy từ danh mục khe của spec ấy. Thiếu thời gian trước
  freeze 31/10 thì Media A đứng một mình được; Media B là phần tải ảnh mới vào thư viện.

## 1. Mục tiêu & phạm vi

### Vấn đề

Site đang dùng 241 ảnh ở 517 chỗ, rải trên bốn nơi: tab Photos của tour, trang sửa bài viết,
Appearance (sắp có) và thư viện ảnh địa danh, nơi chưa có trình sửa nào. Không chỗ nào trả lời
được câu "ảnh này đang dùng ở đâu".

Ghi công không sửa được ở đâu trong admin: các trình sửa chỉ chép ghi công theo nguồn, không cho
sửa. Hai đường ghi duy nhất là script `media:upload` (đọc file CREDITS) và SQL tay; cột
`licenseUrl` thì không có đường ghi nào. Vì vậy cả 3 ảnh giấy phép CC đều thiếu link giấy phép,
trong khi email đặt tour và trang tour của app đã in dòng ghi công dưới ảnh.

Tệ hơn, hai script media đè dữ liệu mỗi lần chạy: `media:upload` ghi lại alt và ghi công của mọi
dòng điểm đến và khe site theo file, `media:alt` ghi lại alt của chúng theo fixture. Admin sửa gì
ở những dòng ấy cũng mất ở lần chạy script kế tiếp.

Thư viện ảnh địa danh là nguồn của tab Photos, của ảnh bìa bài viết và của Appearance, nhưng chỉ
thêm ảnh được bằng script trên máy.

Hàng dọn ảnh 7 ngày (ADR-0035) chạy mà không ai thấy: không xem được ảnh nào đang chờ xoá, ảnh
nào được giữ vì còn dùng, hay lượt dọn hằng ngày có chạy không (job lưu output rỗng).

Nexora có trang Media library và trình sửa ảnh điểm đến; bản đối chiếu admin 20/08 xếp cả hai
loại [V], thụt lùi cần vá (dòng 28 và 37).

### Trong phạm vi

- **Media A:** trang `/media` có hai tab. Tab In use: mỗi ảnh một ô, lọc theo nơi dùng và việc
  cần chú ý, tìm theo chữ; ngăn chi tiết liệt kê mọi chỗ dùng kèm link tới trình sửa, và sửa alt
  cùng ghi công cho mọi chỗ dùng trong một lần lưu. Tab Cleanup queue chỉ đọc: từng ảnh trong
  hàng dọn với trạng thái của nó, và lượt dọn gần nhất. Hai script media thôi đè dữ liệu admin.
- **Media B:** trang Photos cho từng điểm đến, theo khuôn tab Photos của tour: sắp thứ tự, chọn
  ảnh bìa, gỡ ảnh, tải ảnh mới vào thư viện.

### Ngoài phạm vi, cố ý

- Nút xoá ảnh, xoá hàng loạt, quét ngược Cloudinary tìm ảnh mồ côi. Nexora có cả ba. Lý do ở
  §2.3 và §4.4: gỡ ảnh khỏi chỗ dùng là đủ, hàng dọn xoá file sau 7 ngày.
- Ảnh review và avatar trong tab In use: ảnh review duyệt ở `/reviews`, avatar thuộc tài khoản
  khách. Hai loại này chỉ hiện ở tab Cleanup queue.
- Video: site có đúng một video, xem ở Appearance.
- Tải ảnh lên thẳng `/media` mà không gắn chủ. Ảnh tải lên phải có chủ ngay lúc ký thì hàng dọn
  mới phán được nó; nút thêm ảnh của `/media` dẫn tới trang Photos của một điểm đến (Media B).
- Thay file dưới cùng publicId để đổi ảnh ở mọi nơi một lúc. Chữ ký upload đặt
  `overwrite: false`, và đổi ảnh ở từng chỗ đã có trình sửa riêng.
- Sửa alt riêng cho từng chỗ dùng ngay ở `/media`: việc đó vẫn thuộc trình sửa của chủ.
- Hiện ghi công trên web: việc của web, đề xuất thành một mục G riêng (§12).

## 2. Hiện trạng đo được (16/10, chỉ đọc)

### 2.1 Ảnh đang dùng

Đọc `media_assets` trên production, bỏ dòng REVIEW và dòng video.

| Nơi dùng | Ảnh | Dòng |
| --- | --- | --- |
| Tour | 167: 29 ảnh bìa catalog, 137 ảnh mượn thư viện, 1 ảnh tải lên | 306 |
| Thư viện (18 điểm đến, mỗi nơi 2 đến 18 ảnh, đúng một ảnh bìa đứng đầu) | 155 | 155 |
| Bài viết | 9 | 9 |
| Khe site | 47 | 47 |
| **Tổng** | **241** (137 ảnh vừa ở thư viện vừa ở tour) | **517** |

- Một ảnh có tối đa 6 dòng: dòng thư viện và các dòng của tour mượn nó.
- Alt: cả 241 ảnh đều có. Chỉ 4 dòng REVIEW thiếu alt.
- Ghi công: 161 ảnh không có thông tin nguồn nào (tác giả, giấy phép, link nguồn đều trống);
  39 ảnh Unsplash License; 38 ảnh Unsplash+; 3 ảnh CC (2 ảnh CC BY-SA 3.0 de, 1 ảnh CC BY 2.0),
  cả ba có tác giả nhưng không có link giấy phép.
- Các dòng của cùng một ảnh chưa bao giờ lệch nhau: 0 ảnh có alt khác nhau giữa các dòng, 0 ảnh
  có ghi công khác nhau.
- 276 dòng tour mượn thư viện không có kích thước và dung lượng; dòng thư viện của cùng ảnh có đủ.

### 2.2 Code (main `bda89a9`)

- Không trình sửa nào ghi ghi công: tab Photos và ảnh bìa bài viết chép từ dòng thư viện
  (ADR-0048 §3, ADR-0051 §7), Appearance để chỉ đọc (spec Appearance §6.2).
- `licenseUrl`: grep 16/10 không thấy nơi ghi nào, kể cả script. Nơi đọc: dòng ghi công của email
  (`apps/api/src/worker/emails/layout.tsx`, có link khi cột có giá trị) và schema media công khai.
- `media-upload.mjs` upsert mọi dòng DESTINATION và SITE (alt, author, license, source_url) mỗi lần
  chạy, chỉ bỏ qua tour và bài viết đã có dòng. `apply-alt-text.mjs` (`media:alt`) chỉ lấp alt còn
  trống cho TOUR và POST, còn DESTINATION và SITE thì ghi theo fixture.
- Handler `media-gc` (`apps/api/src/worker/start-worker.ts` dòng 168–170) gọi `sweep` mà không trả
  `SweepReport`, nên job pg-boss lưu output rỗng.
- Xoá điểm đến (`admin-destinations.service.ts`, `delete`) xoá dòng ảnh mà không `requeue`: đúng,
  vì hôm nay thư viện chỉ có ảnh catalog. Media B đổi điều đó (§7.1).

### 2.3 Hàng dọn, và vì sao không cần quét ngược

Cloudinary có 251 ảnh dưới `tourism/`, chưa kể 1 video:

- 240 ảnh catalog, khớp DB theo từng thư mục con (destination 155, post 9, site 47, tour 29);
- 1 ảnh `brand/nexora-mark`: logo của email, URL ghim trong code, không có dòng DB nào;
- 10 ảnh trong vùng tải lên: 3 avatar, 5 ảnh review, 2 ảnh tour.

Cả 10 ảnh vùng tải lên đều có dòng trong `media_garbage`. 3 avatar và 1 ảnh tour đang dùng. 6 ảnh
mồ côi đang chờ xoá: 1 ảnh tour tới hạn sau 14:47 ngày 21/10, 5 ảnh review tới hạn sau 19:28 ngày
22/10 (giờ VN). Hàng còn 4 dòng ảnh review của một booking mà file đã xoá tay theo G22 nhưng dòng
review vẫn còn; bộ dọn hoãn chúng cho tới khi lượt seed lại xoá dòng review. Tổng 14 dòng,
`attempts` đều bằng 0. **Không có ảnh mồ côi nào nằm ngoài hàng dọn.**

pg-boss có 7 lượt `media-gc` từ 12/10 (cron 11:00 giờ VN và các lượt chạy bù G41), lượt nào cũng
xong, output đều rỗng.

Vì vậy spec bỏ quét ngược (Nexora gọi là reconcile):

1. **Không còn gì để nó tìm.** Số đo trên cho thấy hàng dọn đã theo dõi mọi ảnh tải lên. Giới hạn
   #6 của ADR-0035 (ảnh mồ côi có từ trước ngày hàng dọn chạy) đóng bằng chính số đo này.
2. **Nó đảo chiều rủi ro**, đúng lý do ADR-0035 đã bỏ phương án này: ảnh dùng ở ngoài DB bị coi là
   mồ côi. Ví dụ có thật: logo email không có dòng DB nào, quét ngược sẽ xoá nó.
3. **Dev và prod dùng chung một cloud và cùng thư mục gốc `tourism`.** Quét từ một DB sẽ coi ảnh
   của DB kia là mồ côi; chạy nhầm từ máy dev là xoá ảnh của site đang sống.
4. **Đường bỏ ảnh đã có:** gỡ ảnh khỏi chỗ dùng ở trình sửa của chủ; ảnh tải lên vào lại hàng dọn
   và mất sau 7 ngày. Ảnh catalog không bao giờ bị xoá (ADR-0035 AMEND 3).

Về sau nếu cần, đường dự phòng vẫn là script một lần của ADR-0035 Giới hạn #6: liệt kê, in danh
sách cho người đọc, rồi mới enqueue.

## 3. Mô hình

- **Một ảnh là một publicId.** Mỗi dòng `media_assets` loại IMAGE có chủ là TOUR, DESTINATION,
  POST hay SITE là một chỗ dùng: chủ, vai (hero hay gallery), thứ tự.
- **Nguồn:** `UPLOAD` khi publicId nằm trong vùng tải lên (`isUploadZonePublicId`: `tours`,
  `posts`, `site` từ Appearance, `destinations` từ Media B); còn lại là `CATALOG`, ảnh do script
  dựng.
- **Alt bắt buộc** khi ảnh có chỗ dùng là tour hay thư viện: luật tab Photos (ADR-0048, 1 đến 300
  ký tự), và thư viện là nguồn của tour. Ảnh chỉ dùng ở bài viết hay khe site được để trống, tức
  ảnh trang trí, web vẽ `alt=""` (cùng luật ảnh bìa bài viết và Appearance).
- **Cần chú ý** (hàm thuần `mediaAttention`): `MISSING_ALT` khi alt bắt buộc mà có dòng để trống;
  `CREDIT_INCOMPLETE` khi giấy phép thuộc họ CC BY (CC BY, CC BY-SA, …) mà thiếu tác giả hay link
  giấy phép, vì giấy phép ấy đòi cả hai. Hôm nay: 0 ảnh và 3 ảnh.
- **Không có thông tin nguồn** là bộ lọc riêng, không phải "cần chú ý". 161 ảnh không rõ nguồn là
  việc bổ sung dần chứ không phải lỗi; gộp chung thì 3 ảnh thật sự thiếu sẽ chìm giữa 164 ảnh.
- **Version của một ảnh** là chuỗi `<số dòng>:<updatedAt lớn nhất>` trên mọi dòng của ảnh. Nó đổi
  khi có ai sửa alt hay ghi công, và khi một chủ mượn thêm hay gỡ ảnh.

## 4. Luật thao tác của Media A (nội dung ADR-0060)

### 4.1 Đọc danh sách

`admin.media.list` gom mọi dòng ở §3 theo publicId, trả mỗi ảnh một mục, ảnh thêm gần nhất lên
trước. Mỗi mục có:

- URL dựng theo ADR-0005 (kèm version Cloudinary); kích thước, dung lượng, format lấy từ dòng có
  số (ưu tiên dòng thư viện, vì dòng tour mượn không có số);
- alt và ghi công: giá trị chung khi mọi dòng giống nhau; khi lệch thì lấy của dòng thư viện,
  không có thì dòng cũ nhất, kèm cờ `altVaries` hay `creditVaries`;
- chỗ dùng: loại chủ, tên (tên tour, tên điểm đến, tiêu đề bài, nhãn khe theo danh mục của
  Appearance), slug hay khoá để dựng link, vai và thứ tự;
- nguồn, cờ cần chú ý, alt có bắt buộc không, version.

Không phân trang: 241 ảnh vừa một lần đọc, lọc và tìm làm ngay trên trình duyệt.

### 4.2 Sửa alt và ghi công

`admin.media.update({ publicId, version, alt, author, license, licenseUrl, sourceUrl })`. Chuỗi
rỗng thành `null`. Độ dài theo cột: alt 300, tác giả 200, giấy phép 60, link giấy phép 300, link
nguồn 500. Hai link phải là URL `http` hay `https`. Alt theo luật bắt buộc ở §3.

Trong một transaction:

1. Đọc các dòng của ảnh, chưa khoá, để biết chủ. Không có dòng nào thì `NOT_FOUND` (404).
2. Khoá hàng của các chủ ấy theo thứ tự cố định (tour, điểm đến, bài viết, khe; trong mỗi loại
   theo id), rồi mới khoá các dòng ảnh `FOR UPDATE`. Mọi trình sửa đang có đều khoá chủ trước rồi
   mới ghi dòng ảnh (`claimTour`, `claimPost`, dòng khe của Appearance); khoá ngược chiều thì hai
   lệnh lưu cùng lúc có thể deadlock.
3. Tính lại version trên các dòng đã khoá. Lệch version gửi lên, hay tập dòng khác lần đọc ở bước
   1, thì `STALE_MEDIA` (409).
4. Ghi alt và ghi công vào mọi dòng đang khác giá trị mới. Không dòng nào khác thì dừng ở đây:
   không ghi, không bust.
5. Chạm `updatedAt` của mọi chủ có dòng vừa đổi, theo luật luôn tăng của `nextTourVersion`.
   Lý do: tab Photos gửi lại alt của mọi ảnh mỗi lần lưu, nên một tab đang mở với alt cũ sẽ âm
   thầm ghi đè alt vừa sửa. Chạm version thì lần lưu ấy nhận `STALE_TOUR` (hay `STALE_POST`,
   `STALE_SLOT`) và tải lại. ADR-0047 §3 đã có tiền lệ: lệnh chỉ đổi bảng con cũng đẩy version
   của tour.

Sau khi commit, bust theo các chủ đã đổi, gộp trùng: tour bắn `tours` và `tour:<slug>`; điểm đến
bắn như lệnh sửa điểm đến (`writtenTags`: `tours` và trang của các tour gắn nó); bài viết bắn
`posts` và `post:<slug>`; khe bắn `site-media`. Hàng dọn không bị đụng tới.

Giấy phép CC BY mà thiếu tác giả hay link giấy phép chỉ bị cảnh báo, không chặn lưu.

### 4.3 Hàng dọn, chỉ đọc

`admin.media.queue` đọc `media_garbage` và gán mỗi dòng một trạng thái, xét theo thứ tự:

| Trạng thái | Khi nào | Nhãn trên admin |
| --- | --- | --- |
| `REFUSED` | publicId ngoài vùng tải lên (ADR-0035 AMEND 3) | Never deleted |
| `GAVE_UP` | `attempts` chạm trần 5 | Gave up after 5 tries |
| `IN_USE` | còn dòng `media_assets` hay `users.image` trỏ tới (cùng phép kiểm của `sweep`) | Kept, still in use |
| `WAITING` | còn lại; tới hạn lúc `createdAt` cộng số ngày ân hạn, xoá ở lượt dọn đầu tiên sau đó | Deleted after (ngày tới hạn) |

- Chủ của ảnh suy từ đường dẫn: tour, bài viết, điểm đến theo uuid (đã xoá thì ghi "Deleted
  tour" và tương tự), khe theo nhãn danh mục, review theo mã booking. Avatar chỉ ghi "Customer
  avatar", không hiện ảnh lẫn danh tính.
- Không hiện `lastError` nguyên văn: đó là chữ kỹ thuật tiếng Việt, còn chữ của admin là tiếng
  Anh (luật 7). Trạng thái đã đủ nói chuyện gì xảy ra.
- Trả kèm `gcEnabled` và `graceDays` (từ env), và `lastSweep`: job `media-gc` mới nhất trong bảng
  `pgboss.job` (trạng thái, giờ xong, `SweepReport`). Chưa có schema hay queue (máy dev, nơi GC
  tắt) thì `lastSweep: null`.
- Handler `media-gc` đổi thành trả về kết quả của `sweep`, để pg-boss lưu báo cáo làm output của
  job.

Chỉ đọc: không có nút xoá ngay, xếp lại hay bỏ khỏi hàng.

### 4.4 Vì sao không có nút xoá

Xoá thẳng một file trên Cloudinary bỏ qua cả hai lưới của ADR-0035: kiểm tham chiếu lúc xoá, và 7
ngày để đổi ý. Với ảnh catalog còn tệ hơn: file biến mất trong khi DB, seed và script vẫn trỏ tới
nó. Muốn bỏ một ảnh thì gỡ nó khỏi chỗ dùng (tab Photos, ảnh bìa bài viết, Appearance, trang
Photos của điểm đến); ảnh tải lên sẽ vào lại hàng dọn. Cần xoá gấp (ví dụ ảnh nhạy cảm) thì vẫn
vào dashboard Cloudinary, như ADR-0035 Giới hạn #5 đã ghi; ADR-0060 đổi giới hạn ấy thành quyết
định cố ý.

### 4.5 Script

- `media-upload.mjs`: điểm đến đã có dòng ảnh thì bỏ qua, cùng luật đang áp cho tour và bài viết
  (Appearance thêm luật ấy cho khe). Không có luật này thì lần chạy kế tiếp đè alt và ghi công vừa
  sửa ở `/media`.
- `apply-alt-text.mjs`: chỉ lấp alt còn trống, với mọi loại chủ.
- DB mới dựng chưa có dòng nào nên hai script vẫn lấp như cũ. Lượt seed lại production (khoảng
  03/11) giữ `media_assets` không phải REVIEW, nên mọi sửa ở `/media` sống qua lượt ấy.

### 4.6 Quyền và vết

Ba thủ tục đều là `staff` trong `ADMIN_ACCESS`, cùng bậc sửa tour và bài viết (ADR-0052); giới hạn
ghi của admin tự áp cho `update`. Không có bảng vết riêng, cùng mọi trình sửa nội dung khác; API
log một dòng `[admin] media updated {publicId, rows, owners}`.

## 5. Contract `admin.media`

| Thủ tục | Vào | Ra | Lỗi |
| --- | --- | --- | --- |
| `list` | — | `items[]`: `publicId`, `url`, `width`, `height`, `bytes`, `format`, `alt`, `altVaries`, `altRequired`, `author`, `license`, `licenseUrl`, `sourceUrl`, `creditVaries`, `source`, `usages[]`, `attention[]`, `version` | — |
| `update` | `{ publicId, version, alt, author, license, licenseUrl, sourceUrl }` | một mục cùng hình với `list` | `STALE_MEDIA` 409, `NOT_FOUND` 404 |
| `queue` | — | `gcEnabled`, `graceDays`, `lastSweep`, `rows[]`: `publicId`, `url`, `zone`, `ownerLabel`, `state`, `queuedAt`, `dueAt`, `attempts` | — |

- `usages[]`: `ownerType`, `ownerId`, `label`, `slug` (tour, điểm đến, bài viết) hay `key` (khe),
  `role`, `sortOrder`.
- `lastSweep`: `null`, hoặc `{ state, finishedAt, report }`; `report` là sáu số của `SweepReport`,
  `null` với job chạy trước bản này.
- `url` của dòng avatar luôn là `null`.

## 6. Giao diện admin

### 6.1 Trang `/media`

- Bật mục Media library trong sidebar.
- Đầu trang: số ảnh, số ảnh cần chú ý, số ảnh đang chờ xoá. Hai tab **In use** và **Cleanup
  queue** (`?tab=queue`).
- Mọi chữ hiện trên trang là tiếng Anh trong `@tourism/i18n` (`admin.media`); các câu trích trong
  spec này chỉ là bản nháp chữ.

### 6.2 Tab In use

- Thanh lọc: ô tìm (alt, tác giả, tên file, tên chỗ dùng); **Used in**: All, Tours, Library,
  Posts, Site; **Show**: All, Needs attention, No credit info. Lọc và tìm giữ trên URL.
- Lưới ảnh thu nhỏ (`tourPhotoThumb`, rộng 320 px). Mỗi ô: nhãn Uploaded khi nguồn là tải lên, số
  chỗ dùng (ví dụ "Library · 5 tours"), chấm cảnh báo khi cần chú ý.
- Bấm một ô mở ngăn chi tiết bên phải:
  - ảnh lớn, kích thước, dung lượng, format, tên file bấm để chép;
  - **Used in**: mỗi chỗ dùng một dòng, link tới trình sửa: tour tới `/tours/<slug>/photos`, điểm
    đến tới `/destinations` (sau Media B là `/destinations/<slug>/photos`), bài viết tới
    `/posts/<slug>`, khe tới `/appearance#<key>`;
  - form: Alt text (đếm ký tự), Author, License (gợi ý các giá trị đang có), License link,
    Source link;
  - khi các dòng đang lệch nhau: "Saving makes all 6 uses the same", kèm các giá trị đang khác;
  - cảnh báo CC thiếu tác giả hay link giấy phép;
  - lưu thì báo toast; `STALE_MEDIA` thì báo ảnh vừa được sửa ở nơi khác, rồi tải lại ngăn.

### 6.3 Tab Cleanup queue

- Dòng tóm tắt: dọn đang bật hay tắt, ảnh bị xoá sau bao nhiêu ngày không dùng, lượt dọn gần nhất
  (giờ chạy, số ảnh đã xoá, giữ lại, hỏng). Môi trường tắt GC thì ghi rõ "Cleanup is off here:
  nothing is deleted."
- Bảng: ảnh thu nhỏ (file đã mất thì ô giữ chỗ; avatar luôn là biểu tượng), loại (tour, bài viết,
  khe, điểm đến, review, avatar), chủ, trạng thái, ngày tới hạn. Không có nút.

## 7. Media B: trang Photos của điểm đến

### 7.1 Luật (cũng vào ADR-0060)

- Ảnh của một điểm đến là một danh sách có thứ tự; ảnh đầu là ảnh bìa (vai hero), còn lại là
  gallery, cùng ADR-0048 §1. Đọc ra theo `orderTourPhotos` (ảnh hero trước), nên lần lưu đầu
  không đổi ảnh bìa nào.
- `setPhotos({ id, version, photos: [{ publicId, alt, upload? }] })` thay trọn danh sách, tối đa 30
  ảnh, alt 1 đến 300 ký tự. Mỗi ảnh thuộc đúng một trong hai nguồn, phán bằng hàm thuần
  `planDestinationPhotos`:
  1. dòng đang có của chính điểm đến: giữ metadata và ghi công, đổi alt và thứ tự;
  2. ảnh tải lên trong `<root>/destinations/<id>/`, kèm metadata Cloudinary do admin gửi (ADR-0048
     §5); ghi công để trống, điền sau ở `/media`.

  Ngoài hai nguồn ấy thì cả lệnh bị từ chối, mã `PHOTO_NOT_ALLOWED` (400).
- Version là `updatedAt` của điểm đến: khoá hàng điểm đến `FOR UPDATE`, lệch thì
  `STALE_DESTINATION` (409), lưu xong thì chạm. Lệnh sửa điểm đến hiện có (tên, mô tả) không so
  version; nó chỉ làm trang Photos đang mở nhận `STALE_DESTINATION` một lần.
- Gỡ ảnh: chỉ ảnh tải lên của chính điểm đến vào lại hàng dọn (`requeue`, ADR-0035 AMEND 2). Tour
  đã mượn ảnh vẫn giữ dòng của mình, và bộ dọn hoãn file chừng nào còn dòng ấy. Ảnh catalog gỡ ra
  thì không thêm lại được từ admin; file vẫn còn trên Cloudinary.
- Danh sách rỗng được phép, như điểm đến tạo mới hôm nay: web vẽ ô giữ chỗ thay ảnh bìa. Admin hỏi
  lại trước khi lưu danh sách rỗng cho một điểm đến đang hiện.
- `signPhotoUploads({ id, count })`: lô tối đa 30, thư mục `<root>/destinations/<id>`, publicId vào
  hàng dọn ngay lúc ký (ADR-0035 §3); thiếu cấu hình Cloudinary thì `MEDIA_UPLOAD_NOT_CONFIGURED`
  (503). Thêm `destinations` với chủ dạng uuid vào `UPLOAD_ZONE_OWNERS`, đúng việc ADR-0035 AMEND 3
  dặn cho mọi đường ký mới.
- Xoá điểm đến đưa ảnh tải lên của nó vào lại hàng dọn trong cùng transaction, như xoá tour
  (ADR-0048 §7). Thiếu bước này thì đồng hồ 7 ngày đếm từ lúc ký hay từ lượt hoãn cuối của bộ
  dọn, không phải từ lúc xoá, nên ảnh có thể mất ngay ở lượt dọn kế tiếp.
- Bust sau commit như lệnh sửa điểm đến (`writtenTags`).

### 7.2 Contract `admin.destinations`, thêm ba thủ tục

| Thủ tục | Vào | Ra | Lỗi |
| --- | --- | --- | --- |
| `photos` | `{ slug }` | `id`, `name`, `slug`, `isActive`, `version`, `photos[]`: `publicId`, `url`, `alt`, `width`, `height`, `source`, `usedByTours` | `NOT_FOUND` 404 |
| `setPhotos` | `{ id, version, photos[] }` | cùng hình với `photos` | `STALE_DESTINATION` 409, `PHOTO_NOT_ALLOWED` 400, `NOT_FOUND` 404 |
| `signPhotoUploads` | `{ id, count }` | `SignedUploadParams[]` | `MEDIA_UPLOAD_NOT_CONFIGURED` 503 |

Cả ba là `staff`, cùng bậc `destinations.update`.

### 7.3 Giao diện

- Bảng `/destinations` thêm hành động **Photos** cho mỗi dòng, mở `/destinations/<slug>/photos`.
  Trang `/media` thêm nút **Add photos to the library**: chọn một điểm đến rồi tới trang Photos của
  nó.
- Trang dùng lại khuôn `tour-photos-form`: danh sách sắp được, Make cover, Remove, ô alt từng ảnh,
  Upload photos theo lô (`uploadPhoto`). Không có nút Add from library: thư viện chính là trang này.
- Gỡ ảnh hiện một dòng nói hậu quả: ảnh có tour mượn ("Used by 5 tours. They keep it; it only
  leaves the library."), ảnh catalog ("Came with the site. Once saved, you can't add it back
  here."), ảnh tải lên ("Deleted from storage 7 days after you save.").
- Lưu thì báo toast; `STALE_DESTINATION` thì báo rồi tải lại.

## 8. Test & nghiệm thu

### 8.1 Unit (TDD)

- `mediaAttention`, luật alt bắt buộc theo chỗ dùng, version, gom dòng thành mục (cờ lệch, chọn
  dòng có kích thước).
- Trạng thái hàng dọn: đủ bốn trạng thái và thứ tự xét; ngày tới hạn; chủ suy từ đường dẫn.
- Tag bust theo chủ, gộp trùng.
- Contract: link không phải URL, chuỗi rỗng thành `null`, độ dài, alt theo luật.
- Admin: lọc và tìm (hàm thuần), trạng thái trên URL, ngăn chi tiết (cảnh báo lệch, cảnh báo CC),
  bảng hàng dọn.
- Media B: `planDestinationPhotos` (hai nguồn; từ chối ảnh lạ, ảnh tải lên của điểm đến khác, ảnh
  tải lên thiếu metadata); `isUploadZonePublicId` nhận `<root>/destinations/<uuid>/<file>`, từ chối
  chủ không phải uuid.

### 8.2 Int (Postgres)

- `list` gom đúng, bỏ REVIEW và video, nhãn chỗ dùng đúng.
- `update` ghi mọi dòng; không đổi gì thì không ghi; chạm version của chủ (lưu tab Photos bằng
  version cũ nhận `STALE_TOUR`); `STALE_MEDIA`; `NOT_FOUND`; bust sau commit đúng tag; khách bị
  403, Staff được.
- `queue` trả đúng trạng thái cho dòng mỗi loại; `lastSweep: null` khi chưa có job; pg-boss thật
  lưu `SweepReport` mà handler trả về.
- Media B: `setPhotos` với hai nguồn, `STALE_DESTINATION`, `PHOTO_NOT_ALLOWED`, hàng dọn chỉ có ảnh
  tải lên vừa gỡ; xoá điểm đến đưa ảnh tải lên vào hàng; ký upload đúng thư mục và vào hàng.

### 8.3 Thử tay trên production sau merge (từng bước, chờ xác nhận)

Media A:

1. Mở `/media`: 241 ảnh; Needs attention có 3 ảnh CC.
2. Điền link giấy phép cho một ảnh CC rồi lưu: còn 2. Câu đọc chỉ xác nhận mọi dòng của ảnh ấy có
   link.
3. Sửa alt một ảnh thư viện đang có tour mượn; mở tab Photos của một tour ấy: thấy alt mới.
4. Tab Cleanup queue khớp câu đọc chỉ trên `media_garbage`. Sau lượt dọn đầu tiên kể từ lúc
   deploy, dòng tóm tắt có số của lượt ấy.

Media B:

1. Tải một ảnh vào một điểm đến rồi lưu; mở hộp Add from library ở tab Photos của một tour: thấy
   ảnh mới. `/media` hiện nó với nhãn Uploaded, ghi công trống.
2. Gỡ ảnh ấy rồi lưu: tab Cleanup queue có nó, hạn 7 ngày.

## 9. Deploy

Không migration, không biến env mới, không dependency mới, không đổi thiết lập Cloudinary (thư mục
`tourism/destinations/` tự có ở lần tải đầu). Push main thì Render dựng API, Vercel dựng admin; web
không đổi. Báo cáo của bộ dọn chỉ có từ lượt dọn đầu tiên sau khi API mới chạy.

## 10. Đối chiếu Nexora (luật 10)

| Nexora | v2 | Loại |
| --- | --- | --- |
| `GET` media library | `admin.media.list`: gom theo ảnh, kèm chỗ dùng và việc cần chú ý | v2 tốt hơn |
| `PATCH` một media | `admin.media.update`: một lần sửa ghi mọi chỗ dùng, có version | v2 tốt hơn |
| `DELETE`, `POST bulk-delete` | không có: gỡ khỏi chỗ dùng, hàng dọn xoá sau 7 ngày (§4.4) | cố ý bỏ |
| `GET garbage` | tab Cleanup queue: trạng thái từng ảnh và lượt dọn gần nhất | tương đương, rõ hơn |
| `POST reconcile` | không có (§2.3) | cố ý bỏ |
| Destinations `PUT media` | `admin.destinations.setPhotos` (Media B) | tương đương |

Hạ tầng xuyên suốt: quyền theo `ADMIN_ACCESS` và giới hạn ghi tự áp; không thêm cron (dùng
`media-gc` hằng ngày và lượt chạy bù G41 sẵn có); bust cache theo đúng tag của từng chủ.

## 11. Giới hạn đã biết

- Sửa alt ở `/media` đè alt riêng mà một tour đã đặt cho ảnh ấy. Admin cảnh báo khi các dòng lệch,
  không chặn.
- Một lần sửa làm mọi trình sửa đang mở của các chủ liên quan nhận lỗi version một lần, kể cả bước
  không dính tới ảnh.
- Restore original của Appearance lấy alt và ghi công từ bảng ảnh gốc, không lấy bản đã sửa ở
  `/media`.
- Ảnh ghim trong code không hiện là chỗ dùng: logo email và sáu ảnh đăng nhập của app mobile.
- Không phân trang. Lên vài nghìn ảnh thì cần (suy đoán, chưa đo).
- Không xoá ngay được từ admin; cần gấp thì vào dashboard Cloudinary.
- Ảnh catalog bị gỡ khỏi mọi chỗ dùng vẫn nằm trên Cloudinary mãi.
- Bộ dọn chỉ chạy khi API thức (gói free của Render ngủ), nên ngày tới hạn trên admin là ngày
  sớm nhất, không phải ngày chính xác.
- Tab Cleanup queue đọc thẳng bảng `pgboss.job`. Nâng pg-boss (sau freeze) thì phải kiểm lại câu
  đọc; int test canh.
- Web vẫn chưa hiện ghi công (§12).

## 12. Đề xuất một mục G cho web

Hiện ghi công trên web theo ADR-0020 Hệ quả: dòng tác giả và giấy phép trong lightbox ảnh tour; ô
nhỏ (thẻ, tile) gom về trang `/credits`, có link ở footer. Ba ảnh CC đòi ghi công như điều kiện của
giấy phép; app và email đã in, chỉ web còn thiếu. Thêm vào `docs/open-items.md` lúc merge Media A;
số G xin điều phối cấp (số trống kế tiếp lúc viết là G55).
