# ADR-0038 — Vỏ Next: security header + CSP cho hai app

- **Trạng thái:** Accepted (2026-09-07, đợt W3)
- **Bối cảnh:** [Rà bảo mật 05/09](../analysis/2026-09-05-web-security-audit.md)
  cụm 7/8 + [spec W3](../specs/2026-09-07-w3-web-shell-headers-design.md).
  Đo `curl -sI` 07/09: cả `www.` lẫn `admin.` chỉ có đúng MỘT header bảo mật
  (`strict-transport-security` do Vercel tự gắn) — không CSP, không
  `frame-ancestors`, không `nosniff`, không `Referrer-Policy`. Hệ quả đã chỉ
  ra ở audit: nút Pay/Cancel nhúng được vào iframe ngoài (clickjacking), và
  referrer đầy đủ rò `?token=` của `/reset-password` sang origin khác.
  ADR-0026 AMEND 1/2 (W2) đã cắt lưới thứ hai (CORS tách + hook 415/403);
  ADR này là NHÁT CẮT GỐC: web không cho script lạ chạy, không cho ai nhúng
  trang mình.

## Quyết định

### 1. Web (`apps/web`): CSP KHÔNG nonce, `'unsafe-inline'` cho script

Mọi trang web là SSG/ISR (ADR-0016 §3). Nonce đòi render động từng request
(proxy sinh nonce, Next chèn vào script của chính nó — xem guide
"Content Security Policy" kèm gói Next 16.3) — tức bỏ ISR TOÀN SITE để đổi lấy
`script-src` nghiêm. Không đáng: sau W2, một XSS trên `www` không còn gọi được
`/api/admin/*` (CORS tách + hook 415/403), nên giá trị còn lại của CSP web nằm
ở:

- **`frame-ancestors 'none'`** — chặn clickjacking nút tiền
  (`/account/bookings/[code]`);
- **`connect-src` allowlist** — script lạ (nếu có) không bắn dữ liệu ra origin
  lạ;
- **`object-src 'none'` / `base-uri 'self'` / `form-action 'self'`** — đóng
  các sink cổ điển;
- **không cho tải script từ host ngoài** (`script-src` không có host nào).

CSP chốt (phát từ `headers()` của `next.config.ts`, nguồn là hàm thuần
`apps/web/src/lib/security-headers.ts`):

```text
default-src 'self';
script-src 'self' 'unsafe-inline' [dev: 'unsafe-eval'];
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://res.cloudinary.com https://tiles.openfreemap.org;
font-src 'self';
connect-src 'self' <apiOrigin> https://tiles.openfreemap.org https://api.cloudinary.com;
worker-src 'self' blob:; child-src blob:;
frame-src 'none'; frame-ancestors 'none';
object-src 'none'; base-uri 'self'; form-action 'self';
manifest-src 'self'; media-src 'self';
[production: upgrade-insecure-requests]
```

Chú giải từng lựa chọn (ràng buộc đã đo ở spec W3 §4):

- `style-src 'unsafe-inline'`: motion render prop `initial` thành `style`
  attr NGAY TRONG HTML SSR (40+ chỗ); `chart.tsx` của @tourism/ui chèn
  `<style>`.
- `img-src` `data:`/`blob:`: placeholder + preview upload; hai host ngoài là
  ảnh media Cloudinary và tile/sprite bản đồ.
- `font-src 'self'`: `next/font/google` TỰ HOST font — runtime không có
  `fonts.googleapis.com`.
- `worker-src 'self' blob:` + `child-src blob:`: MapLibre 5.24 tạo Web Worker
  từ `blob:` — thiếu là bản đồ `/contact` trắng im lặng (chỗ CSP dễ làm hỏng
  prod nhất). `child-src` là fallback cho browser cũ chưa hiểu `worker-src`.
- `connect-src` có `https://api.cloudinary.com`: upload avatar/ảnh review ký ở
  API rồi browser POST THẲNG Cloudinary (`media-upload.ts`, ADR-0021).
- `frame-src 'none'`: Stripe/PayPal là điều hướng top-level
  (`window.location.assign`), không nhúng iframe nào.
- `'unsafe-eval'` CHỈ dev: React dùng `eval` dựng lại server stack khi debug;
  production không cần (guide Next).
- `upgrade-insecure-requests` chỉ production — dev http://localhost mà bật là
  browser tự nâng https rồi chết.

Kèm 4 header ngoài CSP: `X-Content-Type-Options: nosniff` ·
`Referrer-Policy: strict-origin-when-cross-origin` (cắt đường rò `?token=`
qua referrer) · `X-Frame-Options: DENY` (legacy song song `frame-ancestors`) ·
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.

**KHÔNG tự gắn `Strict-Transport-Security`** — Vercel đã gắn
`max-age=63072000` (đo 07/09); gắn đôi là hai giá trị chỏi nhau khi Vercel
đổi. Test canh chiều ngược: buildSecurityHeaders KHÔNG được phát HSTS.

### 2. Danh sách origin ngoài — kết quả grep 07/09 (session thi công W3)

Grep `https?://` toàn `apps/web/src` + `libs/shared/ui/src` (loại `*.spec.*`
và fixture test), phân loại:

| Origin | Ở đâu | CSP |
| --- | --- | --- |
| `https://res.cloudinary.com` | `slot-image.tsx` (OPTIMISABLE_HOST), URL media từ API | `img-src` |
| `https://tiles.openfreemap.org` | `contact-map.tsx` (style positron/dark; style JSON kéo tiles/sprite/glyph CÙNG host) | `img-src` + `connect-src` |
| `https://api.cloudinary.com` | `uploadUrl` do API ký trả về (`media-upload.ts`) | `connect-src` |
| `https://twitter.com`, `https://www.facebook.com` | `share-row.tsx` — link `<a href>` mở tab mới | điều hướng top-level, CSP không quản |
| `https://www.google.com` | `mocks/offices.ts` `mapHref` — link `<a href>` | điều hướng top-level, CSP không quản |
| `https://schema.org` | chuỗi `@context` trong JSON-LD | không phải fetch |
| `http://www.w3.org` | `xmlns` của SVG | không phải fetch |

**Luật:** thêm origin nào vào CSP phải có lý do ghi ở ADR này (AMEND) —
không nhét vào `security-headers.ts` lặng lẽ.

### 3. Admin (`apps/admin`): nonce + `'strict-dynamic'` qua proxy

Admin đã dynamic từng request (layout gọi `cookies()`/`getServerSession`),
không có SSG để mất, và là đích giá trị nhất → đáng dùng CSP nghiêm nhất.
Theo đúng nếp guide Next "Configuring CSP": `proxy.ts` sinh nonce 16 byte
(base64), đặt CSP **vào CẢ request header lẫn response header** — Next đọc
nonce từ request header để gắn vào script của chính nó lúc SSR.

```text
default-src 'self';
script-src 'self' 'nonce-<n>' 'strict-dynamic' [dev: 'unsafe-eval'];
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://res.cloudinary.com;
font-src 'self';
connect-src 'self' <apiOrigin>;
frame-src 'none'; frame-ancestors 'none';
object-src 'none'; base-uri 'self'; form-action 'self';
manifest-src 'self'; media-src 'self';
[production: upgrade-insecure-requests]
```

- Allowlist HẸP HƠN web về bản chất: không map (không OpenFreeMap, không
  worker), không upload thẳng Cloudinary (mọi ghi đi qua server action).
- `style-src 'unsafe-inline'`: recharts/`chart.tsx` chèn `<style>` — đo được,
  không phải phòng hờ.
- Proxy matcher hiện đã phủ mọi route trừ asset tĩnh — GIỮ NGUYÊN; nonce phải
  có mặt ở cả `/login` và `/not-authorized` (hai path public vẫn qua proxy).
- Nếu về sau đo thấy một chỗ CHẶN thật (script inline của thư viện không nhận
  nonce) thì AMEND ADR này ghi rõ chỗ đo được rồi mới hạ về `'unsafe-inline'`
  — KHÔNG hạ trước cho chắc.
- `X-Robots-Tag: noindex, nofollow` toàn admin + `robots.ts` disallow `/`
  (chi tiết ở ADR-0026 AMEND 3).

### 4. Ranh giới file: HAI `security-headers.ts` riêng, không gói chung

Mỗi app một `apps/*/src/lib/security-headers.ts`, **không** gom vào
`libs/shared`: allowlist khác nhau về bản chất (web có map + upload thẳng
Cloudinary, admin có nonce), và một gói chung sẽ thành nơi người sau "thêm
origin cho cả hai" mà không nghĩ. Lý do này ghi ở đầu CẢ HAI file để vòng
review không đếm là trùng lặp.

### 5. Đường mở rộng khi có third-party script

Khi web cần analytics/chat/third-party script: (a) **tự host** script đó
(`'self'` phủ), hoặc (b) chuyển RIÊNG trang cần nó sang dynamic + nonce —
**không nới `script-src` bằng host ngoài** (một host CDN bị chiếm là toàn bộ
giá trị `script-src` sụp).

## Hệ quả

- Mọi origin ngoài mới (map provider khác, CDN ảnh khác…) phải qua AMEND ADR
  này trước khi vào `security-headers.ts`.
- CSP sai là prod hỏng NGAY sau push (push main là deploy — ADR-0024): mọi
  thay đổi CSP phải qua nghiệm thu tay DevTools theo spec W3 §6 trước merge.
- Vercel đổi cách gắn HSTS thì đây là chỗ ghi nhận lại — repo cố ý không có
  HSTS riêng.

## Đã cân nhắc và loại

- **Nonce cho web:** mất ISR toàn site (mọi trang thành dynamic, không CDN
  cache) để vá một lỗ đã có hai lưới khác che (W2) — không đáng với capstone
  SSG-first.
- **SRI experimental của Next:** giữ được SSG nhưng là cờ experimental ngay
  trước freeze 15/10; xét lại ở P7 nếu cần siết thêm.
- **Gom security-headers vào `libs/shared`:** xem §4.
- **`Permissions-Policy` liệt kê đầy đủ ~30 feature:** bốn feature nhạy nhất
  đủ giá trị; danh sách dài là chi phí bảo trì không lãi.

## AMEND 1 — 07/09/2026 (vòng vá review W3 ở session gốc)

Vòng review 8 mũi + 3 verifier bắt được những giả định sai của bản gốc; sửa
ở đây, code theo sau trong cùng đợt vá.

### a. Allowlist thiếu tài nguyên THẬT (bảng §2 dựng từ grep literal)

Grep `https?://` chỉ thấy chuỗi trong source, không thấy URL sinh lúc chạy từ
dữ liệu. Hai bề mặt bị chặn thật:

- **Video Cloudinary** khe `about-cta-video` (`slot-video.tsx` `<video><source
  src>`, API dựng `…/video/upload/…`): `media-src 'self'` chặn, poster đi theo
  `img-src` nên mắt thường không thấy — đúng loại hỏng im lặng ADR sợ. Web:
  `media-src 'self' https://res.cloudinary.com`.
- **Avatar Google OAuth** (`user.image = https://lh3.googleusercontent.com/…`
  do Better Auth ghi khi `socialProviders.google` bật): `img-src` cả hai app
  thêm `https://lh3.googleusercontent.com`.

Hệ quả ĐÃ BIẾT và cố ý không mở: escape-hatch "publicId là URL tuyệt đối"
(ADR-0005 §2) và ảnh markdown thân bài blog (host bất kỳ) — CSP sẽ trắng
ảnh đó ở production. Hôm nay không row/nội dung nào dùng; ngày nào cần thì
là AMEND, không phải sửa lặng. Luật mới cho §2: mỗi lần thêm bề mặt media,
liệt kê URL SINH LÚC CHẠY (từ API/DB), không chỉ grep source.

### b. `connect-src` từ CÙNG resolver với client, không đọc env thô

Proxy admin từng tính `connect-src` từ `process.env.NEXT_PUBLIC_API_URL ||
'http://localhost:3001'` — Next inline lúc build (bundle chứa literal), không
`.origin`, không throw: thiếu env là CSP prod `connect-src http://localhost:
3001` vĩnh viễn, login chết im; env có path `/api` là CSP khớp-chính-xác chặn
Better Auth trong khi authClient (dùng `.origin`) gọi đúng. Web cùng bệnh ở
`next.config.ts` (nhồi chuỗi thô, `;` cắt đôi CSP). Chốt: **nguồn duy nhất
cho `connect-src` là `browserApiOrigin()`** của từng app — chuẩn hoá
`new URL().origin`, production thiếu → throw nêu tên biến, http chỉ cho
loopback (ADR-0016 AMEND 2 §6, ADR-0026 AMEND 4 §D). Proxy throw = 500 mọi
request ngay sau deploy sai — ồn ào đúng ý fail-closed (ADR-0003).

### c. HTML admin nào tĩnh là nonce lệch — luật + hai lưới

Bảng route Next in sau build **giấu** `/_global-error` (`build/utils.js`
"Hide static /_global-error from build output"); manifest thật có nó: 500.html
tĩnh Next tự dựng, 9 script/0 nonce, và Next **cấm** mọi segment config cho
route này (`utils.js` `appConfig = … ? {} : reduceAppConfig`) — không ép động
được. **Chấp nhận**: khi root layout ném, admin thấy trang lỗi chỉ có chữ
(không hydrate, nút reset chết) — nội dung là text thuần, đủ để đọc lỗi.
Luật ghi vào §3: *bất kỳ HTML admin nào được prerender/`use cache`/ISR là
nonce trong body lệch nonce trong header → trắng script; danh sách route tĩnh
cho phép phải khai tường minh.* Hai lưới: `export const dynamic =
'force-dynamic'` ở root layout (lan xuống page con; `/_not-found` đi entry
builtin nên ba `await connection()` hiện có vẫn giữ) và
`scripts/check-admin-prerender.mjs` chạy trong CI sau build — đọc
`prerender-manifest.json`, allowlist `/robots.txt` + `/_global-error`, đỏ nếu
dư. Đây là thứ duy nhất bắt được cả lớp lỗi: mắt người lẫn bảng route của
Next đều đã trượt trong chính đợt này.

### d. Đã cân nhắc thêm

- **`Content-Security-Policy-Report-Only` / `report-to`:** không có kênh nào
  báo khi CSP chặn ở production (chỉ console của người dùng). Chưa làm ở W3 vì
  endpoint nhận báo cáo nằm ở API (W3 không đụng API) → **CÒN TREO W4**: route
  `POST /api/csp-report` + một vòng Report-Only trước khi siết thêm. Bù tạm:
  spec §6 thêm `/about` (bề mặt video) và admin phải thử bằng `next build` +
  `next start`.
- **Preview deployment:** CSP y hệt production, cố ý — nghiệm thu trên preview
  mới có nghĩa. Vercel Live/toolbar (`vercel.live` script/iframe/websocket) vì
  thế bị chặn trên preview; repo không có `vercel.json`, đội không dùng toolbar.
  Nếu cần thì allowlist có điều kiện `VERCEL_ENV === 'preview'` qua AMEND, và
  phải ghi rõ "CSP preview KHÁC prod".
- **`upgrade-insecure-requests` với `next start` local:** không vỡ —
  `localhost`/`127.0.0.1` là *potentially trustworthy* (Secure Contexts §3.2),
  Chromium bỏ qua nâng cấp cho chúng; luồng nghiệm thu chuẩn vẫn là `next dev`.

### e. zod 4 thử `Function("")` — tắt JIT tại contract, không nới CSP

Đo trên admin `next build` + `next start` (07/09): mọi trang một vi phạm
`script-src ← eval` từ chunk chứa zod. zod 4 thử `Function("")` ở lần parse
đầu để bật fast-path JIT; dưới CSP không `'unsafe-eval'` phép thử ném và zod
tự rơi về jitless — chức năng đúng, nhưng vi phạm được ghi ở mọi trang (và sẽ
làm nhiễu `report-to` khi có). Web production y hệt (dev cho `'unsafe-eval'`
nên không thấy). Chốt: `z.config({ jitless: true })` ở điểm vào
`@tourism/contract` (mọi app import zod qua đó, kể cả API — body nhỏ, chi phí
không đáng kể), có spec canh. KHÔNG thêm `'unsafe-eval'` vào production cho
một probe.

### f. Hợp đồng test

Test CSP so **bằng** map directive→sources (`toEqual`), không `toContain`
chuỗi con — thêm host lạ vào bất kỳ directive nào phải đỏ, đúng luật "origin
mới qua AMEND". Nonce admin phải đi qua chính parser của Next
(`getScriptNonceFromHeader`) trong `proxy.spec.ts`: Next bỏ nonce sai định
dạng **im lặng** rồi render HTML không nonce dưới CSP strict-dynamic.

## AMEND 2 — 07/09/2026 (đợt W4): kênh nhận báo cáo CSP — `report-to` + `report-uri`, endpoint ở API

Trả nợ AMEND 1 §d ("không có kênh nào báo khi CSP chặn ở production"):

- **Endpoint MỘT nơi cho cả hai app:** `POST /api/webhooks/csp-report` ở API
  (`@Public()`, `WEBHOOK_THROTTLE` theo IP). Đặt dưới `/api/webhooks/` để
  hook 415 của W2 (ADR-0026 AMEND 2) miễn sẵn — báo cáo CSP tới bằng
  `application/csp-report` (đường `report-uri`) và `application/reports+json`
  (đường `report-to`), không phải JSON thường; nhận CẢ HAI content-type.
- **Hành vi endpoint:** body cắt 8 KB (413 khi quá); log MỘT dòng cấu trúc
  `csp-report {app, directive, blockedUri, documentUri, sample}` với dedupe
  theo (directive, blockedUri) trong 10 phút per-process — một extension phổ
  biến bị chặn không thành bão log; trả **204** và không gì khác; **không
  lưu DB** tới khi thấy cần (log Render đủ cho tần suất hiện tại).
- **Hai app phát ba thứ:** header `Reporting-Endpoints:
  csp="<api>/api/webhooks/csp-report"` (Reporting API v1) + directive
  `report-to csp` + directive `report-uri <api>/api/webhooks/csp-report`
  (fallback cho browser chưa hiểu Reporting API). `security-headers.ts` hai
  app nhận thêm `reportUri`; test map directive so bằng (`toEqual`) cập nhật
  theo — vẫn đúng luật AMEND 1 §f.
- **KHÔNG chuyển sang Report-Only:** CSP đã enforce từ W3 và đã nghiệm thu
  tay; hạ xuống Report-Only để "quan sát trước" là mở lại đúng lỗ vừa đóng.
  Kênh báo cáo ở đây phục vụ chiều ngược: biết khi enforce CHẶN NHẦM thứ
  thật (hạ tầng đổi, thư viện mới) để AMEND kịp.
