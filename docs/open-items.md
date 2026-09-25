# Việc còn treo

> Bản tóm tắt để điều hướng, cập nhật 22/09/2026 (lượt hai). **Không phải nguồn sự thật** —
> chi tiết của từng mục sống ở [CHANGELOG](CHANGELOG.md) (mục "CÒN TREO" của
> entry tương ứng) và ở [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md).
> Trả xong một mục thì gạch ở đây và ghi vào CHANGELOG.

## Mốc thời gian

| Ngày | Việc |
| --- | --- |
| **15/10/2026** | **Freeze**: ngừng nâng cấp thư viện, ngừng đổi nơi deploy |
| ~03/11/2026 | Seed lại dữ liệu prod lượt 2 (ADR-0041 Phụ lục B Bước 8) |
| ~11/11/2026 | Bảo vệ đồ án |

## Phần chưa xây

| Mã | Việc | Ghi chú |
| --- | --- | --- |
| **P4e** | Quản trị catalog: thêm/sửa/xoá tour, điểm đến, danh mục | P4e-1 XONG 22/09 (F11 danh sách tour · F12 lịch chạy · F13 huỷ chuyến có hoàn tiền, đóng nợ ADR-0041 §6). **P4e-2 F14 danh mục XONG 22/09** (màn `/categories` cộng chip lọc của web đọc endpoint). Còn P4e-2 F15 điểm đến, P4e-3 tour CRUD, P4e-4 bài viết |
| **P4f** | Quản trị media và người dùng | Gồm màn hạ quyền / thu hồi phiên admin (ADR-0026 AMEND 1) |
| **P5b-2…5** | Bốn cụm màn mobile: xem tour · đặt tour · tài khoản · đánh giá | **Đã có bản vẽ và tài liệu bàn giao đầy đủ**; thành viên khác dựng màn — xem [`handoff/`](handoff/README.md) |
| **P6** | Trợ lý AI tư vấn tour | Bảng dữ liệu đã có sẵn (`chat_conversations`, `chat_messages`) |
| **P7** | Đợt trau chuốt giao diện cuối | |

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
- **Cơ chế "quay lại đúng chỗ sau đăng nhập" (P5b-4, nhánh
  `feat/mobile-account-screens`, plan
  `docs/plans/2026-09-25-mobile-account-return-to-auth.md`)** — Bấm tim khi
  chưa đăng nhập ở tour detail → Sign in → đăng nhập xong → kiểm PHẢI quay
  đúng tour VÀ tim đã tự đặc sẵn (không cần bấm lại). Thử cả hai chiều: (a)
  đăng nhập xong xuôi, (b) bấm X đóng màn Sign in nửa chừng RỒI đăng nhập lại
  từ chỗ khác (Account/Explore) — PHẢI không bị "dạt" về tour cũ. Máy AI
  không có thiết bị thật, chưa từng chạy tay bước này (Step 6 của plan).

## Việc tay trên hạ tầng

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

1. **Explore-tab wishlist gate chưa gọi `setPendingReturn`** — chỉ tour-detail
   (`[slug].tsx`) và các khối chặn tab tương lai (Saved/Account, V1 spec P5b-4)
   mới nhớ đường quay lại; bấm tim ở thẻ tour trên Explore rồi đăng nhập xong
   thì về Home, không về đúng Explore. Spec §1b bỏ sót nơi này.
2. **`login.tsx`'s `onClose` (nút X) luôn về Home** — kể cả khi mở từ một tour
   cụ thể. Giờ đã có hạ tầng return-to (P5b-4), sửa để về đúng tour là việc
   nhỏ nhưng chưa làm (ngoài phạm vi plan return-to-auth, plan đó chỉ gọi
   `clearPendingReturn()` ở đây, không đổi đích).
3. **`router.replace` khi quay lại tour đã mount sẵn dưới modal login** —
   Expo Router giữ màn tour-detail mount nguyên dưới modal `(auth)`, nên
   `replace` có thể đẩy thêm một bản sao vào stack thay vì đóng modal về đúng
   màn đang có sẵn. Đổi sang `router.back()`/dismiss khi đích trùng màn đã mở
   là sửa đúng hơn nhưng cần test tay trên máy thật (xem mục "Cần thử lại
   bằng máy thật" phía trên) trước khi đổi — rủi ro đổi sai điều hướng cao
   hơn lợi ích nếu không kiểm chứng được trên thiết bị thật.

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
| G3 | `mapError` của `admin-categories.controller.ts` và `admin-departures.controller.ts` trùng chữ ký lẫn cấu trúc. Bản departures còn có lời giải tốt hơn (lỗi mang `code` nên ba mã gập thành một nhánh) — đáng rút chung khi F15 thêm bản thứ ba |
