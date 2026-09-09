# ADR-0026 — P4 Admin: app riêng `apps/admin`, dùng chung session Better Auth qua subdomain

- **Ngày:** 2026-08-20
- **Trạng thái:** Chấp nhận (user duyệt 20/08; P4a merge `a59381b` cùng ngày)
- **Liên quan:** [khảo sát admin Nexora 20/08](../analysis/2026-08-20-admin-parity-nexora.md)
  (đầu vào chính), [ADR-0017 §4](0017-web-session-better-auth.md) (cookie
  cùng registrable domain), [ADR-0024](0024-deploy-targets.md) (subdomain
  `admin.` đã chừa), [ADR-0021](0021-media-write-surface.md) (nợ media
  garbage "để P4"), [ADR-0001](0001-tech-stack.md).

## Bối cảnh

P3b + deploy v1 đã khép; mảng lớn duy nhất còn thiếu so với Nexora là
back-office (bản cũ: 40 trang, 18 vùng, ~60 endpoint admin — xem khảo sát).
User chốt 20/08: app admin **riêng**, thứ tự thi công **setup khung trước,
phân tích từng vùng sau**.

## Quyết định

### 1. Hình hài: app riêng `apps/admin`, KHÔNG phải khu `/admin` trong web

- Next.js **16.3.0** + React **19.2.4** — đúng bản workspace đang ghim.
  KHÔNG đuổi "mới nhất tuyệt đối": override MỘT React cho cả monorepo là
  quyết định đã đo (27/07 — hai React trong store làm Vitest `dispatcher
  null` hàng loạt); nâng React là việc đồng bộ toàn workspace, không thuộc
  P4, và freeze 15/10 đang tới.
- Deploy: Vercel project riêng, root `apps/admin`, domain
  `admin.nexora-travel.agency` (đã chừa từ bước 1 deploy v1). Dev chạy cổng
  **3002** (web 3000 · API 3001).
- Vì sao app riêng thắng `/admin`-trong-web: tách bundle/deploy (đổi admin
  không rebuild site khách), tách bề mặt tấn công (site khách không mang
  code admin), giữ nguyên kiến trúc đã chứng minh ở Nexora, và cookie chung
  subdomain đã sẵn nên chi phí auth — lý do lớn nhất để gộp — không còn.

### 2. Auth: dùng CHUNG hệ Better Auth hiện có, không dựng gì mới

- Session đọc qua cookie `.nexora-travel.agency` (crossSubDomainCookies đã
  bật trên prod — ADR-0024); dev cùng `localhost` khác cổng nên cookie tự
  chung, không cần cấu hình thêm.
- Middleware admin app: không có session → redirect `/login?redirect=…`
  (trang login riêng của admin, gọi cùng `authClient` trỏ API); có session
  nhưng role ≠ ADMIN → chặn bằng màn "không đủ quyền" (không im lặng).
- Phía API giữ nguyên `AuthGuard` + `@Roles(UserRole.ADMIN)` đang chạy;
  endpoint admin mới đều đi cửa này. `TRUSTED_ORIGINS` (API, Render) phải
  thêm `https://admin.nexora-travel.agency` khi deploy.

### 3. Nền UI & kit

- Tái dùng `@tourism/tokens` + `@tourism/ui` (shadcn) + vocabulary motion
  của web — admin không mở hệ thẩm mỹ mới, chỉ mở **CRUD kit** (khối hạ tầng
  lớn nhất, học cấu trúc kit 19 component của bản cũ): table shell (TanStack
  Table qua pattern data-table shadcn) · facet filter · pagination server ·
  columns menu · row actions · media picker · form kit.
- Chart dashboard: recharts (qua shadcn charts) — cùng lib bản cũ đã dùng ổn.
- Test: Vitest + Testing Library, TDD trên logic thuần (luật #4), theo nếp
  per-spec IntersectionObserver stub của web (ADR-0014).

### 4. API: contract-first như mọi phase

Endpoint admin mới khai trong `@tourism/contract` nhóm `admin.*` (đã có sẵn
bookings/cancellations/reviews), triển khai theo vùng — KHÔNG viết REST rời
ngoài contract. Vùng nào đụng schema mới (ví dụ ghi catalog) thì migration
đi trong vòng spec của vùng đó.

### 5. Thứ tự thi công (chốt với user 20/08)

1. **P4a — scaffold**: dựng `apps/admin` (Next 16.3 + tokens/ui/biome/vitest/
   turbo) + **gate đăng nhập ngay từ trang trắng đầu tiên** + shell (sidebar
   18 vùng, nav-user) + deploy sớm lên `admin.` để đường ống sống từ đầu.
2. **P4b — CRUD kit** trên 3 vùng API ăn sẵn: bookings · cancellations ·
   review moderation (kit trưởng thành bằng vùng thật, không dựng chay).
3. **P4c — vận hành**: outbox (nhu cầu chứng minh 20/08) · payment events ·
   enquiries + notes · subscribers.
4. **P4d — dashboard** (admin-stats + chart).
5. **P4e — catalog CRUD** (nặng nhất: tours/departures/categories/
   destinations/posts + media picker).
6. **P4f — media library + garbage reconcile (trả nợ ADR-0021) + appearance
   + users**.
   Mỗi vùng một vòng spec nhỏ → demo → user duyệt → thi công (nếp P3b).

## Hệ quả

- Monorepo thêm một app Next (turbo/CI thêm pipeline tương ứng); CI build
  admin cần API sống giống web (ADR-0016 §3 áp dụng lại) — cân nhắc trong
  spec P4a.
- Preview deploy admin không đăng nhập được (origin động) — cùng hạn chế đã
  chấp nhận ở web (F3).
- Bản cũ có trang mà controller thiếu endpoint (posts KHÔNG có `@Post`
  create) — v2 sẽ làm ĐỦ ở vùng posts, ghi rõ trong spec P4e.
- SEC-1 auto-promote (ADMIN_EMAILS) giữ nguyên là đường lên admin duy nhất
  cho tới vùng users (P4f) — lúc đó mới quyết `PATCH role` thủ công có tồn
  tại song song không.

## Lựa chọn đã bỏ

- **Khu `/admin` trong apps/web**: rẻ lúc đầu, nhưng trộn bundle + deploy +
  bề mặt tấn công; lợi thế cookie chung của nó nay không còn là lợi thế
  riêng (subdomain đã chung cookie).
- **React/Next "mới nhất tuyệt đối"**: xem §1 — trái override một-React và
  sát freeze.
- **Template admin dựng sẵn (shadcn admin kit, refine.dev…)**: kéo hệ quản
  lý state/data riêng vào monorepo đang thuần oRPC + fetch; kit cũ của
  Nexora đã chứng minh đủ và ta có nó làm tham chiếu chi tiết.

## AMEND 1 — 06/09/2026 (W2, audit 05/09 cụm 8): rủi ro cookie cha, blast radius XSS, tách CORS khỏi TRUSTED_ORIGINS, SEC-1 tường minh, runbook thu hồi admin

§2 ở trên chỉ ghi LỢI của cookie cha `.nexora-travel.agency`. Đợt rà 05/09
đo được cái giá, và ADR phải ghi cả hai mặt:

### A. Rủi ro cookie cha — subdomain mồ côi

Cookie `domain=.nexora-travel.agency` được browser gửi tới MỌI subdomain,
kể cả cái ta không kiểm soát: một record DNS mồ côi (CNAME trỏ dịch vụ đã
trả — đúng kịch bản Nexora cũ pause trên chính domain này) là kẻ chiếm được
subdomain đó hứng nguyên cookie session, và ngược lại có thể GHI đè cookie
(cookie tossing) để fixation. Hệ quả thêm: không dùng được tiền tố
`__Host-` (đòi không có Domain attribute). Chấp nhận có điều kiện:

- **Kỷ luật DNS là một phần của kiến trúc**: chỉ ba record `www`/`api`/
  `admin` được tồn tại; record hết dùng phải GỠ ngay trong cùng thao tác
  gỡ dịch vụ. Kiểm kê DNS thuộc checklist deploy.
- `advanced.useSecureCookies: true` (W2, xem ADR-0024 AMEND 2) cho tiền tố
  `__Secure-` — không bằng `__Host-` nhưng chặn ghi đè từ kênh không HTTPS.
- Phương án thay thế (token bearer riêng cho admin, hoặc domain admin tách
  hẳn) bị loại: phá §2 "dùng chung hệ Better Auth, không dựng gì mới" với
  chi phí lớn hơn rủi ro còn lại sau hai lớp trên.

### B. Blast radius: một XSS ở www = 25 endpoint admin

Ba mảnh cộng hưởng: cookie cha (browser gửi cookie cho `api.` bất kể script
chạy ở origin nào trong domain) + `TRUSTED_ORIGINS` kiêm luôn CORS allowlist
(www được phép gọi MỌI path của API, kể cả `/api/admin/*`) + web chưa có CSP
(việc của W3). Nghĩa là MỘT XSS trên site khách, khi nạn nhân là admin, gọi
được trọn 25 procedure admin — kể cả refund — bằng chính cookie của nạn
nhân. Cắt tầng CORS ngay ở W2 (CSP là nhát cắt gốc, W3):

- **Tách `CORS_ORIGINS` khỏi `TRUSTED_ORIGINS`.** Hai biến này trả lời hai
  câu hỏi khác nhau — "origin nào được Better Auth tin ở bước CSRF check"
  (TRUSTED_ORIGINS, cần cả www lẫn admin vì cả hai đăng nhập qua
  authClient) và "origin nào được browser gọi API cross-origin" (CORS) —
  từng dùng chung một danh sách chỉ vì tiện. `CORS_ORIGINS` mới, optional,
  **default = TRUSTED_ORIGINS** để deploy hiện tại không đổi hành vi.
- **`/api/admin/*` KHÔNG phát CORS cho bất kỳ origin nào.** Đo được: admin
  app gọi API HOÀN TOÀN từ phía server (client oRPC của admin chỉ có đường
  server, cookie forward qua `next/headers` — spec P4b §2.3), browser của
  admin chỉ chạm `/api/auth/*` lúc đăng nhập. Tức KHÔNG tồn tại client
  browser hợp lệ nào gọi `/api/admin/*` cross-origin — CORS cho vùng đó là
  cửa mở không ai đi, chỉ kẻ tấn công dùng. @fastify/cors nhận delegator
  theo request: path `/api/admin` → `origin: false`. Giới hạn thành thật:
  CORS chặn ĐỌC response và preflight của JSON write; một simple-request
  không preflight vẫn THI HÀNH tới server (side effect) — nhưng mọi write
  admin là oRPC JSON (content-type application/json → có preflight), nên
  nhát cắt này phủ đúng bề mặt thật. CSP ở W3 mới là gốc.

### C. SEC-1 thành mục tường minh — bốn điều kiện chấp nhận

`ADMIN_EMAILS` auto-promote (§Hệ quả nhắc tên nhưng chưa từng ghi điều
kiện) được chấp nhận là đường LÊN admin duy nhất khi và chỉ khi cả bốn vế
sau còn đúng — vế nào gãy thì phải mở lại quyết định:

1. Promote CHỈ chạy sau `emailVerified` (hook `afterEmailVerification` +
   reconcile lúc boot) — sở hữu email được chứng minh, không phải khai.
2. `requireEmailVerification: true` + `autoSignIn: false` còn hiệu lực
   (AMEND §6 của ADR-0017) — chưa verify thì thậm chí không có session.
3. `role` là field `input: false` — không đường nào từ client set được.
4. Hộp thư trong `ADMIN_EMAILS` do người vận hành kiểm soát thật; biến này
   chỉ sống trong env server (Render dashboard), không log, không client.

Nếu bật Google OAuth ở prod: phải kèm `disableImplicitLinking` và xét
promote ở hook social — điều kiện 1 hiện chỉ đo đường OTP.

### D. Runbook thu hồi quyền/phiên admin (SQL — chưa có UI)

Đường HẠ quyền chưa tồn tại (chỉ promote; vùng users là P4f) mà cookie sống
7 ngày không cookieCache — nghĩa là "admin nghỉ việc/lộ máy" hiện xử bằng
tay. Ghi runbook ở đây để nó là THỦ TỤC chứ không phải ứng biến; chạy trên
Supabase SQL editor (dev/prod chung khuôn):

```sql
-- 1. Hạ quyền (thay email; giữ nguyên nếu chỉ cần đá phiên):
UPDATE users SET role = 'CUSTOMER' WHERE email = 'ai-do@example.com';
-- 2. Thu hồi MỌI phiên của user đó — cookie đang cầm chết ngay lượt request sau:
DELETE FROM sessions WHERE user_id = (
  SELECT id FROM users WHERE email = 'ai-do@example.com'
);
-- 3. Nếu hạ quyền: gỡ email khỏi ADMIN_EMAILS trên Render TRƯỚC khi chạy (1),
--    không thì lần verify/reconcile sau promote lại.
```

Bất biến phải giữ khi P4f dựng UI: không tự hạ chính mình, không hạ admin
cuối cùng, hạ quyền luôn kèm thu hồi phiên.

## AMEND 2 — 07/09/2026 (vòng vá review W2): CORS chỉ giấu response — chặn THI HÀNH ở tầng request

AMEND 1 §B viết "mọi write admin là oRPC JSON → có preflight, nên nhát cắt CORS
phủ đúng bề mặt thật" — **nói quá**: content-type do KẺ GỬI chọn, không do app.
`rawBody: true` làm Nest đăng ký parser `application/x-www-form-urlencoded`
toàn cục, oRPC đọc `req.body` đã parse, contract nhận chuỗi → một XSS ở www
gửi `fetch(..., { mode: 'no-cors', credentials: 'include', body:
'amount=1200&reason=x' })` là simple request KHÔNG preflight và refund CHẠY
THẬT bằng cookie cha của nạn nhân; `origin: false` chỉ giấu response. Chốt:

- Hook `onRequest` ở `configureHttp`: mọi request GHI (non-GET) ngoài
  `/api/auth/*` (Better Auth tự CSRF) và `/api/webhooks/*` (provider gửi JSON)
  có content-type ≠ `application/json` → **415** trước cả AuthGuard. JSON luôn
  bị preflight, và preflight vùng admin đã bị `origin: false` chặn — hai lớp
  mới khép kín.
- Vùng admin thêm: `Sec-Fetch-Site: cross-site` → **403** (browser hiện đại
  gửi header này, script không xoá được).
- So path bỏ query (`/api/admin?x` từng trượt).
- `CORS_ORIGINS` (nếu set) phải chứa origin của `FRONTEND_URL` và mọi entry
  của `TRUSTED_ORIGINS` — superRefine canh, vì ô trống trên Render mời điền
  mỗi www → admin không đăng nhập được, lỗi chỉ hiện ở console browser.

CSP phía web (W3) vẫn là nhát cắt gốc cho XSS; hai lớp trên là để một XSS
không còn gọi được đường ghi admin dù có cookie.

## AMEND 3 — 07/09/2026 (đợt W3, audit 05/09 cụm 8): CSP nonce, noindex, boundary 403, luật proxy, origin https

### A. CSP nonce + `'strict-dynamic'` qua proxy — admin nhận bản nghiêm nhất

Admin đã dynamic từng request và là đích giá trị nhất → CSP nonce khả thi và
đáng làm (khác web SSG/ISR — so sánh và danh sách directive đầy đủ ở
[ADR-0038 §3](0038-web-shell-security-headers.md)). `proxy.ts` sinh nonce
16 byte base64 mỗi request, đặt CSP vào CẢ request header lẫn response (nếp
guide Next: Next đọc nonce từ request header để gắn vào script của chính nó).
Kèm `X-Robots-Tag: noindex, nofollow` toàn admin + `app/robots.ts` disallow
`/` — back-office không có gì cho crawler, root layout đã `robots.index:false`
nhưng header + robots.txt phủ cả response không phải HTML metadata.

### B. `error.tsx` nhận 403 — admin bị thu hồi quyền thấy đúng cửa

Audit cụm 8 (Thấp): layout gác không re-render khi điều hướng MỀM → admin bị
thu hồi role giữa phiên thấy `error.tsx` chung ("Try again" vô vọng) thay vì
`/not-authorized`. Chốt: tầng client oRPC của admin gắn
`digest = 'ADMIN_FORBIDDEN'` lên lỗi HTTP 403 (interceptor của link — MỘT
chỗ cho mọi đường đọc/ghi; Next chuyển `digest` sang client boundary kể cả
production), `error.tsx` thấy digest ấy → `router.replace('/not-authorized')`.
Server action ghi đã classify 403 thành copy riêng từ trước — digest không
đổi hành vi các đường đó.

`(admin)/layout.tsx` thôi hard-code path `'/'`: proxy gắn `x-pathname` vào
request header (đằng nào cũng đã sửa request header cho nonce), layout đọc
qua `headers()` để nhánh login redirect mang đúng path — fallback `'/'` khi
header vắng (gọi không qua proxy).

### C. Luật: proxy KHÔNG phải biên quyền

Ghi thành luật ở cả hai `proxy.ts` (web + admin): proxy chỉ chặn sớm cho đỡ
round-trip; mọi quyết định quyền thật nằm ở layout gác + API guard. Audit đã
chỉ: POST `Next-Action` tới path public `/login` vẫn chạy action (API trả
401, không leo thang được) — chấp nhận, vì biên quyền thật không nằm ở proxy.
Đổi lại, admin có `proxy.spec.ts` (chép khuôn web) canh redirect thiếu cookie,
public path, và CSP nonce ở cả request lẫn response.

### D. `resolveApiOrigin` admin: parse `new URL()`, production ÉP `https:`

Audit cụm 8 (Thấp): `API_URL` sai trên Vercel (http, host lạ) = mọi request
server-side admin forward cookie phiên sang origin đó — exfiltrate cookie
admin. Chốt: `resolveApiOrigin` parse bằng `new URL()` (chuỗi rác → throw
ngay lúc boot thay vì fetch lỗi khó hiểu), production mà scheme khác
`https:` → throw. Hệ quả tự nhiên: production quên khai env → fallback
`http://localhost:3001` cũng chết ở phép ép https — fail-fast trọn gói.

## AMEND 4 — 07/09/2026 (vòng vá review W3): robots admin mở crawl, header proxy→app chỉ định tuyến, cổng gác ép role, origin theo phía

### A. `robots.txt` admin KHÔNG disallow — để crawler đọc được `X-Robots-Tag`

AMEND 3 §A viết "header + robots.txt phủ cả response" — hai lớp không cộng
dồn mà **loại trừ nhau**: crawler tuân `Disallow: /` không bao giờ gửi
request nên không bao giờ thấy `noindex`; URL bị chặn vẫn lên SERP dạng
title-only nếu có backlink (Google ghi rõ). Đúng lý lẽ `apps/web/src/lib/
robots.ts` cùng đợt. Chốt: admin `robots.txt` = `allow: '/'`, giữ
`X-Robots-Tag: noindex, nofollow` trên mọi response qua proxy; crawler gõ
`/bookings` → 307 `/login` (mang noindex) → thật sự bị loại khỏi chỉ mục.

### B/C. Header proxy→app CHỈ mang dữ liệu định tuyến; cổng gác ép role tường minh

- `decideAdminAccess` trả `allow` cho path public TRƯỚC khi kiểm role; layout
  gác nay đưa `x-pathname` từ header vào — Next **không** xoá header client
  gửi (danh sách override dựng từ toàn bộ `request.headers`), chốt chặn duy
  nhất là proxy `.set()` ghi đè. Chốt: (1) luật viết cho §C — *header
  proxy→app chỉ mang dữ liệu định tuyến/hiển thị (`x-pathname`, `x-nonce`);
  mọi phán quyết quyền tính lại ở layout từ session thật*; (2) layout ép
  `session.role === 'ADMIN'` tường minh, không suy từ `decision.kind`;
  (3) `proxy.spec.ts` có ca header `x-pathname` thù địch bị ghi đè;
  (4) `x-pathname` kèm query để `?redirect=` giữ bộ lọc.
- Đường 403 → `/not-authorized`: interceptor gắn digest được test qua chính
  link (`createAdminLink({ fetch })` bơm 403 giả); nhánh digest→route tách
  thành `lib/error-route.ts` thuần có spec (vitest không quét `src/app/**`).

### D. `resolveApiOrigin` theo PHÍA, message nêu tên biến, loopback miễn https, kiểm lúc build

- Tách `serverApiOrigin`/`browserApiOrigin` như web: `connect-src` của CSP
  (proxy) và Better Auth client dùng `browserApiOrigin()` — một nguồn.
- Production thiếu biến → throw **nêu tên biến** trước, rồi mới ép https
  (câu "must use https… got http://" của AMEND 3 che mất nguyên nhân thật là
  thiếu biến). Http chỉ được cho loopback (CI/gate/`next start` thử tay) —
  câu "fallback localhost cũng chết ở phép ép https" của §D không còn đúng.
- "Chết ngay lúc boot" của §D đã sai từ khi các caller thành lười (`14798024`):
  nay `next.config.ts` gọi `browserApiOrigin()` một lần lúc **build** để lỗi
  env nổ ồn ào ở build; `lookupServerSession` tính origin NGOÀI `try` — nuốt
  lỗi cấu hình thành `unreachable` từng biến sai env thành vòng lặp `/login`
  không lời giải thích.

## AMEND 5 — 09/09/2026 (đợt Dependabot 26 alert): `/_next/image` của admin đóng hẳn — cùng lỗ mà ADR-0016 AMEND 2 §7 đã đóng cho web

### Bối cảnh: advisory Next AVIF làm lộ một bề mặt có sẵn

Đêm 08/09 Next công bố `GHSA-2xp9-vwfh-vxw4` (CVSS 9.5) — RCE trong Image
Optimization API khi xử lý AVIF, gốc ở libheif mà `sharp` dùng. Rà theo
advisory thì thấy `apps/web` an toàn (loader custom → `/_next/image` trả 404,
đúng AMEND 2 §7 của ADR-0016), nhưng **`apps/admin` thì không** — và đó là bề
mặt duy nhất trong cả 26 alert mà code của dự án thật sự phục vụ một đường
dính.

Ba dữ kiện đo được, cộng lại mới thành vấn đề:

1. `next.config.ts` khai `remotePatterns` với `hostname: 'res.cloudinary.com'`,
   `pathname: '/**'` và để `loader` mặc định → optimizer BẬT.
2. `proxy.ts` matcher `'/((?!_next/static|_next/image|favicon.ico).*)'` **cố ý**
   loại `_next/image` khỏi cổng gác → optimizer chạy **vô danh**, không đăng nhập.
3. Admin **không import `next/image` ở bất kỳ đâu**: avatar nav-user là
   `AvatarImage` của `@tourism/ui`, thumbnail review cố ý `<img>` trần vì
   next/image ném khi src ở host lạ. Nghĩa là toàn bộ khối `images` chỉ có đúng
   một tác dụng: mở endpoint.

`pathname: '/**'` trên một host dùng chung là điểm đau riêng: `res.cloudinary.com`
đa-tenant nên tài khoản Cloudinary của **bất kỳ ai** cũng khớp — chính docs
Vercel khuyên thêm account id vào pathname khi không sở hữu hostname.

### `formats: ['image/webp']` không phải hàng rào

Dễ kết luận sai ở đây. Đọc `image-optimizer.js`: `BYPASS_TYPES` gồm SVG, ICO,
ICNS, BMP, JXL, HEIC — **không có AVIF**; và nhánh chọn `contentType` đưa
nguyên buffer AVIF vào `optimizeImage()`. `formats` điều khiển định dạng **RA**,
không chặn giải mã AVIF **VÀO**.

### Quyết định: `unoptimized: true`, xoá `remotePatterns`

Không siết `pathname` theo cloud name, vì với admin thì mọi hàng rào đều là cấu
hình chết — không có consumer. Đóng hẳn là lời giải đúng bản chất, cùng tinh
thần "không còn optimizer nên không còn bề mặt" của ADR-0016 AMEND 2 §7.

**Điều KHÔNG chứng minh được, ghi thẳng ra:** chưa xác minh được trên Vercel thì
`/_next/image` do optimizer của nền tảng phục vụ hay do `image-optimizer.js` +
`sharp` trong bundle của mình. Docs Vercel gợi ý vế đầu, nhưng đó là hợp đồng
nền tảng chứ không phải quan sát deployment. Chính vì thế mà chọn sửa cấu hình
thay vì chỉ nâng `next`: **nâng version chỉ đúng dưới một giả thuyết, còn
`unoptimized` đúng dưới cả hai** — Next trả 404 (`next-server.js`:
`loader !== 'default' || unoptimized → render404`) và khối `images` không được
ghi vào build output nên `/_vercel/image` cũng 404.

### Hệ quả

- Ngày nào admin thật sự cần `next/image`, phải mở lại **có chủ đích**: bỏ
  `unoptimized`, khai `remotePatterns` kèm `pathname` theo cloud name của dự án,
  và cân lại việc `proxy.ts` đang miễn cổng gác cho `_next/image`.
- Bản vá này độc lập với việc nâng `next` (đợt cùng ngày): hai thứ đúng dưới hai
  giả thuyết khác nhau và **không thay thế nhau**.
