# Spec F18 — Ảnh tour (P4e-3b)

28/09/2026 · thiết kế duyệt qua bốn phần trong chat cùng ngày. Quyết định kiến
trúc nằm ở [ADR-0048](../adr/0048-tour-photos.md); spec này nói cách làm.

Đánh số **F18**, phần sau của P4e-3 (F17 là phần chữ, spec
[2026-09-24](2026-09-24-p4e-3a-tour-editor-design.md)).

## 1. Mục tiêu & phạm vi

### Vấn đề

Admin tạo và sửa được mọi nội dung chữ của tour nhưng không đụng được ảnh. Tour
mới tạo bằng F17 không có ảnh nào, nên trên web nó chỉ có ô giữ chỗ; ảnh của 29
tour đang bán chỉ đổi được bằng bộ script `media:*` chạy tay. Nexora có ô chọn ảnh,
hộp chọn từ thư viện và `PUT media` cho tour — thụt lùi cần vá (luật 10).

**Mục tiêu:** admin dựng được bộ ảnh cho một tour từ con số 0 — tải ảnh của mình
lên, lấy ảnh có sẵn từ kho địa danh, sắp thứ tự, chọn ảnh bìa, viết alt — và sửa
bộ ảnh của một tour đang bán, mà không bao giờ làm mất một ảnh thư viện đã kiểm
chứng giấy phép.

### Trong phạm vi

- Tab **Photos** trong khu làm việc tour, ngay sau Details.
- Ba thủ tục mới dưới `admin.tours`: `setPhotos`, `signPhotoUploads`,
  `photoLibrary`. `admin.tours.get` trả thêm `photos`.
- `TourReadiness.cover`: tour chưa có ảnh thì không bật bán được.
- Luật "tour đang bán thì luôn đủ" phía admin suy từ `projectedReadiness` ở cả
  Details, Itinerary, Photos (đóng G11 của `docs/open-items.md`).
- Xoá tour dọn luôn các dòng ảnh của tour.
- CSP của admin cho trình duyệt POST file lên `https://api.cloudinary.com`.
- Copy tiếng Anh mới trong `@tourism/i18n`.

### Ngoài phạm vi, cố ý

| Không làm | Vì sao |
| --- | --- |
| Cắt, xoay ảnh | ADR-0020 §4: cắt cúp ảnh ShareAlike tạo tác phẩm phái sinh |
| Video | Chưa có nhu cầu; `posterId` chưa được bộ dọn kiểm (ADR-0035 Giới hạn #3) |
| Ô ghi công cho ảnh tải lên | User chốt 28/09: ảnh tải lên là ảnh của mình; ảnh cần ghi công đi qua thư viện |
| Ảnh cho địa danh, bài viết, trang | P4f (spec F15 đã ghi) và P4e-4 |
| Màn thư viện media, nút xoá ảnh khỏi Cloudinary | P4f |
| Sửa code web hay mobile | Hình dạng `cover` và `media` của endpoint công khai giữ nguyên |

## 2. Quyết định thiết kế

### 2a. Mô hình: một danh sách có thứ tự, ảnh đầu là ảnh bìa

- Mỗi ảnh của tour là một dòng `media_assets` với `ownerType = TOUR`,
  `ownerId = tourId`, `type = IMAGE`.
- Vị trí 0 mang `role = hero`, `sortOrder = 0`; vị trí `i ≥ 1` mang
  `role = gallery`, `sortOrder = i`. Web đã in `hero` trước rồi gallery theo
  `sortOrder` (`tourGallery`), card lấy `hero` — thứ tự admin thấy là thứ tự khách
  thấy.
- **Nguồn của một ảnh** suy từ publicId, không lưu thành cột:
  - `UPLOAD` nếu publicId bắt đầu bằng `<root>/tours/<tourId>/` (`root` là
    `CLOUDINARY_UPLOAD_FOLDER`, prod là `tourism`);
  - `LIBRARY` nếu publicId đang có dòng `DESTINATION` (kho địa danh
    `tourism/catalog/destination/…`);
  - `CATALOG` với mọi publicId khác (ảnh bìa gốc `tourism/catalog/tour/…`) — ADR-0048
    AMEND 1, vòng review F18.
- Không migration: bảng đã đủ cột (`alt` VARCHAR(300), `version`, `width`,
  `height`, `format`, `bytes`, `sortOrder`, bốn cột ghi công).

### 2b. Lệnh ghi `admin.tours.setPhotos`

Input: `{ id, version, photos: [{ publicId, alt, upload? }] }` — `photos` là danh
sách mới theo đúng thứ tự, tối đa 30, publicId không trùng.

Trong một transaction:

1. `claimTour(tx, id, version, now)` — lệch phiên bản → `STALE_TOUR`, không có
   tour → `NOT_FOUND` (khuôn ADR-0047).
2. Đọc mọi dòng `media_assets` hiện có của tour.
3. Phân loại từng ảnh gửi lên (hàm thuần `classifyTourPhotos`):
   - publicId đang là dòng của tour này → **giữ**: chép nguyên metadata và ghi
     công từ dòng cũ, chỉ đổi `alt`, `role`, `sortOrder`. Có `upload` thì bỏ qua.
   - publicId nằm trong thư mục tải lên của tour **và** có `upload` → **tải lên
     mới**: metadata từ `upload`, bốn cột ghi công để `null`.
   - publicId có dòng `ownerType = DESTINATION` → **thư viện**: chép metadata và
     ghi công từ dòng gốc (một câu `findMany … publicId in [...]` cho cả lô; nhiều
     dòng cùng publicId thì lấy dòng `createdAt` sớm nhất).
   - Còn lại → `PHOTO_NOT_ALLOWED` (400), rollback.
4. `deleteMany` mọi dòng cũ của tour, `createMany` danh sách mới. Id của dòng đổi
   là vô hại — không bảng nào trỏ khoá ngoại vào `media_assets.id`.
5. Ảnh **bị gỡ** (có trong danh sách cũ, không có trong danh sách mới) mà nguồn là
   `UPLOAD` → `MediaGarbageService.requeue(tx, …)`. Ảnh `LIBRARY` bị gỡ thì không
   ghi gì vào hàng dọn (ADR-0048 §6).
6. Tour đang bán → `assertStillReady` (giờ gồm `cover`) → `TOUR_NOT_READY`.

Sau commit: bust `tours` và `tour:<slug>` (khuôn `this.bust`), trả `get(slug)`.

### 2c. Ký upload theo lô `admin.tours.signPhotoUploads`

- Input `{ id, count }`, `count` từ 1 tới 30. Output: mảng `SignedUploadParams`
  (schema có sẵn của ADR-0021).
- Tour không có → `NOT_FOUND`; thiếu khoá Cloudinary → `MEDIA_UPLOAD_NOT_CONFIGURED`.
- Thư mục `<root>/tours/<tourId>`, basename `randomUUID()` cho từng file, một
  `timestamp` chung, bộ tham số ký y hệt `buildSignedUploadParams` (định dạng,
  `c_limit,w_2400,h_2400,fl_force_strip`, `overwrite:false`).
- Cả lô publicId đầy đủ (`<folder>/<basename>`) vào hàng dọn bằng
  `enqueueQuietly` ngay lúc ký (ADR-0035 §3) — tải lên rồi bỏ không lưu tự được dọn.
- Một lượt tải 30 ảnh chỉ tốn một trong 60 request mỗi phút mà route admin được
  phép (`ADMIN_WRITE_THROTTLE`, ADR-0037 AMEND 1).

### 2d. Thư viện `admin.tours.photoLibrary`

- Không input. Trả mảng theo địa danh, sắp theo tên:
  `{ destination: { id, name }, photos: [{ publicId, url, alt, width, height, author, license }] }`,
  mỗi địa danh gồm ảnh `hero` rồi `gallery` theo `sortOrder`.
- Dựng URL bằng `MediaService.resolveForOwners('DESTINATION', ids)` — cùng đường
  với web.
- Địa danh đang ẩn vẫn có mặt: ảnh của nó vẫn hợp lệ cho tour.

### 2e. Readiness và G11

- `TourReadinessInput` thêm `hasCover: boolean`; `TourReadinessSchema` thêm
  `cover: boolean`; `ready` đòi đủ bốn.
- API: `readTourReadiness` và `toDetail` tính `hasCover` = tour có dòng
  `role = hero`. `setPublished(true)` và mọi lệnh ghi của tour đang bán tự hưởng
  điều kiện mới qua `assertStillReady`.
- Admin: `readinessIssues` thêm mục `cover` — nhãn "a cover photo", link tới
  `/tours/<slug>/photos`.
- **G11:** `projectedReadiness(detail, patch)` nhận thêm `photos?`. Hàm thuần mới
  `onSaleShortfalls(detail, projected)` trả những điều kiện readiness đang hỏng khi
  tour đang bán. Mỗi tab tự gắn chúng vào ô của mình:

  | Điều kiện hỏng | Details | Itinerary | Photos |
  | --- | --- | --- | --- |
  | `summary` | ô Summary: `summaryOnSale` | — | — |
  | `missingDays` | ô Days: `addDaysOnSale` | tiêu đề từng ngày thiếu: `dayTitleOnSale` | — |
  | `cover` | — | — | danh sách: `photosOnSale` |

  Ba nhánh viết tay trong `validateDetailsForm` và `validateItineraryForm` bỏ đi;
  câu chữ giữ nguyên. `primaryDestination` giữ luật "đúng một điểm chính" sẵn có
  (không phụ thuộc tour đang bán).

### 2f. Xoá tour

`AdminToursService.delete` thành một transaction:

1. Đọc publicId các dòng `media_assets` của tour.
2. `tx.tour.delete` — `P2003` → `TOUR_HAS_BOOKINGS`, `P2025` → `NOT_FOUND`,
   rollback cả transaction.
3. `deleteMany` các dòng ảnh của tour.
4. `requeue` những ảnh nguồn `UPLOAD`.

Hộp xác nhận xoá kể thêm số ảnh ("5 photos") trong danh sách những gì mất theo.

### 2g. Tab Photos

Route `/tours/[slug]/photos`; `TOUR_EDITOR_TABS` chèn `photos` sau `details`.

**Khung** (`EditorFormFrame` như mọi tab): nút Save, dải báo, hỏi lại khi rời trang.

**Thanh trên cùng:** nút **Upload photos** (mở hộp chọn file, nhận nhiều file) ·
nút **Add from library** · bộ đếm "N of 30 photos". Dòng gợi ý dưới thanh: ảnh đầu
là ảnh bìa; định dạng và trần dung lượng. Kéo thả file vào vùng danh sách cũng tải
lên như bấm nút.

**Danh sách** dùng kit `ListEditor` với `labelledRows`:

- Mỗi dòng: thumbnail 120×80 (`object-fit: cover`), ô **Alt text** (`FormField`,
  bắt buộc), một dòng nguồn — "Uploaded", "From the library · Photo: J. Nguyen,
  CC BY-SA 4.0", hoặc "Catalogue photo · … · Can't be added back once removed." (phần
  ghi công chỉ in khi có; không kèm tên địa danh — quyết định 1 của plan F18; nguồn
  Catalog theo ADR-0048 AMEND 1).
- Dòng đầu mang nhãn **Cover**; các dòng khác có nút **Make cover** (đưa lên đầu,
  ảnh bìa cũ lùi xuống vị trí hai).
- ↑ ↓ và thùng rác của kit; luật tiêu điểm của kit giữ nguyên.
- Kit đổi hai chỗ: `newItem` thành tuỳ chọn (vắng thì kit không vẽ nút thêm — ảnh
  vào danh sách qua hai nút ở thanh trên), và `emptyFocus` (ref phần tử nhận tiêu
  điểm khi gỡ dòng cuối — nút Upload photos).

**Tải lên** (hàm thuần tách khỏi component để TDD):

1. Lọc file: đuôi ngoài `ALLOWED_IMAGE_EXTENSIONS` hoặc quá 10 MB bị loại; quá số
   chỗ còn trống (30 trừ số ảnh và số file đang tải) thì phần dư bị loại. File bị
   loại liệt kê trong một dòng báo dưới thanh, kèm lý do.
2. Gọi `signPhotoUploads({ id, count })` một lần cho cả lô.
3. Tải song song tối đa 3 file, mỗi file XHR thẳng lên `uploadUrl`, có tiến độ.
   Hàm tải của admin trả `{ publicId, version, width, height, format, bytes }` từ
   phản hồi Cloudinary (bản web chỉ trả `public_id`).
4. Tải xong → ảnh nối vào cuối danh sách, alt để trống (bắt buộc điền), thumbnail
   dựng từ `cloudName` + `version` + publicId. Hỏng → dòng báo lỗi kèm **Retry**
   (ký lại một chữ ký) và **Remove**.
5. Save khoá khi còn file đang tải, cạnh nút ghi "Waiting for N uploads to finish."

Tải lên rồi rời trang không lưu: hộp hỏi lại của F17 bật lên; nếu vẫn rời, ảnh đã
tải nằm trong hàng dọn từ lúc ký và tự bị dọn.

**Hộp Add from library:**

- Tải thư viện lần đầu mở hộp (server action), giữ trong state cho các lần sau.
- Ô chọn địa danh, mặc định "This tour's destinations" (gộp các địa danh tour đi
  qua); đổi được sang từng địa danh.
- Lưới thumbnail có ô tích; ảnh đã có trong tour hiện "Added", không tích được.
  Không cho tích quá số chỗ còn trống.
- **Add N photos** → ảnh nối vào cuối danh sách, alt chép từ ảnh gốc (sửa được).

**Kiểm trước khi gửi** (`validatePhotosForm`): alt từ 1 tới 300 ký tự sau khi bỏ
khoảng trắng, lỗi dưới đúng ô; tour đang bán mà danh sách rỗng → `photosOnSale`
theo luật G11 ở §2e.

**Thumbnail** dựng bằng hàm thuần `tourPhotoThumb(url)`: chèn
`f_auto,q_auto,w_320` vào URL Cloudinary, **không** `c_fill` — khác
`reviewPhotoThumb` (ADR-0020 §4).

### 2h. Copy (tiếng Anh, `messages.admin.tours.editor.photos`)

Nhãn tab, gợi ý đầu tab, hai nút, bộ đếm, nhãn và lỗi của ô alt, dòng nguồn, trạng
thái tải (đang tải, hỏng, Retry, Remove, chờ tải xong), lý do loại file, hộp thư
viện (tiêu đề, ô chọn địa danh, "Added", "Add N photos", trạng thái rỗng), lỗi
`PHOTO_NOT_ALLOWED`, câu `photosOnSale`, mục readiness "a cover photo", số ảnh trong
hộp xoá tour. Câu cụ thể chốt ở plan; giọng như các tab F17.

## 3. Bề mặt API

| Thủ tục | Route | Lỗi riêng |
| --- | --- | --- |
| `admin.tours.get` (đổi) | có sẵn | — |
| `admin.tours.setPhotos` | `POST /api/admin/tours/{id}/photos` | `STALE_TOUR` · `TOUR_NOT_READY` · `PHOTO_NOT_ALLOWED` · `NOT_FOUND` |
| `admin.tours.signPhotoUploads` | `POST /api/admin/tours/{id}/photo-uploads` | `MEDIA_UPLOAD_NOT_CONFIGURED` · `NOT_FOUND` |
| `admin.tours.photoLibrary` | `GET /api/admin/tour-photo-library` | — |

Route thư viện cố ý KHÔNG nằm dưới `/api/admin/tours/…`: `GET /api/admin/tours/{slug}`
có sẵn sẽ nuốt nó, và một tour có slug `photo-library` là hợp lệ.

Schema mới trong `libs/shared/contract/src/schemas/admin-tours.ts`:

- `AdminTourPhotoSchema`: `publicId · url · alt · width · height · source ('UPLOAD' | 'LIBRARY') · author · license`.
- `AdminTourDetailSchema.photos: AdminTourPhotoSchema[]` — ảnh bìa đứng đầu.
- `AdminTourPhotoInputSchema`: `publicId` (cổng ký tự §4) · `alt` · `upload?:
  { version, width, height, format, bytes }`.
- `AdminTourPhotosInputSchema`: `id · version · photos` (≤ 30, publicId không trùng).
- `AdminTourSignPhotoUploadsInputSchema`: `id · count` (1–30).
- `AdminPhotoLibrarySchema`: mảng `{ destination, photos }` như §2d.

`media.ts`: `MediaPublicIdSchema` (chuyển regex của `ReviewPhotoPublicIdSchema` về
đây; `ReviewPhotoPublicIdSchema` thành bí danh của nó — một cổng cho mọi publicId
client gửi). `tour-readiness.ts`: `hasCover` và `cover`.

### Trần dữ liệu

| Hằng | Giá trị | Vì sao |
| --- | --- | --- |
| `TOUR_PHOTOS_MAX` | 30 | Tour nhiều ảnh nhất hôm nay có 18 |
| `TOUR_PHOTO_ALT_MAX` | 300 | Cột `alt` VARCHAR(300) |
| `TOUR_PHOTO_MAX_BYTES` | 10 MB | Cùng trần ảnh review; trần cứng Cloudinary gói free cũng 10 MB |
| `upload.width`, `upload.height`, `upload.bytes` | số nguyên dương | Chỉ canh dạng: trần 2400px và 10 MB do Cloudinary thi hành (quyết định 3 của plan F18) |
| `upload.version` | chuỗi 1–20 chữ số | Khuôn cột `version` VARCHAR(20) |
| `upload.format` | chuỗi 1–10 ký tự | Khuôn cột `format` VARCHAR(10) |

### Bản đồ file

| Chỗ | File |
| --- | --- |
| Contract | `schemas/admin-tours.ts` · `schemas/media.ts` · `schemas/reviews.ts` · `schemas/tour-readiness.ts` · `contract.ts` |
| API, thuần | `modules/catalog/tour-photos.ts` (phân loại, so danh sách, thư mục) · `lib/upload-signing.ts` (`tourPhotoFolder`, `isTourUploadPublicId`) |
| API, service | `modules/catalog/admin-tours.service.ts` (`get`, `setPhotos`, `signPhotoUploads`, `photoLibrary`, `delete`) · `tour-state.ts` (`readTourReadiness`) · `admin-tours.controller.ts` · module catalog import `MediaModule` và `MediaGarbageModule` |
| Admin, thuần | `lib/tour-photos.ts` (giá trị form, kiểm, lọc file, sức chứa) · `lib/photo-upload.ts` (XHR) · `lib/tour-editor-view.ts` (tab, readiness, `tourPhotoThumb`) · `lib/tour-editor-write.ts` (G11) |
| Admin, UI | `app/(admin)/tours/[slug]/photos/page.tsx` · `[slug]/actions.ts` · `lib/api/tours.ts` · `components/tours/editor/tour-photos-form.tsx` · `photo-library-dialog.tsx` · `kit/list-editor.tsx` · `delete-tour-zone.tsx` · `lib/security-headers.ts` |
| Copy | `libs/shared/i18n/src/lib/messages.ts` |

## 4. Chỗ dễ sai

- **Tiền tố thư mục có dấu `/` chốt đuôi:** `<root>/tours/<tourId>/`. Thiếu nó thì
  tour có id là tiền tố của id khác khớp nhầm. Cloud đã có sẵn thư mục cũ
  `tourism/tours/hero/` (ADR-0020 Hệ quả) — không phải uuid, không bao giờ khớp.
- **Cổng ký tự publicId** trước mọi thứ: chuỗi lạ ở đây là đối số của một lệnh
  destroy bảy ngày sau (ADR-0035 AMEND 2e).
- **Không requeue ảnh thư viện**, kể cả khi nó bị gỡ khỏi tour cuối cùng còn dùng.
- **Requeue nằm trong transaction:** rollback thì không để lại gì trong hàng dọn.
- **Chép đủ metadata của dòng giữ lại:** `deleteMany` rồi `createMany` mà quên
  `version`, `author`, `licenseUrl`, `sourceUrl` là mất ghi công bắt buộc hoặc làm
  URL mất `v<version>`.
- **Ghi công ảnh thư viện chép ở server**, không lấy từ client.
- **Thumbnail không `c_fill`.**
- **CSP admin:** thiếu `https://api.cloudinary.com` ở `connect-src` là mọi lượt tải
  bị trình duyệt chặn — jsdom không canh được, phải có test cho chuỗi CSP.
- **`URL.createObjectURL`** cho xem trước phải `revoke` khi dòng xong hoặc bị gỡ.
- **Chữ ký hết hạn:** Retry ký lại một chữ ký mới, không dùng lại chữ ký cũ.
- **`format`** Cloudinary trả `jpg` cho file `.jpeg` — lưu nguyên giá trị trả về.

## 5. Kiểm thử

TDD trên logic thuần, rồi kiểm đột biến những hàm luật.

- **Contract:** `tourReadiness` với `hasCover`; các schema mới (trùng publicId,
  alt rỗng hoặc chỉ khoảng trắng, 31 ảnh, `upload` sai dạng, `count` 0 và 31);
  `MediaPublicIdSchema` chặn `..`, khoảng trắng, ký tự lạ.
- **API thuần:** `classifyTourPhotos` (giữ / tải lên / thư viện / từ chối, kể cả
  thư mục tour khác và thư mục avatar); phép so danh sách trả đúng tập cần
  requeue; `isTourUploadPublicId` với tiền tố gần giống.
- **API int:**
  - lưu đủ ba nguồn; dòng giữ lại còn nguyên ghi công và version; ảnh thư viện
    mang ghi công của dòng địa danh;
  - `PHOTO_NOT_ALLOWED` với publicId của tour khác, avatar, chuỗi bịa;
  - `STALE_TOUR`; `TOUR_NOT_READY` khi gỡ hết ảnh của tour đang bán;
  - gỡ ảnh tải lên → có dòng `media_garbage` với `created_at` mới; gỡ ảnh thư viện
    → không có;
  - xoá tour → không còn dòng ảnh, ảnh tải lên được requeue; tour có booking →
    `TOUR_HAS_BOOKINGS` và ảnh còn nguyên;
  - `signPhotoUploads` trả đúng `count` bộ, thư mục đúng, mọi publicId vào hàng
    dọn; tài khoản khách → 403; tour không có → `NOT_FOUND`;
  - `setPublished(true)` bị chặn khi tour chưa có ảnh;
  - `photoLibrary` trả ảnh theo địa danh, có địa danh đang ẩn.
- **Admin:**
  - lọc file (đuôi, dung lượng, sức chứa), hàng đợi tải 3 file một lúc, Retry;
  - Save khoá khi còn file đang tải; alt bắt buộc; Make cover; ↑ ↓; gỡ dòng cuối
    trả tiêu điểm về nút Upload photos;
  - hộp thư viện: mặc định địa danh của tour, "Added", trần sức chứa;
  - G11: ba tab báo đúng câu cũ khi tour đang bán, suy từ `projectedReadiness`;
  - chuỗi CSP có `https://api.cloudinary.com`;
  - `tourPhotoThumb` không bao giờ sinh `c_fill`.
- **Thử tay trên production** sau khi Render và Vercel deploy xong, từng bước, chờ
  xác nhận: tạo tour thử → tải hai ảnh (kéo thả và bấm nút) → thêm ba ảnh thư viện
  → sắp lại, đổi bìa, sửa alt → lưu → web hiện đúng bìa và gallery → gỡ một ảnh tải
  lên và một ảnh thư viện → đối chiếu `media_garbage` bằng SQL chỉ đọc → bật bán,
  thử gỡ hết ảnh bị chặn → xoá tour thử.

## 6. Đối chiếu Nexora (luật 10)

| Tầng | Nexora | F18 | Phân loại |
| --- | --- | --- | --- |
| Tính năng | `PUT media` cho tour | `setPhotos` thay trọn | Vá thụt lùi |
| Tính năng | media-field và hộp chọn từ thư viện | Tab Photos, hộp Add from library (kho địa danh) | Vá thụt lùi |
| Tính năng | Ảnh cho địa danh và bài viết | P4f, P4e-4 | Đã xếp lịch |
| Tính năng | Màn thư viện media, dọn rác thủ công | P4f | Đã xếp lịch |
| Hạ tầng | Ký URL upload cho admin | Ký theo lô, chữ ký phủ định dạng, xoá EXIF, không ghi đè | v2 tốt hơn |
| Hạ tầng | Cron reconcile quét ngược rồi xoá | Hàng dọn trễ 7 ngày, kiểm tham chiếu lúc xoá, không đụng ảnh thư viện | v2 an toàn hơn |

## 7. Definition of done

- `pnpm gate:int` xanh; kiểm đột biến trên `classifyTourPhotos`, phép so danh sách,
  `tourReadiness`, `onSaleShortfalls`, lọc file.
- Entry `docs/CHANGELOG.md`; `docs/open-items.md` đóng G11 và ghi luật không chạy
  lại `media:*` / `apply-alt-text.mjs` trên prod; `docs/README.md` có ADR-0048, spec
  này và plan.
- Không migration, không env, không đổi thiết lập Cloudinary — không có việc hạ
  tầng cho bước merge.
- Thử tay trên production đạt đủ các bước ở §5.

## 8. Rủi ro đã biết

- **Ảnh bìa catalog của 29 tour không nằm trong kho địa danh.** Gỡ rồi lưu là không
  chọn lại được từ hộp thư viện (ảnh vẫn còn trên Cloudinary, không bị dọn). Chấp
  nhận: thư viện là kho địa danh theo lựa chọn 28/09. Từ vòng review F18 dòng ảnh ấy
  mang nhãn "Catalogue photo" kèm câu cảnh báo (ADR-0048 AMEND 1).
- **Bộ script `media:*` và `apply-alt-text.mjs`** ghi `media_assets` theo fixture;
  chạy lại trên prod sau F18 sẽ đè alt, thứ tự, ảnh bìa admin đã sửa. Lượt seed lại
  03/11 KHÔNG đụng `media_assets` nên không bị ảnh hưởng.
- **Bộ dọn trên prod** chỉ chạy khi `MEDIA_GC_ENABLED=true` trên worker Render.
  Cờ tắt thì ảnh tải lên rồi bỏ nằm lại Cloudinary — vô hại ở quy mô capstone, và
  tự được dọn ngay khi bật cờ vì hàng dọn đã có dòng từ lúc ký.
- **Metadata do admin gửi** (ADR-0048 §5): sai kích thước chỉ làm khung ảnh lệch tỉ
  lệ trong lúc tải; `version` sai không làm hỏng ảnh vì Cloudinary phục vụ theo
  publicId.
