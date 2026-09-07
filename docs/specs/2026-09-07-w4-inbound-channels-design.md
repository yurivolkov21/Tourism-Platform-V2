# Spec W4 — Kênh vào & email đi ra: ack, consent, suppression, backoff; ký upload; đọc công khai; CSP report

07/09/2026 · đợt vá thứ tư (cuối) theo [bản rà bảo mật 05/09](../analysis/2026-09-05-web-security-audit.md)
(bảng "Đề xuất chia ĐỢT VÁ": **W4 — nội dung & kênh vào**, nhánh
`fix/inbound-channels`). Tiếp nối W1 (tiền), W2 (phiên & hạ tầng), W3 (vỏ
Next, merge 07/09 — [CHANGELOG 07/09](../CHANGELOG.md)). Gom: **cụm 4 trọn**,
**cụm 3** mục ký upload / EXIF / requeue / retract, **cụm 5** mục throttle
đọc / Cache-Control / `page` / `escapeLike` / `resolveForOwners`, và **hai nợ
W3**: CSP `report-to` + throttle `/api/revalidate`. Có migration (một file),
đụng API + web + admin + contract + worker.

Nếp làm việc giữ nguyên: một session thi công trên nhánh (không merge, không
push, không subagent), session gốc review 8 mũi theo tầng rồi vá cụm và merge.

## 1. Vì sao W4 là "kẻ lạ"

Ba đợt trước vá thứ kẻ tấn công ĐÃ có tài khoản hoặc đã chạm tiền. W4 là bề
mặt **không cần tài khoản**: form liên hệ và newsletter là máy gửi thư có nội
dung do người lạ điều khiển tới địa chỉ chưa xác minh (audit cụm 4, Cao);
ký upload là chữ ký mở cho mọi `resource_type` và ảnh gốc giữ EXIF/GPS (cụm
3, Cao); đường đọc catalogue không trần, không cache (cụm 5, Vừa). Sau W3,
CSP đã chặn nhưng **không ai biết khi nó chặn** — `report-to` là nợ W3 ghi
rõ. Tất cả nằm cùng miền outbox/email/media/catalog nên gom một đợt.

## 2. Phạm vi — 16 mục, gom 4 cụm

Ký hiệu **E** (email & outbox), **U** (upload & review), **R** (đọc công khai
& revalidate), **C** (CSP report). Mỗi mục một commit, TDD trên logic thuần,
int test cho mọi đường có DB. Trạng thái đã kiểm 07/09: `bookings.cancel`,
`reviews.create/update` ĐÃ có trần theo user qua ADR-0037 (W2); "lý do huỷ
toàn khoảng trắng" ĐÃ vá W1; `refundEstimate` ĐÃ tính phía server 05/09 —
ba mục đó KHÔNG thuộc W4.

### Cụm E — email đi ra & outbox (ADR-0039 MỚI, đi trước code)

| # | Việc | Nơi |
| --- | --- | --- |
| E1 | **Ack liên hệ**: `dedupeKey` `enquiry-received:<email>:<yyyy-mm-dd>` (một ack mỗi địa chỉ mỗi ngày UTC; admin alert giữ key theo id); template `ENQUIRY_RECEIVED` **bỏ khối "YOUR MESSAGE"** in nguyên `message` (khách viết gì họ tự biết; kẻ lạ mất máy gửi thư có nội dung tự chọn) — alert admin vẫn có message | api `enquiries.service.ts`, `worker/emails/render-email.tsx` |
| E2 | **Welcome một lần THẬT**: cột `subscribers.welcome_sent_at`, set trong CÙNG tx subscribe khi enqueue welcome; welcome chỉ khi null — purge outbox 30 ngày không còn làm welcome lặp mỗi tháng. Int test: subscribe → drain → `purgeSent(0)` → subscribe lại → không welcome mới | migration, `newsletter.service.ts` |
| E3 | **Double opt-in**: cột `subscribers.confirmed_at`; email đầu là **xác nhận** (link HMAC mục đích `confirm`), `confirmedAt` set khi bấm (GET hiện trang, POST claim atomic như unsubscribe); admin subscribers list/CSV hiện cột confirmed; mọi gửi newsletter tương lai chỉ tới confirmed (hôm nay chưa có campaign — ghi bất biến). Web: link `/privacy` dưới form | migration, contract, api, web, admin |
| E4 | **Token có mục đích + phiên bản**: `v1.<purpose>.<hmac>` với purpose ∈ `unsubscribe` \| `confirm` \| `resubscribe`; `resubscribe` mang `exp` 30 ngày, hai mục đích kia không hết hạn. **Vẫn nhận token v0** (HMAC trần đã in trong email đã gửi) cho `unsubscribe` DUY NHẤT — ghi rõ ngày ngừng nhận vào ADR | `unsubscribe-token.ts` + spec |
| E5 | **Backoff + phân loại lỗi**: cột `outbox.next_attempt_at`; drain chỉ lấy `PENDING` có `next_attempt_at <= now`; lỗi 4xx (trừ 429) → FAILED ngay (không retry thư sai địa chỉ), 5xx/429/mạng → `attempts+1`, `next_attempt_at = now + 2^attempts phút` (trần 60′); `MAX_ATTEMPTS` giữ; admin `outbox.retry` reset `next_attempt_at` | migration, `outbox.service.ts`, `resend.deliverer.ts` (ném lỗi mang `status`) |
| E6 | **Suppression từ Resend**: bảng `email_suppressions(email citext PK, reason, source, created_at)`; controller `POST /api/webhooks/resend` (svix verify bằng `RESEND_WEBHOOK_SECRET`, `WEBHOOK_THROTTLE`, `@Public()`), sự kiện `email.bounced` (hard) + `email.complained` → upsert; drain SKIP mọi row tới địa chỉ suppressed (trạng thái SKIPPED, lý do vào `lastError`); admin outbox hiện lý do. Env thiếu → controller trả 503 và log một dòng lúc boot (không chặn boot) | migration, api, worker, render.yaml (chỉ key) |
| E7 | **Redact rộng hơn**: `redactDeep` khớp không phân biệt hoa/thường + hậu tố `token`/`secret`/`password` (`unsubscribeToken`, `confirmToken`, `clientSecret`…); spec | `lib/redact.ts` |
| E8 | **Retention enquiry**: job pg-boss hằng ngày anonymize enquiry `createdAt` quá `ENQUIRY_RETENTION_MONTHS` (mặc định 18): name → `'[anonymized]'`, email → `anon-<id>@invalid`, phone/message → null hoặc rút gọn, `anonymizedAt` set; cột `enquiries.user_id` nullable (ghi khi có session lúc gửi) để xoá tài khoản kéo theo anonymize ngay (nối vào `deleteAccount` tx của W2) | migration, worker, `account.service.ts` |

### Cụm U — upload & review (ADR-0021 AMEND, ADR-0032 AMEND)

| # | Việc | Nơi |
| --- | --- | --- |
| U1 | **Chữ ký upload khoá chặt**: ký thêm `allowed_formats: 'jpg,jpeg,png,webp,heic,heif'` và incoming `transformation: 'c_limit,w_2400,h_2400'` (Cloudinary lưu bản đã transform → **strip EXIF/GPS** và chặn ảnh khổng lồ), `SignedUploadParamsSchema` mang hai field, web `media-upload.ts`/avatar-upload gửi đủ; unit test chữ ký bằng `api_sign_request` với bộ tham số mới; ghi runbook dashboard "Restricted media types" + "Restricted original access" (không tự động hoá được) | `lib/upload-signing.ts`, contract media, web |
| U2 | **`reviews.retract`**: tác giả rút review đã duyệt → `isApproved=false` + `retractedAt`, requeue ảnh (GC 7 ngày), recompute rating, revalidate `tour:<slug>`; admin queue hiện "retracted by author", không duyệt lại được; `/terms` nói rõ tên hiển thị là tên tài khoản lúc đăng và quyền rút | migration (`retracted_at`), contract, api, web account reviews, admin, i18n |
| U3 | **Requeue chỉ publicId thật sự rời**: xác minh `reviews.update` (đã có comment "requeue chứ không enqueue") bằng int test: update giữ nguyên ảnh → KHÔNG đặt lại đồng hồ GC; gỡ ảnh → requeue đúng publicId | int test (+ vá nếu đỏ) |

### Cụm R — đọc công khai & revalidate (ADR-0037 AMEND 2, ADR-0016 AMEND 3)

| # | Việc | Nơi |
| --- | --- | --- |
| R1 | **`PUBLIC_READ_THROTTLE`** `{ limit: 300, ttl: 60_000 }` theo IP cho GET `@Public()` — `DefaultWriteThrottlerGuard` mở rộng thành `DefaultThrottlerGuard`: GET public đếm bucket đọc riêng (tên throttler `read`), GET có session không đếm, non-GET giữ như ADR-0037; `KeyedThrottlerStorage` đã theo key; int test probe | `config/throttle.ts`, guard, int test |
| R2 | **`Cache-Control` cho đọc công khai**: interceptor `PublicCacheInterceptor` gắn `public, s-maxage=60, stale-while-revalidate=300` cho catalog/posts/site-media GET (KHÔNG cho route có session, KHÔNG cho `/api/auth`, `/api/account`, wishlist); web đã ISR nên đây là lớp cho browser/proxy trước Render | api |
| R3 | **Contract siết đọc**: `page.max(10_000)` ở `common.ts`/`catalog.ts`; `escapeLike` cho `search` catalog (helper `lib/like.ts` đã dùng 3 chỗ); `resolveForOwners(ownerType, ids, roles?)` + `select` hẹp cho list chỉ cần `hero` | contract, `catalog.service.ts`, `media.service.ts` |
| R4 | **Throttle `/api/revalidate` (nợ W3)**: bộ đếm in-memory theo instance trong `revalidate-route.ts` (hàm thuần `RevalidateBudget`, 30 call/phút, trả 429 kèm `Retry-After`), ghi rõ "giảm nhiễu, không phải rate-limit thật vì serverless nhiều instance"; API `WebRevalidationService` coi 429 là lỗi tạm (log warn, không retry — như hiện tại) | web, spec |

### Cụm C — CSP report (ADR-0038 AMEND 2, nợ W3)

| # | Việc | Nơi |
| --- | --- | --- |
| C1 | **Endpoint nhận báo cáo**: `POST /api/csp-report` (`@Public()`, `WEBHOOK_THROTTLE` theo IP), nhận cả `application/csp-report` (report-uri) lẫn `application/reports+json` (report-to) — hook 415 của W2 ở `bootstrap.ts` phải **miễn** path này (cùng nhóm với `/api/webhooks/`); body cắt 8 KB; log MỘT dòng cấu trúc `csp-report {app, directive, blockedUri, documentUri, sample}` có dedupe theo (directive, blockedUri) 10′ trong process để không bão log; trả 204; không lưu DB (chưa cần) | api |
| C2 | **Hai app phát `report-uri` + `report-to`**: `Reporting-Endpoints: csp="<api>/api/csp-report"` header + directive `report-to csp` + `report-uri <api>/api/csp-report` (fallback browser cũ) ở CSP enforce hiện có; `security-headers.ts` nhận `reportUri`; test map directive cập nhật; **không** đổi sang Report-Only (CSP đã enforce từ W3 và đã nghiệm thu) | web + admin `security-headers.ts`, `next.config.ts`, `proxy.ts` |

**Không làm ở W4 (cố ý):** Turnstile/captcha (đổi UX form, quyết riêng khi
thấy spam thật — E1 + throttle + suppression đủ trước); catalogue >50
(`fetchToursAll`, đợt riêng); `AdminAuditLog` (P4f); throttler store chung
nhiều instance (Render single instance, ADR-0037); `LazyMotion` (P7); producer
bust `posts`/`site-media` (thuộc P4e/P4f khi admin sửa nội dung).

## 3. Quyết định cần chốt trong ADR (viết TRƯỚC code)

### 3.1 ADR-0039 mới — "Kênh vào & email đi ra"

- **Ack liên hệ không lặp nội dung khách** và một ack/địa chỉ/ngày: form
  liên hệ không còn là máy gửi thư; admin alert vẫn đầy đủ.
- **Consent hai bước** cho newsletter: row Subscriber chưa confirm = "đã xin",
  không phải "đã đồng ý"; mọi gửi hàng loạt tương lai chỉ tới `confirmedAt`
  không null. Welcome cũ đổi thành thư xác nhận (cùng template khung, khác
  CTA). Người đã subscribe TRƯỚC W4 (chưa có confirmedAt) — migration backfill
  `confirmedAt = createdAt` (họ đã nhận welcome, đã có consent theo luật cũ);
  ghi rõ đây là quyết định một lần.
- **Token có mục đích**: format, danh sách purpose, exp, và ngày ngừng nhận
  v0 (đề xuất 31/12/2026 — mọi email cũ đã quá 30 ngày purge nhưng khách vẫn
  có thể giữ mail).
- **Outbox bền**: backoff luỹ thừa trần 60′, 4xx-không-retry, `MAX_ATTEMPTS`
  giữ; **suppression** là nguồn sự thật thứ hai bên cạnh `unsubscribedAt`:
  drain kiểm cả hai; admin thấy lý do; không tự xoá suppression (operator
  gỡ tay khi khách xác nhận địa chỉ sống).
- **Retention enquiry** 18 tháng, anonymize chứ không xoá (giữ thống kê
  lead), `userId` để xoá tài khoản kéo theo. Đếm theo ngày lịch UTC như
  ADR-0030.

### 3.2 ADR-0021 AMEND — chữ ký upload

Chữ ký Cloudinary chỉ phủ tham số, không phủ endpoint `/<resource_type>/upload`
— mọi tham số ràng buộc phải NẰM TRONG chữ ký: `allowed_formats` (chặn
video/raw/file bất kỳ kể cả qua endpoint khác), incoming `transformation`
(bản lưu là bản đã xử lý → EXIF/GPS bị strip, khổ trần 2400). Hai thiết lập
dashboard (Restricted media types, Restricted original access) là lớp hai,
ghi runbook + checklist deploy v1 §7.

### 3.3 ADR-0032 AMEND — `reviews.retract`

Tác giả rút được review đã duyệt (không sửa, không xin duyệt lại) — trạng
thái mới `retractedAt`; ảnh requeue GC; rating recompute; admin thấy lý do
"retracted by author". Tên hiển thị: giữ snapshot lúc đăng, `/terms` nói rõ.

### 3.4 ADR-0037 AMEND 2 — trần ĐỌC công khai

GET `@Public()` đếm bucket `read` 300/60s theo IP (không session); GET có
session không đếm (khách đã đăng nhập là đối tượng của trần ghi); admin GET
không đếm. Lý do con số: `/tours` + detail + related ≈ 6 call/trang, 300/phút
là ~50 trang/phút một IP — người thật không tới, script cào thì chạm.
`Cache-Control` đọc công khai là lớp giảm tải song song.

### 3.5 ADR-0038 AMEND 2 — `report-to`

Endpoint ở API (một nơi cho cả hai app), log cấu trúc có dedupe, không lưu DB
tới khi thấy cần; `report-uri` giữ song song cho browser cũ; body cắt 8 KB;
KHÔNG trả gì ngoài 204. Hook 415 của W2 miễn path này (báo cáo CSP là
`application/csp-report`, không phải JSON).

### 3.6 ADR-0016 AMEND 3 — throttle revalidate

Bộ đếm theo instance là "giảm nhiễu" — nói thẳng giới hạn (serverless nhân
trần theo instance); rate-limit thật là việc của một store chung, chưa cần.

## 4. Ràng buộc kỹ thuật đã đo — đừng đo lại

- **W2 hook 415** (`bootstrap.ts` `onRequest`): mọi ghi non-JSON ngoài
  `/api/auth/` và `/api/webhooks/` bị 415 — C1 phải đặt route dưới
  `/api/webhooks/csp-report` HOẶC thêm exemption; chọn `/api/webhooks/csp-report`
  cho khỏi sửa hook (và Resend webhook E6 cũng ở `/api/webhooks/resend`).
- **`DefaultWriteThrottlerGuard`** (W2) nhận `@Throttle` per-route qua
  metadata, storage `KeyedThrottlerStorage` theo key, `generateKey` thêm
  pathname cho handler wildcard — R1 mở rộng guard này, đừng thêm guard thứ hai.
- **Outbox purge** `purgeSent(RETENTION_DAYS=30)` xoá SENT/SKIPPED có
  `processedAt` — E2 không được dựa vào outbox làm bằng chứng.
- **`dedupeKey`** có `@unique`; quy ước ở `docs/conventions/outbox-dedupe-key.md`
  — E1 đổi khuôn key cho `ENQUIRY_RECEIVED` phải cập nhật doc đó.
- **Chữ ký Cloudinary**: `api_sign_request` ký MỌI tham số truyền vào (trừ
  `file`, `api_key`, `resource_type`, `cloud_name`); client phải gửi đúng
  từng tham số đã ký — thiếu/thừa là 401. `allowed_formats` gửi dạng chuỗi
  phẩy; `transformation` dạng chuỗi.
- **Resend webhook**: ký svix (`svix-id`, `svix-timestamp`, `svix-signature`),
  secret `whsec_…`; dùng gói `svix` hoặc tự HMAC theo tài liệu; body RAW cần
  `rawBody` (Nest đã bật `rawBody: true` từ P2 cho Stripe).
- **pg-boss** đã có cron pattern (`start-worker.ts`: pending sweep, purge,
  media GC) — E8 chép khuôn, `retryLimit: 0`, `policy: 'short'`.
- **RLS backstop**: bảng mới `email_suppressions` phải bật RLS trong cùng
  migration — `scripts/check-rls.sh` trong CI sẽ đỏ nếu quên.
- **Migration**: một file `2026MMDD_w4_inbound_channels` gom mọi cột/bảng;
  KHÔNG sửa migration cũ; apply docker `tourism` + `tourism_test`; ghi "CHƯA
  deploy Supabase" — deploy lúc merge (nếp W1/W2).
- **i18n**: mọi copy mới (thư xác nhận, trang confirm, retract, privacy link)
  vào `@tourism/i18n`, template email trong `worker/emails` đọc từ đó.

## 5. Test bắt buộc

- E1 int: hai enquiry cùng email cùng ngày → một `ENQUIRY_RECEIVED`, hai
  `ENQUIRY_ADMIN_ALERT`; template ack không chứa `message`.
- E2 int: subscribe → drain → purge → subscribe → không welcome mới;
  `welcomeSentAt` set trong tx (rollback khi outbox lỗi).
- E3 int: confirm token đúng → `confirmedAt`; sai/hết hạn → 400; claim hai
  lần → idempotent; admin list lọc confirmed.
- E4 unit: v1 purpose sai → false; resubscribe hết hạn → false; v0 chỉ cho
  unsubscribe; timing-safe.
- E5 unit + int: 4xx → FAILED ngay; 5xx → `nextAttemptAt` tăng luỹ thừa;
  drain bỏ qua row chưa tới giờ; retry admin reset.
- E6 int: webhook chữ ký sai → 400; bounced → suppression; drain SKIP row tới
  địa chỉ suppressed với lý do.
- E7 unit: `UnsubscribeToken`, `clientSecret`, `X-Api-Key` bị che.
- E8 int: job anonymize đúng ngưỡng, không đụng row mới; deleteAccount kéo
  theo enquiry của user.
- U1 unit: chữ ký khớp `api_sign_request` với `allowed_formats` +
  `transformation`; contract schema có field; web gửi đủ (spec fetch-options).
- U2 int: retract → isApproved false, requeue ảnh, rating recompute, revalidate
  tag; không retract review của người khác (404).
- U3 int: update giữ ảnh không requeue.
- R1 int: 300 GET public → 429; GET có session không đếm; non-GET giữ.
- R2 e2e: header `Cache-Control` đúng trên `/api/tours`, KHÔNG trên
  `/api/account/me`.
- R3 unit/int: `page` 10 001 → 400; search `%`/`_` không thành wildcard.
- R4 unit: 31 call/phút → 429 + `Retry-After`.
- C1 int: `application/csp-report` → 204, không 415; body 9 KB → 413; dedupe log.
- C2 unit: map directive có `report-to csp` + `report-uri`, `Reporting-Endpoints`
  header có mặt ở cả hai app.

## 6. Nghiệm thu tay ở session gốc (trước merge)

Session gốc quét headless (nếp W3) `curl -sI` hai app có `Reporting-Endpoints`
và directive report; API `POST /api/webhooks/csp-report` bằng curl → 204 và
một dòng log. User kiểm bằng tay với tài khoản test: gửi form liên hệ → ack
KHÔNG lặp nội dung; đăng ký newsletter → nhận thư xác nhận → bấm → trang
confirm; link huỷ đăng ký trong email CŨ (nếu còn) vẫn chạy; upload avatar
jpg OK, chọn file `.mp4`/`.pdf` bị từ chối; rút một review đã duyệt → biến
khỏi trang tour sau vài giây, admin queue hiện "retracted".

## 7. Đầu ra bắt buộc của session thi công

Commit đầu là `docs(adr)`: ADR-0039 mới + AMEND ADR-0021/0032/0037/0038/0016
(README map theo luật 13). Mỗi mục §2 một commit Conventional tiếng Việt có
dấu, không AI attribution. Migration MỚI một file, apply docker local +
`tourism_test`, ghi "CHƯA deploy Supabase". Kết thúc: `pnpm gate:int` trọn
(API tạm :3001 trên docker DB theo công thức CI; 3001 bận là API dev của user
→ 3011 + `--env-mode=loose`), `scripts/check-rls.sh` xanh, entry CHANGELOG
"W4 kênh vào — CHƯA merge, chờ review session riêng" (ngày · hash · nội dung ·
test · CÒN TREO), README trạng thái W4, `render.yaml` + `.env.example` API
thêm KEY `RESEND_WEBHOOK_SECRET`, `ENQUIRY_RETENTION_MONTHS` (chỉ key). Báo
cáo ghi rõ **env nào user phải đặt trên Render** và **hai thiết lập dashboard
Cloudinary** trước khi merge.
