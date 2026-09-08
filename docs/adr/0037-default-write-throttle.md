# ADR-0037 — Trần ghi MẶC ĐỊNH: ThrottlerGuard toàn cục, route ghi mới sinh ra đã có trần

- **Ngày:** 2026-09-06
- **Trạng thái:** Chấp nhận (đợt W2 `fix/auth-infra-hardening`, ADR đi trước code)
- **Liên quan:** [ADR-0003](0003-auth-fail-closed.md) (khuôn mẫu fail-closed
  toàn cục mà ADR này áp lại cho throttle), `config/throttle.ts` (nơi khai sinh
  mô hình rate limit opt-in — ADR-0010 KHÔNG có mục throttle, tham chiếu cũ ở
  đây là sai, sửa ở AMEND 1), ADR-0029 AMEND 6 (ghi nợ "cân nhắc guard
  toàn cục"), bản rà 05/09 cụm 2/6 (`config/throttle.ts` "cố ý opt-in" bị điểm
  danh là lưới thiếu).

## Bối cảnh

Rate limit hiện là OPT-IN từng route: controller tự gắn
`@UseGuards(ThrottlerGuard | AuthedWriteThrottlerGuard)` +
`@Throttle({ default: … })`. Sau W1, đếm được **11 cặp decorator lặp** (9 ở
bề mặt khách: bookings create/checkout/cancel/cancelPending, reviews
create/update, wishlist.set, avatar, delete account; 2 ở admin: refund,
cancellations.decide) — và lịch sử của chính repo chứng minh mô hình opt-in
thua: `bookings.create/checkout` (mỗi lần gọi = một session provider THẬT)
sống KHÔNG trần từ P2 tới W1, vì "nhớ gắn decorator" không phải là một cơ
chế. Đây đúng dạng lỗ mà ADR-0003 đã xử cho auth: mặc định phải an toàn,
route mới quên khai thì hành vi phải là CÓ lưới chứ không phải không.

## Quyết định

Một guard toàn cục (`APP_GUARD`, chạy SAU AuthGuard để đọc được
`sessionUser`) áp trần cho MỌI route theo bảng:

| Route | Trần | Bucket |
| --- | --- | --- |
| GET/HEAD/OPTIONS | **không đếm** | — |
| non-GET, có session | `AUTHED_WRITE_THROTTLE` (20/60s) | `user.id` |
| non-GET, `@Public()` | `PUBLIC_WRITE_THROTTLE` (5/60s) | IP |
| `@Throttle({ default: X })` per-route | **X thắng mặc định** | theo guard |
| `@SkipThrottle()` | miễn — ngoại lệ TƯỜNG MINH, phải kèm lý do trong comment | — |

- **GET không đếm** — đường đọc công khai (catalogue) có mô hình dùng khác
  hẳn và đã có kết luận riêng ở bản rà (cache-control + PUBLIC_READ, đợt
  W4); đếm chung là khoá nhầm người thật, đúng lý do ADR-0010 từng chọn
  opt-in. ADR này chỉ đảo mặc định cho đường GHI.
- **Bucket theo `user.id` cho route đã auth** (fail-closed như
  `AuthedWriteThrottlerGuard` W1: non-GET không session mà không `@Public()`
  → 401): theo IP thì NAT bị khoá oan còn pool IP xoay lách được.
- **Trần riêng đang có GIỮ NGUYÊN, khai per-route qua `@Throttle`**:
  `WEBHOOK_THROTTLE` (600/60s theo IP — webhook là `@Public()` nhưng
  delivery thật burst theo dải IP hẹp của provider, 5/60s giết nó),
  `SIGN_UPLOAD_THROTTLE` (20/60s), và trần riêng cho `/api/auth/*`
  (AuthController — W2 mục 3). Guard toàn cục chỉ là ĐÁY.
- **11 cặp decorator lặp bị GỠ** — chúng nay là bản chép của mặc định.
  Route nào cần khác mặc định thì decorator per-route là nơi khai; giống
  mặc định mà vẫn khai là hai nguồn sự thật.
- **Nghiệm thu bằng int test đúng bản chất lưới**: một route ghi thử KHÔNG
  khai gì (dựng trong test module) vẫn bị trần chặn ở request thứ N+1 —
  test này canh cái "mặc định", không phải canh từng route.

## Hệ quả

- Route ghi mới từ nay có trần từ lúc sinh ra; quên là an toàn, nhớ mới
  phải hành động (`@SkipThrottle`/`@Throttle` riêng) — đảo đúng chiều.
- Webhook (`@Public()` + non-GET) BẮT BUỘC giữ `@Throttle` webhook riêng —
  rơi về 5/60s là tự tay bóp delivery thật; int test webhook hiện có canh.
- Storage vẫn in-memory per-process — ghim `numInstances: 1` (ADR-0024
  AMEND 2); guard toàn cục không đổi ràng buộc đó, chỉ mở rộng diện phủ.
- `ThrottlerModule.forRoot` vẫn khai default `PUBLIC_WRITE_THROTTLE`;
  logic chọn trần authed/public sống trong guard (một chỗ), không rải cấu
  hình theo module.

## Phương án đã cân nhắc rồi loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ opt-in, thêm lint/checklist "route ghi phải có throttle" | Checklist là trí nhớ mặc đồng phục; đã thua ở CHANGELOG (luật 13, 8 merge liên tiếp) và ở chính bookings.create. Máy canh được thì đừng giao cho người. |
| Trần toàn cục cho CẢ GET | Khoá nhầm người đọc thật (một trang tour = nhiều fetch), trong khi rủi ro đường đọc là cạn pool DB — thuốc đúng của nó là cache + trần đọc riêng (W4), không phải trần ghi. |
| Đếm mọi route theo IP cho đơn giản | Đã bác từ W1: NAT/proxy chung IP bị khoá oan theo nhau, pool IP xoay vòng lách sạch — trần theo IP trên route authed là trần giấy. |
| Store chung (Redis) ngay đợt này | Đổi hạ tầng deploy sát freeze 15/10 chỉ để phục vụ scale ngang chưa tồn tại (`numInstances: 1`). Ghi điều kiện tiên quyết ở ADR-0024 AMEND 2 là đủ. |

## AMEND 1 — 07/09/2026 (vòng vá review W2): storage keyed theo key, nhận diện bằng metadata, bucket auth theo path, carve-out admin

1. **Bug thư viện kích hoạt bởi chính ADR này.** `ThrottlerStorageService`
   của @nestjs/throttler 6.5.0 giữ timer giảm-hit theo TÊN throttler
   (`'default'`); một key hết block gọi `clearExpirationTimes('default')` xoá
   timer của MỌI key → `totalHits` của mọi user/route khác đóng băng. ADR này
   gom mọi route ghi vào đúng tên đó và bật block 60s thật nên nhánh lỗi chắc
   chắn chạy. Thay bằng `KeyedThrottlerStorage` (cửa sổ trượt theo key, không
   timer, không gì dùng chung); unit spec tái hiện đúng ca.
2. **"Chưa khai gì" đọc từ metadata `@Throttle`, không so số.** Bản đầu nhận
   diện default bằng `limit === 5 && ttl === 60000` — route cố ý ghim đúng
   5/60s cho cả người đã đăng nhập bị nâng nhầm lên 20. Nay đọc
   `THROTTLER:LIMITdefault` qua reflector.
3. **Route `@Public()` không bao giờ có `sessionUser`** (AuthGuard thoát sớm
   trước khi gắn) — bảng luật ghi rõ: bề mặt public đếm theo IP kể cả khi
   người gọi đang đăng nhập; nhánh 401 trong guard là đáy không test tới được.
4. **Wildcard = bucket theo pathname.** `AuthController` là một handler cho
   cả cụm `/api/auth/*`; `AUTH_THROTTLE` 60/60s theo IP từng là MỘT bucket cho
   sign-in/sign-up/OTP/sign-out — CGNAT chạm 60/phút là khoá đăng nhập cả pool.
   Guard nối pathname vào key khi route là wildcard.
5. **Carve-out admin.** `ADMIN_WRITE_THROTTLE` 60/60s theo user cho role ADMIN
   trên `/api/admin/*` — moderator duyệt 21 review/phút hay retry cả loạt
   outbox là mức dùng hợp lệ.
6. `SIGN_UPLOAD_THROTTLE` gỡ: trùng từng byte với mặc định (hai nguồn sự thật);
   spec upload-signing set `remoteAddress` thật (bản đầu chỉ set XFF nên guard
   miễn loopback và test vô nghĩa).
7. Trần Better Auth (3/10s per path) vẫn tắt ở test và ở dev BA trả localhost
   cho mọi request (`ip.mjs` `isDevelopment`), tức nhánh `trustedProxies` CHỈ
   chạy ở production — ghi nợ: xác minh hình dạng XFF của ingress Render bằng
   một request thật sau deploy (checklist runbook), không có test nào canh được.


## AMEND 2 — 07/09/2026 (đợt W4): trần ĐỌC công khai `PUBLIC_READ_THROTTLE` — GET `@Public()` đếm bucket `read`

Bản gốc cố ý để GET ngoài trần và trỏ sang W4 ("cache-control + PUBLIC_READ").
Nay trả nợ đó:

- **`PUBLIC_READ_THROTTLE = { limit: 300, ttl: 60_000 }` theo IP** cho GET
  trên route `@Public()` — bucket throttler TÊN RIÊNG `read` (không đụng
  bucket `default` của đường ghi; `KeyedThrottlerStorage` đã theo key nên
  hai bucket sống cạnh nhau).
- **GET có session KHÔNG đếm** — khách đã đăng nhập là đối tượng của trần
  GHI theo user; SSR của web/admin gọi GET bằng cookie forward từ egress IP
  dùng chung (Vercel), đếm theo IP là cả site chia nhau một bucket (đúng bài
  học `AUTH_THROTTLE` W2). GET admin cũng không đếm (cùng lý do + đã có
  RBAC).
- **Con số 300/60s:** `/tours` + detail + related ≈ 6 call một trang view →
  ~50 trang/phút một IP — người thật không tới, script cào tuần tự thì chạm.
  Trần này là lưới chống cạn pool DB (10 connection), không phải chống đọc.
- **Cách thi công:** MỞ RỘNG `DefaultWriteThrottlerGuard` thành
  `DefaultThrottlerGuard` (đổi shouldSkip: GET public đi vào đếm với trần
  `read`) — KHÔNG thêm guard thứ hai: hai guard cùng kế thừa ThrottlerGuard
  là hai lượt đếm/hai storage cho một request, và thứ tự APP_GUARD thành
  load-bearing vô hình. Non-GET giữ nguyên bảng luật gốc + AMEND 1; miễn
  loopback ngoài production giữ nguyên (int suite tự gọi mình).
- **`Cache-Control` cho đọc công khai là lớp GIẢM TẢI song song** (ADR-0016
  phía web đã ISR; đây là lớp cho browser/proxy đứng trước Render):
  interceptor `PublicCacheInterceptor` gắn `public, s-maxage=60,
  stale-while-revalidate=300` CHỈ cho GET catalog/posts/site-media — KHÔNG
  cho route mang session (`/api/auth`, `/api/account`, wishlist…), cache
  công khai một response cá nhân hoá là rò dữ liệu qua proxy.

## AMEND 3 — 08/09/2026 (vòng vá review W4): chế độ `log` cho trần đọc, miễn qua khoá nội bộ, bucket đọc tách bằng KEY

AMEND 2 giả định "GET có session không đếm" phủ được SSR của web — sai ở đúng
đường quan trọng nhất: web KHÔNG forward cookie cho GET catalog (`tours.ts`,
`posts.ts`, `site-media.ts` là fetch ISR không session), nên build Vercel (61
route prerender × 2–6 call từ MỘT egress IP) rơi trọn vào bucket 300/60s và
`generateStaticParams` không settle → 429 là build đỏ. Thêm nữa TRUST_PROXY
trên Render chưa ai đo (nợ W2): nếu `req.ip` là IP proxy thì cả internet chia
một bucket. Chốt:

- **`PUBLIC_READ_THROTTLE_MODE` (env) — mặc định `log`:** đếm như thường,
  chạm trần thì WARN một dòng mỗi IP mỗi cửa sổ và CHO QUA; `enforce` mới
  trả 429. Chuyển bằng env sau khi đo, không sửa code. Int test chạy `enforce`
  để probe thấy 429 thật.
- **Phép đo trước khi `enforce`:** `GET /health` trả thêm `clientIp` (`req.ip`
  sau `trustProxy`) và `forwardedFor` (XFF thô). Gọi từ hai mạng khác nhau
  phải ra hai `clientIp` khác nhau và bằng IP công khai của mình; trùng nhau
  (= IP proxy) là TRUST_PROXY sai và không được bật enforce.
- **`INTERNAL_READ_KEY` + header `x-internal-read-key`:** web SSR/build/ISR
  gắn header CHỈ phía server (`withInternalReadKey`, không NEXT_PUBLIC —
  key lộ ra là mọi người đều "nội bộ"); API so timing-safe và miễn bucket
  ĐỌC (không miễn ghi). Khai key ở render.yaml, turbo build env, hai
  `.env.example`; giá trị phải trùng hai bên. Thiếu env → không ai được miễn.
- **Bucket đọc tách bằng KEY (`throttler:read:<ip>`), tên throttler GIỮ
  `default`:** thư viện đặt tên header theo tên throttler — bucket tên `read`
  từng phát `Retry-After-read` thay vì `Retry-After`; key vẫn một cho mọi
  route đọc theo IP (AMEND 2 tính con số theo TRANG).
- **GET public trên route KHAI `@Throttle`** (AuthController wildcard,
  `get-session`) được MIỄN hẳn — không thi hành trần đã khai cho GET (AUTH_THROTTLE
  cố ý chỉ đếm non-GET); comment "chính sách riêng thắng" của bản thi công
  tả sai hành vi này.
- **`KeyedThrottlerStorage` có trần:** quét bucket rỗng/hết block mỗi 1 000
  lượt, trần 50 000 bucket, hết chỗ đuổi 10% cũ nhất — bản AMEND 1 không bao
  giờ xoá key (mỗi IP lạ một entry vĩnh viễn).
- **`PublicCacheInterceptor`:** `@SkipPublicCache()` cho `catalog.health`
  (probe cache 60 giây là probe mù); `reviews.listByTour` cũng mang
  Cache-Control công khai như catalog.
