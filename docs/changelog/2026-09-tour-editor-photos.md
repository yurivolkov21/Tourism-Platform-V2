# CHANGELOG — lưu trữ: tạo và sửa tour, ảnh tour (25/09–29/09/2026)

F17 tạo và sửa tour, F18 ảnh tour, các lượt thử tay và góp ý sau đó, bật bộ
dọn ảnh mồ côi trên production, vá `fast-uri`.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 14/10/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`, và
link tới tài liệu dời thư mục cùng ngày 14/10 trỏ sang chỗ mới. Đừng
mở-rồi-save bằng editor có markdownlint: nó đổi `+` đầu dòng thành `-` và nói
sai con số test đã ghi.

## 2026-09-29 — Web lấy đủ mọi trang tour, không dừng ở 50 (nhánh `fix/web-tours-all-pages`, đóng G10)

`fetchTours` từng chỉ đọc trang 1 `limit: 50` của `catalog.tours.list` (contract cho tối
đa 50), nên từ tour thứ 51 thì tour cũ nhất biến khỏi listing, sitemap, prerender và số
đếm ở trang chủ. F17 cho admin tạo tour nên ngưỡng này chạm được; hiện có 29 tour.

`38a3b25d`: hàm thuần `collectAllPages` (`apps/web/src/lib/api/collect-pages.ts`) đọc
trang 1 rồi lần lượt tới `totalPages`. Gọi tuần tự để không dồn loạt request vào instance
free của Render; bỏ tour trùng giữa hai trang (tour mới tạo giữa hai lượt gọi đẩy mọi tour
lùi một bậc); ném lỗi thay vì trả danh sách thiếu. Trần 20 trang (1000 tour), chạm trần
thì `console.warn`. Không đổi contract hay API; với 29 tour vẫn là một lượt gọi.

G9 (bust `post:<slug>` khi sửa hay xoá tour) chuyển vào phạm vi P4e-4 thay vì vá bây giờ:
hôm nay chưa có triệu chứng — web chưa hiện tour gắn trong bài viết, không seed hay màn nào
tạo `PostTour`, menu Posts của admin còn tắt.

**Review findings:** user duyệt thiết kế trong chat. Năm đột biến tay (bỏ trần, hụt trang
cuối, không bỏ trùng, báo `totalPages` đã cắt, nuốt lỗi trang sau) đều bị test bắt.

Tests after: xem entry dưới — hai nhánh chạy chung một lượt `gate:int`.

## 2026-09-29 — Lúc build thử lại lâu hơn khi Render dựng lại API (nhánh `fix/web-build-retry`, ADR-0044 AMEND 1)

Bản deploy web của `962d6090` (lượt push merge F18) ERROR dù đã có lớp thử lại: prerender
`/tours/phu-quoc-honeymoon-4d` nhận `ECONNRESET` cả ba lượt của lịch 400ms/1200ms, trong
lúc Render dựng lại API cho chính lượt push ấy. Build Filter `docs/**` (bật 21/09) không
chặn ca này, vì lượt push có sửa `apps/api`.

- `c3a3d5aa`: ADR-0044 AMEND 1 — ràng buộc 4 tách thành hai lịch chờ; bản đồ ADR ghi
  "1 AMEND".
- `a8b5aeb3`: `retryDelaysFor(process.env.NEXT_PHASE)` — lúc `next build` sáu lượt, chờ
  1s, 2s, 4s, 8s, 15s; lúc chạy giữ lịch ngắn. Mỗi lần sắp thử lại ghi một dòng
  `[retry-fetch] GET <đường dẫn> — lượt n/N lỗi … (ECONNRESET), thử lại sau …ms`, không
  kèm query, để log build cho biết lớp này đã cứu lượt nào.

Chỗ nối trong `client.ts` được kiểm bằng một test tạm (không commit) chạy qua client oRPC
thật: có `NEXT_PHASE` của build thì 6 lượt kèm 5 dòng cảnh báo, không có thì 3 lượt. Next
16.3.4 gán `NEXT_PHASE` trước khi tạo worker prerender, và worker nhận env của tiến trình
cha (đọc mã `next/dist`).

**Review findings:** user duyệt thiết kế trong chat. Bảy đột biến tay (đảo điều kiện pha,
gõ sai tên pha, lịch build thiếu lượt, không ghi log khi status tạm thời, bỏ mã nguyên
nhân, đếm sai tổng lượt, log kèm query) đều bị test bắt; ca tên pha so với hằng của
`next/constants`. Tự sửa trước khi push: bản AMEND đầu viết lượt push ấy chỉ sửa `docs/`
và Build Filter chưa bật — sai cả hai.

Tests after (một lượt `gate:int` trên trạng thái gộp hai nhánh; cây trùng `main` trừ file
ADR): unit 4862 — web 1592 (thêm 16), admin 1441, api 1005, contract 560, mobile 159, core
46, ui 23, i18n 18, tokens 18 — và int 702/702 trên DB riêng, hết 700 giây.

## 2026-09-29 — Bật bộ dọn ảnh mồ côi trên production; đính chính entry thử tay F18

**Đính chính.** Entry "Thử tay F18 trên production" bên dưới ghi mười một publicId của
tour thử "sẽ tự dọn sau bảy ngày". Sai ngay lúc viết: `MEDIA_GC_ENABLED` mặc định
`false` (ADR-0035 §6) và Render chưa từng đặt biến này, nên bộ dọn chưa chạy ở production.
Trên Cloudinary lúc ấy còn tám file của tour thử; ba lượt còn lại bị chặn ở bước 4 nên
không tạo file.

**Bật bộ dọn (user, 29/09).** Render thêm `MEDIA_GC_ENABLED=true` và
`MEDIA_GC_GRACE_DAYS=7`; lượt deploy lúc 11:15 UTC đăng ký lịch `media-gc` `0 4 * * *`
(đọc bảng `pgboss.schedule`). Trước khi bật đã chạy thử bằng SQL chỉ đọc: hàng có 17 dòng
(1 avatar, 5 ảnh review, 11 ảnh tour thử), và lượt đầu không xoá gì — ảnh còn dùng thì
hoãn, ảnh mồ côi chưa đủ bảy ngày. Ảnh review mồ côi tới hạn khoảng 01/10; tám file của
tour thử khoảng 07/10, trừ khi user xoá tay trên Cloudinary trước.

**Thuế và phí cổng (user, 29/09).** Render nhập `MARGIN_TAX_RATE=0.1`,
`PAYMENT_FEE_RATE=0.029`, `PAYMENT_FEE_FIXED=0.30`. Ba biến chỉ dùng ở báo cáo `/reports`
và file Excel (ADR-0033 §5–§6), không đổi số tiền khách trả.

**`apps/api/.env.production` (không commit) khớp lại Render**, vì từ nay nó là bản gốc để
import env lên Render. Ba chỗ lệch đã sửa: tên biến thuế từng gõ sai `MARGIN_TAX_RRATE`
(API bỏ qua biến lạ nên thuế âm thầm về 0), phí cổng đang 0, bộ dọn đang `false`. Hai
biến file có mà Render chưa đặt đều vô hại khi import: `ENQUIRY_RETENTION_MONTHS=18` trùng
mặc định; `CORS_ORIGINS` (www và admin) chặt hơn giá trị rơi về `TRUSTED_ORIGINS`, đúng
thiết kế của ADR-0026 AMEND 1, và tên miền gốc vốn chuyển hướng 308 sang www.

Tests after: không đổi — lượt này không đổi file nguồn.

## 2026-09-29 — Góp ý thử tay F18, dọn G13 và một phần G14 trước F19 (nhánh `fix/f18-thu-tay-gop-y`)

F19 chưa thi công, nên user cho vá luôn các mục còn treo của vùng tab Photos. Chỉ chọn
những mục không làm lệch plan F19: plan gọi `tourPhotoThumb` từ `tour-editor-view` và giữ
nguyên chỗ dùng `ListEditor`.

- **Góp ý #1: chữ "Added" bị cắt mất** (`7ab29b66`). Hộp thư viện nối "alt · Added" rồi
  cắt còn hai dòng; alt ảnh thư viện thật dài cả câu nên "Added" luôn rơi vào phần bị
  cắt. Nay "Added" là huy hiệu trên góc ảnh, cùng kiểu nhãn Cover; chú thích chỉ mang
  alt. Ca test mới dùng alt dài như dữ liệu thật.
- **Câu dải TOUR_NOT_READY** (`e4a4ae05`, đóng G13). "This change would leave it
  missing:" đổ lỗi cho lần sửa cả khi chỗ thiếu có từ trước. Nay "Saved like this, it
  would be missing:" — tả trạng thái của bản sẽ lưu. JSDoc giữ nguyên, vì bước B9 của
  F19 sửa đúng dòng ấy.
- **G14, ba mục** (`64d5ccae`, `a761d4f4`, `5890c602`):
  - `toDetail` dùng `pickCover` thay vì tự so `role === 'hero'`; `hasTourCover` bỏ
    export thừa, sửa JSDoc nói sai "`get` gọi nó".
  - Helper URL Cloudinary của admin gom về `lib/cloudinary-url.ts`
    (`withDeliveryTransform`, `cloudinaryImageUrl`). `reviewPhotoThumb`,
    `reviewPhotoLarge`, `tourPhotoThumb` dùng chung; `tourPhotoThumb` ở nguyên
    `tour-editor-view` vì plan F19 import từ đó.
  - Thanh tiến độ tải ảnh dùng `Progress` của `@tourism/ui`, vẫn mang `id` và
    `tabIndex={-1}` để giữ tiêu điểm của Retry.
- **Cố ý để sau F19** (open-items G14): `ListEditor` nhận `add` và `emptyFocus` bằng một
  union, copy đọc từ hằng, gom fixture test — F19 sửa đúng các file ấy.
- **Plan F19** (`1e4d88db`) có mục "Cập nhật 29/09 — code thật đã khác plan ở đâu";
  prompt cuối plan trỏ tới mục đó.

Lưu ý của entry fast-uri đã làm: chạy tay workflow `Audit` (run `36552822991`) — xanh;
hai alert Dependabot mới của fast-uri (#65, #66) tự đóng lúc push, không còn alert nào
mở.

**Đột biến:** năm cái, chết cả năm — nối "Added" lại vào chú thích; `get` luôn coi là
có bìa; bỏ transform khỏi URL Cloudinary; bỏ `id` và bỏ `tabIndex` của `Progress`.

**Review findings:** không mở vòng review riêng — các mục đều đến từ vòng review và lượt
thử tay F18.

Tests after: Vitest **4687** (web 1576, admin 1441, api 1005, contract 560, core 46,
ui 23, tokens 18, i18n 18), int **702 ở 45 file**, jest mobile 159 và mobile-ui 86. Ca
mới ở admin: một ca "Added" với alt dài, ba ca của `cloudinary-url` (một ca dời từ
`tour-editor-view`).

## 2026-09-29 — Thử tay F18 trên production (`47b8dc64`): 11/11 bước đạt, một góp ý

User thử từng bước trên admin production; sau mỗi bước session gốc kiểm DB bằng SQL
chỉ đọc. Tour thử `f18-photo-test` tạo mới ở bước đầu và xoá ở bước cuối. Từ bước 2
trở đi chạy trong cửa sổ InPrivate, để extension không lẫn vào Console.

1. Tạo tour thử, điền đủ readiness trừ ảnh bìa. DB: tắt bán, 0 ảnh.
2. Tải hai ảnh (một bằng nút, một kéo thả), điền alt, lưu. DB: hai dòng trong thư mục
   tải lên của tour, ảnh đầu là `hero`; hàng dọn có đúng hai publicId đã ký. Console
   không có vi phạm CSP nào cho Cloudinary — lớp nghiệm thu thứ hai của ADR-0038
   AMEND 5 đạt.
3. Rời tab lúc đang tải (mạng giả Slow 4G): hộp "Discard unsaved changes?" hiện khi
   form còn sạch, tức phát hiện #8 của vòng review đã vá đúng. F5 thì trình duyệt
   hỏi lại.
4. Tải hỏng bằng cách chặn `https://api.cloudinary.com/*` trong DevTools (Request
   conditions): Retry bằng bàn phím giữ tiêu điểm trên dòng — hỏng lại thì về nút
   Retry, xong thì vào ô alt của ảnh mới; Remove dòng hỏng cuối thì về Upload photos.
5. Thêm ba ảnh thư viện Hội An: alt chép từ ảnh gốc, ghi công chép đủ (tác giả, giấy
   phép, source URL); mở lại hộp thì ba ảnh ấy bị khoá.
6. Alt trống chặn lưu, câu báo nằm dưới đúng ô; lưu 7 ảnh đúng thứ tự trên màn hình.
7. Bật bán: trang web hiện đúng ảnh bìa và 7 ảnh; sau mỗi lần lưu web theo kịp.
8. Gỡ ảnh rồi lưu: ảnh tải lên vào lại hàng dọn với đồng hồ mới (đúng lúc lưu), ảnh
   thư viện không vào hàng.
9. Tour đang bán gỡ hết ảnh: câu "A tour on sale needs a cover photo…", DB không đổi.
10. Tour có sẵn: ảnh bìa gốc ghi "Catalogue photo · … · Can’t be added back once
    removed.", ảnh mượn từ kho địa danh ghi "From the library".
11. Tắt bán rồi xoá tour thử: web trả 404; DB không còn tour, dòng ảnh, liên kết điểm
    đến, lịch trình; ảnh tải lên cuối vào hàng dọn; ba dòng thư viện Hội An còn
    nguyên. Mười một publicId của tour thử trong hàng dọn sẽ tự dọn sau bảy ngày.

**Hai dòng CSP không phải lỗi của site.** `frame-src` chặn `vercel.live`: thanh công cụ
Vercel khi người thử đang đăng nhập Vercel, ADR-0038 đã ghi. `eval` bị chặn: do một
extension ở cửa sổ thường — InPrivate không có, và Issues không ghi vị trí nguồn.

**Góp ý #1:** chữ "Added" trong hộp thư viện bị cắt mất. Nhãn nối "alt · Added" rồi
cắt còn hai dòng (`line-clamp-2`), mà alt ảnh thư viện thật dài cả câu — unit test dùng
alt ngắn nên không thấy. Vá ở nhánh `fix/f18-thu-tay-gop-y`.

**Lúc merge F18:** bản deploy web của `962d6090` ERROR — Render deploy lại API đúng
lúc Vercel prerender, lượt gọi API bị `ECONNRESET` (nguyên nhân 1 của ADR-0044). Site
không sập vì Vercel giữ bản READY cũ, và F18 không đổi gì phía web; lượt `47b8dc64`
READY.

Tests after: không đổi — lượt này không đổi file nguồn.

## 2026-09-29 — Vá fast-uri trên đường request của API, kèm undici và ip-address (nhánh `fix/fast-uri-advisory`)

Workflow "Dependabot Updates" hỏng hai lượt lúc 23:53 UTC ngày 28/09 với
`security_update_not_possible` cho `fast-uri`: nó báo `latest-resolvable-version`
3.1.7 và `lowest-non-vulnerable-version` 3.1.8 rồi dừng — đúng giới hạn đã ghi ở
`audit.yml`, Dependabot không mở được PR cho lock pnpm có override. Workflow `Audit`
xanh lượt 28/09 02:00 UTC, nhưng lượt 05/10 sẽ đỏ: năm advisory vào DB chung của
GitHub tối 28/09 (20:43–21:42 UTC).

- **fast-uri 4.1.3 lên 4.2.1, bản này đang chạy ở production.** Hai advisory high:
  GHSA-qw65-cvwx-89v3 (authority injection qua port không được kiểm trong
  `serialize`, dính `<4.1.4`) và GHSA-58mr-gqgx-xq4g (host confusion qua ngoặc
  vuông không đóng, dính ĐÚNG 4.1.3). Đường kéo: `@tourism/api` → fastify 5.12.1 →
  fast-json-stringify → fast-uri ^4. Bản vá 4.1.4 có từ 02/09 11:07 UTC; đợt vá
  03/09 dừng ở 4.1.3 chỉ vì commit `7e9fad87` lúc 02:58 UTC, khi 4.1.4 mới khoảng
  16 giờ tuổi — dưới cửa sổ `minimumReleaseAge` mặc định một ngày của pnpm 11 (đọc
  mã 11.9.0: `minimum-release-age: 24 * 60`). Override nay là
  `>=4.0.0 <4.1.5: ^4.1.5`, pnpm chọn bản cao nhất 4.2.1 (18/09). Release notes của
  4.2.0 và 4.2.1 chỉ sửa IPv6 zone id và chuẩn hoá `mailto`.
- **fast-uri 3.1.7 lên 3.1.8, vá trước khi audit kịp thấy.** 3.1.7 đã ngoài dải hai
  advisory 28/09, nhưng fastify công bố ở repo từ 15/09 GHSA-hrr3-gc8f-f4qj (medium,
  `>=3.0.0 <3.1.8`) mà DB chung chưa có (API trả 404 ngày 29/09), nên audit lẫn
  Dependabot còn mù. Độ trễ ấy không nhỏ: hai advisory 28/09 có bản vá từ 02/09,
  tức 26 ngày. Dòng 3.x cũng chạy ở production (fastify → `@fastify/ajv-compiler` →
  ajv). Cùng lý do, selector dòng 4.x lấy tới `<4.1.5` để trùm GHSA-hrr3 và
  GHSA-jvvf-x445-j334 (header injection ở `mailto`, `>=4.1.3 <4.1.5`), cũng mới chỉ
  có ở repo.
- **ip-address 10.4.0 lên 10.7.2** (GHSA-rpw4-54j3-4h4q, GHSA-2vr4-cq9g-pvrc,
  moderate; cộng hai advisory repo 15/09 dính `<=10.7.0`). Ba dòng override của đợt
  03/08 GỘP thành một `ip-address@<=10.7.0: ^10.7.1`: pnpm 11 áp override khi
  selector giao với spec của gói cha, và nhiều selector cùng khớp thì nó chỉ lấy MỘT
  (`pickMostSpecificVersionOverride`). Để dòng cũ lại thì spec có thể vẫn là
  `^10.2.2`, 10.4.0 thoả nên lock không nhúc nhích. Đường kéo dev-tooling: shadcn →
  `@modelcontextprotocol/sdk` → express-rate-limit.
- **undici 7.29.0 gộp về 7.29.1 vốn đã có trong lock** (GHSA-3wwx-pv8p-q78v,
  moderate; repo undici còn chín advisory 04/09 cho dòng 7.x, đều vá ở 7.29.1).
  Đường kéo dev-tooling: shadcn CLI và `@dotenvx/dotenvx`.
- `minimumReleaseAgeExclude` không đổi: mọi bản vá đã đủ tuổi, trẻ nhất là 4.2.1 với
  11 ngày. Lock chỉ đổi ba gói, không gói nào nhảy major. Lệnh
  `pnpm audit --audit-level=moderate` về 0, chỉ còn GHSA-vcc3-ghjq-m6fr đã ignore có
  chủ đích từ 21/09. Cảnh báo peer của `pnpm install` giống hệt main (Expo và React
  Native).

**Bài học:** DB advisory chung của GitHub, nơi `pnpm audit` và Dependabot đọc, trễ so
với advisory ở repo của chính gói — lượt này 26 ngày. Khi vá một gói, đọc thêm
`gh api repos/<owner>/<repo>/security-advisories` và release notes của bản vá mới
nhất, đừng dừng ở dải audit báo.

**Review findings:** chưa có vòng review riêng.

Không migration, không đổi env. Đẩy lên `main` thì Render tự deploy API với fast-uri
mới — đó là toàn bộ phần "hạ tầng" của lượt này. Việc còn lại: sau khi đẩy, chạy tay
workflow `Audit` (có `workflow_dispatch`) để thấy xanh ngay thay vì đợi 05/10, và
xem các alert Dependabot của ba gói có tự đóng không.

Tests after: không đổi so với entry G12/G13 ngay dưới, vì lượt này không đổi file
nguồn nào. Vitest **4684** (web 1576, admin 1438, api 1005, contract 560, core 46,
ui 23, tokens 18, i18n 18), int **702 ở 45 file**, jest mobile 159 và mobile-ui 86.
`gate:int` chạy hai lượt, tách bước có hãm song song và watchdog: lượt đầu trên gốc
`962d6090` (671 giây), lượt hai sau khi rebase lên `47b8dc64` (624 giây), vì code
G12/G13 chưa từng chạy chung với lock mới. Int chạy trên DB riêng
`tourism_test_fasturi` và API cho build web ở cổng 3101, vì một session khác chạy gate
ở checkout gốc cùng lúc. Mỗi gói có dependency hoặc mã đổi (api, admin, web, ui) đều
chạy thật các task của nó ở ít nhất một lượt; các gói còn lại replay cache.

## 2026-09-29 — Vá G12 và phần thư viện của G13 sau F18 (nhánh `fix/tour-photo-int32-image-filter`)

Hai mục nhỏ mà vòng review F18 ghi vào open-items. User chọn vá ngay sau merge F18.
Nhánh chỉ đụng contract và API, không đụng file nào plan F19 sẽ sửa.

- **G12: metadata ảnh tải lên vượt INT4 ra 500** (`a5d39f1a`). `TourPhotoUploadSchema`
  dùng `z.int()` (tới 2^53) cho `width`, `height`, `bytes`, trong khi ba cột là INT4.
  Một request tự chế vượt 2^31 lọt schema rồi chết ở DB (P2020, ra 500; transaction
  rollback trọn nên không hỏng dữ liệu). Nay dùng `z.int32()`, request như vậy là 400
  `BAD_REQUEST`.
- **G13: thư viện nhận cả video** (`a5d39f1a`, ADR-0048 AMEND 2). Ba chỗ đọc thư viện
  (hộp Add from library, bước tra thư viện của `setPhotos`, nhãn nguồn của `get`) nhận
  mọi dòng `DESTINATION`, kể cả `VIDEO`. Nay cả ba dùng chung một định nghĩa
  `LIBRARY_PHOTO`: dòng `DESTINATION` loại `IMAGE`. Prod đo 29/09 (chỉ đọc): chưa có video
  nào của địa danh, nên đây là chặn trước. Phần còn lại của G13 vẫn ở open-items: ảnh
  của chính tour chưa lọc theo loại, và câu `banners.notReady` để sau F19.

Cùng lượt đẩy: CLAUDE.md ghi quyết định ở lại NestJS 11 tới hết capstone (`df1bec2e`,
user chốt 29/09).

Test mới: 1 ca contract (N và N+1 cho cả ba cột) và 4 ca int:
- thư viện bỏ video;
- `setPhotos` từ chối publicId chỉ có video;
- nhãn nguồn là `CATALOG` khi publicId chỉ trùng một video;
- metadata vượt INT4 ra 400.

Ba ca đỏ trước khi vá. Ca nhãn nguồn viết sau, nên kiểm bằng đột biến. Cả 7 đột biến
đều chết.

**Review findings:** không mở vòng review riêng — hai mục này đã được vòng review F18
kiểm chứng.

Tests after: Vitest **4684** (web 1576, admin 1438, api 1005, contract 560, core 46,
ui 23, tokens 18, i18n 18), int **702 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-29 — Merge F18 lên main (`a354c74b`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F18" và "F18 ảnh tour".
Entry này chỉ ghi sự kiện merge, vì hai entry kia viết TRƯỚC merge nên chưa mang
hash.

Nhánh `feat/p4e-3b-tour-photos` rebase lên `fc397c32` rồi fast-forward: 29 commit —
14 của đợt thi công, 15 của vòng review. Từ lúc tách nhánh, `main` đã nhận nhánh
sidebar admin (bốn commit, 28/09) và hai commit tài liệu F19 chưa push. Một xung đột ở
CHANGELOG: entry sidebar và entry F18 cùng chen vào đầu file; gỡ bằng cách đặt entry
F18 lên trên, cả hai giữ nguyên văn.

Gate chạy lại trên đỉnh mới, vì code sidebar chưa từng chạy chung với F18. Lượt đầu
đỏ một ca của hộp thư viện: ca ấy tìm option của ô chọn địa danh ĐỒNG BỘ ngay sau khi
mở, trong khi popup của Select mở bất đồng bộ. Chạy riêng thì xanh 5/5, và mọi spec
khác trong repo đều chờ bằng `findByRole`. Vá ở `a354c74b`; lượt hai xanh đủ năm bước.

Cùng lượt đẩy có ADR-0049, spec và plan F19 (khu sửa tour dạng thanh bước), chỉ là
tài liệu. Không migration, không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay F18 trên production theo spec §5 sau khi Vercel và Render
deploy xong (mục CÒN TREO của entry vòng review); đưa prompt thi công F19 cho một
session khác.

Tests after: Vitest **4683** (web 1576, admin 1438, api 1005, contract 559, core 46,
ui 23, tokens 18, i18n 18), int **698 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-29 — Vòng review F18: 15 phát hiện, vá cả 15 (nhánh `feat/p4e-3b-tour-photos`)

Review chạy TRƯỚC merge, ở mức cao nhất: nhiều góc tìm độc lập, bảy nhóm agent kiểm
chứng từng ứng viên, rồi một lượt quét sót. Kết quả: 15 phát hiện đáng vá (1 Cao,
8 Vừa, 6 Thấp), vá cả 15 trên nhánh; ba ứng viên bị bác; các mục nhỏ còn lại (dọn
code, hiệu năng, nợ) ghi sang open-items G12–G17, vì user chưa chốt có làm trong nhánh
này không. Dữ liệu prod đo bằng SQL chỉ đọc (29/09): 29/29 tour đang bán có ảnh bìa,
nên điều kiện bán mới của F18 không làm tụt tour nào.

**Mức Cao.**

1. **Khe deploy làm mất sạch ảnh thật** (`1d0a2343`). Admin (Vercel) lên trước API
   (Render) thì `fetchAdminTour` lùi `photos` về `[]` mà vẫn giữ `version`; `setPhotos`
   thay trọn danh sách, nên thêm ảnh rồi lưu sau khi API lên là xoá hết ảnh cũ, kể cả
   ảnh bìa gốc không chọn lại được. Object lùi nay mang dấu "chưa biết ảnh"
   (`hasKnownPhotos`), tab Photos hiện câu mời tải lại thay cho form. Bốn lệnh ghi của
   F17 và `setPhotos` đi qua cùng lớp lùi, nên khung readiness hết báo sai "A cover
   photo" giữa hai lượt refresh.

**Mức Vừa.**

2. **Gõ số ngày khổng lồ làm treo tab Details** (`1c9ed1c7`). `tourReadiness` lặp theo
   số ngày, còn phép chiếu chạy trước kiểm trần 1–30 (cả với tour tắt bán): gõ
   `1000000000` rồi Save là tab treo hoặc sập, mất chữ chưa lưu. Nay chỉ chiếu với số
   ngày đã qua kiểm khoảng.
3. **Thả file hay Retry lúc đang Save làm mất ảnh vừa tải** (`97b0f8cd`): lượt adopt sau
   khi lưu ghi đè danh sách. Đang lưu thì hai đường ấy báo "Wait for the save to finish,
   then add more photos."
4. **Ảnh bìa gốc mang nhãn sai** (`a0fa6810`, `7926d5c9`; ADR-0048 AMEND 1, phương án
   (a) user chọn). 29 ảnh bìa catalog không có dòng `DESTINATION` nên không nằm trong hộp
   thư viện, mà vẫn ghi "From the library": admin tưởng gỡ ra còn chọn lại được. Nay là
   nguồn thứ ba `CATALOG`: dòng nguồn mở đầu bằng "Catalogue photo", kèm ghi công nếu
   có, và kết bằng "Can’t be added back once removed."; `get` hỏi thêm một câu để phân
   loại. Luật ghi của `setPhotos` không đổi.
5. **Chọn file lần hai trong lúc chờ ký vượt trần 30 ảnh** (`97b0f8cd`). Lượt chọn kế
   thấy sức chứa cũ; lúc lưu server trả lỗi schema kèm câu nhắc "payment provider". Dòng
   tải nay giữ chỗ trước khi ký, và form tự kiểm trần 30 cùng ảnh trùng trước khi gửi.
6. **Hộp thư viện giữ lựa chọn qua Cancel, lần mở sau Add vượt trần** (`3dac07e6`). Đóng
   hộp là xoá lựa chọn; Add chỉ gửi ảnh chưa có trong tour và kẹp theo chỗ trống.
7. **Rời tab lúc đang tải không hỏi lại, file vẫn tải ngầm** (`97b0f8cd`).
   `EditorFormFrame` nhận `busy`: còn file đang tải là trang có thay đổi chưa lưu. Rời
   hẳn thì huỷ lượt tải và hàng đợi (`AbortController`).
8. **Hai script `media:*` đè ảnh tour admin đã sửa** (`3098334a`). `media:alt` chỉ lấp
   alt còn trống ở dòng `TOUR`; `media:upload` bỏ qua hẳn tour đã có dòng ảnh và chặn
   Supabase trừ khi có cờ `--toi-biet-day-la-production`. DB mới dựng vẫn được lấp như
   cũ vì seed không ghi `media_assets`. Lệnh "không chạy lại" ở open-items gỡ bỏ.
9. **`seed:verify` không canh tour đang bán thiếu ảnh bìa** (`09b1754c`): thêm bất biến
   (chỉ kiểm khi DB đã có ảnh tour) và cảnh báo riêng cho DB trần, nơi lưu Details hay
   Itinerary của tour đang bán bị 409.

**Mức Thấp.**

10. **Lệnh ký ném làm dòng tải kẹt, khoá Save mãi** (`97b0f8cd`). Ném coi như lỗi chung:
    file vừa chọn rút khỏi danh sách kèm lý do, Retry ký hỏng trả dòng về Failed. XHR
    có thêm hạn giờ 5 phút.
11. **Hộp thư viện kẹt "Loading…" khi action ném, và nói một câu cho mọi mã**
    (`3dac07e6`). Nay ném coi như lỗi chung kèm Try again; hết phiên hay mất quyền nói
    đúng mã và không mời thử lại.
12. **Tiêu điểm rơi về `<body>` sau Retry hay Remove** (`97b0f8cd`). Retry chuyển tiêu
    điểm sang thanh tiến độ, xong thì sang ô alt, hỏng thì về nút Retry; Remove sang dòng
    hỏng kế, hết thì về nút Upload photos.
13. **Ba câu copy hứa điều code không làm** (`b3abe0c3`). PHOTO_NOT_ALLOWED thôi hứa
    Reload (tải lại cùng phiên bản không bỏ được ảnh hỏng) mà bảo gỡ ảnh thư viện vừa
    thêm, và kho ảnh tải lại ở lần mở hộp sau; câu "không vừa" nói thêm file đang tải
    hay tải hỏng cũng chiếm chỗ; hộp thư viện thôi hứa in ghi công. Kèm câu
    `INVALID_INPUT` chung của admin: bỏ "payment provider" lạc đề (có từ F17, F18 làm
    chạm tới được).
14. **Nghiệm thu CSP dời ra sau merge, trần ký lô trích sai** (`88c7e51a`). ADR-0038
    AMEND 5 từng hẹn DevTools trên production. Đã làm ở local trên bản build của admin:
    `fetch` tới `api.cloudinary.com` đi qua (HTTP 400 vì form rỗng, không tạo asset),
    origin ngoài danh sách bị chặn kèm đúng một vi phạm `connect-src`. Không tải file thật
    vì `.env.local` dùng chung cloud với production; lượt thử tay trên prod giữ làm lớp
    thứ hai. Route admin chịu `ADMIN_WRITE_THROTTLE` 60/60s chứ không phải 20/60s: sửa ở
    ADR-0048 §4 (kèm input thật `{ id, count }`), JSDoc contract, spec §2c. Câu cũ trong
    entry F18 ngay dưới giữ nguyên vì entry là bất biến.
15. **Test xanh giả** (`dd156b30`, `1d0a2343`). Ca int "31 ảnh" dùng publicId không
    nguồn nào nhận, nên bỏ `.max(30)` vẫn ra 400; nay 31 ảnh tải lên hợp lệ và khẳng
    định `BAD_REQUEST`. Thêm ca `photos: []` qua `fetchAdminTour` giữ `cover: false`. Gate
    cuối vòng bắt thêm một ca contract còn khẳng định nguồn chỉ có hai giá trị
    (`2955e313`).

**Đột biến.** Ghi được 37 đột biến trên các ca mới và chỗ vá, 34 cái chết ngay. Hai cái
sống lúc đầu, đã giết bằng ca thêm: `.slice(0, capacity)` của hộp thư viện (ca "sức chứa
co lại giữa lúc hộp mở") và tiêu điểm về Retry khi Retry ký hỏng (`fbf73fbf`). Một cái
tương đương: bỏ `if (signal.aborted) return` sau khi ký không đổi gì, vì
`runWithConcurrency` và `uploadPhoto` đã tự dừng khi lượt tải bị huỷ.

**Ba ứng viên bị bác.** Tiêu đề trang admin viết literal (khuôn chung toàn repo); ghi
công bốn cột bị thiếu khi chép từ thư viện (chép đủ, int test đã chốt); luật "không dọn
ảnh thư viện" nằm ở nơi gọi (hôm nay không phải lỗi, ghi thành G16).

**Không có việc hạ tầng.** Không migration, không env, không đổi thiết lập Cloudinary.

CÒN TREO:

- Merge F18: rebase lên `main`, gồm hai commit docs F19 đang nằm ở `main` local
  (`36e88d87`, `fc397c32`) — chờ user xác nhận.
- Thử tay F18 trên production theo spec §5: tải ảnh thật mà console sạch, log
  `csp-report` không có dòng nào cho `api.cloudinary.com`; thêm ba điều jsdom không canh
  được — hộp hỏi lại khi rời tab lúc đang tải, kéo thả file, tiêu điểm sau Retry.

Tests after: Vitest **4664** (web 1576, admin 1419, api 1005, contract 559, core 46,
ui 23, tokens 18, i18n 18), int **698 ở 45 file**, jest mobile 159 và mobile-ui 86. Ca
mới: admin 34, api 1; một ca contract và ba ca int sửa lại. Gate đầy đủ chạy tách bước
có watchdog, 12,2 phút: commit trống thấp nhất 5,47 GB, pagefile đứng yên 2560 MB.
Commit cuối `fbf73fbf` chỉ thêm một khẳng định vào spec tab Photos, chạy lại riêng file
ấy (23/23).

## 2026-09-28 — F18 ảnh tour (nhánh `feat/p4e-3b-tour-photos`)

Tab Photos trong khu làm việc tour: tải ảnh lên thẳng Cloudinary (ký theo lô),
lấy ảnh từ kho ảnh địa danh kèm ghi công, sắp thứ tự, chọn ảnh bìa (ảnh đầu), sửa
alt. Quyết định ở ADR-0048: một danh sách có thứ tự trong `media_assets`, một lệnh
`setPhotos` thay trọn và khoá phiên bản, chỉ ảnh tự tải lên mới vào lại hàng dọn.
Readiness thêm điều kiện ảnh bìa; luật "tour đang bán thì luôn đủ" phía admin suy
từ `projectedReadiness` (đóng G11). Xoá tour dọn luôn dòng ảnh. Không migration,
không sửa web.

**Tab Photos** (`/tours/[slug]/photos`, ngay sau Details). Mỗi dòng: thumbnail
`f_auto,q_auto,w_320` không cắt cúp (khung 3:2 do CSS), ô Alt text bắt buộc, dòng
nguồn "Uploaded" hoặc "From the library · Photo: tác giả, giấy phép". Dòng đầu mang
nhãn Cover; dòng khác có Make cover — ảnh lên đầu, tiêu điểm vào ô alt của nó. Gỡ
dòng cuối trả tiêu điểm về nút Upload photos. Kit `ListEditor` cho phép không có nút
thêm và nhận `emptyFocus`; `EditorFormFrame` nhận `blockedNote`.

**Tải lên.** Nút Upload photos hoặc kéo thả vào vùng danh sách. File sai đuôi, quá
10 MB hay vượt sức chứa 30 ảnh bị loại kèm lý do; phần còn lại ký MỘT lần cho cả lô
(`admin.tours.signPhotoUploads`, một request dưới trần 20/60s của ADR-0037), tải song
song tối đa ba file bằng XHR có tiến độ. Ảnh tải xong nối vào cuối, alt để trống;
hỏng thì Retry ký lại một chữ ký mới, hoặc Remove. Save khoá khi còn file đang tải
("Waiting for N uploads to finish."). URL xem trước thu hồi khi dòng tải xong hay bị
gỡ. CSP admin mở `connect-src https://api.cloudinary.com` — AMEND 5 của ADR-0038, viết
trong nhánh này theo lựa chọn của user (luật của ADR-0038: origin mới phải qua AMEND).

**Hộp Add from library.** Kho ảnh địa danh tải một lần (`admin.tours.photoLibrary`,
route riêng `/api/admin/tour-photo-library`), mặc định bày ảnh các địa danh tour đi
qua, ô chọn đổi sang từng địa danh kể cả địa danh đang ẩn. Ảnh đã có hiện "Added" và
khoá; không tích quá sức chứa; ảnh nằm ở hai địa danh chỉ bày và gửi một lần. Alt
chép từ ảnh gốc, sửa được.

**API.** `setPhotos` trong một transaction: giành hàng tour → phân loại từng ảnh vào
một trong ba nguồn (dòng đang có của tour giữ nguyên metadata và bốn cột ghi công;
ảnh tải lên trong `<root>/tours/<tourId>/` kèm metadata Cloudinary; dòng
`DESTINATION` — metadata và ghi công chép ở server) → ngoài ba nguồn là 400
`PHOTO_NOT_ALLOWED` → thay dòng → requeue ảnh tải lên bị gỡ, cùng transaction → kiểm
"vẫn đủ để bán". `admin.tours.get` trả `photos` theo thứ tự hiển thị. `delete` thành
một transaction dọn luôn dòng ảnh và requeue ảnh tải lên. Một cổng ký tự
`MediaPublicIdSchema` cho mọi publicId client gửi — ảnh review dùng chính nó.

**Readiness và G11.** `TourReadiness.cover`: `setPublished(true)` và mọi lệnh sửa của
tour đang bán chặn tour mất ảnh bìa ("a cover photo"). Khung readiness có mục "A
cover photo" trỏ tới tab Photos; câu "Ready to sell", câu hộp New tour và câu hộp xoá
tour sửa cho nói đúng. `onSaleShortfalls` là nguồn duy nhất của luật "tour đang bán"
ở Details, Itinerary, Photos, chỉ đếm chỗ do chính lệnh ấy làm hỏng. Hộp xoá tour có
thêm hàng Photos.

**Khe deploy:** `fetchAdminTour` lùi `photos` về `[]` và `readiness.cover` về `true`
khi API cũ chưa trả hai field ấy.

**Chỗ lệch plan** (không chạm spec): fixture plan bỏ sót — `DETAIL` trong
`admin-tours.spec.ts` của contract thêm `cover` và `photos`; ca "heroUrl… chưa có ảnh
trả null" của `admin-catalog.int.spec.ts` đổi vế null từ ALPHA (nay có ảnh bìa) sang
GAMMA; `proxy.spec.ts` so chuỗi `connect-src` nguyên văn. Plan gọi
`validateDetailsForm`, tên thật là `validateTourDetailsForm`. Thêm ca đối chiếu hai
codec của tab Photos với `errorMap` của contract (khuôn có sẵn ở
`tour-editor-write.spec.ts`). Hộp thư viện `showCloseButton={false}` như mọi hộp
thoại admin. JSDoc đầu `security-headers.ts` của admin và JSDoc `delete` sửa cho đúng.
Bước unit của gate chạy `--concurrency=1` từ Task 8: lượt gate Task 7 đẩy commit trống
xuống 1,6 GB, sát ngưỡng dừng 1,5 GB của watchdog.

**Giới hạn đã biết:** ảnh bìa catalog của 29 tour không nằm trong kho địa danh — gỡ
rồi lưu là không chọn lại được từ hộp thư viện (spec §8). `capacity` của tab Photos
đọc theo lượt render: hai lượt thả file liên tiếp trước khi render lại có thể vượt 30
ảnh, và lúc lưu server trả lỗi schema.

**Review findings:** chưa review — session gốc review trước merge.

**Việc hạ tầng:** không có — không migration, không env, không đổi thiết lập
Cloudinary. Thử tay trên production theo spec §5 gồm cả nghiệm thu CSP bằng DevTools
(ADR-0038, Hệ quả).

Tests after: Vitest **4629** (web 1576, admin 1385, api 1004, contract 559, core 46,
ui 23, tokens 18, i18n 18), int **698 ở 45 file**, jest mobile 159 và mobile-ui 86.
Ca mới: contract 12, api 11, admin 48, int 20. Mỗi ca mới thử đột biến; chín đột biến
sống sót với fixture ban đầu (năm cái plan hứa sẽ đỏ) và đều được giết bằng cách siết
fixture hoặc thêm ca: bỏ `orderTourPhotos` (ảnh bìa fixture có `sortOrder` 0), đảo
thứ tự nguồn của `planTourPhotos`, `requeue` ngoài transaction (thêm ca "lệnh hỏng
sau khi gỡ ảnh tải lên"), bỏ vế `current.cover` của G11, luôn vẽ nút thêm của kit,
bỏ điều kiện `blockedNote` ở `onSubmit`, ký theo số file chọn thay vì số file nhận,
Retry dùng chữ ký cũ, bỏ `dedupe` của hộp thư viện.

## 2026-09-28 — Sidebar admin thu gọn thành cột icon (nhánh `fix/admin-sidebar-icon-rail`)

Góp ý giao diện admin: đóng sidebar là nó trượt mất hẳn, trang không còn nút điều
hướng nào. Giờ thu gọn thành cột icon theo mẫu application-shell-26 của shadcnstudio
(user duyệt demo, dặn giữ vạch ngăn giữa các nhóm). Chỉ đổi giao diện admin và thêm
hai chuỗi i18n; API và contract không đổi.

- **Cột icon thay cho trượt mất** (`d6a567ea`). `collapsible="offcanvas"` đổi thành
  `"icon"`: thu gọn còn cột rộng 66px (3rem cộng khung inset) giữ logo, icon từng
  trang và avatar. Điện thoại vẫn là ngăn kéo: component tự đổi sang Sheet dưới
  768px.
- **Tooltip là nhãn của icon.** Rê vào icon thì tooltip bên phải nói tên trang, bật
  ngay không trễ; logo nói "Nexora — Dashboard", avatar nói tên người đang đăng
  nhập. Sidebar mở thì không có tooltip, vì nhãn đã nằm cạnh icon.
- **Mục chưa mở nói được vì sao không bấm được.** Nút `disabled` không nhận chuột lẫn
  tiêu điểm, nên ở cột icon tooltip "Posts · Soon" không bao giờ hiện. Đổi sang
  `aria-disabled`: rê chuột và Tab tới được, bấm vẫn không làm gì, con trỏ
  `not-allowed`, vẫn mờ như cũ.
- **Trang đang mở có ô sáng** và `aria-current="page"`. Trước đây không mục nào sáng;
  ở cột icon đó là dấu duy nhất cho biết đang ở đâu. `isActiveNav` bỏ query của href
  (`/reviews?status=pending`), trang con sáng mục cha (`/tours/<slug>/costs` sáng
  Tours), Dashboard chỉ sáng ở đúng `/`.
- **Vạch ngăn giữa ba nhóm** khi thu gọn, vì nhãn nhóm ẩn ở cột icon.
- **Nút Inbox cạnh Quick Create** ẩn hẳn ở cột icon thay vì `opacity-0`: nút trong
  suốt vẫn nhận Tab.
- **Giữ trạng thái khi chuyển trang.** Mỗi trang dựng lại `AdminShell` với
  `SidebarProvider` mặc định mở, nên thu gọn rồi bấm sang trang khác là sidebar bung
  ra. Shell giờ đọc cookie `sidebar_state` (provider tự ghi mỗi lần đổi) lúc dựng ở
  server. Trang Dashboard trước đây tự dựng một bản khung trùng 1:1, nay dùng chung
  `AdminShell` (`7851d236`) để chỉ còn một chỗ đọc cookie.

**Review findings:** không mở vòng review riêng; test viết trước. Rà lại trước khi
merge thêm hai ca canh (`5c2c5595`): tooltip phải bật NGAY (ca cũ dùng `findBy`, chờ
tới 1s nên không phân biệt được với trễ 600ms mặc định của Base UI khi thiếu
`TooltipProvider`), và Ctrl+B ghi đúng cookie mà shell đọc lại — tên cookie chép tay
vì gói ui không export hằng của nó. 17 đột biến đều làm test đỏ: `offcanvas` thay
`icon`, bỏ tooltip logo, bỏ `TooltipProvider`, tooltip avatar luôn ẩn, bỏ tooltip mục
đã mở, mục Soon về `disabled`, bỏ `isActive`, bỏ `aria-current`, Inbox về
`opacity-0`, vạch ngăn cả nhóm đầu, khớp tiền tố trần (`/tours-archive` sáng Tours),
giữ query của href, tooltip Soon mất chữ "Soon", giá trị cookie lạ thành thu gọn,
đổi tên cookie ở admin, đổi tên cookie ở gói ui, shell không đọc cookie. Bố cục jsdom
không đo được, nên soi bằng CSS của bản build admin (DOM từ jsdom đổ ra trang tĩnh):
thu gọn rộng 66px, logo hiện đủ, vạch 1px ở nhóm hai và ba, Inbox `display: none`,
mục Soon mờ 0.5 với `pointer-events: auto` và con trỏ `not-allowed`. Trạng thái mở
giữ nguyên, chỉ thêm ô sáng ở trang đang mở.

**Không có việc hạ tầng:** không migration, không env; API không đổi code.

Tests after: Vitest **4577** (web 1576, admin 1356, api 993, contract 547, core 46,
ui 23, tokens 18, i18n 18), jest mobile 159 và mobile-ui 86. Int không chạy ở máy:
session F18 đang dùng chung `tourism_test`, và nhánh không chạm API — CI chạy sau
push.

## 2026-09-28 — Góp ý giao diện của lượt thử tay F17 (nhánh `fix/f17-thu-tay-gop-y`)

Đóng mục CÒN TREO của entry thử tay F17 ngay dưới, cộng các góp ý user gửi thêm sau
lượt thử (tab Details, FAQ & policies, Costs). Toàn bộ là giao diện, không đổi API
hay contract.

Ba góp ý ghi trong lượt thử:

- **Ngày một điểm dừng in "09:00–09:00"** (`62c3aec3`). Chuỗi `stopsSummary` của
  i18n in khoảng đầu–cuối kể cả khi hai mốc trùng nhau; giờ mốc đầu trùng mốc cuối
  thì in một giờ ("Day 2 · 1 stop · 09:00"). Sửa ở chuỗi nên đúng cả ngày nhiều
  điểm dừng cùng một giờ.
- **Hai thứ tự chính sách trên một trang** (`51aef65d`). Hàng ô dưới nút đặt chỗ
  giờ đi qua cùng `orderPolicies` với tab Good to know (huỷ → thanh toán → chung).
  Sắp xếp ổn định nên ô của mỗi loại vẫn lấy chính sách admin để đầu.
- **Câu sàn số khách hiện hai lần** (`38dfa282`). Ô Max group size có lỗi thì gợi
  ý sàn ẩn, lỗi nói một mình; hết lỗi thì gợi ý quay lại. Chọn luật "có lỗi thì ẩn
  gợi ý" thay vì "ẩn khi trùng chữ": lỗi từ server có thể mang sàn mới hơn con số
  trong gợi ý đang cầm, và hai câu lệch số còn tệ hơn hai câu trùng chữ.

Góp ý gửi thêm:

- **Nhãn và ô "Base price (USD)" tụt xuống** (`6a5442b6`). Nguyên nhân không phải
  thiếu chú thích: mỗi ô (`FormField`) là một lưới; hàng ba cột kéo ô Base price cao
  bằng hai ô có dòng gợi ý, và lưới bên trong chia phần dư cho nhãn và ô nhập. Kit
  thêm `content-start` nên mọi hàng nhiều cột của admin thẳng mép, kể cả khi một ô
  hiện lỗi đỏ còn ô bên cạnh thì không.
- **Cụm nút ↑ ↓ và thùng rác nằm ngang nhãn** ở dòng FAQ, chính sách, chi phí
  (`67d16115`), và thùng rác dòng điểm đến lệch lên trên nút Primary (`2b595c87`).
  Bốn danh sách dùng chung `ListEditor`, cụm nút canh mép trên của dòng mà dòng mở
  đầu bằng nhãn. Kit thêm `labelledRows`: cụm nút hạ 20px (nhãn 14px và khoảng 6px)
  xuống ngang ô nhập đầu tiên. Highlights, Included, Excluded không có nhãn, giữ
  nguyên.
- **Ô tích không nói nó làm gì** (`2b595c87`). Good for và Badges có dòng gợi ý dưới
  nhóm nói tác động trên web, đọc từ code web: Good for chỉ là thẻ "Good for" ở tab
  Overview (không tích ô nào thì thẻ ẩn); Badges là chip cạnh giá đầu trang tour, tối
  đa hai, còn một khi giá đang hiện có giảm, phần dư gộp "+N". Badges có thêm chú
  thích nghĩa dưới từng ô — nghĩa là quy ước biên tập, hệ thống không tự tính;
  "Limited offer" chỉ dùng khi có giảm giá thật, bám luật giá gạch 15/09. Featured
  cũng có câu chú thích: chip "Featured" trên card trang /tours khi card không có
  giảm giá, và bộ lọc "Featured trips". Mọi câu gắn với ô qua `aria-describedby`.

**Review findings:** không mở vòng review riêng — mỗi thay đổi có test đỏ trước khi
sửa. Đột biến ở ba bản vá đầu: bỏ nhánh trùng giờ, bỏ `orderPolicies`, bỏ điều kiện
ẩn gợi ý, đảo điều kiện ấy — cả bốn đều làm test mới đỏ. Sáu đột biến ở phần gửi
thêm cũng chết: bỏ `content-start`, đổi `pt-5` thành `pt-4`, bỏ `labelledRows` ở form
chi phí, bỏ `aria-describedby` ở ô tích, bỏ nó ở nhóm, gắn chú thích cho cả các ô
Good for. Bố cục jsdom không đo được,
nên soi bằng trình duyệt: dựng ba form trong jsdom, đổ DOM ra trang tĩnh kèm CSS của
bản build admin, khổ 1400px. Hàng Days, Maximum group size, Base price: ba nhãn cùng
mép, ba ô nhập cùng mép; gỡ `content-start` ngay trên trang thì ô Base price tụt lại
đúng 11px như ảnh user gửi. Cụm nút của năm loại dòng lệch ô nhập đầu tiên 0px.

**Không có việc hạ tầng:** không migration, không env; API không đổi code.

Tests after: Vitest **4558** (web 1576, admin 1337, api 993, contract 547, core 46,
ui 23, tokens 18, i18n 18), int **678 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-28 — Thử tay F17 trên production (`e19d4ccc`): 8/8 bước đạt

Lượt thử từng bước trên `admin.nexora-travel.agency` và `www.nexora-travel.agency`
sau khi F17, vòng vá review và bản vá seed cùng lên `main`, bằng một tour thử tạo
mới ở bước 1 rồi xoá ở bước 8. Mỗi bước đối chiếu DB prod bằng câu đọc; cuối lượt
DB về đúng trạng thái trước khi thử (29 tour, cả 29 đang bán, không chuyến mồ côi).

1. **New tour:** slug tự điền theo tên; tour sinh ra tắt bán, một điểm chính;
   khung readiness liệt kê tóm tắt và lịch trình ngày 1–2; câu mới của hộp New tour.
2. **Details:** nút Save mờ khi chưa sửa; phím mũi tên ở nút xoá và ô chọn của dòng
   điểm đến không đổi điểm chính; bấm chữ "Primary" và "Featured" chọn được; lưu
   xong gõ tiếp ngay không mất chữ (chữ ấy vào DB ở lần lưu sau).
3. **Itinerary rồi bật bán:** lưu rồi bấm ngay sang Details, khung readiness chuyển
   "Ready to sell" với câu mới và công tắc mở khoá; bật bán; trang web hiện tour với
   khung ảnh giữ chỗ và "09:00" ở cột giờ riêng.
4. **FAQ, chính sách, chi phí:** trần 999,999.99 chặn ở dòng chi phí; Totals đúng
   ($18.50 mỗi khách, biên $30.50); trang web một ô mỗi loại chính sách (hai
   General và một Booking ra ba ô kể cả ô huỷ), tab Good to know đủ bốn thẻ.
5. **Dời dòng và rời trang:** dời dòng highlight bằng bàn phím, tiêu điểm đi theo
   nút ↓ của dòng vừa dời; đổi tab khi chưa lưu hiện "Discard unsaved changes?";
   F5 hiện hộp "Leave site?" của trình duyệt.
6. **Hai tab cùng sửa:** lệnh lưu cũ ra dải STALE, chữ đang gõ còn nguyên; Reload
   nạp bản của tab kia.
7. **Departures:** trần giá ở form chuyến; số ngày khoá khi có chuyến; hạ số khách
   dưới số ghế bị chặn bằng câu mới, nâng thì lưu được; giá vốn tính lại $16.83;
   chuyến tạo tay chụp giá vốn cố định 100.00.
8. **Xoá tour:** hộp xác nhận kể đủ thứ mất theo (1 chuyến, lịch trình, FAQ…); xoá
   xong trang tour trên web trả 404.

Ba điều jsdom không canh được — tiêu điểm sau khi dời dòng, hộp `beforeunload`,
Reload sau `STALE_TOUR` — đều đạt trong trình duyệt thật.

CÒN TREO — ba góp ý giao diện nhỏ, user chọn vá ngay ở một nhánh riêng:

- Web: ngày có đúng một điểm dừng hiện "1 stop · 09:00–09:00" ở dòng tóm tắt.
- Web: cùng một trang, hàng ô chính sách theo thứ tự admin nhập còn tab Good to
  know xếp theo loại.
- Admin: hạ số khách dưới sàn thì câu "At least 10 — …" hiện hai lần (gợi ý xám và
  lỗi đỏ trùng chữ).

## 2026-09-28 — Seed thay nguyên bảng con của tour fixture: đóng lỗi mức Cao cuối cùng của vòng review F17 (nhánh `fix/seed-bang-con-f17`)

Lỗi 1 của vòng review F17, tách nhánh vì chỉ nổ ở lượt seed lại 03/11. Khu làm
việc F17 thay nguyên FAQ, chính sách và dòng chi phí bằng hàng id MỚI, còn seed
upsert hay `createMany({ skipDuplicates })` theo id fixture: sửa một tour seed
rồi seed lại là bản fixture nằm CẠNH bản admin — FAQ và chính sách in hai lần
trên trang tour, dòng chi phí nhân đôi (giá vốn chụp vào booking và chuyến mới
gần gấp đôi), bỏ điểm chính fixture là tour mang hai điểm chính (tab Details trả
400). Seed vẫn báo thành công, `seed:verify` không bắt.

**Seed.** Năm bảng con của 29 tour fixture (điểm đến, lịch trình, FAQ, chính
sách, dòng chi phí) xoá rồi chèn lại trong MỘT transaction dạng mảng. Chỉ lọc
theo id tour fixture, nên tour tạo tay không bị đụng; không bảng nào có khoá
ngoại trỏ vào năm bảng này. Bước xoá chính sách CANCELLATION riêng nay thừa nên
gỡ. `costPrice` tính lại vô điều kiện (bản cũ chỉ điền chỗ trống, nên giữ giá
vốn tính từ dòng chi phí của admin mà bảng không còn); `fixedCostAmount` của
chuyến vẫn chỉ điền chỗ trống vì là bản chụp. Upsert tour thôi ghi lùi
`updatedAt` về mốc fixture — phiên bản của khu làm việc F17 không lùi.

**`seed:verify` thêm năm bất biến:** số điểm chính khác 1, FAQ trùng câu hỏi,
chính sách trùng loại và tiêu đề, dòng chi phí trùng nhãn, `cost_price` lệch
công thức dẫn xuất.

**Tập dượt trên DB Docker riêng** (seed → sửa một tour như admin qua bốn tab →
seed lại → verify): seed cũ ra 13 vi phạm, tour bị sửa mang FAQ 5→10, chính
sách 2→4, dòng chi phí 4→8, hai điểm chính, giá vốn của admin; seed mới ra 0
vi phạm và tour về đúng fixture; chạy lần ba vẫn ổn; một tour tạo tay còn
nguyên cùng FAQ và điểm đến của nó. Bước `data:reset` không nằm trong lượt tập
dượt: script đòi tài khoản admin mang id của prod, và nó giữ nguyên năm bảng
con nên kết quả không đổi.

**Spec 2026-09-24 §8 sửa lại** — bản đầu sai cả hai vế: bước reset GIỮ bảng
`tours`, nên tour tạo tay còn sống (mất chuyến, booking, đánh giá); tour seed bị
ghi đè trọn. Mục khe deploy ghi thêm rằng tab Departures nay sống qua khe ấy.

Chặn tạm ghi ở vòng review (thử tay chỉ bằng tour mới tạo) không còn cần: lượt
seed 03/11 sẽ ghi đè mọi chỉnh sửa trên tour seed về fixture. Việc còn lại trước
lượt ấy: gỡ bán hoặc xoá tour thử tạo bằng F17 (open-items).

**Không có việc hạ tầng.** Seed chỉ chạy tay ở lượt 03/11; không migration.

Tests after: Vitest **4546** (không đổi — seed không có unit test riêng ngoài 456
ca fixture của `prisma/`), int **678 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-28 — Merge F17 lên main (`9b284e9b`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F17" và "F17 tạo và
sửa tour". Entry này chỉ ghi sự kiện merge, vì hai entry kia viết TRƯỚC merge
nên chưa mang hash.

Nhánh `feat/p4e-3a-tour-editor` rebase lên `8a6390c4` (bản dọn `payment_events`
của `bookings.int.spec`, từ một session riêng) rồi fast-forward: 25 commit — 13
của đợt thi công, 12 của vòng review. Không xung đột. Gate đủ năm bước xanh
trước rebase; int chạy lại xanh trên đỉnh mới (678 ở 45 file). Không migration,
không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay F17 trên production bằng tour MỚI tạo, sau khi Vercel và
Render deploy xong; nhánh vá seed trước lượt seed lại 03/11 (open-items).

Tests after: Vitest **4546** (web 1575, admin 1328, api 993, contract 547,
core 46, ui 23, tokens 18, i18n 16), int **678 ở 45 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-28 — Vòng review F17: 24 lỗi thật, vá 23, lỗi seed tách nhánh riêng (nhánh `feat/p4e-3a-tour-editor`)

Review chạy TRƯỚC merge, ở mức cao nhất: mười một góc tìm độc lập, mười nhóm
agent kiểm chứng từng ứng viên, cộng một lượt quét sót các vùng chưa ai soi
(phân quyền, tour chưa có ảnh bật bán, khoá ngoại khi xoá, đổi slug, server
actions — đều sạch). Kết quả: 24 lỗi thật (2 Cao, 8 Vừa, 14 Thấp), 7 ứng viên
bị bác, 3 mục ghi sang open-items (G9–G11). Vá 23 lỗi trên nhánh; lỗi còn lại
(mức Cao, ở seed) chỉ nổ ở lượt seed lại 03/11 nên tách nhánh riêng làm ngay
sau merge — chi tiết và lệnh chặn tạm ở open-items "Trước lượt seed lại 03/11".

**Hai lỗi mức Cao.**

1. **Seed lại nhân đôi bảng con của tour đã sửa** (CHƯA vá ở nhánh này). Khu
   làm việc thay nguyên FAQ, chính sách, dòng chi phí bằng hàng id mới, còn
   seed upsert theo id fixture: seed lại là FAQ và chính sách in hai lần, giá
   vốn chụp vào booking mới gần gấp đôi, tour có thể mang hai điểm chính.
2. **Phím mũi tên tự đổi điểm đến chính.** `RadioGroup` của Base UI bọc cả danh
   sách điểm đến: gốc composite bắt mọi phím mũi tên nổi bọt từ nút xoá hay ô
   chọn, dời tiêu điểm sang một radio và radio tự bấm. Nay mỗi dòng một radio
   gốc trong `<label>`, tên đọc-màn-hình mang tên điểm đến ("Primary: Hà Nội").

**Tiền, đặt chỗ và luật tour.**

3. **Tên tour 161–200 ký tự làm mọi booking của tour đó 500** — cột bản chụp
   `bookings.tour_title` chỉ 160. `TOUR_TITLE_MAX` hạ về 160. Mô tả gửi cổng
   thanh toán cắt về 127 byte UTF-8 (trần của PayPal), giữ khoảng ngày.
4. **Trần mọi ô tiền admin gõ tay là 999,999.99** (trần một lần thu của Stripe)
   thay cho trần cột: giá × ghế của `total_amount`, tổng dòng chi phí của
   `cost_price` và `fixed_cost_amount` từng tràn `Decimal(14,2)` thành 500. Một
   luật đóng cả hai đường; admin báo câu riêng khi quá trần.
5. **Xoá tour đúng lúc khách đặt chỗ** trả `DEPARTURE_NOT_AVAILABLE` thay vì 500
   (khoá ngoại `P2003` ở câu INSERT booking).
6. **Tạo và sửa chuyến giữ hàng tour `FOR SHARE`** — câu INSERT chỉ lấy
   `KEY SHARE`, nên một chuyến quá trần từng commit đúng lúc tour đang hạ số
   khách. Đóng G8 của open-items, kể cả hai biến thể mà G8 chưa khai.
7. **Sàn số khách chỉ chặn khi HẠ**: dữ liệu đã lệch thì tab Details từng khoá
   cứng, kể cả khi chỉ sửa tên.
8. **Duyệt hay rút review không đẩy `updated_at` của tour** — cột ấy là phiên
   bản của khu làm việc, form đang mở từng dính `STALE_TOUR` giả. Sort công khai
   "updatedAt" nay là lần sửa nội dung gần nhất (ghi ở contract).

**Khu làm việc admin.**

9. **Form không bị dựng lại sau mỗi lần lưu.** Bốn trang từng dựng form với
   `key={detail.version}`: lượt refresh sau lưu gỡ cả form — mất tiêu điểm, mất
   chữ gõ trong khe, Save lần hai ra STALE giả; công tắc On sale refresh sau khi
   tab khác lưu cũng xoá bản sửa dở. `useTourFormState` đón bản server mới ngay
   trong render: form sạch thì nạp, đang sửa thì giữ chữ và hiện dải stale.
10. **Phần đầu theo kịp lần lưu.** Lưu xong bấm ngay sang tab khác thì Next bỏ
    lượt refresh, còn layout không render lại khi đổi tab — khung readiness kẹt
    ở bản cũ. Form nay đẩy bản vừa lưu lên `TourDetailProvider`.
11. **Công tắc ở phần đầu**: `TOUR_NOT_READY` nghĩa là trang đã cũ (câu riêng
    rồi refresh); `NOT_FOUND` về `/tours` thay vì rơi vào trang 404 trần.
12. **Khe deploy**: lượt đọc tour của layout hỏng (admin lên trước API) thì vẫn
    dựng thân tab — tab Departures của F12 sống qua khe ấy.
13. `liveSeatsMax` nhận 0 (DB chỉ canh `>= 0`); slug quá trần trên URL ra 404;
    hộp New tour điều hướng một lần thay vì dựng trang tour mới hai lần.
14. **Nút khoá trông khoá**: `buttonVariants` thêm `aria-disabled:` — nút
    `focusableWhenDisabled` (Save khi chưa sửa, lên/xuống ở mép) từng sáng như
    thường. Lỗi có từ F15, F17 biến nó thành trạng thái thường trực.
15. Danh sách điểm đến bỏ nút dời (bảng không có cột thứ tự); bấm vào chữ
    "Primary" hay "Featured" cũng chọn được; dòng dựng từ server mang key tất
    định (hết lệch id lúc hydrate); Good for và Badges chuẩn hoá thứ tự nên tích
    rồi bỏ tích không còn là "có thay đổi".
16. Copy nói đúng điều server đo: "Ready to sell", hộp New tour, sàn số khách,
    dòng báo tour tắt bán ở tab Departures; JSDoc `tours-publish.ts` lỗi thời.

**Web.**

17. Trang tour chịu được nhiều chính sách cùng loại và câu hỏi trùng nhau: hàng
    ô tin cậy một ô mỗi loại, key theo vị trí.

**Test xanh giả.** Tám đột biến từng sống qua bộ test, nay đều đỏ: bỏ
`deleteMany` chính sách, bỏ `deleteMany` dòng chi phí, bỏ một cột khỏi
`detailsColumns`, tráo hai ghi chú dữ kiện, dời bust vào trong transaction, sàn
chặn cả khi không hạ, cổng bật bán chỉ xét tóm tắt, và bỏ `useReportUnsaved` khỏi
khung form. Thêm ca cho `onFieldError` trả false và xoá điểm chính khi còn ba
dòng, cùng các cặp biên N/N+1 còn thiếu của contract.

**Bảy ứng viên bị bác.** Làm tròn cent từng dòng (mọi đường vào đều ≤ 2 chữ số
lẻ); bật/tắt bán không đẩy `updatedAt` (cố ý); refresh sau lưu (chi phí có chủ
đích); tab Departures đọc tour hai lần (song song, rẻ); `NOT_FOUND` hai nghĩa ở
`updateDetails` (danh mục và điểm đến không xoá được); Enter trong ô một dòng
lưu cả tab (quy ước form admin); seed lùi phiên bản và ghi đè lịch trình (bước
6b đặt lại `now()`, lịch trình giữ bản admin).

**Không có việc hạ tầng.** Không migration, không env, không webhook.

CÒN TREO:

- Nhánh vá seed (lỗi 1) trước lượt seed lại 03/11 — open-items.
- Thử tay F17 trên production bằng tour MỚI tạo, gồm ba điều jsdom không canh
  được (tiêu điểm sau khi dời một dòng, hộp `beforeunload`, Reload sau
  `STALE_TOUR`) và hai điều mới: phím mũi tên ở dòng điểm đến không đổi điểm
  chính; lưu rồi gõ tiếp ngay không mất chữ.

Tests after: Vitest **4546** (web 1575, admin 1328, api 993, contract 547,
core 46, ui 23, tokens 18, i18n 16), int **678 ở 45 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-25 — F17 tạo và sửa tour (nhánh `feat/p4e-3a-tour-editor`)

Admin tạo được tour mới (đang tắt bán), sửa mọi nội dung chữ và số của tour qua
bốn tab của khu làm việc `/tours/[slug]`, bật bán khi tour đủ để bán, và xoá
được tour chưa từng có booking. Quyết định ở ADR-0047: mỗi tab một lệnh ghi,
khối danh sách thay nguyên, một `version` cho cả tour so-và-ghi trong một câu,
`tourReadiness` chặn bật bán. Ba hàm giá vốn dời lên contract, tính trên cent.
Không migration, không sửa web. Mười ba commit (mười hai task, một commit docs),
thi công ở một session riêng theo plan `2026-09-24-p4e-3a-tour-editor.md`.

**Hộp New tour.** Nút ở thanh công cụ bảng `/tours`. Bảy ô: tên, slug (chạy theo
tên bằng `slugifyVietnamese` tới khi admin chạm vào nó; tắt soát chính tả, tự viết
hoa, tự sửa chữ), danh mục và điểm đến chính (ô chọn của kit, mục đã ẩn mang
"(hidden)"), số ngày, số khách tối đa, giá gốc. Tour sinh ra TẮT bán; tạo xong mở
thẳng tab Details của nó. `SLUG_TAKEN` hiện dưới ô slug, hộp giữ nguyên chữ đã gõ.
Danh sách chọn không tải được thì hộp nói vì sao và khoá nút tạo. Tên tour trong
bảng nay là link sang khu làm việc; nút Departures ở cột Actions giữ làm lối tắt.

**Khu làm việc và thanh tab.** Layout `/tours/[slug]` dựng phần đầu dùng chung:
Back to tours · tên tour · công tắc On sale · khung readiness ("Ready to sell"
hoặc "Missing before it can go on sale: …", mỗi mục là link tới đúng ô cần sửa) ·
thanh tab Details / Itinerary / FAQ & policies / Costs / Departures. Màn chuyến
của F12 dời vào dưới layout, bỏ tiêu đề và link Back riêng. Form còn thay đổi chưa
lưu thì bấm tab hay link khác hỏi "Discard unsaved changes?", rời trang thì
`beforeunload` hỏi. Nút Save chỉ sáng khi có thay đổi và khoá bằng
`focusableWhenDisabled`; lưu xong form nhận nguyên tour mới từ response rồi
`router.refresh()` cho phần đầu theo kịp.

**Bốn tab.** Details có ba khung (Basics, Destinations, Selling points): số ngày
khoá khi tour có chuyến; hạ số ngày thì báo trước ngày nào của lịch trình sẽ mất;
số khách tối đa không hạ dưới số ghế lớn nhất của các chuyến chưa xong và chưa
huỷ; điểm đến có nút radio "Primary", luôn đúng một. Itinerary có đủ N thẻ ngày mang `id="day-N"`;
ngày không tiêu đề không được lưu; ô mô tả gợi ý khuôn `09:00 — …` mà trang tour
tách thành cột giờ. FAQ & policies là hai khung sửa danh sách; chính sách huỷ sinh
tự động nên chỉ có một dòng ghi chú. Costs có khung Totals tính NGAY khi gõ bằng
chính ba hàm contract mà API gọi lúc lưu: tổng theo khách, tổng theo chuyến, giá
vốn mỗi khách khi đủ đoàn, biên lời so với giá gốc. Mọi ô chọn là `FormSelect`
của kit.

**Chống ghi đè, và "đang bán thì luôn đủ".** Mỗi lệnh sửa mở đầu bằng MỘT câu
`updateMany` so `updatedAt` với `version` form gửi lên rồi đẩy nó đi (`claimTour`);
phiên bản mới luôn lớn hơn bản cũ ít nhất 1 ms, kể cả khi đồng hồ server lùi
(`nextTourVersion` — có ca int đẩy `updatedAt` ra tương lai). `STALE_TOUR` hiện
dải báo kèm Reload, form giữ chữ đang gõ. Tour đang bán thì `updateDetails` và
`setItinerary` tính lại `tourReadiness` sau khi ghi, trước commit; thiếu là
`TOUR_NOT_READY`, và dải báo liệt kê chỗ thiếu tính từ chính lệnh vừa gửi.

**Công tắc bị khoá khi thiếu.** `setPublished` khoá hàng tour (`FOR UPDATE`), xét
no-op trước, chỉ kiểm readiness ở chiều BẬT, và giữ nguyên `updatedAt` — bật hay
tắt bán không làm form đang mở thành cũ. Công tắc ở phần đầu khu làm việc khoá
chiều bật khi tour chưa đủ, kèm câu "Fill in what is missing to put it on sale.";
gỡ bán không bao giờ bị chặn. Ở bảng `/tours`, `TOUR_NOT_READY` ra toast kèm nút
"Open tour".

**Xoá tour.** Vùng Delete ở cuối tab Details chỉ hiện khi tour chưa từng có
booking. Server gọi thẳng `tour.delete` và để khoá ngoại quyết: `Restrict` của
booking cho `P2003` thành `TOUR_HAS_BOOKINGS` (câu lỗi hiện trong hộp), id không
có cho `P2025` thành `NOT_FOUND`. Hộp xác nhận giọng đỏ kể đúng từng thứ mất theo
(đo trên `schema.prisma`) kèm số chuyến; xoá xong về `/tours`.

**Đường tạo booking đổi chỗ import.** `perPersonTotal`, `perDepartureTotal` và
`derivedCostPrice` dời lên `@tourism/contract`, tính trên cent nguyên. Bản
`Prisma.Decimal` của API chỉ bị xoá SAU khi test đối chiếu chứng minh hai bản ra
cùng ba con số trên cả 29 tour seed. `bookings.service.ts` (`costPerPerson`),
`admin-departures.service.ts` (`fixedCostAmount`) và `seed.ts` (`costPrice`) chỉ
đổi chỗ import, qua bộ chuyển `costItemsOf` (Decimal thành chuỗi hai số lẻ).

**Lệch plan, có lý do** (chi tiết theo từng task ở báo cáo bàn giao):

- Task 2: plan sót chỗ import thứ tư (`prisma/fixtures/catalog/tour-costs.spec.ts`)
  và một comment lỗi thời ở `departure-rules.ts`. User duyệt 24/09: chuyển spec
  sang hàm contract, sửa comment.
- Task 7: plan ghi "ba ca đầu đỏ", nhưng ca gỡ bán và ca no-op vốn xanh với code
  cũ — đó là ca canh hồi quy, đã kiểm bằng đột biến.
- Task 8: `ListEditor` đặt lại tiêu điểm tường minh sau mỗi lần dời (trình duyệt
  bỏ focus của nút bị `insertBefore`), và "ô đầu của dòng mới" tính cả trigger
  `role="combobox"` của `FormSelect`.
- Task 10: spec hook ở `src/lib` không được vitest gom — user duyệt 25/09 thêm glob
  `src/lib/**/*.spec.tsx` vào project dom. `toBeDisabled()` luôn sai với switch
  của Base UI nên kiểm `aria-disabled`. `useSectionSave` chặn lệnh trùng bằng ref
  chứ không bằng state.
- Task 11 và 12: `FormSelect` bắt buộc `placeholder`, nên ba ô luôn có giá trị
  truyền chính nhãn ô; dòng mới mặc định ở mục đầu của mỗi ô chọn; Totals in tiền
  qua `formatAmount` ("$16.83") thay vì số trần; nhóm ô tích dùng `fieldset`
  thay `div role="group"` (Biome `useSemanticElements`).
- Gate: bước int chạy trên DB riêng `tourism_test_f17` bằng config tạm ở
  `apps/api/out/` (session khác dùng `tourism_test` cùng lúc); script tắt API theo
  đúng PID nó dựng.

**Giới hạn đã biết:** nút Back của trình duyệt không hỏi lại khi form còn thay
đổi (chỉ link trong app và `beforeunload` được canh); tạo chuyến và hạ số khách
tối đa chạy cùng lúc có thể để lại một chuyến nhiều ghế hơn số khách tối đa (lệnh
tạo chuyến của F12 không khoá hàng tour — một admin thì không gặp).

**Không có việc hạ tầng.** Không migration, không env, không webhook.

CÒN TREO cho session review:

- Thử trong trình duyệt thật ba điều jsdom không canh được: dời một dòng của khung
  sửa danh sách thì tiêu điểm ở lại nút vừa bấm; rời trang khi form còn thay đổi
  thì trình duyệt hỏi (`beforeunload`); Reload sau `STALE_TOUR` dựng lại form theo
  phiên bản mới (`key={detail.version}` ở bốn trang, không có test trang).
- Merge (rebase + ff), CI (luật 14), rồi thử tay production theo mục "Sau khi bàn
  giao" của plan.

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **4473** (web 1573, api 989, admin 1287, contract 522,
core 46, ui 22, tokens 18, i18n 16), int **666 ở 45 file**. So với main: thêm
282 ca Vitest (admin 175, contract 103, api 4) và 40 ca int (file mới
`admin-tours.int.spec.ts` 36 ca, `admin-catalog.int.spec.ts` thêm 4). Đột biến
255 ở mười hai task: 243 bị giết; 12 còn sống, cái nào cũng có lý do — 8 tương
đương, 3 chỉ lộ trong trình duyệt thật hoặc khi hai lệnh đua nhau thật, 1 vì dữ
liệu seed không chạm nhánh làm tròn (unit Task 1 đã canh). Bảy lỗ test do đột
biến lộ ra đều đã vá bằng ca mới hoặc ca siết lại.
