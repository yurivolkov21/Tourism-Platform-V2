# Spec W3 — Vỏ Next: security header + CSP, robots/metadata, origin API, copy còn sót

07/09/2026 · đợt vá thứ ba theo [bản rà bảo mật 05/09](../analysis/2026-09-05-web-security-audit.md)
(bảng "Đề xuất chia ĐỢT VÁ": **W3 — vỏ Next**, nhánh `fix/web-shell-headers`).
Tiếp nối W1 (tiền, merge 06/09) và W2 (phiên & hạ tầng, merge 07/09 —
[CHANGELOG 07/09](../CHANGELOG.md)). Toàn bộ nằm ở `next.config.ts` / layout /
`lib` của hai app Next; **không đụng API**, không migration.

Nếp làm việc giữ nguyên: một session thi công trên nhánh (không merge, không
push, không subagent), session gốc review 8 mũi theo tầng rồi vá cụm và merge.

## 1. Vì sao W3 vẫn cần sau W2

W2 đã cắt tầng CORS và thêm hook 415/403 ở API, nên một XSS trên `www` không
còn gọi thẳng được `/api/admin/*` bằng form-urlencoded hay cross-site. Nhưng
ADR-0026 AMEND 1/2 ghi rõ: đó là **lưới thứ hai**; nhát cắt gốc là web không
cho script lạ chạy và không cho ai nhúng trang mình. Hôm nay (đo `curl -sI`
07/09) cả `www.` lẫn `admin.` chỉ có đúng một header bảo mật —
`strict-transport-security: max-age=63072000` do Vercel tự gắn. Không CSP,
không `frame-ancestors`, không `nosniff`, không `Referrer-Policy`: nút
Pay/Cancel ở `/account/bookings/[code]` nhúng được vào iframe bên ngoài
(clickjacking), và referrer đầy đủ rò `?token=` của `/reset-password` sang
origin khác khi khách bấm link ngoài.

Cụm 7 còn ba lỗi không phải header: `apiOrigin()` chạy trong bundle browser
với nhánh `API_URL` không bao giờ tồn tại ở đó (cấu hình `.env.example` mô tả
làm SSR xanh mà mọi nút ghi từ browser bắn về `localhost:3001`), sáu trang
`(auth)` index được (`/reset-password?token=…`), và `/api/revalidate` phía web
rơi về secret dev khi env thiếu (API đã fail-fast từ lâu, web thì chưa).

## 2. Phạm vi — 12 mục, gom 4 cụm

Ký hiệu **H** (header), **S** (SEO/metadata), **O** (origin & client), **C**
(copy & vụn). Mỗi mục một commit, TDD trên phần thuần.

### Cụm H — header bảo mật + CSP (ADR-0038 MỚI, đi trước code)

| # | Việc | Nơi |
| --- | --- | --- |
| H1 | `apps/web/src/lib/security-headers.ts` — hàm THUẦN `buildSecurityHeaders({ apiOrigin, isDev })` trả `{ key, value }[]`; `next.config.ts` gọi qua `headers()` cho `'/:path*'` | web |
| H2 | `apps/admin/src/lib/security-headers.ts` cùng khuôn nhưng allowlist hẹp hơn (không map, không upload thẳng Cloudinary) + **nonce** qua `proxy.ts` (admin toàn dynamic nên nonce khả thi — xem §3.2) | admin |
| H3 | `X-Robots-Tag: noindex, nofollow` toàn admin + `apps/admin/src/app/robots.ts` disallow `/` | admin |
| H4 | `/api/revalidate` trả `Cache-Control: no-store` + `X-Robots-Tag: noindex` (route handler không vào sitemap nhưng header rẻ, cắt luôn) | web |

### Cụm S — SEO/metadata theo môi trường (ADR-0016 AMEND)

| # | Việc | Nơi |
| --- | --- | --- |
| S1 | `metadataBase: new URL(siteUrl())` ở root layout — canonical/OG tuyệt đối trỏ `NEXT_PUBLIC_SITE_URL`, không tự trỏ host đang phục vụ (preview Vercel, apex) | web |
| S2 | `robots.ts`: ngoài production (`VERCEL_ENV !== 'production'`) → `disallow: '/'`, không `sitemap`; production giữ rule hiện tại. Hàm thuần `robotsFor(env)` + spec | web |
| S3 | `(auth)/layout.tsx` mới, chỉ `export const metadata = { robots: { index: false, follow: false } }` và trả `children` — sáu trang auth hết index; KHÔNG thêm `disallow` vào robots (comment hiện tại giải thích vì sao) | web |
| S4 | `images.remotePatterns` pathname `/<cloud>/**` khi `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` có, fallback `/**` kèm `console.warn` lúc build; `images.minimumCacheTTL` 86400; **`loaderFile`** chèn `f_auto,q_auto,w_<width>` như ADR-0020 §Hệ quả đã đòi từ 14/08 — loader thuần, idempotent với URL đã có `f_auto,q_auto` (đối chiếu `slot-image.tsx`), URL không phải Cloudinary trả nguyên | web |

### Cụm O — origin API & client (ADR-0016 AMEND)

| # | Việc | Nơi |
| --- | --- | --- |
| O1 | Tách `serverApiOrigin()` (`API_URL \|\| NEXT_PUBLIC_API_URL`) và `browserApiOrigin()` (CHỈ `NEXT_PUBLIC_API_URL`); `client.ts` chọn theo `typeof window`. Production mà thiếu giá trị → **throw** lúc gọi (fail-fast), không rơi về `localhost:3001`; dev/test giữ fallback. `resolveApiOrigin` thuần nhận `{ side, env, nodeEnv }`, spec đủ 4 ca × 2 phía | web |
| O2 | Admin `resolveApiOrigin`: parse bằng `new URL()`, production ép `https:` (khác → throw); cùng lý do audit cụm 8 "API_URL sai trên Vercel = exfiltrate cookie admin mọi request" | admin |
| O3 | `withAuthOptions` nhánh browser thêm `cache: 'no-store'` (JSDoc đã hứa, nhánh server đã có); `fetch-options.spec` thêm ca | web |
| O4 | `lib/checkout-url.ts` thuần `isCheckoutUrl(url)` — chỉ `https:` (dev cho phép `http://localhost`), dùng ở `booking-wizard.tsx:128` và `booking-actions.tsx:278` trước `window.location.assign`; URL lạ → toast lỗi chung, không điều hướng | web |
| O5 | `revalidate-route.ts`: `resolveRevalidateSecret({ REVALIDATE_SECRET, NODE_ENV })` — production thiếu → throw; dev → `DEV_REVALIDATE_SECRET`; `TAG_RE` thêm `site-media` (đã có trong `lib/api/tags.ts`, whitelist đang lệch taxonomy) | web |
| O6 | Admin `error.tsx` nhận 403: tầng đọc/ghi admin gắn `digest = 'ADMIN_FORBIDDEN'` lên lỗi 403 (Next chuyển `digest` sang client boundary kể cả production), boundary thấy digest ấy → `router.replace('/not-authorized')`; `(admin)/layout.tsx` bỏ `'/'` hard-code (đọc từ `headers()` `x-pathname` do proxy gắn, hoặc giữ `'/'` kèm comment vì sao — chọn và ghi). Cả hai `proxy.ts` ghi luật "không đặt luật quyền ở proxy" + `apps/admin/src/proxy.spec.ts` (web đã có) | admin |

### Cụm C — copy còn sót ngoài i18n (luật 7 CLAUDE.md)

| # | Việc | Nơi |
| --- | --- | --- |
| C1 | `login-form` (`Password`, `Board the trip`), `two-factor-form` (mô tả, `Verify and continue`, `Recovery code`), `share-row` (3), `contact-location` (`Come say hello`), `forgot-password-form` (`Send the reset link`, câu "expires in 30 minutes" — nợ ghi ở CHANGELOG 06/09 W2 mục CÒN TREO) → `@tourism/i18n`; DOM spec đang assert chữ cứng đổi sang đọc `messages.*` | web + i18n |

**Không làm ở W3 (cố ý):** `LazyMotion`/`domAnimation` (tối ưu, P7);
`PUBLIC_READ_THROTTLE` + `Cache-Control` đường đọc API (cụm 5, thuộc API →
W4); catalogue >50 (`fetchToursAll`, đợt riêng); `AdminAuditLog` (P4f);
`freshAge` trước hành vi tiền (ADR-0026 §SEC-1, P4f).

## 3. Quyết định cần chốt trong ADR-0038 (viết TRƯỚC code)

### 3.1 Web: CSP không nonce, `'unsafe-inline'` cho script — và vì sao

Mọi trang web là SSG/ISR (ADR-0016 §3). Nonce đòi render động từng request
(proxy sinh nonce, Next chèn vào script của nó) — tức bỏ ISR toàn site để đổi
lấy `script-src` nghiêm. Không đáng: sau W2, một XSS trên `www` không còn gọi
được `/api/admin/*` (CORS tách + hook 415/403), nên giá trị còn lại của CSP
web nằm ở **`frame-ancestors`** (clickjacking nút tiền), **`connect-src`**
(script lạ không bắn dữ liệu ra origin lạ), **`object-src`/`base-uri`/
`form-action`** và **không cho tải script từ host ngoài**. Chốt:

```text
default-src 'self';
script-src 'self' 'unsafe-inline' [dev: 'unsafe-eval'];
style-src 'self' 'unsafe-inline';            # motion ghi style attr trong HTML SSR
img-src 'self' data: blob: https://res.cloudinary.com https://tiles.openfreemap.org;
font-src 'self';                             # next/font tự host
connect-src 'self' <apiOrigin> https://tiles.openfreemap.org https://api.cloudinary.com;
worker-src 'self' blob:; child-src blob:;    # MapLibre worker
frame-src 'none'; frame-ancestors 'none';    # Stripe/PayPal là điều hướng top-level, không iframe
object-src 'none'; base-uri 'self'; form-action 'self';
manifest-src 'self'; media-src 'self';
[production: upgrade-insecure-requests]
```

Kèm `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (legacy song song
`frame-ancestors`), `Permissions-Policy: camera=(), microphone=(),
geolocation=(), payment=()`. **KHÔNG** tự gắn HSTS — Vercel đã gắn
`max-age=63072000` (đo 07/09); gắn đôi là hai giá trị chỏi nhau khi Vercel đổi.

Danh sách origin ngoài ở trên là kết quả grep `https?://` toàn `apps/web/src`
và `libs/shared/ui/src` ngày 07/09 (Cloudinary ảnh + upload ký, OpenFreeMap
style/tiles/sprite/glyph). Session thi công grep lại và ghi kết quả vào ADR;
thêm origin nào phải có lý do ở ADR, không nhét vào `next.config.ts` lặng lẽ.

Đường mở rộng ghi trong ADR: khi web có third-party script (analytics, chat)
thì (a) tự host, hoặc (b) chuyển trang cần nó sang nonce — không nới
`script-src` bằng host ngoài.

### 3.2 Admin: nonce + `'strict-dynamic'` qua proxy

Admin đã dynamic từng request (layout gọi `cookies()`/`getServerSession`),
không có SSG để mất, và là đích giá trị nhất. Proxy sinh nonce (16 byte
base64), đặt CSP **vào cả request header lẫn response** (nếp Next
"Configuring CSP": Next đọc nonce từ request header để gắn vào script của
chính nó), `script-src 'self' 'nonce-<n>' 'strict-dynamic'`,
`style-src 'self' 'unsafe-inline'` (recharts/`chart.tsx` chèn `<style>`),
`img-src 'self' data: blob: https://res.cloudinary.com`, `connect-src 'self'
<apiOrigin>`, `frame-ancestors 'none'`, còn lại như web. Ràng buộc: proxy
matcher hiện đã phủ mọi route trừ asset — giữ, nonce phải có mặt ở cả
`/login` và `/not-authorized`. Nếu đo thấy một chỗ CHẶN thật (script inline
của thư viện không nhận nonce), ADR ghi rõ chỗ đó và hạ về `'unsafe-inline'`
cho admin **kèm lý do đo được** — không hạ trước cho chắc.

### 3.3 Ranh giới file

Hai app mỗi app một `security-headers.ts` riêng, **không** gom vào gói
chung: allowlist khác nhau về bản chất (web có map + upload thẳng Cloudinary,
admin có nonce), và một gói chung sẽ là nơi người sau "thêm origin cho cả
hai" mà không nghĩ. Ghi lý do này ở đầu cả hai file để vòng review không
đếm là trùng lặp.

### 3.4 ADR-0016 AMEND (không ADR mới)

§6 Env: `API_URL` chỉ có nghĩa phía server; browser CHỈ thấy
`NEXT_PUBLIC_API_URL`; production thiếu → throw (gương `env.ts` API), không
fallback localhost. §3 thêm: `/api/revalidate` fail-fast production; whitelist
tag gương đúng `tags.ts`. Thêm §7 "Metadata theo môi trường": `metadataBase`
từ `NEXT_PUBLIC_SITE_URL`, robots đóng ngoài production, `(auth)` noindex.

### 3.5 ADR-0026 AMEND 3

Admin: nonce CSP, `X-Robots-Tag`, `error.tsx` nhận `ADMIN_FORBIDDEN`, luật
"proxy không là biên quyền" (audit cụm 8 mục Thấp), `resolveApiOrigin` ép
https ở production.

## 4. Ràng buộc kỹ thuật đã đo — đừng đo lại

- `next/font/google` tự host font → `font-src 'self'` đủ; không có
  `fonts.googleapis.com` ở runtime.
- Web dùng `next/image` đúng **2** chỗ, không `unoptimized` — `loaderFile` áp
  toàn cục là an toàn; `slot-image.tsx` tự dựng URL Cloudinary với
  `OPTIMISABLE_HOST`, loader phải không phá URL đã có transformation.
- Inline script/style hiện có ở web: theme script + `<noscript><style>` ở
  root layout, JSON-LD (`blog/[slug]`, `faq`, `destinations/[region]`),
  `chart.tsx` trong `@tourism/ui`. Tất cả sống dưới `'unsafe-inline'`; JSON-LD
  là `type="application/ld+json"` không thực thi, CSP không chặn.
- MapLibre 5.24 tạo Web Worker từ `blob:` — thiếu `worker-src blob:` là bản
  đồ `/contact` trắng, chỉ thấy trong console. Đây là chỗ CSP dễ làm hỏng
  prod im lặng nhất.
- Upload avatar/ảnh review ký ở API rồi POST thẳng `api.cloudinary.com` từ
  browser (`media-upload.ts`) → `connect-src` phải có nó.
- Stripe/PayPal: `window.location.assign(checkoutUrl)` là điều hướng
  top-level; CSP `form-action`/`frame-src` không dính. Quay về `/checkout/*`
  là GET top-level, cookie Lax sống (ADR-0017).
- Vitest web: project `node` quét `src/lib/**/*.spec.ts` + `src/proxy.spec.ts`,
  project `dom` quét `src/components/**`; **không quét `src/app/**`** — mọi
  logic mới phải nằm ở `src/lib/*` thuần để test được, `next.config.ts` và
  layout chỉ gọi.
- Admin chưa có `proxy.spec.ts`; web có — chép khuôn.

## 5. Test bắt buộc

- `security-headers.spec.ts` (mỗi app): từng directive có mặt, `apiOrigin`
  vào `connect-src`, dev có `'unsafe-eval'` prod không, prod có
  `upgrade-insecure-requests`, KHÔNG có `Strict-Transport-Security`; admin:
  nonce xuất hiện đúng một lần trong `script-src`, có `'strict-dynamic'`.
- `env.spec.ts` web: 4 ca × server/browser; production thiếu → throw có
  message nêu tên biến. Admin: https ép ở production, http qua ở dev.
- `checkout-url.spec.ts`: https qua, `javascript:`/`http://evil` chặn,
  `http://localhost` chỉ dev.
- `revalidate-route.spec.ts`: secret fail-fast production, `site-media` qua
  whitelist.
- `robots.spec.ts` (hàm thuần): production allow + sitemap, preview disallow
  `/`, không sitemap.
- `cloudinary-loader.spec.ts`: chèn `w_<width>`, idempotent, URL lạ nguyên.
- `proxy.spec.ts` admin: redirect khi thiếu cookie, cho qua public path,
  response mang CSP có nonce và request header cũng có.
- DOM spec các form đổi copy: đọc từ `messages`, không chữ cứng.

## 6. Nghiệm thu tay ở session gốc (trước merge — CSP sai là prod hỏng ngay)

Session thi công KHÔNG chạy browser (user giữ dev server). Báo cáo cuối phải
liệt kê **nguyên văn** hai header CSP (web dev, admin dev) để session gốc đối
chiếu §3, và user mở DevTools console ở localhost các trang sau, **0 dòng
"Refused to …"**: `/` (theme toggle → reload dark), `/contact` (bản đồ vẽ
tiles), `/tours/[slug]` (gallery/lightbox, JSON-LD), `/blog/[slug]`,
`/account/profile` (chọn avatar → upload Cloudinary thành công),
`/tours/[slug]/book` (bấm tới Stripe test → trang Stripe mở), `/login`
(submit sai → lỗi hiện), admin `/login` → `/` dashboard (chart vẽ) →
`/bookings/[code]` (drawer). Sau merge, `curl -sI` prod hai app phải có
CSP + 5 header còn lại và **vẫn** HSTS của Vercel.

## 7. Đầu ra bắt buộc của session thi công

Commit đầu là `docs(adr)`: ADR-0038 mới + AMEND ADR-0016/0026 (README map
theo luật 13). Mỗi mục §2 một commit Conventional tiếng Việt có dấu, không AI
attribution. Kết thúc: `pnpm gate:int` trọn (API tạm :3001 trên docker DB theo
công thức CI; nếu 3001 bận là API dev của user → 3011 + `--env-mode=loose`),
entry CHANGELOG "W3 vỏ Next — CHƯA merge, chờ review session riêng" (ngày ·
hash · nội dung · test · CÒN TREO), README trạng thái W3 ở dòng "Rà bảo mật
05/09". `.env.example` web thêm `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (chỉ key);
báo cáo ghi rõ **env nào user phải đặt thêm trên Vercel** trước khi merge.

## AMEND 07/09/2026 — vòng vá review W3 ở session gốc

Review 8 mũi + 3 verifier trên nhánh `fix/web-shell-headers`: 10 findings, vá
trong cùng đợt trước khi merge. Những chỗ spec này nay KHÁC code (code là
nguồn sự thật; chi tiết ở ADR-0038 AMEND 1, ADR-0016 AMEND 2, ADR-0026 AMEND
4, ADR-0020 AMEND 1):

- **§3.1 / §3.2 CSP**: web `media-src` thêm `https://res.cloudinary.com` (video
  khe `about-cta-video`), `img-src` hai app thêm `https://lh3.googleusercontent.com`
  (avatar Google OAuth). `connect-src` lấy từ `browserApiOrigin()` đã chuẩn
  hoá, không đọc env thô.
- **S2**: robots KHÔNG theo `VERCEL_ENV` lúc build nữa — route động so host
  request với host `NEXT_PUBLIC_SITE_URL`.
- **S4**: chỉ `loaderFile`; `remotePatterns` theo cloud + `minimumCacheTTL` +
  env `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` bị BỎ (cấu hình chết khi có loader).
  §7 câu ".env.example web thêm NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" hết hiệu lực.
- **O1/O2**: cả hai app `new URL().origin`, production thiếu → throw nêu tên
  biến, https ép trừ loopback; mọi caller lười (web `client.ts`/`auth-client.ts`
  cũng vậy, không chỉ admin). S1 `siteUrl()` cũng fail-fast production.
- **H3**: admin `robots.txt` = `allow` (không disallow), giữ `X-Robots-Tag`.
- **O6**: layout gác ép `role === 'ADMIN'` tường minh; `x-pathname` kèm query;
  `error.tsx` đọc `routeForErrorDigest` ở lib.
- **§5 test**: CSP so bằng map directive→sources; nonce qua
  `getScriptNonceFromHeader` của Next; interceptor 403 test qua
  `createAdminLink({ fetch })`; thêm `scripts/check-admin-prerender.mjs` trong CI.
- **§6 nghiệm thu**: thêm `/about` (video phải chạy, không chỉ poster); admin
  thử bằng `next build` + `next start` (không chỉ `next dev`); `/_global-error`
  admin là 500.html tĩnh — chấp nhận chỉ chữ.
- **O4**: contract `checkoutUrl` siết `https` tại nguồn (`z.url({ protocol })`),
  guard client giữ làm lớp hai.

