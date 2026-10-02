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
| **P4e** | Quản trị catalog: thêm/sửa/xoá tour, điểm đến, danh mục | P4e-1 XONG 22/09 (F11 danh sách tour · F12 lịch chạy · F13 huỷ chuyến có hoàn tiền, đóng nợ ADR-0041 §6). **P4e-2 XONG**: F14 danh mục 22/09 (màn `/categories` cộng chip lọc của web đọc endpoint) và F15 điểm đến 24/09 (màn `/destinations`, ba vùng về contract, web chịu được điểm đến đã ẩn). **P4e-3a** (F17 tạo và sửa tour) XONG: merge 28/09 sau vòng review (24 lỗi thật, vá cả 24 — lỗi seed vá ở nhánh riêng cùng ngày). **P4e-3b** (F18 ảnh tour) XONG: merge 29/09 sau vòng review (15 phát hiện, vá cả 15). **P4e-3c** (F19 khu sửa tour dạng thanh bước) XONG: merge 01/10 sau vòng review (15 phát hiện, vá cả 15). Còn **P4e-4** bài viết: ADR-0051 và spec 02/10 (CMS lõi, tour liên quan, đóng G9 và một phần G15), chờ plan |
| **P4f** | Quản trị người dùng và media | **Users**: ADR-0052 và spec 02/10 — Owner (chỉ từ `ADMIN_EMAILS`) cấp Staff cho khách đã xác minh, bảng quyền ở contract, khoá tài khoản, đăng xuất mọi nơi, lịch sử theo người dùng; plan 02/10 (14 task, kèm prompt thi công), thi công sau khi P4e-4 merge. Phủ ba bất biến hạ quyền / thu hồi phiên của ADR-0026 AMEND 1 §D. **Media library**, **Appearance** và G16 chưa thuộc spec nào |
| **P5b-2…5** | Bốn cụm màn mobile: xem tour · đặt tour · tài khoản · đánh giá | **Đã có bản vẽ và tài liệu bàn giao đầy đủ**; thành viên khác dựng màn — xem [`handoff/`](handoff/README.md) |
| **P6** | Trợ lý AI tư vấn tour | Có ADR-0050 và spec (29/09), chưa thi công — mở sau khi admin xong. Thư viện `ai`, `@ai-sdk/anthropic`, `@ai-sdk/react` đã ghim 29/09 (`3f646ace`, spec §7 bước 1). Bảng dữ liệu đã có sẵn (`chat_conversations`, `chat_messages`) |
| **P7** | Đợt trau chuốt giao diện cuối | |

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

## Cần thử lại bằng máy thật

- **Lệnh chạy app điện thoại đổi sang LAN** (21/09, ADR-0040 AMEND 2):
  `pnpm --filter @tourism/mobile dev` nay là `expo start` thay vì
  `--tunnel`. Chưa ai quét QR thử sau khi đổi — cần một lượt trên điện thoại
  thật cùng mạng Wi-Fi. Không chạy được thì `dev:tunnel` vẫn còn nguyên.

## Việc tay trên hạ tầng

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
- Chuyển `backups/2026-09-18/` từ worktree về bản checkout gốc trước khi gỡ
  worktree.
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
| ~~G9~~ | ~~Sửa hay xoá tour chỉ bust `tours` và `tour:<slug>`, không bust `post:<slug>` của bài viết nhúng thẻ tour.~~ Chuyển vào phạm vi P4e-4 (29/09): hôm nay chưa có triệu chứng — `toJournalPostDetail` bỏ `relatedTours` nên web chưa hiện tour gắn trong bài, không seed hay màn nào tạo `PostTour`, menu Posts của admin còn tắt. Spec P4e-4 phải chọn một: tra `PostTour` TRƯỚC khi xoá tour (xoá tour cascade mất liên kết) rồi bust `post:<slug>`, hoặc cho trang bài viết mang thêm tag `tours` |
| ~~G10~~ | ~~Web lấy danh sách tour bằng MỘT trang `limit: 50` — quá 50 tour đang bán thì tour cũ nhất biến khỏi web.~~ Đóng 29/09 (nhánh `fix/web-tours-all-pages`): `fetchTours` đi hết các trang qua `collectAllPages`, trần 20 trang, chạm trần thì `console.warn` |
| ~~G11~~ | ~~Validator tab Details và Itinerary viết tay luật "tour đang bán thì luôn đủ" (tóm tắt, thêm ngày, tiêu đề ngày) thay vì suy từ `projectedReadiness`.~~ Đóng ở F18 (28/09): ba tab Details, Itinerary, Photos suy từ `onSaleShortfalls` |
| ~~G12~~ | ~~Metadata ảnh vừa tải (`TourPhotoUploadSchema`: `width`, `height`, `bytes`) dùng `z.int()` nên số vượt INT4 lọt qua schema và ra 500.~~ Đóng 29/09 (nhánh `fix/tour-photo-int32-image-filter`): `z.int32()`, request như vậy nay là 400 |
| ~~G13~~ | ~~Thư viện của tab Photos nhận cả dòng VIDEO của địa danh; câu `banners.notReady` đổ lỗi cho lần sửa cả khi chỗ thiếu có từ trước.~~ Đóng 29/09: phần thư viện ở nhánh `fix/tour-photo-int32-image-filter` (ADR-0048 AMEND 2), câu banner ở nhánh `fix/f18-thu-tay-gop-y` ("Saved like this, it would be missing:"). Còn một nhận xét không cần vá: ảnh của CHÍNH tour chưa lọc theo loại — prod 29/09 không có dòng VIDEO nào của tour, không đường nào tạo ra |
| G14 | Dọn code F18. **Đã làm 29/09** (nhánh `fix/f18-thu-tay-gop-y`): thanh tiến độ dùng `Progress` của `@tourism/ui`; helper URL Cloudinary gom về `apps/admin/src/lib/cloudinary-url.ts`; `hasTourCover` bỏ export, sửa JSDoc, `get` dùng `pickCover`. **Còn lại, cố ý để sau F19** vì F19 sửa đúng các file ấy: `ListEditor` nhận `add` và `emptyFocus` rời nhau thay vì một union; copy chép tay "JPG, PNG…", "10 MB", "30 photos" thay vì đọc hằng; fixture ảnh chép ở nhiều spec |
| G15 | Ký upload và tải lên có hai bản: `signPhotoUploads` chép đoạn ký và enqueue của `UploadSigningService` (không export khỏi `MediaModule`, hai lớp lỗi NotConfigured); `apps/admin/src/lib/photo-upload.ts` chép phần dựng form và khung XHR của `apps/web/src/lib/media-upload.ts`. Gom cần sửa cả `apps/web` |
| G16 | Hàng dọn media nhận mọi publicId: luật "không dọn ảnh thư viện hay catalog" nằm ở nơi gọi. Nên có một vị từ "publicId nằm trong vùng tải lên" để sweep từ chối destroy ảnh ngoài vùng ấy. Hôm nay chưa đường nào đưa chúng vào hàng; làm cùng P4f hoặc P4e-4 |
| G17 | Hiệu năng F18, đều nhỏ: mỗi nhịp tiến độ tải lên render lại cả form (vài ms mỗi lần); `setPhotos` requeue từng ảnh một trong transaction đang giữ khoá, và `get` hỏi thêm câu media nối tiếp (cộng lại khoảng 0,1–0,2 giây mỗi lần lưu, dưới timeout 5 giây). Chưa đáng sửa riêng |
| G18 | Bước Review (F19): vùng xoá tour đứng TRƯỚC công tắc On sale trong thứ tự tab, và dưới `xl` nằm giữa danh sách kiểm tra và card Visibility — việc chính của bước đến sau nút xoá. Vòng review F19 để lại vì là quyết định bố cục của spec §2d.6, không phải lỗi |
| G19 | `tourPageUrl` (`apps/admin/src/lib/site.ts`) cứng origin prod `www.nexora-travel.agency`: ở máy dev, "View on site" của tour bán trong DB local mở trang prod (404 hoặc tour khác cùng slug). Chú ý bẫy tên: `NEXT_PUBLIC_SITE_URL` của admin là origin CỦA admin, không phải của web |
| G20 | Icon cảnh báo `text-warning` trên nền card chỉ ~2:1 (dưới 3:1 của WCAG 1.4.11). Vòng review F19 đã cho dòng thiếu khác CHỮ dòng đủ nên màu không còn là tín hiệu duy nhất; đổi màu token là việc riêng của hệ màu |
| ~~G21~~ | ~~Báo cáo `/reports` với tháng ĐANG chạy ghi doanh thu của chuyến chưa kết thúc.~~ Đóng 01/10 (nhánh `fix/reports-recognised-to-date`, ADR-0033 AMEND 3): user chọn vá cách tính chứ không chỉ đổi chữ — cột kết quả kinh doanh chỉ ghi nhận chuyến đã kết thúc tới hôm nay (ngày UTC), tháng đang chạy in nhãn "(to date)", tháng tương lai rơi về tháng hiện tại |
| G22 | `data:reset` (`apps/api/scripts/reset-operational-data.mjs`) xoá `reviews` nhưng giữ nguyên `media_assets` (nằm trong `PHAI_CON`), nên dòng ảnh của review thành tham chiếu treo: bộ dọn media coi là còn dùng, hoãn mãi, file Cloudinary không bao giờ bị xoá. Đo 01/10: bốn ảnh như vậy của review thử bị bác trên `BK-5YU9J339`; user chốt xoá tay thư mục ấy trên Cloudinary. Vá trước lượt seed lại khoảng 03/11: xoá dòng `media_assets` của review và đưa publicId vào `media_garbage` |
| G23 | Render deploy API bằng cách chạy instance cũ và mới SONG SONG, còn Session pooler của Supabase chỉ cho 15 kết nối. 01/10 lượt deploy `7844478c` hỏng (`EMAXCONNSESSION`, lúc pg-boss của instance mới khởi động): build web của Vercel cùng lượt push đang prerender gọi dồn vào API cũ, đẩy pool của nó sát trần. Deploy lại tay lúc yên thì qua (3 kết nối). Hướng vá: hạ kích thước pool (Prisma qua adapter-pg và pg-boss) để hai instance cộng tải prerender vẫn dưới 15, hoặc nâng pool size của Supavisor. Chưa quyết; tới lúc đó, push nào đụng cả API lẫn web thì canh trạng thái deploy Render chứ không chỉ health |
