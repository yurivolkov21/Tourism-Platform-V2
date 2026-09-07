# ADR-0016 — Tầng dữ liệu web: oRPC `OpenAPILink` · server-first · ISR + cache-tag

- **Trạng thái:** Accepted (2026-07-31)
- **Bối cảnh:** Phase nối API cho web P3b. Nối tiếp [ADR-0010](0010-infra-hardening.md)
  (error envelope thống nhất — tiền đề "FE một parser"), [ADR-0011](0011-p3b-web-architecture.md)
  §Quyết định 5 (đã hứa "typed oRPC client", chưa chốt chi tiết), [ADR-0005](0005-media-read-build-url.md)
  (media hoãn có chủ đích). Dữ kiện nền: [rà soát docs ↔ code 30/07](../analysis/2026-07-30-docs-audit-progress.md)
  và [đối chiếu Nexora tầng dữ liệu web 31/07](../analysis/2026-07-31-web-data-layer-parity-nexora.md).

> **Cập nhật 2026-08-03 (đại tu docs — đối chiếu code):**
> - **On-demand revalidation thành NỢ QUÁ HẠN.** Bước 1–6 của lộ trình nối API
>   đã merge xong (xem [docs/README.md](../README.md) dòng P3b Web) nhưng
>   **0 dòng code** cho route `/api/revalidate` hay module gọi sang từ API —
>   grep `revalidateTag`/`/api/revalidate` trong `apps/web/src` và `apps/api/src`
>   ra 0 hit. Nợ có kế hoạch ở bản gốc nay đáng lên lịch cụ thể, không còn là
>   "sau bước 1–4" mơ hồ. → **ĐÃ TRẢ cùng ngày 03/08** (`a6136ea..6be5abe`,
>   xem khối "Chốt 2026-08-03" ở §3 + CHANGELOG 03/08).
> - **"Toast quyết ở form đầu tiên" ĐÃ CHỐT 03/08:** sonner cài thật
>   (`apps/web/package.json` — `sonner: ^2.0.7`), `<Toaster>` vendor qua
>   `@tourism/ui` mount toàn site ở
>   [apps/web/src/app/layout.tsx:102](../../apps/web/src/app/layout.tsx) (form
>   Contact/Newsletter — bước 5+6).
> - **Mock sống bổ sung `mocks/auth.ts`** — chờ bước 7 (session Better Auth);
>   danh sách 4 mock-không-endpoint + team/offices ở Quyết định 5 không đổi.
>   Lớp catalogue (`tours`/`destinations`/`journal`…) đã chết hết đúng thiết
>   kế của mục này. → **`mocks/auth.ts` ĐÃ KHAI TỬ cùng ngày 03/08** (bước 7
>   merge — user-menu sang `useSession` thật, xem CHANGELOG 03/08).
>   → 06/08: `mocks/account.ts` sinh ra Ở PHA TĨNH cụm A và khai tử NGAY
>   trong cùng cụm (mẫu mock-chết-trong-cụm — không bao giờ lên main ở
>   trạng thái sống); danh sách mock sống hiện tại: 4 mock-không-endpoint
>   (faq · testimonials · moments · regions) + team/offices — không đổi.
> - **Bảng `lib/api/` nay có thêm 2 file:** `resilience.ts` (`settle()`/
>   `contentState()` — khuôn tri-state cho đường ĐỌC, tách ra từ bước 1) và
>   `submit.ts` (`classifySubmitError`/`submitToast` — đường GHI, bước 5+6;
>   vẫn KHÔNG auto-retry mutation đúng Quyết định 6) —
>   [apps/web/src/lib/api/](../../apps/web/src/lib/api/) cạnh `env.ts`,
>   `client.ts`, `tags.ts` và các module theo resource.
>
> Quyết định gốc giữ nguyên văn — đây là ghi nhận tiến độ + nợ đến hạn, không
> đảo kiến trúc.

## Bối cảnh

19 trang web đã dựng đều là SSG từ `apps/web/src/mocks/**`; **0 trang gọi API** và
`apps/web` chưa có client nào (`package.json` không có `@tourism/contract` lẫn
`@orpc/client`). Nối trang đầu tiên vì thế không phải việc sửa một trang mà là
quyết định kiến trúc dùng chung cho **cả 19 trang cộng các trang sẽ dựng thêm**
(khu tài khoản, booking, unsubscribe…) — làm sau sẽ phải sửa lại tất cả (luật 5).

Ràng buộc đã đo:

- API mount contract theo **path REST tường minh** qua `@orpc/nest`
  (`contract.ts` mỗi procedure mang `.route.path`) — không phải giao thức RPC.
- Mọi lỗi HTTP đã về MỘT envelope `{defined, code, status, message, data}`
  (ADR-0010) — kể cả lỗi từ guard và route Nest thuần.
- `loading.tsx` ở bất kỳ segment cha nào của route động gây **soft 404** (HTTP
  200 kèm UI 404) — đo được, nay là luật riêng:
  [soft-404-loading-tsx](../conventions/soft-404-loading-tsx.md) (bản đo gốc
  trong plan Tours).
- API throttle ghi công khai **theo IP** (`PUBLIC_WRITE_THROTTLE` trên enquiries
  + newsletter) — nơi fetch chạy quyết định budget rate-limit của khách.

## Quyết định

### 1. Client: oRPC `OpenAPILink` từ contract — không `fetch` trần, không codegen

Cài vào `apps/web`: `@tourism/contract` (workspace) + `@orpc/client` +
`@orpc/openapi-client`, **ghim `1.14.8`** khớp bộ `@orpc/*` của API/contract.

- Link là **`OpenAPILink`** (không phải `RPCLink`): server nói chuyện bằng các
  path REST của contract, `RPCLink` là sai giao thức. Kiểu client:
  `JsonifiedClient<ContractRouterClient<typeof contract>>`.
- Type + error code đi thẳng từ Zod của contract sang web — không khai lại
  shape nào, không bước codegen (Nexora phải codegen schema ~7.000 dòng cho
  cùng kết quả). Lỗi defined bắt bằng `isDefinedError` (ví dụ
  `SEATS_UNAVAILABLE`, `REVIEW_ALREADY_EXISTS`).
- Custom fetch của link: `AbortSignal.timeout(10_000)` mặc định (Nexora không
  có timeout ở bất kỳ đâu — điểm vá) và chuyển `next: {revalidate, tags}` theo
  từng call qua **client context** để Server Component điều khiển Data Cache.
- **Không auto-retry.** Mutation retry tự động là bug tiềm ẩn (ghi hai lần);
  GET đã có ISR che, retry là hành động của user (xem Quyết định 4).

Cấu trúc `apps/web/src/lib/api/`:

| File | Vai trò |
| --- | --- |
| `env.ts` | Nguồn env DUY NHẤT của tầng này (Nexora lặp tay base-URL ở 8 file) |
| `client.ts` | Dựng `OpenAPILink` + export client |
| `tags.ts` | Taxonomy cache-tag duy nhất: `TAGS.*` + `tourTag(slug)`, `postTag(slug)`… |
| `tours.ts`, `posts.ts`, … | Mỗi resource một module: fetch + **map DTO → view-model**; component chỉ nhận VM |

Logic thuần trong các module (map, derive, format) TDD theo luật 4 — pattern
"file fetch chỉ fetch + map, mọi nhánh quyết định nằm ở hàm pure có test".

### 2. Ranh giới Server Component / Client Component

| Loại việc | Nơi fetch | Lý do |
| --- | --- | --- |
| Đọc public (tours · posts · destinations · reviews của tour) | **Server Component** — page async gọi `lib/api/*` | SEO + không đổ JS thừa; toàn bộ bước nối 1–4 |
| Ghi công khai throttle per-IP (enquiry · newsletter) | **Client Component — browser gọi thẳng API** | Đi qua server Next là dồn mọi khách vào 1 IP, tự phá rate-limit budget của chính khách đó |
| Ghi cần auth + đọc per-user (wishlist · review · booking · account) | Hướng: browser gọi thẳng API kèm cookie (`credentials: 'include'`; CORS API đã `credentials: true` với `trustedOrigins`) | **Chi tiết CHỐT Ở BƯỚC 7** cùng cơ chế session Better Auth — có thể thành ADR riêng; ADR này không chốt non |
| State per-user trên trang static (tim wishlist trên card) | Client island — không kéo cả trang thành dynamic | Trang catalogue giữ static/ISR |
| `generateMetadata` ↔ thân trang | Bọc fetch detail bằng React `cache()` | Chống double-fetch trong cùng request |

### 3. Cache / revalidate: giữ mô hình classic (SSG → ISR), KHÔNG bật `cacheComponents`

- Trang nối API chuyển **SSG thuần → ISR**: `export const revalidate = 300`
  (con số Nexora đã vận hành thật; trang gần-tĩnh kiểu contact có thể 3600).
  `generateStaticParams` chuyển nguồn từ mock sang API.
- **Mọi fetch gắn cache-tag từ ngày đầu**, tập trung ở `lib/api/tags.ts` —
  để bước on-demand revalidation về sau chỉ còn là thêm endpoint, không phải
  đi cắm lại tag khắp nơi.
- **On-demand revalidation là BƯỚC RIÊNG sau bước nối 1–4** (chốt với user
  31/07): cần route handler `/api/revalidate` + secret ở web **và một module
  mới phía API** gọi sang khi publish/duyệt nội dung (Nexora đã có nguyên
  mẫu: ADR-0013 của repo cũ + `web-revalidation.service.ts`). Ghi nợ có kế
  hoạch — không nhét vào bước 1.

  > **Chốt 2026-08-03 (trả nợ — cơ chế cụ thể):** đúng blueprint Nexora đã
  > đối chiếu. Web: route `POST /api/revalidate`, header secret so
  > constant-time, whitelist đúng taxonomy `lib/api/tags.ts`, tag lạ 400.
  > API: MỘT `WebRevalidationService` fire-and-forget (timeout 3s, mọi lỗi
  > chỉ `warn` — ISR 300s vẫn là lưới đúng đắn), gọi SAU khi transaction
  > commit; điểm móc duy nhất hiện có: `reviews.moderate` khi đổi bề mặt
  > public. Secret theo nếp `DEV_*_SECRET`; không endpoint admin trung gian,
  > không outbox (đã cân nhắc và loại — cache tự lành ≤300s). Chi tiết:
  > [spec 03/08](../specs/2026-08-03-on-demand-revalidation-design.md).
  > **Đã thi hành + merge 03/08** — lưu ý thi công: Next 16 đổi
  > `revalidateTag` thành 2 tham số và `'max'` là SWR mềm; hard-bust đúng là
  > `{ expire: 0 }` (đường `cacheLife.expire === 0` trong revalidate.js —
  > đã đo sống HIT→MISS ngay).
- **Vì sao không `cacheComponents`/`use cache`:** đổi mô hình render + cache
  của toàn app (mọi async data phải vào `use cache` hoặc Suspense) ngay trước
  freeze 15/10, trong khi ISR classic vẫn được Next 16 hỗ trợ đầy đủ và là mô
  hình Nexora đã chạy production. Nếu muốn, migrate là việc của P7 và có bảng
  chuyển đổi rõ (`revalidate = N` → `cacheLife({revalidate: N})`).
- **Hệ quả nhìn thẳng — build cần API sống** (chốt với user 31/07):
  `next build` (nằm trong `pnpm gate`, 18 task) sẽ fetch API lúc prerender.
  Máy dev chạy được API local (DB là Supabase session pooler — không cần
  Postgres cục bộ); CI/deploy trỏ API đã deploy. `settle()` làm lưới: fetch
  hỏng lúc build thì trang render `LoadErrorState` thay vì đánh sập build,
  và ISR tự chữa trong ≤300s sau deploy. Phương án "không prerender, slug
  rỗng render on-demand" bị loại (xem cuối file).

### 4. Khuôn lỗi + trạng thái tải (site chưa có khuôn nào — đây là khuôn)

- **Tri-state bắt buộc** cho mọi section dữ liệu API: port khái niệm
  `settle()` (không throw, trả `{ok, data}`) + `contentState()`
  (`'error' | 'empty' | 'content'`, **failed thắng isEmpty**) +
  component `LoadErrorState` (panel "couldn't load" + nút retry =
  `router.refresh()`). Logic thuần, có test.
- **Cấm hiện empty-state khi API lỗi** — "No tours match your filters" lúc API
  sập là nói dối người dùng; Nexora tự ghi bài học này trong comment
  `app/tours/page.tsx:16-18` của họ.
- Parse lỗi **một kiểu duy nhất**: envelope ADR-0010 + typed errors oRPC.
- **`loading.tsx`: mặc định KHÔNG.** Route động `[slug]` tuyệt đối không có
  (soft 404 đã đo); nếu về sau một listing thành dynamic thật thì
  `loading.tsx` của nó phải nằm trong route group (mẫu `(listing)/` của cụm
  Tours) để không bọc `[slug]`. **Mọi PR đụng khu vực này phải đo lại HTTP
  status của slug lạ trên production build** — luật từ plan Tours.
- Trang ISR được serve từ HTML tĩnh nên mặc định **không cần skeleton**;
  trạng thái tải chỉ tồn tại nơi có chờ thật: form pending (`useActionState`
  / state cục bộ — nút disable + đổi nhãn), island client đang tải.
- Form: lỗi validate field hiển thị **inline** cạnh field; kết quả thao tác
  hiển thị panel tại chỗ. Toast (sonner) chưa cài — quyết ở form đầu tiên
  (bước 5), không quyết trước khi có nhu cầu.

### 5. Số phận mock: chết dần theo trang, không big-bang

- Trang nào nối API thì **gỡ import mock của loại dữ liệu đó ngay trong PR
  đó**; một trang không bao giờ trộn mock + API cho cùng một loại dữ liệu.
- Type `MockTourCard`/`MockTourDetail`/`MockDestination`… thay bằng
  `z.infer` từ `@tourism/contract` — mock tour vốn là *gương contract*
  (`mocks/types.ts` ghi rõ) nên component gần như không đổi, đúng thiết kế.
- **4 mock không có endpoint** (`faq` · `testimonials` · `moments` ·
  `regions`) cùng `team`/`offices`: **sống tiếp** như nội dung biên tập tĩnh,
  không chặn phase; `moments` xét map `siteMedia.list` sau khi xác minh shape.
- File mock hết consumer thì xoá cùng test canh nó.

### 6. Env

`API_URL` (server-side) + `NEXT_PUBLIC_API_URL` (browser) — giá trị là
**origin trần, không kèm `/api`** (path contract đã tự mang prefix). Sống
trong `apps/web/.env.local` theo quy ước tên file env 19/07; mẫu vào
`.env.example`; đọc qua đúng một module `lib/api/env.ts`.

## Hệ quả

- Type + error code chảy một chiều contract → web; lệch contract là lỗi
  compile, không phải lỗi runtime. FE có đúng MỘT parser lỗi.
- **Workflow đổi:** `pnpm gate` (vì có `next build`) từ nay cần API chạy
  (local hoặc URL đã deploy). Fetch hỏng lúc build không sập build nhờ
  `settle()`, nhưng HTML build ra khi đó là `LoadErrorState` — chấp nhận vì
  ISR tự chữa ≤300s; deploy thật luôn build với API prod sống.
- Đổi model render 19 trang: SSG thuần → ISR. Phải đo lại soft-404 (slug lạ)
  và sitemap sau mỗi cụm nối — cùng PR, trên production build.
- TanStack Query chưa vào; điểm xét lại được định trước: khi dựng khu tài
  khoản (bước 8–10), nếu cần thì dùng `@orpc/tanstack-query`.
- Cơ chế session Better Auth ở web là quyết định MỞ, chốt ở bước 7.
- On-demand revalidation là nợ có kế hoạch (bước riêng sau 1–4); trong lúc
  chưa có, nội dung mới chờ tối đa TTL 300s — chấp nhận được cho capstone.

## Đã cân nhắc và loại

- **`fetch` trần:** khai lại tay ~33 shape + error code, lệch contract chỉ lộ
  lúc runtime; Nexora phải trả giá codegen 7.000 dòng cho thứ oRPC cho không.
- **`RPCLink`:** sai giao thức — API mount path REST qua `@orpc/nest`, không
  serve RPC handler.
- **TanStack Query ngay từ đầu:** server-first thì không có gì cho nó cache ở
  bước 1–6; Nexora web cũng không dùng (chỉ mobile). Thêm dep + mental model
  khi chưa có consumer là nợ.
- **`cacheComponents` / `use cache`:** đổi mô hình render toàn app ngay trước
  freeze 15/10; ISR classic đủ, đã được chứng minh, và có đường migrate rõ ở P7.
- **Không prerender trang API-backed (slug list rỗng, on-demand lần đầu):**
  tránh được build-coupling nhưng deploy xong HTML chưa tồn tại, first-hit
  chậm, sitemap phải nói dối hoặc rỗng — user chốt loại 31/07.
- **Server Actions làm đường ghi mặc định (mô hình Nexora):** phá budget
  rate-limit per-IP của enquiry/newsletter (dồn mọi khách vào 1 IP server),
  và với Better Auth cookie-session thì browser-direct tự nhiên hơn — Nexora
  cần Server Actions vì token Supabase nằm ở server, tiền đề đó không còn.
- **On-demand revalidation ngay từ bước 1:** cần module mới phía API — phình
  phạm vi bước đầu tiên; tag đã cắm sẵn nên hoãn không tốn chi phí cắm lại.

## AMEND 1 — 07/09/2026 (đợt W3, audit 05/09 cụm 5 + 7): env origin hai phía, revalidate fail-fast, metadata theo môi trường

### §6 Env — `API_URL` CHỈ có nghĩa phía server; production thiếu là THROW

Audit cụm 7 (Vừa): `apiOrigin()` cũ chạy trong CẢ bundle browser với nhánh
`API_URL` không bao giờ tồn tại ở đó (Next chỉ inline `NEXT_PUBLIC_*`) — cấu
hình "`API_URL` riêng cho server" như `.env.example` mô tả làm SSR xanh nhưng
MỌI nút ghi từ browser bắn về fallback `http://localhost:3001`. Chốt:

- Tách `serverApiOrigin()` (`API_URL || NEXT_PUBLIC_API_URL`) và
  `browserApiOrigin()` (CHỈ `NEXT_PUBLIC_API_URL`); `client.ts` chọn theo
  `typeof window`.
- **Production mà thiếu giá trị → throw lúc gọi, message nêu tên biến**
  (gương `parseEnv` fail-fast của API) — KHÔNG rơi về `localhost:3001`;
  dev/test giữ fallback localhost cho tiện.
- Lõi thuần `resolveApiOrigin({ side, env, nodeEnv })` để test đủ 4 ca × 2
  phía; chuỗi rỗng vẫn là "không khai" (gotcha nền tảng deploy gửi `""`).

### §3 — `/api/revalidate` fail-fast production + whitelist GƯƠNG `tags.ts`

- `resolveRevalidateSecret({ REVALIDATE_SECRET, NODE_ENV })`: production
  thiếu/rỗng → **throw** (trước đây rơi về `DEV_REVALIDATE_SECRET` hard-code
  — audit cụm 5 mức Cao); dev giữ fallback dev-secret khớp phía API.
- `TAG_RE` thêm `site-media`: whitelist phải gương ĐỦ taxonomy `lib/api/tags.ts`
  (tag này có trong `TAGS` từ trước mà whitelist bỏ sót — lệch taxonomy).
- Route trả thêm `Cache-Control: no-store` + `X-Robots-Tag: noindex` (header
  rẻ, cắt luôn dù route handler vốn không vào sitemap).

### §7 (MỚI) — Metadata theo môi trường

- Root layout khai `metadataBase: new URL(siteUrl())` — canonical/OG tuyệt
  đối trỏ `NEXT_PUBLIC_SITE_URL`, không tự trỏ host đang phục vụ (preview
  Vercel, apex).
- `robots.ts`: ngoài production (`VERCEL_ENV !== 'production'`) →
  `disallow: '/'`, không `sitemap`; production giữ rule hiện tại. Lõi thuần
  `robotsFor(env)` có spec.
- `(auth)/layout.tsx` chỉ export `metadata.robots = { index: false,
  follow: false }` — sáu trang auth hết index (`/reset-password?token=…`);
  KHÔNG thêm `disallow` vào robots.txt (comment sẵn trong `robots.ts` giải
  thích: chặn crawl thì crawler không đọc được noindex).
- `images`: `remotePatterns` pathname siết `/<cloud>/**` theo
  `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (thiếu → fallback `/**` + `console.warn`
  lúc build); `minimumCacheTTL: 86400`; `loaderFile` chèn
  `f_auto,q_auto,w_<width>` như ADR-0020 §Hệ quả đã đòi từ 14/08 — loader
  thuần, idempotent với URL đã có transformation, URL ngoài Cloudinary trả
  nguyên.

Security header + CSP của vỏ web nằm ở [ADR-0038](0038-web-shell-security-headers.md).

## AMEND 2 — 07/09/2026 (vòng vá review W3): origin chuẩn hoá, ảnh chỉ loader, metadata fail-fast, robots theo host

### §6 Env — `resolveApiOrigin` chuẩn hoá `new URL().origin`, ép https trừ loopback, gọi LƯỜI

- Web forward cookie phiên server-side tới `API_URL` (session.ts, account.ts,
  `withAuthOptions`) — lý lẽ "origin sai = exfiltrate cookie" của ADR-0026 §D
  áp nguyên cho web; và giá trị này chảy thẳng vào `connect-src` của CSP, nơi
  path thừa (`/api`) là CSP khớp-chính-xác chặn mọi call, dấu `;` cắt đôi
  header. Chốt: parse `new URL()` (chuỗi rác → throw nêu tên biến), trả
  `.origin`, **production ép `https:` TRỪ loopback** (`localhost`/`127.0.0.1`
  — `next build` nào cũng NODE_ENV=production mà CI/gate build với API tạm
  http localhost, `next start` thử tay cũng vậy). Cùng hợp đồng cho admin.
- **Gọi lười, không ở module scope**: `client.ts` `url: () => apiOrigin()`,
  `auth-client.ts` chỉ tính trong browser (`typeof window`). Bản gốc W3 vá điều
  này cho admin mà bỏ sót web: production thiếu env là throw lúc IMPORT —
  prerender chết với stack ở client.ts, chunk browser nổ khi hydrate ngoài cây
  render nên error.tsx không bắt — trái câu "throw lúc gọi" của AMEND 1.
- `next.config.ts` (`headers()`) gọi `browserApiOrigin()` một lần lúc build là
  fail-fast ồn ào đúng tầng; CI khai `NEXT_PUBLIC_API_URL` tường minh.

### §7 — `images`: CHỈ loader; `remotePatterns`/`minimumCacheTTL` là cấu hình chết

AMEND 1 khai `remotePatterns` siết theo cloud + `minimumCacheTTL` + `loaderFile`
như một bộ. Sai tiền đề: với `loaderFile`, Next 16.3 trả 404 cho `/_next/image`
(`next-server.js` `loader !== 'default' → render404`) và thay nguyên module
chứa `hasRemoteMatch` (`create-compiler-aliases.js`) — không còn optimizer,
không còn kiểm host, `minimumCacheTTL` không ai đọc. Chốt: **giữ loader** (ảnh
co ở Cloudinary, không tiêu quota Image Optimization của Vercel, đúng ý
ADR-0020 §Hệ quả), **xoá** `remotePatterns`/`minimumCacheTTL`/`console.warn`/
env `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. Không còn optimizer nên bề mặt "proxy
ảnh cho cloud lạ" (audit cụm 5) tự đóng; URL đến từ API của mình. Loader sửa
điều kiện nhận diện segment transformation (publicId phẳng `my_photo.jpg`,
thư mục `ab_cd/` từng bị nuốt thành URL 400; URL ký `s--…--` trả nguyên).
Bốn bề mặt `<img>` trần còn lại (review-card, avatar-upload, passport-card,
booking-receipt) chưa qua loader — nợ ghi CHANGELOG.

### §7 — `metadataBase` fail-fast; robots theo HOST request; `/account` noindex ở layout

- `siteUrl()` từng rơi im lặng về `http://localhost:3000`; nay là
  `metadataBase` nên Next ưu tiên nó hơn chuỗi fallback Vercel — thiếu env ở
  production là canonical/OG `http://localhost:3000/...` toàn site (hồi quy so
  với trước W3). Chốt: `resolveSiteUrl` production thiếu → throw nêu tên biến;
  CI khai `NEXT_PUBLIC_SITE_URL`.
- `robots.txt` từng là route TĨNH đọc `VERCEL_ENV` lúc build: "Promote to
  Production"/rollback một build preview là nướng `disallow: /` lên prod không
  log, build ngoài Vercel cũng đóng. Chốt: route **động** (`headers()`), mở
  crawl chỉ khi host request trùng host của `NEXT_PUBLIC_SITE_URL`; preview/
  apex/dev/`next start` đóng. Đúng-theo-kiến-tạo với mọi cách deploy, không cần
  `VERCEL_ENV` (gỡ khỏi `turbo.json`).
- `(site)/account/layout.tsx` mang `robots: { index: false, follow: false }`
  cho cả khu (5/7 trang từng tự khai thiếu `follow`, `profile`/`security` không
  khai) — robots.txt disallow mà không noindex là đúng anti-pattern §7 đã lên án
  cho trang auth.

### §3 — whitelist gương taxonomy ≠ API đã bust

`site-media` vào whitelist là đúng, nhưng phía API hôm nay chỉ
`reviews.moderate` gửi `tours`/`tour:<slug>`; `posts`/`site-media` chưa có
producer — ghi CÒN TREO, đừng đọc AMEND 1 thành "ảnh khe đã tươi ngay".

## AMEND 3 — 07/09/2026 (đợt W4): throttle `/api/revalidate` theo instance — "giảm nhiễu", nói thẳng giới hạn

Trả nợ W3 (CHANGELOG 07/09 mục CÒN TREO). Route `/api/revalidate` xác thực
bằng secret nhưng không có trần: ai cầm secret (hoặc một bug phía API gọi
lặp) bust được cache toàn site liên tục — mỗi lượt bust là một cơn regenerate
ISR đổ vào API Render free.

Chốt: bộ đếm in-memory **theo instance** trong `revalidate-route.ts` — hàm
thuần `RevalidateBudget`, trần **30 call/phút**, vượt trả **429 kèm
`Retry-After`** (giây còn lại của cửa sổ). API (`WebRevalidationService`) coi
429 như lỗi tạm sẵn có: log warn, KHÔNG retry (giữ hành vi hiện tại — bust
trượt thì ISR 300s tự chữa).

**Giới hạn nói thẳng, không giả vờ hơn:** web chạy serverless (Vercel) nên
mỗi instance một bộ đếm — trần thật là `30 × số instance đang ấm`, và một
đợt scale-out làm trần nở theo. Đây là lớp GIẢM NHIỄU chống vòng lặp lỗi/lạm
dụng thô, KHÔNG phải rate-limit thật; rate-limit thật cần store chung
(Redis/KV) — chưa cần cho một route server-to-server có secret, và không
đáng đổi hạ tầng sát freeze (cùng lập luận ADR-0037 gốc về store chung).
