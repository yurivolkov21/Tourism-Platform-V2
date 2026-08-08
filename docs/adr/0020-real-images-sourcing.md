# ADR-0020 — Ảnh thật: nguồn, ghi công, và đường ảnh cho catalog

- **Trạng thái:** Accepted (2026-08-08)
- **Bối cảnh thi hành:** nhánh `feat/real-images`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0005](0005-media-read-build-url.md) (đọc media, dựng URL —
  ADR này mở rộng nó sang GHI) · [ADR-0016](0016-web-data-layer.md) (tầng dữ
  liệu web) · `apps/web/public/mock/CREDITS.md` (tiền lệ ghi công)

## Bối cảnh

Chính sách ảnh hiện hành ghi ở `docs/README.md`: *"toàn site dùng
`ImagePlaceholder`, chỉ đổi ảnh thật khi user yêu cầu riêng"*. User yêu cầu
ngày 08/08, nên chính sách đó kết thúc ở đây.

Hiện trạng đo được:

- **23 chỗ render `ImagePlaceholder` trên 21 file**, cộng một component giữ chỗ
  thứ hai ít ai nhớ — `RegionTile` (18 ô trên 3 trang miền, dùng gradient chứ
  không dùng `ImagePlaceholder`).
- **Tầng media là MỘT CHIỀU.** `MediaService` chỉ có `resolveForOwners` (đọc).
  Không service ghi, không procedure upload trong contract, không cron dọn ảnh
  mồ côi. `media_assets` **rỗng sau seed** — seed cố ý không tạo row nào.
- **Tour và Destination không có đường nào ra ảnh** — không field ở
  `schema.prisma`, không field ở contract `catalog.ts`. `docs/README.md` xếp
  đây là "nợ contract #1".
- `apps/web/next.config.ts` **không khai `images`** và web chưa dùng
  `next/image` ở bất kỳ đâu.
- `MediaGarbage` là **bảng chết**: có schema, có RLS, 0 dòng code đọc/ghi.
  Nexora có `reconcileMedia()`; đây là thụt lùi hạ tầng theo luật #10.

## Quyết định

### 1. Nguồn: Wikimedia Commons chính, Pixabay lấp chỗ

**Commons làm nguồn chính** vì một lý do không nguồn nào khác có:
`list=geosearch` lọc theo **toạ độ GPS thật** gắn trong structured data của
file. Đó là cách duy nhất để **máy kiểm chứng** ảnh có đúng chụp tại địa danh
đó không — thay vì tin vào từ khoá. Đo thực tế (bán kính 10km): Hạ Long 229
file · Sa Pa 460 · Hội An 500+ · Huế 500+ · Phong Nha 41 · Đà Lạt 500+ · Phú
Quốc 118 · Cần Thơ 284.

Rủi ro này không lý thuyết: Pexels báo "29.6K ảnh Hạ Long" — con số bất khả
thi, chứng tỏ nó trả cả kết quả "liên quan". Không metadata vị trí thì không
có cách lọc máy, phải duyệt mắt từng tấm.

**Pixabay lấp chỗ** khi Commons mỏng. Điều khoản của nó khớp kiến trúc: *"Permanent
hotlinking of images … is not allowed. If you intend to use the images, please
download them to your server first"* — tức **bắt buộc rehost**, đúng thứ ta
làm. Không bắt ghi công.

### 2. Loại đường API Unsplash — và phân biệt với Unsplash License

**Điều khoản API** của Unsplash bắt buộc hotlink: *"you must directly use or
embed the related image URLs returned by the API … generally referred to as
'hotlinking'"*. Kiến trúc của ta là **rehost** (`MediaAsset.publicId` →
`res.cloudinary.com`, `cloudinary-url.ts:26`). Hai điều đó mâu thuẫn trực tiếp,
nên **không dùng API Unsplash**.

Cần tách bạch để không hiểu nhầm: **Unsplash License** (áp cho ảnh tải từ
website) *có* cho phép chép, sửa, phân phối. Hai file Unsplash đang nằm trong
`apps/web/public/mock/` là **hợp lệ** và được giữ lại. Cái bị loại là con
đường đi qua API.

### 3. Ghi công là bắt buộc — thêm 4 cột vào `MediaAsset`

Đo 200 file Commons quanh Hạ Long và Hội An: **chỉ 8–10% là CC0/public
domain**; còn lại CC BY và CC BY-SA. Với những giấy phép đó, ghi công là
**điều kiện của giấy phép**, không phải phép lịch sự.

`MediaAsset` (`schema.prisma:758-786`) hiện **không có ô nào** cho việc này.
Thêm bốn cột, tất cả nullable (ảnh Pixabay và ảnh tự chụp không cần):

| Cột | Ý nghĩa |
| --- | --- |
| `author` | Tên tác giả như nguồn công bố |
| `license` | Mã ngắn, ví dụ `CC BY-SA 4.0` |
| `licenseUrl` | Link toàn văn giấy phép |
| `sourceUrl` | Link trang gốc của file |

Commons trả đủ bốn thứ này qua `prop=imageinfo&iiprop=extmetadata` — đo được
**0/200 file thiếu trường Artist**, nên sinh chuỗi ghi công **tự động** được,
không phải chép tay.

### 4. Không crop ảnh ShareAlike — giải bằng cách bỏ crop phía máy chủ

CC BY-SA chiếm ~50% mẫu Hội An. Với CC, **đổi định dạng không tạo tác phẩm
phái sinh, nhưng cắt cúp thì có** — và phái sinh kích hoạt nghĩa vụ ShareAlike.

Thay vì né bằng cách chọn ảnh, giải bằng kỹ thuật: **transform Cloudinary chỉ
dùng `f_auto,q_auto` và `w_<width>`**, tuyệt đối không `c_fill`/`c_crop`. Đổi
định dạng và **thu nhỏ theo tỉ lệ** đều không phải phái sinh. Tỉ lệ khung hình
của card/hero do CSS `object-fit: cover` lo phía trình duyệt.

Cách này vừa đóng vấn đề pháp lý vừa đơn giản hơn: một biến thể URL cho mọi bề
mặt, không cần bảng tỉ lệ theo từng khối.

### 5. Kho ảnh theo ĐỊA DANH, tour rút từ kho

Bề mặt duy nhất có khẩu vị ~10 ảnh cho một thực thể là **gallery trang chi
tiết tour** (`tour-gallery.tsx` — 1 ô lớn + `MAX_THUMBS = 4`, lightbox không
giới hạn). Không có trang chi tiết địa danh; mỗi tile địa danh chỉ 1 ảnh.

Nên: **10 ảnh cho mỗi địa danh làm KHO DÙNG CHUNG.** Tour rút từ kho của địa
danh nó thuộc về; tile địa danh lấy 1 tấm từ chính kho đó. 19 × 10 = **190
ảnh** phủ được cả 19 tile lẫn 30 gallery — thay vì 300 tấm nếu mỗi tour một bộ
riêng, và mỗi tấm đều phải kiểm chứng.

### 6. Contract catalog nở ra — đóng "nợ contract #1"

`TourCardSchema`, `TourDetailSchema`, `DestinationSchema` nhận thêm field
media. `catalog.service` gọi `MediaService.resolveForOwners` (đã batch chống
N+1, đã nhận `ownerType` làm tham số — không phải viết mới). Enum
`MediaOwnerType` đã có sẵn `TOUR` và `DESTINATION`.

### 7. Ảnh người thật: KHÔNG seed

`about-team` có 4 ô ảnh. Lấy ảnh người lạ từ kho ảnh rồi trình bày như "đội
ngũ của chúng tôi" là **bịa dữ liệu trông như thật** — vi phạm luật cứng #4 của
design brief, cùng loại với hàng "Google — Connected" đã cắt ở spec redesign
account. Bốn ô này **giữ nguyên giữ chỗ** cho tới khi có ảnh thật của người
thật.

## Hệ quả

- Migration mới cho 4 cột ghi công. Không đụng `migration.sql` cũ (luật bất
  biến).
- UI phải có chỗ **hiển thị** ghi công — giấy phép đòi vậy. Gallery/lightbox
  hiện dòng tác giả + giấy phép; bề mặt nhỏ (tile, card) gom về một trang
  `/credits` và link tới.
- `next.config.ts` khai `remotePatterns` cho `res.cloudinary.com` + custom
  loader chèn `w_<width>` (nếu không, `next/image` tải bản `f_auto,q_auto` rồi
  nén lại lần hai).
- Thiết kế hiện tại được chỉnh RIÊNG cho nền giữ chỗ phẳng —
  `destination-tile.tsx:63` ghi thẳng *"KHÔNG có lớp phủ tối… khi có ảnh thật
  thì mới quay lại mẫu phủ-tối + chữ trắng"*. Phải dựng lại lớp phủ và **đo
  lại tương phản** trên ảnh thật, không chỉ đổi `src`.
- Cloudinary free: 25 credit/tháng, 1 credit = 1 GB lưu trữ. ~250 ảnh ≈ 0.25
  GB — thừa sức. Nhưng có **trần cứng 10 MB / 25 MP mỗi ảnh** mà file gốc
  Commons đã sát (mẫu Sa Pa: 20.2 MP / 5.0 MB). Lấy qua URL `/thumb/…/2400px-`
  thay vì file gốc.
- Cloud `dbkgeehow` **đã có asset từ trước** (`tourism/tours/hero/`,
  `tourism/destinations/hero/`, `tourism/users/avatars/`). Seed vào thư mục
  riêng, không trộn.
- `MediaGarbage` vẫn là bảng chết sau ADR này. Ghi nhận là nợ, không mở trong
  phạm vi này.

## Đã cân nhắc và loại

- **Hotlink thẳng từ Commons/Unsplash.** Bỏ toàn bộ tối ưu Cloudinary, phụ
  thuộc host ngoài lúc bảo vệ, và Pixabay cấm.
- **Chỉ lấy CC0/public domain để né ghi công.** Đo được chỉ 8–10% file đạt —
  nhiều địa danh sẽ không đủ ảnh.
- **Openverse.** Tự phủ nhận tính chính xác của giấy phép (*"does not verify
  its licensing status"*), và giới hạn ẩn danh 5 request/giờ.
- **Dựng tầng upload đầy đủ (ký + procedure contract) ngay bây giờ.** Đó là
  việc P4. Escape-hatch `publicId`-là-URL-tuyệt-đối (ADR-0005 §2) đủ cho seed;
  nhưng ADR này chọn upload THẬT lên Cloudinary bằng script một lần, vì
  escape-hatch mất `f_auto,q_auto` và ta cần biến thể `w_` cho `next/image`.
