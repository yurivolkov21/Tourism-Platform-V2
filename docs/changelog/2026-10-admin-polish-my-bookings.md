# CHANGELOG — lưu trữ: sửa sạn admin, My bookings, vá giao diện điện thoại (05/10–08/10/2026)

Đợt sửa sạn giao diện admin (ô chọn chung, Quick Create, xoá danh mục và điểm
đến), P7 phần A My bookings, vá 24 cảnh báo Dependabot, và các bản vá trang
tour trên màn hẹp.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 14/10/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`, và
link tới tài liệu dời thư mục cùng ngày 14/10 trỏ sang chỗ mới. Đừng
mở-rồi-save bằng editor có markdownlint: nó đổi `+` đầu dòng thành `-` và nói
sai con số test đã ghi.

## 2026-09-23 — T0 mobile browse: tầng dữ liệu + primitive dùng chung, vá 6 phát hiện review cuối cụm (nhánh `feat/mobile-browse-screens`)

Entry này khép cụm T0 của P5b-2 (xem tour trên mobile) — tầng dữ liệu oRPC
`OpenAPILink` và TanStack Query cho `apps/mobile`, cộng sáu primitive dùng
chung mới ở `@tourism/mobile-ui` (`SearchField`, `Chip`, `BottomSheet`,
`AppImage`, khả năng "load lỗi" gộp vào `EmptyState`, tab bar có icon). Quyết
định kiến trúc ở [ADR-0055](../adr/0055-mobile-data-layer.md), kế hoạch thi công
ở [plan T0](../plans/2026-09-23-mobile-browse-t0-data-layer.md). **T1–T7 (các
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
4. ADR-0055 lệch code thật ba chỗ (tên component `LoadErrorState` chưa từng
   tồn tại riêng, cơ chế `transformUrl` của `AppImage`, số dependency thêm
   vào `apps/mobile`). Vá bằng AMEND 1 trong chính ADR, không sửa quyết định
   gốc.
5. `AppImage.transformUrl` (mặc định identity, đúng ý ADR-0040 §2) chưa có
   nơi ghép thật với `cloudinaryUrl()` ở tầng app. Thêm module ghép ở
   `apps/mobile/src/components/app-image.tsx`, kèm một test xác nhận
   `source.uri` có đúng segment transform Cloudinary.
6. Sweep docs sau merge còn thiếu (luật 13): entry này, dòng ADR-0055 vào
   bảng ADR ở `docs/README.md`, và thêm plan T0 vào mục Plans cùng file.

**Review findings:** 6/6 đã vá trong lượt này — chi tiết ở trên, không phát
hiện nào bị bỏ lại.

Tests after (mobile-ui): Jest 18 suite, 107 test — bốn ca `Chip` giữ nguyên
sau khi đổi vỏ biến thể `removable`. Tests after (mobile): Jest 34 suite, 173
test — thêm một ca mới cho module ghép `AppImage`/`cloudinaryUrl()`.
`tsc --noEmit` xanh ở cả hai package, `check-mobile-tokens-only.mjs` xanh (75
file nguồn, không màu viết tay nào).

## 2026-10-08 — My bookings thôi in dòng đếm trùng hero (`87ca93f9`, nhánh `fix/bookings-list-count`)

**Góp ý của user** (08/10, ảnh `/account/bookings` trên production): dòng "2 trips" ngay dưới hàng lọc
nhắc lại đúng số "2 TRIPS" mà hero đã in.

`BookingsListView`: chưa lọc thì dòng đếm thành `sr-only`. Trình đọc màn hình vẫn nghe số đơn, vùng
`aria-live` và đích tiêu điểm khi sang trang của `TripPager` giữ nguyên. Đang lọc hay tìm thì vẫn hiện
"{n} of {tổng} trips", vì hero chỉ in tổng. Khi dòng đếm ẩn, danh sách cách hàng lọc `mt-4` (trước đó là
12px, một dòng chữ rồi 10px). Thay đổi nhỏ theo yêu cầu thẳng của user, không chạy vòng review max.

**CÒN TREO:** không. Không migration, không env, không webhook.

Tests after (`gate:int` trên `87ca93f9`, 08/10 18:33–18:38): unit 5737 — admin 1911, web 1707, api 1085,
contract 665, mobile 159, mobile-ui 86, core 46, ui 36, i18n 23, tokens 19 — và int 775/46. Không ca
mới: `bookings-list-view.spec.tsx` sửa hai ca (chưa lọc thì dòng đếm mang `sr-only` mà vẫn có "12
trips"; đang lọc thì "2 of 18 trips" không mang `sr-only`), đã thấy đỏ trước khi sửa component.

## 2026-10-08 — Thử tay lề trang chi tiết tour trên điện thoại thật (`aa3f2a5a`)

**Thử tay production** sau merge `aa3f2a5a` (CI `gate` xanh, Vercel web và admin success; HTML trang
tour trên production mang lớp `px-4 md:px-8 lg:px-12`). User làm trên iPhone 16 Pro Max (dọc 440px,
nội dung 408px), từng bước một, ở `/tours/vietnam-grand-journey-12d`: bước 1–5 đạt.

- Trang không trôi ngang. Khối ảnh, tên tour, giá và các ô ngày thẳng mép chữ của hero, lề hai bên
  khoảng 16px.
- Panel đặt chỗ: ngày và "N seats left" gọn trong ô, hai nút trải hết bề ngang, hàng ô chính sách
  không chạm viền.
- Tab Departures: dòng phụ của tháng, cặp ngày đi và về, dòng hạn huỷ mỗi thứ nằm trên một dòng; thanh
  ghế và nút Select nằm trong thẻ.
- Itinerary, Reviews và Good to know (mở FAQ): không chữ hay khung nào chạm hoặc lòi khỏi mép.
- "You might also like" thẳng mép các khối phía trên, thanh đặt chỗ dính đáy không che card cuối. Xoay
  ngang (khổ `md`): lề nới ra khoảng 32px, 5 tab chia đều, Departures vẫn ở dạng thẻ; xoay dọc lại vẫn
  đúng.

## 2026-10-08 — Lề trang chi tiết tour dưới lg theo khuôn book và enquire (`e11c5e54`, nhánh `fix/web-tour-detail-gutter`)

**Lỗi** (G26, đo 08/10 trên bản build local, `/tours/vietnam-grand-journey-12d`): khung thân trang và
khu "You might also like" đệm `px-12` ở mọi khổ, nên ở 375px nội dung chỉ còn 279px. Thẻ đợt khởi hành
còn 189px cho khối ngày cạnh giá: dòng phụ của tháng, ngày đi và hạn huỷ đều phải xuống dòng.

User duyệt thiết kế 08/10. `page.tsx` đổi `px-12` thành `px-4 md:px-8 lg:px-12` ở hai chỗ, đúng khuôn
của trang book và enquire cùng route. Không canh theo chữ của hero (`md:px-16`): ngay ở desktop đã
duyệt, hai khối vốn không thẳng hàng (ở 1280 hero bắt đầu ở x=128, thân trang ở x=112). Từ `lg` trở
lên không lớp nào đổi.

Thiết kế được duyệt gồm cả dải 5 tab, nhưng trong lúc đo thì nhánh `fix/tour-tabs-mobile-scroll` đã
sửa xong phần đó theo cùng hướng (G27, `854b3767`..`c88f0469`), nên nhánh này bỏ phần tab. JSDoc và chú thích
test của `tour-tabs` ghi lại khung ở 375 sau G26: 343px, dải 429px vẫn thiếu 86px nên vẫn cuộn.

**Đo trên bản build** (`next start` cổng 3210, API dev cổng 3201; ba tour `vietnam-grand-journey-12d`,
`bana-hills-golden-bridge-day`, `northern-highlights-5d`). Đo bằng JS, mở lần lượt 5 tab, xổ hết tháng
và accordion. Browser pane ẩn nên cuộn mượt không chạy; lượt kiểm dải tab tắt cuộn mượt khi đo.

- 320 và 375px: trang rộng đúng viewport, nội dung 288 và 343px; hero, thân trang, related và thanh
  đáy cùng mép 16px. Không phần tử nào lọt khỏi khung khối của nó ở cả 5 tab.
- 375px, thẻ đợt khởi hành: khung 279 lên 343px, khối ngày 189 lên 253px; dòng phụ tháng, ngày đi và
  hạn huỷ từ hai dòng về một. Ở 320px còn hai dòng xuống dòng, ngắt nguyên cụm như nhánh thẻ đã định.
- 768px (viewport giả lập trừ thanh cuộn 4px): nội dung 668 lên 700px, 5 tab vừa khung, mỗi tab 120,8px.
- 1024 và 1280px: như trước khi sửa. Nội dung 924 và 1056px, hai cột 573 và 443px, ảnh chính 493px,
  tab 165,6 và 192px, cột ngày của bảng 245,4px, card related 292 và 336px.
- Dải tab ở 375px: cuộn tối đa 86px; vào `#good-to-know` thì cuộn hết, `#itinerary` lùi về 53px.

**Review findings:** không mở vòng review riêng. Thay đổi chỉ là lớp CSS nên không có test mới; bằng
chứng là lượt đo trên. Lúc đo lộ thêm một việc ngoài phạm vi, ghi `open-items` G29: cột 7 ảnh nhỏ cao
496px, ảnh chính hẹp hơn thì cạnh nó có khoảng trống (233px ở 375). G28 tính lại theo khung mới:
thanh ghế 254px ở 320 và 309px ở 375, mốc tràn thành 32 và 39 chỗ. Đã soát và bỏ một nghi vấn: ba ô
chính sách trỏ `#good-to-know` không cuộn trang, nhưng dải tab nằm ngay dưới hàng ô (cách 48px) nên
khách vẫn thấy tab đổi.

**CÒN TREO:** G28 và G29 ở `open-items`. Không migration, không env, không webhook.

Tests after (`gate:int` trên `1e57be98`, bản trước khi rebase, 08/10 14:02–14:08, int trên DB riêng
`tourism_test_gutter`): unit 5732 — admin 1911, web 1703, api 1084, contract 665, mobile 159,
mobile-ui 86, core 46, ui 36, i18n 23, tokens 19 — và int 774/774. Không ca mới, số khớp entry G27.
Rebase lên `5731fbf8` mang thêm bản vá Dependabot và bản vá wizard đặt tour (đã qua gate ở nhánh của
chúng); sau rebase cài lại dependency, typecheck và test của web xanh (web 1707, thêm 4 ca của bản vá
wizard), CI chạy cả gate trên `main`.

## 2026-10-08 — Thử tay dải 5 tab trang tour trên điện thoại thật (`48c71074`)

**Thử tay production** sau merge `48c71074` (Vercel web success; run CI riêng của commit này bị huỷ vì
`cancel-in-progress` khi bản vá Dependabot đẩy lên ngay sau, còn `gate` trên `e4462cf4` chứa nó thì
xanh). User làm trên điện thoại thật, từng bước một: bước 1–5 đạt.

- Trang không trôi ngang. Dải bắt đầu bằng Overview sát lề trái, mép phải mờ, đường kẻ đáy chạy nét
  tới hết lề.
- Vuốt dải: chỉ dải trượt, thân trang đứng yên; giữa dải mờ cả hai mép, tới cuối thì Good to know
  hiện trọn và mép phải hết mờ.
- Chạm Reviews đang bị che một nửa: dải trượt cho Reviews hiện trọn, nội dung đổi, URL thêm `#reviews`.
- Mở thẳng `…#good-to-know` trong tab mới: dải đã cuộn tới cuối, Good to know hiện trọn sát lề phải.
- Xoay ngang (từ 640px trở lên): 5 tab chia đều, không mờ mép; xoay dọc lại vẫn giữ Good to know
  hiện trọn.

Trước lượt tay, đo production bằng Edge headless (chỉ đọc trang): khớp số của bản build local ở 320,
360, 375 và 1280px, kể cả khi mở tab Departures.

## 2026-10-08 — Merge bản vá tiền theo cả đơn ở wizard đặt tour lên main (`710653c6`)

Nội dung đã kể ở entry ngay bên dưới (07/10). Entry này chỉ ghi sự kiện merge.

Từ 07/10 bản vá chỉ nằm trên nhánh cục bộ `claude/priceless-heisenberg-d71023` (entry dưới gọi là
`fix/booking-wizard-money`), chưa push; 08/10 user duyệt merge. Session gốc review trước khi merge,
không có phát hiện: `formatBookingMoney` và `bookingPriceLines` trên nền mới y nguyên lúc thi công;
mọi số tiền của wizard (đơn giá ở bước Dates và Review, các dòng, Total, nút Pay) nay đi qua hai hàm
ấy; Total vẫn từ `computeBookingTotal` nên đơn giá có xu in đúng số API tính để thu; giá gạch giữ
`formatMoney`.

Nhánh rebase lên `e4462cf4`, chậm 112 commit. Một xung đột ở CHANGELOG: entry nhánh và các entry
mới của `main` cùng chen vào đầu file; gỡ bằng cách đặt entry nhánh lên trên, cả hai giữ nguyên văn
(nếp merge F18). Commit code áp sạch: từ nền cũ tới `main` không commit nào đụng `lib/checkout.ts`
hay `components/booking`. `gate:int` chạy lại trên đỉnh đã rebase (`ccef2eac`, DB riêng
`tourism_test_wizardmerge`, API cho build web ở cổng 3401): xanh, 13:57–14:02.

Vẫn ngoài phạm vi như entry dưới ghi: trang chi tiết tour làm tròn giá từng đợt (`booking-rail.tsx`,
`departure-dialog.tsx`, `departures-panel.tsx`), nên cùng một đợt hiện "$1,569" ở trang tour mà
"$1,568.70" trong wizard; chờ user quyết. Thử tay trên production cần đăng nhập nên để user làm (ca
gợi ý: `hanoi-heritage-day` ngày 17/12, đơn giá $39.69, 2 người lớn và 2 trẻ em ra $158.76).

Không migration, không env, không webhook; push chỉ đụng `apps/web` và `docs`.

Tests after: unit 5737 — web 1707, admin 1911, api 1085, contract 665, mobile 159, mobile-ui 86,
core 46, ui 36, i18n 23, tokens 19 — và int 775/775.

## 2026-10-07 — Wizard đặt tour in tiền theo cả đơn (`1eb3d81d`, nhánh `fix/booking-wizard-money`)

Việc tách ra từ P7 Phần A (entry ngay dưới, dòng "Ngoài phạm vi"): đơn giá khuyến mãi có xu của
seed (giảm 10–20% trên giá chẵn, vd 52 × 0.87 = 45.24) bị `formatMoney` làm tròn riêng từng chỗ
trong wizard `/tours/[slug]/book`. Với 2 người lớn và 2 trẻ em, cột tóm tắt in "$90" cho mỗi
dòng mà Total "$181", nút "Pay $181" trong khi Stripe thu $180.96, giá mỗi khách ở bước Dates
và Review in "$45".

Sửa: wizard dùng lại `formatBookingMoney` và `bookingPriceLines` của Phần A cho đơn đang dựng
`{ unitPrice: effectivePrice, currency }`, không đặt luật làm tròn mới. Cột tóm tắt dựng dòng
tiền bằng `bookingPriceLines` (cùng hàm của biên nhận và các trang đơn), Total, nút Pay và giá
mỗi khách ở bước Dates, Review đi qua `formatBookingMoney`. Đơn giá chẵn vẫn in không số lẻ;
đơn giá có xu thì đơn giá, các dòng và tổng đủ hai số lẻ. Giá gạch giữ `formatMoney`. JSDoc ở
`lib/checkout.ts` thôi nhắc `booking-form.tsx` (gỡ từ 19/08).

Ngoài phạm vi, chờ user quyết: trang chi tiết tour vẫn làm tròn giá của từng đợt
(`booking-rail.tsx`, `departure-dialog.tsx`, `departures-panel.tsx`), nên cùng một đợt hiện
"$45" ở trang tour mà "$45.24" trong wizard; dòng "Save" in "$7" cho 6.76.

**Review findings:** session thi công không mở vòng review riêng; 4 test viết trước, đỏ đúng
chỗ (không thấy `$90.48`, `$180.96`, `$45.24`, nút "Pay $180.96") rồi mới sửa. Session gốc
review lại sau merge.

Tests after (`gate:int` cô lập: DB `tourism_test_wizard`, API cho build web ở cổng 3111):
Vitest **5470** (web 1674, api 1068, admin 1718, contract 656, core 46, ui 27, tokens 18,
i18n 18, mobile 159, mobile-ui 86), int **753 ở 46 file**. Ca mới: web 4.

CÒN TREO cho session gốc: review rồi push. Không có việc hạ tầng (không migration, không env,
không webhook).

## 2026-10-08 — Vá 24 alert Dependabot, kèm các lỗ production chỉ thấy ở repo gốc (`3a616f46`, nhánh `fix/dependabot-2026-10-08`)

Ngày 08/10 GitHub báo 24 alert mở trên `main` (5 critical, 16 high, 3 medium), tức 16 GHSA: lỗ ở
gói trực tiếp bị đếm riêng cho lock và cho từng `package.json`. Soát thêm `pnpm audit` và advisory ở
repo gốc của 60 dependency production thấy những lỗ Dependabot chưa biết, trong đó hai lỗ với tới
được từ request của khách vô danh. User chọn phương án A: vá cả 24 alert lẫn các lỗ ngoài danh sách,
không nhảy major nào, không nâng better-auth và oRPC 1.15.

**Đường request thật (API trên Render, web và admin trên Vercel):**

- **next 16.3.4 lên 16.3.8** (web, admin). GHSA-vcvr-r3jv-pc5j (critical, alert #69 #76 #81: RCE ở
  `ImageResponse` bản Node của `next/og` khi nhận giá trị do kẻ tấn công điều khiển) vá ở 16.3.6.
  Icon của hai app dùng `ImageResponse` nhưng chỉ với prop tĩnh, nên không với tới. Bảy advisory
  công bố 30/09 (SSRF ở Image Optimization mức high, cache poisoning SSG/ISR, rò Draft Mode…) chỉ vá
  ở 16.3.8, mà PR Dependabot #5 dừng ở 16.3.6.
- **fastify 5.12.1 lên 5.12.5**, override `fastify@>=5.0.0 <5.12.1: 5.12.1` được THAY bằng
  `<5.12.5: 5.12.5` (alert #71–#75, #82–#86; năm GHSA vá ở 5.12.2 và 5.12.5). Phần lớn không với tới
  (API không dùng schema của Fastify, không bật HTTP/2), nhưng gói nằm trên đường HTTP.
- **`@nestjs/common`, `core`, `platform-fastify`, `testing` 11.1.28 lên 11.2.7**, vẫn ở v11.
  GHSA-9c5c-9qcx-q35q (alert #70 #80, bỏ qua middleware Nest theo path) vá ở 11.2.4; API không có
  `forRoutes` nên không với tới. Nâng cả bốn cùng nhịp phát hành: 11.2 thêm tính năng chung cho
  core, common và platform-fastify (method QUERY). Platform-fastify 11.2 kéo thêm `@fastify/middie`
  9.3.4, đúng bản vá GHSA-hx87-8wv7-pjv8.
- **Cả họ `@orpc` 1.14.8 lên 1.14.15** (api, web, admin, contract; vẫn một bản chung theo ADR-0016).
  GHSA-gcgf-fh7c-8gf2 (`@orpc/zod`) và GHSA-4h5r-cv8j-4456 (`@orpc/json-schema`, chưa vào DB chung):
  smart coercion tra schema con bằng `shape[key]`. **Với tới thật**: API bật
  `experimental_ZodSmartCoercionPlugin`, nên `GET /api/tours?constructor=1` trả 500 cho khách vô
  danh. Kèm GHSA-58r7-2f58-x3f6 (`@orpc/nest`, guard cấp method bị bỏ qua khi `@Implement` nhận cả
  router), không với tới: 90/90 `@Implement` là procedure đơn, auth là `APP_GUARD`.
- **`@nestjs/throttler` 6.5.0 lên 6.7.1**. GHSA-5wh8-6fqf-738g (high, mới chỉ ở repo): tracker mặc
  định lấy `req.ip` nguyên văn, nên xoay địa chỉ trong một /64 IPv6 là né được trần. **Với tới**:
  `DefaultThrottlerGuard` gọi `super.getTracker` cho route công khai, `WriteOnlyThrottlerGuard` của
  `/api/auth` dùng tracker mặc định. Từ 6.7.0 địa chỉ IPv6 gom về /64. Nửa "phình bộ nhớ" của advisory
  thì `KeyedThrottlerStorage` đã chặn từ trước (trần 50.000 bucket).
- **sharp 0.35.4 lên 0.35.5** qua override `^0.35.5` (GHSA-wq5f-xc86-pv6w, librsvg). next 16.3.8 vẫn
  khai `^0.35.4`, nên lần này chỉ override kéo được sharp lên.

**brace-expansion tách override theo major, vá luôn một lỗi ngầm trên `main`.** Dòng chung
`brace-expansion: '^5.0.9'` (27/07, khi dòng 2.x chưa có backport) ép 5.x vào minimatch 3, 5 và 9.
Ba bản này `require()` theo API 1.x/2.x (export là một hàm), còn 5.x export `{ expand }`, nên glob
nào có `{a,b}` cũng ném "expand is not a function" — chạy thử cả ba đều ném. Chưa nổ chỉ vì chưa chỗ
nào gọi glob có ngoặc nhọn. Từ 14/09 maintainer vá ngược mọi dòng (alert #77–#79 vá ở 1.1.21, 2.1.7,
3.0.9, 5.0.12), nên dòng chung thay bằng bốn dòng theo major: minimatch@3 nhận 1.1.21, minimatch@5 và
@9 nhận 2.1.7, minimatch@10 nhận 5.0.12. Chạy lại: cả bốn bản khớp `a{b,c}d` đúng.

**Dep bắc cầu, override giới hạn theo dải lỗ:** piscina 4.9.4 (#87) và `@xhmikosr/decompress`
11.1.4 (#67), cả hai qua `@swc/cli` lúc build API. engine.io 6.6.11 (#68) nằm trong `dependencies`
của API qua react-email, nhưng chỉ CLI `email dev` dùng: đo `import('react-email')` nạp 106 module,
không có socket.io. Thêm năm gói `pnpm audit` thấy trước Dependabot, đều là dev tool: shell-quote
(critical), compression, source-map-js, postcss-selector-parser và `@modelcontextprotocol/sdk`. Riêng
selector của MCP SDK lấy tới 1.32.0 theo ba advisory 02–05/10 mới chỉ có ở repo SDK.

**Bốn lỗ chưa có bản vá trên npm** vào `auditConfig.ignoreGhsas`, lý do ghi ở `pnpm-workspace.yaml`:
braces (#89), node-forge (#88), http-cache-semantics (#90) và sprintf-js. Riêng http-cache-semantics:
bản 4.3.0 ra 04/10 không vá — diff 4.2.0→4.3.0 chỉ sửa Vary, nhánh `max-stale` giữ nguyên — nên dòng
"vá ở >=4.2.1" của `pnpm audit` là sai.

**Không nâng, ghi ở `open-items`:** better-auth 1.7.7 (ba lỗ critical/high mới chỉ ở repo, đều cần
plugin mà API không bật: Magic Link, OAuth Proxy, `deviceAuthorization`; nâng minor thư viện đăng
nhập một tuần trước freeze) và oRPC 1.15.2 (GHSA-4p2c-m292-ghmh chỉ dính `RPCHandler`, API dùng
OpenAPI).

**PR Dependabot #5 không merge:** nó dừng next ở 16.3.6, nâng platform-fastify mà để core và common ở
11.1.28, và không đụng override fastify cũ. Platform-fastify ghim fastify 5.11.3, override cũ kéo bản
ấy về 5.12.1, nên lock của PR có hai fastify và adapter Nest — đường HTTP thật — vẫn chạy 5.12.1.

Lock đổi +46/−48 gói, đúng các gói trên; cây không thêm gói nào khác ngoài phụ thuộc của bản mới
(`@fastify/middie`, `@xhmikosr/decompress-tar`, `balanced-match` và `concat-map` của brace-expansion
1.x). `minimumReleaseAgeExclude` không đổi: bản trẻ nhất là MCP SDK 1.32.1, gần ba ngày tuổi.
`pnpm audit --audit-level=moderate` thoát 0. Cảnh báo peer của `pnpm install` giống `main` (Expo và
React Native). API mới khởi động được với `.env.local` dev: health 200, `?constructor=1` trả 200.

**Review findings:** không mở vòng review riêng. Hai test hồi quy viết trước, chạy trên lock cũ đỏ
đúng lý do: `throttle.e2e.spec` — địa chỉ IPv6 thứ 6 cùng /64 vẫn nhận 201 thay vì 429 trên throttler
6.5.0; `catalog.int.spec` — `?constructor=1` nhận 500 trên `@orpc/zod` 1.14.8. Trên lock mới cả hai
xanh.

**Việc sau push** (push chờ user duyệt): dismiss ba alert #88 #89 #90 (`tolerable_risk`, lý do
như trên); chạy tay workflow `Audit`; xem 21 alert còn lại tự chuyển `fixed`; đóng PR #5 và xoá nhánh
của nó. Không migration, không env, không webhook. Push lên `main` là Render deploy API mới và Vercel
build lại web, admin — canh G23 ở cả Render lẫn status `Vercel – web`.

Tests after (`gate:int` trên `3a19022d`, bản trước khi rebase, tách bước có hãm song song và watchdog,
08/10 13:34–13:47, int trên DB riêng `tourism_test_depfix`): unit 5713 — admin 1911, web 1683, api
1085, contract 665, mobile 159, mobile-ui 86, core 46, ui 36, i18n 23, tokens 19 — và int 775/775 ở
46 file; build web 75/75 trang tĩnh với API dev cổng 3401. Cây của `3a19022d` chỉ khác lượt unit và
int ở một đoạn comment, đã chạy lại build, typecheck và Biome. Commit trống thấp nhất 2,09 GB, lúc
Next sinh trang tĩnh bằng 15 worker; pagefile đứng yên 2048 MB. Rebase lên `48c71074` chỉ thêm code
dải tab của web (đã qua gate ở nhánh của nó); sau rebase chạy lại typecheck, test và build của web:
1703 test, 75/75 trang tĩnh. CI chạy cả gate trên `main`.

## 2026-10-08 — Dải 5 tab trang tour cuộn ngang dưới 640px (`854b3767`..`c88f0469`, nhánh `fix/tour-tabs-mobile-scroll`)

**Lỗi** (G27, đo 07–08/10 trên prod lẫn bản build local, `/tours/vietnam-grand-journey-12d`): ở 375px
năm tab cộng bốn khe 24px cần 430px trong khung 279px, mà `TabsList` không có lớp cuộn nào. Tab cuối
tràn tới x=402 và cả trang cuộn ngang được (`scrollWidth` 402 so với 375). Lúc đo lại bằng Chromium
mới lộ nửa thứ hai: lớp gốc `justify-center` căn giữa cả phần tràn, nên Overview nằm ở x=−27, chỗ
không cuộn tới được.

User duyệt thiết kế 08/10, chọn "cuộn ngang và mờ mép". Ba hướng bị loại: thu khe và chữ (bỏ hết khe
vẫn 334px, chữ 12px còn khoảng 286px, đều quá 279), để lộ thanh cuộn 4px (iPhone chỉ hiện nó lúc đang
vuốt), và ô chọn (mất cái nhìn tổng quan 5 phần). Mã ở `tour-tabs.tsx`:

- Dưới 640px (`max-sm:`) dải là vùng cuộn native, thanh cuộn ẩn, tab căn từ mép trái. Tab giữ
  `flex-1` nên khung đủ rộng thì vẫn chia đều.
- Mép nào còn tab bị che thì mờ 2rem. Hook đặt `data-overflow-start` và `data-overflow-end` theo vị
  trí cuộn, nghe `scroll` cùng ResizeObserver trên dải lẫn từng tab (font nạp xong làm tab rộng ra
  mà dải không đổi kích thước). Đường kẻ đáy dời ra vỏ ngoài để mask không làm mờ nó.
- Tab đang mở (từ hash lúc vào trang, `hashchange` hay cú bấm) được cuộn ra khỏi vùng mờ, chỉ chạm
  trục ngang, trượt mượt trừ khi máy bật giảm chuyển động. Hai phép tính thuần tách ra
  `lib/scroll-strip.ts`.
- `data-lenis-prevent` chỉ gắn khi dải tràn. Từ 640px trở lên không lớp nào đổi.

**Đo trên bản build** (`next start` cổng 3310, API dev cổng 3301). Browser pane đang ẩn nên đo bằng
Edge headless qua CDP, profile tạm:

- 320, 360 và 375px: `scrollWidth` của trang bằng `clientWidth`, kể cả khi mở tab Departures. Dải
  rộng 429px, cuộn tối đa 205, 165 và 150px; Overview nằm ở x=0.
- 375px: ở đầu dải chỉ mép phải mờ, giữa dải mờ cả hai mép. Bấm Reviews khi nó đang lộ 19px thì dải
  cuộn đúng 69px. Vào bằng `#good-to-know` thì dải cuộn hết 150px và tab ấy lộ trọn. Gạch chân nằm ở
  37–39px, chạm đường kẻ của vỏ ở 39–40px.
- 768 và 1280px: tab rộng 114,4px (khung 668 vì thanh cuộn dọc 4px) và 192px, cao 40px, gạch chân
  ở 37,5–39,5px như trước khi sửa. Không mờ mép, không `data-lenis-prevent`.

**Review findings:** không mở vòng review riêng. Test viết trước, đỏ đúng lý do: 12 ca cho hai hàm
thuần và 8 ca component (mép mờ, giữ wheel, ResizeObserver, cuộn tab đang mở ra ở ba đường). jsdom
không có layout nên lỗi `justify-center` chỉ lộ khi đo trên bản build; ca canh nó là test hợp đồng
trên lớp CSS. Vòng focus bàn phím dưới 640px: viền 1px vẫn đủ bốn cạnh, nhưng quầng 3px phía trên
(và bên trái của tab đầu) bị vùng cuộn cắt; desktop giữ nguyên.

**CÒN TREO:** G26 (lề 48px ở mọi khổ) và G28, ghi ở `open-items`. Không migration, không env, không
webhook.

Tests after (`gate:int` trên `c88f0469`, 08/10 13:33–13:38, int trên DB riêng `tourism_test_tabs`):
unit 5732 — admin 1911, web 1703, api 1084, contract 665, mobile 159, mobile-ui 86, core 46, ui 36,
i18n 23, tokens 19 — và int 774/774. Web thêm đúng 20 ca của nhánh này; api và int nhiều hơn entry
ngay dưới là phần của bản vá huỷ chuyến đã lên `main` trước.

## 2026-10-08 — Bảng đợt khởi hành dưới lg thành thẻ xếp dọc (`ec039b0d`, nhánh `fix/web-departures-mobile`)

Lỗi có từ trước, không do bản vá giá có xu: tab Departures của trang chi tiết tour vỡ ở khổ điện
thoại. Đo prod 07/10 (`/tours/vietnam-grand-journey-12d`, viewport 375): khung bảng 277px mà bốn cột
ghim cứng đã 400px, nên cột ngày và cột ghế bị bóp về 0, chữ đè nhau, nút Select bị `overflow-hidden`
cắt mất. Ở 768px cột ngày cũng chỉ còn khoảng 70px; bảng đọc ổn từ khoảng 820px.

User duyệt thiết kế 08/10, chọn "thẻ xếp dọc" thay vì "cuộn ngang có chỉ báo" (`departures-panel.tsx`):

- Dưới `lg`, chính `<table>` đó đổi `display` bằng CSS, không dựng bản sao DOM cho mobile: `thead` và
  `colgroup` rời bố cục, mỗi `tr` là một khối flex-wrap.
- Hàng tháng: mũi xổ, tên tháng, giá; số ghế và huy hiệu mỗi thứ một dòng. Hàng đợt: khối ngày cạnh
  giá, thanh ghế trải ngang, huy hiệu cùng nút Select hoặc "Ask about this trip".
- Mốc chuyển là `lg`, trùng mốc thanh đặt chỗ dính đáy. Lớp chỉ dành cho bảng mang tiền tố `lg:` thay
  vì để trần rồi đè bằng `max-lg:`, vì `[&>td:first-child]:pl-…` nặng độ ưu tiên hơn mọi lớp đè.
- Flex-wrap chứ không dùng lưới: lưới hai cột thì giá và nút "Ask about this trip" chung cột phải,
  cột ấy nở theo nút và bóp khối ngày.

Phát sinh khi đo trên bản build, vá trong cùng nhánh (test viết trước, đỏ đúng lý do):

- Cụm ngày bị chẻ ("until 15" / "Nov", "1–22" / "Nov"): ngày đi và ngày về thành hai cụm `nowrap`;
  hạn huỷ và dòng phụ của tháng nối cụm ngày bằng NBSP, chèn WORD JOINER (U+2060) sau gạch "–".
- Ở 320px tên tháng bị bóp còn 56px và cụm ngày tràn ô 2px: khối ngày giữ sàn 112px (cụm rộng nhất
  đo được 97,6px), tên tháng giữ sàn 96px; thiếu chỗ thì giá xuống dòng, `ml-auto` giữ nó sát phải.
- Thanh ghế 16 đốt có bề rộng tối thiểu 252px nên lấn lề thẻ ở 375px, còn tour 22 chỗ tràn khỏi
  khung ở 320px: ô ghế `min-w-0` để đốt co đều.

**Đo trên bản build** (`next start` cổng 3210, API dev cổng 3101), ba tour: `phu-quoc-island-hopping-day`
(16 chỗ, có đợt đã đóng, đợt hết chỗ, giá gạch), `vietnam-grand-journey-12d` (ngày dài, giá gạch),
`halong-bay-overnight-cruise` (22 chỗ):

- 320, 375 và 768px: khung không cuộn ngang, không ô nào tràn hay đè nhau, mọi nút lọt khung, không
  cụm ngày nào bị chẻ.
- 1024 và 1280px: bề rộng cột, chiều cao hàng và vị trí ô khớp số đo chụp trước khi sửa ở cả 6 lượt;
  đệm và viền ô tính ra như cũ.
- Tương tác ở 375px: tháng đóng ẩn hàng (`[hidden]` của preflight Tailwind thắng `max-lg:flex`), nút
  Select đổi đợt đang chọn.

**Review findings:** không mở vòng review riêng. jsdom không tính layout nên 7 test mới là test hợp
đồng trên lớp CSS và ký tự nối; bằng chứng bố cục là lượt đo ở trên. Hàng "See all N … dates" chỉ có
test hợp đồng, vì dữ liệu dev không có tháng nào quá 6 đợt.

**CÒN TREO:** G26 (lề trang 48px ở mọi khổ), G27 (dải 5 tab tràn ngang ở 375px, cả trang cuộn ngang
được), G28 (thanh ghế quá 24 chỗ tràn thẻ ở 320px), ghi ở `open-items`. Bản vá giá có xu (`1eb3d81d`,
`2e62229b`) vẫn chỉ nằm ở nhánh cục bộ `claude/priceless-heisenberg-d71023`, chưa lên `main`. Không
migration, không env, không webhook.

Tests after (`gate:int` trên `05534a94`, bản trước khi rebase, 08/10 13:02–13:09, int trên DB riêng
`tourism_test_depmobile`): unit 5708 — admin 1911, web 1683, api 1080, contract 665, mobile 159,
mobile-ui 86, core 46, ui 36, i18n 23, tokens 19 — và int 771/771. Rebase lên `f6d53151` chỉ thêm
code API và contract của bản vá huỷ chuyến ngay dưới (đã qua gate ở nhánh của nó); sau rebase chạy lại
typecheck và test của web, CI chạy cả gate trên `main`.

## 2026-10-08 — Chuyến bị công ty huỷ thì khách hết tự huỷ: vá khoảng chờ job hoàn tiền (`c7f86e2a`..`cf6a0824`, nhánh `claude/vigilant-jones-c95f34`)

**Lỗi** (phát hiện ở review P7 phần C, xác minh bằng đọc mã): admin huỷ chuyến thì booking `PAID`
nằm chờ job `departure-refund` — worker gói free ngủ khoảng 15 phút, lưới quét 10 phút một lần, cổng
lỗi thì retry giãn luỹ thừa. Trong khoảng chờ, trang đơn vẫn in nút huỷ và `bookings.cancel` vẫn
nhận lệnh; quá hạn chót thì khách được hoàn 0. Job tới sau thấy booking `CANCELLED` nên coi như
xong, lưới quét chỉ tìm `PAID`/`PARTIALLY_REFUNDED` nên cũng không vớt — khách mất khoản 100% mà
ADR-0041 §6 hứa. Soát prod 08/10 (SQL chỉ đọc): chưa đơn nào dính; đơn duy nhất trên chuyến huỷ từ
F13 là đơn thử tay 22/09, do chính job hoàn trọn.

**Sửa** theo ADR-0041 AMEND 1, viết trước code (`c7f86e2a`); mã ở `cf6a0824`:

- `cancellationBlocker` nhận đường đi tường minh (`CancelPath`, bỏ mặc định `'customer'`). Đường
  khách bắt buộc mang trạng thái SỐNG của chuyến; chuyến `CANCELLED` thì chặn, 422
  `NOT_CANCELLABLE`. `bookings.byCode.cancellation` trả `null` — luật huỷ của khách thôi áp dụng.
- Lõi huỷ khoá hàng chuyến `FOR KEY SHARE` trước khi đọc trạng thái, xếp hàng với `FOR UPDATE` của
  lượt huỷ chuyến. `KEY SHARE` chứ không `SHARE`: hai khách cùng chuyến không deadlock ở câu trả ghế,
  lúc tiền đã đi.
- Giao dịch huỷ chuyến nâng timeout lên 20 giây: nó có thể phải chờ một lượt khách đang gọi cổng.
- Docs: `booking-states.md` thêm hàng "Công ty huỷ chuyến" (thiếu từ F13) và luật mới, sửa đoạn "Một
  lõi cho hai người gọi" đã cũ; mô tả trường `cancellation` ở contract và chú thích web theo.

**Review findings:** không mở vòng review riêng. Test viết trước, đỏ đúng lý do: 6 ca đơn vị và 3
ca int — đơn huỷ được (200) trong khoảng chờ; `byCode` còn nút huỷ; ca đua (giao dịch giữ khoá
chuyến như admin) để lệnh khách chờ ở câu CTE rồi lọt qua. Kiểm đột biến: bỏ `FOR KEY SHARE` thì ca
đua đỏ lại (200).

**CÒN TREO:** phần web — khối báo "chuyến đã bị huỷ, tiền đang hoàn", voucher và hoá đơn trong khoảng
chờ — làm sau khi P7 B và C merge (`docs/open-items.md`). Không migration, không env, không webhook:
deploy chỉ là push.

Tests after (`gate:int` trên `cf6a0824`, 08/10 12:45–12:53, int chạy trên DB riêng): unit 5705 —
admin 1911, web 1676, api 1084, contract 665, mobile 159, mobile-ui 86, core 46, ui 36, i18n 23,
tokens 19 — và int 774/774.

## 2026-10-07 — Thử tay đợt sửa sạn admin trên production và năm việc chờ quyết (`4956c287`..`89d1b3eb`, nhánh `fix/admin-polish-followups`)

**Thử tay production** sau merge `3b608b3f` (CI xanh sau 9 phút 24 giây, Render live 17:43, không
dính G23), từng bước theo spec §5, user làm và gửi ảnh: bước 1–7 đạt.

- Ô chọn ở khu sửa tour và hộp New tour, gồm gõ chữ trên ô đang đóng.
- Các ô lọc: thư viện ảnh, Rows per page, ô trạng thái enquiry.
- Quick Create: cùng trang, khác trang, "Discard changes", điện thoại.
- Nút Delete đang khoá: tooltip khi rê và Tab; toast khi chạm trên DevTools mô phỏng iPhone 16 Pro
  Max (một toast, chạm lại không chồng).
- Xoá thật một điểm đến tạm `QA delete test`: hộp xác nhận, toast, xoá trùng ở tab cũ báo "This
  destination no longer exists".
- Hộp Reject, dòng báo Summary bị cắt, các sạn nhỏ còn lại.

Bước 8 (lượt 375px tổng và hộp xác nhận ở web) chỉ được phủ một phần qua các ảnh 375px. Điểm đến
thử `abc` đã không còn trên production (đo bằng SQL chỉ đọc), không tour nào bị ghi trong lượt thử.

**Năm việc chờ quyết** — user giao "làm theo hướng tối ưu":

- Bảng Outbox: ô Attempts xuống dòng dưới trần 144px (`89d1b3eb`). Đo bằng Edge headless ở khung
  1094px (cửa sổ 1440px có sidebar): các kịch bản thật về 0, còn 24px ở ca cực đoan — hàng SKIPPED
  giữa các hàng FAILED mang chuỗi dài nhất và ngày rộng nhất; trước đó 152px.
- Hàng đã ẩn thôi khuyên ẩn: tooltip "Used by N tours.", lỗi `IN_USE` dừng ở "…can’t be deleted."
  (`6fc4f92d`); hàng đang hiện giữ chữ cũ.
- Ô "Photo unavailable" trong dialog chi tiết review đủ khung một ảnh 4:3, co theo dialog hẹp
  (`95ac760c`, prop `brokenClassName` của kit `SafeImg`).
- Route revalidate của web từ chối chuỗi dev công khai ở production (`32098a15`, ADR-0016 AMEND 4) —
  kiểm lúc xử lý request nên web vẫn lên.
- ADR-0052 AMEND 1: danh sách Owner-only thêm hai lệnh xoá của ADR-0053, đếm thành 16 (`4956c287`).

**Review findings:** không mở vòng review riêng — mỗi mục có test viết trước, đỏ đúng lý do; kiểm đột
biến ở chữ hàng ẩn; đo trình duyệt cho Outbox và ô ảnh hỏng.

**CÒN TREO:** nợ G24 (bốn bảng admin còn dựng lại ô sau mỗi lượt làm mới) và G25 (khoá ngoại điểm đến
`CASCADE`); chạm nút Delete khoá trên máy cảm ứng thật. Không migration, không env, không webhook.

Tests after (`gate:int` trên `89d1b3eb`, 07/10 19:09–19:15): unit 5701 — admin 1911, web 1676, api
1080, contract 665, mobile 159, mobile-ui 86, core 46, ui 36, i18n 23, tokens 19 — và int 771/771.

## 2026-10-07 — Sửa sạn giao diện admin: ô chọn chung, Quick Create, xoá danh mục và điểm đến (`b98b1bdf`..`238fdc2f`, nhánh `fix/admin-ui-polish`)

Thay chỗ P4f: 05/10 user hoãn P4f để dọn sạn admin trước freeze 15/10. Đầu vào là bốn sạn user
gửi và mười sạn agent tự rà trên admin production cùng ngày. Quyết định ghi ở ADR-0053 và spec
`2026-10-05-admin-ui-polish-design` (`2b3a6b92`, viết trước code), plan 19 task (`8c472b61`, vá
sau lượt soát ở `2329e5f8`). Thi công bằng subagent, mỗi task một vòng review, rồi một lượt review
cuối toàn nhánh và một đợt vá theo nó (Opus 5.5 effort max, user chọn). 45 commit đầu: 4 commit
doc và env (`b98b1bdf`..`2329e5f8`), 27 commit của 19 task (`0ed7d48f`..`632228a0`), bản đầu của
entry này (`b627e111`), 12 commit của đợt vá cuối và bản viết lại entry (`65d07577`). Sau đó
session gốc review max rồi vá trọn trên chính nhánh — 52 commit nữa, xem mục "Review max trước
merge" bên dưới. Không migration, không đổi schema, không env mới.

**A. Một kiểu ô chọn và Quick Create.**

- `Picker` (`kit/picker.tsx`; `0ed7d48f`, `0030263e`) vẫn là Base UI Select nhưng khoác dáng menu
  lọc: danh sách thả xuống dưới ô, nhãn nhóm, vạch ngăn, icon và chữ phụ mờ. Hai biến thể: `field`
  cao 32px như ô nhập, nền nhạt khi rê và khi mở; `toolbar` dáng nút lọc 36px. Giá trị không khớp
  mục nào thì in thẳng ra ô. Hằng style của popup, nhãn nhóm và mục nằm ở `kit/menu-style.ts`,
  `ToolbarFilterMenu` đọc chung. Ô dáng ô nhập co được dưới bề rộng chữ: tên dài cắt "…" và chữ
  "Hidden" vẫn nằm trong ô thay vì tràn sang ô bên cạnh (`6770fb10`). Spec thêm ca chặn `null` của
  Base UI và hai ca bàn phím (`2bbce358`).
- Mười ô chọn trong form đổi sang `Picker`; mục đã ẩn mang chữ phụ "Hidden" thay cho "(hidden)"
  ghép vào tên (`2000748f`). Ô lọc màn hẹp của `StatusFilterTabs`, ô trạng thái `/enquiries` và
  Rows per page cũng đổi (`eba0f363`, `f8c8d849`). `FormSelect` và `ToolbarSelect` bị gỡ.
- `Popover` và `Tooltip` của `@tourism/ui` đổi `z-50` sang `z-(--z-popover)` (`034675e4`): đặt
  trong hộp thoại thì nổi trên hộp thoại.
- Quick Create thành menu bốn mục New tour · New post · Add category · Add destination
  (`1e8bd72e`). Bản đầu mở hộp tạo qua tham số `?create=1`; vòng review thay bằng một yêu cầu tạo
  phía client (xem dưới), F5 và Back vẫn không mở lại. Menu mở bên dưới khi sidebar mở rộng, bên
  phải ở cột icon. Nút phong bì không có
  đích bị gỡ. Ở cột icon, nhãn nhóm vô hình hết chặn chuột nên bấm giữa icon mở được menu
  (`ebaa4af1`); JSDoc chỉ còn nhận chung khuôn ghép trigger với `NavUser` (`fbd62ce9`).

**B. Xoá danh mục và điểm đến chưa tour nào dùng (ADR-0053).**

- Contract (`2195106a`): `admin.categories.delete` và `admin.destinations.delete`,
  `POST …/{id}/delete`, lỗi `IN_USE` 409 và `NOT_FOUND` 404, trả `{ slug }`. Hàng của hai bảng
  thêm `linkedTourCount` — số tour mọi trạng thái; `tourCount` giữ nghĩa tour đang bán.
- API: xoá danh mục chạy trong khoá thứ tự, `P2003` thành `IN_USE` (`ccc17db0`, `e7d3ff6b`). Xoá
  điểm đến khoá hàng `FOR UPDATE`, đếm liên kết, gỡ dòng ảnh `DESTINATION` của nó rồi mới xoá
  (`c7e55332`). Bust `tours` sau commit. Đếm tour bỏ qua liên kết trỏ tới tour vừa bị xoá giữa hai
  câu đọc (`833fa4a1`). JSDoc của hai select đếm tour sửa cho đúng: không phải một ảnh chụp, bất
  biến `tourCount ≤ linkedTourCount` đứng nhờ hai số đếm trên cùng một mảng (`86be546b`). Ca int
  xoá điểm đến canh thêm ảnh của điểm đến khác (`d5e0783f`); ca đua chờ lệnh xoá đứng sau khoá
  hàng ở `pg_locks` thay vì chờ cứng 300ms (`169ee44c`).
- Admin: kit `TourCountCell` và `DeleteRowAction` (`c7ab4bfc`). Cột Tours in "N tours" kèm dòng mờ
  "M published", hoặc "No tours" mờ. Nút Delete là nút thứ ba của hàng; hàng còn tour thì nút khoá
  kiểu `aria-disabled`, tooltip "Used by N tours — hide it instead." hiện cả khi rê lẫn khi Tab tới.
  Hộp xác nhận giọng đỏ (`7d3dc844`, `96a27f81`, `9676f1ec`). Nút khoá giữ focus khi bảng làm mới
  đổi trạng thái, trình đọc màn hình nghe lý do qua `aria-describedby`, rê hay nhấn không đổi nền
  (`824b9974`).
- ADR-0053 ghi thêm giới hạn: tour mượn ảnh thư viện của điểm đến đã xoá thấy ảnh mang nhãn
  "Catalogue photo", lưu vẫn chạy (`9503bcc2`).

**C. Sạn nhỏ.**

- Thẻ "Card on /tours" báo khi Summary bị cắt sau hai dòng (`21c6bf0b`).
- Hộp Reject rộng tới 64rem, danh sách lý do có làn riêng cho thanh cuộn (`1a1ebe83`; lề hai bên
  sửa ở vòng review).
- Bảng Tours xin ảnh bản 160px. Ảnh hỏng ở bảng Tours, bảng Posts, bảng review, dialog chi tiết và
  hộp duyệt review hiện ô "Photo unavailable" (`f4f63d51`, `31907a70`).
- Nút Export của Subscribers nằm trong ô tiêu đề cột Actions; bảng Outbox thu trần ba cột
  (`da344bb6`), rồi hạ tiếp theo số đo của Task 19 (`632228a0`, xem dưới).
- Chi tiết booking: email xuống dòng sau `@`, provider in "Stripe"/"PayPal", badge huỷ REFUNDED đỏ
  như booking CANCELLED, chuyến một ngày in một ngày (`78744a90`). Email ở chi tiết enquiry và
  drawer outbox cũng xuống dòng sau `@` (`d2ce5e63`).
- Đường doanh thu Dashboard đổi sang `monotone`, hết vọt dưới 0; `/categories` và `/destinations`
  bỏ tiêu đề lớn (`4e80c725`).
- Thẻ số liệu xếp 2 cột từ màn hẹp nhất (`4e80c725`). Thẻ hẹp dưới 220px thì pill xuống dòng riêng
  dưới con số, căn trái, con số còn 20px (`c02ff069`, `a1f7a11c`) — spec §7 chỉ dặn thu cỡ chữ con
  số, đo thì thấy chưa đủ (xem dưới). Vòng review thay ngưỡng 220px bằng bố cục theo nội dung.

**Kèm theo.** `b98b1bdf` khai đủ khoá env ở `render.yaml` và sửa ghi chú hai `.env.example` (mẫu,
không đổi giá trị nào trên Render). Doc: spec P4e-2 §2a trỏ ADR-0053; doc P4f cộng hai lệnh xoá vào
bảng quyền và ẩn hai nút Delete với Staff (`c4c6d6da`, `23d39d7d`); bản đồ `docs/README.md` thêm
spec, plan và ADR-0053.

**Đo trên trình duyệt thật (Task 19).** Edge 154 headless, admin dev và API dev ở máy, DB Docker
đã seed, đo bằng JS. Các mục đạt:

- đường doanh thu chạm 0 mà không xuống dưới, lệch 0px ở cả ba dải;
- thẻ số liệu 2 cột, trang không tràn ngang ở 375px;
- mọi `Picker` ở khu sửa tour và hộp New tour thả danh sách dưới ô (hai danh sách lật lên trên khi
  phía dưới hết chỗ, không đè ô); "Hidden" mờ cả trong danh sách lẫn trên ô;
- popup ô lọc màn hẹp nằm trọn khung ở 375 và 360px;
- Quick Create mở đúng hộp ở cả bốn vùng; tải thẳng `?create=1` không lỗi hydration; F5 và Back
  không mở lại (cơ chế tham số này đã thay ở vòng review);
- tooltip của nút Delete khoá hiện khi rê và khi Tab; một danh mục và một điểm đến tạo thử được xoá
  trọn vòng bằng nút mới;
- tooltip đặt trong sheet nổi trên sheet (z 1500 so với 1400);
- hộp Reject, nút Export của Subscribers, dòng báo Summary và chi tiết booking đúng spec.

Bảng Outbox: trang hàng FAILED mang chuỗi dài vẫn cuộn ngang 120–146px ở 1440px, nên trần hạ tiếp
còn Type 176px, Recipient 144px, Last error 80px (`632228a0`, kèm spec ghim trần và `title`). Đo
lại thì vừa khung 1094px. Ảnh hỏng: không thử được, DB local không có dòng `media_assets` nào.

Bốn phát hiện nằm ngoài các sửa Task 19 được phép, chuyển cho review cuối:

- thẻ số liệu ở 375px: pill của thẻ Revenue (`/`, `/bookings`) bị đẩy ra ngoài, phần đầu thẻ tràn
  53px; Cancellation rate tràn 1px, Unsubscribed 28d (`/subscribers`) 19px. Thu cỡ chữ con số không
  đủ: 16px vẫn tràn 11px, còn hai thẻ kia tràn vì chữ dài nhất của nhãn cộng pill. Đã sửa
  (`c02ff069`, `a1f7a11c`);
- Quick Create ở cột icon: nhãn nhóm "Operations" vô hình (`opacity-0`, `-mt-8`) vẫn nhận chuột và
  che nửa dưới nút, bấm giữa icon không mở menu. Nhãn "Content" và "System" che chừng 35% phía dưới
  của Subscribers và Appearance theo cùng cách (có từ trước nhánh). Đã sửa (`ebaa4af1`);
- bảng Outbox vẫn cuộn ở 1440px khi trang có hàng mang nhãn Attempts dài: tab Skipped cuộn
  51–77px, hàng SKIPPED lẫn hàng FAILED cuộn 131–156px, hàng "Sent after a manual retry" 58px. Chờ
  user quyết (CÒN TREO);
- `Picker` với tên dài: trên ô, chữ không cắt "…" mà tràn sang ô bên cạnh ở hộp New tour (danh mục
  ẩn có tên rộng hơn 120px đã tràn) — đã sửa (`6770fb10`). Trong danh sách, tên dài bị mép popup
  cắt ngang và chữ "Hidden" bị đẩy ra ngoài tầm nhìn — hoãn theo Ruling F-c, vì chỗ sửa nằm ở
  `select.tsx` của `@tourism/ui`, dùng chung với web.

**Đo lại sau đợt vá cuối** (06/10, cùng cách đo, trên `a1f7a11c`):

- cột icon: giữa nút Quick Create và các điểm 15–85% chiều cao nút đều trúng nút; bấm giữa icon mở
  menu bên phải. Subscribers, Appearance và Media library nhận chuột trọn chiều cao. Sidebar mở
  rộng: menu thả dưới nút, không tooltip;
- thẻ số liệu ở 360, 375, 414px trên `/`, `/bookings` (tháng 9), `/subscribers`, `/reports` (tháng
  9, có doanh thu), và cả tám trang ở 375px: không phần đầu thẻ nào tràn, pill nằm dưới con số.
  Quét thêm 420–1440px: màn 448–480px và 768px có sidebar (thẻ 200–216px) cũng xếp pill xuống
  dòng, 1440px không thẻ nào xếp dọc. Ngưỡng 200px theo Ruling F-a còn để pill cắt 17px ở màn 448
  và 7px ở màn 768 — nhánh `main` xếp 1 cột ở các bề rộng ấy nên không cắt, tức là vẫn thụt lùi —
  nên nâng lên 220px (`a1f7a11c`);
- hộp New tour, danh mục ẩn tên 82 ký tự: ô giữ 232px, tên cắt "…", "Hidden" nằm trong ô, cách ô
  Primary destination 16px; mở lại thì popup rộng 352px (trước là 576px vì ô nở theo chữ);
- nút Delete khoá: rê và Tab hiện tooltip; cây trợ năng của Edge đọc mô tả "Used by 14 tours — hide
  it instead."; ép `:hover` và `:active` thì nền và vị trí y nguyên ở cả sáng lẫn tối, trong khi
  nút của hàng 0 tour vẫn đổi nền và nhún 1px.

**Review findings.** Mỗi task một vòng review spec và chất lượng; không task nào có mục Critical.
Bốn task phải vá một vòng: T1 (`0030263e` — `Picker` in giá trị lạ thay câu giữ chỗ, menu lọc đọc
chung hằng nhãn nhóm), T3 (`f8c8d849` — Rows per page còn thiếu spec), T6 (`e7d3ff6b` — ca đua cũ
không đỏ khi gỡ khoá thứ tự, thêm ca tất định giữ khoá advisory) và T9 (`96a27f81` — ca phân loại
lỗi của lệnh xoá mà spec §5 bắt buộc). Ba phán quyết vá trước khi review: Prisma trả `tour: null`
khi tour bị xoá giữa hai câu đọc nên đếm tour bỏ qua liên kết ấy (`833fa4a1`); dấu hiệu ảnh hỏng áp
cho mọi chỗ in ảnh review (`31907a70`); doc P4f ẩn cả hai nút Delete với Staff (`23d39d7d`). Các
phán quyết khác: hộp tạo mở bằng state khởi đầu, cộng một effect cho trường hợp cùng trang; giữ
commit email thêm `d2ce5e63`; cột Departure của `/bookings` cũng in một ngày cho chuyến một ngày;
payload chế độ Simple không bọc email. Tối 05/10 Device Guard chặn `pnpm.exe` một lúc: Task 12–14
chạy Vitest, tsc và Biome bằng bin trực tiếp, tới lúc tạm dừng sau Task 14 thì `pnpm` chạy lại.

Review cuối toàn nhánh (`163c348b..661fc91e`): "With fixes" — 0 Critical, 4 Important, đều đã xử
lý: nhãn nhóm vô hình chặn Quick Create ở cột icon (`ebaa4af1`); thẻ số liệu ở 375px cắt pill,
thụt lùi so với `main` — Ruling F-a: thẻ hẹp đưa pill xuống dòng riêng, vẫn 2 cột (`c02ff069`,
ngưỡng nâng lên 220px theo số đo ở `a1f7a11c`, chú thích làm rõ ở `340ab747`); ô `Picker` tràn
sang ô bên cạnh (`6770fb10`); entry CHANGELOG phải viết lại trước merge (chính bản này). Các mục
rẻ làm cùng đợt: `DeleteRowAction` dựng lại nút khi lý do khoá đổi nên rơi focus, nút khoá vẫn
sáng khi rê, và trình đọc màn hình không nghe lý do — Ruling F-e thay phán quyết T8-a cũ: span
`hidden` cộng `aria-describedby` (`824b9974`; chạm trên màn cảm ứng vẫn không hiện tooltip, cột
Tours đã in số tour); JSDoc nói cờ tour đọc "trong cùng một lần đọc" trong khi Prisma 7.8 đọc quan
hệ bằng câu SQL riêng — đo hai câu với danh mục, ba câu với điểm đến (`86be546b`); ca xoá điểm đến
chưa canh bộ lọc `ownerId` (`d5e0783f`); ca đua chờ cứng 300ms có thể xanh oan khi máy tải nặng —
nay chờ `pg_locks`, đỏ 3/3 khi gỡ `FOR UPDATE`, xanh 3/3 khi có (`169ee44c`); JSDoc Quick Create
nói hướng mở giống `NavUser` (`fbd62ce9`); spec §5 thiếu ca chặn `null` và ca bàn phím của
`Picker` (`2bbce358`); ADR-0053 thiếu giới hạn ảnh mượn (`9503bcc2`). Hoãn theo phán quyết: nhãn
Attempts dài ở Outbox (Ruling F-b), danh sách `Picker` cắt tên dài (Ruling F-c), secret revalidate
dev trong `.env.example` của web (Ruling F-d); các mục Minor khác của từng task để lại, không chặn
merge.

**Review max trước merge (07/10, session gốc).** Nhánh rebase lên `main` `197fe31d` (có P7 Phần A)
trước khi vá; chỉ hai file doc xung đột. Mười góc tìm, mỗi ứng viên một lượt kiểm chứng, một lượt
rà sót: 15 phát hiện báo cáo cộng 21 mục nhẹ, tất cả đã kiểm chứng. User chọn vá 34 mục; bỏ hai:
khoá ngoại `tour_destinations` vẫn `CASCADE` (cần migration, spec §1 chốt không — ghi thành giới
hạn 4 của ADR-0053, nợ G25) và secret revalidate dev trong `.env.example` của web (đã hoãn theo
Ruling F-d). Thi công bằng subagent theo năm nhóm, rồi hai reviewer soát lại toàn bộ (18/18 và
20/20 mục đạt) và một nhóm vá năm việc nhỏ họ nêu. ADR đi trước code: ADR-0053 AMEND 1
(`c939c239`, sửa mã ở `388f4ce3`).

- **Contract và API** (`c84779a4`–`d401a2af`): lưu tab Details hay tạo tour với danh mục hoặc điểm
  đến vừa bị xoá từng nhận `NOT_FOUND` — trùng mã "tour không tồn tại", nên khu sửa tour báo "This
  tour no longer exists.", đá về `/tours` và làm mất chữ chưa lưu; nay là mã riêng `LINK_NOT_FOUND`
  (404, theo tiền lệ `RELATED_TOUR_NOT_FOUND`). Bust cache chia lô tối đa 20 tag, vì route web từ
  chối NGUYÊN lệnh khi vượt trần — sửa một điểm đến gắn từ 20 tour trở lên từng không bust được gì;
  route web lấy trần độ dài slug từ hằng của contract (`5d4871d2`). Xoá hàng đang ẩn không bust
  `tours`; int test chứng minh bust chạy SAU commit bằng cách đếm transaction đang mở. Một helper
  đếm tour cho danh mục và điểm đến; list điểm đến từ ba câu SQL xuống hai (một câu `GROUP BY`).
  Hai ghi chú `render.yaml` nói sai được sửa: `SENTRY_DSN` là seam chưa nối, `CLOUDINARY_UPLOAD_FOLDER`
  là tiền tố sở hữu của ảnh đã tải (đổi về sau là mồ côi ảnh cũ).
- **Kit dùng chung `@tourism/ui`** (`524a01cf`–`593193ea`, user đồng ý sửa dù web đang chạy):
  AlertDialog còn `z-50` nên nằm DƯỚI Sheet và hộp thoại — trên điện thoại hộp "Discard changes?"
  mở dưới sidebar, focus kẹt trong hộp bị che — và dưới navbar web; nay ở tầng token mới
  `--z-alert` 1450. Tên dài trong danh sách thả cắt "…" (`min-w-0` cho ItemText), không còn đẩy chữ
  "Hidden" ra ngoài popup. Nhãn nhóm sidebar thu gọn tắt chuột ngay ở primitive. Vạch ngăn của
  Select ra khỏi cây trợ năng.
- **Picker và dòng lựa chọn** (`8d6d45b8`–`5f7d0e0f`, `f6cb4162`): Picker chỉ chuyển tiếp lựa chọn
  của người dùng — Base UI tự quay về giá trị lúc mount khi mục đang chọn rời danh sách; một dòng
  lựa chọn dùng chung cho Picker và menu lọc, tên trợ năng đọc "Tên (Hidden)" ở mọi nơi kể cả radio
  Primary, tên bị cắt mang `title`; biến thể toolbar canh trái, hết đè lên sidebar.
- **Bảng danh mục, điểm đến, chuyến** (`273b4ee2`–`a0c62946`): server action đổi danh tính mỗi lượt
  `router.refresh()`, để trong deps của cột thì mọi ô hành động bị dựng lại — focus rơi về `<body>`
  sau khi bị chặn xoá, hộp Edit đang mở biến mất. Lệnh ghi đi qua `RowActionsContext`, cột là hằng
  module (bảng chuyến cùng lỗi, vá luôn — user đồng ý). Xoá thành công thì focus sang nút Add. Nút
  Delete chỉ mở khi đếm đúng 0 — khe deploy (admin mới, API cũ) không còn mở nút ở mọi hàng với câu
  "No tour uses…" sai. Chạm nút Delete đang khoá trên màn cảm ứng thì toast lý do. Chuỗi xoá và đếm
  tour gom về hằng chung của i18n.
- **Quick Create** (`8911014b`–`469fb8d1`, `7af4badc`, `38c19d53`, `238fdc2f`): bỏ tham số
  `?create=1` — cùng trang thì sinh hai mục lịch sử trùng URL và mất bộ lọc, `router.replace` kéo
  thêm một lượt render server. Nay một yêu cầu tạo phía client (`lib/quick-create.ts`), sống 60
  giây: cùng trang mở hộp ngay không điều hướng; khác trang ghi lúc điều hướng bắt đầu
  (`onNavigate`). Trên điện thoại bấm mục thì đóng Sheet; đóng hộp thì focus về nút Add/New; Ctrl,
  Cmd, Shift, Alt + bấm (tab mới) không ghi yêu cầu. Hộp hỏi rời trang thôi `stopPropagation` — nó
  làm menu kẹt mở, nổi trên chính hộp hỏi; "Discard changes" vẫn mở hộp tạo, ở lại thì yêu cầu bị
  xoá. Khu sửa tour và hộp New tour gặp `LINK_NOT_FOUND` thì báo lỗi, làm mới danh sách chọn, giữ
  chữ đang gõ, ô của mục vừa bị xoá về câu giữ chỗ (`4197dfd2`).
- **Sạn nhỏ khác** (`d4e04713`–`9c334602`): thẻ số liệu bố cục theo nội dung — pill tự xuống dòng khi
  hết chỗ, cỡ con số co theo bề ngang thẻ (`cqi`, trần 30px) nên số tiền 6–7 chữ số và pill % lớn
  không bị cắt; hàng 3 thẻ về 1 cột ở điện thoại như trước nhánh. Trang chi tiết enquiry thôi kéo
  `motion` (~47 KB gzip). Hộp Reject giữ trần 64rem nhưng luôn chừa lề. Một kit `TableThumb` cho
  bảng Tours và Posts. Bốn chỗ quản lý ảnh dùng `SafeImg`.
- **Năm việc nhỏ sau hai reviewer** (`38c19d53`–`9a236ed5`): yêu cầu Quick Create ghi lúc điều hướng
  bắt đầu, sống 60 giây (API gói free ngủ dậy chậm); xoá trúng hàng người khác vừa xoá thì focus về
  nút Add; chạm nhiều lần nút khoá chỉ một toast; ô chọn không in UUID thô sau `LINK_NOT_FOUND`; một
  helper int `trackOpenTransactions`.
- **Doc:** spec ghi lại mọi chỗ đổi thiết kế (`72c612a7`, `0bf28d05`, `c3df5d73`);
  `open-items` thêm năm việc chờ quyết, lượt thử màn cảm ứng, nợ G24 (bốn bảng còn dựng lại ô) và
  G25 (`64a5cb8c`).

**CÒN TREO**

- Năm việc chờ user quyết, chép sang `docs/open-items.md` mục "Đang chờ chủ dự án quyết": bảng Outbox ở
  1440px còn cuộn khi trang có nhãn Attempts dài (Ruling F-b); câu "… — hide it instead." đọc lệch ở
  hàng đã ẩn; ô "Photo unavailable" nhỏ trong dialog chi tiết review; secret revalidate dev trong
  `.env.example` của web (Ruling F-d — user soát env Vercel, đảm bảo `REVALIDATE_SECRET` không phải giá
  trị mẫu); ADR-0052 §2 còn ghi "Owner-only (14)".
- Nợ mới: G24 (bốn bảng admin còn dựng lại ô sau mỗi lượt làm mới) và G25 (khoá ngoại điểm đến
  `CASCADE`).
- Thử tay trên production sau merge, từng bước theo spec §5, chờ Render live trước. Thêm các điểm
  review nêu: gõ chữ trên ô Picker đang đóng; thẻ số liệu ở `/` và `/bookings` lúc 1440px (con số
  còn khoảng 28px thay 30px) và 375px; popup lọc của thẻ biểu đồ (khe phải) tự lật canh; hai tab —
  xoá điểm đến ở tab này rồi lưu tab Details ở tab kia; form đang sửa dở rồi Quick Create; chạm nút
  Delete đang khoá trên máy cảm ứng thật. Xoá điểm đến thử `abc` bằng nút Delete mới.
- Không migration, không env, không webhook. Push đụng cả API lẫn web: canh trạng thái deploy Render
  (G23), không chỉ health.

Tests after (`gate:int` trên `238fdc2f`, 07/10 14:59–15:04): unit 5680 — admin 1896, web 1671, api
1080, contract 665, mobile 159, mobile-ui 86, core 46, ui 36, i18n 22, tokens 19 — và int 771/771 ở
46 file. So với `main` `197fe31d`: admin thêm 178, contract 9, api 12, ui 9, i18n 4, tokens 1, web 1;
int thêm 18.

## 2026-10-06 — P7 Phần A: My bookings lọc, tìm và phân trang theo hành trình (merge hai nhịp, nhánh `feat/booking-pages-redesign`)

Trang `/account/bookings` có hàng tìm và lọc (When · Status, chọn nhiều, số đếm tĩnh), 10 đơn
mỗi trang xếp theo hành trình — đang đi, sắp đi, đã qua — và phân trang "Previous / Next";
hero có nút tròn quay lại Passport. Quyết định ở ADR-0054 (Accepted 06/10), hợp đồng ở spec
05/10 (§2.1, §2.7, §3, §4, §7). Không migration, không env.

Contract và API: `bookingPhase`, `bookingWhen`, `calendarDaysBetween`, `tripDayNumbers` và
`ACTIVE_BOOKING_STATUSES` dùng chung cho API và web (`booking-phase.ts`); đơn REFUNDED còn
ngày đi tương lai thôi lọt vào nhóm sắp đi, đơn chờ trả quá hạn chót là `lapsed`. `bookings.mine`
nhận `when` (mảng), `status` (một giá trị hoặc mảng), `q`, `order` (`recent` mặc định,
`journey`), trả thêm `facets` (đếm trên mọi đơn, bỏ qua bộ lọc), `overallTotal` và `today`.
Service đọc tập khoá nhẹ của mọi đơn, lọc, tìm, xếp và cắt trang bằng hàm thuần
`selectBookingsPage`, rồi mới nạp đủ dòng cho các id của trang (rào `userId` ở cả hai câu đọc,
giữ thứ tự hàm thuần trả). Tìm bỏ dấu, hạ chữ thường và bỏ mọi ký tự không phải chữ hoặc số ở
cả hai phía ("ha noi" khớp "Hà Nội"). Int test xác nhận oRPC dựng đúng mảng từ ký pháp ngoặc
`when[0]=…` trên query GET; `status=PAID` kiểu cũ vẫn nhận.

Web: `ContentHero.back` (nút tròn trước breadcrumb); `lib/bookings-list.ts` đọc và dựng URL
`?q=…&when=…&status=…&page=…`, dịch sang input API, dựng `pagerView`; `fetchMyBookingsPage`;
`FacetFilter` và `BookingsToolbar` (debounce 300 ms, Enter áp ngay, `sentQ` không đè chữ đang
gõ, `useOptimistic`, `router.replace` đưa page về 1, tiêu điểm về ô tìm sau ✕ và Reset);
`TripPager`; `BookingsListView` (trống, đếm, rỗng do lọc, `key` theo URL để hàng đầu mỗi
trang mở sẵn); trang chuyển về trang cuối khi `page` vượt số trang. `BookingAccordion` đọc
`bookingPhase` trên `today` của API cho dòng phụ, Pay now và Review — đơn `lapsed` mang nhãn
"Payment not completed", PARTIALLY_REFUNDED có "In N days" và "Ends …", ô tổng ghi "Total" khi
chưa trả. Hàm dùng chung cho Phần B và C: `bookingPriceLines`, `formatBookingMoney`,
`bookingTotalLabel`, `paymentProviderLabel` (biên nhận và trang chi tiết dùng ngay, bỏ hai bảng
`PROVIDER_LABEL`). Gỡ "Load more", `groupBookingsByTime`, `daysUntilDeparture`,
`BOOKINGS_PAGE_SIZE`, `accountBookings.loadMore`, `passportBookings.back`,
`passportVisa.labels.total`.

Soi bố cục (Task A11, DOM thật cộng CSS build thật, Browser pane): ở 1280px mọi mốc đạt ngay —
nút quay lại 34×34 thẳng tâm breadcrumb, ô tìm 290×36, hai nút lọc 176×36 cùng hàng kể cả khi
mang "Upcoming" và "2 selected", Reset cao 36, phân trang ba phần thẳng hàng. Ở 375px lần đầu
TRƯỢT: trang tràn ngang 391px vì `AccordionTrigger` (flex item `flex-1`) thiếu `min-w-0`, tên
tour dài vô hiệu hoá `truncate` — lỗi có sẵn của accordion cũ. Sửa bằng `min-w-0` trong
`BookingAccordion` (commit `fix`), đo lại: không tràn, ô tìm chiếm cả hàng, hai nút lọc chia
đôi hàng hai, Reset chỉ còn icon (38px), dòng "Page … of …" lên trên hai link. Ở 375px chip giá
trị trong nút lọc bị cắt ("Up…", "2 s…") — `truncate` đúng thiết kế, tên đọc vẫn đủ.

Lệch plan lúc thi công: (1) chú thích trên `accountBookings` plan ghi chữ `loadMore` làm phép
grep kiểm (phải rỗng) ra một dòng — đổi thành "Nút "Load more" cũ đã gỡ", vẫn bốn dòng nên
`travellers` giữ dòng 2433 (user chọn 06/10); (2) bộ lọc "chờ lượt nặng" của gate cô lập loại
`next dev` và `start-server.js` — session admin mở `next dev -p 3002` để thử tay, chạy lâu dài;
(3) lệnh thêm import `paymentProviderLabel` đẩy dòng 13 và 27–29 của `booking-receipt.tsx`
xuống một dòng — số dòng trích trong prompt B và C cần cập nhật; (4) đột biến `/^\d{1,5}$/`
thành `/^\d+$/` sống — trần `PAGE_MAX` đã chặn 10001 ở bước sau.

**Review findings** (max effort: 10 góc, kiểm chứng từng ứng viên, một lượt rà sót) — 15 phát
hiện, vá cả 15 trên nhánh:

1. Dòng tiền làm tròn riêng từng dòng nên với đơn giá có xu (giá khuyến mãi của seed) cộng không
   ra tổng: BK-LRYP3PBP in "$90 + $90", Total "$181", Stripe thu $180.96. `formatBookingMoney`
   định dạng theo cả đơn: đơn giá có xu thì đơn giá, dòng và tổng đều đủ hai số lẻ.
2. Push hai nhịp như plan làm CI `main` đỏ ở nhịp 1 (`docs-freshness`: entry CHANGELOG chỉ nằm
   ở commit cuối). Entry này xếp ngay sau commit API để đi cùng nhịp 1.
3. Đơn chờ trả còn sống qua hạn chót (PayPal tạo lúc 23:30 ngày hạn chót) vẫn được xếp Upcoming
   và mời Pay now, mà re-checkout từ chối. `lapsed` nay tính từ `cancellationDeadline`
   (ADR-0054 §1 sửa trước), nhãn "Payment not completed".
4. Gõ tìm rồi bấm Back trong 300 ms: hẹn giờ cũ `router.replace` đè lên mục lịch sử vừa về. Lượt
   tìm còn chờ bị huỷ khi `params.q` đổi từ ngoài và ngay ở `popstate`.
5. Danh sách và trang chi tiết nói khác nhau về cùng một đơn: trang chi tiết ghi "Total paid" cho
   đơn chưa từng trả và bày Pay now cho đơn `lapsed`. Một luật `bookingTotalLabel` cho ba nơi.
6. Vế PAID của `canReview` không test nào giữ — thêm ca PARTIALLY_REFUNDED đã đi.
7. Phiên hết hạn thì đăng nhập xong mất bộ lọc — `requireSession` nhận URL đang lọc.
8. API và web mỗi bên tự đọc "hôm nay": sát 00:00 giờ Việt Nam hàng nằm trong bộ lọc Upcoming mà
   ghi "Ends …". Kết quả `bookings.mine` mang `today`; int test giả Date ghim mốc giờ Việt Nam.
9. `mine` thành 9 câu SQL nối đuôi (trước 5 đợt), kể cả Passport. Chỉ kéo tên điểm đến khi có từ
   khoá, lô ảnh bìa chạy song song câu thứ hai.
10. Menu lọc là `role="dialog"` không tên — mang tên của nút lọc.
11. Bấm Next tới trang cuối thì tiêu điểm rơi về `<body>` — nay về dòng đếm ở đầu trang mới.
12. Lựa chọn 0 đơn vẫn tích được (chắc chắn "No trips match") — khoá như bộ lọc `/tours`.
13. "Older trips" ngược nghĩa ở đoạn chuyến sắp đi (xếp gần tới xa) — đổi sang "Previous / Next"
    (user chốt).
14. Reset của "No trips match" là link thường: tải lại trang, thêm mục lịch sử — nay
    `router.replace` như Reset của hàng lọc.
15. JSDoc khai "một nguồn" khi trang chi tiết còn bảng `PROVIDER_LABEL` riêng — trang chi tiết
    dùng `paymentProviderLabel`.

Ngoài phạm vi, tách việc riêng: wizard đặt tour cùng họ lỗi làm tròn (nút "Pay $181" khi cổng
thu $180.96).

Tests after: Vitest **5466** (web 1670, api 1068, admin 1718, contract 656, core 46, ui 27,
tokens 18, i18n 18, mobile 159, mobile-ui 86), int **753 ở 46 file**. Đợt thi công thêm
contract 40, api 29 và 5 int, web 74, gỡ 16 ca của `account-stats.spec.ts`; đột biến 93 lần thử,
87 bị giết (sáu cái sống có lý do, gồm vế PAID của `canReview` — đã thêm ca ở vòng vá). Vòng vá
thêm 24 ca (contract 5, web 18, int 1); mười đột biến, giết cả mười.

CÒN TREO: không có việc hạ tầng (không migration, không env, không webhook). Đã push hai nhịp
ngày 06/10: nhịp 1 `804365d1` (contract, API và entry này — CI xanh, Render live), rồi nhịp 2
`8b813bfd` (web).
