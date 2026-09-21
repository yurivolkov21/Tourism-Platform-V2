# CHANGELOG — lưu trữ: đập-xây-lại khu tài khoản và trang thanh toán (08/08–13/08/2026)

Khu tài khoản làm lại hai lần rồi chốt ở thế giới "Hộ chiếu"; trang thanh toán
đổi hướng; mở bề mặt cho khách tải ảnh lên (avatar, ảnh đánh giá); trang chi
tiết tour trùng tu thành 5 tab.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-08-13 — Trùng tu Tour Details: 5 tab, dựng LẠI bám wireframe đã duyệt (branch `feat/tour-detail-redesign`, ff-only, 36 commit `43132e2..5a4c1dc`, 63 file, +6966/−2142)

Động cơ user nói thẳng ở đầu vòng: giao diện cũ "vẫn giống kiểu AI hay làm".
Nên vòng này KHÔNG tự chế bố cục — dựng lại 6 mẫu `product-detail` của ReUI
bằng dữ liệu tour thật rồi đo bằng `getComputedStyle`, user chọn
`product-detail-1`, sau đó ~20 vòng tinh chỉnh trên artifact demo trước khi
viết một dòng code sản phẩm. [Spec](../specs/2026-08-13-tour-detail-redesign.md) ·
[ADR-0022](../adr/0022-tour-detail-tabs.md) ·
[wireframe nguồn](../design/mockups/tour-detail.src.html).

**Nhánh này chứa HAI đợt thi công, và đợt đầu đã bị xoá.** Ghi rõ vì lịch sử
commit đọc ra như làm hai lần cùng một việc. Đợt đầu (14 commit, `43132e2..9c3178c`)
dựng theo một bản spec **ghi sai số đo**: nó đo từ bản ReUI gốc (1104/621/541)
chứ không đo từ wireframe user đã duyệt (1056/573/493), và ghi thêm một dải
khởi hành mà bản duyệt không có. User đối chiếu và kết luận "khác một trời một
vực". Nên `2b8062a` **xoá trọn phần thân** (gallery + panel đặt chỗ + 5 tab +
2 modal), giữ hero và "You might also like" vì hai khối đó đã đo khớp; `8530c48`
viết lại spec bằng số đo **trích bằng máy** từ chính file wireframe và khai tử
plan cũ. 22 commit còn lại dựng lại từng khối một, mỗi khối đo xong mới sang
khối kế.

**Bài học vận hành đã ghi vào [memory](../../CLAUDE.md)**: đợt đầu chạy
subagent-driven (Haiku ở T3, Sonnet ở T4/T5); phần visual không bám wireframe.
User chốt **không dùng subagent nữa** cho loại việc này. Và file wireframe từng
nằm trong `.superpowers/` vốn bị gitignore — nay chép sang `docs/design/mockups/`
để không mất theo lần dọn kế.

**Trang đổi hình dạng**: hero (giữ) → khối gallery 7 thumb + panel đặt chỗ ghim
443px → **5 tab** (Overview · Itinerary · Departures · Reviews · Good to know) →
"You might also like". `OnThisPage` rời trang này (tab bar thay vai mục lục;
component vẫn sống ở `/blog`), và mọi anchor cũ (`#itinerary`, `#departures`…)
vẫn mở đúng tab vì `TourTabs` đọc hash lúc mount **và** nghe `hashchange`. Năm
panel render ĐỦ rồi ẩn bằng CSS — trang là SSG nằm trong sitemap, mount có điều
kiện là giấu lịch trình khỏi crawler.

**Contract nở đúng một chỗ** (`reviews.byTour`): `sort` (newest/oldest/highest/
lowest) · `rating` · `withPhotos` · trả thêm `breakdown` 5 mức sao. `breakdown`
cố ý KHÔNG áp bộ lọc `rating` (áp thì biểu đồ tự triệt tiêu thành một cột)
nhưng CÓ áp `withPhotos` — đó là phạm vi người đọc đang xem.

**Tab Departures là chỗ DUY NHẤT cố ý khác bản duyệt**, và lý do là kết quả thử
người dùng chứ không phải ý thích: bản duyệt vẽ mỗi tháng thành một dải khối
ngang, nhóm của user thử mà không đọc ra khối đó là gì. Đo được nguyên nhân:
mỗi khối đáng lẽ là một đợt nhưng `flex:1` khiến nó giãn kín cột, mà fixture
thật chỉ 1–2 đợt/tháng nên hầu hết dòng ra một thanh đặc kín — trông hệt thanh
tiến độ 100%. Hỏng ở cả hai đầu: 1 đợt ra thanh đầy, 30 đợt ra 30 lát 21px
không đọc nổi. Thay bằng **bảng nhóm theo tháng có hàng xổ**, theo luật "mọi
thứ trên dòng cha phải có chi phí O(1)": dòng tháng chỉ chứa số tổng hợp, thanh
ghế chia đốt (port ReUI `stats-13`, một đốt là một ghế nên luôn đúng
`maxGroupSize` đốt) tụt xuống dòng đợt, danh sách xổ chặn ở 6 dòng rồi nhường
cho modal. Thanh ghế **đảo cực** so với bản gốc: tô đầy là ghế CÒN cho khách —
cực gốc là card quản trị nên đợt chưa ai đặt sẽ ra thanh trắng trơn, đọc như
tour ế. Bản duyệt của phương án thay thế lưu ở
[tour-detail-departures.src.html](../design/mockups/tour-detail-departures.src.html).

**Bốn chỗ trung thực với dữ liệu, khác bản duyệt** — đều là "wireframe nói được,
dữ liệu thì không": bỏ huy hiệu "Verified rider" (`PublicReviewSchema` không
phơi `source` và `listByTour` trả cả review `CURATED`) · ngày review giữ khuôn
"August 2026" của `formatReviewDate` thay vì "2 weeks ago" · thẻ policy bỏ nhãn
nhóm khi nhãn trùng đúng `title` (fixture đặt `title: 'Cancellation'` cho
`kind: CANCELLATION`) · card dữ kiện thiếu dòng mô tả nên cao ~110 thay vì 197.

**Bảy lỗi pixel bắt bằng trình duyệt thật, không bằng test.** Bo góc: wireframe
dùng đúng thang bậc dự án nhưng base `1rem` còn site `0.375rem`, nên phải đè
`--radius` **tại container trang** thay vì hardcode px; và các biến `--radius-*`
tính sẵn ở `:root` nên `calc(var(--radius-md) - 4px)` KHÔNG đọc được base cục bộ
(utility `rounded-md` thì đọc được). Gạch chân tab lệch 5px và ra màu đen vì
`tailwind-merge` **không khử** hai class khác tiền tố biến thể — phải đè bằng
đúng tiền tố đó. Nút nhỏ của repo (`size="sm"`) cao 28 trong khi `.btn-sm` bản
duyệt cao 32 — lệch 4px ở mọi nút của hai tab, gom thành hằng `PANEL_BTN_SM`.
`text-xs` đặt line-height 16 trong khi chữ trong `.pane` thừa hưởng 23 — biểu đồ
review hụt 35px. Cụm sao là `flex` nên chiếm trọn 220px cột trái thay vì
`inline-flex` 68×20. `AccordionTrigger` có sẵn `border border-transparent` cho
vòng focus nên mỗi nút FAQ cao 58 thay vì 56. Và hover hàng bảng đợt hở đuôi vì
`<colgroup>` khai 6 cột mà dòng tháng chỉ có 5 `<td>`.

**Hai lỗi thị giác user bắt, một cái là ảo giác.** Modal review giật mỗi lần
đổi bộ lọc: hai nguyên nhân rời nhau — hộp để `max-h` nên lọc còn 1 kết quả làm
nó tụt từ 760 xuống ~300 rồi bung lại, và danh sách bị thay bằng dòng
"Loading…" nên chữ biến mất rồi hiện lại. Ghim `h-` và giữ kết quả cũ (chỉ làm
mờ) là hết. Còn "thanh 5 sao trông mỏng hơn" thì **đo ra không mỏng hơn**: đọc
pixel cho 18/18 device px ở 3× trên cả năm hàng. Đó là ảo giác irradiation —
cạnh tối trên nền sáng (5.55:1) đọc ra mảnh hơn cạnh sáng (1.85:1). User chốt
giữ nguyên bản duyệt thay vì bẻ số đo để chiều một ảo giác.

**Nghiệm thu (R9) — đo, không nhìn**: bộ so wireframe ⟷ trang thật chạy trên
**38 phần tử của cả 5 tab và 2 modal, ở CẢ HAI chế độ màu** → **0 lệch**; 28/28
phép kiểm hành vi (đồng bộ hash, 5 panel nằm trong HTML tĩnh, 2 modal, xổ tháng,
lọc review, FAQ); **0 lỗi console**; build **74/74** trang tĩnh. Ba quy ước đọc
bảng ghi ở [spec §6](../specs/2026-08-13-tour-detail-redesign.md) — không so chiều
cao khối chứa văn bản, chuẩn hoá `radius ≥ 999px` và `gap normal ↔ 0px`, bỏ hộp
`.shell` vì wireframe chia hai lớp còn app dùng một lớp. Còn **một** khác biệt
có chủ ý: đệm dọc khung trang 56 (`py-14`) so với 80 của wireframe — trên
wireframe phía trên `.shell` là chrome giả của khung demo chứ không phải hero,
nên khoảng cách hero ⟷ gallery là quyết định sản phẩm mà bản demo không phán
được. User chốt giữ 56.

**Dọn xác trang cũ cùng lượt** (user chốt xoá luôn trong nhánh này): 11 file
component + spec (`tour-gallery`, `tour-reviews`, `good-to-know`, `inclusions`,
`itinerary-timeline`, `tour-facts`, `departures-table`) và
`DeparturesTableConnected`. Xoá theo dây: ba hàm thuần chỉ còn chính test của
mình gọi, ba mock type hết consumer, và ~25 khoá i18n chết dưới `tourDetail`.
**`tsc` là lưới an toàn ở đây, không phải grep**: quét thủ công bỏ sót
`reviews.deletedAuthor` vì `destinations/region-reviews.tsx` mượn khối đó qua
alias — typecheck bắt ngay, khoá đó đã giữ lại kèm ghi chú vì sao.

**Review findings:** một Important giữa chừng — brief Task 5 cấm
`DepartureDialog` nhận prop nên `currency` bị đẩy vào context, reviewer chỉ ra
tiền lệ ngược (ba component `…Connected` đều nhận `currency` qua prop); đã sửa
(`3333199`). Tests after: 1698 — 1518 unit (82 contract, 10 tokens, 2 i18n, 22
ui, 215 api, 1187 web) và 180 api int.

**Sổ nợ mở — đọc kỹ:** `MediaAsset` rỗng nên gallery 7 thumb không có gì để
hiện, và **KHÔNG có lệnh nào chạy để lấp chỗ đó**: repo chỉ có `db:seed`, còn
`prisma/seed.ts` không tạo một row `MediaAsset` nào cho tour; script chọn ảnh
của [ADR-0020](../adr/0020-real-images-sourcing.md) đã bị gỡ khỏi nhánh cùng lượt
xoá 189 ảnh bị từ chối, nên muốn có ảnh tour phải LÀM LẠI khâu tuyển ảnh kèm
cửa lọc chủ thể — một đợt việc riêng, không phải một câu lệnh · mô tả cho bốn
card dữ kiện (cần 4 cột nullable trên `Tour`) · tiêu đề riêng cho thẻ policy
(**không cần cột mới** — sửa fixture) · `freeCancellationDays` · thu phóng trong
lightbox. Món `meals`/`accommodation` **rút khỏi sổ nợ**: bản duyệt in bữa ăn và
chỗ ngủ bằng chữ đậm trong chính mô tả ngày, không cần cột riêng.

## 2026-08-12 — Vá CORS thiếu PATCH: avatar upload xong 100% rồi báo lỗi (branch `fix/cors-patch-avatar`, ff-only, 1 commit `ce691bd`)

Nghiệm thu đầu-cuối với key Cloudinary thật — đúng món nợ ghi ở cuối entry
dưới — lộ ngay bug hạ tầng: user chọn ảnh, thanh tiến trình chạy tới 100%
rồi hiện "Upload failed. Please try again.". **Nguyên nhân: `methods` của
`@fastify/cors` trong `configureHttp` liệt kê `GET/HEAD/POST/DELETE`, thiếu
`PATCH`** — mà `account.setAvatar` (`PATCH /api/account/avatar`) là verb
PATCH ĐẦU TIÊN của contract, vừa sinh ra ở cụm ADR-0021 mà không ai cập
nhật allowlist kèm. Trình duyệt chặn NGAY tại preflight nên server không hề
thấy request; ảnh thật ra đã nằm yên trên Cloudinary cả 4 lần user thử, chỉ
bước ghi `User.image` chết. Nút gỡ avatar hỏng cùng lý do (chung route).
Đúng lớp lỗi của `DELETE` hồi Task 7/A2, tái phát vì cùng một lỗ: **int/e2e
test gọi qua `app.inject()` nên KHÔNG enforce CORS**, mọi verb mới đều vô
hình với gate cho tới khi mở trình duyệt thật. Vá một chữ trong allowlist,
kèm case e2e canh preflight PATCH đối xứng case DELETE sẵn có.

**Cách chẩn:** đo từng biên thay vì đoán — ký upload (200) · POST Cloudinary
(200, `public_id` đủ prefix folder) · `setAvatar` gọi từ node (200, DB ghi
đúng) · preflight PATCH (`access-control-allow-methods` không có PATCH →
thủ phạm). Chốt bằng A/B trong Chromium thật từ origin `localhost:3000`:
API chưa vá trả `TypeError: Failed to fetch`, instance đã vá chạy trọn
sign → upload → setAvatar → 200. **Review findings:** không có — diff một
dòng logic. Tests after: 1598 — 1422 unit (82 contract, 10 tokens, 1 i18n,
14 ui, 215 api, 1100 web) và 176 api int. Sổ nợ: 4 asset mồ côi của user
còn trên Cloudinary (4 lần thử thất bại, không có row DB nào trỏ tới) — gộp
vào món "rác Cloudinary ký-rồi-bỏ" đã hẹn cron reconcile ở P4.

## 2026-08-12 — Bề mặt GHI media: avatar + ảnh review lưu thật qua Cloudinary signed upload (branch `feat/media-write-surface`, ff-only, 19 commit `19e5068..7351e6a`)

Trả món nợ static-first của entry dưới, ADR-0021 đi trước code (user duyệt
rồi mới plan 11 task, thi công subagent-driven). **Contract nở 2 namespace
mới**: `media.signUpload` (POST `/api/media/upload-signatures` — ký bộ
`{folder, public_id, timestamp}`, publicId server sinh uuid, folder theo
purpose, đuôi file whitelist bằng `z.enum` nên chết ngay tầng validate) và
`account.setAvatar` (PATCH — procedure oRPC ĐẦU TIÊN của namespace account,
đường ĐÓNG: server kiểm chủ quyền publicId theo segment rồi tự dựng URL ghi
`User.image`, cấm client set URL tự do); `reviews.create` nhận `photos` ≤5
(kiểm prefix folder đúng booking, tạo `MediaAsset` ownerType `REVIEW` trong
CÙNG transaction), `PublicReviewSchema.media` bắt buộc — lan tự nhiên sang
`mine`/admin, 4 đường đọc (kể cả `moderate`) batch `resolveForOwners` chống
N+1. **Quyền REVIEW_PHOTO soi CÙNG `checkReviewEligibility`** với
reviews.create — một nguồn luật, không drift. **Web nối dây, UI giữ
nguyên**: lib `media-upload` (XHR progress, trả public_id đầy đủ; trần
dung lượng dời về contract làm MỘT nguồn client+server), AvatarUpload nối
sign→upload→setAvatar→refresh (hiển thị navbar/hộ chiếu/Settings),
ReviewComposer lift state giữa hai FramePanel (page là RSC), ảnh review đã
duyệt hiện trên trang tour + trang vùng. Env Cloudinary bật trong
`.env.example`; thiếu cặp key API vẫn boot — signUpload trả 503.

**Review findings tiêu biểu:** final review toàn branch bắt 2 Important —
ảnh trùng publicId làm `createMany` ném P2002 bị map nhầm thành 409
REVIEW_ALREADY_EXISTS (dedupe giữ thứ tự), và trần throttle public 5/60s
khít đúng flow 5 ảnh (tách `SIGN_UPLOAD_THROTTLE` 20/60s); task review bắt
promise treo khi Cloudinary trả 2xx không-JSON (`JSON.parse` ném trong
callback executor không reject), drop file thứ hai lúc busy không bị chặn,
`media.int.spec` vỡ DI vì MediaController mới mang ThrottlerGuard, thiếu
test nhánh upload-fail. Sự cố nghiệm thu: `prisma.config.ts` chỉ đọc
`.env` nên `migrate dev` áp docker local, Supabase thiếu enum `REVIEW` →
web build 500; đã `migrate deploy` tường minh và ghi gotcha vào CLAUDE.md.
Tests after: 1597 — 1421 unit (82 contract, 10 tokens, 1 i18n, 14 ui,
214 api, 1100 web) và 176 api int. Sổ nợ: rác Cloudinary (ký rồi bỏ) và
cron reconcile là P4; chữ ký không phủ format/resource_type (enforce đuôi
thật phía Cloudinary) P4; deploy thật phải API-trước-web (`media` là field
bắt buộc); gotcha `pnpm --filter @tourism/api test:int -- <file>` KHÔNG
filter — dùng `pnpm test:int <file>` từ cwd `apps/api`; nhánh `user.image`
ở navbar/hộ chiếu chưa có test; user chưa test đầu-cuối với key Cloudinary
thật (điền `.env.local` rồi thử avatar + ảnh review).

## 2026-08-12 — Vòng quét từng-trang khu Account + booking: accordion, review-ảnh UI, đồng bộ Frame (branch `feat/bookings-inline-detail`, ff-only, 13 commit `850fc05..1be6a6c`)

Nối tiếp bản chốt hộ chiếu: user quét từng trang trên giao diện thật, mỗi góp
ý một commit. **My bookings** thành accordion xổ-inline theo pattern
coupon-manager ReUI user tham khảo (ảnh + prompt block trả phí — dựng lại
bằng đồ nhà, KHÔNG cài code họ): row = icon tile + tên tour + badge trạng
thái chấm màu theo tone `bookingView` + mã mono · đếm ngược · ngày + giá;
xổ ra thẻ chi tiết lưới IATA + action theo trạng thái; JourneyRow nghỉ hưu,
7 test trạng thái port sang (`today` thành prop chuỗi UTC — hết fake timer;
sửa kèm `daysUntilDeparture` nhận `today`, bản cũ chốt giờ máy). **Cụm
review-ảnh UI** (static-first, backend chờ ADR bề mặt ghi media): khối
upload ảnh chuyến đi (dropzone + lưới preview kéo-thả sắp xếp — vendor
`@reui/sortable` kèm @dnd-kit; luật chọn ảnh `validatePhoto` TDD, trần 5
ảnh · 10MB) + form rating thay da InputGroup composite (logic giữ nguyên,
spec sống nguyên) + cả khu bọc `Frame stacked`; textarea kéo giãn được kèm
bộ đếm n/2000 phơi trần contract. **Đồng bộ khung**: giấy tờ v-doc booking
lên Frame dense (dải tone dán sát viền — vá thêm padding panel), thẻ lối vào
nghỉ, Saved tours + Sign out vào cụm nút khung hộ chiếu (SignOutButton
client, cùng logic ADR-0017 §2); Settings thêm khối avatar upload
(static-first, `validateAvatar` TDD trần 2MB) và ô mật khẩu mới dùng chung
`PasswordStrengthField` với register. **Voucher** có hero chuẩn site
(navbar về đồng bộ — `HERO_LESS_EXCEPTIONS` cho riêng `/checkout/success`;
book/cancel giữ hero-less đã duyệt). **Site-wide**: gỡ `mt-32` của
SiteFooter (dải trống lưng chừng user soi F12 — giải phóng 3 chỗ vá quanh
nó); vá scrollspy vendored: bấm nút không cuộn khi bám window (thiếu
targetRef → undefined, kiểm chứng máy scrollY 0→2870); script
`seed-demo-visits.ts` đắp 20 booking PAID quá khứ cho 2 tài khoản demo
(vá kèm contactName null do gate bắt).

**Review findings tiêu biểu:** gate bắt type lỗi seed (`user.name` null);
test port bắt countdown lệch mốc (`daysUntilDeparture` giờ máy vs prop
today); user bắt tại trận: dải tone hở vành khung (dense chưa đủ — panel
còn padding nội bộ), scrollspy bấm không cuộn. Tests after: 1553 — 1395
unit (76 contract, 10 tokens, 1 i18n, 14 ui, 210 api, 1084 web) và 158 api
int. Sổ nợ: avatar + ảnh review đang static-first (preview/mô phỏng, CHƯA
lưu server) chờ cụm ADR bề mặt ghi media — branch kế tiếp user đã đặt hàng;
`stamp-pages`/`pageStamps`/`unstampedNames` + `stepper` vendored vẫn gỡ tạm;
user-menu literal chưa i18n; trang saved + dark mode + mobile user chưa quét.

## 2026-08-11 — Khu Account đập-xây-lại thành "Hộ chiếu" bản chốt (branch `feat/account-passport`, ff-only, 34 commit `b2959c5..bf20383`)

Vòng đập-xây-lại account user đã hứa ở entry dưới: thi công inline 10 task theo
spec `2026-08-11-account-passport-redesign.md`, rồi ~10 vòng góp ý từng-trang
của user trên giao diện thật (mỗi vòng một commit — spec §7 ghi trọn hành
trình). Bản chốt trang `/account`: **khung PassportCard** mở trang (viền kép
laminate, avatar vuông kiểu profile, lưới field Name/Email/Phone/Since/
Passport no./Type·Code, dải MRZ TD3 THẬT 2 dòng × 44 ký tự check digit 7-3-1
trong khung — vector mẫu ICAO 9303 nằm trong test) và nút My bookings và
Settings ở góc phải trên khung; dòng ledger stats mono thay hàng 4 ô; **Travel
log** = nav Scrollspy dựng dọc sticky theo địa danh, mỗi section ảnh cover
kèm timeline dọc các CHUYẾN (check mực = đã đi, node rỗng = sắp tới, card
Collapsible mã booking + link) — vendor 5 component ReUI bản Base UI
(scrollspy/frame/icon-tile/stepper/timeline, vá 12 lỗi Biome nguồn). Route
`/account/bookings` khôi phục từ redirect 308 thành trang danh sách thật;
Settings vào cả menu avatar; khu account về nền thường (gỡ PassportPaper +
layout khu); tokens paper và ink mới; script `seed-demo-visits.ts` đắp lịch
sử 2-3 lần đi cho tài khoản demo.

Các thử nghiệm BỊ user BÁC và đã gỡ sạch (bài học "đừng chia ô xếp hàng"):
caption đánh số (1)-(9) + hàng Zone I mở đầu (đọc như form hành chính), tem
chữ nhật Schengen đồng loạt, lưới 19 ô đều, trang tem rải + bản đồ chấm +
stepper theo nơi (ba đời của khu dưới — bản chốt là timeline).

**Review findings tiêu biểu:** final review (opus) 1 Critical + 9 Important —
hộ chiếu trống ĐÁNH RƠI link Settings (ngõ cụt thật); `text-ink/55` đo 2.62:1
(hạ xuống trang trí thuần); `Promise.all` sập cả trang vì API phụ (safe()
fallback); PARTIALLY_REFUNDED mất tem (chốt luật: đã đi thật); hai luật biên
ngày lệch nhau (thống nhất so CHUỖI UTC); user bắt tại trận: timeline bị
ScrollArea cắt nửa indicator (ms-10 thua ms-8 variant) và cuộn-lồng-cuộn phải
kéo tay (gỡ ScrollArea, một ngữ cảnh cuộn). Tests after: 1545 — 1387 unit
(76 contract, 10 tokens, 1 i18n, 14 ui, 210 api, 1076 web) và 158 api int.
Sổ nợ mới: `WishlistItem` chưa có image; user-menu literal chưa qua i18n;
`stamp-pages`/`pageStamps`/`unstampedNames` + `stepper` vendored đang không có
chỗ dùng (gỡ tạm theo lệnh user — chờ số phận cuối); trang visa/saved user
chưa review; cover Hà Nội trong DB dev đang null (data, không phải code).

## 2026-08-11 — Redesign Checkout hướng B + khu Account hướng A (branch `feat/redesign-checkout-account`, ff-only, 27 commit `330452e..05d4d1c`)

Cụm lớn nhất P3b tới nay: 11 task subagent-driven + final review toàn branch +
6 vòng polish theo mắt user trên giao diện thật. **Checkout được user duyệt**;
khu account thi công đúng spec nhưng **user bác về visual** ("vẫn là trang cũ
chỉnh lại") — sẽ đập-xây-lại ở vòng design riêng (demo vòng 2 với 3 kiến trúc
từ-số-0 đang chờ user chấm), phần logic/contract của cụm này vẫn là nền dùng lại.

Nội dung chính: contract `BookingSchema` thêm `tourSlug` và `tourImage` (join
lúc đọc, phủ 9 call site `toBooking`, kiểu ép compile-error khi quên join, int
test); trang book lưới 2 cột marketplace (step indicator, 3 card, summary sticky
badge outline + dòng trấn an hoàn tiền tính mốc THẬT từ policy bậc thang, không
dark-pattern); form private trip đồng bộ card + DatePicker Calendar/Popover thay
native date; trang success thành TẤM VÉ theo giải phẫu boarding-pass thật
(nghiên cứu IATA BCBP + Apple Wallet + Flighty: lưới nhãn-trên-giá-trị-dưới,
cuống dọc, lỗ đục kim, serial + barcode deterministic từ mã, fine print, băng
trạng thái mép cuống — khai tử cliché dashed+notch); cancel trấn an trung thực
("booking still open", không nói giữ ghế); khu account hướng A (3 tab Trips, hub
gỡ, TripCard status-aware đếm ngược, hủy giáng cấp text-link cạnh policy,
profile nở-inline, delete-account text-link); nút Reserve trang tour NỐI DÂY
vào trang book (nút chết từ thời static-first — user phát hiện); đóng nợ
contrast primary dark bằng viền phân định; book page né navbar fixed.

**Review findings tiêu biểu:** final review (opus) bắt badge "Free cancellation"
là lời hứa sai policy (spec cấm trước, plan kê sai, test khoá hành vi sai —
sửa thành trấn an tính mốc thật); TripCard bỏ qua `booking.status` (PENDING
quá hạn hiện nhầm "Leave a review"); copy "reservation is held" vi phạm
invariant PENDING-không-giữ-ghế; CTA mobile đứng trước form; tổng tiền tính
đôi ở 2 component (hợp nhất `computeBookingTotal`). 11/11 task đều qua review
2 lớp; 5 task cần vòng fix, 4 Approved thẳng.

**Nợ mới ghi sổ:** Trips hero "Leave a review" hiện cả khi đã review (list
không đọc `reviewedAt` — chống N+1 có hồ sơ) · "Where you've been" chứa
CANCELLED chưa-đi (grouping tiền tồn) · pill badge tự chế còn ở tour-hero/
tour-card/booking-rail (ngoài scope, đợt sau đồng bộ theo Badge outline) ·
site-header edge case slug tour tên "book" · CopyCodeButton kế thừa pattern
setTimeout-không-cleanup của ShareRow. Nợ ĐÓNG: contrast primary dark 2.91
(viền thay thế — ADR-0019 xác nhận không thể đạt kép), textarea lý do hủy
(vòng trước đã trả), Reserve chết.

**Tests after:** CI full xanh (gate + 158 int; đo tại nghiệm thu worktree:
1334 unit và 158 int); riêng web 1060 test / 89 file sau vòng polish cuối.

## 2026-08-11 — Khu account: lưới ba toạ độ, hub khối, tách token mực `destructive` (branch `feat/account-sidebar`, 3 commit)

Vòng này có ba lần user bác thiết kế liên tiếp, và bài học lớn nhất là bài học
QUY TRÌNH chứ không phải kỹ thuật: mỗi lần được yêu cầu "làm lại", em giữ bộ
khung cũ rồi vá góp ý mới lên trên. Ba lần như vậy cho ra một khu account chắp
vá, và user chốt lại bằng đúng câu đó. Lần sau nghe "làm lại" thì phải BỎ HẲN
bản cũ và dựng từ đầu, không lượm góp ý ghép vào khung cũ.

**Lệch lề mà user chỉ ra có gốc sâu hơn chỗ nhìn thấy.** Grep ra: 52 chỗ trên
site dùng `lg:px-24 xl:px-32`, và khu account là chỗ DUY NHẤT dùng `px-16` —
do chính commit sidebar (vòng trước, đã bị gỡ) cắt đôi padding để lấy chỗ cho
cột dọc 240px. Footer ngay dưới lại dùng `xl:px-32` + `max-w-7xl`. Tức chọn
sidebar mới là thứ ép khu này phá lề chung với phần còn lại của site; thứ user
nhìn thấy (ray dọc, chấm tròn) chỉ là lớp trên cùng. Kèm một lệch có sẵn từ
trước và không liên quan vòng nào: `max-w-6xl` trong khi footer `max-w-7xl`,
chênh 64px mỗi bên từ 1536px.

**Cả khu nay chỉ có BA toạ độ x** (đo thật trên trình duyệt ở 1440, W=1184):
128 là mép container = H1 = tiêu đề mục = tab đầu tiên; 536 là mép cột phải =
đầu mọi dòng dữ liệu; 1312 là mép phải = mọi giá trị và mọi hành động. Kiểm
bằng script duyệt DOM chứ không bằng mắt: 128 và 536 mỗi cái xuất hiện 8 lần,
toạ độ lẻ chỉ còn ở mép TRÁI của khối căn phải — nơi theo thiết kế chỉ mép phải
bị ghim. Cơ chế giữ được điều đó là `account-section.tsx`: lưới khai báo MỘT
lần cho cả năm màn, không màn nào tự khai lưới riêng. `grid-cols-3 gap-x-10`
không phải số bịa — nó bằng đúng lưới 12 cột span-4/span-8 mà footer và
testimonials đã dùng, vì (T−2g)/3 = 368.

**Hai vòng thiết kế trong cùng branch, vòng sau đè vòng trước.** Vòng đầu theo
hai mẫu shadcn-studio user gửi: tab gạch chân, hairline ngăn mục, không card.
Vòng sau theo hai màn Airbnb user gửi tiếp: `/account` thành hub khối (ba khối
đích có icon + mô tả + một dòng số liệu thật), các trang trong giữ dòng dữ liệu
nhưng cột phải bọc trong card. Mép card rơi ĐÚNG hai neo cũ 536/1312 nên card
không đẻ toạ độ thứ tư; nội dung bên trong thụt đều 25px (viền 1px + `px-6`).

**Một lỗi WCAG thật bị bắt trên đường:** pill trạng thái dùng
`bg-warning/10 text-warning`, mà `warning` trên nền ở chế độ SÁNG đo **1.90:1**
— "Awaiting payment" gần như vô hình đúng lúc nó cần được nhìn thấy nhất. Bỏ
pill, xoá `booking-tone.ts` (hết consumer), thay bằng nhãn mono chữ hoa:
`foreground` (13.78/11.73) cho trạng thái còn việc, `muted-foreground`
(6.24/6.66) cho trạng thái đã yên — kênh phân biệt là ĐỘ ĐẬM, không phải màu.

**`destructive` mắc đúng mâu thuẫn ba vai mà ADR-0019 dựng ra để giải** —
chưa ai soi vì ADR gốc chỉ xét `primary`. Vai bề mặt (badge "−20%" cõng chữ
trắng) đo 4.62 ✅; vai mực (`text-destructive`) đo 3.19 trên nền và 2.83 trên
card, đều dưới 4.5. Nâng L cứu vai mực thì giết vai bề mặt: L 0.70 kéo chữ
trắng trên badge xuống 2.85. Hai khoảng rời hẳn nhau nên lời giải là lời giải
cũ — tách `destructive-emphasis`, light giữ y hệt (vai mực ở sáng đã đạt sẵn
5.62/5.93 nên không đổi một pixel nào), dark 0.72 cho 5.58/4.95. Quét 34 chỗ
`text-destructive`; ba vai khác giữ nguyên và đếm được: 24 `bg-`, 25 `border-`,
30 `ring-`. Ghi vào [ADR-0019](../adr/0019-color-token-roles.md) mục 2b.

**Ba số em từng nói SAI với user, đính chính bằng phép đo lại thẳng từ nguồn
token thay vì hardcode giá trị vào script:** `border` là 1.86/1.64 chứ không
phải 1.35 · `muted-foreground` 6.24/6.66 · và `destructive` dark 3.19. Bài học:
script đo tương phản phải `import` từ `tokens.mjs`, không được chép giá trị.

**Lỗi chỉ ẢNH CHỤP bắt được, test xanh suốt:** ô lưới mặc định giãn cho bằng ô
cao nhất trong hàng, nên card một dòng ("Danger zone") đứng cạnh cột mô tả ba
dòng thì phình ra và chừa một mảng trống dưới nút. `self-start` xử lý.

**Dọn code chết:** `booking-tone.ts` · `account-dashboard.tsx` (166 dòng, hub
thay hẳn) và spec của nó — thay bằng `account-hub.spec.tsx` 10 test.

**Nợ mở:** khu checkout/booking CHƯA đụng tới trong vòng này. User chốt sẽ giao
thiết kế lại toàn bộ khu account cho một session khác dựng lại từ đầu — bản
merge ở đây là nền để đập đi xây lại, không phải bản chốt thẩm mỹ.

Tests after: 1036 web · 210 api · 71 contract · 13 ui · 10 tokens · 1 i18n, và
158 integration. Build + typecheck 12/12 task, lint sạch.

## 2026-08-10 — Redesign khu account: ba nợ A1/A2/A3 đóng cùng lượt (branch `feat/account-redesign`, 9 task)

Khu account "dựng tạm" chỉ tạm ở phần NHÌN — dữ liệu và hành động đã thật từ
cụm A. Vòng này thay lớp trình bày của 5 màn, và trên đường đi đóng luôn hai
khoản nợ đi kèm.

**Nợ A3 (tương phản dark) hoá ra sâu hơn sổ ghi.** [ADR-0019](../adr/0019-color-token-roles.md)
gọi tên thứ chưa ai gọi: `primary` gánh BA vai loại trừ nhau ở chế độ tối. Bề
mặt phải đủ TỐI để cõng nhãn gần-trắng (`L ≤ 0.542`); chữ phải đủ SÁNG để đọc
trên `muted` (`L ≥ 0.74`); vòng focus cũng cần sáng. Hai khoảng đầu rời hẳn
nhau — nên hai lần vá trước đều chỉ là kéo co: `cf8f821` hạ primary cứu nhãn
nút, `121cff6` nâng nền cứu chữ thường, mỗi lần cứu một vai làm vai kia tệ đi.

Sổ nợ còn ghi SAI ngưỡng: 2.91 và 2.57 là cặp BỀ MẶT (WCAG 1.4.11, ngưỡng 3:1),
không phải chữ. Nhóm thật sự chịu 4.5:1 thì sổ không liệt kê, và đó mới là chỗ
tệ nhất — **2.05 trên nền muted**. Sau khi tách token: 7.10 / 6.30 / 5.01. Kèm
bốn token bị `cf8f821` bỏ quên (`ring` phải NÂNG lên chứ không hạ theo primary
— bằng chứng thứ hai cho lý lẽ của ADR) và viền ô nhập từ 1.24 lên 3.13.

**Nợ A2 không phải nợ thẩm mỹ.** Chuỗi hardcode `'Requested via account portal.'`
được worker render vào email gửi NGƯỢC cho chính khách ("Your reason: …"), tức
mọi người xin huỷ đều nhận một câu nói rằng lý do của họ là như vậy. Nay có ô
nhập bắt buộc, chỉ ở nhánh PAID; `cancelPending` không đụng tới vì đó là luồng
khác bản chất (input chỉ `{code}`, không qua admin, không đụng ghế).

**Cụm B đóng trọn.** Contract nở `reviewedAt` (additive) — không có nó thì cách
duy nhất biết booking đã đánh giá hay chưa là POST rồi bắt 409, tức khách gõ
xong cả bài mới được báo là không viết được. `reviewSlot()` soi gương luật API
kể cả THỨ TỰ ưu tiên; web nói khác API thì khách gõ hết bài rồi mới bị từ chối.

**Năm màn, tóm tắt:** dashboard đảo trục (chuyến kế tiếp lên đầu, hai ô số thay
bốn, Recent bookings dạng sheet — phép chọn MỚI có cả CANCELLED, sắp theo lúc
ĐẶT chứ không theo ngày đi) · `/bookings` gom ba nhóm thời gian với hai luật
không thuần-ngày (CANCELLED luôn "đã qua"; chỉ PAID mới "đang đi", vì PENDING
không giữ chỗ) · trang chi tiết thêm ô lý do và form review · hồ sơ thành danh
sách tóm tắt đọc-trước, mỗi lúc một dòng mở · `/saved` có card riêng.

**Ba thứ chỉ ẢNH CHỤP bắt được, test đều xanh lúc đó:**

1. **"Trips booked 0"** đứng ngay trên ba dòng booking PENDING — đọc thành mâu
   thuẫn. Bản bốn ô cũ giấu được vì có "Upcoming 3" làm dịu. Đổi nhãn thành
   "Trips paid": sửa CÂU CHỮ cho trung thực với con số, không đổi phép đếm.
2. **Nhãn trường hiện hai lần, hai nút Cancel** ở trang hồ sơ — form nở ra xếp
   chồng dưới dòng thay vì thay thế giá trị.
3. **Navbar tàng hình ở chế độ SÁNG trên 8 trang không có hero** (`/account/*`,
   `/checkout/*`). Navbar lúc chưa cuộn dùng `on-media` vì giả định đang nằm
   trên hero tối; 8 trang này bù khoảng bằng `pt-36` mà không có hero thật. Ở
   chế độ tối tình cờ vẫn đọc được nên lỗi sống sót lâu. Lỗi CÓ SẴN, không do
   redesign — vá ở `b7ccf83`.

**Hai lỗi có sẵn khác được vá nhân tiện:** lỗi của hành động trong dialog render
PHÍA SAU lớp modal (`getByText` thấy nên test cũ xanh, `getByRole` thì không —
người dùng bàn phím không với tới link đăng nhập lại); và `SavedGrid` là
component duy nhất trong khu account thiếu nhánh 401, khiến khách hết phiên bị
báo là thao tác hỏng.

**Dọn code chết:** prop `deniedNote` (contract khách cố ý không mang
`decisionNote` nên nó LUÔN null) · `ProfileForm` · `wishlist-vm` — hàm này bịa
`category`/`maxGroupSize`/`isFeatured` để nhét WishlistItem vào TourCardVM;
`TourCard` tình cờ không render ba field đó nên chưa ai thấy, nhưng ngày nào nó
bắt đầu hiện category thì mọi tour đã lưu mọc ra một chip rỗng.

**Một lỗi quy trình của em, ghi để không lặp:** một lệnh thay chuỗi hàng loạt
trượt IM LẶNG vì Biome đã xuống dòng chuỗi đích từ trước, và `replace` không
báo gì — chỉ lộ khi test đỏ theo kiểu khó hiểu. Từ đó mọi lệnh sửa hàng loạt
đều `assert` trước khi ghi.

**Nghiệm thu sống:** 5 màn × 2 chế độ không màn nào ra lỗi · xin huỷ một booking
PAID thật, `cancellation_requests.reason` đúng chữ khách gõ và outbox có email
mang đúng lý do · viết một đánh giá 5 sao thật, DB có review đúng nội dung với
`is_approved=false` và `title` bỏ hẳn khi để trống · đo lại 20 cặp tương phản,
toàn bộ đạt ngưỡng ADR-0019.

**Nợ mở:** `/account/saved` và mọi bề mặt ảnh vẫn là ô giữ chỗ — chờ hướng chọn
ảnh mới (xem [ADR-0020](../adr/0020-real-images-sourcing.md) đã AMEND).

**Tests after:** `gate:int` trọn 1.504 test (web 1.041 · api 210 unit và 158 int
· contract 71 · ui 13 · tokens 10 · i18n 1). 18/18 task `gate` và 5/5 `test:int`.

## 2026-08-10 — Cụm B nửa 1: nút tim wishlist trên `/tours` (branch `feat/wishlist-heart`, ff-only, 1 commit `3e83df8`)

Card danh sách tour đang ship một nút tim **bấm được nhưng hoàn toàn trơ**:
không `onClick`, file còn không phải client component, trong khi `aria-label`
vẫn nói "Save … to wishlist". Trình đọc màn hình quảng cáo một chức năng không
tồn tại, trên trang catalogue chính — đúng điều repo tự cấm ở `tour-card.tsx`:
"một cái tim không làm gì là hứa thứ sản phẩm không giữ". Ba nhánh rà độc lập
đều nêu chỗ này; nó là lỗi đang sống chứ không phải việc tương lai.

Ba tầng dưới đã sẵn từ P3a nên cụm này thuần web: contract có
`wishlist.set/list/check`, API có module đầy đủ, và đường GHI đã chạy thật ở
`/account/saved` từ cụm A.

**Hỏi trạng thái ở CLIENT sau hydrate, không ở server component.** `/tours` là
trang công khai ISR 300s dùng chung cho mọi khách; nhét trạng thái
theo-từng-người vào đó vừa hỏng cache vừa **rò rỉ wishlist người này sang người
khác**. HTML tĩnh luôn ra tim rỗng, client tô lại sau khi biết mình là ai.

**Context cho cả trang thay vì state trong từng nút.** `wishlist.check` là
endpoint BATCH (trần 100 id) được thiết kế đúng cho việc này; mỗi nút tự hỏi là
quay lại N+1 mà contract đã cố tránh. Chỉ hỏi cho tour đang hiện trên trang
hiện tại, không phải cả bộ.

**Khách chưa đăng nhập** bấm tim thì sang trang login, GIỮ nguyên query đang lọc
— đăng nhập xong bị ném về `/tours` trống là mất công họ vừa chọn. Chặn open
redirect ngay tại hàm dựng href (lớp thứ hai là `safeRedirect` của trang login).

**Nút tự ẩn khi không có provider bao ngoài.** Card dùng chung ở trang miền, tour
liên quan và khu account; chỗ nào không có nguồn trạng thái thì không vẽ tim,
thay vì lặp lại đúng lỗi vừa sửa.

Lỗi `check` **nuốt im lặng có chủ đích**: không tô được tim là mất trang trí chứ
không mất chức năng, bấm vẫn lưu được — toast ở đó là quấy khách vì thứ họ không
yêu cầu. Lỗi `set` thì rollback đúng khuôn `SavedGrid` và có báo.

Nhãn nút chuyển từ hardcode trong component sang `@tourism/i18n` (luật #7), một
nhãn DUY NHẤT cho cả hai trạng thái — bật/tắt đi qua `aria-pressed`, đổi nhãn
qua lại làm người dùng tưởng là hai nút khác nhau.

**Bốn thứ phát sinh:**

1. **Thêm provider làm đỏ 38 test** của `tours-explorer.spec.tsx` — spec đó
   KHÔNG mock gì cả, nên `useRouter()` ném "invariant expected app router".
   Đúng loại giòn mà đợt rà khu account đã cảnh báo; đã thêm mock tối thiểu.
2. **Thử phá code để kiểm test có cắn không**: bỏ rollback → đúng 1 test đỏ; bỏ
   guard provider → đúng 1 test đỏ; khôi phục → xanh lại.
3. **Biome bắt một lỗi thật**, không chỉ format: optional chaining rồi truy cập
   thẳng thuộc tính, `undefined` sẽ ném TypeError thay vì fail assertion tử tế.
4. **Better Auth chặn `MISSING_OR_NULL_ORIGIN`** khi script nghiệm thu gọi API
   thiếu header `Origin` — không phải lỗi, đó là bảo vệ CSRF làm đúng việc.

TDD đúng nghĩa cho phần logic thuần (`lib/wishlist.ts`: viết test, thấy đỏ, rồi
implement); phần component thì viết code trước rồi mới viết test, bù lại bằng
vòng phá-code ở trên.

**Nghiệm thu sống** trên trình duyệt thật, đi trọn vòng: chưa đăng nhập bấm tim
→ `/login?redirect=/tours?destinations=hue` giữ nguyên bộ lọc; đăng nhập rồi bấm
→ đổi màu ngay; tải lại trang → vẫn đặc, tức đã lưu ở server; `/account/saved`
thấy tour; bấm lại → bỏ lưu.

**Nợ mở:** `TourCard` (card lưới ở trang miền, tour liên quan) vẫn chưa có tim —
quyết định riêng, không gộp vào đây. Nửa 2 của cụm B (form review) đi cùng vòng
redesign khu account vì nó nằm trên đúng trang sẽ được vẽ lại.

**Tests after:** `gate:int` trọn 1.440 test (web 963 → 981: thêm 8 ca logic thuần
và 10 ca jsdom cho nút tim). 18/18 task `gate` và 5/5 task `test:int`.

## 2026-08-08 — Đường ảnh cho catalog: contract nở, cột ghi công, và một lô ảnh bị loại (branch `feat/real-images`, ff-only, 3 commit `ecc88f3..a68a4a9`)

Entry này ghi cả thứ đã ship lẫn thứ **đã làm rồi vứt** — vứt là phần tốn công
nhất, và lý do vứt mới là thứ đáng nhớ.

**Đã ship và giữ lại.** Tour và Destination trước nay KHÔNG có đường nào ra ảnh:
không field ở `schema.prisma`, không field ở contract `catalog.ts`, nên web chỉ
vẽ được ô giữ chỗ và trang chi tiết tour phải truyền `media={[]}` cứng cho khảm
gallery. `docs/README.md` xếp đây là "nợ contract #1"; nay đã trả:
`TourCard`/`Destination` nhận `cover`, `TourDetail` nhận mảng `media`. Kèm
migration `20260808140917_media_attribution` thêm bốn cột ghi công
(`author`/`license`/`licenseUrl`/`sourceUrl`) vào `media_assets` — thuần
`ADD COLUMN`, nullable, đã áp cho cả DB local lẫn Supabase.

Chọn **khoá bắt buộc với giá trị nullable** thay vì `optional`: web phải phân
biệt được "chưa có ảnh" với "trường không tồn tại", và cách này ép mọi nơi sinh
dữ liệu khai tường minh. Cái giá là 34 chỗ fixture phải thêm một dòng.

`toTourCard` nhận `cover` làm THAM SỐ chứ không tự query: hàm chạy trong vòng
lặp `map()` trên cả trang nên gọi DB bên trong là đẻ N+1. Chỗ gọi resolve một
lần cho cả lô, cùng khuôn `posts.service` từ P3a. Nhân tiện nối luôn cover cho
`relatedTours` dưới bài blog.

[ADR-0020](../adr/0020-real-images-sourcing.md) chốt nguồn ảnh: Wikimedia Commons
chính, Pixabay lấp chỗ, **loại đường API Unsplash** vì API Terms bắt hotlink,
mâu thuẫn thẳng với kiến trúc rehost lên Cloudinary (lưu ý Unsplash *License*
cho ảnh tải từ website thì vẫn hợp lệ). ShareAlike giải bằng kỹ thuật: transform
CHỈ `f_auto,q_auto,w_`, cấm `c_fill`/`c_crop`, vì cắt cúp tạo tác phẩm phái sinh
còn đổi định dạng và thu nhỏ theo tỉ lệ thì không.

**Đã làm rồi vứt: lô 189 ảnh.** Script seed ba pha đã chạy trọn — 189 ảnh lên
Cloudinary, 19/19 địa danh có bìa, 30/30 tour có bộ ảnh, 256 `media_asset`,
không row nào thiếu ghi công. User duyệt và **từ chối toàn bộ**: lẫn ảnh bãi rác
thật, ảnh công trình, ảnh sinh hoạt đường phố.

Gốc rễ nằm ở mục 1 của ADR-0020, nay đã đính chính tại chỗ: `geosearch` kiểm
chứng **VỊ TRÍ** chứ không kiểm chứng **CHỦ THỂ trong khung hình**. Một tấm chụp
bãi rác ngay tại Hạ Long thì đúng toạ độ, đúng giấy phép, đủ độ phân giải, tên
file không chứa từ khoá rác nào — nó qua sạch mọi bộ lọc đã dựng. "Chụp đúng
chỗ" và "ảnh du lịch tốt" là hai bài toán khác nhau; ADR gốc chỉ giải bài thứ
nhất rồi coi như đã giải cả hai. Sai quy trình đi kèm: bảng duyệt được dựng SAU
khi upload, đúng ra phải là cửa chặn TRƯỚC.

Toàn bộ 189 ảnh đã xoá khỏi Cloudinary và 256 row khỏi Supabase (kiểm từng cái:
`main-sample` có từ 12/07 và `site_media_slots` 9 row còn nguyên; 30 tour, 19
địa danh, 137 đợt khởi hành, 84 review, 9 bài, 2 booking, 3 user không bị đụng).
Commit chứa script chọn ảnh đã bị bỏ khỏi nhánh — giữ nó lại chỉ tạo ảo giác đã
có sẵn thứ dùng được, và manifest trong đó có cơ chế tự-dùng-lại nên lần chạy
sau sẽ lặng lẽ nạp lại đúng lô ảnh vừa bị loại.

**Bốn lỗi kỹ thuật gặp trong lúc làm**, ghi lại vì ba trong số đó dễ tái phạm:

1. **Manifest ghi vào `dist-seed/`** — script chạy từ thư mục biên dịch nên
   `import.meta.url` trỏ vào build artifact, vốn gitignored và bị xoá mỗi lần
   compile.
2. **Commons trả HTTP 200 KÈM lỗi trong thân JSON** (ratelimit/maxlag). Code chỉ
   đọc `query.geosearch`, thấy `undefined` thì coi như "không có ảnh" — TP.HCM
   về 0 trong khi thực tế có 87 tấm đạt chuẩn. **Hỏng im lặng**, không kêu một
   tiếng; ba lỗi kia đều kêu. Đây là loại nguy hiểm nhất.
3. **Tải qua `Special:Redirect`** tức đi qua app server MediaWiki, nơi siết ngặt
   nhất: 8/189 tấm qua. Lấy `thumburl` từ API rồi tải thẳng CDN
   `upload.wikimedia.org` thì gần như trọn bộ.
4. **Ô Artist của Commons là văn bản tự do** — một trường dài 601 ký tự làm vỡ
   INSERT. Không nới cột, vì chỗ hiển thị ghi công cần TÊN người chứ không phải
   đoạn văn.

Kèm một lỗi idempotency: upsert chỉ THÊM và SỬA, không BỚT, nên lần chạy dở để
lại 22 ảnh bìa cho 19 địa danh. Idempotent đúng nghĩa là **hội tụ** về trạng
thái mong muốn.

**Nợ mở:** không có ảnh nào trên site; mọi việc giao diện phụ thuộc ảnh (nối
cover blog, tile địa danh, khảm gallery, dựng lại lớp phủ và đo lại tương phản)
tạm dừng cho tới khi có hướng chọn ảnh mới. Ứng viên đáng tìm hiểu kỹ: hệ thống
thẩm định của người thật trên Commons (`Quality images`, `Featured pictures`,
`Valued images`), đọc được bằng máy qua `prop=categories`.

**Tests after:** `gate:int` trọn 1.422 test (contract 57 → 67 nhờ 10 ca mới cho
`cover`/`media` và ghi công; api 210 unit và 158 int; web 963; ui 13; tokens 10;
i18n 1). 18/18 task `gate` và 5/5 task `test:int`, chạy không cache.
