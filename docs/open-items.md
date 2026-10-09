# Việc còn treo

> Bản tóm tắt để điều hướng, cập nhật 28/09/2026. **Không phải nguồn sự thật** —
> chi tiết của từng mục sống ở [CHANGELOG](CHANGELOG.md) (mục "CÒN TREO" của
> entry tương ứng) và ở [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md).
> Trả xong một mục thì gạch ở đây và ghi vào CHANGELOG.

## Mốc thời gian

| Ngày | Việc |
| --- | --- |
| **15/10/2026** | **Freeze**: ngừng nâng cấp thư viện, ngừng đổi nơi deploy |
| ~03/11/2026 | Seed lại dữ liệu prod lượt 2 (ADR-0041 Phụ lục B Bước 8) — xem [việc phải xong trước lượt này](#trước-lượt-seed-lại-0311) |
| ~11/11/2026 | Bảo vệ đồ án |

## Phần chưa xây

| Mã | Việc | Ghi chú |
| --- | --- | --- |
| **P4e** | Quản trị catalog: thêm/sửa/xoá tour, điểm đến, danh mục | P4e-1 XONG 22/09 (F11 danh sách tour · F12 lịch chạy · F13 huỷ chuyến có hoàn tiền, đóng nợ ADR-0041 §6). **P4e-2 XONG**: F14 danh mục 22/09 (màn `/categories` cộng chip lọc của web đọc endpoint) và F15 điểm đến 24/09 (màn `/destinations`, ba vùng về contract, web chịu được điểm đến đã ẩn). **P4e-3a** (F17 tạo và sửa tour) XONG: merge 28/09 sau vòng review (24 lỗi thật, vá cả 24 — lỗi seed vá ở nhánh riêng cùng ngày). **P4e-3b** (F18 ảnh tour) XONG: merge 29/09 sau vòng review (15 phát hiện, vá cả 15). **P4e-3c** (F19 khu sửa tour dạng thanh bước) XONG: merge 01/10 sau vòng review (15 phát hiện, vá cả 15). **P4e-4** (F20 bài viết) XONG: merge 05/10 sau vòng review (15 phát hiện cộng 8 mục nhỏ, vá cả 23; thêm cột `post_tag_links.order`). Còn **P4f** (media, users) |
| **P4f** | Quản trị người dùng và media | **Users**: ADR-0052 và spec 02/10 — Owner (chỉ từ `ADMIN_EMAILS`) cấp Staff cho khách đã xác minh, bảng quyền ở contract, khoá tài khoản, đăng xuất mọi nơi, lịch sử theo người dùng; plan 02/10 (14 task, kèm prompt thi công); P4e-4 đã merge 05/10 nên sẵn sàng thi công. Phủ ba bất biến hạ quyền / thu hồi phiên của ADR-0026 AMEND 1 §D. **Media library**, **Appearance** và G16 chưa thuộc spec nào |
| **P5b-2…5** | Bốn cụm màn mobile: xem tour · đặt tour · tài khoản · đánh giá | **P5b-2 xem tour và P5b-4 tài khoản XONG**: merge 09/10 qua nhánh `feat/mobile-account-screens` (review 05/10 có 24 phát hiện, vá 23, Q4 là nợ lịch sử; review cuối 09/10). Ba commit riêng của nhánh `feat/mobile-browse-screens` (tìm không dấu, D6 return-to, một commit thử) chưa vào main — nhóm quyết port hay bỏ. **P5b-3 đặt tour** và **P5b-5 đánh giá** đang review trên nhánh riêng, xếp chồng lên account nên phải rebase lên main. Bản vẽ và tài liệu bàn giao ở [`handoff/`](handoff/README.md) |
| **P6** | Trợ lý AI tư vấn tour | Có ADR-0050 và spec (29/09), chưa thi công — mở sau khi admin xong. Thư viện `ai`, `@ai-sdk/anthropic`, `@ai-sdk/react` đã ghim 29/09 (`3f646ace`, spec §7 bước 1). Bảng dữ liệu đã có sẵn (`chat_conversations`, `chat_messages`) |
| **P7** | Đợt trau chuốt giao diện cuối | Ba trang đơn của khách (ADR-0054, spec và plan 05/10, 26 task chia ba phần): **Phần A XONG** 06/10 — My bookings lọc, tìm, 10 đơn mỗi trang theo hành trình, phân trang "Previous / Next" (review 15 phát hiện, vá cả 15). Phần B (chi tiết đơn) và C (voucher) chờ thi công |

## Trước lượt seed lại 03/11

- **Ngay trước khi chạy seed:** gỡ bán hoặc xoá các tour thử tạo bằng F17 —
  `seed:verify` bắt "tour đang bán không có rating". Đo 01/10: còn đúng một tour
  như vậy, `test-01` (tạo 01/10 bằng tài khoản admin, đang bán, một chuyến giá
  $2.00, một booking đã huỷ và hoàn đủ). Có booking nên chưa xoá được; `data:reset`
  giữ bảng `tours`, nên SAU lượt seed tour này hết booking và xoá được qua admin.
- Lượt ấy ghi đè TRỌN nội dung 29 tour seed về fixture: cột của `tours` và năm
  bảng con (điểm đến, lịch trình, FAQ, chính sách, dòng chi phí), cùng giá vốn.
  Tour tạo tay còn sống, chỉ mất chuyến, booking, đánh giá. Vá 28/09 ở vòng
  review F17 — trước đó seed chèn lại bảng con CẠNH bản admin nên FAQ, chính
  sách, dòng chi phí nhân đôi; `seed:verify` nay có năm bất biến canh đúng dấu
  vết ấy.

## Đang chờ chủ dự án quyết

| Việc | Nêu ngày | Tình trạng |
| --- | --- | --- |
| Cho KHÁCH đọc được lý do công ty huỷ chuyến | 22/09 | Chưa quyết — xem mục ngay dưới |
| Tự đăng nhập sau khi xác minh OTP | 18/09 | Đã chốt **không làm** (21/09), lý do ghi trong mã nguồn |
| Gỡ nhánh tinh chỉnh giao diện web + admin gom 18/09 | 18/09 | Chưa mở |

## Đề xuất sản phẩm: cho khách biết VÌ SAO chuyến bị huỷ

Nêu 22/09 sau lượt chạy thử tay F13 trên production. Khi công ty huỷ chuyến,
admin bắt buộc phải gõ lý do và lý do ấy được lưu vào `cancellation_requests`
của TỪNG booking — nhưng hiện **chỉ admin đọc được**: email báo huỷ không mang
nó, và trang booking phía khách không hiện nó ở đâu.

Khách bị huỷ chuyến nhận một email nói "đã huỷ và hoàn tiền" mà không biết vì
sao. Với một chuyến bị bỏ vì hướng dẫn viên ốm hay vì bão, câu giải thích là
thứ khác biệt giữa một khách hiểu chuyện và một khách mất lòng tin.

Làm thì phải đụng ba chỗ: thêm `reason` vào payload outbox `BOOKING_CANCELLED`,
thêm một khối vào template email, và hiện nó trên trang booking của khách. Kèm
một quyết định về copy: lý do admin gõ là câu NỘI BỘ ("guide bỏ việc"), nên
hoặc ô nhập phải đổi giọng thành câu-cho-khách-đọc, hoặc cần hai ô.

Trong lúc chưa quyết, câu nhắc ở màn admin đã sửa cho nói đúng sự thật (nó là
ghi chép nội bộ) — trước đó nó hứa nhầm rằng khách sẽ đọc được.

## Web: trang đơn chưa biết chuyến đã bị công ty huỷ

Nêu 08/10 cùng bản vá ADR-0041 AMEND 1. API đã đóng đường khách tự huỷ khi chuyến
`CANCELLED` (`bookings.byCode.cancellation` là `null`, lệnh huỷ trả 422), nhưng
trong khoảng chờ job `departure-refund` (thường dưới 15 phút, lâu hơn nếu cổng
thanh toán lỗi) booking vẫn `PAID`. Trang chi tiết đơn và voucher vì vậy hiện như
một chuyến còn chạy — voucher, hoá đơn, đếm ngược — không chữ nào nói chuyến đã bị
huỷ và tiền đang hoàn.

Làm: thêm một trường vào `BookingDetail` (chuyến đã bị công ty huỷ, kèm mốc), rồi
một khối báo trên trang chi tiết và trang voucher, ẩn hoặc đánh dấu voucher. Đụng
thẳng file của nhánh P7 B (`feat/booking-pages-redesign`) và P7 C
(`feat/booking-voucher`), nên làm SAU khi hai nhánh ấy merge; gộp được với đề xuất
"cho khách biết vì sao" ở trên, cùng một khối báo. Lưu ý cho P7 B:
`booking-journey.ts` tự so ngày khi `cancellation` là `null`, nên đơn `PAID` trên
chuyến đã huỷ sẽ có bước "Free cancellation" tính theo ngày.

## Cần thử lại bằng máy thật

- **Lệnh chạy app điện thoại đổi sang LAN** (21/09, ADR-0040 AMEND 2):
  `pnpm --filter @tourism/mobile dev` nay là `expo start` thay vì
  `--tunnel`. Chưa ai quét QR thử sau khi đổi — cần một lượt trên điện thoại
  thật cùng mạng Wi-Fi. Không chạy được thì `dev:tunnel` vẫn còn nguyên.
- **Admin trên màn cảm ứng** (vòng vá review đợt sửa sạn admin, 07/10): chạm nút Delete đang
  khoá phải hiện toast lý do. Test chỉ giả lập `pointerType: touch` trong jsdom; thử tay 07/10 đạt
  trên DevTools mô phỏng iPhone 16 Pro Max (một toast, chạm lại không chồng) — còn máy thật.
- **Màn tài khoản mobile (P5b-4, merge 09/10)** — kịch bản từng bước ở mục 8
  của [tóm tắt nhánh](analysis/2026-10-06-branch-summary-mobile-account-screens.md).
  Ưu tiên ba bản vá chỉ kiểm được trên máy: F2 (Android: pinch, chạm đúp, vuốt
  đóng trình xem ảnh), F3 (iOS: bàn phím không che ô nhập trong tấm sửa tên, xoá
  tài khoản, hỏi ngày), F7 (iOS và Android ≤ 12: từ chối quyền ảnh vẫn mở được
  thư viện). Cơ chế quay lại sau đăng nhập: bấm tim khi chưa đăng nhập ở tour
  detail hoặc Explore, đăng nhập xong PHẢI về đúng chỗ và tim đã đặc; đóng Sign
  in bằng X, back cứng Android hay vuốt iOS rồi đăng nhập từ chỗ khác thì KHÔNG
  được dạt về tour cũ. Máy AI không có thiết bị thật.

## Việc tay trên hạ tầng

- **Render: thêm `nexora://` vào `TRUSTED_ORIGINS`** (P5b-4 merge 09/10, ADR-0017
  §10) — chờ user duyệt. Không thêm `exp://`: đó là origin của Expo Go ở máy dev,
  production chặn nó ở `parseEnv`. Chưa thêm thì app bản build bị 403 khi gọi
  auth; web không ảnh hưởng.
- Theo dõi bộ dọn ảnh vừa bật 29/09: lượt 04:00 UTC ngày 30/09 phải ghi "Dọn media: 0
  xoá khỏi CDN, …" trong log Render. Lượt đầu có xoá thật (khoảng 01/10 ảnh review mồ côi,
  khoảng 07/10 ảnh tour thử) thì đối chiếu: `destroyed = 0` mà `absent` bằng tất cả là
  publicId đang ghi sai dạng (lời dặn trong `media-garbage.service.ts`).
- Tám file của tour thử F18 ở thư mục Cloudinary `tourism/tours/4371eb10-…`: user xoá tay
  được ngay; không thì bộ dọn xoá khoảng 07/10.
- Đối chiếu khoản hoàn `re_3UHzrvK1oRTwa7qk1hs4Rxnw` trên dashboard Stripe test
  mode (phiên kết nối đã hết hạn lúc nghiệm thu 21/09; mã do chính Stripe trả về
  nên khoản hoàn chắc chắn đã phát).
- Kiểm nút Export trên production sau lần deploy gần nhất.
- Xoá cơ sở dữ liệu Docker `tourism_ui` khi nghiệm thu xong; seed lại DB Docker
  `tourism` theo mã mới.
- Tắt tự-động-cập-nhật marketplace `claude-plugins-official` trước freeze 15/10.
- Cân nhắc siết thêm Build Filter của Render: thêm `apps/web/**`,
  `apps/admin/**`, `apps/mobile/**` vào Ignored Paths. **Đừng thêm `libs/**`** —
  máy chủ ăn `@tourism/contract` và `@tourism/core`.

## Con số đã biết, không phải lỗi mới

- `seed:verify` trên prod báo **2** ở mục "refund không có đúng một payment
  event hoàn": hai khoản hoàn cũ (trước ADR-0043) cố ý không backfill, vì lượt
  seed 03/11 sẽ xoá sạch.
- Lint còn đúng **1 warning và 1 info** có từ trước.
- `seed:verify` ở DB local mới seed (chưa chạy `media:upload`) in cảnh báo "DB chưa
  có ảnh tour nào": seed không ghi `media_assets`, nên theo readiness của F18 cả 29
  tour đang bán đều thiếu ảnh bìa. Ở DB ấy, lưu Details hay Itinerary của tour đang
  bán bị 409 `TOUR_NOT_READY` — chạy `media:upload`, hoặc tắt bán tour cần thử.
  Prod không dính: đo 29/09, 29/29 tour đang bán có ảnh bìa.

## Advisory sẽ thành alert, đã soát là không với tới

Soát 08/10 ở repo gốc của từng gói (đợt vá Dependabot, CHANGELOG cùng ngày). Các
advisory dưới đây chưa vào DB chung của GitHub nên Dependabot và `pnpm audit` chưa
thấy. Lúc chúng vào DB thì có thể đã qua freeze 15/10: đọc lý do ở đây, dismiss alert
`tolerable_risk`, thêm GHSA vào `auditConfig.ignoreGhsas` của `pnpm-workspace.yaml`.

- **better-auth 1.6.23**, bản vá chỉ có ở dòng 1.7: GHSA-965c-763c-88jm (critical, cần
  plugin Magic Link), GHSA-r4xp-prcw-77qf (high, cần plugin OAuth Proxy),
  GHSA-q84f-53jg-9ppm (high, cần plugin `deviceAuthorization`) và GHSA-44jh-23m7-hpcf
  (low, cần adapter Drizzle hoặc Kysely với rate limit lưu trong DB). API chỉ bật
  `emailOTP` và Google, rate limit của Better Auth lưu trong RAM.
- **@orpc/client, @orpc/server 1.14.15**: GHSA-4p2c-m292-ghmh (high, vá ở 1.15.2) chỉ dính
  `RPCHandler`; API phục vụ bằng OpenAPI qua `@orpc/nest`, web và admin dùng
  `OpenAPILink`.
- **@nestjs/microservices**: GHSA-m8vh-jmq9-5rjg và GHSA-96h4-vgxj-gvm2 — gói không có
  trong cây.

## Bug tiềm ẩn: `pending-sweep.service.ts` so sánh timestamp phụ thuộc timezone server

Phát hiện 25/09 khi chạy `pnpm gate:int` trên máy Windows native (Postgres
service cài native, timezone hệ điều hành `Asia/Bangkok`) trong lúc soát nhánh
`feat/mobile-browse-screens` — KHÔNG liên quan code nhánh đó, bug có sẵn từ
trước, chỉ bị máy này làm lộ.

[`pending-sweep.service.ts`](../apps/api/src/worker/pending-sweep.service.ts)
so `checkout_session_expires_at < now()` bằng raw SQL. Mọi cột `DateTime`
trong `schema.prisma` là `timestamp without time zone` (mặc định Prisma, không
`@db.Timestamptz` chỗ nào). `now()` trả `timestamptz`; Postgres ép cột naive
sang `timestamptz` theo **session timezone**, không phải UTC. Trên máy có
session timezone khác UTC, một hạn session còn tương lai bị đọc thành "đã hết
hạn" (đo được: lệch đúng bằng offset múi giờ).

**Vì sao chưa ai gặp:** production (Supabase) và Docker Postgres mặc định UTC
nên bug im lặng ở mọi nơi đã biết — chỉ lộ ra vì máy này cài Postgres native
theo múi giờ hệ điều hành.

**Vì sao vẫn phải vá:** worker này chạy CRON thật ở production (pg-boss, ADR-
0006), không chỉ trong test. Bất kỳ lúc nào server Postgres đổi timezone khác
UTC (đổi hạ tầng, admin sửa `postgresql.conf`, máy dev khác cài native) — logic
"session re-mint còn sống thì đừng huỷ" (ADR-0006 AMEND 1c) vô hiệu âm thầm:
khách đang gõ thẻ trên session còn sống bị huỷ oan booking.

Vá đúng: ép UTC tường minh trong SQL
(`checkout_session_expires_at AT TIME ZONE 'UTC' < now()`) hoặc đổi cột thời
gian sang `@db.Timestamptz` trong schema. Repro: `int-full-3.log` gồm 2 test
`pending-sweep.int.spec.ts` (AMEND 1c, AMEND 2d) fail đơn định trên máy
timezone khác UTC — chạy cô lập cũng fail, không phải do đụng độ file khác.

Chưa vá — ngoài phạm vi nhánh `feat/mobile-browse-screens` (luật 1 CLAUDE.md).
Cần mở nhánh `fix/` riêng khi có người rảnh tay.

## Nợ nhỏ phát sinh từ P5b-4 (nhánh `feat/mobile-account-screens`)

Phát hiện 25/09 ở final review của plan return-to-auth (SDD, xem
[ledger](../.superpowers/sdd/2026-09-25-mobile-account-return-to-auth/progress.md)
nếu còn — file này bị xoá sau khi merge). Không chặn merge, ghi lại để không quên:

1. **Đã sửa (`bd4ae138`, merge 09/10).** **Explore-tab wishlist gate chưa gọi `setPendingReturn`** — chỉ tour-detail
   (`[slug].tsx`) và các khối chặn tab tương lai (Saved/Account, V1 spec P5b-4)
   mới nhớ đường quay lại; bấm tim ở thẻ tour trên Explore rồi đăng nhập xong
   thì về Home, không về đúng Explore. Spec §1b bỏ sót nơi này.
2. **Đã sửa (`bd4ae138`, merge 09/10).** **`login.tsx`'s `onClose` (nút X) luôn về Home** — kể cả khi mở từ một tour
   cụ thể. Giờ đã có hạ tầng return-to (P5b-4), sửa để về đúng tour là việc
   nhỏ nhưng chưa làm (ngoài phạm vi plan return-to-auth, plan đó chỉ gọi
   `clearPendingReturn()` ở đây, không đổi đích).
3. **`router.replace` khi quay lại tour đã mount sẵn dưới modal login** —
   Expo Router giữ màn tour-detail mount nguyên dưới modal `(auth)`, nên
   `replace` có thể đẩy thêm một bản sao vào stack thay vì đóng modal về đúng
   màn đang có sẵn. Đổi sang `router.back()`/dismiss khi đích trùng màn đã mở
   là sửa đúng hơn nhưng cần test tay trên máy thật (xem mục "Cần thử lại
   bằng máy thật" phía trên) trước khi đổi — rủi ro đổi sai điều hướng cao
   hơn lợi ích nếu không kiểm chứng được trên thiết bị thật. Còn mở 09/10: nút X
   đã dùng `dismissTo`, nhưng nhánh đăng nhập/đăng ký thành công vẫn `replace`.
4. **Rủi ro còn lại của proxy đăng nhập Google (ADR-0017 §11)** — URL hợp lệ vẫn
   mang `state` do người gọi chọn, và sau callback OAuth plugin `expo()` gắn cookie
   phiên vào deep link `nexora://` (`@better-auth/expo` 1.6.23, `dist/index.js:81`).
   Một app khác giành scheme `nexora` trên máy nạn nhân có thể nhận phiên. Production
   thiếu cặp env Google nên proxy chặn hết: **giữ Google tắt trên Render** tới khi
   đổi cơ chế state (sau v1). Nâng `@better-auth/expo` thì đọc lại endpoint và hook
   này trước.
5. **N7–N10 mức thấp còn mở** — bảng ở mục 7 của tóm tắt nhánh: bấm đúp nút chọn
   ảnh, lỗi form đổi mật khẩu không tự xoá, Saved đếm "100 tours" trước khi tải đủ
   trang, ba chỗ a11y.

## Nợ kỹ thuật chi tiết

Sáu nhóm (giao diện · dữ liệu · kiểm thử · thư viện bên thứ ba · nợ cũ · nợ sau
deploy) nằm ở [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md) —
**đọc trước khi mở một cụm việc mới**. Vài mục còn mở đáng chú ý:

| Mã | Nợ |
| --- | --- |
| A5 | Con dấu tem thư `/contact` còn ghi "Hà Nội · Sa Pa" trong khi văn phòng Sa Pa đã xoá |
| A16 | 7 icon mạng xã hội trỏ `#top` — chốt giữ nguyên tới khi có tài khoản thật |
| D1 | `input-otp@1.4.2` rò rỉ timer, mới chỉ giảm thiểu |
| E6 | Xác thực hai lớp — đã quyết định gác lại |
| F1 | Webhook Resend (`delivered`/`bounced`/`complained`) — hiện `SENT` chỉ nghĩa là Resend đã nhận |
| G1 | `admin.categories.move` trả CẢ danh sách đã sắp lại, mà client vứt đi rồi `router.refresh()`. Giữ nguyên có chủ đích ở vòng review F14: tiêu thụ payload ấy cần đưa `rows` vào state của bảng, tức hai nguồn sự thật cho một bảng sáu hàng. Cái giá hiện tại là MỘT truy vấn `list()` thừa mỗi cú bấm mũi tên |
| G2 | 23 bản chép của `sessionCookie` trong `apps/api/src/**/*.int.spec.ts` — ngưỡng rút chung đã vượt từ lâu, nhưng nó không thuộc phạm vi một cụm tính năng nào. Better-auth đổi tên cookie là 23 chỗ phải sửa |
| G3 | Rút chung ở F15, còn thiếu một bản: `toContractError` (`apps/api/src/lib/contract-error.ts`) và `hasFormErrors` (`apps/admin/src/lib/form-errors.ts`) nay nuôi danh mục lẫn điểm đến, nhưng `admin-departures.controller.ts` và `departures-write.ts` vẫn giữ bản riêng — code departures của F16 nằm ngoài phạm vi F15. Vòng review F15 đã cho `mapError` của chuyến dùng `declaredError` chung (Proxy của oRPC); đổi hai bản ấy sang hẳn là đóng G3 |
| G6 | Nút mở hộp thoại còn khoá bằng `disabled` thật khi bảng làm mới ở: hàng chuyến (`departure-row-actions.tsx`), `bookings/refund-panel.tsx`, `outbox/retry-action.tsx`, `reviews/moderate-actions.tsx`, `subscribers/unsubscribe-action.tsx`. Hộp đóng đúng lúc làm mới thì Base UI không trả focus về nút `disabled` được, và focus bàn phím rơi về `<body>`. Vòng review F15 vá danh mục, điểm đến và nút Add của màn chuyến bằng `focusableWhenDisabled`; áp cùng khuôn cho năm chỗ này là đóng |
| G7 | Khu làm việc tour (F17): nút Back của trình duyệt không hỏi lại khi form còn thay đổi chưa lưu — chỉ link trong app và `beforeunload` được canh |
| ~~G8~~ | ~~Tạo chuyến và hạ số khách tối đa của tour chạy cùng lúc có thể để lại một chuyến nhiều ghế hơn số khách tối đa.~~ Đã vá ở vòng review F17 (28/09): tạo và sửa chuyến giữ hàng tour bằng `FOR SHARE` |
| ~~G9~~ | ~~Sửa hay xoá tour chỉ bust `tours` và `tour:<slug>`, không bust `post:<slug>` của bài viết nhúng thẻ tour.~~ Chuyển vào phạm vi P4e-4 (29/09): hôm nay chưa có triệu chứng — `toJournalPostDetail` bỏ `relatedTours` nên web chưa hiện tour gắn trong bài, không seed hay màn nào tạo `PostTour`, menu Posts của admin còn tắt. Spec P4e-4 phải chọn một: tra `PostTour` TRƯỚC khi xoá tour (xoá tour cascade mất liên kết) rồi bust `post:<slug>`, hoặc cho trang bài viết mang thêm tag `tours`. ĐÓNG ở P4e-4 (merge 05/10): trang bài viết mang thêm tag `tours`. |
| ~~G10~~ | ~~Web lấy danh sách tour bằng MỘT trang `limit: 50` — quá 50 tour đang bán thì tour cũ nhất biến khỏi web.~~ Đóng 29/09 (nhánh `fix/web-tours-all-pages`): `fetchTours` đi hết các trang qua `collectAllPages`, trần 20 trang, chạm trần thì `console.warn` |
| ~~G11~~ | ~~Validator tab Details và Itinerary viết tay luật "tour đang bán thì luôn đủ" (tóm tắt, thêm ngày, tiêu đề ngày) thay vì suy từ `projectedReadiness`.~~ Đóng ở F18 (28/09): ba tab Details, Itinerary, Photos suy từ `onSaleShortfalls` |
| ~~G12~~ | ~~Metadata ảnh vừa tải (`TourPhotoUploadSchema`: `width`, `height`, `bytes`) dùng `z.int()` nên số vượt INT4 lọt qua schema và ra 500.~~ Đóng 29/09 (nhánh `fix/tour-photo-int32-image-filter`): `z.int32()`, request như vậy nay là 400 |
| ~~G13~~ | ~~Thư viện của tab Photos nhận cả dòng VIDEO của địa danh; câu `banners.notReady` đổ lỗi cho lần sửa cả khi chỗ thiếu có từ trước.~~ Đóng 29/09: phần thư viện ở nhánh `fix/tour-photo-int32-image-filter` (ADR-0048 AMEND 2), câu banner ở nhánh `fix/f18-thu-tay-gop-y` ("Saved like this, it would be missing:"). Còn một nhận xét không cần vá: ảnh của CHÍNH tour chưa lọc theo loại — prod 29/09 không có dòng VIDEO nào của tour, không đường nào tạo ra |
| G14 | Dọn code F18. **Đã làm 29/09** (nhánh `fix/f18-thu-tay-gop-y`): thanh tiến độ dùng `Progress` của `@tourism/ui`; helper URL Cloudinary gom về `apps/admin/src/lib/cloudinary-url.ts`; `hasTourCover` bỏ export, sửa JSDoc, `get` dùng `pickCover`. **Còn lại, cố ý để sau F19** vì F19 sửa đúng các file ấy: `ListEditor` nhận `add` và `emptyFocus` rời nhau thay vì một union; copy chép tay "JPG, PNG…", "10 MB", "30 photos" thay vì đọc hằng; fixture ảnh chép ở nhiều spec |
| G15 | Ký upload và tải lên có hai bản: `signPhotoUploads` chép đoạn ký và enqueue của `UploadSigningService` (không export khỏi `MediaModule`, hai lớp lỗi NotConfigured); `apps/admin/src/lib/photo-upload.ts` chép phần dựng form và khung XHR của `apps/web/src/lib/media-upload.ts`. Gom cần sửa cả `apps/web`. Một phần đóng ở P4e-4: phía API `signUploads` dùng chung cho tour và bài viết, một lớp `UploadsNotConfiguredError` cho cả ba nơi ký (vòng review); admin dùng chung `uploadPhoto`, hộp thư viện và một server action kho ảnh. Còn bản chép XHR giữa web và admin. |
| G16 | Hàng dọn media nhận mọi publicId: luật "không dọn ảnh thư viện hay catalog" nằm ở nơi gọi. Nên có một vị từ "publicId nằm trong vùng tải lên" để sweep từ chối destroy ảnh ngoài vùng ấy. Hôm nay chưa đường nào đưa chúng vào hàng; làm cùng P4f hoặc P4e-4. P4e-4: đường bài viết chỉ đưa ảnh trong thư mục tải lên của chính bài vào hàng dọn (vị từ ở nơi gọi). Vị từ chung cho bộ dọn vẫn để P4f. |
| G17 | Hiệu năng F18, đều nhỏ: mỗi nhịp tiến độ tải lên render lại cả form (vài ms mỗi lần); `setPhotos` requeue từng ảnh một trong transaction đang giữ khoá, và `get` hỏi thêm câu media nối tiếp (cộng lại khoảng 0,1–0,2 giây mỗi lần lưu, dưới timeout 5 giây). Chưa đáng sửa riêng |
| G18 | Bước Review (F19): vùng xoá tour đứng TRƯỚC công tắc On sale trong thứ tự tab, và dưới `xl` nằm giữa danh sách kiểm tra và card Visibility — việc chính của bước đến sau nút xoá. Vòng review F19 để lại vì là quyết định bố cục của spec §2d.6, không phải lỗi |
| G19 | `tourPageUrl` (`apps/admin/src/lib/site.ts`) cứng origin prod `www.nexora-travel.agency`: ở máy dev, "View on site" của tour bán trong DB local mở trang prod (404 hoặc tour khác cùng slug). Chú ý bẫy tên: `NEXT_PUBLIC_SITE_URL` của admin là origin CỦA admin, không phải của web |
| G20 | Icon cảnh báo `text-warning` trên nền card chỉ ~2:1 (dưới 3:1 của WCAG 1.4.11). Vòng review F19 đã cho dòng thiếu khác CHỮ dòng đủ nên màu không còn là tín hiệu duy nhất; đổi màu token là việc riêng của hệ màu |
| ~~G21~~ | ~~Báo cáo `/reports` với tháng ĐANG chạy ghi doanh thu của chuyến chưa kết thúc.~~ Đóng 01/10 (nhánh `fix/reports-recognised-to-date`, ADR-0033 AMEND 3): user chọn vá cách tính chứ không chỉ đổi chữ — cột kết quả kinh doanh chỉ ghi nhận chuyến đã kết thúc tới hôm nay (ngày UTC), tháng đang chạy in nhãn "(to date)", tháng tương lai rơi về tháng hiện tại |
| G22 | `data:reset` (`apps/api/scripts/reset-operational-data.mjs`) xoá `reviews` nhưng giữ nguyên `media_assets` (nằm trong `PHAI_CON`), nên dòng ảnh của review thành tham chiếu treo: bộ dọn media coi là còn dùng, hoãn mãi, file Cloudinary không bao giờ bị xoá. Đo 01/10: bốn ảnh như vậy của review thử bị bác trên `BK-5YU9J339`; user chốt xoá tay thư mục ấy trên Cloudinary. Vá trước lượt seed lại khoảng 03/11: xoá dòng `media_assets` của review và đưa publicId vào `media_garbage` |
| G23 | Render deploy API bằng cách chạy instance cũ và mới SONG SONG, còn Session pooler của Supabase chỉ cho 15 kết nối. 01/10 lượt deploy `7844478c` hỏng (`EMAXCONNSESSION`, lúc pg-boss của instance mới khởi động): build web của Vercel cùng lượt push đang prerender gọi dồn vào API cũ, đẩy pool của nó sát trần. Deploy lại tay lúc yên thì qua (3 kết nối). Hướng vá: hạ kích thước pool (Prisma qua adapter-pg và pg-boss) để hai instance cộng tải prerender vẫn dưới 15, hoặc nâng pool size của Supavisor. Chưa quyết; tới lúc đó, push nào đụng cả API lẫn web thì canh trạng thái deploy Render chứ không chỉ health. **08/10 tái phát theo chiều ngược** (push `9084a111`): deploy API vẫn lên live, nhưng build web của Vercel đỏ — instance API CŨ vừa thức (gói free ngủ) đúng lúc Render đang build bản mới, trả 500 `EMAXCONNSESSION` cho `/api/posts/<slug>` suốt khoảng 30 giây, sáu lượt retry của prerender hết trước khi pool nhả. Bấm Redeploy web lúc API đã thức thì qua. Nên canh cả status `Vercel – web` của commit, không chỉ Render |
| G24 | Bốn bảng admin còn để server action trong deps của cột: `tours/tours-table.tsx` (`setPublished`, ô `PublishToggle` có state riêng), `reviews/reviews-table.tsx` (`moderate`), `outbox/outbox-table.tsx` (`retry`), `subscribers/subscribers-table.tsx` (`unsubscribe`). Server action đổi danh tính mỗi lượt `router.refresh()`, cột dựng lại nên ô hành động bị dựng lại: focus rơi về `<body>`, hộp đang mở trong ô biến mất. Vòng vá review đợt sửa sạn admin (07/10) đã vá danh mục, điểm đến và chuyến bằng `RowActionsContext` cộng cột hằng module; áp cùng khuôn cho bốn bảng này là đóng |
| G25 | Khoá ngoại `tour_destinations.destination_id` vẫn `ON DELETE CASCADE` (ADR-0053, giới hạn 4): luật "đang có tour thì không xoá" chỉ sống ở lệnh xoá của API; xoá điểm đến bằng SQL tay, Prisma Studio hay script sẽ lặng lẽ gỡ nó khỏi mọi tour. Đổi sang `RESTRICT` như danh mục cần một migration — để sau capstone |
| ~~G26~~ | ~~Trang chi tiết tour giữ lề `px-12` (48px mỗi bên) ở MỌI khổ (`apps/web/src/app/(site)/tours/[slug]/page.tsx`, khung thân trang và "You might also like"): ở 375px nội dung chỉ còn 279px, thẻ đợt khởi hành còn 245px bề ngang chữ nên hạn huỷ và dòng phụ của tháng phải xuống dòng. Trang book và enquire cùng route dùng `px-4 md:px-8`. Sửa dưới `lg` thì desktop vẫn giữ 1056px nội dung đã duyệt. Đo 08/10 lúc vá bảng đợt khởi hành~~ Đóng 08/10 (nhánh `fix/web-tour-detail-gutter`): hai chỗ đệm `px-4 md:px-8 lg:px-12`. Đo lại trên bản build: 375px còn 343px nội dung, khối ngày của thẻ đợt khởi hành 253px, dòng phụ tháng, ngày đi và hạn huỷ về một dòng; từ `lg` số đo không đổi (924 và 1056px, hai cột 573 và 443px) |
| ~~G27~~ | ~~Dải 5 tab của trang chi tiết tour (`apps/web/src/components/tours/tour-tabs.tsx`) không co dưới bề rộng chữ: ở 375px năm tab cộng bốn khe 24px là 430px trong khung 279px, tab cuối kết thúc ở x=402 nên cả trang cuộn ngang được (`scrollWidth` 402 so với 375). Đo 07–08/10 trên prod lẫn bản build local~~ Đóng 08/10 (nhánh `fix/tour-tabs-mobile-scroll`): dưới 640px dải cuộn ngang trong hàng của nó, mép còn tab bị che thì mờ 2rem, tab đang mở tự cuộn ra khỏi vùng mờ; đo lại ở 320, 360 và 375 thì `scrollWidth` bằng `clientWidth`. Lỗi còn nửa thứ hai: lớp gốc `justify-center` căn giữa nội dung tràn, nên Overview cũng bị đẩy ra x=−27 bên trái, chỗ không cuộn tới được |
| G28 | Thanh ghế `SeatMeter` giữ "một đốt là một ghế" bằng sàn `min-w-1` (4px) cộng khe 4px, nên tour quá 24 chỗ tràn thẻ đợt khởi hành ở 320px (thẻ 190px; 375px chịu được tới 31 chỗ). Sau G26 (08/10) thẻ rộng hơn: thanh ghế đo được 254px ở 320, 309px ở 375, nên hai mốc thành 32 và 39 chỗ. Dữ liệu hiện tối đa 22 chỗ, nhưng contract chỉ ép `maxGroupSize` dương. Sức chứa lớn trên điện thoại cần một quyết định thiết kế, không phải sửa lớp CSS |
| G29 | Khối ảnh trang chi tiết tour (`apps/web/src/components/tours/tour-media-panel.tsx`): cột 7 ảnh nhỏ cao cố định 496px (7 × 64 cộng 6 khe 8), còn ảnh chính vuông theo bề ngang cột. Khi ảnh chính hẹp hơn 496px thì cạnh cột ảnh nhỏ là một khoảng trống. Đo 08/10 trên bản build: ảnh chính 208px ở 320, 263px ở 375 (trống 233px), 361px ở 1024 (trống 135px); 768 không lộ (ảnh 620px), 1280 khớp bản duyệt (493 so với 496). Không tràn khung; cần một quyết định thiết kế, ví dụ dưới `lg` đưa ảnh nhỏ thành hàng ngang dưới ảnh chính |
