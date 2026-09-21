# CHANGELOG — lưu trữ: bốn đợt vá bảo mật W1–W4 (06/09–08/09/2026)

Bốn đợt theo thứ tự rủi ro, mỗi đợt khép bằng một vòng review tám mũi: W1 tiền,
W2 phiên và hạ tầng, W3 vỏ Next và CSP, W4 kênh vào và email đi ra.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 21/09/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`
(đúng cách hai file lưu trữ 03/08 đã làm). Đừng mở-rồi-save bằng editor có
markdownlint: nó đổi `+` đầu dòng thành `-` và nói sai con số test đã ghi.

## 2026-09-08 — W4 merge + vòng vá review 8 mũi (nhánh `fix/inbound-channels`, 33 commit `6b3c4da..27af99b9` ff vào main: 19 thi công + 8 vá `721250f0..e513dde9` + 2 test + docs; 2 migration — `20260907115144` deploy Supabase 08/09 sớm, `20260908120000_w4_review_fixups` deploy Supabase 08/09 lúc merge, 25/25 up to date)

Review ở session gốc theo nếp review theo tầng: 8 finder theo miền (trần
đọc/cache · CSP report · consent newsletter · suppression/outbox · ký upload ·
retract/stats · R3/enquiry · test/docs), 3 verifier theo miền (39 mục: 30
CONFIRMED, 6 PLAUSIBLE, 3 REFUTED), `gate:int` trọn trong cây chính với API
tạm :3001. Khác W3, lần này có **ba lỗi nổ ngay lần deploy đầu** (trần đọc
nuốt build Vercel, endpoint CSP report đốt CPU không auth, suppression Resend
no-op vì lọc `'hard'`) và **một việc đi trước quy trình** (session thi công
tự deploy migration/webhook/env/Cloudinary → luật §15 CLAUDE.md). 10
findings, vá trong 8 commit:

- **Trần đọc (`0a165dc1`, ADR-0037 AMEND 3):** web không forward cookie cho
  GET catalog nên carve-out "GET có session" không phủ build/ISR — 61 route
  prerender × 2–6 call từ một egress IP sát trần 300/phút, `generateStaticParams`
  không settle → 429 là build đỏ; TRUST_PROXY Render chưa đo. Vá:
  `PUBLIC_READ_THROTTLE_MODE=log` mặc định (đếm + warn, không 429) tới khi đo
  `GET /health.clientIp`/`forwardedFor` từ hai mạng; `INTERNAL_READ_KEY` +
  header `x-internal-read-key` chỉ phía server web → miễn bucket đọc; bucket
  tách bằng key, tên throttler giữ `default` (header `Retry-After` chuẩn thay
  `Retry-After-read`); GET public khai `@Throttle` được miễn hẳn (comment tả
  sai); `KeyedThrottlerStorage` quét + trần 50 000 bucket (trước không bao giờ
  xoá key); `@SkipPublicCache` cho `catalog.health`; `reviews.listByTour` có
  Cache-Control. Khai key ở render.yaml, turbo, hai `.env.example`.
- **CSP report (`721250f0`, ADR-0038 AMEND 3):** dedupe quét toàn Map mỗi lượt
  không trần — đo 19 giây CPU/phút từ một IP không auth; `application/json`
  lách trần 8 KB qua parser 1 MiB (~16k report/request); dedupe đầu độc được,
  không kiểm host; `documentUri` giữ query → token reset vào log; byte NUL thô
  trong source (git coi file là binary). Vá: chỉ hai MIME qua hook 415,
  allowlist host `CORS_ORIGINS ∪ FRONTEND_URL`, bỏ query, trần 32 report/request,
  dedupe O(1) khoá gồm app + trần 5 000 + dòng `csp-report-suppressed`.
- **Consent newsletter (`1d03f6b9`, ADR-0039 AMEND 1):** GET trang huỷ mint
  `resubscribeToken` từ token huỷ không hết hạn (nhận cả v0) → hạn 30 ngày và
  khoá v0 là hư cấu; confirm không nhìn `unsubscribedAt`; `welcomeSentAt` chặn
  tuyệt đối → thư hỏng là kẹt vĩnh viễn; backfill `confirmed_at = created_at`
  không loại người đã huỷ và ĐÃ chạy prod. Vá: token đổi ý chỉ từ POST huỷ vừa
  claim; token confirm ký thêm thế hệ consent (`consentGeneration`); confirm
  compare-and-set ghi confirmedAt + xoá unsubscribedAt; predicate mailable
  chung (`mailable.ts`); gửi lại thư xác nhận sau 24h (dedupeKey theo ngày);
  `V0_ACCEPT_UNTIL` hằng; migration mới sửa backfill; panel web bỏ nút đăng
  ký lại ở trạng thái "bấm link cũ".
- **Suppression (`7f6b377e`):** payload Resend thật là `Permanent/Transient/
  Undetermined`, không `hard` → hard bounce thật không bao giờ ghi; chặn cả
  reset mật khẩu/OTP khi khách bấm spam một welcome. Vá: map đúng loại,
  `complained` chỉ chặn bản tin, bounce trên email auth WARN, secret ép
  `whsec_`; FAILED purge 180 ngày.
- **Ký upload (`d7df62e5`, ADR-0021 AMEND 2):** format ký lệch contract
  (avif/gif 400 — regression; heic chết ở client), `c_limit` không strip EXIF,
  signed upload mặc định `overwrite=true` (tráo ảnh review sau duyệt trong 10′
  chữ ký). Vá: format một nguồn, `fl_force_strip`, `overwrite:false` trong chữ ký.
- **Retract/stats (`ad90fd07`, ADR-0032 AMEND 2):** card Pending và trung bình
  sao admin đếm cả review đã rút; thiếu CHECK/index; không tab Retracted; nút
  rút không đọc mã 409. Vá: `retractedAt: null` ở `pendingReviewsAt` +
  `NOT_REJECTED` (chính sách A), CHECK `reviews_retracted_shape` + index (cùng
  migration mới), tab dựng từ enum contract, nút rút toast theo mã + refresh.
- **Outbox/R3 (`53550e9d`):** 401/403 = vĩnh viễn nên xoay key park cả batch
  FAILED; FAILED giữ PII vĩnh viễn; `user_id` enquiry không bao giờ ghi vì
  form web không gửi cookie; ack chở `message` thừa; `escapeLike` thiếu ở
  posts/reviews/payment events; `bookings.mine` `page` không trần. Vá đủ; admin
  thấy `nextAttemptAt`; controller enquiry đọc session trong try/catch riêng.
- **Test (`e513dde9`):** deliverer thật assert `DeliveryHttpError` có status;
  `X-Api-Key`/`Authorization` vào bộ che; Cache-Control cho posts/site-media/
  reviews + `/api/health` không cache; preflight csp-report hai origin; spec
  `ConfirmPanel` và `RetractReviewButton` (hai island chưa có spec).
- **Docs/luật:** ADR-0039 AMEND 1 · 0037 AMEND 3 · 0038 AMEND 3 · 0021 AMEND 2 ·
  0032 AMEND 2, spec W4 §8 AMEND, README, CLAUDE.md §15 "session thi công
  không chạm hạ tầng sống" + gotcha "comment migration không khai trạng thái
  deploy"; quy ước dedupe-key thêm hàng `<event>:<email>:<ngày>`.

Tests after: `pnpm gate:int` trọn trong cây chính (API tạm :3001 trên docker `tourism`, kill theo PID), `check-rls.sh` xanh, migration mới apply docker `tourism`/`tourism_test` và `prisma migrate diff` không drift. Tests after: 3164 unit (463 api, 255 contract, 1499 web, 913 admin, 2 i18n, 10 tokens, 22 ui) và 496 int — so bàn giao: cộng 12 api, cộng 12 web, cộng 1 admin, cộng 9 int. Một lần gate đỏ ở `register-form.spec` web (timeout 5 s dưới tải, chạy riêng 8/8 xanh, cả suite web chạy lại 1499/1499).

**CÒN TREO (cố ý):** bật `PUBLIC_READ_THROTTLE_MODE=enforce` chỉ sau khi đo
`clientIp` trên Render; đặt `INTERNAL_READ_KEY` ở CẢ Render lẫn Vercel web
(production + preview) trước lần build đầu sau merge — chưa đặt thì web vẫn
chạy, chỉ không được miễn (và ở chế độ `log` thì không 429); đường quay lại
newsletter sau cửa sổ đổi ý 30 ngày là form footer + thư xác nhận mới (không
có đường admin — consent phải từ chủ hộp thư); chưa lưu `version` Cloudinary;
suppression gỡ bằng SQL; danh sách "không làm ở W4" giữ nguyên.

## 2026-09-07 — W4 kênh vào & email đi ra — bàn giao từ session thi công (merged 08/09 cùng vòng review, xem entry trên) (nhánh `fix/inbound-channels`, 19 commit `6b3c4da..0499d2d`, 1 migration MỚI)

Đợt vá thứ tư (cuối) theo bản rà 05/09 — cụm 4 trọn, cụm 3 (upload/retract),
cụm 5 (đường đọc) và hai nợ W3. ADR đi trước code: **ADR-0039 mới** (kênh
vào & email đi ra) và AMEND ADR-0021/0032/0037/0038/0016 (`6b3c4da`). Một
migration `20260907115144_w4_inbound_channels` (`9ab97fe`) gom mọi cột/bảng:
`subscribers.welcome_sent_at` và `confirmed_at` (backfill người cũ =
`created_at`, quyết định một lần), `outbox.next_attempt_at`, bảng
`email_suppressions` (bật RLS cùng migration, check-rls xanh),
`enquiries.user_id` cộng `anonymized_at`, `reviews.retracted_at` — đã apply
docker `tourism` và `tourism_test`, và **đã deploy Supabase sớm 08/09** (xem
khối "Hạ tầng đã làm SỚM" bên dưới; bản đầu của entry này ghi "CHƯA deploy",
sửa lại cho khớp vì entry chưa merge). 16 mục, mỗi mục một commit, TDD
test-đỏ-trước:

- **E — email đi ra & outbox:** ack liên hệ bỏ khối YOUR MESSAGE + dedupe
  một-ack/địa-chỉ/ngày UTC (`fbbe6b2`); `welcomeSentAt` trong cùng tx — purge
  outbox 30 ngày hết làm welcome lặp (`682cf0d`); token
  `v1.<purpose>.<hmac>`, resubscribe mang exp 30 ngày, v0 chỉ còn nhận cho
  unsubscribe tới 31/12/2026, GET confirm phát `resubscribeToken` cho panel
  (`9d1473d`); double opt-in — thư đầu là thư XÁC NHẬN, endpoint GET/POST
  `/api/newsletter/confirm`, trang web `/newsletter/confirm`, admin cột
  Confirmed cộng filter cộng CSV, link `/privacy` dưới form footer
  (`aa93f63`); outbox backoff luỹ thừa trần 60 phút, 4xx-không-retry,
  deliverer ném lỗi mang status, admin retry reset lịch (`7b45b19`);
  suppression từ Resend — webhook svix tự cài, `email.bounced` cứng và
  `email.complained` upsert, drain SKIP mọi loại email kèm lý do vào
  lastError, thiếu env thì 503 và một dòng log boot (`1a5ce93`); redactDeep
  không phân biệt hoa/thường và hậu tố token/secret/password (`37ab587`);
  retention enquiry 18 tháng anonymize, `user_id` ghi lúc có session, nối
  vào deleteAccount cùng tx (`e55aa5e`).
- **U — upload & review:** chữ ký Cloudinary ký thêm `allowed_formats` và
  incoming `transformation c_limit,w_2400,h_2400` (strip EXIF/GPS), web gửi
  đủ, runbook dashboard hai thiết lập (`a2e1181`); `reviews.retract` trọn
  bốn tầng — trạng thái thứ tư `retracted`, requeue ảnh, recompute rating,
  bust `tour:<slug>`, admin "Retracted by author" không duyệt lại, `/terms`
  nói rõ tên hiển thị snapshot (`c6985b3`); int test U3 lộ đúng lỗ —
  `reviews.update` từng đặt lại đồng hồ GC của ảnh được GIỮ, nay chỉ requeue
  publicId thật sự rời (`e6f1557`).
- **R — đường đọc & revalidate:** GET `@Public()` đếm bucket `read` 300/60s
  theo IP, một bucket cho cả trang, GET có session và route khai `@Throttle`
  riêng không đếm — guard đổi tên `DefaultThrottlerGuard`, không guard thứ
  hai (`2ca24b0`); `PublicCacheInterceptor` gắn `public, s-maxage=60, SWR
  300` cho catalog/posts/site-media, hook onSend gỡ cache công khai khỏi mọi
  response lỗi (`0b8c74c`); `page.max(10000)`, escapeLike search catalog,
  `resolveForOwners` lọc role ngay ở query cộng select hẹp — mọi call site
  chỉ-cần-cover truyền `[hero]` (`2708ba1`); `RevalidateBudget` in-memory
  30/phút mỗi instance, 429 kèm Retry-After, đếm sau bước secret (`be7a721`).
- **C — CSP report (nợ W3):** `POST /api/webhooks/csp-report` nhận cả
  `application/csp-report` lẫn `application/reports+json`, parser giữ raw
  cộng trần 8 KB → 413, log một dòng cấu trúc dedupe (directive, blockedUri)
  10 phút, trả 204 (`88f990b`); hai app phát `Reporting-Endpoints` cộng
  directive `report-to csp` cộng `report-uri`, test map directive so bằng
  cập nhật (`0499d2d`).

`pnpm gate:int` trọn trong cây chính (API tạm :3001 trên docker `tourism`
theo công thức CI, kill theo PID sau khi kiểm cwd), `check-rls.sh` và
`check-admin-prerender.mjs` xanh; smoke curl: csp-report 204 kèm một dòng
log, resend webhook thiếu env 503. Tests after: 3139 unit (451 api, 255
contract, 1487 web, 912 admin, 2 i18n, 10 tokens, 22 ui) và 487 int.
`render.yaml` cộng `.env.example` thêm khoá `RESEND_WEBHOOK_SECRET`,
`ENQUIRY_RETENTION_MONTHS`.

**Hạ tầng đã làm SỚM 08/09 (trước merge — an toàn vì migration thuần cộng
thêm, code main cũ không đọc cột mới):** migration đã deploy Supabase và
verify đường đọc 8/8 (sổ `_prisma_migrations` khớp, 6 cột mới, RLS
`email_suppressions` bật, backfill 2/2 subscriber); webhook Resend đã tạo
(ID `00fa02da…`, event bounced+complained — sẽ 404 tới khi merge, vô hại vì
event hiếm) và `RESEND_WEBHOOK_SECRET` đã set trên Render (service redeploy,
health 200); Cloudinary đã bỏ 3 tick Unsigned actions — runbook chỉnh theo
console THẬT ở `2c52289` (KHÔNG có mục "Restricted original access", Strict
transformations phải GIỮ Disabled vì delivery là transform động không ký).
Session review chỉ còn: review code, nghiệm thu tay spec §6, quét headless
header sau merge, liếc đèn CI.

**Chỗ session thi công TỰ QUYẾT, đáng soi kỹ nhất:** GET
`newsletter.unsubscribeConfirm` phát thêm `resubscribeToken` (mở rộng
contract ngoài chữ spec E4 — cách duy nhất giữ nút "đăng ký lại" của panel
khi token đã tách mục đích; lý do ở JSDoc `UnsubscribeConfirmResultSchema`);
GET public của người ĐANG đăng nhập vẫn đếm bucket read theo IP (AuthGuard
thoát sớm trên `@Public()` nên không có session để nhìn — đọc session cho
mọi GET công khai là trả một round-trip DB cho chính đường trần này bảo vệ,
JSDoc `DefaultThrottlerGuard`); thứ tự commit E4 TRƯỚC E3 khác spec (E3
dùng token mục đích `confirm` của E4).

**CÒN TREO (cố ý, ghi để reviewer khỏi đi tìm):** trần đọc R1 có thể chạm
bởi build Vercel/ISR production (một IP build prerender nhiều trang — chưa
đo, theo dõi lần deploy đầu sau merge); Turnstile/captcha, catalogue lớn
hơn 50, AdminAuditLog, throttler store chung, LazyMotion, producer bust
posts/site-media — giữ nguyên danh sách "không làm ở W4" của spec;
suppression chưa có UI gỡ tay (operator dùng SQL); ngày ngừng nhận token v0
31/12/2026 là một lần gỡ mã có chủ đích sau này.

## 2026-09-07 — W3 merge + vòng review 8 mũi cho vỏ Next (nhánh `fix/web-shell-headers`, 29 commit `57d302e..a1a45cc` ff vào main, 83 file, KHÔNG migration, không đụng API)

Entry ngay dưới ghi "19 commit code `57d302e..66804c8` và 2 commit docs" — đếm
lại là 18 code + 4 docs (kể cả spec `3c3c0e5` và `5660ccc` là docs);
"security-headers 8" admin thật ra 7 `it(`; "41 spec web mới" thật ra +26
(1445 → 1471, 18 ca login/forgot-password chỉ đổi assert); và "chỉ
`/robots.txt` tĩnh" bỏ sót `/_global-error` vì bảng route Next in ra giấu nó.
Đợt review làm ở session gốc theo nếp review theo tầng: 8 finder theo miền
(CSP web thực thi · CSP admin nonce/proxy · origin/env · robots/metadata/ảnh ·
revalidate/checkout/no-store · cổng gác 403 · tầng test · docs/altitude), 3
verifier theo miền (38 mục: 24 CONFIRMED, 9 PLAUSIBLE, 5 REFUTED), `gate:int`
trọn trong cây chính với API tạm :3001. Kết luận: hướng CSP đúng, nhưng phần
vá nhiều nhất là những chỗ **giả định về Next hoặc về tài nguyên thật sai** —
ba trong số đó là "hỏng prod im lặng". 10 findings, vá trong 8 commit
(`992b633..a1a45cc`, 56 file) rồi ff.

### Findings và cách vá (theo tầng)

**Tầng chính sách**

1. **CSP thiếu tài nguyên THẬT** (`545102a`, [ADR-0038 AMEND 1 §a](../adr/0038-web-shell-security-headers.md)).
   Bảng origin §2 dựng từ grep literal nên không thấy URL sinh lúc chạy:
   `media-src 'self'` chặn video Cloudinary khe `about-cta-video` (poster đi
   theo `img-src` nên mắt thường không thấy); `img-src` hai app không có
   `lh3.googleusercontent.com` (avatar Google OAuth). Thêm hai host; ghi rõ
   escape-hatch publicId-là-URL (ADR-0005 §2) và ảnh markdown thân bài CỐ Ý
   không mở. Luật mới: mỗi lần thêm bề mặt media phải liệt kê URL sinh từ
   API/DB, không chỉ grep source.
2. **`loaderFile` làm `remotePatterns`/`minimumCacheTTL` thành cấu hình chết**
   (`0db8576`, [ADR-0016 AMEND 2 §7](../adr/0016-web-data-layer.md), [ADR-0020 AMEND 1](../adr/0020-real-images-sourcing.md)).
   Next 16.3 trả 404 cho `/_next/image` và thay nguyên module kiểm host khi có
   loader custom — ADR-0020 đòi đồng thời hai thứ loại trừ nhau; mục CÒN TREO
   "đặt `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` trên Vercel" là việc vô nghĩa.
   Chốt giữ loader (Cloudinary co ảnh, không tiêu quota Vercel), xoá ba khoá
   chết + env, sửa 5 chỗ docs/comment tả sai. Loader cũng sửa điều kiện nhận
   diện segment transformation (`my_photo.jpg`, `ab_cd/` từng bị nuốt → 400;
   URL ký `s--…--` trả nguyên), 4 ca test.
3. **`/_global-error` admin tĩnh không nonce; vá từng trang không lưới**
   (`545102a`, ADR-0038 AMEND 1 §c). Next giấu route này khỏi bảng in sau
   build và cấm mọi segment config — chấp nhận 500.html chỉ chữ, ghi luật
   "HTML admin cache/prerender = nonce lệch"; `force-dynamic` ở root layout
   làm lưới hai, `scripts/check-admin-prerender.mjs` đọc prerender-manifest
   trong CI làm lưới cuối (allowlist `/robots.txt` + `/_global-error`).
4. **`metadataBase` rơi về localhost; robots nướng `VERCEL_ENV` lúc build**
   (`b871176`, ADR-0016 AMEND 2 §7). `siteUrl()` nay fail-fast production
   (CI khai `NEXT_PUBLIC_SITE_URL`); `/robots.txt` thành route ĐỘNG so host
   request với host site — promote/rollback một build preview không còn đóng
   prod khỏi index; `(site)/account/layout.tsx` noindex + nofollow cả khu.
5. **Contract `checkoutUrl: z.url()` nhận `javascript:`** (`c93b851`): siết
   `protocol: /^https$/` tại nguồn, guard client giữ làm lớp hai.

**Tầng thiết kế / code**

6. **`connect-src` bake từ chuỗi thô** (`545102a`, ADR-0038 AMEND 1 §b):
   proxy admin đọc env thô inline lúc build (bundle chứa literal localhost),
   web nhồi origin nguyên văn (path `/api` → CSP khớp-chính-xác chặn hết; `;`
   cắt đôi). Nay nguồn duy nhất là `browserApiOrigin()` đã chuẩn hoá.
7. **Origin API: web module-scope, admin nuốt lỗi cấu hình** (`992b633`,
   ADR-0016 AMEND 2 §6, [ADR-0026 AMEND 4 §D](../adr/0026-p4-admin-app.md)): cả
   hai app `new URL().origin`, production thiếu biến throw nêu tên, https ép
   trừ loopback (CI/gate/`next start` build được với localhost); web
   `client.ts`/`auth-client.ts` lười như admin; admin `session.ts` tính
   origin ngoài `try` (từng thành vòng lặp `/login` không lời giải thích);
   admin `next.config` gọi resolver lúc build; `turbo.json` `passThroughEnv`
   cho ba cờ warm-up/guard-build.
8. **Cổng gác tin `x-pathname`** (`efa96f3`, ADR-0026 AMEND 4 §B/§C): gate trả
   `allow` cho path public trước khi kiểm role, Next không xoá header client
   gửi — layout ép `role === 'ADMIN'` tường minh, proxy.spec ca header thù
   địch, `x-pathname` kèm query, luật "header proxy→app chỉ mang định tuyến".
   Admin `robots.txt` bỏ disallow để crawler đọc được `X-Robots-Tag` (§A).
9. **zod 4 thử `Function("")`** (`a1a45cc`, ADR-0038 AMEND 1 §e) — phát hiện
   lúc quét admin `next start` bằng Chromium headless: một vi phạm `script-src
   ← eval` ở mọi trang. zod tính `fastEnabled` ngay lúc DỰNG `z.object`, nên
   `z.config({ jitless: true })` phải nằm ở module import ĐẦU TIÊN của contract
   (đặt trong thân `index.ts` là quá muộn vì import bị hoist); spec spy
   `Function` canh. Không nới CSP bằng `'unsafe-eval'`.

**Tầng test / docs**

10. Test CSP so BẰNG map directive→sources (thêm host lạ là đỏ); nonce qua
    `getScriptNonceFromHeader` của Next; interceptor 403 test qua
    `createAdminLink({ fetch })`; `routeForErrorDigest` tách lib có spec;
    `proxy.spec` assert `connect-src`/`isDev`/độ dài nonce. Docs: ADR-0038
    AMEND 1 (Report-Only cân nhắc → W4, preview CSP y prod, UIR localhost),
    i18n gộp bộ chuỗi share trùng, `.env.example` hai app, comment
    `warm-api.mjs`/bfcache, JSDoc revalidate ghi `site-media`/`posts` chưa có
    producer (`2d1c863`, `c93b851`).

### Nghiệm thu tay (lần đầu có Chromium headless từ session gốc)

- Web dev server của user (:3000, DPR 1 và 2): `/`, `/tours`, `/destinations`,
  `/about`, `/contact`, `/tours/[slug]`, `/blog/[slug]`, `/login`,
  `/register` — 0 CSP violation, mọi response Cloudinary 200, ảnh chậm nhất
  ~9s vì Cloudinary sinh biến thể `w_*` lần đầu. Báo "hầu hết ảnh mất" của
  user truy ra là render cũ bị cache 300s lúc API dev chưa sẵn sàng (curl đầu
  không có `<img>`, vài giây sau đủ 25) — có từ trước W3.
- Admin `next build` + `next start` (:3002): nonce header khớp 18/18 script,
  hydrate thật, 0 violation sau vá zod; `check-admin-prerender` OK. Còn
  `favicon.ico` 404 (admin chưa có icon, có từ trước).
- Env Vercel: cả hai project đã có `API_URL`, `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_SITE_URL` (web thêm `REVALIDATE_SECRET`), Production + Preview,
  https không path — không phải bổ sung gì; `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  không cần.

Tests after: 454 api-int và 409 api-unit và 251 contract và 910 admin và 1480
web và 22 ui và 10 tokens và 2 i18n — `pnpm gate:int` trọn với API tạm :3001
trên docker DB theo công thức CI, lint 0 lỗi, `check-admin-prerender` OK.

### CÒN TREO (cố ý)

- CSP `report-to` cần endpoint nhận báo cáo ở API → W4, kèm một vòng
  Report-Only trước khi siết thêm. Throttle `/api/revalidate` cũng W4.
- `posts`/`site-media` có trong whitelist revalidate nhưng API chưa có
  producer bust (chỉ `reviews.moderate` gửi `tours`/`tour:<slug>`).
- Bốn bề mặt `<img>` trần (review-card, avatar-upload, passport-card,
  booking-receipt) chưa qua loader Cloudinary — thumbnail vẫn tải bản đầy.
- Spec DOM cho `two-factor-form`/`share-row`, assert eyebrow contact-location,
  assert "30 minutes" ↔ 1800s của API — đợt copy riêng.
- Booking PENDING được tạo trước khi guard `checkoutUrl` từ chối (có sẵn
  trước W3): nhánh từ chối nên khoá nút + hiện mã booking thay vì mời bấm lại.
- `/_global-error` admin là 500.html tĩnh chỉ chữ khi root layout ném.
- Admin chưa có `favicon`; admin `remotePatterns` không đổi (không có loader).
- Nợ W2 vẫn treo: TRUST_PROXY/XFF Render chưa đo, BA rate limit chưa có test.

## 2026-09-07 — W3 vỏ Next thi công xong — **CHƯA merge, chờ review ở session riêng** (nhánh `fix/web-shell-headers`, 19 commit code `57d302e..66804c8` và 2 commit docs, 57 file, KHÔNG migration, không đụng API)

Đợt vá thứ ba theo [bản rà 05/09](../analysis/2026-09-05-web-security-audit.md)
(cụm 7 trọn + cụm 5 mục revalidate/metadata/robots/ảnh + cụm 8 mục admin),
theo [spec W3 07/09](../specs/2026-09-07-w3-web-shell-headers-design.md). ADR đi
trước code: [ADR-0038 mới](../adr/0038-web-shell-security-headers.md) (CSP hai
app, HSTS để Vercel, hai file security-headers riêng) + ADR-0016 AMEND 1 +
ADR-0026 AMEND 3. 12 mục, mỗi mục một commit, TDD trên phần thuần:

- **H**: web CSP không nonce qua `headers()` (`security-headers.ts` thuần);
  admin CSP nonce 16 byte + `'strict-dynamic'` qua proxy (CSP vào cả request
  lẫn response), admin thêm `X-Robots-Tag` noindex + `robots.ts` disallow;
  `/api/revalidate` trả `no-store` + noindex.
- **S**: `metadataBase` từ `NEXT_PUBLIC_SITE_URL`; robots đóng ngoài
  production theo `VERCEL_ENV` (`robotsFor` thuần); `(auth)/layout.tsx`
  noindex 6 trang auth; `remotePatterns` siết theo
  `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` + `minimumCacheTTL` 86400 + loader
  Cloudinary chèn `w_<width>` idempotent (trả nợ ADR-0020 từ 14/08).
- **O**: web tách `serverApiOrigin`/`browserApiOrigin`, production thiếu →
  throw nêu tên biến (CI khai `NEXT_PUBLIC_API_URL` tường minh, `turbo.json`
  khai `VERCEL_ENV` và `API_URL` cho task build); admin `resolveApiOrigin`
  parse `new URL()` + production ép https — kèm bản vá phát hiện khi chạy
  gate: `next build` nào cũng NODE_ENV=production nên hai chỗ gọi
  `apiOrigin()` ở module scope phải thành lười (`url: () => …`, authClient
  chỉ tính origin trong browser); `withAuthOptions` nhánh browser `no-store`;
  `isCheckoutUrl` gác hai chỗ `location.assign`; `resolveRevalidateSecret`
  fail-fast production + whitelist thêm `site-media`; admin 403 mang digest
  `ADMIN_FORBIDDEN` → `error.tsx` về `/not-authorized`, layout gác đọc
  `x-pathname` do proxy gắn, admin có `proxy.spec.ts`.
- **C**: copy sót về `@tourism/i18n` (login, two-factor, share-row,
  contact-location, forgot-password — trả luôn nợ câu "expires in 30
  minutes" ghi CÒN TREO ở entry W2 06/09).

Vòng TỰ RÀ sau thi công bắt được hai lỗi lớp "hỏng prod im lặng", vá trong
2 commit (`294a39f..66804c8`), cả hai đều test-đỏ-trước:

1. **Admin `/robots.txt` bị proxy đá về `/login`** — matcher phủ path này mà
   `decideAdminAccess` không coi nó public, crawler không cookie không bao
   giờ đọc được disallow. Vá: thêm vào `PUBLIC_PATHS` (`admin-gate.ts`).
2. **`/login`, `/not-authorized`, `not-found` admin bị prerender TĨNH** —
   HTML tĩnh không có nonce trong khi CSP là nonce + `strict-dynamic`, tức
   production chặn TRẮNG script trang login (form chết); dev không lộ vì dev
   luôn render động. Vá: `await connection()` ép động cả ba (route table sau
   build: mọi trang ƒ Dynamic, chỉ `/robots.txt` tĩnh — không script, vô
   hại).

Tests after: `pnpm gate:int` trọn (chạy LẠI sau hai bản vá) với API tạm
:3001 trên docker DB theo công thức CI — unit 250 contract, 1471 web, 409
api, 902 admin, 22 ui, 10 tokens, 2 i18n; integration 454 api. Tổng web tăng
thêm 41 spec mới của W3 (security-headers 7, robots 3, cloudinary-loader 5,
env 6, checkout-url 4…), admin thêm 25 (security-headers 8, proxy 9, env 5,
forbidden 3, admin-gate +1, và các spec sửa).

CÒN TREO (chờ session gốc trước khi merge):

- **Nghiệm thu tay DevTools theo spec §6** — 0 dòng "Refused to …" trên các
  trang liệt kê. Riêng admin PHẢI thử thêm trên `next start` (production
  build) chứ không chỉ `next dev`: lỗi static-không-nonce ở mục 2 trên đúng
  loại dev che mất, và nonce/`strict-dynamic` chỉ hành xử thật ở bản build.
- **Đặt env Vercel TRƯỚC merge**: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (web —
  thiếu chỉ warn + mở `/**`); soát `NEXT_PUBLIC_API_URL` đã đặt ở CẢ hai
  project (từ W3 thiếu là build/runtime THROW thay vì âm thầm trỏ localhost;
  admin còn ép https).
- **Sau merge**: `curl -sI` hai app phải thấy CSP + 5 header mới và VẪN còn
  HSTS của Vercel; soát đèn CI main (luật 14).
- **`digest ADMIN_FORBIDDEN` chưa đo sống trên production boundary** — unit
  test phủ hàm thuần + interceptor, nhưng đường Next chuyển digest qua
  client boundary ở production nên nghiệm thu bằng cách thu hồi role một
  tài khoản thử trong lúc điều hướng mềm.
- **Sổ nợ copy ngoài danh sách C1** (spec chỉ định danh sách hẹp):
  `register-form` còn `Password` cứng, và cụm auth còn chuỗi heading/label
  chưa vào i18n — quét trọn ở đợt copy riêng, không chặn W3.
- **Admin chưa siết ảnh như web S4**: `remotePatterns` admin vẫn pathname
  `/**`, không `loaderFile` (spec S4 chỉ áp web; avatar admin nhỏ) — xét
  cùng đợt W4/P4f.
- **CSP web bake lúc build**: `connect-src` lấy `NEXT_PUBLIC_API_URL` qua
  `headers()` của `next.config.ts` — đổi origin API là phải rebuild web (nếp
  Vercel bình thường, ghi để khỏi ngạc nhiên).
- Hai diagnostic Biome CÓ SẴN ngoài phạm vi W3 (`wizard-steps.tsx`
  useIndexOf, `date-field.ts` unused `isValidDate`) — dọn ở sweep lint sau.
- Nợ W2 vẫn treo nguyên (không thuộc W3): TRUST_PROXY/XFF Render chưa đo,
  BA rate limit chưa có test.

Ngoài phạm vi (cố ý, spec §2): LazyMotion (P7), throttle + Cache-Control
đường đọc API (W4), catalogue >50, AdminAuditLog + freshAge (P4f).

## 2026-09-07 — W2 merge + vòng review 8 mũi cho phiên & hạ tầng (nhánh `fix/auth-infra-hardening`, 23 commit `4787bd4..6689fdf` ff vào main, 92 file, 2 migration đã deploy Supabase)

Entry ngay dưới ghi "16 commit `4787bd4..d16c718`, chưa merge, chờ review ở
session riêng" — đếm lại là 17 (tính cả entry docs `17ea4e6`), và "12
controller" gỡ AuthGuard thừa thực ra là 14. Đợt review làm ở session gốc theo
nếp review theo tầng: 8 finder theo miền (phiên/tài khoản · Better Auth · throttle
· ranh giới admin↔web/CORS · bootstrap/env/deploy · refund reason & W1 nợ · tầng
test · docs/altitude), 3 verifier theo miền, `gate:int` trọn trong cây chính với
API tạm :3001 trên docker DB. Kết luận: W2 đóng đúng ba cụm audit, nhưng câu
"admin không phát CORS" chỉ giấu response chứ không chặn THI HÀNH, một lỗi thư
viện throttler làm trần ghi lan sang khách thật, và bốn chỗ ADR/spec tả sai hành
vi thật của Better Auth. 10 finding bảng, vá trong 6 commit (`3f487a5..6689fdf`,
50 file) rồi ff.

### Findings và cách vá (theo tầng)

**Tầng chính sách**

1. **Gate xoá tài khoản bị sửa thân trong commit code** (`1af3daf`,
   [ADR-0017 §8a](../adr/0017-web-session-better-auth.md)). Câu user duyệt
   ("PAID/PARTIALLY_REFUNDED hoặc REQUESTED → chặn") bị đổi thành "chưa khởi
   hành" trong `2e54786` — PARTIALLY_REFUNDED đã đi còn phần dư, PAID khởi hành
   hôm qua xoá được. Về câu gốc theo `departureEndDate >= hôm nay`, thêm chặn
   PENDING còn `checkoutSessionExpiresAt` sống (khách trả tiền qua tab Stripe cũ
   sau khi tombstone), mã `ACCOUNT_HAS_PENDING_CHECKOUT` 409 + copy web.
2. **§7c tả sai Better Auth** (`1af3daf`, §8b): với `requireEmailVerification`
   + `autoSignIn:false`, sign-up trùng email trả 200 synthetic và KHÔNG gửi mail
   (không hề lộ EMAIL_EXISTS), web đẩy sang /verify-email chờ mã không tới. Giữ
   200 câm của BA, trang verify thêm hint "already have an account". Chuẩn hoá
   400 ở `check-verification-otp` không đóng oracle vì TOO_MANY_ATTEMPTS 403 chỉ
   phát khi user tồn tại — BA có `disabledPaths`, route tắt hẳn (404), web chỉ
   dùng sign-in/email-otp.
3. **Reason refund thiện chí: purge 30 ngày và gửi thẳng khách** (`1db5ea4`,
   [ADR-0030 AMEND 2](../adr/0030-refund-policy-tiers.md)). AMEND 1 lấy `reason`
   làm lưới thay bảng bậc nhưng chỉ lưu trong payload outbox mà `purgeSent(30)`
   xoá; template in free-text admin vào email khách. Migration
   `20260907090000_w2_review_refund_reason` thêm cột nội bộ `refunds.reason`
   (lên contract + cột sổ cái admin, placeholder nói rõ không gửi khách); email
   in câu chung "Goodwill refund issued by our team" qua `REFUND_REASON_COPY`;
   `refund-math` bỏ nhánh `requested == null → trọn phần dư` (cửa hậu chết còn
   giữ nguyên hình + spec canh nó).
4. **`revokeOtherSessions` chỉ là cờ client** (`1af3daf`, §8c): client khác
   gọi change-password không cờ → cookie trộm sống. `hooks.before` của BA ép
   `revokeOtherSessions: true` server-side; session-revoke spec assert cookie
   xoay nghiêm, ca không-cờ vẫn thu hồi.

**Tầng thiết kế**

5. **POST admin nhận form-urlencoded — CORS không chặn thi hành** (`3f487a5`,
   [ADR-0026 AMEND 2](../adr/0026-p4-admin-app.md)). `rawBody: true` khiến
   FastifyAdapter đăng ký parser `application/x-www-form-urlencoded` toàn cục,
   oRPC đọc `req.body` đã parse, cookie lax + domain cha → mọi POST
   `/api/admin/*` là simple request không preflight; `origin:false` chỉ giấu
   response. Hook `onRequest` ở bootstrap: ghi non-JSON ngoài `/api/auth/` và
   `/api/webhooks/` → 415 `UNSUPPORTED_MEDIA_TYPE`; `/api/admin*` kèm
   `sec-fetch-site: cross-site` → 403 `CROSS_SITE_FORBIDDEN`; delegator CORS bỏ
   query (`/api/admin?x` từng trượt). Đây vẫn là lưới thứ hai — nhát cắt gốc CSP
   thuộc W3.
6. **Lỗi thư viện throttler** (`f1e99db`, [ADR-0037 AMEND 1](../adr/0037-default-write-throttle.md)):
   `ThrottlerStorageService` 6.5.0 giữ `timeoutIds` theo TÊN throttler nên hết
   block một key là `clearExpirationTimes('default')` xoá timer decay của MỌI
   key → `totalHits` đóng băng, khách thật ghi rải rác vẫn chạm trần. Thay bằng
   `KeyedThrottlerStorage` (sliding window theo key, unit spec riêng). Cùng
   commit: guard nhận `@Throttle` per-route qua metadata thay vì so số (từng
   không phân biệt SIGN_UPLOAD với AUTHED), bucket auth theo path (một handler
   wildcard từng gom sign-in/sign-up/OTP/sign-out vào một bucket 60/phút theo
   IP — CGNAT di động khoá cả pool), admin carve-out `ADMIN_WRITE_THROTTLE`
   60/60s (moderator duyệt 21 review/phút từng bị 429), gỡ `SIGN_UPLOAD_THROTTLE`
   trùng AUTHED.
7. **DELETE account: oracle mật khẩu + tombstone rời rạc** (`1af3daf`, §8a):
   route trả 403 phân biệt, lớp chống dò duy nhất là 20/60s theo user
   (28.800 lần/ngày). Nay khoá 15′ sau 5 lần sai (`TOO_MANY_ATTEMPTS` 429);
   gate + tombstone chạy trong MỘT `$transaction`; ảnh review của user vào
   `media_garbage` (từng scrub tên mà ảnh mặt vẫn treo trên trang tour).
8. **Hook avatar hở đường sign-up, `..` lách prefix** (`1af3daf`, §8d): không
   có `user.create.before` nên sign-up/email và sign-in/email-otp lần đầu ghi
   `image` client thẳng vào DB; so chuỗi thô nên
   `res.cloudinary.com/<cloud>/../<cloud-khác>/` qua được; `image: ''` bị 400.
   Nay `guardAvatarImage` gác cả create lẫn update, so trên URL đã chuẩn hoá
   (`isOwnCloudinaryUrl`), `''` → null.

**Tầng dữ liệu và code**

9. **Timeout hiểu sai, redact che OTP dev, mất stack, env/deploy** (`3f487a5`,
   [ADR-0024 AMEND 3](../adr/0024-deploy-targets.md)): `requestTimeout` là thời
   gian NHẬN request, `connectionTimeout` là socket bất động (60s <
   keepAliveTimeout 72s → 502 lác đác) — nay request 30s / handler 60s /
   connection 120s, e2e đi qua `createFastifyAdapter()`. `redactDeep` che
   `otp`/`url` ở ConsoleDeliverer làm dev không đăng nhập được local → chỉ che
   ngoài development. onError oRPC truyền stack cho 500 thật
   (`orpcErrorStack`). `CORS_ORIGINS` phải chứa origin của FRONTEND_URL và mọi
   TRUSTED_ORIGINS (superRefine). render.yaml bỏ `numInstances` (free plan
   từ chối) và ghi định dạng từng khoá `sync:false` (`MEDIA_GC_ENABLED=TRUE`
   từng làm boot đỏ). ConsoleDeliverer nhận cờ qua field, không constructor —
   Nest DI đòi inject `Boolean` làm WorkerModule không dựng được (`6689fdf`,
   bắt được ở `test:int` sau gate).
10. **Tầng test + docs**: `upload-signing.int.spec` không set `remoteAddress`
    nên guard skip loopback — "6 lần ký cùng IP → 200" xanh kể cả gỡ throttle;
    account-delete thêm PARTIALLY_REFUNDED / PENDING sống / khởi hành hôm nay;
    avatar-hook thêm cloud khác + `..` + `''`, assert `toBe(400)`;
    auth-hardening đếm đủ 60 non-429 rồi 429, sign-out không đếm, route OTP tắt
    404 kể cả lần thứ 6; default-write-throttle probe admin + `@Throttle` pinned;
    `check-rls.int.spec` ca âm có bằng chứng; `keyed-throttler-storage.spec` mới.
    Docs: JSDoc PUBLIC_WRITE, spec P4b F2, ADR-0029:316, ADR-0035, ADR-0037 dẫn
    ADR-0010 sửa đúng (`51d93cc`).

### Vận hành lúc merge

- Hai migration `20260906150000_w2_rls_backstop_new_tables` và
  `20260907090000_w2_review_refund_reason` đã `migrate deploy` lên Supabase
  TRƯỚC khi push (23/23 applied).
- Commit docs `51d93cc` từng stage nhầm 102 file `docs/navel/` (187 MB ảnh
  thiết kế mobile, cố ý không track) — viết lại thành `73c6f9b` trước khi push,
  thư mục giữ nguyên trên đĩa và vào `.git/info/exclude` máy dev.

### Nghiệm thu

Tests after: 454 api-int và 409 api-unit và 250 contract và 871 admin và 1445
web và 10 tokens và 22 ui và 2 i18n — `gate:int` trọn với API tạm :3001 (web
DOM test timeout khi chạy song song dưới tải, chạy riêng 1445/1445 xanh), lint 0
lỗi, `check-rls` xanh.

### CÒN TREO (cố ý)

- TRUST_PROXY / hop XFF cuối của Render chưa đo trên prod — bucket IP của
  Better Auth (`trustedProxies`) vẫn là giả định; dev/test BA luôn trả
  LOCALHOST_IP nên rate limit nội bộ BA chưa có test.
- CSP + header vỏ Next (nhát cắt gốc cho XSS→admin) thuộc W3; runbook thu hồi
  phiên admin chờ P4f.
- Tài khoản Google-OAuth-only chưa có đường xoá self-service (ADR-0017 §7b).

## 2026-09-06 — W2 phiên & hạ tầng (nhánh `fix/auth-infra-hardening`, 16 commit `4787bd4..d16c718`, CHƯA merge — chờ review ở session riêng)

Đợt vá thứ hai theo bản rà 05/09 (cụm 1 Auth & tài khoản, cụm 6 Hạ tầng API,
cụm 8 ranh giới admin↔web) cộng hai nợ W1 ghi ở ADR-0029 AMEND 6. ADR đi
trước code (`4787bd4`): AMEND ADR-0017 §7 / ADR-0024 AMEND 2 / ADR-0026
AMEND 1 / ADR-0030 AMEND 1, và ADR-0037 mới (trần ghi mặc định). Mỗi mục một
commit, TDD test-đỏ-trước.

### Nội dung chính

1. **Phiên** (`7a58d5f`, `2e54786`): đổi/đặt lại mật khẩu thu hồi phiên cũ
   (`revokeSessionsOnPasswordReset` và web gửi `revokeOtherSessions`); `DELETE
   /api/account` đòi mật khẩu, chặn khi còn booking PAID chưa khởi hành hoặc
   cancellation request mở (4 mã lỗi riêng, copy i18n mới), dọn `verification`
   treo trong cùng tx, token reset 1800s khớp copy "30 minutes".
2. **Better Auth biết hạ tầng** (`416dccf`, `7802dc8`): `ipAddress.
   trustedProxies` dịch từ TRUST_PROXY (tên dải → CIDR, một nguồn cho Fastify
   lẫn BA); `rateLimit.enabled` tường minh theo môi trường; trần Nest riêng cho
   `/api/auth/*` (60/60s, chỉ non-GET); ẩn enumeration ở `check-verification-
   otp` (mọi 400 cùng body INVALID_OTP); hook `user.update.before` bác image
   ngoài cloud Cloudinary.
3. **Env & bootstrap** (`7d199f2`, `6757e4d`): superRefine production cho
   BETTER_AUTH_URL/FRONTEND_URL/TRUSTED_ORIGINS/COOKIE_DOMAIN (https bắt buộc,
   cấm localhost) và `useSecureCookies`; Fastify requestTimeout 30s /
   connectionTimeout 60s; onError oRPC log một dòng (hết dump PII trong cause),
   4xx nghiệp vụ không đẩy Sentry; ConsoleDeliverer redactDeep; Dockerfile
   `USER node`.
4. **RLS + CI** (`e0f2f6b`): migration MỚI `20260906150000` bật RLS cho
   `enquiry_status_events` và `tour_cost_items` — **đã apply docker local
   (tourism, tourism_test), CHƯA deploy Supabase**; `scripts/check-rls.sh`
   đối chiếu `pg_class.relrowsecurity` chạy trong CI ngay sau test:int (đã
   mutation-test).
5. **Ranh giới admin** (`de6aa0d`, `7968958`): env `CORS_ORIGINS` tách khỏi
   TRUSTED_ORIGINS (fallback giữ hành vi cũ), `/api/admin/*` không phát CORS
   cho origin nào (admin gọi API thuần server-side); gỡ `@UseGuards(AuthGuard)`
   thừa ở 12 controller (đọc session hai lần/request); export-route.spec 4 ca
   gác quyền, mỗi route xuất một test không-chạm-data, adminList reviews có cặp
   401/403.
6. **Hai nợ W1** (`8d6e84f`, `2469fb0`): `admin.bookings.refund` đòi ĐỦ
   `amount` và `reason` (xoá nhánh vắng-là-trọn-phần-dư; RefundPanel bỏ radio
   full/partial, thêm nút điền nhanh phần dư); ADR-0037 guard toàn cục — route
   ghi mới không khai gì vẫn có trần (authed theo user, public theo IP, GET
   không đếm), gỡ 11 cặp decorator lặp, probe int test canh cái lưới.
7. **Deploy** (`c445903`, `d16c718`): render.yaml khai đủ khoá env còn thiếu
   (TRUST_PROXY, CORS_ORIGINS, MEDIA_GC_*, MARGIN_TAX_RATE, PAYMENT_FEE_* —
   chỉ key) và ghim `numInstances: 1`; .env.example thêm CORS_ORIGINS.

Review giữa đợt: security-review nền bắt guard miễn-loopback dùng `req.ip` —
vá sang địa chỉ socket thô, chỉ miễn ngoài production, kèm test XFF giả
loopback vẫn 429 (`ffc7e76`).

Tests after: 441 api-int và 403 api-unit và 250 contract và 871 admin và 1445
web và 10 tokens và 22 ui và 2 i18n — `pnpm gate:int` trọn, API tạm :3001
trên docker DB theo công thức CI (kill sau khi xong), lint 0 lỗi.

### CÒN TREO (cố ý, không phải sót)

- Migration RLS `20260906150000` chưa `migrate deploy` lên Supabase — làm lúc
  merge (cùng nếp W1); `check-rls.sh` sẽ đỏ nếu chạy trỏ Supabase trước đó.
- Tài khoản Google-OAuth-only chưa có đường xoá self-service (mã
  CREDENTIAL_ACCOUNT_NOT_FOUND + copy hướng dẫn liên hệ) — Google OAuth prod
  chưa bật, ghi ở ADR-0017 §7b.
- Better Auth rate limit nay BẬT ở dev (3/10s cho /sign-in theo path) — dev
  thấy đúng hành vi prod; nếu vướng khi test tay thì đó là chủ đích.
- CSP phía web (nhát cắt gốc cho blast radius XSS→admin) thuộc W3; runbook SQL
  thu hồi phiên admin nằm trong ADR-0026 AMEND 1 chờ P4f dựng UI.
- Copy "30 minutes" của forgot-password vẫn hard-code trong form (nợ i18n W3
  đã ghi ở audit cụm 7); W2 chỉ sửa máy theo lời.

## 2026-09-06 — W1 merge + vòng review 8 mũi cho money-path (nhánh `fix/web-money-path`, 18 commit `f4c791c..96789bf` ff vào main, 64 file, 2 migration đã deploy Supabase)

Entry ngay dưới ghi "chưa merge, chờ review ở session riêng; migration CHƯA
deploy Supabase" — đợt review ấy làm ở session gốc theo nếp review theo tầng:
8 finder theo miền (vòng đời session · webhook/tiền vào · bề mặt webhook +
throttle · tạo booking + claim · huỷ/hoàn · tầng test · dữ liệu/docs/altitude
· lần vết chéo), 3 verifier (33 mục: 26 CONFIRMED, 6 PLAUSIBLE, 1 REFUTED),
`gate:int` trọn trong cây chính với API tạm :3001. Kết luận: W1 đóng đúng ba
cửa lớn của audit, nhưng chính hai cơ chế mới (gate tiền, sweep neo session) mở
ra hai đường mất tiền/kẹt mới, và một cặp số vốn "trơ" (PayPal 3h so với TTL
65′) thành đang hoạt động. 10 finding bảng + ~12 món verifier thêm, vá trong 5
commit (`67b531d..96789bf`) rồi ff.

### Findings và cách vá (theo tầng)

**Tầng chính sách**

1. **Event lệch tiền = tiền vào hố** (`67b531d`, [ADR-0006 AMEND 2a](../adr/0006-pending-lifecycle.md)).
   AMEND 1d để booking "ở lại PENDING cho operator" trong khi sweep là tác nhân
   tự động khác đang chờ đúng booking ấy: 65′ sau huỷ, không refund, không email.
   Gate đứng TRƯỚC claim nên capture thứ hai lệch amount trên booking PAID cũng
   không tới nhánh dup-capture. Nay gate chỉ áp khi booking còn PENDING; lệch →
   hoàn NGAY đúng số event khai (`mismatch-refund:<capture>`, ngoài sổ), booking
   ở lại PENDING; capture lệch trên booking đã settle đi đường dup-capture.
2. **"Audit ở payment_events" không tồn tại** (`67b531d`, AMEND 2a). Dup-capture
   và hoàn ngoài sổ chuyển tiền thật không ghi hàng DB nào; cột `note` không map
   lên admin (write-only). Nay MỌI khoản không thành Refund row — lệch, dup,
   ngoài sổ, hoàn thất bại, thiếu capture id — ghi `note` kèm mã hoàn provider;
   `note` lên `PaymentEventRowSchema` + drawer admin. Dup-capture hoàn đúng số
   event khai, không đoán bằng total; booking settle không mang capture → note.
3. **Bất biến "TTL sweep > hạn session dài nhất" sai ngay lúc viết**
   (`b036bc6`, AMEND 2d): PayPal khai 3h > 65′, spec chỉ so Stripe; và sweep AND
   hạn session nên `created_at` hết là trần cứng — reCheckout mỗi ~55′ giữ
   PENDING sống vô hạn. Nay `PENDING_HARD_TTL_HOURS = 24`; PayPal PENDING sống
   tới 3h là CÓ CHỦ ĐÍCH (không expire API, không webhook hết hạn — Quyết định 2
   từng hứa "PayPal voided → expired" chưa bao giờ thi hành); unit spec canh
   cả ba số; câu sai trong ADR gạch bỏ.
4. **`freeCancellationDays` join sống** (`dbbd5f4`, [ADR-0029 AMEND 6](../adr/0029-cancellation-approve-partial-refund.md)):
   sửa tour sau khi khách gửi yêu cầu là khách rớt bậc không cần `decisionNote`
   (số mới bằng mức chính sách mới) — trái ADR-0030 §2. Migration
   `20260906120000_w1_review_cancellation_snapshot` chụp badge lên
   `cancellation_requests.free_cancellation_days`; `approve` đọc snapshot (row cũ
   rơi về badge hiện tại); contract + admin nạp stepper từ request.

**Tầng thiết kế**

5. **`reCheckout` không lock, expire S1 trước khi ghi S2** (`b036bc6`, AMEND 2b):
   hai "Pay again" song song cùng mint, session ghi trước sống mồ côi; webhook
   expired của S1 khớp gate 1c (S1 vẫn là hiện tại) và huỷ booking đang re-mint,
   `update` không gate PENDING ghi S2 lên booking đã CANCELLED. Nay trọn trong
   `withBookingRefundLock`: mint S2 → `updateMany` gate PENDING (0 row → expire
   S2, 422) → mới expire S1. `cancelPending` xoá URL/hạn + expire session.
6. **CTE cancel không đọc rowcount, key theo nguyên nhân** (`67b531d`, AMEND 2c):
   log "CANCELLED" vô điều kiện; claim không lấy lock nên delivery #2 claim PAID
   vào khe giữa hoàn và cancel (admin mở lại chuyến) → PAID kèm Refund row full.
   Nay claim + auto-refund cùng advisory lock, refund→sổ→cancel trong một lock
   (`finalize`), 0 row → ERROR + note; key `auto-refund:<capture>`; guard theo
   capture nhận row sổ null của booking chưa mang capture (đường orphan nay set
   `provider_payment_id` qua COALESCE) — đóng ca hoàn lần hai trên dữ liệu cũ.
7. **Gate chuyến** (`b036bc6`, [ADR-0009 AMEND 2](../adr/0009-refund-correctness.md)):
   `reCheckout` không gate, web hiện Pay now cho mọi PENDING → mời khách trả
   khoản chắc chắn bị từ chối; `current_date` theo TZ session DB so với ngày
   lịch VN, phân loại dùng đồng hồ Node riêng; email in "Reason:
   departure-closed" thô. Nay `reCheckout` gate (400 DEPARTURE_NOT_AVAILABLE trên
   route checkout), SQL `(now() AT TIME ZONE 'UTC')::date` + helper `todayUtc()`
   — chốt tường minh "đã đi" theo UTC (rộng hơn đời thật 7 giờ, cùng lề với
   walk-in cùng ngày); email dịch mã lý do sang câu cho khách.
8. **Throttle** (`3d0b226`): hai đường ghi tiền của admin không trần → có; guard
   không session → 401 (fail-closed thật, thay vì rơi về IP/bucket 'unknown');
   `WEBHOOK_THROTTLE` 120 → 600/phút vì delivery thật chung bucket với kẻ dò và
   burst redeliver sau khi Render thức đủ chạm trần; web map 429 ở wishlist,
   saved-grid, review-form, avatar-upload; stepper `submit()` chặn `amountError`.
   Guard toàn cục + `@SkipThrottle` để đợt sau (ghi nợ).

**Tầng dữ liệu và code**

9. `reason = ''` cũ không backfill → hàng đợi duyệt huỷ vẫn có thể 500 sau
   merge — cùng migration `UPDATE … 'No reason given'`. 5 JSDoc còn hứa "vắng =
   trọn phần dư" (contract ×2, service, stepper, `DecideAction`) — dọn.
   `admin.bookings.refund` vắng `amount` = trọn phần dư không kiểm bậc: ADR-0030
   ghi "chưa chốt", xếp W2. Web: server trả `refundEstimate` null (chuyến đã
   đi) → không bày nút xin huỷ, nói thẳng không huỷ online được (bản đầu mở
   dialog nửa tiền trống rồi ăn 422). Currency so không phân biệt hoa/thường.
10. **Tầng test**: thêm lề 5′, `expireSession` ném (fake `failExpireSession`),
    PARTY tính trẻ em, estimate null chuyến đã đi, reCheckout chuyến CLOSED,
    cancelPending expire session, trần cứng sweep, snapshot badge, cột
    `provider_payment_id` trên sổ, dup-capture không amount, mismatch hoàn ngay;
    spec throttle route đủ `limit` lượt 404 rồi mới 429 (test cũ pass kể cả khi
    request đầu 429), payments spec reset `ThrottlerStorage` mỗi test (test trần
    hết phụ thuộc cuối file), dọn `media_assets` và user rác giữa file.

### Vận hành lúc merge

Hai migration (`20260906014052_w1_checkout_session_lifecycle`,
`20260906120000_w1_review_cancellation_snapshot`) deploy Supabase TRƯỚC push
(cột đều nullable, code cũ đang chạy không vỡ; chiều ngược lại — code mới trên
DB thiếu cột — là mọi `bookings.*` và cả `beginEvent` webhook 500, nên thứ tự
này là bắt buộc). Không có backfill nào khác.

### Nghiệm thu

`pnpm gate:int` trọn trong cây chính với API tạm :3001 trên docker DB (kill sau
khi xong): build 21/21 task · unit contract 15 · api 40 · admin 73 · web 116
file (1441 test) · lint 980 file · **int 28 file / 420 test** (414 → 420) —
xanh. Không commit nào mang trailer AI. Chưa kiểm bằng mắt trên localhost.

## 2026-09-06 — W1 khép money-path: một session sống mỗi booking, capture thừa không bị nuốt, approve theo chính sách (nhánh `fix/web-money-path`, 12 commit `f4c791c..f7ea657`, 41 file, 1 migration — **chưa merge, chờ review ở session riêng; migration CHƯA deploy Supabase**)

Đợt vá đầu trong bốn đợt của [audit web 05/09](../analysis/2026-09-05-web-security-audit.md)
— trọn cụm 2 (money-path) cộng ba mục cụm 3 (lý do huỷ, cửa hậu
`refundAmount`, throttle ghi đã-auth) và mục 11 tuỳ chọn. Ba AMEND ADR đi
TRƯỚC code trong commit đầu: [ADR-0006 AMEND 1](../adr/0006-pending-lifecycle.md)
(vòng đời checkout session, 4 tiểu mục), [ADR-0009 AMEND 1](../adr/0009-refund-correctness.md)
(gate chuyến ở claim), [ADR-0029 AMEND 5](../adr/0029-cancellation-approve-partial-refund.md)
(vắng `refundAmount` = mức chính sách). Mỗi mục một commit, TDD test-đỏ-trước.

**Tiền vào** (`f6f409a..1c2b174`): booking lưu `checkout_session_url` +
`checkout_session_expires_at` — `reCheckout` trả LẠI session còn sống (hết
mint chồng, đúng lời hứa gốc của ADR-0006), hết sống thì
`PaymentGateway.expireSession?.()` (Stripe có API; PayPal không — ghi rõ trong
AMEND) rồi mới mint. `handleEvent` outcome `already-paid` mà capture KHÁC →
auto-refund thẳng ở provider key `dup-capture:<capture>`, KHÔNG ghi sổ (tiền
NGOÀI total — ghi là phá trigger `SUM ≤ total`), log ERROR; guard
`issueFullAutoRefund` đổi từ "đã có Refund row" sang theo capture (cột mới
`refunds.provider_payment_id`, mọi đường ghi sổ đều điền). `VerifiedEvent`
mang `sessionId` — expired của session CŨ đến muộn không huỷ booking đã
re-mint (gate `provider_session_id`), sweep bỏ qua PENDING có session còn
sống. Event lệch `amount`/`currency` với booking → không PAID, lý do vào cột
mới `payment_events.note`, event vẫn processed.

**Bề mặt** (`016880f..6be1db4`): PayPal webhook kiểm đủ 5 header
`paypal-transmission-*` cộng parse body TRƯỚC round-trip verify (DoS ẩn danh
hết đốt quota); `WEBHOOK_THROTTLE` 120/60s theo IP; body 400 cố định
`'Webhook rejected'`. `PARTY_TOO_LARGE` (422, mã mới + i18n web): party vượt
`maxGroupSize` bị chặn ở server, contract trần sanity `.max(99)`.
`AUTHED_WRITE_THROTTLE` 20/60s bucket theo `user.id`
(`AuthedWriteThrottlerGuard`) cho 9 đường ghi đã-auth. `resolveGateway` dời
lên TRƯỚC insert — provider chưa cấu hình là 502 typed, hết PENDING mồ côi.

**Tiền ra** (`aae31d7..f7ea657`): CTE claim PAID gate thêm chuyến
`OPEN AND start_date >= current_date` → outcome mới `departure-closed` đi
chung đường auto-refund với overbook (`refundUnclaimablePending`). `approve`
tính `policyRefundAmount` VÔ ĐIỀU KIỆN: vắng `refundAmount` = mức chính sách
(bậc 0% → hoàn 0 mà vẫn đóng request + huỷ + nhả ghế — đóng cửa hậu "vắng =
trọn phần dư"), MỌI lệch với chính sách đòi `decisionNote`
(`OFF_POLICY_NOTE_REQUIRED` áp cả khi không gửi số); UI stepper không đổi.
Free-text trim MỘT chỗ ở contract (`reason`/`decisionNote`/refund `reason` →
`.trim().min(1)`, service bỏ trim) — đứt chuỗi reason-toàn-khoảng-trắng →
row rỗng → 500 output validation khoá `admin.cancellations.list`. Mục 11:
`bookings.byCode` trả `refundEstimate` tính bằng đồng hồ SERVER, web
`CancelSummary` chỉ in — hết lệch bậc/ân hạn theo múi giờ trình duyệt.

**Nghiệm thu:** đủ 9/9 int test bắt buộc của brief; `pnpm gate:int` trọn xanh
với API tạm :3001 trên docker DB theo công thức CI (kill sạch sau khi xong) —
**int 28 file / 414 test** (401 → 414), api unit 384, contract 249, web 1441;
lint 978 file. Không commit nào mang trailer AI.

**Còn treo (đọc ở session review/merge — đừng bỏ quên):**

- ⚠️ **Migration `20260906014052_w1_checkout_session_lifecycle` mới apply
  docker local + `tourism_test`, CHƯA deploy Supabase.** Bốn cột đều nullable
  (thêm-không-phá) nên site đang chạy không vỡ, nhưng PHẢI
  `pnpm prisma migrate deploy` (export DATABASE_URL từ `.env.local` của
  `apps/api` — gotcha `prisma.config.ts` chỉ đọc `.env`) TRƯỚC khi push main,
  vì Render tự deploy code mới cần cột.
- Cách ly int test theo thứ tự file: `refunds.int.spec` giả định
  `media_assets` sạch nhưng `bookings.int.spec` seed mà không dọn — chạy
  SUBSET sai thứ tự sẽ đỏ giả (dính 2 lần trong đợt này, dọn tay bằng
  `TRUNCATE media_assets` trên `tourism_test`; full suite không ảnh hưởng).
  Đáng một vá nhỏ đợt sau.
- PayPal không có API expire order → cửa sổ hai-order-sống chỉ còn lề đồng hồ
  (hạn khai bảo thủ 3h); lưới cuối là dup-capture backstop — chấp nhận, ghi ở
  ADR-0006 AMEND 1a.
- `refundEstimate` là ảnh chụp lúc fetch trang; tab để lâu có thể cũ (refresh
  là tươi) — chấp nhận, vẫn đúng hơn đồng hồ client.
- W2/W3/W4 của audit chưa mở; các món audit cụm 2 "hardening đáng làm" ngoài
  phạm vi W1 (ThrottlerGuard toàn cục + `@SkipThrottle` vùng đọc, catalog công
  bố provider khả dụng) chưa làm.

## 2026-09-06 — Build web tự đánh thức API Render trước prerender (nhánh `fix/web-build-warm-api`, 1 commit `7f73317`, 4 file, KHÔNG migration)

Deploy web trên Vercel cho commit `03eaef9` (docs sweep P4d) ERROR trong khi
CI xanh và deploy admin READY. Log Vercel: `Collecting page data` 16:49:13 →
`TimeoutError … Failed to collect page data for /blog/[slug]` 16:49:24 — đúng
10s, là `AbortSignal.timeout(10_000)` của client oRPC (ADR-0016);
`generateStaticParams` của /blog cố ý không `settle` (ADR-0016 §3 "build với
API sống"). Nguyên nhân: Render free ngủ sau 15 phút, thức ~50s (spec deploy
v1 đã ghi); lần build web trước đó cách 28 phút. Ca y hệt đã xảy ra 02/09
(`233c559`). Site không sập — Vercel giữ deploy READY cũ — nhưng commit đó
không lên web nếu không ai bấm Redeploy. ADR-0024 từng dự báo và đẩy
mitigation sang spec (cron ping / plan trả phí); nay chốt bằng code.

**Vá** (`7f73317`, [ADR-0024 AMEND 1](../adr/0024-deploy-targets.md)):
`apps/web/scripts/warm-api.mjs` chạy trước `next build` — poll `/api/health`
của `API_URL|NEXT_PUBLIC_API_URL` (cùng thứ tự ưu tiên với `resolveApiOrigin`)
tối đa 90s, mỗi 3s, timeout mỗi request 5s, rồi **luôn thoát 0**: thất bại thì
mở như `guard-build.mjs`, API chết thật thì `next build` tự đỏ với lỗi thật.
Log in mã lỗi trong `cause` (ECONNREFUSED…) để đọc được là ngủ hay sai host.
Bỏ qua `SKIP_API_WARMUP=1`, rút hạn khi thử tay `API_WARMUP_DEADLINE_MS`.
Ghi nhận không sửa: cảnh báo Vercel về `API_URL`/`REVALIDATE_SECRET` thiếu
trong `turbo.json` — không phải nguyên nhân, việc riêng.

**Nghiệm thu:** spec thuần 4 test (`warm-api.spec.ts`, đồng hồ giả tiêm
`now`/`sleep`/`fetch`); chạy tay hai nhánh: cổng chết hạn 4s → cảnh báo rồi
exit 0, `SKIP_API_WARMUP=1` → exit 0. `pnpm gate:int` trọn với API tạm :3001
trên docker DB (kill sau khi xong) — build web đi qua chính script ("API trả
lời sau 1 lần gọi"); unit web 116 file · admin 73 · api 40 · contract 15;
lint 978 file; **int 27 file / 397 test** — xanh. Push này cũng là lần deploy
web đầu tiên chạy qua script trên Vercel thật.
