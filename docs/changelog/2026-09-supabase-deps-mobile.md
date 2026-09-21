# CHANGELOG — lưu trữ: đóng bề mặt Supabase, Dependabot, và template mobile (09/09/2026)

Tắt Data API và Auth của Supabase, đóng 26 cảnh báo Dependabot, và dựng khung
ứng dụng điện thoại đầu tiên trên Expo SDK 57.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-09-09 — Đóng nốt hai alert cuối: `maplibre-gl` 5.24.0 → 6.4.1, tự phục vụ worker, và cấu hình Dependabot (nhánh `fix/maplibre-v6`, **CHƯA merge**)

Sau đợt trước còn đúng **hai alert** — cùng MỘT lỗ hổng `GHSA-jrc7-96c5-q579`
(CVE-2026-85061, CVSS 10.0) bị GitHub đếm hai lần vì khớp ở hai manifest. Dòng
5.x **không bao giờ có bản vá** (5.24.0 là bản cuối), nên đóng chúng bắt buộc
nhảy major. Lần trước đã cắt đường thực thi bằng `attributionControl: false`,
nên đợt này không gấp theo giờ — có quyền chọn bản ngấm lâu thay vì bản mới nhất.

**Chọn 6.4.1 chứ không phải 6.8.0.** Từ **6.7.0**, `new Map()` NÉM
`GPUInitializationError` khi không tạo được WebGL2 thay vì bắn event `error` —
mà constructor của ta nằm trong `useEffect`, nên throw sẽ leo lên `app/error.tsx`
và nuốt NGUYÊN trang `/contact` (form liên hệ, địa chỉ, tất cả) chỉ vì một ô
trang trí. 6.4.1 giữ đúng hành vi hôm nay, lại ngấm lâu nhất trong các bản đã vá
(21,8 ngày so với 1,4 ngày của 6.8.0) và có delta nhỏ nhất — đúng tiêu chí trước
freeze 15/10. Vẫn bọc `try/catch` quanh constructor làm bảo hiểm rẻ.

**Cái suýt giết cả đợt, và `pnpm gate` không bao giờ thấy nó.** Từ 6.x worker
không còn dựng từ `blob:` mà nạp từ URL thật, và nó `import` file anh em
`maplibre-gl-shared.mjs` bằng đường dẫn tương đối. Tài liệu maplibre nói thẳng về
Next.js: Turbopack biến `new URL(…, import.meta.url)` thành asset băm mà **không
phát ra file anh em**, hậu quả nguyên văn là *"the map mounts but never requests
a tile"*. Không exception, build xanh, gate xanh, bản đồ prod trắng. Lời giải:
`apps/web/scripts/copy-maplibre-worker.mjs` chép hai file vào `public/maplibre/`,
nối vào đầu chuỗi `build` và `dev`, cộng `setWorkerUrl(…)` ở module scope.

Rồi chính lời giải đó đẻ ra chế độ hỏng im lặng **thứ hai**: một lần Turborepo
cache HIT sẽ khôi phục `.next` mà không tạo lại `public/maplibre/`. Nên
`turbo.json` phải khai `public/maplibre/**` trong `outputs` của task `build`, và
thư mục đó vào `.gitignore` vì là artifact.

**Một lỗ CSP có sẵn, lộ ra nhờ đợt này:** `child-src` đang là `blob:` — thiếu
`'self'`. `child-src` là fallback cho browser chưa hiểu `worker-src`, nên đúng
những browser đó sẽ chặn worker same-origin mới, và chỉ ở đó bản đồ mới trắng.
Bẫy này không lộ khi tự kiểm bằng Chrome mới. Đã sửa thành `child-src 'self' blob:`.

**Nghiệm thu — `gate:int` xanh không đủ, phép đo quyết định là ĐẾM TILE.** Cả hai
chế độ hỏng trên đều không sinh lỗi, còn spec thì luôn mock `./contact-map` (jsdom
không có WebGL). Quét bằng chromium thật trên `next start`: worker và file anh em
đều HTTP 200, **36 tile tải về**, 2 marker, 3 link attribution, form liên hệ còn
sống, 0 CSP violation, 0 lỗi console, 0 request hỏng. Pixel canvas stdev
30,8/28,6/27,3 — gần trùng khít bản 5.24 (30,9/28,6/27,3). Lý do và cách lặp lại
phép đo ở [ADR-0018 AMEND 2](../adr/0018-web-map-library.md).

**PR Dependabot #3 bị đóng, và có `.github/dependabot.yml` mới.** PR #3 mang nhãn
"1 update" nhưng diff còn nâng `vitest` 4.1.11 → **5.0.0** ở cả 8 `package.json` —
một cú nhảy MAJOR mà không advisory nào đòi (mọi alert vitest đã vá ở 4.1.11 cùng
ngày), và Vitest 5 đổi mặc định `extends` trong `test.projects` từ `false` sang
`true`, đúng thứ cấu hình `testTimeout` vừa thêm đang dựa vào. Repo trước đó
KHÔNG có cấu hình Dependabot nào. File mới khai tường minh lập trường: nhận bản vá
bảo mật, KHÔNG nhận version update (`open-pull-requests-limit: 0`), phủ đủ 10
manifest bằng `directories` số nhiều, và ghi rõ hai thứ cố ý không dùng
(`target-branch` sẽ TẮT security update; `cooldown` chỉ chạm version update).

Ghi để khỏi ảo tưởng: `ignore` với `version-update:semver-major` KHÔNG chặn được
ca đã xảy ra — vitest 5.0.0 đi kèm một PR *security*, không phải PR version-update.
Phanh thật nằm ở nếp vận hành: đọc `gh pr diff` trước, không merge thẳng PR
Dependabot bao giờ.

Tests after: gate:int xanh — web 122 file · admin 80 · api 47 unit và 37 int ·
contract 16 · ui 5 · i18n 2 · tokens 2. Không thêm test mới; lớp canh cho đợt này
là bộ quét chromium, không phải spec.

## 2026-09-09 — Đợt Dependabot 26 alert: đóng `/_next/image` admin, cắt đường sanitize maplibre, nâng next/vitest/js-yaml/hono, nâng trần test (5 nhánh, rebase thành chuỗi tuyến tính rồi ff vào `main`)

Sáng 09/09 GitHub mở 26 Dependabot alert (8 critical, 4 high, 14 medium) đúng
**7 giây sau** cú push merge P5a — nên thoạt nhìn như hệ quả của nó. Không phải:
đối chiếu `published_at` từng advisory thì **23/26 là advisory công bố tối
08/09** (một đêm dày: Next, MapLibre, Vitest, Hono, js-yaml, sharp cùng nổ), và
độ trễ advisory→alert đo trên chính repo này qua 34 alert đã đóng là 1,3–11,8
giờ; hai lô lịch sử (04/08, 02/09) nổ khi KHÔNG có push nào. P5a thật sự tạo ra
đúng **3 alert** — `image-size` ×2 và `decode-uri-component`, đều vào qua
metro/expo-router, không cái nào chạm web/api/admin đang chạy.

26 alert thực chất là **8 gói**: GitHub đếm lặp mỗi gói một lần cho từng manifest.
Riêng `vitest` chiếm 10 alert và chỉ chạy ở máy dev với CI.

**Phát hiện quan trọng nhất lại không phải một bản nâng version.** Trong cả 26
alert chỉ có MỘT chỗ mà code của dự án đang phục vụ một đường dính, không cần
đăng nhập: `/_next/image` của admin. Ba dữ kiện cộng lại mới thành vấn đề —
`next.config.ts` khai `remotePatterns` `res.cloudinary.com` `pathname: '/**'`
với loader mặc định (optimizer BẬT); `proxy.ts` matcher cố ý loại `_next/image`
khỏi cổng gác (optimizer chạy VÔ DANH); và admin không import `next/image` ở
đâu cả, nên khối cấu hình đó chỉ có tác dụng mở endpoint. Host
`res.cloudinary.com` đa-tenant nên `'/**'` khớp tài khoản của bất kỳ ai. Đây
đúng bề mặt mà audit 05/09 cụm 5 nêu và ADR-0016 AMEND 2 §7 đã đóng cho
`apps/web` — admin bị sót trong chính đợt đó.

Năm nhánh, **thứ tự merge 1→2→3→4→5**; nhánh 4 xếp chồng lên nhánh 3 vì cả hai
cùng sửa `pnpm-lock.yaml`, nhánh 5 chồng lên nhánh 4 vì entry này nằm ở đó.

Lúc merge, cả năm được rebase thành MỘT chuỗi tuyến tính rồi đẩy lên và **chờ CI
xanh trên đúng commit cuối** trước khi `--ff-only` vào `main` — vì rebase đổi
hash nên đèn xanh của từng nhánh trước đó không còn áp cho commit mới. Bỏ bước
đó chính là cách `main` đỏ âm thầm sáng nay.

1. **`fix/admin-image-endpoint` `1da928e1`** — `images: { unoptimized: true }`,
   xoá `remotePatterns` chết. Chọn đóng hẳn thay vì siết `pathname` vì không có
   consumer nên mọi hàng rào đều là cấu hình chết. Lý do đầy đủ ở
   [ADR-0026 AMEND 5](../adr/0026-p4-admin-app.md), kể cả điều KHÔNG chứng minh
   được: chưa xác minh được trên Vercel thì `/_next/image` do optimizer nền
   tảng hay bundle của mình phục vụ — nên chọn hành động đúng dưới CẢ HAI giả
   thuyết, còn nâng `next` thì chỉ đúng dưới một.
2. **`fix/maplibre-attribution` `fcebfbbe`** — `GHSA-jrc7-96c5-q579` (CVSS
   10.0): `DOM.sanitize()` của maplibre 5.24 duyệt live `NamedNodeMap` trong lúc
   xoá thuộc tính nên bỏ sót. Đọc source bản đang cài: `sanitize(` có ĐÚNG MỘT
   call site sản phẩm (`attribution_control.ts:177`), và chuỗi vào là HTML THÔ
   tải runtime từ TileJSON của `tiles.openfreemap.org` — host thứ ba; web lại cố
   ý không dùng nonce nên CSP có `'unsafe-inline'`, không đỡ. Dòng 5.x không có
   bản vá (5.24.0 là bản cuối), bản vá duy nhất là 6.4.1 tức nhảy major kèm
   ESM-only. Nên cắt đường thực thi: `attributionControl: false` (map.ts:826 chỉ
   `addControl` khi option truthy). Nghĩa vụ ODbL giữ nguyên — attribution render
   lại bằng React đủ ba nguồn. [ADR-0018 AMEND](../adr/0018-web-map-library.md)
   tách rành mạch NGHĨA VỤ khỏi CƠ CHẾ, thứ mà §7 cũ gộp làm một.
3. **`fix/deps-cheap` `1c15d2ab`** — vitest 4.1.10 → 4.1.11 ở 8 `package.json`
   (đóng 10 alert), override js-yaml → 4.3.2, override hono → 4.13.5. Không món
   nào nằm trên đường phục vụ request thật.
4. **`fix/next-sharp` `f15f2b1d`** — next 16.3.0 → **16.3.4** và override sharp
   `>=0.35.0` → `^0.35.4`, hai thứ KHÔNG tách rời được (xem dưới).
5. **`fix/test-timeout-web-admin` `26c7f846`** — trần test của web/admin, xem mục riêng dưới.

**Cái bẫy im lặng của đợt này, ghi kỹ vì nó sẽ quay lại.** PR Dependabot #2 nhắm
`next@16.3.3`; đi theo nó là sai. 16.3.3 vá bằng cách TẮT hẳn tối ưu AVIF, còn
16.3.4 BẬT LẠI vì sharp 0.35.4 đã mang libheif đã vá — đo được ở
`optionalDependencies.sharp`: 16.3.3 khai `^0.35.3`, 16.3.4 khai `^0.35.4`. Mà
override của pnpm THAY THẾ version spec ở mọi tầng, nên dải rộng `'>=0.35.0'` cũ
nuốt mất đúng ràng buộc `^0.35.4` đó và `--frozen-lockfile` sẽ vui vẻ giữ
0.35.3. Tổ hợp **next 16.3.4 cộng sharp 0.35.3 tệ hơn đứng yên ở 16.3.0**. Vì
vậy có một cổng bắt buộc, đã chạy chứ không suy đoán: sau install lockfile phải
ra `sharp@0.35.4` (đạt), và `pnpm install --frozen-lockfile` — đúng lệnh CI —
exit 0 nên không cần thêm mục `minimumReleaseAgeExclude` nào.

**PR Dependabot #2 không merge được và cũng không nên.** `mergeStateStatus:
BLOCKED`, `gate` đỏ ngay ở `pnpm install --frozen-lockfile` với
`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` do hai gói bắc cầu chưa đủ 24 giờ tuổi
(`@maplibre/maplibre-gl-style-spec@26.4.2`, `electron-to-chromium@1.5.425`).
Ngoài ra nó gộp một major bump (maplibre 5→6) chung với bản vá critical trong
một cú push mà push main là Vercel tự deploy.

**Cố ý bỏ qua, có lý do đo được:**

- `image-size` ×2 (high, `#52` `#53`) — **không tồn tại bản vá ở bất kỳ phiên bản
  nào**: `dist-tags` cho `latest: 2.0.2` (04/2025) mà advisory ghi phạm vi
  `<= 2.0.2` với `first_patched_version: null`. Đường sống là metro lúc bundle,
  đọc asset của chính repo; app mobile chưa phát hành.
- `decode-uri-component` (medium, `#54`) — bản vá duy nhất 0.5.0 là ESM-only còn
  consumer `query-string@7.1.3` là CJS khai `^0.2.2`, override sẽ vỡ. Chỉ chạm
  `apps/mobile` (parse deep link).

**Trần test 5000ms: bốn lần đỏ trong một ngày, ba package — và nhánh 5 chữa
nó.** `apps/web` và `apps/admin` không khai `testTimeout` nên dùng mặc định
5000ms, trong khi `pnpm gate` chạy `turbo run build typecheck test` trong MỘT
đồ thị (concurrency mặc định 10) — vitest jsdom chen chỗ với `next build` của
chính package mình và của 4 package khác. Đo 09/09: test chậm nhất lúc máy rảnh
1115ms, dưới tải gate 3096ms, tức chỉ còn **1,6x biên**. Sự cố trong ngày:
mobile đỏ CI (session P5a vá bằng `testTimeout: 60_000` cho jest, `fbb945af`),
`apps/web` đỏ 2 lần ở máy dev rồi xanh lại ở đúng cùng commit
(`register-form.spec.tsx` timeout 5s, `otp-form.spec.tsx` lệch đếm ngược 1
giây), và `apps/admin` đỏ trên CI ở `decide-actions.spec.tsx` rồi **xanh khi
rerun mà không đổi một dòng code nào**.

Ba điều rút ra, vì "nâng trần" một mình là lời giải sai:

- **`otp-form` 59s/58s KHÔNG phải lỗi trần.** Gốc là
  `advanceTimersByTimeAsync(5000)` không bọc `act`, nên React commit dở dang:
  `countdownBefore` chụp DOM giữa chuỗi setState đang xếp hàng, phần còn lại
  commit tiếp trong lúc `findByText` bơm React. Nâng trần không chạm tới phép so
  sánh này, thậm chí cho chuỗi tồn đọng thêm thời gian trôi. Đã sửa gốc bằng
  vòng `act` từng nhịp — đúng mẫu mà CHÍNH FILE ĐÓ đã dùng ở hai test resend.
- **Nâng `testTimeout` mà quên `asyncUtilTimeout` là che bệnh có hại.** Trần
  async của testing-library là 1000ms và nằm BÊN TRONG trần Vitest, nên runner
  chậm chỉ ĐỔI KIỂU đỏ: từ `Test timed out` sang `Unable to find role=…` —
  trông y hệt lỗi sản phẩm thật. Đó chính là dòng 326 của `decide-actions`, một
  **nạn nhân dây chuyền** chứ không phải lỗi độc lập (Vitest hết giờ thì đánh
  dấu hỏng nhưng không huỷ được chuỗi async đang chạy, userEvent bỏ dở lái DOM
  sang test sau trong khi RTL đã cleanup). Đừng đi chữa dòng 326.
- **`testTimeout` chưa bao giờ là phanh chống treo, và repo đang không có
  phanh.** `ci.yml` không đặt `timeout-minutes` nên mặc định GitHub là **360
  phút**: một promise không bao giờ resolve sẽ ngốn 6 giờ runner. Nay đặt
  `timeout-minutes: 25` (~2,5x run xanh dài nhất đo được, 10,1 phút).

Nhánh 5 vì thế gồm bốn thay đổi: `testTimeout`/`hookTimeout` 30s ở cấp gốc
`test:` của web và admin (đủ cho cả hai project vì cả hai khai `extends: true`
— Vitest 4.x mặc định `extends` là FALSE, dòng đó là load-bearing), 
`configure({ asyncUtilTimeout: 5000 })` trong hai file setup, sửa gốc `act` ở
`otp-form.spec.tsx`, và `timeout-minutes` trong `ci.yml`. Con số 30s khác 60s
của mobile là CỐ Ý: ở mobile đo được `renderRouter` cold 9,2s, vitest không có
chi phí tương đương. Cái giá ghi thẳng ra: một test treo thật nay ngốn 30s thay
vì 5s, và mỗi `waitFor` thất bại tốn 5s thay vì 1s.

**CÒN TREO:**

1. **Nghiệm thu `/contact` bằng mắt.** `gate:int` xanh KHÔNG chứng minh bản đồ
   còn vẽ được: không có `contact-map.spec.tsx`, và `contact-location.spec.tsx`
   mock nguyên module vì jsdom không có WebGL. `map-attribution.spec.tsx` mới chỉ
   canh phần ghi công. Một bản đồ trắng đi qua được cả gate lẫn build Vercel.
2. **Đóng PR Dependabot #2** và dismiss 3 alert cố ý bỏ qua kèm lý do.
3. **Tách `decide-actions.spec.tsx:298` thành `it.each`.** Một `it()` đang ôm
   bốn luồng wizard và chi phí tăng theo SỐ MÃ stale của contract (`aa89d844`
   vừa thêm `OVER_TOTAL`, +33%), nên nâng trần chỉ dời ngày đội trần chứ không
   xoá. Repo đã có tiền lệ chữa đúng bệnh này ở `refund-panel` (07/09) — mỗi mã
   một ngân sách riêng, cleanup riêng, và khi đỏ thì báo đúng mã nào.
4. **maplibre 5→6** là nhánh TUỲ CHỌN, chưa làm: ESM-only, phải gọi
   `setWorkerUrl`, chế độ hỏng là bản đồ trắng im lặng. Nếu làm thì nhắm 6.4.1
   hoặc 6.6.0, KHÔNG nhắm bản `latest` mới vài ngày tuổi — trước freeze 15/10 thì
   thứ cần là bản có nhiều thời gian ngoài đời nhất.
5. Alert `maplibre-gl` VẪN MỞ sau nhánh 2: bản vá cắt đường thực thi chứ không gỡ
   lỗ hổng khỏi cây phụ thuộc.

Tests after (gate:int nhánh 4, lượt xanh): web 122 file · admin 80 · api 47 unit
và 37 int · contract 16 · ui 5 · i18n 2, tổng 25/25 task turbo cộng 5/5 của
test:int. Thêm `map-attribution.spec.tsx` (2 test) là lớp canh mới duy nhất.
## 2026-09-09 — Đóng bề mặt Supabase: tắt Data API và Supabase Auth (thay đổi HẠ TẦNG sống, không có commit code)

Xuất phát từ mail advisor Supabase 08/09 báo CRITICAL `rls_disabled_in_public`
"as of 06 Sep". Cảnh báo đó **đã hết hạn khi mail tới**: hai bảng thiếu RLS
(`enquiry_status_events` deploy 03/09, `tour_cost_items` deploy 05/09) đã được
migration `20260906150000_w2_rls_backstop_new_tables` vá, chạy trên Supabase lúc
07/09 00:43 UTC — tức sau lượt quét 06/09. Không phải sự cố.

Rà tiếp thì lộ bề mặt thật: `anon` và `authenticated` có đủ 7 quyền trên cả 36
bảng `public`, PostgREST mở chúng ra Internet, chỉ RLS đứng giữa. User đã đóng
lúc 08:33–08:37 giờ máy (01:33–01:37 UTC), dựng lại được từ log nền tảng:

1. **Data API tắt** (Integrations → Data API), kèm workaround SQL của Supabase để
   log khỏi kêu `pg_pgrst_no_exposed_schemas`: tạo một schema rỗng và
   `alter role authenticator set pgrst.db_schemas = 'pgrst_no_exposed_schemas'`.
2. **Supabase Auth**: tắt provider Email (mọi provider nay `false`), xoá dòng
   `auth.users` duy nhất (`user_deleted` lúc 01:37:04Z, do service_role qua mgmt-api).

**Nghiệm thu** — 6 agent đo song song rồi một lượt critic bới lại: REST trả 404
`PGRST205` với **cả hai** khóa đang bật (anon legacy và `sb_publishable_…`),
GraphQL 406 `PGRST106`, OpenAPI root 401, RPC 404. Kèm đối chứng SQL rằng dữ liệu
vẫn còn (`tours` 29 dòng, `users` 63, `bookings` 159, `payment_events` 197) nên 404
là **bị chặn** chứ không phải bảng rỗng. Chính PostgREST tự khai trong log:
*"Schema cache loaded 0 Relations, 0 Relationships, 0 Functions"*. Prod không gãy:
51/51 URL trong sitemap trả 200, `/health` trả `{"status":"ok","database":"up"}`,
uptime cộng khớp từng giây qua hai lần đo nên không có restart âm thầm. Advisor
còn **0 error, 7 warning** (giảm từ 8 — lint leaked-password tự rút sau khi tắt
provider Email) và 36 cộng 31 suggestion, tất cả đã xét và ghi lý do.

Chi tiết, cách kiểm lại, thứ tự hoàn tác và danh sách cố ý bỏ qua nằm ở convention
mới [supabase-data-api-surface](../conventions/supabase-data-api-surface.md).

**Hai phát hiện ngoài phạm vi, nêu để khỏi rơi:**

- Trang `/privacy` đang sống nói *"Sign-in is handled by our authentication provider
  (Supabase); we never see or store your password."* — sai: xác thực là Better Auth,
  và `public.accounts` đang giữ **60/63 hash mật khẩu** trong DB của chính dự án.
  Từ 09/09 câu đó sai gấp đôi vì Supabase Auth đã tắt hẳn. Nguồn
  `libs/shared/i18n/src/lib/legal/privacy.ts` dòng 25 và 55. Đây là văn bản pháp lý
  công khai, sẽ bị hỏi khi bảo vệ.
- `TRUST_PROXY` vẫn chưa đặt, nay đo được bằng chính `/health`: hai lần gọi trả
  `clientIp` khác nhau (`162.159.98.183` rồi `172.71.81.2`, đều là edge Cloudflare)
  trong khi `forwardedFor` cho thấy IP thật nằm ở phần tử trái nhất. Rate limit theo
  IP đang gộp cả Internet vào vài bucket và còn nhảy bucket giữa các request.

**CÒN TREO:**

1. `ALTER FUNCTION public.refunds_sum_within_total() SET search_path = public, pg_temp;`
   — migration MỚI, kẹp vào lần migration kế tiếp (user dự tính reset và seed lại dữ
   liệu, làm luôn ở đó).
2. Sửa hai dòng `privacy.ts` nói trên.
3. Đặt `TRUST_PROXY` rồi mới bật `PUBLIC_READ_THROTTLE_MODE=enforce` (nợ từ W4).
4. `disable_signup` vẫn `false` — hiện vô hại vì mọi provider đã tắt, nhưng bật lại
   một provider là signup mở ngay, không còn lớp thứ hai. Bật "Allow new users to
   sign up" = OFF nếu muốn phòng hai lớp.
5. Cân nhắc revoke bớt quyền ghi của `anon`/`authenticated` trên 36 bảng — hiện vẫn
   đủ 7 quyền, chỉ bị chặn bởi RLS deny-all và việc Data API đã tắt.

**Một vết do chính đợt nghiệm thu để lại, đã kiểm:** phép đo Realtime bằng WebSocket
thật đánh thức tenant, khiến Supabase tự chạy DDL — partition `realtime.messages`,
publication `supabase_realtime_messages_publication`, và một logical replication
slot. Slot đã tự biến mất khi tenant ngủ lại (`pg_replication_slots` rỗng lúc 02:0x
UTC), publication ở lại và vô hại. Bài học đã ghi vào convention: đó là phép đo
GHI, không được dùng trong session thi công (CLAUDE.md §15).

Tests after: không đổi — entry này không kèm commit code.

## 2026-09-09 — P5a template mobile: khung Expo SDK 57 + `@tourism/mobile-ui` (nhánh `feat/p5a-mobile-template`, **16 commit ff vào main**: 10 thi công `ecc62bcf..3401ce53`, 4 vá review `37ce65b1..1beab567`, 1 nâng dep `97df1611`, cộng commit docs này — không migration)

Session thi công theo [spec P5a](../specs/2026-09-08-p5a-mobile-template-design.md)
và [ADR-0040](../adr/0040-mobile-app-expo.md). Mở phase P5. Không migration,
không chạm `apps/api`/`apps/web`/`apps/admin`, không chạm hạ tầng sống
(CLAUDE.md §15). Bảy task của spec ra sáu commit — T7 (CI + runbook + docs
sweep) đi cùng chính entry này.

**CỔNG tsgo × React Native (spec §4.1): XANH.** TypeScript 7.0.2 (tsgo)
typecheck được codebase RN sau khi khai `types` tường minh trong tsconfig —
đúng gotcha 04/08 mà spec đoán trước. Không đo bằng "chạy không báo lỗi": chèn
một lỗi prop RN thật (`numberOfLines` trên `View`) thì tsgo báo TS2769 đúng
dòng, gỡ ra thì xanh lại. Dùng `types: ["jest", "expo/types"]` chứ KHÔNG
`@types/node` — `expo/types/metro-require.d.ts` đã khai `process.env`, và Node
type trong app RN là sai bản chất. Vì cổng xanh nên **không cần AMEND
ADR-0040 §7**, và `apps/mobile` KHÔNG được cấp compiler riêng.

- **T1 `ecc62bcf` — scaffold + toolchain.** `@tourism/mobile` với expo
  57.0.20 · expo-router 57.0.19 · RN 0.86.3, `.env.example`/`.env.local` +
  `src/lib/env.ts` fail-fast (chuỗi rỗng coi như THIẾU, đúng gotcha env của
  repo), task turbo `bundle` (cố ý không tên `build`). `pnpm-workspace.yaml`
  KHÔNG đổi một dòng; không có `metro.config.js` nào và `expo export` vẫn
  bundle được cả hai nền tảng — đúng dự đoán ADR-0040 §6.
- **T2 `65dab998` — `@tourism/mobile-ui` + ThemeProvider.** Package mới ở
  `libs/mobile/ui`, cấm phụ thuộc `@tourism/ui`. `theme-provider.tsx` là chỗ
  DUY NHẤT import `@tourism/tokens/theme`. `MOBILE_COLOR_KEYS` là danh sách
  màu curated — đổi tên token thì `buildTheme()` ném lỗi nêu đúng tên khoá.
  Spec canh tokens-only bằng máy: quét `#[0-9a-fA-F]{3,8}` trong `src/lib` và
  assert rỗng, kèm một test tự-kiểm để cái quét không thành test rỗng luôn xanh.
- **T3 `f3e6d8b1` · T4 `9840d606` — sáu primitive.** `Screen` · `AppText`
  (6 bậc chữ theo vai trò) · `Button` (3 vai, `disabled` CHẶN `onPress` thật,
  `accessibilityRole`) · `Card` · `EmptyState`. Không `fontSize` hay hex viết
  tay ở đâu; test duyệt từng bậc/từng vai và đối chiếu thẳng với cầu token.
- **T5 `20a4c467` — copy vào `@tourism/i18n`.** Khối `mobile.appShell`: 11
  tiêu đề màn, ô giữ chỗ, copy `+not-found`. Năm nhãn tab tách hằng
  `MOBILE_TAB_COPY` dùng chung cho cả thanh tab lẫn tiêu đề màn.
- **T6 `515920f6` — cây route.** Đúng cây spec §3: `(tabs)` 5 màn, `(auth)` 3
  màn mở dạng modal, `tours/[slug]`, `bookings/[code]`, `+not-found` có nút
  quay về. Mọi màn là ô giữ chỗ — không mock data, không gọi API, không auth
  thật, không bố cục theo `docs/navel/`. Test dựng cây THẬT bằng
  `renderRouter('src/app')`.
- **T7 (entry này) — CI + runbook + docs.** `.github/workflows/ci.yml` thêm
  step *"App mobile bundle được"* (không cần Postgres/API); runbook mới
  [conventions/mobile-dev-loop](../conventions/mobile-dev-loop.md).

**Một chỗ lệch phạm vi spec, nêu thẳng để review cân.** Spec §"Đụng" không
liệt kê `libs/shared/tokens`, nhưng cầu `rn-convert` từ P0 chỉ mang màu và bo
góc — không mang type scale. Mà spec §5 đòi *"AppText lấy đúng số từ token,
không hardcode fontSize"* và ADR-0013 hứa *"đổi brand = sửa MỘT file"* nay phủ
cả mobile. Nên thêm `toRnScale()` đọc `themeExtras`/`rootExtras` (vốn đã có
`--text-*`, `--font-weight-*`, `--spacing`, `--touch-target-min`) và phát ra
`type`/`weight`/`spacing`/`touchTargetMin` theo dp. Bán kính nổ bằng không, đo
chứ không đoán: `generated/tokens.css` giữ nguyên TỪNG BYTE (diff trước/sau),
nên web và admin không đụng gì.

**Bảy thứ phải chạy thật mới biết** (chi tiết ở runbook §5–6): `newArchEnabled`
đã bị gỡ khỏi schema app config SDK 57 nên để lại là expo-doctor đỏ · `jest`
phải là `~29.7.0` vì jest-expo@57 khai dependency ở `^29.2.1` (với Jest 30,
runtime winter của expo ném *"import a file outside of the scope of the test
code"*, thông báo không nhắc gì tới phiên bản) · RNTL 14 chuyển API sang bất
đồng bộ, chưa `await render()` thì `screen` rỗng · `renderRouter` gắn
`getPathname()` lên chính Promise đó nên `await` là mất, và `return app` trong
hàm `async` cũng tự await thenable · `@orpc/*` chỉ có ESM và app kéo vào gián
tiếp qua i18n → contract, phải nới CẢ `transformIgnorePatterns` lẫn `transform`
(mẫu `\.[jt]sx?$` không khớp `.mjs`) · expo-router KHÔNG bỏ qua `.spec.tsx`
nên spec cây route phải nằm ngoài `src/app` · alias `@/*` của tsconfig chạy
thẳng ở Metro, không cần cấu hình thêm.

**Nghiệm thu đã chạy (dán từ máy, không nói suông):** `pnpm gate:int` trọn với
API tạm :3001 trên docker theo công thức CI — 25/25 task, lint sạch, int
496/496 · `pnpm turbo run bundle --filter=@tourism/mobile` xanh (iOS 1254
module / Android 1380 module) · `pnpm exec expo-doctor` 21/21 ·
`./scripts/check-rls.sh` xanh · `grep -rn --exclude-dir=.expo "eslint\|prettier"
apps/mobile libs/mobile` rỗng · `git status --short docs/navel` rỗng.
(Cổng grep phải loại `.expo/`: `expo start` sinh `.expo/types/router.d.ts` mang
`/* eslint-disable */`, nên bản không loại KHÔNG BAO GIỜ xanh trên máy đã chạy
dev server — kể cả chính máy vừa nghiệm thu. Thư mục đó gitignore, không có
ESLint nào vào repo.)

**Vòng vá review ở session gốc (4 commit `37ce65b1..704f5266`).** Review 8 mũi
theo miền (toolchain · cầu token · primitive a11y · route/deep-link · env/bí mật ·
i18n · test xanh giả · tài liệu), 10 phát hiện, tất cả CONFIRMED. Vá theo bốn cụm:

- **Điều hướng** (`37ce65b1`): thiếu `unstable_settings.anchor` nên mọi deep
  link là ngõ cụt một chiều — không back, không đường tới tab; nhóm `(auth)`
  không có nút đóng nào (comment khẳng định ngược lại) nên vào bằng
  `nexora://login` là kẹt cứng, phải tắt app; `extra.router.sitemap: false` vì
  expo-router mặc định bật và không có guard `__DEV__` nên `nexora://_sitemap`
  mở được trong bản phát hành, in cả cây route lẫn phiên bản Hermes/SDK.
- **Primitive** (`2799c04e`): `Screen` không truyền `edges` nên cộng inset
  CHỒNG với header của navigator (~63dp dải trắng chết trên 6/12 route), và
  không cuộn/không tránh bàn phím nên màn có ô nhập thì nút gửi không chạm tới
  được. Nay `edges` tường minh kèm hai hằng `SCREEN_EDGES_UNDER_TABS`/
  `SCREEN_EDGES_UNDER_HEADER`, mặc định cuộn được, đệm vào `contentContainerStyle`.
- **Lưới nói dối** (`704f5266`): task `bundle` thiếu `inputs` nên `.env.local`
  ngoài hash và cache trả dist cũ mang localhost; đường type scale không có cổng
  chặn còn ba lớp test canh nó đều là tautology; lưới tokens-only không quét
  `apps/mobile` và bỏ sót màu không-hex; `typedRoutes` chỉ sống trên máy dev.
- **Env và bản ghi** (commit này): `env` ném ở module scope — trước cả khi cây
  React tồn tại, nên `ErrorBoundary` không bắt được và bản phát hành thiếu biến
  crash câm lúc mở; thêm kiểm dạng URL và ép `https` trừ loopback (Android chặn
  cleartext, thiếu chốt này là 100% request chết không cảnh báo); thêm
  `ErrorBoundary` gốc GỠ SPLASH (không có nó thì mọi lỗi render là splash đứng
  vĩnh viễn); bỏ tiêu đề vẽ hai lần trên 6 màn có header.

Cùng đợt, **nâng `expo` 57.0.20 → 57.0.21 và `expo-router` 57.0.19 → 57.0.20**:
hai patch upstream ra sau khi nhánh dựng làm `expo-doctor` tụt xuống 20/21. Vẫn
trong SDK 57 và trong cửa sổ trước freeze 15/10; pnpm tự thêm 9 mục vào
`minimumReleaseAgeExclude` (2 gói đích và 7 dependency bắc cầu) theo đúng nếp
các đợt Next trước. Sau khi nâng: `expo-doctor` **21/21**.

**Vá nóng sau merge (`main` đỏ một lần, 09/09).** Suite `apps/mobile` xanh ở
máy nhưng ĐỎ trên CI: `renderRouter` lần đầu nạp cả cây route qua babel-jest,
và trên runner CI (chậm hơn, cache jest nguội) riêng test đầu tiên vượt trần
5s mặc định của Jest — cả suite 126s trên CI so với ~3s ở máy, đúng MỘT test
hỏng còn 28 cái sau xanh vì cache đã ấm. Đặt `testTimeout: 60_000` cho cả hai
package mobile. **Bài học quy trình:** nhánh này chưa từng được push nên CI
chưa từng chạy trên nó trước khi merge — nếp "session thi công không push" để
lại đúng khoảng mù đó; lần sau đẩy nhánh lên để CI soi trước khi ff vào main.

**Hai phát hiện của vòng review bị BÁC sau khi đo lại:** (a) "`{...rest}` xoá
`accessibilityState` của Button" — `Pressable` của React Native ép lại `disabled`
mỗi khi prop `disabled` khác null, đã thêm test ghim lời bảo đảm đi mượn đó;
(b) "`react-test-renderer@19.2.3` lệch với react 19.2.4" — gói đó không có
trong cây (jest-expo 57 dùng `test-renderer`, resolve đúng 19.2.4).

**CÒN TREO — việc cho merge / P5b:**

1. **`react` 19.2.4 thay vì 19.2.3 theo ma trận Expo** — do `overrides` toàn
   workspace (chốt 27/07, vá bug hai bản React ở Vitest), không sửa được từ
   phía mobile. Manifest đã sửa cho đúng sự thật. `expo.install.exclude` giữ
   react VÀ typescript, nghĩa là expo-doctor KHÔNG canh hai gói đó — ADR-0040
   §7 cần AMEND cả con số lẫn câu lập luận "pnpm cô lập nên hai bản React sống
   cạnh nhau không đụng" (sai với repo này).
2. **Chưa có icon tab, icon app, ảnh splash** — `app.json` cố ý không trỏ asset
   nào. P5b.
3. **`eas.json` và Maestro chưa có** — cố ý theo ADR-0040.
4. **Tiêu đề header đọc từ i18n chưa có test** — prop native của
   `RNSScreenStackHeaderConfig` không truy được, RNTL 14 bỏ nhóm `UNSAFE_*`.
   Lớp canh i18n còn ở 5 tab và nhãn thanh tab.
5. **`bookings/[code]` chưa có gác đăng nhập** và tham số deep link chưa được
   kẹp — nợ đã ghi thành comment tại chỗ, P5b phải trả trước khi nối API.
6. **`EXPO_PUBLIC_API_URL` trong `.env.local` là `http://localhost:3001`** —
   điện thoại không hiểu địa chỉ đó. Từ P5b phải trỏ API đã deploy (nay bắt
   buộc `https` với host thật) hoặc mở thêm tunnel cho cổng 3001.
7. **Đổi dark/light chưa có mắt người xác nhận** — nhánh `useColorScheme` mới
   có test đơn vị.

Tests after: **3.257 unit** (913 admin và 1.499 web và 463 api và 255 contract
và 52 mobile-ui và 29 mobile và 22 ui và 18 tokens và 6 i18n) cộng **496 int**.
Nhánh này thêm 93 test mới: 29 mobile · 52 mobile-ui · 8 tokens · 4 i18n.
