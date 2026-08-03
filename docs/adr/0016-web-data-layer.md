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
>   "sau bước 1–4" mơ hồ.
> - **"Toast quyết ở form đầu tiên" ĐÃ CHỐT 03/08:** sonner cài thật
>   (`apps/web/package.json` — `sonner: ^2.0.7`), `<Toaster>` vendor qua
>   `@tourism/ui` mount toàn site ở
>   [apps/web/src/app/layout.tsx:102](../../apps/web/src/app/layout.tsx) (form
>   Contact/Newsletter — bước 5+6).
> - **Mock sống bổ sung `mocks/auth.ts`** — [apps/web/src/mocks/auth.ts](../../apps/web/src/mocks/auth.ts)
>   chờ bước 7 (session Better Auth); danh sách 4 mock-không-endpoint + team/offices
>   ở Quyết định 5 không đổi. Lớp catalogue (`tours`/`destinations`/`journal`…)
>   đã chết hết đúng thiết kế của mục này.
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
