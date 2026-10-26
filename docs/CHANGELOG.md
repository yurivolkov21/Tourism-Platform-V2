# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

> **File này chỉ giữ đợt đang chạy** (từ 13/10/2026). Toàn bộ lịch sử trước đó
> nằm ở [`changelog/`](changelog/) — 19 file theo giai đoạn, có
> [mục lục kể lại từng giai đoạn](changelog/README.md).
> Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`) — archive là di chuyển
> nguyên văn, không sửa một ký tự.

## 2026-10-26 — Merge review F1 hạ tầng API, CI và cấu hình gốc: đường admin viết mã hoá không còn lọt CORS và chặn cross-site, trần chat một giờ không bị quét sớm, Sentry không nhận tham số câu truy vấn của Prisma (`7a71882`)

Luồng F1 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `e8fdfee`, rebase lên `96db013` trước khi đẩy. Báo
cáo đủ 19 dòng (9 sửa ở đây, 1 việc hạ tầng Yuri chọn làm, 1 đề xuất, 7 ghi lại, và L1-16 chuyển từ L1 chỉ ghi
nhận) từng nằm ở `code-review/F1-bao-cao.md` của thư mục chung; thư mục ấy đã được dọn trước lúc merge, nên việc
hạ tầng, các bước test tay và phần ghi lại chép ở mục CÒN TREO dưới đây. Nhánh `fix/review-f1-api-ci-config-6sek70`,
[PR #62](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/62), thi công trên session cloud. Đụng api
(bootstrap, throttle, Sentry, comment), hook session cloud và `compose.yaml`: không migration, không đổi contract,
không biến env mới, không dependency mới.

- `b53f22d` (F1-01, P1; phần `bootstrap.ts` của F1-03): router của Fastify (find-my-way 9.7) giải mã
  percent-encoding của path trước khi khớp route, còn delegator CORS, hook onRequest (cổng JSON 415, chặn
  cross-site 403) và guard throttle so `req.url` thô. Đo bằng e2e trên API local: `OPTIONS /api/%61dmin/bookings`
  với Origin của web được cấp `Access-Control-Allow-Origin` (ADR-0026 AMEND 1 hứa vùng admin không phát CORS cho
  origin nào), POST JSON cross-site tới `/api/%61dmin/bookings/BK-X/refund` ra 401 thay vì 403, và
  `/api/webhooks/csp-r%65port` nhận `application/json` qua parser 1 MiB thay vì 415. Kịch bản: một XSS ở www gọi
  đường admin viết mã hoá kèm cookie khi nạn nhân là admin, đọc được dữ liệu và gửi được lệnh ghi JSON. Đây là
  lớp phòng thủ chiều sâu; lớp chính vẫn là CSP của web. Nay `lib/request-path.ts` (`routingPath`,
  `isAdminSurfacePath`) chép đúng cách router cắt `?`, `#` và giải mã (giữ ký tự dành riêng và `%25`), dùng ở
  mọi phép so path của tầng HTTP. Cùng gốc, nhẹ hơn: key throttle của đường auth wildcard lấy path thô, nên
  `/api/auth/sign-in/email#1`, `#2`… mỗi lượt một bucket mới (trần riêng của Better Auth vẫn chặn).
- `29b59e3` (F1-02, P2): lượt quét dọn của `KeyedThrottlerStorage` (mỗi 1 000 lượt đếm, hoặc khi chạm trần
  50 000 bucket) dùng `ttl` của lượt kích nó, gần như luôn 60 giây, nên xoá bucket chat một giờ còn hit mà chưa
  bị block. Trần 20 lượt mỗi giờ của khách chưa đăng nhập vì thế mở lại sau một phút im lặng, và ai cũng kích
  được lượt quét bằng khoảng 1 000 GET công khai. Nay mỗi bucket giữ cửa sổ của chính nó (lớn nhất từng nhận);
  ADR-0037 AMEND 4. Trần tiền theo ngày `CHAT_DAILY_BUDGET_USD` vẫn chặn tổng trong suốt thời gian lỗi tồn tại.
- `f326fd4` (F1-11): `scrubEvent` chỉ lọc khối request, mà message của `PrismaClientValidationError` in nguyên
  tham số câu truy vấn (đo trên Prisma 7.8: `where: { email: "…" }`), kể cả với `errorFormat: 'minimal'`. Nay
  Sentry chỉ nhận đoạn đầu (model và hàm gọi) và đoạn cuối (trường nào sai kiểu gì). Chỉ xảy ra khi có lỗi lập
  trình (input đã qua zod) nên hiếm. Log stdout trên Render vẫn in nguyên, vì đó là nơi chẩn đoán lỗi.
- `219a408` (F1-03, F1-04, F1-08, F1-12): sửa comment nói sai code hoặc viết tiếng Anh ở `bootstrap.ts` (PATCH
  nay là hai route), `orpc-error-log.ts` (JSDoc nằm nhầm hàm), `prisma.config.ts` (CLI không dùng pool, pool của
  tiến trình API là 5), `contract/src/index.ts`, `env.spec.ts`, `csp-report.controller.ts` (chỉ `documentUri` bỏ
  query) và header `prisma/hardening-v2.sql` (bản ghi của migration `20260718092447_hardening`, không phải nguồn
  sự thật; lưới thật là `check-rls.sh`). File ấy không nằm trong `prisma/migrations/` nên không đụng checksum.
- `7a71882` (F1-05, F1-06): hook session cloud chạy `prisma generate` ngay sau `pnpm install` (thiếu nó thì làm
  bước "Migrate + seed" trước mọi task turbo là `ERR_MODULE_NOT_FOUND`, dính 20/10 ở L2); header `compose.yaml`
  thôi hứa "boot cả hệ một lệnh": `api` và `worker` chạy `NODE_ENV=production` với env tối thiểu nên chốt
  production của `env.ts` dừng tiến trình ngay, đúng thiết kế; hai service giữ để thử image.

**Review.** Không có lượt review độc lập; mỗi phần sửa có test đỏ trên mã cũ: F1-01 (3 e2e, cùng 16 unit test
cho `request-path` viết khi module chưa có), F1-02 (1), F1-11 (1, dùng message thật đo được). Năm trọng tâm của
kế hoạch: Render ngủ rồi thức êm phía API (timeout, `/health` 503 khi DB lỗi, job bù có khoá theo ngày) pass có
điều kiện vì thời gian khởi động thật và timeout phía web thuộc F3 và L3; cấu hình production sai thì tiến trình
dừng pass (ngoại lệ `ADMIN_EMAILS`, `EMAIL_FROM`, xem CÒN TREO); truy vấn nóng có index pass (55 `@@index`); CI
canh đủ thứ CLAUDE.md nói pass có điều kiện (docs-freshness kiểm theo ngày, F1-07); lỗi 500 lên Sentry chỉ mang
method và path pass sau F1-11. Yuri chọn "Đặt trước buổi test tay" cho F1-10 và bảo đẩy lên main 26/10 02:09 UTC.
Docs sweep cùng đợt: ADR-0037 AMEND 4, một dòng ở "Việc tay trên hạ tầng" của `open-items.md`, mô tả hook ở
`CLAUDE.md`.

Tests after (`gate:int` trên `7a71882`, nền `96db013`, 26/10, session cloud, API sống ở :3001): unit 8508 (web 2469, admin
2456, api 1470, mobile 961, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int 982; Biome 2122
file; RLS, tokens-only của mobile (190 file), bundle mobile và prerender admin xanh. Lượt đầu `@tourism/contract#test`
chết vì hết heap ở một file như entry A3, A4, A5 và A1; chạy lại với `--max-old-space-size=6144`: 812/812. PR thêm
21 test unit ở api (16 `request-path`, 3 e2e, 1 storage, 1 `scrubEvent`).

**CÒN TREO:**

- **Trước buổi test tay, việc tay trên Render (F1-10, Yuri chọn 26/10, ADR-0037 AMEND 4).** Service API, mục
  Environment, ô `TRUST_PROXY` đặt giá trị dưới đây (một dòng, không dấu cách), Save, đợi deploy xong. Đối chiếu
  dải với `https://www.cloudflare.com/ips-v4` và `https://www.cloudflare.com/ips-v6` trước khi dán (mạng của
  session review không mở được hai trang đó; danh sách dưới là bản đã ổn định từ 2023):
  `loopback,linklocal,uniquelocal,173.245.48.0/20,103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,141.101.64.0/18,108.162.192.0/18,190.93.240.0/20,188.114.96.0/20,197.234.240.0/22,198.41.128.0/17,162.158.0.0/15,104.16.0.0/13,104.24.0.0/14,172.64.0.0/13,131.0.72.0/22,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2a06:98c0::/29,2c0f:f248::/32`
  Rồi mở `https://api.nexora-travel.agency/health` từ Wi-Fi và từ 4G: `clientIp` mỗi lần phải bằng IP công khai
  của mạng đó (so với `https://api.ipify.org` mở trên cùng mạng), hai lần khác nhau. Ra IP dạng `162.158…`,
  `172.64…` tới `172.71…` là chưa ăn: xoá ô để quay về mặc định và báo lại. Deploy hỏng ngay sau khi lưu thì
  một CIDR gõ sai: sửa ô hoặc xoá ô. `PUBLIC_READ_THROTTLE_MODE` giữ `log`.
- Buổi test tay, trên production sau khi bản này deploy. Bước 1 và 2 chỉ đọc (không cookie, không lệnh nào được
  thi hành).
  1. (F1-01) Từ Git Bash:
     `curl -si -X OPTIONS "https://api.nexora-travel.agency/api/%61dmin/bookings" -H "Origin: https://www.nexora-travel.agency" -H "Access-Control-Request-Method: GET" | grep -i "^access-control-allow-origin"`
     không in ra dòng nào.
  2. (F1-01) `curl -si -X POST "https://api.nexora-travel.agency/api/%61dmin/bookings/BK-X/refund" -H "Content-Type: application/json" -H "Sec-Fetch-Site: cross-site" -d "{}" | head -1`
     ra `403` (trước bản này là `401`).
  3. Admin làm một thao tác ghi thường (duyệt một review hay đổi trạng thái một enquiry) và khách chưa đăng
     nhập gửi hai, ba câu cho trợ lý chat: cả hai chạy như cũ.
  4. Làm nóng API 1 tới 2 phút trước demo: mở `https://api.nexora-travel.agency/health`, đợi ra `ok`.
  5. (F1-11) Gặp một lỗi 500 thật trong buổi test thì mở issue trên Sentry: phần request chỉ có method và path.
- Đề xuất F1-07, không gấp: `scripts/docs-freshness.sh` kiểm theo NGÀY, nên đã có một entry ngày D thì mọi
  commit feat hay fix lên `main` cùng ngày mà thiếu entry riêng vẫn xanh, trong khi luật 13 hứa chặn từng lượt
  gộp. Cách làm: đếm commit feat và fix sau commit cuối cùng có sửa `docs/CHANGELOG.md`, khoảng 10 dòng, thử
  trên repo tạm. Rủi ro: entry viết trong commit đứng trước commit fix là CI `main` đỏ. Chưa làm vì đây là cổng
  của `main`, sát freeze.
- Ghi lại, không sửa: F1-09 production không bắt buộc `ADMIN_EMAILS`, `EMAIL_FROM` (ô trống rơi về
  `admin@tourism.test`, `noreply@tourism.test`; thêm chốt boot khi không đọc được env Render là có thể chặn
  deploy kế); F1-13 chạm trần 50 000 bucket thì đuổi cả bucket đang block (khoảng 45 000 POST tới
  `/api/auth/<chuỗi ngẫu nhiên>`; nếu cần, đuổi bucket hết block trước, khoảng 10 dòng); F1-14
  `pnpm-workspace.yaml` còn `libs/web/*` và vài mục `minimumReleaseAgeExclude` cũ; F1-15 JSDoc gốc của
  `contract.ts` còn ghi "contract v1 — health + catalog read public"; F1-16 `totalPages` tính tay ở 8 chỗ dù có
  `toPaged`; F1-17 regex hex của `check-mobile-tokens-only.mjs` có thể báo nhầm chuỗi như `'#add'`; F1-18 JSDoc
  đầu `auth.config.ts` ghi `requireEmailVerification` false trong khi code là `true` từ 20/08. L1-16 (trần mặc
  định của Better Auth cho `/get-session`) giữ quyết định cũ; sau F1-10 thì SSR chỉ còn chia IP của Vercel.
- Dọn nhánh `fix/review-f1-api-ci-config-6sek70` trên origin nếu GitHub không tự xoá.

## 2026-10-26 — Merge review A1 admin vận hành: hai bộ đếm huỷ của báo cáo tháng chỉ đếm khách tự huỷ, thẻ dashboard đọc tươi, sổ thanh toán và sổ hoàn dễ đọc hơn, nhãn "Revenue (gross)" và cột Created ở `/bookings` (`6c4caec`)

Luồng A1 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `e8fdfee`, rebase lên `4b40972` trước khi đẩy. Báo
cáo đủ 36 phát hiện (12 sửa ở đây, 2 sửa ở PR #60 của A5, 3 chuyển coordinator, 2 đề xuất làm theo lựa chọn của
Yuri, 1 đề xuất còn treo, 1 bỏ, 15 ghi lại) từng nằm ở `code-review/A1-bao-cao.md` của thư mục chung; thư mục ấy đã
được dọn trước lúc merge, nên các bước test tay và việc còn treo chép ở mục CÒN TREO dưới đây. Nhánh
`fix/review-a1-admin-ops-n6iayk`, [PR #61](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/61), thi công
trên session cloud. Đụng api (thống kê, sổ hoàn), admin (dashboard, `/bookings`, chi tiết đơn, sổ thanh toán),
i18n và JSDoc của contract: không migration, không đổi kiểu contract, không biến env, không dependency mới.

- `a25f094` (A1-01, P1): hai bộ đếm "Cancelled within the deadline" và "Cancelled after the deadline" của báo cáo
  tháng (màn hình, bản in, sheet Operations) đếm cả lượt công ty huỷ chuyến, vì đường F13 ghi yêu cầu huỷ
  `REFUNDED` với `decided_by` là admin. Owner huỷ một chuyến có sáu đơn đã trả, ba ngày trước ngày đi, thì báo cáo
  ghi "Cancelled after the deadline: 6" ngay trên câu "after the deadline means no automatic refund", dù cả sáu đơn
  được hoàn đủ. Nay `cancellationOutcomesSlice` chỉ đếm yêu cầu có `decided_by = user_id`, cùng phép so với cờ
  `decidedByCustomer` của contract; câu định nghĩa thành "Customer cancellations are counted…"; ADR-0033 AMEND 4.
  Seed che lỗi này (đơn công ty huỷ của seed còn dạng trước F13), nên nó chỉ hiện từ lượt huỷ chuyến thật đầu tiên.
- `cfaf0a6` (A1-02): ở chi tiết đơn của admin, lượt công ty huỷ từng ghi "After the free-cancellation deadline (…)"
  cạnh "Refunded $117.00". Yêu cầu không do khách quyết trên chuyến đã huỷ nay in "Departure called off, so the
  deadline does not apply", vẫn in số đã hoàn.
- `a91035e` (A1-03): bốn thẻ của `/` dùng chung fetcher có cache 60 giây với `/bookings`, mà Data Cache là
  stale-while-revalidate, nên thẻ mang số của lượt xem trước trong khi biểu đồ và bảng ngay dưới đã có khoản trả
  mới. Nay `fetchDashboardBookingsStats` đọc không cache; ADR-0036 AMEND 3. Lúc rebase sau PR #60, header
  `lib/api/stats.ts` và đoạn "Không đổi" của AMEND 3 ghi theo khoá cache theo khung `x-admin-cache-window`: trần 60
  giây của `/bookings` và `/reviews` nay là thật, còn `/` vẫn đọc tươi vì thẻ đứng cạnh biểu đồ không cache.
- `703878a` (A1-04, A1-05, A1-06): sổ thanh toán. Ghi chú của handler ("operator must refund manually") từng chỉ thấy
  khi mở đúng row, vì row ấy đã có mốc Processed; nay bảng có badge "Handler note" cạnh mốc ấy, nguyên văn ở tooltip.
  Row hoàn tiền do chính hệ thống ghi có tiêu đề "What we recorded for this refund" thay cho "What the payment
  provider sent". Mốc tạo event của Stripe và PayPal mang nhãn "Event created" thay cho "Received at", vốn trùng tên
  với field Received của drawer.
- `97610ba` (A1-07): `/bookings` đang lọc thêm tìm kiếm hay trạng thái mà rỗng thì từng báo "No bookings were created
  between …", như thể lỗi do khoảng ngày; nay là "No matching bookings were created between …". Cùng khuôn ở bảng
  review (L5) và subscriber (L6) để lại, đã báo coordinator.
- `12fc4c4` (A1-08): lý do hoàn dài trên sổ hoàn của chi tiết đơn xuống dòng thay vì bị cắt.
- `fee55c8` (A1-09): `fetchAdminBookings` luôn gửi `includeMedia: false`; bảng và route xuất file không in ảnh tour,
  nên API thôi chạy thêm một câu tìm ảnh mỗi lần lọc hay phân trang. Contract giữ mặc định `true`.
- `1856baf` (A1-10): hai cảnh báo thiếu giá vốn của báo cáo tháng chia số ít, số nhiều ("1 booking has…").
- `9e15ee6` (A1-11, L4-22): dòng sổ hoàn của API trả "30.00" thay cho "30" và "20.5".
- `8c03495` (A1-12): sửa comment nói sai code ở module stats, báo cáo tháng, contract và danh sách đơn; không đổi
  hành vi.
- `fa8bd42` (A1-19): thẻ tiền của `/` và `/bookings` ghi "Revenue (gross)", đúng tên dòng của khối "Money and
  operations" ở báo cáo tháng: số ấy là tiền thu theo `paid_at`, không trừ khoản hoàn.
- `6c4caec` (A1-18): `/bookings` lọc theo ngày đặt mà bảng chỉ in ngày đi; nay có cột Created ngay sau Tour, hai
  dòng ngày và giờ UTC, ẩn được ở menu Columns. Cột không đứng cuối vì nút Export treo đè lên nửa phải tiêu đề cột
  cuối (bản đầu đặt cuối thì nút che chữ "Created" ở 1440px). Bảng vừa khung từ 1366px; ở 1280px tràn chừng 25px và
  nút Export che đuôi chữ Customer, thân bảng đủ chữ.

**Review.** Không có lượt review độc lập; mỗi phần sửa có test đỏ trên mã cũ: A1-01 (1 int), A1-02 tới A1-05 (mỗi
phần 1), A1-06 (1 assertion thêm vào test sẵn có), A1-07 (3), A1-08 (1), A1-09 (2), A1-10 (1), A1-11 (2 assertion
int đổi theo), A1-18 (5), A1-19 (1); ba ca canh hành vi đúng (A1-02, A1-03, A1-05) xanh ở cả hai bản. Bốn trọng tâm
của kế hoạch đều pass: cùng một khoảng ngày thì dashboard, `/bookings`, báo cáo tháng và Excel ra cùng số; hoàn
ngoại lệ không vượt phần còn hoàn được, không chạy hai lần, Staff không làm được; route xuất file kiểm quyền như
trang; bản in mười tháng 01–10/2026 của seed local mỗi tờ một trang A4. Giả định "ngày cắt theo giờ Việt Nam" của kế
hoạch sai: code cắt theo UTC có chủ đích (ADR-0028 §3, ADR-0036 §2) và mọi nhãn đều ghi UTC. A1-13 (cache không trần
của `/bookings`, `/reviews`) và A1-14 (lịch lọc chọn được ngày tương lai) sửa ở PR #60, xem entry A5. A1-15 và A1-16
(lượt tra phiên không có timeout khi API ngủ) đã gộp vào đề xuất A5-12 ở entry A5. A1-21 bỏ vì Yuri chọn "Không làm"
ở thẻ F2-04. Yuri chọn "Làm cả hai" cho A1-18 và A1-19, rồi bảo đẩy lên main 26/10 01:32 UTC.

Tests after (`gate:int` trên `6c4caec`, nền `4b40972`, 26/10, session cloud, API sống ở :3001): unit 8487 (web
2469, admin 2456, api 1449, mobile 961, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
982; Biome 2120 file; RLS, tokens-only của mobile và prerender admin xanh. Test contract chạy với
`--max-old-space-size=6144` như entry A3, A4 và A5, 812/812. PR thêm 19 test unit ở admin và 1 int test.

**CÒN TREO:**

- Buổi test tay, trên production. Theo luật demo của F2: không hoàn, không huỷ trên đơn seed đã trả; dùng một đơn
  mới trả bằng thẻ 4242. Bước 1 tới 5 dùng chung đợt và đơn với bước 3 của L4 (công ty huỷ chuyến): làm bước 2 tới
  4 trước khi huỷ đợt.
  1. Chuẩn bị: Owner tạo một đợt mới cho một tour. Trước khi khách trả, ghi lại thẻ "Revenue (gross)" và Paid
     bookings của `/`, và hai dòng "Cancelled within the deadline", "Cancelled after the deadline" của `/reports`
     tháng hiện tại.
  2. (A1-03) Khách đặt một chỗ trên đợt ấy và trả bằng thẻ 4242. Tải lại `/` một lần: thẻ tiền tăng đúng tổng đơn,
     Paid bookings tăng 1, cùng lúc với cột hôm nay của biểu đồ. Phần `/bookings` đo ở bước 10 của A5.
  3. (A1-08) Ở chi tiết đơn ấy, hoàn một phần (ví dụ $10) với lý do dài khoảng 300 ký tự: sổ hoàn in đủ lý do,
     xuống nhiều dòng.
  4. (A1-05, A1-06) `/payment-events`: row "payment.refunded" vừa sinh có tiêu đề payload "What we recorded for this
     refund"; row Stripe của lần trả ở bước 2, chế độ Simple, có nhãn "Event created". Badge "Handler note" (A1-04)
     chỉ hiện khi handler ghi chú (lệch tiền, hoàn tự động hỏng), không tạo an toàn trên prod được; test unit canh.
  5. (A1-01, A1-02) Huỷ đợt ở bước 1 kèm lý do (bước 3 của L4), đợi job hoàn phần còn lại. Tải lại `/reports`: hai
     dòng ghi ở bước 1 không đổi, dòng Refunds có thêm khoản hoàn, khối định nghĩa ghi "Customer cancellations are
     counted on the day they were made…". Chi tiết đơn của admin: dòng lịch sử huỷ ghi "Departure called off, so the
     deadline does not apply" cạnh số đã hoàn. Rồi in `/reports` tháng hiện tại và một tháng cũ (Print, lưu PDF):
     mỗi tờ một trang, đủ khối chú giải và chân trang.
  6. (A1-07, A1-18, A1-23) `/bookings`, giữ khoảng ngày mặc định, tìm "zzz": bảng ghi "No matching bookings were
     created between …". Xoá ô tìm: cột Created (ngay sau Tour) in ngày đặt hai dòng, đơn ở bước 2 mang ngày hôm
     nay; chữ Customer và nút Export không chồng nhau trên màn laptop; trên điện thoại cột ẩn được ở menu Columns.
     Bấm Export một lần và đợi file về: `/activity` có đúng một dòng "Exported bookings" với số dòng khớp file.
- Đề xuất A1-20 chờ Yuri, không gấp: thứ tự khối định nghĩa của `/reports` trên màn hình khác bản in và Excel, dù
  comment `report-print.ts` hứa "giấy và file đọc như nhau"; gốc là các danh sách chỉ số chép nhiều nơi. Cách làm:
  export `DEFINITION_ORDER` và các danh sách từ `reports-view.ts` cho cả ba bề mặt, khoảng 3 file, 40 tới 60 dòng,
  test hiện có canh đủ.
- A1-17 (ghi lại, đã báo coordinator): comment ở mười file action dưới `apps/admin/src/app/(admin)/` của A2, A3, L5,
  L6 còn ghi quyền gác là "`AuthGuard` + `@Roles(ADMIN)`", trong khi từ ADR-0052 Staff gọi được phần lớn các thủ
  tục ấy. Sửa kèm khi file ấy có dịp.
- Dọn nhánh `fix/review-a1-admin-ops-n6iayk` trên origin nếu GitHub không tự xoá.

## 2026-10-26 — Merge review A5 khung admin, quyền, nhân sự, nhật ký thao tác: nhật ký bỏ lệnh trùng hiện trạng, Sign out hỏi trước khi bỏ bản nháp, lịch lọc ngày dừng ở hôm nay, thẻ số liệu không cũ quá 60 giây (`5d5272c`)

Luồng A5 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `e8fdfee`, rebase lên `e586945` trước khi đẩy. Báo
cáo đủ 12 phát hiện (7 sửa ở đây, gồm hai mục luồng A1 chuyển sang; 4 ghi lại; 1 đề xuất) và một việc giao đọc lại
test của L1 (sạch) từng nằm ở `code-review/A5-bao-cao.md` của thư mục chung; thư mục ấy đã được dọn trước lúc
merge, nên các bước test tay và đề xuất còn treo chép ở mục CÒN TREO dưới đây. Nhánh
`fix/review-a5-admin-shell-n9pad7`, [PR #60](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/60), thi
công trên session cloud. Đụng api (mô tả của nhật ký thao tác), admin (menu tài khoản, kit, form đăng nhập, client
API) và i18n (một khoá ở `admin.login.errors`): không migration, không đổi contract, không biến env, không
dependency mới.

- `02dca26` (A5-01, A5-02; L5-17 và A2-20 chuyển sang): `reviews.moderate` và `departures.setStatus` không trả cờ
  `changed`, nên duyệt lại từ tab thứ hai một review đã duyệt, hay đóng một chuyến đã đóng, từng thêm một dòng vào
  `/activity` như thể có người vừa quyết lại. Nay bước `before` đọc dấu trước khi chạy: `moderatedAt` cho review
  (mọi quyết định thật đặt mốc mới), `version` (`updatedAt`) cho chuyến. Không so trạng thái, để không bỏ sót
  lệnh đổi thật khi admin khác vừa đảo trạng thái giữa chừng; đọc dấu lỗi thì vẫn ghi như một lệnh có đổi.
- `8236834` (A5-03, A2-18): `SafeImg` giữ dấu ảnh hỏng theo đúng `src` (`brokenSrc === src`). Effect đo lại sau
  mount từng xoá dấu khi sự kiện `error` tới trước nó, nên ô hiện ảnh vỡ thay cho "Photo unavailable"; đó là
  nguồn flake của `photo-library-dialog.spec.tsx` (5 lần liền xanh sau sửa).
- `1af8457` (A5-04, L1-12): form đăng nhập admin gặp 429 của Better Auth (3 lần trong 10 giây) báo "Too many
  attempts. Please wait a minute." thay cho câu chung mời bấm lại.
- `c287e1b` (A5-05, A2-17): Sign out nằm ở sidebar, ngoài `UnsavedChangesProvider`, và không phải link, nên từng
  đăng xuất ngay dù khu sửa tour hay bài viết còn bản nháp chưa lưu. Nay `requestLeave(proceed)` phát một sự kiện
  huỷ được ở `window`; provider đang có thay đổi mở đúng hộp "Discard unsaved changes?", chỉ Discard changes mới
  đăng xuất. `kit/unsaved-changes.tsx` là file kit của A2, sửa có phép của coordinator.
- `54f9159` (A5-10, A1-14): lịch lọc khoảng ngày của `/bookings`, `/reviews`, `/subscribers` và `/activity` cho
  chọn tới hai năm sau, trong khi cả bốn vùng lọc theo ngày tạo. Chọn 05–10/11 vào ngày 20/10 thì bảng rỗng, còn
  hàng thẻ của `/bookings` ghi "Oct 20 – Oct 20, 2026", Revenue $0.00. Nay ngày sau hôm nay bị khoá và dropdown năm
  dừng ở năm nay. "Hôm nay" là ngày UTC (`utcToday`), cùng phép cắt ngày của API, nên từ 00:00 tới 07:00 giờ Việt
  Nam ô hôm nay cũng bị khoá. URL gõ tay vẫn mang được ngày tương lai; khi ấy API trả kỳ rỗng như ADR-0028.
- `5d5272c` (A5-11, A1-13): `cacheFor` của bộ số `/bookings` và `/reviews` dùng `next.revalidate: 60`, mà Data
  Cache của Next là stale-while-revalidate: lượt mở đầu sau một quãng dài nhận số của lượt xem trước, có khi từ
  hôm trước, lệch với bảng ngay dưới. Nay `withAdminOptions` gắn header `x-admin-cache-window` bằng
  `floor(now / ttl)`. Khoá cache của Next gồm mọi header (đọc ở next 16.3.8, `patch-fetch.js` và
  `generateCacheKey`), nên entry của khung trước không bao giờ được đọc lại và trần 60 giây mà ADR-0036 §2 chấp
  nhận thành thật. API không đọc header này. Sửa hai comment sai ở `client.ts` (no-store "vô điều kiện"; khoá
  "không gồm cookie", thật ra entry theo từng phiên). Trên `main` lúc này bốn thẻ của `/` cũng đi đường này cho
  tới khi PR #61 (A1-03) bỏ cache ở đó; theo luật của coordinator, #61 lên sau nên #61 sửa header `stats.ts` và
  đoạn "Không đổi" của ADR-0036 AMEND 3 cho khớp.

Spec nhật ký thao tác (§3, §8) ghi thêm luật lệnh trùng hiện trạng; spec P4e-3a §2i ghi Sign out cũng hỏi.

**Review.** Không có lượt review độc lập; mỗi phần sửa có test đỏ trên mã cũ: A5-01 và A5-02 (3 unit, 2 int),
A5-03, A5-04 và A5-05 (mỗi phần 1), A5-10 (4), A5-11 (1); hai ca canh hành vi cũ (quyết định thật vẫn ghi, Sign
out khi không có bản nháp) xanh ở cả hai bản. Bốn trọng tâm của kế hoạch và phần security header đều pass: ba lớp
quyền khớp nhau cho mọi trang và ba route xuất file; khoá tài khoản thu mọi phiên trong cùng transaction, Owner
không tự hạ quyền hay tự khoá mình; mọi lệnh ghi admin có một dòng nhật ký, lệnh lỗi không có (sau A5-01, A5-02);
kit giữ focus và về trang 1 khi lọc; CSP theo nonce. Đọc lại bản sửa test của L1 (L1-18): sạch. Để lại A5-07
(Sign out bỏ qua kết quả của `signOut()` khi API ngủ: bấm như không ăn, bấm lại khi API thức là được) và A5-08
(tài khoản không tên thì tooltip ở cột icon rỗng). A5-09 đã thành đề xuất A3-09 ở entry A3. Đề xuất A5-06 và A5-12
ở mục CÒN TREO. Yuri bảo đẩy lên main 26/10 00:59 UTC.

Tests after (`gate:int` trên `5d5272c`, nền `e586945`, 26/10, session cloud, API sống ở :3001): unit 8468 (web
2469, admin 2437, api 1449, mobile 961, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
981; Biome 2115 file; RLS, tokens-only của mobile và prerender admin xanh. Test contract chạy với
`--max-old-space-size=6144` như entry A3 và A4, 812/812. PR thêm 13 test unit (admin 9, api 4) và 2 int test.

**CÒN TREO:**

- Buổi test tay, trên production. Dùng tài khoản thử, không dùng khách của seed; xong thì mở khoá và thu Staff để
  trả hiện trạng.
  1. Đăng nhập Staff: sidebar không có Reports, Payment events, Users, Activity; gõ thẳng `/activity` thì ra trang
     Not authorized với câu dành cho Staff.
  2. Owner cấp Staff cho một khách thử đã xác minh, rồi thu lại: tab đang đăng nhập của người ấy văng ra ở lần tải
     trang kế; trang chi tiết của người ấy có hai dòng lịch sử tương ứng.
  3. Khoá tài khoản thử đang đăng nhập ở một trình duyệt khác: lần tải trang kế về `/login`, đăng nhập lại thì báo
     tài khoản bị khoá; lịch sử có dòng khoá kèm lý do. Mở khoá.
  4. `/activity` có đúng một dòng cho mỗi thao tác ở bước 2 và 3.
  5. (A5-01) Mở cùng một review chờ duyệt ở hai tab. Tab 1 Approve; tab 2 Approve mà không tải lại: `/activity`
     chỉ có một dòng duyệt review ấy.
  6. (A5-02) Mở tab Departures của một tour ở hai tab, Close cùng một chuyến chưa ai đặt ở cả hai: `/activity` có
     một dòng đóng chuyến. Mở lại chuyến ấy cho đúng hiện trạng.
  7. (A5-05) Sửa một ô ở bước Details của một tour, không lưu, mở menu tài khoản, bấm Sign out: hộp "Discard
     unsaved changes?" hiện. Keep editing thì ở lại, chữ vừa gõ còn nguyên. Bấm Sign out lần nữa rồi Discard
     changes: về `/login`. Đăng nhập lại, không sửa gì, Sign out thì đi ngay.
  8. (A5-04) Trang đăng nhập admin, gõ sai mật khẩu 4 lần liền trong 10 giây: lần thứ tư báo "Too many attempts.
     Please wait a minute."; chờ một phút rồi đăng nhập đúng được.
  9. (A5-10) `/bookings`, mở lịch lọc ngày: ngày sau hôm nay mờ và bấm không được, dropdown năm dừng ở năm nay.
     Chọn một khoảng kết thúc hôm nay: bảng và hàng thẻ cùng nói về khoảng ấy. Test trong khoảng 00:00 tới 07:00
     giờ Việt Nam thì ô hôm nay cũng bị khoá, đúng thiết kế.
  10. (A5-11) Ghi số ở thẻ New bookings của `/bookings`. Đặt một đơn mới bên web (thẻ 4242). Chờ ít nhất một phút
      rồi tải `/bookings` một lần: thẻ đã tăng và khớp số dòng của bảng, không cần tải lại lần hai. Bước này thay
      cho ghi chú A1-13 trong các bước test tay của A1.
  11. (A5-12, đo, tuỳ chọn) Để API nhàn rỗi ít nhất 15 phút, phiên admin còn hạn. Mở thẳng `/bookings`, ghi thời
      gian chờ và thứ hiện ra (bảng, khối lỗi, hay trang lỗi có Retry). Một lần nhàn rỗi khác, bấm Export ở
      `/bookings`: ghi tải được file, ra câu 502 có lời, hay trang 504 của Vercel, cùng tổng thời gian.
- Đề xuất A5-12 chờ Yuri (file của L1 và A1): lượt tra phiên ở `lib/api/session.ts` không có timeout. API Render
  ngủ thì trang chờ API thức (khoảng 50 giây, số đo G23) trong khi các lệnh đọc chạy song song bị cắt ở giây thứ
  10; route export cộng dồn chờ phiên, tra email, ngân sách gom 45 giây và ghi nhật ký nên có thể quá
  `maxDuration = 60` và ra trang 504 của Vercel. Không thêm timeout vào lượt tra phiên dùng chung: layout coi
  `unreachable` là chưa đăng nhập và redirect `/login`, nên mỗi lần API thức dậy sẽ đẩy admin về trang đăng nhập dù
  phiên còn nguyên. Cách đề xuất: một hạn chót chung cho cả GET của ba route export (tra phiên, tra email, gom
  trang, ghi nhật ký) dưới 60 giây, hết hạn thì 502 có lời, khoảng 30 dòng và 2 tới 3 test; trang thì chờ phiên
  xong mới đọc, hoặc thử lại một lần lệnh đọc bị `TimeoutError` (đụng 15 trang). Luật demo đánh thức API trước khi
  trình bày che được cả hai.
- Đề xuất nhỏ A5-06 chờ Yuri: 429 của trần ghi admin (60 lệnh trong 60 giây) rơi vào câu "kết cục không rõ" nên hộp
  xác nhận đóng và mất chữ đang gõ, trong khi lệnh chắc chắn chưa chạy. Cách làm: mã transport `RATE_LIMITED` ở
  `write-error.ts` giữ hộp mở kèm câu chờ một phút; 1 khoá i18n, 2 tới 3 test; đổi hành vi của mọi lệnh ghi admin.
- Dọn nhánh `fix/review-a5-admin-shell-n9pad7` trên origin nếu GitHub không tự xoá.

## 2026-10-26 — Merge review A3 admin danh mục, điểm đến, bài viết: mũi tên đổi chỗ danh mục báo lỗi và giữ focus, đổi tên danh mục làm tươi trang tour, test canh slug bài viết và link `javascript:` (`1eec242`)

Luồng A3 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `e8fdfee`, rebase lên `ef3a211` trước khi đẩy. Báo
cáo đủ 9 phát hiện (3 lỗi sửa ở đây, 1 dòng sửa comment, 2 test canh hành vi đang đúng, 2 ghi lại, 1 đề xuất chuyển
từ luồng A5) từng nằm ở `code-review/A3-bao-cao.md` của thư mục chung; Yuri đã dọn thư mục ấy trước lúc merge, nên
các bước test tay và đề xuất còn treo chép ở mục CÒN TREO dưới đây. Nhánh `fix/review-a3-admin-content-s8ij19`,
[PR #59](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/59), thi công trên session cloud. Đụng admin (khu
`/categories`, test trình soạn bài viết), api (danh mục, một int test bài viết) và comment của contract: không
migration, không đổi schema contract, không biến env, không dependency mới, không đổi chữ hiển thị.

- `30127b7` (A3-01, A3-03): mũi tên đổi chỗ trên `/categories`. Lệnh đổi chỗ ném (mạng đứt, redeploy giữa chừng)
  từng thành unhandled rejection và admin không thấy toast nào; nay `catch` hiện câu chung của lệnh đổi chỗ, bảng
  vẫn làm mới. Người dùng bàn phím từng mất focus sau mỗi cú bấm: Chromium 141 đẩy focus về `<body>` khi nút đang
  giữ focus bị `disabled` và khi hàng của nó bị dời trong DOM, còn `useRowFocusRescue` chỉ phủ ca phần tử bị gỡ.
  Nay nhớ mũi tên vừa bấm và trả focus trong `useLayoutEffect` khi bảng hết bận; hàng chạm đầu hay cuối thì về
  mũi tên còn lại; người dùng đã tự đi chỗ khác thì không giành lại. Vòng focus chỉ hiện khi bấm bằng phím.
- `20549e1` (A3-02): đổi tên danh mục chỉ bust `tours`, nên trang `/tours/<slug>` (breadcrumb, dòng chữ trên tiêu
  đề, câu meta dự phòng) giữ tên cũ tới hết 300 giây ISR. Nay lệnh sửa bust thêm `tour:<slug>` của mọi tour thuộc
  danh mục (`renamedTags`), như `writtenTags` của điểm đến (G5); ẩn hiện vẫn chỉ bust `tours`. API chia lô 20 tag
  mỗi lệnh nên danh mục nhiều tour không vượt trần của route web.
- `db36b27` (A3-05) và `1eec242` (A3-06): hai lưới cho hành vi đang đúng. Int test: lệnh lưu bài viết gửi kèm slug
  khác thì slug ở kết quả, ở DB và ở tag bust vẫn là slug cũ (danh mục và điểm đến đã có ca này). Test tab Preview
  của trình soạn bài viết (cùng `ArticleMarkdown` với web): `[Click](javascript:alert(1))`, `<script>` và
  `<img onerror>` không thành mã chạy được. Contract chỉ chặn HTML thô và ảnh nên link `javascript:` vẫn lưu được;
  lớp chặn là `urlTransform` mặc định của react-markdown, lớp sau là React 19. Phá thử `urlTransform` thì test đỏ.
- `b2c0f55` (A3-04): sửa comment nói sai code: khoá của lệnh đổi chỗ danh mục trong contract (thật ra là một khoá
  advisory cả bảng, `withCategoryOrderLock`), "khoá phụ `id`" không có thật, "năm thao tác" của điểm đến (nay là
  tám), `setPhotos` mang transaction riêng, JSDoc nằm nhầm chỗ ở `destinations-write.ts`.

Spec P4e-2 §4 mục 4 ghi thêm tag `tour:<slug>` khi sửa danh mục.

**Review.** Không có lượt review độc lập; A3-01, A3-02 và A3-03 có test đỏ trên mã cũ (1 test admin, 1 int test, 3
test admin), A3-06 kiểm bằng đột biến. Bốn trọng tâm của kế hoạch đều pass: markdown không chèn được HTML hay
script, slug không đổi được, xoá danh mục hay điểm đến đang có tour bị chặn ở cả API lẫn giao diện, web làm tươi
đúng tag sau khi sửa (sau A3-02). Để lại A3-07 (hai danh mục ngang `order`, chỉ có khi sửa DB bằng tay) và A3-08
(G1, lệnh đổi chỗ trả cả danh sách mà client bỏ đi). Đề xuất A3-09 ở mục CÒN TREO. Yuri bảo đẩy lên main 26/10
00:25 UTC.

Tests after (`gate:int` trên `1eec242`, nền `ef3a211`, 26/10, session cloud, API sống ở :3001): unit 8455 (web
2469, admin 2428, api 1445, mobile 961, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
979; Biome 2113 file; RLS, tokens-only của mobile và prerender admin xanh. Test contract chạy với
`--max-old-space-size=6144` như entry A4 (container mới để trần heap Node thấp), 812/812. PR thêm 5 test unit
(admin) và 2 int test.

**CÒN TREO:**

- Buổi test tay, trên production:
  1. `/categories`, chỉ dùng bàn phím: Tab tới mũi tên lên của danh mục nằm cuối danh sách, bấm Enter hai lần.
     Hàng lên hai bậc, vòng focus vẫn ở mũi tên lên. Tab sang mũi tên xuống, bấm Enter tới khi hàng về cuối: lúc
     chạm cuối, focus nhảy sang mũi tên lên của chính hàng đó. Bấm bằng chuột thì không hiện vòng focus.
  2. Đổi tên một danh mục đang có tour đã đăng (thêm chữ " test" vào cuối tên). Trong khoảng một phút, mở trang
     một tour của danh mục ấy trên www: breadcrumb và dòng chữ nhỏ trên tiêu đề in tên mới. Đổi lại tên cũ ngay.
- Đề xuất A3-09 (chuyển từ A5-09) chờ Yuri, sau buổi demo: `categories.setActive` và `destinations.setActive` ghi
  không điều kiện, nên ẩn hay hiện lại một hàng vốn đã ở đúng trạng thái (tab mở từ trước, hai admin cùng bấm) vẫn
  `UPDATE`, nhích `updatedAt` và thêm một dòng thừa vào `/activity`; với điểm đến, `updatedAt` là phiên bản của
  trang Photos nên trang Photos đang mở gặp `STALE_DESTINATION` oan khi lưu. Cách làm: `updateMany` có điều kiện
  `isActive`, trả thêm `changed`, describer trả null khi `changed` là false như `tours.setPublished`; vẫn bust như
  `setTourPublished`. Khoảng 6 file mã (35 dòng) và 3 file test (50 dòng); chỉ thêm trường vào output nên Render
  hay Vercel deploy trước đều được. Đụng `activity-describers.ts` của A5, nên làm sau khi PR #60 lên `main`.
- Dọn nhánh `fix/review-a3-admin-content-s8ij19` trên origin nếu GitHub không tự xoá.

## 2026-10-22 — Merge review A4 admin Appearance và thư viện ảnh: hộp Replace không lưu khi chưa đổi gì, Restore original nói đúng về ảnh đã rời thư viện, test liên luồng cho ảnh khe đang mượn (`29d8c19`)

Luồng A4 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `e8fdfee`, rebase lên `f5877b7` trước khi đẩy. Báo
cáo đủ 10 phát hiện (2 sửa ở đây, 1 test canh hành vi đang đúng, 7 ghi lại): `code-review/A4-bao-cao.md` cùng thư
mục. Nhánh `fix/review-a4-admin-appearance-media-20h631`,
[PR #58](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/58), thi công trên session cloud. Đụng admin (khu
`/appearance`), i18n (khối `admin.appearance`) và một int test của api: không migration, không đổi contract, không
biến env, không dependency mới.

- `9a6ac8d` (A4-01): hộp Replace mở sẵn ảnh đang dùng, nên bấm Save khi alt chưa đổi từng gửi `setSlot`: phiên bản
  khe nhích (người khác đang mở khe ấy gặp `STALE_SLOT`), cache `site-media` của web bị bust và `/activity` thêm một
  dòng "Replaced site image" dù không có gì thay. Nay hàm thuần `isUnchangedSlotDraft` chặn ở admin theo khuôn
  `canSaveMedia` của Media library: hộp nhắc "Choose a new photo or change the alt text first.", sửa alt là lưu
  được.
- `2a7c553` (A4-02): khe mượn ảnh của một điểm đến, rồi điểm đến gỡ ảnh ấy khỏi trang Photos, thì khe mang nguồn
  `OTHER` mà hộp Restore original vẫn hứa "The current photo can be picked again from the library." Nay nguồn
  `OTHER` có câu riêng "The current photo isn’t in the library, so it can’t be picked again."
- `29d8c19` (A4-03, câu hỏi L8-15 của luồng L8): Media library không có đường xoá ảnh (ADR-0060 §5), còn bộ dọn
  kiểm tham chiếu trên mọi chủ, nên ảnh đang gắn vào khe không bị xoá. Int test mới canh đúng ca liên luồng: điểm
  đến gỡ ảnh khe đang mượn, quá hạn 7 ngày bộ dọn vẫn hoãn, khe về ảnh gốc thì ảnh mới chuyển sang chờ dọn. Thử
  đột biến: bỏ chủ `SITE` khỏi phép kiểm tham chiếu thì test đỏ.

Spec P4f Appearance ghi thêm đường ra nguồn `OTHER` (§5) và luật Save khi chưa đổi gì (§6.2).

**Review.** Không có lượt review độc lập; A4-01 và A4-02 có test đỏ trên mã cũ (1 hàm thuần, 1 ca hộp Replace, 1
ca thẻ khe), A4-03 kiểm bằng đột biến. Để lại A4-04 đến A4-10: lưới `/media` in "No photo matches these filters."
khi DB chưa có ảnh nào; hộp Replace không nói gì về ảnh nguồn `OTHER`; khe mili giây giữa phép kiểm tham chiếu và
lệnh destroy của bộ dọn; `setSlot` nhận publicId tải lên sâu hơn vùng tải lên của bộ dọn với lệnh Staff tự chế
(rò ảnh, không mất ảnh); `altVaries` của API theo alt thô; câu của khung xem trước `null`; `libraryPublicIds` chép
hai nơi. Yuri bảo đẩy lên main 22/10 01:30 UTC.

Tests after (`gate:int` trên `29d8c19`, nền `f5877b7`, 22/10, session cloud, API sống ở :3001): unit 8450 (web
2469, admin 2423, api 1445, mobile 961, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
977; Biome 2113 file; RLS, tokens-only của mobile và prerender admin xanh. Container mới để trần heap Node
2240 MB nên `src/contract.spec.ts` (46 test) chết vì hết bộ nhớ ở lượt đầu, cả khi chạy riêng; chạy với
`--max-old-space-size=6144` thì 812/812 xanh. Code contract y như `main`, CI của `main` trên GitHub xanh. PR thêm
3 test unit (admin) và 1 int test.

**CÒN TREO:**

- Buổi test tay: hai bước mục 3 của `code-review/A4-bao-cao.md` (Replace rồi Save ngay thì chỉ nhắc, nhật ký không
  thêm dòng; ảnh thử mượn từ một điểm đến, điểm đến gỡ ra, Restore original in câu mới, tab Cleanup queue có ảnh
  chờ dọn). Bước 2 gộp được với Media B §8.3 của A3. Cuối buổi Restore original mọi khe đã đổi.
- Đề xuất nhỏ A4-05 chờ Yuri: hộp Replace in lại câu `notInLibrary` khi nguồn là `OTHER` (3 dòng, 1 test).
- Dọn nhánh `fix/review-a4-admin-appearance-media-20h631` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review L8 trang chủ, điểm đến, blog và trang tĩnh: blog kẹp `?page=`, ngày và tháng đúng múi giờ, giá "from" của trang vùng, canonical blog, sáu nút xem tour về `/tours` (`4bee6ff`)

Luồng L8 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `f8f8634`, rebase lên `3e78c3f`, `e8fdfee` rồi
`a856dd9` trước khi đẩy. Báo cáo đủ 24 phát hiện (13 sửa ở đây, gồm một của L2 và một do F3 đo ra; một đề xuất để
sau bảo vệ; phần còn lại ghi lại hay chuyển luồng khác): `code-review/L8-bao-cao.md` cùng thư mục. Nhánh
`fix/review-l8-home-blog-xjppea`, [PR #57](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/57), thi công
trên session cloud. Đụng web, i18n (khối `aboutPage.team`) và một comment ở api: không migration, không đổi
contract, không biến env, không dependency mới.

- `7f8c91c` (L8-01): `/blog?page=` lạ được làm tròn xuống và kẹp về trang có thật trước `paginate`, như `/tours`
  ở `d22c2d3`; trước đó `?page=9` ra lưới trắng với dòng "Showing 49–9 of 9".
- `a1b7da1` (L8-02) và `619b811` (L8-22, file của L2 do coordinator giao): ngày đăng ở card, hero bài và tháng
  của đánh giá khoá `timeZone: 'UTC'`; khách ở múi giờ âm từng thấy lùi một ngày hay một tháng, kèm lệch HTML lúc
  hydrate.
- `8871069` (L8-03): ô "From" ở hero trang vùng và giá ô chuyến một ngày đọc `cardPrice()` (ADR-0058), cùng giá
  với thẻ tour; seed local trước đó in "From $35" ở miền Bắc trong khi thẻ rẻ nhất in $28.
- `863165c` (L8-04): API địa điểm lỗi thì hero `/destinations` dùng câu không số thay cho "Three regions, 0
  places.".
- `aa2af57` (L8-05): icon nhóm ở `/faq` gắn theo nhóm, không theo vị trí sau khi lọc.
- `d056024` (L8-06): hàng số liệu hero trang vùng đặt nhãn vào `<dt>`, số vào `<dd>`.
- `4fe49a7` (L8-07): `/blog` và trang bài khai `alternates.canonical`.
- `5c59490` (L8-08): sửa bốn comment nói sai code.
- `26655e5` (L8-23, F3-14 đo bằng axe): mô tả dưới sáu con số ở `/about` đổi `text-foreground/40` (3.06:1) sang
  `text-foreground/80` (7.61:1, 5.67:1 khi rê chuột lên ô); số "01", "02" của mục lục "On this page" bỏ
  `opacity-60` (2.62:1 lên 5.55:1 trở lên).
- `dd0fd2e` (L8-09, Yuri chọn 21/10): sáu nút "View tours", "Browse tours", "Browse the tours" ở trang chủ,
  `/about`, `/contact` và trang 404 trỏ `/tours` thay cho `#tours` của khu Stats trang chủ.
- `d790adc` (L8-10, Yuri chọn 21/10): bỏ icon Website và LinkedIn trỏ `#team` ở khu Team, cùng hai khoá i18n.
- `4bee6ff` (L8-24): tiêu đề khu Team đổi "Four faces," thành "Three faces,"; đội còn ba người từ `22f245f`
  (24/09).

**Review.** Không có lượt review độc lập; mỗi commit sửa có test đỏ trên mã cũ (L8-08 chỉ là comment). Hai đề xuất
L8-09, L8-10 Yuri chọn trên thẻ trong thread L8 ngày 21/10 05:29 UTC; L8-11 (nhánh ghi chú hành trình của ô chuyến
một ngày không chạy trên production) để sau bảo vệ. Tương phản của L8-23 đo trên bản build của nhánh bằng
Chromium theo cách của axe; cùng cách đo ra 3.06 và 2.62 cho bản cũ như axe. Yuri bảo đẩy lên main 21/10 05:29 UTC.

Tests after (`gate:int` trên `4bee6ff`, nền `a856dd9`, 21/10, session cloud, API sống ở :3001): unit 8447 (web
2469, admin 2420, api 1445, mobile 961, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
976; Biome 2113 file; RLS và tokens-only của mobile xanh. Lượt đầu `@tourism/contract#test` dính flake "Worker forks emitted error" (một ca
quá 5 giây trên máy tải nặng), chạy lại thì xanh.

**CÒN TREO:**

- Buổi test tay chạy chín bước mục 3 của `code-review/L8-bao-cao.md` trên production.
- Dọn nhánh `fix/review-l8-home-blog-xjppea` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review M3-14: nội dung hoá đơn và tracker của app mobile dựng bằng hàm thuần có test, route chỉ còn giữ state và nối nút (`910017b`)

Đề xuất M3-14 của luồng M3 (`code-review/M3-bao-cao.md` trong thư mục chung của project). Entry M3 ngày 20/10 ghi
"chỉ làm sau khi phần của Nghĩa đã gộp"; Yuri đổi ý 21/10 04:31 UTC ("làm luôn cho tối ưu") để Nghĩa làm giao diện
22–30/10 trên nền mới thay vì trên hai route dài. Rà và làm trên `main` `852c53b`. Nhánh
`fix/review-m3-mobile-booking-g0iuac` (dùng lại tên nhánh của PR #47 đã gộp, dựng lại từ `main`),
[PR #65](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/65), thi công trên session cloud. Chỉ đụng
`apps/mobile/src` và một mục handoff: không đổi hành vi, không đổi chữ, không migration, không biến env, không
dependency mới; không sửa file màn nào trong danh sách Nghĩa làm lại giao diện.

- `8e21ac7`: `features/booking/booking-detail-view.ts` dựng props của `BookingDetailScreen` cho sáu khung hoá đơn
  (chờ trả, quá hạn trả, đã trả, chuyến bị công ty huỷ, khách đã huỷ, đã hoàn) bằng
  `bookingDetailView(booking, { today, now, payError, paying }, handlers)`; `cancelSheetView` dựng tấm huỷ T6/T7;
  `bookingEnquiryParams` gom tham số form hỏi gắn chuyến, dùng chung với tracker. Route
  `app/bookings/[code].tsx` từ 585 còn 276 dòng.
- `78cb3fa`: `features/trip-tracker/trip-tracker-view.ts` dựng bốn mặt tracker (`tripUpcomingView` P1,
  `tripImminentView` P2, `tripDayView` P5, `tripEndedView` P6). Route `app/trips/[code]/index.tsx` từ 417 còn 210
  dòng.
- Việc của từng nút truyền vào qua `handlers`, nên hàm vẫn thuần và test bấm thử được; kiểu lấy từ props của màn
  bằng `import type`, nên đợt giao diện đổi props hay tên icon thì `tsc` chỉ chỗ sửa ở hai file view.
- `910017b`: mục 7 của `docs/handoff/mobile-ui-upgrade-handoff.md` thêm ý 6, chỉ hai file view cho đợt giao diện.

**Review.** Không có lượt review độc lập; test route cũ giữ nguyên, không sửa một dòng, và vẫn xanh, là bằng chứng
props không đổi. 34 test unit mới (23 hoá đơn, 11 tracker) phủ 100% dòng của hai file view. Yuri bảo đẩy lên main
21/10 05:05 UTC.

Tests after (`gate:int` trên `910017b`, nền `852c53b`, 21/10, session cloud, API sống ở :3001): unit 8423 (admin
2420, web 2445, api 1445, mobile 961, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
976; Biome 2102 file; RLS, tokens-only của mobile và prerender admin xanh. `@tourism/contract#test` dính flake
"Worker forks emitted error" một lần, chạy riêng và chạy lại đều xanh.

**CÒN TREO:**

- Bản APK mới từ `main` (EAS trên PC), gộp vào lượt dựng lại sau phần giao diện của Nghĩa; buổi test tay bấm lại
  sáu khung hoá đơn và bốn mặt tracker trên Android cùng tám bước mục 3 của `code-review/M3-bao-cao.md`.
- Dọn nhánh `fix/review-m3-mobile-booking-g0iuac` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review A2 admin catalog tour: link nút viền có lại viền, chuyến khởi hành dài đúng số ngày của tour, báo trước khi dời ngày lúc khách đang trả tiền, khu sửa tour làm mới sau lỗi lưu do tab khác, Retry và dòng tải ảnh (`aba5933`)

Luồng A2 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `3e78c3f`, rebase lên `e8fdfee`, `b048d66` rồi
`6fcf63b` trước khi đẩy. Báo cáo đủ 25 phát hiện (11 sửa ở đây, 5 đề xuất, phần còn lại ghi lại hay chuyển luồng
khác): `code-review/A2-bao-cao.md` cùng thư mục. Nhánh `fix/review-a2-admin-tours-1gh80p`,
[PR #56](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/56), thi công trên session cloud. Đụng api
(module catalog), contract (schema chuyến của admin, một mã lỗi mới ở `create` và `update`), i18n (khối
`admin.departures`) và admin: không migration, không biến env, không dependency mới.

- `04b1f8c` (A2-01, việc CÒN TREO của entry Media B): năm link dạng nút viền ngoài (Departures ở bảng `/tours`, Fix
  ở bước Review, Departures ở đầu khu sửa tour, Sign in ở trang lỗi, Back to dashboard ở trang 404) có lại viền.
  `buttonVariants()` trần trên `Link` giữ cả `border-transparent` của lớp gốc lẫn `border-border` của outline, và
  lớp trong suốt thắng; nay đi qua `cn` như `Button` và `ButtonLink`. Hai file của A5 (`app/error.tsx`,
  `app/not-found.tsx`) sửa theo phép của điều phối.
- `2ca2685` (A2-03, M3-13 do M3 chuyển sang): chuyến khởi hành phải dài đúng `durationDays` của tour, tính bằng
  `tripLengthDays` như hạn huỷ ADR-0041. API từ chối tạo chuyến, hay đổi NGÀY chuyến, khi lệch (422
  `TRIP_LENGTH_MISMATCH`); đổi giá hay ghế trên chuyến lệch sẵn vẫn được. Form admin tự đặt ngày về theo ngày đi
  (ô chỉ đọc, kèm dòng gợi ý); contract thêm `durationDays` vào tour của chuyến, chỉ admin đọc. Trước đó tour 5 ngày
  mang được chuyến 2 ngày, nên hạn huỷ miễn phí và "Day n of N" ở trang theo dõi chuyến tính theo chuyến lệch.
- `9002411` (A2-04): dời ngày một chuyến còn khách đang trả tiền (checkout dở, chưa giữ ghế) thì hộp sửa báo trước
  khoản trả ấy sẽ bị hoàn (ADR-0009 AMEND 4); phụ đề tab Departures và lời hộp sửa nói "while no seats are booked"
  thay cho "while nobody has booked", khớp thước `seatsBooked` của server.
- `72a1e51` (A2-06, A2-07): bật bán hay thêm chuyến ở tab khác không đổi phiên bản tour, nên lần lưu ở tab này hỏng
  với `TOUR_NOT_READY` (phần đầu còn ghi "Off sale") hay `GROUP_SIZE_BELOW_SEATS` (câu không kèm sàn ghế). Nay hai
  mã này làm mới trang mà giữ chữ đang gõ; `DURATION_LOCKED` cố ý không làm mới. Câu "Days … will be removed"
  tắt ngay khi lưu xong.
- `450eef4` (A2-08): booking tới sau lúc trang tải thì Delete bị chặn đúng, nhưng đóng hộp xong vùng xoá vẫn mời
  bấm; nay đóng hộp sau `TOUR_HAS_BOOKINGS` thì làm mới.
- `b19ec4a` (A2-05) và `511895a` (A2-09), kit ảnh dùng chung với trang Photos của điểm đến: Retry xoá câu báo của
  lượt trước; cột chữ của dòng tải có `min-w-0` và `wrap-anywhere`, nên tên ảnh dài không làm dòng tràn ở 390px
  (đo bằng Chromium headless).
- `9aac420` (A2-02), `9892ecf` (A2-10) và `aba5933` (A2-11): không đổi hành vi. Mười một comment nói sai về catalog
  admin, id ô alt của tab Photos dùng chung helper `altInputId`, thanh bước bỏ tên biến trùng.

Khe deploy: Render lên trước Vercel là an toàn. Admin cũ gặp `TRIP_LENGTH_MISMATCH` thì hộp báo lỗi chung; admin mới
đọc API cũ chưa có `durationDays` thì ô ngày về gõ tay như trước. Spec P4e-1 (F12) và P4e-3a (bảng mã lỗi) ghi luật
mới.

**Review.** Bốn mảng rà song song: API và lịch chuyến tự đọc; form sửa tour; phần ảnh cùng bảng `/tours`. Mọi phát
hiện của các lượt soát được đọc lại trên code trước khi ghi; test mới chạy đỏ trên mã cũ trước khi sửa. M3-13: Yuri
chọn "Chặn luôn" trên thẻ hỏi 21/10 03:49 UTC; cỡ thật 18 file, 329 dòng thêm, lớn hơn mức ước trên thẻ (khoảng 10
file, 120 dòng). Yuri bảo đẩy lên main 21/10 03:49 UTC.

Tests after (`gate:int` trên `aba5933`, nền `6fcf63b`, 21/10, session cloud, API sống ở :3001): unit 8389 (admin
2420, web 2445, api 1445, mobile 927, contract 812, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
976; Biome 2098 file; RLS, tokens-only của mobile và prerender admin xanh. PR thêm 27 test unit (admin 22, api 4,
contract 1) và 4 int test.

**CÒN TREO:**

- Buổi test tay: mục 3 của `code-review/A2-bao-cao.md` (năm link có viền; ngày về tự điền theo số ngày tour; câu
  cảnh báo khi dời ngày lúc có người đang trả, bấm Cancel chứ KHÔNG lưu; dòng tải tên dài ở 390px).
- Đề xuất chờ Yuri: A2-12 (đưa tiêu điểm tới ô lỗi đầu tiên khi Save), A2-13 (Reload sau lỗi không rõ kết cục khi
  form còn thay đổi), A2-14 (gỡ lớp đỡ khe deploy F18 đã chết), A2-15 (hook `useTourStep`, nên để sau bảo vệ),
  A2-16 (`PhotoDropZone` dùng chung với trang Photos của điểm đến).
- Chuyển qua điều phối 20/10: A2-17, A2-18, A2-20 cho A5; A2-19 cho F3.
- ADR-0049 còn nhắc prop `lead` của khung bước, đã gỡ ở `604aae0`; ADR là bản ghi quyết định nên không sửa (A2-25).
- Dọn nhánh `fix/review-a2-admin-tours-1gh80p` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review L6-04: thư khách trả lời mail của Nexora về hộp hỗ trợ công khai, alert lead mới trả lời thẳng cho khách (`dfc2baa`)

Phần còn lại của luồng L6 (đề xuất L6-04 trong `code-review/L6-bao-cao.md` cùng thư mục chung của project). Yuri
giao chọn hướng 21/10 03:19 UTC. Nhánh `fix/review-l6-contact-email-tls7up` dựng lại từ `main` `250b67f` (sau
PR #54), [PR #64](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/64), thi công trên session cloud. Chỉ
đụng worker của `apps/api`: không đổi chữ, không migration, không biến env, không dependency mới.

- `dfc2baa` (L6-04): request gửi Resend mang `reply_to`. Mail gửi khách trả lời về `tourism.platform.online@gmail.com`
  (hằng `SUPPORT_REPLY_TO`), cùng địa chỉ web in ở topbar, `/contact`, Terms, Privacy và chân voucher; spec canh
  hằng này trùng địa chỉ của Terms và Privacy. `ENQUIRY_ADMIN_ALERT` trả lời thẳng cho email của khách gửi form;
  email sai dạng thì bỏ `reply_to`, vì Resend trả 422 và drain coi 4xx là FAILED ngay, tức mất alert. Trước đó mọi
  mail đi từ `noreply@nexora-travel.agency` không kèm `reply_to`, mà Resend tắt Receiving cho tên miền ấy, trong
  khi sáu loại mail gửi khách và ba câu trên web bảo khách trả lời mail.

**Review.** Không có lượt review độc lập; hướng sửa chọn giữa ba phương án của báo cáo L6 (biến env
`EMAIL_REPLY_TO`, đổi chữ ở 10 chỗ sang trang liên hệ, hoặc `reply_to` về địa chỉ web đã công bố). Giả định: hộp
gmail ấy có người đọc, vì web đã công bố nó là kênh liên hệ. Yuri bảo đẩy lên main 21/10 03:26 UTC.

Tests after (`gate:int` trên `dfc2baa`, nền `b048d66`, 21/10, session cloud, API sống ở :3001): unit 8362 (admin
2398, web 2445, api 1441, mobile 927, contract 811, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
972; Biome 2097 file; RLS, tokens-only của mobile và prerender admin xanh. PR thêm 4 test unit (api).

**CÒN TREO:**

- Buổi test tay: bước 6 ở mục 3 của `code-review/L6-bao-cao.md` (Reply trên mail xác nhận enquiry tới hộp gmail;
  Reply trên mail báo lead mới tới khách).
- Dọn nhánh `fix/review-l6-contact-email-tls7up` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review L7 trợ lý AI tư vấn tour: thẻ enquiry đã gửi không còn bị báo "not sent" khi model lỗi sau Send, thẻ tự đóng giữ tên tour, tài khoản bị khoá không đọc đơn qua chat, trợ lý nói đúng tiền của đơn đã huỷ và mời viết review theo cổng mới (`9ba82e2`)

Luồng L7 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `451f82f`, rebase lên `3e78c3f`, `e8fdfee`, `a05cece`
rồi `250b67f` trước khi đẩy. Báo cáo đủ phát hiện, gồm bốn mục để lại và L4-20, L5-20 chuyển sang:
`code-review/L7-bao-cao.md` cùng thư mục. Nhánh `fix/review-l7-ai-chat-rxs353`,
[PR #55](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/55), thi công trên session cloud. Đụng api (module
chat) và web (khung chat): không migration, không đổi contract, không biến env, không dependency mới. Không gọi
Anthropic thật: mọi kịch bản lỗi của model chạy trên model giả `MockLanguageModelV4`.

- `00233c7` (L7-01, API) và `1efa8ab` (L7-01, web): khách bấm Send trên thẻ enquiry, tool `submitEnquiry` chạy xong
  (enquiry đã tạo, hai thư đã xếp hàng) rồi bước model ngay sau đó lỗi. Trước đó API coi cả lượt là hỏng nên không
  ghi gì, thẻ trong DB còn chờ; Retry hay gõ tin mới đều khiến API tự từ chối thẻ, nên trợ lý nói "enquiry not
  sent" trong khi thư xác nhận đã tới hộp thư. Nay `settleApproval` (`chat-history.ts`) ghi thẻ ở trạng thái cuối
  và bỏ chữ dở; còn phần nào chưa chốt thì lượt đi đường cũ. Web thấy thẻ vừa chốt ở tin cuối thì cắt phần chữ dở
  và gỡ lỗi, khách gõ tiếp như thường.
- `cdeb656` (L7-02): gõ tin mới khi thẻ enquiry còn chờ thì thẻ tự đóng mà vẫn giữ dòng Tour (`requestReason`), như
  bản API lưu; trước đó dòng ấy mất tới khi tải lại trang.
- `98e3bfa` (L7-03): controller chat (`@Public`, tự đọc phiên) coi tài khoản đang bị khoá như khách vãng lai, cùng
  luật `AuthGuard` (ADR-0052 §4). Trước đó một phiên sót, được ghi đúng lúc lệnh khoá chạy, vẫn đọc được đơn qua
  hai tool.
- `5e6b50a` (L4-20, L4 chuyển sang): đơn đã trả rồi huỷ không còn bị ghi "Not paid": `payment` ghi "Paid, refunded
  in full", "Paid, partly refunded" hay "Paid, not refunded" theo sổ hoàn của trang chi tiết đơn, danh sách đơn ghi
  "Paid; refund details are on the booking page". Đơn khách tự huỷ quá hạn (không được hoàn) mà sau đó công ty huỷ
  chuyến không còn được hứa "anything paid is refunded in full". Ca khách huỷ TRONG hạn rồi công ty huỷ chuyến
  vẫn kể chuyện của công ty, theo quyết định L4-08 (để sau bảo vệ).
- `9ba82e2` (L5-20, L5 chuyển sang, thêm sau khi PR #51 lên `main`): `reviewText` của trợ lý dùng `bookingKeepsTrip`
  của contract thay cho bản chép tay "chỉ PAID", nên đơn hoàn một phần hay hoàn thiện chí trọn mà vẫn đi được mời
  viết review như trang đơn.
- Commit docs này: spec P6 (`specs/2026-09-29-p6-ai-concierge-design.md`) ghi ba thay đổi trên (lượt duyệt hỏng sau
  khi tool chạy xong vẫn được ghi, chữ tiền của đơn huỷ, phiên của tài khoản bị khoá không tính là có phiên).

**Review.** Đây chính là lượt review của luồng L7; không có lượt review độc lập cho các bản sửa. Ghi lại không sửa:
L7-04 (Anthropic lỗi thoáng qua trước chữ đầu tiên thì khung khoá như lúc hết trần ngày, tới khi Start over hay tải
lại trang; cách sửa khoảng 20 dòng ở 2 file web), L7-05 (trần ngày cộng token theo ngày của tin đề xuất, lượt hỏng
không tính: vượt nhẹ, throttle giới hạn), L7-06 (mất mạng giữa lượt duyệt: Retry gặp 400 tới khi tải lại; cách sửa
khoảng 15 dòng), L7-07 (`handlerTimeout` 60 giây của Fastify bao cả lúc chờ chữ đầu tiên; suy luận, chưa đo).
Gửi L6: form enquiry đọc phiên tuỳ chọn cũng chỉ loại `deletedAt`, vô hại vì chỉ ghi `enquiries.user_id`. Yuri bảo
đẩy lên main 21/10 03:22 UTC.

Tests after (`gate:int` trên `9ba82e2`, nền `250b67f`, 21/10, session cloud, API sống ở :3001): unit 8358 (admin
2398, web 2445, api 1437, mobile 927, contract 811, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
972; Biome 2097 file; RLS, tokens-only của mobile và prerender admin xanh. PR thêm 26 test unit (api 24, web 2) và
2 int test; mỗi test đã chạy đỏ trên code cũ, trừ hai ca canh đơn huỷ không được mời viết review.

**CÒN TREO:**

- Buổi test tay: năm bước ở mục 3 của `code-review/L7-bao-cao.md` (kịch bản P6 mục A tới F rồi G cuối cùng, thẻ tự
  đóng vẫn ghi tour, tiền của đơn đã huỷ, đọc đơn khi đăng nhập, cổng review của đơn được hoàn mà vẫn đi). L7-01 và
  L7-03 không dựng được trên production, chỉ có test tự động canh.
- Dọn nhánh `fix/review-l7-ai-chat-rxs353` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review L6 liên hệ, bản tin và email đi ra: lead đã ẩn danh không còn đánh sập trang Enquiries, thư xác nhận đi khi khách đăng ký lại sau khi huỷ, form liên hệ báo "quá dài" thay vì "quá ngắn", câu bảng trống của /subscribers (`cb8fff1`)

Luồng L6 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `451f82f`, rebase lên `f8f8634`, `e8fdfee` rồi `0141b84`
trước khi đẩy. Báo cáo đủ 11 phát hiện, gồm phần để lại, đề xuất L6-04 còn chờ Yuri và A1-07 chuyển sang thành
L6-11: `code-review/L6-bao-cao.md` cùng thư mục. Nhánh `fix/review-l6-contact-email-tls7up`,
[PR #54](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/54), thi công trên session cloud. Đụng contract
(schema enquiry của admin), api (worker outbox và comment), admin, web, mobile và `@tourism/i18n` (ba khoá mới, ba
câu đổi): không migration, không biến env, không dependency mới; không sửa file nào trong danh sách Nghĩa làm lại
giao diện 22–30/10. Không gửi mail thật nào; với Resend chỉ đọc trạng thái tên miền và webhook qua connector.

- `01a817e` (L6-01): schema hàng và chi tiết enquiry của admin nhận thêm đúng dạng email ẩn danh
  `anon-<uuid>@invalid` (không nới chung) và lời nhắn rỗng; trang chi tiết in "Removed when this lead was
  anonymized." thay cho thẻ Message trống. Anonymize (job retention 18 tháng, hoặc xoá tài khoản khi lead mang
  `user_id`) ghi hai giá trị ấy, mà oRPC kiểm output, nên trước đó `/enquiries` trả 500 ở mọi tab và trang có
  hàng ẩn danh, trang chi tiết của nó cũng 500. Trên production: khách đăng nhập gửi form `/contact` rồi xoá tài
  khoản là trang Enquiries sập. Đây là bug "task riêng" ở Q9 của spec seed khung 2026 (14/09); comment fixture
  seed bỏ câu "dòng ẩn danh làm vỡ trang admin".
- `9c581c8` (L6-02): worker gửi thư xác nhận bản tin khi và chỉ khi link trong thư còn mở được (`confirmToken`
  khớp thế hệ consent hiện tại, hàm `isDeadConfirmMail`). Trước đó khách huỷ rồi đăng ký lại ở footer, đúng đường
  trang huỷ chỉ, thì thư thành SKIPPED vì row vẫn ở trạng thái huỷ tới lúc bấm link: toast báo đã gửi mà không có
  thư nào. Huỷ hoặc bấm "Re-subscribe" sau khi thư đã xếp hàng thì thư vẫn bị bỏ; trần một thư mỗi 24 giờ giữ
  nguyên.
- `22a8f7e` (L6-03, web) và `668a0df` (L6-03, app): form `/contact`, form trang chủ và tấm "Ask about this date"
  của app báo "Keep your name under 120 characters." và "Keep your message under N characters." thay cho câu
  "at least 10 characters" khi vượt trần. Ô lời nhắn của web trừ sẵn dòng ngày mong muốn mà form ghép vào. App
  nhận bản sửa ở APK kế tiếp (file của M2, không thuộc danh sách của Nghĩa).
- `cea3e13` (L6-05): ba comment của `newsletter.controller.ts`, `enquiries.controller.ts` và `contract.ts` thôi
  tả một `ThrottlerGuard` riêng gắn ở method; trần là guard toàn cục của ADR-0037 (chỉ comment).
- `cb8fff1` (L6-11, A1-07 chuyển sang): ba câu ô rỗng của `/subscribers` khi đang lọc ngày thành "No matching
  subscribers signed up …", cùng khuôn `/bookings` và `/reviews`: ngày cộng dồn với tab, ô tìm và nguồn.

**Review.** Đây chính là lượt review của luồng L6; không có lượt review độc lập cho các bản sửa. Ghi lại không
sửa: L6-06 (lúc Render deploy, hai bản worker có thể cùng gửi một row; request tới Resend không có
`Idempotency-Key`), L6-07 (template `EMAIL_CHANGED` và `EMAIL_VERIFICATION` dạng link không còn nơi xếp hàng),
L6-08 (trang xác nhận và huỷ bản tin in "link hỏng" khi API 5xx, cố ý), L6-09 (xoá tài khoản không dọn mail outbox
đang chờ, file của L1), L6-10 (đăng ký lại trong 24 giờ không có thư, cố ý). Còn chờ Yuri: L6-04, hộp
`noreply@nexora-travel.agency` có nhận thư không; sáu loại mail gửi khách và ba câu trên web bảo khách trả lời
mail, trong khi Resend tắt Receiving cho tên miền này. Yuri bảo đẩy lên main 21/10 02:34 UTC.

Tests after (`gate:int` trên `cb8fff1`, nền `0141b84`, 21/10, session cloud, API sống ở :3001): unit 8332 (admin
2398, web 2443, api 1413, mobile 927, contract 811, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
970; Biome 2097 file; RLS, tokens-only của mobile và prerender admin xanh. PR thêm 15 test unit (api 6, contract
3, web 3, admin 2, mobile 1) và 5 int test.

**CÒN TREO:**

- Bản APK mới từ `main` (EAS trên PC) để phần app của L6-03 tới máy khách, gộp vào lượt dựng lại sau phần giao
  diện của Nghĩa (22–30/10).
- L6-04 chờ Yuri: có hộp thư hoặc chuyển tiếp cho `noreply@` thì thôi; không có thì chọn giữa env tuỳ chọn
  `EMAIL_REPLY_TO` (Yuri đặt trên Render lúc merge) hoặc đổi chữ ở 10 chỗ sang trang liên hệ.
- Buổi test tay: sáu bước ở mục 3 của `code-review/L6-bao-cao.md` (lead ẩn danh trên admin, đăng ký lại bản tin
  ở footer sau 24 giờ, form liên hệ quá dài trên web và app, ô rỗng của `/subscribers`, trả lời một mail).
- Dọn nhánh `fix/review-l6-contact-email-tls7up` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review F2 dữ liệu demo: bản sao lưu trước khi seed lại lấy trọn mọi bảng, gỡ hai script dev đã hỏng, kế hoạch `data:reset` không còn khai số liệu của lượt 09/09 (`16743d3`)

Luồng F2 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `451f82f`, rebase lên `f8f8634` rồi lên `a05cece`
trước khi đẩy. Báo cáo đủ 9 phát hiện của luồng và hai phát hiện chuyển sang (L4-19, L5-18), câu trả lời "có
cần seed lại lần hai trước bảo vệ không" cùng hướng dẫn seed lại production từng bước:
`code-review/F2-bao-cao.md` cùng thư mục. Nhánh `fix/review-f2-seed-reset-m7kz98`,
[PR #53](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/53), thi công trên session cloud. Chỉ đụng
script chạy tay và comment của `apps/api` cùng một dòng của `docs/snapshots/README.md`: không migration, không
biến env, không dependency mới, không đổi code chạy trên production. Seed, reset và verify chỉ chạy trên
Postgres local của container.

- `010fd96`: `snapshot:export` đọc danh sách bảng từ `information_schema` lúc chạy và sao lưu trọn mọi bảng của
  schema `public` vào `backups/<ngày>/`, trừ `_prisma_migrations`. Trước đó bản kê tay 19 bảng thiếu năm bảng
  mà `data:reset` xoá (chat của trợ lý AI, ghi chú và lịch sử trạng thái của enquiry, nhật ký thao tác admin)
  và sáu bảng mà seed ghi đè (29 tour gốc cùng năm bảng con), tức đúng phần sẽ mất khi seed lại mà không có
  bản nào để lấy lại. Đo trên Postgres local: 37 file cho 37 bảng.
- `eb503cd`: gỡ `scripts/demo-account.mjs`, `prisma/seed-demo-visits.ts` và script `demo:account`. Script đầu
  chết ở bước đầu từ khi đăng ký phải xác minh email (`3bab8e2`, 20/08); file sau đắp lịch sử cho hai tài
  khoản mà reset đã xoá; cả hai ghi thẳng vào `DATABASE_URL` mà không có chốt production. Seed nay tạo 120
  khách giả đăng nhập được, có đơn ở mọi giai đoạn.
- `fb4ab52`: kế hoạch in của `data:reset` bỏ hai câu chỉ đúng với prod ngày 09/09 ở dòng `outbox` và `enquiries`
  ("137 dòng đều SENT, không email nào đang chờ"), nhắc soát `/outbox` trước `--apply`. Đo local: outbox còn
  hai dòng PENDING mà kế hoạch cũ vẫn in câu ấy.
- `16743d3`: ba comment lệch code trong `seed.ts`, gồm L5-18 chuyển từ luồng L5: công thức điểm tour nay trỏ theo
  tên hàm `moderate` và `retract` của `ReviewsService`, đúng cả trước lẫn sau PR #51; bỏ các con số đổi theo
  ngày H.

**Review.** Đây chính là lượt review của luồng F2; không có lượt review độc lập cho các bản sửa. Vòng reset,
seed, verify chạy đủ trên Postgres local với H 18/09, 05/11 và 08/11; lượt cuối `seed:verify` 0 vi phạm trên
119 bất biến. Ghi lại không sửa: L4-19 đơn seed mang mã thanh toán giả nên cổng sandbox từ chối hoàn (luật khi
trình bày ở mục 3 và 6.6 của báo cáo); F2-04 đợt công ty huỷ trong seed còn hình dạng trước F13, Yuri chọn
không làm 21/10 01:05 UTC nên A1-21 của luồng A1 cũng không làm; F2-05 tới F2-09 là việc của lượt seed lại.
Yuri bảo đẩy lên main 21/10 01:06 UTC.

Tests after (`gate:int` trên `16743d3`, nền `a05cece`, 21/10, session cloud, API sống ở :3001): unit 8317
(admin 2396, web 2440, api 1407, mobile 926, contract 808, mobile-ui 145, i18n 64, ui 57, core 48, tokens
26) và int 965; Biome 2097 file; RLS và prerender admin xanh. PR không thêm test: không đổi logic thuần, đo
bằng chạy thật trên Postgres local.

**CÒN TREO:**

- Seed lại production theo mục 6 của `code-review/F2-bao-cao.md`: 1–2 ngày trước buổi thuyết trình thử và
  lần nữa 1–2 ngày trước bảo vệ (chờ Yuri chốt ngày). Mục "Trước lượt seed lại 03/11" của `docs/open-items.md`
  và dòng "lượt seed 2, khoảng 03/11" của `docs/snapshots/README.md` đổi theo ngày Yuri chốt.
- Buổi test tay: hai điều ở mục 3 của `code-review/F2-bao-cao.md` (công ty huỷ đợt chỉ trên đợt 0 ghế đã đặt,
  với đơn mới trả bằng thẻ 4242; khách tự huỷ trong hạn và hoàn goodwill chỉ trên đơn mới).
- Dọn nhánh `fix/review-f2-seed-reset-m7kz98` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review L5 đánh giá tour: lệnh duyệt mang phiên bản, khách hoàn thiện chí mà vẫn đi viết được review, nút ảnh review hiện trên điện thoại, form sửa gặp bài vừa duyệt thì tải lại, câu bảng rỗng của /reviews (`b80c25f`)

Luồng L5 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `451f82f`, rebase dần lên `56e23ae` trước khi đẩy.
Báo cáo đủ 21 phát hiện, gồm phần để lại, phần chuyển luồng và đề xuất L5-07 Yuri chọn "Mở" ngày 20/10:
`code-review/L5-bao-cao.md` cùng thư mục. Nhánh `fix/review-l5-reviews-ulk5gf`,
[PR #51](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/51), thi công trên session cloud. Đụng contract
(route `admin.reviews.moderate` đòi `version` và có mã `STALE_REVIEW`; hàm mới `bookingKeepsTrip`), api, admin,
web, mobile và `@tourism/i18n` (một khoá mới, ba câu đổi): không migration, không biến env, không dependency mới;
không sửa file nào trong danh sách Nghĩa làm lại giao diện 22–30/10.

- `49ecf2a` (L5-01): lệnh duyệt review mang `version` (`updatedAt` dạng ISO, `AdminReview.version`, không thêm
  cột). `moderate()` so phiên bản dưới `FOR UPDATE`, đặt sau guard trùng trạng thái; lệch thì 409
  `STALE_REVIEW`, admin thấy toast bảo đọc lại, dialog đóng và hàng đợi tải lại. Dialog chụp bài cùng phiên bản
  lúc mở. Trước đó khách sửa bài trong lúc admin đọc thì Approve đăng luôn bản mới chưa ai đọc (điểm tour tính
  theo số sao mới), và tab admin mở từ trước bác được bài admin khác vừa duyệt. Theo khuôn `DEPARTURE_STALE`
  của vòng F12, không ADR.
- `0c55abe` (L5-04, L5-05): câu tính lại điểm tour của `retract` và `moderate` gom về một hàm
  `recomputeTourRating`; `update()` bỏ một lần đọc booking thừa. Không đổi hành vi.
- `1559b23` (L5-02): nút gỡ ảnh và tay nắm sắp xếp ảnh của review hiện khi focus nằm trong ô
  (`group-focus-within/item:`) và luôn hiện trên màn cảm ứng (`pointer-coarse:`). Tailwind v4 bọc `hover`
  trong `@media (hover: hover)`, nên trước đó trên điện thoại hai nút không bao giờ hiện, còn người dùng bàn
  phím tab vào một nút vô hình.
- `01fb7f2` (L5-03): form sửa review gặp `REVIEW_NOT_EDITABLE` (bài vừa được duyệt) báo toast rồi
  `router.refresh()`, khung đổi sang trạng thái đã đăng; trước đó form in lỗi và đứng nguyên, bấm lại vẫn lỗi.
- `dc5e020` (L5-06): comment lệch code ở `reviews.service.ts`, `moderate-actions.tsx`, `reviews-moderate.ts`,
  spec của contract và `lib/review.ts` (cổng API chặn chuyến bị công ty huỷ từ G36).
- `3dad5bb` (L5-07): `bookingKeepsTrip` ở contract cạnh `bookingPhase` (đơn còn chuyến: PAID,
  PARTIALLY_REFUNDED, REFUNDED chưa có `cancelledAt`, theo ADR-0054 AMEND 1), và `bookingPhase` dùng chính hàm
  ấy. Cổng `checkReviewEligibility` đọc hàm này thay cho "chỉ PAID" (lý do `NOT_PAID` đổi tên thành
  `NOT_TRAVELLING`); `reviews.create` và `media.signUpload` nạp thêm `cancelledAt`. Web: `reviewSlot`, link
  Review của My bookings và chân khối Get ready theo cùng luật. Khách được hoàn thiện chí một phần hay trọn mà
  vẫn đi nay viết được review; đơn huỷ thật rồi mới hoàn vẫn bị chặn.
- `4bdb7c9` (L5-19): app theo cổng mới: `canWriteReview` của hoá đơn chuyến đã về đọc `bookingKeepsTrip`; khối
  "chờ viết bài" của My reviews xin server PAID, PARTIALLY_REFUNDED và REFUNDED, có test buộc bộ lọc khớp
  `bookingKeepsTrip`. Hai file của luồng M3, coordinator cho làm trong PR này.
- `7caa6f7`: JSDoc của chân khối Get ready trong `messages.ts` thôi nói "chỉ đơn PAID" (chỉ comment).
- `b80c25f` (L5-21, A1 chuyển sang): ba câu ô rỗng của `/reviews` khi đang lọc ngày thành "No matching reviews
  were submitted …", như A1-07 sửa `/bookings`: ngày cộng dồn với tab trạng thái, nguồn, số sao và ô tìm kiếm,
  nên câu cũ đọc thành "khoảng này không ai gửi review" khi chỉ là tab Pending trống.

Doc hiện trạng sửa theo: spec ba trang đơn 05/10 (§2.4 chân Get ready theo `bookingKeepsTrip`, §2.5 cổng API đã
chặn chuyến huỷ từ G36, thẻ cảm ơn ở `travelled` nay chỉ là lưới an toàn) và bảng giai đoạn của
`docs/handoff/mobile-booking-handoff.md` (hoá đơn T4 mời viết theo `bookingKeepsTrip`).

**Review.** Đây chính là lượt review của luồng L5; không có lượt review độc lập cho các bản sửa. Chuyển luồng:
L5-17 sang A5 (nhật ký `/activity` ghi "approved" cho lệnh duyệt no-op), L5-18 sang F2 (comment của seed trỏ
công thức điểm cũ), L5-20 sang L7 (`reviewText` của trợ lý AI còn chép cổng "chỉ PAID"; vào PR #55 sau khi PR
này lên). Ghi lại không sửa: L5-08 tới L5-15 (câu "hết lượt" khi admin Reopen bài bị bác hai lần, "last reason"
của hồ sơ review, ký upload cho bài đã duyệt, trần 10 MB chỉ ở client, sạn nhỏ của khung ảnh, hai câu copy chờ
Yuri chọn chữ, bấm Submit hai lần, số query của `listByTour`), L5-16 không làm (`version` theo mili-giây, cùng
giới hạn `DEPARTURE_STALE`). Yuri bảo đẩy lên main 21/10 00:33 UTC.

Tests after (`gate:int` trên `b80c25f`, nền `56e23ae`, 21/10, session cloud, API sống ở :3001): unit 8317 (admin
2396, web 2440, api 1407, mobile 926, contract 808, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
965; Biome 2099 file; RLS, bundle mobile và prerender admin xanh. PR thêm 30 test unit (contract 8, web 8, admin
6, api 5, mobile 3) và 8 int test.

**CÒN TREO:**

- Lúc deploy, Render (API) và Vercel (admin, web) lên riêng: tab admin mở từ trước deploy phải tải lại, không
  thì nút duyệt trả 400 vì thiếu `version`; web lên trước API thì khách hoàn một phần thấy form review nhưng gửi
  bị từ chối cho tới khi Render xong.
- Bản APK mới từ `main` (EAS trên PC) để phần app của L5-07 tới máy khách, gộp vào lượt dựng lại sau phần giao
  diện của Nghĩa (22–30/10). Màn chuyến đã xong của APK đang cài chạy đúng ngay khi API lên.
- Buổi test tay: tám bước ở mục 3 của `code-review/L5-bao-cao.md` (ảnh review trên điện thoại và bàn phím, duyệt
  bài vừa bị sửa, hai tab admin, sửa bài vừa được duyệt, đơn hoàn thiện chí viết review trên web và app, ô rỗng
  của `/reviews`).
- L5-20 vào PR #55 của L7.
- Dọn nhánh `fix/review-l5-reviews-ulk5gf` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review M1 mobile đăng nhập, tài khoản, khung app: nút về không để lại bản sao màn trong stack, onboarding vẫn mở app khi ghi cờ hỏng, test canh env hỏng (`d1e50c5`)

Luồng M1 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `99de947`, rebase lên `451f82f` rồi lên `cacdf3a`
trước khi đẩy. Báo cáo đủ 17 phát hiện, gồm phần để lại và một chỗ chuyển M2: `code-review/M1-bao-cao.md` cùng
thư mục. Nhánh `fix/review-m1-mobile-auth-orptsn`,
[PR #50](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/50), thi công trên session cloud. Chỉ đụng
`apps/mobile/src`: không migration, không biến env, không dependency mới, không khoá i18n mới; không sửa file
nào trong danh sách Nghĩa làm lại giao diện 22–30/10.

- `7f4546a`: sáu nút "về" đổi `router.replace` hay `router.navigate` sang `router.dismissTo`, gỡ về bản màn đang
  có (chưa có thì thay màn hiện tại). Đo trên cây route thật của expo-router 57: hai lệnh kia dựng bản MỚI kể cả
  khi màn đích nằm ngay dưới. "Back to sign in" của Forgot password, "Sign in" ở màn kết quả sau xác minh email
  và link "Sign in" ở chân Create account từng đẩy thêm một Sign in, phải back thêm lần nữa mới đóng nhóm auth.
  Xoá tài khoản xong, X ở Reset password và "Back to home" của `+not-found` từng dựng một bộ tab mới chồng lên bộ
  cũ: back cứng Android về bộ cũ thay vì thoát app. Spec mới `back-stack-routes.spec.tsx` chạy trên router thật.
- `ce197a9`: onboarding bắt lỗi của `markSeen()` rồi vẫn điều hướng, cùng lẽ `readHasSeen` (F9) ở chiều đọc.
  Trước đó SecureStore ném lúc ghi (Keychain đang khoá, keystore hỏng) thì Skip, Get started và "I already have
  an account" không đi đâu.
- `8a4b9a3`: trả JSDoc của `readEnv` về đúng hàm (từng nằm trên `isLoopback`).
- `68032f4`: `env-failure.spec.tsx` canh hợp đồng thiếu biến `EXPO_PUBLIC_*` thì ErrorBoundary gốc hiện câu lỗi
  nêu tên biến và gỡ splash. Trước đó dời `env()` ra module scope là app đóng ngay lúc mở mà không test nào đỏ.
- `d1e50c5`: bốn nút "Browse tours" ở các khung hoá đơn đã đóng và dòng "Where to next?" ở P6 dùng
  `router.dismissTo('/explore')` như B8 (file của luồng M3 đã xong, điều phối đồng ý 20/10). Trước đó từ Explore
  back về Home rồi back nữa lại ra đúng hoá đơn hay P6 vừa rời.

**Review.** Đây chính là lượt review của luồng M1; không có lượt review độc lập cho các bản sửa. Chuyển M2 qua
điều phối: "Explore other tours" ở `tours/[slug].tsx` cùng lỗi, M2 đã sửa ở `d3e6ab6` (entry M2 ngay dưới ghi
"không còn dùng `router.dismissTo`", code thật thì nay dùng nó). Ghi lại không sửa: M1-10 Create account mở từ
cổng của tab còn nằm dưới Sign in sau xác minh, M1-11 lệnh auth không có trần thời gian, M1-12 màn lỗi gốc in
thẳng `error.message`, M1-13 đếm ngược "Resend code" đứng khi app nằm nền, M1-14 deep link ở lần mở đầu tiên bị
onboarding thay chỗ, M1-15 bốn khoá mobile không còn dùng (dọn sau 30/10). Yuri bảo đẩy lên main 21/10 00:29 UTC.

Tests after (`gate:int` trên `d1e50c5`, nền `cacdf3a`, 21/10, session cloud, API sống ở :3001): unit 8287 (admin
2390, web 2432, api 1402, mobile 923, contract 800, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
957; Biome 2097 file; RLS, bundle mobile và prerender admin xanh. PR thêm 14 test unit ở mobile (909 lên 923).

**CÒN TREO:**

- Bản APK mới từ `main` (EAS trên PC) để các sửa tới máy khách, gộp vào lượt dựng lại sau phần giao diện của
  Nghĩa (22–30/10).
- Buổi test tay: bảy bước ở mục 3 của `code-review/M1-bao-cao.md`, làm trên Android (Back to sign in, link Sign
  in qua lại, Sign in sau xác minh email, X ở Reset password mở từ email, trang không tìm thấy qua `adb`, xoá một
  tài khoản thử, Browse tours và Where to next? rồi back).
- Dọn nhánh `fix/review-m1-mobile-auth-orptsn` trên origin nếu GitHub không tự xoá.

## 2026-10-21 — Merge review M2 mobile xem tour, Saved, bài viết: ngày theo giờ Việt Nam, đợt hết chỗ không chọn được và giá gạch như web, tab Reviews không báo rỗng sai và không nhảy trang, lỗi 4xx không thử lại (`d3e6ab6`)

Luồng M2 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `99de947`, rebase lên `451f82f` rồi lên `e8fdfee`
trước khi đẩy. Báo cáo đủ 18 phát hiện, gồm phần để lại, phần chuyển cho Nghĩa và một đề xuất:
`code-review/M2-bao-cao.md` cùng thư mục. Nhánh `fix/review-m2-mobile-browse-5jm83v`,
[PR #49](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/49), thi công trên session cloud. Đụng
`apps/mobile/src` và ba khoá mới trong khối mobile của `@tourism/i18n`: không migration, không biến env, không
dependency mới; không sửa file nào trong danh sách Nghĩa làm lại giao diện 22–30/10.

- `7505571`: `formatFullDate` nhận cả mốc thời gian: chuỗi dài hơn 10 ký tự đi qua `vietnamToday(new Date(iso))`
  như web (ADR-0041 §7), `formatReviewDate` gọi lại nó. Trước đó mốc từ 00:00 tới 07:00 giờ Việt Nam in lùi một
  ngày: ngày trả, huỷ, hoàn ở hoá đơn và tracker (M3-10), ngày review ở trang tour, ngày đăng bài viết.
- `87740f5`: tab Dates dùng `isDepartureOpen` (còn hạn VÀ còn chỗ) cho view model hàng đợt và chốt chặn
  `handleBookPress`. Cờ `bookable` của API chỉ xét hạn đặt, nên đợt kín còn hạn từng chọn được và mở wizard với
  trần 0 khách. Giá gạch theo `departureStrikePrice`, chép luật `strikePrice` của web (15/09): đợt hạ giá không
  có neo riêng nay gạch giá gốc, đợt có neo thấp hơn giá trả thôi gạch.
- `d2d5187`: review của chi tiết tour chuyển sang `useInfiniteQuery` như `app/posts/index.tsx`: trang tải hỏng
  rồi bấm "Load more" tải lại đúng trang ấy thay vì nhảy sang trang sau; helper `isReviewSortChange` thành thừa,
  đã bỏ. Câu của danh sách rỗng theo trạng thái query (ADR-0055 §3): "Loading…" khi đang tải, "Couldn't load
  reviews." khi hỏng (khoá mới `mobile.tourDetail.reviewsError`), chỉ nói chưa có review khi server trả rỗng.
- `1442cd6`: `queryClient` có `retry: shouldRetryQuery`: lỗi 4xx của server không gọi lại, trừ 401, 408, 429;
  lỗi mạng, hết giờ chờ và 5xx giữ trần 3 lần. Trước đó tour đã gỡ hay bài viết không còn quay vòng thêm khoảng
  7 giây rồi mới hiện màn "không còn".
- `8349b82`: bài viết gặp `POST_NOT_FOUND` có trạng thái `notFound` riêng của `PostDetailScreen`: "This story
  isn't available anymore." với nút "Go back" (hai khoá mới ở `mobile.posts`), thay màn lỗi có nút "Try again"
  không bao giờ thành công.
- `99478f5`: tấm "Ask about this date" đụng trần 5 lượt mỗi phút thì báo chờ một phút (`askAboutDateErrorCopy`,
  cùng câu 429 của form enquiry chung) thay vì mời thử lại ngay.
- `cfa1575`: My reviews bỏ phần cắt 10 ký tự trước khi gọi `formatFullDate` (phần còn lại của M3-10, ở file của
  luồng M3 đã xong, sửa theo ngoại lệ mục 2.2 của kế hoạch).
- `d3e6ab6`: "Explore other tours" ở màn tour không còn dùng `router.dismissTo('/explore')` như B8, lùi về bộ tab
  có sẵn thay vì dựng thêm một bộ tab đè lên trang tour (M1 báo sang).

**Review.** Đây chính là lượt review của luồng M2; không có lượt review độc lập cho các bản sửa. Chuyển Nghĩa qua
Yuri, cả ba ở `tour-detail-screen.tsx`: M2-11 hàng đợt kín còn hạn cần nhãn "Sold out" thay vì "Booking closed",
M2-12 tab Reviews chưa có nút thử lại, M2-13 trạng thái loading của chi tiết tour không có nút back. Một đề xuất
chờ Yuri chốt: M2-14 (thêm `priceFrom` vào `WishlistItemSchema` để thẻ Saved của web và app in cùng giá "from"
như Explore; khoảng 40 đến 60 dòng, phần app chờ Nghĩa). Ghi lại không sửa: M2-15 Explore thay danh sách bằng
khung chờ mỗi lần đổi sort (file của Nghĩa), M2-17 thanh tiến độ của tracker tính từ ngày UTC, M2-18 tên
`formatReviewDate`. Yuri bảo đẩy lên main 20/10 23:52 UTC.

Tests after (`gate:int` trên `d3e6ab6`, nền `e8fdfee`, 21/10, session cloud, API sống ở :3001): unit 8273 (admin
2390, web 2432, api 1402, mobile 909, contract 800, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26) và int
957; Biome 2095 file; RLS, bundle mobile và prerender admin xanh. PR thêm 29 test unit ở mobile (880 lên 909).

**CÒN TREO:**

- Bản APK mới từ `main` (EAS trên PC) để các sửa tới máy khách, gộp vào lượt dựng lại sau phần giao diện của
  Nghĩa (22–30/10).
- Buổi test tay: tám bước ở mục 3 của `code-review/M2-bao-cao.md`, làm trên Android (đợt kín ở tab Dates, giá
  gạch so với web, tab Reviews lúc API ngủ, Load more sau khi mất mạng, bài viết không tồn tại, ngày trả và ngày
  review từ 00:00 tới 07:00, Explore other tours rồi back, Ask about this date sáu lần).
- Dọn nhánh `fix/review-m2-mobile-browse-5jm83v` trên origin nếu GitHub không tự xoá.

## 2026-10-20 — Merge review L4 đơn của khách, huỷ và hoàn tiền: nút Pay now và huỷ giữ chỗ gặp đơn vừa đổi trạng thái thì làm mới trang, tiền đủ hai số lẻ khi có khoản hoàn, kết quả hoàn của admin, ô vé in gọn hai dòng (`d32f730`)

Luồng L4 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `99de947` rồi rebase lên `3e78c3f` trước khi đẩy.
Báo cáo đủ 23 phát hiện, gồm phần để lại và phần chuyển luồng: `code-review/L4-bao-cao.md` cùng thư mục. Nhánh
`fix/review-l4-customer-bookings-51rc91`, [PR #52](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/52),
thi công trên session cloud. Đụng web, api và i18n: không migration, không biến env, không dependency mới, không
đổi contract; một khoá i18n mới.

- `74d5365`: nút "Pay now" và "Cancel booking" của trang chi tiết đơn nhận `NOT_PENDING` (422 của
  `bookings.checkout` và `bookings.cancelPending`): đơn chờ trả vừa được trả (webhook về sau khi trang đã render),
  vừa bị câu quét huỷ hay bị huỷ ở tab khác. Trước đó khách đọc câu lỗi chung, trang đứng yên, bấm lại vẫn lỗi;
  nay in câu `accountActionErrors.notPending` và `router.refresh()`, cùng nếp `NOT_CANCELLABLE` (chuyển từ L3-18,
  M3-12).
- `9ebb4d1`: `admin.bookings.refund` trả `refundedTotal` thật (tổng sau lần hoàn, đọc trong khoá) thay cho
  `'0.00'`. Sửa comment nói lời gọi cổng chạy ngoài transaction (thật ra trong transaction của advisory lock,
  ngoại lệ ADR-0009) và dòng JSDoc cũ của `refund-math`.
- `3e8ac05`: JSDoc của `byCode`, `cancelPending` và `BookingNotCancellableError` theo ADR-0041 và AMEND 1.
- `6fdb293`: khối tiền của trang chi tiết đơn và của hoá đơn in đủ hai số lẻ khi đơn có khoản hoàn. Trước đó
  "Total paid $147" đứng trên "Refunded −$73.50", và "$39" đứng cạnh câu "$39.00 has been refunded"; voucher và
  thẻ chờ đã theo luật này từ thử tay production 09/10.
- `f0008a3`: hộ chiếu tính độ dài chuyến bằng `tripLengthDays` của contract thay cho phép tính tay; sửa comment
  lỗi thời của trang hộ chiếu, `booking-accordion` và `account-stats`.
- `4a88860`: JSDoc của `AccountActionError` ghi rõ `redirectTo` được ghép thẳng vào `?redirect=`, chỗ gọi tự
  encode (chuyển từ L1-15).
- `d32f730`: bốn ô của vé in (voucher và hoá đơn chờ) kẹp hai dòng và ngắt chuỗi liền. Phép tính vừa trang của
  voucher coi vé cao cố định, mà tên liên hệ được tới 120 ký tự: đo bản in thì tên 120 ký tự đẩy dải cuối (Where
  to meet, Cancellation, Payment) và chân trang của voucher tour 12 ngày ra khỏi tờ, còn tên một từ dài đè sang
  ba ô bên. Đánh đổi: tên dài hơn khoảng 25 ký tự bị cắt "…" trên giấy in; màn hình và trang đơn vẫn in đủ. Spec
  in ấn §3.4 thêm luật này.

**Review.** Đây chính là lượt review của luồng L4; không có lượt review độc lập cho các bản sửa. Đo bản in bằng
Chromium headless trên DB local: 68 đơn seed của đủ 12 tháng và 6 biến thể tạm, mọi tờ một trang A4. Chuyển
luồng khác qua coordinator: L7 (trợ lý AI ghi "Not paid" cho mọi đơn CANCELLED, kể cả đơn đã trả rồi được hoàn),
A1 (bộ lọc Status của My bookings đếm theo trạng thái DB còn huy hiệu theo giai đoạn; `toRefund` trả `amount`
thiếu hai số lẻ), F2 (đơn seed đã trả mang mã thanh toán giả, nên huỷ chuyến có đơn ấy trên production thì cổng
từ chối hoàn). Hai đề xuất Yuri chọn trên thẻ 20/10: L4-08 để sau buổi bảo vệ (`G56` ở open-items), L4-09 giữ
nguyên mã trang tem đã gỡ tạm. Yuri bảo gộp 20/10 11:23 UTC.

Tests after (`gate:int` trên `d32f730`, nền `3e78c3f`, 20/10, session cloud, API sống ở :3001): unit 8244
(web 2432, admin 2390, api 1402, mobile 880, contract 800, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26)
và int 957; Biome 2092 file. PR thêm 5 test unit ở web và một khẳng định vào int test hoàn tiền của
admin.

**CÒN TREO:**

- Buổi test tay: bốn bước ở mục 3 của `code-review/L4-bao-cao.md` (hai tab cùng một đơn chờ trả với Pay now và
  Cancel booking, khối tiền của đơn hoàn một phần, huỷ chuyến trên một đợt không có đơn seed đã trả và khác đợt
  khách tự huỷ, in voucher của đơn có tên liên hệ dài).
- Dọn nhánh `fix/review-l4-customer-bookings-51rc91` trên origin nếu GitHub không tự xoá.

## 2026-10-20 — Merge review L1 đăng nhập và tài khoản khách: đóng đăng nhập bằng OTP email, xoá tài khoản xoá cả hội thoại chat, đăng nhập xong về đúng trang, API lỗi không còn đẩy khách ra `/login` (`81ccd67`)

Luồng L1 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `43e7c75` rồi rebase lên `f8f8634` trước khi đẩy.
Báo cáo đủ 20 phát hiện, gồm phần để lại và phần chuyển luồng: `code-review/L1-bao-cao.md` cùng thư mục. Nhánh
`fix/review-l1-auth-hch85p`, [PR #46](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/46),
thi công trên session cloud. Không migration, không biến env, không dependency mới; thêm một khoá i18n
(`accountProfile.connected.google`) và ADR-0017 AMEND §12 (đếm AMEND ở `docs/adr/README.md` lên 7).

- `2e58b12`: bốn route của plugin `emailOTP` vào `disabledPaths` (404): `/sign-in/email-otp` (đăng nhập không
  mật khẩu, email lạ thì tạo luôn tài khoản đã xác minh) và ba route đặt lại mật khẩu bằng OTP. Không app nào gọi
  chúng nhưng chúng sống trên API production: ai đọc được hộp thư của một tài khoản là có phiên mà không cần mật
  khẩu, trái chốt 21/09 rằng OTP email chỉ để xác minh email. Before-hook từ chối gửi OTP khác loại
  `email-verification` (400), nên route gửi OTP thôi nhận loại `sign-in`, loại từng gửi thư cho cả email chưa
  đăng ký.
- `8dfb7df`: xoá tài khoản xoá luôn hội thoại với trợ lý AI trong cùng transaction, tin nhắn đi theo cascade.
  User chỉ bị tombstone nên `onDelete: SetNull` của `chat_conversations` không chạy, và nội dung chat (cả dữ liệu
  đơn trợ lý đọc ra theo ADR-0050 AMEND 2) từng còn tới 30 ngày.
- `fc28b4b`: link chéo giữa `/login` và `/register` cùng bước sang `/verify-email` mang `?redirect=` qua
  `withRedirect` (lọc bằng `safeRedirect`). Trước đó khách mới bị đẩy đi đăng nhập từ trang đặt tour, bấm
  "Create an account", đăng ký và xác minh xong thì về trang chủ, phải tìm lại tour.
- `043f29b`: nút "Log in" trên navbar mang pathname của trang đang xem.
- `296ed9e`: proxy của admin giữ cả query trong `?redirect=`, đăng nhập lại không mất bộ lọc của trang đang mở.
- `0499642`: hook tạo và sửa user chốt tên 120 và số điện thoại 30 ký tự, trả 400 `NAME_TOO_LONG` hoặc
  `PHONE_TOO_LONG`. Trước đó gọi thẳng `update-user` với giá trị quá cột ra 500 (thành sự cố giả trên Sentry),
  `sign-up` ra 422.
- `439d403`: tour không còn đợt đặt được vẫn có nút lưu tour trên trang chi tiết (L2-12, chuyển từ L2).
- `d94642b`: `requireSession` ném `SessionUnavailableError` khi API trả 5xx, 429 hoặc lỗi mạng, nên trang đặt
  tour, checkout và khu `/account` hiện trang lỗi có nút thử lại thay vì đẩy khách đã đăng nhập sang `/login`
  lúc API đang khởi động lại hay đang deploy (L3-19, chuyển từ L3). `getServerSession` của trang hỏi tour vẫn trả
  `null` để trang dựng được cho khách vãng lai.
- `94c7e49`: ba error boundary (`error.tsx` và `global-error.tsx` của web, `error.tsx` của admin) gọi `retry()`
  thay vì `reset()`. Ở Next 16 `reset` chỉ dựng lại cây con, không tải lại dữ liệu server, nên lỗi phát từ
  Server Component bấm "Try again" là hiện lại đúng lỗi cũ.
- `f02640b`: mục "Connected accounts" của Settings đọc `GET /api/auth/list-accounts` của Better Auth song song
  với hồ sơ và in một dòng cho mỗi cách đăng nhập thật (mật khẩu, Google); không đọc được thì bỏ cả mục. Trước
  đó mục này luôn in "Email & password", kể cả tài khoản chỉ đăng nhập bằng Google.
- `81ccd67` (`test(admin)`, file của luồng A5, không đổi hành vi): ca focus của `confirm-write-dialog.spec.tsx`
  chờ focus đầu của Base UI đậu vào ô ghi chú rồi mới bấm gửi. Ở máy rảnh ca ấy đỏ ở mọi lần chạy cả file, kể cả
  trên `main`, nên làm đỏ `gate:int` cục bộ của các thread; CI GitHub chậm hơn nên vẫn xanh.

**Review.** Đây chính là lượt review của luồng L1; không có lượt review độc lập cho các bản sửa. Báo luồng khác
qua coordinator: L7 (xoá tài khoản nay xoá hội thoại chat), A5 (dòng chờ focus trong test hộp xác nhận), F3 và A5
(error boundary đã chuyển sang `retry()`, không cần làm lại). Chín mục Ghi lại để nguyên, gồm Sign out lúc mất
mạng không báo gì và admin bị 429 khi đăng nhập không biết phải chờ; không có đề xuất nào chờ Yuri chốt. Yuri bảo
đẩy lên main 20/10 07:35 UTC.

Tests after (`gate:int` trên `81ccd67`, nền `f8f8634`, 20/10, session cloud, API sống ở :3001): unit 8239
(web 2427, admin 2390, api 1402, mobile 880, contract 800, mobile-ui 145, i18n 64, ui 57, core 48, tokens 26)
và int 957; Biome 2092 file. PR thêm 23 test unit ở web, 2 ở admin và 3 test int ở api.

**CÒN TREO:**

- Buổi test tay: chín bước ở mục 3 của `code-review/L1-bao-cao.md` (curl `/sign-in/email-otp` phải ra 404, OTP
  xác minh email trên web và app, quên mật khẩu, khách mới về đúng trang đặt tour, nút Log in của navbar, admin
  giữ bộ lọc, xoá tài khoản xoá chat, Connected accounts của tài khoản Google).
- Dọn nhánh `fix/review-l1-auth-hch85p` trên origin nếu GitHub không tự xoá.

## 2026-10-20 — Merge review L2 đợt hai: hàng tháng của tab Departures chỉ tính đợt còn đặt được, `BookingRail` bỏ biến thể rail (`78e6e8c`)

Đợt hai của luồng L2 (kế hoạch review 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`): hai đề xuất L2-09 và L2-10 của báo cáo `code-review/L2-bao-cao.md`
cùng thư mục, Yuri chọn làm cả hai lúc 06:31 UTC sau PR #44. Nhánh `fix/review-l2-browse-xfgnsc` dựng lại trên
`main` `451f82f`, [PR #48](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/48), thi công trên session
cloud. Chỉ đụng web và i18n: không migration, không biến env, không dependency mới; bỏ ba khoá i18n không còn
chỗ đọc.

- `ed3faca`: `departureMonths` tính ghế và khoảng giá của hàng tháng trên tập `isDepartureOpen`, cùng tập với ô
  "Seats left", "Price range" và huy hiệu tháng. Trước đó tháng chỉ còn đợt đã qua hạn đặt in "N of M seats
  left" ngay cạnh huy hiệu "Booking closed", và đợt khuyến mãi đã hết chỗ kéo đáy khoảng giá của tháng xuống.
  Tháng không còn đợt đặt được nay ghi 0 ghế, cột giá giữ giá của mọi đợt trong tháng. Modal "All dates" chỉ
  đọc tháng và danh sách đợt nên không đổi.
- `c1c88cc`: `BookingRail` bỏ biến thể `rail` (cột phải dính), không còn call-site từ khi trang Tour Details
  ghép lại 13/08 (`9c3178c`), cùng `PriceBlock`, `SeatMeter`, prop `variant`, ba prop chỉ rail dùng và khoá
  `tourDetail.departures.railLabel`; các case rail ở hai spec xoá theo. Bar đáy không đổi hành vi.
- `78e6e8c`: bỏ `tourDetail.departures.stripHeading` và `seeAll`, mất chỗ đọc từ khi dải đợt dưới hero xoá
  21/09 (L2-17 của báo cáo).

**Review.** Đây là lượt sửa theo đề xuất của chính luồng L2; không có lượt review độc lập. Yuri bảo đẩy lên main
20/10 07:35 UTC.

Tests after (`gate:int` trên `78e6e8c`, nền `451f82f`, 20/10, session cloud, API sống ở :3001): unit 8214
(admin 2388, web 2404, api 1402, mobile 880, contract 800, mobile-ui 145, i18n 64, ui 57, core 48, tokens
26) và int 954; Biome 2089 file. Web bớt 1 test: thêm 4 test cho L2-09, bỏ 5 case rail.

**CÒN TREO:**

- Buổi test tay: bước 5 và 6 ở mục 3 của `code-review/L2-bao-cao.md` (hàng tháng có đợt "Booking closed" ghi
  "0 of N seats left", bar đáy dưới 1024px dẫn Reserve sang `/book`).
- Dọn nhánh `fix/review-l2-browse-xfgnsc` trên origin nếu GitHub không tự xoá.

## 2026-10-20 — Merge review M3 mobile đặt tour, chuyến, đánh giá: hoá đơn đọc lại sau khi khách quay về từ trang trả trên Android, tracker của tour đã gỡ đưa về hoá đơn, upload ảnh có trần, đồng hồ server đo lại khi app quay lại (`32e9139`)

Luồng M3 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `43e7c75` rồi rebase lên `99de947` trước khi đẩy.
Báo cáo đủ 20 phát hiện, gồm phần để lại và phần chuyển luồng: `code-review/M3-bao-cao.md` cùng thư mục. Nhánh
`fix/review-m3-mobile-booking-g0iuac`, [PR #47](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/47),
thi công trên session cloud. Chỉ đụng `apps/mobile/src`: không migration, không biến env, không dependency mới,
không khoá i18n mới; không sửa file nào trong danh sách Nghĩa làm lại giao diện 22–30/10.

- `04b0597`: `openCheckout` đợi lần AppState về `active` kế tiếp rồi mới trả, cùng cách polyfill
  `openAuthSessionAsync` của expo-web-browser. Trên Android `openBrowserAsync` trả `opened` ngay khi Custom Tab
  bật (iOS đợi đóng), nên nút Pay của hoá đơn đọc lại đơn TRƯỚC khi khách trả: trả xong quay về app vẫn thấy
  "Payment due" cho tới khi rời màn.
- `d9f752d`: B6 đánh dấu `bookings.mine` cũ khi đơn ra trạng thái cuối. Trước đó tab Trips đã mở trong phiên vẫn
  giữ "Payment due" sau khi B6 báo đã trả, vì app không có focus refetch.
- `43854cc`: tracker không retry `NOT_FOUND` của `catalog.tours.bySlug` và `replace` sang hoá đơn. Admin gỡ
  publish tour không bị chặn khi còn đơn sống, nên trước đó đơn PAID của tour ấy mở ra tracker chỉ có nút Retry
  không bao giờ thành công, khách không tới được hoá đơn để xem hay huỷ.
- `ce0a0c5`: "Contact us" ở hoá đơn đã trả còn hạn huỷ mở form enquiry gắn sẵn chuyến (trước đó mở trang tour),
  cùng đích với tracker và tấm huỷ quá hạn; hai lối gom về `openEnquiry`.
- `41cf13e`: huỷ giữ chỗ gặp `NOT_PENDING` (đơn vừa được trả nơi khác hoặc câu quét đã huỷ) thì đóng tấm và đọc
  lại đơn thay vì hiện "Something went wrong"; hàm `cancelPendingErrorAction` cùng khuôn `payErrorAction`.
- `b2f0d56`: `uploadToCloudinary` đặt `xhr.timeout` 120 giây và reject ở `timeout`, `abort`. React Native không
  có trần mặc định (OkHttp của Android đặt 0), nên mạng treo giữa chừng làm ô ảnh quay mãi và khoá nút gửi
  review; nay ô ảnh chuyển lỗi và thử lại được.
- `7f858ec`: "Back to tour" sau khi gửi enquiry dùng `router.dismissTo`, lùi về trang tour nằm dưới thay vì đẩy
  thêm một bản đè lên màn "đã gửi".
- `a4c6404`: `useServerClock` nghe AppState và đánh dấu `health.check` cũ khi app quay lại foreground. Trước đó
  lệch đồng hồ chỉ đo một lần mỗi phiên, nên chỉnh đồng hồ máy giữa phiên làm "giờ server" của tracker trôi
  đúng bằng khoảng vừa chỉnh.
- `32e9139`: đóng tấm huỷ thì xoá câu lỗi của lượt huỷ trước.

**Review.** Đây chính là lượt review của luồng M3; không có lượt review độc lập cho các bản sửa. Chuyển luồng
khác qua coordinator: M2 (`formatFullDate` cắt ngày UTC nên mốc thời gian từ 00:00 tới 07:00 giờ VN in lùi một
ngày), L4 (web `cancelPending` gặp `NOT_PENDING` hiện lỗi chung), A2 (đợt khởi hành dài khác `durationDays` làm
tracker in "Day n of N" lệch). Chuyển Nghĩa qua Yuri: màn P6 `trip-ended-screen.tsx` vẫn mời viết đánh giá cho
đơn `PARTIALLY_REFUNDED` hoặc `REFUNDED` mà API sẽ từ chối. Một đề xuất chờ Yuri chốt: M3-14 (tách view model
khỏi route hoá đơn và route tracker, chuyển khoảng 250 dòng, thêm khoảng 300 dòng test, chỉ làm sau khi phần
của Nghĩa đã gộp). Yuri bảo đẩy lên main 20/10 03:09 UTC.

Tests after (`gate:int` trên `32e9139`, nền `99de947`, 20/10, session cloud, API sống ở :3001): unit 8215
(admin 2388, web 2405, api 1402, mobile 880, contract 800, mobile-ui 145, i18n 64, ui 57, core 48, tokens
26) và int 954; Biome 2089 file. PR thêm 16 test unit ở mobile.

**CÒN TREO:**

- Bản APK mới từ `main` (EAS trên PC) để các sửa tới máy khách, gộp vào lượt dựng lại sau phần giao diện của
  Nghĩa (22–30/10).
- Buổi test tay: tám bước ở mục 3 của `code-review/M3-bao-cao.md`, làm trên Android (Pay ở hoá đơn rồi đóng
  trình duyệt, tour bị gỡ publish, Contact us, huỷ giữ chỗ sau khi trả trên web, upload ảnh lúc mất mạng, Back to
  tour, chỉnh đồng hồ máy, mở lại tấm huỷ).
- Dọn nhánh `fix/review-m3-mobile-booking-g0iuac` trên origin nếu GitHub không tự xoá.

## 2026-10-20 — Merge review L2 tìm và xem tour: modal review báo lỗi và cho thử lại, lịch trình đủ trong HTML, `?page=` được kẹp, khoảng giá bỏ đợt hết chỗ (`eab1e57`)

Luồng L2 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `43e7c75` rồi rebase lên `46f96d5` trước khi đẩy.
Báo cáo đủ 16 phát hiện, gồm phần để lại và phần chuyển luồng: `code-review/L2-bao-cao.md` cùng thư mục. Nhánh
`fix/review-l2-browse-xfgnsc`, [PR #44](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/44), thi công
trên session cloud. Chỉ đụng web và i18n: không migration, không biến env, không dependency mới; hai khoá i18n
mới.

- `28b418b`: modal "Show all reviews" bắt lỗi khi tải trang lọc. Trước đó lời gọi API không có `.catch`: đổi
  sort, chọn mức sao hay sang trang lúc API ngủ hoặc mạng rớt thì modal giữ danh sách cũ dưới nhãn lọc mới,
  chân modal in số đếm cũ, không có chữ nào báo lỗi. Nay danh sách nhường chỗ cho câu
  `tourDetail.dialogs.reviewsLoadFailed` và nút "Try again" (`retry`) chạy lại đúng bộ lọc; chân modal bỏ số
  đếm; về bản mặc định thì hết báo lỗi.
- `5505ebf`: lightbox đóng thì trả thu/phóng về 100%. Trước đó phóng 150%, nhấn Esc rồi mở ảnh khác thì ảnh
  mới vẫn ở 150% với độ dời cũ.
- `a58ac3b`: tab Itinerary render mốc giờ của mọi ngày, ngày đóng chỉ mang `hidden`. Trước đó HTML server
  render chỉ có mốc của ngày 1 (ngày tự mở), trái ADR-0022 §2.
- `d22c2d3`: `/tours` làm tròn xuống và kẹp `?page=` về trang cuối có thật. Link cũ `?page=9` khi chỉ còn 3
  trang từng ra lưới rỗng kèm "No tours match your filters"; `?page=1.5` cắt lưới lệch nửa trang.
- `d2964f7`: `toursPage.resultSummary` chia số ít cho cả vế điểm đến ("1 tour across 1 destination").
- `6875af0`: breadcrumb trang tour bỏ `aria-current="page"` trên link chuyên mục.
- `eab1e57`: ô "Price range" và "Seats left" của tab Departures lọc bằng `isDepartureOpen` như giá "from" của
  hero và thẻ tour (ADR-0058 §1), nên đợt khuyến mãi đã hết chỗ không còn kéo đáy khoảng giá xuống.

**Review.** Đây chính là lượt review của luồng L2; không có lượt review độc lập cho các bản sửa. Chuyển luồng
khác qua coordinator: L1 (nút lưu tour chỉ hiện khi có đợt đang chọn), L8 (`/blog?page=` vượt số trang ra lưới
rỗng, cùng cách sửa với `d22c2d3`). Hai đề xuất chờ Yuri chốt: L2-09 (hàng tháng của tab Departures cộng cả
đợt đã đóng và đợt hết chỗ) và L2-10 (xoá biến thể `rail` không còn call-site của `BookingRail`, khoảng 120
dòng). Yuri bảo đẩy lên main 20/10 02:41 UTC.

Tests after (`gate:int` trên `eab1e57`, nền `46f96d5`, 20/10, session cloud, API sống ở :3001): unit 8199
(admin 2388, web 2405, api 1402, mobile 864, contract 800, mobile-ui 145, i18n 64, ui 57, core 48, tokens
26) và int 954; Biome 2086 file. PR thêm 9 test unit ở web và 2 ở i18n.

**CÒN TREO:**

- Buổi test tay: bốn bước ở mục 3 của `code-review/L2-bao-cao.md` (`/tours?page=9`, modal review lúc mất mạng
  rồi "Try again", mở ảnh khác sau khi phóng trong lightbox, mã nguồn trang tour có lịch trình của ngày 2).
- Dọn nhánh `fix/review-l2-browse-xfgnsc` trên origin nếu GitHub không tự xoá.

## 2026-10-20 — Merge review L3 đặt tour và thanh toán: huỷ đơn khi "Pay again" chạy song song, wizard sau Back từ cổng, trần số khách, trang chờ tự làm tươi (`368d484`)

Luồng L3 của đợt review code theo luồng (kế hoạch 20/10 trong thư mục chung của project,
`code-review/ke-hoach-review-theo-luong.md`), rà trên `main` `43e7c75`. Báo cáo đủ 20 phát hiện, gồm phần
để lại và phần chuyển luồng: `code-review/L3-bao-cao.md` cùng thư mục. Nhánh `fix/review-l3-booking-je1ptg`,
[PR #45](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/45), thi công trên session cloud. Không
migration, không biến env, không dependency mới; một khoá i18n mới.

- `fa92dbd`: `cancelPending` lấy session id từ `RETURNING` của chính câu `UPDATE`. Trước đó nó đọc session
  ngoài khoá, trước câu `UPDATE`, nên khách huỷ đơn đúng lúc "Pay again" vừa ghi session mới thì code vô hiệu
  session cũ (đã chết) và để session mới sống: tab thanh toán mới vẫn thu tiền cho đơn CANCELLED rồi hoàn tự
  động. Hàm thuộc L4 nhưng lỗi sinh từ `reCheckout` của L3 và L4 chưa mở (ngoại lệ mục 2.2 của kế hoạch).
  Hai int test mới: huỷ chen ngang lúc "Pay again", hai "Pay again" song song; `FakeGateway` có thêm độ trễ.
- `d6d2911`: `CheckoutAutoRefresh` làm tươi mỗi 5 giây trong phút đầu, rồi mỗi 30 giây tới mốc 10 phút. Bản
  cũ tắt sau 60 giây trong khi trang chờ vẫn in "This page updates automatically"; PayPal cần hai webhook.
  Component có spec đầu tiên.
- `368d484`: wizard nghe `pageshow` có `persisted` để mở lại nút Pay và Back khi trình duyệt khôi phục trang
  từ back-forward cache. `validateBookingForm`, `stepErrors`, `canLeaveStep` nhận trần của đợt đang chọn, nên
  party chọn ở đợt rộng rồi đổi sang đợt ít ghế bị chặn ở bước Travellers với câu mới
  `booking.errors.PARTY_OVER_SEATS`. 401 lúc bấm Pay hiện `AccountActionError` có link đăng nhập lại về đúng
  trang đặt tour. Hàng của màn Review ngắt dòng giá trị dài. Sửa hai comment lệch code.

**Review.** Đây chính là lượt review của luồng L3; không có lượt review độc lập cho các bản sửa. Chuyển
luồng khác qua coordinator: L4 (`classifyActionError` thiếu `NOT_PENDING`), L1 (`getServerSession` coi lỗi
mạng là chưa đăng nhập), F3 (timeout trình duyệt 10 giây có thể sinh hai đơn PENDING khi API vừa thức).
Nghi ngờ chưa kiểm được: Stripe coi `checkout.session.completed` là đã trả mà không đọc `payment_status`
(chỉ thành lỗi nếu Dashboard bật phương thức trả chậm). Yuri bảo đẩy lên main 20/10 02:35 UTC.

Tests after (`gate:int` trên `368d484`, nền `43e7c75`, 20/10, session cloud, API sống ở :3001): unit 8188
(admin 2388, web 2396, api 1402, mobile 864, contract 800, mobile-ui 145, i18n 62, ui 57, core 48, tokens
26) và int 954. PR thêm 10 test unit ở web và 2 test int ở api. Lượt đầu `@tourism/contract#test` chết vì
vitest EPIPE (flake đã biết), chạy riêng 800/800, chạy lại từ bước turbo thì xanh.

**CÒN TREO:**

- Buổi test tay: sáu bước ở mục 3 của `code-review/L3-bao-cao.md` (Back từ trang Stripe, danh sách phương
  thức trả trên trang Stripe, trần số khách khi đổi đợt, màn Review ở 390px, trang chờ của PayPal, huỷ đơn
  sau Pay now).
- Dọn nhánh `fix/review-l3-booking-je1ptg` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P6 sửa trợ lý lần ba: sau Cancel nói chưa gửi gì, không bảo bấm Send (`e90c60f`)

Yuri thử lại B3 trên production 19/10 lúc 13:12 UTC, sau PR #42. Thẻ hiện đúng "Enquiry not sent.", câu
"unable to process" đã hết và thẻ không còn tự điền ngày. Nhưng sau khi khách bấm Cancel, trợ lý nói "You'll
see a confirmation card… Please press Send to submit it", như thể thẻ vẫn chờ. Render ghi lượt sau Cancel
lúc 13:12:27, 47 token ra, khớp câu đó. Nguyên nhân: câu lý do chung "The visitor did not press Send…"
của PR #42 bị model hiểu là "chưa bấm Send". Nhánh `feat/p6-ai-concierge-3xp4sq` (tạo lại từ `c215d97`),
[PR #43](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/43), thi công trên session cloud. Không
migration, không biến env, không dependency mới, không copy mới.

- `e90c60f`: `ENQUIRY_NOT_SENT_REASON` ở `chat-history.ts` tách làm hai hằng. `ENQUIRY_CANCELLED_REASON` cho
  thẻ khách bấm Cancel: khách đã bấm Cancel, chưa gửi gì, thẻ đã đóng nên không còn gì để bấm, không phải
  lỗi, hãy nói chưa gửi gì. `ENQUIRY_SKIPPED_REASON` cho thẻ bị đóng vì khách gõ tin khác hoặc trả lời thẻ
  khác cùng tin. Spec P6 §2c ghi lần sửa thứ ba.
- Commit merge này: open-items dòng P6 ghi kết quả thử và việc còn treo.

**Review.** Không có lượt review độc lập. Chưa thử với model thật (container không có API key); test chỉ
chứng minh model nhận đúng câu lý do. Nếu B3 còn hỏng, hướng tiếp theo là bỏ lượt gọi model sau Cancel và
cho server trả một câu cố định. Yuri bảo đẩy lên main 19/10 13:20 UTC.

Tests after (`gate:int` trên `e90c60f`, nền `c215d97`, 19/10, session cloud, API sống ở :3001): unit 8178
(admin 2388, web 2386, api 1402, mobile 864, contract 800, mobile-ui 145, i18n 62, ui 57, core 48, tokens
26) và int 952; Biome 2085 file. PR thêm 2 test unit ở api và đổi câu kiểm lý do ở hai test int.

**CÒN TREO:**

- Trên production: thử lại B3 (Start over, xin gửi enquiry, bấm Cancel: trợ lý nói chưa gửi gì, không bảo
  bấm Send, admin không có enquiry mới). Đạt thì dòng P6 chuyển sang open-items-closed.
- Dọn nhánh `feat/p6-ai-concierge-3xp4sq` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P6 sửa trợ lý: bấm Cancel thì nói chưa gửi gì, travelDate chỉ cho ngày khách nói rõ (`5596064`)

Yuri thử lại trên production 19/10 lúc 12:37–12:41 UTC, sau PR #41. B4 đạt: hỏi "Saigon Vespa" ra tour
"Sài Gòn After Dark by Vespa" kèm ngày khởi hành gần nhất. Enquiry lần hai trong cùng cuộc chat đạt: trợ lý
nói đội đã nhận và chỉ nút Start over, không mở thẻ thứ hai. B3 hỏng: sau Start over, bấm Cancel trên thẻ
thì thẻ hiện đúng "Enquiry not sent.", nhưng trợ lý nói "I'm unable to process this enquiry" và gợi ý thử
lại với ngày cụ thể. Nguyên nhân: approval bị từ chối mà không có lý do thì AI SDK đưa model câu mặc định
"Tool call execution denied.", model đọc thành lỗi. Thẻ ấy còn điền Travel date 2026-12-15 dù khách chỉ nói
"in December" (suy từ ảnh; log không ghi input). Render ghi đủ các lượt trong hai hội thoại. Nhánh
`feat/p6-ai-concierge-3xp4sq` (tạo lại từ `70f0c5e` sau khi PR #41 merge),
[PR #42](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/42), thi công trên session cloud. Không
migration, không biến env, không dependency mới, không copy mới.

- `5596064`: hằng `ENQUIRY_NOT_SENT_REASON` ở `chat-history.ts` (khách không bấm Send, chưa gửi gì, đó là
  lựa chọn của khách chứ không phải lỗi) gắn vào `approval.reason` ở cả ba đường từ chối: Cancel, gõ tin
  khác thay vì bấm thẻ, phần chờ thứ hai bị tự từ chối. Trường `travelDate` của `submitEnquiry` có mô tả
  riêng: chỉ ngày khách nói rõ, tháng hay ngày áng chừng để trong `message`. Spec P6 §2c ghi lần sửa.
- Commit merge này: open-items dòng P6 ghi kết quả thử và việc còn treo.

**Review.** Không có lượt review độc lập. Chưa thử với model thật (container không có API key); test chỉ
chứng minh model nhận đúng câu lý do. Yuri bảo đẩy lên main 19/10 12:50 UTC.

Tests after (`gate:int` trên `5596064`, nền `70f0c5e`, 19/10, session cloud, API sống ở :3001): unit 8176
(admin 2388, web 2386, api 1400, mobile 864, contract 800, mobile-ui 145, i18n 62, ui 57, core 48, tokens
26) và int 952; Biome 2085 file. PR thêm 2 test unit ở api và câu kiểm lý do ở hai test int sẵn có.

**CÒN TREO:**

- Trên production: thử lại B3 (Start over, xin gửi enquiry, bấm Cancel: trợ lý nói chưa gửi gì, admin
  không có enquiry mới). Đạt thì dòng P6 chuyển sang open-items-closed.
- Dọn nhánh `feat/p6-ai-concierge-3xp4sq` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P6 sửa trợ lý: tìm tour bằng một từ khoá, thẻ enquiry thứ hai báo đã gửi (`9ff2e4d`)

Yuri thử lại trên production 19/10 lúc 11:17–11:21 UTC, sau PR #38. A8 đạt: dòng `chat turn` có `page`
là `red-river-craft-villages-day`, trợ lý trả lời còn 2 chỗ ngày 27/10, khớp trang. B1 đạt: thẻ xác nhận
hiện, log có `submitEnquiry`. B2 đạt: enquiry lúc 11:19 UTC có trong admin; Render ghi đã giao
`ENQUIRY_RECEIVED` và `ENQUIRY_ADMIN_ALERT` lúc 11:20:50; Resend báo delivered; hai mail tới hộp thư.
Còn hai chỗ sai. B4: "Saigon Vespa" không ra tour "Sài Gòn After Dark by Vespa", vì `search` là chuỗi
con có phân biệt dấu. Trong cùng hội thoại sau khi đã gửi, trợ lý mời thẻ thứ hai; thẻ hiện "Enquiry not
sent." và trợ lý nói "wasn't able to process", nghe như hỏng. Nhánh `feat/p6-ai-concierge-3xp4sq` (tạo
lại từ `2291509` sau khi PR #38 merge), [PR #41](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/41),
thi công trên session cloud. Không migration, không biến env, không dependency mới.

- `9ff2e4d`: prompt thêm khối "Searching" (tìm bằng một từ khoá, nơi chốn đi bằng slug điểm đến, không ra
  thì tìm lại trước khi nói không có tour) và hai luật enquiry (mỗi hội thoại một enquiry, kể cả khi tool
  trả `already_sent`; khách bấm Cancel thì nói chưa gửi gì). Mô tả `search` của `searchTours` nói rõ là
  một từ khoá. Thẻ nhận `sent: false` hiện copy mới `chatBot.confirm.alreadySent` thay câu của nút
  Cancel. Spec P6 §2c và §2h ghi hai lần sửa.
- Commit merge này: open-items dòng P6 ghi kết quả thử và việc còn treo.

**Review.** Không có lượt review độc lập. Chưa thử với model thật (container không có API key). Nguyên
nhân của B4 suy từ cách tìm (`contains` không bỏ dấu); log không ghi từ khoá model đã gõ. Yuri bảo đẩy
lên main 19/10 11:47 UTC.

Tests after (`gate:int` trên `2ec656b`, nền `2291509`, 19/10, session cloud, API sống ở :3001): unit 8174
(admin 2388, web 2386, api 1398, mobile 864, contract 800, mobile-ui 145, i18n 62, ui 57, core 48, tokens
26) và int 952; Biome 2085 file. PR thêm 4 test prompt ở api và 1 test thẻ ở web. Test contract chết giữa
chừng ở lượt đầu (worker vitest thoát khi máy tải nặng), chạy riêng 800/800, chạy lại cả gate thì xanh.

**CÒN TREO:**

- Trên production: thử lại B4 (ra đúng tour Vespa và đưa link đặt); xin gửi enquiry lần hai trong cùng
  cuộc chat (trợ lý nói đã gửi; nếu thẻ vẫn hiện thì sau Send báo đã gửi trước đó); B3 (bấm Start over rồi
  Cancel, admin không có enquiry mới). Đạt thì dòng P6 chuyển sang open-items-closed.
- Dọn nhánh `feat/p6-ai-concierge-3xp4sq` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge sửa comment `SENTRY_DSN` trong `render.yaml`; Sentry của API đã bật trên production (`aceebc2`)

Phần hạ tầng trong mục CÒN TREO của entry PR #37 (Sentry bắt lỗi 500 của API) đã xong 19/10. Nhánh
`claude/project-thread-4trwm7`, [PR #40](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/40),
làm trên session cloud. Chỉ đổi comment YAML và tài liệu: không migration, không biến env, không
dependency mới.

- `aceebc2`: comment cạnh `SENTRY_DSN` trong `render.yaml` còn ghi "seam chưa nối, đặt DSN không gửi gì",
  sai từ PR #37. Nay ghi đúng: có DSN thì lỗi 500 của API lên Sentry, chỉ kèm method và đường dẫn; DSN
  gõ sai thì API không boot; bỏ trống là tắt; kiểm bằng `pnpm sentry:test`.
- Commit merge này: dòng "Bật Sentry cho API" chuyển từ open-items sang open-items-closed, kèm lời ghi đóng.

**Việc hạ tầng đã làm** (Yuri làm tay, thread hướng dẫn từng bước). Project `nexora-api` kiểu Node.js
trên Sentry. `SENTRY_DSN` đặt trên Render; lượt Save and deploy xếp hàng sau bản tự deploy của PR #38 và
live 11:00 UTC trên `f897a7a`. Log Render (đọc chỉ-đọc) có `[Observability] Sentry bật
(environment=production)` lúc 11:00:36 UTC, rồi `listening on :3001 (production) + inline worker`,
không dòng lỗi. `SENTRY_DSN` cũng ghi vào `apps/api/.env.production` trên máy. `sentry:test` từ máy lúc
11:25 UTC in `Sentry bật (environment=development)` và `✓ Đã gửi sự kiện thử`; Sentry có issue
NEXORA-API-1 đúng mốc giờ, environment `development`, Users 0; Yuri đã Resolve.

**Review.** Không có lượt review độc lập. Chưa có lỗi 500 thật nào từ production lên Sentry, nên bộ lọc
request (`scrubEvent`) mới được đo trên session cloud với một máy nhận Sentry giả (entry PR #37), chưa
trên dữ liệu thật.

**CÒN TREO:** khi có lỗi 500 thật đầu tiên trên production, mở issue trong Sentry và xác nhận request
chỉ có method và đường dẫn, không header, query, cookie hay email.

Tests after: không chạy `gate:int` vì chỉ đổi comment YAML và Markdown; CI của PR #40 trên `fdd9edb`
(cùng diff `render.yaml`, trước lần rebase lên `2291509`) xanh; CI trên main là lưới.

## 2026-10-19 — Merge nhật ký thao tác admin: trang `/activity` chỉ Owner, ghi tự động sau mỗi lệnh ghi thành công (`6f50333`..`e597e59`)

Mục 8 của bản rà "Việc còn thiếu ở api, web, admin": Yuri chốt làm 19/10 08:36 UTC, chọn "Chỉ Owner"
08:49 UTC. Nhánh `feat/admin-audit-log`,
[PR #39](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/39), thi công trên session cloud. Một
migration `20261019094109_admin_activity` (bảng `admin_activity` chỉ thêm, bật RLS): Yuri chạy tay trên
Supabase 19/10 11:14 UTC trước khi đẩy main; ảnh chụp cho thấy đúng một migration chờ, áp dụng xong,
`Database schema is up to date!`, production còn 34 migration. Không biến env, không dependency mới.

- `6f50333`: [ADR-0061](adr/0061-admin-activity-log.md),
  [spec](specs/2026-10-19-admin-activity-log-design.md) và
  [plan](plans/2026-10-19-admin-activity-log.md).
- `41a0c25`: contract. `ADMIN_ACTIVITY` phân loại `log` hoặc `skip` cho mọi khoá của `ADMIN_ACCESS`
  (`satisfies`, thêm thủ tục admin mà quên phân loại là đỏ typecheck): 37 thủ tục `log`, 14 khu vực.
  `admin.activity.list` (Owner) lọc theo người, khu vực, khoảng ngày (`createdAtRange`), phân trang, kèm
  danh sách người có trong nhật ký; `admin.activity.recordExport` (Staff gọi được) cho ba loại xuất.
- `f8673ec`: API. Bảng `admin_activity` chép nhãn người làm và nhãn đối tượng lúc ghi, nên dòng còn đọc
  được khi đối tượng bị xoá hay tài khoản bị xoá cứng. `@AdminImplement` gắn interceptor cho thủ tục
  `log`; interceptor nối một middleware oRPC chạy sau bước kiểm input và ghi sau khi handler thành công,
  nên input sai, lỗi 404/409 hay `changed: false` không ghi. Ghi lỗi thì chỉ log và báo Sentry, response
  không đổi. Lệnh xoá đọc nhãn trước khi chạy. Không chép email, số điện thoại của khách hay chữ admin gõ
  (lý do khoá, ghi chú, lý do hoàn tiền). `data:reset` xoá bảng này.
- `e597e59`: admin. Mục Activity cuối nhóm System, chỉ Owner; Staff mở thẳng `/activity` thì về trang
  "Owner only". Bảng When · Who · What · Item, mới nhất trước, lọc People, Area và khoảng ngày, nút xoá
  lọc, phân trang. Ba route xuất Excel (bookings, subscribers, báo cáo tháng) báo lượt xuất sau khi dựng
  file; báo lỗi thì file vẫn tải về.
- Commit merge này: CHANGELOG, CLAUDE.md roadmap, mục lục specs và dòng trạng thái của spec.

**Review.** Không có lượt review độc lập. Yuri bảo đẩy lên main 19/10 11:16 UTC ("Đẩy PR #39 lên main").
Nhánh rebase lên `f897a7a` không xung đột. Int nhật ký (19 test): lưới quét mọi controller, đúng 37 thủ
tục có interceptor; gỡ bán tour ghi một dòng, lặp lại không đổi gì thì không ghi; 404, 400 và 409 không
ghi; xoá tour giữ nhãn, list trả `ref` null; Staff ghi dòng mang bậc Staff; enquiry và cấp quyền Staff
không chép email hay số điện thoại; ghi nhật ký lỗi thì thao tác vẫn thành công; recordExport ba loại;
list lọc người, khu vực, ngày, phân trang; quyền list chỉ Owner. Chromium thật trên bản build với API
sống ở 1440, 768 và 390: gỡ bán một tour ghi "Took off sale" kèm link tour; bán lại bị 409 (tour seed
thiếu ảnh bìa) và không ghi; xuất bookings ghi "730 rows · everything"; lọc Area và ngày đúng; Staff không
thấy mục Activity; không cuộn ngang trang.

Tests after (`gate:int` trên `e597e59`, 19/10, session cloud, API sống ở :3001): unit 8169 (web 2385,
admin 2388, api 1394, mobile 864, contract 800, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
952 (57 file); Biome 2085 file. So với `f897a7a`: admin thêm 32 test, api 13, contract 16, int 19 (một
file mới); Biome thêm 18 file; các gói khác không đổi.

**CÒN TREO:**

- Thử tay production theo spec §8.1, từng bước, chờ xác nhận: gỡ bán rồi bán lại một tour thì `/activity`
  có "Took off sale" và "Put on sale" với link đúng tour; xuất Excel ở `/bookings` thì có dòng "Exported
  bookings" với số dòng khớp file; đăng nhập Staff thì không thấy mục Activity, mở `/activity` về trang
  "Owner only".
- Dọn nhánh `feat/admin-audit-log` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P6 sửa trợ lý: câu không nêu tên tour là hỏi tour đang xem, yêu cầu tour riêng là enquiry (`a8eab3a`)

Yuri chạy 28 kịch bản thử tay của trợ lý trên production 19/10 khoảng 09:30 UTC: đạt, trừ A8 và B1. A8:
hỏi về Sa Pa, mở trang Bát Tràng rồi hỏi số chỗ còn lại thì trợ lý trả lời theo tour Sa Pa. B1: xin tour
Hạ Long riêng cho 6 người kèm tên và email thì không hiện thẻ xác nhận enquiry; log Render cả ngày chưa
có lượt nào gọi `submitEnquiry`, lượt B1 chỉ gọi `searchTours`. Trước đó (09:07–09:21 UTC) Yuri đã thử
hỏi đơn khi đã và chưa đăng nhập theo mục CÒN TREO của entry PR #35: đạt. Nhánh
`feat/p6-ai-concierge-3xp4sq`, [PR #38](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/38),
thi công trên session cloud. Không migration, không biến env, không dependency mới.

- `a8eab3a`: prompt. Câu ngữ cảnh tour đang xem nói khách có thể đã chuyển trang giữa hội thoại, và câu
  không nêu tên tour (chỗ, ngày, giá, phần bao gồm) là hỏi tour ấy dù trước đó bàn tour khác. Khối
  Enquiries thêm: yêu cầu mà tour có sẵn không phủ (tour riêng, đi theo nhóm, ngày riêng) là enquiry;
  có tên và email thì gọi `submitEnquiry` ngay trong lượt đó thay vì hỏi xác nhận bằng chữ (thẻ là bước
  xác nhận); tháng hay khoảng ngày ghi vào lời nhắn, `travelDate` chỉ cho một ngày cụ thể. Mô tả tool
  `submitEnquiry` thêm ví dụ tour riêng, nhóm, ngày riêng. Dòng log `chat turn` thêm `page` (slug trang
  tour lúc gửi tin; dữ liệu công khai, vẫn không ghi nội dung tin). Spec P6 §2d và §2f ghi hai lần sửa.
- Commit merge này: open-items dòng P6 ghi kết quả thử và việc còn treo.

**Review.** Không có lượt review độc lập. Chưa thử với model thật (container không có API key); nguyên
nhân của B1 là suy từ log, chưa thấy câu trả lời thật của lượt ấy. Yuri bảo đẩy lên main 19/10 10:52 UTC.

Tests after (`gate:int` trên `a8eab3a`, 19/10, session cloud, API sống ở :3001): unit 8108 (web 2385,
admin 2356, api 1381, mobile 864, contract 784, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
933; Biome 2067 file. So với `a551710`: api thêm 4 test prompt, int thêm 1 (dòng log có `page`). Test
`zod-config.spec.ts` của contract quá 5 giây ở lượt đầu, chạy riêng 784/784, chạy lại cả gate thì xanh.

**CÒN TREO:**

- Trên production: thử lại A8 và B1. Dòng `chat turn` trên Render của lượt A8 phải có `page` đúng slug
  trang đang mở; lượt B1 phải có `submitEnquiry` trong `tools`. Sau đó B2 (bấm Send, có enquiry trong
  admin và email xác nhận) và B3 (bấm Cancel, không có enquiry mới). Đạt thì dòng P6 chuyển sang
  open-items-closed.
- Dọn nhánh `feat/p6-ai-concierge-3xp4sq` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge Sentry bắt lỗi 500 của API, khối Plan your trip cuối `/faq`, ghi bỏ sửa và xoá review ở admin (`db5bf45`..`25d8c56`)

Ba việc Yuri chốt 19/10 08:36 UTC sau bản rà việc còn thiếu ở api, web và admin: mục 4 (Sentry), mục 5
(sổ nợ E1, khối hỏi đáp cuối `/faq`), mục 7 (bỏ sửa, xoá review ở admin). Mục 8 (nhật ký thao tác admin)
chuyển sang thread admin. Nhánh `claude/project-thread-4trwm7`,
[PR #37](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/37), thi công trên session cloud.
Không migration, không biến env bắt buộc. Một dependency mới (`@sentry/node`), vào trước freeze 31/10.

- `db5bf45`: open-items-closed mục "Quyết định đã chốt" thêm dòng admin sửa, xoá, ghim và tự tạo đánh
  giá: cố ý bỏ (khách tự sửa hoặc rút đánh giá theo ADR-0032, admin duyệt và gỡ duyệt bằng
  `admin.reviews.moderate`, testimonials trang chủ là nội dung tĩnh theo sổ nợ B3).
- `ca1a4be`: component dùng chung `EnquiryCta` (`components/content/enquiry-cta.tsx`) dùng copy sẵn có ở
  `messages.enquiryCta`: eyebrow "Plan your trip", tiêu đề theo trang, ba lợi ích, link "Start
  planning" sang `/contact`. Là một thẻ trong cột nội dung, da panel "What happens next" của form liên
  hệ trang chủ, không phải băng sát footer như CTA bỏ ở `/destinations` 28/07. `/faq` đặt nó dưới câu
  hỏi cuối với `headings.faq`. Yuri duyệt ảnh chụp desktop, mobile và dark 19/10 09:44 UTC.
- `2e2dd84`: [ADR-0010 AMEND 1](adr/0010-infra-hardening.md): §3 nối Sentry thật, chín điểm (gói,
  khởi động, chỉ bắt lỗi, dữ liệu cá nhân tối thiểu, chế độ `strict` cho promise bị reject không ai bắt,
  DSN ép URL, release, lockfile, cách kiểm). Mục lục ADR ghi 1 AMEND.
- `4f3984a`: `@sentry/node` ghim `10.76.2` ở `apps/api`. `initObservability` gọi đầu `main.ts` và
  `worker.ts`; thiếu `SENTRY_DSN` thì không làm gì. `captureException` của hai call-site cũ (exception
  filter, `onError` của oRPC) đẩy lỗi lên Sentry. Không tracing, không móc ESM loader; `beforeSend` chỉ
  giữ method và đường dẫn của request, bỏ `user`; bỏ breadcrumb console; `OnUnhandledRejection` ở chế
  độ `strict`. `SENTRY_DSN` thành `z.url()`. Script `sentry:test` build rồi gửi một sự kiện thử.
  Lockfile: `@opentelemetry/api` thành peer tuỳ chọn được dùng của `next`, `better-auth`, `@orpc/*` ở
  mọi app.
- `25d8c56`: `/privacy` mục bên nhận thêm "our error-monitoring provider (Sentry)"; một ca test canh.
- Commit merge này: sổ nợ gạch E1, open-items thêm việc đặt DSN vào mục việc tay trên hạ tầng.

**Review.** Không có lượt review độc lập. Yuri duyệt khối `/faq` và bảo đẩy lên main 19/10 09:44 UTC.
Nhánh rebase lên `7b99cec` (PR #35) có một xung đột ở `privacy.ts`, giữ cả dòng Anthropic mới lẫn vế
Sentry; rebase tiếp lên `3ae6c68` không xung đột. Thử thật ở local: API chạy với DSN trỏ vào một server
Sentry giả, tắt Postgres rồi gọi `/api/tours?search=…` kèm cookie và Authorization; lỗi 500 tới nơi với
`request` chỉ còn method và URL không query, không chuỗi nào của cookie, token hay email. `sentry:test`
gửi được sự kiện thử tới server giả.

Tests after (`gate:int` trên `25d8c56`, 19/10, session cloud, API sống ở :3001): unit 8104 (web 2385,
admin 2356, api 1377, mobile 864, contract 784, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
932; Biome 2067 file. So với `3ae6c68`: web thêm 4 test, api 10; Biome thêm 4 file; các gói khác không
đổi. Test contract chết EPIPE của vitest ở lượt đầu, chạy lại riêng thì 784/784.

**CÒN TREO:**

- Hạ tầng (luật 15): tạo project Sentry kiểu Node.js, đặt `SENTRY_DSN` trên Render (service API) và
  trong `apps/api/.env.production`. Sau deploy: log boot của Render có dòng `Sentry bật
  (environment=production)`; chạy `sentry:test` với DSN production (cách chạy ở đầu
  `apps/api/scripts/sentry-test.mjs`) và thấy sự kiện thử trong Sentry. Chưa đặt DSN thì API chạy như cũ.
- Ở ngày thử tay: mở `/faq` trên production, thấy thẻ cuối trang và link sang `/contact`; mở `/privacy`
  thấy Sentry trong mục bên nhận.
- Dọn nhánh `claude/project-thread-4trwm7` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P4f Media library B: trang Photos của điểm đến, thêm ảnh vào thư viện từ `/media` (`a8dbdd5`..`6aeac90`)

Spec [2026-10-16-p4f-media-library-design.md](specs/2026-10-16-p4f-media-library-design.md) §8, Yuri duyệt
19/10 03:05 UTC. Nhánh `feat/admin-p4f-media-b`,
[PR #36](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/36), thi công trên session cloud. PR thứ
hai sau Media A (PR #34). Không migration, không biến env, không dependency mới, không đổi thiết lập
Cloudinary (thư mục `tourism/destinations/` tự có ở lần tải đầu).

- `a8dbdd5`: contract `schemas/admin-destinations.ts` và ba thủ tục `admin.destinations.photos` (đọc
  theo slug), `setPhotos` (thay trọn danh sách có thứ tự, kèm version), `signPhotoUploads` (ký lô tải
  lên), bậc `staff`. Plan [2026-10-19-p4f-media.md](plans/2026-10-19-p4f-media.md) phần Media B.
- `ea63bfb`: API. Một lần lưu chạy trong một transaction và giành version của điểm đến trước, nên trong
  hai lệnh lưu cùng lúc lệnh sau ra `STALE_DESTINATION` trước mọi lỗi khác. Ảnh chỉ đến từ hai nguồn: dòng
  đang có của điểm đến, hoặc ảnh tải lên trong thư mục riêng `destinations/<id>/`; khác đi là
  `PHOTO_NOT_ALLOWED`. Chỉ ảnh tải lên của chính điểm đến bị gỡ mới vào hàng dọn 7 ngày (đặt lại đồng hồ
  và số lần thử); tour đang mượn giữ dòng của mình. Xoá điểm đến đưa ảnh tải lên của nó vào hàng dọn.
  Vùng tải lên của bộ dọn thêm `destinations`.
- `2c8c657`: tách phần tải ảnh của tab Photos tour thành hook dùng chung (`usePhotoUploads`,
  `PhotoUploadRows`); `EditorFormFrame` nhận câu stale riêng.
- `c4fd493`: trang `/destinations/<slug>/photos` cho Owner và Staff, mở từ nút Photos ở bảng
  Destinations. Danh sách ảnh theo thứ tự, ảnh đầu là ảnh bìa (web chỉ vẽ ảnh này, ở thẻ điểm đến); kéo
  hoặc bấm để tải nhiều ảnh một lượt, sửa alt, đặt làm bìa. Ảnh gỡ khỏi danh sách hiện ở khối "Leaving
  the library when you save" kèm câu nói rõ hậu quả và nút Put back. Lưu danh sách rỗng cho điểm đến
  đang hiện trên web phải xác nhận. `/media` có menu Add photos to the library chọn điểm đến; link "Used
  in" và hàng dọn của ảnh điểm đến trỏ về trang này.
- `25b8962`: link Photos ở bảng điểm đến có viền như nút Edit cạnh nó (bọc `buttonVariants()` trong
  `cn(...)`).
- `6aeac90`: plan ghi các quyết định lúc thi công Media B.
- Commit merge này: dòng P4f ghi Media B xong rồi chuyển sang open-items-closed (cả ba vùng đã xây),
  CLAUDE.md roadmap, tiêu đề nhóm P4f ở mục lục specs.

**Review.** Không có lượt review độc lập. Yuri bảo merge 19/10 09:00 UTC ("Merge nhé"). Nhánh rebase lên
`7b99cec` không xung đột. Int ảnh điểm đến (12 test): đọc theo slug, slug lạ 404; thay trọn danh sách
giữ ghi công và số đo dòng cũ; gỡ ảnh thì chỉ ảnh tải lên của điểm đến vào hàng dọn, tour mượn giữ dòng
của mình; danh sách rỗng hợp lệ; version cũ ra `STALE_DESTINATION` không đổi gì; ảnh lạ ra
`PHOTO_NOT_ALLOWED` không ghi gì; ký lô đúng thư mục; xoá điểm đến đưa ảnh tải lên vào hàng dọn; bust tag
sau commit; Staff dùng được, khách 403, chưa đăng nhập 401. Chromium thật trên bản build với API sống
(Cloudinary chặn bằng phản hồi giả vì sandbox không ra mạng) ở 1440, 768 và 390: tải ảnh lên Bến Tre
rồi lưu thì `/media` hiện nó với nhãn Uploaded; gỡ rồi lưu thì hàng dọn có nó, hạn 7 ngày; gỡ một ảnh
catalog có tour mượn thì khối dưới nói tour vẫn giữ ảnh; lưu rỗng hỏi xác nhận; không cuộn ngang trang.

Tests after (`gate:int` trên `6aeac90`, 19/10, session cloud, API sống ở :3001): unit 8090 (web 2381,
admin 2356, api 1367, mobile 864, contract 784, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
932 (56 file); Biome 2063 file. So với `7b99cec`: admin thêm 27 test, api 11, contract 14, int 12; Biome
thêm 9 file; các gói khác không đổi.

**CÒN TREO:**

- Thử tay production theo spec §8.3 phần Media B, từng bước, chờ xác nhận: tải một ảnh vào một điểm đến
  rồi lưu, mở hộp Add from library ở tab Photos của một tour thấy ảnh mới, `/media` hiện nó với nhãn
  Uploaded và ghi công trống; gỡ ảnh ấy rồi lưu thì tab Cleanup queue có nó, hạn 7 ngày.
- Năm chỗ khác còn dùng `buttonVariants({ variant: 'outline' })` trần trên Link nên mất viền (bảng
  tours, bước Review của tour, đầu khu sửa tour, `app/error` và `app/not-found` của admin). Media B chỉ
  sửa chỗ của nó.
- Dọn nhánh `feat/admin-p4f-media-b` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P6 trợ lý đọc đơn của khách đã đăng nhập, nút Plan your trip mở thẳng khung chat (`2f60dca`..`64b4899`)

Yuri hỏi 19/10 07:45 UTC cho trợ lý đọc dữ liệu tài khoản của khách đang đăng nhập và bỏ lối "Send an
enquiry" ở menu nút nổi. Kế hoạch nằm trong thư mục chung của project; Yuri chọn phạm vi "Chỉ xem đơn"
07:46 và thêm luật cho khách chưa đăng nhập 08:00. Nhánh `feat/p6-ai-concierge-3xp4sq`,
[PR #35](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/35), thi công trên session cloud. Không
migration, không biến env, không dependency mới; trần chi phí ngày giữ nguyên.

- `2f60dca`: [ADR-0050](adr/0050-ai-concierge-chat.md) AMEND 2 (tool chỉ đọc đơn của chính khách, định
  danh lấy từ phiên; gắn hội thoại vô chủ vào tài khoản; luật cho khách chưa đăng nhập; nút nổi mở thẳng
  khung chat) và spec P6 cập nhật theo.
- `d279913`: API. Hai tool `listMyBookings` (tối đa 10 đơn, thứ tự như trang My bookings, lọc upcoming,
  past hoặc all) và `getMyBooking` (nhận mã chữ thường hay thiếu `BK-`; mã của người khác trả
  `found: false`, mã sai khuôn không chạm DB) chỉ đăng ký khi lượt có phiên, gọi `BookingsService.mine`
  và `byCode` với user id của phiên. `chat-bookings.ts` thu gọn đơn trước khi tới model: không email, số
  điện thoại, tên liên hệ, ghi chú, link thanh toán, id nội bộ, nội dung hay lý do bác review; trạng thái
  và thanh toán viết sẵn bằng chữ từ `bookingPhase`. Lượt POST có phiên vào hội thoại chưa có chủ gắn nó
  vào tài khoản (`updateMany` có điều kiện `userId: null`), từ đó khách khác và khách vãng lai nhận 404;
  GET không gắn. Prompt có khối Account theo cờ đăng nhập: khách chưa đăng nhập hỏi về đơn, thanh toán,
  hoàn tiền, tài khoản hay thông tin cá nhân chỉ nhận câu "I can't check this because you're not signed
  in. Please sign in and ask me again." kèm link `/login`.
- `13e7d2b`: web. Bỏ popover hai lối; nút "Plan your trip" mở và đóng khung chat. Khung hỏi
  `GET /api/chat` mỗi lần mở: "Connecting…" lúc chờ, trợ lý nghỉ thì câu "taking a break" kèm link
  enquiry. Khách đã đăng nhập thấy lời chào theo tên và gợi ý "Show my bookings". Phiên rời một tài khoản
  thì xoá id hội thoại khỏi localStorage và dỡ khung; từ vãng lai đăng nhập thì giữ hội thoại.
- `64b4899`: `/privacy` kể chi tiết đơn trợ lý tra cho khách đã đăng nhập cũng gửi tới Anthropic, không
  kèm email hay số điện thoại; hội thoại gắn tài khoản khi khách đăng nhập lúc khung đang mở; trình duyệt
  quên id hội thoại khi đăng xuất.
- Commit merge này: CLAUDE.md roadmap, dòng P6 ở open-items.

**Review.** Không có lượt review độc lập. Yuri bảo merge 19/10 08:35 UTC ("Merge nhé"). Nhánh rebase lên
`aab0c1c` không xung đột. Kiểm đột biến tay: bỏ bước gắn hội thoại, bỏ bước xoá id lúc đăng xuất, hay bỏ
điều kiện "phiên đang đọc" lúc hydrate thì test tương ứng đỏ. Chromium thật với API chạy model giả và tài
khoản seed ở 375 và 1440: khách vãng lai nhận câu mời đăng nhập; đăng nhập rồi hội thoại cũ được gắn vào
tài khoản (GET không phiên ra 404); "Show my bookings" ra danh sách có link trang đơn; đăng xuất thì khung
quên hội thoại. Không lỗi console, không cuộn ngang.

Tests after (`gate:int` trên `64b4899`, 19/10, session cloud, API sống ở :3001): unit 8038 (web 2381,
admin 2329, api 1356, mobile 864, contract 770, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
920; Biome 2054 file. So với `aab0c1c`: api thêm 46 test, web 7, int 3; Biome thêm 2 file; các gói khác
không đổi.

**CÒN TREO:**

- Ở ngày thử tay: đăng nhập trên production, bấm "Show my bookings" và hỏi một mã đơn, đối chiếu với trang
  My bookings; đăng xuất rồi hỏi lại thì nhận câu mời đăng nhập; mở `/privacy` thấy câu về chi tiết đơn.
- Dọn nhánh `feat/p6-ai-concierge-3xp4sq` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P4f Media library A: trang `/media` xem mọi ảnh, sửa alt và ghi công một lần cho mọi chỗ dùng, hàng dọn chỉ đọc (`fb1cf2e`..`dee3ec8`)

Spec [2026-10-16-p4f-media-library-design.md](specs/2026-10-16-p4f-media-library-design.md), Yuri duyệt 19/10
03:05 UTC. Nhánh `feat/admin-p4f-media`,
[PR #34](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/34), thi công trên session cloud. PR đầu
trong hai PR nối nhau; Media B (trình sửa ảnh điểm đến) theo sau. Không migration, không biến env, không
dependency mới, không đổi thiết lập Cloudinary.

- `fb1cf2e`: [ADR-0060](adr/0060-media-library.md) (Accepted 19/10), [ADR-0035](adr/0035-media-lifecycle.md)
  AMEND 4 (hàng dọn có màn chỉ đọc, handler trả báo cáo) và plan
  [2026-10-19-p4f-media.md](plans/2026-10-19-p4f-media.md). Một ảnh là một publicId; sửa alt và ghi
  công một lần thì mọi dòng của ảnh đổi theo; không có nút xoá ảnh.
- `d229ff0`: contract `schemas/admin-media.ts` (chỗ dùng, mục ảnh, cờ chú ý, input `update` với chuỗi
  rỗng thành `null` và link chỉ `http`/`https`, hàng dọn bốn trạng thái và `lastSweep`) và ba thủ tục
  `admin.media.list`, `update`, `queue` bậc `staff`. Hàm thuần dùng chung hai phía: `isCcByLicense`,
  `mediaAttention`, `mediaAltRequired`.
- `215c2cb`: API. `list` đọc dòng ảnh và tên chủ trong hai lượt, bỏ REVIEW và video. `update` chạy trong
  một transaction: khoá chủ theo thứ tự cố định rồi khoá dòng, so version ảnh (`STALE_MEDIA`), ghi mọi
  dòng, chạm `updatedAt` của chủ (tab Photos của tour lưu bằng version cũ nhận `STALE_TOUR`), bắn tag
  bust của các chủ sau commit; không đổi gì thì không ghi. `queue` đọc `media_garbage`, kiểm còn dùng
  gộp một lượt và đọc job `media-gc` mới nhất trong `pgboss.job`. Handler `media-gc` trả `SweepReport`
  (trước đó pg-boss lưu output rỗng).
- `0726c70`: `media-upload.mjs` bỏ qua điểm đến đã có dòng ảnh; `apply-alt-text.mjs` chỉ lấp alt trống,
  nên lần chạy script sau không đè alt và ghi công admin vừa sửa.
- `dee3ec8`: trang `/media` cho Owner và Staff, mục sidebar Media library bật. Tab In use là lưới ảnh gom
  theo publicId với số chỗ dùng, cờ chú ý (thiếu alt, thiếu ghi công, CC thiếu link, alt lệch giữa các
  dòng), lọc và tìm giữ trên URL; ngăn chi tiết có số đo, nguồn, chỗ dùng gắn link tới đúng trình sửa
  (khe site trỏ `/appearance#<khoá>`), form alt và ghi công. Tab Cleanup queue là bảng hàng dọn chỉ đọc.
- open-items: dòng P4f; thêm G55 (web hiện ghi công, spec §12). CLAUDE.md: roadmap. Mục lục specs:
  tiêu đề nhóm P4f.

**Review.** Không có lượt review độc lập. Yuri bảo merge 19/10 08:00 UTC ("Merge nhé"). Nhánh rebase lên
`08994f9` không xung đột. Int Media: `list` gom đúng và nhãn chỗ dùng; `update` ghi mọi dòng, chạm version
chủ, `STALE_MEDIA`, `NOT_FOUND`, alt bắt buộc, bust đúng tag sau commit, khách
403, Staff được; `queue` đủ bốn trạng thái, `lastSweep: null` khi chưa có job, pg-boss thật lưu
`SweepReport`. Chromium thật trên bản build với API sống ở 1440, 768 và 390: không cuộn ngang trang (bảng
hàng dọn ở 768 cuộn trong khung của bảng); sửa ghi công một ảnh thư viện Đà Nẵng có hai tour mượn thì
cả ba dòng đổi và tour được chạm version; lọc "cần chú ý" giữ trên URL, nút Back trả về lưới đầy đủ.

Tests after (`gate:int` trên `dee3ec8`, 19/10, session cloud, API sống ở :3001): unit 7985 (web 2374,
admin 2329, api 1310, mobile 864, contract 770, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
917; Biome 2052 file. So với `08994f9`: admin thêm 60 test, api 28, contract 30, int 14; Biome thêm 31
file; các gói khác không đổi.

**CÒN TREO:**

- Thử tay production theo spec §8.3 phần Media A, từng bước, chờ xác nhận: mở `/media` thấy 241 ảnh,
  Needs attention có 3 ảnh CC; điền link giấy phép cho một ảnh CC thì còn 2 (câu đọc chỉ xác nhận mọi
  dòng có link); sửa alt một ảnh thư viện có tour mượn rồi mở tab Photos của tour ấy thấy alt mới; tab
  Cleanup queue khớp câu đọc chỉ trên `media_garbage`, sau lượt dọn đầu tiên dòng tóm tắt có số.
- G55: web hiện ghi công (lightbox ảnh tour, trang `/credits` có link ở footer). Ba ảnh CC đòi ghi công
  như điều kiện giấy phép; chủ dự án nhập link giấy phép còn thiếu ở `/media`.
- Dọn nhánh `feat/admin-p4f-media` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge `/privacy` kể trợ lý AI và Anthropic, test canh liên hệ trong Terms và Privacy (sổ nợ C1, `721825f`..`e719fa6`)

Lượt rà việc còn thiếu ở api, web và admin ngày 19/10 (thread cloud, báo cáo trong thư mục chung của
project) thấy `/privacy` không nhắc trợ lý hay Anthropic, trong khi chat đã bật trên production từ
03:57 UTC cùng ngày và tin khách gõ đi tới Anthropic. Yuri bảo làm các việc nhẹ trước. Nhánh
`claude/project-thread-4trwm7`, [PR #33](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/33),
thi công trên session cloud. Chỉ đổi văn bản pháp lý mà web đọc, một spec của web và docs: không
migration, không env, không dependency.

- `721825f`: `libs/shared/i18n/src/lib/legal/privacy.ts` thêm bốn câu theo đúng hành vi của code
  (ADR-0050 §2 và §5). Mục thu thập: tin khách gửi trợ lý và câu trả lời, mỗi hội thoại giữ 30 ngày sau
  tin cuối rồi xoá (`ChatRetentionService` xoá theo `updatedAt`), gắn tài khoản nếu khách đang đăng
  nhập, trình duyệt giữ một id ngẫu nhiên để nạp lại hội thoại. Mục dùng: trả lời câu hỏi qua trợ lý.
  Mục bên nhận: Anthropic nhận tin chat kèm thông tin tour trợ lý tra để viết câu trả lời, kèm lời dặn
  đừng gõ thông tin thanh toán hay thông tin nhạy cảm. Mục chuyển dữ liệu ra nước ngoài: Anthropic đặt
  ở Mỹ. Ngày cập nhật 19 October 2026. `legal-content.spec.ts`: một ca canh Anthropic và "30 days", hai
  ca sổ nợ C1 (mục "Contact us" của Terms và Privacy chứa `EMAIL`, `PHONE` của `lib/site.ts` và dòng
  đầu địa chỉ văn phòng Hồ Chí Minh của `mocks/offices.ts`).
- `e719fa6`: open-items chuyển dòng "Build web trên Vercel đỏ 09/10" sang open-items-closed, đóng vì
  không xác minh được nữa: log của service API trên Render (đọc chỉ-đọc 19/10) chỉ còn từ 12/10 07:10
  UTC. G23 đã vá 14/10 ở PR #16.
- Commit merge này: sổ nợ gạch C1.

**Review.** Không có lượt review độc lập. Yuri bảo merge 19/10 07:47 UTC ("Merge nhé"). Nhánh rebase lên
`33de359` không xung đột. Kiểm đột biến tay: đổi một chữ số điện thoại trong `terms.ts` thì ca C1 đỏ.

Tests after (`gate:int` trên `e719fa6`, 19/10, session cloud, API sống ở :3001): unit 7867 (web 2374,
admin 2269, api 1282, mobile 864, contract 740, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
903; Biome 2021 file. So với `33de359`: web thêm 3 test, các gói khác không đổi.

**CÒN TREO:**

- Ở ngày thử tay: mở `/privacy` trên production, thấy ngày 19 October 2026 và câu về Anthropic.
- Dọn nhánh `claude/project-thread-4trwm7` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge P4f Appearance: đổi ảnh 47 khe của web từ admin (`ae75d7c`..`838d927`)

Spec [2026-10-15-p4f-appearance-design.md](specs/2026-10-15-p4f-appearance-design.md), Yuri duyệt 19/10
03:05 UTC. Nhánh `feat/admin-p4f-appearance`,
[PR #31](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/31), thi công trên session cloud. Không
migration, không biến env, không dependency mới, không đổi thiết lập Cloudinary.

- `ae75d7c`: [ADR-0059](adr/0059-site-slot-appearance.md) (Accepted 19/10) và plan
  [2026-10-19-p4f-appearance.md](plans/2026-10-19-p4f-appearance.md). Danh mục khe nằm ở contract; một lần
  lưu nhận ảnh từ đúng một trong bốn nguồn; bảng ảnh gốc 47 mục nằm trong code API.
- `df7f3df`: contract `site-slots.ts`, danh mục 47 khe (khoá, nhóm theo tám trang web, đường dẫn, kiểu,
  khung đo ở 1440 và 390, `inMobileApp`) và ba thủ tục `admin.appearance.list`, `setSlot`, `signUpload`
  bậc `staff`. Khe video `about-cta-video` chỉ xem. Web đọc khe qua `siteMediaImage(key: SiteSlotKey)`
  nên gõ sai khoá là lỗi typecheck.
- `5f20127`: API. Một lần lưu chạy trong một transaction: tạo dòng khe nếu thiếu, `FOR UPDATE`, so phiên
  bản (`STALE_SLOT`), thay ảnh, nhích phiên bản, đưa ảnh tải lên cũ của chính khe vào hàng dọn 7 ngày;
  nguồn khác bốn nguồn là `PHOTO_NOT_ALLOWED`. Bắn tag `site-media` sau commit (trước đó API chưa bao
  giờ bắn tag này). Vùng tải lên của bộ dọn ảnh thêm `site`; `media-upload.mjs` bỏ qua khe đã có ảnh.
- `c0c1643`, `db2a644`, `838d927`: trang `/appearance` cho Owner và Staff, mục sidebar bật. Mỗi khe một
  thẻ: ảnh trong khung đúng tỉ lệ, chip nguồn, câu chữ web đặt cạnh ảnh. Hộp Replace có hai khung xem
  trước (desktop, điện thoại), tải lên hoặc chọn từ thư viện ảnh địa danh, sửa alt; Restore original qua
  hộp xác nhận; neo `/appearance#<khoá>` cho trang Media sau này. `838d927` sửa khung ảnh tràn thẻ ở
  lưới hẹp.
- open-items: dòng P4f. CLAUDE.md: roadmap. Mục lục specs: tiêu đề nhóm P4f.

**Review.** Không có lượt review độc lập. Yuri bảo merge 19/10 07:24 UTC ("Merge nhé"). Nhánh rebase lên
`50e8546` không xung đột. Int Appearance 29 test: quyền ẩn danh, khách, Staff; bốn nguồn; hai lệnh lưu
cùng lúc chỉ một qua, kể cả khe chưa có dòng; rollback trọn khi ảnh lạ; hàng dọn; bust sau commit; ký
tải lên. Chromium thật trên bản build với API sống ở 1440, 768 và 390: không cuộn ngang, không phần tử
nào tràn thẻ (lượt đo đầu bắt khung ảnh tràn ở 768, sửa ở `838d927`), khung xem trước giữ tỉ lệ khi co,
Restore original lấp khe trống của DB dev, neo cuộn tới đúng thẻ, console sạch. Ảnh Cloudinary lúc đo
là ảnh giả vì sandbox không ra mạng, nên đường tải lên thật chỉ thử được trên production.

Tests after (`gate:int` trên `838d927`, 19/10, session cloud, API sống ở :3001): unit 7864 (web 2371,
admin 2269, api 1282, mobile 864, contract 740, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
903; Biome 2021 file. So với `50e8546`: web thêm 7 test, admin 45, api 18, contract 13, int 28; Biome thêm
31 file; các gói khác không đổi.

**CÒN TREO:**

- Thử tay production theo spec §8.3, từng bước, chờ xác nhận: mở `/appearance` thấy 47 khe đều
  Original; thay Home · Hero bằng một ảnh thư viện, trang chủ đổi ảnh trong vòng một phút; Restore
  original đưa về ảnh cũ; tải một ảnh lên một khe Team rồi Restore original, hàng dọn có ảnh vừa tải
  với đồng hồ mới (kiểm bằng câu đọc chỉ). Lần tải lên đầu tạo thư mục `tourism/site/` trên Cloudinary.
- Dọn nhánh `feat/admin-p4f-appearance` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge khung chat trợ lý dạng hội thoại, P6 bật trên production (`a8968f4`..`ab84ad4`)

Yuri thử P6 trên production 19/10 và thấy khung chat "không giống kiểu chat hỏi đáp", bảo thiết kế lại theo
nguồn shadcn. Nhánh `feat/p6-ai-concierge-3xp4sq` dựng lại từ main sau PR #30,
[PR #32](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/32), thi công trên session cloud. Chỉ đổi
web, `@tourism/i18n` và spec P6: không đổi API hay contract, không dependency, không migration, không env.

- `a8968f4`: vòng 1 dựng bằng bộ chat shadcn có sẵn trong `@tourism/ui` (`Message`, `MessageAvatar`,
  `Bubble`, `InputGroup`). Tin trợ lý là bong bóng sáng kèm ảnh đại diện, tin khách là bong bóng màu chính
  bên phải; ba chấm "đang gõ" thay dòng "Thinking…" và giữ cả quãng giữa tool xong với chữ của bước sau.
  Đầu khung có tên và dòng phụ `chatBot.subtitle`; ô nhập bo tròn, cao dần theo chữ, nút gửi trong ô;
  disclaimer dời xuống dưới ô nhập.
- `ab84ad4`: vòng 2, sau khi đối chiếu shadcn chat, AI Elements, prompt-kit, assistant-ui. Màn chào có ba
  gợi ý kèm icon; khách cuộn lên đọc lại thì chữ đang stream không kéo khung xuống, có nút tròn đưa về
  cuối; nút sao chép dưới lượt đã xong; tin mới trượt vào (`motion-safe`); vòng xoay trên nút gửi khi
  chờ; khung màn rộng 25rem x 40rem (trước 23rem x 36rem). Copy mới `chatBot.copy`, `copied`,
  `scrollToLatest`. Spec P6 §2h, §2i.
- Dải thẻ tour có ảnh dưới câu trả lời (Carousel shadcn, kèm ảnh bìa trong kết quả `searchTours` và
  `toModelOutput` để model không thấy ảnh) đã dựng và thử rồi bỏ trước merge theo ý Yuri: thẻ chiếm chỗ
  trong khung hẹp và đẩy hội thoại trôi đi. Tour vẫn là tên gắn link trong câu trả lời, như prompt trên
  main đã dặn. Lý do ghi ở spec §2h.
- open-items: dòng P6 ghi đã bật, còn thử enquiry trên production. CLAUDE.md: roadmap.

**P6 bật trên production** (mục CÒN TREO của entry merge P6 `abcf44a`..`5d30f0c`, entry đó bất biến nên
ghi ở đây). Yuri tạo key `nexora-prod` ở Claude Console ngày 19/10 (scope workspace Default, hết hạn
30/11/2026; trả bằng 100 USD credit có sẵn của tổ chức, tự nạp tắt). Yuri đặt `ANTHROPIC_API_KEY` trong
`apps/api/.env.production` và trên Render, cùng `CHAT_ENABLED=true` và `CHAT_DAILY_BUDGET_USD=10` (Yuri
nâng từ 1 để nhóm thử nhiều trước khi credit hết hạn); `CHAT_MODEL` để trống là `claude-haiku-4-5`.
Render live 03:57:54 UTC, log có `ChatModule`. Log Render (chỉ đọc) có ba lượt thật 04:26 đến 04:28 UTC
trong một hội thoại: `searchTours` hai lần, `getTourDetails` một lần, mỗi lượt 1821 đến 6875 token vào
và 206 đến 691 token ra. Lần đầu "Chat with us" không hiện vì API gói free đang ngủ; API thức lúc
04:17:55 UTC thì nút hiện.

**Review.** Không có lượt review độc lập. Yuri xem ảnh từng vòng và bảo merge 19/10 07:07 UTC ("Ổn rồi
đó, merge nhé"). Nhánh rebase lên `87b873c` không xung đột. Thử bằng Chromium thật trên session cloud với
API chạy model giả ở 375 và 1440 (vòng 2 thêm 768 nền tối): màn chào, gợi ý, tên tour gắn link, nút sao
chép, nút cuộn xuống, thẻ xác nhận enquiry, Esc trả tiêu điểm, tải lại trang nạp lại hội thoại, không
cuộn ngang trang. Kiểm đột biến tay: bỏ điều kiện "lượt xong" của nút sao chép, hay luôn cuộn xuống, thì
test tương ứng đỏ.

Tests after (`gate:int` trên `ab84ad4`, 19/10, session cloud, API sống ở :3001): unit 7781 (web 2364,
admin 2224, api 1264, mobile 864, contract 727, mobile-ui 145, i18n 62, ui 57, core 48, tokens 26) và int
875; Biome 1990 file. So với `265ca46`: web thêm 4 test khung chat, các gói khác không đổi.

**CÒN TREO:**

- Thử gửi enquiry qua thẻ xác nhận trên production (email ack đi thật qua Resend), rồi đọc log Render có
  `submitEnquiry`. Xong thì chuyển dòng P6 sang `open-items-closed.md`.
- Nhóm thử trợ lý trên production theo bộ kịch bản 28 ca Yuri nhận ngày 19/10.
- Trước mỗi buổi demo: mở site vài phút trước cho API gói free thức, không thì lần bấm đầu thiếu
  "Chat with us".
- Dọn nhánh `feat/p6-ai-concierge-3xp4sq` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge ADR-0040 AMEND 7: chữ hệ thống, icon Material, thanh tab `NativeTabs` cho app mobile (`8caaff3`)

Yuri bảo soạn AMEND trước khi Nghĩa code, theo luật 5: bản vẽ duyệt cùng ngày đảo hai quyết định của
ADR-0040 AMEND 1 (icon Feather; Literata cho tiêu đề, Archivo cho thân). Chỉ đổi tài liệu.

- `8caaff3`: [ADR-0040](adr/0040-mobile-app-expo.md) AMEND 7. Chữ thân dùng font hệ thống, biến
  thể `brand` giữ Literata, thang chữ token không đổi; icon `MaterialCommunityIcons` của
  `@expo/vector-icons`; thanh tab `NativeTabs` của `expo-router/unstable-native-tabs` có điều kiện
  spike trên Android thật (Expo Go và build EAS, màu theo token, bấm lại tab cuộn lên đầu), không
  đạt thì giữ `FloatingTabBar` vẽ lại; nền bề mặt pha từ token bằng hàm thuần. Không dependency mới.
  Bàn giao cập nhật tên prop màu thật của `NativeTabs`, icon qua `NativeTabs.Trigger.VectorIcon`,
  thử spike cả trên build EAS. Mục lục ADR: 0040 ghi 7 AMEND.
- Commit merge này: Yuri duyệt AMEND 7 ngày 19/10 ("duyệt AMEND 7 rồi gộp vào main"); trạng thái đổi sang
  Accepted, bàn giao, open-items và mục lục handoff bỏ chữ "chờ duyệt".

**Đính chính entry trước** (entry bất biến nên ghi ở đây): mục CÒN TREO của entry "Merge bản vẽ nâng
cấp giao diện app mobile" gọi AMEND này là "ADR-0040 AMEND 3" — sai, AMEND 3 đến 6 đã dùng từ 24/09
tới 09/10. Số đúng là AMEND 7.

**Review.** Không có lượt review độc lập. Đã kiểm trong code trước khi ghi: `NativeTabs` có sẵn
trong expo-router 57.0.21, bản Android dựng trên `react-native-screens/experimental` (4.26.2); chữ G
của nút Google lấy từ `AntDesign` nên không đổi; `app-text.spec.tsx` đang khẳng định
`Archivo_400Regular` và `Literata_700Bold` nên phải sửa khi code N2.

**CÒN TREO:** điền mục "Kết quả spike" của AMEND 7 trước khi gộp N1.

Tests after: không chạy `gate:int` vì chỉ đổi Markdown; CI trên main là lưới.

## 2026-10-19 — Merge bản vẽ nâng cấp giao diện app mobile theo Material 3 và bàn giao cho Nghĩa (`616357a`..`9c45bea`)

Nhánh `docs/mobile-ui-upgrade-mockup` của Nghĩa (vòng 1, 14/10) được Yuri review 19/10 trên session cloud;
Yuri chọn sửa thẳng bản vẽ rồi giao lại Nghĩa phần code. Làm trên nhánh `claude/eloquent-darwin-emmopy`,
hai commit của Nghĩa cherry-pick nên giữ tên tác giả. Chỉ đổi tài liệu và mockup HTML: không code, không
dependency, không migration, không đụng hạ tầng.

- `616357a`, `e87df77` (Nghĩa): mockup HTML 42 khung, thêm bóng, kính mờ và điểm nhấn nhưng giữ nguyên bố
  cục; luật Biome `!docs/design/*.html`.
- `26eb1c7`: dời file về `docs/design/mockups/mobile-ui-upgrade.src.html` (luật Biome sẵn có của
  `*.src.html` đã phủ), bỏ bản sao `mobile-ui-account-auth-mockup.html`, trả `biome.json` về như cũ.
- `54047af`: vòng 2 theo phạm vi Yuri chốt: thanh tab có chữ, một kiểu ô nhập, bố cục mới cho Home,
  Explore và Saved, chi tiết tour, bốn bước đặt tour, Trips. Tài khoản giữ năm dòng mở trình duyệt có icon
  ↗ (quyết định 21/09).
- `3cbe858`: vòng 3 theo Apple HIG (iOS 26) vì vòng 2 vẫn dáng web responsive.
- `36a333a`: vòng 4 theo Material 3 Expressive vì buổi demo chạy Android: thanh điều hướng đáy tràn
  ngang, thanh trên canh trái, chữ Roboto, icon Material Symbols, ô nhập outlined, chip bo 8, thanh tìm
  56, bottom sheet tràn ngang, danh sách thẻ rời như Cài đặt Android 16. Bảng việc code xếp P1/P2.
- `946a10f`: theo góp ý của Yuri: Home giữ bố cục cũ với rail ba vùng dọc; All/Upcoming/Past chỉ bo
  tròn hai đầu, ô đang chọn giữ hình.
- `9c45bea`: bàn giao [mobile-ui-upgrade-handoff](handoff/mobile-ui-upgrade-handoff.md) cho đợt code
  23–30/10; mục lục `handoff/` và `design/mockups/`.
- Commit merge này: open-items thêm dòng việc đang mở và mốc thuyết trình thử (tuần 02–08/11, Yuri báo
  19/10); CLAUDE.md roadmap.

**Review.** Lượt review đầu trên nhánh của Nghĩa tìm ra: bố cục giữ nguyên trong khi task giao cả bố
cục; thanh tab chỉ có icon; hai kiểu ô nhập lẫn trong cùng luồng đặt tour; màn Tài khoản gộp ba trang
pháp lý thành "Policies" có mũi tên, ngược quyết định 21/09; mockup vẽ 4 bước đặt tour trong khi code có
3; file đặt sai thư mục, có bản sao 99% và phải nới `biome.json`; mockup chụp từ main 14/10, thiếu năm
thay đổi mobile vào sau. Tất cả đã xử lý trong các vòng trên. Hướng dẫn đối chiếu: Apple HIG (vòng 3) và
tài liệu `material-components-android` của Google (vòng 4; m3.material.io bị chặn ở môi trường cloud).
Yuri duyệt bản vẽ 19/10 ("Ổn rồi").

**CÒN TREO** (cho người nhận, chi tiết ở bàn giao mục 3):

- ADR-0040 AMEND 3 trước khi code: chữ thân dùng font hệ thống, icon bộ Material, thanh tab
  `NativeTabs` nếu spike đạt.
- Spike `expo-router/unstable-native-tabs` trên máy Android thật qua Expo Go.
- Bản xem online của mockup là artifact riêng tư của Yuri; cần chia sẻ cho Nghĩa.

Tests after: không chạy `gate:int` vì nhánh chỉ đổi Markdown và một file HTML mà Biome bỏ qua; CI trên
main là lưới. Mockup mở bằng Chromium ở bề rộng 1280 và 400, cả hai nền: không lỗi console, không cuộn
ngang.

## 2026-10-19 — Merge P6 trợ lý AI tư vấn tour, API và web, cờ tắt mặc định (ADR-0050 AMEND 1, `abcf44a`..`5d30f0c`)

Phase P6, user bảo "Làm ngay" 15/10 sau khi dời freeze sang 31/10. Nhánh `feat/p6-ai-concierge-3xp4sq`,
[PR #30](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/30), thi công trên session cloud; tạm
dừng 15/10 vì giới hạn usage, làm tiếp 19/10. MỘT migration, bốn biến env mới (đều tắt hoặc có mặc định),
không dependency mới (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react` đã ghim 29/09). Thư viện dùng chung bị
sửa: `@tourism/contract` (thêm `schemas/chat.ts`) và `@tourism/i18n` (khối `chatBot`, `contactLauncher`).

- `abcf44a`: plan [2026-10-15-p6-ai-concierge](plans/2026-10-15-p6-ai-concierge.md) và
  [ADR-0050](adr/0050-ai-concierge-chat.md) AMEND 1: tên API của AI SDK 7 (`toolApproval` thay
  `needsApproval`), cột giữ lượt `turn_started_at`, job dọn vào danh sách chạy bù của G41. Mục lục
  ADR: 0050 ghi 1 AMEND. Spec sửa trong cùng commit.
- `55f17a5`, `9c42cd7`: module `chat` của API. Ba endpoint Nest ngoài oRPC (`GET /api/chat`,
  `GET /api/chat/:id`, `POST /api/chat`); lịch sử ở server, trình duyệt chỉ gửi tin mới hoặc quyết
  định duyệt. Ba tool gọi thẳng service; `submitEnquiry` chỉ chạy sau khi khách bấm Send và đi qua
  `EnquiriesService.create` y như form. Stream UI message ghi SSE thẳng `reply.raw`, chép header CORS
  và helmet; luồng tee để khách đóng tab thì lượt vẫn chạy trọn và token vẫn vào trần ngày. Trần: 20
  POST mỗi giờ theo IP, 1000 ký tự mỗi tin, 20 tin khách mỗi hội thoại, 5 bước tool và 800 token mỗi
  lượt, `CHAT_DAILY_BUDGET_USD` mỗi ngày UTC (mặc định 1). Queue pg-boss `chat-retention` (04:30 UTC,
  có trong danh sách chạy bù) xoá hội thoại không đụng tới quá 30 ngày.
- `a6cd80e`: `searchTours` dùng sort `rating` và `nextDeparture` của ADR-0058 (main đi thêm PR #28
  trong lúc nhánh dừng).
- `232746b`, `f442182`: web. Nút nổi "Plan your trip" ở mọi trang khách, popover hai lối ("Chat with
  us" chỉ hiện khi API báo `available`, và enquiry), khung chat (khung nổi ở màn rộng, lớp phủ dưới
  `sm`), thẻ xác nhận enquiry, markdown chỉ cho link nội bộ. Trang tour dưới `lg`: thanh đặt chỗ gắn
  `data-booking-bar` lên `<body>`, nút nổi, nút lên đầu trang và khung chat đứng trên thanh. Copy bỏ
  WhatsApp.
- `2349383`: `render.yaml` và `apps/api/.env.example` khai `CHAT_ENABLED`, `ANTHROPIC_API_KEY`,
  `CHAT_MODEL`, `CHAT_DAILY_BUDGET_USD` (đều `sync: false`, bỏ trống là mặc định: cờ tắt,
  `claude-haiku-4-5`, 1 USD). `reset-operational-data.mjs` chỉ sửa ghi chú hai bảng chat.
- `d00f695`, `5d30f0c`: spec và plan sửa theo bản thi công (tee thay `consumeStream`, tour mặc định
  đi qua prompt, `turn_started_at` là `TIMESTAMP(3)`, cách web xử lý Retry).
- `a6ab308`: migration `20261019024540_chat_tokens_enquiry_turn`, chỉ thêm cột nullable và index:
  `chat_conversations.enquiry_id` (unique, `SET NULL`), `turn_started_at`,
  `chat_messages.input_tokens`, `output_tokens`, index `created_at`. Sinh bằng `prisma migrate diff`
  trên DB đã có mọi migration của main, sau G25.
- open-items: dòng P6 ghi trạng thái mới, còn mở tới khi bật cờ và thử tay production. CLAUDE.md:
  roadmap ghi P6.

**Deploy Supabase:** Yuri chạy `prisma migrate deploy` bằng tay từ máy dev ngày 19/10, migration xong
lúc 03:13:40 UTC, trước khi đẩy main. Truy vấn chỉ đọc ngay sau đó: 33 migration đã chạy, bốn cột mới có
mặt, hai bảng chat vẫn 0 dòng.

**Review.** Không có lượt review độc lập. User bảo merge 19/10 03:04 UTC ("Merge nhé"). Nhánh rebase lên
`68f65ef` không xung đột. Thử bằng Chromium thật trên session cloud với API chạy model giả ở 375, 768 và
1440: stream qua CORS, thẻ xác nhận ghi enquiry đúng tour vào DB local, Esc đóng khung và trả tiêu điểm,
tải lại trang thì hội thoại nạp lại, nút nổi không đè thanh đặt chỗ. Chưa có lượt nào với Anthropic thật
vì container không có key.

Tests after (`gate:int` trên `a6ab308`, 19/10 xong 02:56 UTC, session cloud theo các bước của CI): unit
7777 (web 2360, admin 2224, api 1264, mobile 864, contract 727, mobile-ui 145, i18n 62, ui 57, core 48,
tokens 26) và int 875 trong 54 file; Biome 1990 file; `check-rls.sh` và `check-admin-prerender.mjs`
qua. So với `68f65ef`: int thêm 25 (23 ca chat, 2 ca job dọn), unit thêm 127 (web 45, api 74, contract
8). Lượt cloud đầu (với migration tạm, trên `d0a051d`) có `@tourism/contract#test` bị giết vì hết RAM
dưới tải turbo (đã gặp 15/10); chạy riêng 727/727, lượt sau xanh. CI của PR xanh cả lượt `push` lẫn `pull_request` trên `5d30f0c`.

**CÒN TREO:**

- Yuri tạo API key Anthropic, nạp trước một khoản nhỏ, tắt tự nạp.
- Yuri đặt `ANTHROPIC_API_KEY` trên Render và trong `apps/api/.env.production`; `CHAT_MODEL` và
  `CHAT_DAILY_BUDGET_USD` để trống là `claude-haiku-4-5` và 1 USD. Rồi bật `CHAT_ENABLED=true`.
- Thử tay production sau khi bật: trên một trang tour, mở nút nổi, hỏi tìm tour, hỏi chi tiết tour,
  gửi enquiry qua thẻ (email ack đi thật qua Resend), Esc, tải lại trang; log Render có dòng
  `chat turn {…}` mang token mỗi lượt. Xong thì chuyển dòng P6 sang `open-items-closed.md`.
- Dọn sau merge: nhánh `feat/p6-ai-concierge-3xp4sq` trên origin nếu GitHub không tự xoá.

## 2026-10-19 — Merge G25 khoá ngoại điểm đến của tour đổi sang `RESTRICT` (ADR-0053 AMEND 2, `c97b8ba`..`b021316`)

Việc tồn đọng của admin, làm 15/10 sau khi user dời freeze sang 31/10. Nhánh
`fix/admin-g25-destination-restrict`, [PR #26](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/26),
thi công trên session cloud; tạm dừng lúc chờ merge vì giới hạn usage. MỘT migration, không env,
không dependency, không đổi hình dạng contract; thư viện dùng chung bị sửa: `@tourism/contract` (chỉ
comment và JSDoc).

- `c97b8ba`: [ADR-0053](adr/0053-delete-unused-categories-destinations.md) AMEND 2 chốt khoá ngoại
  `tour_destinations_destination_id_fkey` đổi từ `ON DELETE CASCADE` sang `ON DELETE RESTRICT`, giống
  `tours.category_id`, đi trước code. Mục lục ADR: 0053 ghi 2 AMEND (sửa trong chính commit ADR).
- `b021316`: migration `20261015005139_g25_destination_fk_restrict` là MỘT câu `ALTER TABLE` (DROP
  rồi ADD cùng tên). `prisma migrate deploy` không bọc file trong transaction: đo trên DB nháp, bản hai
  câu Prisma sinh ra để bảng mất hẳn khoá ngoại khi câu ADD hỏng, còn bản một câu để khoá cũ nguyên
  vẹn. `schema.prisma` khai `onDelete: Restrict`. Không đụng dữ liệu: production trước deploy (truy
  vấn chỉ đọc 19/10) có 53 liên kết, 0 liên kết mồ côi. Lệnh xoá của admin giữ nguyên (đếm liên kết
  dưới khoá hàng, trả `IN_USE`); khoá ngoại là lưới thứ hai cho SQL tay, Prisma Studio hay script.
  Sửa năm comment còn ghi CASCADE (service, nút xoá ở admin, contract).
- open-items: dòng G25 chuyển sang `open-items-closed.md`.

**Deploy Supabase:** Yuri chạy `prisma migrate deploy` bằng tay từ máy dev ngày 19/10, migration xong
lúc 02:41:48 UTC, trước khi đẩy main. Truy vấn chỉ đọc ngay sau đó: khoá ngoại là `RESTRICT`
(`confdeltype = 'r'`), 32 migration đã chạy, vẫn 53 liên kết.

**Review.** Không có lượt review độc lập. User bảo merge 19/10 00:56 UTC ("Merge G25"). Nhánh tách từ
`16ca003`, rebase lên `d0a051d` không xung đột (main đi thêm PR #27, #28, #29 và commit spec, không
cái nào đụng `prisma/`).

Tests after (`gate:int` trên `b021316`, 19/10 xong 02:40 UTC, session cloud theo các bước của CI):
unit 7650 (web 2315, admin 2224, api 1190, mobile 864, contract 719, mobile-ui 145, i18n 62, ui 57,
core 48, tokens 26) và int 850 trong 52 file; Biome 1960 file. Cùng số khi chạy trên máy Windows của
Yuri trước đó; CI của PR xanh cả lượt `push` lẫn `pull_request` trên `b021316`. So với `d0a051d`: int
thêm 1, unit giữ nguyên. Lượt cloud đầu có `@tourism/contract#test` hết giờ một lần dưới tải turbo
(`zod-config.spec.ts`, 5,07 giây so với giới hạn 5 giây, đã gặp 15/10); chạy riêng 719/719, lượt sau
xanh. Int mới: xoá điểm đến còn tour bằng SQL tay và bằng Prisma Client đều bị từ chối, tour giữ đủ
điểm đến; đỏ trên khoá CASCADE cũ. Ca đua cũ (bỏ `FOR UPDATE` ở lệnh xoá) nay ra 500 thay vì 409, vẫn
đỏ.

**Đóng CÒN TREO của entry 14/10 "Merge G18 … G41":** (1) ba job bù `singleton_key = 'catch-up'` của
14/10 đều `completed` lúc 08:18 UTC, ngay sau deploy; (2) ngày 15/10 lần thức đầu tiên (00:20:54 UTC,
07:20 giờ VN) gửi đủ ba job bù mới, `completed` lúc 00:21:56 UTC; lần thức 00:41 và 24 lần thức sau
deploy ngày 14/10 đều log "hôm nay đã có", không gửi thêm (đọc `pgboss.job` và log Render, chỉ đọc);
(3) nhánh `fix/admin-g18-review-order` không còn trên origin.

**CÒN TREO:**

- Dọn sau merge: nhánh `fix/admin-g25-destination-restrict` trên origin nếu GitHub không tự xoá.

## 2026-10-15 — Merge W-09 phần cuối của web: hậu tố title, RSS, breadcrumb JSON-LD, tên tháng và thứ vào `@tourism/i18n` (`5c2c5c2`..`61cc745`)

Lượt open-items của web, tách từ yêu cầu của user sáng 15/10 (dời freeze sang 31/10, chia luồng
web và admin). Nhánh `fix/web-i18n-strings-lwbur9`,
[PR #27](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/27), session cloud; tạm dừng
lúc chờ merge vì giới hạn usage. Không migration, không env, không đổi contract, không dependency.
Thư viện dùng chung bị sửa: `@tourism/i18n` (`messages.ts` thêm `pageMeta.withBrand`, `blog.feed`,
`contactForm.preferredDates`; module mới `date-names.ts`; `index.ts`).

- `5c2c5c2`: năm bản chép tay của tên tháng và thứ viết tắt trong `apps/web` (`lib/tours.ts` hai
  bản, `lib/tour-detail.ts`, `lib/passport.ts`, `itinerary-panel.tsx`) đọc từ `dateNames` của module
  mới `date-names.ts`, export thẳng từ barrel và không gắn vào `messages` (cùng lý do tách
  `resilience.ts`). Hằng cục bộ giữ tên cũ nên thân các hàm in ngày không đổi. Bản chép ở admin
  (`bookings-view.ts`) và mobile (`tour-detail/reviews.ts`, `departures.ts`) ngoài phạm vi đợt này.
- `61cc745`: 28 chỗ trong 24 file trang tự nối ` — Nexora` vào title nay gọi
  `messages.pageMeta.withBrand` (các mảnh nối bằng gạch dài, brand đứng cuối; title sáu trang auth
  đã viết đủ câu nên giữ). Tên và mô tả kênh `/blog/rss.xml` vào `messages.blog.feed`; JSON-LD
  breadcrumb của bài viết đọc `common.home` và `blog.breadcrumb`, đúng hai khoá PostHero đang in;
  `buildEnquiryPayload` nối `messages.contactForm.preferredDates`. Cố ý giữ: thân 503 của RSS, giá
  trị `@type` của schema.org, lỗi cho developer, logo chữ, watermark, ba tên nguồn bản đồ, `mocks/`.
- Docs: sổ nợ B1, phần "i18n sweep" còn lại thành đã trả.

**Đóng CÒN TREO của entry 13/10 (lô 2) "W-09 còn phần ngoài cụm đăng nhập":** con số 283 chuỗi
trong 55 file ghi ở đó là bản quét trước PR #17; PR #17 (14/10) dời khoảng 300 chữ, đợt này dời
phần còn lại. Bản quét lại 15/10 bằng cây cú pháp mọi file `.ts`/`.tsx` của `apps/web/src` (bỏ
spec, mock, test), chạy lại sau rebase lên `e764809`, không còn chữ khách đọc nào ngoài các chỗ cố
ý giữ ở trên. Còn ngoài phạm vi: chữ a11y của các component shadcn trong `libs/shared/ui` ("Close",
"Loading", nhãn carousel và pagination), dùng chung với admin.

**Review.** Không có lượt review độc lập. User bảo merge 15/10 12:47 UTC ("Merge nhé."). Nhánh tách
từ `4529721`, rebase lên `16ca003` rồi lên `e764809` (PR #28 và #29) không conflict.

Tests after (`gate:int` trên `61cc745` sau rebase, 15/10 xong 13:30 UTC, session cloud theo các
bước của CI): unit 7650 (web 2315, admin 2224, api 1190, mobile 864, contract 719, mobile-ui 145,
i18n 62, ui 57, core 48, tokens 26) và int 849; Biome 1960 file, tokens-only mobile 188 file. Lượt
đầu có hai gói đỏ vì máy quá tải, đều ngoài phạm vi nhánh: contract bị kill (mã 137) và một test của
admin (`photo-library-dialog.spec.tsx`, ô "Photo unavailable") không thấy ảnh đổi sau lỗi tải; chạy
lại riêng từng gói xanh 719/719 và 2224/2224. So với `e764809`: i18n thêm 4 test (2 cho `dateNames`,
2 cho `withBrand` và `preferredDates`), các gói khác giữ nguyên. Chữ ra của 77 route trên bản build production
(sitemap, RSS, các trang 404, trang auth và 11 lượt gọi có đăng nhập) khớp từng ký tự giữa
`4529721` và `0a69300` (bản trước rebase); bản so này không chạy lại sau rebase lên `e764809`
(`messages.ts` và `lib/tours.ts` đổi ở cả hai bên nhưng git gộp không conflict). CI `gate` của PR
xanh hai lượt trên `0a69300`.

**CÒN TREO:**

- Dọn sau merge: nhánh `fix/web-i18n-strings-lwbur9` trên origin nếu GitHub không tự xoá.

## 2026-10-15 — Merge việc tồn web và app: ảnh review, mail có ảnh tour và hàng sao, ngăn kéo lọc /blog, màn "Password updated", khối chờ viết bài (sổ nợ F2, N8, P5b-5 mục 1–2, `0d6289e`..`59b3329`)

Lượt open-items của web và app, tách từ yêu cầu của user sáng 15/10 (dời freeze sang 31/10, chia
luồng web và admin). Nhánh `fix/web-open-items-10`,
[PR #29](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/29), session cloud; tạm dừng
giữa chừng vì giới hạn usage rồi chạy tiếp cùng ngày. Không migration, không env, không
dependency. Thư viện dùng chung bị sửa: `@tourism/i18n` (câu lỗi quyền ảnh, bốn chuỗi ngăn kéo
blog, màn "Password updated", bốn chuỗi khối chờ viết bài); `libs/mobile/*` không đổi.

- Mobile `0d6289e` (F7 cho ảnh review): chọn ảnh từ thư viện ở R1, R5 đi đường không cần quyền như
  màn Account; chỉ chụp ảnh mới xin quyền camera, câu lỗi chỉ còn nói camera.
- API `51603e0` (sổ nợ F2): câu claim PAID của money-path lấy ảnh hero đầu tiên của tour (bỏ hero
  là video) bằng một `LEFT JOIN LATERAL` chỉ đọc rồi ghi vào payload outbox; mail xác nhận in ảnh qua
  Cloudinary (`w_1024`, không crop, ADR-0020 §4) kèm dòng ghi công (§3), tour chưa có ảnh vẫn ra
  monogram như ADR-0025. Mail duyệt bài mang `rating` (đọc dưới `FOR UPDATE`) và `tourSlug` (null
  khi tour đang ẩn): hàng năm sao và nút "See your review". `ResendDeliverer` đọc
  `CLOUDINARY_CLOUD_NAME` vốn đã bắt buộc ở production. User duyệt ảnh mẫu mail trên thẻ quyết định.
- Web `aa66c93` (nợ hoãn 17/08): dưới `lg`, hai nhóm Topic và Place của `/blog` nằm trong ngăn kéo
  `Drawer` của `@tourism/ui` như `/tours`: số bài sống ở đầu, "Clear all" và "Show N stories" ở
  chân, nút mở có huy hiệu đếm; từ `lg` giữ sidebar.
- Mobile `b130599` (N8 nửa sau, thẻ "Màn kết quả"): đổi mật khẩu xong mở màn "Password updated"
  (route mới `password-updated` dùng lại `ResultScreen` của cụm auth), nút về Account bằng
  `dismissTo`.
- Mobile `fc38195` (P5b-5 mục 1 và 2, thẻ "Thêm khối" và "Màn kết quả"): đầu My reviews có khối
  "Waiting for your review" cho đơn PAID của chuyến đang đi hoặc đã về mà chưa có bài (qua đúng
  cổng `canWriteReview` của hoá đơn), mỗi dòng một nút "Write a review"; mở R1 từ đây thì màn đã
  gửi ghi "Back to my reviews" và lùi về đúng My reviews. Rút bài xong app đọc "Review retracted"
  cho trình đọc màn hình. User duyệt ảnh khối (sáng, tối) trên thẻ quyết định; ảnh dựng lại bằng
  HTML từ token và số đo trong code vì app không có bản chạy web.
- Test `c350ba2` (spec i18n đếm 25 màn), `59b3329` (spec R4 chỉ gỡ đúng spy của nó thay vì
  `restoreAllMocks`).
- Docs: N8 nửa sau và P5b-5 mục 1, 2 chuyển sang `open-items-closed.md` (mục P5b-5 hết nên bỏ khỏi
  file chính); sổ nợ F2 và nợ con ở spec deploy v1 §10 thành đã trả; thêm hai dòng thử tay.

**Review.** Không có lượt review độc lập. CI `gate` đỏ trên `e664be8`: spec i18n còn đếm 24 màn,
vá ở `45309da` (sau rebase là `c350ba2`). User bảo merge 15/10 12:45 UTC ("Merge nhé"). Nhánh tách
từ `16ca003`, rebase lên `a8db3e9` (PR #28) không conflict.

Tests after (`gate:int` trên `59b3329` sau rebase, 15/10 xong 13:02 UTC, session cloud theo các
bước của CI, xanh ngay lượt đầu): unit 7646 (web 2315, admin 2224, api 1190, mobile 864, contract
719, mobile-ui 145, i18n 58, ui 57, core 48, tokens 26) và int 849; Biome 1958 file, tokens-only
mobile 188 file. Turbo phát lại kết quả đã lưu của tokens và mobile-ui. So với `a8db3e9`: web thêm
7 test, api thêm 16, mobile thêm 14, int thêm 3, các gói khác giữ nguyên. CI `gate` của PR xanh
trên cùng code (`d296139`, bản đầu của commit docs này). Trước rebase, `gate:int`
trên `e6f3f8d` xanh ở lượt thứ ba: hai lượt đầu chết vì một test quá 5 giây khi máy quá tải
(tokens, rồi `zod-config.spec` của contract), cả hai file không đổi trong nhánh. Test của N8 và
khối R4 viết trước, đỏ rồi mới xanh.

**CÒN TREO:**

- Thử tay ở bản build app kế tiếp (dòng ở open-items): chọn ảnh review không hỏi quyền, màn
  "Password updated", khối chờ viết bài, TalkBack đọc "Review retracted".
- Thử tay trên production sau deploy (dòng ở open-items): mail xác nhận có ảnh tour, mail duyệt bài
  có hàng sao.

## 2026-10-15 — Thẻ /tours mang đợt kế tiếp và badge, sắp theo rating (ADR-0058, sổ nợ E3, `6c2098c`)

Mục E3 của sổ nợ kỹ thuật, tách từ lượt Yuri giao làm nốt open-items của web và admin sáng 15/10.
Nhánh `feat/tours-card-sort-yxb5g6`,
[PR #28](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/28), session cloud. Không
migration, không env, không dependency. Contract dùng chung đổi theo kiểu cộng thêm nên app mobile
bản cũ vẫn đọc được.

- ADR-0058 (Accepted 15/10) đi trước code: một tập "đợt đặt được" (OPEN, còn hạn đặt theo ADR-0041,
  còn chỗ) nuôi cả giá "from" lẫn đợt kế tiếp trên thẻ. `TourCardSchema` thêm `nextDeparture`
  (`startDate`, `seatsLeft`; null khi không còn đợt nào đặt được) và nhận `badges` từ detail, hình
  dạng detail không đổi. `TourSortKeySchema` thêm `rating`: chưa có đánh giá đứng cuối ở cả hai
  chiều, hoà điểm thì nhiều đánh giá hơn đứng trước, rồi `id`. Bộ lọc giá, thời lượng, độ khó ở lại
  web theo lựa chọn của Yuri trên thẻ quyết định 01:05 UTC (§5).
- API: `cardDepartureFactsByTour` tính giá "from" và đợt kế tiếp cho danh sách, chi tiết và tour
  liên quan của bài viết trong một truy vấn; giá "from" thôi tính đợt đã kín chỗ nên thẻ và hero
  trang tour in cùng một số. Lệnh ghi đợt của admin bust thêm tag `tours` khi số chỗ của một đợt
  đang nuôi thẻ đổi.
- Web: thẻ có băng "Next departure Sat 14 Nov", thêm "Only N seats left" khi còn từ 3 chỗ trở
  xuống, hoặc "Dates on request". Góc ảnh tối đa hai chip: suất đầu giữ luật −N% hoặc Featured,
  badge admin lấp suất còn lại. Ô sort thêm "Rating: high to low"; sort giá và nhóm giá của bộ lọc
  đọc giá "from" in trên thẻ thay cho `basePrice`. Web chịu được API bản cũ thiếu hai field mới trong
  lúc Vercel build xong trước khi Render lên bản mới. Skeleton `/tours` thêm băng đợt kế tiếp.
- Admin: thẻ xem trước "Card on /tours" ở bước Details hiện badge như thẻ thật (Featured rồi badge,
  tối đa hai). Key `preview.featuredNote` đổi thành `preview.chipsNote`; sửa chữ `preview.priceNote`
  và `badgesHint`.
- Docs: sổ nợ E3 thành đã trả; spec Tours 27/07 §8 ghi #2–#5 trả theo ADR-0058.

**Review.** Không có lượt review độc lập. CI `gate` đỏ trên `bf88c47` trong lúc thread tạm dừng vì
giới hạn usage: bài test kiểu ở `libs/shared/contract/src/contract.spec.ts` còn ghim union sort cũ,
vá ở `5c10ca9` khi chạy lại. User bảo merge 15/10 11:34 UTC ("Merge nhé"). Nhánh tách từ `16ca003`;
main không đổi tới lúc merge nên không cần rebase.

Tests after: `pnpm gate:int` xanh ở session cloud trên `6c2098c`, ở lần chạy thứ tư. Ba lần trước
chết vì máy 4 nhân quá tải ở test nhánh không đụng tới: tokens quá 5 giây, bottom sheet của
mobile-ui quá 60 giây, contract vitest EPIPE. `turbo run build typecheck test` 28/28 task: contract
719, api 1174, web 2308, admin 2224, mobile 850, mobile-ui 145, ui 57, i18n 58, core 48, tokens 26;
`test:int` 52 file 846 test. CI `gate` của PR xanh cả lượt push lẫn lượt pull_request trên
`6c2098c`. Ảnh trước và sau (1440, 390, sáng, tối) ở thư mục chung của project; đo ở khung 360px,
hai chip dài nhất ("Limited offer" và "Best value") còn dư 81px trước vết khuyết.

**CÒN TREO:**

- App mobile chưa dùng gì mới: Explore vẫn đọc 50 tour đầu, sort giá theo `basePrice`, chưa có sort
  `rating` hay băng đợt kế tiếp. Ghi để nhóm mobile biết, chưa thành mục open-items.

## 2026-10-15 — Merge dời freeze từ 15/10 sang 31/10 (ADR-0001 AMEND 3, `68fbe7c`)

User chốt sáng 15/10: buổi bảo vệ còn khoảng 4 tuần tính từ thứ Hai 19/10 (khoảng 16/11), trước
đó có buổi thuyết trình thử, nên freeze dời sang cuối tháng 10 để làm nốt open-items của web và
admin. Nhánh `docs/freeze-cuoi-thang-10-28z6kd`,
[PR #25](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/25), session cloud. Chỉ đổi docs
và một comment YAML: không code, không migration, không env, không dependency.

- ADR-0001 AMEND 3: freeze là 31/10/2026, nội dung không đổi (không nâng cấp dependency, không đổi
  nơi deploy); ở lại NestJS v11 tới hết capstone cũng không đổi. AMEND đặt ở ADR-0001 vì chính
  sách freeze sinh ra ở mục Hệ quả của nó và ở CLAUDE.md. ADR, spec, plan, CHANGELOG, comment code
  viết trước 15/10 ghi "freeze 15/10" giữ nguyên văn; ba chỗ là luật còn hiệu lực (ADR-0018 Ràng
  buộc lịch, ADR-0019, ADR-0024 Hệ quả) đọc mốc là 31/10. `docs/adr/README.md`: ADR-0001 lên 3 AMEND.
- Sửa tại chỗ: CLAUDE.md (ngày bảo vệ khoảng 16/11, roadmap, mục "Chính sách theo lịch"), bảng mốc
  thời gian của open-items (freeze 31/10, thêm dòng "Thuyết trình thử, chưa có ngày", bảo vệ khoảng
  16/11) và hai câu nhắc freeze trong đó, `docs/skills.md`,
  `docs/conventions/supabase-data-api-surface.md` (mốc 30/10 của Supabase nay rơi một ngày trước
  freeze, vẫn no-op), comment đầu `.github/dependabot.yml`.

**Review.** Không có lượt review độc lập. User bảo merge 15/10 01:03 UTC ("Merge nhé"). Nhánh tách
từ `4529721`; main không đổi tới lúc merge nên không cần rebase.

Tests after: không chạy `gate:int` riêng vì diff không chạm code; CI của PR (`gate` và `test:int`)
xanh cả lượt push và lượt pull_request lúc 01:01 UTC trên `68fbe7c`. Diff không thêm hay bớt test nào.

**CÒN TREO:**

- Lượt seed lại prod vẫn ghi khoảng 03/11 (spec seed §8.5, chọn khi bảo vệ dự kiến khoảng 11/11).
  Có ngày thuyết trình thử thì xem lại ngày chạy lượt này và ghi ngày thử vào bảng mốc của
  open-items.
- Dọn sau merge: nhánh `docs/freeze-cuoi-thang-10-28z6kd` trên origin nếu GitHub không tự xoá.

## 2026-10-15 — Merge hỏi lại trước khi rời màn viết bài của app khi bài còn dở: R1, R5 (open-items P5b-5 mục 4, `c5b4633`)

Làm tiếp open-items theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt): PR xong 14/10, merge
sáng 15/10. Nhánh `fix/review-draft-leave-guard`,
[PR #24](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/24), thi công trên session cloud.
Không migration, không env, không dependency. Thư viện dùng chung bị sửa: `@tourism/i18n`
(`reviews.unsentDraft`, bốn câu).

- Mobile `c5b4633`: back cứng Android, nút back ở header và vuốt back iOS ở màn viết bài (R1) và màn
  viết lại bài bị bác (R5) mở tấm "Leave without sending?" khi bài còn dở, cùng khuôn tấm rút bài;
  chỉ "Discard and leave" mới cho lệnh rời chạy tiếp. Còn dở nghĩa là khác gốc: form trống ở R1,
  bài cũ điền sẵn ở R5 (`reviewDraftChanged`: chữ so sau khi cắt khoảng trắng, ảnh so theo khoá
  từng ô). Đang gửi hay đã gửi xong thì không hỏi. `DiscardDraftGuard` dùng `usePreventRemove` của
  expo-router.
- open-items: mục 4 của "Nợ nhỏ phát sinh từ P5b-5" chuyển sang `open-items-closed.md`; thêm một
  dòng thử tay.

**Review.** Không có lượt review độc lập. User bảo merge 15/10 00:36 UTC ("Merge nhé"). Nhánh tách
từ `1274a3f`; main không đổi tới lúc merge nên không cần rebase.

Tests after (`gate:int` trên `c5b4633`, 14/10 xong 13:24 UTC, session cloud theo các bước của CI):
unit 7556 — web 2280, admin 2222, api 1158, mobile 850, contract 712, mobile-ui 145, i18n 58, ui 57,
core 48, tokens 26 — và int 843; CI của PR xanh 13:29 UTC trên cùng commit. So với `1274a3f`: mobile
thêm 17 test, các gói khác giữ nguyên. Turbo phát lại kết quả đã lưu của mobile-ui và tokens. Test
viết trước và đỏ, xanh sau; ba lượt đổi code thử (tắt guard, bỏ lệnh rời tiếp, bỏ điều kiện pha form)
đều làm test đỏ.

**CÒN TREO:**

- Thử tay trên máy thật ở bản build app kế tiếp (dòng ở open-items): back cứng Android ở R1, R5.

## 2026-10-14 — Merge lý do công ty huỷ chuyến cho khách đọc: email báo huỷ, trang đơn web và app, câu nhắc ở hộp huỷ chuyến (ADR-0041 AMEND 2, `bdc5e72`..`8ee7ecb`)

Làm tiếp open-items theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze 15/10): mục
"Đang chờ chủ dự án quyết" nêu 22/09, user chọn bản một ô 14/10 11:27 UTC. Nhánh
`feat/departure-cancel-reason`, [PR #23](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/23),
thi công trên session cloud. Không migration, không env, không dependency. Thư viện dùng chung bị
sửa: `@tourism/contract` (`BookingDetailSchema.departureCancelReason`, bắt buộc, `string | null`) và
`@tourism/i18n` (`bookingDetail.closed.whyLabel`, hai câu của hộp huỷ chuyến).

- ADR `bdc5e72`: ADR-0041 AMEND 2. Lý do admin gõ lúc huỷ chuyến là câu cho khách đọc nguyên văn,
  một ô, không có ô nội bộ thứ hai; ghi chỗ khác ADR-0030 AMEND 2 (lý do hoàn thiện chí vẫn nội
  bộ) và cái giá.
- API `4d72658`: lõi huỷ đường công ty đưa `reason` vào payload outbox `BOOKING_CANCELLED` (đường
  khách tự huỷ ghi `null`), template in khối "WHY" như email bác bài đánh giá. `bookings.byCode`
  thêm `departureCancelReason`, đọc sống `tour_departures.cancel_reason` khi chuyến `CANCELLED`.
- Web `58a88db`: trang chi tiết đơn có khối "Why" dưới "We had to cancel this departure.", chỉ khi
  trang kể chuyện công ty huỷ (`cancelledByOperator`). Không in ở hoá đơn in (G40) và voucher.
- Mobile `b6efe99`: hoá đơn khung `departureCancelled` có khối lý do dưới khối báo huỷ.
- Admin `8ee7ecb`: ô lý do của hộp huỷ chuyến nói trước rằng khách đọc nguyên văn, trên trang đơn
  và trong email báo huỷ nếu đã trả; câu báo khi ô trống thôi nói lý do chỉ để đội mình đọc.
- `docs/conventions/booking-states.md` ghi email mang `reason`. open-items: mục chờ quyết và mục đề
  xuất "cho khách biết VÌ SAO chuyến bị huỷ" chuyển sang `open-items-closed.md`; thêm một dòng thử
  tay.

**Review.** Không có lượt review độc lập. User bảo merge 14/10 12:38 UTC ("Merge nhé"). Nhánh tách
từ `f3786de`, rebase lên `07278d0` (PR #22, chỉ thêm `vercel.json` và docs) lúc 12:17 UTC; diff
của nhánh giữ nguyên, main không đổi tới lúc merge.

Tests after (`gate:int` trên `dccd07a`, bản trước khi rebase, 14/10 xong 11:59 UTC, session cloud
theo các bước của CI): unit 7539 — web 2280, admin 2222, api 1158, mobile 833, contract 712,
mobile-ui 145, i18n 58, ui 57, core 48, tokens 26 — và int 843; CI của PR xanh 12:30 UTC trên
`8ee7ecb`. So với `f3786de`: web thêm 7 test, api 8, contract 3, mobile 3, admin 1; int giữ 843 vì
các ca int chỉ thêm khẳng định vào test có sẵn. Turbo phát lại kết quả đã lưu của mobile-ui và
tokens. Test của từng phần đỏ trước khi sửa, xanh sau; int test của API đỏ 15 ca khi gỡ phần sửa.

**CÒN TREO:**

- Thử tay trên production (dòng ở open-items): huỷ một chuyến thử có đơn đã trả, đọc email và trang
  đơn. Hoá đơn app chỉ đổi ở bản build kế tiếp.
- Dọn sau merge: nhánh `feat/departure-cancel-reason` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge Vercel chỉ tạo deployment cho nhánh `main` (`73c2c5d`)

User hỏi 14/10 cách để Vercel và Render chỉ deploy nhánh `main`, không deploy các nhánh thành viên
nhóm push lên. Nhánh `chore/vercel-chi-deploy-main`,
[PR #22](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/22), thi công trên session cloud.
Không migration, không env, không dependency, không đổi code chạy.

- Render không cần đổi (đọc chỉ-đọc 14/10): service API theo dõi `main`, Pull Request Previews tắt,
  30 lần deploy gần nhất đều là commit của `main`.
- Vercel: `apps/web/vercel.json` và `apps/admin/vercel.json` đặt `git.deploymentEnabled` thành
  `{ "main": true, "**": false }`. Trước đó push lên nhánh nào cũng build cả web lẫn admin: 70 trong
  100 deployment gần nhất là preview, phần lớn là nhánh của các thread Claude; riêng 14/10 UTC đã có
  69 deployment trong giới hạn 100 mỗi ngày của Hobby. Không dùng Ignored Build Step trên dashboard
  vì bản bị nó huỷ vẫn tính vào giới hạn deployment.
- ADR-0024 AMEND 6 ghi số đo, lý do và hệ quả; mục lục ADR tăng số AMEND của 0024.

**Review.** Không có lượt review độc lập. Phép thử thật: push nhánh của PR lúc 11:36 UTC không tạo
deployment nào trên web và admin (đọc API Vercel tới 11:52), commit không có status nào của Vercel.
User bảo merge 14/10 11:58 UTC. Nhánh tách từ `f3786de`, main không đổi tới lúc merge nên không cần
rebase.

Tests after: CI của PR xanh trên `73c2c5d` (run 38557839456, đủ `test:int`, build, typecheck, test,
lint; xong 11:50 UTC). Không đổi code nên không đếm lại số test.

**CÒN TREO:**

- Nhánh tách ra trước `73c2c5d` vẫn tạo preview Vercel cho tới khi rebase lên `main` mới.
- Render không deploy commit này: build filter của service bỏ qua `docs/**`, `apps/web/**` và
  `apps/admin/**`.
- Dọn sau merge: nhánh `chore/vercel-chi-deploy-main` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge sáu việc nhỏ của app mobile: đơn quá hạn chót (G54), hoá đơn mời viết đánh giá, N7–N10 của nợ nhỏ P5b-4 (`b8529b9`..`3900a5b`)

Làm tiếp open-items theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze 15/10).
Nhánh `fix/web-open-items-9`, [PR #21](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/21),
thi công trên session cloud. Không migration, không env, không dependency, không đổi contract, không
thêm chữ. Thư viện dùng chung bị sửa: `@tourism/mobile-ui` (`bottom-sheet.tsx` bắt buộc prop
`closeLabel`, `bottom-sheet.spec.tsx`).

- G54 `b8529b9`: đơn chờ trả quá hạn chót (giai đoạn `lapsed`) thôi mang pill "Payment due" cam ở
  tab Trips và trên hoá đơn: nay "Payment not completed" xám như web. Hoá đơn có khung riêng nói
  "This booking wasn’t paid by the deadline." rồi câu điều kiện của web, chỉ còn nút "Browse tours"
  — trước đó khung T5 vẫn mời trả và mời huỷ giữ chỗ, bấm mới biết đã đóng. Giai đoạn tính bằng
  ngày của đồng hồ server như tab Trips.
- Hoá đơn mời viết đánh giá `e6fbf4e` (nợ nhỏ P5b-5 mục 1): mockup ghi R1 mở từ P6, từ chi tiết
  booking hoặc từ dòng My reviews, mà app chỉ có lối P6. Hoá đơn T4 nay có nút "Write a review" khi
  `canWriteReview`: đơn PAID, chưa có bài, chuyến không bị công ty huỷ, ngày về đã tới theo ngày UTC
  như cổng `checkReviewEligibility` (cùng luật nhánh `form` của `reviewSlot` bên web). Lối từ My
  reviews chưa làm: R4 chưa vẽ chỗ cho chuyến chờ đánh giá.
- N10 `be45bde`: backdrop tấm trượt là nút "Close" cho trình đọc màn hình, trước là một chỗ bấm
  không tên. Chín tấm của app truyền `messages.mobile.appShell.close`. Không chọn ẩn backdrop khỏi
  trình đọc màn hình: tấm mời đăng nhập và tấm sửa tên không có nút huỷ.
- N7 `3900a5b`: bấm đúp "Take photo" hay "Choose from library" (ảnh đại diện, ảnh review) trước khi
  picker kịp mở chỉ mở một picker, qua `createSingleFlight`
  (`apps/mobile/src/lib/single-flight.ts`).
- N9 `02a4db7`: Saved trên 100 tour thôi ghi "100 tours" lúc trang sau đang về: `wishlistCount` đọc
  `total` ở trang mới nhất, trừ các mục vừa bỏ lưu lạc quan.
- N8 `03438bf`: gõ lại ở màn đổi mật khẩu xoá khung lỗi cấp form của lần lưu trước, như màn Sign in.
  Nửa sau của N8 (lưu thành công thì về mà không báo) còn mở vì app chưa có toast.
- Bảng giai đoạn của [handoff mobile booking](handoff/mobile-booking-handoff.md) ghi luật `lapsed`
  và lối viết đánh giá từ hoá đơn. open-items: G54 chuyển sang `open-items-closed.md`; phần đã sửa
  của N7–N10 (nợ nhỏ P5b-4 mục 5) chuyển theo, chỉ để lại nửa sau N8; nợ nhỏ P5b-5 mục 1 ghi lối đã
  có; thêm một dòng thử máy thật.

**Review.** Không có lượt review độc lập. User bảo merge 14/10 11:06 UTC. Nhánh tách từ `9db6a2a`, main không đổi tới lúc merge nên không cần rebase.

Tests after (`gate:int` trên `3900a5b`, 14/10 xong 09:02 UTC, session cloud theo các bước của
CI): unit 7517 — web 2273, admin 2221, api 1150, mobile 830, contract 709, mobile-ui 145, i18n 58,
ui 57, core 48, tokens 26 — và int 843; CI của PR xanh 09:17 UTC. So với `9db6a2a`: mobile thêm
28 test, mobile-ui thêm 1. Turbo chạy lại test và typecheck của mobile và mobile-ui (đầu vào đổi);
các package khác phát lại kết quả đã lưu. Test của từng phần đỏ trước khi sửa, xanh sau; test route
của hoá đơn đỏ khi gỡ phần nối nút.

**CÒN TREO:**

- Màn mobile mới chỉ tới người dùng ở bản build app kế tiếp; dòng thử máy thật nằm ở open-items.
- Dọn sau merge: nhánh `fix/web-open-items-9` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge thẻ Trips và hoá đơn mobile nói chuyến bị công ty huỷ, chữ lỗi ảnh review theo contract, chip a11y, câu quét PENDING theo giờ UTC (`3a180a9`..`201fa68`)

Làm tiếp open-items theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze 15/10).
Nhánh `fix/web-open-items-8`, [PR #20](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/20),
thi công trên session cloud. Không migration, không env, không dependency, không đổi contract, không
thêm chữ. Thư viện dùng chung bị sửa: `@tourism/mobile-ui` (`chip.tsx`, `chip.spec.tsx`).

- Mobile, chuyến công ty huỷ `3a180a9`: trong lúc chờ job `departure-refund`, đơn còn PAID trên chuyến
  công ty huỷ vẫn ghi "Paid" nền xanh ở tab Trips, và hoá đơn không nói gì về việc huỷ. Pill của thẻ
  Trips và của hoá đơn nay đọc chung `bookingStatusPill`
  (`apps/mobile/src/features/trips/trips-list.ts`), cùng luật giai đoạn `cancelled` của `phaseLabel`
  bên web: "Cancelled" xám, đơn đã hoàn trọn giữ "Refunded". Hoá đơn có khung `departureCancelled`
  (cùng luật `cancelledByOperator` của web) mở bằng "We had to cancel this departure.", rồi "Your
  full refund is on its way." khi job chưa chạy, hay khoản đã hoàn và mốc khi job xong; không nút
  trả, không nút huỷ. Chữ dùng lại `messages.bookingDetail.closed` của web.
- Cùng commit, phát hiện khi làm: khách tự huỷ đơn đã trả thì API đặt CANCELLED (ADR-0041 §4), mà
  `bookingDetailKind` coi mọi đơn CANCELLED là chưa từng thu tiền, nên hoá đơn mobile chỉ ghi "This
  booking was cancelled." và không kể khoản hoàn. Đơn đã thu (cùng luật `wasCharged` của web) nay về
  khung T8 như handoff ghi. Bảng giai đoạn của
  [handoff mobile booking](handoff/mobile-booking-handoff.md) ghi thêm hai luật này.
- Ảnh review `9af27b3`: câu lỗi ảnh và số ô ảnh đọc `REVIEW_PHOTO_MAX_BYTES` và `REVIEW_PHOTOS_MAX` của
  contract thay cho "10 MB" và 5 ghi cứng (`reviewPhotoErrorText`, `maxPhotos` của hai route).
- Chip `201fa68`: chip bấm được báo `accessibilityState.selected` cho trình đọc màn hình; chip không có
  `onPress` (tag của bài viết) là `View` có nhãn thay cho `Pressable` vai "button". Đó là hai trong ba
  chỗ a11y của N10; backdrop của tấm trượt vẫn chưa có nhãn vì cần chọn cách đóng cho trình đọc màn
  hình.
- API, câu quét PENDING bỏ dở `a0a7f88`: `pending-sweep.service.ts` so `checkout_session_expires_at`
  với `now()`, mà cột không có tz nên Postgres ép theo TimeZone của phiên: trên Postgres cài theo giờ
  máy (UTC+7, mục nêu 25/09) câu quét huỷ cả booking còn phiên trả tiền sống. Nay so và ghi
  `cancelled_at`, `updated_at` bằng `now() AT TIME ZONE 'UTC'`. Supabase và Docker ở UTC nên
  production không đổi hành vi. `sweepAbandoned` nhận client tuỳ chọn cho int spec; `start-worker.ts`
  không đổi.
- open-items: mục "Mobile: thẻ Trips và hoá đơn chưa nói chuyến bị công ty huỷ", mục "Bug tiềm ẩn"
  của `pending-sweep.service.ts` và nợ nhỏ P5b-5 mục 3 chuyển sang `open-items-closed.md`; N10 ghi
  phần đã sửa; thêm một dòng thử máy thật và G54 (pill và hoá đơn mobile chưa kể giai đoạn `lapsed`).

**Review.** Không có lượt review độc lập. User bảo merge 14/10 08:35 UTC. Nhánh đã rebase lên `31d8ebb` (sau PR #18) trước khi chạy gate, không xung đột: hai bên không chung file nào.

Tests after (`gate:int` trên `201fa68`, 14/10 xong 08:24 UTC, session cloud theo các bước của
CI): unit 7488 — web 2273, admin 2221, api 1150, mobile 802, contract 709, mobile-ui 144, i18n 58,
ui 57, core 48, tokens 26 — và int 843; CI của PR xanh 08:40 UTC. So với `31d8ebb`: mobile thêm
23 test, mobile-ui thêm 2, api thêm 1 int. Lượt này turbo chạy lại test của api, admin, mobile và
mobile-ui (đầu vào đổi sau khi rebase lên PR #18); các package khác phát lại kết quả đã lưu. Test
của bốn phần đỏ trước khi sửa, xanh sau. Int spec mới chạy câu quét trong transaction có
`SET LOCAL TIME ZONE 'Asia/Bangkok'`: trước khi sửa nó huỷ 3 booking thay vì 1, gồm cả booking còn
phiên sống và booking 5 phút tuổi.

**CÒN TREO:**

- Màn mobile mới chỉ tới người dùng ở bản build app kế tiếp; dòng thử máy thật nằm ở open-items.
- Dọn sau merge: nhánh `fix/web-open-items-8` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G18 vùng xoá tour ở bước Review xuống sau công tắc On sale, G41 chạy bù ba job dọn dẹp hằng ngày khi API thức (`e5666d6`..`8c5392b`)

Làm tiếp việc tồn đọng của admin theo yêu cầu của user 13/10 (đóng càng nhiều open-items càng tốt
trước freeze 15/10). Nhánh `fix/admin-g18-review-order`,
[PR #18](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/18), thi công trên session cloud.
Không migration, không env, không dependency, không đổi contract; thư viện dùng chung không đổi.

- G18 `e5666d6`: ở bước Review của khu sửa tour, vùng "Delete this tour" đứng trước cột phải trong
  DOM, nên phím Tab tới nút Delete tour trước công tắc On sale, và dưới `xl` vùng xoá chen giữa danh
  sách kiểm tra và card Visibility. `StepColumns` (`editor-form-frame.tsx`) nhận prop `after` dựng
  sau `<aside>`; từ `xl` khung ấy nằm ở cột trái hàng hai, cột phải phủ hai hàng để sticky vẫn dính
  khi cuộn, gap hàng của lưới tắt và khung tự mang `mt-6` để Staff (vùng xoá render rỗng) không có
  dải trống 24 px. `TourReviewStep` đưa `DeleteTourZone` vào `after`. Từ 1280 px giao diện không
  đổi; màn hẹp đưa vùng xoá xuống cuối trang.
  [Spec F19](specs/2026-09-28-p4e-3c-tour-workspace-steps-design.md) §2d.6 thêm dòng "Sửa 14/10
  (G18)". Thẻ chọn bố cục (khuyến nghị "Dời xuống cuối") chưa có câu trả lời; user bảo merge PR có
  thay đổi này.
- G41: [ADR-0024](adr/0024-deploy-targets.md) AMEND 5 (`daba826`) đi trước code `8c5392b`. API gói
  free ngủ sau 15 phút không có request, còn cron của pg-boss không bù mốc đã lỡ (chỉ gửi job khi
  mốc gần nhất cách hiện tại dưới 60 giây), nên ba job dọn dẹp hằng ngày chỉ chạy nếu đúng phút ấy
  máy thức. Bảng `pgboss.job` production 07–14/10 (truy vấn chỉ đọc): `outbox-purge` chạy 6/8 ngày,
  `enquiry-retention` 5/8, `media-gc` 3/8, lượt lỡ nào cũng trùng quãng máy ngủ. Nay mỗi lần worker
  khởi động gửi vào mỗi queue dọn dẹp một job bù (`apps/api/src/worker/daily-catch-up.ts`) với
  `singletonKey: 'catch-up'`, `singletonSeconds: 86400` và `startAfter: 60`: chỉ mục duy nhất
  `job_i4` của pg-boss cho mỗi queue nhiều nhất một job bù mỗi ngày UTC, kể cả khi job đầu đã chạy
  xong, nên chỉ lần thức đầu tiên trong ngày chạy bù. Gửi hỏng chỉ ghi log, không làm sập lần khởi
  động của API; `media-gc` vẫn chỉ khi có `MEDIA_GC_ENABLED`.
- Mục lục ADR: 0024 ghi 5 AMEND (sửa trong chính commit ADR).
- open-items: dòng G18 và G41 chuyển sang `open-items-closed.md`; câu về bộ dọn ảnh ở mục "Việc tay
  trên hạ tầng" ghi G41 đã đóng.

**Review.** Không có lượt review độc lập. User bảo merge 14/10 07:52 UTC. Nhánh rebase lên `ef91e70`
(sau PR #19) không xung đột: hai bên chỉ chung `docs/adr/README.md`, mỗi bên sửa một dòng khác nhau.

Tests after (`gate:int` trên `8c5392b`, 14/10 xong 08:02 UTC, session cloud theo các bước của CI):
unit 7463 — web 2273, admin 2221, api 1150, mobile 779, contract 709, mobile-ui 142, i18n 58, ui 57,
core 48, tokens 26 — và int 842; CI của nhánh trên `8c5392b` xanh 08:11 UTC. So với `ef91e70`: admin
thêm 6 test, api thêm 7 unit và 4 int. Lượt này turbo chạy lại test của api, mobile và mobile-ui
(đầu vào đổi sau khi rebase lên PR #19); các package khác phát lại kết quả đã lưu vì đầu vào không
đổi. G18: test của `StepColumns` khoá thứ tự DOM (khung `after` đứng sau `<aside>`), lớp lưới từ
`xl` và khung ẩn khi rỗng; test của `TourReviewStep` khoá Tab tới công tắc On sale trước nút Delete
và vùng xoá là khối cuối. G41: unit cho `sendDailyCatchUp` và `describeCatchUp`; int với pg-boss
thật khoá rằng lần khởi động thứ hai trong ngày không gửi thêm, job bù đã `completed` vẫn chặn, job
cron đang chờ không chặn; bỏ `singletonSeconds` làm 2 int test đỏ, bỏ `singletonKey` làm 3 đỏ. Lượt
gate trên `68f9fb3` (trước rebase) có một test admin (`photo-library-dialog.spec.tsx`) đỏ một lần
dưới tải đầy rồi xanh khi chạy lại; chạy riêng 16/16, CI của PR trên commit đó xanh.

**CÒN TREO:**

- [ ] Ngay sau deploy API: bảng `pgboss.job` có ba job `singleton_key = 'catch-up'` (`outbox-purge`,
  `enquiry-retention`, `media-gc`) của hôm nay ở trạng thái `completed` (truy vấn chỉ đọc).
- [ ] Ngày 15/10: lần thức đầu tiên của ngày mới gửi ba job bù mới, lần thức sau trong ngày không gửi
  thêm (đọc `pgboss.job` và log `chạy bù hằng ngày` của Render).
- Dọn sau merge: nhánh `fix/admin-g18-review-order` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G47 chữ trạng thái trên app mobile đạt tương phản, G2 một helper `sessionCookie` cho int spec API (`2482f36`..`f76989d`)

Làm tiếp open-items theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze 15/10).
Nhánh `fix/web-open-items-7`, [PR #19](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/19),
thi công trên session cloud. Không migration, không env, không dependency. Thư viện dùng chung bị
sửa: `@tourism/mobile-ui` (`theme.ts` thêm hai khoá màu, `theme.spec.ts`).

- G47: [ADR-0019](adr/0019-color-token-roles.md) AMEND 4 (`2482f36`) đi trước code `5bb5384`. Bốn nhãn
  chữ 12dp của app mobile vẽ bằng chính màu bề mặt `warning` hoặc `success` lên lớp tô nhạt của
  màu đó: huy hiệu "Almost full" ở trang tour, nhãn "Paid" ở Trips và ở chi tiết đơn, nhãn
  "Published" ở My reviews. Theme sáng chỉ đạt 1,68 tới 2,83:1, theme tối 3,81 và 3,92:1 cho hai
  nhãn xanh. Nay chữ dùng `warning-emphasis` và `success-emphasis` (thêm vào `MOBILE_COLOR_KEYS`, cầu
  token có sẵn giá trị), lớp tô giữ token bề mặt: theme sáng 5,49 tới 5,74:1, theme tối 4,55 tới
  5,31:1. Chỗ sát nhất là Trips theme tối, 4,55:1 trên lớp tô 18%. "Booking closed" đi chung thẻ nên
  đổi theo (1,36 lên 2,54:1, hàng tắt nên WCAG 1.4.3 miễn). Mockup đã duyệt vẫn ghi
  `success`/`warning` và là bản ghi bất biến; code cố ý lệch, ghi ở AMEND 4. Màu mới tới người dùng
  ở bản build app kế tiếp.
- G2 `f76989d`: helper `apps/api/src/test/session-cookie.ts` thay 29 bản chép y hệt của
  `sessionCookie` trong int spec API (giữ nguyên thân và thông báo lỗi), test riêng 4 ca; 29 file
  thêm 29 dòng, bớt 367 dòng.
- Mục lục ADR: 0019 ghi 4 AMEND.

**Đóng CÒN TREO của entry W-09 và G15 (PR #17):** user thử tay production 14/10 07:49 UTC: đổi
avatar ở web và tải một ảnh tour ở admin đều thành công, chữ trang chủ, About, Contact và trang 404
không đổi, không chỗ nào hiện `undefined`. GitHub đã tự xoá nhánh `fix/web-open-items-6`.

**Đóng CÒN TREO của entry rà docs:** mục ADR-0055 dựa trên tiền đề sai. AMEND 2 của
[ADR-0055](adr/0055-mobile-data-layer.md) (06/10, "gỡ wrapper `AppImage` tầng app") đã ghi việc
wrapper `apps/mobile/src/components/app-image.tsx` bị gỡ và các màn truyền `transformUrl` tường
minh; đối chiếu code 14/10: file không còn, không chỗ nào import nó, 15 file màn truyền
`transformUrl={cloudinaryUrl}`. Không cần AMEND mới; link chết ở AMEND 1 là bản ghi có ngày nên
để nguyên. Cùng commit sửa câu tương ứng trong
[báo cáo rà tài liệu 14/10](analysis/progress/2026-10-14-docs-audit.md). GitHub cũng đã tự xoá
nhánh `docs/docs-reorg-2026-10-14`.

**Review.** Không có lượt review độc lập. User bảo merge 14/10 07:52 UTC, sau khi nhận ảnh so màu trước và sau. Nhánh đã rebase lên `587c559` (sau PR #17) trước khi chạy gate, không xung đột: hai bên không chung file nào.

Tests after (`gate:int` trên `f76989d`, 14/10 xong 07:29 UTC, session cloud theo các bước của CI):
unit 7450 — web 2273, admin 2215, api 1143, mobile 779, contract 709, mobile-ui 142, i18n 58,
ui 57, core 48, tokens 26 — và int 838; CI của PR xanh 07:47 UTC. So với `587c559`: mobile thêm 8
test, mobile-ui thêm 6, api thêm 4. G47: test của `mobile-ui` tính tương phản trên màu lớp tô đã
trộn (sRGB) cho ba tổ hợp đang dùng, cả hai theme đều từ 4,5:1 trở lên, và khoá rằng mực bề mặt
trần trượt ở theme sáng; test của bốn màn kiểm màu chữ là token emphasis ở cả hai theme; đỏ trước
khi sửa, xanh sau. G2: test helper đỏ khi chưa có file, xanh sau.

**CÒN TREO:**

- Dọn sau merge: nhánh `fix/web-open-items-7` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge W-09 chữ cứng của web vào `@tourism/i18n`, "1 tour", G15 một bản tải ảnh cho web và admin (`4b5f4ef`..`8102039`)

Làm tiếp open-items phía khách theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze
15/10). Nhánh `fix/web-open-items-6`, [PR #17](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/17),
thi công trên session cloud. Không migration, không env, không đổi contract, không thêm hay nâng
dependency ngoài. Thư viện dùng chung bị sửa: `@tourism/i18n` (`messages.ts`, `resilience.ts`,
`index.ts`, ba module trang mới), `@tourism/ui` (module `cloudinary-upload` mới, `package.json` thêm
phụ thuộc workspace `@tourism/contract`), cùng `pnpm-lock.yaml` (3 dòng link workspace).

- W-09 (`4b5f4ef`..`21a038d`): khoảng 300 chữ khách đọc hoặc trình đọc màn hình đọc (tiêu đề, đoạn
  văn, nút, nhãn ảnh, `aria-label`, placeholder, title và description) rời component web về
  `@tourism/i18n` theo luật 7: trang chủ, About, Contact, navbar, footer, top bar, menu tài khoản, nút
  về đầu trang, trang 404, blog, tours. Ba module `home-page.ts`, `about-page.ts`, `contact-page.ts`
  export thẳng từ barrel và CỐ Ý không gắn vào `messages`: component của ba trang là client
  component, gắn vào `messages` thì chữ của một trang chui vào chunk client dùng chung của mọi trang
  (cùng lý do đã tách `resilience.ts`). Chữ trùng nghĩa dùng lại khoá sẵn có; khoá mồ côi cùng nghĩa
  (`pageMeta.about/tours/destinations/contact`, chín khoá của `blog`) căn theo chữ đang chạy rồi nối
  vào trang. Cố ý để nguyên: logo chữ "Nex"/"ora" và watermark ở footer, ba tên nguồn ghi công bản
  đồ (ADR-0018), dữ liệu biên tập trong `apps/web/src/mocks/` (ADR-0016), chuỗi `sizes`, lỗi dành
  cho developer. Đóng mục "`user-menu` label literal", mục cuối còn mở của E5 trong
  [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md).
- "1 tour" `b70b1a7`: thẻ điểm đến ở trang chủ và About in "1 tours" khi điểm đến chỉ có một tour; ba
  hàm đếm chia số ít như mọi bộ đếm tour khác trong `messages`. Lỗi có từ bản chữ cứng, W-09 cố ý
  giữ nguyên khi dời chữ.
- G15: ADR `7275271` ([ADR-0021](adr/0021-media-write-surface.md) AMEND 3) đi trước code `8102039`.
  Phần chung của web và admin (đuôi file, form đã ký, khung XHR có hạn giờ 5 phút và huỷ qua
  `AbortSignal`) vào `libs/shared/ui/src/lib/cloudinary-upload.ts`; khung XHR nhận hàm `parse` vì web
  chỉ cần `public_id` còn admin cần thêm số đo ảnh. `apps/web/src/lib/media-upload.ts` và
  `apps/admin/src/lib/photo-upload.ts` thành lớp mỏng giữ nguyên tên hàm. Web nay có hạn giờ: mạng
  chết giữa lúc tải avatar hay ảnh review thì báo lỗi thay vì ô tải quay mãi. Chọn `ui` vì ADR-0042
  §3 cấm API DOM trong `core`. Mobile giữ bản riêng (React Native gửi `{uri, name, type}`), nên danh
  sách tham số ký còn hai nơi thay vì ba. Phần ký phía API của G15 đã gom từ P4e-4, nên G15 đóng
  hẳn: dòng chuyển sang `open-items-closed.md`.
- Mục lục ADR: 0021 ghi 3 AMEND; 0024 sửa thành 4 AMEND (AMEND 4 của G23 vào sau khi mục lục được
  viết lại ở đợt rà docs).

**Review.** Không có lượt review độc lập. User bảo merge 14/10 07:09 UTC. Rebase lên `6da00d2` (đợt
rà docs, trên G23 `572eb6f`) không xung đột: hai bên không chung file code nào.

Tests after (`gate:int` trên `8102039`, 14/10 xong 07:19 UTC, session cloud theo các bước của CI):
unit 7432 — web 2273, admin 2215, api 1139, mobile 771, contract 709, mobile-ui 136, i18n 58,
ui 57, core 48, tokens 26 — và int 838. Trừ api và mobile, các gói trúng cache turbo vì đầu vào y
hệt lượt chạy thật trước rebase (06:23 UTC); api và mobile chạy lại. W-09: chữ trong HTML server
trả về của 40 route (bản build production, gồm 9 trang cần đăng nhập và các trang 404) khớp từng ký
tự trước và sau; JS nén gzip tăng 0,67 KB ở `/`, 1,17 KB ở `/about`, 0,64 KB ở `/contact`, 0,03 tới
0,11 KB ở route khác. G15: module chung 10 test với XHR giả; test hạn giờ của web đỏ trước khi sửa
và xanh sau; admin bớt 2 test vì test phần chung chuyển về `ui`.

**CÒN TREO:**

- [ ] Thử tay production một lần: đổi avatar ở web và tải một ảnh tour ở admin. Môi trường cloud
  không có key Cloudinary (luật 15) nên G15 mới chỉ qua test giả lập; lỗi thì revert riêng `8102039`.
- Dọn sau merge: nhánh `fix/web-open-items-6` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge rà soát và sắp xếp lại `docs/`: thư mục mới, tách CHANGELOG và open-items, sửa thông tin lỗi thời (`90b1236`..`e0e40bb`)

User yêu cầu 14/10: kiểm lại thông tin trong `docs/`, sắp file vào thư mục cho hợp lý, chia nhỏ file
quá dài. Nhánh `docs/docs-reorg-2026-10-14`,
[PR #15](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/15), thi công trên session cloud.
Chỉ đổi tài liệu, `CLAUDE.md` và ba comment trỏ đường dẫn tài liệu; không migration, không env,
không dependency. Số đo và bảng sai/đúng ở
[báo cáo rà tài liệu 14/10](analysis/progress/2026-10-14-docs-audit.md).

- Dời thư mục `90b1236`: `reviews/`, `guides/`, `analysis/nexora-parity/`, `analysis/progress/`,
  `plans/prompts/`, bằng `git mv` để giữ lịch sử. Link tương đối viết lại bằng máy; comment trong
  `schema.prisma` và hai file `apps/mobile/src/features/auth/` sửa theo đường dẫn mới.
- Tách CHANGELOG `67a7a36`: entry 16/09–12/10 sang bảy file lưu trữ trong `changelog/`, chép nguyên
  văn, chỉ đổi đích link (ghép lại khớp 5.999 dòng, đủ 110 entry). File này giữ đợt từ 13/10.
- Mục lục `f844f6d`: `docs/README.md` từ 380 còn 77 dòng, chỉ trỏ tới `README.md` của từng thư mục;
  18 plan và 4 prompt đã xong có dòng "ĐÃ ĐÓNG" ở đầu trỏ đúng file lưu trữ.
- open-items `a27bf10`: `open-items.md` chỉ giữ việc còn mở (69 KB còn 24 KB), mục đã đóng chép
  nguyên văn sang `open-items-closed.md`. Cùng commit sửa thông tin lỗi thời đối chiếu với code:
  README gốc, overview, glossary, handoff, guides, sáu file conventions, brief thiết kế, mockups,
  sổ nợ.
- Báo cáo `6a4a4b3`; `CLAUDE.md` `edae037` (user duyệt 06:27 UTC): luật 13 nay nói doc mới thêm vào
  `README.md` của thư mục nó nằm, dòng Test của bảng toolchain ghi mobile và mobile-ui chạy Jest và
  jest-expo, link đối chiếu Nexora trỏ `analysis/nexora-parity/`. `e0e40bb`: số test ở overview theo
  entry G23.

**Cách làm từ nay:** đóng một mục open-items là ghi kết quả vào dòng, chuyển cả dòng sang
`open-items-closed.md` rồi ghi vào CHANGELOG, không gạch tại chỗ nữa. Mã G kế tiếp: G54.

**Review.** Không có lượt review độc lập. Kiểm bằng máy sau khi rebase: 1.287 link tương đối, 22 link
không tới được và cả 22 đều có sẵn trên `main`; mọi file `.md` nằm trong ít nhất một mục lục; dòng `+`
cột 0 vẫn 55 dòng ở 11 file. Rebase lên `572eb6f` (G23): dòng G23 đã gạch chuyển nguyên văn sang
`open-items-closed.md`. User bảo merge 14/10 07:08 UTC.

Tests after (`gate:int` trên `ab244b0`, 14/10 xong 06:04 UTC, session cloud theo các bước của CI):
unit 7416 — web 2273, admin 2217, api 1133, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 836. Lượt đầu `@tourism/contract` chết vì EPIPE của Vitest lúc
máy quá tải, chạy riêng 709/709, chạy lại cả lượt thì xanh. Sau rebase, CI `gate` của PR trên
`e0e40bb` xanh cả hai lượt (gồm test G23). Đợt này không thêm hay bớt test.

**Đóng CÒN TREO của entry G23:** sau deploy `572eb6f` (Render live 06:34 UTC), thread admin đọc chỉ-đọc
log Supavisor: phiên Prisma mang tên `tourism-api`, pg-boss mở đúng 2 phiên, không còn
`EMAXCONNSESSION` sau lần cuối 06:25 UTC (máy cũ, cấu hình cũ). GitHub đã tự xoá nhánh
`fix/api-g23-pool` khi PR #16 merge.

**CÒN TREO:**

- [ ] ADR-0055 dòng 162 trỏ `apps/mobile/src/components/app-image.tsx`, file không còn (các màn truyền
  thẳng `transformUrl={cloudinaryUrl}` vào `AppImage` của `@tourism/mobile-ui`): cần AMEND, không chỉ
  sửa đường dẫn.
- Dọn sau merge: nhánh `docs/docs-reorg-2026-10-14` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G23 trần pool kết nối của API để vừa Session pooler 15 client (`edace31`..`b15239d`)

Thread việc tồn đọng vùng admin nhận G23 ngày 14/10 (user muốn đóng càng nhiều open-items càng tốt
trước freeze 15/10). Nhánh `fix/api-g23-pool`,
[PR #16](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/16), thi công trên session cloud.
Không migration, không env, không dependency mới, không đổi contract, không thư viện dùng chung nào
bị sửa.

- Đo trước khi sửa, đọc chỉ-đọc log Supavisor (Supabase giữ 24 giờ): Session pooler nhận 15 client,
  client thứ 16 nhận `EMAXCONNSESSION`. Lúc 02:01:15 UTC một instance duy nhất vừa thức, không deploy
  nào chạy, giữ 9 phiên Prisma và 6 phiên pg-boss, phiên Prisma thứ 10 bị từ chối (preview web của
  PR #13 đỏ). Lúc 05:12:19 UTC, cũng một instance, Vercel build web sau push `89afda5`: Prisma 8,
  pg-boss 7, hai request oRPC trả 500. Trong 24 giờ: 22 phiên bị từ chối, 18 của pg-boss (lượt poll
  hỏng) và 4 của Prisma (request 500). Ghi chú cũ của G23 đoán đúng (hai pool mặc định 10), giờ có số.
- ADR `edace31`: [ADR-0024](adr/0024-deploy-targets.md) AMEND 4 chốt ràng buộc
  `2 × (Prisma + pg-boss) + 1 ≤ 15` (hai instance chồng nhau lúc Render deploy, chừa một phiên chạy
  tay) và hệ quả: request xếp hàng chờ kết nối thay vì 500; giao dịch tương tác chờ lấy kết nối tối
  đa 2 giây (`maxWait` mặc định) nên đợt dồn tải rất lớn có thể hỏng một giao dịch, cùng loại rủi ro
  mà hiếm hơn. Nâng Pool Size của Supavisor là đường thứ hai, không chọn vì nằm ngoài repo.
- API `b15239d`: trần gom ở `apps/api/src/config/db-pool.ts`, Prisma 5 (tên phiên `tourism-api`,
  trước đó log ghi tên mặc định `Supavisor`) và pg-boss 2; `auth.config.ts` và `start-worker.ts`
  dùng lại. CLAUDE.md bỏ câu "pool ~10" ở mục Postgres và trỏ về file này.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 06:27 UTC). Nhánh dựng trên `89afda5`
và main không đổi từ đó, nên không cần rebase.

Tests after (`gate:int` trên `b15239d`, 14/10 xong 05:40 UTC, session cloud theo các bước của CI):
unit 7422 — web 2273, admin 2217, api 1139, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 838. So với main `89afda5`: api thêm 6 ca (`db-pool.spec.ts`
khoá ràng buộc và hai hàm cấu hình), int thêm 2 (`db-pool.int.spec.ts` đếm phiên thật trong
`pg_stat_activity` lúc dồn việc: Prisma đúng 5 phiên với 15 câu cùng lúc, pg-boss không quá 2 với
sáu hàng đợi; cấu hình cũ đo được 10 và 8, cả hai ca đỏ). CI `gate` của PR xanh cả hai lượt.

**Đóng CÒN TREO `media-gc` của entry PR #13:** lượt 14/10 04:00 UTC chạy xong trong 18 ms, không row
nào tới hạn nên không in dòng `Dọn media: …` (sweep trả sớm khi không có row tới hạn,
`media-garbage.service.ts`). `media_garbage` còn 6 row, cả 6 trong vùng tải lên theo đúng vị từ
`isUploadZonePublicId`, không row nào có lỗi; tới hạn sớm nhất ở lượt 19/10 04:00 UTC. Nhánh
`fix/admin-open-items-3` của entry ấy GitHub đã tự xoá lúc merge.

**CÒN TREO:**

- [ ] Sau deploy: đọc log Supavisor, phiên Prisma phải mang tên `tourism-api` và không còn
  `EMAXCONNSESSION`. Lượt deploy của chính commit merge còn instance cũ (pool cũ) phục vụ build web,
  nên lượt đó vẫn có thể gặp G23 một lần; build web đỏ thì bấm Redeploy.
- Dọn sau merge: nhánh `fix/api-g23-pool` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge W-10 ảnh xin Cloudinary đúng cỡ, D1 nâng input-otp lên 1.5.0 (`bedfaff`..`860a501`)

Làm tiếp open-items phía khách theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze
15/10). Nhánh `fix/web-open-items-5`, [PR #14](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/14),
thi công trên session cloud. Không migration, không env, không đổi contract. **Có nâng dependency**
trước freeze: `input-otp` ^1.4.2 lên ^1.5.0. Thư viện dùng chung bị sửa: `@tourism/ui`
(`package.json`), cùng `pnpm-lock.yaml`.

- W-10 ảnh `bedfaff`: hàm `thumbnailSrc` (`apps/web/src/lib/cloudinary-thumb.ts`) xin Cloudinary bề
  ngang gấp ba khung hiển thị qua `cloudinaryLoader` có sẵn; URL ngoài Cloudinary (ảnh xem trước
  `blob:`, avatar Google) trả nguyên. Dùng ở `review-card` (64px), `region-reviews` (112px),
  `passport-card` (112px), `avatar-upload` (96px). Ảnh bìa ở `checkout-summary` đổi sang `SlotImage`,
  ở `travel-log` sang `next/image`, cả hai có `sizes` đúng khung. Trước đó các ô 64 tới 112px tải bản
  gốc `f_auto,q_auto`. Đóng mục CÒN TREO "Bốn bề mặt `<img>` trần" của W3 (archive
  `changelog/2026-09-security-w1-w4.md`): `booking-receipt` không còn từ P7. Hai `<img>` còn lại là cố
  ý: ảnh bìa bản in (ADR-0057 §4) và preview Object URL ở form ảnh review.
- W-10 LazyMotion: **không làm, có số đo.** Đổi 47 file sang `LazyMotion` và `m` rồi build production,
  đếm JS nén mỗi route bằng `next start`: tăng 3,6 tới 4,3 KB trên cả 14 route thay vì giảm. Entry
  `motion/react` vẫn kéo `motion` đầy đủ (gồm drag và layout) vào chunk đầu, `optimizePackageImports`
  không đổi được điều đó; lợi thật cần import thẳng `framer-motion`, tức đổi dependency sát freeze.
- D1 `860a501`: `input-otp` 1.5.0 trả cleanup cho effect hẹn ba timer; type chỉ thêm prop tuỳ chọn
  `nonce`. Lockfile sửa đúng ba khối của `input-otp` (10 dòng) vì `pnpm add` phân giải lại peer của cả
  repo (334 dòng churn, đổi cả `@types/node` của mobile); `pnpm install --frozen-lockfile` xác nhận.
  `otp-form.spec.tsx` gỡ đoạn đợi thật 150ms sau mỗi test (`adaedf3`), thêm test đồng hồ giả gỡ form
  rồi đếm timer: đỏ với 1.4.2 (6 timer), xanh với 1.5.0; chạy spec 20 lần liền không lần nào lỗi.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 05:06 UTC). Nhánh dựng trên `0d747a7`
và main không đổi từ đó, nên không cần rebase lại. A5 (tem "Hà Nội · Sa Pa") bỏ qua vì user đã chốt
giữ ngày 06/08. Rà sổ nợ thấy E5 "Load-more cap 50" đã hết từ P7 Phần A (phân trang 10 đơn), gạch luôn.

Tests after (`gate:int` trên `860a501`, 14/10 xong 02:36 UTC, session cloud theo các bước của CI):
unit 7416 — web 2273, admin 2217, api 1133, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 836. So với main `0d747a7`: web thêm 4 ca (hai của
`thumbnailSrc`, một cỡ ảnh avatar, một timer của OtpForm). CI `gate` của PR xanh cả hai lượt.

**CÒN TREO:**

- Dọn sau merge: nhánh `fix/web-open-items-5` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G16 bộ dọn media chỉ xoá ảnh trong vùng tải lên, G22 data:reset dọn ảnh review, G14 dọn code ảnh tour (`7da26ee`..`3a6c450`)

Nhánh thứ ba của việc tồn đọng vùng admin, sau PR #11. Nhánh `fix/admin-open-items-3`,
[PR #13](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/13), thi công trên session cloud.
Không migration, không env, không dependency mới, không đổi contract. Thư viện dùng chung bị sửa:
`@tourism/i18n` (chữ ảnh của admin dựng từ hằng contract).

- G16 ADR `7da26ee`, API `3deca5e`: [ADR-0035](adr/0035-media-lifecycle.md) AMEND 3. Bộ dọn media
  chỉ destroy ảnh trong bốn thư mục mà server ký upload vào (`avatars/<id user>`,
  `reviews/<booking code>`, `tours/<id tour>`, `posts/<id bài>`). Vị từ thuần
  `isUploadZonePublicId` ở `apps/api/src/lib/upload-signing.ts` soi cả dạng chủ sở hữu, vì thư mục
  cũ `tourism/tours/hero/` nằm ngay trong `tours`. Ảnh ngoài vùng bị từ chối trước mọi bước khác,
  kể cả khi còn được dùng: row ở lại với `attempts` bằng trần và `last_error` ghi lý do, dòng log
  mỗi lượt có thêm số ảnh ngoài vùng. Trước đó luật "không dọn ảnh catalog hay thư viện" chỉ nằm ở
  từng nơi gọi.
- G22 `059ca9f`: `data:reset` xoá dòng `media_assets` của review và xếp publicId vào
  `media_garbage` với đồng hồ mới trong cùng transaction, kèm bất biến đếm riêng. Đo trên DB nháp
  (seed và 4 ảnh review): main dừng ở `ROLLBACK: 4 ảnh mồ côi`, bản sửa `COMMIT`; ba đột biến cấy
  vào script đều `ROLLBACK` với lý do rõ.
- G14 `d551634`, `a1bae80`, `3a6c450`: phần còn lại của đợt dọn F18, người dùng không thấy gì
  khác. Chữ "JPG, PNG, WebP, AVIF or GIF", "10 MB" và trần 30 ảnh dựng từ
  `ALLOWED_IMAGE_EXTENSIONS`, `TOUR_PHOTO_MAX_BYTES`, `TOUR_PHOTOS_MAX`
  (`libs/shared/i18n/src/lib/photo-upload-copy.ts`), chữ in ra giữ nguyên từng ký tự. `ListEditor`
  nhận đúng một trong hai: nút thêm (`newItem` cùng `addLabel`) hoặc `emptyFocus`. Fixture tải ảnh
  của bốn spec gom về `apps/admin/src/test/photo-upload.ts`.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 02:20 UTC). Nhánh dựng thẳng trên
`27bc40c` và main không đổi từ đó, nên không cần rebase. Preview web của Vercel trên `3a6c450` đỏ vì
G23 (API production hết chỗ kết nối DB đúng lúc build), không do nhánh; CI `gate` xanh cả hai lượt.

Tests after (`gate:int` trên `3a6c450`, 14/10 xong 01:58 UTC, session cloud theo các bước của CI):
unit 7412 — web 2269, admin 2217, api 1133, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 836. So với main `27bc40c`: api thêm 6 ca, i18n thêm 5, admin
thêm 1, int thêm 2 (bộ dọn từ chối ảnh ngoài vùng, kể cả ảnh catalog đang được dùng).

**Đóng CÒN TREO thử tay của hai entry trước** (PR #8 và PR #11): user thử trên production 14/10
02:14 UTC (`/users`, "View bookings" ra đúng booking của một tài khoản kèm chip "Account",
`/subscribers`), không gặp lỗi. Ảnh chụp không có lượt thu hẹp cửa sổ, "Export N rows" và lọc
ngày của `/subscribers`; ghi đóng theo lời user.

**CÒN TREO:**

- [ ] Sau lượt `media-gc` kế tiếp (04:00 UTC hằng ngày), đọc dòng `Dọn media: …` trong log Render;
  số "ngoài vùng tải lên" khác 0 thì xem `last_error` của các row ấy trong `media_garbage`.
- Dọn sau merge: nhánh `fix/admin-open-items-3` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G45 lọc /bookings theo tài khoản, G50 tới G53 focus sau lệnh ghi, nút Export và login không WebGL (`a935fc4`..`a39d59d`)

Nhánh thứ hai của việc tồn đọng vùng admin (user giao 13/10 02:17 UTC; G45 user chọn "Làm luôn",
G50 tới G53 là lỗ thấy lúc đo PR #8). Nhánh `fix/admin-open-items-2`,
[PR #11](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/11), thi công trên session cloud.
Không migration, không env, không dependency mới. Contract đổi: `admin.bookings.list` nhận `userId`
(uuid, tuỳ chọn). Thư viện dùng chung bị sửa: `@tourism/contract` (trường ấy), `@tourism/i18n` (chữ
của G45), `@tourism/ui` (`GradientWaves`).

- G45 spec `a935fc4`, API `ced4c47`, admin `44188f3`:
  [spec](specs/2026-10-13-g45-bookings-account-filter.md). "View bookings" ở `/users/[id]` mở
  `/bookings?user=<id>&dates=all`: đúng các booking của tài khoản ấy (lọc cột `bookings.user_id`, có
  sẵn index), kể cả booking đặt bằng email liên hệ khác. Trước đó link tìm theo email nên lẫn booking
  của người khác. Hàng điều khiển có chip "Account: <email>" gỡ được (Staff hay tài khoản không còn
  thấy "One account"), Clear filters gỡ cả nó, file Excel ghi tài khoản ở đầu trang. Id không ứng với
  ai cho trang rỗng, chuỗi không phải uuid trả 400.
- G52 `2fd26df`: ô tiêu đề mang nút Export ghim mép phải ở `/subscribers` và `/bookings`. Đánh đổi:
  ở 1024px trở xuống ô ghim che chữ tiêu đề của cột đang trôi dưới nó cho tới khi cuộn bảng.
- G51 `a45455b`, `7d68ff5`: nút gửi và Cancel của hộp ghi khoá bằng `aria-disabled` lúc chờ
  (`ConfirmWriteDialog`, năm form dialog, hộp bác review, hộp hoàn tiền); lệnh hỏng mà hộp ở lại thì
  focus về chỗ cũ. Nút Staff access và Lock của `/users/[id]` theo khuôn G6.
- G50 `6c9406c`, `9e48d97`, `c6cc9ed`: `DataTableBody` cứu focus khi nút trong hàng biến mất sau
  lệnh ghi thành công: ô cùng cột của hàng cũ, rồi hàng thế chỗ, hàng phía trên, cuối cùng là chính
  bảng; chỉ cứu khi focus thật sự lạc từ thân bảng. Sign out everywhere, Reopen, đổi trạng thái
  enquiry, Add note và Sign in không còn đánh rơi focus.
- G53 `a39d59d`: `/login` của admin không sập cả trang khi trình duyệt không tạo được WebGL; nền sóng
  bỏ trống, form đăng nhập vẫn dùng được.

**Đo trên bản build (Chromium headless của session cloud, DB dev local).** G50: 10 ca, vết focus mỗi
5 ms, không ca nào chạm `<body>`. Lượt đo đầu bắt được điều jsdom không có: Chromium bắn `focusout`
ngay trước khi gỡ nút, lúc nút còn trong DOM; test mới giả đúng hành vi ấy (`c6cc9ed`). G51: request
giữ 1,5 giây, focus nằm trên "Saving…" suốt lúc chờ. G52: nút Export trong khung ở 768, 1024, 1280,
1366, 1440 và 1600px, lúc bảng ở đầu lẫn khi cuộn hết. G45: email dài từng làm trang tràn ngang 322px
ở 390px, khe hành động của `DataTableFrame` thêm `min-w-0`. G53: Chromium headless không có WebGL,
trang login hiện đủ form.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 01:09 UTC). Rebase lên `33df9d4`
(PR #12 của web) sạch, không xung đột.

Tests after (`gate:int` trên `a39d59d`, 14/10 xong 01:24 UTC, session cloud theo các bước của CI):
unit 7400 — web 2269, admin 2216, api 1127, mobile 771, contract 709, mobile-ui 136, i18n 51,
core 48, ui 47, tokens 26 — và int 834. So với main `33df9d4`: admin thêm 57 ca, contract thêm 5,
int thêm 3 (lọc theo tài khoản của `admin.bookings.list`).

**CÒN TREO:**

- [ ] Thử tay production: ở `/users/[id]` bấm "View bookings" (chỉ booking của tài khoản ấy, chip
  "Account" gỡ được), và ở `/subscribers` thu hẹp cửa sổ rồi xem nút Export vẫn thấy được.
- Dọn sau merge: nhánh `fix/admin-open-items-2` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G49 nút đỏ ở chân hộp thoại, G36 chặn review chuyến bị huỷ, G34 giờ chốt trong email (`9dcfc15`..`38934c9`)

Làm tiếp open-items phía khách theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze
15/10). Nhánh `fix/web-open-items-4`, [PR #12](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/12),
thi công trên session cloud. Không migration, không env, không dependency mới, không đổi contract.
Thư viện dùng chung bị sửa: `@tourism/tokens` (giá trị cả hai theme của `destructive-emphasis`).

- G34 `9dcfc15`: email xác nhận đặt tour (`render-email.tsx`) lấy giờ chốt hạn huỷ từ
  `DEADLINE_CUTOFF_COPY` của `@tourism/i18n` thay vì gõ tay. Chữ in ra không đổi.
- G49 ADR trước code: [ADR-0019](adr/0019-color-token-roles.md) AMEND 3 `c97e4da`, token và test
  `5b105d8`. Đo lại cho G49 thì thấy phần lớn nút đỏ đứng ở chân hộp thoại (`bg-muted/50` phủ lên
  popover): nút xoá tài khoản ở web, bỏ thay đổi chưa lưu và từ chối review ở admin. AMEND 2 (G46) chỉ
  đo nền và card nên bỏ sót bề mặt này; lúc hover ở đó theme sáng chỉ 3.96, theme tối 4.27.
  `destructive-emphasis` sáng xuống `oklch(0.47 0.136 27.3)` (≈ #98342D), tối lên `oklch(0.80 0.11
  26.7)` (≈ #FDA298); `destructive` (vai bề mặt) không đổi. Chỗ yếu nhất nay là 4.83 (sáng) và 4.78
  (tối). `tokens.spec.ts` thay ca chỉ đo nút ở theme tối bằng ca đo cả hai theme trên nền, card và chân
  hộp thoại, lúc nghỉ và lúc hover; ca này đỏ với giá trị cũ. Mobile đọc cùng token nên chữ đỏ của app
  đổi theo ở lần build sau.
- G36 `38934c9`: `checkReviewEligibility` có lý do mới `DEPARTURE_CANCELLED`, xét sau `NOT_OWNER` và
  `NOT_PAID`, trước `TRIP_NOT_COMPLETED`. `reviews.create` và `media.signUpload` nạp thêm trạng thái
  chuyến và rơi về `ReviewNotEligibleError` sẵn có (400 `REVIEW_NOT_ELIGIBLE`). Hai ca int mới đỏ khi bỏ
  dòng kiểm.

**Đo.** Bảng màu trước và sau dựng từ `generated/tokens.css` thật (Chromium headless của session
cloud): `reports/2026-10-13-g49/g49-truoc-sau.png` trong thư mục dự án. Đo lại tương phản từ pixel của
ảnh chụp lệch số tính toán không quá 0.05 (chỗ yếu nhất đo được 4.79 sáng, 4.82 tối).

**Review.** Không có lượt review độc lập. User xem bảng màu và bảo merge (14/10 00:50 UTC). Tự bắt lúc
thi công: G46 đã merge bỏ sót chân hộp thoại (sửa luôn trong G49 như trên). G30 (xác minh số điện
thoại bằng OTP) không làm: cần nhà cung cấp SMS có phí.

Tests after (`gate:int` trên `38934c9`, 13/10 xong 10:34 UTC, session cloud theo các bước của CI):
unit 7338 — web 2269, admin 2159, api 1127, mobile 771, contract 704, mobile-ui 136, i18n 51,
core 48, ui 47, tokens 26 — và int 831. So với main `cd589e6`: api thêm 4 ca, int thêm 2, tokens giữ
26 (một ca được thay).

**CÒN TREO:**

- [ ] Nhìn chữ đỏ trên production ở hai theme, ví dụ nút "Discard changes" của hộp "Discard unsaved
  changes?" ở khu sửa tour của admin: sửa một ô rồi bấm Back, xem xong chọn "Keep editing".
- Dọn sau merge: nhánh `fix/web-open-items-4` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge việc tồn đọng của admin: G43, G24, G6, G19, G3, G44, G7 (`ff825b3`..`dc95a68`)

User giao 13/10 02:17 UTC: làm luôn các việc còn tồn đọng của admin. Nhánh `fix/admin-open-items`,
[PR #8](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/8), thi công trên session cloud.
Không migration, không dependency mới. Env: admin có thêm biến TUỲ CHỌN `NEXT_PUBLIC_WEB_URL` (G19),
production không cần khai. Contract đổi: `admin.subscribers.list` nhận `from` và `to`. Thư viện dùng
chung bị sửa: `@tourism/contract` (hai trường ấy), `@tourism/i18n` (chữ của G43 và G7), `@tourism/ui`
(ô tích ở trạng thái một phần).

- G43 spec `ff825b3`, API `6effec6`, admin `49f1957`:
  [spec](specs/2026-10-13-g43-subscribers-selection-dates.md). `/subscribers` có cột ô tích như
  `/bookings`: tích vài hàng rồi "Export N rows" để tải đúng các hàng ấy (gom một trang; thiếu hàng thì
  409, API hỏng thì 502, audit ghi `mode: 'selection'`; URL mang `id`, không mang email). Hàng điều
  khiển có khoảng ngày đăng ký (ngày UTC, biên nửa mở qua `createdAtRange`, khoảng ngược trả 400). Phần
  dùng chung với `/bookings/export` lên `lib/export-selection.ts`.
- Ô tích dùng chung `0d08859`: trạng thái một phần đổ nền và vẽ dấu gạch. Trước đó nó vẽ dấu tích không
  nền, nên ô tiêu đề lúc mới tích vài hàng nhìn như đã chọn hết. Chỉ `/bookings` và `/subscribers` dùng.
- G24 `e35535e`: `/tours`, `/reviews`, `/outbox` và `/subscribers` không còn dựng lại cả cột hành động
  sau mỗi lần ghi — cột là hằng của module, lệnh ghi đi qua context như danh mục, điểm đến và chuyến.
- G6 `c15fb56`: năm nút mở hộp (Unsubscribe, Retry, Refund, cụm Approve/Reject, ba nút của hàng chuyến)
  khoá bằng `focusableWhenDisabled` khi bảng làm mới, nên Base UI trả focus về được.
- G19 `5e118d5`: "View on site" đọc `NEXT_PUBLIC_WEB_URL`. Không khai thì dev và test dùng
  `http://localhost:3000`, production dùng origin thật; khai sai thì `next.config.ts` làm build đỏ.
- G3 `bb58b0f`: lỗi của chuyến là `ContractError` (`admin-departure-errors.ts`), controller dùng
  `toContractError`, form dùng `lib/form-errors.ts`. Không đổi hành vi.
- G44 `50e5e4a`: cột tiêu đề của `/posts` và `/tours` có sàn `min-w-48` theo khuôn bảng Users.
- G7 `dc95a68`: Back, Forward và menu giữ chuột của trình duyệt mở hộp "Discard unsaved changes?" ở khu
  sửa tour và trình sửa bài viết.

**Đo trên bản build (Chromium headless của session cloud, DB dev local).** G6: lưu hộp Edit của một
chuyến thì hộp đóng ở 124 ms, focus nằm trên nút Edit đang `aria-disabled` tới lúc mở khoá ở 233 ms.
G7: có hỏi, giữ chữ và vị trí cuộn, Discard đi đúng mục lịch sử đã bấm. G44: tiêu đề giữ 192px ở 390
và 768px, trang không tràn ở 390, 768 và 1600px. G43: không tràn từ 390 tới 1600px; 22/22 đột biến cấy
vào phần admin của G43 (query, route xuất, bảng, file Excel) đều bị test bắt.

**Review.** Không có lượt review độc lập. User bảo merge (13/10 09:54 UTC). Phát hiện lúc đo, ghi thành
G50 tới G53 và đang vá ở nhánh `fix/admin-open-items-2`: focus rơi về `<body>` khi nút mở hộp biến mất
sau lệnh ghi thành công (G50), nút gửi và Cancel của hộp ghi khoá bằng `disabled` thật lúc chờ (G51),
nút Export ra ngoài khung khi bảng cuộn ngang (G52), trang `/login` sập khi trình duyệt không có WebGL
(G53).

Tests after (`gate:int` trên `dc95a68`, 13/10 xong 10:09 UTC, session cloud theo các bước của CI):
unit 7334 — web 2269, admin 2159, api 1123, mobile 771, contract 704, mobile-ui 136, i18n 51,
core 48, ui 47, tokens 26 — và int 829. So với main `df97df2`: admin thêm 76 ca, api thêm 5,
contract và i18n mỗi gói thêm 3, int thêm 4.

**CÒN TREO:**

- [ ] Thử tay production `/subscribers`: tích vài hàng rồi "Export N rows" (file chỉ có các hàng ấy),
  và lọc một khoảng ngày đăng ký.
- Dọn sau merge: nhánh `fix/admin-open-items` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge G46 chữ đỏ theme tối và G48 timer của auth-client.spec (`77e9e44`..`c75dee9`)

Làm tiếp open-items của web theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze 15/10).
Nhánh `fix/web-open-items-3`, [PR #10](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/10),
thi công trên session cloud. Không migration, không env, không dependency mới, không đổi API hay
contract. Thư viện dùng chung bị sửa: `@tourism/tokens` (giá trị tối của `destructive-emphasis`).

- G48 `77e9e44`: `apps/web/src/lib/auth-client.spec.tsx` thêm `afterAll` đợi thật 1100ms để timer
  1000ms của nanostores (cleanup của better-auth, đụng `window`) nổ trước khi Vitest tháo jsdom; cùng
  cách vá `otp-form.spec` ở `adaedf3`. Tái hiện bằng cách xếp spec ấy trước một file giả lập lúc
  `window` đã mất: chưa vá thì `ReferenceError: window is not defined` và thoát 1, có vá thì 3/3 lượt
  xanh.
- G46 ADR trước code: [ADR-0019](adr/0019-color-token-roles.md) AMEND 2 `3a8e7f5`, token và test
  `c75dee9`. `destructive-emphasis` tối từ `oklch(0.72 0.148 26.7)` lên `oklch(0.77 0.13 26.7)`
  (≈ #FC9287); sáng giữ nguyên. Soát chỗ dùng không thấy câu lỗi nào đặt thẳng trên `bg-muted`, nhưng
  thấy chữ của nút và huy hiệu biến thể `destructive` ở `@tourism/ui` (lớp tô `dark:bg-destructive/20`)
  chỉ 4.21:1, lúc hover 3.82:1 — gồm nút xoá tour, xoá bài viết, từ chối review, bỏ thay đổi ở admin và
  xoá tài khoản ở web. Giá trị mới: nền 6.75, card 5.99, muted 4.77, nút 5.09, hover 4.62.
  `tokens.spec.ts` thêm `destructive-emphasis` vào phép thử 4.5:1 trên nền, card, muted và thêm phép
  thử nút đỏ (trộn alpha 20% và 30% trong sRGB); hai test này đỏ với giá trị cũ. Mobile đọc cùng token
  nên chữ đỏ theme tối của app đổi theo khi build lại.

**Đo.** Bảng màu trước và sau dựng từ `generated/tokens.css` thật (Chromium headless của session
cloud): `reports/2026-10-13-g46/g46-truoc-sau.png` trong thư mục dự án.

**Review.** Không có lượt review độc lập. User xem bảng màu và bảo merge (13/10 09:54 UTC). Phát hiện
kèm: nút `destructive` lúc hover ở theme sáng chỉ 4.40 trên card và 4.19 trên nền, ghi thành G49.

**Đóng CÒN TREO của entry G42 ngay dưới:** user thử tay production 13/10 09:27 UTC (đơn BK-NYMOTOYZ,
huỷ ở trang Stripe về `/checkout/cancel`): thẻ chờ và Pay now đúng như mong đợi.

Tests after (`gate:int` trên `c75dee9`, 13/10 xong 09:44 UTC, session cloud theo các bước của CI):
unit 7247 — web 2269, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, i18n 48, core
48, ui 47, tokens 26 — và int 825. So với main `2ef92ef`: tokens thêm 2 ca.

**CÒN TREO:**

- Dọn sau merge: nhánh `fix/web-open-items-3` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge G42 màn hoá đơn chờ cho đơn chưa trả, phương án A (`2e84458`..`18e5ebd`)

User giao 13/10 07:16 UTC: làm G42 trước freeze 15/10 nếu kịp; chọn phương án A "Voucher chờ" trên
thẻ quyết định lúc 07:32 UTC (B là bản in B1 đưa lên màn hình). Nhánh `feat/g42-pending-receipt`,
[PR #9](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/9), thi công trên session cloud.
Không migration, không env, không dependency mới, không đổi API hay contract. Thư viện dùng chung bị
sửa: `@tourism/i18n` (thêm khối `pendingReceipt`, gỡ 13 khoá chỉ hoá đơn cũ dùng ở `booking.success`
và `booking.cancel`).

- Spec, bản vẽ, plan `2e84458`, `1bdd7a6`:
  [spec](specs/2026-10-13-g42-pending-receipt-design.md), bản ghi nguyên văn
  `design/mockups/pending-receipt.src.html`, [plan](plans/2026-10-13-g42-pending-receipt.md).
- Bảng quyết định `bf78b15`: `pendingView(booking, now, page)` ở `lib/pending-receipt.ts` cho bốn
  trạng thái — `payable` (trang huỷ, còn trả được), `confirming` (trang success, chờ webhook),
  `notPaid` (quá hạn chót), `closed` (đơn đã đóng, kể "Charged $0" hoặc khoản hoàn).
- Ảnh bìa dùng chung `23cbe61`: `VoucherPhoto` tách khỏi `VoucherOverview`, `InfoCell` có biến thể
  cảnh báo cho ô hạn trả.
- Thẻ chờ `426d833`: `PendingCard` cùng lưới hai cột với voucher, cột phải mảng `muted` có ô mã viền
  đứt, dải gạch chéo thay mã vạch (mã của đơn chưa trả không phải giấy vào cổng), Receipt overview,
  Trip journal, hành động chính. Hành động vẽ hai lần (ô gọn dưới `xl`, cột phải từ `xl`) nhưng chỉ
  một bộ hẹn giờ tự làm tươi.
- Hai trang `18e5ebd`: `/checkout/cancel` và nhánh chưa trả của `/checkout/success` dựng thẻ chờ;
  breadcrumb "Checkout". Gỡ `BookingReceipt` cùng `checkoutMood`, `cancelPageNote`, `receiptNote`
  (thay bằng `closedNote`). Pay now dùng lại `BookingActions` của trang chi tiết đơn.

**Đo trên bản build (Chromium headless của session cloud).** Sáu đơn thử chèn vào DB dev local (còn
trả được, chờ webhook PayPal, quá hạn chót, quá mốc 60 phút, đã huỷ chưa thu, đã huỷ sau khi bị thu
và hoàn tự động), đo xong đã xoá. 6 bề rộng (320, 375, 768, 1024, 1280, 1440) nhân sáng và tối: 72/72
lượt không cuộn ngang, không chữ ra ngoài thẻ, ảnh có `sizes`; tương phản thấp nhất của chữ trong thẻ
4.62:1 (sáng) và 4.69:1 (tối), kể cả chữ trên dải gạch chéo. Một lượt bị đẩy về `/login` giữa chừng,
đo lại thì đạt.

**Review.** Không có lượt review độc lập. User xem ảnh tổng hợp ba cặp trạng thái và bảo merge (13/10
08:20 UTC). Lỗi tự bắt lúc thi công: lớp Tailwind ghép động không được quét (đổi sang chuỗi viết
sẵn); `pending-card` và `pending-pass` import vòng (tách `pending-action.tsx`); `ButtonLink` nhận
`data-slot` thì đè slot `button` (bỏ).

Tests after (`gate:int` trên `18e5ebd`, 13/10 xong 08:14 UTC, session cloud theo các bước của CI):
unit 7245 — web 2269, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, i18n 48, core
48, ui 47, tokens 24 — và int 825. So với main `8af423d`: web thêm 32 ca mới (`pending-receipt` 23,
`pending-card` 9) và gỡ các ca của `BookingReceipt`, `checkoutMood`, `cancelPageNote`, ròng bớt 1.

**CÒN TREO:**

- [ ] Thử tay production: đặt một tour, bấm huỷ ở trang Stripe để về `/checkout/cancel` (thẻ chờ, Pay
  now trả tiếp được), và trả xong mà về trước webhook để thấy nhánh "Checking with Stripe…".
- Dọn sau merge: nhánh `feat/g42-pending-receipt` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge việc tồn đọng của web, lô 1 và lô 2: 15 mục open-items (`5fd101b`..`d154a26`)

User giao 13/10 04:46 UTC: làm các mục còn mở của web từ dễ tới khó, đóng được càng nhiều càng tốt.
Bản phân tích đầu vào đặt mã tạm `W-01` tới `W-11` cho mục chưa có dòng trong open-items; các mã ấy
không phải mã chính thức. Một nhánh `fix/web-open-items`, mỗi mục một commit,
[PR #7](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/7). Thi công trên session cloud.
Lô 1 được rebase lên `7429bdc` sau khi P4f merge; không xung đột. Không migration, không env, không
dependency mới. Thư viện dùng chung bị sửa: `@tourism/i18n` (G38, G37, W-05, W-01, W-09) và
`@tourism/tokens` (G32). Admin bị sửa ba file cho G20.

**Lô 1 (chín mục).**

- G38 `5fd101b`: gỡ năm khoá i18n mồ côi của `booking.success`; JSDoc `TICKET_BARCODE_BAR_COUNT`
  thôi tả cuống vé đã xoá.
- G35 `588e339`: ô thả ảnh của form review hết dùng `h3`; vé dùng `tripLengthDays` của contract;
  `sizes` ảnh bìa voucher đi cùng lề trang `/checkout/success` (`voucher-layout.ts`, có test đối
  chiếu).
- W-02 `a0c3d07`: ba nút Reserve gửi `?departure=<id>`, trang đặt chỗ chọn sẵn đợt đó nếu còn mở;
  `proxy.ts` giữ query trong `?redirect=` nên đợt không mất khi khách phải đăng nhập giữa chừng.
- W-01 `d9ca015`: `/privacy` nói đúng là mật khẩu lưu dạng hash trong DB của dự án, Google là tuỳ
  chọn, Supabase là nơi đặt DB (trước đó nói Supabase lo đăng nhập).
- W-07 `ff6e778`: lượt đọc tour phụ của trang chi tiết đơn và voucher có trần 8 giây; quá trần thì
  trang vẫn hiện đơn, chỉ thiếu phần lấy từ tour (trước có thể chờ tới khoảng 62 giây).
- G37 `37f1464`: `/checkout/cancel` thôi nói "still open" với đơn đã đóng (dùng câu "settled" của
  hoá đơn), và câu `heldNote` gọi đúng "My bookings" thay vì "Trips".
- W-05 `34aebf3`: tài khoản chỉ có Google được chỉ đường "Forgot password?" rồi tự xoá, thay vì bảo
  liên hệ support. Int test mới (`account-delete.int.spec.ts`, ca `2d`): tài khoản chỉ OAuth đặt
  mật khẩu qua reset, đăng nhập lại, `DELETE /api/account` trả 204.
- G31 `04beaa7`: hộp xoá tài khoản có ô `username` ẩn, chỉ đọc, mang email ngay trước ô mật khẩu, để
  trình quản lý mật khẩu của Edge có chỗ điền thay vì ô gõ DELETE.
- G33 `e59cfa6`, `3def7d8`: Lenis buông quán tính (`stop()` rồi `start()`, vì `reset()` là private)
  mỗi khi đường dẫn đổi, kể cả `router.push` trong mã; bỏ qua lúc có modal mở.

**Lô 2 (sáu mục).**

- G39 `c8ace93`: Passport phân loại đơn theo `bookingPhase` (ADR-0054 AMEND 1) thay vì tông riêng.
  User chọn 13/10 05:30 UTC: đơn hoàn tiền trọn mà khách vẫn đi thì vẫn đóng tem (`travelled`).
  Chuyến công ty huỷ không được đếm, đơn `lapsed` không có tem ghost.
- G28 `d82d446`: tour từ 24 chỗ thì thanh ghế vẽ một thanh liền theo tỉ lệ ghế còn; tới 23 chỗ giữ
  một đốt một ghế như bản duyệt. Dữ liệu hiện tối đa 22 chỗ nên khách chưa thấy khác.
- G29 `64ee41a`: dưới 640px và từ 1024 tới 1151px, bảy ảnh nhỏ thành một hàng ô vuông dưới ảnh
  chính (custom variant `gallery-row` ở `globals.css`); 640–1023 và từ 1152 giữ bố cục cột đã duyệt.
- W-09 `4a8b1de`: chữ cứng của cụm đăng nhập (6 trang auth, 8 component, nhãn logo ở header và
  footer) vào `messages.authForms` và `messages.a11y.homeLink`. Chữ khách thấy không đổi.
- G32 và G20: [ADR-0019](adr/0019-color-token-roles.md) AMEND 1 `70aaa0e` đi trước code `d154a26`.
  Hai token vai mực `warning-emphasis` (sáng `oklch(0.47 0.095 75)`, tức #79520A nâu hổ phách) và
  `success-emphasis`; bề mặt giữ nguyên. 14 chỗ ở web và 4 ở admin đổi sang token mới, gỡ cặp tạm
  `text-warning-foreground dark:text-warning`. Thay đổi nhìn thấy: ở theme sáng mộc "AWAITING
  PAYMENT" và chữ "N seats left" từ vàng sang nâu hổ phách; mộc và chữ thành công đậm hơn. Theme tối
  gần như không đổi.

**Đo trên bản build (Chromium headless của session cloud).** G29 ở 14 khổ từ 320 tới 1440px: không
hở cạnh ảnh nhỏ, không tràn, ảnh chính thẳng hàng cột đặt chỗ từ 1024 (dữ liệu local không có ảnh
tour nên đo với ô giữ chỗ). W-09: 80/81 chuỗi cũ hiện y nguyên qua các trạng thái; chuỗi còn lại
("Resend the code", chỉ hiện sau 60 giây) có test ở `otp-form.spec.tsx`. G33 bằng con lăn giả lập rồi
`router.push`: bản sửa đúng 10/10 lượt; bản đối chứng build tạm không có bản sửa sai 5/10 lượt (dừng
ở 2000 thay vì 0 hoặc 1135). G32: tương phản tính từ token bằng culori và có test 4.5:1 trên nền,
card, muted ở cả hai theme (`tokens.spec.ts`).

**Review.** Không có lượt review độc lập. User đọc báo cáo lô 1 và lô 2 kèm ảnh G29 và bảng màu G32
trước và sau rồi bảo merge (13/10 07:16 UTC). Lỗi tự bắt lúc thi công: G33 gọi `Lenis.reset()` là
hàm private (tsc bắt, đổi sang `stop()` rồi `start()`); ảnh chính G29 lệch 25px ở 1024 vì lưới kéo
giãn chiều cao (vá bằng `justify-end`); L của `warning-emphasis` hạ từ 0.5 xuống 0.47 vì mộc mờ 85%
chỉ đạt 4.36:1.

Tests after (`gate:int` trên `d154a26`, 13/10 xong 06:54 UTC, session cloud theo các bước của CI):
unit 7246 — web 2270, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, i18n 48, core
48, ui 47, tokens 24 — và int 825. So với main `7429bdc`: unit thêm 40 ca (web 32, i18n 5, tokens 3),
int thêm 1 ca (W-05). CI của PR xanh ở cả hai lượt chạy của `d154a26`. Một lượt `pull_request` của
`64ee41a` đỏ dù 2270/2270 test web PASS: Vitest đếm một unhandled error `window is not defined` từ
timer 1000ms của nanostores gọi cleanup của better-auth sau khi jsdom bị tháo
(`auth-client.spec.tsx`, file nhánh không đụng). Lượt `push` của cùng commit xanh. Đã tái hiện bằng
cách xếp spec ấy trước một file giả lập lúc `window` đã mất; ghi G48.

**CÒN TREO:**

- [ ] G31: thử trên Edge có lưu mật khẩu cho www, mở hộp xoá tài khoản, ô "Type DELETE to confirm"
  phải còn trống. Chưa ai thử trên trình duyệt thật.
- [ ] W-08: một lượt PayPal sandbox qua giao diện `www` trên production (việc tay của user).
- [ ] W-09 còn phần ngoài cụm đăng nhập: bản quét trước thấy khoảng 283 chuỗi cứng trong 55 file, đa
  số trang marketing (họ "i18n sweep" của sổ nợ B1 và E5).
- [ ] W-06 (ảnh Google ở host khác `lh3`) không làm: `google-avatar.spec` cố ý từ chối `lh5`, chưa có
  bằng chứng Google trả host khác cho ảnh hồ sơ, và đổi thì phải nới CSP ở web lẫn admin.
- Phát hiện mới ghi vào open-items: G46 (`destructive-emphasis` theme tối trên `muted` 3.94:1), G47
  (mobile vẫn dùng `success` và `warning` làm mực), G48 (timer rò của `auth-client.spec.tsx`).
- Dọn sau merge: nhánh `fix/web-open-items` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge P4f vùng Users: hai bậc Owner và Staff, khoá tài khoản (`8b453c6`..`26746d3`)

Admin có hai bậc: Owner (role `ADMIN`, chỉ từ `ADMIN_EMAILS`) và Staff (role `STAFF`, Owner cấp cho
khách đã xác minh). Bảng quyền `ADMIN_ACCESS` ở contract quyết 64 thủ tục admin: Staff dùng 48, 16 là
của riêng Owner. Owner có `/users`: danh sách, chi tiết, cấp và thu Staff, khoá và mở khoá, đăng xuất
mọi nơi, lịch sử theo người. Quyết định ở [ADR-0052](adr/0052-admin-staff-tier.md), hợp đồng ở
[spec](specs/2026-10-02-p4f-users-staff-design.md), các bước ở
[plan](plans/2026-10-02-p4f-users-staff.md). Một migration chỉ thêm
(`20261013022702_p4f_users_staff`: giá trị `STAFF`, cột `users.locked_at`, bảng `user_events` có
RLS); không env. Thi công và review trên session cloud 13/10,
[PR #6](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/6).

**API.** `@AdminImplement` thay `@Implement` ở mọi handler admin của 14 controller: gắn route như cũ
cộng `@Roles(...)` suy từ bảng quyền (`owner` → ADMIN, `staff` → ADMIN và STAFF); lưới
`@Roles(ADMIN)` cấp class giữ nguyên. Test quét quyền gọi mọi thủ tục admin: khách nhận 403 ở tất
cả, Staff nhận 403 ở thủ tục của Owner và qua cổng ở thủ tục của Staff. Khoá tài khoản: hook
`session.create.before` ném 403 `ACCOUNT_LOCKED` ở mọi đường tạo phiên (mật khẩu, OTP email, Google
trên web và app), AuthGuard trả 401 cho phiên sót của tài khoản đang khoá, `lockedAt` đi kèm
get-session. Sáu route `admin.users.*` (`list`, `byId`, `setRole`, `lock`, `unlock`,
`revokeSessions`): mỗi lệnh ghi một transaction giành hàng bằng `SELECT … FOR UPDATE` rồi mới hỏi
`userActions`, xoá phiên trong cùng transaction khi khoá hay thu Staff, ghi đúng một dòng
`user_events`. Trần ghi 60/60s của bề mặt admin áp cho cả Staff (trước chỉ Owner). Từ vòng vá
review: hook tạo và sửa user chặn email dài hơn 254 ký tự, `revokeSessions` trả số phiên còn hạn, ô
tìm của outbox không còn khớp `dedupeKey` của bốn loại email auth.

**Web.** Đăng nhập bị khoá hiện câu `accountLocked` (`mapAuthError` của core nhận
`ACCOUNT_LOCKED`); nút Google gửi `errorCallbackURL` về `/login` và form đọc `?error=`; phiên có
`lockedAt` coi như không đăng nhập.

**Admin.** Cổng nhận Staff; `AdminAccessProvider` và `useCanAccess` cho component client hỏi nút
nào hiện (không provider thì true); `requirePageAccess` chặn `/reports`, `/payment-events`, `/users`
và `/users/[id]` trước khi fetch, route xuất của thủ tục chỉ Owner trả 403 cho Staff kèm câu
`exportOwnerOnly`; trang `/not-authorized` có biến thể "Owner only". Sidebar lọc theo bậc, menu tài
khoản ghi Owner hay Staff. Staff không thấy sáu nút: hoàn tiền, huỷ chuyến, xoá tour, xoá bài, xoá
danh mục, xoá điểm đến. `/users`: tab All, Staff, Locked, tìm theo tên hay email, phân trang.
`/users/[id]`: Profile, Activity (link sang bookings đã lọc), Staff access, Account lock, Sessions,
History; bốn thao tác qua hộp xác nhận (khoá bắt buộc ghi lý do). Card Staff access nói theo đúng
trạng thái, kể cả Staff đang khoá và Staff chưa có mật khẩu (chỉ đường "Forgot password?").

**Lệch plan.** (1) Spec của `@AdminImplement` import `@nestjs/common/constants.js` và các method
thăm dò trả `never` để tsc 7 nhận dưới ESM. (2) Throttler gọi `isAdminAppRole(user.role ?? '')` vì
`role` của user phiên có thể vắng theo kiểu. (3) Test quét quyền đỏ hai ca từ Task 3 tới Task 5:
`admin.users.*` có trong contract từ Task 1 nhưng route tới Task 5 mới có, nên trả 404 thay vì 403.
(4) Ca get-session của Task 4 kiểm `user.lockedAt` là chuỗi, chặt hơn plan. (5) `loginDestination`
(G40 Phần 3 thêm sau khi plan viết) nhận cả Staff, nên Staff đã đăng nhập mở link mã đơn trong Excel
cũng vào thẳng trang đơn. (6) Spec của provider truyền role qua helper `renderAs` vì luật a11y
`useValidAriaRole` của Biome bắt prop `role="STAFF"`. (7) Gate đầy đủ chạy ở hai mốc (sau Task 6 và
ở Task 14) thay vì cuối mỗi task; task nào cũng chạy unit test của gói đã chạm, typecheck và đột
biến. (8) Ghi chú mobile (Task 14 B3) viết theo đường ID token của ADR-0056: lỗi khoá về thẳng 403,
không qua redirect như plan tả. (9) Grep của Task 14 B2 trúng ba chỗ đúng: JSDoc của
`@AdminImplement` nhắc `@Implement(contract.admin.…)`, và `users-view.ts` so
`detail.role === 'ADMIN'` hai lần (role của tài khoản đang xem, code của chính plan Task 11). (10)
Session cloud nên nhánh được đẩy lên origin sau mỗi task; docs của Task 14 đi hai commit. (11) Nhánh
rebase lên `1ca92f5` sau merge Google native; commit CHANGELOG viết sớm bị bỏ và dòng attribution bị
gỡ theo chỉ dẫn dự án 13/10; int test khoá cho hai đường Google thêm sau rebase (`4a35107`). Lúc
merge nhánh rebase thêm một lần lên `59af46c` (commit docs thử tay Google): xung đột chỉ ở docs, mã
không đổi.

**Soi bố cục (CSS build thật; Chromium headless qua CDP vì session cloud không có Browser
pane).** `/users/[id]` với tên, email và lý do khoá dài: 1600px không cuộn ngang, Profile và Activity
cùng hàng, ba card Staff access, Account lock, Sessions cùng hàng, không card nào tràn; 390px không
cuộn ngang, ba card xếp chồng, không card nào tràn. Đo thêm trang của một Staff đang hoạt động: cùng
kết quả. `/users` 1600px không cuộn ngang; 390px trang không tràn (đạt tiêu chí plan) nhưng cột User
chỉ còn ảnh đại diện: link tên rộng 0px ở 390px, 33px ở 768px. Vá bằng sàn `min-w-48` cho lưới tên
(`711c9e6`); đo lại: tên 192px ở 390px và 768px, bảng cuộn ngang trong khung, trang không tràn. Bảng
Posts và Tours đang chạy prod có cùng tật: ghi G44, không sửa ở nhánh này.

**Review 13/10 trên session cloud** (hai lượt review độc lập trên `38fe4fe`: một lượt rà API,
contract và Better Auth; một lượt rà admin, web và copy): 11 phát hiện, vá 9, ghi 1, giữ 1.

1. Ô tìm của outbox khớp `contains` trên `dedupeKey` thô, mà khoá của email auth nhúng OTP và link
   reset. Review xếp Thấp; đo lại là Cao: Staff gửi OTP đăng nhập tới email Owner (route ẩn danh),
   dò đủ sáu số sau 26 lượt `GET /api/admin/outbox`, đăng nhập thành Owner và gọi được
   `/api/admin/users`. Lỗ sinh ra từ P4f, vì trước đó chỉ Owner vào được outbox. Vá ở `e4c46c3`:
   vế `dedupeKey` loại bốn loại email auth, tìm theo người nhận vẫn ra; đo lại sau vá, 60 lượt dò
   không ra số nào.
2. Email tài khoản không có trần, nên một email 330 ký tự (đăng ký ẩn danh được) làm
   `admin.users.list` và `byId` trả 500 ở bước kiểm output. Vá ở `f752d17`: hook tạo và sửa user chặn
   email dài hơn 254 ký tự (400 `INVALID_EMAIL`), schema đọc bỏ trần để hàng cũ vẫn hiện.
3. Toast "N sessions ended." đếm cả phiên đã hết hạn, lệch ô Active sessions. Vá ở `5d8347e`.
4. Card Staff access của một Staff đang khoá vẫn nói dùng được back office. Vá ở `682b7ce`.
5. Khách vừa khoá vừa chưa xác minh được bảo mở khoá trước, như thể mở khoá là đủ. Vá ở `682b7ce`.
6. "View bookings" tìm bằng `contains` nên có thể kéo booking của tài khoản khác. Ghi G45: vá cần lọc
   `userId` cho `admin.bookings.list`, tức thêm tính năng.
7. Staff mở thẳng link xuất báo cáo nhận câu "no longer has admin access". Vá ở `7830e8c`.
8. Ca test chip của bảng Users không thể đỏ; ca "ba nút ba card" và ca Owner đang khoá không kiểm nút
   nằm ở card nào. Vá ở `42823ea`: soi trong đúng hàng và đúng card.
9. Lớp gác giao diện của Staff (provider ở layout, `requirePageAccess` ở bốn trang) không test nào
   canh. Vá ở `bdc5f38`: `owner-gates.spec.tsx`, Vitest admin thêm glob `src/app/**`.
10. Staff chỉ có tài khoản Google không vào được form admin (form cần mật khẩu) và form báo sai mật
    khẩu. Vá ở `682b7ce` và `b35175e`: card chỉ đường đặt mật khẩu bằng "Forgot password?", int test
    đo đường đó với tài khoản chỉ có Google; spec §8.4 và §11 ghi giới hạn. Suy luận chưa đo: trên
    production `COOKIE_DOMAIN` chia phiên giữa www và admin, nên phiên Google ở www có thể vào thẳng
    admin.
11. Hook khoá thêm một lượt đọc mỗi lần tạo phiên. Giữ: đọc theo khoá chính.

Tests after (`gate:int` 13/10 04:17–04:29, session cloud theo đúng các bước của CI, trên đầu nhánh
khi còn đặt trên `1ca92f5`; lần rebase lên `59af46c` sau đó chỉ kéo thêm docs nên mã y hệt `26746d3`):
unit 7206 — web 2238, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, core 48, ui 47,
i18n 43, tokens 21 — và int 824 ở 50 file. So với main `1ca92f5`: unit thêm 129 ca (admin 85,
contract 26, api 11, web 5, core 2), int thêm 34 ca (ba file mới `account-lock`, `admin-access`,
`admin-users`, và ca mới ở `google-sign-in`, `auth-hardening`, `admin-outbox`). Lượt gate đầu đỏ ở
`@tourism/contract#test` vì container hết RAM (dmesg: kernel giết một tiến trình node 4,4 GB đúng lúc
worker test chết); contract chạy riêng 701/701, lượt chạy lại xanh. CI của PR #6 xanh trước lần
rebase đó. Đột biến tay lúc thi công 66 lần, 64 lần test đỏ. Hai lần sống sót: `=== 'ACCOUNT_LOCKED'`
thành `includes('LOCK')` ở `mapAuthError` (plan chấp nhận: không mã Better Auth nào khác chứa LOCK), và
gỡ `requirePageAccess` ở trang, lúc thi công không test nào bắt, nay `owner-gates.spec.tsx` bắt.

**Migration lên Supabase:** user chạy tay từ máy mình 13/10, khoảng 05:08–05:12 UTC, trước lượt push
main (Git Bash, thư mục `apps/api`, checkout của nhánh, `DATABASE_URL` lấy từ `.env.production`).
`migrate status` báo thiếu đúng `20261013022702_p4f_users_staff`, `migrate deploy` áp xong, rồi
`migrate status` báo 31 migration và "Database schema is up to date!". Thread không ghi vào Supabase
(chỉ dẫn dự án 13/10).

**CÒN TREO:**

- [ ] Thử tay trên production theo spec §8.4, từng bước. Cần một tài khoản khách thật thứ hai mà
  user giữ hộp thư (khách seed không đăng nhập được).
- [ ] G45 chờ user quyết: thêm lọc `userId` cho `admin.bookings.list` là thêm tính năng.
- Dọn sau merge: nhánh `feat/p4f-users-staff` trên origin (session cloud không xoá được nhánh trên
  GitHub).

## 2026-10-13 — Thử tay đăng nhập Google native trên production 4/4 bước

**Thử tay** (ba mục thử trong CÒN TREO của entry merge bên dưới, chia thành bốn bước; sau push
`1ca92f5`: Actions main xanh, Render deploy API live 03:51 UTC; user làm trên máy mình và điện
thoại Android, gửi ảnh hoặc báo kết quả, session gốc đối chiếu):

1. Web production, cửa sổ ẩn danh, một tài khoản Google chưa có trên Nexora (Workspace, chưa đặt
   ảnh): tài khoản tạo xong, khung hộ chiếu và avatar đầu trang hiện ảnh mặc định chữ cái của
   Google (nền tím, chữ trắng). Khi không có ảnh, app vẽ ô xám nhạt với chữ serif
   (`passport-card.tsx`), nên URL ảnh Google đã được lưu.
2. `curl -i` vào `expo-authorization-proxy` từ máy user: `HTTP/1.1 400 Bad Request`, body
   `{"message":"Invalid authorizationURL"}`, không có `set-cookie`.
3. Build lại APK `preview` từ `main` (`1ca92f5`, build EAS `e0a6f244`) rồi cài lại. Checkout trên
   máy user lúc đó còn ở nhánh cũ, thiếu 6 commit của vòng review, nên phải chuyển sang `main` và
   pull trước khi build.
4. Trên APK mới: bấm Google hiện bảng chọn; tắt hẳn app, mở lại, Sign out, bấm Google lần nữa vẫn
   hiện bảng chọn và chọn được tài khoản khác. Đây là ca phát hiện 1 và 2 của review nhắm tới (bản
   cũ gọi `signOut` khi chưa `configure` sau khi mở lại app). Avatar trên app đúng ảnh tài khoản
   Google; user không gặp lỗi nào khác.

User đã xoá nhánh `feat/mobile-google-native-signin` trên origin và ở máy mình.

**CÒN TREO:**

- Nút Google ẩn ở bản iOS thiếu client iOS mới có unit test, chưa thử trên máy: cần bản iOS, tức
  là cần tài khoản Apple Developer. Ghi cùng Credential Manager ở open-items mục 4 (sau v1).
- Docs, không đổi mã; không migration, không env.

## 2026-10-13 — Merge đăng nhập Google native trên mobile (ADR-0056), đóng proxy Expo trên API (`b6dacdc`..`2d6f6c7`)

App mobile đăng nhập Google bằng SDK gốc `@react-native-google-signin/google-signin` 16.1.5: bảng
chọn tài khoản của hệ điều hành cho ID token, app gửi `POST /api/auth/sign-in/social` kèm `idToken`
rồi lưu cookie phiên như đăng nhập email. Luồng cũ qua trình duyệt và proxy
`expo-authorization-proxy` bỏ hẳn. Expo Go không nạp được module gốc nên nút Google ẩn ở đó (và ở
bản iOS thiếu client iOS); thử Google cần APK `preview` hoặc dev build của EAS
([runbook §7](conventions/mobile-dev-loop.md)). [ADR-0056](adr/0056-mobile-google-native-signin.md)
cùng AMEND 1, [spec](specs/2026-10-09-mobile-google-native-signin-design.md).

API, deploy theo merge này:

- `b6dacdc`: before-hook trả 400 cho mọi `GET /expo-authorization-proxy`, ở mọi môi trường — vá
  chuỗi chiếm phiên qua deep link đang mở trên production (ghi chú 09/10 ở ADR-0017 §11) — và cho
  `/sign-in/social`, `/link-social` không kèm `idToken` mà có callback là deep link. Provider Google
  nhận `clientId` dạng mảng: client web, rồi client iOS nếu có `GOOGLE_IOS_CLIENT_ID`.
- `c3bca63`: tài khoản MỚI tạo bằng Google, cả web lẫn app, không còn bị guard avatar chặn. Trên
  `/sign-in/social` và `/callback/:id`, ảnh `lh3.googleusercontent.com` được giữ, ảnh host khác bị
  bỏ (user chọn giữ ảnh Google 13/10). Trước bản này mọi tài khoản mới bằng Google bị từ chối, kể cả
  trên web production — kết luận từ đọc mã và int test, chưa đối chiếu log production.

Mobile `2b26e55` (seam SDK ở `google-native.ts`, nút ẩn khi không dùng được) và `245958e` (nối dự án
EAS `@yuri-volkovs-team/nexora-travel`): `eas.json` có profile `preview` (APK trỏ API production,
client ID web và iOS trong khối `env`) và `development`, script `eas-build-post-install` build các
package workspace trên EAS, `expo-dev-client` nên ba script dev thêm `--go`. Docs `f189183` và
`8d302da`. Không migration, không đổi env API; hai dependency mobile mới đã có trong ADR-0056.

**Google Cloud và EAS** (user làm 13/10): client iOS và client Android cùng dự án với client web
đang chạy, trang OAuth Publish ("In production"), build `preview` đầu tiên trên EAS xanh với khoá ký
sinh trên EAS.

**Thử trên máy thật 13/10** (APK `preview`, API production chưa có nhánh này): Google vào đúng tài
khoản email có sẵn (không ảnh là đúng thiết kế, Better Auth không chép ảnh khi liên kết); đóng bảng
chọn thì màn đứng yên; đăng xuất rồi chọn lại tài khoản được; bấm tim khi chưa đăng nhập rồi đăng
nhập Google quay về đúng chỗ.

**Review 13/10 trên session cloud** (code-review mức high trên `d0d7b88..245958e`): 10 phát hiện, vá
8, giữ 2.

1. Đăng xuất khỏi app gọi `signOut` của SDK khi SDK chưa cấu hình trong tiến trình (sau khi mở lại
   app), Android từ chối và lỗi bị nuốt, nên lần sau Android tự vào lại tài khoản cũ. Vá ở
   `0d46574`: đăng xuất cấu hình SDK trước.
2. API từ chối token thì SDK vẫn nhớ tài khoản vừa chọn. Vá ở `0d46574`: app `signOut` trước mỗi
   lần mở bảng chọn, nên lần nào cũng được chọn tài khoản.
3. Bản iOS thiếu client iOS hiện nút mà bấm vào chỉ ra lỗi. Vá ở `0d46574`: ẩn nút.
4. Khoá deep link chỉ bắt `nexora:`, trong khi plugin `expo()` tự tin `exp://` ở development và gắn
   cookie cho mọi deep link tin cậy. Vá ở `9d512f6`: chặn mọi URL tuyệt đối có scheme khác
   http/https, parse bằng `new URL` như plugin (hoa thường, tab, ký tự điều khiển không lách được).
5. Ngoại lệ ảnh Google chưa có int test qua đường thật của Better Auth. Vá ở `430f9c7`: 5 ca với
   JWKS và token endpoint Google giả; chạy trên `auth.config.ts` trước bản vá ảnh thì 3 ca tài khoản
   mới đỏ.
6. Mọi lỗi của SDK gộp thành lỗi chung. Vá ở `0d46574`: máy không có Google Play Services báo
   "not available" (bấm lại không chữa được); các lỗi còn lại vẫn là lỗi chung.
7. Scheme `nexora` lặp lại ở API ngoài `env.ts`. Hết theo mục 4: API không còn hằng scheme.
8. Before-hook so path lần hai để chọn thông điệp. Vá ở `9d512f6`: guard trả lý do.
9. `GOOGLE_IOS_CLIENT_ID` bị cho là cấu hình chết. Giữ: ID token cấp cho app iOS mang audience là
   client iOS (suy từ tài liệu Google, chưa đo được khi chưa có bản iOS); thừa thì vô hại.
10. Ảnh Google ở host `lh4`–`lh6` bị bỏ. Giữ: nới host phải sửa cả `img-src` của CSP web và admin;
    ghi ở open-items mục 4.

Tests after (`gate:int` trên `2d6f6c7`, 13/10 03:11–03:20, chạy trên cloud theo đúng các bước
của CI): unit 7077 — web 2233, admin 1998, api 1107, mobile 771, contract 675, mobile-ui 136, ui 47,
core 46, i18n 43, tokens 21 — và int 790/47. So với main: api 1097 → 1107 (guard 12 ca, ảnh Google
5, env 1, trừ 8 ca của spec proxy cũ đã gỡ), mobile 738 → 771 (seam Google 16, hành động auth 5,
cấu hình EAS 3, env 3, hai màn auth 4, đăng xuất 2), int 782 → 790 (proxy và khoá deep link 3, đăng
nhập Google qua Better Auth thật 5). Lượt gate đầu đỏ ở typecheck mobile vì spec mới so
`invocationCallOrder[0]`, kiểu `number | undefined` dưới `noUncheckedIndexedAccess` (jest vẫn
xanh); vá ở `2d6f6c7`, lượt sau chạy lại từ bước build API vì int đã xanh trên cùng mã API.

**CÒN TREO:**

- [ ] Sau khi Render deploy: đăng nhập bằng một Gmail chưa có tài khoản, trên web production và trên
  app, thấy tài khoản tạo xong kèm ảnh Google.
- [ ] Gọi proxy từ máy, thấy 400 và không có `set-cookie`:
  `curl -i "https://api.nexora-travel.agency/api/auth/expo-authorization-proxy?authorizationURL=https%3A%2F%2Faccounts.google.com"`.
- [ ] Build lại APK `preview` (JS của vòng review chưa có trong APK đang cài), cài lại, thử: bảng
  chọn hiện mỗi lần bấm, đăng xuất rồi đăng nhập lại chọn được tài khoản khác.
- [ ] Sau v1: Credential Manager thay Google Sign-In cũ trên Android; iOS khi có tài khoản Apple
  Developer (lúc đó thêm `GOOGLE_IOS_CLIENT_ID` vào env Render). Đã ghi ở open-items mục 4.
- Dọn sau merge: nhánh `feat/mobile-google-native-signin` trên origin (session cloud không xoá được
  nhánh trên GitHub).
