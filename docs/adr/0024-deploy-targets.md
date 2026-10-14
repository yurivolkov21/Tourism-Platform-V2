# ADR-0024 — Nơi deploy v1: web Vercel · API + worker Render · DB Supabase · domain `nexora-travel.agency`

- **Ngày:** 2026-08-19
- **Trạng thái:** Đã triển khai 20/08/2026 — smoke §0 của spec đạt cả 5 mục
  (web/API sống trên domain, OTP + xác minh email + cookie `.nexora-travel.agency`,
  booking Stripe sandbox PAID qua webhook, contact + newsletter gửi mail thật)
- **Liên quan:** [ADR-0001](0001-tech-stack.md) (đã dự kiến Vercel Hobby + Render/Railway),
  [ADR-0010](0010-infra-hardening.md), [ADR-0017 §4](0017-web-session-better-auth.md)
  (cookie cùng registrable domain là ràng buộc deploy), [ADR-0016](0016-web-data-layer.md)
  (web build cần API sống).

## Bối cảnh

P3b web ~95%, user muốn có bản chạy thật (domain, email, thanh toán sandbox)
TRƯỚC khi mở P4 Admin. CLAUDE.md chốt **freeze 15/10: không đổi nơi deploy** —
nên phải quyết nơi deploy bằng ADR ngay bây giờ, không để trôi tới lúc freeze.

Bản tiền nhiệm Nexora từng chạy trên domain `https://www.nexora-travel.agency/`
(đang pause). Domain chỉ là DNS, không gắn code; v2 không hardcode domain nào —
mọi URL đi qua env (`NEXT_PUBLIC_SITE_URL`, `FRONTEND_URL`, `BETTER_AUTH_URL`,
`TRUSTED_ORIGINS`, `EMAIL_FROM`).

## Quyết định

| Mảnh | Nơi | Ghi chú |
| --- | --- | --- |
| Web (Next 16) | **Vercel** (Hobby), project mới cho v2 | root `apps/web`, build qua turbo; domain `www.nexora-travel.agency` + apex redirect về `www` |
| API (NestJS) | **Render** Web Service, Docker từ `apps/api/Dockerfile` | `api.nexora-travel.agency`; health `GET /health` |
| Worker (outbox email · pending sweep · pg-boss cron) | **Render** Background Worker, **cùng image**, CMD `node dist/worker.js` | Tách tiến trình như local (`worker.ts`); free tier không có Background Worker → cần plan trả phí nhỏ HOẶC (quyết ở bước triển khai) chạy worker trong cùng tiến trình API bằng một cờ env — xem spec §3 |
| DB | **Supabase** Postgres (project riêng cho prod), **Session pooler 5432** | Cấm 6543 (transaction pooler — CLAUDE.md). `prisma migrate deploy` tường minh với `DATABASE_URL` prod |
| Email | **Resend**, domain đã xác minh (SPF/DKIM trên `nexora-travel.agency`) | `EMAIL_FROM=Nexora <noreply@nexora-travel.agency>` |
| Media | Cloudinary hiện có (cùng cloud, cùng folder `tourism/…`) | publicId đã sống, không đổi |
| Thanh toán | Stripe + PayPal **sandbox** (capstone không doanh thu) | webhook trỏ `https://api.nexora-travel.agency/…` |
| Domain / DNS | `nexora-travel.agency` tái dùng từ Nexora cũ | Gỡ khỏi project Vercel cũ trước; DNS ở registrar hiện tại |

## Cookie session — đường CHUẨN của ADR-0017 §4

Web và API cùng registrable domain (`www.` + `api.`) → bật
`advanced.crossSubDomainCookies` (`domain: .nexora-travel.agency`), giữ
`sameSite: lax` + `secure`. **Không** dùng fallback `sameSite: 'none'` — không
cần vì đã có domain chung. Đây là lý do chọn tái dùng domain thay vì cặp
`*.vercel.app` + `*.onrender.com`.

## Hệ quả

- Thêm một cờ env phía API cho cookie domain (chỉ bật ở prod); local/dev giữ
  nguyên (same-site).
- Thứ tự deploy bắt buộc: **DB → API (+migrate) → worker → DNS api → web build**
  — web build SSG gọi API thật (ADR-0016 §3), API chưa sống thì build đỏ.
- Vercel preview URL (theo branch) không nằm trong `TRUSTED_ORIGINS` → preview
  không đăng nhập được; chấp nhận (preview chỉ để nhìn UI).
- Render free tier ngủ sau 15 phút → lần build web đầu có thể timeout; mitigations
  ở spec.
- Sau freeze 15/10 mọi thứ trong bảng trên là cố định.

## Lựa chọn đã bỏ

- **Railway cho API** (ADR-0001 nêu ngang Render): Render có Docker + health
  check + cron/worker rõ ràng, tài liệu quen với user; không có lý do kỹ thuật
  phân thắng bại — chọn một để đóng.
- **Web + API cùng một host (Render cả hai)**: mất ISR/Edge của Vercel mà web
  đang dựa (Cache Components/ISR 300s), build Next trên Render chậm.
- **`sameSite: 'none'`** để chạy hai domain rời: mất lớp CSRF của `lax`, chỉ là
  fallback khi không có domain.

## AMEND 1 — 05/09/2026: build web tự đánh thức API trước khi prerender

**Hệ quả** ở trên dự báo "Render free tier ngủ sau 15 phút → lần build web
đầu có thể timeout" và trỏ mitigation sang spec (cron ping hoặc plan trả
phí). Nó xảy ra thật hai lần — 02/09 (`233c559`) và 05/09 (`03eaef9`) — cùng
một dạng: commit chỉ có docs, push sau hơn 15 phút không ai chạm site, Vercel
build web chết `TimeoutError` ở "Collecting page data for /blog/[slug]" đúng
10s sau khi bắt đầu (timeout của client oRPC, ADR-0016), trong khi CI xanh vì
CI có API riêng trên localhost. Site không sập (Vercel giữ deploy READY cũ)
nhưng commit đó không bao giờ lên web nếu không ai bấm Redeploy.

**Chốt:** `apps/web/scripts/warm-api.mjs` chạy trước `next build` trong script
`build` của web: poll `${API_URL|NEXT_PUBLIC_API_URL}/api/health` tối đa 90s
(mỗi 3s, timeout mỗi request 5s), rồi **luôn thoát 0** — cùng nguyên tắc
"thất bại thì mở" của `guard-build.mjs`: API chết thật thì `next build` tự đỏ
với lỗi thật, không có nguồn sự thật thứ hai. Luật ADR-0016 §3 "build với
API sống" giữ nguyên; script chỉ xoá đúng ca "API đang ngủ". Chọn cách này
thay cron ping/plan trả phí vì nó nằm trong repo, không tốn tiền, và cũng che
luôn CI/local khi API vừa mới bật. Bỏ qua: `SKIP_API_WARMUP=1`.

Ghi nhận, không sửa ở đây: Vercel cảnh báo `API_URL`/`REVALIDATE_SECRET` không
khai trong `turbo.json` nên bị strict env lọc lúc build — build vẫn đúng vì
client rơi về `NEXT_PUBLIC_API_URL` (framework inference cho qua), còn
`REVALIDATE_SECRET` chỉ dùng lúc runtime. Khai vào `turbo.json` là việc riêng.

## AMEND 2 — 06/09/2026 (W2, audit 05/09 cụm 6): env production phải qua superRefine, Fastify phải có timeout, container không chạy root

Bốn lỗ cùng một dạng — "prod dựa vào việc AI/người vận hành nhớ điền đúng":

**(a) superRefine production cho nhóm env deploy.** Đo được:
`BETTER_AUTH_URL`/`FRONTEND_URL`/`TRUSTED_ORIGINS`/`COOKIE_DOMAIN` không có
mặt trong superRefine — Render gửi CHUỖI RỖNG khi ô bị bỏ trống, `parseEnv`
strip rỗng nên default `http://localhost:…` kích hoạt, boot XANH với origin
localhost trên máy prod. Tệ nhất là chuỗi hệ quả cookie: Better Auth suy cờ
`Secure` CHỈ từ `baseURL.startsWith('https://')` (đo trong
`cookies/index.mjs` của BA 1.6.23) — `BETTER_AUTH_URL` rơi về default http
là cookie prod mất `Secure` + `__Secure-`. Chốt, với `NODE_ENV=production`:

- `BETTER_AUTH_URL`, `FRONTEND_URL`, mọi entry của `TRUSTED_ORIGINS` (và
  `CORS_ORIGINS` nếu set): BẮT BUỘC `https://`, CẤM localhost/127.0.0.1.
- `COOKIE_DOMAIN`: BẮT BUỘC có giá trị — thiếu nó thì cookie không có
  domain cha, www không gửi cookie sang api, đăng nhập hỏng ÂM THẦM đúng
  kiểu chỉ lộ khi user thật bấm.
- Lưới hai độc lập với env: `advanced.useSecureCookies: true` khi
  `NODE_ENV=production` — cờ Secure không còn treo vào một biến URL.

**(b) Fastify timeout.** `FastifyAdapter` của Nest ghi đè
`requestTimeout`/`connectionTimeout` về 0 (tắt luôn default 300s của Node)
— một client giữ body chậm chiếm socket VÔ HẠN trên instance free vốn kiêm
worker inline. Chốt: `requestTimeout: 30_000`, `connectionTimeout: 60_000`
trong `createFastifyAdapter()` (đủ rộng cho refund gọi provider ~10s và
webhook verify; 300s của Node mới là quá đà), assert ở `bootstrap.spec.ts`
— cùng bài học "một nguồn sự thật" của chính file đó.

**(c) Container `USER node`.** Image chạy root không vì lý do gì — Node
không cần bind port <1024. Một dòng trong Dockerfile, thu hẹp thiệt hại nếu
tiến trình bị chiếm.

**(d) `render.yaml` khai THIẾU khoá.** Blueprint là nguồn khai env duy nhất
có version control, mà `TRUST_PROXY` (không khai = default nội bộ, đúng
hiện tại nhưng ngầm), `MEDIA_GC_ENABLED`/`MEDIA_GC_GRACE_DAYS` (không khai
= bộ dọn ảnh ĐANG TẮT ở prod mà không ai quyết điều đó), `MARGIN_TAX_RATE`/
`PAYMENT_FEE_RATE`/`PAYMENT_FEE_FIXED` (báo cáo tài chính đang tính thuế/phí
= 0 ngầm định) vắng mặt. Khai đủ KEY (`sync: false`, không giá trị) để
dashboard hiện ô trống tường minh thay vì biến tàng hình. Kèm
`numInstances: 1` ghim tường minh: throttler đang in-memory per-process —
scale ngang là NHÂN trần rate-limit lên theo số instance mà không ai đổi
một dòng code; ngày nào cần >1 instance thì điều kiện tiên quyết là dời
throttle sang store chung (Redis), và dòng ghim này là chỗ nhắc.

## AMEND 3 — 07/09/2026 (vòng vá review W2): sửa (b) và (d) của AMEND 2

- **(b) Timeout — đọc lại đúng nghĩa từng option** (docs Fastify 5.12.1
  `Reference/Server.md`): `requestTimeout` là thời gian NHẬN trọn request
  (chặn slow-body), KHÔNG giới hạn handler — câu "đủ rộng cho refund gọi
  provider ~10s" ở AMEND 2 mô tả sai; `connectionTimeout` là `server.timeout`
  socket bất động, và 60s NHỎ HƠN `keepAliveTimeout` 72s mặc định → socket
  keep-alive rảnh bị đóng trước khi LB tái dùng = 502 lác đác. Chốt:
  `requestTimeout: 30_000`, `handlerTimeout: 60_000` (trần application-level
  cho cả vòng đời route, sống chung keep-alive, 503 khi quá), `connectionTimeout:
  120_000` (> keepAlive). `bootstrap.spec` canh cả ba; e2e dựng bằng
  `createFastifyAdapter()` chung với main.
- **(d) `numInstances: 1` GỠ khỏi `render.yaml`**: là khoá của scaling trả
  phí, trên instance free blueprint sync có thể từ chối; ràng buộc "throttle
  in-memory → không scale ngang" ghi bằng comment cạnh các khoá env. Bảy ô
  `sync: false` kèm comment ĐỊNH DẠNG (`true`/`false` chữ thường, tỉ lệ 0..1)
  — ô trống mời gõ `TRUE`/`10%` là zod fail → API không boot.
- **`CORS_ORIGINS`** phải chứa origin `FRONTEND_URL` + mọi entry
  `TRUSTED_ORIGINS` (xem ADR-0026 AMEND 2).
- **ConsoleDeliverer** KHÔNG che ở `development`: đó là đường duy nhất lấy
  OTP/link reset khi không có `RESEND_API_KEY`; ngoài dev vẫn che.
- onError của oRPC log kèm STACK cho lỗi không phải ORPCError (500 thật) —
  bản AMEND 2 rút về một dòng làm mất file/line.

## AMEND 4 — 14/10/2026 (G23): trần pool kết nối của mỗi tiến trình API

**Bối cảnh.** Session pooler của Supabase (Supavisor, cổng 5432) nhận tối đa
15 client cùng lúc (`pool_size: 15`); client thứ 16 nhận `EMAXCONNSESSION`,
với Prisma đó là một HTTP 500. Một tiến trình API mở HAI pool riêng: client
Prisma dùng chung (`max: 10`) và pg-boss của worker chạy kèm (không đặt `max`,
nên theo mặc định 10 của `pg.Pool`), trần lý thuyết 20 mỗi instance. Log
Supavisor đọc chỉ-đọc ngày 14/10 cho số đo, không còn là suy luận như ghi chú
G23 cũ:

- 02:01:15 UTC, một instance DUY NHẤT vừa thức, không deploy nào chạy: Prisma
  giữ 9 phiên, pg-boss 6, phiên Prisma thứ 10 bị từ chối.
- 05:12:19 UTC, cũng một instance, lúc Vercel build web sau push `89afda5`:
  Prisma 8, pg-boss 7, hai phiên Prisma kế bị từ chối; log Render ghi hai
  `DriverAdapterError: (EMAXCONNSESSION)` từ oRPC.
- Trong 24 giờ tới 05:22 UTC: 22 phiên bị từ chối trong 10 đợt, 18 của pg-boss
  (lượt poll của worker hỏng) và 4 của Prisma (request trả 500). Log của gói
  free chỉ giữ một ngày nên không đo được các lần 01/10 và 08/10.

pg-boss mở 5 tới 7 phiên lúc khởi động và mỗi khi sáu vòng poll dồn lại sau
một quãng event loop bị nghẽn (instance free chỉ có 0,1 CPU), rồi nhả về 2 sau
10 giây rảnh (`idleTimeoutMillis` mặc định của pg).

**Chốt.**

- Prisma `max: 5`, pg-boss `max: 2`, gom ở `apps/api/src/config/db-pool.ts`
  cùng ràng buộc `2 × (5 + 2) + 1 ≤ 15`. Hệ số 2 là lúc Render deploy: bản cũ
  sống tới khi bản mới qua health check (đo 14/10: chồng nhau 8 giây), và kết
  nối rảnh của bản cũ vẫn giữ phiên tới khi nó tắt. Chỗ thứ 15 chừa cho một
  phiên chạy tay (`prisma migrate deploy`). `db-pool.spec.ts` khoá ràng buộc.
- Pool của Prisma mang `application_name` `tourism-api` (pg-boss vốn tự đặt
  `pgboss`), để log Supavisor và `pg_stat_activity` tách được hai nguồn; trước
  đây phiên Prisma hiện tên mặc định `Supavisor`.

**Hệ quả.** Lúc dồn tải (prerender của build web), request xếp hàng chờ kết nối
trong pool thay vì nhận 500; trần chờ là `handlerTimeout` 60s của AMEND 3 (503),
xa hơn nhiều thời gian một câu query. Với 0,1 CPU, nút thắt là CPU chứ không
phải số kết nối. Giao dịch tương tác của Prisma chờ lấy kết nối tối đa 2 giây
(`maxWait` mặc định; khoá hoàn tiền và hai service catalog đặt 5 giây), nên một
đợt dồn tải lớn có thể làm một giao dịch hỏng P2028 thay vì 500: cùng loại rủi
ro, hiếm hơn. Đường hoàn tiền của ADR-0009 giữ 1 kết nối suốt lời gọi cổng
thanh toán, còn 4 cho phần khác. Nâng Pool Size của Supavisor trong dashboard
Supabase là cách thứ hai, không cần deploy; không chọn làm chính vì nó nằm
ngoài repo. Nếu sau này nâng thì sửa `SESSION_POOLER_CLIENT_CAP` cùng lúc.

## AMEND 5 — 14/10/2026 (G41): chạy bù ba job dọn dẹp hằng ngày khi worker khởi động

**Bối cảnh.** Worker chạy chung tiến trình với API (`WORKER_INLINE=true`, bảng
Quyết định ở trên), mà API ở gói free ngủ sau 15 phút không có request. Cron của
pg-boss 12 không bù mốc đã lỡ: mỗi lượt kiểm lịch (30 giây một lần) chỉ gửi job
khi mốc gần nhất của biểu thức cron cách hiện tại dưới 60 giây (`shouldSendIt`
trong `timekeeper.js` của pg-boss). Máy ngủ đúng phút 03:00, 03:30 hay 04:00 UTC
thì `outbox-purge`, `enquiry-retention` hay `media-gc` mất lượt của ngày ấy.
Bảng `pgboss.job` đọc chỉ-đọc ngày 14/10 cho số đo của tám ngày 07–14/10; job
`booking-sweep` mười phút một lần cho biết máy thức lúc nào:

- `outbox-purge` chạy 6/8 ngày, `enquiry-retention` 5/8, `media-gc` 3/8.
- Lượt lỡ nào cũng trùng một quãng không có `booking-sweep`, tức máy đang ngủ:
  ngày 07 và 08/10 không có lượt nào trong 02:30–04:30; ngày 09/10 máy thức tới
  03:30 (mất `media-gc`); ngày 10/10 thức tới 03:00 (mất hai job sau); ngày
  11/10 ngủ từ sau 03:50 (mất `media-gc`).
- Ba ngày đủ lượt (12–14/10) là ba ngày máy thức suốt 03:00–04:00 UTC, tức
  10–11 giờ sáng giờ Việt Nam: lượt chạy tuỳ vào việc có ai đang dùng site đúng
  giờ ấy. Ghi chú G41 ngày 10/10 còn ghi `media_garbage` có 19 mục, tất cả
  `attempts = 0`, trong đó 11 ảnh thử F18 lẽ ra đã xoá ngày 07/10.

**Chốt.**

- Mỗi lần `startWorker` chạy, sau khi tạo queue và đăng ký worker, nó gửi vào
  mỗi queue dọn dẹp hằng ngày (`outbox-purge`, `enquiry-retention`, và
  `media-gc` khi `MEDIA_GC_ENABLED`) một job bù với `singletonKey: 'catch-up'`
  và `singletonSeconds: 86400` (`worker/daily-catch-up.ts`). pg-boss đặt
  `singleton_on` của job vào 00:00 UTC của ngày gửi, và chỉ mục duy nhất
  `job_i4` trên `(name, singleton_on, singleton_key)` chặn job thứ hai cùng ngày
  kể cả khi job đầu đã chạy xong (chỉ trạng thái `cancelled` không tính); `send`
  khi ấy trả `null`. Vậy mỗi queue có nhiều nhất một lượt bù mỗi ngày UTC, ở lần
  thức ĐẦU TIÊN trong ngày, dù máy khởi động lại bao nhiêu lần.
- Job bù hẹn chạy sau 60 giây (`startAfter`) để request đánh thức máy không
  phải chia 0,1 CPU và 5 kết nối Prisma (AMEND 4) với ba lượt dọn. Lượt build
  web đi kèm (AMEND 1) prerender, tức gọi API thật, sau khi `next build` biên
  dịch xong; chưa đo mốc ấy rơi trước hay sau 60 giây, nên hai việc vẫn có thể
  trùng giờ. Chấp nhận, vì lượt dọn chỉ giữ kết nối trong từng câu truy vấn,
  không giữ suốt lượt (`media-gc` gọi Cloudinary ngoài mọi giao dịch). Job đã
  nằm trong DB, nên tiến trình có tắt trước khi tới giờ thì lần thức sau vẫn
  chạy nó.
- Khoá `catch-up` khác khoá rỗng của job do cron gửi, nên một job cron đang chờ
  không chặn job bù và ngược lại (policy `short` chỉ gộp hai job đang chờ CÙNG
  khoá).
- Gửi hỏng (DB chập chờn lúc khởi động) chỉ ghi log lỗi: tiến trình API vẫn phải
  lên, và lần thức sau hay lượt cron kế tiếp sẽ bù.
- Lịch cron giữ nguyên; ngày máy thức đúng giờ thì cron vẫn chạy như cũ.

**Hệ quả.**

- Ngày máy vừa khởi động vừa thức đúng giờ cron thì job chạy hai lần. Vô hại:
  ba job đều idempotent (xoá outbox `SENT` quá 30 ngày; ẩn danh enquiry quá
  `ENQUIRY_RETENTION_MONTHS`; `media-gc` chỉ xử lý mục đã tới hạn và gỡ mục đã
  xong khỏi hàng), và mỗi tiến trình xử lý job của một queue lần lượt từng job
  (`localConcurrency` mặc định 1).
- Mỗi lần khởi động tốn tối đa ba câu INSERT; từ lần thứ hai trong ngày cả ba bị
  chỉ mục chặn.
- Ngày không có lần thức nào thì không có lượt nào, nhưng cả ba job quét theo
  ngưỡng thời gian chứ không theo ngày, nên lần thức kế tiếp dọn hết phần tồn.
- Máy dev và CI chỉ gửi job bù khi worker chạy. `media-gc` vẫn chỉ khi có cờ
  (ADR-0035 §6), nên máy dev không bao giờ gửi job bù cho nó.

**Đã bỏ.**

- Dịch vụ ngoài gọi đánh thức API trước 03:00 UTC (cron-job.org, `schedule` của
  GitHub Actions): thêm một phụ thuộc nằm ngoài repo, và lịch của GitHub Actions
  có thể trễ nên vẫn lỡ đúng phút cron.
- Gói Render trả phí để máy không ngủ: tốn tiền, dự án ở gói free (chốt 14/10).
- Tự đọc `pgboss.job` xem hôm nay job đã chạy chưa rồi mới gửi: làm lại việc chỉ
  mục duy nhất của pg-boss đã làm, và thêm truy vấn vào schema của thư viện.
