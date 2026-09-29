# ADR-0048 — Ảnh tour: một danh sách có thứ tự, kho địa danh làm thư viện, chỉ ảnh tự tải lên mới được dọn

- **Ngày:** 28/09/2026
- **Trạng thái:** Chấp nhận
- **Bối cảnh:** [Spec F18 — ảnh tour (P4e-3b)](../specs/2026-09-28-p4e-3b-tour-photos-design.md)
- **Liên quan:** [ADR-0020](0020-real-images-sourcing.md) (nguồn ảnh, ghi công,
  kho theo địa danh) · [ADR-0021](0021-media-write-surface.md) (ký upload thẳng
  lên Cloudinary) · [ADR-0035](0035-media-lifecycle.md) (hàng dọn có độ trễ) ·
  [ADR-0047](0047-tour-editor-sections.md) (khu làm việc chia tab, khoá phiên
  bản, cổng đăng tour)

## Bối cảnh

F17 cho admin tạo và sửa mọi nội dung chữ và số của tour, nhưng ảnh thì chưa:
tour mới tạo không có ảnh nào, và ảnh của 29 tour đang bán chỉ đổi được bằng bộ
script `media:*` chạy tay. Nexora có ô chọn ảnh, hộp chọn từ thư viện và một lệnh
`PUT media` thay trọn danh sách ảnh của tour, nên đây là thụt lùi cần vá (luật
10, `docs/analysis/2026-08-20-admin-parity-nexora.md`).

Đo trên DB production ngày 28/09:

- Mỗi tour có đúng một ảnh role `hero` (29 ảnh, thư mục `tourism/catalog/tour/`,
  không tour nào dùng chung) và từ 1 tới 17 ảnh role `gallery`. Tổng 305 dòng,
  từ 2 tới 18 dòng mỗi tour.
- Cả 276 dòng gallery đều **mượn từ kho địa danh** (`tourism/catalog/destination/`,
  137 ảnh của 18 địa danh), đúng ADR-0020 §5.
- Cả 305 dòng đều có `alt` và `version`; 34 dòng mang ghi công tác giả (ảnh
  Commons CC BY / CC BY-SA — ghi công là điều kiện của giấy phép).
- `media_garbage` có 6 dòng, đều từ đường ký upload của khách.

Hạ tầng sẵn có mà F18 dựa vào:

| Thứ đã có | Ở đâu |
| --- | --- |
| `media_assets` đa chủ, có `alt`, `version`, kích thước, `sortOrder`, bốn cột ghi công | `schema.prisma`, ADR-0020 §3 |
| Role `hero` và `gallery`; web in `hero` trước rồi gallery theo `sortOrder` | `tourGallery` (`apps/web/src/lib/tours.ts`) |
| Ký upload thẳng lên Cloudinary: publicId do server sinh, chữ ký phủ định dạng, `fl_force_strip`, `overwrite:false` | `upload-signing.ts`, ADR-0021 AMEND 1–2 |
| Ký là đăng ký theo dõi: mọi publicId đã ký nằm trong hàng dọn tới khi mồ côi thật | ADR-0035 §3, AMEND 2 |
| Readiness thuần dùng chung API và admin | `tour-readiness.ts`, ADR-0047 §4 |

Hai phát hiện lúc rà code quyết định hình dạng lời giải:

1. `media.signUpload` chịu trần toàn cục của ADR-0037 — **20 lần / 60 giây mỗi
   user**. Tải 30 ảnh một lượt là 429 từ ảnh thứ 21.
2. `AdminToursService.delete` xoá tour bằng một lệnh `tour.delete` trần. `media_assets`
   là bảng đa chủ, không có khoá ngoại tới `tours`, nên các dòng ảnh của tour bị
   xoá ở lại mãi — và vì còn dòng tham chiếu, bộ dọn của ADR-0035 không bao giờ
   coi ảnh của chúng là mồ côi.

## Quyết định

1. **Ảnh của một tour là MỘT danh sách có thứ tự; ảnh đầu là ảnh bìa.** Dòng ở vị
   trí 0 mang role `hero`, các dòng sau mang `gallery` với `sortOrder` bằng vị trí.
   Không có công tắc "ảnh bìa" tách khỏi thứ tự: web vốn in `hero` trước rồi mới
   tới gallery, nên thứ tự admin thấy chính là thứ tự khách thấy. Không migration.

2. **Một lệnh ghi thay trọn: `admin.tours.setPhotos`.** Cùng khuôn mọi tab của
   ADR-0047: gửi cả danh sách kèm phiên bản tour, server `claimTour` (lệch phiên
   bản → `STALE_TOUR`), so với các dòng đang có trong cùng transaction, rồi kiểm
   "tour đang bán thì luôn đủ". Không có endpoint cho từng ảnh.

3. **Mỗi ảnh gửi lên thuộc đúng một trong ba nguồn, ngoài ra là 400:**
   - dòng **đã có** của chính tour này — giữ metadata và ghi công của dòng;
   - ảnh **tải lên** nằm trong thư mục `<root>/tours/<tourId>/` — metadata lấy từ
     phản hồi Cloudinary do admin gửi kèm, ghi công để trống;
   - ảnh **thư viện**, tức publicId đang có dòng `DESTINATION` — server tự chép
     metadata và ghi công từ dòng gốc, không nhận từ client.

   So thư mục theo tiền tố có dấu `/` chốt đuôi, cùng nếp `isOwnAvatarPublicId`,
   để thư mục của tour này không khớp thư mục của tour khác.

4. **Ký upload cho admin là một lệnh riêng theo lô: `admin.tours.signPhotoUploads`.**
   Nhận tối đa 30 đuôi file, trả chừng ấy bộ tham số ký trong một lần gọi — một
   lượt tải 30 ảnh chỉ tốn một request dưới trần 20/60s. Tách khỏi
   `media.signUpload` còn giữ hai bề mặt riêng: bề mặt khách chỉ cần đăng nhập,
   bề mặt admin nằm sau `@Roles(ADMIN)` của controller admin. Bộ tham số ký giữ
   nguyên ADR-0021 AMEND 1–2, và mỗi publicId vào hàng dọn ngay lúc ký như §3
   của ADR-0035.

5. **Metadata của ảnh tải lên do admin gửi, server chỉ kiểm dạng.** `version`,
   `width`, `height`, `format`, `bytes` lấy từ phản hồi Cloudinary. Không gọi Admin
   API của Cloudinary lúc lưu: đó là một phụ thuộc mạng thêm vào đường ghi, để đổi
   lấy sự thật về những con số chỉ ảnh hưởng hiển thị, từ một người vốn đã được
   tin để sửa toàn bộ tour.

6. **Chỉ ảnh tự tải lên mới vào lại hàng dọn; ảnh thư viện không bao giờ.**
   - Gỡ một ảnh tải lên khỏi tour (so danh sách cũ và mới) hoặc xoá tour → `requeue`
     publicId ấy trong cùng transaction (ADR-0035 AMEND 2b: đặt lại đồng hồ 7 ngày).
   - Ảnh thư viện gỡ khỏi tour thì chỉ mất dòng của tour; không ghi gì vào hàng
     dọn. Đó là ảnh đã kiểm chứng giấy phép và ghi công (ADR-0020); mất là phải đi
     xin lại. Bộ dọn không có cách nào tự phân biệt "ảnh thư viện chỉ còn tour này
     dùng" với "rác", nên luật loại trừ nằm ở đường enqueue.
   - Ảnh tải lên rồi bỏ không lưu đã nằm trong hàng từ lúc ký — không cần gì thêm.

7. **Xoá tour thành một transaction:** xoá tour, xoá mọi dòng `media_assets` của
   tour, `requeue` các ảnh tải lên trong số đó. `P2003` vẫn là `TOUR_HAS_BOOKINGS`
   và rollback cả ba bước.

8. **Readiness thêm `cover`** (tour có ít nhất một ảnh). `ready` đòi đủ bốn điều
   kiện; `setPublished(true)` chặn tour chưa có ảnh, `setPhotos` chặn gỡ hết ảnh
   của tour đang bán. Phía admin, luật "tour đang bán thì luôn đủ" ở cả ba tab
   Details, Itinerary, Photos suy từ `projectedReadiness` thay vì viết tay từng
   luật — đóng mục nợ G11.

9. **Thư viện là kho địa danh, một lệnh đọc: `admin.tours.photoLibrary`.** Trả mọi
   ảnh `DESTINATION` (khoảng 155) theo địa danh trong một lần; admin tự đưa các
   địa danh tour đi qua lên đầu.

10. **Web không đổi; admin không crop.** Web đọc `cover` và `media` qua endpoint
    công khai với hình dạng cũ. Thumbnail ở admin dùng `f_auto,q_auto,w_320` và
    `object-fit: cover` của CSS, không `c_fill` (ADR-0020 §4: cắt cúp ảnh
    ShareAlike tạo tác phẩm phái sinh). CSP của admin mở `connect-src` cho
    `https://api.cloudinary.com` — trình duyệt admin POST file thẳng lên đó.

## Hệ quả

- Contract nở ba thủ tục dưới `admin.tours` (`setPhotos`, `signPhotoUploads`,
  `photoLibrary`), `AdminTourDetail.photos`, và `TourReadiness.cover`. Web và mobile
  không đổi.
- `AdminToursService.delete` đổi từ một lệnh sang một transaction.
- Bộ dọn của ADR-0035 có thêm hai nơi `requeue` (gỡ ảnh, xoá tour) và một luật loại
  trừ (ảnh ngoài thư mục tải lên của tour).
- Sau F18, bộ script `media:*` và `apply-alt-text.mjs` không được chạy lại trên
  production: chúng ghi `media_assets` theo fixture và sẽ đè alt, thứ tự, ảnh bìa
  admin đã sửa.
- Ảnh do admin tải lên không có ghi công. Admin chỉ tải ảnh mình có quyền dùng; ảnh
  cần ghi công đi qua thư viện, nơi ghi công được chép tự động.

## Phương án đã cân nhắc

- **Mỗi thao tác ghi ngay** (tải xong là gắn, mỗi lần dời, đổi bìa, sửa alt, gỡ là
  một lệnh). Bỏ: mỗi thao tác đẩy phiên bản tour lên một nấc nên mọi tab khác liên
  tục dính STALE; năm sáu endpoint thay vì một; và không còn "đổi ý chưa lưu".
- **Dựng thư viện media của admin trước (P4f), tour chỉ chọn từ đó.** Bỏ: phạm vi
  gấp đôi, trễ F18 khi còn khoảng hai tuần rưỡi tới freeze 15/10.
- **Thêm purpose `TOUR_PHOTO` vào `media.signUpload`.** Bỏ: trần 20/60s chặn lô 30
  ảnh, và luật quyền theo purpose trong một endpoint chỉ-cần-đăng-nhập là thứ phải
  nhớ mãi, trong khi controller admin đã có `@Roles(ADMIN)`.
- **Server hỏi Admin API của Cloudinary lấy metadata lúc lưu.** Bỏ: xem §5.
- **Requeue mọi ảnh gỡ ra, để bộ dọn tự kiểm tham chiếu.** Bỏ: một ảnh thư viện
  chỉ còn một tour dùng sẽ bị destroy bảy ngày sau khi admin gỡ nó.
- **Công tắc "ảnh bìa" độc lập với thứ tự.** Bỏ: hai khái niệm cho một thứ web vốn
  suy từ thứ tự; và nó cho phép trạng thái "bìa nằm giữa danh sách" mà web không
  bao giờ hiện như vậy.

## Không mở ra

Cắt hoặc xoay ảnh; video; ảnh cho địa danh, bài viết, trang (P4f và P4e-4); màn thư
viện media riêng và nút xoá ảnh khỏi Cloudinary (P4f); ô ghi công cho ảnh tải lên.

## AMEND 1 — Nhãn nguồn thứ ba "Catalog" cho ảnh bìa gốc (29/09, vòng review F18)

Vòng review F18 đo trên prod: 29 ảnh bìa gốc `tourism/catalog/tour/<slug>/…` chỉ có
dòng `TOUR`, không có dòng `DESTINATION` nào — nên KHÔNG có trong hộp Add from library.
Bản thi công lại gắn chúng nhãn `LIBRARY` ("From the library"), khiến admin tưởng gỡ ra
vẫn chọn lại được; gỡ rồi lưu là mất khỏi tour, và gắn lại thì cả ba nguồn của §3 đều
trượt (`PHOTO_NOT_ALLOWED`).

Quyết định (user chọn 29/09): phần HIỂN THỊ có ba nguồn thay vì hai —

- `UPLOAD`: publicId trong thư mục tải lên của tour (như §3);
- `LIBRARY`: publicId đang có dòng `DESTINATION` — đúng định nghĩa thư viện của §3;
- `CATALOG`: mọi ảnh còn lại. Dòng nguồn của admin nói thẳng "Catalogue photo" kèm câu
  "can't be added back once removed".

Luật GHI của §3 không đổi: ảnh đang có của tour vẫn được giữ; một ảnh `CATALOG` đã gỡ
thì vẫn không gắn lại được — đó là giới hạn đã nhận ở spec §8, nay nói ra ngay trên dòng
ảnh thay vì bị nhãn che đi. `get` tốn thêm một câu đọc (dòng `DESTINATION` có publicId
thuộc tour) để phân biệt `LIBRARY` với `CATALOG`. Phương án đưa ảnh bìa gốc vào thư viện
(để gắn lại được) bị loại: nó đổi phạm vi thư viện của §9 khi còn hai tuần tới freeze.

