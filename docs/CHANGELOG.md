# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

> **File này chỉ giữ đợt đang chạy** (từ 15/09/2026). Toàn bộ lịch sử trước đó
> nằm ở [`changelog/`](changelog/) — 12 file theo kỷ nguyên, có
> [mục lục kể lại từng giai đoạn](changelog/README.md).
> Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`) — archive là di chuyển
> nguyên văn, không sửa một ký tự.

## 2026-09-23 — T0 mobile browse: tầng dữ liệu + primitive dùng chung, vá 6 phát hiện review cuối cụm (nhánh `feat/mobile-browse-screens`)

Entry này khép cụm T0 của P5b-2 (xem tour trên mobile) — tầng dữ liệu oRPC
`OpenAPILink` và TanStack Query cho `apps/mobile`, cộng sáu primitive dùng
chung mới ở `@tourism/mobile-ui` (`SearchField`, `Chip`, `BottomSheet`,
`AppImage`, khả năng "load lỗi" gộp vào `EmptyState`, tab bar có icon). Quyết
định kiến trúc ở [ADR-0047](adr/0047-mobile-data-layer.md), kế hoạch thi công
ở [plan T0](plans/2026-09-23-mobile-browse-t0-data-layer.md). **T1–T7 (các
màn xem tour thật) vẫn CÒN TREO** — T0 chỉ là hạ tầng, chưa màn nào nối dữ
liệu thật.

Vòng review cuối cụm tìm sáu phát hiện, vá cả sáu trong lượt này:

1. Biến thể `removable` của `Chip` không tới được VoiceOver — `Pressable`
   ngoài gộp hết con cháu thành một khối chọn duy nhất, nuốt mất nút "x" lồng
   bên trong. Chốt: đổi vỏ ngoài của biến thể này thành `View` thường, chỉ nút
   "x" còn là `Pressable`.
2. Vùng chạm 32dp của `Chip` chưa đạt `touchTargetMin` (44dp). Thêm `hitSlop`
   cho các `Pressable` còn lại sau khi vá mục 1, không đổi chiều cao nhìn thấy
   (mockup ấn định 32dp).
3. `apps/mobile/src/lib/api/client.ts`: fetch wrapper đè mất signal huỷ của
   caller bằng một `AbortSignal.timeout(10_000)` riêng. Đọc thẳng mã nguồn
   `@orpc/client`/`@orpc/standard-server-fetch` xác nhận signal của caller
   nằm ở `request.signal` (không phải `init.signal` như phỏng đoán ban đầu
   của review — `init` ở đây luôn là hằng `{ redirect: 'manual' }`). Chốt
   ghép hai signal bằng `AbortSignal.any`.
4. ADR-0047 lệch code thật ba chỗ (tên component `LoadErrorState` chưa từng
   tồn tại riêng, cơ chế `transformUrl` của `AppImage`, số dependency thêm
   vào `apps/mobile`). Vá bằng AMEND 1 trong chính ADR, không sửa quyết định
   gốc.
5. `AppImage.transformUrl` (mặc định identity, đúng ý ADR-0040 §2) chưa có
   nơi ghép thật với `cloudinaryUrl()` ở tầng app. Thêm module ghép ở
   `apps/mobile/src/components/app-image.tsx`, kèm một test xác nhận
   `source.uri` có đúng segment transform Cloudinary.
6. Sweep docs sau merge còn thiếu (luật 13): entry này, dòng ADR-0047 vào
   bảng ADR ở `docs/README.md`, và thêm plan T0 vào mục Plans cùng file.

**Review findings:** 6/6 đã vá trong lượt này — chi tiết ở trên, không phát
hiện nào bị bỏ lại.

Tests after (mobile-ui): Jest 18 suite, 107 test — bốn ca `Chip` giữ nguyên
sau khi đổi vỏ biến thể `removable`. Tests after (mobile): Jest 34 suite, 173
test — thêm một ca mới cho module ghép `AppImage`/`cloudinaryUrl()`.
`tsc --noEmit` xanh ở cả hai package, `check-mobile-tokens-only.mjs` xanh (75
file nguồn, không màu viết tay nào).

## 2026-09-23 — Thử tay F14 trên production: 8/8 bước đạt, bốn mục vá (nhánh `fix/p4e-2-f14-manual-test`)

Lượt thử tay chạy NGAY sau merge F14 thay vì đợi F15 như plan ghi: F14 đã
chạy thật, còn F15 sẽ chép lại cách làm của nó, nên lỗi tìm được lúc này là
lỗi F15 khỏi phải lặp. Tám bước, mỗi bước chờ người thử xác nhận, và sau mỗi
lệnh ghi thì đối chiếu thẳng với DB production.

**Không tạo danh mục thật.** Hệ thống cố ý không có nút xoá, nên một hàng
"test" sẽ nằm lại vĩnh viễn, kể cả lúc bảo vệ. Thay vào đó:
`seasonal-classics` (đang ẩn sẵn, 0 tour) để thử chip không có tour, và ẩn rồi
hiện `trekking` (5 tour) để thử đường "danh mục đã ẩn". Form tạo vẫn được kiểm,
chỉ là bấm Cancel. Cuối lượt DB khớp TUYỆT ĐỐI trạng thái gốc — sáu `order`
không trùng, trạng thái bật/tắt và số tour như cũ.

**Ba lỗi của vòng review F14 ở đường "ẩn danh mục" — đã kiểm tận mắt là hết.**
Link cũ `/tours?categories=trekking` vẫn lọc đúng 5 tour, chip đang bật in
"Trekking & Adventure" chứ không phải slug, ô facet được bù vào cuối và đang
tích nên bỏ được. Menu lọc bên back office vẫn có danh mục đã ẩn. Đường nối
"thứ tự admin đặt → thứ tự chip của khách" chạy đúng từ đầu tới cuối.

**Bốn mục lượt thử tìm ra, đã vá cả bốn:**

1. **Cụm nút lệch cột** (góp ý của người thử). Hide và Show rộng khác nhau, mà
   cụm nút canh phải, nên hàng mang nhãn hẹp hơn kéo mũi tên và nút Edit lệch
   khỏi cột. Màn chuyến khởi hành lệch nặng hơn: nút "Cancel departure" chỉ có
   ở hàng chưa khởi hành. Người thử đề xuất tách mỗi nút một cột bảng. Bản vá
   xử cùng cái gốc mà không phải xẻ `DepartureRowActions` — component chứa nút
   huỷ chuyến có hoàn tiền — chỉ để sửa bố cục: mỗi ô nút luôn chiếm bề rộng
   của trạng thái rộng nhất của nó (kit `StableLabel` mới), và hàng thiếu nút
   huỷ giữ một ô trống cùng cỡ.
2. **Câu lỗi slug nói sai luật.** Câu cũ bảo gạch nối được phép, trong khi gõ
   đúng một dấu `-` lại bị từ chối — vòng review siết khuôn slug mà câu báo
   lỗi không theo kịp. Câu mới kèm một ví dụ, và có ca test ghim rằng ví dụ ấy
   hợp lệ.
3. **Ô slug bị soát chính tả** — trình duyệt gạch đỏ `dao-phu-quoc`. Đã tắt,
   cùng tự viết hoa và tự sửa chữ trên bàn phím điện thoại.
4. **Câu cảnh báo trấn an mà tô đỏ.** Hộp ẩn danh mục tô đỏ cả câu "tour vẫn
   bán, link vẫn chạy" — màu nói ngược với chữ. Kit `ConfirmWriteDialog` nhận
   thêm `warningTone`, mặc định vẫn đỏ; hộp danh mục xin giọng trung tính. Kèm
   theo: menu lọc danh mục ở `/tours` nay đánh dấu "(hidden)" cho danh mục đã
   ẩn, để admin biết vì sao nhóm tour ấy không có chip trên web.

**Một lỗ test lượt đột biến bắt được:** `fetchTourCategories` chưa từng có
test, nên gán cứng `isActive: true` ở đó thì dấu (hidden) chẳng bao giờ hiện
mà không ca nào đỏ. Thêm spec theo khuôn mock client của `bookings.spec.ts`.

**Bố cục cần mắt người.** jsdom không dàn trang, nên việc cụm nút đã thẳng cột
chưa được test tự động nào chứng minh — bước kiểm cuối là nhìn trên production
sau khi deploy.

Plan F15 cập nhật theo: bài học 8 ghi câu lỗi slug đã sửa, thêm bài học 13
(`StableLabel`) và 14 (`warningTone`).

**Review findings:** không có vòng review riêng — đây là bản vá từ lượt thử tay.

Tests after: Vitest **3979** (web 1533, api 978, admin 1013, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**. Mười lăm ca mới ở
admin. Tám đột biến đều bị giết.

## 2026-09-23 — Merge F14 lên main (`892de4e8`)

Nội dung của lượt merge này đã kể đủ ở HAI entry ngày 22/09 ngay bên dưới —
"F14 quản trị danh mục tour" và "Vòng review F14". Entry này chỉ ghi sự kiện
merge, vì hai entry kia viết TRƯỚC merge nên chưa mang hash.

Nhánh `feat/p4e-2-categories` rebase lên `fa297460` (bản dọn `isValidDate` từ
một session song song) rồi fast-forward: 11 commit, không xung đột,
`pnpm gate:int` chạy lại xanh trên đỉnh mới trước khi đẩy. Không migration,
nên không có bước Supabase nào.

**Vì sao cần entry này — và vì sao CI lần đẩy đầu đỏ.** `docs-freshness.sh`
lọc commit theo NGÀY COMMIT (`git log --since`). Rebase ghi lại ngày commit
của cả 11 commit thành ngày rebase (23/09), còn entry mới nhất vẫn mang ngày
làm việc (22/09) — nên script thấy tám commit `feat`/`fix` "mới hơn" entry
cuối và đỏ, dù nội dung đã được kể. Bẫy này sẽ lặp lại MỖI KHI một nhánh viết
entry hôm trước rồi rebase-và-merge hôm sau. Cách tránh: viết entry vào đúng
ngày merge, hoặc thêm một entry merge ngắn như entry này.

Tests after: không đổi so với entry vòng review — Vitest **3964**, int
**596 ở 43 file**, đo lại trên đỉnh sau rebase.

## 2026-09-22 — Vòng review F14: mười lăm phát hiện, ba nhóm, ba cái gốc (nhánh `feat/p4e-2-categories`)

Vòng review chạy TRƯỚC merge, mười góc tìm cộng một lượt quét sót. Mười lăm
phát hiện, nhưng chúng gom về ba gốc chứ không phải mười lăm chỗ vá.

**Gốc thứ nhất — không ai bảo đảm mỗi lúc chỉ một người ghi thứ tự.** Năm phát
hiện quanh cột `order`. `move` đọc hai hàng RỒI mới `SELECT … FOR UPDATE`, nên
khoá xếp hàng người ghi mà không bảo vệ giá trị đã đọc: hai lượt trên hai cặp
giao nhau — (2,3) và (3,4) — để lượt sau ghi bằng ảnh chụp cũ, và vì cột ấy
không unique nên hai hàng cùng số sống chung im lặng, vĩnh viễn. JSDoc ngay
trên hai câu UPDATE khẳng định ngược lại. `create` tính `max + 1` cũng đua.
`assertSlugFree` là SELECT pre-flight, mà READ COMMITTED không serialize hai
INSERT — nên slug trùng thoát ra thành `P2002` trần, tức 500, tức admin phân
loại `GENERIC` rồi mất cả form vừa gõ. Và cờ đổi-chỗ ở phía client là state
của MỘT hàng, nên một admin bấm nhanh hai hàng là đủ gây đua, không cần hai
người.

Vá bằng một câu thay vì ba miếng dán: `withCategoryOrderLock`, khoá advisory
cấp bảng, cùng khuôn `withBookingRefundLock` (ADR-0006 AMEND 2b). Mọi lệnh đọc
nằm SAU khoá theo CẤU TRÚC, nên `move` hết stale read, `create` hết đua, và
`assertSlugFree` từ một lời hứa hão thành đúng thật. `FOR UPDATE` thô, phép
`.sort()` theo id và nhánh `CannotMoveError` không-thể-xảy-ra chết theo. Ba
lớp lưới cho đường không đi qua khoá: bắt `P2002`, bắt `P2025` (thay
`assertExists` + `update` vốn là check-then-act, bớt luôn một vòng mạng), và
khoá phụ `{ id: 'asc' }` ở cả hai đường đọc danh mục.

**Gốc thứ hai — web và admin đọc `is_active` bằng hai nghĩa khác nhau.** Ba
phát hiện. Menu lọc `/tours` của chính back office vẫn đọc endpoint CÔNG KHAI,
nên từ khi F14 có nút Hide, ẩn một danh mục là mất luôn cách lọc ra các tour
thuộc nó để đi sửa — đúng lúc cần nhất. Ở trang khách, một danh mục vừa ẩn thì
chip đang bật in slug máy và thẻ facet không có ô nào để bỏ tick, dù link cũ
vẫn lọc đúng. Và câu phụ đề "thứ tự ở đây là thứ tự khách nhìn thấy" nói sai,
vì bảng admin xen cả hàng ĐÃ ẨN còn trang khách lọc chúng đi.

Vá: menu back office đổi sang `admin.categories.list` (JSDoc ở đó đã hẹn
"P4e-2 sẽ thay nguồn" — P4e-2 chính là nhánh này). Trang khách tách "danh sách
chip nào tồn tại" khỏi "chip đang bật tên là gì", gom vào `resolveCategoryOptions`;
hàm ấy cũng phân biệt lời gọi HỎNG (`null`) với mảng rỗng hợp lệ, nên một lượt
500 của `/api/categories` không còn xoá sạch thẻ facet khỏi trang đang sống.
Câu phụ đề viết lại cho đúng.

**Gốc thứ ba — chỗ tự gây, và mấy cái nói sai.** `slugifyVietnamese` nuốt mất
`Ð`/`ð` (U+00D0, ETH) vì chỉ xử `Đ`/`đ` (U+0110): hai cặp vẽ y hệt nhau mà
TCVN3/VNI vẫn sinh ra cặp đầu, nên admin thấy tên ĐÚNG còn slug mất chữ đầu —
và slug khoá vĩnh viễn sau khi tạo. Regex dấu phụ viết bằng ký tự tổ hợp THÔ,
vô hình với mắt lẫn với diff; đo bằng `cat -A` thì viết escape cũng không
thoát, công cụ ghi file đổi nó thành ký tự thô, nên chuyển hẳn sang `\p{M}` và
dựng bốn ký tự D-có-gạch từ MÃ SỐ. `boDauTiengViet` đổi tên (luật 8 đòi
identifier tiếng Anh) và nuốt luôn bản trùng ở `apps/web/src/lib/text.ts`.
Khuôn slug siết lại — bản cũ nhận `-`, `---`, `-day-`; đã đo sáu slug đang
chạy trên production, tất cả đều qua. Mô tả rỗng nay thành `null` thật, đúng
như JSDoc của chính nó vẫn hứa. Bốn comment khai "Task 5 chưa làm" — sai từ
một commit CÙNG NHÁNH.

**`views={null}` sửa ở KHUNG, không ở call site.** Hàng điều khiển là
`justify-between` với đúng hai con, nên `views` rỗng làm cụm nút dạt sang
TRÁI, lệch với mười bảng còn lại. Khung nay tự bọc khe trái.

**Ba test xanh giả.** Ca int "hai lượt đối đầu" bắn `move(2,'down')` +
`move(3,'up')` — cùng MỘT phép đổi chỗ, nên không interleaving nào làm nó đỏ
được, kể cả khi gỡ sạch khoá. `expect(move).not.toHaveBeenCalled()` nằm trong
một ca không bấm gì. Ca contract "KHÔNG nhận số thứ tự" xanh vì thiếu
`direction` bắt buộc, chẳng liên quan tới `order`. Cả ba viết lại; khối guard
của int spec cũng thiếu `update`, nay đủ năm đường cộng một ca 401.

**Dọn.** `Field` chép nguyên văn giữa hai dialog về kit thành `FormField`,
trước khi màn `/destinations` của F15 chép lần thứ ba. Regex slug phía admin
thôi chép tay. Gỡ `isMoveStale`, `CategoryRowVM.order`, hai khoá i18n
`move.up`/`move.down`. JSDoc của `departures` về đúng key nó mô tả.

**Ba món ghi vào sổ nợ** (`open-items.md` G1–G3), có chủ đích chứ không bỏ
quên: payload `move` mà client vứt đi (tiêu thụ nó cần hai nguồn sự thật cho
một bảng sáu hàng), 23 bản chép `sessionCookie` trong int spec, và hai bản
`mapError` đáng rút chung khi F15 thêm bản thứ ba.

**Review findings:** 15 phát hiện, tất cả CONFIRMED, tất cả đã vá.

Tests after: Vitest **3964** (web 1533, api 978, admin 998, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**. Mười lăm ca mới.
Đo đột biến từng cụm: gỡ khoá khỏi `move` hay `create` → đỏ 3/3 lượt; mười ba
đột biến còn lại ở contract, admin và web đều bị giết.

## 2026-09-22 — F14 quản trị danh mục tour, và bộ chip của khách thôi nói dối (nhánh `feat/p4e-2-categories`)

Vùng thứ hai của P4e: `/categories` trong back office, cộng một đoạn dây nối
nó tới trang công khai mà trước nay không có.

**Màn quản trị.** Sáu hàng, không phân trang, không lọc, không tìm kiếm — đo
trên production thì bảng này có đúng sáu hàng, và một thanh công cụ cho sáu
hàng là nhiễu. Bốn hành động trên từng hàng: sửa, ẩn/hiện, lên, xuống. KHÔNG
có nút xoá: `is_active` đã có sẵn nên ẩn là đảo ngược được bằng một cú bấm,
còn xoá thì không.

**Slug khoá sau khi tạo**, và ô nhập chỉ CÓ MẶT ở form tạo — không phải mờ đi,
mà vắng mặt hẳn. Slug đi vào `/tours?categories=<slug>`, mà tham số truy vấn
thì không chuyển hướng được; một ô mờ chỉ mời người ta thử rồi bắt ta giải
thích. Lúc tạo, slug tự điền theo tên qua `slugifyVietnamese` cho tới khi admin
chạm vào ô đó — đo trên production thì slug thật do người chọn (`Hà Nội` thành
`hanoi`, không phải `ha-noi`), nên quyền quyết cuối phải ở họ.

**`move` khoá HAI hàng, sắp theo id trước khi khoá.** Đổi chỗ động tới hai
dòng; hai admin bấm ngược chiều cùng lúc mà khoá theo thứ tự khác nhau là một
deadlock có thật, không phải giả định.

**Đoạn dây nối.** Đây là phần đáng kể nhất của cụm: `/tours` vốn dựng bộ chip
lọc bằng cách suy từ danh sách tour đã tải, nên `is_active` và `order` **không
với tới trang công khai** — ẩn một danh mục vẫn thấy chip, đổi thứ tự vẫn không
đổi gì, và một danh mục mới tạo chưa gắn tour thì không có chip nào để admin
nhìn thấy. Trang nay đọc `catalog.categories.list`; hàm suy-từ-tour xoá hẳn,
vì còn để đó là còn đường quay lại.

Con số in trên chip thì GIỮ cách đếm cũ, ngược với điều bản plan ghi:
`toursCount` của endpoint là số toàn catalogue, in nó ra khi khách đang tìm
kiếm là hứa nhiều hơn thực tế. Endpoint quyết chip NÀO có mặt và theo thứ tự
nào; con số vẫn tính trên lưới đã lọc.

**Hai chỗ doc nói sai code, đã sửa doc:**

- Spec §2e ghi "trang 2 của danh sách tour có bộ chip khác trang 1" như một sai
  lệch cần vá. Đo lại thì không có sai lệch đó — `fetchTours()` gọi một lần
  `limit: 50` và explorer phân trang phía client bằng `history.replaceState`,
  không có vòng server nào. Đính chính ghi thẳng vào spec.
- Bước B5 của plan ghi ngược về con số trên chip (xem trên). Lý do lệch ghi
  ngay tại bước đó.

**Một lỗi tự bắt khi soát lại trước commit:** view model của bảng suy mô tả
hiển thị ra `No description` khi cột trống, rồi form sửa lại so ngược chuỗi ấy
để đoán về bản thô. Một danh mục có mô tả thật đúng bằng câu đó sẽ mở form ra ô
trống, và lưu một phát là mất mô tả. Mô tả thô nay đi riêng khỏi mô tả hiển thị.

**Review findings:** chưa chạy vòng review riêng cho F14.

Tests after: Vitest **3949** (web 1525, api 978, admin 997, contract 347,
core 46, ui 22, tokens 18, i18n 16), int **590 ở 43 file**. Thêm 41 ca admin,
26 ca contract, 20 ca int, và 3 ca web thay cho 3 ca của hàm đã xoá. Mọi ca
mới đều kiểm ĐỎ bằng đột biến — chín đột biến ở vùng admin, ba ở vùng web.

## 2026-09-22 — Vòng hai của F12: tám mục, và hai trong số đó đã tự đóng (nhánh `fix/p4e-f12-wave2`)

Tám mục không-chạm-tiền mà vòng review F12 (21/09) gác lại. Rà từng mục trong mã
hiện tại TRƯỚC khi vá — và **hai mục hoá ra đã đóng** do chính bản vá F12 và F13,
nên chúng được KIỂM chứ không được vá.

**Sáu mục vá thật:**

1. **Form giờ là `<form>` thật.** Gõ xong bốn ô rồi bấm Enter là phản xạ của mọi
   người từng điền form; trước vòng này khối ô chỉ là một `<div>` nên Enter rơi
   vào hư không.
2. **`aria-describedby` nối ô nhập với gợi ý và câu lỗi của nó.** Helper `Field`
   đổi sang render-prop và tự ghép chuỗi id — để mỗi chỗ gọi tự ghép là bốn nơi
   phải nhớ hai luật, và một `aria-describedby` trỏ vào id không tồn tại còn tệ
   hơn không có.
3. **`update` ghi dòng nhật ký kiểm toán.** `create` và `setStatus` đã có, mà
   `update` mới là lệnh đổi được nhiều thứ nhất (ngày, ghế, giá). Ghi CẢ trước
   và sau, vì "đổi 20 thành 45" mới là câu trả lời được cho *"ai hạ ghế xuống?"*.
4. **`TourNotFoundError` bắt bằng `instanceof`, không so `error.name`.** Repo có
   **năm** lớp trùng tên ở năm module, nên so theo tên là bắt nhầm lỗi của bất kỳ
   module nào lọt vào đây.
5. **`isRefreshing` rời khỏi deps của `useMemo` dựng cột, đi qua context.** Cờ ấy
   đổi hai lần mỗi lệnh ghi; nằm trong deps thì mảng cột dựng lại cả hai lần,
   TanStack thấy cột mới nên dựng lại ô, kéo theo `DepartureRowActions` unmount
   rồi mount lại cùng toàn bộ state của nó.
6. **Trần ghế theo cỡ nhóm tour** (`SEATS_ABOVE_TOUR_MAX`, 422) ở cả `create` lẫn
   `update`. `tours.max_group_size` là lời hứa in trên chính trang tour và nó
   quyết cỡ xe; một chuyến 40 ghế trên tour công bố tối đa 12 là bán thứ không
   giao được, mà không tầng nào bên dưới bắt — CHECK của DB chỉ canh
   `seats_booked <= seats_total`, không biết gì về tour. Đo trước khi bật: prod
   có **0** hàng vi phạm, nên không chuyến nào đang chạy bỗng thành không sửa được.

**Hai mục đã tự đóng, kiểm bằng đột biến mã chứ không bằng suy đoán:**

- *Test xanh giả ở `departure-row-actions.spec.tsx`.* Khối chứa nó đã được viết
  lại ở vòng vá F12 (câu `t.list.bookings(2)` thay bằng cặp khẳng-định/phủ-định
  theo nhãn). Quét đột biến ba hành vi mà file ấy canh — bỏ chốt hàng đã huỷ, mở
  khoá nút Reopen, luôn hiện nút huỷ — đều làm đúng số ca đỏ.
- *Dời ngày chuyến đã qua thì viết lại sổ P&L tháng đã chốt.* Báo cáo gom giá vốn
  cố định theo `end_date` và **chỉ đếm chuyến có khách đã trả tiền**; mà chuyến
  như thế thì `seats_booked` khác 0, nên chốt `dateChangeBlocker` chặn sẵn. Tính
  chất này chỉ đúng NHỜ thước `seats_booked` của vòng vá F12 — bản cũ đếm theo
  trạng thái booking và một booking hoàn-thiện-chí-trọn-tiền đọc ra 0 trong khi
  vẫn tính vào P&L. Nay có ca int ghim lại, kèm ca thứ hai cho hướng dời-về-quá-khứ
  (chốt `START_IN_PAST` bắt trước).

**Một hệ quả phụ đáng ghi:** fixture của int spec dựng chuyến 20 và 30 ghế trên
một tour fixture công bố tối đa **16** — tức dữ liệu test vốn đã mâu thuẫn với
lời hứa của chính tour đó, chỉ là chưa ai hỏi. Hạ xuống 12/14 cho khớp.

**Review findings:** không có vòng review riêng — đây là vòng hai của review F12.

Tests after: Vitest **3882** (web 1525, api 978, admin 956, contract 321, core 46,
ui 22, tokens 18, i18n 16), int **570 ở 42 file**. Thêm 7 ca unit và 4 ca int.
Bốn ca component mới đã kiểm ĐỎ bằng đột biến (đổi nút submit về `type="button"`
và cắt `aria-describedby`).

## 2026-09-22 — Vá lỗ hổng đường claim: chuyến dời ngày giữa lúc khách đang trả tiền (ADR-0009 AMEND 4, nhánh `fix/claim-gate-departure-moved`)

Mục cuối cùng còn chạm tiền của P4e-1, phát hiện ở vòng review F12 và để lại
trong [open-items](open-items.md) vì nằm ngoài phạm vi F12.

**Lỗ hổng.** Booking `PENDING` không làm tăng `seats_booked` (bất biến #1 của
ADR-0009), mà chốt chặn đổi ngày của `admin.departures.update` lại đo bằng
`seats_booked`. Nên admin dời được ngày một chuyến ngay trong lúc khách còn ngồi
ở trang thanh toán — hoàn toàn hợp lệ theo luật hiện hành. Khi capture về, gate
claim của [ADR-0009 AMEND 1](adr/0009-refund-correctness.md) chỉ hỏi *"chuyến
còn mở và chưa đi chưa"*, không hỏi *"chuyến còn là thứ khách đã mua không"* —
nên booking flip `PAID` mang BẢN SAO NGÀY CŨ. Khách cầm voucher in sai ngày và
một hạn huỷ tính từ một ngày không còn tồn tại, không có gì báo cho ai.

**Vá.** Qual của AMEND 1 thêm hai phép so `dep.start_date = b.departure_start_date`
và `dep.end_date = b.departure_end_date`. Lệch ngày → outcome MỚI
`departure-moved` → đi đúng đường auto-refund sẵn có của
`overbooked`/`departure-closed`: hoàn trọn, booking `CANCELLED`, email
`BOOKING_REFUNDED`, dedupe key riêng `departure-moved-refund:<bookingId>`.

**Ba quyết định, ghi đủ ở [AMEND 4](adr/0009-refund-correctness.md):**

- *Outcome RIÊNG chứ không dùng lại `departure-closed`.* Hai đường xử lý giống
  hệt nhau nên gộp là rẻ hơn, nhưng chuyến ở đây đang MỞ và đang bán — một dòng
  log nói "departure-closed" về nó là câu sai nằm lại trong sổ sự kiện tiền.
  Cùng lý lẽ đã dùng khi bỏ cột "x / y refunded".
- *HOÀN TIỀN chứ không dời booking theo chuyến.* Đồng bộ bản sao xuống booking là
  âm thầm đổi thứ khách đã đồng ý; ADR-0041 §2b đã loại cách ấy cho người ĐÃ trả
  tiền, người ĐANG trả lại càng chưa đồng ý gì.
- *KHÔNG siết chốt chặn ở `admin.departures.update`.* Thêm "chặn khi có PENDING"
  chỉ thu hẹp cửa sổ chứ không đóng được: `bookings.create` không khoá chuyến,
  nên một booking mới luôn chen được vào giữa lúc admin đọc và lúc admin ghi.
  Chỉ gate claim mới đóng được, vì nó là nơi duy nhất thấy cả hai sự thật.

**Một test cũ phải sửa SETUP, và đó là phát hiện phụ đáng giữ.** Ca §3.2
("thanh toán đang dở lúc hạn chót trôi qua vẫn được nhận") giả lập hạn chót đã
qua bằng cách DỜI NGÀY CHUYẾN mà không dời bản sao trên booking — tức nó đang
giả lập nhầm một chuyện khác hẳn, và gate mới trả `departure-moved` đúng như nó
phải làm. §3.2 nói về ĐỒNG HỒ chạy tới, không nói về lịch bị sửa; setup nay dời
cả hai.

**Review findings:** không có vòng review riêng — bản vá một mục đã được review
gọi tên từ 21/09.

Tests after: Vitest 3875 không đổi, int **566 ở 42 file** (thêm 2 ca AMEND 4 —
một ca dời ngày, một ca dời-rồi-khởi-hành để ghim thứ tự phân loại). Ca dời ngày
đã kiểm ĐỎ bằng cách gỡ hai phép so ra khỏi CTE.

## 2026-09-22 — Chạy thử tay F13 trên production, và một câu copy nói dối (nhánh `fix/departure-cancel-reason-copy`)

Lượt nghiệm thu cuối của [plan P4e-1](plans/2026-09-21-p4e-1-departures.md), chạy
trên chính production (Stripe test mode, worker inline). Đường huỷ chuyến chạy
đúng từ đầu tới cuối; một lỗi copy lộ ra, và nó là loại lỗi chỉ thử tay mới bắt.

**Đường huỷ: đạt.** Tạo chuyến 22/10 trên tour `hanoi-old-quarter-food-night`,
đóng rồi mở lại, đặt một chỗ và trả bằng thẻ test, rồi huỷ chuyến. Đo được trong
DB prod: chuyến `CANCELLED` với đủ ba cột sổ (`cancelled_at/by/reason`), booking
`CANCELLED`, một dòng sổ hoàn **35.00 USD** mang mã `re_…` do chính Stripe trả
về, ghế trả lại `0 / 4`, `cancellation_requests` ở `REFUNDED` đúng lý do, email
`BOOKING_CANCELLED` đã gửi và in đúng số tiền. Từ lúc bấm huỷ tới lúc hoàn xong:
**1,4 giây** — ảnh chụp kịp thấy cột "1 traveller still to refund" rồi nó biến
mất sau một lượt refresh, đúng hành vi đã đổi ở vòng review.

**Lỗi tìm được.** Hộp xác nhận huỷ nhắc dưới ô lý do: *"Say why — travellers see
this on their booking."* Câu ấy SAI. Lý do có vào `cancellation_requests.reason`
thật và admin đọc được, nhưng email báo huỷ không mang nó và trang booking phía
khách không render nó ở đâu cả — tra lại mã nguồn thì `apps/web` chỉ có ô
`reason` để KHÁCH tự gõ khi họ huỷ. Không mất tiền, nhưng là copy nói dối trên
màn tiền: nó khiến admin cân nhắc câu chữ cho một người đọc không tồn tại. Cùng
loại lỗi mà vòng review vừa bắt ở cột "x / y refunded".

Vá bằng cách nói đúng thứ đang xảy ra — câu nhắc nay là *"it is kept on every
affected booking for your team"*. Cho khách thật sự đọc được là việc KHÁC (phải
đụng payload outbox, template email và một vùng trên web, cộng một quyết định về
giọng văn vì lý do admin gõ là câu nội bộ); đã ghi thành đề xuất sản phẩm ở
[open-items](open-items.md) chờ chủ dự án quyết.

Ghi chú vận hành: 3.877 test tự động không cái nào biết email trông ra sao. Đây
là giá trị của mục "chạy thử tay" trong plan, và là lý do nên giữ nó ở mọi phase
sau.

**Review findings:** không có vòng review riêng — đây là lượt vá một câu copy.

Tests after: không đổi con số nào (chỉ sửa chuỗi i18n và hai khối JSDoc). Vitest
3875, int 564 ở 42 file.

## 2026-09-22 — P4e-1 F13: nút công ty huỷ chuyến, hoàn tiền qua hàng đợi (nhánh `feat/p4e-departure-cancel`)

Đóng món nợ [ADR-0041 §6](adr/0041-single-cancellation-deadline.md) mở từ đầu
tháng 9: *công ty huỷ chuyến hoàn 100% mọi lý do — lõi đã viết sẵn nhưng chưa
có nút*. Bốn task theo [plan](plans/2026-09-21-p4e-1-departures.md), mỗi task
một commit.

**Hai đường huỷ, hai cách tính tiền.** `refundOnOperatorCancelForBooking` là
hàm mới, và toàn bộ lý do nó tồn tại nằm ở chỗ nó KHÔNG nhận `now`: hạn chót
là luật cho KHÁCH đổi ý (qua hạn thì chỗ không bán lại được nữa nên không tự
hoàn), còn chuyến bị công ty bỏ thì khách chẳng đổi ý gì cả. Cùng một mốc
18/10 với hạn chót 17/10, khách tự huỷ ra `0.00` và công ty huỷ ra trọn
`117.00`. Thêm `now` vào chữ ký là mời người đọc sau tin rằng thời điểm có ảnh
hưởng.

**Hàng đợi đầu tiên của dự án mang payload.** Năm queue hiện có đều là cron
không tham số với `retryLimit: 0`, vì lượt kế bù được. Ở đây bỏ một lượt là
MỘT KHÁCH KHÔNG ĐƯỢC HOÀN TIỀN, nên queue khai `retryLimit: 5` giãn luỹ thừa
từ 30 giây, và `policy` để mặc định chứ không `'short'` (`'short'` gộp các job
đang chờ thành một, mà mỗi job ở đây là một khách khác nhau). Retry chỉ an
toàn nhờ job idempotent: lượt giao lại đọc trạng thái booking TRONG khoá, thấy
`CANCELLED`, và dừng TRƯỚC cổng thanh toán. Trả `null` chứ không ném — "đã
hoàn rồi" là kết cục THÀNH CÔNG, ném ở đó sẽ đốt hết retry để báo lỗi cho một
việc đã xong.

**Một job mỗi booking, không phải mỗi chuyến.** Mỗi booking là một lời gọi ra
cổng thanh toán và hỏng độc lập; gom cả chuyến thì khách thứ 7 hỏng kéo theo
lượt retry của 6 người đã hoàn xong.

**Endpoint đồng bộ, tiền bất đồng bộ.** `admin.departures.cancel` khoá chuyến,
đổi `CANCELLED`, huỷ luôn nhóm `PENDING` tại chỗ (chưa trả tiền nên không có
gì hoàn; không trả ghế vì `PENDING` chưa từng claim ghế), chụp nhóm cần hoàn,
rồi trả về. Đợi hoàn tiền ngay trong request là sai: một chuyến 30 khách là 30
lời gọi ra cổng, và request đầu tiên hết giờ chờ để lại một lượt huỷ nửa chừng
mà không ai biết đã tới đâu.

**Màn admin.** Nút huỷ dùng thước NGÀY KHỞI HÀNH chứ không phải hạn nhận đặt —
khác hẳn nút Mở lại ngay bên cạnh, vì một chuyến quá hạn đặt mà hướng dẫn viên
gãy chân vẫn phải huỷ được. Hộp xác nhận in hai con số (bao nhiêu người được
hoàn, bao nhiêu phiên thanh toán bị huỷ) và bắt nhập lý do, kèm câu nhắc rằng
KHÁCH đọc được lý do ấy. Cột tiến độ đọc từ đếm booking, không thêm bảng nào.

**Hai thứ làm THÊM so với plan, cùng vì một lỗ hổng.** Job được đẩy SAU khi
transaction commit, nên có một khoảng hở thật: không worker nào đăng ký, hoặc
pg-boss lỗi, hoặc tiến trình chết đúng khe giữa — thì booking đã trả tiền nằm
lại trên chuyến đã huỷ và KHÔNG có gì đánh thức nó dậy (khác mọi queue khác,
ở đây không có cron nào tự chạy lại). Vá bằng: ba cột sổ trên `tour_departures`
(`cancelled_at/by/reason` — cũng là nơi DUY NHẤT trả lời "ai huỷ, vì sao" với
một chuyến không có khách nào), và lượt quét `sweepStranded` đi ké nhịp
`booking-sweep` 10 phút. Chuyến huỷ từ trước F13 không có sổ thì lượt quét BỎ
QUA và cảnh báo, không bịa ra người quyết.

**Một quyết định đo được, không phải suy đoán.** `cancelled_by` cố ý KHÔNG có
khoá ngoại tới `users`. Bản đầu có, và `TRUNCATE users CASCADE` lập tức kéo
theo cả `tour_departures` làm 25 integration test đỏ — `POST /api/bookings`
trả `DEPARTURE_NOT_AVAILABLE` vì lịch chạy biến mất giữa chừng. Lý do thứ nhất
đứng độc lập với lỗi ấy: một dấu vết kiểm toán phải sống lâu hơn tài khoản nó
trỏ tới, mà khoá ngoại chỉ cho chọn giữa `SET NULL` (xoá admin là xoá luôn vết
họ từng huỷ chuyến nào) và `RESTRICT` (không xoá được tài khoản nữa).

**Review findings:** vòng review 22/09 báo **4 phát hiện, nhưng chỉ hai chỗ
sai** — vá ở gốc thay vì vá bốn triệu chứng (`b221754f`).

*Gốc 1 — đường operator mượn cổng chặn của đường khách.* `cancellationBlocker`
chặn khi "đã tới ngày khởi hành": đúng với khách, SAI với lượt hoàn tiền của
công ty. Lượt ấy chạy bất đồng bộ — worker gói free ngủ 15 phút, cổng thanh
toán hờn rồi retry giãn luỹ thừa — nên job hoàn toàn có thể chạy sau ngày khởi
hành, mà chuyến khi ấy đã bị bỏ từ trước. Đo được bằng test: chuyến 10/10 huỷ
ngày 09/10, worker tỉnh ngày 11/10 → `cancelByOperator` trả `null` → pg-boss
ack THÀNH CÔNG → khách mất tiền, không log, không alert; lưới quét 10 phút/lần
vấp đúng chốt ấy nên không bao giờ cứu được, và vì chỉ đếm thành công nên cũng
không kêu. Vá: `cancellationBlocker` nhận `initiator` (mặc định `'customer'`
để mọi chỗ gọi cũ giữ nguyên nghĩa), chốt ngày chỉ áp cho khách. Kèm theo,
`cancelByOperator` tách hai kết cục vốn bị gộp: trạng thái đã đóng là ĐÃ XONG
(trả `null`), còn thiếu capture là CẦN NGƯỜI NHÌN (ném) — `claimSeatsForPaid`
nhận `providerPaymentId ?? null` nên hàng PAID không capture là có thật.

*Gốc 2 — cột "x / y refunded" nói sai.* Tử số `cancelledBookingCount` đếm cả
booking `PENDING` vừa bị huỷ tại chỗ (chưa trả tiền nên chưa từng được hoàn)
lẫn booking khách tự huỷ từ trước: chuyến 2 PENDING cộng 3 PAID hiện
"2 / 5 refunded" ngay khi chưa một đồng nào đi, và chuyến huỷ lúc chưa ai đặt
hiện "0 / 0 refunded". Vá bằng cách THAY thước chứ không sửa phép tính: cột in
"N travellers still to refund" đọc thẳng từ `liveBookingCount` và để TRỐNG khi
hết người chờ. `cancelledBookingCount` bỏ hẳn khỏi contract — một field không
ai dùng trên hàng tiền là một field sẽ lệch.

**CÒN TREO:**

- **Deploy migration `20260922120000_departure_cancellation_audit` lên Supabase**
  sau khi merge (luật 15).
- **Chạy thử tay** theo mục nghiệm thu của plan: tạo một chuyến, đóng, mở lại,
  rồi huỷ một chuyến có booking sandbox và xem cột tiến độ chạy tới đủ.
- Vòng hai của F12 (8 mục) vẫn mở.

Tests after: Vitest **3875** (web 1525, api 975, admin 952, contract 321, core 46,
ui 22, tokens 18, i18n 16), int **564 ở 42 file**, Jest mobile 245 không đổi.
Riêng F13 thêm 23 ca unit và 19 ca int (gồm vòng vá review). Task 8, Task 9 và luật
`departureCancelBlocker` đi đúng TDD (đỏ trước rồi mới implement); bảy ca int
của endpoint viết SAU phần cài đặt và được bù bằng đột biến mã — bỏ chốt
huỷ-lần-hai, bỏ chặn chuyến đã khởi hành, bỏ ghi sổ, bỏ huỷ nhóm `PENDING`,
bỏ chốt idempotent và bỏ guard chuyến đều làm đúng số ca dự kiến đỏ.

## 2026-09-22 — P4e-1: danh sách tour có công tắc đăng, và lịch chạy của từng tour (nhánh `feat/p4e-tours-list` rebase dưới `feat/p4e-departures-crud`)

Hai cụm việc đầu của P4e, dựng song song ở hai worktree rồi gộp làm một lượt vì
F12 nối thẳng từ màn F11 (nút "Departures" trên mỗi hàng tour). Thiết kế đi
trước: [spec](specs/2026-09-21-p4e-1-departures-design.md) ·
[plan 11 task](plans/2026-09-21-p4e-1-departures.md).

**F11 — `/tours`.** `admin.tours.list` trả CẢ tour chưa đăng (bề mặt công khai
không được biết chúng tồn tại), kèm `isPublished` và số chuyến còn bán được
trong khoảng lọc. `admin.tours.setPublished` là ĐÚNG MỘT công tắc, cố ý không
khai mã lỗi nào ngoài `NOT_FOUND`: gỡ đăng một tour đang có khách là hợp lệ và
không được chặn — khách đã mua vẫn đi, tour chỉ thôi được chào bán. Chặn ở đây
là khoá đúng thao tác vận hành cần nhất khi có chuyện.

**F12 — `/tours/[slug]/departures`.** Bốn thao tác: đọc danh sách, thêm, sửa,
đóng/mở lại. Hạn chót có CỘT RIÊNG chứ không giấu sau tooltip, vì nó là mốc
quyết định mọi thao tác trên hàng. Ba luật viết thành hàm thuần có test:

- **Đổi ngày** bị khoá khi chuyến đã có ghế bị giữ. `Booking` lưu BẢN SAO ngày
  khởi hành và ADR-0041 tính hạn huỷ từ bản sao ấy, nên đổi ngày chuyến là tạo
  hai sự thật. Bất biến: hạn huỷ không bao giờ xấu đi sau khi khách đã trả tiền.
  Giá và ghế thì vẫn sửa được, kể cả khi đã có khách.
- **Hạ ghế** dưới số đã đặt bị từ chối ở tầng nghiệp vụ. CHECK
  `departures_seats_within_total` vẫn đứng sau làm lưới, nhưng một SQLSTATE
  23514 phơi lên màn hình là câu trả lời cho máy, không phải cho người sửa lịch.
- **Mở lại** sau hạn chót bị từ chối: hạn chót cũng là lúc ngừng nhận đặt, nên
  mở lại sau mốc đó là bày ra một chuyến không ai đặt được.

KHÔNG có nút huỷ chuyến (đó là F13, và nó chạm tiền) và KHÔNG có lệnh xoá:
chuyến đã có người đặt thì phải huỷ có hoàn tiền, chuyến chưa ai đặt thì `CLOSED`
đã đủ — thêm lệnh xoá là thêm một đường làm mất bản ghi mà báo cáo tháng đang đếm.

**Review findings:** hai vòng review riêng, 10 góc mỗi vòng, tổng **28 mục vá**.

*F11 — mười ba mục* (`c3fc83c6`). Sáu mục chặn merge. Nặng nhất: công tắc đăng
KẸT sai trạng thái tới khi tải lại cả trang, vì gương `serverValue` được nâng
khi prop đổi giữa lúc lệnh ghi đang bay; bản vá ĐẦU TIÊN của vòng này cũng sai
theo đúng cách ấy, và chính hai test mới bắt được. Bust cache thôi gác sau
`changed` (revalidate là fire-and-forget, gác lại thì tour ở lại trên site trọn
300 giây ISR). Menu lọc danh mục gọi endpoint công khai nên ăn trần đọc theo
IP — nay hỏng thì trả rỗng thay vì kéo sập cả bảng. `page` kẹp cả TRẦN 10 000
theo contract: lỗ này ở kit dùng chung nên **sáu bảng admin cùng được vá**.
Đếm chuyến cắt thêm nhát `isWithinDeadline`, hệ quả cố ý là tháng quá khứ trả 0
và nhãn đổi sang "Bookable departures".

*F12 — mười lăm phát hiện, bảy mục vá* (`048cfc48`); tám mục còn lại dồn sang
vòng hai vì chúng không chạm tiền và không làm sập trang.

Năm mục chạm tiền:

1. **Trần giá và đúng 2 chữ số lẻ.** `129.999` từng đi lọt cả ba tầng rồi bị
   cột `Decimal(14,2)` làm tròn thành `130.00` — một con số khách phải trả mà
   không ai gõ vào. Quá 12 chữ số phần nguyên thì Postgres ném `22003`,
   `mapError` không nhận ra nên thành 500 trần, admin phân loại `GENERIC`, rồi
   kit ĐÓNG dialog: mất sạch bốn ô vừa điền.
2. **Token `version` chống ghi đè mù giữa hai tab**, kèm mã `DEPARTURE_STALE`.
   `FOR UPDATE` tuần tự hoá hai lệnh ghi nhưng KHÔNG phát hiện được cái cũ, vì
   giá trị "hiện tại" trong payload đến từ form trình duyệt chứ không từ hàng
   vừa khoá. A đổi 20 ghế thành 45, B bấm Lưu từ form mở trước đó và ghi đè về
   20: 25 ghế biến mất im lặng, khách đặt tiếp đâm trần, claim trả `overbooked`,
   hệ thống tự hoàn tiền người ĐÃ trả. Token là `updatedAt` nên không thêm cột;
   form CHỤP nó lúc mở chứ không đọc lại lúc gửi.
3. **Thước khoá ô ngày đổi sang `seats_booked`.** Bản đầu đếm trạng thái
   booking, nhưng [`booking-states`](conventions/booking-states.md) nói ngược
   đúng chỗ đó: hoàn tiền thiện chí trọn tiền KHÔNG trả ghế, khách vẫn đi tour.
   Nên đếm theo trạng thái đọc ra 0 trên một chuyến vẫn còn khách thật rồi mở
   khoá ô ngày. Đổi thước còn xoá một mâu thuẫn bày ngay trên màn hình:
   "Seats 4 / 20" đứng cạnh "Live bookings 0".
4. **Tách `pendingBookingCount`.** Đóng chuyến gây hai hệ quả khác hẳn nhau:
   khách ĐÃ trả giữ chỗ và không ai báo gì, còn khách ĐANG trả bị đường claim
   từ chối rồi hoàn tiền tự động kèm email. Hộp xác nhận nay in hai dòng, và
   thêm một câu cảnh báo khi còn checkout dở.
5. **Copy tạo chuyến thôi hứa "goes on sale straight away"**, và form cảnh báo
   ngay khi chuyến sắp tạo đã quá hạn nhận đặt — hạn là `ngày đi − N` với N tới
   7 ngày, nên một chuyến 5 ngày khởi hành tuần sau đã quá hạn ngay lúc tạo.

Hai mục làm sập cả trang: `seatsTotal` ở hàng ĐẦU RA nới về `nonnegative()` (khai
chặt 1..500 nghĩa là một hàng hợp lệ với DB nhưng ngoài dải sẽ trượt validation
đầu ra và 500 cả trang, kể cả chính cái form dùng để sửa nó); và CHECK
`departures_date_range` (`end_date >= start_date`) — một hàng ngược ngày sinh ra
độ dài âm, `tripLengthDays` ném `RangeError`, mà hàm đó chạy cho MỌI hàng ở
`admin.departures.list` lẫn `catalog.getTourBySlug`, nên đúng một hàng hỏng kéo
sập luôn trang tour công khai.

**CÒN TREO:**

- **Vòng hai của F12** (8 mục, không chạm tiền): bọc `<form>` để Enter gửi được ·
  `aria-describedby` cho ô có gợi ý · `update` thiếu dòng nhật ký kiểm toán ·
  một test xanh giả ở `departure-row-actions.spec.tsx` · `TourNotFoundError` bắt
  bằng `error.name` thay vì `instanceof` · `isRefreshing` nằm trong deps của
  `useMemo` nên ô bảng bị dựng lại · thiếu kiểm `maxGroupSize` lúc tạo · dời
  ngày một chuyến đã qua thì viết lại sổ P&L của tháng đã chốt.
- **Lỗ hổng đường claim** (ngoài phạm vi F12, đã ghi ở
  [open-items](open-items.md)): booking `PENDING` không làm tăng `seats_booked`,
  nên chuyến vẫn đổi ngày được trong lúc khách đang thanh toán; lượt claim về
  sau vẫn flip sang `PAID` với bản sao ngày CŨ. Cổng claim hiện chỉ kiểm chuyến
  còn `OPEN` và chưa khởi hành, không so bản sao ngày với ngày thật.
- **Deploy migration `20260922090000_departure_date_range_check` lên Supabase**
  sau khi merge (luật 15: hạ tầng sống chỉ đụng ở session gốc, sau review).

Tests after: Vitest **3852** (web 1525, api 965, admin 942, contract 318, core 46,
ui 22, tokens 18, i18n 16), int **545 ở 41 file**, Jest mobile 245 không đổi.
Riêng hai cụm này thêm 163 ca unit và 48 ca int. Ba ca mới của vòng vá F12 đã
kiểm ĐỎ bằng đột biến mã trước khi nhận là xanh thật. Build web chạy với API
sống trên máy (đúng cấu hình CI) — xanh.

## 2026-09-21 — Đại tu tài liệu: bản đồ gọn lại, thêm lớp cho người đọc phổ thông, tách CHANGELOG (nhánh `docs/overhaul-2026-09`)

Đợt rà soát toàn bộ `docs/` đầu tiên kể từ 03/08. Quy mô lúc bắt đầu: **159 file
Markdown · 78.970 dòng · 4,40 MB**, cộng 114 file khác. Bảy đợt sửa, ghi đầy đủ ở
[báo cáo rà soát](analysis/2026-09-21-docs-audit.md).

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| `docs/README.md` | 149 KB, 665 ký tự/dòng | **19 KB**, 68 ký tự/dòng |
| `docs/CHANGELOG.md` | 589 KB, 133 entry | **60 KB**, 17 entry |
| File lưu trữ changelog | 2 | **12** (tối đa 75 KB) |
| `conventions/` | 12 file, 86 KB | **7 file, 41 KB** |
| File `.md` ngoài bản đồ | 4 | **0** |
| Link `.md` gãy trong `docs/` | 17 | **0** |
| Trang cho người không lập trình | 0 | **3** |
| `docs/` trên đĩa | 109 MB | **11 MB** |

**Thông tin sai ở đúng chỗ người lạ đọc đầu tiên.** `README.md` gốc ghi admin là
Vite/TanStack trong khi thật ra là Next 16.3.4, mobile Expo 56 và RN 0.85 trong
khi thật ra 57 và 0.86.3, ba app còn đánh dấu chưa làm trong khi đã chạy thật,
thiếu hẳn hai gói `ui`, và vẫn trỏ repo tham chiếu Nexora đã bỏ từ 14/09.
`CLAUDE.md` còn ghi P4 admin là phase kế tiếp.

**Bản đồ đã hoá thành bách khoa.** 224 dòng nhưng 149 KB: mỗi ô bảng là bản tóm
tắt đầy đủ của một ADR kèm cả AMEND, ô dài nhất 5.772 ký tự. Cắt được vì mọi
AMEND chép trong đó đều đã có đủ trong chính file ADR — và bản chép còn cũ hơn
bản gốc (ghi ADR-0026 tới AMEND 4 trong khi ADR có AMEND 5).

**Ba tài liệu mới cho người không lập trình**: [overview](overview.md) (sản phẩm
là gì, ai dùng, sáu luồng chính, sơ đồ bốn app), [glossary](glossary.md) (khoảng
60 thuật ngữ chia sáu nhóm), [open-items](open-items.md) (gom hơn 30 mục CÒN TREO
vốn rải khắp 133 entry). Không dịch ADR và plan sang ngôn ngữ phổ thông — làm
loãng chúng thì mất chính xác mà không ai được lợi.

**Tách CHANGELOG, kiểm nguyên văn bằng máy.** 116 entry vào 10 file lưu trữ theo
kỷ nguyên, cộng [mục lục](changelog/README.md) kể lại 12 giai đoạn bằng ngôn ngữ
thường. Ghép 11 file lại rồi so từng dòng với bản gốc lấy từ git: 6.904 dòng nội
dung khớp 100%, đủ 133 entry. Chỗ duy nhất đụng là **89 đường dẫn tương đối** phải
thêm `../` vì file xuống sâu một cấp — đúng cách hai file lưu trữ đợt 03/08 đã
làm, dù header của chúng tuyên bố "0 ký tự đổi".

**Rà `conventions/` bằng cách đối chiếu mã nguồn.** Bốn file đúng nguyên
(`booking-states`, `read-then-write-races`, `soft-404-loading-tsx`,
`supabase-data-api-surface` — kiểm `cancelInLock`, `vietnamToday`, `FOR UPDATE`,
vị trí `loading.tsx`, 36 bảng RLS). Ba file lệch:

- `mobile-dev-loop` §2 đứng trọn trên tiền đề WSL NAT, lỗi thời từ 14/09 khi máy
  dev sang Windows native. Nợ này CHANGELOG 16/09 đã ghi nhận mà chưa trả. Kèm
  [ADR-0040 AMEND 2](adr/0040-mobile-app-expo.md) đảo §8: `dev` = `expo start`
  (LAN), thêm `dev:tunnel`, `dev:lan` giữ làm bí danh.
- `outbox-dedupe-key` sai bốn chỗ: hai dòng bảng trùng nhau, ví dụ
  `cancellation-denied` thuộc luồng ADR-0041 đã xoá, tên sự kiện `booking-paid`
  trong khi mã dùng `booking-confirmed`, và thiếu ba dạng đang chạy thật.
- `read-then-write-races` thiếu nơi áp dụng thứ ba (`admin-enquiries`, W4).

**Sắp xếp lại ba chỗ.** Năm tài liệu bàn giao mobile sang [`handoff/`](handoff/README.md)
— chúng có hình dạng của plan và có ngày hết hạn, khác luật áp dụng mãi mãi.
`color-system` tách đôi: luật thi hành ở lại (4 KB), phần đo đạc sang
[analysis](analysis/2026-07-22-color-system-analysis.md) (9 KB). `design/prompts/`
gộp lên một cấp vì thư mục chỉ có đúng một file.

**Hai thư mục không phải Markdown.** `snapshots/` (28 file JSON, có commit) nay có
[mục lục](snapshots/README.md) — trước đó không một dòng giải thích, dù
`reset-operational-data.mjs` đọc `keep-list.json` ở thư mục có ngày lớn nhất nên
thêm một lượt là đổi luôn hành vi script dọn dữ liệu. `screenshot/` (98 MB ảnh
tham chiếu riêng của user, gitignored) đã dời hẳn ra ngoài kho mã.

**Đo được một rủi ro rộng hơn tưởng.** Gotcha `+` ở cột 0 lâu nay chỉ nhắc
changelog; đo lại thì **11 file** dính, gồm 4 ADR, 2 bản phân tích (một file 37
dòng), 2 plan, 1 spec và `libs/shared/tokens/README.md`. Tất cả là dòng tiếp nối
hoặc phép cộng bị ngắt dòng — mở rồi save bằng editor có markdownlint là làm sai
nghĩa. CLAUDE.md đã ghi đúng phạm vi.

**CÒN TREO:** quét QR thử app điện thoại sau khi đổi lệnh `dev` sang LAN (nếu
không chạy được thì `dev:tunnel` vẫn còn nguyên) · `.claude/skills/` có 41 link
gãy nhưng đó là bản sao upstream của skill bên thứ ba, không đụng.

**Review findings:** chưa có vòng review riêng.

Tests after: không đổi code sản phẩm — thay đổi duy nhất ngoài `docs/` là một
dòng script `dev` trong `apps/mobile/package.json` và ghi chú `.gitignore`. Vitest
3689, Jest mobile 245, int 497 ở 39 file, tất cả giữ nguyên so với entry trước.

## 2026-09-21 — Prerender thử lại khi API hắt hơi (ADR-0044, nhánh `fix/prerender-retry`)

Ba lượt build web trên Vercel chết liên tiếp, **ba mã lỗi khác nhau trên cùng
một đường**, trong khi gọi tay chính endpoint ấy trả 200 dưới 0,6 giây:

| Deploy | Trang chết | Lỗi |
| --- | --- | --- |
| `f4809d3f` | `/tours/bana-hills-golden-bridge-day` (trang 57/75) | `TimeoutError`, quá 10s |
| `659a48fc` | `/blog/what-to-pack-for-the-mist-season` (trang đầu) | HTTP 502, header `x-render-routing: dynamic-free-error` |
| redeploy `659a48fc` | cùng trang | HTTP 520, trang lỗi HTML của Cloudflare |

- **Chẩn đoán sai một nhịp rồi sửa lại giữa chừng.** Bản đầu kết luận "flake do
  Render ngủ dậy" và đề nghị deploy lại; deploy lại VẪN chết, lần này 520 dù API
  đã tỉnh ổn định 11 phút. Kết luận đúng có hai tầng: (a) service Render đặt
  `autoDeploy` theo MỌI commit nên push docs cũng dựng lại API — log Render
  `03:22:59 ==> Deploying…` rồi `03:23:34 Starting Nest…` trong khi build web gọi
  lúc `03:23:48`; (b) instance **free** một mình ở Singapore không nuốt nổi loạt
  75 request prerender bắn từ vùng IAD, Cloudflare đứng trước trả 520/502.
- **`settle()` của ADR-0016 không dùng được ở đây.** `fetchPostDetail` cố ý ném
  lại mọi lỗi khác `POST_NOT_FOUND` để error boundary xử lý; đổi sang `settle` là
  build XANH trong khi xuất bản một trang bài viết rỗng. Thà đỏ.
- **Vá ở tầng vận chuyển**, một chỗ duy nhất: bọc `fetch` của `OpenAPILink` bằng
  `createRetryingFetch` (`apps/web/src/lib/api/retry-fetch.ts`). Bốn ràng buộc
  của ADR-0044 đều có test canh: CHỈ `GET` (gửi lại POST là nguy cơ đặt trùng chỗ
  và thu tiền hai lần), CHỈ phía server, CHỈ lỗi tạm thời (network/timeout cộng
  `408 425 429 500 502 503 504 520 521 522 523 524`; 404 và 4xx nghiệp vụ đi
  thẳng để `notFound()` còn chạy), và đúng ba lượt giãn 400ms rồi 1200ms.
- **Timeout tách hai phía:** server 20s, trình duyệt giữ nguyên 10s.
  `AbortSignal.timeout()` phải dựng LẠI từng lượt — dùng chung một signal thì
  lượt thử thứ hai nhận signal đã hết hạn và chết tức khắc.

**Phần (1) đã xong bằng tay 21/09:** user bật Build Filter trên dashboard Render
(service `Tourism-Platform-V2` → Settings → Build Filters → Ignored Paths →
`docs/**`) — Render chưa mở cấu hình này qua API lẫn MCP nên không tự động hoá
được. Từ nay commit chỉ đụng `docs/` không dựng lại API nữa.

Còn một mức siết nữa CHƯA làm, để dành khi cần: `apps/web/**`, `apps/admin/**`
và `apps/mobile/**` cũng không vào ảnh Docker của API, nên thêm chúng vào
Ignored Paths sẽ chặn nốt phần lớn ca còn lại. **Đừng thêm `libs/**`** — API ăn
`@tourism/contract` và `@tourism/core`, ignore chúng là deploy API thiếu bản
contract mới mà không ai hay.

**Review findings:** chưa có vòng review riêng.

Tests after: Vitest 3689, trong đó web 1538 (thêm **32** test mới cho
`retry-fetch`), api 932, admin 838, contract 279, core 46, ui 22, tokens 18,
i18n 16. Jest mobile 245 không đổi. Int 497 ở 39 file. `pnpm gate:int` trọn
xanh; lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — Audit hết đỏ: metro bỏ `image-size`, ghim `@types/react`, ghi nhận lỗ `decode-uri-component` (nhánh `fix/audit-metro-image-size`)

Workflow `Audit` (lịch, 09:00 thứ Hai) đỏ từ **14/09** mà không ai nhìn — lần
xanh cuối là 07/09. Ba lỗ, cả ba chỉ đến từ bộ công cụ Expo trong `apps/mobile`;
web và api sạch.

- **Hai lỗ high `image-size` (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq)** — vá
  bằng MỘT lượt làm mới lockfile, không cần override: `metro@0.87.1` đã **bỏ hẳn**
  dependency `image-size`, và `metro-config@0.87.1` nằm trọn trong dải `^0.87.0`
  mà `@react-native/metro-config@0.87.1` (bản repo đang cài) khai. Lock chỉ đang
  giữ 0.87.0 vì `--frozen-lockfile`. Đây là patch BÊN TRONG dải upstream đã cho
  phép, không đụng Expo SDK 57 của ADR-0040 — hợp chính sách freeze 15/10.
- **KHÔNG override `image-size` lên 2.x** dù advisory bảo `>=2.0.3`:
  `metro/src/Assets.js` gọi `_interopRequireDefault(require("image-size"))`, tức
  dùng default export, mà v2 chỉ xuất named `imageSize` → Metro sẽ chết khi bundle
  bất kỳ ảnh nào. Đã kiểm bằng cách đọc mã nguồn metro trong `node_modules`.
- **Lỗ moderate `decode-uri-component` (GHSA-vcc3-ghjq-m6fr) KHÔNG vá được**, ghi
  nhận có chủ đích bằng `auditConfig.ignoreGhsas` kèm lý do đo được và điều kiện
  gỡ. Advisory ghi "Patched versions >=0.4.3" nhưng **bản 0.4.3 không tồn tại trên
  npm** (registry chỉ tới 0.4.1 rồi nhảy 0.5.0), và 0.5.0 là `"type": "module"`
  trong khi `query-string@7.1.3` là CJS `require()` nó → ép lên là
  `ERR_REQUIRE_ESM`, expo-router hỏng lúc CHẠY. Gỡ được khi Expo kéo
  `query-string >=9.5.1` (bản đó khai `decode-uri-component: ^0.5.0`; 9.0 vẫn khai
  `^0.4.1` nên chưa đủ).
- **Tác dụng phụ bắt được nhờ gate, không phải nhờ may:** lượt làm mới lock kéo
  thêm `@types/react@19.2.18` cạnh 19.2.17 mà react-native và `apps/web` đang
  dùng → hai bản types trong store → `tsc` ở `libs/shared/ui` báo *"Two different
  types with this name exist, but they are unrelated"* cho `Ref<SVGSVGElement>`.
  Ghim `'@types/react': '19.2.17'` theo đúng nếp đã có cho `react`/`react-dom`, và
  cùng lý lẽ: hạ xuống cho khớp, KHÔNG phải nâng cấp. Lỗi này không hiện ở runtime.
- **Phạm vi lock:** 33 gói đổi version, toàn bộ patch/minor trong dải đã khai,
  **không gói nào nhảy major**. Phần lớn là họ `metro-*` 0.87.0 lên 0.87.1; vài gói
  là đích của override bảo mật sẵn có tự trôi tới (hono 4.13.5 lên 4.13.8, postcss
  8.5.23 lên 8.5.28, nanoid 3.3.17 lên 3.3.19).

**Kiểm metro riêng vì gate không đụng tới nó:** `pnpm gate` chạy jest-expo chứ
không chạy Metro (ADR-0040 §5 — `expo export` tốn 1–2 phút nên đứng ngoài vòng
lặp TDD). Đã chạy `turbo run bundle --filter=@tourism/mobile`: ra bundle iOS
3.4MB và Android 3.7MB, đúng như CI. Build web thì cần API sống (ADR-0016) nên
chạy tay với API nền ở cổng 3001 — xanh.

**Review findings:** chưa có vòng review riêng.

Tests after: không đổi con số nào so với entry trước (thay đổi không chạm file
nguồn nào). Vitest 3657 chia ra api 932, web 1506, admin 838, contract 279, core
46, ui 22, tokens 18, i18n 16. Jest mobile 245 (mobile 159 và mobile-ui 86). Int
497 ở 39 file. Lint vẫn đúng 1 warning và 1 info có từ trước. `pnpm audit
--audit-level=moderate` nay exit 0.

## 2026-09-21 — Việc 4: OTP gửi ngay, `.vercel.app` chuyển hướng về www, và chốt KHÔNG tự đăng nhập sau OTP (nhánh `feat/outbox-nudge`)

Đóng mục cuối của bản bàn giao sau đợt hoàn tiền — ba đề xuất từ 18/09 user
chưa chọn. Kết cục ba kiểu khác nhau: một cái sửa code, một cái đổi thiết lập
hạ tầng, một cái chốt KHÔNG làm.

### 1. OTP và đặt lại mật khẩu xin drain ngay

- `9c10a5e3` feat(api): thêm `worker/outbox-nudge.ts` — registry cấp module,
  vòng worker đăng ký hàm `boss.send` của chính instance nó, đường request gọi
  `nudgeOutboxDrain()` để đẩy một job vào queue `outbox-drain` thay vì đợi tick
  cron (mỗi phút, granularity nhỏ nhất pg-boss cho). Gọi ở hai chỗ tạo email
  auth trong `auth.config.ts`: `PASSWORD_RESET` và `EMAIL_OTP` (callback OTP
  phục vụ cả ba loại OTP của plugin nên một dòng phủ hết).

  **Vì sao là registry chứ không phải DI** — bản bàn giao đề xuất "đẩy job cho
  pg-boss" mà chưa biết chỗ vướng: `sendVerificationOTP` là callback của plugin
  better-auth ở TẦNG MODULE, không nằm trong container Nest và ghi bằng `prisma`
  trần, nên không inject được gì vào đó. Dùng lại đúng instance pg-boss của
  worker (không mở client thứ hai) vì pool Postgres chốt ~10 kết nối.

  **BEST-EFFORT là toàn bộ hợp đồng**: không worker nào đăng ký, pg-boss lỗi,
  queue chưa tạo — đều log rồi đi tiếp, vì cron vẫn là lưới cuối. Để một lỗi
  pg-boss lan ra ngoài `sendVerificationOTP` là biến "email chậm một phút"
  thành "không đăng ký được".

  **Giới hạn đã biết, ghi trong JSDoc**: chỉ có tác dụng khi worker chạy CÙNG
  tiến trình API (`WORKER_INLINE=true` — đúng cấu hình prod trên Render free).
  Tách worker ra process riêng thì nudge trả `no-worker` và OTP quay lại nhịp
  cron; muốn phủ cả ca đó thì API phải tự mở một client pg-boss, tức thêm một
  kết nối vào pool — cố ý không làm khi prod chưa cần.

  Hai đường đã cân và loại: gọi thẳng `outbox.drainOnce()` trong request (app
  API không import `WorkerModule` nên KHÔNG có deliverer, và nó kéo cả lô 50
  row vào đường request); gửi thẳng qua Resend bỏ qua outbox (mất kiểm
  `email_suppressions`, mất retry, mất audit — đúng loại email không được phép
  mất mấy thứ đó).

- **Test của chính đợt này bắt được lỗi của chính nó.** Int spec mới ghim ca
  "queue chưa tạo → `failed` chứ không ném" — ca duy nhất soi được lỗi đăng ký
  sai thứ tự, vì nudge nuốt lỗi nên mọi thứ sai ở tầng queue đều hỏng IM LẶNG.
  Lượt đầu nó xanh, lượt sau đỏ: schema `pgboss` của `tourism_test` KHÔNG bị
  truncate giữa các lượt (globalSetup chỉ `migrate deploy` schema Prisma) nên
  queue do lượt trước tạo vẫn còn. Sửa bằng `deleteQueue` tường minh trước khi
  khẳng định, rồi chạy hai lượt liên tiếp để chứng minh tính lặp lại.

### 2. `.vercel.app` chuyển hướng về www — user đổi trên Vercel

Domain `tourism-platform-v2-web.vercel.app` đang phục vụ app trực tiếp
(`redirect: null`), nên mở site qua host đó thì đăng ký/đăng nhập hỏng: API chỉ
trả CORS cho `www.nexora-travel.agency` (đúng thiết kế W3/W4). User đặt redirect
308 sang www, giống hệt apex đã có sẵn. Đo sau khi đổi: `/`, `/login` và một
trang tour đều trả 308 và GIỮ NGUYÊN path; đi theo chuỗi thì đúng một lượt
chuyển hướng rồi 200 ở www.

Hệ quả phụ đã lường và đo: `robots.txt` trên host cũ nay cũng 308 sang www, nên
host đó không còn tự phục vụ `disallow: /` nữa. Chặt hơn chứ không hở — 308
vĩnh viễn gom tín hiệu về www và không còn nội dung nào ở host cũ để index,
trong khi `disallow` chỉ ngăn thu thập mà vẫn để URL tồn tại. Không file nào
trong repo ghi cứng host đó; `robots.ts` khớp theo mẫu `*.vercel.app` nên không
phải sửa.

### 3. Tự đăng nhập sau OTP — CHỐT KHÔNG LÀM

- `ab57f8dd` docs(web): ghi lý do ngay cạnh chỗ redirect trong `otp-form.tsx`.

Đọc plugin `email-otp` của better-auth 1.6.23: nó KHÔNG có tuỳ chọn phát session
sau `verify-email`. Hai route tách bạch — `/email-otp/verify-email` chỉ đánh dấu
email đã xác minh, còn `/sign-in/email-otp` là một luồng ĐĂNG NHẬP KHÔNG MẬT
KHẨU riêng. Nên "tự đăng nhập sau OTP" chỉ làm được bằng cách chuyển sang route
thứ hai, và cái giá là mã 6 số gửi qua email trở thành yếu tố đăng nhập đầy đủ
cho MỌI tài khoản, không riêng tài khoản vừa đăng ký — đúng thứ lần siết 20/08
cố ý bỏ. User chốt không đánh đổi. Ghi vào code chứ không chỉ vào đây, để lần
sau không ai đề xuất lại mà không biết điều đó; đổi ý thì phải đi qua một ADR.

**Review findings:** chưa có vòng review riêng.

Tests after: cổng đầy đủ xanh (28/28 task với `--concurrency=2`, int 6/6, API
nền sống cho build web). Int 498 ở 39 file (thêm 1: nối dây nudge trên pg-boss
thật). Vitest 3680, trong đó api 936 có thêm 4 test cho `outbox-nudge`; web
1525, admin 838, contract 279, core 46, ui 22, tokens 18, i18n 16 đều không
đổi. Jest mobile 245 không đổi. Lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — Nghiệm thu trên prod: hoàn tiền đã để lại vết ở `/payment-events` (không đổi code)

Đóng mục CÒN TREO quan trọng nhất của entry ADR-0043 bên dưới. Chạy tay trên
site thật theo từng bước, user bấm, agent đo.

**Đường đi:** đặt `BK-XKEHLSZL` (Hanoi Old Quarter Street Food by Night, đợt
16/10/2026, 1 người lớn, 35.00 USD) bằng tài khoản khách `boscowong31@`, trả qua
Stripe test mode, rồi huỷ. Chọn đợt 16/10 vì tour 1 ngày nên N = 1, hạn chót
15/10 — còn xa, huỷ phải hoàn ĐỦ. Hộp xác nhận in đúng "full refund of $35.00".

**Đo được, khớp từng lời hứa của ADR-0043:**

| Kiểm | Kết quả |
| --- | --- |
| Dòng sổ `refunds` | 35.00 USD, `re_3UHzrvK1oRTwa7qk1hs4Rxnw`, `admin_id` NULL |
| Row `payment_events` | type `payment.refunded`, gắn `BK-XKEHLSZL` |
| `event_id` là id refund của CỔNG | trùng `provider_refund_id` |
| `processed_at` = `received_at` = `refunds.created_at` | cả ba đúng `05:37:06.615` |
| `payload` | `source: refund-core`, `cause: cancel`, đủ ba id |
| `payment.refunded` toàn prod | 0 trước, **1** sau |
| Trang admin `/payment-events` | có dòng "Refund issued", 35.00, gắn đúng booking; drawer in đúng payload |

**Sửa một con số ghi sai ở entry ADR-0043 bên dưới.** Entry đó viết "hai khoản
hoàn cũ trên prod sẽ còn làm bất biến báo **2** cho tới lượt seed 03/11". Đo
thật thì là **46**: prod seed ngày 18/09 bằng bộ sinh CŨ nên 44 dòng hoàn của
seed mang type thô (`charge.refunded` 30, `PAYMENT.CAPTURE.REFUNDED` 14) và
cũng trượt bất biến mới, cộng 2 khoản hoàn thật. Bản chất không đổi — lượt seed
lại khoảng 03/11 ghi đúng `payment.refunded` và xoá cả 46 cùng lúc — nhưng con
số thì phải nói đúng.

**Một quan sát củng cố quyết định của ADR-0043:** lượt thanh toán này lại đẻ
thêm đúng 2 event Stripe không map được (`other` đi từ 4 lên 6), y như hôm
18/09. Nếu chọn hướng "bật `charge.refunded` ở dashboard" thay vì để lõi tự
ghi, dòng hoàn sẽ rơi vào đúng cái hố "Other / Not linked" đó.

**CÒN TREO:** connector Stripe trong phiên đã hết hạn nên KHÔNG đối chiếu được
dashboard cổng; `re_…` là id do chính Stripe trả về nên khoản hoàn chắc chắn đã
phát, nhưng muốn nhìn tận mắt thì mở dashboard test mode tìm
`pi_3UHzrvK1oRTwa7qk1fb0095a`. Booking `BK-XKEHLSZL` ở lại prod dưới dạng
CANCELLED đã hoàn đủ — không cần dọn, lượt seed 03/11 xoá sạch.

Tests after: không đổi code, không chạy lại cổng. Bằng chứng là dữ liệu prod đo
trực tiếp, liệt kê ở bảng trên.

## 2026-09-21 — Ba món nợ nhỏ sau đợt hoàn tiền: JSDoc cũ, dải chip chết, favicon 404 (nhánh `chore/refund-followups`)

Gom ba mục còn treo trong bản bàn giao sau đợt "hoàn tiền một hạn chót". Không
mục nào đổi hành vi money-path; không migration.

- `71050455` docs(contract): khối JSDoc trên `CancellationRequestStatusSchema`
  còn tả luồng duyệt huỷ của ADR-0029/0030 (REQUESTED là đơn đang mở, DENIED là
  admin từ chối, REFUNDED là đã duyệt rồi hoàn theo bảng bậc) — cả ba vế đều sai
  từ ADR-0041. Viết lại: `REFUNDED` là kết cục thường và mang nghĩa "đã giải
  quyết", KHÔNG phải "đã có tiền về" (huỷ quá hạn hoàn 0 cũng ghi nó mà không
  sinh dòng sổ `refunds`); `REQUESTED`/`DENIED` chỉ còn để đọc dữ liệu cũ. Câu
  cuối là đo được chứ không đoán: `verify-seed.mjs` dòng 242 đã có bất biến
  "yêu cầu huỷ còn REQUESTED hoặc DENIED" phải bằng 0. Chỉ sửa comment.
- `139c6f5a` refactor(web): xoá `DepartureStrip`. Bản bàn giao ghi "không trang
  nào render" — đúng nhưng chưa đủ: nó CÓ một người import là
  `DepartureStripConnected`, mà chính wrapper đó mới là thứ không ai gọi. Trang
  chi tiết tour cố ý bỏ dải chip theo wireframe đã duyệt (panel đặt chỗ ngay
  dưới đã in đúng bốn ô ngày đó), nên cả cụm là mã chết — và là mã chết mang
  LUẬT CŨ: nó chọn đợt theo mỗi `seatsLeft`, chưa qua `isDepartureOpen` của
  ADR-0041. Xoá component, spec 13 test, wrapper, và `MockTourDeparture` (consumer
  duy nhất của type đó là chính file vừa xoá — đúng tiền lệ `mocks/types.ts` đã
  ghi sẵn cho `MockTourDifficulty`/`MockTourBadge`). Hình dạng một đợt ở web nay
  chỉ còn `DepartureVM`. Vá năm chỗ chú thích trỏ tới file đã xoá, trong đó
  `tour-hero.spec.tsx` là chỗ ngoài kế hoạch tự lòi ra khi quét.
- `8d8da389` fix(web): rewrite `/favicon.ico` sang `/icon` ở `next.config.ts`.
  Icon sinh động từ `app/icon.tsx` (ADR-0038 AMEND 4) nên tab trình duyệt vẫn
  đúng, nhưng trình đọc RSS, crawler và trình duyệt cũ gọi thẳng `/favicon.ico`
  và nhận 404. Chọn rewrite thay vì đặt `public/favicon.ico` để giữ MỘT nguồn
  sự thật cho icon. Đo thật sau khi dựng, không chỉ khai là đã thêm dòng config:
  `/favicon.ico` trả 200, `content-type: image/png`, magic byte PNG đúng.
- `5caf15ef` chore(api): `EMAIL_FROM` mẫu ở `.env.example` đổi từ `tourism.test`
  sang `noreply@nexora-travel.agency`. Tên miền cũ chưa verify ở Resend nên mọi
  lượt gửi ở máy dev bị 403 và outbox đánh FAILED — đó là lý do luồng quên mật
  khẩu không thử được ở máy hôm 18/09. Kèm chú thích nói rõ phần sau `@` phải là
  tên miền đã verify. (`.env.local` của máy cũng đổi theo, nhưng file đó không
  commit.)

**Một lượt gate đỏ vì FLAKE, không phải hồi quy — ghi lại để khỏi truy lại lần
sau.** `apps/web/src/mocks/mocks.spec.ts` (test FAQ) timeout đúng 30 000ms trong
lượt `gate:int` đầu. Truy: test là hàm thuần (`await import('./faq.js')` rồi so
chuỗi), không I/O, không có gì để mất 30 giây; chạy riêng 14/14 xanh; chạy trọn
bộ web một mình 1525/1525 xanh; file đó lần cuối đổi ở `8e3f52e2` chứ không phải
đợt này, và thứ đợt này sửa trong `src/mocks/` chỉ là type — bị xoá lúc runtime,
mà typecheck trong chính lượt gate ấy đã xanh. Nguyên nhân là tranh tài nguyên:
bộ web tốn 631 giây CPU chỉ để import trên 96 giây thực, nên khi turbo chạy 8
package cùng lúc kèm một API server thì một `import()` kẹt là chuyện sẽ tới.
Chạy lại với `--concurrency=2` xanh trọn 28/28. Kết luận vận hành: ở máy này
chạy gate nên hãm concurrency, đừng đọc một lượt đỏ kiểu này là hồi quy.

**CÒN TREO:** Việc 4 của bản bàn giao (chuyển hướng `.vercel.app` về www, OTP gửi
ngay, tự đăng nhập sau OTP) vẫn chưa làm — cả ba chờ user chọn. Lỗ hổng
`image-size` mà workflow Audit bắt được đã do `f4809d3f` xử lý ở nhánh khác,
không thuộc đợt này.

**Review findings:** chưa có vòng review riêng.

Tests after: cổng đầy đủ xanh (28/28 task với `--concurrency=2`, int 6/6, API nền
sống cho build web). Int 497 ở 39 file, không đổi. Vitest 3676, trong đó web 1525
(bớt 13 test của `departure-strip.spec.tsx`; phần tăng so với entry trước là của
`969ccb7b` thêm `retry-fetch.spec.ts` theo ADR-0044, không phải đợt này); api 932,
admin 838, contract 279, core 46, ui 22, tokens 18, i18n 16 đều không đổi. Jest
mobile 245 không đổi. Lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — Hoàn tiền để lại vết ở sổ `payment_events` (nhánh `feat/refund-payment-event`, ff vào `main` `a1544081` — ĐẨY NHẦM, xem mục Review findings)

Hai khoản hoàn THẬT trên prod (`BK-7WKW9ESB`, `BK-PY7IZMD4`, nghiệm thu 18/09)
chỉ có event lượt thu, nên `/payment-events` — kính soi tiền của admin — không
bao giờ thấy tiền đi ra. Rà ra **ba** nguyên nhân chứ không một, và hai cái sau
khiến "bật thêm event ở dashboard" một mình là vô nghĩa:

1. Cả ba đường ghi dòng sổ `refunds` (admin hoàn thiện chí, khách tự huỷ,
   auto-refund của money-path) đều chỉ ghi `refunds`, không đường nào chạm
   `payment_events`.
2. Với Stripe, `data.object` của `charge.refunded` là một **Charge** — ta chỉ
   đặt `metadata[bookingId]` trên Checkout Session, không bao giờ đặt
   `payment_intent_data[metadata]`, nên Charge không mang metadata đó.
   `mapStripeEvent` đọc `object.metadata?.bookingId` và `object.amount_total`,
   Charge không có cả hai → row sẽ là `other` / không gắn booking / **không cả
   số tiền**. Đúng hình dạng hai row "Other / Not linked" prod đã ghi 18/09.
3. Seed ghi type **thô** của provider (`checkout.session.completed`,
   `charge.refunded`) còn `beginEvent` của app thật ghi type **trung lập**
   (`payment.completed`…). Nên không chỉ dòng hoàn lệch — dòng thu cũng lệch,
   mọi row seed nằm ngoài bộ lọc type của admin, và bất biến nghiệm thu seed
   (dò hai chuỗi thô) **không thể đúng với dữ liệu thật dù chọn hướng nào**.

Chốt hướng sau brainstorming ([ADR-0043](adr/0043-refund-payment-event.md)):
`payment_events` đổi nghĩa thành sổ sự kiện tiền CẢ HAI CHIỀU. Row hoàn không
phải dữ liệu bịa — cổng thật sự có phát event hoàn, ta ghi nó từ response của
API refund thay vì đợi echo. Đối soát qua webhook để dành dạng CHỈ ĐỌC, không
làm đường ghi thứ hai.

- `23768ed2` docs(adr): ADR-0043, ba nguyên nhân đo được, hai phương án đã bỏ
  (chỉ-bật-webhook; và giữ `payment_events` thuần webhook rồi cho admin đọc sổ
  `refunds` ở vùng khác — bỏ vì không đạt nghiệm thu user đặt ra).
- `41575415` feat(api): `VerifiedEvent['type']` nay là TỪ VỰNG của cột
  `payment_events.type`, thêm giá trị thứ năm `payment.refunded`; kéo theo
  `PAYMENT_EVENT_TYPES`, nhãn i18n "Refund issued" và icon `Undo2` ở menu lọc
  admin. **Không migration** — cột là `varchar(100)` tự do, không phải enum
  Prisma, nên không có gì phải deploy lên Supabase. Mirror spec ép hai chiều
  tuple ⊆ union và union ⊆ tuple nên quên chỗ nào là đỏ typecheck.
- `5d3d83d0` feat(api): builder THUẦN `refund-event.ts`, ba call-site ghi row
  trong ĐÚNG transaction đang ghi dòng sổ (vẫn trong advisory lock ADR-0009).
  `eventId` lấy id refund của CỔNG để khoá `[provider, eventId]` vẫn là lớp
  chống trùng thật; hai mốc bằng ĐÚNG `refunds.created_at` — đường huỷ cho CTE
  `refund_insert` trả `created_at` rồi dùng lại, hai đường kia lấy từ row Prisma
  vừa tạo. Ba khoản hoàn NGOÀI sổ (lệch tiền, dup-capture, nhánh off-ledger)
  giữ nguyên đường `note` của ADR-0006 AMEND 2a, có test chốt chặn. Seed ghi
  type trung lập và `eventId` là id refund của cổng; bất biến `verify-seed` đổi
  sang `payment.refunded`. Viết lại JSDoc ở bảy chỗ còn gọi bảng này là "sổ
  webhook".
- Chỉ số `paymentEvents.received` của dashboard nay gộp cả row hoàn. **Cố ý**
  (user chốt 21/09): mô tả đổi từ "thông lượng webhook" sang "số dòng sổ sự kiện
  tiền trong kỳ". Loại một type ra khỏi một chỉ số thông lượng là đúng thứ
  luật-chồng-luật rồi không ai nhớ.
- Hai thứ phải sửa dọc đường, đều là **rác cục bộ chứ không phải lỗi mã**:
  Prisma Client sinh ra ở máy còn bản trước M2 (thiếu `BOOKING_CANCELLED`) nên
  `typecheck` đỏ 19 lỗi `EmailType` cho tới khi `prisma generate`; và `.next` của
  admin còn trỏ hai trang `cancellations` đã xoá theo ADR-0041 nên
  `admin#typecheck` đỏ cho tới khi xoá thư mục. Lượt gate đầu còn đỏ ở
  `web#build` với `ECONNREFUSED` — đó là yêu cầu đã biết của ADR-0016 (build web
  cần API SỐNG, xem `ci.yml` bước "Migrate + seed db rồi mở API nền"), không
  phải hồi quy; chạy lại với API nền ở `localhost:3001` thì xanh.

**CÒN TREO cho session gốc:**

- **Nghiệm thu trên site thật** (thứ duy nhất chứng minh xong): huỷ một booking
  sandbox → `/payment-events` phải có dòng `Refund issued` gắn đúng booking,
  đúng số tiền.
- **Hai khoản hoàn cũ trên prod KHÔNG backfill** (user chốt 21/09): lượt seed
  lại prod khoảng 03/11 (ADR-0041 Phụ lục B Bước 8) xoá sạch chúng, nên
  migration backfill là làm việc rồi bị xoá. Tới lúc đó `seed:verify` trên prod
  vẫn báo 2 ở mục "refund không có đúng một payment event hoàn" — con số đã
  biết, không phải lỗi mới.
- **Nhánh này mang thêm 5 commit docs/mockup của một session khác**
  (`a176b7b4`…`8dafd4ee`, cụm mobile P5b và mục lục thư mục mockup) commit chồng
  lên trong lúc thi công. Không phải của đợt này. Cả 5 nay đã ở `main`.

**Review findings:** chưa có vòng review riêng. **Nhánh lên `main` do ĐẨY NHẦM
21/09**: session mockup được user duyệt đẩy MỘT commit docs (`8dafd4ee`) nhưng
chạy `git push origin HEAD:main` mà không kiểm lại HEAD — HEAD đã dịch sang
`a1544081` vì session này commit chồng lên trong lúc đó, nên ba commit của đợt
này đi theo. User chốt 21/09 **giữ trên `main` và review tại chỗ** thay vì
revert: không có migration nào đi kèm (0 file trong `prisma/migrations/`) nên
không có thay đổi DB nào được deploy, và revert thì Render/Vercel phải dựng
thêm một lượt nữa. Việc còn lại: chạy vòng review, sửa gì thì vá bằng commit
MỚI trên `main`.

Bài học cho lần sau: nhánh dùng chung nhiều session thì `git push HEAD:main`
là cái bẫy — phải `git log --oneline origin/main..HEAD` ngay trước khi đẩy,
hoặc đẩy đích danh SHA (`git push origin <sha>:main`).

Tests after: cổng đầy đủ xanh (28/28 task, int 6/6, với API nền sống). Int 497 ở
39 file (thêm 2: đường admin và đường khách tự huỷ). Vitest 3657, trong đó api
932 có thêm 7 test (5 cho builder `refund-event`, 2 cho chốt chặn từ vựng type ở
fixture seed chạy trên hai mốc H); các package còn lại không đổi — admin 838,
web 1506, contract 279, core 46, ui 22, tokens 18, i18n 16. Jest mobile 245
không đổi. Lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — M2 hoàn tiền một hạn chót: xoá hai cột badge huỷ và ba loại email duyệt (nhánh `chore/refund-deadline-m2`, ff vào `main`)

Migration thu hẹp đi sau M1 đúng một nhịp (Phụ lục B Bước 7 của plan 15/09,
spec 15/09 §10 bước 7). Code viết 19/09; merge và deploy 21/09 sau khi bản
ADR-0041 đã chạy thật ba ngày, đúng khoảng chờ user chốt 17/09. Prod đã seed lại
18/09 nên không bản API nào còn đọc hai cột.

- `22ec285a` chore(api): migration `20260919111406_refund_deadline_contract` xoá
  `tours.free_cancellation_days` và `cancellation_requests.free_cancellation_days`;
  dựng lại enum `EmailType` không còn `CANCELLATION_REQUESTED`,
  `CANCELLATION_APPROVED`, `CANCELLATION_DENIED` (Postgres không có
  `ALTER TYPE … DROP VALUE`). Migration mang chốt chặn `DO $$ … RAISE`: còn dòng
  `outbox` mang ba giá trị ấy thì dừng, không đổi kiểu nửa chừng.
- Code theo sau trong cùng commit: `EmailTypeSchema` còn 12 giá trị
  (`BOOKING_CANCELLED` vẫn cuối); gỡ ba `case` của `render-email.tsx` (105 dòng),
  ba mục của `outbox-type-menu.tsx` cùng ba icon mồ côi, và ba nhãn ở
  `@tourism/i18n`. Hành vi "hoàn 0 thì không hứa tiền" đã nằm ở biến thể không
  hoàn của `BOOKING_CANCELLED` (hai ca `amount: '0.00'` trong spec), nên xoá
  describe cũ không mất bất biến nào.
- Lệch plan, đã xử lý: Step 4 chạy `prisma migrate dev` không kèm `DATABASE_URL`,
  tức rơi vào DB Docker `tourism` dùng chung. Checkout gốc còn trên `main` chưa
  có M2 sẽ hỏng, vì Prisma Client ở đó vẫn SELECT hai cột. Lượt này tạo và kiểm
  migration trên DB riêng `tourism_m2` rồi xoá; sau cổng xoá luôn `tourism_test`,
  vì globalSetup chỉ `migrate deploy` chứ không reset — lần chạy sau tự dựng lại
  theo migration của checkout đang chạy.
- Chú thích ở `seed.ts` từng nói M2 xoá cả `decision_note`; sai, M2 chỉ xoá
  `free_cancellation_days`. Đã sửa.
- **Lệch plan nặng nhất, bắt được trước khi deploy:** Step 12 bảo chạy M2 lên
  Supabase TRƯỚC khi push. API đang chạy vẫn khai hai cột trong `schema.prisma`,
  và Prisma Client liệt kê mọi cột khi query không có `select` riêng
  (`catalog.service.ts` trang chi tiết tour, `cancellations.service.ts` lịch sử
  huỷ) — xoá cột trước là 500 cho tới khi Render dựng xong API mới. Thứ tự đúng:
  push code, chờ Render chạy API mới, rồi mới chạy M2. Step 12 của plan đã sửa.

Kiểm trên DB riêng: `migrate dev` lần hai báo "Already in sync" (SQL viết tay
khớp `schema.prisma`); seed H = 2026-09-18 trên schema M2 rồi `seed:verify`
0 vi phạm trên 106 bất biến. Trên prod trước khi push: `outbox` không còn dòng
nào mang ba loại cũ (chốt chặn sẽ qua), `migrate status` chỉ còn M2 chưa áp.

**Trạng thái deploy:** commit code push lên `main` lúc 07:19 giờ VN 21/09; Render
dựng xong bản mới lúc 07:23 (deploy `dep-dao7g72jnfac739etisg`, `status: live`),
CI `gate` của `22ec285a` xanh; **M2 chạy lên Supabase lúc 07:28 giờ VN 21/09**,
`migrate status` in "Database schema is up to date!". Đo lại trên prod ngay sau
đó: không còn cột `free_cancellation_days` nào, enum `EmailType` còn 12 giá trị
đúng thứ tự với `BOOKING_CANCELLED` ở cuối, kiểu tạm `EmailType_old` đã bị xoá.
Kiểm chạy: `/api/tours/{slug}` (đường Prisma đọc mọi cột của `Tour`),
`/api/tours`, `/health` và bốn trang web đều 200 — gọi mỗi trang hai lần vì ISR.

**Review findings:** không có vòng review riêng; migration và phần gỡ code theo
đúng plan đã duyệt, cổng đầy đủ là lưới.

Tests after: cổng đầy đủ xanh. Int 495 ở 39 file (có spec đối chiếu thứ tự enum
giữa DB và contract). Vitest 3650 (api 925, bớt 11 test của ba template; contract
279, admin 838, web 1506, core 46, ui 22, tokens 18, i18n 16) và jest mobile 245.
Build 8/8, web 75/75 trang. Typecheck 15/15. Lint chỉ còn 1 warning và 1 info có
từ trước. `check-admin-prerender` OK, tokens-only ✓.

## 2026-09-18 — Tinh chỉnh giao diện web và admin: hạn chót huỷ, hộp huỷ, nút Export, nút Ask about, favicon (nhánh `fix/ui-polish-web-admin`, ff vào `main`)

User gom năm góp ý giao diện từ hai lượt nghiệm thu (test tay 17/09, nghiệm thu
prod 18/09) vào một nhánh. Bốn commit, không migration, không đổi API:

- `8039a8f3` nút "Ask about this trip" ở hàng chuyến đã đóng của tab Departures:
  chữ xuống hai dòng kế thừa `text-right` của ô bảng nên canh phải, nay canh giữa.
- `c3fc9dec` favicon: web vẫn dùng `favicon.ico` mặc định của create-next-app
  (chính là logo Vercel, có từ scaffold 22/07), admin không có favicon nào. Hai
  app nay sinh `app/icon.tsx` (32px) và `app/apple-icon.tsx` (180px) bằng
  `ImageResponse`: hai viên kim cương của logo trên ô vuông nền primary, màu lấy
  từ `@tourism/tokens/theme`; hình mark tách thành hằng `LOGO_MARK` dùng chung
  với `Logo`. Ở admin, `/icon` và `/apple-icon` vào `PUBLIC_PATHS` (không thì
  trang login mất icon) và vào allowlist của `check-admin-prerender.mjs`, ghi
  thành ADR-0038 AMEND 4.
- `02edc785` nút Export CSV của admin: cao 32 → 28px, rộng tối thiểu 192 → 144px,
  chữ 11 → 10px; giữ nguyên kiểu HUD.
- `8646aa7c` trang booking của khách: hạn chót huỷ miễn phí từ dòng chú thích xám
  cỡ nhỏ thành khối có viền, tiêu đề, icon lịch và chữ cỡ thân bài; quá hạn thì
  cả khối sang tông cảnh báo. Hộp xác nhận huỷ rộng 384 → 512px, tiêu đề
  `text-xl`, thân và link `text-base`, hai nút cỡ lớn.

Nghiệm thu: user xem bằng mắt trên localhost bốn mục (DB Docker riêng
`tourism_ui`, H = 2026-09-18). Nút Export để kiểm trên production vì admin local
không đăng nhập được: thư đặt lại mật khẩu bị Resend từ chối 403, do `.env.local`
gửi từ tên miền `tourism.test` chưa xác minh.

**Review findings:** không có vòng review riêng; đây là tinh chỉnh giao diện nhỏ,
user duyệt bằng mắt từng mục.

**CÒN TREO:** kiểm nút Export trên production sau deploy · xoá DB Docker
`tourism_ui` khi nghiệm thu xong · ở máy dev không gửi được thư thật (tên miền gửi
`tourism.test`), muốn thử luồng email ở máy thì đổi địa chỉ gửi sang tên miền đã
xác minh · ba đề xuất 18/09 user chưa chọn làm: chuyển domain `.vercel.app` về
www, gửi OTP ngay khi tạo mã, tự đăng nhập sau khi xác minh OTP.

Tests after: cổng đầy đủ xanh. Int 495 ở 39 file. Vitest 3661 (admin 838 có thêm 2
test cổng icon, web 1506, api 936, contract 279, core 46, ui 22, tokens 18, i18n
16) và jest mobile 245. Build 8/8, web 75/75 trang (thêm hai route icon, bớt
`favicon.ico`). Typecheck 15/15. Lint chỉ còn 1 warning và 1 info có từ trước.
`check-admin-prerender` OK, tokens-only ✓.

## 2026-09-18 — Triển khai hoàn tiền một hạn chót lên prod và seed lại dữ liệu (Phụ lục B Bước 2–6)

Phần hạ tầng của entry ngay dưới. Không đổi code; commit này chỉ mang snapshot,
bản đồ tài liệu và hai ghi chú cho plan.

- **Bước 2 (09:40 giờ VN):** M1 `20260915120000_refund_deadline_expand` lên
  Supabase qua Session pooler cổng 5432, `migrate status` báo "up to date"; API cũ
  vẫn `database: up`.
- **Bước 3–5:** Ignored Build Step của hai project Vercel tạm để không build. Push
  `2060c457..3569f496` thì deployment của web và admin đều Canceled, đúng ý đồ.
  Render chạy API mới sau khoảng 100 giây; CI run `35301236930` success. Redeploy
  web và admin từ chính bản Canceled của `3569f496`, bỏ build cache, rồi trả
  Ignored Build Step về giá trị cũ. Web: `/`, `/tours`, `/cancellation-policy` và
  trang tour trả 200, in hạn chót từng chuyến. Admin: `/bookings`, `/outbox`,
  `/reports` tải được, `/cancellations` ra 404.
- **Bước 6, seed lại prod với H = 2026-09-18.** Đo trước: prod không có dòng nào
  tạo sau lượt seed 15/09, tức toàn dữ liệu seed. Tập dượt trên DB Docker rỗng dựng
  bằng `migrate deploy`: `seed:verify` 0 vi phạm trên 106 bất biến; bốn chốt chặn
  nhắm prod (thiếu cờ, thiếu H, H ở tương lai, mật khẩu khách trống) đều dừng trước
  khi kết nối. Lượt prod: `snapshot:export` 3117 dòng (`docs/snapshots/2026-09-18/`
  đi cùng commit này, `backups/2026-09-18/` gitignored); `data:reset` chạy khô rồi
  chạy thật, xoá 2662 dòng (có 9 yêu cầu `REQUESTED` của luồng duyệt cũ), giữ đúng
  một admin; `db:seed` ghi 702 booking, 730 payment event, 44 dòng hoàn, 15 yêu cầu
  huỷ, 261 chuyến, 119 review, 67 enquiry, 177 subscriber, 120 khách giả và gỡ 29
  policy `CANCELLATION` cũ; `seed:verify` 0 vi phạm trên 106 bất biến.
- **Nghiệm thu sandbox Stripe, đạt 5/5**, trên tài khoản khách mới do user tạo:
  1. `BK-7WKW9ESB` (tour trong ngày, đi 22/11) trả bằng thẻ test: `PAID`, webhook
     xử lý ngay, thư xác nhận Sent.
  2. Huỷ trong hạn: hộp xác nhận "Cancel and refund $49.00"; booking `CANCELLED`,
     một dòng hoàn $49 mang mã refund Stripe, `admin_id` NULL, thư huỷ Sent.
  3. Admin ghi "By the customer · Within the free-cancellation deadline (21 Nov
     2026) · Refunded $49.00". Mã refund do Stripe trả về, API chỉ ghi dòng hoàn
     sau khi có mã; phía dashboard Stripe do user tự xem (Stripe MCP của agent nối
     một tài khoản khác).
  4. Huỷ quá hạn trên booking seed `BK-9L93LTWH`: "Cancel without refund", không
     dòng hoàn, không gọi cổng. Thư biến thể không hoàn bị Resend từ chối 422 vì
     địa chỉ `@example.com` của khách seed: outbox có một dòng FAILED, không thử
     lại, lượt seed 2 sẽ dọn.
  5. Trang `central-honeymoon-5d`: chuyến 22/09 ghi "Booking closed" kèm "Ask about
     this trip", bốn ô tổng hợp bỏ qua chuyến đã đóng.

**Phát hiện trong lúc triển khai:**

- Danh sách Deployments của Vercel không hiện bản Canceled, phải mở thẳng trang
  deployment để Redeploy; Redeploy bản Ready cũ hơn là build lại code cũ. Đã ghi
  vào Bước 5 của plan.
- Lệnh `echo "${DATABASE_URL%%@*}"` ở Bước 2 của plan in ra MẬT KHẨU (phần trước
  `@`). Lượt này không dùng nó; plan đã sửa thành `${DATABASE_URL##*@}`.
- Mở web qua `tourism-platform-v2-web.vercel.app` thì đăng ký báo "Something went
  wrong": API chỉ trả CORS cho `www.nexora-travel.agency`, đúng thiết kế W3/W4.
  Nên cho domain `.vercel.app` chuyển hướng về www.
- Thư OTP chờ khoảng 1,5 phút vì outbox gửi theo cron mỗi phút. Xác minh OTP xong
  phải đăng nhập lại là cố ý từ 20/08 (verify không phát session).

**CÒN TREO:** Bước 7 (nhánh M2, sau vài ngày chạy thật) · Bước 8 (lượt seed 2
khoảng 03/11) · nhánh tinh chỉnh giao diện web và admin mà user gom ngày 18/09 ·
chuyển `backups/2026-09-18/` từ worktree về checkout gốc trước khi gỡ worktree ·
seed lại DB Docker `tourism` theo code mới.

Tests after: không đổi code; CI của `3569f496` success.

## 2026-09-18 — Hoàn tiền một hạn chót mỗi chuyến (ADR-0041, nhánh `feat/refund-deadline`, ff vào `main`)

Thay bảng bậc 100/50/25/0, ân hạn 24 giờ và luồng duyệt huỷ bằng MỘT hạn chót
cho mỗi chuyến: ngày chót = khởi hành trừ N, với N là 1 cho tour trong ngày, 3
cho tour 2–3 ngày, 7 cho tour từ 4 ngày. Cùng một mốc vừa ngừng nhận đặt vừa hết
huỷ miễn phí. Khách tự huỷ và hệ thống xử lý ngay: trong hạn hoàn trọn phần còn
lại, quá hạn hoàn `0.00` và không gọi cổng thanh toán. Mọi phép so ngày theo giờ
Việt Nam, tính ở server. 15 task, 14 commit thi công (`b11c5a5f..e5cf0cbf`, kèm
hai commit ghi chú cổng), một commit vá sau nghiệm thu, một commit ghi điều chỉnh
seed prod và bốn commit vá sau review: 22 commit, rebase lên `main` `2060c457`.

- Luật là bộ hàm thuần ở `libs/shared/contract/src/schemas/refund-policy.ts`
  (`cancellationDeadline`, `isWithinDeadline`, `canCancelOnline`,
  `refundOnCancel`, `vietnamToday`); API, web, admin, seed và email gọi chung.
- Lõi huỷ `cancelInLock` chạy trong advisory lock của booking: gọi cổng thanh
  toán TRƯỚC, một CTE ghi SAU (booking CANCELLED, yêu cầu REFUNDED, dòng hoàn
  nếu có, trả ghế, outbox `BOOKING_CANCELLED`). P4e-1 dùng lại cho nút
  "Cancel departure".
- Gỡ: vùng Cancellations của admin, `admin.cancellations.*`, stepper duyệt,
  `CANCELLATION_OPEN`, `refundEstimate`, badge `freeCancellationDays`.
- Báo cáo tháng đổi cặp approved/denied thành huỷ trong hạn và huỷ quá hạn; P&L
  tính tiền giữ lại của booking huỷ quá hạn là doanh thu (ADR-0033 AMEND 2).
- Hai migration: M1 `20260915120000_refund_deadline_expand` (mở rộng) chạy cùng
  đợt này; M2 thu hẹp đi ở nhánh riêng sau khi prod đã seed lại.
- Plan 15 task sai hoặc sót khoảng một chục chỗ nhỏ (fixture, vòng đếm grep, copy,
  số ca seed); mỗi chỗ đã vá lúc thi công và ghi trong message commit của task đó.

**Đóng hai mục CÒN TREO:**

- Chốt chặn đặt chỗ: từ nay `create` và `checkout` bị chặn sau hạn chót của
  chuyến, thay cho đề xuất "chốt chặn 3 ngày" còn treo từ vòng rà 04/09.
- `search_path` của `refunds_sum_within_total()` đã ghim
  (`SET search_path = public, pg_temp`), đóng cảnh báo
  `function_search_path_mutable` của linter Supabase.

**Nghiệm thu 17/09:** `seed:verify` 0 vi phạm trên 106 bất biến ở ba mốc H
(20/09, 03/11, 17/09), mỗi mốc một DB Docker mới dựng bằng `migrate deploy`. User
test tay 10 bước trên trình duyệt, đạt cả 10: khách huỷ trong hạn và quá hạn, cổng
lỗi thì booking giữ nguyên, API chặn đặt chuyến đã đóng, lịch sử huỷ và hoàn
thiện chí ở admin, outbox, báo cáo và file Excel. Bốn phát hiện giao diện, vá
trong `0d0659db`:

- Tháng chỉ còn chuyến đã đóng vẫn báo "Almost full": `monthNotice` nay bỏ chuyến
  đã đóng khi xét ghế và báo "Booking closed" khi tháng hết chuyến nhận đặt.
- Ô "Seats left" cộng cả ghế chuyến đã đóng dưới nhãn "across every open date".
- Ô "Price range" tính cả giá chuyến đã đóng; hết chuyến nhận đặt thì lùi về
  `basePrice` như `heroPrice`. Ô "Next departure" cùng lỗi, nay ghi "Booking closed".
- Testimonial mẫu "Cancelled two days before … refunded" trái luật với chuyến từ
  hai ngày trở lên, đổi thành huỷ trước một tuần.

**Review findings:** 3, cả ba trên đường tiền, vá trong `c95d5fa4`, `f283d829`,
`896b1b15`; `64151282` ghi lại vào ADR-0041 §4 và spec §4.4.

- Event `payment.completed` gửi lại trên booking khách đã huỷ quá hạn đi đường
  tiền mồ côi, tức hoàn trọn khoản luật cho giữ và đổi booking sang REFUNDED.
  `handleCaptureOnCancelled` nay xét `provider_payment_id` của booking: NULL là
  tiền mồ côi thật (đường cũ), trùng capture là event gửi lại nên không làm gì,
  capture khác là khách trả hai lần nên hoàn ngoài sổ.
- Hộp xác nhận in số hoàn lúc tải trang còn server tính lại lúc bấm: mở trang
  trước nửa đêm ngày hạn chót rồi bấm sau nửa đêm thì booking bị huỷ với 0 đồng
  mà khách không được hỏi lại. `bookings.cancel` nay bắt buộc
  `expectedRefundAmount`; lệch thì 409 `REFUND_AMOUNT_CHANGED` và không ghi gì,
  web báo khách rồi tải lại số mới.
- Khoá chống trùng `cancel:<bookingId>` giữ nguyên qua mọi lần thử trong khi số
  tiền tính lại từ sổ: hoàn thiện chí xen giữa hai lần thử thì cổng từ chối vì
  trùng khoá, khách kẹt ở `REFUND_FAILED`. Khoá nay là
  `cancel:<bookingId>:<tổng đã hoàn>`; câu `REFUND_FAILED` thôi khẳng định booking
  "không đổi gì", log API ghi khoá và nhắc đối soát khi lỗi là hết giờ chờ.

Rủi ro còn lại, đã báo user và chấp nhận: Stripe lưu cả phản hồi lỗi 500 theo khoá
trong 24 giờ; cổng hết giờ chờ nhưng thật ra đã hoàn, sau đó khách quá hạn xác
nhận huỷ 0 đồng, thì sổ lệch cổng và phải đối soát tay.

**Trạng thái deploy:** M1 chạy lên Supabase 18/09 (Phụ lục B Bước 2 của plan),
TRƯỚC khi push. Seed lại prod chạy sau push và ghi ở entry sau.

**CÒN TREO:**

- Seed lại prod theo seed spec §8.3 và nghiệm thu sandbox Stripe năm mục (Phụ lục
  B Bước 6).
- M2 (xoá hai cột `free_cancellation_days` và ba loại email duyệt huỷ, Phụ lục A):
  chỉ chạy sau khi bản mới đã chạy prod vài ngày (Bước 7).
- Lượt seed prod 2 khoảng 03/11 với bốn điều chỉnh ghi 17/09 (Bước 8).
- Nợ P4e-1: nút "Cancel departure" mở `cancelInLock` cho `initiator: 'operator'`
  và CHECK `end_date >= start_date` trên `tour_departures`.
- JSDoc của `CancellationRequestStatusSchema` (`libs/shared/contract/src/schemas/bookings.ts`)
  còn tả luồng duyệt cũ. `DepartureStrip` (giữ có chủ đích, chưa trang nào dùng)
  chưa theo cờ `bookable`.
- Góp ý giao diện user để làm sau: dòng hạn chót ở trang booking và hộp huỷ quá
  nhỏ, nút Export của admin quá to.
- DB Docker dùng chung `tourism` đã có M1 nhưng dữ liệu vẫn theo seed cũ; seed
  lại theo code mới trước khi dev tiếp.

Tests after: cổng đầy đủ xanh sau rebase (bảy lệnh của Phụ lục B Bước 4). Int 495
test ở 39 file. Unit Vitest 3659 (contract 279, api 936, admin 836, web 1506, core
46, ui 22, tokens 18, i18n 16) và jest mobile 245 (mobile 159, mobile-ui 86). Build
8/8, web 74/74 trang với API sống ở `localhost:3001`. Typecheck 15/15. Lint chỉ
còn 1 warning và 1 info có từ trước nhánh. Tokens-only ✓ 65 file nguồn mobile.

## 2026-09-18 — Vòng vá review 2 cụm auth mobile: review nhánh của Nghĩa, giữ ba phần, vá bốn chỗ (`fix/p5b-auth-review-2`, ff vào `main`)

User review nhánh `feat/mobile-dev-api-url-auto-derive` của Nghĩa (2 commit
`32ef255e`, `dacc4fdd`, rẽ từ `ee91d5b1` — TRƯỚC vòng vá review 1) bằng review 10
góc có kiểm chứng; 15 phát hiện đều xác nhận. User chốt 18/09: dựng nhánh mới từ
`main`, chỉ đưa sang phần khớp bản vẽ, commit của Nghĩa đứng tên Nghĩa; nhánh gốc
xoá sau merge.

Đưa sang, đứng tên Nghĩa:

- `1f2efd15` nút pill cao 46dp — đúng `.btn` 46px của bản vẽ.
- `ed2d0353` tự suy origin API dev từ `hostUri` của Metro (bản gốc, vá ở dưới).
- `60154a49` nút Next onboarding tròn 54dp nền primary — đúng `.round` của bản vẽ;
  main đang lệch với `IconButton` glass 44dp.

Vá chồng lên:

- `403425a8` bản tự suy gốc ĐÈ `EXPO_PUBLIC_API_URL` ở mọi phiên Metro và tắt chốt
  https. Lệnh dev mặc định (`--tunnel`) cho `hostUri` là host ngrok không cổng, nên
  origin thành `http://…exp.direct:3001` — cổng tunnel không mở — còn API đã deploy
  khai trong `.env.local` bị bỏ qua mà không báo gì. Nay env tường minh thắng; chỉ
  thay host loopback bằng IPv4 LAN của Metro, giữ scheme và cổng; tunnel,
  `--localhost`, IPv6 và bản phát hành giữ nguyên env. Lỗi đang ngủ vì chưa màn nào
  dùng `apiUrl`.
- `20ddcf3b` pill lấy `touchTargetMin` làm sàn — 46 > 44 trước đó chỉ là trùng số.
- `246cb9d9` font nạp lỗi thì `fontsLoaded` mãi false: cây không vẽ, splash không
  gỡ, không gì ném lên `ErrorBoundary` (lỗi có từ trước). Nay nạp lỗi cũng tính là
  xong, app vẽ bằng chữ hệ thống.
- `e6bd9500` runbook `mobile-dev-loop.md` và `.env.example` theo hành vi mới.

Không đưa sang, lý do đã kiểm bằng mã nguồn thư viện:

- **Dev build/EAS** (`expo-dev-client`, `eas.json`, `extra.eas.projectId`, `owner:
  ngh1az`) và `@expo/ngrok` trong devDependencies: đảo ADR-0040 §1 mà không có AMEND
  (CLAUDE.md #5). Có `expo-dev-client` là `expo start` tự chuyển sang dev client nên
  QR hết mở bằng Expo Go; `projectId` bật ký manifest ở mỗi request nên người chưa
  đăng nhập Expo bị prompt chặn. User chọn giữ Expo Go.
- **Splash poster 1080×2340** kèm `resizeMode: cover` và bỏ `imageWidth`: plugin
  `expo-splash-screen` 57 chỉ vẽ ảnh trong ô vuông `imageWidth` (mặc định 100) trên
  cả hai nền tảng, nên poster còn khoảng 46×100dp — mark 9dp, tagline 1dp. Kèm mốc
  giữ splash 900ms áp cho cả bản phát hành.
- **Tinh chỉnh khoảng cách** 5 màn auth, onboarding và gallery: rẽ từ trước review 1
  nên conflict 8 file, và chọn phía nhánh là đảo ba bản vá (`autoFocus` màn quên mật
  khẩu, vai `subtitle`, `insets.bottom` ở onboarding). `View` bọc cộng dồn margin lên
  primitive nên lệch bản vẽ xa hơn (OrDivider 16 so với 10, Checkbox 24 so với 14);
  `OnboardingButton` cao cứng 68dp; cỡ chữ viết số; `\n` cứng trong tiêu đề i18n.

Tests after: mobile 159 test ở 31 file (149, thêm 9 cho `resolveDevApiUrl` và 1 cho
font lỗi), mobile-ui 86 (thêm 1 cho sàn vùng chạm) — mỗi test mới đã chạy đỏ trước
khi sửa. Build và typecheck 6/6 task của các gói bị ảnh hưởng, Biome exit 0,
tokens-only ✓ 65 file nguồn mobile, `bundle` xanh cả iOS lẫn Android, `expo-doctor`
21/21, user test tay nút Next trên máy thật. `test:int` KHÔNG chạy ở máy: DB
`tourism_test` đang mang migration `20260915120000_refund_deadline_expand` của nhánh
hoàn tiền chưa merge, chạy chung dễ phá session kia; nhánh này không chạm `apps/api`
và CI chạy `test:int` với Postgres riêng.

**CÒN TREO:**

- Splash chưa có wordmark và tagline như khung 1a — plugin chỉ vẽ một ảnh nhỏ giữa
  màn, cần chốt cách làm trước.
- Phần vá giao diện giao cho Nghĩa vẫn mở: 6 khung chưa đối chiếu trên máy (4a–4c,
  5b, 5c, 5d), nền tối chưa soi. Làm lại trên nền `main` hiện tại: số dọc qua
  `fromMockup`, cỡ chữ qua vai `AppText`, khoảng cách sửa trong primitive.
- Runbook `mobile-dev-loop.md` và ADR-0040 §8 còn tiền đề WSL NAT, tunnel mặc định —
  lỗi thời từ 14/09 khi máy dev chuyển sang Windows native.
- `expo start` tự gỡ `expo-env.d.ts` khỏi `include` của `apps/mobile/tsconfig.json`
  mỗi lần chạy (typedRoutes tắt), để lại file bẩn — commit sẵn thay đổi đó.
- Nợ cũ giữ nguyên: chặn tab khi chưa đăng nhập · icon app · admin chuyển sang
  `@tourism/core` · nối API thật.

## 2026-09-16 — Vòng vá review 1 cụm auth mobile: chờ font rồi mới vẽ, dựng lại đúng tỉ lệ bản vẽ (`fix/p5b-auth-review-1`, ff vào `main`)

User nghiệm thu bằng máy thật (Android, nền sáng) ngay sau entry dưới và bắt được
ba chuyện. Hai chuyện đầu là lỗi; chuyện thứ ba là sai ở CÁCH chuyển bản vẽ sang
code, không phải thiếu việc.

- `4e3591e7` chữ "Skip" ở onboarding hiện ra "Ski", reload một lần thì đúng lại.
  Vỏ ứng dụng vẽ ngay bằng chữ hệ thống rồi mới đổi sang chữ brand, mà BỐ CỤC đã
  đo xong bằng khuôn cũ nên ký tự cuối bị cắt; lần hai font đã nằm trong cache nên
  không thấy nữa. Nay chưa có font thì chưa vẽ gì — splash vẫn đang che nên quãng
  chờ đó không ai thấy. Bước đọc cờ onboarding dời xuống sau khi có cây thật, vì
  `router.replace` gọi lúc cây còn `null` là gọi khi chưa có navigator nào mounted.
  Cùng commit: tab Account nay có nút Sign in (vỏ ứng dụng trước đó không có đường
  nào tới cụm auth ngoài trang onboarding cuối) kèm đường tắt tới `/dev/gallery`
  chỉ dựng ở bản dev.
- `441ae969` **khung điện thoại trong mockup là 324×700 px — một hình minh hoạ thu
  nhỏ, không phải khung máy** — mà đợt dựng chép thẳng số pixel đó thành dp. Ảnh bìa
  300px là 42,9% khung vẽ nhưng chỉ còn 35,5% trên máy 844dp: ảnh thấp hơn thiết kế,
  chữ dồn lên cao, đáy thừa khoảng trống. `fromMockup(px, screenHeight)` quy mọi số
  DỌC về tỉ lệ chiều cao màn; đệm ngang và cỡ chữ vẫn theo token.
  - Nút thoát, nhãn địa danh và Skip đo từ `insets.top` thay vì top cứng: bản vẽ có
    thanh trạng thái giả cao 40px, máy thật có tai thỏ 47–59dp nên nút bị cắt.
  - Màn kết quả: nút chính nay bo tròn hết cỡ và ghim đáy đúng lề 24dp.
  - `AppText` thêm vai `subtitle` (bậc sm) cho câu dẫn dưới tiêu đề; vai `label` đổi
    sang semibold theo Archivo 600 của bản vẽ.
  - Stack gốc khai luôn nhóm `dev`. Thiếu dòng đó, expo-router đội cho gallery một
    header tên "dev", khung ngắn lại và **gallery trông giống bản vẽ hơn màn thật** —
    chính quan sát này của user là bằng chứng chốt chẩn đoán tỉ lệ.
  - Bỏ `autoFocus` ở ô email màn quên mật khẩu: bàn phím bật ngay che mất nút gửi.

Tests after: `gate:int` xanh (6/6 task, int 496 test ở 37 file), `gate` 28/28, mobile
149 test (thêm 2 cho `fromMockup`), `bundle` xanh cả iOS lẫn Android, tokens-only ✓
65 file nguồn mobile.

**CÒN TREO — bàn giao phần vá giao diện cho thành viên khác (user chốt 16/09):**
mới đối chiếu được 8 ảnh máy thật, TOÀN Ở NỀN SÁNG; chưa ai soi nền tối. Sáu khung
chưa từng đối chiếu trên máy: verify email (4a, 4b, 4c), forgot đã gửi (5b), reset
(5c, 5d). Cỡ nhãn nhỏ trong ô nhập, cỡ chữ dòng điều khoản và số đo ô OTP cũng chưa
so với bản vẽ. Nợ cũ giữ nguyên: chặn tab khi chưa đăng nhập · icon app · admin
chuyển sang `@tourism/core` · dòng COPY trong `apps/api/Dockerfile` nếu API dùng
`core` · nối API thật.

## 2026-09-16 — P5b-1 cụm auth mobile: `@tourism/core` và 17 khung giao diện tĩnh (hai nhánh, ff vào `main`)

Spec: [specs/2026-09-16-p5b-auth-wireframe-design.md](specs/2026-09-16-p5b-auth-wireframe-design.md) ·
plan: [plans/2026-09-16-p5b-auth-wireframe.md](plans/2026-09-16-p5b-auth-wireframe.md) ·
mockup user duyệt: `design/mockups/mobile-auth-screens.src.html` ·
bàn giao: [handoff/mobile-auth-handoff.md](handoff/mobile-auth-handoff.md).

### Nhánh 1 — `refactor/shared-auth-rules` (4 commit, `d3a3c442`…`8fa89ff3`)

- `d3a3c442` dựng `@tourism/core` tại `libs/shared/core` (đóng gói y hệt `@tourism/i18n`)
  và chuyển NGUYÊN VĂN `auth-errors.ts` của web sang, kèm test.
- `7baeee14` chuyển tiếp `auth-form.ts`; 7 file của web đổi đường import, không đổi
  một dòng logic nào.
- `d4763519` hàng rào import canh bằng máy (`package-boundary.ts`): chỉ được import
  tương đối, `@tourism/contract` và `@tourism/i18n` — cấm react/react-native/next/DOM/Node.
- `8fa89ff3` khai type Node cho chính spec quét file đó (ADR-0042).
- `AuthErrorField` thêm `'otp'` để mã xác minh sai rơi đúng kênh 1; web không đổi
  hành vi vì web không có màn nào nhận field `otp`.

### Nhánh 2 — `feat/p5b-auth-screens` (14 commit, `fcffded1`…`8504135a`)

Dựng đủ **17 khung** của spec §4 dưới dạng giao
diện TĨNH; không màn nào gọi API thật.

- **Bộ primitive mới** (`@tourism/mobile-ui`): `TextField` (nhãn nổi, nút hiện/ẩn
  mật khẩu), `FormMessage`, `OtpInput` (một ô nhập trong suốt phủ 6 ô vẽ — hệ điều
  hành lo sẵn nhảy ô, xoá lùi và dán mã), `Checkbox`, `IconButton`. `AppText` thêm
  tông `link` và `media`; `Button` thêm `shape="pill"`, `leading` và vai `media`.
  Cầu font brand (Literata cho tiêu đề, Archivo cho thân) và `withAlpha` để suy dải
  mờ TỪ token thay vì gõ màu tay.
- **Seam hạ tầng**: `AuthActions` 7 method cùng bản giả lập chọn nhánh theo email và
  mã nhập vào, và `OnboardingStore` nhớ trong RAM. Người làm hạ tầng đổi đúng hai
  dòng ở `src/app/_layout.tsx`.
- **Ba kênh lỗi, một hàm quyết kênh** (`placeAuthError`): dưới ô sai · khung ngay
  trên nút chính · thay cả thân màn. Màn không tự chọn kênh nên hai màn không thể
  nói khác nhau về cùng một mã lỗi.
- **Cụm `(auth)` bỏ hẳn header**: mỗi màn tự vẽ đường thoát đè lên nội dung (X đóng
  cả nhóm ở màn đầu, mũi tên lùi ở màn đi tiếp, màn kết quả không có đường lui).
- **Splash và onboarding**: `assets/splash-mark.png` xuất từ chính mark SVG của web;
  màu nền splash trong `app.json` có `app-config.spec.ts` canh cho khớp token chế độ
  tối, vì lưới tokens-only không quét file JSON. Cấu hình splash nằm trong plugin
  `expo-splash-screen`, KHÔNG phải khoá `expo.splash` như plan viết: SDK 57 đã bỏ
  khoá đó khỏi schema và `expo-doctor` báo đỏ.
- **`/dev/gallery`**: bảng tra 17 khung dựng bằng dữ liệu cứng, chỉ mở được ở bản
  dev (`isDevBuild()` đẩy bản phát hành về Home).

### Cổng đã đo

- **jest-expo** (cổng nhánh 1, Task 3): mobile tiêu thụ được `@tourism/core` — xanh.
- **Metro** (cổng Task 10): `pnpm turbo run bundle --filter=@tourism/mobile` xanh cho
  cả iOS lẫn Android, không phải thêm `metro.config.js` nào.
- **expo-doctor**: 21/21.
- Runbook `mobile-dev-loop.md` đổi bước build sang `--filter=@tourism/mobile^...`:
  Metro cần `dist` của cả `i18n` và `core`, bản cũ chỉ build `tokens` nên máy sạch
  chết ở `@tourism/i18n`.

### Bẫy ghi lại

- **RNTL 14 bất đồng bộ**: `fireEvent.*`, `unmount()` và `render()` đều trả Promise.
  Bốn cú `fireEvent.press` không `await` trong một test để lại phần việc treo và làm
  MỌI test sau trong cùng file render ra cây RỖNG — lỗi hiện ở test khác chứ không ở
  chỗ gây ra nó. Đã sửa cả 10 chỗ còn thiếu `await` trong spec mobile và mobile-ui.
- **`rerender` của RNTL thay TOÀN BỘ cây** bằng đúng thứ được truyền vào, nên gọi
  thẳng là rụng provider; `renderWithTheme` nay bọc lại nó.
- **Bản giả lập `react-native-screens` trong jest vẫn render nội dung header đã ẩn**,
  nên `headerShown: false` một mình vẫn để lại hai nút cùng nhãn trong cây test.

Tests after: `gate:int` xanh lúc 16/09 (6/6 task, int 496 test ở 37 file), đo lại sau
khi rebase lên `main` thì `gate` vẫn 28/28. Unit 3786
test: web 1477 · api 809 · admin 918 · contract 255 · mobile 147 · mobile-ui 84 ·
core 46 · ui 22 · tokens 18 · i18n 10. So với 15/09 (3627): mobile thêm 118,
mobile-ui thêm 32, i18n thêm 4, core 46 test mới trong đó 41 chuyển nguyên văn từ
web (nên web giảm 41), còn lại là 5 test hàng rào import. `pnpm gate` 28/28 task
xanh · tokens-only ✓ (64 file nguồn mobile) · Biome không lỗi.

**CÒN TREO sau đợt này:** chặn tab khi chưa đăng nhập (cụm tabs) · icon app ·
admin chuyển sang `@tourism/core` (bản chép thứ ba vẫn còn) · thêm dòng COPY trong
`apps/api/Dockerfile` nếu API dùng tới `core` · nối API thật và thay
`createMemoryOnboardingStore` (thành viên khác, theo tài liệu bàn giao).
