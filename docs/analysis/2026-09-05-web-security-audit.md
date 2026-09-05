# Rà bảo mật + thiết kế web theo cụm tính năng — 05/09/2026

- **Chụp tại:** main `833d039` (sau merge nhánh `fix/p4c-backend-logic`).
- **Cách làm:** 8 mũi đọc-chỉ, mỗi mũi một CỤM tính năng, đặt mình ở vị trí kẻ
  tấn công muốn trục lợi rồi suy ra fix đúng tầng; 27 khẳng định nặng nhất
  được verify chéo bởi 3 mũi độc lập — **27/27 CONFIRMED**. Không sửa gì.
- **Đọc thế nào:** mỗi cụm có (1) chuỗi tính năng, (2) phát hiện theo mức, (3)
  đã kiểm sạch. Cuối file là đề xuất chia ĐỢT VÁ (mỗi đợt một nhánh/session).
- Mức: **Nghiêm trọng** = mất tiền/chiếm tài khoản/khoá site rẻ tiền · **Cao** =
  lộ dữ liệu hoặc hỏng nghiệp vụ thật · **Vừa** = lưới thiếu, cần điều kiện ·
  **Thấp** = vệ sinh, nợ.

## Cụm 1 — Auth & tài khoản

Chuỗi: đăng ký + OTP (`requireEmailVerification`, `autoSignIn:false`) → đăng
nhập / Google OAuth → phiên (cookie `.nexora-travel.agency`, `httpOnly`,
`Lax`, 7 ngày) → quên/đổi mật khẩu → avatar (ký Cloudinary) → xoá tài khoản
(tombstone) → `ADMIN_EMAILS` promote sau verify.

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| **Cao** | Đổi/đặt lại mật khẩu KHÔNG thu hồi phiên cũ — kẻ cầm cookie giữ quyền vô thời hạn (cookie tự gia hạn) | `auth.config.ts` thiếu `revokeSessionsOnPasswordReset`; web `changePassword` thiếu `revokeOtherSessions` | 2 dòng cấu hình + 1 int test "reset xong cookie cũ → 401" |
| **Cao** | `DELETE /api/account` chỉ cần cookie: không đòi mật khẩu/fresh session, không kiểm booking PAID/refund mở → tombstone không hoàn tác | `account.controller.ts`, `account.service.ts deleteAccount` | Đòi xác thực lại; chặn khi còn booking PAID/request mở (mã lỗi riêng); xoá `verification` treo trong cùng tx |
| Vừa | Better Auth tính IP riêng, không biết `TRUST_PROXY` → XFF ≥2 hop là MỌI người chung một bucket 3 req/10s cho `/sign-in` (ai cũng khoá được đăng nhập cả site) | `auth.config.ts advanced` thiếu `ipAddress.trustedProxies` | Khai từ cùng nguồn `TRUST_PROXY`; grep log BA "falling back to a single shared per-path bucket" để biết đang ở nhánh nào |
| Vừa | Toàn bộ chống brute-force `/api/auth/*` treo vào `NODE_ENV==='production'` (BA `rateLimit.enabled ?? isProduction`), storage RAM một tiến trình | `auth.controller.ts` không ThrottlerGuard | `rateLimit.enabled: true` tường minh + `@Throttle` riêng cho AuthController |
| Vừa | User enumeration ở sign-up và `check-verification-otp` (forgot-password thì sạch) — chính sách tự mâu thuẫn | `auth-errors.ts:41` | Quyết định + ghi ADR: chấp nhận ở sign-up (chuẩn ngành) hay ẩn |
| Thấp | `updateUser({image})` vẫn mở dù JSDoc nói "đường avatar đóng" | `account.service.ts:23` | Hook `user.update.before` bác `image` ngoài host Cloudinary |
| Thấp | Cookie cha `.nexora-travel.agency` không dùng được `__Host-`; subdomain mồ côi = hứng cookie / cookie tossing | ADR-0026 | Kỷ luật DNS + ghi rủi ro vào ADR-0026 (hiện chỉ ghi lợi) |
| Thấp | Erasure chưa trọn: `booking.contact*` giữ PII, `verification` treo → link reset cũ tạo lại Account cho user tombstone; copy "30 minutes" nhưng token reset sống 60 phút | `account.service.ts:66-96` | `verification.deleteMany` trong tx; quyết PII booking; `resetPasswordTokenExpiresIn: 1800` |

Sạch: promote ADMIN chỉ sau `emailVerified` (SEC-1); `role`/`deletedAt` `input:false`; OAuth linking không chiếm tài khoản chưa verify; OTP 5 lần sai huỷ mã; reset token một lần; CSRF Better Auth (Origin check + `trustedOrigins`); open redirect chặn (`safe-redirect.ts`); avatar folder theo `callerId`; IDOR booking owner-or-404; đường leo lên admin chặn ba lớp (proxy → layout → `@Roles`); credential auth được `redactDeep` ở admin outbox.

## Cụm 2 — Đặt tour → checkout → thanh toán (money-path)

Chuỗi: wizard 4 bước (authed) → `bookings.create` PENDING (giá tính lại từ DB, không giữ ghế) → mint session Stripe/PayPal 60′ → webhook (HMAC/verify) → CTE claim ghế + outbox trong MỘT statement → sweep PENDING 65′.

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| **Nghiêm trọng** | Capture THỨ HAI trên cùng booking bị nuốt im lặng: `reCheckout` mint session mới mỗi lần, không expire session cũ (trái ADR-0006 "trả session hiện có"); `handleEvent` không có nhánh cho `'already-paid'` → khách bị trừ tiền hai lần, không refund, không cảnh báo | `bookings.service.ts:401-434`, `payments.service.ts:132-145` | (i) `reCheckout` trả session còn sống hoặc `expireSession()` ở provider trước khi mint (thêm vào `PaymentGateway`); (ii) `'already-paid'` với `providerPaymentId` khác → auto-refund key `dup-capture:<providerPaymentId>` + log error; đổi guard `issueFullAutoRefund` sang theo `providerPaymentId` |
| **Cao** | `checkout.session.expired` của session CŨ huỷ booking đang trả qua session MỚI (`cancelExpiredPending` theo bookingId, `VerifiedEvent` không mang session id); sweep tính TTL theo `created_at` chứ không theo lần mint gần nhất | `payments.service.ts:154-186`, `pending-sweep.service.ts:36` | `VerifiedEvent.sessionId` + gate `provider_session_id = $sessionId`; sweep neo `GREATEST(created_at, session_minted_at)` |
| Vừa | Không đối chiếu `amount`/`currency` của event với `booking.totalAmount` trước khi flip PAID (dữ liệu đã ghi vào `payment_events` mà không ai đọc) | `payments.service.ts:116-167` | So trước `claimSeatsForPaid`; lệch → không PAID, log error + outbox alert |
| Vừa | Webhook PayPal `@Public()`, không throttle, gọi PayPal verify (network) TRƯỚC mọi kiểm rẻ → DoS ẩn danh đốt quota, delivery thật fail → booking kẹt PENDING → sweep huỷ | `webhooks.controller.ts:61-88` | Kiểm 5 header `paypal-transmission-*` + parse body trước; `@Throttle` rộng tay; body 400 mã cố định |
| Vừa | `maxGroupSize` chỉ ép ở trình duyệt; contract không trần `numAdults/numChildren`; server chỉ kiểm ghế | `schemas/bookings.ts:48`, `bookings.service.ts:291` | Kiểm ở `create` (đã join tour) → `PARTY_TOO_LARGE`; `.max()` ở contract |
| Vừa | Mọi endpoint ghi đã-auth không có trần: `bookings.create/checkout` (mỗi lần = 1 session provider), `reviews.create/update`, `wishlist.set`, avatar, delete account | `config/throttle.ts` cố ý opt-in | `AUTHED_WRITE_THROTTLE` theo `user.id`; cân nhắc ThrottlerGuard toàn cục + `@SkipThrottle` vùng đọc |
| Thấp | `resolveGateway` ngoài try → provider chưa cấu hình = 500 mù + PENDING mồ côi | `bookings.service.ts:353` | Resolve trước insert / `CheckoutFailedError`; catalog công bố provider khả dụng |
| Thấp | Claim PAID không nhìn `tour_departures.status`/`start_date` → capture muộn xác nhận chuyến đã CLOSED (bẫy chờ phase /tours) | `bookings.service.ts:672-711` | Gate `d.status='OPEN' AND start_date>=current_date` → outcome `departure-closed` → auto-refund |

Sạch: giá không sửa được từ client; `numAdults≥1`; IDOR `byCode`/`mine` owner-or-404; Stripe HMAC `timingSafeEqual` ±5′, raw body; replay `@@unique(provider,eventId)`; oversell chặn bằng CHECK + CTE; cancelled→auto-refund với advisory lock; không lộ secret provider; log không PAN; `trustProxy` danh sách.

## Cụm 3 — Sau khi mua: huỷ/hoàn phía khách, review + ảnh

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| **Cao** | Lý do huỷ toàn khoảng trắng: input `min(1)` không `.trim()`, service trim rồi ghi `''`, output `min(1)` → oRPC 500 "Output validation failed" ở chính `bookings.cancel` (row ĐÃ insert), `admin.cancellations.list` (cả trang) và `AdminBookingDetail` → một khách khoá hàng đợi duyệt huỷ | `schemas/bookings.ts:306/319/332`, `cancellations.service.ts:183` | `z.string().trim().min(1)` ở contract (khuôn `reviews.ts:61`), bỏ trim ở service; quét mọi free-text `min(n)` khác |
| **Cao** | Chữ ký upload chỉ ký `{folder, public_id, timestamp}` — Cloudinary không ký `resource_type`/`file` → khách đủ điều kiện review upload được raw/video/file bất kỳ (kể cả URL từ xa) lên cloud thương hiệu; `input.ext` bị vứt; bộ dọn enqueue `image` → destroy trả not-found = "xong", file ở lại vĩnh viễn | `lib/upload-signing.ts:52-72`, `upload-signing.service.ts:79` | Ký thêm `allowed_formats` + `resource_type` (hoặc named upload preset), `SignedUploadParamsSchema` mang field mới; bật Restricted media types trên dashboard |
| **Cao** | Ảnh gốc kèm EXIF/GPS công khai: bỏ đoạn `f_auto,q_auto/` khỏi URL review là ra bản gốc (toạ độ khách sạn/nhà) | `cloudinary-url.ts:56-58`, `review-card.tsx:94` | `eager`/incoming transformation strip metadata lúc ký (cùng chỗ với mục trên); Strict transformations / restricted original access cho `reviews/` |
| **Cao** | Cửa hậu ADR-0030 §5: `refundAmount` VẮNG = hoàn TRỌN phần dư không cần lý do, nhánh kiểm chính sách chỉ chạy khi có `refundAmount` → yêu cầu 3 ngày trước khởi hành (bậc 0%) được 100% không dấu vết | `cancellations.service.ts:473-510` | Tính `policyAmount` VÔ ĐIỀU KIỆN; vắng `refundAmount` → mặc định = mức chính sách; mọi lệch đòi `decisionNote`; lưu percent/amount đã hứa lúc request |
| Vừa | Tác giả không rút được review đã duyệt, tên thật snapshot vĩnh viễn, không có `reviews.delete`; xoá tài khoản chỉ lật `authorDeleted` | contract reviews, `review-policy.ts:54` | ADR AMEND 0032: `reviews.retract` (unpublish + requeue ảnh + recompute) hoặc rút gọn `authorName` lúc tạo + nói rõ ở /terms |
| Vừa | `reviews.create/update`, `bookings.cancel` không throttle; `update` mỗi lần `requeue` đặt lại đồng hồ 7 ngày → gọi mỗi 6 ngày giữ ảnh mồ côi sống mãi | `reviews.controller.ts:51,75` | Throttle; `requeue` chỉ cho publicId THẬT SỰ rời danh sách mới |
| Thấp | Ước tính hoàn tiền tính bằng đồng hồ TRÌNH DUYỆT (`new Date()` client) — lệch bậc/ân hạn với server | `booking-actions.tsx:455` | `bookings.byCode` trả `refundEstimate` tính phía server |

Sạch: owner-or-404 bằng userId; một request sống mỗi booking (partial unique, không pre-SELECT); `createdAt` do DB; `paidAt` chỉ webhook ghi; eligibility review dùng chung hàm với ký upload (có 4 int test 403/400/404); `publicId` regex chặn `..`; folder/public_id nằm trong chữ ký; XSS: React escape, không HTML thô; note nội bộ không rò; wishlist scope userId.

## Cụm 4 — Kênh vào từ người lạ: newsletter, liên hệ, email đi ra

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| **Cao** | Form liên hệ = máy gửi thư có nội dung do kẻ lạ điều khiển tới địa chỉ CHƯA xác minh: `ENQUIRY_RECEIVED` tới `input.email`, in nguyên `message` (2000 ký tự), dedupeKey chứa uuid nên không chặn lặp; ~7.200 thư/ngày/IP, đẩy mail reset/booking xuống cuối hàng FIFO 50/phút | `enquiries.service.ts:52-66`, `render-email.tsx:286` | dedupeKey `enquiry-received:<email>:<yyyy-mm-dd>`; bỏ QuoteCard "YOUR MESSAGE" khỏi thư ack (giữ ở admin alert); cân nhắc Turnstile |
| Vừa | Purge outbox 30 ngày phá bất biến "welcome một lần" — sau 31 ngày subscribe lại gửi welcome lần hai, lặp mỗi tháng | `outbox.service.ts:165-172`, `newsletter.service.ts:66-77` | Cột `Subscriber.welcomeSentAt` set trong tx subscribe; int test subscribe→drain→purge→subscribe |
| Vừa | Không double opt-in; row Subscriber là "consent" không có bằng chứng; form không link /privacy | `newsletter.controller.ts` | `CONFIRM_SUBSCRIPTION` dùng lại token HMAC; link privacy dưới form |
| Vừa-Thấp | Token unsubscribe = HMAC(id) không mục đích/hết hạn/version, dùng cho cả `resubscribe` → ai từng thấy link bật lại đăng ký của người đã rút consent, mãi mãi | `unsubscribe-token.ts:10` | Ký kèm mục đích + version; `exp` cho resubscribe; unsubscribe không hết hạn (RFC) |
| Thấp | `redactDeep` khớp khoá chính xác → `unsubscribeToken` hiện nguyên ở admin outbox | `lib/redact.ts:25` | Khớp không phân biệt hoa/thường + hậu tố `token`/`secret` |
| Thấp | Worker không backoff, không phân biệt 4xx/5xx/429; không có webhook Resend bounce/complaint → không suppression | `outbox.service.ts:98-119` | `nextAttemptAt` + backoff; phân loại status; controller webhook Resend (svix) + bảng suppression |
| Thấp | Enquiry giữ PII vĩnh viễn, không retention/erasure, không `userId` dù prefill từ session | `schema.prisma Enquiry` | Job anonymize sau N tháng; quyết `Enquiry.userId` → ADR |
| Thấp | Throttler in-memory per-process, per-handler → scale instance nhân trần; IPv6/proxy pool vô hiệu | `config/throttle.ts` | Ngân sách theo email ở DB + captcha; ghim `numInstances: 1` hoặc store chung |

Sạch: HMAC `timingSafeEqual` + guard độ dài; secret dev bị `superRefine` chặn prod; `ADMIN_EMAILS` rỗng chặn ở boot; header/HTML injection không có (JSON tới Resend, React escape, `subjectText` cắt CR/LF); GET unsubscribeConfirm không side-effect; enumeration chặn; admin controller tách khỏi `@Public()`; CSV injection chặn.

## Cụm 5 — Bề mặt đọc công khai: catalogue, cache, ảnh, SEO

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| **Cao** | `/api/revalidate` phía web nhận secret dev hard-code khi env thiếu/rỗng (không fail-fast như API); 20 tag/lần, không throttle → hard-bust toàn site, dồn tải lên Render/Supabase | `apps/web/src/app/api/revalidate/route.ts:12` | Fail-fast production (gương `env.ts` API); `TAG_RE` thêm `site-media` |
| Vừa | Đường đọc công khai không rate limit, không `Cache-Control` → script vài trăm rps cạn pool Postgres của CÙNG tiến trình chạy money-path + worker inline | `catalog/posts/site-media.controller.ts` | `PUBLIC_READ_THROTTLE`; interceptor `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` |
| Vừa | `page` không `.max()` (OFFSET khổng lồ, vượt i32 → 500); `search` `contains` không `escapeLike` (helper đã có ở `lib/like.ts`, dùng ở 3 chỗ khác) trên cột không index | `schemas/catalog.ts:245`, `catalog.service.ts:135` | `.max(10_000)`; `escapeLike`; index trgm khi search thật |
| Vừa | `remotePatterns pathname '/**'` = mọi cloud name Cloudinary qua optimizer Vercel; thiếu `loaderFile` chèn `w_<width>` mà ADR-0020 §Hệ quả đã yêu cầu (thumbnail 64px tải nguyên bản rồi nén lại) | `next.config.ts:12` | `pathname: '/<cloud>/**'`; `loaderFile`; `minimumCacheTTL` |
| Vừa | Không `metadataBase` → canonical tương đối tự trỏ host đang phục vụ; `robots.ts` allow-all mọi môi trường → preview Vercel/apex crawl được, nội dung trùng | `app/layout.tsx`, `robots.ts` | `metadataBase: new URL(siteUrl())`; robots `disallow: '/'` ngoài production |
| Vừa | Catalogue ghim cứng một trang 50 (bằng đúng trần contract): tour thứ 51 không prerender, không sitemap, không hiện ở `/tours` — im lặng; `/tours` lọc/tìm phía client trên toàn bộ payload | `lib/api/tours.ts:42`, `tours-explorer.tsx` | `fetchToursAll()` lặp `totalPages` cho build; `/tours` lọc bằng query API; related tours truy vấn hẹp |
| Thấp | `resolveForOwners` kéo mọi role/cột cho list chỉ dùng `hero` (~300 row/request) | `media.service.ts:25` | Tham số `roles` + `select` hẹp |

Sạch: `isPublished` ở mọi đường đọc kể cả `_count`, sitemap, related; sort enum + bảng tra; route revalidate còn lại chắc (timing-safe, whitelist, chỉ POST, không path); không cache-poisoning qua Host; giá hiển thị ≠ giá tính tiền; lỗi không lộ stack; tri-state ADR-0016 đúng.

## Cụm 6 — Hạ tầng API xuyên suốt

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| **Cao** | `BETTER_AUTH_URL`/`FRONTEND_URL`/`TRUSTED_ORIGINS`/`COOKIE_DOMAIN` KHÔNG trong `superRefine` production; Render gửi chuỗi rỗng khi ô trống → default localhost, boot xanh; Better Auth suy cờ `Secure` CHỈ từ `baseURL.startsWith('https://')` → cookie mất `Secure` + `__Secure-` trên domain cha | `env.ts:44-58`, better-auth `cookies/index.mjs:21` | superRefine: https bắt buộc, cấm localhost, `COOKIE_DOMAIN` bắt buộc; `advanced.useSecureCookies` làm lưới hai |
| **Cao** | Fastify ghi đè `requestTimeout: 0`/`connectionTimeout: 0` (tắt mặc định 300s của Node) → slow-body giữ socket vô hạn trên instance free kiêm worker inline | `bootstrap.ts:33` | `new FastifyAdapter({ trustProxy, requestTimeout: 30_000, connectionTimeout: 60_000 })` + assert ở `bootstrap.spec.ts` |
| Vừa | (= cụm 1) Better Auth IP riêng, bucket chung khi XFF ≥2 hop | `auth.config.ts advanced` | `ipAddress.trustedProxies` từ `TRUST_PROXY` |
| Vừa | (= cụm 2) webhook PayPal không throttle, I/O trước kiểm rẻ; body 400 lộ `message` | `webhooks.controller.ts:84` | như cụm 2 |
| Vừa-Thấp | `ConsoleDeliverer` log nguyên payload: URL reset (token) + OTP — lưới duy nhất là env `RESEND_API_KEY` | `worker/deliverer.ts:22` | `redactDeep(payload)` một dòng |
| Thấp | Container chạy root | `apps/api/Dockerfile` | `USER node` |
| Thấp | oRPC `onError` `console.error` dump object (cause chứa dữ liệu response bị từ chối = PII), không qua `captureException` | `app.module.ts:36` | Logger + message/code; `captureException` |
| Thấp | RLS thiếu ở 2 bảng mới (`enquiry_status_events`, `tour_cost_items`) — backstop cho đường anon | migrations | Migration MỚI `ENABLE ROW LEVEL SECURITY`; script CI đối chiếu `pg_class.relrowsecurity` |

Bảng controller × guard: 23 controller, **không cái nào thiếu guard**; 9/9 admin `@Roles(ADMIN)` cấp class. Sạch: 0 `$queryRawUnsafe`, 13 raw đều `Prisma.sql` bound param; 500 không lộ Prisma text; body limit 1MB; CORS allowlist; helmet; `trustProxy` không spoof được; health không lộ version; secret không trong repo/image/CI; `.env.example` ↔ `env.ts` khớp; `pnpm audit` sạch; worker không crash loop.

Hardening đáng làm: gỡ `@UseGuards(AuthGuard)` thừa ở 12 controller (AuthGuard đã là `APP_GUARD` → mỗi request đọc session HAI lần); xác minh IP ingress Render rồi khai `TRUST_PROXY` trong `render.yaml`; ghim `numInstances: 1` (throttle in-memory); bật access log; đóng seam Sentry hoặc bỏ nhánh gây hiểu lầm; bổ sung env thiếu vào `render.yaml` (`MEDIA_GC_*` → bộ dọn ảnh đang TẮT ở prod, `TRUST_PROXY`, `MARGIN_TAX_RATE`…); một luật cho log PII (honeypot đang log email thô).

## Cụm 7 — Vỏ Next của `apps/web`

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| **Cao** | (= cụm 5) `/api/revalidate` secret dev fallback | `route.ts:12` | fail-fast |
| Vừa | Không một security header nào (CSP, `frame-ancestors`, Referrer-Policy, nosniff, HSTS) dù API đã ghi "CSP là hợp đồng của web" → clickjacking nút Pay/Cancel trên `/account/bookings/[code]` | `next.config.ts` không `headers()` | `headers()`; script theme inline dùng hash/nonce; bật NGAY khi chưa có third-party script |
| Vừa | 6 trang `(auth)` không `robots.index=false` dù `robots.ts` giả định có → `/reset-password?token=…`, `/verify-email?email=…` index được | `(auth)/*/page.tsx` | `(auth)/layout.tsx` export metadata robots |
| Vừa | `apiOrigin()` chạy trong bundle browser với nhánh `API_URL` không bao giờ tồn tại → cấu hình `.env.example` mô tả (API_URL riêng) làm SSR xanh, MỌI nút ghi từ browser bắn tới localhost | `lib/api/env.ts:9`, `client.ts:100` | Tách `serverApiOrigin`/`browserApiOrigin`, không fallback localhost ở production; test |
| Thấp-Vừa | Nhánh browser của `withAuthOptions` thiếu `cache: 'no-store'` (JSDoc bắt buộc, nhánh server có) → dữ liệu per-user vào HTTP cache/bfcache | `client.ts:63-70` | Một từ |
| Thấp | `window.location.assign(booking.checkoutUrl)` không kiểm scheme | `booking-wizard.tsx:128`, `booking-actions.tsx:283` | Guard `https:` cạnh check hiện có |
| Thấp | Copy hard-code ngoài i18n: `login-form` (5), `two-factor-form` (6), `share-row` (3), `contact-location` (1) | — | Đẩy vào `@tourism/i18n` |

Sạch: 0 server action; XSS không có sink (markdown không `rehype-raw`, JSON-LD escape `<`); open redirect chặn; SSRF không có; error boundary không lộ; cache per-user không rò (`cookies()` → dynamic, không `unstable_cache`); auth guard hai lớp mọi trang authed; validation dùng chung contract; localStorage chỉ theme; 0 `console.*`; `target=_blank` có `rel`; a11y cơ bản ổn; tokens-only.

Tối ưu: `LazyMotion` + `domAnimation` (15 component import full `motion`); gộp header + noindex thành một task vỏ shell; `X-Robots-Tag`/`no-store` cho `/api/revalidate`.

## Cụm 8 — Ranh giới admin ↔ web (cookie chung)

| Mức | Phát hiện | Nơi | Fix đúng tầng |
| --- | --- | --- | --- |
| Vừa | Cookie cha + `TRUSTED_ORIGINS` kiêm CORS + không CSP ở cả hai app = một XSS ở www là chiếm trọn 25 endpoint admin (kể cả refund) khi nạn nhân là admin | `auth.config.ts:115`, `bootstrap.ts:69`, cả hai `next.config.ts` | CSP ở web (cắt gốc); tách `CORS_ORIGINS` khỏi `TRUSTED_ORIGINS` (www không cần gọi `/api/admin/*`); ghi blast radius vào ADR-0026 |
| Vừa | `guardExportAccess` — lớp gác duy nhất cho 3 route xuất PII — không có test nào; xoá dòng `if (!gate.ok)` mà suite vẫn xanh | `lib/export-route.ts:27` | `export-route.spec.ts` 4 ca + 1 test/route |
| Vừa | Không tồn tại đường hạ quyền/thu hồi phiên admin (chỉ promote); cookie 7 ngày, không cookieCache → thu hồi = SQL tay | `admin-bootstrap.ts` | P4f: `admin.users.setRole` (không tự hạ, không hạ admin cuối) + `revokeSessions`; hoặc runbook SQL trong ADR-0026 |
| Thấp | Proxy admin không là biên cho server action: POST `Next-Action` tới `/login` (path public) vẫn chạy action (API 401, không leo thang) | `proxy.ts`, `admin-gate.ts` | Ghi luật "không đặt luật quyền ở proxy"; tuỳ chọn 401 POST không cookie |
| Thấp | Vết audit chỉ ở stdout; `getPaymentEventAction` (đọc nhạy nhất) không log; `outbox.retry` không actor | `export-route.ts:63`, `payment-events/actions.ts` | Bảng `AdminAuditLog` hoặc tối thiểu `adminId` trong log |
| Thấp | (= cụm 6) `COOKIE_DOMAIN`/`TRUSTED_ORIGINS` không bắt buộc ở prod | `env.ts` | superRefine |
| Thấp | Layout không re-render khi điều hướng mềm → admin bị thu hồi thấy `error.tsx` chung thay vì `/not-authorized`; `'/'` hard-code | `(admin)/layout.tsx:12` | `error.tsx` nhận 403 → `/not-authorized` |
| Thấp | `resolveApiOrigin` admin không ép `https:` → `API_URL` sai trên Vercel = exfiltrate cookie admin mọi request | `lib/api/env.ts` | `new URL()` + ép https ở production |

Sạch: 25/25 procedure admin sau guard cấp class; CUSTOMER tới admin bị chặn đúng; CSRF server action chặn (Origin ≠ Host abort); `role` không set từ client; xoá tài khoản = thu hồi phiên ngay; danh tính hành vi ghi từ session; cache stats không rò; test 401/403 ở 8/9 nhóm admin; RLS 33 bảng (backstop, ghi rõ).

Hardening: `noindex` cho `admin.` (không có `robots.ts`); rút tuổi thọ phiên / `freshAge` trước hành vi tiền; test 401/403 cho `adminList` reviews; `proxy.spec.ts` cả hai app; SEC-1 ghi thành mục tường minh ở ADR-0026 (4 điều kiện chấp nhận); nếu bật Google OAuth ở prod: `disableImplicitLinking` + promote ở hook social.

## Đề xuất chia ĐỢT VÁ (mỗi đợt một nhánh/session, review 8 mũi tại session gốc)

| Đợt | Nhánh | Nội dung | Vì sao gom vậy |
| --- | --- | --- | --- |
| **W1 — tiền** | `fix/web-money-path` | Cụm 2 (8 mục) + cụm 3 mục lý-do-huỷ, cửa-hậu-refundAmount, throttle ghi đã-auth | Cùng file `payments/bookings/cancellations`, cùng ADR-0006/0029/0030 (cần AMEND trước code); tất cả có int spec sẵn khuôn |
| **W2 — phiên & hạ tầng** | `fix/auth-infra-hardening` | Cụm 1 (Cao ×2, Vừa ×3), cụm 6 (Cao ×2 + 5 Thấp), cụm 8 mục CORS tách, runbook demote, export-route spec, Dockerfile, RLS migration mới | Hầu hết là cấu hình `env.ts`/`auth.config.ts`/`bootstrap.ts` + test; một migration RLS |
| **W3 — vỏ Next** | `fix/web-shell-headers` | Cụm 7 toàn bộ + cụm 5 mục revalidate/`metadataBase`/robots/remotePatterns/loader + cụm 8 mục noindex admin, `error.tsx` 403, `resolveApiOrigin` | Toàn bộ nằm ở `next.config.ts`/layout/lib của hai app Next, không đụng API |
| **W4 — nội dung & kênh vào** | `fix/inbound-channels` | Cụm 4 toàn bộ + cụm 3 mục ký upload/EXIF/requeue + cụm 5 mục throttle đọc/Cache-Control/page/escapeLike/roles | Cùng miền media/newsletter/enquiry/catalog; cần 1 migration (`welcomeSentAt`) và ADR nhỏ cho retention/retract |
| **Sau** | riêng | Outbox backoff + webhook Resend; catalogue >50 (`fetchToursAll`, `/tours` server-side); `AdminAuditLog`; P4f users | Mỗi cái đủ lớn cho ADR riêng |

Thứ tự khuyên: W1 → W2 → W3 → W4. W1 và W2 chạm tiền và phiên — hai thứ kẻ tấn công thử trước.
