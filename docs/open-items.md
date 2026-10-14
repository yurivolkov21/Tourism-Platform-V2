# Việc còn treo

> Bản tóm tắt để điều hướng, cập nhật 14/10/2026. **Chỉ giữ việc còn mở**; mục đã
> đóng (gồm các mã G đã gạch) nằm ở [open-items-closed.md](open-items-closed.md),
> chép nguyên văn. **Không phải nguồn sự thật** — chi tiết của từng mục sống ở
> [CHANGELOG](CHANGELOG.md) (mục "CÒN TREO" của entry tương ứng) và ở
> [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md).
> **Đóng một mục:** ghi kết quả vào dòng (ngày, nhánh, commit), chuyển cả dòng
> sang open-items-closed.md, rồi ghi vào CHANGELOG. **Mã G kế tiếp: G54.**

## Mốc thời gian

| Ngày | Việc |
| --- | --- |
| **15/10/2026** | **Freeze**: ngừng nâng cấp thư viện, ngừng đổi nơi deploy |
| ~03/11/2026 | Seed lại dữ liệu prod lượt 2 (ADR-0041 Phụ lục B Bước 8) — xem [việc phải xong trước lượt này](#trước-lượt-seed-lại-0311) |
| ~11/11/2026 | Bảo vệ đồ án |

## Phần chưa xây

| Mã | Việc | Ghi chú |
| --- | --- | --- |
| **P4f** | Quản trị người dùng và media | **Users XONG 13/10** (merge `26746d3`, PR #6; ADR-0052, spec và plan 02/10): hai bậc Owner và Staff, khoá tài khoản; thử tay production theo spec §8.4 còn treo ở CHANGELOG. Phủ ba bất biến hạ quyền / thu hồi phiên của ADR-0026 AMEND 1 §D. **Media library** và **Appearance** chưa thuộc spec nào; G16 đóng 14/10 bằng ADR-0035 AMEND 3 (PR #13) |
| **P6** | Trợ lý AI tư vấn tour | Có ADR-0050 và spec (29/09), chưa thi công — mở sau khi admin xong. Thư viện `ai`, `@ai-sdk/anthropic`, `@ai-sdk/react` đã ghim 29/09 (`3f646ace`, spec §7 bước 1). Bảng dữ liệu đã có sẵn (`chat_conversations`, `chat_messages`) |

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

## Mobile: thẻ Trips và hoá đơn chưa nói chuyến bị công ty huỷ

Nêu 12/10 ở review nhánh `fix/mobile-booking-screens` (merge cùng ngày). Bản vá N3 đã đưa đơn trên
chuyến công ty huỷ ra khỏi cụm P và nhãn "On tour now" (`bookingPhase` là `cancelled`), nhưng trong
lúc chờ job `departure-refund` (thường dưới 15 phút) đơn còn PAID: thẻ ở tab Trips vẫn ghi "Paid"
nền xanh, và hoá đơn mobile chưa có khối "We had to cancel this departure" như web (mục web đóng
09/10 ở trên). Job chạy xong thì đơn được huỷ như một lần huỷ thật nên thẻ thôi ghi "Paid", nhưng
mobile vẫn không nói chuyến do công ty huỷ. Làm: chữ mới trong `@tourism/i18n` cho thẻ và một khối
báo ở `bookings/[code]`, đọc cờ `departureCancelled`.

## Cần thử lại bằng máy thật

- **G31 hộp xoá tài khoản trên Edge** (merge 13/10, `04beaa7`): Edge có lưu mật khẩu cho
  www.nexora-travel.agency, vào Settings, bấm xoá tài khoản, ô "Type DELETE to confirm" phải còn
  trống. Mới có test đơn vị.
- **Lệnh chạy app điện thoại đổi sang LAN** (21/09, ADR-0040 AMEND 2):
  `pnpm --filter @tourism/mobile dev` nay là `expo start --go` (mạng LAN) thay vì
  `--tunnel`. Chưa ai quét QR thử sau khi đổi — cần một lượt trên điện thoại
  thật cùng mạng Wi-Fi. Không chạy được thì `dev:tunnel` vẫn còn nguyên.
- **Admin trên màn cảm ứng** (vòng vá review đợt sửa sạn admin, 07/10): chạm nút Delete đang
  khoá phải hiện toast lý do. Test chỉ giả lập `pointerType: touch` trong jsdom; thử tay 07/10 đạt
  trên DevTools mô phỏng iPhone 16 Pro Max (một toast, chạm lại không chồng) — còn máy thật.
- **Màn tài khoản mobile (P5b-4, merge 09/10)** — kịch bản từng bước ở mục 8
  của [tóm tắt nhánh](reviews/2026-10-06-branch-summary-mobile-account-screens.md).
  Ưu tiên ba bản vá chỉ kiểm được trên máy: F2 (Android: pinch, chạm đúp, vuốt
  đóng trình xem ảnh), F3 (iOS: bàn phím không che ô nhập trong tấm sửa tên, xoá
  tài khoản, hỏi ngày), F7 (iOS và Android ≤ 12: từ chối quyền ảnh vẫn mở được
  thư viện). Cơ chế quay lại sau đăng nhập: bấm tim khi chưa đăng nhập ở tour
  detail hoặc Explore, đăng nhập xong PHẢI về đúng chỗ và tim đã đặc; đóng Sign
  in bằng X, back cứng Android hay vuốt iOS rồi đăng nhập từ chỗ khác thì KHÔNG
  được dạt về tour cũ. Máy AI không có thiết bị thật.
- **Rời màn Sign in của mobile (nhánh browse, merge 12/10)** — kịch bản 1–30 ở mục 6 của
  [tóm tắt nhánh](reviews/2026-10-11-branch-summary-mobile-browse-screens.md). Ưu tiên R2
  (bước 14–17, Android và Google: về đúng tour, back cứng về Home, app không thoát) và đường
  onboarding: mở app lần đầu → "I already have an account" → đăng nhập xong → back cứng ở Home
  không được về lại Sign in.
- **Cụm đặt tour mobile (P5b-3, merge 12/10)** — kịch bản ở
  [hướng dẫn test](reviews/testing-guide-booking-fixes.md), cộng ba đường của review 12/10: để app nền qua
  đêm rồi mở chuyến đang đi, P5 phải đúng ngày (N2); hết ghế ở B4 → "Choose another date" về đúng
  trang tour, back một lần là ra; B8 "Browse more tours" mở Explore, back về Home rồi hết (N5); đơn
  hoàn một phần mở cụm P, còn nút huỷ ở hoá đơn (N3). Chưa kiểm: iOS (quyết bỏ 09/10), PayPal
  sandbox thật.
- **Cụm đánh giá mobile (P5b-5, merge 12/10)** — luồng C1–C6 của
  [hướng dẫn test máy thật](guides/huong-dan-test-may-that.md) và phần B của
  [hướng dẫn test](reviews/testing-guide-review-fixes.md) (Nghia chạy 10/10 trên nhánh chưa rebase), cộng
  hai đường của review 12/10: R5 gửi lại xong bấm "Back to my reviews" về đúng danh sách, back thêm
  một lần là ra Account (M2); thẻ bị bác hai lần ghi "See why" và mở R6 (M4). Mới xác nhận qua code:
  ảnh bìa tour ở R5 và R6 (V6), thumbnail nhẹ ở R5 (V9).

## Việc tay trên hạ tầng

- **Build web trên Vercel đỏ 09/10 vì API trả 500 lúc prerender** (`/blog/two-days-among-the-karsts`,
  6 lượt thử). Bản preview cùng commit lúc 02:39 UTC cũng nhận 500 ở review của 5 tour, trước
  khi push main. Redeploy 03:06 UTC xanh, không còn 500. Nghi API đang khởi động lại
  (deploy hoặc đổi env trên Render) — chưa đọc log Render quanh 02:39 và 02:48 UTC để xác nhận.
  Cùng hình dạng với các lần tái phát của G23 (API vừa thức trả 500 lúc prerender) — suy
  luận, chưa kiểm bằng log.
- Bộ dọn ảnh và tám file thử F18 trên Cloudinary: xem G41 ở bảng nợ bên dưới — bộ dọn
  gần như không chạy trên gói free của Render, nên hai mốc theo dõi cũ (30/09, 07/10) đã
  chuyển sang open-items-closed.md.
- Đối chiếu khoản hoàn `re_3UHzrvK1oRTwa7qk1hs4Rxnw` trên dashboard Stripe test
  mode (phiên kết nối đã hết hạn lúc nghiệm thu 21/09; mã do chính Stripe trả về
  nên khoản hoàn chắc chắn đã phát).
- Xoá cơ sở dữ liệu Docker `tourism_ui` khi nghiệm thu xong; seed lại DB Docker
  `tourism` theo mã mới. Máy dev cài lại 12/10 nên Docker dựng mới; chưa kiểm
  `tourism_ui` còn hay không.
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
  `OpenAPILink`. App mobile ghim 1.14.8 và cũng chỉ gọi qua `OpenAPILink`
  (`apps/mobile/src/lib/api/client.ts`), nên không với tới.
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

Phát hiện 25/09 ở final review của plan return-to-auth (SDD; ledger từng ở
`.superpowers/sdd/2026-09-25-mobile-account-return-to-auth/progress.md`, đã xoá
sau khi merge). Không chặn merge, ghi lại để không quên. Mục 1–3 đã sửa, chuyển
sang [open-items-closed.md](open-items-closed.md):

4. **Đăng nhập Google trên mobile sau ADR-0056** — proxy `expo-authorization-proxy` đóng ở
   mọi môi trường và server không còn luồng redirect nào đổ cookie phiên về deep link
   (`nexora:`, `exp:` hay scheme nào khác ngoài http/https; ADR-0017 §11 đã được thay). Còn
   lại: SDK miễn phí dùng Google Sign-In cũ trên Android (deprecated), chuyển sang Credential
   Manager sau v1; iOS chưa có Google tới khi có tài khoản Apple Developer (thêm
   `GOOGLE_IOS_CLIENT_ID` vào env API lúc đó). Ảnh Google lúc tạo tài khoản chỉ nhận host
   `lh3.googleusercontent.com`; ảnh ở host khác bị bỏ và tài khoản hiện chữ cái đầu. Nới host
   phải sửa cả `img-src` của CSP web và admin.
5. **N7–N10 mức thấp còn mở** — bảng ở mục 7 của tóm tắt nhánh: bấm đúp nút chọn
   ảnh, lỗi form đổi mật khẩu không tự xoá, Saved đếm "100 tours" trước khi tải đủ
   trang, ba chỗ a11y.

## Nợ nhỏ phát sinh từ P5b-5 (nhánh `fix/mobile-review-screens`)

Nêu 12/10 ở review lần 2 (merge cùng ngày). Không chặn merge:

1. **R1 mới mở được từ P6.** Mockup ghi thêm hai lối: chi tiết booking và dòng My reviews ở
   Account.
2. **Rút bài xong không có toast "Review retracted"** như web (chữ `reviews.retract.toast.done`
   có sẵn). Thẻ đổi sang "You retracted this review" nên khách vẫn thấy kết quả.
3. **Chữ báo lỗi ảnh ghi cứng "10 MB" và 5** ở `use-review-photos.ts`, cùng số ô còn trống và
   `maxPhotos={5}` ở hai route, trong khi luật chặn đọc `REVIEW_PHOTO_MAX_BYTES` và
   `REVIEW_PHOTOS_MAX` của contract: đổi hằng số là chữ lệch.
4. **Bài đang gõ ở R1, R5 mất khi bấm back cứng Android**, không hỏi lại.

## Nợ kỹ thuật chi tiết

Sáu nhóm (giao diện · dữ liệu · kiểm thử · thư viện bên thứ ba · nợ cũ · nợ sau
deploy) nằm ở [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md) —
**đọc trước khi mở một cụm việc mới**. Vài mục còn mở đáng chú ý:

| Mã | Nợ |
| --- | --- |
| A16 | 7 icon mạng xã hội trỏ `#top` — chốt giữ nguyên tới khi có tài khoản thật |
| E6 | Xác thực hai lớp — đã quyết định gác lại |
| F1 | Webhook Resend (`delivered`/`bounced`/`complained`) — hiện `SENT` chỉ nghĩa là Resend đã nhận. Một nửa đã có từ W4 (08/09, ADR-0039 §4): webhook nhận `bounced` (vĩnh viễn) và `complained` để ghi suppression (`apps/api/src/modules/email-webhooks/resend-event.ts`); `delivered` vẫn bị bỏ qua nên `SENT` chưa đổi nghĩa (đo 14/10) |
| G1 | `admin.categories.move` trả CẢ danh sách đã sắp lại, mà client vứt đi rồi `router.refresh()`. Giữ nguyên có chủ đích ở vòng review F14: tiêu thụ payload ấy cần đưa `rows` vào state của bảng, tức hai nguồn sự thật cho một bảng sáu hàng. Cái giá hiện tại là MỘT truy vấn `list()` thừa mỗi cú bấm mũi tên |
| G2 | 29 bản chép của `sessionCookie` trong `apps/api/src/**/*.int.spec.ts` — ngưỡng rút chung đã vượt từ lâu, nhưng nó không thuộc phạm vi một cụm tính năng nào. Better-auth đổi tên cookie là 29 chỗ phải sửa (đếm lại 14/10, trước là 23) |
| G15 | Ký upload và tải lên có hai bản: `signPhotoUploads` chép đoạn ký và enqueue của `UploadSigningService` (không export khỏi `MediaModule`, hai lớp lỗi NotConfigured); `apps/admin/src/lib/photo-upload.ts` chép phần dựng form và khung XHR của `apps/web/src/lib/media-upload.ts`. Gom cần sửa cả `apps/web`. Một phần đóng ở P4e-4: phía API `signUploads` dùng chung cho tour và bài viết, một lớp `UploadsNotConfiguredError` cho cả ba nơi ký (vòng review); admin dùng chung `uploadPhoto`, hộp thư viện và một server action kho ảnh. Còn bản chép XHR giữa web và admin. |
| G17 | Hiệu năng F18, đều nhỏ: mỗi nhịp tiến độ tải lên render lại cả form (vài ms mỗi lần); `setPhotos` requeue từng ảnh một trong transaction đang giữ khoá, và `get` hỏi thêm câu media nối tiếp (cộng lại khoảng 0,1–0,2 giây mỗi lần lưu, dưới timeout 5 giây). Chưa đáng sửa riêng |
| G18 | Bước Review (F19): vùng xoá tour đứng TRƯỚC công tắc On sale trong thứ tự tab, và dưới `xl` nằm giữa danh sách kiểm tra và card Visibility — việc chính của bước đến sau nút xoá. Vòng review F19 để lại vì là quyết định bố cục của spec §2d.6, không phải lỗi |
| G25 | Khoá ngoại `tour_destinations.destination_id` vẫn `ON DELETE CASCADE` (ADR-0053, giới hạn 4): luật "đang có tour thì không xoá" chỉ sống ở lệnh xoá của API; xoá điểm đến bằng SQL tay, Prisma Studio hay script sẽ lặng lẽ gỡ nó khỏi mọi tour. Đổi sang `RESTRICT` như danh mục cần một migration — để sau capstone |
| G30 | Số điện thoại ở `/account/settings` chỉ được lưu để liên hệ (gợi ý dưới nhãn: "So the guide can reach you on the day."), không xác minh bằng OTP như nhiều site. Thêm OTP cần nhà cung cấp SMS (dịch vụ ngoài, có chi phí), luồng gửi lại mã và chống spam. User nêu khi thử tay 09/10; để sau capstone, nhắc trong báo cáo như hướng phát triển |
| G41 | Ba job hằng ngày của worker gần như không chạy trên production: `outbox-purge` 03:00, `enquiry-retention` 03:30, `media-gc` 04:00 UTC (10–11 giờ sáng giờ Việt Nam). API Render (`srv-da36lvgu01pc7381cv10`) là gói **free**, ngủ sau 15 phút không có request, và worker chạy chung tiến trình (`[WorkerInline]`, ADR-0024): cron pg-boss chỉ bắn khi đúng phút ấy máy đang thức. Đo 10/10: log từ 15/09 chỉ có ĐÚNG MỘT lượt `MediaGarbageService` (03/10 04:00:07 UTC); bảng `media_garbage` còn 19 mục, tất cả `attempts = 0`, trong đó 11 ảnh thử F18 xếp hàng từ 29/09 lẽ ra đã xoá ngày 07/10. Đề xuất (chưa duyệt): mỗi lần worker khởi động gửi một lượt của ba job với khoá đơn nhất theo ngày (pg-boss `singletonKey` cùng `singletonSeconds`), chạy bù ở lần thức đầu tiên trong ngày — các job đều idempotent; không tốn tiền, không thêm dịch vụ ngoài. AMEND ADR-0024 trước code. Nên xong trước lượt seed lại ~03/11 |
| G47 | `MOBILE_COLOR_KEYS` của app mobile vẫn dùng `success` và `warning` làm mực. Nếu app có chữ cảnh báo trên nền sáng thì cùng lỗi 2:1 mà G32 vá cho web và admin (13/10). Soát 14/10: hai chỗ dùng chúng làm màu CHỮ — pill "Paid" ở `apps/mobile/src/features/trips/trips-screen.tsx` (`success`) và nhãn caption ở `features/tour-detail/tour-detail-screen.tsx` (`warning`, dòng 1341); các chỗ khác chỉ dùng làm nền pha alpha. Chưa đo tương phản |
