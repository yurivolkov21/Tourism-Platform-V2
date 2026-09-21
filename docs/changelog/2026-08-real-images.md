# CHANGELOG — lưu trữ: thay ô giữ chỗ bằng ảnh thật (14/08–18/08/2026)

Dựng đường ống ảnh (cây thả ảnh, ba script quét và tải lên) rồi phủ ảnh thật có
ghi công giấy phép lên trang chủ, blog, giới thiệu, liên hệ, auth và điểm đến.
Kèm khe video đầu tiên.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-08-18 — Lấp 5 khe Moments bằng ảnh SẴN CÓ, viết lại caption theo ảnh (nhánh `feat/moments-images`, `4da65a8`, 3 file, +74/−32)

`/destinations` hết ô giữ chỗ: khối Moments từ **0/5 lên 5/5 ảnh thật**, và
KHÔNG phải đi tìm tấm nào mới.

**Đảo chiều quy trình.** Bản cũ viết caption trước rồi mới đi tìm ảnh khớp, và
ba trong năm cảnh (hang Hạ Long, thung lũng Sa Pa, chợ nổi Cái Răng) không có
tấm nào trong kho — Hạ Long, Sa Pa, Huế, Cần Thơ đều là địa danh CHƯA có ảnh
nào tải về. Nay chọn từ ảnh đang có trước, rồi sửa caption cho khớp thứ trong
ảnh. Mục Hội An giữ NGUYÊN văn vì `hoi-an/gallery/01.jpg` đúng là thuyền đậu
bên sông Hoài giữa ban ngày, tức "hours before the lanterns" theo nghĩa đen.

| khe | ảnh nguồn (đã sống trên CDN) | tour |
| --- | --- | --- |
| `moment-lanha-kayak` | `cat-ba/gallery/01.jpg` — mũi kayak trên nước lục | Lan Hạ & Cát Bà Kayak Cruise |
| `moment-hagiang-valley` | `ha-giang/gallery/02.jpg` — đường uốn qua thung lũng | Hà Giang Loop by Easyrider |
| `moment-hoian-river` | `hoi-an/gallery/01.jpg` — thuyền bên sông Hoài | Hội An Old Town & Lantern Evening |
| `moment-myson-towers` | `hoi-an/gallery/17.jpg` — tháp gạch Chăm | Mỹ Sơn Sanctuary at Sunrise |
| `moment-bentre-canal` | `ben-tre/gallery/03.jpg` — luồng dừa nước | Bến Tre Coconut Country Day Trip |

**Upload không đưa tấm nào chưa duyệt lên CDN** — cả 5 đã được duyệt mắt và
đang sống dưới dạng ảnh gallery địa danh, nên tinh thần ADR-0020 đã thoả từ
trước. Đo trước/sau để chứng minh: 218 → 223 publicId phân biệt, đúng 5 khe
mới, **0 version đổi, 0 mất**. (Con số 494→499 là số ROW — một ảnh gallery
địa danh được nhiều tour mượn nên nhiều row dùng chung một publicId; đừng lẫn
hai đơn vị này khi đọc log `media:upload`, nó in "177 file" là số file GỬI đi,
không phải số ảnh thay đổi.)

**Đổi tên 4 khe theo địa danh CÓ ảnh.** Khoá khe cũng là `publicId` trên
Cloudinary; giữ tên `moment-hue-gate` mà nhét tháp Chăm vào là gài bẫy người
đọc sau. Khe cũ chưa có row media nào nên đổi tên miễn phí — vẫn 34 khe site.

**Vá scrim caption, theo số đo.** Đây là lúc khe có ảnh THẬT nên khuyết cũ mới
lộ, và nó KHÔNG nằm ở đáy ô như tưởng: gradient `to-transparent` phủ đúng chiều
cao khung caption (116px với `pt-10`), nên ở DÒNG TIÊU ĐỀ TRÊN CÙNG alpha chỉ
còn 0,5·(1−70/116) ≈ 0,20 — gần như không che gì. Đo tỉ lệ pixel nền quá sáng
để chữ trắng đạt AA, trên chính 5 ảnh sắp gắn:

| ô | hiện tại | sau vá |
| --- | --- | --- |
| Hà Giang | 17,4% | 2,9% |
| Hội An | 10,0% | 0,2% |
| Lan Hạ (ô lớn) | 8,3% | 1,4% |
| Mỹ Sơn | 3,2% | 0,1% |
| Bến Tre | 0,0% | 0,0% |

Hai lớp gradient chồng (alpha 1−(1−a)²) cộng `pt-16` kéo dải phủ lên 140px. Giá
phải trả là ảnh bị dìm trung bình 11% → 22%; đã cân `pt-20` nhưng chỉ hơn 1,6
điểm mà dìm thêm nữa nên dừng ở `pt-16`. Lớp thứ hai đặt TRONG khung caption và
`inset-0` chứ không phải một chiều cao cố định — để nó tự khớp khi tiêu đề rơi
từ 2 dòng xuống 1.

**Một sai số đo tự bắt được giữa đường:** vòng đầu tôi lấy 42% chiều cao ô làm
dải phủ, phóng đại độ tối ở dòng tiêu đề gấp ~1,7 lần và suýt kết luận "chỉ cần
đổi ảnh là xong". Hình học phải đọc từ CODE (`p-4 pt-10`, `text-sm`=14/20,
`text-xs`=12/16), không ước lượng theo tỉ lệ ô.

Nghiệm thu trên trang thật: 5/5 `<img>` có `naturalWidth > 0`, `currentSrc` trỏ
đúng 5 `publicId` mới.

Tests after: 1264 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-18 — CI đỏ vì bộ gỡ khối tự viết xoá lem 8 tour (nhánh `fix/restore-south-tours`, `5b39827`, 1 file, +350/−38)

`main` đỏ ở `55cdf9c`: `db:seed` gãy với `tour_destinations_tour_id_fkey`. Lỗi
của tôi ở chính commit gỡ Côn Đảo ngay trên.

**Bộ gỡ khối cắt chuỗi theo mốc text, và mốc text ăn lem sang hàng xóm.** Nó
tìm UUID rồi lùi về `rfind('\n  {')`, tiến tới `find('\n  },')` — với một khối
nằm cạnh khối khác thì ranh giới đó nhảy qua cả phần tử bên cạnh. Hậu quả: mảng
`tours` của `tours-south.ts` từ 9 phần tử về **0** thay vì còn 8, trong khi
`tourDestinations` vẫn trỏ tới 8 tour vừa biến mất.

Sửa bằng phép ĐẾM NGOẶC (bỏ qua ngoặc nằm trong chuỗi) để tách đúng từng phần
tử cấp cao nhất, rồi lọc theo DANH TÍNH thay vì theo vị trí text. Kết quả khớp
chính xác con số đã đo trên DB lúc xoá: tours −1 · tourDestinations −1 ·
tourItineraryDays −3 · tourPolicies −3 · tourFaqs −4 · tourDepartures −3.

**Vì sao gate ở máy không bắt được — và đây mới là bài học thật.** `pnpm
gate:int` KHÔNG chạy `db:seed`; DB local lúc đó đã có sẵn dữ liệu nên mọi truy
vấn vẫn đúng, typecheck cũng xanh vì file vẫn hợp lệ cú pháp. CI thì seed từ DB
RỖNG, và đó là chỗ duy nhất tham chiếu treo lộ ra. Lần này đã chạy đúng phép
kiểm đó trước khi push: DROP/CREATE DATABASE → `migrate deploy` → `db:seed` từ
đầu (507 dòng, 29 tour, 84 review, không lỗi).

**Hai luật rút ra:**

1. **Sửa fixture bằng cắt chuỗi là sai công cụ.** Fixture là dữ liệu có cấu
   trúc; phải tách theo cấu trúc. Ba lần quét text liên tiếp trong cùng một
   commit (theo slug, theo UUID, theo tên hiển thị) đều "có vẻ" đúng vì mỗi lần
   đều làm số lần nhắc giảm — không lần nào đo thứ đáng đo là **số phần tử còn
   lại**.
2. **Với thay đổi động tới fixture seed, gate xanh KHÔNG đủ để khai xong** —
   phải seed lại từ DB rỗng. Đây là khoảng mù thật của `gate:int`, không phải
   sơ suất một lần.

Tests after: 1264 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-18 — Gỡ Côn Đảo khỏi catalogue, và nối nốt dây ảnh mà vòng trước bỏ lọt (nhánh `feat/remove-con-dao`, `4d2eae6`+`798b184`, 12 file, +79/−723)

Hai việc trong một nhánh, và cái thứ hai là hậu quả của một thiếu sót ở vòng
trước.

**Gỡ Côn Đảo — quyết định BIÊN TẬP, không phải vấn đề kỹ thuật.** Côn Đảo là
đảo tù chính trị thời chiến; user không muốn giới thiệu nơi này như một điểm du
lịch. Gỡ trọn vẹn cả tour lẫn địa danh, không ẩn và không `isActive: false`.

Đáng ghi là tôi đã CAN hai lần trước đó và cả hai lần đều can sai chỗ. Lần đầu
user muốn xoá vì không tìm được ảnh; tôi can bằng lý lẽ "đừng đổi dữ liệu để
chữa một khiếm khuyết hiển thị — ô giữ chỗ sinh ra cho đúng việc đó", rồi đi
tìm ảnh hộ. Lần hai user nghi ảnh không đúng địa danh; tôi kiểm và chứng minh
được là đúng (tiêu đề tiếng Việt của chính tác giả, thẻ địa danh, và một ảnh
Wikimedia độc lập cho cùng dáng núi). Nhưng lý do THẬT chưa bao giờ nằm ở ảnh.
**Bài học: hỏi "vì sao muốn bỏ" TRƯỚC khi bảo vệ "cách rẻ hơn để giữ".**

Gỡ ở bốn tầng, mỗi tầng kiểm riêng. Chỗ suýt sót: các khối itinerary/policy/FAQ
tham chiếu tour bằng **UUID chứ không phải slug**, nên lượt quét theo slug bỏ
lọt 5 khối — typecheck vẫn xanh vì chúng hợp lệ cú pháp, chỉ grep lại theo tên
"Côn Đảo" mới lộ. DB xoá trong một transaction: chênh đúng 14 dòng phụ thuộc
(3 departure · 3 itinerary · 3 policy · 4 FAQ · 1 tour_destinations) cộng tour
và địa danh; `media_assets`, `reviews`, `bookings` KHÔNG đổi dòng nào. Test có
số ghim cứng phải sửa theo: sitemap 52 → 51 URL, 30 → 29 tour — đúng như chốt
chặn đó được thiết kế để bắt.

**Nối dây ảnh: hai chỗ, hai bệnh khác nhau.** User phát hiện bằng mắt rằng thẻ
tour ở trang vùng vẫn là ô giữ chỗ dù ảnh đã lên CDN.

`tour-card.tsx` **quên nối dây** — nhận `TourCardVM` vốn đã mang `cover` nhưng
vẽ `ImagePlaceholder` vô điều kiện, đúng lỗi `destination-tile.tsx` mắc hôm
trước. Lần này nặng hơn vì `TourCard` dùng ở NĂM chỗ (gợi ý cuối trang tour,
`region-tours`, `region-day-trips`, tab đánh giá, lưới đã lưu).

`saved-grid.tsx` **thiếu dữ liệu**, không phải quên nối: `WishlistItemSchema`
chưa có trường ảnh nào nên không có gì để nối. Phải nở contract thêm `cover` và
cho `wishlist.service` lấy ảnh theo LÔ qua `MediaService.resolveForOwners` —
một lượt cho cả trang; làm sai chỗ này thì trang 24 item là 24 lượt đi DB.

**Review findings**

- **Rà theo TRANG là cách đã bỏ lọt chính lỗi này.** Vòng trước nối xong
  `destination-tile` thì `/destinations` trông đã ổn, nên coi như xong — trong
  khi `TourCard` vẫn hỏng ở trang vùng. Lần này rà theo DỮ LIỆU: liệt kê mọi
  component nhận VM có `cover` rồi đối chiếu số `<ImagePlaceholder>` với số thẻ
  ảnh thật. Sau khi sửa chỉ còn `slot-image`, `slot-video`, `tour-media-panel`
  giữ placeholder, và cả ba là nhánh dự phòng đúng nghĩa.
- **Phép đếm ảnh của tôi từng nói dối.** Có lúc báo "trang Bến Tre 0 ảnh" trong
  khi HTML có URL Cloudinary và URL đó trả HTTP 200 kèm 780KB. Nguyên nhân:
  đếm quá sớm, ảnh chưa tải xong. Sửa bằng cuộn chậm hơn và điều kiện
  `naturalWidth > 0`. Suýt đi tìm lỗi trong một thứ không hỏng.
- **API chết giữa chừng, và fallback che mất.** `ECONNREFUSED 127.0.0.1:3001`
  làm trang tour trả 500 còn các trang khác rơi về fallback nên trông như mất
  ảnh. Tách tầng (API trả gì · HTML có gì · URL ảnh trả gì) mới thấy.
- **4 test e2e đỏ vì Postgres local tắt, không phải vì thay đổi này.** Kiểm
  bằng cách `git stash` rồi chạy lại — vẫn đỏ. `docker compose up -d` là xanh.
  Quy đúng nguyên nhân rẻ hơn nhiều so với sửa mò.
- **Chip giảm giá của `TourCard` lệch token.** Nó dùng `bg-destructive` trong
  khi `TourListCard` đã chuyển sang `sale` từ 17/08 — hai thẻ tour của cùng sản
  phẩm hiện hai sắc đỏ khác nhau. Đồng bộ luôn vì đang sửa đúng file đó.

**Ảnh: xong trọn bộ catalogue.** Sau các lô Unsplash+ của user (Hà Nội, Hội An,
TP.HCM, Đà Nẵng, Ninh Bình và 9 địa danh còn lại) cộng tấm Fansipan dùng lại từ
panel auth: **29/29 cover tour · 18/18 bìa địa danh · 18/18 gallery địa danh**.
Đo trên trang thật: ba trang vùng từ 6 ô giữ chỗ mỗi trang về 0, `/tours` 1 → 0,
trang tour 3 → 0, trang chủ 25/25 ảnh.

**Nợ mở:** 5 khe Moments ở `/destinations` vẫn trống — chỗ duy nhất còn ô giữ
chỗ · 4 khe site mồ côi (`content-hero`, `destinations-hero`, `home-experiences`,
`home-trust`) không trang nào hỏi tới · trang chữ chưa quyết có hero ảnh không ·
`RegionTile` ở `region-gallery` vẫn dùng nền gradient thay vì ảnh thật, là lựa
chọn thiết kế cũ chưa rà lại.

Tests after: 1264 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-18 — Vá alert deepmerge-ts: ép qua major khi thượng nguồn ghim cứng (nhánh `fix/deepmerge-ts-advisory`, `09e604f`, 2 file, +135/−4)

GHSA-ggr8-5vv4-36mx (high) — `deepmerge-ts < 8.0.0` cạn stack khi merge object
đệ quy. Phát hiện tình cờ: output của `git push` đợt trước có nhắc một link
Dependabot, kiểm thì thấy alert đang mở.

**Thượng nguồn ghim CỨNG nên không có đường tự lên.** `@prisma/config@7.8.0`
khai `deepmerge-ts: "7.1.5"` — một phiên bản chính xác, không phải range. Tức
`pnpm update` không bao giờ chạm tới được; chỉ còn hai lựa chọn: chờ Prisma phát
hành, hoặc override. Bản vá duy nhất là 8.0.0, nên override này **ép qua major
7→8**.

**Ép major mà vẫn an toàn, vì bề mặt API dùng thật rất hẹp.** Đọc
`dist/index.js` của `@prisma/config`: cả ba lần nhắc `deepmerge` đều là MỘT
chỗ gọi — lấy named export rồi truyền làm `merger` cho c12. Phần types/record
mà v8 thay đổi không nằm trên đường đó. **Đọc code thượng nguồn rẻ hơn đoán
theo số major.**

**Chứng minh bằng chạy thật, đúng cách đã dùng cho `brace-expansion` 2→5.**
`prisma validate` in "Loaded Prisma config from prisma.config.ts" — tức đã đi
qua đúng chỗ gọi `deepmerge` — rồi báo schema hợp lệ; `prisma generate` sinh
client; `prisma migrate status` nói schema up to date; `gate:int` xanh 18 task
cộng 180 int test dùng Prisma. Lockfile sau đó chỉ còn `deepmerge-ts@8.0.1`.

**Review findings**

- **Suýt đặt override sai file.** Bản đầu tôi thêm `pnpm.overrides` vào
  `package.json`, cài lại thì phiên bản KHÔNG đổi. Nhìn lockfile mới thấy khối
  `overrides` đã tồn tại với react/react-dom/@hono — tức repo giữ chúng ở
  `pnpm-workspace.yaml`. Và đó là lựa chọn có lý do: YAML cho phép comment, nên
  mỗi override đều mang theo lý lẽ của nó, thứ `package.json` không làm được.
  **Một thay đổi không có tác dụng thì hãy hỏi "mình có đang sửa đúng file
  không", trước khi hỏi "cú pháp có sai không".**
- **Override phải CÓ PHẠM VI.** Repo dùng dạng `pkg@<dải dính>: ^bản vá` để
  không ghim vĩnh viễn các bản sau. Bản đầu tôi viết `deepmerge-ts: '^8.0.1'`
  trần — đúng kết quả hôm nay, nhưng khoá cứng tương lai.
- **Mức độ thực tế thấp, và nói rõ điều đó cũng là một phần của bản vá.**
  `@prisma/config` chỉ chạy lúc đọc file cấu hình ở CLI/build, không nằm trên
  đường phục vụ request, input là `prisma.config.ts` của chính mình. Vá để sạch
  alert, không phải vì đang bị với tới — ghi ra để sau này ai đọc còn biết mức
  ưu tiên thật nếu dòng override này gãy.
- **Alert chưa tự đóng ngay sau khi gate xanh.** GitHub chỉ quét lại khi
  lockfile mới lên remote, nên số alert vẫn là 1 cho tới lúc push.

**Nợ mở:** 5 khe Moments vừa mở vẫn trống · 10/19 địa danh chưa cover, 14/19
chưa gallery · 3 khe DB vẫn mồ côi · 25/30 tour chưa cover · trang chữ chưa
quyết có hero ảnh không · pnpm báo có bản 11.22.0 (đang 11.9.0) — không nâng,
theo chính sách freeze.

Tests after: 1264 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-18 — `/destinations` từ 0 lên 9 ảnh mà không upload tấm nào, và ba vòng đo mới ra đúng lớp phủ (nhánh `feat/destination-cover-wiring`, `9897d92`, 8 file, +204/−14)

Khảo sát hôm trước chỉ ra `/destinations` render 17 ô giữ chỗ trong khi 9/19
địa danh ĐÃ có cover nằm sẵn trong DB. Bệnh là THIẾU DÂY NỐI, không phải thiếu
ảnh: `destination-tile.tsx` vẽ `ImagePlaceholder` vô điều kiện, không đọc
`DestinationSchema.cover`. Nối xong: 9 ảnh thật hiện ra, ô giữ chỗ 17 → 8,
không upload thêm tấm nào.

**Nối dây kéo theo một quyết định thiết kế, không chỉ đổi component.** Thẻ này
CỐ Ý bỏ lớp phủ tối và dùng `text-foreground` theo theme, vì nền vốn là ô giữ
chỗ màu phẳng — phủ tối lên màu phẳng vẫn ra màu phẳng, vòng trước đã dựng thử
rồi bác. File còn để sẵn lời dặn "khi có ảnh thật thì mới quay lại mẫu
phủ-tối cộng chữ trắng". Nay 9 ô có ảnh và 10 ô chưa, nên thẻ phải chạy CẢ HAI
cùng lúc; dùng một cách xử lý cho cả hai là hỏng một nửa số ô.

**Ba vòng đo mới ra đúng lớp phủ, và cả ba lần sai theo kiểu khác nhau.**

| Cách phủ | Tên ô xấu nhất (light, nghỉ) | Kết |
| --- | --- | --- |
| `bg-overlay/55` | 1.72 | trượt xa |
| `bg-overlay` một lớp | 2.92 | vẫn trượt |
| phủ phẳng hai lớp (0.75) | 5.90 | đạt, nhưng dìm ảnh |
| gradient hai lớp | 5.29 | đạt, ảnh còn sống |

Lần một: `--overlay` đã là `oklch(0 0 0 / 0.5)`, TỰ MANG alpha, mà cú pháp
`/NN` của Tailwind NHÂN vào alpha đó — nên `bg-overlay/55` ra ~27% đen chứ
không phải 55%. Chính file này đã ghi sẵn "một lớp `bg-overlay` KHÔNG chia mới
đạt ~4.6:1"; viết `/55` là đi ngược điều file đã đo.
Lần hai: một lớp không chia vẫn chỉ 2.92, vì con số 4.6:1 kia đo trên ô giữ
chỗ màu PHẲNG chứ không phải ảnh. Tính ngược từ luminance ảnh Hội An (~0.585):
muốn 4.5:1 với chữ `on-media` thì cần alpha ≥ 0.71 — một lớp không bao giờ tới.
Lần ba là lỗi THẨM MỸ chứ không phải lỗi số: phủ phẳng 0.75 đạt chuẩn nhưng
dìm cả tấm ảnh thành nâu đục — vừa gắn ảnh vào đã làm nó biến mất thì gắn làm
gì. Vì caption nằm GIỮA ô, hai gradient `trong → overlay → trong` dồn độ đậm
đúng dải chữ và trả độ trong cho mép trên/dưới. User chốt gradient.
**Bài học: một con số đo được vẫn có thể áp sai chỗ — 4.6:1 kia đúng, nhưng
đúng cho NỀN KHÁC.**

**Khối Moments mở 5 khe site mới**, khe site lên 34. Tên khe đặt theo CHỦ THỂ
trong khung hình (`moment-halong-kayak`, `moment-hue-gate`…) chứ không theo câu
caption — cùng lý lẽ cụm `why-*`: đổi chữ sau này không làm tên khe lạc nghĩa.
Mỗi khoảnh khắc TỰ KHAI khoá khe của mình thay vì suy từ vị trí trong mảng;
suy theo index thì sắp xếp lại `MOMENTS` là ảnh gắn nhầm chỗ mà không gì báo —
đúng lý lẽ `tourSlug` ghi tay đã dùng ở chính file đó.

**Review findings**

- **Comment trong file là kết quả đo, phải đọc trước khi sửa.** Cả hai lỗi lớp
  phủ đầu tiên đều đã có lời cảnh báo nằm sẵn cách chỗ sửa vài dòng. Đọc code
  xung quanh trước khi viết đè rẻ hơn ba vòng đo.
- **Khe trống và khe lỗi cho cùng kết quả, nên không bọc `settle()`.** Ảnh
  Moments giải bằng `fetchSiteMedia().catch(() => new Map())`: cả hai đường đều
  ra `null` → ô giữ chỗ, nên thêm một lớp settle chỉ là nghi thức.
- **`JourneyMoments` là server component nhưng vẫn KHÔNG tự fetch.** File ghi
  rõ nó nhận dữ liệu qua prop để test được với fixture nhỏ; tự fetch là tiện
  hơn vài dòng nhưng mất luôn tính chất đó. Ảnh giải ở trang rồi truyền xuống.
- **Bộ canh khoá khe thêm ngay, không đợi.** Gõ sai khoá thì `map.get()` trả
  undefined và ô lặng lẽ về giữ chỗ, KHÔNG lỗi nào — đúng kiểu hỏng đã dính ở
  panel auth hôm trước, nên lần này canh từ đầu.

**Nợ mở:** 5 khe Moments vừa mở vẫn TRỐNG, cần user duyệt ảnh · 10/19 địa danh
chưa cover, 14/19 chưa gallery · 3 khe DB vẫn không trang nào hỏi tới
(`content-hero`, `destinations-hero`, `home-experiences`, `home-trust`) · 25/30
tour chưa cover — làm gallery THEO ĐỊA DANH thì phần tour rút từ ~120 ảnh
xuống còn 25 cover, vì gallery tour tự mượn gallery địa danh · trang chữ chưa
quyết có hero ảnh không.

Tests after: 1264 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-17 — Ảnh thật cho panel sáu trang auth, và một hằng số biến thành hàm (nhánh `feat/auth-panel-image`, `659b8e0`, 10 file, +181/−21)

Khảo sát "trang nào còn thiếu ảnh" (user hỏi, trừ `/tours` ra) rồi làm cụm rẻ
nhất trước. Khe `auth-panel` phục vụ SÁU trang bằng một ảnh, nên sửa một lần
được cả sáu.

**Bảng khe một mình sẽ báo cáo SAI.** DB có 29 khe, 24 có ảnh, 5 trống — nhưng
đếm trên trang đang chạy thì **4 trong 5 khe trống không trang nào hỏi tới**
(`destinations-hero`, `home-experiences`, `home-trust`, và `auth-panel` lúc đó).
Chúng là hàng DB không nối vào đâu. Ngược lại, `/destinations` render 17 ô giữ
chỗ mà **0 ảnh thật dù 9/19 địa danh đã có cover trong DB** — vì
`destination-tile.tsx` vẽ `ImagePlaceholder` vô điều kiện, không đọc
`DestinationSchema.cover`. **Bài học: "thiếu ảnh" và "thiếu dây nối" là hai
bệnh khác nhau, và chỉ đếm dữ liệu thì không phân biệt được — phải đếm cái
NGƯỜI DÙNG THẤY.**

**Ảnh khớp sẵn ba chi tiết đã có trên trang.** User tìm được ảnh đỉnh Fansipan
lúc bình minh (cáp treo, tượng Phật, biển mây). Trang vốn đã ghi caption
"Sapa Express · departs at dawn", cuống vé "HN → SAPA", và cột trái vẽ tuyến
trắc địa 1 650 m → 3 143 m lấy đỉnh Fansipan làm điểm đến — không phải sửa chữ
nào. Duyệt bằng mắt TRƯỚC upload theo ADR-0020 bản sửa: dựng preview đặt ảnh
vào đúng khe (720×900 ở 1440px, 512×800 ở 1024px) rồi mới đẩy lên CDN.

**Một hằng số chuỗi lặng lẽ biến thành `function`.** Để sáu trang khỏi tự gõ
`'auth-panel'`, tôi export hằng `AUTH_PANEL_SLOT` từ `auth-screen.tsx`. Trang
vẫn vẽ ô giữ chỗ, không lỗi, không cảnh báo. Đo ra: `map.size` là 25 và
`[...map.keys()]` CÓ `auth-panel`, nhưng `map.has(AUTH_PANEL_SLOT)` false trong
khi `map.has('auth-panel')` true. Nguyên nhân: `auth-screen.tsx` là
`'use client'`, và khi server component import một export từ module client thì
bundler thay nó bằng **client-reference proxy** — `typeof` ra `'function'`,
`JSON.stringify` ra `undefined`. Chuyển hằng sang `lib/api/site-media.ts` (module
không có `'use client'`) là hết. **Bài học: hằng dùng chung giữa server và
client phải sống ở module KHÔNG có `'use client'`; và thứ tôi thêm vào để chống
gõ sai lại đẻ ra một lỗi im lặng tệ hơn chính cái nó phòng.**

**Review findings**

- **Không phải cache, dù triệu chứng giống hệt.** Ô giữ chỗ vẫn còn sau khi đã
  upload, nên nghi `revalidate: 300` giữ bản 24 khe cũ; xoá `.next/cache` và
  khởi động lại — vẫn y nguyên. Kiểm API thì nó trả đủ 25 khe kèm `auth-panel`.
  Hai phép thử đó loại sạch tầng cache và tầng API, chỉ còn tầng trang, và một
  máy dò in thẳng giá trị ra mới lòi nguyên nhân thật. **Sửa theo phỏng đoán
  quen tay (xoá cache) tốn hai vòng mà không tiến thêm bước nào.**
- **Quote đè lên ảnh: đo chứ không nhìn.** Ẩn chữ đi rồi chụp đúng vùng nền sau
  nó — cách này tránh lỗi đo trúng khe hở giữa các nét chữ đã dính ở đợt màu
  badge. Chữ 24px là "chữ lớn" theo WCAG nên ngưỡng 3:1; pixel xấu nhất 3.63 ở
  1920, 3.47 ở 1440, 3.15 ở 1024 — đạt cả ba, không phải đổi scrim.
- **Lời dặn trong code hết hiệu lực khi đổi nguồn ảnh.** Comment cũ dặn "thêm
  lại dòng ghi công CC BY cùng lúc với ảnh thật". Lời dặn đó gắn với ảnh
  Wikimedia CC BY 2.0; ảnh mới theo Unsplash License KHÔNG đòi ghi công trên
  UI, nên làm theo lời dặn một cách máy móc là thêm một dòng credit không cần
  thiết. Ghi công vẫn lưu đủ trong DB theo ADR-0020 §3; ảnh Wikimedia cũ đã xoá
  khỏi `public/images`.
- **`alt` rỗng ở đây là ĐÚNG, không phải nợ.** Panel là ảnh nền trang trí, nội
  dung thật (quote + tên người nói) là text riêng ngay cạnh — luật này
  `slot-image.tsx` đã ghi sẵn. Nhãn mô tả chỉ dùng cho ô giữ chỗ khi khe trống.

**Nợ mở:** `/destinations` là cụm nặng nhất còn lại — 4 trang, 35 ô giữ chỗ, và
phải NỐI DÂY `cover` trước khi thêm ảnh mới có tác dụng · 10/19 địa danh chưa
cover, 14/19 chưa gallery · khối "Moments from the journey" còn chạy mock, chưa
có nguồn dữ liệu thật · 3 khe DB vẫn không trang nào hỏi tới, nên hoặc nối dây
hoặc xoá cho khỏi nhiễu thống kê · 25/30 tour chưa có cover · trang chữ
(`/faq`, `/privacy`, `/terms`, `/cancellation-policy`) hiện không ảnh nào và
khe `content-hero` chưa dùng — chờ user quyết có muốn hero ảnh không.

Tests after: 1258 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-17 — Thẻ tour /tours thành lưới hai cột, và một cái bẫy của `grid-cols-2` (nhánh `feat/tours-card-grid`, `4753248`, 6 file, +358/−143)

User đưa hai mẫu ReUI ([product-grid-1](https://reui.io/preview/base/product-grid-1)
và [product-card-5](https://reui.io/preview/base/product-card-5)) rồi phân vân
chọn cái nào. Chép 1:1 cả hai để so thì câu trả lời tự lộ: product-card-5 là
MỘT thẻ đơn khổ 1024×648 kiểu trưng bày, có variant picker và nút "Add to Bag"
ngay trên thẻ — dùng cho 30 tour nghĩa là 30 thẻ khổng lồ xếp chồng. User chốt
lấy KHUNG XƯƠNG của product-grid-1 và KIỂU ẢNH khuyết góc của product-card-5.

**Ghép hai mẫu làm lộ một xung đột không mẫu nào có một mình.** Mask cắt mọi
thứ nằm trong phần tử nó áp lên, kể cả con nằm đè. Mà vết khuyết của
product-card-5 nằm đúng GÓC TRÊN-PHẢI — chính chỗ product-grid-1 đặt nút
wishlist. Đo trên khung 554×369: vết cắt bắt đầu ở x=410 mép trên và y=96 mép
phải, nên nút tim (x 512..542, y 12..42) nằm TRỌN trong vùng bị cắt và biến
mất sạch. Lời giải là bọc thêm một lớp `position: relative`, chỉ khung ảnh
mang mask, badge và tim thành ANH EM của nó — nút tim vì thế ngồi trong phần
khuyết, trên nền thẻ, hoá ra đọc ra như thể vết khuyết sinh ra để chứa nó.

**`grid-cols-2` của Tailwind không chặn được chiều rộng.** `1fr` nghĩa là
`minmax(auto, 1fr)`, mà cận dưới `auto` lấy min-content; tiêu đề đặt
`white-space: nowrap` có min-content bằng CẢ dòng chữ, nên cột phình ra để
chứa nó thay vì cắt nó. Ba triệu chứng cùng một gốc, phát hiện lúc dựng
wireframe: cột 580 → 670, thẻ cao thêm 60px (ảnh giữ tỉ lệ 3:2 nên rộng ra là
cao lên), và số tiêu đề bị ellipsis cắt là 0 vì hộp đã nở vừa chữ. Ghim
`minmax(0,1fr)` thì phép cắt mới thật sự chạy. **Bài học: một phép cắt chữ
không bao giờ kích hoạt thường không phải lỗi của phép cắt, mà là hộp chứa nó
đang tự nở.**

**Chiều cao cố định, không phải `min-height`.** User chốt "tiêu đề 1 dòng, mô
tả 2 dòng thì nhớ cố định, tránh trường hợp tiêu đề dài 2 dòng thì card lại
giãn ra". `min-h` chỉ chặn chiều HỤT; chặn chiều PHÌNH phải là `height` cố
định cộng cắt chữ. Nghiệm thu bằng cách ép tiêu đề 948px và tóm tắt gấp 30 lần
vào một thẻ: thẻ đứng nguyên 602px và cả 10 thẻ vẫn bằng nhau.

**Màu badge: đo xong thì phải làm NGƯỢC yêu cầu của user.** User muốn "giống
#E63946 nhưng nhạt hơn 3-4%". Đo ra thì chính #E63946 đã không đạt chữ trắng
(4.17 < 4.5), nhạt thêm 3.5% còn 3.62, và đổi sang chữ mực đậm cũng không cứu
(4.07). Giá trị nhạt NHẤT còn đạt trong cùng chroma/hue là `oklch(0.59 0.208
22.2)` = #DE3040 (4.56) — tức TỐI hơn bản gốc 2.2%, ngược chiều user xin. Đã
báo user kèm số đo và đề nghị đổi lại nếu chấp nhận mất chuẩn đọc. Token `sale`
tách khỏi `destructive` vì ngữ nghĩa đối lập (xoá/nguy hiểm ≠ khuyến mãi), và
`sale-foreground` là trắng thật chứ không mượn `on-media` — `on-media` kéo
tương phản xuống 4.33, phá đúng lý do chọn màu.

**Điểm ngắt hai cột do đo mà đổi, không do mẫu.** Wireframe user duyệt là khung
1184 (thẻ 580), nhưng `sm:` mặc định bật hai cột từ 640px. Đếm tiêu đề bị
ellipsis cắt trên 10 tour thật: 1280px → 0/10 · 1024px → 6/10 (mất nhiều nhất
17%) · 820px → 9/10 (33%) · 640px → 9/10 (42%). Chuyển sang `lg:` (1024) thì
dưới ngưỡng là một cột và số bị cắt về 0/10. Một cột đọc được hơn hai cột đúng
hình.

**Review findings**

- **Cổng 3000 đang chạy `next start` — bản build ĐÓNG BĂNG.** Đo trang thật ra
  thẻ 1184×230 tiêu đề 2 dòng, tức thẻ CŨ, trong khi code đã đổi. Suýt đi tìm
  lỗi trong component. Kiểm `ps` mới thấy tiến trình là `sh -c next start`.
  Cùng họ với sự cố `pnpm start` của API ngày 16/08 (rơi về Postgres docker,
  ảnh biến mất mà trang vẫn trông bình thường). Đã chuyển sang `next dev`, giữ
  nguyên cổng. **Đo một trang do server nào phục vụ là một phần của phép đo.**
- **Nhánh badge `isFeatured` bị wireframe bỏ sót.** Wireframe chỉ vẽ badge giảm
  giá, nhưng thẻ đang chạy có nhánh thứ hai: không giảm giá mà `isFeatured` thì
  hiện "Featured". Dựng "giống 100% wireframe" một cách máy móc là đánh rơi một
  tính năng đang chạy. Đã bổ sung nhánh này vào CẢ wireframe lẫn component, và
  có test cho ca cả hai cùng đúng (giảm giá thắng).
- **`titlesClipped: 0` trên dữ liệu thật KHÔNG chứng minh phép cắt chạy.** Nó
  chỉ nói không tour nào có tên đủ dài. Phải bơm tiêu đề dài vào DOM rồi đo lại
  mới là bằng chứng. Cùng họ với bài học viewport Playwright ngày 15/08: kết
  quả giống nhau trong mọi điều kiện là dấu hiệu dụng cụ hỏng, không phải phát
  hiện.
- **Skeleton `loading.tsx` phải sửa CÙNG đợt.** Chính comment trong file nói
  khối giả lệch bố cục thật là lời hứa sai, và nó từng bị đúng lỗi đó một lần.
  Ô ảnh trong skeleton cố ý KHÔNG vẽ góc khuyết: không có ảnh thật bên dưới thì
  nó chỉ là hình chữ nhật xám bị gặm mất một góc, trông như lỗi render.

**Nợ mở:** thẻ mới bỏ dòng chuỗi chặng (Hà Nội → Ninh Bình → …) vì wireframe đã
duyệt không có và thẻ hẹp đi một nửa — đã nêu để user quyết, địa danh chính vẫn
còn ở băng dữ kiện · ở đúng 1024px vẫn còn 6/10 tiêu đề bị cắt tới 17% · 25/30
tour chưa có cover nên phần lớn thẻ vẫn là ô giữ chỗ · gallery địa danh 5/19 ·
5/29 khe site trống · `family` cho tag nên vào contract · /blog chưa có ngăn kéo
mobile.

Tests after: 1253 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-17 — /blog đổi sang filter sidebar hai trục, và một lỗi phân loại đội lốt lỗi thẩm mỹ (nhánh `feat/blog-filter-sidebar`, `259f1ef`+`639150d`, 7 file, +816/−171)

User nói `/blog` "thiết kế chưa được ổn lắm" và muốn mượn giao diện
[ReUI filter-sidebar-1](https://reui.io/preview/base/filter-sidebar-1). Khảo
sát xong thì thứ đáng sửa hoá ra không phải thẩm mỹ.

**Lỗi thật là LỖI PHÂN LOẠI.** Đo trên 9 bài: mỗi bài có ĐÚNG MỘT tag chủ đề
và 8/9 bài có một tag địa danh — hai họ rõ rệt. Nhưng `/blog` đổ cả **14 tag
vào một hàng chip xếp theo bảng chữ cái**, nên "Culture" nằm cạnh "Da Nang".
Hai loại khái niệm khác hẳn bị trộn, và người đọc phải tự lọc bằng mắt. Sidebar
sửa được điều đó vì nó có sẵn hai danh sách tick riêng.

**Trục nào đáng có, quyết bằng dữ liệu chứ không bằng mẫu.** Đo phân bố thật
trước khi thiết kế: tác giả có **đúng 1 người** (9/9 bài) nên section tác giả
là một ô tick vô nghĩa; thời lượng đọc **không có** trong `PostCardSchema`
(`content` chỉ có ở trang chi tiết); giá/màu/size không tồn tại. Nên bốn
section của mẫu ReUI bỏ hết, chỉ giữ KHUNG XƯƠNG.

**`lan-ha-bay` là lỗ của cách phân họ, tìm ra TRƯỚC khi viết code.** User chốt
tách Topic/Place bằng cách đối chiếu slug tag với slug địa danh từ API (tự
động, thêm địa danh mới không phải sửa code). Kiểm lại thì `lan-ha-bay` là tag
địa danh thật mà KHÔNG phải slug destination — catalog có `cat-ba` và
`ha-long`, không có nó. Chỉ đối chiếu destinations là xếp nhầm nó sang Topic,
hiện ngay cạnh "Food". Vá bằng danh sách ngoại lệ ngắn có ghi lý do. Lời giải
triệt để là thêm trường `family` cho tag ở contract — đổi schema nên để ADR
riêng. **Bài học: kiểm giả định phân loại trên dữ liệu THẬT trước khi code, vì
một ngoại lệ trong 14 giá trị đủ làm giao diện nói sai.**

**Số đếm của API nói dối sau lần lọc đầu tiên.** `PostTagSchema.count` là tổng
TOÀN CỤC; giữ nguyên nó sau khi lọc thì người dùng bấm vào một con số khác 0
rồi nhận về màn hình trống. Trang đã tải sẵn cả 9 bài và lọc phía client nên
tính lại tại chỗ được. `facetCounts` bỏ qua lựa chọn của CHÍNH trục đang đếm —
áp cả nó thì mọi mục chưa chọn trong nhóm đều ra 0 và không ai chọn được giá
trị thứ hai cùng nhóm — nhưng trục kia thì có áp.

**Hai cột không giải được bài toán "50 tag", chỉ chia đôi nó.** User góp ý xếp
2 cột cho đỡ dài; đo được panel từ 746 xuống 522px. Nhưng 50 mục thành 25
hàng, ở ~32px/hàng vẫn là ~800px. Thứ thật sự chặn chiều cao là ngưỡng: quá 14
mục thì section chặn cao 220px và cuộn tại chỗ. Dưới ngưỡng KHÔNG bật cuộn —
không ai nên phải cuộn để thấy thứ vốn đã vừa màn hình.

**Link cũ `?tag=` phải sống.** /blog đã phát hành link dạng đó qua chip, RSS và
chia sẻ. `parseFacetParams` nhận nó, chuẩn hoá về đúng họ ngay lúc mount rồi
mọi thứ phía sau chỉ còn một đường; có `?topic=`/`?place=` mới thì bỏ qua tag
cũ để tránh hai bộ lọc chồng nhau mà giao diện chỉ hiện được một.

**Review findings (tự bắt trên đường):**

- **Input lồng trong `<label>` của chính nó → click chạy ĐÔI.** Một cú bấm kích
  hoạt hai lần (trực tiếp + label chuyển tiếp), hàm toggle chạy hai lượt và
  trạng thái quay về chỗ cũ: giao diện trông như bấm không ăn. Điều làm nó khó
  lần ra là `checked` vẫn `true` — đó là trạng thái DOM native, KHÔNG chứng
  minh state React đổi. Sửa bằng id/htmlFor với input là anh em của label.
- **Đếm card sau khi lọc là không tin được**, và dự án ĐÃ ghi lại điều này ở
  test phân trang từ trước: trong jsdom thẻ đang exit của `AnimatePresence`
  không bao giờ rời DOM. Suýt kết luận sai rằng bộ lọc hỏng, trong khi dòng
  "N stories" đã báo đúng 3. Trên trình duyệt thật thẻ tự biến mất sau ~1s (đã
  đo). Test nay khẳng định trên "N stories" lấy thẳng từ `visible.length`.
- **`tabIndex` trên vùng cuộn bị Biome chặn.** Giữ lại kèm `biome-ignore` có lý
  do: WCAG 2.1.1 đòi vùng cuộn thao tác được bằng bàn phím, không có nó thì
  người dùng bàn phím không tới được tag nằm dưới vạch cắt 220px. Đổi
  `div role="group"` sang `fieldset`/`legend` thì luật `useSemanticElements`
  hết kêu mà markup cũng đúng hơn.
- **Suppression đặt sai dòng thì vô hiệu.** `biome-ignore` phải nằm ngay trên
  dòng BỊ BẮT (thuộc tính `tabIndex`), không phải trên thẻ mở.

**Nợ mở:** mobile chưa làm ngăn kéo (user hoãn) nên sidebar chỉ xếp trên lưới ở
màn hẹp, người đọc phải cuộn qua trọn bộ lọc mới tới bài đầu · thứ tự tag theo
bảng chữ cái chứ không theo số bài, vì sắp theo số đếm sẽ làm danh sách nhảy
chỗ mỗi lần lọc · `family` cho tag nên vào contract thay vì danh sách ngoại lệ
ở web · 25/30 tour chưa có cover · gallery địa danh 5/19 · 5/29 khe site trống.

Tests after: 1243 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-17 — Khe VIDEO đầu tiên: dải CTA /about có nền động, đường ống media học nhận video (nhánh `feat/about-cta-video`, `9413469`→`751db04`, 11 file, +148/−29)

`/about` **hết sạch ô giữ chỗ** — từ 1 ảnh thật / 15 ô lúc sáng nay xuống 18
ảnh + 1 video + **0 ô**. Khe site lên **29**.

**Hai đầu của hạ tầng video đã nằm sẵn từ lâu mà không ai nối.** Contract khai
`type: 'IMAGE' | 'VIDEO'` từ ADR-0005, `buildCloudinaryUrl` đã biết dựng URL
video và suy poster từ frame `so_0`. Chỗ duy nhất còn mù là hai script:
`media-scan` chỉ quét đuôi ảnh nên video thả vào cây **bị bỏ qua im lặng**, và
`media-upload` hardcode `resource_type: 'image'`. Nay đuôi file quyết định
`type`, và `resource_type` đi theo. Đây là kiểu nợ dễ nằm im lâu: mỗi mảnh
riêng lẻ đều "đã làm xong", chỉ thiếu đúng khúc nối, và không có gì báo cho
tới lúc ai đó thật sự thả file video vào.

**Video phải tự chặn cỡ vì không ai chặn hộ.** Ảnh đi qua `next/image` nên
trình duyệt xin đúng cỡ qua `w=`; video đi thẳng thẻ `<video>` nên nguồn bao
nhiêu thì tải bấy nhiêu. Thêm `w_1600,c_limit` (chỉ thu nhỏ, không phóng to):
đo trên clip thật, **91MB xuống 4,4MB** — khách đang phải tải gấp 21 lần thứ
họ thấy trên một dải rộng 1280. Poster suy-từ-video cũng chặn cùng cỡ, 408KB
xuống 197KB. Hai test URL có sẵn **bắt đúng thay đổi này**, đã cập nhật kèm lý
do ngay tại chỗ.

**`SlotVideo` là component RIÊNG, và đó là bài học rút thẳng từ lỗi sáng nay.**
Video không đi qua `next/image`, cần bộ thuộc tính khác hẳn, lại cần một hiệu
ứng client cho `prefers-reduced-motion`. Nhét thêm nhánh vào `SlotImage` sẽ
cho ba nhánh chỏi nhau — chính xác thứ đã đẻ ra lỗi định vị `fill` vài giờ
trước, khi hai nhánh của cùng một component không mang cùng bộ class. Vì vậy
`SlotVideo` cũng tự mang `relative overflow-hidden` qua `cn`, cùng hợp đồng
với `SlotImage`.

**`muted` và `playsInline` không phải tuỳ chọn:** thiếu `muted` thì mọi trình
duyệt chặn autoplay, thiếu `playsInline` thì Safari iOS mở toàn màn hình thay
vì phát tại chỗ. Reduced-motion xử lý bằng cách để `autoPlay` chạy rồi dừng
ngay trong effect — trình duyệt bấm play TRƯỚC khi React kịp chạy, nên cách
duy nhất chặn từ đầu là bỏ `autoPlay` và bắt MỌI người dùng chờ thêm một vòng
render. Đánh đổi đã chọn: người bật giảm-chuyển-động mất vài khung hình rồi
đứng ở poster.

**Lo ngại về vòng lặp KHÔNG thành hiện thực, và lý do đáng ghi.** Clip mở đầu
trong hang tối; tưởng dưới scrim 60% sẽ thành mảng đen suốt 4 giây đầu mỗi
vòng. Đo lại: khung CTA tỉ lệ **3.33 chỉ giữ dải giữa** của khung 16:9, tức
đúng cửa hang sáng — vách đá tối nằm ngoài vùng cắt. Bài học ngược với thường
lệ: ở khung càng dẹt, **vùng cắt có thể CỨU một tấm** chứ không chỉ phá.

**Khối Numbers: không ảnh, và đó là trạng thái CHỐT.** Ô giữ chỗ cũ nằm ở
`opacity-30` dưới lớp phủ `overlay/70` — chỉ còn khoảng 9% hiện ra, không đóng
góp gì mà lại là lời hứa "sắp có ảnh" đứng mãi. Gỡ hẳn, ghi comment rõ để lần
sau không ai mở khe `about-numbers` vì tưởng bị sót.

**Trả một món nợ vừa ghi hôm nay:** trang đăng ký ghi *"four friends"* trong
khi §Story và mốc 2014 đều ghi *"three guides"*. Sửa thành "three".

**Review findings (tự bắt trên đường):**

- **`guard-build.mjs` báo nhầm vì chính lệnh của tôi.** Guard quét `/proc` tìm
  tiến trình có cwd `apps/web` và cmdline khớp `next-server|next start`; lệnh
  tôi chạy lại **chứa đúng chuỗi đó** trong câu `pgrep`, nên nó khớp chính
  shell của mình. Guard fail-closed nên chỉ chặn build chứ không gây hại. Chưa
  sửa guard — ghi vào nợ mở.
- **URL video vẫn ra bản cũ sau khi sửa `cloudinary-url.ts`,** vì HAI tầng
  cache chồng nhau: API còn chạy `dist` cũ trong bộ nhớ, và Next giữ **fetch
  cache** trong `.next/cache` theo `revalidate = 300`. Các đợt trước chỉ xoá
  `.next/cache/images` nên không đủ; thay ảnh/URL do API sinh thì phải
  `rm -rf .next` trọn VÀ khởi động lại API.
- **`duration` đọc ra 2,1s trong khi clip dài 13,82s** — chỉ là metadata đọc
  dở lúc chưa buffer xong. Đã đo lại bằng cách lấy mẫu 18 giây: chạy tới 13s
  rồi quay về 0,67s, `duration` báo đúng 13,82s. Suýt kết luận sai rằng video
  lặp sớm.

**Nợ mở:** `guard-build.mjs` khớp cả tiến trình chỉ *nhắc tới* `next start`
trong cmdline · `alt` rỗng toàn site (`media_assets.alt` null) · thẻ "Southern
Vietnam" dùng ảnh thúng chai vốn là đặc trưng miền Trung và thẻ "All of
Vietnam" dùng vịnh Hạ Long vốn là biểu tượng miền Bắc — user đã cân nhắc và
chốt giữ cả hai · 25/30 tour chưa có cover · gallery địa danh 5/19 · 5/29 khe site
còn trống (`home-experiences`, `home-trust`, `content-hero`,
`destinations-hero`, `auth-panel`).

Tests after: 1218 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-17 — /about gần đủ ảnh: Story + Gallery + Timeline + đội ngũ thật, và một lỗi định vị ẩn kỹ ở `SlotImage` (nhánh `feat/about-images`, `d407b59`+`4325bc4`, 15 file, +272/−43)

`/about` từ **1 ảnh thật / 15 ô giữ chỗ** xuống còn **2 ô** (nền Numbers và
video CTA). Khe site lên **28**.

**ĐÍNH CHÍNH entry 17/08 phía dưới — số đo panel `/contact` trong đó SAI.**
Entry đó ghi *"card khoá 1024px ở MỌI bề rộng 1280→2560, nên panel luôn
511×790"*. Nguyên nhân: `context.newPage()` của Playwright **không nhận tham
số** — tôi truyền `{viewport}` vào đó nên nó bị bỏ qua lặng lẽ và MỌI lần đo
đều chạy ở mặc định 1280×720. Vì mọi lần đo đều cùng một bề rộng nên kết quả
"giống nhau ở mọi viewport" trông rất thuyết phục. Số đúng: panel cao cố định
790 nhưng rộng theo card, tỉ lệ trải **0.65 ở 1280 · 0.75 ở 1440 · 0.81 từ
1920 · 0.36 ở tablet 768**. Trớ trêu là 0.81 mới đúng cho desktop rộng — con
số ban đầu đúng, "sửa" thành 0.65 mới là bước lùi. Entry cũ giữ nguyên theo
luật bất biến; `media-tree.mjs` đã sửa. **Bài học: một thước đo cho kết quả
giống hệt nhau ở mọi điều kiện là dấu hiệu thước hỏng, không phải phát hiện.**

**Lỗi thật, và nó ẩn được lâu vì hai nhánh của cùng một component không giống
nhau.** `SlotImage` bọc `next/image` với `fill`, mà `fill` định vị theo tổ
tiên CÓ `position` gần nhất. Nhánh giữ chỗ (`ImagePlaceholder`) vốn tự mang
`relative overflow-hidden`; nhánh ảnh thật thì không, nó chỉ đổ thẳng
`className` của caller. Nên caller nào quên `relative` vẫn chạy êm suốt thời
gian khe còn trống, và **chỉ vỡ đúng lúc gắn ảnh thật vào**. Lộ ra ở §Team:
ô 302×320 mà ảnh render **1440×900** — đúng bằng viewport, nhìn ra như ô
trắng. Vá bằng `cn('relative overflow-hidden', className)`; dùng `cn`
(twMerge) chứ không nối chuỗi để caller cần `absolute inset-0` như
`about-story` vẫn ghi đè được. Hai test khoá cả hai chiều đó.

**Nhãn ảnh phải nói cùng một thứ với ảnh.** Nhãn của `ImagePlaceholder` thành
`alt` khi khe có ảnh, nên đổi ảnh mà quên nhãn là để alt nói dối. Đổi hai:
mốc 2017 từ *"lanterns on the Thu Bồn river"* sang *"bánh mì, Hội An"*, mốc
2021 từ *"Cái Răng floating market at dawn"* sang *"island dusk over Phú
Quốc"*.

**Hai lần đổi chủ đề, và lý do đáng ghi hơn kết quả.** Mốc 2017 bỏ đèn lồng vì
ba cớ cộng lại: ở dải 512×208 tường đèn lồng thành mảng màu rối không có điểm
nhìn; trùng đăng ký với hero Hội An trên trang chủ; và chữ của mốc nói
*"lantern rivers"* — đèn thả trên sông, không phải đèn treo bán. Bánh mì neo
được miền Trung qua bánh mì Phượng Hội An. **Phở thì không dùng ở mốc này** —
đó là món Hà Nội, đặt vào mốc "mở miền Trung" là lệch vùng. Mốc 2021 bỏ chợ
nổi vì kho ảnh miễn phí gần như không có tấm dùng được; lối ra nằm sẵn trong
chính copy của mốc: *"island dusk after"*.

**Ứng viên 2026 bị loại vì trùng lần thứ ba.** Tấm user gửi là Hanoi Train
Street — nơi đã dùng ở thẻ Hà Nội trang chủ VÀ bìa bài *"Crossing Hanoi"*.
Chuyện trùng hai lần đó chính entry 17/08 phía dưới đã ghi là nợ mở, nên thêm
lần ba là làm nặng thêm món nợ vừa ghi nhận. Đổi sang nhóm nhỏ đi trên bờ
ruộng sen giữa núi đá.

**Đội ngũ chuyển sang NGƯỜI THẬT** (4 thành viên nhóm capstone). Ba việc đi
kèm, không phải chỉ thay chuỗi:
- Tên cũ còn nằm ở **5 trang auth** dưới dạng tác giả câu trích. Không đổi thì
  site hiện lẫn lộn hai bộ tên.
- Bỏ hết quan hệ gia đình trong phần giới thiệu (*"The elder brother"*, *"The
  younger brother"*, *"The neighbour"*). Gán quan hệ anh em bịa cho nhân vật
  hư cấu là một chuyện; gán cho người có tên thật là chuyện khác. Câu *"two
  brothers and a neighbour"* ở §Story giữ nguyên vì nó không nêu tên ai.
- Bỏ con số *"560 departures"* khỏi dòng của Head of Operations — số cứng nằm
  trong copy, đúng loại lỗi entry 14/08 đã ghi.

**Avatar: KHÔNG dùng mặt thật** (quyết định user — riêng tư). Dùng DiceBear,
bộ `voxel-bot` ở **API 10.x** (bộ này không có ở 9.x), giấy phép CC0 1.0 nên
không cần ghi nguồn. Hai điều đo được: API chặn PNG ở **256px** nên phải lấy
SVG rồi rasterize bằng trình duyệt lên 800px; và preset **"Animated" KHÔNG lấy
được qua HTTP API** — tài liệu ghi API chỉ trả ảnh tĩnh, thử
`preset=animated`/`animated=true`/`motion=true` đều trả SVG không có thẻ
animation nào.

**Hover: bỏ ý skeleton, giữ ý "rê vào thì rõ".** User đề xuất skeleton mặc
định, hover mới hiện ảnh. Không làm, vì hai lẽ: skeleton là tín hiệu ĐANG TẢI
nên dùng làm trạng thái vĩnh viễn là dạy sai người dùng; và **hover không tồn
tại trên máy cảm ứng** nên khách mobile sẽ mất hẳn nội dung. Bản đã ship: xám
lúc thường, bừng màu khi rê — và `[@media(hover:hover)]` bọc riêng phần xám,
vì không bọc thì avatar trên điện thoại xám VĨNH VIỄN (không có hover để gỡ
ra). Đo cả hai chiều: desktop `grayscale(1)` → `grayscale(0)`; cảm ứng `none`.

**Chạy lại `media:upload` là vô hại — đo chứ không đoán.** Script upload cả 39
file mỗi lần chạy chứ không lọc, nên có lo nó đổi `version` của mọi ảnh cũ và
bust sạch CDN. Chụp version trước/sau: **0 đổi, 47 giữ nguyên, 1 mới**.
Cloudinary trả lại đúng version cũ khi bytes không đổi.

**Nợ mở:** trang đăng ký ghi *"four friends"* trong khi §Story và mốc 2014 đều
ghi *"three guides"* — mâu thuẫn có sẵn, sửa một chữ · `alt` rỗng toàn site vì
`SlotImage` đọc alt từ `media_assets.alt` mà cột đó null cho mọi ảnh (với ảnh
trang trí cạnh chữ mô tả thì alt rỗng hợp chuẩn, nên không gấp) · thẻ
"Southern Vietnam" dùng ảnh thúng chai — đặc trưng miền TRUNG, user cân nhắc
và chốt giữ · thẻ "All of Vietnam" dùng vịnh Hạ Long, biểu tượng miền Bắc ·
25/30 tour chưa có cover · gallery địa danh 5/19 · 2 ô /about còn trống.

Tests after: 1218 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-17 — /contact §2 gộp về MỘT card, radio thay dropdown, chữ ký tự điền (nhánh `feat/contact-split-panel`, `4f5dc6d`, 10 file, +742/−135)

Đóng phần ảnh + hoàn thiện §2 của `/contact`. Khe site lên **16** (thêm
`contact-panel`).

**Hai khối rời luôn đọc ra là hai vật thể — cân cỡ cũng không cứu được.** Bản
sáng 17/08 thêm ảnh dọc cạnh lá thư rồi đóng khung nó thành card thứ hai, và
sau đó chỉnh cho hai khung bằng kích cỡ. User vẫn bác: *"nhìn nó cứ kỳ kỳ"*.
Cân kích cỡ giải sai bài toán — vấn đề không phải hai khung LỆCH nhau mà là
có HAI khung. Mẫu [ReUI contact-2](https://reui.io/preview/base/contact-2)
giải bằng cách khác hẳn: một card duy nhất chia đôi, một nửa là panel **tràn
viền** (không padding ngoài, không viền trong), `overflow-hidden` ở card làm
ảnh chạm sát mép và bo theo góc card.

**Wireframe chép 1:1 TRƯỚC khi đụng code**, số đo trích bằng `getComputedStyle`
trên chính trang gốc chứ không ước lượng bằng mắt:
[contact-2](../design/mockups/contact-reui-2.src.html) và
[contact-5](../design/mockups/contact-reui-5.src.html), rồi
[bản ghép](../design/mockups/contact-split-panel.src.html) lấy bố cục của -2 và
hàng thông tin có icon của -5. Đảo vế so với mẫu (panel nằm TRÁI) để giữ thứ
tự đọc sẵn có của trang.

**Dropdown vùng → 4 radio** (`Anywhere`/`Northern`/`Central`/`Southern`), lưới
2×2, `<fieldset>` với `<input type="radio">` thật ẩn bằng `sr-only` nên bàn
phím và trình đọc màn hình dùng được nguyên bản. Đo trên trang thật: thẻ cao
731 → 792 (**+61px**, nhiều hơn ước tính 26px của tôi vì mỗi ô mang viền và
padding riêng).

**Chữ ký điền sẵn tên khách đã đăng nhập**, để trống khi chưa. Cờ `filledOnce`
là phần đáng nói: `useSession` trả về BẤT ĐỒNG BỘ, nên khách hoàn toàn có thể
gõ xong tên trước khi session tới — không chặn thì lần điền muộn sẽ xoá thứ họ
vừa gõ. Và khách cố ý xoá trắng ô (gửi hộ người khác) cũng không bị điền lại.
Nghiệm thu bằng trình duyệt thật với cookie session thật, cả hai trạng thái;
`customer@tourism.test` trong seed **không đăng nhập được** vì tạo thẳng bằng
Prisma nên không có mật khẩu Better Auth — phải đăng ký tài khoản mới để đo.

**Doc lệch code, sửa doc:** mô tả khe `contact-panel` trong `media-tree.mjs`
còn ghi *"DẢI RẤT NGANG, 1600×640 (2.5:1)"* — đó là bố cục cũ. Đo lại: card
khoá cứng **1024px** ở mọi bề rộng 1280→2560, nên panel luôn **511×790**, tức
ảnh DỌC 2:3. Để nguyên là gài bẫy người chọn ảnh lần sau.

**Review findings (tự bắt):**

- **Typecheck đỏ vì mock tự chốt kiểu.** `vi.fn(() => ({ data: null }))` khiến
  TS suy ra kiểu trả về đúng bằng `null`, nên ca "đã đăng nhập" không gán được
  `{ data: { user } }`. Khuôn đúng của repo là `vi.fn()` trần rồi set trong
  `beforeEach` (xem `user-menu.spec.tsx`). Nhắc lại lý do phải chạy `gate:int`
  chứ không chỉ `pnpm test`: bộ test XANH trong khi typecheck ĐỎ.
- **Thước đo tương phản tự chế cho số VÔ NGHĨA, đã vứt.** Lấy pixel tệ nhất
  trong ô bao từng dòng chữ thì đo trúng nền ở **khe hở giữa các chữ**, không
  phải nền dưới nét chữ; cả sáu ứng viên panel đều ra 1.00 y hệt nhau — dấu
  hiệu lỗi thước chứ không phải phát hiện. Đây là biến thể của cùng một cái bẫy
  đã mắc ở đợt đo hero. Với chữ lớn trên ảnh, chỉ vùng bám nét chữ mới dùng
  được.
- **Ảnh `contact-panel` là bản đồ đường bộ Mỹ.** Ở khung thật phóng 2x đọc rõ
  ARKANSAS/MISSOURI/MISSISSIPPI và lá cờ Mỹ; tôi từng duyệt tấm này ở kích
  thước cũ nhỏ hơn nên **rút lại đánh giá đó**. Đã dựng 6 phương án thay bằng
  ảnh địa danh dự án SẴN CÓ (9 hero đều là ảnh dọc, Hà Nội/Sa Pa/Hội An đúng
  tỉ lệ 0.67). **User cân nhắc và chốt GIỮ NGUYÊN** — khách du lịch là người
  nước ngoài, đồ vật quen thuộc cũng hợp, và đây không phải dự án kinh doanh
  thật.

**Nợ mở:** 25/30 tour chưa có cover · 5 khe site còn trống (`home-experiences`,
`home-trust`, `content-hero`, `destinations-hero`, `auth-panel`) · gallery địa
danh mới 5/19 nên nhánh 7-thumb của `TourMediaPanel` vẫn chưa bao giờ render
từ dữ liệu thật · dải `Partners` vẫn nêu tên báo thật kèm chữ "as featured in"
(user đã cân nhắc và chọn giữ).

Tests after: 1216 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-17 — Nhánh ảnh bài viết: 9 ảnh bìa lên /blog, một mắt xích thiếu ở view-model (trực tiếp `main`, 9 file, +94/−12)

`/blog` là bề mặt cuối còn trắng trơn. Đóng nó bằng **9/9 ảnh bìa**, và nhân
đó mở nhánh ảnh bài viết mà cây thả ảnh còn nợ từ đợt đầu (README của cây tự
ghi *"chưa dựng cây — làm sau"*).

**Ba script đều chưa biết gì về bài viết** — `media:fetch` từ chối đích
`posts/…`, `media:tree` không dựng thư mục nào, `media:scan` không lập kế
hoạch. Mở cả ba, cộng `ownerType: POST` cho bước upload.

**Nhánh `posts/` KHÔNG nằm dưới địa danh.** Một bài có thể nói về nhiều nơi,
hoặc không nơi nào — bài *"when to come, and when not to"* là về thời tiết cả
nước. Xếp nó vào cây địa danh là dựng một quan hệ không có thật. Cũng vì vậy
**không có luật rơi-về** ở nhánh này: bài thiếu ảnh thì thẻ giữ chỗ, không
mượn của ai.

**Mắt xích thiếu, và nó nằm ở chỗ ít ai nghĩ tới.** `PostCardSchema.cover` đã
có trong contract từ [ADR-0020](../adr/0020-real-images-sourcing.md) §6, enum
`MediaOwnerType.POST` đã có trong schema — nhưng view-model `JournalPost` của
web **bỏ rơi `cover`**: `mapCommon()` không chép field đó sang. Nghĩa là dù DB
có ảnh, component cũng không bao giờ thấy. Hạ tầng đủ hai đầu mà đứt ở khúc
giữa; chỉ lộ ra khi đi lần từng chặng.

**Một ảnh bìa phải sống sót qua BA khung**, đo trên trang thật: thẻ nổi bật
781×384 (**2.03**), thẻ thường 379×224 (**1.69**), hero trang bài 1440×372
(**3.87**). Khung 3.87 cắt trên/dưới mạnh nhất nên chủ thể phải nằm ở dải
giữa. Luật này ghi thẳng vào `NEEDED.md` của từng bài để lần sau khỏi đo lại;
sàn cỡ riêng cho loại đích này là 1600×900.

**Đo được và ghi lại, chưa sửa:** lớp phủ hero trang bài là
`from-background via-background/90 to-background/60` — 90% ở giữa. Ảnh gắn vào
chỉ hiện mờ như một lớp vân; phần lớn giá trị của tấm bìa nằm ở **thẻ trên
/blog**. Nới lớp phủ là đổi thiết kế nên để user quyết, không tự làm.

**Ảnh chèn trong thân bài: CHƯA cần.** `react-markdown` + `remarkGfm` render
`![alt](url)` sẵn, nên rào cản không phải kỹ thuật. Nhưng đo nội dung thật:
mỗi bài **~300 từ, 4–5 mục, 2 phút đọc** — thêm 3–4 ảnh vào 300 từ thì ảnh
nhiều hơn chữ. Ngưỡng đáng làm: bài dài lên 800+ từ, hoặc riêng hai bài ẩm
thực (gọi tên món cụ thể nên ảnh THÊM thông tin chứ không trang trí).

**Nợ mở:** `content-hero` vẫn là khe không có consumer — `ContentHero` chưa
bao giờ có ô ảnh (chỉ `bg-hero` + gradient + topo) và nó dùng chung ở **11
trang**, nên thêm ảnh ở đó là quyết định 11-trang chứ không phải việc của
/blog · ảnh bài *"Crossing Hanoi"* trùng chủ thể (Train Street) với thẻ địa
danh Hà Nội ở trang chủ · ảnh bài Đà Nẵng rất tối nên gần như biến mất dưới
lớp phủ hero · 25/30 tour chưa có cover · 5 khe site còn trống.

Tests after: 1213 web · 219 api · 180 api-int · 86 contract · 22 ui · 10
tokens và 2 i18n.

## 2026-08-14 — Home đủ ảnh, và ba lời hứa sai bị bắt trên đường (trực tiếp `main`, 16 file, +144/−45)

Đóng trọn phần ảnh của trang chủ: **9/9 thẻ địa danh**, **5/5 slider khoảnh
khắc**, **6/6 khối "why choose us"**, `cta-band`. Khe site lên **15** (thêm
`why-guide`/`why-food`/`why-river`/`why-evening`/`why-heritage`).

**Ba lời hứa sai, tìm ra bằng cách đối chiếu chữ với DỮ LIỆU chứ không đọc
lướt.** Đây là phần đáng giá nhất của đợt này, không phải mấy tấm ảnh:

- **"Small groups, twelve max" — sai ở 14 chỗ.** Đo trên 30 tour: chỉ 11 tour
  có `maxGroupSize ≤ 12`; **19 tour vượt**, cao nhất **22**. Mà site khẳng định
  con số đó rất dứt khoát — FAQ viết *"It is the one number we have never
  bent"*, About viết *"never more"*, cộng ticker, Contact, timeline, và cả một
  review của khách khen đúng điều đó. Chốt với user: **bỏ hẳn con số** khỏi lời
  hứa chung, vì `maxGroupSize` là dữ liệu từng tour do admin đặt theo loại xe;
  số thật đã hiện ở trang chi tiết (`overview-panel` — đã kiểm).
- **"Support around the clock" — chính site tự phủ nhận.** `mocks/offices.ts`
  khai giờ làm việc `Mon–Fri · 8:00 am – 6:00 pm (GMT+7)`, `contact-hero` viết
  *"replies within the hour, Monday to Friday"*. Câu 24/7 đã bị BỎ.
- **"Free cancellation up to 48h" — không có con số chung.** 15/30 tour đặt mốc
  bằng NGÀY, 15 tour còn lại bằng GIỜ, mốc khác nhau.

**Năm mục `why-choose-us` thay trọn.** Bản cũ trộn hai loại: hai mục kể trải
nghiệm, ba mục nêu chính sách. Ba mục chính sách hỏng ở cả hai đầu — trang đặt
tour nào cũng nói y hệt, và **không tồn tại bức ảnh nào minh hoạ được "không
phí ẩn"**, trong khi đây là khối mà ảnh chiếm nửa bố cục. Năm mục mới chọn theo
số đo trên 30 tour (ẩm thực 30/30 · sông nước 21/30 · đêm 19/30 · lối mòn 17/30
· di sản 13/30), mỗi mục một chủ thể ảnh rời nhau.

**`trust-strip.tsx` mới** — ba huy hiệu chuyển về đây, đặt ngay trước dải CTA
(chỗ người dùng quyết định). Câu chữ viết theo dữ liệu: *"No booking fees"* là
câu mạnh nhất vì đúng tuyệt đối (`computeBookingTotal` chỉ nhân giá với số
khách, mô hình không có dòng phí nào).

**`SlotImage` chặn URL ngoài `res.cloudinary.com`.** `buildCloudinaryUrl` có
escape-hatch cố ý (ADR-0005 §2) trả nguyên URL tuyệt đối, còn `next.config.ts`
chỉ khai `remotePatterns` cho Cloudinary — một row dữ liệu dùng escape-hatch đó
sẽ làm `next/image` ném `Invalid src prop`, giết trang lúc prerender. Nay rơi về
`<img>` thường: mất tối ưu thì phiền, sập trang vì một row thì hỏng. 4 test mới
khoá hành vi này.

**`media:upload` cập nhật `width/height/bytes/format` ở nhánh `DO UPDATE`.**
Thiếu mấy cột này thì THAY ảnh để lại số đo của ảnh cũ trong khi URL đã trỏ ảnh
mới — sai lệch câm. Đo được: cover Hạ Long còn ghi 2816×2112/1674KB của tấm đã
bị thay, thật ra là 2400×1600.

**Bỏ mọi con số khe viết cứng** trong `media-tree` — nó đã lệch ba lần
(9 → 10 → 15), mỗi lần phải sửa vài chỗ rời nhau.

**Nghiệm thu:** `gate:int` xanh 18/18 + 5/5. Smoke 12 route bằng trình duyệt
thật — tất cả 200, **0 ảnh hỏng, 0 lỗi console, 0 request ≥400**. Tương phản
caption 9 thẻ địa danh: thấp nhất Cần Thơ 5.17:1, cao nhất Sa Pa 16.19:1, đều
trên ngưỡng 4.5.

**Nợ mở:** 6 khe site còn trống (`about-story` · `auth-panel` ·
`home-experiences` · `home-trust` · `content-hero` · `destinations-hero`) ·
26/30 tour chưa có cover · gallery địa danh mới 5/19 nên gallery 7-thumb của
trang tour vẫn chưa render từ dữ liệu thật · dải `Partners` chạy tên báo có
thật kèm nhãn *"featured by travel storytellers worldwide"* — user đã cân nhắc
và **cố ý giữ** (capstone, ưu tiên hiệu ứng hình ảnh).

Tests after: 1213 web · 219 api · 180 api-int · 86 contract · 22 ui · 10 tokens
và 2 i18n.

## 2026-08-14 — Ảnh thật lên site: cây thả ảnh media-inbox, ba script fetch/scan/upload, sáu khe đã nối (branch `feat/media-inbox`, ff-only, 7 commit `6e44a04..da0fde4`, 22 file, +1254/−36)

Mở lại khâu ảnh thật sau khi lô 189 ảnh tự động bị từ chối trọn hồi 08/08
([ADR-0020 bản sửa](../adr/0020-real-images-sourcing.md)). Lần này **người chọn,
máy chỉ khuân**: user gửi link ảnh, script tải về đúng chỗ trong cây, in bảng
duyệt, rồi mới upload. Đó chính là hai điều bản sửa bắt buộc — cửa lọc theo
CHỦ THỂ và duyệt mắt đứng TRƯỚC upload — dựng thành quy trình chạy được thay
vì một lời dặn.

**Ba script tách rời, và việc tách là có chủ đích.** `media:tree` dựng 69 thư
mục + file hướng dẫn theo DB; `media:fetch` tải từ `LINKS.txt`; `media:scan`
**chỉ báo cáo, không upload, không ghi DB**; `media:upload` đọc `--json` của
scan. Ranh giới scan↔upload chính là chỗ con người chen vào — lần trước bảng
duyệt dựng SAU khi đã đẩy 189 tấm lên CDN nên dọn tốn gấp nhiều lần.

**Luật rơi-về là thứ làm cây sống được với số ảnh có hạn.** Gallery của tour
rơi về gallery của ĐỊA DANH khi tour chưa có ảnh riêng: một bộ ảnh Hội An tử
tế phục vụ cả trang địa danh lẫn 6 tour đi qua đó. Không có luật này thì 30
tour × 8 ảnh = 240 tấm phải tự tìm. Đo được: 5 ảnh thả vào 5 gallery địa danh
sinh ra 22 chỗ gắn, trong đó 9 chỗ dùng lại file đã có trên CDN.

**Khe thứ 10 `about-hero`.** Hero /about là bề mặt ảnh lớn nhất mà 9 khe
thương hiệu không có mục nào trỏ tới. Nhân đó bỏ số 9 viết cứng trong bảng
đếm của `media:scan` — tổng số khe nay đếm từ `site_media_slots`, nơi duy
nhất biết đủ danh sách.

**Slider khoảnh khắc lấy `cover` của TOUR, không phải của địa danh** — dù mỗi
khoảnh khắc đều thuộc một nơi. `DestinationSchema.cover` cố ý chỉ có một tấm
dành cho tile 4/5 DỌC, còn ô slider là 4/3 NGANG; ép hai bề mặt dùng chung
một ảnh thì một trong hai chắc chắn bị cắt hỏng. Contract giữ nguyên, không
nở thêm field nào.

**Bốn caption trong `moments.ts` sửa cho khớp ảnh** thay vì đi săn ảnh khớp
caption. Chúng hứa những thứ ảnh không có ("golden hour", "bếp vườn của chị
Lan"). Test chỉ khoá trường `credit` (phải nhắc đúng tên tour), `title` tự do.

**Một tấm bị từ chối vì [ADR-0020 §7](../adr/0020-real-images-sourcing.md), và
lý do đáng ghi.** Ảnh Hội An có một phụ nữ nhận diện rõ mặt đứng giữa khung;
gắn vào caption "Emma, Hội An Lantern Evening" là trình bày người thật thành
khách hàng bịa — cùng loại với ảnh "đội ngũ" mà §7 đã cấm. Tấm đó chuyển sang
làm ảnh ĐỊA DANH (không khai gì về cô ấy) và hoá ra vừa khít khung 4/5 dọc
của tile.

**Đo tương phản trên ảnh thật, không đổi `src` rồi thôi** — đúng dặn dò của
ADR-0020. Caption thẻ địa danh đạt 4.83:1. Một ảnh hero /about ứng viên bị
LOẠI nhờ phép đo: badge rơi từ 7.96:1 (nền tối lý tưởng) xuống 2.05:1 trên
mobile vì quầng mặt trời nằm đúng sau chữ.

**Chặn build khi server đang chạy** (`apps/web/scripts/guard-build.mjs`).
Build đè lên `.next` trong lúc một tiến trình serve từ đó làm hỏng thư mục
build IM LẶNG: build vẫn báo thành công, nhưng HTML trỏ tới chunk chưa kịp
ghi → HTTP 500 → ChunkLoadError → trang lỗi. Dính **ba lần trong ngày**, mỗi
lần điều tra lại từ đầu vì mọi dấu hiệu bề mặt đều bình thường (`curl /` trả
200, HTML đúng, gate xanh); chỉ kiểm HTTP code TỪNG asset mới lộ. Guard
**thất bại thì MỞ** — mọi lỗi khi dò tiến trình đều cho build chạy tiếp, vì
một guard làm đỏ CI còn tệ hơn con bug nó chặn.

**Nợ mở:** 1 cover tour (Hội An, cần ảnh NGANG) · 7 ảnh địa danh cho Home
(cần ảnh DỌC) · `home-experiences`/`home-trust`/`content-hero`/`destinations-hero`
chưa có consumer 1:1 · `auth-panel` dùng chung ở 4 trang auth nên cần một vòng
riêng · `why-choose-us` giữ 6 ô ảnh trong khi khe chỉ 1 ảnh, ánh xạ 1→6 là
quyết định thiết kế · ảnh bài blog chưa có nhánh nào trong cây.

Tests after: 1209 web · 215 api · 180 api-int · 86 contract · 22 ui · 10
tokens · 2 i18n.

## 2026-08-14 — Trả sổ nợ Tour Details: năm cột nội dung, ba thẻ bị bỏ sót, thu/phóng lightbox (branch `feat/tour-content-debt`, ff-only, 3 commit `cacb8d5..6e17bcc`, 22 file, +1164/−172)

Bốn món trong [sổ nợ A9–A12](../analysis/2026-08-06-backlog-no-ky-thuat.md) mở ra
sau vòng trùng tu 13/08, cộng **một chỗ bỏ sót tìm thấy giữa chừng**.
[ADR-0023](../adr/0023-tour-merchandising-fields.md) đi trước code theo luật 5.

**Bỏ sót ở R6, và vì sao nghiệm thu R9 không bắt được.** Bản duyệt có `fcard ×3`
ở cuối pane Departures; bản ship 13/08 có **0**. Bộ so R9 báo "0 lệch" mà vẫn
lọt vì nó chỉ đối chiếu **phần tử có mặt ở CẢ HAI bên** — phần tử app thiếu hẳn
thì không có gì để so nên nó im lặng. Đó là khuyết tật thiết kế của chính bộ so,
không phải rủi ro ngẫu nhiên. Thứ tìm ra là **phép đếm khối theo pane**, và nó
xác nhận các pane còn lại đếm khớp hết (`dep-stat ×4`, `tl-item ×4`, `bar ×5`,
`rv-item ×2`, `acc-item ×5`, `pol ×1`).

**Một migration cho cả năm cột** (`fact*Note` ×4 varchar(280) + `freeCancellationDays`)
— tách hai migration cho hai cột cùng bảng là tạo drift thừa, mà migration đã
apply là bản ghi bất biến. Bốn cột RỜI chứ không một cột JSON: bốn card là bốn ô
cố định của một bố cục đã chốt, nên Zod kiểm được từng trường và admin P4 dựng
được bốn ô nhập bình thường.

**`freeCancellationDays` KHÔNG parse từ văn xuôi, và có số liệu để chứng minh.**
Đếm trên 29 policy `CANCELLATION`: regex `up to (\d+) days` chỉ bắt được **12**;
17 câu còn lại viết khác khuôn ("Cancel at least 24 hours before pickup…",
"Cancellations more than 48 hours…"). Và **15/30 tour ghi cửa sổ bằng GIỜ** chứ
không phải ngày — ép 24 giờ thành "1 ngày" là nói sai vì mốc đó tính từ giờ khởi
hành. Nên cột là `Int?`, tour tính bằng giờ để `null`, thẻ rơi về `policy.title`.

**90 tiêu đề policy.** Fixture đặt `title` bằng ĐÚNG nhãn nhóm cho cả 90 row
("Cancellation" ×30), nên UI phải bỏ eyebrow để khỏi in một chuỗi hai lần và hai
trong ba thẻ lệch tầng. Không thêm cột `headline` — đó là lỗi nội dung, không
phải thiếu trường. Mỗi tiêu đề nén đúng câu đầu của `body`, không thêm dữ kiện.
Cộng 120 câu mô tả card dữ kiện, mỗi câu bám dữ liệu của chính tour đó.

**Hai bước seed đổi sang `upsert`** (`tours`, `tourPolicies`).
`createMany({ skipDuplicates })` bỏ qua row đã tồn tại, nên sửa fixture hay thêm
cột đều **không bao giờ** tới được DB đang chạy. Đã dính đúng lỗi này giữa
chừng: seed báo thành công mà năm cột mới vẫn `null`. Seed đã có tiền lệ upsert
cho nội dung biên tập (`siteMediaSlot`/`posts`/`users`).

**Một điều về môi trường chưa từng ghi ở đâu, và nó tốn khá nhiều thời gian để
tìm ra:** `pnpm db:seed` **luôn** nạp `.env.local` nên **luôn** trỏ Supabase,
còn API chạy `node dist/main.js` **không nạp file env nào** nên rơi về Postgres
docker local. Hai bên là hai DB khác nhau — seed xong mà app không đổi là vì
vậy. Muốn seed local phải truyền `DATABASE_URL` tường minh.

**Thu/phóng lightbox (A12).** Bản duyệt có sẵn CSS cho việc này (`.lb-stage`
cursor zoom-in, `.zoomed` grab, `.dragging` tắt transition, ô `.lb-zoom`) nhưng
**không có một dòng JS nào** — hành vi là mới. Thang RỜI RẠC 1/1.5/2/3 chứ không
liên tục: nút bấm biết mình sẽ tới đâu, con số luôn tròn, hai phiên cho cùng kết
quả. Kéo để rê khi đã phóng, biên kẹp ở nửa phần thừa mỗi chiều; khung 0×0 (lần
render đầu) trả 0 chứ không `NaN` — `NaN` đi thẳng vào `transform` là ảnh biến
mất. Đổi ảnh thì zoom về gốc. **Tắt theo mặc định**: có prop `zoom` là bật, nên
trang vùng dùng chung component không bị thêm hai nút chưa ai đặt hàng.

**Pre-commit bắt đúng một chỗ a11y.** Khung ảnh ban đầu là `div role="button"`;
Biome đòi thẻ thật và nó đúng — con trỏ đã là `zoom-in` nên chuột được hứa một
cú bấm, lời hứa đó phải tới được cả bàn phím. Đổi sang `<button>` được
Enter/Space miễn phí, kèm một cờ `movedRef` phân biệt "rê" với "bấm": cú thả sau
khi kéo cũng bắn `click`, không lọc thì mỗi lần rê xong zoom tự nhảy về 100%.

**Đo lại sau khi vá**: card dữ kiện tab Overview cao **199** so với 197 của bản
duyệt (trước khi có `fact*Note` là ~110); ba thẻ Departures 3/3, lưới
`341.33 ×3` và `margin-top:32` khớp; thẻ cao 219 so với 177 vì `note` dùng TOÀN
VĂN `policy.body` thay câu viết tay ngắn của bản duyệt — giữ văn thật thay vì
cắt cụt chính sách. Lightbox: 100 → 150 → 300%, nút phóng tự tắt ở trần, đổi ảnh
về 100%, Enter trên khung cũng phóng, 0 lỗi console.

Tests after: 1724 — 1544 unit (86 contract, 10 tokens, 2 i18n, 22 ui, 215 api,
1209 web) và 180 api int. **Sổ nợ còn lại: đúng một món** — ảnh tour (A8). Nó
cần bạn duyệt bằng mắt TRƯỚC upload theo [ADR-0020 bản sửa](../adr/0020-real-images-sourcing.md),
nên không uỷ quyền được; đang chốt phương án.
