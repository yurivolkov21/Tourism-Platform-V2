# Việc còn treo

> Bản tóm tắt để điều hướng, cập nhật 15/10/2026. **Chỉ giữ việc còn mở**; mục đã
> đóng (gồm các mã G đã gạch) nằm ở [open-items-closed.md](open-items-closed.md),
> chép nguyên văn. **Không phải nguồn sự thật** — chi tiết của từng mục sống ở
> [CHANGELOG](CHANGELOG.md) (mục "CÒN TREO" của entry tương ứng) và ở
> [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md).
> **Đóng một mục:** ghi kết quả vào dòng (ngày, nhánh, commit), chuyển cả dòng
> sang open-items-closed.md, rồi ghi vào CHANGELOG. **Mã G kế tiếp: G55.**

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

Không còn việc nào chờ quyết (14/10).

## Cần thử lại bằng máy thật

- **Hỏi lại trước khi rời màn viết bài của app** (merge 15/10, nhánh `fix/review-draft-leave-guard`, PR #24): ở bản
  build app kế tiếp, gõ vài chữ ở R1 rồi bấm back cứng Android: phải hiện tấm "Leave without
  sending?", "Keep writing" ở lại màn, "Discard and leave" thì rời. Mở R5 rồi back ngay thì rời
  luôn, không hỏi. Có iPhone thì thử thêm vuốt back. Mới có test đơn vị.
- **Lý do công ty huỷ chuyến cho khách đọc** (merge 14/10, nhánh `feat/departure-cancel-reason`, PR #23):
  admin huỷ một chuyến thử có một đơn đã trả bằng thẻ Stripe test và gõ lý do; email báo huỷ của
  khách phải có khối "WHY" đúng câu ấy, trang đơn web có khối "Why" dưới "We had to cancel this
  departure.", và hoá đơn app (bản build kế tiếp) có khối lý do. Mới có test đơn vị và int.
- **Sáu việc nhỏ của app mobile** (merge 14/10, nhánh `fix/web-open-items-9`, PR #21): đơn chờ trả
  quá hạn chót ghi "Payment not completed" xám ở Trips và hoá đơn không mời trả (G54); hoá đơn
  chuyến đã về chưa có bài có nút "Write a review" mở R1; TalkBack và VoiceOver đọc backdrop tấm
  trượt là nút "Close", chạm hai lần thì đóng tấm (N10); bấm đúp "Choose from library" chỉ mở
  một picker (N7). Mới có test đơn vị.
- **Hoá đơn và thẻ Trips khi chuyến bị công ty huỷ, hoá đơn của đơn khách tự huỷ** (merge 14/10,
  nhánh `fix/web-open-items-8`, PR #20): đơn còn PAID trên chuyến vừa huỷ phải ghi "Cancelled" xám
  ở Trips, hoá đơn mở bằng "We had to cancel this departure." cùng "Your full refund is on its
  way."; đơn khách tự huỷ trong hạn phải hiện số đã hoàn và ngày. Mới có test đơn vị.
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
- Bộ dọn ảnh và tám file thử F18 trên Cloudinary: bộ dọn từng gần như không chạy trên gói
  free của Render (G41), nên hai mốc theo dõi cũ (30/09, 07/10) đã chuyển sang
  open-items-closed.md. G41 đóng 14/10 (PR #18): từ bản deploy ấy worker chạy bù `media-gc`
  ở lần thức đầu tiên mỗi ngày, không còn phụ thuộc máy thức đúng 04:00 UTC.
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

## Nợ nhỏ phát sinh từ P5b-4 (nhánh `feat/mobile-account-screens`)

Phát hiện 25/09 ở final review của plan return-to-auth (SDD; ledger từng ở
`.superpowers/sdd/2026-09-25-mobile-account-return-to-auth/progress.md`, đã xoá
sau khi merge). Không chặn merge, ghi lại để không quên. Mục 1–3 và phần lớn mục 5
đã sửa, chuyển sang [open-items-closed.md](open-items-closed.md):

4. **Đăng nhập Google trên mobile sau ADR-0056** — proxy `expo-authorization-proxy` đóng ở
   mọi môi trường và server không còn luồng redirect nào đổ cookie phiên về deep link
   (`nexora:`, `exp:` hay scheme nào khác ngoài http/https; ADR-0017 §11 đã được thay). Còn
   lại: SDK miễn phí dùng Google Sign-In cũ trên Android (deprecated), chuyển sang Credential
   Manager sau v1; iOS chưa có Google tới khi có tài khoản Apple Developer (thêm
   `GOOGLE_IOS_CLIENT_ID` vào env API lúc đó). Ảnh Google lúc tạo tài khoản chỉ nhận host
   `lh3.googleusercontent.com`; ảnh ở host khác bị bỏ và tài khoản hiện chữ cái đầu. Nới host
   phải sửa cả `img-src` của CSP web và admin.
5. **N8 nửa sau còn mở** — đổi mật khẩu thành công thì màn đóng về Account mà không báo gì,
   vì app chưa có toast. N7, N9, N10 và nửa đầu N8 đã sửa 14/10
   (nhánh `fix/web-open-items-9`, PR #21), chuyển sang [open-items-closed.md](open-items-closed.md).

## Nợ nhỏ phát sinh từ P5b-5 (nhánh `fix/mobile-review-screens`)

Nêu 12/10 ở review lần 2 (merge cùng ngày). Không chặn merge. Mục 3 (14/10) và 4 (15/10) đã
sửa, chuyển sang [open-items-closed.md](open-items-closed.md):

1. **R1 chưa mở được từ dòng My reviews.** Mockup ghi ba lối vào R1: P6, chi tiết booking và
   dòng My reviews ở Account. Lối chi tiết booking có từ 14/10 (`e6fbf4e`,
   nhánh `fix/web-open-items-9`, PR #21); R4 chưa vẽ chỗ cho chuyến chờ đánh giá nên lối thứ ba
   cần thiết kế.
2. **Rút bài xong không có toast "Review retracted"** như web (chữ `reviews.retract.toast.done`
   có sẵn). Thẻ đổi sang "You retracted this review" nên khách vẫn thấy kết quả.

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
| G17 | Hiệu năng F18, đều nhỏ: mỗi nhịp tiến độ tải lên render lại cả form (vài ms mỗi lần); `setPhotos` requeue từng ảnh một trong transaction đang giữ khoá, và `get` hỏi thêm câu media nối tiếp (cộng lại khoảng 0,1–0,2 giây mỗi lần lưu, dưới timeout 5 giây). Chưa đáng sửa riêng |
| G25 | Khoá ngoại `tour_destinations.destination_id` vẫn `ON DELETE CASCADE` (ADR-0053, giới hạn 4): luật "đang có tour thì không xoá" chỉ sống ở lệnh xoá của API; xoá điểm đến bằng SQL tay, Prisma Studio hay script sẽ lặng lẽ gỡ nó khỏi mọi tour. Đổi sang `RESTRICT` như danh mục cần một migration — để sau capstone |
| G30 | Số điện thoại ở `/account/settings` chỉ được lưu để liên hệ (gợi ý dưới nhãn: "So the guide can reach you on the day."), không xác minh bằng OTP như nhiều site. Thêm OTP cần nhà cung cấp SMS (dịch vụ ngoài, có chi phí), luồng gửi lại mã và chống spam. User nêu khi thử tay 09/10; để sau capstone, nhắc trong báo cáo như hướng phát triển |
